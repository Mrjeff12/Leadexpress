import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

// ── Supabase + Twilio clients ───────────────────────────────────────────────

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const TWILIO_SID = Deno.env.get('TWILIO_ACCOUNT_SID')!;
const TWILIO_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN')!;
const TWILIO_FROM = Deno.env.get('TWILIO_WA_FROM') ?? 'whatsapp:+14155238886';
const TWILIO_URL = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`;
const TWILIO_AUTH = 'Basic ' + btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`);

// ── Redis-like state via Supabase (Edge Functions can't use Redis) ──────────
// We use a simple key-value approach with the profiles table metadata
// For onboarding state, we store in a lightweight table or use Supabase Realtime
// For MVP: onboarding state stored in a separate table

// ── Constants ───────────────────────────────────────────────────────────────

const POSITIVE_WORDS = ['כן', 'yes', 'yeah', 'yep', 'y', 'ok', 'אוקי', 'זמין', 'available', 'sure', 'בטח', 'כמובן', '👍', 'yea', 'ya', 'ken', 'betach'];
const NEGATIVE_WORDS = ['off', 'skip', 'no', 'לא', 'not'];
const MENU_TRIGGERS = ['menu', 'help', 'תפריט'];

// ── Main handler ────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'GET') {
    return new Response(JSON.stringify({ status: 'ok', service: 'whatsapp-webhook', version: '2.0' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const formData = await req.formData();
    const from = (formData.get('From') as string) ?? '';
    const body = (formData.get('Body') as string) ?? '';
    const messageSid = (formData.get('MessageSid') as string) ?? '';

    const phone = from.replace('whatsapp:', '');
    const text = body.trim();
    const textLower = text.toLowerCase();

    console.log(`[webhook] phone=${phone}, text=${text.substring(0, 50)}, sid=${messageSid}`);

    if (!phone) {
      return twiml();
    }

    // Route message
    await routeMessage(phone, text, textLower);
  } catch (err) {
    console.error('[webhook] Error:', err);
  }

  return twiml();
});

// ── Router ──────────────────────────────────────────────────────────────────

async function routeMessage(phone: string, text: string, textLower: string): Promise<void> {
  // 0. Check for account connection code (LE-{userId prefix})
  const codeMatch = text.match(/LE-([a-f0-9]{8})/i);
  if (codeMatch) {
    await handleConnectionCode(phone, codeMatch[1]);
    return;
  }

  // 1. Check if user has onboarding state
  const { data: onboardState } = await supabase
    .from('wa_onboard_state')
    .select('*')
    .eq('phone', phone)
    .maybeSingle();

  if (onboardState) {
    await handleOnboardingStep(phone, text, textLower, onboardState);
    return;
  }

  // 2. Check if this is a known user
  const profile = await findProfile(phone);

  if (!profile) {
    // Unknown user — try matching by phone field
    const profileByPhone = await findProfileByPhone(phone);
    if (!profileByPhone) {
      await sendText(phone, `Welcome! 👋\n\nYou don't have a LeadExpress account yet.\nVisit leadexpress.com to start your free trial.`);
      return;
    }
    // Link WhatsApp and continue
    await supabase.from('profiles').update({ whatsapp_phone: phone }).eq('id', profileByPhone.id);
    await handleKnownUser(phone, text, textLower, profileByPhone);
    return;
  }

  await handleKnownUser(phone, text, textLower, profile);
}

async function handleKnownUser(
  phone: string,
  text: string,
  textLower: string,
  profile: { id: string; full_name: string },
): Promise<void> {
  // Check subscription (every interaction)
  const hasSub = await checkSubscription(profile.id);
  if (!hasSub) {
    await sendText(phone, `Hi ${profile.full_name}! Your subscription has expired.\nVisit leadexpress.com to renew.`);
    return;
  }

  // Check if contractor exists and is set up
  const { data: contractor } = await supabase
    .from('contractors')
    .select('user_id, professions, zip_codes, wa_notify')
    .eq('user_id', profile.id)
    .maybeSingle();

  // Not set up yet — start onboarding
  if (!contractor || contractor.professions.length === 0 || contractor.zip_codes.length === 0) {
    if (!contractor) {
      await supabase.from('contractors').insert({ user_id: profile.id, wa_notify: true });
    } else {
      await supabase.from('contractors').update({ wa_notify: true }).eq('user_id', profile.id);
    }
    await startOnboarding(phone, profile);
    return;
  }

  // Enable WA if not already
  if (!contractor.wa_notify) {
    await supabase.from('contractors').update({ wa_notify: true }).eq('user_id', profile.id);
  }

  // ── Route by message content ──────────────────────────────────────────

  // Menu
  if (MENU_TRIGGERS.some(t => textLower === t)) {
    await handleMenu(phone);
    return;
  }

  // Menu selections (1-5 after MENU was shown)
  if (['1', '2', '3', '4', '5'].includes(textLower) && await isMenuContext(phone)) {
    await handleMenuSelection(phone, textLower, profile.id);
    return;
  }

  // Check-in responses
  if (isCheckinResponse(textLower)) {
    await handleCheckin(phone, textLower, profile);
    return;
  }

  // Claim/Pass (from lead notification callbacks)
  if (textLower.startsWith('claim:')) {
    const leadId = text.substring(6).trim();
    await handleClaim(phone, leadId, profile.id);
    return;
  }
  if (textLower.startsWith('pass:')) {
    const leadId = text.substring(5).trim();
    await handlePass(phone, leadId, profile.id);
    return;
  }

  // Settings shortcut
  if (textLower === 'settings' || textLower === 'status') {
    await handleSettings(phone, profile.id);
    return;
  }

  // Pause/resume shortcuts
  if (textLower === 'stop' || textLower === 'pause') {
    await handlePauseResume(phone, profile.id, false);
    return;
  }
  if (textLower === 'start' || textLower === 'resume') {
    await handlePauseResume(phone, profile.id, true);
    return;
  }

  // Default — show menu hint
  await sendText(phone, `Send *MENU* for options, or reply to your morning check-in to start receiving leads.`);
}

// ── Account Connection handler ──────────────────────────────────────────────

async function handleConnectionCode(phone: string, codePrefix: string): Promise<void> {
  // Find user by ID prefix
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name')
    .like('id', `${codePrefix}%`)
    .maybeSingle();

  if (!profile) {
    await sendText(phone, `Invalid connection code. Please try again from your LeadExpress dashboard.`);
    console.log(`[connect] No profile found for code prefix: ${codePrefix}`);
    return;
  }

  // Check if already connected
  const { data: existing } = await supabase
    .from('profiles')
    .select('whatsapp_phone')
    .eq('id', profile.id)
    .single();

  if (existing?.whatsapp_phone) {
    await sendText(phone, `Your account is already connected! 👍\nSend *MENU* for options.`);
    return;
  }

  // Link WhatsApp phone to profile
  await supabase.from('profiles').update({ whatsapp_phone: phone }).eq('id', profile.id);

  const firstName = profile.full_name?.split(' ')[0] ?? 'there';
  await sendText(
    phone,
    `✅ *Connected!* Welcome ${firstName}!\n\nYour WhatsApp is now linked to LeadExpress.\nYou'll receive leads and updates right here.\n\nSend *MENU* for options.`,
  );

  console.log(`[connect] WhatsApp linked: ${phone} → user ${profile.id}`);
}

// ── Check-in handler ────────────────────────────────────────────────────────

function isCheckinResponse(text: string): boolean {
  return POSITIVE_WORDS.some(w => text.includes(w)) || NEGATIVE_WORDS.some(w => text.includes(w));
}

async function handleCheckin(
  phone: string,
  textLower: string,
  profile: { id: string; full_name: string },
): Promise<void> {
  const isAvailable = POSITIVE_WORDS.some(w => textLower.includes(w));

  if (isAvailable) {
    const windowUntil = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    await supabase
      .from('contractors')
      .update({ available_today: true, wa_window_until: windowUntil })
      .eq('user_id', profile.id);

    await sendText(phone, `✅ You're live! Leads will come through today.`);
    console.log(`[checkin] ${profile.id} available until ${windowUntil}`);
  } else {
    await supabase
      .from('contractors')
      .update({ available_today: false })
      .eq('user_id', profile.id);

    await sendText(phone, `👍 Got it, enjoy your day off!`);
    console.log(`[checkin] ${profile.id} off today`);
  }
}

// ── Menu handler ────────────────────────────────────────────────────────────

async function handleMenu(phone: string): Promise<void> {
  // Set menu context so next number reply routes here
  await supabase.from('wa_onboard_state').upsert({
    phone,
    step: 'menu',
    data: {},
    updated_at: new Date().toISOString(),
  });

  await sendText(
    phone,
    `📋 *LeadExpress Menu*\n\nReply with a number:\n\n1️⃣ ⚙️ My Settings\n2️⃣ 📍 Update Areas\n3️⃣ 🔧 Update Trades\n4️⃣ 📅 Working Days\n5️⃣ ⏸️ Pause / Resume Leads`,
  );
}

async function isMenuContext(phone: string): Promise<boolean> {
  const { data } = await supabase
    .from('wa_onboard_state')
    .select('step')
    .eq('phone', phone)
    .eq('step', 'menu')
    .maybeSingle();
  return !!data;
}

async function handleMenuSelection(phone: string, selection: string, userId: string): Promise<void> {
  // Clear menu context
  await supabase.from('wa_onboard_state').delete().eq('phone', phone);

  switch (selection) {
    case '1':
      await handleSettings(phone, userId);
      break;
    case '2':
      await startOnboardingStep(phone, userId, 'city');
      break;
    case '3':
      await startOnboardingStep(phone, userId, 'profession');
      break;
    case '4':
      await startOnboardingStep(phone, userId, 'working_days');
      break;
    case '5':
      await handlePauseToggle(phone, userId);
      break;
  }
}

// ── Settings ────────────────────────────────────────────────────────────────

async function handleSettings(phone: string, userId: string): Promise<void> {
  const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', userId).single();
  const { data: contractor } = await supabase.from('contractors').select('professions, zip_codes, wa_notify, working_days').eq('user_id', userId).single();
  const { data: sub } = await supabase.from('subscriptions').select('status, plans!inner(name)').eq('user_id', userId).in('status', ['active', 'trialing']).maybeSingle();

  const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const PROF_EMOJI: Record<string, string> = { hvac: '❄️', renovation: '🔨', fencing: '🧱', cleaning: '✨', locksmith: '🔑', plumbing: '🚰', electrical: '⚡', other: '📋' };

  const profLabels = contractor?.professions?.map((p: string) => `${PROF_EMOJI[p] ?? '📋'} ${p}`).join(', ') ?? 'None';
  const dayLabels = contractor?.working_days?.map((d: number) => DAY_NAMES[d]).join(', ') ?? 'Mon-Fri';
  const planData = sub?.plans as unknown;
  const planName = planData ? (Array.isArray(planData) ? (planData[0] as {name: string})?.name : (planData as {name: string})?.name) : 'Free';
  const statusEmoji = contractor?.wa_notify ? '✅ Active' : '⏸️ Paused';

  await sendText(
    phone,
    `⚙️ *Your Settings*\n\n👤 *Name:* ${profile?.full_name ?? 'N/A'}\n📦 *Plan:* ${planName}\n🔔 *Status:* ${statusEmoji}\n\n🔧 *Trades:* ${profLabels}\n📍 *ZIP codes:* ${contractor?.zip_codes?.length ?? 0}\n📅 *Days:* ${dayLabels}\n\nSend *MENU* to change.`,
  );
}

// ── Pause/Resume ────────────────────────────────────────────────────────────

async function handlePauseResume(phone: string, userId: string, enable: boolean): Promise<void> {
  await supabase.from('contractors').update({ wa_notify: enable }).eq('user_id', userId);
  if (enable) {
    await sendText(phone, `✅ *Leads resumed!* You'll get your next check-in tomorrow.`);
  } else {
    await sendText(phone, `⏸️ *Leads paused.* Send *START* to resume.`);
  }
}

async function handlePauseToggle(phone: string, userId: string): Promise<void> {
  const { data } = await supabase.from('contractors').select('wa_notify').eq('user_id', userId).single();
  const newState = !data?.wa_notify;
  await handlePauseResume(phone, userId, newState);
}

// ── Claim/Pass ──────────────────────────────────────────────────────────────

async function handleClaim(phone: string, leadId: string, userId: string): Promise<void> {
  const { data: lead, error } = await supabase
    .from('leads')
    .update({ status: 'claimed', claimed_by: userId, claimed_at: new Date().toISOString() })
    .eq('id', leadId)
    .eq('status', 'sent')
    .select('id, profession, city, sender_id, parsed_summary')
    .maybeSingle();

  if (error || !lead) {
    await sendText(phone, `This lead has already been claimed or is no longer available.`);
    return;
  }

  const contactLink = buildContactLink(lead);
  if (contactLink) {
    await sendText(phone, `✅ Lead claimed! Good luck 🤞\n\n👉 Contact: ${contactLink}`);
  } else {
    await sendText(phone, `✅ Lead claimed! Good luck 🤞`);
  }
}

async function handlePass(phone: string, leadId: string, userId: string): Promise<void> {
  await supabase.from('pipeline_events').insert({
    stage: 'lead_passed',
    detail: { lead_id: leadId, contractor_id: userId, channel: 'whatsapp' },
  });
  await sendText(phone, `OK, skipped. You'll get the next one! 👍`);
}

function buildContactLink(lead: { sender_id: string | null; profession: string; city: string | null }): string | null {
  if (!lead.sender_id) return null;
  const senderPhone = lead.sender_id.replace(/@.*$/, '');
  if (!senderPhone || senderPhone.length < 8) return null;
  const city = lead.city ?? 'your area';
  const msg = encodeURIComponent(`Hi! I'm a licensed ${lead.profession} contractor reaching out about your request in ${city}. I'm available and can help. When works for you?`);
  return `https://wa.me/${senderPhone}?text=${msg}`;
}

// ── Onboarding ──────────────────────────────────────────────────────────────

async function startOnboarding(phone: string, profile: { id: string; full_name: string }): Promise<void> {
  await supabase.from('wa_onboard_state').upsert({
    phone,
    step: 'profession',
    data: { userId: profile.id, professions: [], cities: [], zipCodes: [], state: '', workingDays: [1,2,3,4,5] },
    updated_at: new Date().toISOString(),
  });

  const firstName = profile.full_name.split(' ')[0];
  await sendText(
    phone,
    `Welcome to LeadExpress, ${firstName}! 🔧\n\nLet's set up your profile.\n\n*Step 1:* What type of work do you do?\nReply with numbers:\n\n1️⃣ ❄️ HVAC / AC\n2️⃣ 🔨 Renovation\n3️⃣ 🧱 Fencing & Railing\n4️⃣ ✨ Cleaning\n5️⃣ 🔑 Locksmith\n6️⃣ 🚰 Plumbing\n7️⃣ ⚡ Electrical\n8️⃣ 📋 Other\n\nExample: *1, 6*`,
  );
}

async function startOnboardingStep(phone: string, userId: string, step: string): Promise<void> {
  await supabase.from('wa_onboard_state').upsert({
    phone,
    step,
    data: { userId, professions: [], cities: [], zipCodes: [], state: '', workingDays: [1,2,3,4,5] },
    updated_at: new Date().toISOString(),
  });

  switch (step) {
    case 'profession':
      await sendText(phone, `🔧 *Update Trades*\n\n1️⃣ ❄️ HVAC / AC\n2️⃣ 🔨 Renovation\n3️⃣ 🧱 Fencing & Railing\n4️⃣ ✨ Cleaning\n5️⃣ 🔑 Locksmith\n6️⃣ 🚰 Plumbing\n7️⃣ ⚡ Electrical\n8️⃣ 📋 Other\n\nReply with numbers: e.g. *1, 6*`);
      break;
    case 'city':
      await sendText(phone, `📍 *Update Areas*\n\nWhich state?\n\n1️⃣ 🌴 Florida\n2️⃣ 🗽 New York\n3️⃣ 🤠 Texas`);
      break;
    case 'working_days':
      await sendText(phone, `📅 *Working Days*\n\n1️⃣ Mon-Fri\n2️⃣ Every day\n3️⃣ Custom`);
      break;
  }
}

async function handleOnboardingStep(
  phone: string,
  text: string,
  textLower: string,
  state: { step: string; data: Record<string, unknown> },
): Promise<void> {
  const data = state.data as {
    userId: string;
    professions: string[];
    cities: string[];
    zipCodes: string[];
    state: string;
    workingDays: number[];
  };

  switch (state.step) {
    case 'menu':
      // Menu was shown, route selection
      if (['1','2','3','4','5'].includes(textLower)) {
        await supabase.from('wa_onboard_state').delete().eq('phone', phone);
        await handleMenuSelection(phone, textLower, data.userId);
      } else {
        await sendText(phone, `Reply 1-5 to select, or send *MENU* again.`);
      }
      break;

    case 'profession':
      await onboardProfession(phone, text, data);
      break;

    case 'city_state':
      await onboardCityState(phone, textLower, data);
      break;

    case 'city':
      await onboardCity(phone, textLower, data);
      break;

    case 'working_days':
      await onboardWorkingDays(phone, textLower, data);
      break;

    case 'confirm':
      await onboardConfirm(phone, textLower, data);
      break;

    default:
      await supabase.from('wa_onboard_state').delete().eq('phone', phone);
      await sendText(phone, `Send *MENU* for options.`);
  }
}

// ── Onboarding steps ────────────────────────────────────────────────────────

const PROFESSIONS = ['hvac','renovation','fencing','cleaning','locksmith','plumbing','electrical','other'];
const PROF_LABELS: Record<string, string> = { hvac:'❄️ HVAC', renovation:'🔨 Renovation', fencing:'🧱 Fencing', cleaning:'✨ Cleaning', locksmith:'🔑 Locksmith', plumbing:'🚰 Plumbing', electrical:'⚡ Electrical', other:'📋 Other' };

async function onboardProfession(phone: string, text: string, data: Record<string, unknown>): Promise<void> {
  const nums = text.match(/\d+/g)?.map(Number).filter(n => n >= 1 && n <= 8) ?? [];
  if (nums.length === 0) {
    await sendText(phone, `Reply with numbers 1-8. Example: *1, 6*`);
    return;
  }

  const selected = nums.map(n => PROFESSIONS[n - 1]);
  (data as Record<string, unknown>).professions = selected;

  await supabase.from('wa_onboard_state').update({
    step: 'city_state',
    data,
    updated_at: new Date().toISOString(),
  }).eq('phone', phone);

  const labels = selected.map(k => PROF_LABELS[k] ?? k).join(', ');
  await sendText(phone, `Got it: ${labels}\n\n*Step 2:* Which state?\n\n1️⃣ 🌴 Florida\n2️⃣ 🗽 New York\n3️⃣ 🤠 Texas`);
}

// City-to-ZIP mapping (inline for Edge Function)
const STATE_CITIES: Record<string, { key: string; label: string; zips: string[] }[]> = {
  FL: [
    { key: 'miami', label: 'Miami', zips: ['33125','33126','33127','33128','33129','33130','33131','33132','33133','33134','33135','33136','33137','33138','33139','33140','33141','33142','33143','33144','33145','33146','33147','33148','33149','33150','33155','33156','33157','33158','33160','33161','33162','33165','33166','33167','33168','33169','33170','33172','33173','33174','33175','33176','33177','33178','33179','33180','33181','33182','33183','33184','33185','33186'] },
    { key: 'fort_lauderdale', label: 'Fort Lauderdale', zips: ['33301','33304','33305','33306','33308','33309','33311','33312','33313','33314','33315','33316','33317','33319','33334'] },
    { key: 'hollywood', label: 'Hollywood', zips: ['33019','33020','33021','33023','33024','33025','33026','33027','33028','33029'] },
    { key: 'hialeah', label: 'Hialeah', zips: ['33010','33012','33013','33014','33015','33016','33018'] },
    { key: 'coral_gables', label: 'Coral Gables', zips: ['33134','33143','33146'] },
    { key: 'boca_raton', label: 'Boca Raton', zips: ['33427','33428','33431','33432','33433','33434','33486','33487','33496','33498'] },
    { key: 'west_palm', label: 'West Palm Beach', zips: ['33401','33403','33404','33405','33406','33407','33409','33411','33412','33413','33414','33415','33417'] },
    { key: 'pompano', label: 'Pompano Beach', zips: ['33060','33062','33063','33064','33065','33066','33067','33068','33069','33071','33073'] },
    { key: 'delray', label: 'Delray Beach', zips: ['33444','33445','33446','33448','33483','33484'] },
    { key: 'homestead', label: 'Homestead', zips: ['33030','33031','33032','33033','33034','33035'] },
    { key: 'doral', label: 'Doral', zips: ['33122','33166','33172','33178'] },
    { key: 'pembroke_pines', label: 'Pembroke Pines', zips: ['33023','33024','33025','33026','33027','33028','33029','33082','33084'] },
    { key: 'miramar', label: 'Miramar', zips: ['33023','33025','33027','33029'] },
    { key: 'plantation', label: 'Plantation', zips: ['33317','33322','33324','33325','33388'] },
    { key: 'sunrise', label: 'Sunrise', zips: ['33304','33313','33319','33321','33322','33323','33325','33326','33351'] },
    { key: 'weston', label: 'Weston', zips: ['33326','33327','33331','33332'] },
    { key: 'aventura', label: 'Aventura', zips: ['33160','33180'] },
    { key: 'miami_beach', label: 'Miami Beach', zips: ['33109','33139','33140','33141','33154'] },
  ],
  NY: [
    { key: 'manhattan', label: 'Manhattan', zips: ['10001','10002','10003','10004','10005','10006','10007','10009','10010','10011','10012','10013','10014','10016','10017','10018','10019','10020','10021','10022','10023','10024','10025','10026','10027','10028','10029','10030','10031','10032','10033','10034','10035','10036','10037','10038','10039','10040'] },
    { key: 'brooklyn', label: 'Brooklyn', zips: ['11201','11203','11204','11205','11206','11207','11208','11209','11210','11211','11212','11213','11214','11215','11216','11217','11218','11219','11220','11221','11222','11223','11224','11225','11226','11228','11229','11230','11231','11232','11233','11234','11235','11236','11237','11238','11239'] },
    { key: 'queens', label: 'Queens', zips: ['11101','11102','11103','11104','11105','11106','11354','11355','11356','11357','11358','11360','11361','11362','11363','11364','11365','11366','11367','11368','11369','11370','11371','11372','11373','11374','11375','11377','11378','11379','11385','11411','11412','11413','11414','11415','11416','11417','11418','11419','11420','11421','11422','11423','11426','11427','11428','11429','11430','11432','11433','11434','11435','11436'] },
    { key: 'bronx', label: 'Bronx', zips: ['10451','10452','10453','10454','10455','10456','10457','10458','10459','10460','10461','10462','10463','10464','10465','10466','10467','10468','10469','10470','10471','10472','10473','10474','10475'] },
    { key: 'staten_island', label: 'Staten Island', zips: ['10301','10302','10303','10304','10305','10306','10307','10308','10309','10310','10312','10314'] },
  ],
  TX: [
    { key: 'houston', label: 'Houston', zips: ['77001','77002','77003','77004','77005','77006','77007','77008','77009','77010','77011','77012','77013','77014','77015','77016','77017','77018','77019','77020','77021','77022','77023','77024','77025','77026','77027','77028','77029','77030','77031','77032','77033','77034','77035','77036','77037','77038','77039','77040','77041','77042','77043','77044','77045','77046','77047','77048','77049','77050','77051','77053','77054','77055','77056','77057','77058','77059','77060','77061','77062','77063','77064','77065','77066','77067','77068','77069','77070','77071','77072','77073','77074','77075','77076','77077','77078','77079','77080','77081','77082','77083','77084','77085','77086','77087','77088','77089','77090','77091','77092','77093','77094','77095','77096','77098','77099'] },
    { key: 'dallas', label: 'Dallas', zips: ['75201','75202','75203','75204','75205','75206','75207','75208','75209','75210','75211','75212','75214','75215','75216','75217','75218','75219','75220','75223','75224','75225','75226','75227','75228','75229','75230','75231','75232','75233','75234','75235','75236','75237','75238','75240','75241','75243','75244','75246','75247','75248','75249','75251','75252','75253','75254'] },
    { key: 'fort_worth', label: 'Fort Worth', zips: ['76101','76102','76103','76104','76105','76106','76107','76108','76109','76110','76111','76112','76113','76114','76115','76116','76117','76118','76119','76120','76123','76126','76129','76130','76131','76132','76133','76134','76135','76137','76140','76148','76155','76164','76179'] },
    { key: 'san_antonio', label: 'San Antonio', zips: ['78201','78202','78203','78204','78205','78207','78208','78209','78210','78211','78212','78213','78214','78215','78216','78217','78218','78219','78220','78221','78222','78223','78224','78225','78226','78227','78228','78229','78230','78231','78232','78233','78234','78235','78236','78237','78238','78239','78240','78242','78244','78245','78247','78248','78249','78250','78251','78252','78253','78254','78255','78256','78257','78258','78259','78260','78261','78263','78264','78266'] },
    { key: 'austin', label: 'Austin', zips: ['78701','78702','78703','78704','78705','78712','78717','78719','78721','78722','78723','78724','78725','78726','78727','78728','78729','78730','78731','78732','78733','78734','78735','78736','78737','78738','78739','78741','78742','78744','78745','78746','78747','78748','78749','78750','78751','78752','78753','78754','78756','78757','78758','78759'] },
  ],
};

async function onboardCityState(phone: string, textLower: string, data: Record<string, unknown>): Promise<void> {
  const stateMap: Record<string, string> = { '1': 'FL', 'fl': 'FL', 'florida': 'FL', '2': 'NY', 'ny': 'NY', 'new york': 'NY', '3': 'TX', 'tx': 'TX', 'texas': 'TX' };
  const selectedState = stateMap[textLower];

  if (!selectedState) {
    await sendText(phone, `Reply *1* for Florida, *2* for New York, or *3* for Texas.`);
    return;
  }

  data.state = selectedState;
  const cities = STATE_CITIES[selectedState] ?? [];
  const cityList = cities.map((c, i) => `${i + 1}️⃣ ${c.label}`).join('\n');

  await supabase.from('wa_onboard_state').update({
    step: 'city',
    data,
    updated_at: new Date().toISOString(),
  }).eq('phone', phone);

  await sendText(phone, `*${selectedState}* — select cities:\n\n${cityList}\n\nReply with numbers: e.g. *1, 3, 5*`);
}

async function onboardCity(phone: string, textLower: string, data: Record<string, unknown>): Promise<void> {
  const st = data.state as string;
  const cities = STATE_CITIES[st] ?? [];
  const nums = textLower.match(/\d+/g)?.map(Number).filter(n => n >= 1 && n <= cities.length) ?? [];

  if (nums.length === 0) {
    await sendText(phone, `Reply with city numbers (1-${cities.length}).`);
    return;
  }

  const selectedCities = nums.map(n => cities[n - 1]);
  const allZips = [...new Set(selectedCities.flatMap(c => c.zips))];

  data.cities = selectedCities.map(c => c.key);
  data.zipCodes = allZips;

  await supabase.from('wa_onboard_state').update({
    step: 'working_days',
    data,
    updated_at: new Date().toISOString(),
  }).eq('phone', phone);

  const labels = selectedCities.map(c => c.label).join(', ');
  await sendText(phone, `Selected: ${labels} (${allZips.length} ZIPs)\n\n*Step 3:* Working days?\n\n1️⃣ Mon-Fri\n2️⃣ Every day\n3️⃣ Custom`);
}

async function onboardWorkingDays(phone: string, textLower: string, data: Record<string, unknown>): Promise<void> {
  const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  let days: number[];

  if (textLower === '1' || textLower.includes('mon-fri')) {
    days = [1,2,3,4,5];
  } else if (textLower === '2' || textLower.includes('every')) {
    days = [0,1,2,3,4,5,6];
  } else if (textLower === '3') {
    await sendText(phone, `Reply with day numbers:\n0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat\n\nExample: *1,2,3,4,5*`);
    return;
  } else {
    const nums = textLower.match(/\d/g)?.map(Number).filter(n => n >= 0 && n <= 6) ?? [];
    if (nums.length === 0) {
      await sendText(phone, `Reply *1* for Mon-Fri, *2* for every day, or *3* for custom.`);
      return;
    }
    days = [...new Set(nums)].sort();
  }

  data.workingDays = days;

  await supabase.from('wa_onboard_state').update({
    step: 'confirm',
    data,
    updated_at: new Date().toISOString(),
  }).eq('phone', phone);

  const profs = (data.professions as string[]).map(k => PROF_LABELS[k] ?? k).join(', ');
  const dayLabels = days.map(d => DAY_NAMES[d]).join(', ');
  const zipCount = (data.zipCodes as string[]).length;

  await sendText(phone, `*Your profile:*\n\n🔧 ${profs}\n📍 ${zipCount} ZIP codes\n📅 ${dayLabels}\n\nReply *YES* to confirm or *REDO* to start over.`);
}

async function onboardConfirm(phone: string, textLower: string, data: Record<string, unknown>): Promise<void> {
  if (textLower === 'redo' || textLower === 'no') {
    await supabase.from('wa_onboard_state').update({
      step: 'profession',
      data: { ...data, professions: [], cities: [], zipCodes: [], state: '' },
      updated_at: new Date().toISOString(),
    }).eq('phone', phone);

    await sendText(phone, `OK! Let's start over.\n\n1️⃣ ❄️ HVAC\n2️⃣ 🔨 Renovation\n3️⃣ 🧱 Fencing\n4️⃣ ✨ Cleaning\n5️⃣ 🔑 Locksmith\n6️⃣ 🚰 Plumbing\n7️⃣ ⚡ Electrical\n8️⃣ 📋 Other\n\nReply with numbers.`);
    return;
  }

  if (!POSITIVE_WORDS.some(w => textLower.includes(w))) {
    await sendText(phone, `Reply *YES* to confirm or *REDO* to start over.`);
    return;
  }

  // Save to DB
  const userId = data.userId as string;
  await supabase.from('contractors').update({
    professions: data.professions,
    zip_codes: data.zipCodes,
    wa_notify: true,
    is_active: true,
    working_days: data.workingDays,
  }).eq('user_id', userId);

  // Clear onboarding state
  await supabase.from('wa_onboard_state').delete().eq('phone', phone);

  await sendText(phone, `✅ *All set!*\n\nYou'll get your first check-in tomorrow morning.\nLeads matching your profile will come straight here.\n\nSend *MENU* anytime for options.`);
  console.log(`[onboard] Complete: ${userId}`);
}

// ── Helpers ─────────────────────────────────────────────────────────────────

async function findProfile(phone: string) {
  const { data } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('whatsapp_phone', phone)
    .maybeSingle();
  return data;
}

async function findProfileByPhone(phone: string) {
  const stripped = phone.replace(/^\+/, '');
  const { data } = await supabase
    .from('profiles')
    .select('id, full_name')
    .or(`phone.eq.${phone},phone.eq.${stripped}`)
    .maybeSingle();
  return data;
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

async function sendText(to: string, body: string): Promise<void> {
  const toWa = to.startsWith('whatsapp:') ? to : `whatsapp:${to.startsWith('+') ? to : '+' + to}`;
  const formData = new URLSearchParams({ From: TWILIO_FROM, To: toWa, Body: body });

  try {
    const res = await fetch(TWILIO_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: TWILIO_AUTH },
      body: formData.toString(),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error(`[twilio] Send failed: ${err}`);
    }
  } catch (err) {
    console.error(`[twilio] Network error:`, err);
  }
}

function twiml(): Response {
  return new Response('<Response></Response>', {
    status: 200,
    headers: { 'Content-Type': 'text/xml' },
  });
}
