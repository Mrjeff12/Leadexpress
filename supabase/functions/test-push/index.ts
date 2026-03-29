import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import webpush from "https://esm.sh/web-push@3.6.7";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:support@masterleadflow.com";

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  try {
    // Get optional user_id from body, or send to all subscriptions
    let targetUserId: string | null = null;
    try {
      const body = await req.json();
      targetUserId = body.user_id || null;
    } catch {
      // no body is fine
    }

    // Build query
    let query = supabase.from("push_subscriptions").select("user_id, endpoint, p256dh, auth");
    if (targetUserId) {
      query = query.eq("user_id", targetUserId);
    }

    const { data: subs, error } = await query.limit(10);
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }

    if (!subs || subs.length === 0) {
      return new Response(JSON.stringify({ error: "No push subscriptions found" }));
    }

    const payload = JSON.stringify({
      title: "🔔 MasterLeadFlow",
      body: "Test notification — push is working! 🎉",
      url: "/",
    });

    let sent = 0;
    const errors: string[] = [];

    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          payload
        );
        sent++;
      } catch (err: any) {
        console.error(`Push failed for ${sub.user_id}:`, err?.statusCode, err?.body);
        errors.push(`${sub.user_id}: ${err?.statusCode || err?.message}`);
        // Remove expired/invalid subscriptions
        if (err?.statusCode === 410 || err?.statusCode === 404) {
          await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
        }
      }
    }

    return new Response(
      JSON.stringify({ sent, total: subs.length, errors }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("test-push error:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
