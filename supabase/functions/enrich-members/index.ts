import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

/**
 * enrich-members: Fetches WhatsApp profile pics + contact info from Green API
 * for unenriched group_members. Priority: admins → lead-active → others.
 * Also detects professions from "about" text and tags prospects.
 * Runs on cron every 1 hour. Max 30 members per run (within 60s timeout).
 */

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const MAX_PER_RUN = 10;
const RE_ENRICH_DAYS = 30;

// ── Profession detection from "about" text ──────────────────────────────────
const PROFESSION_PATTERNS: Array<[RegExp, string]> = [
  [/\b(hvac|heating|cooling|air\s*condition)/i, "hvac"],
  [/\b(plumb|pipe|drain|water\s*heater)/i, "plumbing"],
  [/\b(electric|wiring|panel|circuit)/i, "electrical"],
  [/\b(roof|shingle|gutter)/i, "roofing"],
  [/\b(locksmith|lock|key|safe)/i, "locksmith"],
  [/\b(garage\s*door|overhead\s*door)/i, "garage_door"],
  [/\b(air\s*duct|duct\s*clean|dryer\s*vent)/i, "air_duct"],
  [/\b(chimney|fireplace|flue)/i, "chimney"],
  [/\b(carpet\s*clean|upholstery)/i, "carpet_cleaning"],
  [/\b(paint|stain|coat)/i, "painting"],
  [/\b(renovat|remodel|general\s*contract|handyman)/i, "renovation"],
  [/\b(landscap|lawn|garden|tree)/i, "landscaping"],
  [/\b(tile|tiling|flooring)/i, "tiling"],
  [/\b(clean|janitorial|maid|housekeep)/i, "cleaning"],
  [/\b(pool|spa|swim)/i, "pool"],
  [/\b(mov|haul|truck|junk)/i, "moving"],
  [/\b(fence|fencing|gate)/i, "fencing"],
  [/\b(kitchen|cabinet|counter)/i, "kitchen"],
  [/\b(bathroom|bath|shower)/i, "bathroom"],
  [/\b(licensed|insured|bonded|certified)/i, "other"],
];

const PHONE_PATTERN = /(?:\+?1[-.\s]?)?\(?[2-9]\d{2}\)?[-.\s]?\d{3}[-.\s]?\d{4}/;

function detectProfessions(about: string): string[] {
  const found: string[] = [];
  for (const [pattern, tag] of PROFESSION_PATTERNS) {
    if (pattern.test(about) && !found.includes(tag)) {
      found.push(tag);
    }
  }
  return found;
}

function looksLikeSeller(about: string): boolean {
  return PHONE_PATTERN.test(about);
}

Deno.serve(async (req: Request) => {
  if (req.method === "GET") {
    return json({ status: "ok", service: "enrich-members" });
  }

  // 1. Load active scanner accounts
  const { data: accounts } = await supabase
    .from("wa_accounts")
    .select("id, green_api_id, green_api_token, green_api_url")
    .eq("is_active", true)
    .eq("status", "connected");

  if (!accounts?.length) return json({ enriched: 0, message: "no connected accounts" });

  // Build a map: for each member we need to find which account to use
  // We'll query group_members with their group's wa_account_id
  const accountMap = new Map(accounts.map((a: any) => [a.id, a]));

  // 2. Priority queue: admins → lead-active → others → re-enrich (30d old)
  const cutoff = new Date(Date.now() - RE_ENRICH_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const seen = new Set<string>();
  const toEnrich: Array<{ id: string; wa_sender_id: string; wa_account_id: string }> = [];

  const collect = (data: any[] | null) => {
    for (const m of data ?? []) {
      if (toEnrich.length >= MAX_PER_RUN || seen.has(m.id)) continue;
      seen.add(m.id);
      toEnrich.push({
        id: m.id,
        wa_sender_id: m.wa_sender_id,
        wa_account_id: m.groups?.wa_account_id,
      });
    }
  };

  // Batch 1: unenriched admins
  const { data: admins } = await supabase
    .from("group_members")
    .select("id, wa_sender_id, groups!inner(wa_account_id)")
    .is("left_group_at", null)
    .is("last_enriched_at", null)
    .eq("classification", "admin")
    .limit(MAX_PER_RUN);
  collect(admins);

  // Batch 2: unenriched with lead activity
  if (toEnrich.length < MAX_PER_RUN) {
    const { data: leads } = await supabase
      .from("group_members")
      .select("id, wa_sender_id, groups!inner(wa_account_id)")
      .is("left_group_at", null)
      .is("last_enriched_at", null)
      .gt("lead_messages", 0)
      .limit(MAX_PER_RUN);
    collect(leads);
  }

  // Batch 3: any other unenriched
  if (toEnrich.length < MAX_PER_RUN) {
    const { data: others } = await supabase
      .from("group_members")
      .select("id, wa_sender_id, groups!inner(wa_account_id)")
      .is("left_group_at", null)
      .is("last_enriched_at", null)
      .limit(MAX_PER_RUN);
    collect(others);
  }

  // Batch 4: stale enrichment (re-enrich after 30 days)
  if (toEnrich.length < MAX_PER_RUN) {
    const { data: stale } = await supabase
      .from("group_members")
      .select("id, wa_sender_id, groups!inner(wa_account_id)")
      .is("left_group_at", null)
      .lt("last_enriched_at", cutoff)
      .limit(MAX_PER_RUN);
    collect(stale);
  }

  if (!toEnrich.length) return json({ enriched: 0, message: "all members enriched" });

  // 3. Enrich each member
  let enriched = 0;
  const errors: string[] = [];

  for (const member of toEnrich) {
    const account = accountMap.get(member.wa_account_id);
    if (!account) continue;

    const updates: Record<string, unknown> = {
      last_enriched_at: new Date().toISOString(),
    };

    // 3a. Get avatar
    try {
      const res = await fetch(
        `${account.green_api_url}/waInstance${account.green_api_id}/getAvatar/${account.green_api_token}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chatId: member.wa_sender_id }),
        },
      );
      if (res.ok) {
        const data = await res.json();
        if (data.urlAvatar) updates.profile_pic_url = data.urlAvatar;
      }
    } catch { /* avatar is optional */ }

    await new Promise((r) => setTimeout(r, 300));

    // 3b. Get contact info
    try {
      const res = await fetch(
        `${account.green_api_url}/waInstance${account.green_api_id}/getContactInfo/${account.green_api_token}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chatId: member.wa_sender_id }),
        },
      );
      if (res.ok) {
        const data = await res.json();
        if (data.name) updates.profile_name = data.name;
        if (data.contactName) updates.display_name = data.contactName;
        if (data.about) updates.about = data.about;
      }
    } catch { /* contact info is optional */ }

    await new Promise((r) => setTimeout(r, 300));

    // 3c. Profession detection from "about" text
    const about = updates.about as string | undefined;
    let detectedTags: string[] = [];
    if (about) {
      detectedTags = detectProfessions(about);
    }

    // 4. Save to group_members
    await supabase.from("group_members").update(updates).eq("id", member.id);

    // 5. Update prospect if exists
    const prospectUpdates: Record<string, unknown> = {};
    if (updates.profile_pic_url) prospectUpdates.profile_pic_url = updates.profile_pic_url;
    if (updates.display_name || updates.profile_name) {
      prospectUpdates.display_name = (updates.display_name ?? updates.profile_name) as string;
    }

    if (Object.keys(prospectUpdates).length > 0 || detectedTags.length > 0) {
      // If we detected professions, merge into profession_tags
      if (detectedTags.length > 0) {
        const { data: existing } = await supabase
          .from("prospects")
          .select("profession_tags")
          .eq("wa_id", member.wa_sender_id)
          .maybeSingle();

        if (existing) {
          const currentTags = existing.profession_tags ?? [];
          const mergedTags = [...new Set([...currentTags, ...detectedTags])];
          prospectUpdates.profession_tags = mergedTags;
        }
      }

      if (Object.keys(prospectUpdates).length > 0) {
        await supabase.from("prospects").update(prospectUpdates).eq("wa_id", member.wa_sender_id);
      }
    }

    // 6. If "about" looks like a seller, update classification
    if (about && looksLikeSeller(about)) {
      const { data: memberRow } = await supabase
        .from("group_members")
        .select("classification, manual_override")
        .eq("id", member.id)
        .maybeSingle();

      if (memberRow && !memberRow.manual_override && memberRow.classification === "unknown") {
        await supabase.from("group_members").update({
          classification: "seller",
          classified_at: new Date().toISOString(),
        }).eq("id", member.id);
      }
    }

    enriched++;
  }

  console.log(`[enrich-members] Enriched: ${enriched}/${toEnrich.length}`);
  return json({ enriched, total_candidates: toEnrich.length, errors: errors.length > 0 ? errors : undefined });
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
