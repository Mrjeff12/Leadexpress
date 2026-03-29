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

Deno.serve(async (_req) => {
  // Auth is handled by Supabase gateway (service_role JWT required).
  // pg_cron calls with the service_role key in the Authorization header.
  try {
    // Step 1: Find contractors whose 24h window closes in < 2 hours
    const now = new Date();
    const twoHoursFromNow = new Date(Date.now() + 2 * 60 * 60 * 1000);
    const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();

    const { data: contractors, error } = await supabase
      .from("contractors")
      .select("user_id, last_push_reminder_at")
      .gt("wa_window_until", now.toISOString())
      .lt("wa_window_until", twoHoursFromNow.toISOString())
      .eq("wa_notify", true)
      .eq("is_active", true);

    if (error) {
      console.error("Query error:", error);
      return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }

    if (!contractors || contractors.length === 0) {
      return new Response(JSON.stringify({ sent: 0, message: "No targets found" }));
    }

    // Filter out recently reminded
    const eligible = contractors.filter(
      (t) => !t.last_push_reminder_at || t.last_push_reminder_at < twelveHoursAgo
    );

    if (eligible.length === 0) {
      return new Response(JSON.stringify({ sent: 0, message: "All recently reminded", total: contractors.length }));
    }

    const userIds = eligible.map((c) => c.user_id);

    // Step 2: Get profiles for eligible users
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", userIds);

    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

    // Step 3: Get push subscriptions for eligible users
    const { data: subscriptions } = await supabase
      .from("push_subscriptions")
      .select("user_id, endpoint, p256dh, auth")
      .in("user_id", userIds);

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(JSON.stringify({ sent: 0, message: "No push subscriptions", eligible: eligible.length }));
    }

    // Group subscriptions by user_id
    const subsByUser = new Map<string, typeof subscriptions>();
    for (const sub of subscriptions) {
      const arr = subsByUser.get(sub.user_id) ?? [];
      arr.push(sub);
      subsByUser.set(sub.user_id, arr);
    }

    let sentCount = 0;

    for (const target of eligible) {
      const userSubs = subsByUser.get(target.user_id);
      if (!userSubs || userSubs.length === 0) continue;

      const fullName = profileMap.get(target.user_id) ?? "";
      const firstName = fullName.split(" ")[0] || "there";

      const payload = JSON.stringify({
        title: "MasterLeadFlow",
        body: `Hey ${firstName}, you have pending leads! Tap to reconnect and see them 👉`,
        url: `https://wa.me/${REBECA_PHONE}?text=${encodeURIComponent("👋")}`,
      });

      for (const sub of userSubs) {
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
      JSON.stringify({ sent: sentCount, eligible: eligible.length, total: contractors.length })
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
