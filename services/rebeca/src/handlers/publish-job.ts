import { getState, setState, type BotState } from '../lib/state.js';
import { sendText } from '../lib/twilio.js';
import { supabase } from '../lib/supabase.js';
import type { Lang } from '../lib/i18n.js';

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

// ── i18n helpers ──────────────────────────────────────────────────────────────

function L(lang: Lang): Lang { return lang || 'en'; }

const PJ: Record<string, Record<Lang, string>> = {
  start: {
    en: '🔧 *Post a Job*\n\nWhat trade do you need?\n\n{{list}}\n\nReply with a number or type the trade name.',
    he: '🔧 *פרסם עבודה*\n\nאיזה מקצוע אתה צריך?\n\n{{list}}\n\nהקלד מספר או שם המקצוע.',
    es: '🔧 *Publicar Trabajo*\n\n¿Qué oficio necesitas?\n\n{{list}}\n\nResponde con un número o el nombre del oficio.',
  },
  trade_not_found: {
    en: '❌ Trade not found. Reply with a number (1-14) or type the name.',
    he: '❌ לא מצאתי את המקצוע. הקלד מספר (1-14) או את שם המקצוע.',
    es: '❌ Oficio no encontrado. Responde con un número (1-14) o escribe el nombre.',
  },
  describe: {
    en: '{{prof}}\n\nNow describe the job briefly.\n\nExample: "Residential lock change, 3 doors, customer waiting"',
    he: '{{prof}}\n\nתאר את העבודה בקצרה.\n\nדוגמה: "החלפת מנעול בדירה, 3 דלתות, לקוח ממתין"',
    es: '{{prof}}\n\nDescribe el trabajo brevemente.\n\nEjemplo: "Cambio de cerradura residencial, 3 puertas, cliente esperando"',
  },
  describe_too_short: {
    en: 'Please describe the job in at least a few words.',
    he: 'תאר את העבודה בכמה מילים לפחות.',
    es: 'Describe el trabajo con al menos unas palabras.',
  },
  ask_location: {
    en: '📍 Where is the job?\n\nEnter city and ZIP code.\nExample: "Miami, 33101"',
    he: '📍 איפה העבודה?\n\nהקלד עיר ומיקוד.\nדוגמה: "Miami, 33101"',
    es: '📍 ¿Dónde es el trabajo?\n\nEscribe ciudad y código postal.\nEjemplo: "Miami, 33101"',
  },
  ask_location_retry: {
    en: 'Please enter the city and ZIP code.',
    he: 'הקלד עיר ומיקוד.',
    es: 'Escribe la ciudad y el código postal.',
  },
  ask_address: {
    en: '🏠 Full customer address?\n\nOr type "skip" if you don\'t have it yet.',
    he: '🏠 כתובת מלאה של הלקוח?\n\nאו הקלד "דלג" אם אין לך עדיין.',
    es: '🏠 ¿Dirección completa del cliente?\n\nO escribe "saltar" si aún no la tienes.',
  },
  ask_commission: {
    en: '💰 What percentage does the sub-contractor get?\n\nExample: "80" means 80% to sub, 20% to you.',
    he: '💰 כמה אחוז מקבל קבלן המשנה?\n\nדוגמה: "80" = 80% לטכנאי, 20% לך.',
    es: '💰 ¿Qué porcentaje recibe el subcontratista?\n\nEjemplo: "80" significa 80% para el sub, 20% para ti.',
  },
  commission_invalid: {
    en: 'Please enter a number between 1 and 100 (percentage for the sub-contractor).',
    he: 'הקלד מספר בין 1 ל-100 (אחוז לקבלן המשנה).',
    es: 'Escribe un número entre 1 y 100 (porcentaje para el subcontratista).',
  },
  summary: {
    en: '📋 *Job Summary*\n\n🔧 Trade: {{prof}}\n📍 Location: {{loc}}\n📝 {{desc}}\n{{addr}}💰 Commission: {{sub_pct}}% to sub / {{my_pct}}% to you\n\nReply *yes* to publish or *no* to cancel.',
    he: '📋 *סיכום העבודה*\n\n🔧 מקצוע: {{prof}}\n📍 מיקום: {{loc}}\n📝 {{desc}}\n{{addr}}💰 חלוקה: {{sub_pct}}% לטכנאי / {{my_pct}}% לך\n\nהקלד *כן* לפרסם או *לא* לבטל.',
    es: '📋 *Resumen del Trabajo*\n\n🔧 Oficio: {{prof}}\n📍 Ubicación: {{loc}}\n📝 {{desc}}\n{{addr}}💰 Comisión: {{sub_pct}}% al sub / {{my_pct}}% a ti\n\nResponde *sí* para publicar o *no* para cancelar.',
  },
  confirm_retry: {
    en: 'Reply *yes* to publish or *no* to cancel.',
    he: 'הקלד *כן* לפרסם או *לא* לבטל.',
    es: 'Responde *sí* para publicar o *no* para cancelar.',
  },
  cancelled: {
    en: '❌ Job cancelled. Send me a message anytime to post another one.',
    he: '❌ העבודה בוטלה. שלח הודעה מתי שתרצה לפרסם עבודה נוספת.',
    es: '❌ Trabajo cancelado. Envíame un mensaje cuando quieras publicar otro.',
  },
  publishing: {
    en: '⏳ Publishing your job...',
    he: '⏳ מפרסם את העבודה...',
    es: '⏳ Publicando tu trabajo...',
  },
  not_registered: {
    en: '⚠️ You need to be registered to publish jobs. Type "register" to get started.',
    he: '⚠️ צריך להירשם כדי לפרסם עבודות. הקלד "הרשמה" כדי להתחיל.',
    es: '⚠️ Necesitas registrarte para publicar trabajos. Escribe "registro" para comenzar.',
  },
  published: {
    en: '✅ *Job Published!*\n\nYour {{prof}} job has been sent to matching contractors in your area.\n\nWe\'ll notify you on WhatsApp when someone is interested. 🔔',
    he: '✅ *העבודה פורסמה!*\n\nעבודת ה-{{prof}} נשלחה לטכנאים מתאימים באזור שלך.\n\nנעדכן אותך בוואטסאפ כשמישהו מתעניין. 🔔',
    es: '✅ *¡Trabajo Publicado!*\n\nTu trabajo de {{prof}} fue enviado a contratistas en tu área.\n\nTe notificaremos por WhatsApp cuando alguien esté interesado. 🔔',
  },
  error: {
    en: '⚠️ Something went wrong publishing your job. Please try again later.',
    he: '⚠️ משהו השתבש בפרסום. נסה שוב מאוחר יותר.',
    es: '⚠️ Algo salió mal al publicar. Inténtalo más tarde.',
  },
};

function pj(key: string, lang: Lang, vars?: Record<string, string>): string {
  let str = PJ[key]?.[L(lang)] ?? PJ[key]?.en ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      str = str.replaceAll(`{{${k}}}`, v);
    }
  }
  return str;
}

// ── Entry & dispatcher ────────────────────────────────────────────────────────

/** Start the publish job flow — show profession picker first */
export async function startPublishJob(phone: string, state: BotState): Promise<void> {
  state.step = 'pj_profession';
  state.extra = { ...(state.extra || {}), job: {} };
  await setState(phone, state);

  const l = L(state.language);
  const list = PROFESSIONS.map(p => `${p.num}. ${p.emoji} ${p.en}`).join('\n');
  await sendText(phone, pj('start', l, { list }));
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
  const l = L(state.language);
  const input = text.trim().toLowerCase();
  const byNum = PROFESSIONS.find(p => p.num === input);
  const byKey = PROFESSIONS.find(p => p.key === input || p.en.toLowerCase() === input || p.en.toLowerCase().startsWith(input));
  const match = byNum || byKey;

  if (!match) {
    await sendText(phone, pj('trade_not_found', l));
    return;
  }

  job.profession = match.key;
  job.professionLabel = `${match.emoji} ${match.en}`;
  state.extra = { ...(state.extra || {}), job };
  state.step = 'pj_description';
  await setState(phone, state);
  await sendText(phone, pj('describe', l, { prof: `${match.emoji} *${match.en}*` }));
}

async function handleDescription(phone: string, text: string, state: BotState, job: Record<string, string>) {
  const l = L(state.language);
  if (!text.trim() || text.trim().length < 5) {
    await sendText(phone, pj('describe_too_short', l));
    return;
  }
  job.description = text.trim();
  state.extra = { ...(state.extra || {}), job };
  state.step = 'pj_location';
  await setState(phone, state);
  await sendText(phone, pj('ask_location', l));
}

async function handleLocation(phone: string, text: string, state: BotState, job: Record<string, string>) {
  const l = L(state.language);
  if (!text.trim()) {
    await sendText(phone, pj('ask_location_retry', l));
    return;
  }
  const parts = text.split(',').map(s => s.trim());
  job.city = parts[0] || text.trim();
  job.zip_code = parts[1] || '';
  state.extra = { ...(state.extra || {}), job };
  state.step = 'pj_address';
  await setState(phone, state);
  await sendText(phone, pj('ask_address', l));
}

async function handleAddress(phone: string, text: string, state: BotState, job: Record<string, string>) {
  const l = L(state.language);
  const lower = text.trim().toLowerCase();
  if (lower !== 'skip' && lower !== 'דלג' && lower !== 'saltar') {
    job.address = text.trim();
  }
  state.extra = { ...(state.extra || {}), job };
  state.step = 'pj_commission';
  await setState(phone, state);
  await sendText(phone, pj('ask_commission', l));
}

async function handleCommission(phone: string, text: string, state: BotState, job: Record<string, string>) {
  const l = L(state.language);
  const num = parseInt(text.trim().replace('%', ''));
  if (isNaN(num) || num < 1 || num > 100) {
    await sendText(phone, pj('commission_invalid', l));
    return;
  }
  job.sub_pct = String(num);
  job.my_pct = String(100 - num);
  state.extra = { ...(state.extra || {}), job };
  state.step = 'pj_confirm';
  await setState(phone, state);

  const profLabel = job.professionLabel || (job.profession || '').replace(/_/g, ' ');
  const loc = [job.city, job.zip_code].filter(Boolean).join(', ');
  const addr = job.address
    ? (l === 'he' ? `🏠 כתובת: ${job.address}\n` : l === 'es' ? `🏠 Dirección: ${job.address}\n` : `🏠 Address: ${job.address}\n`)
    : '';
  await sendText(phone, pj('summary', l, { prof: profLabel, loc, desc: job.description, addr, sub_pct: job.sub_pct, my_pct: job.my_pct }));
}

async function handleConfirm(phone: string, text: string, state: BotState, job: Record<string, string>) {
  const l = L(state.language);
  const answer = text.trim().toLowerCase();

  if (['no', 'cancel', 'לא', 'ביטול', 'cancelar'].includes(answer)) {
    state.step = 'menu';
    state.extra = { ...(state.extra || {}), job: undefined };
    await setState(phone, state);
    await sendText(phone, pj('cancelled', l));
    return;
  }

  if (!['yes', 'y', 'כן', 'sí', 'si'].includes(answer)) {
    await sendText(phone, pj('confirm_retry', l));
    return;
  }

  // ── Publish the job ──
  await sendText(phone, pj('publishing', l));

  try {
    const userId = state.userId;
    if (!userId) {
      await sendText(phone, pj('not_registered', l));
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

    await res.json().catch(() => ({}));

    // 5. Done — return to menu
    state.step = 'menu';
    state.extra = { ...(state.extra || {}), job: undefined };
    await setState(phone, state);

    const profLabel = job.professionLabel || (job.profession || '').replace(/_/g, ' ');
    await sendText(phone, pj('published', l, { prof: profLabel }));

  } catch (err: any) {
    console.error('[publish-job] Error:', err.message || err);
    await sendText(phone, pj('error', l));
    state.step = 'menu';
    await setState(phone, state);
  }
}
