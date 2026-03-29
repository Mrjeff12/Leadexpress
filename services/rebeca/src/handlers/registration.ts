import { supabase } from '../lib/supabase.js';
import { sendText } from '../lib/twilio.js';
import { lang } from '../lib/i18n.js';
import { getState, setState, clearState } from '../lib/state.js';
import { getCitiesByState, getAllZipsForCities } from '../lib/city-zips.js';
import type { BotState } from '../lib/state.js';
import pino from 'pino';

const log = pino({ name: 'registration' });

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

/**
 * Start registration for a brand-new user (no profile/account).
 */
export async function startRegistration(phone: string): Promise<void> {
  const l = lang(phone);

  const state: BotState = {
    step: 'profession',
    userId: null,
    prospectId: null,
    language: l,
    openaiResponseId: null,
    sessionStartedAt: new Date().toISOString(),
    flow: 'registration',
    collected: {},
  };
  await setState(phone, state);

  await sendProfessionStep(phone, l);
}

async function sendProfessionStep(phone: string, l: 'he' | 'en'): Promise<void> {
  const profList = PROFESSIONS.map((p, i) =>
    `${i + 1}️⃣ ${p.emoji} ${l === 'he' ? p.he : p.en}`
  ).join('\n');

  if (l === 'he') {
    await sendText(phone,
      `ברוך הבא ל-MasterLeadFlow! 👋\n\nבוא נגדיר אותך תוך 2 דקות.\n\n*שלב 1/4:* מה סוג העבודה שלך?\nשלח את המספרים של המקצועות שלך:\n\n${profList}\n${OTHER_INDEX}️⃣ 📋 אחר\n\nלדוגמה: 1, 6 למיזוג ואינסטלציה`,
    );
  } else {
    await sendText(phone,
      `Welcome to MasterLeadFlow! 👋\n\nLet's get you set up in under 2 minutes.\n\n*Step 1/4:* What type of work do you do?\nReply with the numbers of your trades:\n\n${profList}\n${OTHER_INDEX}️⃣ 📋 Other\n\nExample: 1, 6 for HVAC and Plumbing`,
    );
  }
}

/**
 * Handle a message from a user in the registration flow.
 */
export async function handleRegistration(phone: string, text: string): Promise<void> {
  const state = await getState(phone);
  if (!state) return;

  const lower = text.trim().toLowerCase();
  if (['stop', 'cancel', 'ביטול', 'הפסק'].includes(lower)) {
    await clearState(phone);
    const l = state.language;
    await sendText(phone, l === 'he' ? 'בוטל. שלח הודעה מתי שתרצה להתחיל.' : 'Cancelled. Send a message anytime to start.');
    return;
  }

  if (['redo', 'start over', 'מחדש', 'התחל מחדש'].includes(lower)) {
    await clearState(phone);
    await startRegistration(phone);
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
    case 'name':
      await handleNameStep(phone, text, state);
      return;
    case 'email':
      await handleEmailStep(phone, text, state);
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

// ── Step 2/4: State + Cities ──

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
      `*שלב 2/4 (המשך):* באילו אזורים אתה עובד?\nשלח מספרים, או *0* לכל האזורים:\n\n0️⃣ 🗺️ כל האזורים\n${cityList}\n\nלדוגמה: 1, 3, 5`,
    );
  } else {
    await sendText(phone,
      `*Step 2/4 (cont):* Which areas do you cover?\nReply with numbers, or *0* for all areas:\n\n0️⃣ 🗺️ All areas\n${cityList}\n\nExample: 1, 3, 5`,
    );
  }
}

async function handleCityStep(phone: string, text: string, state: BotState): Promise<void> {
  const l = state.language;
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

  state.step = 'name';
  await setState(phone, state);

  const cityCount = state.collected.cities!.length;

  if (l === 'he') {
    await sendText(phone,
      `נבחרו ${cityCount} אזורים\n\n*שלב 3/4:* מה השם המלא שלך?`,
    );
  } else {
    await sendText(phone,
      `Selected ${cityCount} areas\n\n*Step 3/4:* What is your full name?`,
    );
  }
}

// ── Step 3/4: Name ──

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
  state.step = 'email';
  await setState(phone, state);

  const firstName = name.split(' ')[0];
  if (l === 'he') {
    await sendText(phone,
      `תודה, ${firstName}!\n\n*שלב 4/4:* מה כתובת האימייל שלך?\n\nנשתמש בזה להתחברות לדשבורד.`,
    );
  } else {
    await sendText(phone,
      `Thanks, ${firstName}!\n\n*Step 4/4:* What is your email address?\n\nWe'll use this for your dashboard login.`,
    );
  }
}

// ── Step 4/4: Email ──

async function handleEmailStep(phone: string, text: string, state: BotState): Promise<void> {
  const l = state.language;
  const email = text.trim().toLowerCase();

  if (!EMAIL_RE.test(email)) {
    await sendText(phone,
      l === 'he'
        ? 'זה לא נראה כמו אימייל תקין. נסה שוב.\nלדוגמה: *john@gmail.com*'
        : 'That doesn\'t look like a valid email. Please try again.\nExample: *john@gmail.com*',
    );
    return;
  }

  state.collected.email = email;
  state.step = 'confirm';
  await setState(phone, state);

  const profLabels = (state.collected.professions ?? []).map(key => {
    if (key === 'other') return l === 'he' ? 'אחר' : 'Other';
    const p = PROFESSIONS.find(pr => pr.key === key);
    return p ? `${p.emoji} ${l === 'he' ? p.he : p.en}` : key;
  }).join(', ');

  const cityCount = state.collected.cities?.length ?? 0;

  if (l === 'he') {
    await sendText(phone,
      `*אשר את הפרטים:*\n\n👤 *שם:* ${state.collected.name}\n📧 *אימייל:* ${email}\n🔧 *מקצועות:* ${profLabels}\n📍 *אזור:* ${cityCount} ערים ב-${state.collected.state}\n📅 *ימי עבודה:* ראשון-חמישי\n\n*כן* לאישור | *מחדש* להתחיל מחדש`,
    );
  } else {
    await sendText(phone,
      `*Confirm your details:*\n\n👤 *Name:* ${state.collected.name}\n📧 *Email:* ${email}\n🔧 *Trades:* ${profLabels}\n📍 *Area:* ${cityCount} cities in ${state.collected.state}\n📅 *Working days:* Mon-Fri\n\n*YES* to confirm | *REDO* to start over`,
    );
  }
}

// ── Confirm & Create Account ──

async function handleConfirmStep(phone: string, text: string, state: BotState): Promise<void> {
  const l = state.language;
  const trimmed = text.trim().toLowerCase();

  if (['redo', 'מחדש', 'no', 'לא', 'start over', 'התחל מחדש'].includes(trimmed)) {
    await clearState(phone);
    await startRegistration(phone);
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

  // ── 1. Create auth user ──
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
  log.info({ userId, email: state.collected.email }, 'Registration: auth user created');

  // ── 2. Update profile (handle_new_user trigger already created the row) ──
  await supabase
    .from('profiles')
    .update({ phone, whatsapp_phone: phone })
    .eq('id', userId);

  // ── 3. Insert contractor record ──
  const { error: contractorError } = await supabase
    .from('contractors')
    .insert({
      user_id: userId,
      professions: state.collected.professions,
      zip_codes: state.collected.zipCodes,
      working_days: [1, 2, 3, 4, 5],
      is_active: true,
      wa_notify: true,
    });

  if (contractorError) {
    log.error({ error: contractorError, userId }, 'Failed to insert contractor');
  }

  // ── 4. Create trial subscription ──
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

  // ── 5. Send magic link via email ──
  const { error: inviteError } = await supabase.auth.admin.inviteUserByEmail(state.collected.email!);
  if (inviteError) {
    log.error({ error: inviteError }, 'Failed to send invite email');
  }

  // ── 6. Clear state ──
  await clearState(phone);

  // ── 7. Success messages ──
  const profLabels = (state.collected.professions ?? []).map(key => {
    if (key === 'other') return l === 'he' ? 'אחר' : 'Other';
    const p = PROFESSIONS.find(pr => pr.key === key);
    return p ? `${p.emoji} ${l === 'he' ? p.he : p.en}` : key;
  }).join(', ');

  const firstName = state.collected.name?.split(' ')[0] ?? '';

  if (l === 'he') {
    await sendText(phone,
      `✅ *החשבון נוצר!*\n\n👤 ${state.collected.name}\n🔧 ${profLabels}\n📍 ${state.collected.cities?.length} ערים ב-${state.collected.state}\n🆓 תקופת ניסיון 7 ימים\n\nהצ'ק-אין הראשון שלך יגיע מחר בבוקר.`,
    );
    await sendText(phone,
      `📧 בדוק את האימייל — שלחנו לינק כניסה לדשבורד.`,
    );
  } else {
    await sendText(phone,
      `✅ *Account created!*\n\n👤 ${state.collected.name}\n🔧 ${profLabels}\n📍 ${state.collected.cities?.length} cities in ${state.collected.state}\n🆓 7-day free trial started\n\nYou'll receive your first check-in tomorrow morning.`,
    );
    await sendText(phone,
      `📧 Check your email for a dashboard login link.`,
    );
  }

  log.info({ userId, email: state.collected.email, professions: state.collected.professions, zipCount: state.collected.zipCodes?.length }, 'Registration complete');
}
