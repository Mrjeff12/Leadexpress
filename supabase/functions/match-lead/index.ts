import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

// ── Emoji & Urgency maps ─────────────────────────────────────────────────────
const PROFESSION_EMOJI: Record<string, string> = {
  hvac:"❄️",air_duct:"🌬️",chimney:"🏠",dryer_vent:"🌀",garage_door:"🚗",
  locksmith:"🔑",roofing:"🏗️",plumbing:"🚰",electrical:"⚡",painting:"🎨",
  cleaning:"✨",carpet_cleaning:"🧹",renovation:"🔨",fencing:"🧱",
  landscaping:"🌿",tiling:"🔲",kitchen:"🍳",bathroom:"🚿",pool:"🏊",
  moving:"📦",other:"📋",
};

const URGENCY_LABEL: Record<string, string> = {
  hot: "🔥 ASAP — Today/Tomorrow",
  warm: "⚡ This Week",
  cold: "❄️ Flexible",
};

// ── Format notification messages ─────────────────────────────────────────────
function formatWhatsAppMessage(lead: Record<string, unknown>): string {
  const emoji = PROFESSION_EMOJI[lead.profession as string] ?? "📋";
  const prof = (lead.profession as string).replace(/_/g, " ").toUpperCase();
  const location = [lead.city, lead.state, lead.zip_code].filter(Boolean).join(", ");
  const urgency = URGENCY_LABEL[lead.urgency as string] ?? "❄️ Flexible";
  const summary = lead.parsed_summary as string;

  let msg = `${emoji} *New ${prof} Lead*\n\n`;
  if (summary) msg += `> _${summary}_\n\n`;
  if (location) msg += `📍 *Location:* ${location}\n`;
  if (lead.budget_range) msg += `💰 *Budget:* ${lead.budget_range}\n`;
  msg += `⏰ *Urgency:* ${urgency}\n`;
  return msg;
}

// ── Main handler ─────────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === "GET") {
    return new Response(JSON.stringify({ status: "ok", service: "match-lead" }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // Claim pending parsed_leads jobs
  const { data: jobs, error: claimErr } = await supabase.rpc("claim_jobs", {
    p_queue: "parsed_leads",
    p_limit: 5,
  });

  if (claimErr || !jobs?.length) {
    return new Response(JSON.stringify({ processed: 0 }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const results: string[] = [];

  for (const job of jobs) {
    const { leadId } = job.payload as { leadId: string };

    try {
      // Fetch lead
      const { data: lead, error: leadErr } = await supabase
        .from("leads")
        .select("*, groups(name)")
        .eq("id", leadId)
        .single();

      if (leadErr || !lead) {
        throw new Error(`Lead ${leadId} not found`);
      }

      if (!lead.zip_code) {
        await supabase.from("leads").update({ status: "no_match" }).eq("id", leadId);
        await supabase.from("pipeline_events").insert({
          stage: "no_match", detail: { lead_id: leadId, reason: "no_zip_code" },
        });
        await supabase.rpc("complete_job", { p_job_id: job.id });
        results.push(`no_zip:${leadId}`);
        continue;
      }

      // Find matching contractors
      const { data: contractors } = await supabase
        .from("contractors")
        .select(`
          user_id, professions, zip_codes, wa_notify, available_today,
          wa_window_until,
          profiles!inner(full_name, whatsapp_phone,
            subscriptions!inner(status, plan_id))
        `)
        .eq("is_active", true)
        .eq("profiles.status", "active")
        .in("profiles.subscriptions.status", ["active", "trialing"])
        .contains("professions", [lead.profession])
        .contains("zip_codes", [lead.zip_code]);

      if (!contractors?.length) {
        await supabase.from("leads").update({ status: "no_match" }).eq("id", leadId);
        await supabase.rpc("complete_job", { p_job_id: job.id });
        results.push(`no_match:${leadId}`);
        continue;
      }

      // Load push subscriptions for these contractors
      const contractorIds = contractors.map((c) => c.user_id);
      const { data: pushSubs } = await supabase
        .from("push_subscriptions")
        .select("user_id")
        .in("user_id", contractorIds);
      const hasPush = new Set((pushSubs ?? []).map((s: { user_id: string }) => s.user_id));

      // Load throttle data (1h window)
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { data: throttled } = await supabase
        .from("reconnect_throttle")
        .select("contractor_id, channel")
        .in("contractor_id", contractorIds)
        .gt("sent_at", oneHourAgo);
      const throttleSet = new Set(
        (throttled ?? []).map((t: { contractor_id: string; channel: string }) =>
          `${t.contractor_id}:${t.channel}`),
      );

      const isThrottled = (id: string, ch: string) => throttleSet.has(`${id}:${ch}`);

      // Format messages
      const waMessage = formatWhatsAppMessage(lead);

      // Cap at 50 contractors
      const capped = contractors.slice(0, 50);
      const matchedIds: string[] = [];
      let notifyCount = 0;

      for (const c of capped) {
        const profile = c.profiles as unknown as {
          full_name: string;
          whatsapp_phone: string | null;
        };
        let primaryChannel: string | null = null;

        // Tier 1: WhatsApp template with buttons (always preferred when phone available)
        if (profile.whatsapp_phone && !isThrottled(c.user_id, "whatsapp_template")) {
          await supabase.rpc("enqueue_job", {
            p_queue: "notify_whatsapp_template",
            p_payload: {
              leadId, contractorId: c.user_id, whatsappPhone: profile.whatsapp_phone,
              contractorName: profile.full_name, profession: lead.profession,
              city: lead.city, zip_code: lead.zip_code, summary: lead.parsed_summary, urgency: lead.urgency,
            },
            p_dedup_key: `wa-tpl-${leadId}-${c.user_id}`,
            p_max_attempts: 3,
          });
          primaryChannel = "whatsapp_template";
        }

        // Tier 2: Push (if available)
        if (hasPush.has(c.user_id)) {
          const profLabel = lead.profession.replace(/_/g, " ").toUpperCase();
          await supabase.rpc("enqueue_job", {
            p_queue: "notify_push",
            p_payload: {
              leadId, contractorId: c.user_id,
              title: `🔥 New ${profLabel} Lead`,
              body: `${lead.city ?? "Your area"} — Tap to view details`,
              url: "/leads",
            },
            p_dedup_key: `push-${leadId}-${c.user_id}`,
            p_max_attempts: 2,
          });
        }

        if (primaryChannel) {
          matchedIds.push(c.user_id);
          notifyCount++;

          // Track notification
          await supabase.from("lead_notifications").upsert({
            lead_id: leadId, contractor_id: c.user_id,
            channel: primaryChannel, delivery_status: "queued",
          }, { onConflict: "lead_id,contractor_id" });
        }
      }

      // Atomic: update lead status + log pipeline event
      await supabase.rpc("finalize_lead_match", {
        p_lead_id: leadId,
        p_matched_contractor_ids: matchedIds,
        p_sent_count: notifyCount,
      });

      await supabase.rpc("complete_job", { p_job_id: job.id });
      results.push(`matched:${leadId}:${notifyCount}`);

    } catch (err) {
      const msg = err instanceof Error ? err.message : "unknown";
      console.error(`[match-lead] Job ${job.id} failed:`, msg);
      await supabase.rpc("fail_job", { p_job_id: job.id, p_error: msg });
      results.push(`error:${msg}`);
    }
  }

  return new Response(
    JSON.stringify({ processed: results.length, results }),
    { headers: { "Content-Type": "application/json" } },
  );
});
