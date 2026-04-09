import { getState, setState, type BotState } from '../lib/state.js';
import { sendText } from '../lib/twilio.js';
import { supabase } from '../lib/supabase.js';

/**
 * Publish Job handler — multi-step conversation where a publisher
 * describes a job and broadcasts it to matching sub-contractors.
 *
 * Steps: pj_profession → pj_description → pj_location → pj_address → pj_commission → pj_confirm
 */

const SUPA_URL = process.env.SUPABASE_URL || '';

const PROFESSIONS = [
  { key: 'hvac',        en: 'HVAC & AC',               emoji: '❄️',  num: '1' },
  { key: 'air_duct',    en: 'Air Duct Cleaning',        emoji: '💨',  num: '2' },
  { key: 'renovation',  en: 'Renovation & Remodeling',  emoji: '🔨',  num: '3' },
  { key: 'fencing',     en: 'Fencing & Gates',           emoji: '🧱',  num: '4' },
  { key: 'locksmith',   en: 'Locksmith',                 emoji: '🔑',  num: '5' },
  { key: 'chimney',     en: 'Chimney Sweep',             emoji: '🧹',  num: '6' },
  { key: 'garage',      en: 'Garage Doors',              emoji: '🚪',  num: '7' },
  { key: 'windows',     en: 'Windows & Doors',           emoji: '🪟',  num: '8' },
  { key: 'cleaning',    en: 'Cleaning',                  emoji: '✨',  num: '9' },
  { key: 'plumbing',    en: 'Plumbing',                  emoji: '🚰',  num: '10' },
  { key: 'electrical',  en: 'Electrical',                emoji: '⚡',  num: '11' },
  { key: 'roofing',     en: 'Roofing',                   emoji: '🏠',  num: '12' },
  { key: 'painting',    en: 'Painting',                  emoji: '🎨',  num: '13' },
  { key: 'landscaping', en: 'Landscaping',               emoji: '🌳',  num: '14' },
];

/** Start the publish job flow — show profession picker first */
export async function startPublishJob(phone: string, state: BotState): Promise<void> {
  state.step = 'pj_profession';
  state.extra = { ...(state.extra || {}), job: {} };
  await setState(phone, state);

  const list = PROFESSIONS.map(p => `${p.num}. ${p.emoji} ${p.en}`).join('\n');
  await sendText(phone,
    `🔧 *Post a Job*\n\nWhat trade do you need?\n\n${list}\n\nReply with a number or type the trade name.`
  );
}

/** Main dispatcher */
export async function handlePublishJob(phone: string, text: string): Promise<void> {
  const state = await getState(phone);
  if (!state) return;

  const job = (state.extra?.job || {}) as Record<string, string>;

  switch (state.step) {
    case 'pj_profession':
      return handleProfession(phone, text, state, job);
    case 'pj_description':
      return handleDescription(phone, text, state, job);
    case 'pj_location':
      return handleLocation(phone, text, state, job);
    case 'pj_address':
      return handleAddress(phone, text, state, job);
    case 'pj_commission':
      return handleCommission(phone, text, state, job);
    case 'pj_confirm':
      return handleConfirm(phone, text, state, job);
  }
}

// ── Step handlers ──────────────────────────────────────────────────────────

async function handleProfession(phone: string, text: string, state: BotState, job: Record<string, string>) {
  const input = text.trim().toLowerCase();
  // Match by number
  const byNum = PROFESSIONS.find(p => p.num === input);
  // Match by key or name
  const byKey = PROFESSIONS.find(p => p.key === input || p.en.toLowerCase() === input || p.en.toLowerCase().startsWith(input));
  const match = byNum || byKey;

  if (!match) {
    await sendText(phone, '❌ Trade not found. Reply with a number (1-14) or type the name.');
    return;
  }

  job.profession = match.key;
  job.professionLabel = `${match.emoji} ${match.en}`;
  state.extra = { ...(state.extra || {}), job };
  state.step = 'pj_description';
  await setState(phone, state);
  await sendText(phone,
    `${match.emoji} *${match.en}*\n\nNow describe the job briefly.\n\nExample: "Residential lock change, 3 doors, customer waiting"`
  );
}

async function handleDescription(phone: string, text: string, state: BotState, job: Record<string, string>) {
  if (!text.trim() || text.trim().length < 5) {
    await sendText(phone, 'Please describe the job in at least a few words.');
    return;
  }
  job.description = text.trim();
  state.extra = { ...(state.extra || {}), job };
  state.step = 'pj_location';
  await setState(phone, state);
  await sendText(phone,
    '📍 Where is the job?\n\nEnter city and ZIP code.\nExample: "Miami, 33101"'
  );
}

async function handleLocation(phone: string, text: string, state: BotState, job: Record<string, string>) {
  if (!text.trim()) {
    await sendText(phone, 'Please enter the city and ZIP code.');
    return;
  }
  // Try to parse city + zip
  const parts = text.split(',').map(s => s.trim());
  job.city = parts[0] || text.trim();
  job.zip_code = parts[1] || '';
  state.extra = { ...(state.extra || {}), job };
  state.step = 'pj_address';
  await setState(phone, state);
  await sendText(phone,
    '🏠 Full customer address?\n\nOr type "skip" if you don\'t have it yet.'
  );
}

async function handleAddress(phone: string, text: string, state: BotState, job: Record<string, string>) {
  if (text.trim().toLowerCase() !== 'skip') {
    job.address = text.trim();
  }
  state.extra = { ...(state.extra || {}), job };
  state.step = 'pj_commission';
  await setState(phone, state);
  await sendText(phone,
    '💰 What percentage does the sub-contractor get?\n\nExample: "80" means 80% to sub, 20% to you.'
  );
}

async function handleCommission(phone: string, text: string, state: BotState, job: Record<string, string>) {
  const num = parseInt(text.trim().replace('%', ''));
  if (isNaN(num) || num < 1 || num > 100) {
    await sendText(phone, 'Please enter a number between 1 and 100 (percentage for the sub-contractor).');
    return;
  }
  job.sub_pct = String(num);
  job.my_pct = String(100 - num);
  state.extra = { ...(state.extra || {}), job };
  state.step = 'pj_confirm';
  await setState(phone, state);

  // Show summary
  const profLabel = job.professionLabel || (job.profession || '').replace(/_/g, ' ');
  const loc = [job.city, job.zip_code].filter(Boolean).join(', ');
  await sendText(phone,
    `📋 *Job Summary*\n\n` +
    `🔧 Trade: ${profLabel}\n` +
    `📍 Location: ${loc}\n` +
    `📝 ${job.description}\n` +
    (job.address ? `🏠 Address: ${job.address}\n` : '') +
    `💰 Commission split: ${job.sub_pct}% to sub / ${job.my_pct}% to you\n\n` +
    `Reply *yes* to publish and send to matching contractors, or *no* to cancel.`
  );
}

async function handleConfirm(phone: string, text: string, state: BotState, job: Record<string, string>) {
  const answer = text.trim().toLowerCase();

  if (answer === 'no' || answer === 'cancel') {
    state.step = 'menu';
    state.extra = { ...(state.extra || {}), job: undefined };
    await setState(phone, state);
    await sendText(phone, '❌ Job cancelled. Send me a message anytime to post another one.');
    return;
  }

  if (answer !== 'yes' && answer !== 'y' && answer !== 'כן') {
    await sendText(phone, 'Reply *yes* to publish or *no* to cancel.');
    return;
  }

  // ── Publish the job ──
  await sendText(phone, '⏳ Publishing your job...');

  try {
    const userId = state.userId;
    if (!userId) {
      await sendText(phone, '⚠️ You need to be registered to publish jobs. Type "register" to get started.');
      return;
    }

    // 1. Create lead
    const { data: lead, error: leadErr } = await supabase
      .from('leads')
      .insert({
        raw_message: job.description,
        parsed_summary: job.description,
        profession: job.profession || null,
        city: job.city || null,
        zip_code: job.zip_code || null,
        source: 'publisher_rebeca',
        source_type: 'publisher',
      })
      .select('id')
      .single();

    if (leadErr || !lead) throw new Error('Failed to create lead');

    // 2. Create broadcast
    const { data: broadcast, error: bcErr } = await supabase
      .from('job_broadcasts')
      .insert({
        lead_id: lead.id,
        publisher_id: userId,
        deal_type: 'percentage',
        deal_value: `${job.sub_pct}%`,
        description: job.description,
        status: 'open',
      })
      .select('id')
      .single();

    if (bcErr || !broadcast) throw new Error('Failed to create broadcast');

    // 3. Also create job_order with publisher set (for portal flow)
    await supabase
      .from('job_orders')
      .insert({
        lead_id: lead.id,
        contractor_id: null,
        publisher_user_id: userId,
        deal_type: 'percentage',
        deal_value: `${job.sub_pct}%`,
        status: 'pending',
        customer_address: job.address || null,
        publisher_cut: `${job.my_pct}%`,
        contractor_pay: `${job.sub_pct}%`,
        broadcast_id: broadcast.id,
      });

    // 4. Trigger broadcast-job edge function
    const res = await fetch(`${SUPA_URL}/functions/v1/broadcast-job`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        action: 'send_broadcast',
        broadcast_id: broadcast.id,
      }),
    });

    const result = await res.json().catch(() => ({}));
    const sentCount = result.sent_count || 0;

    // 5. Done — return to menu
    state.step = 'menu';
    state.extra = { ...(state.extra || {}), job: undefined };
    await setState(phone, state);

    const profLabel = (job.profession || '').replace(/_/g, ' ');
    await sendText(phone,
      `✅ *Job Published!*\n\n` +
      `Your ${profLabel} job has been sent to ${sentCount} matching contractors.\n\n` +
      `We'll notify you on WhatsApp when someone is interested. 🔔`
    );

  } catch (err: any) {
    console.error('[publish-job] Error:', err.message || err);
    await sendText(phone, '⚠️ Something went wrong publishing your job. Please try again later.');
    state.step = 'menu';
    await setState(phone, state);
  }
}
