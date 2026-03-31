// supabase/functions/send-window-reminder/index.ts
// Triggered by pg_cron every 5 minutes.
//
// Stage 1: Contractors whose 24h window closes in <10 min → send WhatsApp reminder
//          (still inside window = free message, contractor replies to auto-renew)
//
// Stage 2: Contractors with expired/null window → send WhatsApp Content Template
//          (ContentSid bypasses 24h rule) + queue push notification via pending_push_jobs

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const REBECA_PHONE = Deno.env.get("REBECA_PHONE") || "14155238886";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// Twilio config (loaded lazily from DB)
let TWILIO_SID = "", TWILIO_TOKEN = "", TWILIO_FROM = "";
let _secretsLoaded = false;

async function loadTwilioSecrets() {
  if (_secretsLoaded) return;
  const { data, error } = await supabase.rpc("get_twilio_secrets");
  if (error || !data) {
    console.error("[secrets] Failed to load:", error);
    return;
  }
  TWILIO_SID = data.TWILIO_ACCOUNT_SID || "";
  TWILIO_TOKEN = data.TWILIO_AUTH_TOKEN || "";
  TWILIO_FROM = data.TWILIO_WA_FROM || "";
  _secretsLoaded = true;
}

Deno.serve(async (_req) => {
  try {
    await loadTwilioSecrets();

    const now = new Date();
    const tenMinFromNow = new Date(Date.now() + 10 * 60 * 1000);
    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
    const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();

    let stage1Sent = 0;
    let stage2Sent = 0;

    // ── Stage 1: Window closing in <10 min — WhatsApp free-form reminder ──
    const { data: expiringContractors } = await supabase
      .from("contractors")
      .select("user_id, last_push_reminder_at")
      .gt("wa_window_until", now.toISOString())
      .lt("wa_window_until", tenMinFromNow.toISOString())
      .eq("wa_notify", true)
      .eq("is_active", true);

    const expiringEligible = (expiringContractors ?? []).filter(
      (c) => !c.last_push_reminder_at || c.last_push_reminder_at < sixHoursAgo
    );

    if (expiringEligible.length > 0) {
      const userIds = expiringEligible.map((c) => c.user_id);

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, whatsapp_phone")
        .in("id", userIds);

      for (const profile of profiles ?? []) {
        if (!profile.whatsapp_phone) continue;

        const firstName = (profile.full_name || "").split(" ")[0] || "Hey";
        const body = `${firstName}, your lead channel closes in 5 min! 🕐\n\nSend 👋 to stay connected and keep receiving leads.`;

        const sent = await sendWhatsApp(profile.whatsapp_phone, body);
        if (sent) {
          stage1Sent++;
          await supabase
            .from("contractors")
            .update({ last_push_reminder_at: now.toISOString() })
            .eq("user_id", profile.id);
        }
      }
    }

    // ── Stage 2: Expired window — WhatsApp Content Template outreach ──
    const { data: expiredContractors } = await supabase
      .from("contractors")
      .select("user_id, last_push_reminder_at")
      .or(`wa_window_until.is.null,wa_window_until.lt.${now.toISOString()}`)
      .eq("wa_notify", true)
      .eq("is_active", true);

    // Check throttle via reconnect_throttle table (12h per channel)
    const expiredIds = (expiredContractors ?? []).map((c) => c.user_id);

    let expiredEligible: typeof expiredContractors = [];
    if (expiredIds.length > 0) {
      const { data: throttled } = await supabase
        .from("reconnect_throttle")
        .select("contractor_id")
        .in("contractor_id", expiredIds)
        .eq("channel", "whatsapp_template")
        .gt("sent_at", twelveHoursAgo);

      const throttledSet = new Set((throttled ?? []).map((t) => t.contractor_id));
      expiredEligible = (expiredContractors ?? []).filter((c) => !throttledSet.has(c.user_id));
    }

    if (expiredEligible && expiredEligible.length > 0) {
      const userIds = expiredEligible.map((c) => c.user_id);

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, whatsapp_phone")
        .in("id", userIds);

      // Also check subscription is active
      const { data: activeSubs } = await supabase
        .from("subscriptions")
        .select("user_id")
        .in("user_id", userIds)
        .in("status", ["active", "trialing"]);
      const activeSubSet = new Set((activeSubs ?? []).map((s) => s.user_id));

      // Check which contractors have real matched leads (only send template if there's value)
      const { data: recentLeadCounts } = await supabase.rpc('count_matched_leads_by_contractor', {
        contractor_ids: userIds,
        since_hours: 24,
      }).catch(() => ({ data: null }));
      const leadCountMap = new Map<string, number>();
      for (const row of recentLeadCounts ?? []) {
        leadCountMap.set(row.contractor_id, row.count);
      }

      const ACCOUNT_STATUS_TEMPLATE = Deno.env.get("TWILIO_CONTENT_ACCOUNT_STATUS") || "HX6fab64f5e7365e174e2047a664fa406c";

      for (const profile of profiles ?? []) {
        if (!profile.whatsapp_phone) continue;
        if (!activeSubSet.has(profile.id)) continue;

        const matchedLeads = leadCountMap.get(profile.id) ?? 0;
        // Only send template if there are real leads — don't waste quality score
        if (matchedLeads === 0) continue;

        // Send Utility Template (works on US numbers, $0.004)
        const sent = await sendContentTemplate(
          profile.whatsapp_phone,
          ACCOUNT_STATUS_TEMPLATE,
          { '1': String(matchedLeads), '2': 'your trades', '3': 'your service area' },
        );
        if (sent) {
          stage2Sent++;
          await supabase.from("reconnect_throttle").upsert(
            { contractor_id: profile.id, channel: "whatsapp_template", sent_at: now.toISOString() },
            { onConflict: "contractor_id,channel" }
          );
        }
      }
    }

    return new Response(JSON.stringify({
      stage1_expiring: expiringEligible.length,
      stage1_sent: stage1Sent,
      stage2_expired: expiredEligible?.length ?? 0,
      stage2_sent: stage2Sent,
    }));
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});

// ── Send WhatsApp via Twilio ──
async function sendWhatsApp(to: string, body: string): Promise<boolean> {
  if (!TWILIO_SID || !TWILIO_FROM) {
    console.error("Twilio not configured");
    return false;
  }

  const phone = to.startsWith("+") ? to : `+${to}`;
  const toWa = `whatsapp:${phone}`;

  const form = new URLSearchParams({ From: TWILIO_FROM, To: toWa, Body: body });

  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: "Basic " + btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`),
        },
        body: form.toString(),
      }
    );

    if (res.ok) return true;

    const data = await res.json();
    console.error(`Twilio send failed for ${phone}:`, data.message || res.status);
    return false;
  } catch (err) {
    console.error(`Twilio error for ${phone}:`, err);
    return false;
  }
}

// ── Send Content Template via Twilio (bypasses 24h window) ──
async function sendContentTemplate(
  to: string,
  contentSid: string,
  variables: Record<string, string>,
): Promise<boolean> {
  if (!TWILIO_SID || !TWILIO_FROM) {
    console.error("Twilio not configured");
    return false;
  }

  const phone = to.startsWith("+") ? to : `+${to}`;
  const toWa = `whatsapp:${phone}`;

  const form = new URLSearchParams({
    From: TWILIO_FROM,
    To: toWa,
    ContentSid: contentSid,
    ContentVariables: JSON.stringify(variables),
  });

  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: "Basic " + btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`),
        },
        body: form.toString(),
      }
    );

    if (res.ok) return true;

    const data = await res.json();
    console.error(`Twilio template failed for ${phone}:`, data.message || res.status);
    return false;
  } catch (err) {
    console.error(`Twilio template error for ${phone}:`, err);
    return false;
  }
}
