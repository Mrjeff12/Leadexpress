import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "../_shared/cors.ts";

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
    // Fallback to text if template SID not configured
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
    // Fallback to text
    const fallback = Object.values(vars).join('\n');
    return sendText(to, fallback);
  }
  return true;
}

// ── Main handler ────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { broadcast_id, action, contractor_ids, phone, name, inviter_name, register_url, contractor_id } = body;

    if (action === 'send_broadcast') {
      return await handleSendBroadcast(broadcast_id);
    }

    if (action === 'send_invite') {
      return await handleSendInvite(phone, name, inviter_name, register_url);
    }

    if (action === 'notify_closed') {
      return await handleNotifyClosed(contractor_ids || []);
    }

    if (action === 'notify_chosen') {
      return await handleNotifyChosen(contractor_id, broadcast_id);
    }

    // Default: broadcast
    if (broadcast_id) {
      return await handleSendBroadcast(broadcast_id);
    }

    return new Response(JSON.stringify({ error: 'Missing broadcast_id or action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[broadcast-job] Error:', err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// ── Send broadcast to matching contractors ──────────────────
async function handleSendBroadcast(broadcastId: string): Promise<Response> {
  // 1. Get broadcast + lead
  const { data: broadcast, error: bErr } = await supabase
    .from('job_broadcasts')
    .select('*, leads(profession, city, zip_code)')
    .eq('id', broadcastId)
    .single();

  if (bErr || !broadcast) {
    return jsonResponse({ error: 'Broadcast not found' }, 404);
  }

  if (broadcast.status !== 'open') {
    return jsonResponse({ error: 'Broadcast is not open' }, 400);
  }

  const lead = broadcast.leads as { profession: string; city: string | null; zip_code: string | null };
  const profession = lead?.profession || 'general';
  const city = lead?.city || 'your area';
  const zipCode = lead?.zip_code;

  // 2. Get publisher name
  const { data: publisher } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', broadcast.publisher_id)
    .single();

  // 3. Find matching contractors
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
    return jsonResponse({ sent: 0, message: 'No matching contractors found' });
  }

  // 4. Filter out publisher
  const eligible = matches.filter(m => m.user_id !== broadcast.publisher_id);

  // 5. Send WhatsApp to each
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

    // Check if contractor is mid-onboarding — don't overwrite their session
    const { data: existingState } = await supabase
      .from('wa_onboard_state')
      .select('step')
      .eq('phone', normalized)
      .maybeSingle();

    if (existingState && existingState.step !== 'broadcast_pending') {
      // Skip — contractor is in an active onboarding flow
      continue;
    }

    // Store broadcast context for button callback
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

  // 6. Update sent count
  await supabase.from('job_broadcasts').update({ sent_count: sentCount }).eq('id', broadcastId);

  return jsonResponse({ sent: sentCount, total_eligible: eligible.length });
}

// ── Send invite to unregistered contractor ──────────────────
async function handleSendInvite(
  phone: string, name: string, inviterName: string, registerUrl: string
): Promise<Response> {
  if (!phone || !registerUrl) {
    return jsonResponse({ error: 'Missing phone or register_url' }, 400);
  }

  const sent = await sendButtons(normalizePhone(phone), CONTENT.CONTRACTOR_INVITE, {
    '1': inviterName || 'A contractor',
    '2': registerUrl,
  });

  return jsonResponse({ sent });
}

// ── Notify closed contractors ───────────────────────────────
async function handleNotifyClosed(contractorIds: string[]): Promise<Response> {
  let notified = 0;

  for (const cId of contractorIds) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('whatsapp_phone')
      .eq('id', cId)
      .single();

    if (profile?.whatsapp_phone) {
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

  return jsonResponse({ notified });
}

// ── Notify chosen contractor ────────────────────────────────
async function handleNotifyChosen(contractorId: string, broadcastId: string): Promise<Response> {
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
    return jsonResponse({ error: 'Profile or broadcast not found' }, 404);
  }

  const lead = broadcast.leads as { profession: string; city: string | null };
  // For now, use dashboard URL since portal requires job_order token
  const portalUrl = `https://app.leadexpress.co/jobs`;

  const sent = await sendButtons(profile.whatsapp_phone, CONTENT.BROADCAST_CHOSEN, {
    '1': lead?.profession || 'general',
    '2': lead?.city || 'your area',
    '3': portalUrl,
  });

  return jsonResponse({ sent });
}

// ── Helpers ─────────────────────────────────────────────────
function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
