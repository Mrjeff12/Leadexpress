import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

/**
 * process-claim-followups: Cron-triggered function (every 2 minutes).
 * Finds lead_claimed events older than 10 minutes that haven't received
 * a follow-up yet, and sends a WhatsApp template asking the contractor
 * to update their status.
 */

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const FOLLOWUP_TEMPLATE_SID = Deno.env.get("TWILIO_CONTENT_CLAIM_FOLLOWUP") || "HXdf326dee63c6f2aabf8af4bd2c5f6f2d";

let TWILIO_SID = "", TWILIO_TOKEN = "", TWILIO_FROM = "";
let _secretsLoaded = false;

async function loadSecrets() {
  if (_secretsLoaded) return;
  const { data, error } = await supabase.rpc("get_twilio_secrets");
  if (error || !data) { console.error("[secrets] Failed:", error); return; }
  TWILIO_SID = data.TWILIO_ACCOUNT_SID || "";
  TWILIO_TOKEN = data.TWILIO_AUTH_TOKEN || "";
  TWILIO_FROM = data.TWILIO_WA_FROM || "";
  _secretsLoaded = true;
}


Deno.serve(async (_req: Request) => {
  await loadSecrets();
  if (!TWILIO_SID) {
    return new Response(JSON.stringify({ error: "no_secrets" }), { status: 500 });
  }

  // Find lead_claimed events older than 10 minutes but not older than 7 days
  const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: claimEvents, error: queryErr } = await supabase
    .from("pipeline_events")
    .select("id, detail, created_at")
    .eq("stage", "lead_claimed")
    .lt("created_at", tenMinAgo)
    .gt("created_at", sevenDaysAgo)
    .order("created_at", { ascending: true })
    .limit(20);

  if (queryErr) {
    console.error("[process-claim-followups] Query error:", queryErr.message);
    return new Response(JSON.stringify({ error: queryErr.message }), { status: 500 });
  }

  const results: string[] = [];

  for (const evt of claimEvents ?? []) {
    const detail = evt.detail as { lead_id?: string; contractor_id?: string };
    const leadId = detail?.lead_id;
    const contractorId = detail?.contractor_id;
    if (!leadId || !contractorId) continue;

    // Check if follow-up already sent
    const { count: followupCount } = await supabase
      .from("pipeline_events")
      .select("id", { count: "exact", head: true })
      .eq("stage", "claim_followup_sent")
      .filter("detail->>lead_id", "eq", leadId)
      .filter("detail->>contractor_id", "eq", contractorId);

    if (followupCount && followupCount > 0) continue;

    // Get lead + contractor details for the template
    const { data: lead } = await supabase
      .from("leads")
      .select("profession, city, zip_code")
      .eq("id", leadId)
      .maybeSingle();

    // Try contractor phone from claim event detail first (works for unregistered contractors),
    // then fall back to contractors table
    let contractorPhone = (detail as any)?.contractor_phone || null;
    if (!contractorPhone) {
      const { data: contractor } = await supabase
        .from("contractors")
        .select("whatsapp_phone")
        .eq("user_id", contractorId)
        .maybeSingle();
      contractorPhone = contractor?.whatsapp_phone || null;
    }

    if (!contractorPhone) {
      results.push(`skip_no_phone:${contractorId}`);
      continue;
    }

    const profession = (lead?.profession || "").replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
    const location = [lead?.city, lead?.zip_code].filter(Boolean).join(", ") || "Your area";
    const normalizedPhone = contractorPhone.startsWith("+") ? contractorPhone : "+" + contractorPhone;
    const toWa = `whatsapp:${normalizedPhone}`;

    // Store followup context so the webhook knows which claim the button press refers to
    await supabase.from("wa_onboard_state").upsert({
      phone: normalizedPhone,
      step: "claim_followup",
      data: { leadId, contractorId },
      updated_at: new Date().toISOString(),
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
          body: new URLSearchParams({
            From: TWILIO_FROM,
            To: toWa,
            ContentSid: FOLLOWUP_TEMPLATE_SID,
            ContentVariables: JSON.stringify({
              "1": profession || "Job",
              "2": location,
            }),
          }).toString(),
        },
      );

      if (res.ok || res.status === 201) {
        // Record follow-up sent
        await supabase.from("pipeline_events").insert({
          stage: "claim_followup_sent",
          detail: { lead_id: leadId, contractor_id: contractorId },
        });
        results.push(`sent:${contractorId}:${leadId.slice(0, 8)}`);
      } else {
        const errText = await res.text();
        console.error(`[process-claim-followups] Twilio error ${res.status}:`, errText);
        results.push(`twilio_error:${res.status}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "unknown";
      console.error("[process-claim-followups] Error:", msg);
      results.push(`error:${msg}`);
    }
  }

  // ── Publisher no-show reminders (24h after job created, not viewed) ──
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();

  const { data: pendingJobs } = await supabase
    .from("job_orders")
    .select("id, access_token, contractor_id, customer_name, lead_id")
    .eq("status", "pending")
    .is("viewed_at", null)
    .lt("created_at", oneDayAgo)
    .gt("created_at", threeDaysAgo)
    .limit(10);

  for (const job of pendingJobs ?? []) {
    // Check if reminder already sent
    const { count: reminderCount } = await supabase
      .from("pipeline_events")
      .select("id", { count: "exact", head: true })
      .eq("stage", "publisher_noshow_reminder")
      .filter("detail->>job_id", "eq", job.id);

    if (reminderCount && reminderCount > 0) continue;

    // Get contractor phone
    const { data: contractor } = await supabase
      .from("contractors")
      .select("whatsapp_phone")
      .eq("user_id", job.contractor_id)
      .maybeSingle();

    if (!contractor?.whatsapp_phone) continue;

    const portalUrl = `https://app.masterleadflow.com/portal/job/${job.access_token}`;
    const toWa = `whatsapp:${contractor.whatsapp_phone.startsWith("+") ? contractor.whatsapp_phone : "+" + contractor.whatsapp_phone}`;

    await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: "Basic " + btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`),
        },
        body: new URLSearchParams({
          From: TWILIO_FROM,
          To: toWa,
          Body: `⏳ המפרסם עדיין לא אישר את העבודה שלקחת.\n\nשלח לו שוב את הלינק:\n👉 ${portalUrl}`,
        }).toString(),
      },
    );

    await supabase.from("pipeline_events").insert({
      stage: "publisher_noshow_reminder",
      detail: { job_id: job.id, contractor_id: job.contractor_id },
    });

    results.push(`noshow_reminder:${job.id.slice(0, 8)}`);
  }

  return new Response(
    JSON.stringify({ processed: results.length, results }),
    { headers: { "Content-Type": "application/json" } },
  );
});
