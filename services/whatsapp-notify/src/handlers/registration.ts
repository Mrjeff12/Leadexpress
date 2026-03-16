import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type Redis from 'ioredis';
import type { Logger } from 'pino';
import { config } from '../config.js';
import { sendText } from '../interactive.js';
import { PROFESSIONS } from './onboarding.js';
import { getCitiesByState, getAllZipsForCities } from '../city-zips.js';

const supabase: SupabaseClient = createClient(config.supabase.url, config.supabase.serviceKey);

// ── Redis key prefixes & TTLs ───────────────────────────────────────────────

const REGISTER_PREFIX = 'le:wa-register:';
const REGISTER_TTL = 3600; // 1 hour
const LOCK_PREFIX = 'le:wa-lock:';
const LOCK_TTL = 30; // 30 seconds

// ── Registration state ──────────────────────────────────────────────────────

export type RegistrationStep =
  | 'profession'
  | 'state_select'
  | 'city'
  | 'name'
  | 'email'
  | 'confirm';

export interface WaRegistrationState {
  phone: string;
  step: RegistrationStep;
  professions: string[];
  stateName: string;
  cities: string[];
  zipCodes: string[];
  fullName: string;
  email: string;
}

// ── Redis helpers ───────────────────────────────────────────────────────────

export async function getRegistrationState(redis: Redis, phone: string): Promise<WaRegistrationState | null> {
  const raw = await redis.get(`${REGISTER_PREFIX}${phone}`);
  if (!raw) return null;
  return JSON.parse(raw) as WaRegistrationState;
}

export async function setRegistrationState(redis: Redis, phone: string, state: WaRegistrationState): Promise<void> {
  await redis.set(`${REGISTER_PREFIX}${phone}`, JSON.stringify(state), 'EX', REGISTER_TTL);
}

export async function clearRegistrationState(redis: Redis, phone: string): Promise<void> {
  await redis.del(`${REGISTER_PREFIX}${phone}`);
}

export async function acquireLock(redis: Redis, phone: string): Promise<boolean> {
  const result = await redis.set(`${LOCK_PREFIX}${phone}`, '1', 'EX', LOCK_TTL, 'NX');
  return result === 'OK';
}

export async function releaseLock(redis: Redis, phone: string): Promise<void> {
  await redis.del(`${LOCK_PREFIX}${phone}`);
}

// ── Rate limiting ───────────────────────────────────────────────────────────

const RATE_LIMIT_KEY = 'le:wa-register-count';
const RATE_LIMIT_MAX = 50;
const RATE_LIMIT_WINDOW = 3600;

export async function checkRateLimit(redis: Redis): Promise<boolean> {
  const count = await redis.incr(RATE_LIMIT_KEY);
  // Always set expiry to self-heal if a previous EXPIRE was missed
  await redis.expire(RATE_LIMIT_KEY, RATE_LIMIT_WINDOW);
  return count <= RATE_LIMIT_MAX;
}

// ── Opt-out ─────────────────────────────────────────────────────────────────

export async function isOptedOut(phone: string): Promise<boolean> {
  const { data } = await supabase
    .from('wa_opt_outs')
    .select('phone')
    .eq('phone', phone)
    .maybeSingle();
  return !!data;
}

export async function recordOptOut(phone: string): Promise<void> {
  await supabase
    .from('wa_opt_outs')
    .upsert({ phone, opted_out_at: new Date().toISOString() });
}

// ── Email validation ────────────────────────────────────────────────────────

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email.trim().toLowerCase());
}

// ── Selection parser ───────────────────────────────────────────────────────

function parseSelections(
  text: string,
  options: readonly { key: string; label: string }[],
): string[] {
  const trimmed = text.trim().toLowerCase();

  // Try number parsing: "1, 3, 6"
  const numbers = trimmed.match(/\d+/g)?.map(Number) ?? [];
  if (numbers.length > 0) {
    return numbers
      .filter((n) => n >= 1 && n <= options.length)
      .map((n) => options[n - 1].key);
  }

  // Try keyword matching: "hvac, plumbing"
  const words = trimmed.split(/[,\s]+/).filter(Boolean);
  const matched = words
    .map((w) => options.find((o) => o.key.includes(w) || o.label.toLowerCase().includes(w)))
    .filter(Boolean)
    .map((o) => o!.key);

  return [...new Set(matched)];
}

// ── Positive response check ────────────────────────────────────────────────

function isPositive(text: string): boolean {
  const positiveWords = ['yes', 'y', 'yeah', 'yep', 'ok', 'sure', 'confirm', 'כן', '1', '👍'];
  return positiveWords.some((w) => text.includes(w));
}

// ── Step number helper ─────────────────────────────────────────────────────

function stepNumber(step: RegistrationStep): number {
  const map: Record<RegistrationStep, number> = {
    profession: 1,
    state_select: 1,
    city: 2,
    name: 3,
    email: 4,
    confirm: 4,
  };
  return map[step];
}

// ── Profession list prompt ─────────────────────────────────────────────────

function professionPrompt(): string {
  return PROFESSIONS.map(
    (p, i) => `${i + 1}️⃣ ${p.emoji} ${p.label}`,
  ).join('\n');
}

// ── Start registration ─────────────────────────────────────────────────────

export async function startRegistration(
  phone: string,
  redis: Redis,
  log: Logger,
): Promise<void> {
  // Rate-limit new registrations globally
  if (!(await checkRateLimit(redis))) {
    await sendText(phone, `We're experiencing high demand. Please try again in a few minutes.`, log);
    return;
  }

  const state: WaRegistrationState = {
    phone,
    step: 'profession',
    professions: [],
    stateName: '',
    cities: [],
    zipCodes: [],
    fullName: '',
    email: '',
  };
  await setRegistrationState(redis, phone, state);

  await sendText(
    phone,
    `Welcome to LeadExpress! 👋\n\nLet's get you set up in under 2 minutes.\n\n*Step 1/4:* What type of work do you do?\nReply with the numbers of your trades:\n\n${professionPrompt()}\n\nExample: *1, 6* for HVAC and Plumbing`,
    log,
  );
}

// ── Main step dispatcher ───────────────────────────────────────────────────

export async function handleRegistrationStep(
  phone: string,
  text: string,
  redis: Redis,
  log: Logger,
): Promise<boolean> {
  const state = await getRegistrationState(redis, phone);
  if (!state) return false;

  const trimmed = text.trim().toLowerCase();

  // ── Global commands ────────────────────────────────────────────────────
  if (trimmed === 'stop' || trimmed === 'unsubscribe' || trimmed === 'cancel') {
    await clearRegistrationState(redis, phone);
    await recordOptOut(phone);
    await sendText(
      phone,
      `You've been unsubscribed. You won't receive any more messages from LeadExpress.\n\nIf you change your mind, send us a message anytime.`,
      log,
    );
    return true;
  }

  if (trimmed === 'redo' || trimmed === 'start over') {
    await clearRegistrationState(redis, phone);
    await startRegistration(phone, redis, log);
    return true;
  }

  if (trimmed === 'menu' || trimmed === 'help') {
    const sn = stepNumber(state.step);
    await sendText(
      phone,
      `You're on step ${sn}/4 of registration.\n\nSend CONTINUE to resume or REDO to restart.\n\nCommands:\n• *REDO* — start over\n• *STOP* — unsubscribe`,
      log,
    );
    return true;
  }

  // ── Route to step handler ──────────────────────────────────────────────
  switch (state.step) {
    case 'profession':
      await handleProfessionStep(phone, text, state, redis, log);
      return true;

    case 'state_select':
      await handleStateSelectStep(phone, text, state, redis, log);
      return true;

    case 'city':
      await handleCityStep(phone, text, state, redis, log);
      return true;

    case 'name':
      await handleNameStep(phone, text, state, redis, log);
      return true;

    case 'email':
      await handleEmailStep(phone, text, state, redis, log);
      return true;

    case 'confirm':
      await handleConfirmStep(phone, text, state, redis, log);
      return true;

    default:
      return false;
  }
}

// ── Step: Profession ───────────────────────────────────────────────────────

async function handleProfessionStep(
  phone: string,
  text: string,
  state: WaRegistrationState,
  redis: Redis,
  log: Logger,
): Promise<void> {
  const selected = parseSelections(text, PROFESSIONS);

  if (selected.length === 0) {
    await sendText(
      phone,
      `Please reply with numbers (1-${PROFESSIONS.length}) separated by commas.\nExample: *1, 6* for HVAC and Plumbing`,
      log,
    );
    return;
  }

  state.professions = selected;
  state.step = 'state_select';
  await setRegistrationState(redis, phone, state);

  const selectedLabels = selected
    .map((key) => {
      const p = PROFESSIONS.find((pr) => pr.key === key);
      return p ? `${p.emoji} ${p.label}` : key;
    })
    .join('\n');

  await sendText(
    phone,
    `Great! You selected:\n${selectedLabels}\n\n*Step 1/4 (cont):* Which state do you work in?\n\n1️⃣ 🌴 Florida\n2️⃣ 🗽 New York\n3️⃣ 🤠 Texas`,
    log,
  );
}

// ── Step: State select ─────────────────────────────────────────────────────

async function handleStateSelectStep(
  phone: string,
  text: string,
  state: WaRegistrationState,
  redis: Redis,
  log: Logger,
): Promise<void> {
  const trimmed = text.trim().toLowerCase();

  const stateMap: Record<string, string> = {
    '1': 'FL', 'fl': 'FL', 'florida': 'FL',
    '2': 'NY', 'ny': 'NY', 'new york': 'NY',
    '3': 'TX', 'tx': 'TX', 'texas': 'TX',
  };
  const selectedState = stateMap[trimmed];
  if (!selectedState) {
    await sendText(phone, `Reply *1* for Florida, *2* for New York, or *3* for Texas.`, log);
    return;
  }

  state.stateName = selectedState;
  state.step = 'city';
  await setRegistrationState(redis, phone, state);

  const cities = getCitiesByState(selectedState);
  const cityList = cities
    .map((c, i) => `${i + 1}️⃣ ${c.label}`)
    .join('\n');

  await sendText(
    phone,
    `*${selectedState}* — select your service cities.\n\n*Step 2/4:* Reply with numbers separated by commas:\n\n${cityList}\n\nExample: *1, 3, 5*`,
    log,
  );
}

// ── Step: City ─────────────────────────────────────────────────────────────

async function handleCityStep(
  phone: string,
  text: string,
  state: WaRegistrationState,
  redis: Redis,
  log: Logger,
): Promise<void> {
  const cities = getCitiesByState(state.stateName);

  const numbers = text.match(/\d+/g)?.map(Number) ?? [];
  const validNumbers = numbers.filter((n) => n >= 1 && n <= cities.length);

  if (validNumbers.length === 0) {
    await sendText(phone, `Reply with city numbers (1-${cities.length}) separated by commas.`, log);
    return;
  }

  const selectedCityKeys = validNumbers.map((n) => cities[n - 1].id);
  const selectedCityLabels = validNumbers.map((n) => cities[n - 1].label);
  const zips = getAllZipsForCities(state.stateName, selectedCityKeys);

  state.cities = selectedCityKeys;
  state.zipCodes = zips;
  state.step = 'name';
  await setRegistrationState(redis, phone, state);

  await sendText(
    phone,
    `Selected: ${selectedCityLabels.join(', ')} (${zips.length} ZIP codes)\n\n*Step 3/4:* What is your full name?`,
    log,
  );
}

// ── Step: Name ─────────────────────────────────────────────────────────────

async function handleNameStep(
  phone: string,
  text: string,
  state: WaRegistrationState,
  redis: Redis,
  log: Logger,
): Promise<void> {
  const name = text.trim().replace(/<[^>]*>/g, '').replace(/[^\p{L}\p{M}\s'.\-]/gu, '').trim();

  if (name.length < 2 || name.length > 100) {
    await sendText(
      phone,
      `Please enter your full name (2-100 characters).`,
      log,
    );
    return;
  }

  state.fullName = name;
  state.step = 'email';
  await setRegistrationState(redis, phone, state);

  await sendText(
    phone,
    `Thanks, ${name}!\n\n*Step 4/4:* What is your email address?\n\nWe'll use this for your account login.`,
    log,
  );
}

// ── Step: Email ────────────────────────────────────────────────────────────

async function handleEmailStep(
  phone: string,
  text: string,
  state: WaRegistrationState,
  redis: Redis,
  log: Logger,
): Promise<void> {
  const email = text.trim().toLowerCase();

  if (!isValidEmail(email)) {
    await sendText(
      phone,
      `That doesn't look like a valid email. Please try again.\nExample: *john@gmail.com*`,
      log,
    );
    return;
  }

  // Note: Email duplicate check is intentionally deferred to createUser time (handleConfirmStep).
  // Supabase admin API doesn't expose an efficient getUserByEmail method, and listing all users
  // to check uniqueness here would be costly. The UX impact is minimal — if the email is taken,
  // the user is prompted to enter a different one after confirming.

  state.email = email;
  state.step = 'confirm';
  await setRegistrationState(redis, phone, state);

  const profLabels = state.professions
    .map((key) => {
      const p = PROFESSIONS.find((pr) => pr.key === key);
      return p ? `${p.emoji} ${p.label}` : key;
    })
    .join(', ');

  await sendText(
    phone,
    `*Please confirm your details:*\n\n👤 *Name:* ${state.fullName}\n📧 *Email:* ${email}\n🔧 *Trades:* ${profLabels}\n📍 *Area:* ${state.cities.length} cities in ${state.stateName} (${state.zipCodes.length} ZIPs)\n📅 *Working days:* Mon-Fri\n\nReply *YES* to create your account or *REDO* to start over.`,
    log,
  );
}

// ── Step: Confirm (account creation) ───────────────────────────────────────

async function handleConfirmStep(
  phone: string,
  text: string,
  state: WaRegistrationState,
  redis: Redis,
  log: Logger,
): Promise<void> {
  const trimmed = text.trim().toLowerCase();

  if (trimmed === 'redo' || trimmed === 'start over' || trimmed === 'no') {
    await clearRegistrationState(redis, phone);
    await startRegistration(phone, redis, log);
    return;
  }

  const confirmWords = ['yes', 'y', 'yeah', 'yep', 'ok', 'sure', 'confirm', 'כן', '👍'];
  if (!confirmWords.includes(trimmed)) {
    await sendText(phone, `Reply *YES* to create your account or *REDO* to start over.`, log);
    return;
  }

  // ── 1. Create auth user ──────────────────────────────────────────────
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: state.email,
    email_confirm: true,
    user_metadata: { full_name: state.fullName },
  });

  if (authError) {
    // Duplicate email — let user try another email
    if (authError.message?.toLowerCase().includes('already') || authError.message?.toLowerCase().includes('duplicate')) {
      log.warn({ email: state.email }, 'Duplicate email during WA registration');
      state.step = 'email';
      await setRegistrationState(redis, phone, state);
      await sendText(
        phone,
        `That email is already registered. Please enter a different email address:`,
        log,
      );
      return;
    }

    log.error({ error: authError }, 'Failed to create user during WA registration');
    await sendText(
      phone,
      `Something went wrong. Please send YES to try again.`,
      log,
    );
    return;
  }

  const newUserId = authData.user.id;
  log.info({ userId: newUserId, email: state.email }, 'WA registration: auth user created');

  // ── 2. Update profile (handle_new_user trigger already created the row) ──
  const { error: profileError } = await supabase
    .from('profiles')
    .update({
      phone: state.phone,
      whatsapp_phone: state.phone,
    })
    .eq('id', newUserId);

  if (profileError) {
    log.error({ error: profileError, userId: newUserId }, 'Failed to update profile during WA registration');
  }

  // ── 3. Insert contractor record ──────────────────────────────────────
  const { error: contractorError } = await supabase
    .from('contractors')
    .insert({
      user_id: newUserId,
      professions: state.professions,
      zip_codes: state.zipCodes,
      working_days: [1, 2, 3, 4, 5],
      is_active: true,
      wa_notify: true,
    });

  if (contractorError) {
    log.error({ error: contractorError, userId: newUserId }, 'Failed to insert contractor during WA registration');
  }

  // ── 4. Lookup starter plan & insert subscription ─────────────────────
  const { data: starterPlan } = await supabase
    .from('plans')
    .select('id')
    .eq('slug', 'starter')
    .single();

  if (starterPlan) {
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + 7);

    const { error: subError } = await supabase
      .from('subscriptions')
      .insert({
        user_id: newUserId,
        plan_id: starterPlan.id,
        status: 'trialing',
        current_period_end: trialEnd.toISOString(),
        stripe_customer_id: '',
      });

    if (subError) {
      log.error({ error: subError, userId: newUserId }, 'Failed to insert subscription during WA registration');
    }
  } else {
    log.error('Starter plan not found in DB during WA registration');
  }

  // ── 5. Send magic link via email (NOT WhatsApp) ─────────────────────
  const { error: inviteError } = await supabase.auth.admin.inviteUserByEmail(state.email);

  if (inviteError) {
    log.error({ error: inviteError }, 'Failed to send invite email during WA registration');
  }

  // ── 6. Clear registration state ──────────────────────────────────────
  await clearRegistrationState(redis, phone);

  // ── 7. Send success messages ─────────────────────────────────────────
  const profLabels = state.professions
    .map((key) => {
      const p = PROFESSIONS.find((pr) => pr.key === key);
      return p ? `${p.emoji} ${p.label}` : key;
    })
    .join(', ');

  await sendText(
    phone,
    `✅ *Account created!*\n\n👤 ${state.fullName}\n🔧 ${profLabels}\n📍 ${state.cities.length} cities in ${state.stateName}\n🆓 7-day free trial started\n\nYou'll receive your first check-in tomorrow morning.`,
    log,
  );

  await sendText(
    phone,
    `📧 Check your email for a dashboard login link.`,
    log,
  );

  log.info(
    {
      userId: newUserId,
      email: state.email,
      professions: state.professions,
      zipCount: state.zipCodes.length,
      state: state.stateName,
    },
    'WA registration complete',
  );
}
