import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

/**
 * record-claim: Records a lead_claimed event when contractor clicks
 * "WhatsApp the Customer" on the claim landing page.
 *
 * Security: validates that a lead_page_viewed event exists for this
 * lead+contractor pair (proves they came through claim-redirect).
 * Dedup: skips insert if lead_claimed already exists for this pair.
 *
 * POST body: { leadId, contractorId }
 * No JWT required — called from public claim page.
 */

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

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
    const { leadId, contractorId } = await req.json();

    if (!leadId || !contractorId) {
      return new Response(JSON.stringify({ error: "missing_params" }), {
        status: 400, headers: corsHeaders,
      });
    }

    // Security: verify this contractor actually viewed the claim page
    // (lead_page_viewed is inserted by claim-redirect with a signed token)
    const { count: viewCount } = await supabase
      .from("pipeline_events")
      .select("id", { count: "exact", head: true })
      .eq("stage", "lead_page_viewed")
      .filter("detail->>lead_id", "eq", leadId)
      .filter("detail->>contractor_id", "eq", contractorId);

    if (!viewCount || viewCount === 0) {
      console.error(`[record-claim] No page view found for lead=${leadId} contractor=${contractorId}`);
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 403, headers: corsHeaders,
      });
    }

    // Dedup: check if this contractor already claimed this lead
    const { count: existingClaim } = await supabase
      .from("pipeline_events")
      .select("id", { count: "exact", head: true })
      .eq("stage", "lead_claimed")
      .filter("detail->>lead_id", "eq", leadId)
      .filter("detail->>contractor_id", "eq", contractorId);

    if (existingClaim && existingClaim > 0) {
      // Already claimed — return success without duplicate insert
      return new Response(JSON.stringify({ ok: true, dedup: true }), {
        headers: corsHeaders,
      });
    }

    const { error } = await supabase.from("pipeline_events").insert({
      stage: "lead_claimed",
      detail: { lead_id: leadId, contractor_id: contractorId, channel: "whatsapp_cta" },
    });

    if (error) {
      console.error("[record-claim] Insert error:", error.message);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500, headers: corsHeaders,
      });
    }

    return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
  } catch (err) {
    console.error("[record-claim] Error:", err);
    return new Response(JSON.stringify({ error: "internal" }), {
      status: 500, headers: corsHeaders,
    });
  }
});
