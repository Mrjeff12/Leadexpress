// supabase/functions/send-window-reminder/index.ts
// Triggered by pg_cron every 30 minutes.
// Finds contractors whose WhatsApp 24h window is about to close
// and sends them a push notification to reopen it.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:support@masterleadflow.com";
const REBECA_PHONE = Deno.env.get("REBECA_PHONE") || "14155238886";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

Deno.serve(async (req) => {
  // Allow invocation from pg_cron (no auth) or with service role key
  const authHeader = req.headers.get("authorization") ?? "";
  const isServiceRole = authHeader.includes(SERVICE_ROLE_KEY);
  const isCron = req.headers.get("x-pg-cron") === "true";

  if (!isServiceRole && !isCron) {
    // Also allow if called from Supabase dashboard/CLI
    const apiKey = req.headers.get("apikey") ?? "";
    if (apiKey !== SERVICE_ROLE_KEY) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }
  }

  try {
    // Find contractors whose 24h window closes in < 2 hours
    // AND who haven't been reminded in the last 12 hours
    // AND who have push subscriptions
    const { data: targets, error } = await supabase
      .from("contractors")
      .select(`
        user_id,
        last_push_reminder_at,
        profiles!inner(full_name),
        push_subscriptions!inner(endpoint, p256dh, auth)
      `)
      .gt("wa_window_until", new Date().toISOString())
      .lt("wa_window_until", new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString())
      .eq("wa_notify", true)
      .eq("is_active", true);

    if (error) {
      console.error("Query error:", error);
      return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }

    if (!targets || targets.length === 0) {
      return new Response(JSON.stringify({ sent: 0, message: "No targets found" }));
    }

    // Filter out recently reminded
    const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
    const eligible = targets.filter(
      (t) => !t.last_push_reminder_at || t.last_push_reminder_at < twelveHoursAgo
    );

    let sentCount = 0;

    for (const target of eligible) {
      const profile = Array.isArray(target.profiles) ? target.profiles[0] : target.profiles;
      const firstName = (profile?.full_name ?? "").split(" ")[0] || "there";
      const subscriptions = Array.isArray(target.push_subscriptions)
        ? target.push_subscriptions
        : [target.push_subscriptions];

      const payload = JSON.stringify({
        title: "MasterLeadFlow",
        body: `Hey ${firstName}, you have pending leads! Tap to reconnect and see them 👉`,
        url: `https://wa.me/${REBECA_PHONE}?text=${encodeURIComponent("👋")}`,
      });

      for (const sub of subscriptions) {
        try {
          await sendWebPush(sub.endpoint, sub.p256dh, sub.auth, payload);
          sentCount++;
        } catch (err) {
          console.error(`Push failed for ${target.user_id}:`, err);
          // Remove expired subscriptions
          if (err instanceof PushError && (err.status === 410 || err.status === 404)) {
            await supabase
              .from("push_subscriptions")
              .delete()
              .eq("endpoint", sub.endpoint);
          }
        }
      }

      // Update last reminder timestamp
      await supabase
        .from("contractors")
        .update({ last_push_reminder_at: new Date().toISOString() })
        .eq("user_id", target.user_id);
    }

    return new Response(
      JSON.stringify({ sent: sentCount, eligible: eligible.length, total: targets.length })
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});

// ── Web Push implementation using Web Crypto API ──

class PushError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function sendWebPush(
  endpoint: string,
  p256dh: string,
  auth: string,
  payload: string
): Promise<void> {
  // For Deno edge functions, we use the web-push HTTP protocol directly
  // This is a simplified implementation that works with most push services

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "TTL": "86400",
      // Note: Full VAPID + encryption requires web-push library.
      // For production, consider calling the notification service instead.
      "Authorization": `Bearer ${await generateVapidAuth(endpoint)}`,
      "Crypto-Key": `p256ecdsa=${VAPID_PUBLIC_KEY}`,
    },
    body: payload,
  });

  if (!response.ok) {
    throw new PushError(
      `Push failed: ${response.status} ${response.statusText}`,
      response.status
    );
  }
}

async function generateVapidAuth(audience: string): Promise<string> {
  // Generate a VAPID JWT token
  const url = new URL(audience);
  const aud = `${url.protocol}//${url.host}`;

  const header = { typ: "JWT", alg: "ES256" };
  const claims = {
    aud,
    exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
    sub: VAPID_SUBJECT,
  };

  const headerB64 = btoa(JSON.stringify(header)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const claimsB64 = btoa(JSON.stringify(claims)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const unsignedToken = `${headerB64}.${claimsB64}`;

  // Import the VAPID private key and sign
  const keyData = base64UrlToArrayBuffer(VAPID_PRIVATE_KEY);
  const key = await crypto.subtle.importKey(
    "pkcs8",
    keyData,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    new TextEncoder().encode(unsignedToken)
  );

  const sigB64 = arrayBufferToBase64Url(signature);
  return `${unsignedToken}.${sigB64}`;
}

function base64UrlToArrayBuffer(b64url: string): ArrayBuffer {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (b64.length % 4)) % 4);
  const binary = atob(b64 + padding);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function arrayBufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
