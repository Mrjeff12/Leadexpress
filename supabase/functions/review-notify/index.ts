import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

/**
 * review-notify: Called when a job is marked as completed.
 * Sends WhatsApp to both contractor and publisher with a link to rate each other.
 */

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const SITE_URL = Deno.env.get("SITE_URL") || "https://app.masterleadflow.com";

const corsHeaders = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
};

let TWILIO_SID = "", TWILIO_TOKEN = "", TWILIO_FROM = "";
let _secretsLoaded = false;

async function loadSecrets() {
  if (_secretsLoaded) return;
  const { data, error } = await supabase.rpc("get_twilio_secrets");
  if (error || !data) return;
  TWILIO_SID = data.TWILIO_ACCOUNT_SID || "";
  TWILIO_TOKEN = data.TWILIO_AUTH_TOKEN || "";
  TWILIO_FROM = data.TWILIO_WA_FROM || "";
  _secretsLoaded = true;
}

async function sendWhatsApp(to: string, body: string): Promise<boolean> {
  const toWa = to.startsWith("whatsapp:") ? to : `whatsapp:${to.startsWith("+") ? to : "+" + to}`;
  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: "Basic " + btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`),
        },
        body: new URLSearchParams({ From: TWILIO_FROM, To: toWa, Body: body }).toString(),
      },
    );
    return res.ok || res.status === 201;
  } catch { return false; }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { job_order_id } = await req.json();
    if (!job_order_id) {
      return new Response(JSON.stringify({ error: "job_order_id required" }), { status: 400, headers: corsHeaders });
    }

    // Get job + both parties
    const { data: job, error: jobErr } = await supabase
      .from("job_orders")
      .select("id, contractor_id, publisher_user_id, status")
      .eq("id", job_order_id)
      .single();

    if (jobErr || !job) {
      return new Response(JSON.stringify({ error: "Job not found" }), { status: 404, headers: corsHeaders });
    }

    if (job.status !== "completed") {
      return new Response(JSON.stringify({ error: "Job not completed" }), { status: 400, headers: corsHeaders });
    }

    await loadSecrets();
    const reviewUrl = `${SITE_URL}/review-submit/${job_order_id}`;
    let sent = 0;

    // Notify contractor (sub-contractor who did the work)
    if (job.contractor_id) {
      const { data: contractor } = await supabase
        .from("profiles")
        .select("whatsapp_phone, full_name")
        .eq("id", job.contractor_id)
        .single();

      if (contractor?.whatsapp_phone) {
        const msg = `⭐ The job is done! Take a moment to rate the publisher you worked with.\n\nGood ratings help you get more work in the future.\n\n👉 ${reviewUrl}`;
        if (await sendWhatsApp(contractor.whatsapp_phone, msg)) sent++;
      }
    }

    // Notify publisher (if exists)
    if (job.publisher_user_id) {
      const { data: publisher } = await supabase
        .from("profiles")
        .select("whatsapp_phone, full_name")
        .eq("id", job.publisher_user_id)
        .single();

      if (publisher?.whatsapp_phone) {
        // Generate magic link for publisher (they might not be logged in)
        const { data: tokenRow } = await supabase
          .from("magic_login_tokens")
          .insert({
            user_id: job.publisher_user_id,
            redirect_path: `/review-submit/${job_order_id}`,
            expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
          })
          .select("token")
          .single();

        const publisherUrl = tokenRow
          ? `${SITE_URL}/auto-login?token=${tokenRow.token}`
          : reviewUrl;

        const msg = `⭐ The job is done! Take a moment to rate the contractor you worked with.\n\nYour feedback helps the community find reliable subs.\n\n👉 ${publisherUrl}`;
        if (await sendWhatsApp(publisher.whatsapp_phone, msg)) sent++;
      }
    }

    return new Response(JSON.stringify({ ok: true, sent }), { headers: corsHeaders });
  } catch (err) {
    console.error("[review-notify]", err);
    return new Response(JSON.stringify({ error: "internal" }), { status: 500, headers: corsHeaders });
  }
});
