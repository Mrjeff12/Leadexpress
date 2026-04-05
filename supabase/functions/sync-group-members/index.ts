import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

// ── Types ───────────────────────────────────────────────────────────────────
interface WaAccount {
  id: string;
  green_api_id: string;
  green_api_token: string;
  green_api_url: string;
}

interface GroupRow {
  id: string;
  wa_group_id: string;
  name: string;
  wa_account_id: string;
}

interface Participant {
  id: string;
  isAdmin?: boolean;
}

interface GroupDataResponse {
  groupName?: string;
  participants?: Participant[];
}

// ── Main ────────────────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === "GET") {
    return json({ status: "ok", service: "sync-group-members" });
  }

  // Optional: sync only specific group IDs (used by sync-groups chaining)
  let targetGroupIds: string[] | null = null;
  try {
    const body = await req.json();
    if (body?.groupIds?.length) targetGroupIds = body.groupIds;
  } catch { /* empty body = sync all */ }

  // 1. Load active scanner accounts
  const { data: accounts } = await supabase
    .from("wa_accounts")
    .select("id, green_api_id, green_api_token, green_api_url")
    .eq("is_active", true);

  if (!accounts?.length) return json({ processed: 0, message: "no active accounts" });

  const accountMap = new Map(accounts.map((a: WaAccount) => [a.id, a]));

  // 2. Load groups (optionally filtered)
  let query = supabase
    .from("groups")
    .select("id, wa_group_id, name, wa_account_id")
    .in("status", ["active", "paused"]);

  if (targetGroupIds) {
    query = query.in("id", targetGroupIds);
  }

  const { data: groups } = await query;
  if (!groups?.length) return json({ processed: 0, message: "no groups" });

  const now = new Date().toISOString();
  let groupsScanned = 0;
  let newMembers = 0;
  let leftMembers = 0;
  let adminsUpdated = 0;
  let namesUpdated = 0;
  const errors: string[] = [];

  for (const group of groups as GroupRow[]) {
    if (!group.wa_group_id || !group.wa_account_id) continue;

    // Get the right scanner credentials for this group
    const account = accountMap.get(group.wa_account_id);
    if (!account) {
      errors.push(`${group.name}: no account for ${group.wa_account_id}`);
      continue;
    }

    const chatId = group.wa_group_id.includes("@g.us")
      ? group.wa_group_id
      : `${group.wa_group_id}@g.us`;

    const url = `${account.green_api_url}/waInstance${account.green_api_id}/getGroupData/${account.green_api_token}`;

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupId: chatId }),
      });

      if (!res.ok) {
        errors.push(`${group.name}: HTTP ${res.status}`);
        continue;
      }

      const groupData: GroupDataResponse = await res.json();
      const apiParticipants = groupData.participants ?? [];

      if (apiParticipants.length === 0) {
        errors.push(`${group.name}: 0 participants`);
        continue;
      }

      groupsScanned++;

      // ── Update group name if changed ──
      if (groupData.groupName && groupData.groupName !== group.name) {
        await supabase.from("groups").update({ name: groupData.groupName }).eq("id", group.id);
        namesUpdated++;
      }

      const apiIds = new Set(apiParticipants.map((p) => p.id));
      const adminIds = new Set(apiParticipants.filter((p) => p.isAdmin).map((p) => p.id));

      // Get existing members
      const { data: existingMembers } = await supabase
        .from("group_members")
        .select("id, wa_sender_id, classification, manual_override, left_group_at")
        .eq("group_id", group.id);

      const existingMap = new Map(
        (existingMembers ?? []).map((m: { id: string; wa_sender_id: string; classification: string; manual_override: boolean; left_group_at: string | null }) => [m.wa_sender_id, m]),
      );

      // ── New / returning members ──
      for (const p of apiParticipants) {
        const existing = existingMap.get(p.id);

        if (!existing) {
          await supabase.from("group_members").insert({
            group_id: group.id,
            wa_sender_id: p.id,
            classification: p.isAdmin ? "admin" : "unknown",
            classified_at: p.isAdmin ? now : null,
            joined_group_at: now,
            total_messages: 0,
            lead_messages: 0,
            service_messages: 0,
            last_seen_at: now,
          });
          newMembers++;
        } else {
          const updates: Record<string, unknown> = { last_seen_at: now };

          if (existing.left_group_at) {
            updates.left_group_at = null;
            updates.joined_group_at = now;
          }

          if (!existing.manual_override && p.isAdmin && existing.classification !== "admin") {
            updates.classification = "admin";
            updates.classified_at = now;
            adminsUpdated++;
          }

          await supabase.from("group_members").update(updates).eq("id", existing.id);
        }
      }

      // ── Left members ──
      for (const [waId, member] of existingMap) {
        if (!apiIds.has(waId) && !member.left_group_at) {
          await supabase.from("group_members").update({ left_group_at: now }).eq("id", member.id);
          leftMembers++;
        }
      }

      // ── Update group counts ──
      await supabase.from("groups").update({
        total_members: apiParticipants.length,
        known_admins: adminIds.size,
        last_synced_at: now,
        sync_status: "synced",
      }).eq("id", group.id);

    } catch (err) {
      errors.push(`${group.name}: ${(err as Error).message}`);
    }

    // Rate limit: 500ms between groups
    await new Promise((r) => setTimeout(r, 500));
  }

  // Sync admin counts
  try { await supabase.rpc("sync_group_admin_counts"); } catch { /* optional */ }

  console.log(`[sync-group-members] Scanned: ${groupsScanned}, New: ${newMembers}, Left: ${leftMembers}, Names: ${namesUpdated}`);

  return json({
    groups_scanned: groupsScanned,
    new_members: newMembers,
    left_members: leftMembers,
    admins_updated: adminsUpdated,
    names_updated: namesUpdated,
    errors: errors.length > 0 ? errors : undefined,
  });
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
