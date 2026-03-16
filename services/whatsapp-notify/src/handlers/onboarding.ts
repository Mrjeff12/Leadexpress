import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type Redis from 'ioredis';
import type { Logger } from 'pino';
import { config } from '../config.js';
import { sendText } from '../interactive.js';

const supabase: SupabaseClient = createClient(config.supabase.url, config.supabase.serviceKey);

// Onboarding state in Redis
const ONBOARD_PREFIX = 'le:wa-onboard:';
const ONBOARD_TTL = 3600; // 1 hour

export interface WaOnboardState {
  userId: string;
  step: 'profession' | 'city' | 'working_days' | 'confirm';
  professions: string[];
  cities: string[]; // city keys like "miami", "hollywood"
  zipCodes: string[];
  state: string; // "FL", "NY", "TX"
  workingDays: number[];
}

export const PROFESSIONS = [
  { key: 'hvac', label: 'HVAC / AC', emoji: '❄️' },
  { key: 'renovation', label: 'Renovation', emoji: '🔨' },
  { key: 'fencing', label: 'Fencing & Railing', emoji: '🧱' },
  { key: 'cleaning', label: 'Cleaning', emoji: '✨' },
  { key: 'locksmith', label: 'Locksmith', emoji: '🔑' },
  { key: 'plumbing', label: 'Plumbing', emoji: '🚰' },
  { key: 'electrical', label: 'Electrical', emoji: '⚡' },
  { key: 'other', label: 'Other', emoji: '📋' },
] as const;

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// ---------------------------------------------------------------------------
// Entry: first message from a new WhatsApp user
// ---------------------------------------------------------------------------

export async function handleFirstContact(
  phone: string,
  log: Logger,
  redis: Redis,
): Promise<void> {
  // Look up by whatsapp_phone first (already linked)
  let profile = await findProfileByWhatsApp(phone);

  // Then try by phone number
  if (!profile) {
    profile = await findProfileByPhone(phone);
  }

  if (!profile) {
    await sendText(
      phone,
      `Welcome! 👋\n\nYou don't have a LeadExpress account yet.\nVisit leadexpress.com to start your free trial.`,
      log,
    );
    return;
  }

  // Check subscription
  const sub = await checkSubscription(profile.id);
  if (!sub) {
    await sendText(
      phone,
      `Hi ${profile.full_name}! Your subscription has expired.\nVisit leadexpress.com to renew and start receiving leads again.`,
      log,
    );
    return;
  }

  // Link WhatsApp phone if not already linked
  if (!profile.whatsapp_phone) {
    await supabase
      .from('profiles')
      .update({ whatsapp_phone: phone })
      .eq('id', profile.id);
  }

  // Check if contractor already set up
  const { data: contractor } = await supabase
    .from('contractors')
    .select('user_id, professions, zip_codes')
    .eq('user_id', profile.id)
    .maybeSingle();

  if (contractor && contractor.professions.length > 0 && contractor.zip_codes.length > 0) {
    // Already set up — enable WA notifications
    await supabase
      .from('contractors')
      .update({ wa_notify: true })
      .eq('user_id', profile.id);

    await sendText(
      phone,
      `Welcome back, ${profile.full_name}! ✅\n\nWhatsApp notifications are now active.\nYou'll receive your first check-in tomorrow morning.\n\nSend MENU anytime for options.`,
      log,
    );
    return;
  }

  // Ensure contractor record exists
  if (!contractor) {
    await supabase.from('contractors').insert({ user_id: profile.id, wa_notify: true });
  } else {
    await supabase.from('contractors').update({ wa_notify: true }).eq('user_id', profile.id);
  }

  // Start onboarding
  const state: WaOnboardState = {
    userId: profile.id,
    step: 'profession',
    professions: [],
    cities: [],
    zipCodes: [],
    state: '',
    workingDays: [1, 2, 3, 4, 5], // default Mon-Fri
  };
  await setOnboardState(redis, phone, state);

  await sendText(
    phone,
    `Welcome to LeadExpress, ${profile.full_name}! 🔧\n\nLet's set up your profile so you get the right leads.\n\n*Step 1:* What type of work do you do?\nReply with the numbers of your trades:\n\n1️⃣ ❄️ HVAC / AC\n2️⃣ 🔨 Renovation\n3️⃣ 🧱 Fencing & Railing\n4️⃣ ✨ Cleaning\n5️⃣ 🔑 Locksmith\n6️⃣ 🚰 Plumbing\n7️⃣ ⚡ Electrical\n8️⃣ 📋 Other\n\nExample: *1, 6* for HVAC and Plumbing`,
    log,
  );
}

// ---------------------------------------------------------------------------
// Process onboarding step
// ---------------------------------------------------------------------------

export async function handleOnboardingStep(
  phone: string,
  text: string,
  redis: Redis,
  log: Logger,
): Promise<boolean> {
  const state = await getOnboardState(redis, phone);
  if (!state) return false; // not in onboarding

  switch (state.step) {
    case 'profession':
      await handleProfessionStep(phone, text, state, redis, log);
      return true;

    case 'city':
      await handleCityStep(phone, text, state, redis, log);
      return true;

    case 'working_days':
      await handleWorkingDaysStep(phone, text, state, redis, log);
      return true;

    case 'confirm':
      await handleConfirmStep(phone, text, state, redis, log);
      return true;

    default:
      return false;
  }
}

// ---------------------------------------------------------------------------
// Step 1: Profession selection
// ---------------------------------------------------------------------------

async function handleProfessionStep(
  phone: string,
  text: string,
  state: WaOnboardState,
  redis: Redis,
  log: Logger,
): Promise<void> {
  // Parse numbers from input: "1, 3, 6" or "1 3 6" or "hvac, plumbing"
  const selected = parseSelections(text, PROFESSIONS);

  if (selected.length === 0) {
    await sendText(
      phone,
      `Please reply with numbers (1-8) separated by commas.\nExample: *1, 6* for HVAC and Plumbing`,
      log,
    );
    return;
  }

  state.professions = selected;
  state.step = 'city';
  await setOnboardState(redis, phone, state);

  const selectedLabels = selected
    .map((key) => {
      const p = PROFESSIONS.find((pr) => pr.key === key);
      return p ? `${p.emoji} ${p.label}` : key;
    })
    .join('\n');

  await sendText(
    phone,
    `Great! You selected:\n${selectedLabels}\n\n*Step 2:* Which state do you work in?\n\n1️⃣ 🌴 Florida\n2️⃣ 🗽 New York\n3️⃣ 🤠 Texas`,
    log,
  );
}

// ---------------------------------------------------------------------------
// Step 2: City selection (state → city)
// ---------------------------------------------------------------------------

async function handleCityStep(
  phone: string,
  text: string,
  state: WaOnboardState,
  redis: Redis,
  log: Logger,
): Promise<void> {
  const trimmed = text.trim().toLowerCase();

  // If no state selected yet, parse state selection
  if (!state.state) {
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

    state.state = selectedState;
    await setOnboardState(redis, phone, state);

    // Dynamic import to avoid circular deps
    const { getCitiesByState } = await import('../city-zips.js');
    const cities = getCitiesByState(selectedState);

    const cityList = cities
      .map((c, i) => `${i + 1}️⃣ ${c.label}`)
      .join('\n');

    await sendText(
      phone,
      `*${selectedState}* — select your service cities.\nReply with numbers separated by commas:\n\n${cityList}\n\nExample: *1, 3, 5*`,
      log,
    );
    return;
  }

  // Parse city selections
  const { getCitiesByState, getAllZipsForCities } = await import('../city-zips.js');
  const cities = getCitiesByState(state.state);

  // Parse numbers
  const numbers = text.match(/\d+/g)?.map(Number) ?? [];
  const validNumbers = numbers.filter((n) => n >= 1 && n <= cities.length);

  if (validNumbers.length === 0) {
    await sendText(phone, `Reply with city numbers (1-${cities.length}) separated by commas.`, log);
    return;
  }

  const selectedCityKeys = validNumbers.map((n) => cities[n - 1].id);
  const selectedCityLabels = validNumbers.map((n) => cities[n - 1].label);
  const zips = getAllZipsForCities(state.state, selectedCityKeys);

  state.cities = selectedCityKeys;
  state.zipCodes = zips;
  state.step = 'working_days';
  await setOnboardState(redis, phone, state);

  await sendText(
    phone,
    `Selected: ${selectedCityLabels.join(', ')} (${zips.length} ZIP codes)\n\n*Step 3:* Which days do you work?\n\n1️⃣ Mon-Fri (default)\n2️⃣ Every day\n3️⃣ Custom\n\nReply *1*, *2*, or *3*`,
    log,
  );
}

// ---------------------------------------------------------------------------
// Step 3: Working days
// ---------------------------------------------------------------------------

async function handleWorkingDaysStep(
  phone: string,
  text: string,
  state: WaOnboardState,
  redis: Redis,
  log: Logger,
): Promise<void> {
  const trimmed = text.trim();

  if (trimmed === '1' || trimmed.toLowerCase().includes('mon-fri') || trimmed.toLowerCase().includes('default')) {
    state.workingDays = [1, 2, 3, 4, 5];
  } else if (trimmed === '2' || trimmed.toLowerCase().includes('every')) {
    state.workingDays = [0, 1, 2, 3, 4, 5, 6];
  } else if (trimmed === '3' || trimmed.toLowerCase().includes('custom')) {
    await sendText(
      phone,
      `Reply with day numbers:\n0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat\n\nExample: *1,2,3,4,5* for Mon-Fri`,
      log,
    );
    // Stay on same step, wait for day numbers
    return;
  } else {
    // Try parsing day numbers
    const nums = text.match(/\d/g)?.map(Number).filter((n) => n >= 0 && n <= 6) ?? [];
    if (nums.length === 0) {
      await sendText(phone, `Reply *1* for Mon-Fri, *2* for every day, or *3* for custom.`, log);
      return;
    }
    state.workingDays = [...new Set(nums)].sort();
  }

  state.step = 'confirm';
  await setOnboardState(redis, phone, state);

  const profLabels = state.professions
    .map((key) => {
      const p = PROFESSIONS.find((pr) => pr.key === key);
      return p ? `${p.emoji} ${p.label}` : key;
    })
    .join(', ');

  const dayLabels = state.workingDays.map((d) => DAY_NAMES[d]).join(', ');

  await sendText(
    phone,
    `*Your profile:*\n\n🔧 *Trades:* ${profLabels}\n📍 *Areas:* ${state.cities.length} cities (${state.zipCodes.length} ZIPs)\n📅 *Days:* ${dayLabels}\n\nReply *YES* to confirm or *REDO* to start over.`,
    log,
  );
}

// ---------------------------------------------------------------------------
// Step 4: Confirm
// ---------------------------------------------------------------------------

async function handleConfirmStep(
  phone: string,
  text: string,
  state: WaOnboardState,
  redis: Redis,
  log: Logger,
): Promise<void> {
  const trimmed = text.trim().toLowerCase();

  if (trimmed === 'redo' || trimmed === 'start over' || trimmed === 'no') {
    state.step = 'profession';
    state.professions = [];
    state.cities = [];
    state.zipCodes = [];
    state.state = '';
    state.workingDays = [1, 2, 3, 4, 5];
    await setOnboardState(redis, phone, state);

    await sendText(
      phone,
      `OK, let's start over!\n\n*Step 1:* What type of work do you do?\n\n1️⃣ ❄️ HVAC / AC\n2️⃣ 🔨 Renovation\n3️⃣ 🧱 Fencing & Railing\n4️⃣ ✨ Cleaning\n5️⃣ 🔑 Locksmith\n6️⃣ 🚰 Plumbing\n7️⃣ ⚡ Electrical\n8️⃣ 📋 Other\n\nExample: *1, 6*`,
      log,
    );
    return;
  }

  if (!isPositive(trimmed)) {
    await sendText(phone, `Reply *YES* to confirm or *REDO* to start over.`, log);
    return;
  }

  // Save to DB
  const { error } = await supabase
    .from('contractors')
    .update({
      professions: state.professions,
      zip_codes: state.zipCodes,
      wa_notify: true,
      is_active: true,
      working_days: state.workingDays,
    })
    .eq('user_id', state.userId);

  if (error) {
    log.error({ error, userId: state.userId }, 'Failed to save onboarding');
    await sendText(phone, `Something went wrong. Please try again later.`, log);
    return;
  }

  // Clear onboarding state
  await clearOnboardState(redis, phone);

  log.info({ userId: state.userId, professions: state.professions, zipCount: state.zipCodes.length }, 'WhatsApp onboarding complete');

  await sendText(
    phone,
    `✅ *All set!*\n\nYou'll get your first check-in tomorrow morning.\nWhen leads match your profile, they'll come straight here.\n\nSend *MENU* anytime for options.`,
    log,
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseSelections(text: string, options: readonly { key: string; label: string }[]): string[] {
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

function isPositive(text: string): boolean {
  const positiveWords = ['yes', 'y', 'yeah', 'yep', 'ok', 'sure', 'confirm', 'כן', '1', '👍'];
  return positiveWords.some((w) => text.includes(w));
}

async function findProfileByWhatsApp(phone: string) {
  const { data } = await supabase
    .from('profiles')
    .select('id, full_name, phone, whatsapp_phone')
    .eq('whatsapp_phone', phone)
    .maybeSingle();
  return data;
}

async function findProfileByPhone(phone: string) {
  // Try exact match, then try with/without country code
  const { data } = await supabase
    .from('profiles')
    .select('id, full_name, phone, whatsapp_phone')
    .eq('phone', phone)
    .maybeSingle();

  if (data) return data;

  // Try without leading +
  const stripped = phone.replace(/^\+/, '');
  const { data: data2 } = await supabase
    .from('profiles')
    .select('id, full_name, phone, whatsapp_phone')
    .eq('phone', stripped)
    .maybeSingle();

  return data2;
}

async function checkSubscription(userId: string): Promise<boolean> {
  const { data } = await supabase
    .from('subscriptions')
    .select('status')
    .eq('user_id', userId)
    .in('status', ['active', 'trialing'])
    .maybeSingle();
  return !!data;
}

export async function getOnboardState(redis: Redis, phone: string): Promise<WaOnboardState | null> {
  const raw = await redis.get(`${ONBOARD_PREFIX}${phone}`);
  if (!raw) return null;
  return JSON.parse(raw) as WaOnboardState;
}

export async function setOnboardState(redis: Redis, phone: string, state: WaOnboardState): Promise<void> {
  await redis.set(`${ONBOARD_PREFIX}${phone}`, JSON.stringify(state), 'EX', ONBOARD_TTL);
}

export async function clearOnboardState(redis: Redis, phone: string): Promise<void> {
  await redis.del(`${ONBOARD_PREFIX}${phone}`);
}
