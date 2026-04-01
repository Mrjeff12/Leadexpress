import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

/**
 * claim-followup-action: Handles contractor's response to follow-up.
 *
 * POST body: { leadId, contractorId, action: 'took' | 'not_relevant' | 'still_talking' }
 *
 * If action = 'took':
 *   1. Creates a job_order linking the lead to the contractor
 *   2. Returns publisher message + job portal URL
 *
 * If action = 'not_relevant' or 'still_talking':
 *   Records the status in pipeline_events
 */

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const CLAIM_SECRET = Deno.env.get("CLAIM_TOKEN_SECRET") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function verifyFollowupToken(tokenStr: string): Promise<{ l: string; c: string; ts: string } | null> {
  const [token, sigB64] = tokenStr.split(".");
  if (!token || !sigB64) return null;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", encoder.encode(CLAIM_SECRET),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(token));
  const computed = btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

  if (computed.length !== sigB64.length) return null;
  const a = encoder.encode(computed);
  const b = encoder.encode(sigB64);
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a[i] ^ b[i];
  if (result !== 0) return null;

  try {
    const padded = token.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const corsHeaders = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  };

  try {
    const { token, action } = await req.json() as {
      token: string;
      action: "took" | "not_relevant" | "still_talking";
    };

    if (!token || !action) {
      return new Response(JSON.stringify({ error: "missing_params" }), {
        status: 400, headers: corsHeaders,
      });
    }

    // Verify signed token
    const payload = await verifyFollowupToken(token);
    if (!payload) {
      return new Response(JSON.stringify({ error: "invalid_token" }), {
        status: 403, headers: corsHeaders,
      });
    }

    const { l: leadId, c: contractorId } = payload;

    // Dedup: check if action already recorded
    const { count: existingAction } = await supabase
      .from("pipeline_events")
      .select("id", { count: "exact", head: true })
      .eq("stage", "claim_followup_response")
      .filter("detail->>lead_id", "eq", leadId)
      .filter("detail->>contractor_id", "eq", contractorId);

    if (existingAction && existingAction > 0) {
      return new Response(JSON.stringify({ ok: true, dedup: true }), {
        headers: corsHeaders,
      });
    }

    // Record the response
    await supabase.from("pipeline_events").insert({
      stage: "claim_followup_response",
      detail: { lead_id: leadId, contractor_id: contractorId, action },
    });

    let jobOrder = null;
    let publisherMessage = null;

    if (action === "took") {
      // Get lead details for the job
      const { data: lead } = await supabase
        .from("leads")
        .select("id, profession, city, zip_code, sender_id, sender_name, parsed_summary")
        .eq("id", leadId)
        .maybeSingle();

      // Get contractor details
      const { data: contractor } = await supabase
        .from("contractors")
        .select("user_id, full_name")
        .eq("user_id", contractorId)
        .maybeSingle();

      if (lead && contractor) {
        const profession = (lead.profession || "").replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
        const location = [lead.city, lead.zip_code].filter(Boolean).join(", ") || "Your area";

        // Create job_order
        const { data: job, error: jobErr } = await supabase
          .from("job_orders")
          .insert({
            lead_id: leadId,
            contractor_id: contractorId,
            assigned_user_id: contractorId,
            deal_type: "custom",
            deal_value: "TBD",
            status: "accepted",
            customer_name: lead.sender_name || null,
            customer_address: location,
            notes: lead.parsed_summary || null,
            token_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          })
          .select("id, access_token")
          .single();

        if (jobErr) {
          console.error("[claim-followup-action] Job creation error:", jobErr.message);
        } else {
          jobOrder = job;

          // Record job creation event
          await supabase.from("pipeline_events").insert({
            stage: "job_created_from_claim",
            detail: { lead_id: leadId, contractor_id: contractorId, job_order_id: job.id },
          });

          // Build publisher forwarding message
          const jobUrl = `https://app.masterleadflow.com/portal/job/${job.access_token}`;
          publisherMessage = `Hi! I'm reaching out about the ${profession} job you posted in ${location}.\n\nI'd like to take this on through MasterLeadFlow — here's a link with the job details. You can approve it there, and we'll both have everything tracked securely:\n\n${jobUrl}\n\nFeel free to sign up for free to manage the process easily. Looking forward to working together!`;
        }
      }
    }

    return new Response(JSON.stringify({
      ok: true,
      action,
      jobOrder: jobOrder ? { id: jobOrder.id, accessToken: jobOrder.access_token } : null,
      publisherMessage,
    }), { headers: corsHeaders });
  } catch (err) {
    console.error("[claim-followup-action] Error:", err);
    return new Response(JSON.stringify({ error: "internal" }), {
      status: 500, headers: corsHeaders,
    });
  }
});
