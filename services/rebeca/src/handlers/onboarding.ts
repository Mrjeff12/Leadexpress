import { supabase } from '../lib/supabase.js';
import { config } from '../config.js';
import { sendText } from '../lib/twilio.js';
import { lang, resolveLocale, detectLangFromMessage } from '../lib/i18n.js';
import { getState, setState, clearState } from '../lib/state.js';
import { getCitiesByState, getAllZipsForCities, matchState, matchMultipleStates, stateName, US_STATES, CITY_ZIPS } from '../lib/city-zips.js';
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

const TOTAL_STEPS_SUB = 5;      // profession, state, city, working_days, confirm
const TOTAL_STEPS_GC = 4;       // states, cities, professions_needed, confirm

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
  return state.collected.role === 'gc' ? TOTAL_STEPS_GC : TOTAL_STEPS_SUB;
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
      body: JSON.stringify({ action: 'generate', user_id: userId, redirect_path: '/complete-account' }),
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
export async function startOnboarding(phone: string, profile: { id: string; full_name: string; preferred_locale?: string | null }): Promise<void> {
  const l = resolveLocale(phone, profile.preferred_locale, null);
  const hasRealName = profile.full_name && !profile.full_name.startsWith('+');

  const state: BotState = {
    step: 'role',
    userId: profile.id,
    prospectId: null,
    language: l,
    openaiResponseId: null,
    sessionStartedAt: new Date().toISOString(),
    collected: hasRealName ? { name: profile.full_name } : {},
  };
  await setState(phone, state);
  await sendRoleStep(phone, state);
}

/**
 * Start onboarding for a brand-new user (no account at all).
 * Sends the welcome/sales pitch message first.
 */
export async function startNewUserOnboarding(phone: string, firstMessage?: string): Promise<void> {
  const l = resolveLocale(phone, null, firstMessage ?? null);

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

  // Re-detect language from each message so the bot adapts if user switches
  const detected = detectLangFromMessage(text);
  if (detected && detected !== state.language) {
    state.language = detected;
    await setState(phone, state);
  }

  const lower = text.trim().toLowerCase();
  if (['stop', 'cancel', 'ביטול', 'הפסק'].includes(lower)) {
    await clearState(phone);
    const l = state.language;
    await sendText(phone, l === 'he' ? 'בוטל. שלח הודעה מתי שתרצה.' : 'Cancelled. Send a message anytime.');
    return;
  }
  if (['redo', 'start over', 'מחדש', 'התחל מחדש'].includes(lower)) {
    state.step = 'role';
    state.collected = { name: state.collected.name };
    await setState(phone, state);
    await sendRoleStep(phone, state);
    return;
  }

  switch (state.step) {
    case 'welcome':        return handleWelcomeStep(phone, text, state);
    case 'name':           return handleNameStep(phone, text, state);
    case 'role':           return handleRoleStep(phone, text, state);
    case 'profession':     return handleProfessionStep(phone, text, state);
    case 'state_select':   return handleStateStep(phone, text, state);
    case 'city':           return handleCityStep(phone, text, state);
    case 'working_days':   return handleWorkingDaysStep(phone, text, state);
    case 'confirm':        return handleConfirmStep(phone, text, state);
    case 'groups':         return handleGroupsStep(phone, text, state);
    case 'gc_states':      return handleGcStatesStep(phone, text, state);
    case 'gc_cities':      return handleGcCitiesStep(phone, text, state);
    case 'gc_professions': return handleGcProfessionsStep(phone, text, state);
    case 'gc_confirm':     return handleGcConfirmStep(phone, text, state);
    default:
      state.step = 'role';
      await setState(phone, state);
      return sendRoleStep(phone, state);
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
  state.step = 'role';
  await setState(phone, state);

  const greeting = l === 'he'
    ? `נעים להכיר, ${name}! ⚡`
    : `Nice to meet you, ${name}! ⚡`;

  await sendText(phone,
    l === 'he'
      ? `${greeting}\n\nאתה מפרסם עבודות או מחפש עבודות?\n\n1️⃣ מחפש עבודות (קבלן משנה / טכנאי)\n2️⃣ מפרסם עבודות (קבלן ראשי)\n\n✏️ הקלד 1 או 2`
      : `${greeting}\n\nAre you looking for jobs or posting jobs?\n\n1️⃣ Looking for jobs (Subcontractor)\n2️⃣ Posting jobs (General Contractor)\n\n✏️ Type 1 or 2`,
  );
}

// ── Role ──

async function sendRoleStep(phone: string, state: BotState): Promise<void> {
  const l = state.language;
  const name = state.collected.name ? `, ${state.collected.name}` : '';

  await sendText(phone,
    l === 'he'
      ? `שלום${name}! 👋\n\nאתה מפרסם עבודות או מחפש עבודות?\n\n1️⃣ מחפש עבודות (קבלן משנה / טכנאי)\n2️⃣ מפרסם עבודות (קבלן ראשי)\n\n✏️ הקלד 1 או 2`
      : `Hey${name}! 👋\n\nAre you looking for jobs or posting jobs?\n\n1️⃣ Looking for jobs (Subcontractor)\n2️⃣ Posting jobs (General Contractor)\n\n✏️ Type *1* or *2*`,
  );
}

async function handleRoleStep(phone: string, text: string, state: BotState): Promise<void> {
  const l = state.language;
  const lower = text.trim().toLowerCase();

  const isSub = lower === '1' || lower.includes('looking') || lower.includes('מחפש') || lower.includes('sub');
  const isGc = lower === '2' || lower.includes('posting') || lower.includes('מפרסם') || lower.includes('general') || lower.includes('ראשי');

  if (!isSub && !isGc) {
    await sendText(phone,
      l === 'he'
        ? 'הקלד *1* אם אתה מחפש עבודות, או *2* אם אתה מפרסם עבודות.'
        : 'Type *1* if you\'re looking for jobs, or *2* if you\'re posting jobs.',
    );
    return;
  }

  if (isSub) {
    state.collected.role = 'sub';
    state.step = 'profession';
    await setState(phone, state);
    await sendProfessionStep(phone, state);
  } else {
    state.collected.role = 'gc';
    state.step = 'gc_states';
    await setState(phone, state);
    await sendGcStatesStep(phone, state);
  }
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
    `${intro}Step 1/${total} — What services do you offer?\n\n${shortList}\n\n📋 Type *MORE* to see all services\n\n✏️ Type the name of your service, or pick a number from the list.\nYou can also 🎙️ record a voice message.\nExample: "HVAC" or "1, 3, 5"`,
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
        `Got it: ${profLabels(matched)} 🔧\n\nStep 2/${total} — Which state do you serve?\n\n✏️ Type the state name or abbreviation.\nExamples: "Florida", "FL", "New York", "TX"\n🎙️ You can also record a voice message.`,
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
    `Got it: ${profLabels(selected)} 🔧\n\nStep 2/${total} — Which state do you serve?\n\n✏️ Type the state name or abbreviation.\nExamples: "Florida", "FL", "New York", "TX"\n🎙️ You can also record a voice message.`,
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

// ── State (Sub flow — single state, all 50 supported) ──

async function handleStateStep(phone: string, text: string, state: BotState): Promise<void> {
  const total = totalSteps(state);
  const l = state.language;

  const selectedState = matchState(text);
  if (!selectedState) {
    await sendText(phone,
      l === 'he'
        ? 'לא הצלחתי לזהות את המדינה.\n\n✏️ הקלד את שם המדינה או הקיצור שלה.\nדוגמאות: "Florida", "FL", "California", "CA"'
        : `I didn't recognize that state.\n\n✏️ Type the full state name or abbreviation.\nExamples: "Florida", "FL", "California", "CA"`,
    );
    return;
  }

  state.collected.state = selectedState;
  state.step = 'city';
  await setState(phone, state);

  const sName = stateName(selectedState);
  const cities = getCitiesByState(selectedState);

  if (cities.length > 0) {
    const cityList = cities.map((c, i) => {
      const num = String(i + 1).padStart(2, ' ');
      return `${num}. ${c.label}`;
    }).join('\n');

    await sendText(phone,
      l === 'he'
        ? `Step 3/${total} — באילו ערים ב-${sName} אתה עובד?\n\n${cityList}\n\n✏️ הקלד מספרים מופרדים בפסיקים.\nדוגמה: *1, 3, 5*\nאו הקלד *0* לכל הערים.`
        : `Step 3/${total} — Pick your service areas in ${sName}:\n\n${cityList}\n\n✏️ Type the numbers separated by commas.\nExample: *1, 3, 5*\nOr type *0* for all areas.`,
    );
  } else {
    // No predefined cities — ask for free text
    await sendText(phone,
      l === 'he'
        ? `Step 3/${total} — באילו ערים ב-${sName} אתה עובד?\n\n✏️ הקלד שמות של ערים, מופרדים בפסיקים.\nדוגמה: "Miami, Fort Lauderdale, Hollywood"\nאו הקלד *all* אם אתה מכסה את כל המדינה.`
        : `Step 3/${total} — Which cities in ${sName} do you serve?\n\n✏️ Type city names separated by commas.\nExample: "Miami, Fort Lauderdale, Hollywood"\nOr type *all* if you cover the whole state.`,
    );
  }
}

// ── City ──

async function handleCityStep(phone: string, text: string, state: BotState): Promise<void> {
  const total = totalSteps(state);
  const l = state.language;
  const selectedState = state.collected.state!;
  const cities = getCitiesByState(selectedState);
  const lower = text.trim().toLowerCase();

  if (cities.length > 0) {
    // Predefined city list — use numbered selection
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
            ? `הקלד מספרי ערים (1-${cities.length}), או *0* לכל הערים.\nדוגמה: *1, 3, 5*`
            : `Type city numbers (1-${cities.length}), or *0* for all areas.\nExample: *1, 3, 5*`,
        );
        return;
      }
      const selectedKeys = [...new Set(valid.map(n => cities[n - 1].id))];
      state.collected.cities = selectedKeys;
      state.collected.zipCodes = getAllZipsForCities(selectedState, selectedKeys);
    }

    const cityNames = (state.collected.cities ?? []).map(key => {
      const c = cities.find(ci => ci.id === key);
      return c?.label ?? key;
    }).join(', ');

    state.step = 'working_days';
    await setState(phone, state);

    await sendText(phone,
      l === 'he'
        ? `📍 ${cityNames}\n\nStep 4/${total} — מתי אתה עובד?\n\n1. ראשון-חמישי\n2. כל יום\n3. מותאם אישית\n\n✏️ הקלד 1, 2, או 3`
        : `📍 ${cityNames}\n\nStep 4/${total} — When do you work?\n\n1. Mon–Fri\n2. Every day\n3. Custom (pick specific days)\n\n✏️ Type *1*, *2*, or *3*`,
    );
  } else {
    // No predefined cities — accept free text
    if (lower === 'all' || lower === 'הכל' || lower === 'כל המדינה') {
      state.collected.cities = ['all'];
    } else {
      const cityNames = text.split(/[,\n]+/).map(s => s.trim()).filter(Boolean);
      if (cityNames.length === 0) {
        await sendText(phone,
          l === 'he'
            ? `✏️ הקלד שמות ערים מופרדים בפסיקים.\nדוגמה: "Miami, Tampa, Orlando"\nאו הקלד *all* לכל המדינה.`
            : `✏️ Type city names separated by commas.\nExample: "Miami, Tampa, Orlando"\nOr type *all* for the whole state.`,
        );
        return;
      }
      state.collected.cities = cityNames;
    }

    const display = state.collected.cities![0] === 'all'
      ? `All of ${stateName(selectedState)}`
      : state.collected.cities!.join(', ');

    state.step = 'working_days';
    await setState(phone, state);

    await sendText(phone,
      l === 'he'
        ? `📍 ${display}\n\nStep 4/${total} — מתי אתה עובד?\n\n1. ראשון-חמישי\n2. כל יום\n3. מותאם אישית\n\n✏️ הקלד 1, 2, או 3`
        : `📍 ${display}\n\nStep 4/${total} — When do you work?\n\n1. Mon–Fri\n2. Every day\n3. Custom (pick specific days)\n\n✏️ Type *1*, *2*, or *3*`,
    );
  }
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
  const l = state.language;
  const total = totalSteps(state);
  const dayLabels = (state.collected.workingDays ?? []).map(d => DAY_NAMES[d]).join(', ');
  const profs = profLabels(state.collected.professions ?? []);
  const selectedState = state.collected.state ?? '';
  const sName = stateName(selectedState);
  const cityDisplay = countyLabels(selectedState, state.collected.cities ?? []);
  const name = state.collected.name ?? '';

  await sendText(phone,
    l === 'he'
      ? `Step 5/${total} — כמעט סיימנו! הנה הפרופיל שלך:\n\n👤 ${name}\n🔧 ${profs}\n📍 ${sName} — ${cityDisplay}\n📅 ${dayLabels}\n\n✅ הקלד *כן* לאישור\n🔄 הקלד *מחדש* להתחיל שוב`
      : `Step 5/${total} — Almost done! Here's your profile:\n\n👤 ${name}\n🔧 ${profs}\n📍 ${sName} — ${cityDisplay}\n📅 ${dayLabels}\n\n✅ Type *YES* to confirm\n🔄 Type *REDO* to start over`,
  );
}

// ── Confirm & save ──

async function handleConfirmStep(phone: string, text: string, state: BotState): Promise<void> {
  const l = state.language;
  const trimmed = text.trim().toLowerCase();

  if (['redo', 'מחדש', 'no', 'לא', 'start over', 'התחל מחדש'].includes(trimmed)) {
    state.step = 'profession';
    state.collected = { name: state.collected.name, role: 'sub' };
    await setState(phone, state);
    await sendProfessionStep(phone, state);
    return;
  }

  const positives = ['yes', 'y', 'yeah', 'yep', 'ok', 'sure', 'confirm', 'כן', 'מאשר', 'אוקי', 'בסדר', '👍', 'בטח'];
  if (!positives.some(w => trimmed.includes(w))) {
    const l = state.language;
    await sendText(phone,
      l === 'he' ? 'הקלד *כן* לאישור או *מחדש* להתחיל שוב.' : 'Type *YES* to confirm or *REDO* to start over.',
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
  const userId = state.userId!;

  const { error } = await supabase
    .from('contractors')
    .update({
      role: 'sub',
      professions: state.collected.professions,
      zip_codes: state.collected.zipCodes,
      service_states: state.collected.state ? [state.collected.state] : [],
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
    role: 'sub',
    professions: state.collected.professions,
    zip_codes: state.collected.zipCodes,
    service_states: state.collected.state ? [state.collected.state] : [],
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

// ══════════════════════════════════════════════════════════════════════════════
// GC (General Contractor) flow
// ══════════════════════════════════════════════════════════════════════════════

// ── GC: States (multiple) ──

async function sendGcStatesStep(phone: string, state: BotState): Promise<void> {
  const l = state.language;
  await sendText(phone,
    l === 'he'
      ? `🏗️ מעולה — בוא נגדיר את הפרופיל שלך כקבלן ראשי.\n\nStep 1/${TOTAL_STEPS_GC} — באילו מדינות אתה פועל?\n\n✏️ הקלד שמות מדינות או קיצורים, מופרדים בפסיקים.\nדוגמה: "Florida, New York, Texas"\nאו: "FL, NY, TX"\n\nאפשר לבחור כמה שרוצים!`
      : `🏗️ Great — let's set up your General Contractor profile.\n\nStep 1/${TOTAL_STEPS_GC} — Which states do you operate in?\n\n✏️ Type state names or abbreviations, separated by commas.\nExample: "Florida, New York, Texas"\nOr: "FL, NY, TX"\n\nYou can pick as many as you need!`,
  );
}

async function handleGcStatesStep(phone: string, text: string, state: BotState): Promise<void> {
  const l = state.language;
  const matched = matchMultipleStates(text);

  if (matched.length === 0) {
    await sendText(phone,
      l === 'he'
        ? `לא הצלחתי לזהות מדינות.\n\n✏️ הקלד שמות מדינות או קיצורים.\nדוגמה: "Florida, Texas" או "FL, TX, CA"`
        : `I didn't recognize any states.\n\n✏️ Type state names or abbreviations.\nExample: "Florida, Texas" or "FL, TX, CA"`,
    );
    return;
  }

  state.collected.states = matched;
  state.collected.citiesByState = {};

  // Start collecting cities for first state
  state.step = 'gc_cities';
  state.extra = { gcCityStateIndex: 0 };
  await setState(phone, state);

  await sendGcCitiesForState(phone, state, matched[0]);
}

// ── GC: Cities per state ──

async function sendGcCitiesForState(phone: string, state: BotState, stateCode: string): Promise<void> {
  const l = state.language;
  const sName = stateName(stateCode);
  const states = state.collected.states ?? [];
  const idx = (state.extra?.gcCityStateIndex as number) ?? 0;
  const cities = getCitiesByState(stateCode);

  if (cities.length > 0) {
    const cityList = cities.map((c, i) => `${String(i + 1).padStart(2, ' ')}. ${c.label}`).join('\n');
    await sendText(phone,
      l === 'he'
        ? `Step 2/${TOTAL_STEPS_GC} — ערים ב-${sName} (${idx + 1}/${states.length}):\n\n${cityList}\n\n✏️ הקלד מספרים מופרדים בפסיקים.\nדוגמה: *1, 3, 5*\nאו הקלד *0* לכל הערים ב-${sName}.`
        : `Step 2/${TOTAL_STEPS_GC} — Cities in ${sName} (${idx + 1}/${states.length}):\n\n${cityList}\n\n✏️ Type numbers separated by commas.\nExample: *1, 3, 5*\nOr type *0* for all cities in ${sName}.`,
    );
  } else {
    await sendText(phone,
      l === 'he'
        ? `Step 2/${TOTAL_STEPS_GC} — ערים ב-${sName} (${idx + 1}/${states.length}):\n\n✏️ הקלד שמות ערים מופרדים בפסיקים.\nדוגמה: "Miami, Tampa, Orlando"\nאו הקלד *all* לכל ${sName}.`
        : `Step 2/${TOTAL_STEPS_GC} — Cities in ${sName} (${idx + 1}/${states.length}):\n\n✏️ Type city names separated by commas.\nExample: "Miami, Tampa, Orlando"\nOr type *all* for all of ${sName}.`,
    );
  }
}

async function handleGcCitiesStep(phone: string, text: string, state: BotState): Promise<void> {
  const l = state.language;
  const states = state.collected.states ?? [];
  const idx = (state.extra?.gcCityStateIndex as number) ?? 0;
  const currentStateCode = states[idx];
  const cities = getCitiesByState(currentStateCode);
  const lower = text.trim().toLowerCase();

  if (!state.collected.citiesByState) state.collected.citiesByState = {};

  if (cities.length > 0) {
    const numbers = text.match(/\d+/g)?.map(Number) ?? [];
    if (numbers.includes(0)) {
      state.collected.citiesByState[currentStateCode] = cities.map(c => c.id);
    } else {
      const valid = numbers.filter(n => n >= 1 && n <= cities.length);
      if (valid.length === 0) {
        await sendText(phone,
          l === 'he'
            ? `הקלד מספרי ערים (1-${cities.length}), או *0* לכל הערים.\nדוגמה: *1, 3, 5*`
            : `Type city numbers (1-${cities.length}), or *0* for all.\nExample: *1, 3, 5*`,
        );
        return;
      }
      state.collected.citiesByState[currentStateCode] = [...new Set(valid.map(n => cities[n - 1].id))];
    }
  } else {
    if (lower === 'all' || lower === 'הכל') {
      state.collected.citiesByState[currentStateCode] = ['all'];
    } else {
      const cityNames = text.split(/[,\n]+/).map(s => s.trim()).filter(Boolean);
      if (cityNames.length === 0) {
        await sendText(phone,
          l === 'he'
            ? `✏️ הקלד שמות ערים או *all* לכל המדינה.`
            : `✏️ Type city names or *all* for the whole state.`,
        );
        return;
      }
      state.collected.citiesByState[currentStateCode] = cityNames;
    }
  }

  // Move to next state or to professions
  const nextIdx = idx + 1;
  if (nextIdx < states.length) {
    state.extra = { ...state.extra, gcCityStateIndex: nextIdx };
    await setState(phone, state);
    await sendGcCitiesForState(phone, state, states[nextIdx]);
  } else {
    state.step = 'gc_professions';
    await setState(phone, state);
    await sendGcProfessionsStep(phone, state);
  }
}

// ── GC: Professions needed ──

async function sendGcProfessionsStep(phone: string, state: BotState): Promise<void> {
  const l = state.language;
  const fullList = PROFESSIONS.map((p, i) => `${i + 1}. ${p.emoji} ${p.en}`).join('\n');

  await sendText(phone,
    l === 'he'
      ? `Step 3/${TOTAL_STEPS_GC} — איזה סוגי טכנאים אתה מחפש?\n\n${fullList}\n\n✏️ הקלד מספרים מופרדים בפסיקים.\nדוגמה: *1, 3, 10, 11*\nאפשר לבחור כמה שרוצים!\n\nאו הקלד את סוג הטכנאי (למשל: "HVAC, plumbing")`
      : `Step 3/${TOTAL_STEPS_GC} — What types of technicians are you looking for?\n\n${fullList}\n\n✏️ Type numbers separated by commas.\nExample: *1, 3, 10, 11*\nPick as many as you need!\n\nOr type the service name (e.g., "HVAC, plumbing")`,
  );
}

async function handleGcProfessionsStep(phone: string, text: string, state: BotState): Promise<void> {
  const l = state.language;
  const lower = text.trim().toLowerCase();

  // Try numbers first
  const numbers = text.match(/\d+/g)?.map(Number) ?? [];
  const valid = numbers.filter(n => n >= 1 && n <= PROFESSIONS.length);

  let selected: string[];

  if (valid.length > 0) {
    selected = [...new Set(valid.map(n => PROFESSIONS[n - 1].key))];
  } else {
    const matched = matchProfessionsByText(lower);
    if (matched.length === 0) {
      await sendText(phone,
        l === 'he'
          ? `לא הצלחתי לזהות. הקלד מספרים (1-${PROFESSIONS.length}) או שמות שירותים.\nדוגמה: *1, 3, 5* או "HVAC, plumbing"`
          : `I didn't catch that. Type numbers (1-${PROFESSIONS.length}) or service names.\nExample: *1, 3, 5* or "HVAC, plumbing"`,
      );
      return;
    }
    selected = matched;
  }

  state.collected.professions = selected;
  state.step = 'gc_confirm';
  await setState(phone, state);
  await sendGcConfirmSummary(phone, state);
}

// ── GC: Confirm ──

async function sendGcConfirmSummary(phone: string, state: BotState): Promise<void> {
  const l = state.language;
  const name = state.collected.name ?? '';
  const profs = profLabels(state.collected.professions ?? []);
  const statesList = (state.collected.states ?? []).map(s => stateName(s)).join(', ');

  // Build cities summary
  const citiesSummary = (state.collected.states ?? []).map(s => {
    const sName = stateName(s);
    const cityKeys = state.collected.citiesByState?.[s] ?? [];
    const predefinedCities = getCitiesByState(s);
    let cityDisplay: string;
    if (cityKeys[0] === 'all') {
      cityDisplay = l === 'he' ? 'כל המדינה' : 'Entire state';
    } else if (predefinedCities.length > 0) {
      cityDisplay = cityKeys.map(k => {
        const c = predefinedCities.find(ci => ci.id === k);
        return c?.label ?? k;
      }).join(', ');
    } else {
      cityDisplay = cityKeys.join(', ');
    }
    return `  📍 ${sName}: ${cityDisplay}`;
  }).join('\n');

  await sendText(phone,
    l === 'he'
      ? `Step 4/${TOTAL_STEPS_GC} — סיכום הפרופיל שלך:\n\n👤 ${name}\n🏗️ קבלן ראשי\n📍 מדינות: ${statesList}\n${citiesSummary}\n🔧 מחפש: ${profs}\n\n✅ הקלד *כן* לאישור\n🔄 הקלד *מחדש* להתחיל מחדש`
      : `Step 4/${TOTAL_STEPS_GC} — Your profile summary:\n\n👤 ${name}\n🏗️ General Contractor\n📍 States: ${statesList}\n${citiesSummary}\n🔧 Looking for: ${profs}\n\n✅ Type *YES* to confirm\n🔄 Type *REDO* to start over`,
  );
}

async function handleGcConfirmStep(phone: string, text: string, state: BotState): Promise<void> {
  const l = state.language;
  const trimmed = text.trim().toLowerCase();

  if (['redo', 'מחדש', 'no', 'לא', 'start over', 'התחל מחדש'].includes(trimmed)) {
    state.step = 'role';
    state.collected = { name: state.collected.name };
    await setState(phone, state);
    await sendRoleStep(phone, state);
    return;
  }

  const positives = ['yes', 'y', 'yeah', 'yep', 'ok', 'sure', 'confirm', 'כן', 'מאשר', 'אוקי', 'בסדר', '👍', 'בטח'];
  if (!positives.some(w => trimmed.includes(w))) {
    await sendText(phone,
      l === 'he' ? 'הקלד *כן* לאישור או *מחדש* להתחיל שוב.' : 'Type *YES* to confirm or *REDO* to start over.',
    );
    return;
  }

  // Save GC profile — collect all zip codes from all states/cities
  const allZips: string[] = [];
  const allCities: string[] = [];
  for (const s of state.collected.states ?? []) {
    const cityKeys = state.collected.citiesByState?.[s] ?? [];
    if (cityKeys[0] !== 'all') {
      const zips = getAllZipsForCities(s, cityKeys);
      allZips.push(...zips);
      allCities.push(...cityKeys);
    } else {
      // "all" — get all cities for that state
      const cities = getCitiesByState(s);
      const keys = cities.map(c => c.id);
      allCities.push(...keys);
      allZips.push(...getAllZipsForCities(s, keys));
    }
  }

  state.collected.cities = allCities;
  state.collected.zipCodes = [...new Set(allZips)].sort();

  if (state.userId) {
    await saveGcUser(phone, state);
  } else {
    await createGcUser(phone, state);
  }
}

async function saveGcUser(phone: string, state: BotState): Promise<void> {
  const userId = state.userId!;

  const { error } = await supabase
    .from('contractors')
    .update({
      role: 'gc',
      professions: state.collected.professions,
      zip_codes: state.collected.zipCodes,
      service_states: state.collected.states,
      working_days: [1, 2, 3, 4, 5],
      wa_notify: true,
      is_active: true,
    })
    .eq('user_id', userId);

  if (error) {
    log.error({ error, userId }, 'Failed to save GC onboarding');
    await sendText(phone, 'Something went wrong. Try again.');
    return;
  }

  if (state.collected.name) {
    await supabase.from('profiles').update({ full_name: state.collected.name }).eq('id', userId);
  }

  await clearState(phone);

  const name = state.collected.name ?? '';
  const l = state.language;

  await sendText(phone,
    l === 'he'
      ? `✅ מעולה ${name}! פרופיל הקבלן הראשי שלך נשמר!\n\nכשטכנאים מתאימים נרשמים — נעדכן אותך.\n\nשלח *MENU* לאפשרויות.`
      : `✅ All set, ${name}! Your GC profile is saved!\n\nWe'll notify you when matching technicians sign up.\n\nSend *MENU* for options.`,
  );

  log.info({ phone, userId, role: 'gc', states: state.collected.states, professions: state.collected.professions }, 'GC onboarding complete');
}

async function createGcUser(phone: string, state: BotState): Promise<void> {
  const l = state.language;
  const name = state.collected.name ?? 'User';

  const placeholderEmail = `wa-${phone.replace(/\+/g, '')}@app.masterleadflow.com`;

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: placeholderEmail,
    email_confirm: true,
    user_metadata: { full_name: name },
  });

  if (authError) {
    if (authError.message?.toLowerCase().includes('already') || authError.message?.toLowerCase().includes('duplicate')) {
      const { data: existing } = await supabase
        .from('profiles')
        .select('id')
        .or(`whatsapp_phone.eq.${phone},phone.eq.${phone}`)
        .maybeSingle();

      if (existing) {
        state.userId = existing.id;
        await setState(phone, state);
        await saveGcUser(phone, state);
        return;
      }
    }
    log.error({ error: authError }, 'Failed to create GC user');
    await sendText(phone, l === 'he' ? 'משהו השתבש, שלח *כן* לנסות שוב.' : 'Something went wrong. Send *YES* to try again.');
    return;
  }

  const userId = authData.user.id;
  log.info({ userId, phone }, 'GC auth user created');

  await supabase
    .from('profiles')
    .update({ full_name: name, phone, whatsapp_phone: phone })
    .eq('id', userId);

  await supabase.from('contractors').insert({
    user_id: userId,
    role: 'gc',
    professions: state.collected.professions,
    zip_codes: state.collected.zipCodes,
    service_states: state.collected.states,
    working_days: [1, 2, 3, 4, 5],
    is_active: true,
    wa_notify: true,
  });

  // Create trial
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
  }

  const magicLink = await generateMagicLink(userId);
  const dashboardUrl = magicLink ?? 'https://app.masterleadflow.com/login';

  await sendText(phone,
    l === 'he'
      ? `✅ מעולה ${name}! פרופיל הקבלן הראשי נוצר!\n\n🎉 תקופת הנסיון שלך (7 ימים) התחילה!\n\n📱 הממשק שלך מוכן:\n👉 ${dashboardUrl}\n\nשלח *MENU* לאפשרויות.`
      : `✅ Awesome, ${name}! Your GC profile is created!\n\n🎉 Your trial (7 days) has started!\n\n📱 Your dashboard is ready:\n👉 ${dashboardUrl}\n\nSend *MENU* for options.`,
  );

  await clearState(phone);
  log.info({ userId, phone, role: 'gc', states: state.collected.states, professions: state.collected.professions }, 'GC registration complete');
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

    // Send PWA install tip
    const name = state.collected.name?.split(' ')[0] ?? '';
    await sendText(phone,
      l === 'he'
        ? `📱 טיפ אחרון, ${name} —\n\nהתקן את האפליקציה שלנו כדי לקבל התרעות מיידיות גם כשוואטסאפ שקט:\n👉 https://app.masterleadflow.com/install\n\nלוקח 30 שניות. לא תפספס אף ליד!`
        : `📱 One last tip, ${name} —\n\nInstall our app to get instant notifications even when WhatsApp is quiet:\n👉 https://app.masterleadflow.com/install\n\nTakes 30 seconds. You'll never miss a lead!`,
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
      // Check if already submitted
      const { data: existing } = await supabase
        .from('contractor_group_scan_requests')
        .select('id, status')
        .eq('invite_code', inviteCode)
        .neq('status', 'archived')
        .maybeSingle();

      if (existing) {
        const statusMsg: Record<string, string> = {
          pending: l === 'he' ? '⏳ הקבוצה הזו כבר בתור — ממתינה להצטרפות.' : '⏳ This group is already queued — waiting to join.',
          joined: l === 'he' ? '✅ כבר הצטרפנו לקבוצה הזו!' : '✅ We already joined this group!',
          failed: l === 'he' ? '❌ ניסינו להצטרף אבל נכשל. ננסה שוב!' : '❌ Join failed before. We\'ll retry!',
        };
        await sendText(phone, statusMsg[existing.status] ?? (l === 'he' ? '👍 כבר יש לנו את הקבוצה.' : '👍 We already have this group.'));

        // If failed, reset to pending for retry
        if (existing.status === 'failed') {
          await supabase.from('contractor_group_scan_requests')
            .update({ status: 'pending', last_error: null })
            .eq('id', existing.id);
        }
        return;
      }

      const inviteLink = `https://chat.whatsapp.com/${inviteCode}`;
      const { error: insertErr } = await supabase.from('contractor_group_scan_requests').insert({
        contractor_id: userId,
        invite_code: inviteCode,
        invite_link_raw: inviteLink,
        invite_link_normalized: inviteLink,
        status: 'pending',
        join_method: 'manual',
      });
      if (insertErr) {
        console.error('[onboarding] Failed to save group link:', insertErr.message);
      }
    }

    await sendText(phone,
      l === 'he'
        ? '✅ הקבוצה נשמרה! נצטרף בהקדם. שלח עוד לינקים או כתוב *סיימתי*.'
        : '✅ Group saved! We\'ll join soon. Send more links or type *DONE*.',
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
