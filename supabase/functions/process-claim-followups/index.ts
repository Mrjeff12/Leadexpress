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

const FOLLOWUP_TEMPLATE_SID = Deno.env.get("TWILIO_CONTENT_CLAIM_FOLLOWUP") || "HXb17a13f65f92c9409c153552bcfc2252";
const CLAIM_SECRET = Deno.env.get("CLAIM_TOKEN_SECRET") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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

async function signFollowupToken(payload: Record<string, string>): Promise<string> {
  const json = JSON.stringify(payload);
  const token = btoa(json).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", encoder.encode(CLAIM_SECRET),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(token));
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${token}.${sigB64}`;
}

Deno.serve(async (_req: Request) => {
  await loadSecrets();
  if (!TWILIO_SID) {
    return new Response(JSON.stringify({ error: "no_secrets" }), { status: 500 });
  }

  // Find lead_claimed events older than 10 minutes
  const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();

  const { data: claimEvents, error: queryErr } = await supabase
    .from("pipeline_events")
    .select("id, detail, created_at")
    .eq("stage", "lead_claimed")
    .lt("created_at", tenMinAgo)
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
    const toWa = `whatsapp:${contractorPhone.startsWith("+") ? contractorPhone : "+" + contractorPhone}`;

    // Create signed follow-up token
    const followupToken = await signFollowupToken({
      l: leadId,
      c: contractorId,
      ts: String(Date.now()),
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
              "3": followupToken,
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

  return new Response(
    JSON.stringify({ processed: results.length, results }),
    { headers: { "Content-Type": "application/json" } },
  );
});
