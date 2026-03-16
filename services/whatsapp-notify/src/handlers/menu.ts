import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type Redis from 'ioredis';
import type { Logger } from 'pino';
import { config } from '../config.js';
import { sendText } from '../interactive.js';
import { PROFESSIONS, setOnboardState, type WaOnboardState } from './onboarding.js';

const supabase: SupabaseClient = createClient(config.supabase.url, config.supabase.serviceKey);

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// ---------------------------------------------------------------------------
// MENU — main menu
// ---------------------------------------------------------------------------

export async function handleMenu(phone: string, log: Logger): Promise<void> {
  await sendText(
    phone,
    `📋 *LeadExpress Menu*\n\nReply with a number:\n\n1️⃣ ⚙️ My Settings\n2️⃣ 📍 Update Areas\n3️⃣ 🔧 Update Trades\n4️⃣ 📅 Working Days\n5️⃣ ⏸️ Pause / Resume Leads`,
    log,
  );
}

// ---------------------------------------------------------------------------
// SETTINGS — show current profile
// ---------------------------------------------------------------------------

export async function handleSettings(phone: string, log: Logger): Promise<void> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('whatsapp_phone', phone)
    .maybeSingle();

  if (!profile) {
    await sendText(phone, `You're not connected yet. Send any message to get started.`, log);
    return;
  }

  const { data: contractor } = await supabase
    .from('contractors')
    .select('professions, zip_codes, is_active, wa_notify, working_days')
    .eq('user_id', profile.id)
    .maybeSingle();

  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('status, plans!inner(name)')
    .eq('user_id', profile.id)
    .in('status', ['active', 'trialing'])
    .maybeSingle();

  // Count leads this month
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const { count: leadsThisMonth } = await supabase
    .from('leads')
    .select('id', { count: 'exact', head: true })
    .eq('claimed_by', profile.id)
    .gte('claimed_at', startOfMonth.toISOString());

  const planData = subscription?.plans as unknown;
  const planName = planData
    ? (Array.isArray(planData) ? (planData[0] as { name: string })?.name : (planData as { name: string })?.name)
    : 'Free';

  const profLabels = contractor?.professions?.length
    ? contractor.professions
        .map((p: string) => {
          const match = PROFESSIONS.find((pr) => pr.key === p);
          return match ? `${match.emoji} ${match.label}` : p;
        })
        .join(', ')
    : 'None';

  const dayLabels = contractor?.working_days?.length
    ? contractor.working_days.map((d: number) => DAY_NAMES[d]).join(', ')
    : 'Mon-Fri';

  const statusEmoji = contractor?.wa_notify ? '✅ Active' : '⏸️ Paused';

  await sendText(
    phone,
    `⚙️ *Your Settings*\n\n👤 *Name:* ${profile.full_name}\n📦 *Plan:* ${planName}\n📊 *Leads this month:* ${leadsThisMonth ?? 0}\n🔔 *Status:* ${statusEmoji}\n\n🔧 *Trades:* ${profLabels}\n📍 *ZIP codes:* ${contractor?.zip_codes?.length ?? 0}\n📅 *Days:* ${dayLabels}\n\nSend *MENU* to update any of these.`,
    log,
  );
}

// ---------------------------------------------------------------------------
// PAUSE / RESUME
// ---------------------------------------------------------------------------

export async function handlePause(phone: string, log: Logger): Promise<void> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('whatsapp_phone', phone)
    .maybeSingle();

  if (!profile) return;

  const { data: contractor } = await supabase
    .from('contractors')
    .select('wa_notify')
    .eq('user_id', profile.id)
    .maybeSingle();

  if (!contractor) return;

  const newState = !contractor.wa_notify;
  await supabase
    .from('contractors')
    .update({ wa_notify: newState })
    .eq('user_id', profile.id);

  if (newState) {
    await sendText(phone, `✅ *Leads resumed!*\nYou'll get your next check-in tomorrow morning.`, log);
  } else {
    await sendText(phone, `⏸️ *Leads paused.*\nYou won't receive leads until you resume.\nSend *MENU* → 5 to resume.`, log);
  }

  log.info({ userId: profile.id, wa_notify: newState }, 'Contractor toggled WA notifications');
}

// ---------------------------------------------------------------------------
// Start re-onboarding for areas or trades
// ---------------------------------------------------------------------------

export async function handleUpdateAreas(phone: string, redis: Redis, log: Logger): Promise<void> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('whatsapp_phone', phone)
    .maybeSingle();

  if (!profile) return;

  const state: WaOnboardState = {
    userId: profile.id,
    step: 'city',
    professions: [],
    cities: [],
    zipCodes: [],
    state: '',
    workingDays: [1, 2, 3, 4, 5],
  };
  await setOnboardState(redis, phone, state);

  await sendText(
    phone,
    `📍 *Update Service Areas*\n\nWhich state do you work in?\n\n1️⃣ 🌴 Florida\n2️⃣ 🗽 New York\n3️⃣ 🤠 Texas`,
    log,
  );
}

export async function handleUpdateTrades(phone: string, redis: Redis, log: Logger): Promise<void> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('whatsapp_phone', phone)
    .maybeSingle();

  if (!profile) return;

  const state: WaOnboardState = {
    userId: profile.id,
    step: 'profession',
    professions: [],
    cities: [],
    zipCodes: [],
    state: '',
    workingDays: [1, 2, 3, 4, 5],
  };
  await setOnboardState(redis, phone, state);

  await sendText(
    phone,
    `🔧 *Update Trades*\n\nReply with numbers:\n\n1️⃣ ❄️ HVAC / AC\n2️⃣ 🔨 Renovation\n3️⃣ 🧱 Fencing & Railing\n4️⃣ ✨ Cleaning\n5️⃣ 🔑 Locksmith\n6️⃣ 🚰 Plumbing\n7️⃣ ⚡ Electrical\n8️⃣ 📋 Other\n\nExample: *1, 6*`,
    log,
  );
}

export async function handleUpdateDays(phone: string, redis: Redis, log: Logger): Promise<void> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('whatsapp_phone', phone)
    .maybeSingle();

  if (!profile) return;

  const state: WaOnboardState = {
    userId: profile.id,
    step: 'working_days',
    professions: [],
    cities: [],
    zipCodes: [],
    state: '',
    workingDays: [1, 2, 3, 4, 5],
  };
  await setOnboardState(redis, phone, state);

  await sendText(
    phone,
    `📅 *Update Working Days*\n\n1️⃣ Mon-Fri\n2️⃣ Every day\n3️⃣ Custom\n\nReply *1*, *2*, or *3*`,
    log,
  );
}

// ---------------------------------------------------------------------------
// Route menu selection (1-5)
// ---------------------------------------------------------------------------

export async function handleMenuSelection(
  phone: string,
  selection: string,
  redis: Redis,
  log: Logger,
): Promise<boolean> {
  switch (selection) {
    case '1':
      await handleSettings(phone, log);
      return true;
    case '2':
      await handleUpdateAreas(phone, redis, log);
      return true;
    case '3':
      await handleUpdateTrades(phone, redis, log);
      return true;
    case '4':
      await handleUpdateDays(phone, redis, log);
      return true;
    case '5':
      await handlePause(phone, log);
      return true;
    default:
      return false;
  }
}
