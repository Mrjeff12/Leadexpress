import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

// ── Supabase client ─────────────────────────────────────────
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

// ── Twilio secrets (loaded lazily via RPC) ──────────────────
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

// ── Nudge wave timing (minutes) ─────────────────────────────
// Maps stage+sub_status to array of wave delays in minutes
const WAVE_TIMING: Record<string, number[]> = {
  // Onboarding: 30m, 1h, 1d, 2d
  'onboarding.*':       [30, 60, 1440, 2880],
  // Trial
  'demo_trial.just_started':  [360, 1440],          // 6h, 1d
  'demo_trial.no_leads':      [0, 2880, 5760],      // immediate, 2d, 4d
  'demo_trial.inactive':      [2880, 5760],          // 2d, 4d
  'demo_trial.expiring':      [0, 1440],             // immediate, 1d
  'demo_trial.wants_to_pay':  [5, 60, 1440],         // 5m, 1h, 1d
  // Trial Expired
  'trial_expired.had_leads':     [0, 10080, 20160],  // immediate, 7d, 14d
  'trial_expired.was_active':    [0, 10080, 20160],
  'trial_expired.no_leads':      [0, 10080, 20160],
  'trial_expired.barely_used':   [0, 10080, 20160],
  'trial_expired.never_used':    [1440, 10080, 20160], // 1d, 7d, 14d
  'trial_expired.payment_failed':[0, 1440, 4320],     // immediate, 1d, 3d
  'trial_expired.got_offer':     [1440, 4320],         // 1d, 3d
  // Paying
  'paying.welcome':          [0],               // immediate
  'paying.healthy':          [10080],            // weekly
  'paying.getting_leads':    [10080],            // weekly
  'paying.no_leads_week':    [10080],            // 7d
  'paying.low_leads':        [10080],            // weekly
  'paying.payment_failing':  [0, 2880, 7200],   // immediate, 2d, 5d
  'paying.support_issue':    [60],               // 1h
  // Churned
  'churned.payment_failed':  [0, 10080],         // immediate, after 3 retries
  'churned.recent':          [1440, 10080, 20160], // 1d, 7d, 14d
  'churned.no_value':        [20160, 43200],     // 14d, 30d
  'churned.seasonal':        [0],                // start of season
};

// ── DRY RUN mode — set to true to prevent actual sending ────
const DRY_RUN = false;

// ── Quiet hours: don't send between 22:00-08:00 US Eastern ──
function isQuietHours(): boolean {
  const now = new Date();
  // Convert to US Eastern (UTC-5 / UTC-4 DST)
  const eastern = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const hour = eastern.getHours();
  return hour >= 22 || hour < 8;
}

// ── Load payment links from app_settings ────────────────────
let _paymentLink = '', _paymentLink50 = '';
async function loadPaymentLinks() {
  const { data } = await supabase.from('app_settings').select('key, value')
    .in('key', ['payment_link', 'payment_link_50_off']);
  if (data) {
    for (const row of data) {
      if (row.key === 'payment_link') _paymentLink = row.value;
      if (row.key === 'payment_link_50_off') _paymentLink50 = row.value;
    }
  }
}

// ── Resolve variable placeholders ───────────────────────────
function resolveVars(template: string, vars: Record<string, string | number>): string {
  let result = template;
  for (const [key, val] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), String(val));
  }
  // Payment links
  result = result.replace(/\{payment_link\}/g, _paymentLink);
  result = result.replace(/\{payment_link_50_off\}/g, _paymentLink50);
  return result;
}

// ── Send WhatsApp message via Twilio ────────────────────────
async function sendWhatsApp(phone: string, body: string): Promise<string | null> {
  if (DRY_RUN) {
    console.log(`[DRY_RUN] Would send to ${phone}: ${body.substring(0, 80)}...`);
    return 'dry_run_' + Date.now();
  }

  const toWa = `whatsapp:${phone.startsWith('+') ? phone : '+' + phone}`;
  const formData = new URLSearchParams({ From: TWILIO_FROM, To: toWa, Body: body });

  try {
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`;
    const auth = btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`);
    const res = await fetch(twilioUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: `Basic ${auth}` },
      body: formData.toString(),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error(`[twilio] Send failed: ${err}`);
      return null;
    }
    const data = await res.json();
    return data.sid || null;
  } catch (err) {
    console.error(`[twilio] Network error:`, err);
    return null;
  }
}

// ── Determine which wave number a prospect should receive ───
function getNextWave(nudgesSent: number, timingKey: string): number | null {
  // Find timing array — try exact match first, then wildcard
  const timing = WAVE_TIMING[timingKey] || WAVE_TIMING[timingKey.split('.')[0] + '.*'];
  if (!timing) return null;

  const nextWave = nudgesSent + 1;
  if (nextWave > timing.length) return null; // All waves sent
  return nextWave;
}

// ── Check if enough time has passed for next wave ───────────
function isTimeForWave(minutesInStatus: number, wave: number, timingKey: string): boolean {
  const timing = WAVE_TIMING[timingKey] || WAVE_TIMING[timingKey.split('.')[0] + '.*'];
  if (!timing || wave < 1 || wave > timing.length) return false;
  return minutesInStatus >= timing[wave - 1];
}

// ── Process onboarding nudges ───────────────────────────────
async function processOnboarding(): Promise<number> {
  const { data: stuck, error } = await supabase.rpc('get_stuck_onboarding');
  if (error || !stuck?.length) return 0;

  let sent = 0;
  for (const row of stuck) {
    const wave = row.nudges_sent + 1;
    if (wave > 4) continue; // Max 4 waves

    // Get template from message_templates
    const templateSlug = `onboard_nudge${wave}_${row.step === 'city_state' ? 'state' : row.step}`;
    const { data: tpl } = await supabase
      .from('message_templates')
      .select('body_template')
      .eq('slug', templateSlug)
      .maybeSingle();

    if (!tpl) {
      console.warn(`[nudge] Template not found: ${templateSlug}`);
      continue;
    }

    // Fetch prospect stats for variable resolution
    const { data: pStats } = await supabase.from('prospects')
      .select('group_count, messages_scanned, lead_count')
      .eq('id', row.prospect_id).maybeSingle();
    const body = resolveVars(tpl.body_template, {
      name: row.first_name || 'there',
      group_count: String(pStats?.group_count || 0),
      messages_scanned: String(pStats?.messages_scanned || 0),
      lead_count: String(pStats?.lead_count || 0),
    });
    const sid = await sendWhatsApp(row.phone, body);

    // Log nudge (unique constraint prevents duplicates)
    const { error: logErr } = await supabase.rpc('log_nudge', {
      p_prospect_id: row.prospect_id,
      p_phone: row.phone,
      p_stage: 'onboarding',
      p_sub_status: row.step,
      p_wave: wave,
      p_nudge_key: `onboarding.${row.step}.wave${wave}`,
      p_message_body: body,
      p_twilio_sid: sid,
    });
    if (logErr) { console.warn(`[nudge] Duplicate or error: ${logErr.message}`); continue; }

    // Update nudge counter via RPC
    await supabase.rpc('increment_onboard_nudge', { p_phone: row.phone, p_count: wave });

    sent++;
  }
  return sent;
}

// ── Process stage-based nudges (trial, expired, paying, churned) ──
async function processStage(stage: string): Promise<number> {
  // Pick the right RPC
  const rpcMap: Record<string, string> = {
    demo_trial: 'get_stuck_trial',
    trial_expired: 'get_stuck_trial_expired',
    paying: 'get_stuck_paying',
    churned: 'get_stuck_churned',
  };

  const rpcName = rpcMap[stage];
  if (!rpcName) return 0;

  const { data: stuck, error } = await supabase.rpc(rpcName);
  if (error || !stuck?.length) {
    if (error) console.error(`[nudge] RPC ${rpcName} error:`, error);
    return 0;
  }

  let sent = 0;
  for (const row of stuck) {
    const timingKey = `${stage}.${row.sub_status}`;
    const nextWave = getNextWave(Number(row.nudges_sent), timingKey);
    if (!nextWave) continue;

    const minutesInStatus = stage === 'demo_trial'
      ? Number(row.hours_in_status) * 60
      : (Number(row.days_expired || row.days_in_status || row.days_churned) * 1440);

    if (!isTimeForWave(minutesInStatus, nextWave, timingKey)) continue;

    // Build message from templates (stored in code for now — will move to DB)
    // For now, just log that we WOULD send
    const nudgeKey = `${stage}.${row.sub_status}.wave${nextWave}`;
    const vars = {
      name: row.display_name || 'there',
      group_count: String(row.group_count || 0),
      messages_scanned: String(row.messages_scanned || 0),
      lead_count: String(row.lead_count || 0),
    };

    // Try to get template from DB
    const templateSlug = `${stage}_nudge${nextWave}_${row.sub_status}`;
    const { data: tpl } = await supabase
      .from('message_templates')
      .select('body_template')
      .eq('slug', templateSlug)
      .maybeSingle();

    let body: string;
    if (tpl) {
      body = resolveVars(tpl.body_template, vars);
    } else {
      console.warn(`[nudge] Template not found: ${templateSlug} — skipping`);
      continue;
    }

    const sid = await sendWhatsApp(row.phone, body);

    // Log nudge (unique constraint prevents duplicates)
    const { error: logErr } = await supabase.rpc('log_nudge', {
      p_prospect_id: row.prospect_id,
      p_phone: row.phone,
      p_stage: stage,
      p_sub_status: row.sub_status,
      p_wave: nextWave,
      p_nudge_key: nudgeKey,
      p_message_body: body,
      p_twilio_sid: sid,
    });
    if (logErr) { console.warn(`[nudge] Duplicate or error: ${logErr.message}`); continue; }

    sent++;
  }
  return sent;
}

// ── Main handler ────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  try {
    const reqBody = await req.json().catch(() => ({ stage: 'all' }));
    const { stage, force } = reqBody;

    // Quiet hours check — don't send between 22:00-08:00 US Eastern (bypass with force:true)
    if (isQuietHours() && !force) {
      return new Response(JSON.stringify({ ok: true, skipped: 'quiet_hours', dry_run: DRY_RUN }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    await loadSecrets();
    await loadPaymentLinks();
    const stages = stage === 'all'
      ? ['onboarding', 'demo_trial', 'trial_expired', 'paying', 'churned']
      : stage.split(',').map((s: string) => s.trim());

    const results: Record<string, number> = {};

    for (const s of stages) {
      if (s === 'onboarding') {
        results[s] = await processOnboarding();
      } else {
        results[s] = await processStage(s);
      }
    }

    const total = Object.values(results).reduce((a, b) => a + b, 0);
    console.log(`[nudge] Processed: ${JSON.stringify(results)} — total: ${total} — DRY_RUN: ${DRY_RUN}`);

    return new Response(JSON.stringify({
      ok: true,
      dry_run: DRY_RUN,
      results,
      total,
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[nudge] Fatal error:', err);
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
