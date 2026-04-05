import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getCorsHeaders } from "../_shared/cors.ts";

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

// ── Twilio secrets ──────────────────────────────────────────
let TWILIO_SID = '', TWILIO_TOKEN = '', TWILIO_FROM = '';
let _secretsLoaded = false;

async function loadSecrets() {
  if (_secretsLoaded) return;
  const { data, error } = await supabase.rpc('get_twilio_secrets');
  if (error || !data) {
    console.error('[secrets] Failed to load:', error);
    return;
  }
  TWILIO_SID = data.TWILIO_ACCOUNT_SID || '';
  TWILIO_TOKEN = data.TWILIO_AUTH_TOKEN || '';
  TWILIO_FROM = data.TWILIO_WA_FROM || '';
  _secretsLoaded = true;
}

// ── Content template SIDs ───────────────────────────────────
const CONTENT = {
  BROADCAST_NOTIFY:   Deno.env.get('TWILIO_CONTENT_BROADCAST_NOTIFY')   ?? 'HX65b6f4255de50f056add8a1e58b81881',
  BROADCAST_INTEREST: Deno.env.get('TWILIO_CONTENT_BROADCAST_INTEREST') ?? 'HXe17599d4d5a2405eb0a8c8aa5e9794a7',
  BROADCAST_CHOSEN:   Deno.env.get('TWILIO_CONTENT_BROADCAST_CHOSEN')   ?? 'HXe3ef47c713bfa9c739aa75864801e52e',
  BROADCAST_CLOSED:   Deno.env.get('TWILIO_CONTENT_BROADCAST_CLOSED')   ?? 'HXb13bcbd71187d719cc79df427da86612',
  CONTRACTOR_INVITE:  Deno.env.get('TWILIO_CONTENT_CONTRACTOR_INVITE')  ?? 'HX344261bdd6e219674f350ce662326e28',
};

const PROFESSION_EMOJI: Record<string, string> = {
  hvac: '❄️', renovation: '🏗️', fencing: '🏗️', cleaning: '🧹',
  plumbing: '🔧', electrical: '⚡', painting: '🎨', roofing: '🏠',
  landscaping: '🌿', flooring: '🪵', general: '📋', other: '📋',
};

function normalizePhone(raw: string): string {
  const cleaned = raw.replace('whatsapp:', '').replace(/\s/g, '');
  return cleaned.startsWith('+') ? cleaned : `+${cleaned}`;
}

// ── Send WhatsApp via Twilio ────────────────────────────────
async function sendText(to: string, body: string): Promise<boolean> {
  await loadSecrets();
  const toWa = to.startsWith('whatsapp:') ? to : `whatsapp:${normalizePhone(to)}`;
  const form = new URLSearchParams({ From: TWILIO_FROM, To: toWa, Body: body });
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: 'Basic ' + btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`),
      },
      body: form.toString(),
    }
  );
  return res.ok;
}

async function sendButtons(to: string, contentSid: string, vars: Record<string, string>): Promise<boolean> {
  await loadSecrets();
  if (!contentSid) {
    const fallback = Object.values(vars).join('\n');
    return sendText(to, fallback);
  }
  const toWa = to.startsWith('whatsapp:') ? to : `whatsapp:${normalizePhone(to)}`;
  const form = new URLSearchParams({
    From: TWILIO_FROM,
    To: toWa,
    ContentSid: contentSid,
    ContentVariables: JSON.stringify(vars),
  });
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: 'Basic ' + btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`),
      },
      body: form.toString(),
    }
  );
  if (!res.ok) {
    const fallback = Object.values(vars).join('\n');
    return sendText(to, fallback);
  }
  return true;
}

type CorsHeaders = Record<string, string>;

// ── Main handler ────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  const cors = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors });
  }

  try {
    const body = await req.json();
    const { broadcast_id, action, contractor_ids, phone, name, inviter_name, register_url, contractor_id } = body;

    if (action === 'send_broadcast') {
      return await handleSendBroadcast(broadcast_id, cors);
    }

    if (action === 'send_invite') {
      return await handleSendInvite(phone, name, inviter_name, register_url, cors);
    }

    if (action === 'notify_closed') {
      return await handleNotifyClosed(contractor_ids || [], cors);
    }

    if (action === 'notify_chosen') {
      return await handleNotifyChosen(contractor_id, broadcast_id, cors);
    }

    if (broadcast_id) {
      return await handleSendBroadcast(broadcast_id, cors);
    }

    return jsonResponse({ error: 'Missing broadcast_id or action' }, 400, cors);
  } catch (err) {
    console.error('[broadcast-job] Error:', err);
    return jsonResponse({ error: (err as Error).message }, 500, cors);
  }
});

// ── Send broadcast to matching contractors ──────────────────
async function handleSendBroadcast(broadcastId: string, cors: CorsHeaders): Promise<Response> {
  const { data: broadcast, error: bErr } = await supabase
    .from('job_broadcasts')
    .select('*, leads(profession, city, zip_code)')
    .eq('id', broadcastId)
    .single();

  if (bErr || !broadcast) {
    return jsonResponse({ error: 'Broadcast not found' }, 404, cors);
  }

  if (broadcast.status !== 'open') {
    return jsonResponse({ error: 'Broadcast is not open' }, 400, cors);
  }

  const lead = broadcast.leads as { profession: string; city: string | null; zip_code: string | null };
  const profession = lead?.profession || 'general';
  const city = lead?.city || 'your area';
  const zipCode = lead?.zip_code;

  const { data: publisher } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', broadcast.publisher_id)
    .single();

  let query = supabase
    .from('contractors')
    .select('user_id, professions, profiles(whatsapp_phone, full_name)')
    .eq('is_active', true)
    .contains('professions', [profession]);

  if (zipCode) {
    query = query.contains('zip_codes', [zipCode]);
  }

  const { data: matches } = await query.limit(broadcast.max_recipients);

  if (!matches || matches.length === 0) {
    await supabase.from('job_broadcasts').update({ sent_count: 0 }).eq('id', broadcastId);
    return jsonResponse({ sent: 0, message: 'No matching contractors found' }, 200, cors);
  }

  const eligible = matches.filter(m => m.user_id !== broadcast.publisher_id);

  const emoji = PROFESSION_EMOJI[profession] || '📋';
  const dealSummary = broadcast.deal_type === 'percentage'
    ? `${broadcast.deal_value}%`
    : broadcast.deal_type === 'fixed_price'
    ? `$${broadcast.deal_value}`
    : broadcast.deal_value;

  let sentCount = 0;

  for (const contractor of eligible) {
    const phone = (contractor.profiles as any)?.whatsapp_phone;
    if (!phone) continue;

    const normalized = normalizePhone(phone);

    // Idempotency: atomic insert into broadcast_sent_log — skip on conflict
    const { error: dedupErr } = await supabase
      .from('broadcast_sent_log')
      .insert({ broadcast_id: broadcastId, contractor_id: contractor.user_id });
    if (dedupErr?.code === '23505') continue;

    await supabase.from('wa_onboard_state').upsert(
      { phone: normalized, step: 'broadcast_pending', data: { broadcastId } },
      { onConflict: 'phone' }
    );

    const sent = await sendButtons(normalized, CONTENT.BROADCAST_NOTIFY, {
      '1': emoji,
      '2': profession,
      '3': city,
      '4': dealSummary,
      '5': publisher?.full_name || 'A contractor',
    });

    if (sent) sentCount++;
  }

  await supabase.from('job_broadcasts').update({ sent_count: sentCount }).eq('id', broadcastId);

  return jsonResponse({ sent: sentCount, total_eligible: eligible.length }, 200, cors);
}

// ── Send invite to unregistered contractor ──────────────────
async function handleSendInvite(
  phone: string, name: string, inviterName: string, registerUrl: string, cors: CorsHeaders
): Promise<Response> {
  if (!phone || !registerUrl) {
    return jsonResponse({ error: 'Missing phone or register_url' }, 400, cors);
  }

  const sent = await sendButtons(normalizePhone(phone), CONTENT.CONTRACTOR_INVITE, {
    '1': inviterName || 'A contractor',
    '2': registerUrl,
  });

  return jsonResponse({ sent }, 200, cors);
}

// ── Notify closed contractors ───────────────────────────────
async function handleNotifyClosed(contractorIds: string[], cors: CorsHeaders): Promise<Response> {
  let notified = 0;

  for (const cId of contractorIds) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('whatsapp_phone')
      .eq('id', cId)
      .single();

    if (profile?.whatsapp_phone) {
      // Clear broadcast_pending state so they can receive future broadcasts
      const normalized = normalizePhone(profile.whatsapp_phone);
      const { data: state } = await supabase
        .from('wa_onboard_state')
        .select('step')
        .eq('phone', normalized)
        .maybeSingle();
      if (state?.step === 'broadcast_pending') {
        await supabase
          .from('wa_onboard_state')
          .update({ step: 'idle', data: null })
          .eq('phone', normalized);
      }

      if (CONTENT.BROADCAST_CLOSED) {
        await sendButtons(profile.whatsapp_phone, CONTENT.BROADCAST_CLOSED, {});
      } else {
        await sendText(
          profile.whatsapp_phone,
          'Thanks for your interest! This job has been assigned to another contractor. Keep your profile updated to get more opportunities! 💪'
        );
      }
      notified++;
    }
  }

  return jsonResponse({ notified }, 200, cors);
}

// ── Notify chosen contractor ────────────────────────────────
async function handleNotifyChosen(contractorId: string, broadcastId: string, cors: CorsHeaders): Promise<Response> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('whatsapp_phone')
    .eq('id', contractorId)
    .single();

  const { data: broadcast } = await supabase
    .from('job_broadcasts')
    .select('*, leads(profession, city)')
    .eq('id', broadcastId)
    .single();

  if (!profile?.whatsapp_phone || !broadcast) {
    return jsonResponse({ error: 'Profile or broadcast not found' }, 404, cors);
  }

  const lead = broadcast.leads as { profession: string; city: string | null };
  const sent = await sendButtons(profile.whatsapp_phone, CONTENT.BROADCAST_CHOSEN, {
    '1': lead?.profession || 'general',
    '2': lead?.city || 'your area',
    '3': broadcastId,
  });

  return jsonResponse({ sent }, 200, cors);
}

// ── Helpers ─────────────────────────────────────────────────
function jsonResponse(data: unknown, status: number, cors: CorsHeaders): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}
