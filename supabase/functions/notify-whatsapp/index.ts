import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

// Twilio secrets loaded from DB (same pattern as whatsapp-webhook)
let TWILIO_SID = "", TWILIO_TOKEN = "", TWILIO_FROM = "";
let _secretsLoaded = false;

// Claim token signing (same secret as claim-redirect)
const CLAIM_SECRET = Deno.env.get("CLAIM_TOKEN_SECRET") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function signClaimToken(payload: { l: string; u: string; p: string; m: string }): Promise<string> {
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
  return `${token}&sig=${sigB64}`;
}

async function loadSecrets() {
  if (_secretsLoaded) return;
  const { data, error } = await supabase.rpc("get_twilio_secrets");
  if (error || !data) { console.error("[secrets] Failed:", error); return; }
  TWILIO_SID = data.TWILIO_ACCOUNT_SID || "";
  TWILIO_TOKEN = data.TWILIO_AUTH_TOKEN || "";
  TWILIO_FROM = data.TWILIO_WA_FROM || "";
  _secretsLoaded = true;
}

interface WaJob {
  leadId: string;
  contractorId: string;
  whatsappPhone: string;
  contractorName: string;
  message: string;
}

async function sendWhatsApp(to: string, body: string): Promise<boolean> {
  const toWa = to.startsWith("whatsapp:") ? to : `whatsapp:${to.startsWith("+") ? to : "+" + to}`;
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
}

Deno.serve(async (req: Request) => {
  if (req.method === "GET") {
    return new Response(JSON.stringify({ status: "ok", service: "notify-whatsapp" }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  await loadSecrets();
  if (!TWILIO_SID) {
    return new Response(JSON.stringify({ error: "no_secrets" }), { status: 500 });
  }

  // Process both wa-notifications and wa-template queues
  const { data: waJobs } = await supabase.rpc("claim_jobs", {
    p_queue: "notify_whatsapp", p_limit: 20,
  });
  const { data: tplJobs } = await supabase.rpc("claim_jobs", {
    p_queue: "notify_whatsapp_template", p_limit: 20,
  });

  const results: string[] = [];

  // Free-form WA messages
  for (const job of waJobs ?? []) {
    const p = job.payload as WaJob;
    try {
      // Check window still open
      const { data: contractor } = await supabase
        .from("contractors").select("wa_window_until")
        .eq("user_id", p.contractorId).maybeSingle();

      const windowOpen = contractor?.wa_window_until &&
        new Date(contractor.wa_window_until) > new Date();

      if (!windowOpen) {
        // Fallback to telegram
        await supabase.rpc("enqueue_job", {
          p_queue: "notify_telegram",
          p_payload: { leadId: p.leadId, contractorId: p.contractorId,
            telegramChatId: "", contractorName: p.contractorName, message: p.message },
          p_max_attempts: 3,
        });
        await supabase.rpc("complete_job", { p_job_id: job.id });
        results.push(`fallback_tg:${p.contractorId}`);
        continue;
      }

      const sent = await sendWhatsApp(p.whatsappPhone, p.message);
      if (sent) {
        await supabase.rpc("complete_job", { p_job_id: job.id });
        results.push(`wa_sent:${p.contractorId}`);
      } else {
        throw new Error("Twilio send failed");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "unknown";
      await supabase.rpc("fail_job", { p_job_id: job.id, p_error: msg });
      results.push(`error:${msg}`);
    }
  }

  // Template WA messages (for closed windows)
  for (const job of tplJobs ?? []) {
    const p = job.payload as {
      leadId: string; contractorId: string; whatsappPhone: string;
      contractorName: string; profession: string; city: string | null;
      zip_code?: string | null; summary: string; urgency: string;
    };
    try {
      const contentSid = Deno.env.get(
        p.whatsappPhone.startsWith("+1") ? "TWILIO_CONTENT_LEAD_NOTIFY_BTN" : "TWILIO_CONTENT_LEAD_NOTIFY",
      );

      if (!contentSid) {
        // Fallback to push
        await supabase.rpc("enqueue_job", {
          p_queue: "notify_push",
          p_payload: { leadId: p.leadId, contractorId: p.contractorId,
            title: `🔥 New ${p.profession.toUpperCase()} Lead`,
            body: `${p.city ?? "Your area"} — Tap to view`, url: "/leads" },
          p_max_attempts: 2,
        });
        await supabase.rpc("complete_job", { p_job_id: job.id });
        results.push(`fallback_push:${p.contractorId}`);
        continue;
      }

      const EMOJI: Record<string, string> = {
        hvac:"❄️",air_duct:"🌀",chimney:"🏠",garage_door:"🚗",roofing:"🏗️",
        plumbing:"🚰",electrical:"⚡",carpet_cleaning:"🧹",dryer_vent:"💨",
        locksmith:"🔑",other:"📋",
      };
      const emoji = EMOJI[p.profession] ?? "📋";
      const urgencyLabel = p.urgency === "hot" ? "🔥 ASAP" : p.urgency === "warm" ? "⚡ This Week" : "❄️ Flexible";
      const location = [p.city, p.zip_code].filter(Boolean).join(", ") || "Your area";
      const toWa = `whatsapp:${p.whatsappPhone.startsWith("+") ? p.whatsappPhone : "+" + p.whatsappPhone}`;

      // Resolve sender phone for claim token
      let senderPhone = "";
      const { data: leadRow } = await supabase
        .from("leads").select("sender_id").eq("id", p.leadId).maybeSingle();
      if (leadRow?.sender_id) senderPhone = leadRow.sender_id.replace(/@.*$/, "");

      const profLabel = p.profession.replace(/_/g, " ").charAt(0).toUpperCase() + p.profession.replace(/_/g, " ").slice(1);
      const introMsg = `Hi! I am a licensed ${profLabel} contractor reaching out about your request in ${location}. I am available and can help. When works for you?`;
      const claimTokenParam = await signClaimToken({
        l: p.leadId, u: p.contractorId, p: senderPhone, m: introMsg,
      });

      // CTA template: {{1}}=profession, {{2}}=location, {{3}}=summary, {{4}}=source, {{5}}=claim_token
      const res = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization: "Basic " + btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`),
          },
          body: new URLSearchParams({
            From: TWILIO_FROM, To: toWa, ContentSid: contentSid,
            ContentVariables: JSON.stringify({
              "1": p.profession.replace(/_/g, " ").toUpperCase(),
              "2": location,
              "3": (p.summary ?? "").substring(0, 120),
              "4": "WhatsApp Group",
              "5": claimTokenParam,
            }),
          }).toString(),
        },
      );

      if (res.ok || res.status === 201) {
        await supabase.from("reconnect_throttle").upsert(
          { contractor_id: p.contractorId, channel: "whatsapp_template", sent_at: new Date().toISOString() },
          { onConflict: "contractor_id,channel" },
        );
        await supabase.rpc("complete_job", { p_job_id: job.id });
        results.push(`tpl_sent:${p.contractorId}`);
      } else {
        throw new Error(`Twilio template error: ${res.status}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "unknown";
      await supabase.rpc("fail_job", { p_job_id: job.id, p_error: msg });
      results.push(`error:${msg}`);
    }
  }

  return new Response(
    JSON.stringify({ processed: results.length, results }),
    { headers: { "Content-Type": "application/json" } },
  );
});
