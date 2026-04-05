import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

/**
 * sync-groups: Auto-discovers new WhatsApp groups from connected scanners
 * and adds them to the DB. Also updates connection status for existing groups.
 *
 * Runs on a cron schedule (e.g. every 6 hours).
 * Flow:
 *   1. Load all active wa_accounts
 *   2. For each account, call Green API getChats to get group list
 *   3. Compare against groups table
 *   4. Insert new groups, update status of existing ones
 */

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

interface WaAccount {
  id: string;
  label: string;
  green_api_id: string;
  green_api_token: string;
  green_api_url: string;
  status: string;
}

interface GreenChat {
  id: string;
  name: string;
  archive: boolean;
}

Deno.serve(async (req: Request) => {
  if (req.method === "GET") {
    return new Response(JSON.stringify({ status: "ok", service: "sync-groups" }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // 1. Load active scanner accounts
  const { data: accounts } = await supabase
    .from("wa_accounts")
    .select("id, label, green_api_id, green_api_token, green_api_url, status")
    .eq("is_active", true);

  if (!accounts?.length) {
    return json({ processed: 0, message: "no active accounts" });
  }

  // 2. Load all existing groups from DB
  const { data: existingGroups } = await supabase
    .from("groups")
    .select("wa_group_id, wa_account_id, status");

  const existingIds = new Set((existingGroups ?? []).map((g: { wa_group_id: string }) => g.wa_group_id));

  const results: string[] = [];
  const newGroupDbIds: string[] = [];
  let added = 0;
  let updated = 0;

  for (const account of accounts) {
    // Skip disconnected accounts
    const stateUrl = `${account.green_api_url}/waInstance${account.green_api_id}/getStateInstance/${account.green_api_token}`;
    try {
      const stateRes = await fetch(stateUrl);
      const stateData = await stateRes.json();

      if (stateData.stateInstance !== "authorized") {
        if (account.status !== "disconnected") {
          await supabase.from("wa_accounts").update({ status: "disconnected" }).eq("id", account.id);
          // Alert admin about scanner disconnect
          await supabase.from("system_alerts").insert({
            type: "scanner_disconnected",
            severity: "critical",
            title: `Scanner ${account.label} disconnected`,
            message: `WhatsApp scanner "${account.label}" lost connection. Groups monitored by this scanner will not receive leads until reconnected.`,
          }).then(() => {}, () => {}); // ignore if table doesn't exist
        }
        results.push(`${account.label}: disconnected — skipped`);
        continue;
      }

      // Scanner reconnected — alert + trigger member sync
      if (account.status === "disconnected") {
        await supabase.from("wa_accounts").update({ status: "connected" }).eq("id", account.id);
        await supabase.from("system_alerts").insert({
          type: "scanner_reconnected",
          severity: "info",
          title: `Scanner ${account.label} back online`,
          message: `WhatsApp scanner "${account.label}" reconnected successfully. Resuming group monitoring.`,
        }).then(() => {}, () => {});
        // Trigger immediate member sync for this scanner's groups
        const { data: scannerGroups } = await supabase
          .from("groups").select("id").eq("wa_account_id", account.id).eq("status", "active");
        if (scannerGroups?.length) {
          try {
            await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/sync-group-members`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
              },
              body: JSON.stringify({ groupIds: scannerGroups.map((g: { id: string }) => g.id) }),
            });
          } catch { /* best effort */ }
        }
      } else if (account.status !== "connected") {
        await supabase.from("wa_accounts").update({ status: "connected" }).eq("id", account.id);
      }
    } catch (err) {
      results.push(`${account.label}: API error — ${err instanceof Error ? err.message : "unknown"}`);
      continue;
    }

    // 3. Fetch group list from Green API
    const chatsUrl = `${account.green_api_url}/waInstance${account.green_api_id}/getChats/${account.green_api_token}`;
    let groups: GreenChat[] = [];
    try {
      const chatsRes = await fetch(chatsUrl);
      const chats: GreenChat[] = await chatsRes.json();
      groups = chats.filter((c) => c.id.endsWith("@g.us") && !c.archive);
    } catch (err) {
      results.push(`${account.label}: getChats failed — ${err instanceof Error ? err.message : "unknown"}`);
      continue;
    }

    // 4. Find new groups not in DB
    const liveGroupIds = new Set(groups.map((g) => g.id));

    for (const group of groups) {
      if (!existingIds.has(group.id)) {
        // New group — insert
        const { error } = await supabase.from("groups").insert({
          wa_group_id: group.id,
          name: group.name || "Unknown Group",
          status: "active",
          wa_account_id: account.id,
        });

        if (!error) {
          added++;
          // Get the inserted group's DB id for member sync
          const { data: inserted } = await supabase.from("groups")
            .select("id").eq("wa_group_id", group.id).maybeSingle();
          if (inserted) newGroupDbIds.push(inserted.id);
          results.push(`NEW: ${group.name} (${group.id})`);
        } else if (error.code === "23505") {
          // Duplicate — already exists (race condition)
          results.push(`DUP: ${group.name}`);
        } else {
          results.push(`ERR: ${group.name} — ${error.message}`);
        }
      }
    }

    // 5. Update existing groups connected to this account:
    //    - Mark groups that are in the live list as connected
    //    - Mark groups NOT in the live list as offline (scanner left/removed)
    for (const existing of existingGroups ?? []) {
      if (existing.wa_account_id !== account.id) continue;

      const isLive = liveGroupIds.has(existing.wa_group_id);
      const currentStatus = existing.status;

      if (isLive && currentStatus !== "active") {
        await supabase.from("groups").update({ status: "active" }).eq("wa_group_id", existing.wa_group_id);
        updated++;
      } else if (!isLive && currentStatus === "active") {
        // Scanner is no longer in this group — mark inactive
        await supabase.from("groups").update({ status: "inactive" }).eq("wa_group_id", existing.wa_group_id);
        updated++;
      }
    }

    results.push(`${account.label}: ${groups.length} groups found`);
  }

  // 6. Chain: sync members for newly discovered groups
  if (newGroupDbIds.length > 0) {
    try {
      const syncUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/sync-group-members`;
      await fetch(syncUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({ groupIds: newGroupDbIds }),
      });
      results.push(`Chained member sync for ${newGroupDbIds.length} new groups`);
    } catch (err) {
      results.push(`Chain sync failed: ${err instanceof Error ? err.message : "unknown"}`);
    }
  }

  // 7. Log summary
  console.log(`[sync-groups] Added: ${added}, Updated: ${updated}, Accounts: ${accounts.length}`);

  return json({ added, updated, accounts: accounts.length, results });
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
