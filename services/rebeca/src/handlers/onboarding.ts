import { supabase } from '../lib/supabase.js';
import { sendText } from '../lib/twilio.js';
import { lang } from '../lib/i18n.js';
import { getState, setState, clearState } from '../lib/state.js';
import { getCitiesByState, getAllZipsForCities } from '../lib/city-zips.js';
import type { BotState } from '../lib/state.js';
import pino from 'pino';

const log = pino({ name: 'onboarding' });

const PROFESSIONS = [
  { key: 'hvac', en: 'HVAC / AC', he: 'מיזוג / מזגנים', emoji: '❄️' },
  { key: 'renovation', en: 'Renovation', he: 'שיפוצים', emoji: '🔨' },
  { key: 'fencing', en: 'Fencing & Railing', he: 'גדרות ומעקות', emoji: '🧱' },
  { key: 'cleaning', en: 'Cleaning', he: 'ניקיון', emoji: '✨' },
  { key: 'locksmith', en: 'Locksmith', he: 'מנעולן', emoji: '🔑' },
  { key: 'plumbing', en: 'Plumbing', he: 'אינסטלציה', emoji: '🚰' },
  { key: 'electrical', en: 'Electrical', he: 'חשמל', emoji: '⚡' },
];

const OTHER_INDEX = 8;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const DAY_NAMES_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_NAMES_HE = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

const TOTAL_STEPS_NEW = 6;    // profession, state+city, working_days, name, email, confirm
const TOTAL_STEPS_EXISTING = 4; // profession, state+city, working_days, confirm

function totalSteps(state: BotState): number {
  return state.userId ? TOTAL_STEPS_EXISTING : TOTAL_STEPS_NEW;
}

function stepLabel(n: number, total: number, l: 'he' | 'en'): string {
  return l === 'he' ? `*שלב ${n}/${total}:*` : `*Step ${n}/${total}:*`;
}

// ── Profession labels helper ──

function profLabels(keys: string[], l: 'he' | 'en'): string {
  return keys.map(key => {
    if (key === 'other') return l === 'he' ? 'אחר' : 'Other';
    const p = PROFESSIONS.find(pr => pr.key === key);
    return p ? `${p.emoji} ${l === 'he' ? p.he : p.en}` : key;
  }).join(', ');
}

// ══════════════════════════════════════════════════════════════════════════════
// Entry points
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Start onboarding for an existing user (has profile, missing contractor setup).
 */
export async function startOnboarding(phone: string, profile: { id: string; full_name: string }): Promise<void> {
  const l = lang(phone);
  const hasRealName = profile.full_name && !profile.full_name.startsWith('+');

  const state: BotState = {
    step: 'profession',
    userId: profile.id,
    prospectId: null,
    language: l,
    openaiResponseId: null,
    sessionStartedAt: new Date().toISOString(),
    collected: hasRealName ? { name: profile.full_name } : {},
  };
  await setState(phone, state);
  await sendProfessionStep(phone, state);
}

/**
 * Start onboarding for a brand-new user (no account at all).
 */
export async function startNewUserOnboarding(phone: string): Promise<void> {
  const l = lang(phone);

  const state: BotState = {
    step: 'profession',
    userId: null,
    prospectId: null,
    language: l,
    openaiResponseId: null,
    sessionStartedAt: new Date().toISOString(),
    collected: {},
  };
  await setState(phone, state);
  await sendProfessionStep(phone, state);
}

// ══════════════════════════════════════════════════════════════════════════════
// Main dispatcher
// ══════════════════════════════════════════════════════════════════════════════

export async function handleOnboarding(phone: string, text: string): Promise<void> {
  const state = await getState(phone);
  if (!state) return;

  const lower = text.trim().toLowerCase();
  if (['stop', 'cancel', 'ביטול', 'הפסק'].includes(lower)) {
    await clearState(phone);
    const l = state.language;
    await sendText(phone, l === 'he' ? 'בוטל. שלח הודעה מתי שתרצה.' : 'Cancelled. Send a message anytime.');
    return;
  }
  if (['redo', 'start over', 'מחדש', 'התחל מחדש'].includes(lower)) {
    state.step = 'profession';
    state.collected = { name: state.collected.name, email: state.collected.email };
    await setState(phone, state);
    await sendProfessionStep(phone, state);
    return;
  }

  switch (state.step) {
    case 'profession':    return handleProfessionStep(phone, text, state);
    case 'state_select':  return handleStateStep(phone, text, state);
    case 'city':          return handleCityStep(phone, text, state);
    case 'working_days':  return handleWorkingDaysStep(phone, text, state);
    case 'name':          return handleNameStep(phone, text, state);
    case 'email':         return handleEmailStep(phone, text, state);
    case 'confirm':       return handleConfirmStep(phone, text, state);
    default:
      state.step = 'profession';
      await setState(phone, state);
      return handleProfessionStep(phone, text, state);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Step handlers
// ══════════════════════════════════════════════════════════════════════════════

// ── Profession ──

async function sendProfessionStep(phone: string, state: BotState): Promise<void> {
  const l = state.language;
  const total = totalSteps(state);
  const profList = PROFESSIONS.map((p, i) =>
    `${i + 1}️⃣ ${p.emoji} ${l === 'he' ? p.he : p.en}`
  ).join('\n');

  const intro = state.userId
    ? (l === 'he' ? 'בוא נגדיר אותך תוך 2 דקות.' : `Let's get you set up in under 2 minutes.`)
    : (l === 'he' ? 'ברוך הבא ל-MasterLeadFlow! 👋\nבוא נגדיר אותך תוך 2 דקות.' : `Welcome to MasterLeadFlow! 👋\nLet's get you set up in under 2 minutes.`);

  await sendText(phone,
    `${intro}\n\n${stepLabel(1, total, l)} ${l === 'he' ? 'מה סוג העבודה שלך?' : 'What type of work do you do?'}\n${l === 'he' ? 'שלח את המספרים של המקצועות שלך:' : 'Reply with the numbers of your trades:'}\n\n${profList}\n${OTHER_INDEX}️⃣ 📋 ${l === 'he' ? 'אחר' : 'Other'}\n\n${l === 'he' ? 'לדוגמה: 1, 6 למיזוג ואינסטלציה' : 'Example: 1, 6 for HVAC and Plumbing'}`,
  );
}

async function handleProfessionStep(phone: string, text: string, state: BotState): Promise<void> {
  const l = state.language;
  const total = totalSteps(state);
  const numbers = text.match(/\d+/g)?.map(Number) ?? [];
  const hasOther = numbers.includes(OTHER_INDEX);
  const valid = numbers.filter(n => n >= 1 && n <= PROFESSIONS.length);

  if (valid.length === 0 && !hasOther) {
    await sendText(phone,
      l === 'he'
        ? `שלח מספרים (1-${OTHER_INDEX}) מופרדים בפסיקים.\nלדוגמה: *1, 6*`
        : `Reply with numbers (1-${OTHER_INDEX}) separated by commas.\nExample: *1, 6*`,
    );
    return;
  }

  const selected = [...new Set(valid.map(n => PROFESSIONS[n - 1].key))];
  if (hasOther) selected.push('other');
  state.collected.professions = selected;
  state.step = 'state_select';
  await setState(phone, state);

  await sendText(phone,
    `${l === 'he' ? 'בחרת' : 'You selected'}: ${profLabels(selected, l)}\n\n${stepLabel(2, total, l)} ${l === 'he' ? 'באיזה מדינה אתה עובד?' : 'Which state do you work in?'}\n\n1️⃣ 🌴 ${l === 'he' ? 'פלורידה' : 'Florida'}\n2️⃣ 🗽 ${l === 'he' ? 'ניו יורק' : 'New York'}\n3️⃣ 🤠 ${l === 'he' ? 'טקסס' : 'Texas'}`,
  );
}

// ── State ──

async function handleStateStep(phone: string, text: string, state: BotState): Promise<void> {
  const l = state.language;
  const total = totalSteps(state);
  const trimmed = text.trim().toLowerCase();

  const stateMap: Record<string, string> = {
    '1': 'FL', 'fl': 'FL', 'florida': 'FL', 'פלורידה': 'FL',
    '2': 'NY', 'ny': 'NY', 'new york': 'NY', 'ניו יורק': 'NY',
    '3': 'TX', 'tx': 'TX', 'texas': 'TX', 'טקסס': 'TX',
  };

  const selectedState = stateMap[trimmed];
  if (!selectedState) {
    await sendText(phone,
      l === 'he'
        ? 'שלח *1* לפלורידה, *2* לניו יורק, או *3* לטקסס.'
        : 'Reply *1* for Florida, *2* for New York, or *3* for Texas.',
    );
    return;
  }

  state.collected.state = selectedState;
  state.step = 'city';
  await setState(phone, state);

  const cities = getCitiesByState(selectedState);
  const cityList = cities.map((c, i) => `${i + 1}️⃣ ${c.label}`).join('\n');

  await sendText(phone,
    `${stepLabel(2, total, l)} ${l === 'he' ? 'באילו אזורים אתה עובד?' : 'Which areas do you cover?'}\n${l === 'he' ? 'שלח מספרים, או *0* לכל האזורים:' : 'Reply with numbers, or *0* for all areas:'}\n\n0️⃣ 🗺️ ${l === 'he' ? 'כל האזורים' : 'All areas'}\n${cityList}\n\n${l === 'he' ? 'לדוגמה: 1, 3, 5' : 'Example: 1, 3, 5'}`,
  );
}

// ── City ──

async function handleCityStep(phone: string, text: string, state: BotState): Promise<void> {
  const l = state.language;
  const total = totalSteps(state);
  const selectedState = state.collected.state!;
  const cities = getCitiesByState(selectedState);
  const numbers = text.match(/\d+/g)?.map(Number) ?? [];

  if (numbers.includes(0)) {
    const allKeys = cities.map(c => c.id);
    state.collected.cities = allKeys;
    state.collected.zipCodes = getAllZipsForCities(selectedState, allKeys);
  } else {
    const valid = numbers.filter(n => n >= 1 && n <= cities.length);
    if (valid.length === 0) {
      await sendText(phone,
        l === 'he'
          ? `שלח מספרי ערים (0-${cities.length}). *0* = כל האזורים.`
          : `Reply with city numbers (0-${cities.length}). *0* = all areas.`,
      );
      return;
    }
    const selectedKeys = [...new Set(valid.map(n => cities[n - 1].id))];
    state.collected.cities = selectedKeys;
    state.collected.zipCodes = getAllZipsForCities(selectedState, selectedKeys);
  }

  // Next step: working days
  state.step = 'working_days';
  await setState(phone, state);

  await sendText(phone,
    `${stepLabel(3, total, l)} ${l === 'he' ? 'באילו ימים אתה עובד?' : 'Which days do you work?'}\n\n1️⃣ ${l === 'he' ? 'ראשון-חמישי' : 'Mon-Fri'}\n2️⃣ ${l === 'he' ? 'כל יום' : 'Every day'}\n3️⃣ ${l === 'he' ? 'מותאם אישית' : 'Custom'}`,
  );
}

// ── Working days ──

async function handleWorkingDaysStep(phone: string, text: string, state: BotState): Promise<void> {
  const l = state.language;
  const trimmed = text.trim().toLowerCase();

  if (trimmed === '1' || trimmed.includes('mon-fri') || trimmed.includes('ראשון-חמישי')) {
    state.collected.workingDays = [1, 2, 3, 4, 5];
  } else if (trimmed === '2' || trimmed.includes('every') || trimmed.includes('כל יום')) {
    state.collected.workingDays = [0, 1, 2, 3, 4, 5, 6];
  } else if (trimmed === '3' || trimmed.includes('custom') || trimmed.includes('מותאם')) {
    await sendText(phone,
      l === 'he'
        ? 'שלח מספרי ימים:\n0=ראשון, 1=שני, 2=שלישי, 3=רביעי, 4=חמישי, 5=שישי, 6=שבת\n\nלדוגמה: *1,2,3,4,5*'
        : 'Send day numbers:\n0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat\n\nExample: *1,2,3,4,5*',
    );
    return;
  } else {
    const nums = text.match(/\d/g)?.map(Number).filter(n => n >= 0 && n <= 6) ?? [];
    if (nums.length === 0) {
      await sendText(phone,
        l === 'he'
          ? 'שלח *1* לראשון-חמישי, *2* לכל יום, או *3* למותאם אישית.'
          : 'Reply *1* for Mon-Fri, *2* for every day, or *3* for custom.',
      );
      return;
    }
    state.collected.workingDays = [...new Set(nums)].sort();
  }

  // Existing user → skip name/email, go to confirm
  if (state.userId) {
    state.step = 'confirm';
    await setState(phone, state);
    await sendConfirmSummary(phone, state);
    return;
  }

  // New user → collect name
  const total = totalSteps(state);
  state.step = 'name';
  await setState(phone, state);

  await sendText(phone,
    `${stepLabel(4, total, l)} ${l === 'he' ? 'מה השם המלא שלך?' : 'What is your full name?'}`,
  );
}

// ── Name (new users only) ──

async function handleNameStep(phone: string, text: string, state: BotState): Promise<void> {
  const l = state.language;
  const total = totalSteps(state);
  const name = text.trim().replace(/<[^>]*>/g, '').replace(/[^\p{L}\p{M}\s'.\-]/gu, '').trim();

  if (name.length < 2 || name.length > 100) {
    await sendText(phone,
      l === 'he'
        ? 'שלח את השם המלא שלך (2-100 תווים).'
        : 'Please enter your full name (2-100 characters).',
    );
    return;
  }

  state.collected.name = name;
  state.step = 'email';
  await setState(phone, state);

  const firstName = name.split(' ')[0];
  await sendText(phone,
    `${l === 'he' ? `תודה, ${firstName}!` : `Thanks, ${firstName}!`}\n\n${stepLabel(5, total, l)} ${l === 'he' ? 'מה כתובת האימייל שלך?' : 'What is your email address?'}\n\n${l === 'he' ? 'נשתמש בזה להתחברות לדשבורד.' : `We'll use this for your dashboard login.`}`,
  );
}

// ── Email (new users only) ──

async function handleEmailStep(phone: string, text: string, state: BotState): Promise<void> {
  const l = state.language;
  const email = text.trim().toLowerCase();

  if (!EMAIL_RE.test(email)) {
    await sendText(phone,
      l === 'he'
        ? 'זה לא נראה כמו אימייל תקין. נסה שוב.\nלדוגמה: *john@gmail.com*'
        : `That doesn't look like a valid email. Try again.\nExample: *john@gmail.com*`,
    );
    return;
  }

  state.collected.email = email;
  state.step = 'confirm';
  await setState(phone, state);

  await sendConfirmSummary(phone, state);
}

// ── Confirm summary ──

async function sendConfirmSummary(phone: string, state: BotState): Promise<void> {
  const l = state.language;
  const dayNames = l === 'he' ? DAY_NAMES_HE : DAY_NAMES_EN;
  const dayLabels = (state.collected.workingDays ?? []).map(d => dayNames[d]).join(', ');
  const cityCount = state.collected.cities?.length ?? 0;
  const profs = profLabels(state.collected.professions ?? [], l);

  let summary = l === 'he'
    ? `*סיכום:*\n\n🔧 ${profs}\n📍 ${state.collected.state} — ${cityCount} אזורים\n📅 ${dayLabels}`
    : `*Summary:*\n\n🔧 ${profs}\n📍 ${state.collected.state} — ${cityCount} areas\n📅 ${dayLabels}`;

  // New user — show name + email too
  if (!state.userId) {
    summary += l === 'he'
      ? `\n👤 ${state.collected.name}\n📧 ${state.collected.email}`
      : `\n👤 ${state.collected.name}\n📧 ${state.collected.email}`;
  }

  summary += l === 'he'
    ? '\n\n*כן* לאישור | *מחדש* להתחיל מחדש'
    : '\n\n*YES* to confirm | *REDO* to start over';

  await sendText(phone, summary);
}

// ── Confirm & save ──

async function handleConfirmStep(phone: string, text: string, state: BotState): Promise<void> {
  const l = state.language;
  const trimmed = text.trim().toLowerCase();

  if (['redo', 'מחדש', 'no', 'לא', 'start over', 'התחל מחדש'].includes(trimmed)) {
    state.step = 'profession';
    state.collected = { name: state.collected.name, email: state.collected.email };
    await setState(phone, state);
    await sendProfessionStep(phone, state);
    return;
  }

  const positives = ['yes', 'y', 'yeah', 'yep', 'ok', 'sure', 'confirm', 'כן', 'מאשר', 'אוקי', 'בסדר', '1', '👍', 'בטח'];
  if (!positives.some(w => trimmed.includes(w))) {
    await sendText(phone,
      l === 'he'
        ? '*כן* לאישור | *מחדש* להתחיל מחדש'
        : '*YES* to confirm | *REDO* to start over',
    );
    return;
  }

  if (state.userId) {
    await saveExistingUser(phone, state);
  } else {
    await createNewUser(phone, state);
  }
}

// ── Save: existing user (has account) ──

async function saveExistingUser(phone: string, state: BotState): Promise<void> {
  const l = state.language;
  const userId = state.userId!;

  const { error } = await supabase
    .from('contractors')
    .update({
      professions: state.collected.professions,
      zip_codes: state.collected.zipCodes,
      working_days: state.collected.workingDays ?? [1, 2, 3, 4, 5],
      wa_notify: true,
      is_active: true,
    })
    .eq('user_id', userId);

  if (error) {
    log.error({ error, userId }, 'Failed to save onboarding');
    await sendText(phone, l === 'he' ? 'משהו השתבש, נסה שוב.' : 'Something went wrong. Try again.');
    return;
  }

  if (state.collected.name) {
    await supabase.from('profiles').update({ full_name: state.collected.name }).eq('id', userId);
  }

  await clearState(phone);

  await sendText(phone,
    l === 'he'
      ? '✅ הפרופיל מוגדר!\nלידים מתאימים יגיעו ישירות לפה.\n\nשלח *MENU* לאפשרויות.'
      : `✅ You're all set!\nMatching leads will come straight here.\n\nSend *MENU* for options.`,
  );

  log.info({ phone, userId, professions: state.collected.professions, zipCount: state.collected.zipCodes?.length }, 'Onboarding complete');
}

// ── Save: new user (create account) ──

async function createNewUser(phone: string, state: BotState): Promise<void> {
  const l = state.language;

  // 1. Create auth user
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: state.collected.email!,
    email_confirm: true,
    user_metadata: { full_name: state.collected.name },
  });

  if (authError) {
    if (authError.message?.toLowerCase().includes('already') || authError.message?.toLowerCase().includes('duplicate')) {
      log.warn({ email: state.collected.email }, 'Duplicate email during registration');
      state.step = 'email';
      await setState(phone, state);
      await sendText(phone,
        l === 'he'
          ? 'האימייל הזה כבר רשום. שלח כתובת אימייל אחרת:'
          : 'That email is already registered. Please enter a different email:',
      );
      return;
    }
    log.error({ error: authError }, 'Failed to create user');
    await sendText(phone, l === 'he' ? 'משהו השתבש, שלח *כן* לנסות שוב.' : 'Something went wrong. Send *YES* to try again.');
    return;
  }

  const userId = authData.user.id;
  log.info({ userId, email: state.collected.email }, 'Auth user created');

  // 2. Update profile
  await supabase
    .from('profiles')
    .update({ phone, whatsapp_phone: phone })
    .eq('id', userId);

  // 3. Insert contractor
  await supabase.from('contractors').insert({
    user_id: userId,
    professions: state.collected.professions,
    zip_codes: state.collected.zipCodes,
    working_days: state.collected.workingDays ?? [1, 2, 3, 4, 5],
    is_active: true,
    wa_notify: true,
  });

  // 4. Create trial subscription
  const { data: starterPlan } = await supabase
    .from('plans')
    .select('id')
    .eq('slug', 'starter')
    .single();

  if (starterPlan) {
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + 7);
    await supabase.from('subscriptions').insert({
      user_id: userId,
      plan_id: starterPlan.id,
      status: 'trialing',
      current_period_end: trialEnd.toISOString(),
      stripe_customer_id: '',
    });
  } else {
    log.error('Starter plan not found in DB');
  }

  // 5. Send magic link via email
  const { error: inviteError } = await supabase.auth.admin.inviteUserByEmail(state.collected.email!);
  if (inviteError) {
    log.error({ error: inviteError }, 'Failed to send invite email');
  }

  // 6. Clear state
  await clearState(phone);

  // 7. Success messages
  const profs = profLabels(state.collected.professions ?? [], l);

  if (l === 'he') {
    await sendText(phone,
      `✅ *החשבון נוצר!*\n\n👤 ${state.collected.name}\n🔧 ${profs}\n📍 ${state.collected.cities?.length} ערים ב-${state.collected.state}\n🆓 תקופת ניסיון 7 ימים\n\nהצ'ק-אין הראשון שלך יגיע מחר בבוקר.`,
    );
    await sendText(phone, '📧 בדוק את האימייל — שלחנו לינק כניסה לדשבורד.');
  } else {
    await sendText(phone,
      `✅ *Account created!*\n\n👤 ${state.collected.name}\n🔧 ${profs}\n📍 ${state.collected.cities?.length} cities in ${state.collected.state}\n🆓 7-day free trial started\n\nYou'll receive your first check-in tomorrow morning.`,
    );
    await sendText(phone, '📧 Check your email for a dashboard login link.');
  }

  log.info({ userId, email: state.collected.email, professions: state.collected.professions, zipCount: state.collected.zipCodes?.length }, 'Registration complete');
}
