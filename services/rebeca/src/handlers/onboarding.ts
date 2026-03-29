import { supabase } from '../lib/supabase.js';
import { config } from '../config.js';
import { sendText } from '../lib/twilio.js';
import { lang } from '../lib/i18n.js';
import { getState, setState, clearState } from '../lib/state.js';
import { getCitiesByState, getAllZipsForCities } from '../lib/city-zips.js';
import type { BotState } from '../lib/state.js';
import pino from 'pino';

const log = pino({ name: 'onboarding' });

// ── Profession catalog ──────────────────────────────────────────────────────

const PROFESSIONS = [
  { key: 'hvac',        en: 'HVAC & AC',               emoji: '❄️' },
  { key: 'air_duct',    en: 'Air Duct Cleaning',        emoji: '💨' },
  { key: 'renovation',  en: 'Renovation & Remodeling',  emoji: '🔨' },
  { key: 'fencing',     en: 'Fencing & Gates',           emoji: '🧱' },
  { key: 'locksmith',   en: 'Locksmith',                 emoji: '🔑' },
  { key: 'chimney',     en: 'Chimney Sweep',             emoji: '🧹' },
  { key: 'garage',      en: 'Garage Doors',              emoji: '🚪' },
  { key: 'windows',     en: 'Windows & Doors',           emoji: '🪟' },
  { key: 'cleaning',    en: 'Cleaning',                  emoji: '✨' },
  { key: 'plumbing',    en: 'Plumbing',                  emoji: '🚰' },
  { key: 'electrical',  en: 'Electrical',                emoji: '⚡' },
  { key: 'roofing',     en: 'Roofing',                   emoji: '🏠' },
  { key: 'painting',    en: 'Painting',                  emoji: '🎨' },
  { key: 'landscaping', en: 'Landscaping',               emoji: '🌳' },
];

// Short display: show first 6 as teaser, then MORE for full list
const SHORT_DISPLAY_COUNT = 6;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const TOTAL_STEPS_NEW = 5;      // profession, state, city, working_days, confirm
const TOTAL_STEPS_EXISTING = 4; // profession, state+city, working_days, confirm

// ── County mapping (city key → county name) ─────────────────────────────────

const COUNTY_MAP: Record<string, Record<string, string>> = {
  FL: {
    miami: 'Miami-Dade', hialeah: 'Miami-Dade', coral_gables: 'Miami-Dade',
    homestead: 'Miami-Dade', miami_beach: 'Miami-Dade', doral: 'Miami-Dade',
    aventura: 'Miami-Dade',
    fort_lauderdale: 'Broward County', hollywood: 'Broward County',
    pompano_beach: 'Broward County', deerfield_beach: 'Broward County',
    sunrise: 'Broward County', plantation: 'Broward County', davie: 'Broward County',
    pembroke_pines: 'Broward County', miramar: 'Broward County', weston: 'Broward County',
    boca_raton: 'Palm Beach County', west_palm_beach: 'Palm Beach County',
    delray_beach: 'Palm Beach County',
  },
  NY: {
    manhattan: 'Manhattan', brooklyn: 'Brooklyn', queens: 'Queens',
    bronx: 'Bronx', staten_island: 'Staten Island',
    yonkers: 'Westchester', white_plains: 'Westchester', new_rochelle: 'Westchester',
    hempstead: 'Long Island', huntington: 'Long Island',
  },
  TX: {
    houston: 'Harris County', dallas: 'Dallas County', fort_worth: 'Tarrant County',
    san_antonio: 'Bexar County', austin: 'Travis County', plano: 'Collin County',
    arlington: 'Tarrant County',
  },
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function totalSteps(state: BotState): number {
  return state.userId ? TOTAL_STEPS_EXISTING : TOTAL_STEPS_NEW;
}

function profLabels(keys: string[]): string {
  return keys.map(key => {
    const p = PROFESSIONS.find(pr => pr.key === key);
    return p ? `${p.emoji} ${p.en}` : key;
  }).join(', ');
}

function countyLabels(stateCode: string, cityKeys: string[]): string {
  const counties = COUNTY_MAP[stateCode];
  if (!counties) return cityKeys.join(', ');
  const unique = [...new Set(cityKeys.map(k => counties[k] ?? k))];
  return unique.join(', ');
}

async function generateMagicLink(userId: string): Promise<string | null> {
  try {
    const res = await fetch(`${config.supabase.url}/functions/v1/magic-login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.supabase.serviceKey}`,
      },
      body: JSON.stringify({ action: 'generate', user_id: userId, redirect_path: '/' }),
    });
    const data = await res.json() as { link?: string };
    return data.link ?? null;
  } catch (err) {
    log.error({ err, userId }, 'Failed to generate magic link');
    return null;
  }
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
 * Sends the welcome/sales pitch message first.
 */
export async function startNewUserOnboarding(phone: string): Promise<void> {
  const l = lang(phone);

  const state: BotState = {
    step: 'welcome',
    userId: null,
    prospectId: null,
    language: l,
    openaiResponseId: null,
    sessionStartedAt: new Date().toISOString(),
    collected: {},
  };
  await setState(phone, state);

  if (l === 'he') {
    await sendText(phone,
      `MasterLeadFlow סורקת קבוצות וואטסאפ של קבלנים 24/7 ומזהה עבודות אמיתיות. כשיש עבודה רלוונטית, אתה מקבל התראה עם כפתור "תפוס" — לוחץ ומקבל את פרטי הלקוח. אפשר לחבר כמה קבוצות שרוצים! \n\nרוצה לנסות 7 ימים חינם?`,
    );
  } else {
    await sendText(phone,
      `MasterLeadFlow scans contractor WhatsApp groups 24/7 and detects real jobs. When there's a relevant job, you get an alert with a "Grab" button — tap it and get the client's details. Connect as many groups as you want!\n\nWant to try 7 days free?`,
    );
  }
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
    state.collected = { name: state.collected.name };
    await setState(phone, state);
    await sendProfessionStep(phone, state);
    return;
  }

  switch (state.step) {
    case 'welcome':       return handleWelcomeStep(phone, text, state);
    case 'name':          return handleNameStep(phone, text, state);
    case 'profession':    return handleProfessionStep(phone, text, state);
    case 'state_select':  return handleStateStep(phone, text, state);
    case 'city':          return handleCityStep(phone, text, state);
    case 'working_days':  return handleWorkingDaysStep(phone, text, state);
    case 'confirm':       return handleConfirmStep(phone, text, state);
    case 'groups':        return handleGroupsStep(phone, text, state);
    default:
      state.step = 'profession';
      await setState(phone, state);
      return handleProfessionStep(phone, text, state);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Step handlers
// ══════════════════════════════════════════════════════════════════════════════

// ── Welcome (new users only) ──

async function handleWelcomeStep(phone: string, text: string, state: BotState): Promise<void> {
  const l = state.language;
  const lower = text.trim().toLowerCase();
  const positives = ['yes', 'y', 'yeah', 'yep', 'ok', 'sure', 'כן', 'בטח', 'כמובן', 'אוקי', 'בסדר', '1', '👍'];

  if (!positives.some(w => lower.includes(w))) {
    await sendText(phone,
      l === 'he'
        ? 'שלח *כן* כדי להתחיל ניסיון חינם של 7 ימים!'
        : 'Reply *YES* to start your free 7-day trial!',
    );
    return;
  }

  // Move to name collection
  state.step = 'name';
  await setState(phone, state);

  await sendText(phone,
    l === 'he'
      ? 'מעולה! 🚀 בוא נתחיל — לוקח דקה.\n\nמה השם המלא שלך?'
      : `Awesome! 🚀 Let's get started — takes a minute.\n\nWhat is your full name?`,
  );
}

// ── Name (new users, pre-step) ──

async function handleNameStep(phone: string, text: string, state: BotState): Promise<void> {
  const l = state.language;
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
  state.step = 'profession';
  await setState(phone, state);

  // "Nice to meet you, [name]!" then show profession step
  const greeting = l === 'he'
    ? `נעים להכיר, ${name}! ⚡`
    : `Nice to meet you, ${name}! ⚡`;

  const total = totalSteps(state);
  const shortList = PROFESSIONS.slice(0, SHORT_DISPLAY_COUNT)
    .map(p => `${p.emoji} ${p.en}`)
    .join('\n');

  await sendText(phone,
    `${greeting}\n\nStep ${1}/${total} — What services do you offer?\n\n${shortList}\n\n📋 Type MORE to see all services\n\n✏️ Type or 🎙️ record what you do.\nYou can pick from the list or describe your own.`,
  );
}

// ── Profession ──

async function sendProfessionStep(phone: string, state: BotState): Promise<void> {
  const total = totalSteps(state);

  const shortList = PROFESSIONS.slice(0, SHORT_DISPLAY_COUNT)
    .map(p => `${p.emoji} ${p.en}`)
    .join('\n');

  const intro = state.userId
    ? `Let's get you set up in under 2 minutes.\n\n`
    : '';

  await sendText(phone,
    `${intro}Step ${1}/${total} — What services do you offer?\n\n${shortList}\n\n📋 Type MORE to see all services\n\n✏️ Type or 🎙️ record what you do.\nYou can pick from the list or describe your own.`,
  );
}

async function handleProfessionStep(phone: string, text: string, state: BotState): Promise<void> {
  const total = totalSteps(state);
  const lower = text.trim().toLowerCase();

  // Handle MORE command — show full numbered list
  if (lower === 'more' || lower === 'עוד') {
    const fullList = PROFESSIONS.map((p, i) =>
      `${i + 1}. ${p.emoji} ${p.en}`
    ).join('\n');

    await sendText(phone,
      `📋 All services:\n\n${fullList}\n\n✏️ Type the numbers of your services.\nExample: *1, 4, 5*`,
    );
    return;
  }

  // Try to parse numbers
  const numbers = text.match(/\d+/g)?.map(Number) ?? [];
  const valid = numbers.filter(n => n >= 1 && n <= PROFESSIONS.length);

  if (valid.length === 0) {
    // Try keyword matching for free-text input
    const matched = matchProfessionsByText(lower);
    if (matched.length > 0) {
      state.collected.professions = matched;
      state.step = 'state_select';
      await setState(phone, state);

      await sendText(phone,
        `Got it: ${profLabels(matched)} 🔧\n\nStep ${2}/${total} — Which state do you serve?\n\n🌴 Florida\n🗽 New York\n🤠 Texas\n\n✏️ Type or 🎙️ record your answer.`,
      );
      return;
    }

    await sendText(phone,
      `Hmm, I didn't catch that.\n\nJust tell me what services you offer — for example:\n"HVAC and plumbing" or "air duct cleaning"\n\n✏️ Type or 🎙️ record your answer.`,
    );
    return;
  }

  const selected = [...new Set(valid.map(n => PROFESSIONS[n - 1].key))];
  state.collected.professions = selected;
  state.step = 'state_select';
  await setState(phone, state);

  await sendText(phone,
    `Got it: ${profLabels(selected)} 🔧\n\nStep ${2}/${total} — Which state do you serve?\n\n🌴 Florida\n🗽 New York\n🤠 Texas\n\n✏️ Type or 🎙️ record your answer.`,
  );
}

/** Simple keyword matching for profession free-text input */
function matchProfessionsByText(text: string): string[] {
  const keywords: Record<string, string[]> = {
    hvac: ['hvac', 'ac', 'air condition', 'מיזוג', 'מזגן'],
    air_duct: ['duct', 'air duct', 'ניקוי צנרת', 'דאקט'],
    renovation: ['renovation', 'remodel', 'שיפוץ', 'שיפוצ'],
    fencing: ['fence', 'fencing', 'gate', 'railing', 'גדר', 'מעקה', 'שער'],
    locksmith: ['locksmith', 'lock', 'מנעול'],
    chimney: ['chimney', 'ארובה'],
    garage: ['garage', 'גראז'],
    windows: ['window', 'door', 'חלון', 'דלת'],
    cleaning: ['clean', 'ניקיון', 'ניקוי'],
    plumbing: ['plumb', 'אינסטל'],
    electrical: ['electr', 'חשמל'],
    roofing: ['roof', 'גג'],
    painting: ['paint', 'צבע', 'צביע'],
    landscaping: ['landscape', 'garden', 'גינ', 'גינון'],
  };

  const matched: string[] = [];
  for (const [key, words] of Object.entries(keywords)) {
    if (words.some(w => text.includes(w))) {
      matched.push(key);
    }
  }
  return matched;
}

// ── State ──

async function handleStateStep(phone: string, text: string, state: BotState): Promise<void> {
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
      'Reply *1* for Florida, *2* for New York, or *3* for Texas.',
    );
    return;
  }

  state.collected.state = selectedState;
  state.step = 'city';
  await setState(phone, state);

  const stateName = { FL: 'Florida', NY: 'New York', TX: 'Texas' }[selectedState];
  const cities = getCitiesByState(selectedState);
  const cityList = cities.map((c, i) => {
    const num = String(i + 1).padStart(2, ' ');
    return `${num}. ${c.label}`;
  }).join('\n');

  await sendText(phone,
    `Step ${3}/${total} — Pick your service areas in ${stateName}:\n\n${cityList}`,
  );
}

// ── City ──

async function handleCityStep(phone: string, text: string, state: BotState): Promise<void> {
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
        `Reply with city numbers (1-${cities.length}), or *0* for all areas.\nExample: *1, 3, 5*`,
      );
      return;
    }
    const selectedKeys = [...new Set(valid.map(n => cities[n - 1].id))];
    state.collected.cities = selectedKeys;
    state.collected.zipCodes = getAllZipsForCities(selectedState, selectedKeys);
  }

  // Show selected city names
  const cityNames = (state.collected.cities ?? []).map(key => {
    const c = cities.find(ci => ci.id === key);
    return c?.label ?? key;
  }).join(', ');

  state.step = 'working_days';
  await setState(phone, state);

  await sendText(phone,
    `📍 ${cityNames}\n\nStep ${4}/${total} — When do you work?\n\n1. Mon–Fri\n2. Every day\n3. Custom\n\n✏️ Type or 🎙️ record your answer.`,
  );
}

// ── Working days ──

async function handleWorkingDaysStep(phone: string, text: string, state: BotState): Promise<void> {
  const trimmed = text.trim().toLowerCase();

  if (trimmed === '1' || trimmed.includes('mon-fri') || trimmed.includes('mon–fri')) {
    state.collected.workingDays = [1, 2, 3, 4, 5];
  } else if (trimmed === '2' || trimmed.includes('every') || trimmed.includes('כל יום')) {
    state.collected.workingDays = [0, 1, 2, 3, 4, 5, 6];
  } else if (trimmed === '3' || trimmed.includes('custom') || trimmed.includes('מותאם')) {
    await sendText(phone,
      'Send day numbers:\n0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat\n\nExample: *1,2,3,4,5*',
    );
    return;
  } else {
    const nums = text.match(/\d/g)?.map(Number).filter(n => n >= 0 && n <= 6) ?? [];
    if (nums.length === 0) {
      await sendText(phone,
        'Reply *1* for Mon-Fri, *2* for every day, or *3* for custom.',
      );
      return;
    }
    state.collected.workingDays = [...new Set(nums)].sort();
  }

  state.step = 'confirm';
  await setState(phone, state);
  await sendConfirmSummary(phone, state);
}

// ── Confirm summary ──

async function sendConfirmSummary(phone: string, state: BotState): Promise<void> {
  const total = totalSteps(state);
  const dayLabels = (state.collected.workingDays ?? []).map(d => DAY_NAMES[d]).join(', ');
  const profs = profLabels(state.collected.professions ?? []);
  const selectedState = state.collected.state ?? '';
  const counties = countyLabels(selectedState, state.collected.cities ?? []);
  const name = state.collected.name ?? '';

  await sendText(phone,
    `Step ${5}/${total} — Almost done! Here's your profile:\n\n👤 ${name}\n🔧 ${profs}\n📍 ${counties}\n📅 ${dayLabels}\n\n✅ Reply YES to confirm\n🔄 Reply REDO to start over`,
  );
}

// ── Confirm & save ──

async function handleConfirmStep(phone: string, text: string, state: BotState): Promise<void> {
  const l = state.language;
  const trimmed = text.trim().toLowerCase();

  if (['redo', 'מחדש', 'no', 'לא', 'start over', 'התחל מחדש'].includes(trimmed)) {
    state.step = 'profession';
    state.collected = { name: state.collected.name };
    await setState(phone, state);
    await sendProfessionStep(phone, state);
    return;
  }

  const positives = ['yes', 'y', 'yeah', 'yep', 'ok', 'sure', 'confirm', 'כן', 'מאשר', 'אוקי', 'בסדר', '👍', 'בטח'];
  if (!positives.some(w => trimmed.includes(w))) {
    await sendText(phone, 'Reply YES to confirm or REDO to start over.');
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
    await sendText(phone, 'Something went wrong. Try again.');
    return;
  }

  if (state.collected.name) {
    await supabase.from('profiles').update({ full_name: state.collected.name }).eq('id', userId);
  }

  await clearState(phone);

  const name = state.collected.name ?? '';
  const l = state.language;

  if (l === 'he') {
    await sendText(phone,
      `✅ מעולה ${name}! הפרופיל נשמר!\n\nלידים שמתאימים לך יגיעו ישירות לפה.\n\nשלח *MENU* לאפשרויות.`,
    );
  } else {
    await sendText(phone,
      `✅ You're all set, ${name}!\nMatching leads will come straight here.\n\nSend *MENU* for options.`,
    );
  }

  log.info({ phone, userId, professions: state.collected.professions, zipCount: state.collected.zipCodes?.length }, 'Onboarding complete');
}

// ── Save: new user (create account) ──

async function createNewUser(phone: string, state: BotState): Promise<void> {
  const l = state.language;
  const name = state.collected.name ?? 'User';

  // 1. Create auth user (no email — placeholder)
  const placeholderEmail = `wa-${phone.replace(/\+/g, '')}@app.masterleadflow.com`;

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: placeholderEmail,
    email_confirm: true,
    user_metadata: { full_name: name },
  });

  if (authError) {
    if (authError.message?.toLowerCase().includes('already') || authError.message?.toLowerCase().includes('duplicate')) {
      log.warn({ phone }, 'Duplicate phone during registration — may already have account');
      // Try to find existing user
      const { data: existing } = await supabase
        .from('profiles')
        .select('id')
        .or(`whatsapp_phone.eq.${phone},phone.eq.${phone}`)
        .maybeSingle();

      if (existing) {
        state.userId = existing.id;
        await setState(phone, state);
        await saveExistingUser(phone, state);
        return;
      }
    }
    log.error({ error: authError }, 'Failed to create user');
    await sendText(phone, l === 'he' ? 'משהו השתבש, שלח *כן* לנסות שוב.' : 'Something went wrong. Send *YES* to try again.');
    return;
  }

  const userId = authData.user.id;
  log.info({ userId, phone }, 'Auth user created');

  // 2. Update profile
  await supabase
    .from('profiles')
    .update({ full_name: name, phone, whatsapp_phone: phone })
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

  // 5. Generate magic login link
  const magicLink = await generateMagicLink(userId);
  const dashboardUrl = magicLink ?? 'https://app.masterleadflow.com/login';

  // 6. Success message
  if (l === 'he') {
    await sendText(phone,
      `✅ מעולה ${name}! הפרופיל נשמר!\n\n🎉 תקופת הנסיון שלך (7 ימים) התחילה!\nלידים שמתאימים לך יגיעו ישירות לפה.\n\n📱 הממשק שלך מוכן:\n👉 ${dashboardUrl}\n(שם תוכל להוסיף אימייל, סיסמא, ולראות את הלידים על מפה)`,
    );
  } else {
    await sendText(phone,
      `✅ Awesome, ${name}! Profile saved!\n\n🎉 Your trial (7 days) has started!\nMatching leads will come straight here.\n\n📱 Your dashboard is ready:\n👉 ${dashboardUrl}\n(You can add email, password, and see leads on a map)`,
    );
  }

  // 7. Group collection prompt
  state.userId = userId;
  state.step = 'groups';
  await setState(phone, state);

  // Count existing groups
  const { count } = await supabase
    .from('contractor_group_scan_requests')
    .select('*', { count: 'exact', head: true })
    .eq('contractor_id', userId);

  const groupCount = count ?? 0;

  if (l === 'he') {
    await sendText(phone,
      `📋 עוד דבר אחד —\n\nכרגע יש לך ${groupCount} קבוצות שאנחנו סורקים בשבילך.\n\nשלח לי קישורים לקבוצות וואטסאפ של קבלנים — ואני אסרוק אותן 24/7 ואשלח לך רק עבודות רלוונטיות.\n\nהדבק פה לינק, או שלח עזרה ואסביר לך איך מוציאים לינק מקבוצה.\n\nכתוב סיימתי כשגמרת (או דלג ותוסיף אחר כך).`,
    );
  } else {
    await sendText(phone,
      `📋 One more thing —\n\nYou currently have ${groupCount} groups we're scanning for you.\n\nSend me WhatsApp group invite links for contractor groups — I'll scan them 24/7 and send you only relevant jobs.\n\nPaste a link here, or send HELP for instructions.\n\nType DONE when finished (or skip and add later).`,
    );
  }

  log.info({ userId, phone, professions: state.collected.professions, zipCount: state.collected.zipCodes?.length }, 'Registration complete');
}

// ── Groups collection step ──

const GROUP_LINK_RE = /chat\.whatsapp\.com\/([A-Za-z0-9]+)/;

async function handleGroupsStep(phone: string, text: string, state: BotState): Promise<void> {
  const l = state.language;
  const lower = text.trim().toLowerCase();

  // Done / skip
  if (['done', 'סיימתי', 'דלג', 'skip', 'later', 'אחר כך'].includes(lower)) {
    await clearState(phone);
    await sendText(phone,
      l === 'he'
        ? '👍 מעולה! אפשר להוסיף קבוצות מתי שרוצים.\n\nשלח *MENU* לאפשרויות.'
        : `👍 Great! You can add groups anytime.\n\nSend *MENU* for options.`,
    );
    return;
  }

  // Help
  if (['help', 'עזרה'].includes(lower)) {
    await sendText(phone,
      l === 'he'
        ? '📱 *איך מוציאים לינק מקבוצה:*\n\n1. פתח את הקבוצה בוואטסאפ\n2. לחץ על שם הקבוצה למעלה\n3. גלול למטה ולחץ על "הזמן באמצעות לינק"\n4. לחץ "העתק לינק"\n5. הדבק פה!\n\nאפשר לשלוח כמה לינקים שרוצים.'
        : `📱 *How to get a group invite link:*\n\n1. Open the group in WhatsApp\n2. Tap the group name at the top\n3. Scroll down and tap "Invite via link"\n4. Tap "Copy link"\n5. Paste it here!\n\nYou can send as many links as you want.`,
    );
    return;
  }

  // Try to extract group link
  const match = text.match(GROUP_LINK_RE);
  if (match) {
    const inviteCode = match[1];
    const userId = state.userId;

    if (userId) {
      await supabase.from('contractor_group_scan_requests').insert({
        contractor_id: userId,
        invite_code: inviteCode,
        invite_link: `https://chat.whatsapp.com/${inviteCode}`,
        status: 'pending',
      });
    }

    await sendText(phone,
      l === 'he'
        ? '✅ הקבוצה נשמרה! שלח עוד לינקים או כתוב *סיימתי*.'
        : '✅ Group saved! Send more links or type *DONE*.',
    );
    return;
  }

  // Unrecognized
  await sendText(phone,
    l === 'he'
      ? 'שלח לינק לקבוצת וואטסאפ (chat.whatsapp.com/...) או כתוב *סיימתי*.'
      : 'Send a WhatsApp group link (chat.whatsapp.com/...) or type *DONE*.',
  );
}
