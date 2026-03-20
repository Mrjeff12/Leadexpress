import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getCorsHeaders } from "../_shared/cors.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const WA_INVITE_RE = /^https:\/\/chat\.whatsapp\.com\/([A-Za-z0-9]{10,})$/;

Deno.serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    // ── Auth ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response("Unauthorized", { status: 401 });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response("Unauthorized", { status: 401 });
    }

    // ── Body ──
    const { invite_link } = await req.json();
    if (!invite_link || typeof invite_link !== "string") {
      return new Response(
        JSON.stringify({ error: "Missing invite_link" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── Validate format ──
    const trimmed = invite_link.trim();
    const match = trimmed.match(WA_INVITE_RE);
    if (!match) {
      return new Response(
        JSON.stringify({ error: "Invalid WhatsApp invite link. Expected format: https://chat.whatsapp.com/XXXXX" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const inviteCode = match[1];

    // ── Lookup active partner ──
    const { data: partner, error: partnerErr } = await supabase
      .from("community_partners")
      .select("id, status")
      .eq("user_id", user.id)
      .maybeSingle();

    if (partnerErr || !partner) {
      return new Response(
        JSON.stringify({ error: "Partner record not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (partner.status !== "active") {
      return new Response(
        JSON.stringify({ error: "Partner account is not active" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── Check if group already exists by wa_group_id (invite code) ──
    const { data: existingGroup } = await supabase
      .from("groups")
      .select("id, status")
      .eq("wa_group_id", inviteCode)
      .maybeSingle();

    let groupId: string;
    let responseStatus: "linked" | "pending";

    if (existingGroup) {
      // Group exists — link it
      groupId = existingGroup.id;
      responseStatus = existingGroup.status === "active" ? "linked" : "pending";
    } else {
      // Group doesn't exist — create a pending entry
      const { data: newGroup, error: insertGroupErr } = await supabase
        .from("groups")
        .insert({
          wa_group_id: inviteCode,
          name: `Pending: ${inviteCode.slice(0, 8)}...`,
          status: "paused",
          message_count: 0,
        })
        .select("id")
        .single();

      if (insertGroupErr) {
        console.error("[partner-link-group] Insert group error:", insertGroupErr);
        return new Response(
          JSON.stringify({ error: "Failed to create group entry" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      groupId = newGroup.id;
      responseStatus = "pending";
    }

    // ── Link partner to group (ON CONFLICT DO NOTHING) ──
    const { error: linkErr } = await supabase
      .from("partner_linked_groups")
      .upsert(
        { partner_id: partner.id, group_id: groupId },
        { onConflict: "partner_id,group_id", ignoreDuplicates: true },
      );

    if (linkErr) {
      console.error("[partner-link-group] Link error:", linkErr);
      return new Response(
        JSON.stringify({ error: "Failed to link group" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ success: true, group_id: groupId, status: responseStatus }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[partner-link-group] Error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
