import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

/**
 * auto-import-prospects: Converts group_members into prospects automatically.
 * Deduplicates by wa_sender_id across groups (1 person in 5 groups = 1 prospect).
 * Runs on cron every 4 hours.
 */

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const MAX_PER_RUN = 100;

Deno.serve(async (req: Request) => {
  if (req.method === "GET") {
    return json({ status: "ok", service: "auto-import-prospects" });
  }

  // 1. Find group_members not yet in prospects (dedup by wa_sender_id)
  const { data: unimported, error: queryErr } = await supabase.rpc("get_unimported_members", {
    p_limit: MAX_PER_RUN,
  });

  // Fallback: if RPC doesn't exist, do a manual query
  let members: Array<{
    wa_sender_id: string;
    display_name: string | null;
    profile_pic_url: string | null;
    group_id: string;
    group_name: string;
    group_category: string | null;
    classification: string;
  }> = [];

  if (queryErr || !unimported) {
    // Manual fallback query
    const { data: raw } = await supabase
      .from("group_members")
      .select(`
        wa_sender_id, display_name, profile_pic_url, classification,
        groups!inner(id, name, category)
      `)
      .is("left_group_at", null)
      .not("wa_sender_id", "is", null)
      .limit(MAX_PER_RUN * 2); // over-fetch for dedup

    if (!raw?.length) return json({ imported: 0, message: "no new members" });

    // Filter out those already in prospects
    const senderIds = [...new Set((raw as any[]).map((r) => r.wa_sender_id))];
    const { data: existingProspects } = await supabase
      .from("prospects")
      .select("wa_id")
      .in("wa_id", senderIds);

    const existingSet = new Set((existingProspects ?? []).map((p: { wa_id: string }) => p.wa_id));

    members = (raw as any[])
      .filter((r) => !existingSet.has(r.wa_sender_id))
      .map((r) => ({
        wa_sender_id: r.wa_sender_id,
        display_name: r.display_name,
        profile_pic_url: r.profile_pic_url,
        group_id: r.groups.id,
        group_name: r.groups.name,
        group_category: r.groups.category,
        classification: r.classification,
      }));
  } else {
    members = unimported as any[];
  }

  if (!members.length) return json({ imported: 0, message: "all members already imported" });

  // 2. Deduplicate by wa_sender_id — aggregate group_ids and profession_tags
  const prospectMap = new Map<string, {
    wa_id: string;
    phone: string;
    display_name: string;
    profile_pic_url: string | null;
    group_ids: string[];
    profession_tags: string[];
    is_admin: boolean;
  }>();

  for (const m of members) {
    const existing = prospectMap.get(m.wa_sender_id);
    const phone = m.wa_sender_id.replace("@c.us", "");
    const tag = m.group_category?.toLowerCase() || null;

    if (existing) {
      if (!existing.group_ids.includes(m.group_id)) existing.group_ids.push(m.group_id);
      if (tag && !existing.profession_tags.includes(tag)) existing.profession_tags.push(tag);
      if (m.classification === "admin") existing.is_admin = true;
    } else {
      prospectMap.set(m.wa_sender_id, {
        wa_id: m.wa_sender_id,
        phone,
        display_name: m.display_name || phone,
        profile_pic_url: m.profile_pic_url,
        group_ids: [m.group_id],
        profession_tags: tag ? [tag] : [],
        is_admin: m.classification === "admin",
      });
    }
  }

  // 3. Upsert into prospects
  let imported = 0;
  let skipped = 0;

  for (const prospect of prospectMap.values()) {
    if (imported >= MAX_PER_RUN) break;

    const { error } = await supabase.from("prospects").upsert({
      wa_id: prospect.wa_id,
      phone: prospect.phone,
      display_name: prospect.display_name,
      profile_pic_url: prospect.profile_pic_url,
      group_ids: prospect.group_ids,
      profession_tags: prospect.profession_tags,
      stage: "prospect",
      sub_status: prospect.is_admin ? "hot" : "warm",
    }, {
      onConflict: "wa_id",
      ignoreDuplicates: false,
    });

    if (!error) {
      imported++;
    } else {
      skipped++;
    }
  }

  console.log(`[auto-import-prospects] Imported: ${imported}, Skipped: ${skipped}`);
  return json({ imported, skipped, total_candidates: prospectMap.size });
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
