import { supabase } from '../lib/supabase.js';
import { sendText } from '../lib/twilio.js';
import { lang } from '../lib/i18n.js';
import { getState, setState, clearState, newOnboardState } from '../lib/state.js';
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
] as const;

const OTHER_INDEX = 8; // "Other" is always last option

const DAY_NAMES_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_NAMES_HE = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

/**
 * Start onboarding for a user who has a profile but no contractor setup.
 */
export async function startOnboarding(phone: string, profile: { id: string; full_name: string }): Promise<void> {
  const l = lang(phone);
  const hasRealName = profile.full_name && !profile.full_name.startsWith('+');

  const state = newOnboardState(profile.id, null, l, hasRealName ? profile.full_name : undefined);
  await setState(phone, state);

  await sendProfessionStep(phone, l);
}

async function sendProfessionStep(phone: string, l: 'he' | 'en'): Promise<void> {
  const profList = PROFESSIONS.map((p, i) =>
    `${i + 1}️⃣ ${p.emoji} ${l === 'he' ? p.he : p.en}`
  ).join('\n');

  if (l === 'he') {
    await sendText(phone,
      `בוא נגדיר אותך תוך 2 דקות.\n\n*שלב 1/4:* מה סוג העבודה שלך?\nשלח את המספרים של המקצועות שלך:\n\n${profList}\n${OTHER_INDEX}️⃣ 📋 אחר\n\nלדוגמה: 1, 6 למיזוג ואינסטלציה`,
    );
  } else {
    await sendText(phone,
      `Let's get you set up in under 2 minutes.\n\n*Step 1/4:* What type of work do you do?\nReply with the numbers of your trades:\n\n${profList}\n${OTHER_INDEX}️⃣ 📋 Other\n\nExample: 1, 6 for HVAC and Plumbing`,
    );
  }
}

/**
 * Handle a message from a user who is currently in the onboarding flow.
 */
export async function handleOnboarding(phone: string, text: string): Promise<void> {
  const state = await getState(phone);
  if (!state) return;

  const lower = text.trim().toLowerCase();
  if (['menu', 'help', 'cancel', 'stop', 'תפריט', 'ביטול'].includes(lower)) {
    await clearState(phone);
    const l = state.language;
    await sendText(phone, l === 'he' ? 'בוטל. שלח MENU לאפשרויות.' : 'Cancelled. Send MENU for options.');
    return;
  }

  switch (state.step) {
    case 'profession':
      await handleProfessionStep(phone, text, state);
      return;
    case 'state_select':
      await handleStateStep(phone, text, state);
      return;
    case 'city':
      await handleCityStep(phone, text, state);
      return;
    case 'working_days':
      await handleWorkingDaysStep(phone, text, state);
      return;
    case 'confirm':
      await handleConfirmStep(phone, text, state);
      return;
    default:
      state.step = 'profession';
      await setState(phone, state);
      await handleProfessionStep(phone, text, state);
      return;
  }
}

// ── Step 1/4: Profession ──

async function handleProfessionStep(phone: string, text: string, state: BotState): Promise<void> {
  const l = state.language;
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

  const labels = selected.map(key => {
    if (key === 'other') return `📋 ${l === 'he' ? 'אחר' : 'Other'}`;
    const p = PROFESSIONS.find(pr => pr.key === key)!;
    return `${p.emoji} ${l === 'he' ? p.he : p.en}`;
  }).join(', ');

  if (l === 'he') {
    await sendText(phone,
      `בחרת: ${labels}\n\n*שלב 2/4:* באיזה מדינה אתה עובד?\n\n1️⃣ 🌴 פלורידה\n2️⃣ 🗽 ניו יורק\n3️⃣ 🤠 טקסס`,
    );
  } else {
    await sendText(phone,
      `You selected: ${labels}\n\n*Step 2/4:* Which state do you work in?\n\n1️⃣ 🌴 Florida\n2️⃣ 🗽 New York\n3️⃣ 🤠 Texas`,
    );
  }
}

// ── Step 2/4: State ──

async function handleStateStep(phone: string, text: string, state: BotState): Promise<void> {
  const l = state.language;
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

  if (l === 'he') {
    await sendText(phone,
      `*שלב 3/4:* באילו אזורים אתה עובד?\nשלח מספרים, או *0* לכל האזורים:\n\n0️⃣ 🗺️ כל האזורים\n${cityList}\n\nלדוגמה: 1, 3, 5`,
    );
  } else {
    await sendText(phone,
      `*Step 3/4:* Which areas do you cover?\nReply with numbers, or *0* for all areas:\n\n0️⃣ 🗺️ All areas\n${cityList}\n\nExample: 1, 3, 5`,
    );
  }
}

// ── Step 3/4: City ──

async function handleCityStep(phone: string, text: string, state: BotState): Promise<void> {
  const l = state.language;
  const selectedState = state.collected.state!;
  const cities = getCitiesByState(selectedState);

  const numbers = text.match(/\d+/g)?.map(Number) ?? [];

  if (numbers.includes(0)) {
    const allKeys = cities.map(c => c.id);
    const allZips = getAllZipsForCities(selectedState, allKeys);
    state.collected.cities = allKeys;
    state.collected.zipCodes = allZips;
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
    const zips = getAllZipsForCities(selectedState, selectedKeys);
    state.collected.cities = selectedKeys;
    state.collected.zipCodes = zips;
  }

  state.step = 'working_days';
  await setState(phone, state);

  if (l === 'he') {
    await sendText(phone,
      `*שלב 4/4:* באילו ימים אתה עובד?\n\n1️⃣ ראשון-חמישי\n2️⃣ כל יום\n3️⃣ מותאם אישית`,
    );
  } else {
    await sendText(phone,
      `*Step 4/4:* Which days do you work?\n\n1️⃣ Mon-Fri\n2️⃣ Every day\n3️⃣ Custom`,
    );
  }
}

// ── Step 4/4: Working days ──

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

  state.step = 'confirm';
  await setState(phone, state);

  const dayNames = l === 'he' ? DAY_NAMES_HE : DAY_NAMES_EN;
  const profLabels = (state.collected.professions ?? []).map(key => {
    if (key === 'other') return l === 'he' ? 'אחר' : 'Other';
    const p = PROFESSIONS.find(pr => pr.key === key);
    return p ? `${p.emoji} ${l === 'he' ? p.he : p.en}` : key;
  }).join(', ');
  const dayLabels = (state.collected.workingDays ?? []).map(d => dayNames[d]).join(', ');
  const cityCount = state.collected.cities?.length ?? 0;

  if (l === 'he') {
    await sendText(phone,
      `*סיכום הפרופיל:*\n\n🔧 ${profLabels}\n📍 ${state.collected.state} — ${cityCount} אזורים\n📅 ${dayLabels}\n\n*כן* לאישור | *מחדש* להתחיל מחדש`,
    );
  } else {
    await sendText(phone,
      `*Profile summary:*\n\n🔧 ${profLabels}\n📍 ${state.collected.state} — ${cityCount} areas\n📅 ${dayLabels}\n\n*YES* to confirm | *REDO* to start over`,
    );
  }
}

// ── Confirm ──

async function handleConfirmStep(phone: string, text: string, state: BotState): Promise<void> {
  const l = state.language;
  const trimmed = text.trim().toLowerCase();

  if (['redo', 'מחדש', 'no', 'לא', 'start over', 'התחל מחדש'].includes(trimmed)) {
    state.step = 'profession';
    state.collected = { name: state.collected.name };
    await setState(phone, state);
    await sendProfessionStep(phone, l);
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

  // Save to DB
  const userId = state.userId;
  if (!userId) {
    log.error({ phone }, 'Confirm step with no userId');
    return;
  }

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

  if (l === 'he') {
    await sendText(phone,
      `✅ הפרופיל מוגדר!\nלידים מתאימים יגיעו ישירות לפה.\n\nשלח *MENU* לאפשרויות.`,
    );
  } else {
    await sendText(phone,
      `✅ You're all set!\nMatching leads will come straight here.\n\nSend *MENU* for options.`,
    );
  }

  log.info({ phone, userId, professions: state.collected.professions, zipCount: state.collected.zipCodes?.length }, 'Onboarding complete');
}
