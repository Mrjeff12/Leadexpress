import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import webpush from "https://esm.sh/web-push@3.6.7";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:support@masterleadflow.com";

let _vapidReady = false;
function ensureVapid() {
  if (_vapidReady) return true;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return false;
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  _vapidReady = true;
  return true;
}

interface PushJob {
  leadId: string;
  contractorId: string;
  title: string;
  body: string;
  url?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "GET") {
    return new Response(JSON.stringify({ status: "ok", service: "notify-push" }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!ensureVapid()) {
    return new Response(JSON.stringify({ error: "no_vapid_keys" }), { status: 500 });
  }

  const { data: jobs } = await supabase.rpc("claim_jobs", {
    p_queue: "notify_push", p_limit: 30,
  });

  if (!jobs?.length) {
    return new Response(JSON.stringify({ processed: 0 }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const results: string[] = [];

  for (const job of jobs) {
    const p = job.payload as PushJob;
    try {
      // Fetch all push subscriptions for this contractor
      const { data: subs, error } = await supabase
        .from("push_subscriptions")
        .select("id, endpoint, p256dh, auth")
        .eq("user_id", p.contractorId);

      if (error) throw new Error(`Fetch subs: ${error.message}`);

      if (!subs?.length) {
        await supabase.rpc("complete_job", { p_job_id: job.id });
        results.push(`no_subs:${p.contractorId}`);
        continue;
      }

      const payload = JSON.stringify({
        title: p.title,
        body: p.body,
        leadId: p.leadId,
        url: p.url ?? "/leads",
      });

      let sentCount = 0;
      const expiredIds: string[] = [];

      for (const sub of subs) {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload,
          );
          sentCount++;
        } catch (err: unknown) {
          const statusCode = (err as { statusCode?: number }).statusCode;
          if (statusCode === 410 || statusCode === 404) {
            expiredIds.push(sub.id);
          } else {
            console.warn(`[notify-push] Send failed for ${sub.endpoint}:`, statusCode);
          }
        }
      }

      // Clean up expired subscriptions
      if (expiredIds.length > 0) {
        await supabase.from("push_subscriptions").delete().in("id", expiredIds);
      }

      // Log pipeline event
      await supabase.from("pipeline_events").insert({
        lead_id: p.leadId,
        stage: "push_sent",
        detail: { contractorId: p.contractorId, sent: sentCount, expired: expiredIds.length },
      });

      await supabase.rpc("complete_job", { p_job_id: job.id });
      results.push(`sent:${p.contractorId}:${sentCount}/${subs.length}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "unknown";
      console.error(`[notify-push] Job ${job.id} failed:`, msg);
      await supabase.rpc("fail_job", { p_job_id: job.id, p_error: msg });
      results.push(`error:${msg}`);
    }
  }

  return new Response(
    JSON.stringify({ processed: results.length, results }),
    { headers: { "Content-Type": "application/json" } },
  );
});
