import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

/**
 * portal-nudge: Cron job that checks for publishers who opened the portal
 * page but didn't complete signup. Sends a reminder to the sub-contractor
 * (Moti) so they can follow up.
 *
 * Schedule: every 2 hours
 * Condition: viewed_at is 2-48 hours ago, publisher_user_id is null, nudge not sent
 */

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

let TWILIO_SID = "";
let TWILIO_TOKEN = "";
let TWILIO_FROM = "";
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
  } catch {
    return false;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "GET") {
    return new Response(JSON.stringify({ status: "ok", service: "portal-nudge" }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    await loadSecrets();

    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

    // Find jobs where publisher opened but didn't sign up
    const { data: staleJobs, error } = await supabase
      .from("job_orders")
      .select(`
        id,
        contractor_id,
        viewed_at,
        lead:leads!job_orders_lead_id_fkey (
          profession,
          city,
          zip_code
        )
      `)
      .not("viewed_at", "is", null)
      .is("publisher_user_id", null)
      .eq("portal_nudge_sent", false)
      .lt("viewed_at", twoHoursAgo)
      .gt("viewed_at", fortyEightHoursAgo);

    if (error) {
      console.error("[portal-nudge] Query error:", error);
      return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }

    if (!staleJobs || staleJobs.length === 0) {
      return new Response(JSON.stringify({ nudged: 0 }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    let nudged = 0;

    for (const job of staleJobs) {
      // Get contractor's WhatsApp phone
      const { data: contractor } = await supabase
        .from("profiles")
        .select("whatsapp_phone, full_name")
        .eq("id", job.contractor_id)
        .single();

      if (!contractor?.whatsapp_phone) continue;

      const lead = job.lead as any;
      const profession = (lead?.profession || "").replace(/_/g, " ");
      const location = [lead?.city, lead?.zip_code].filter(Boolean).join(", ");
      const jobDesc = [profession, location].filter(Boolean).join(" in ") || "the job";

      const msg = `💡 Heads up — the publisher of ${jobDesc} opened your link but didn't finish signing up.\n\nYou can send them a quick reminder or reach out directly. Sometimes people just get busy!`;

      const sent = await sendWhatsApp(contractor.whatsapp_phone, msg);

      if (sent) {
        await supabase
          .from("job_orders")
          .update({ portal_nudge_sent: true })
          .eq("id", job.id);
        nudged++;
      }
    }

    console.log(`[portal-nudge] Nudged ${nudged}/${staleJobs.length} contractors`);

    return new Response(JSON.stringify({ nudged, total: staleJobs.length }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[portal-nudge] Error:", err);
    return new Response(JSON.stringify({ error: "internal" }), { status: 500 });
  }
});
