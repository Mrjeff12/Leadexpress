import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getCorsHeaders } from "../_shared/cors.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const GREEN_API_URL = Deno.env.get("GREEN_API_URL") || "https://api.green-api.com";
const GREEN_API_ID = Deno.env.get("GREEN_API_ID");
const GREEN_API_TOKEN = Deno.env.get("GREEN_API_TOKEN");

function greenUrl(method: string): string {
  return `${GREEN_API_URL}/waInstance${GREEN_API_ID}/${method}/${GREEN_API_TOKEN}`;
}

Deno.serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // ── Auth: require admin JWT ──
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Missing or invalid Authorization header' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const jwt = authHeader.replace('Bearer ', '');
  const { data: { user: caller }, error: authErr } = await supabase.auth.getUser(jwt);
  if (authErr || !caller) {
    return new Response(JSON.stringify({ error: 'Invalid token' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const { data: callerProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', caller.id)
    .single();
  if (!callerProfile || callerProfile.role !== 'admin') {
    return new Response(JSON.stringify({ error: 'Admin access required' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (!GREEN_API_ID || !GREEN_API_TOKEN) {
    return new Response(
      JSON.stringify({ error: "Green API credentials not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  try {
    const { data: groups, error: groupErr } = await supabase
      .from("groups")
      .select("id, wa_group_id, name")
      .in("status", ["active", "paused"]);

    if (groupErr || !groups) {
      return new Response(
        JSON.stringify({ error: "Failed to fetch groups", detail: groupErr?.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const now = new Date().toISOString();
    let groupsScanned = 0;
    let newMembers = 0;
    let leftMembers = 0;
    let adminsUpdated = 0;
    const errors: string[] = [];

    for (const group of groups) {
      if (!group.wa_group_id) continue;

      const chatId = group.wa_group_id.includes("@g.us")
        ? group.wa_group_id
        : `${group.wa_group_id}@g.us`;

      try {
        const res = await fetch(greenUrl("getGroupData"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ groupId: chatId }),
        });

        if (!res.ok) {
          errors.push(`${group.name}: HTTP ${res.status}`);
          continue;
        }

        const groupData = await res.json() as {
          participants?: Array<{ id: string; isAdmin?: boolean }>;
        };

        const apiParticipants = groupData.participants ?? [];
        if (apiParticipants.length === 0) {
          errors.push(`${group.name}: 0 participants returned`);
          continue;
        }

        groupsScanned++;
        const apiIds = new Set(apiParticipants.map((p) => p.id));
        const adminIds = new Set(apiParticipants.filter((p) => p.isAdmin).map((p) => p.id));

        // Get existing members from DB
        const { data: existingMembers } = await supabase
          .from("group_members")
          .select("id, wa_sender_id, classification, manual_override, left_group_at")
          .eq("group_id", group.id);

        const existingMap = new Map(
          (existingMembers ?? []).map((m) => [m.wa_sender_id, m]),
        );

        // --- New members: in API but not in DB ---
        for (const p of apiParticipants) {
          const existing = existingMap.get(p.id);

          if (!existing) {
            // Brand new member
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
            // Existing member — update last_seen, clear left_group_at if they came back
            const updates: Record<string, unknown> = { last_seen_at: now };

            if (existing.left_group_at) {
              // Member returned to group
              updates.left_group_at = null;
              updates.joined_group_at = now;
            }

            // Update admin status if not manually overridden
            if (!existing.manual_override && p.isAdmin && existing.classification !== "admin") {
              updates.classification = "admin";
              updates.classified_at = now;
              adminsUpdated++;
            }

            await supabase
              .from("group_members")
              .update(updates)
              .eq("id", existing.id);
          }
        }

        // --- Left members: in DB but not in API ---
        for (const [waId, member] of existingMap) {
          if (!apiIds.has(waId) && !member.left_group_at) {
            await supabase
              .from("group_members")
              .update({ left_group_at: now })
              .eq("id", member.id);
            leftMembers++;
          }
        }

        // Update group counts
        const activeCount = apiParticipants.length;
        const adminCount = adminIds.size;
        await supabase
          .from("groups")
          .update({
            total_members: activeCount,
            known_admins: adminCount,
          })
          .eq("id", group.id);

      } catch (err) {
        errors.push(`${group.name}: ${(err as Error).message}`);
      }

      await new Promise((r) => setTimeout(r, 500));
    }

    // Sync admin counts
    await supabase.rpc("sync_group_admin_counts");

    return new Response(
      JSON.stringify({
        success: true,
        groups_scanned: groupsScanned,
        new_members: newMembers,
        left_members: leftMembers,
        admins_updated: adminsUpdated,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[sync-group-members]", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
