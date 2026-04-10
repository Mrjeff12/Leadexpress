import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getCorsHeaders } from "../_shared/cors.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

interface WaAccount {
  id: string;
  green_api_url: string;
  green_api_id: string;
  green_api_token: string;
  phone_number: string;
}

// ── Send WhatsApp DM via Green API ─────────────────────────
async function sendWhatsAppDM(
  account: WaAccount,
  phone: string,
  message: string,
): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  // Normalize phone to Green API format: 1234567890@c.us
  const cleaned = phone.replace(/[\s\-\+\(\)]/g, "");
  const chatId = cleaned.includes("@") ? cleaned : `${cleaned}@c.us`;

  const url = `${account.green_api_url}/waInstance${account.green_api_id}/sendMessage/${account.green_api_token}`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatId, message }),
    });
    const data = await res.json();
    if (data.idMessage) {
      return { ok: true, messageId: data.idMessage };
    }
    return { ok: false, error: JSON.stringify(data) };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

// ── Main handler ───────────────────────────────────────────
Deno.serve(async (req: Request) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  if (req.method === "GET") {
    return new Response(JSON.stringify({ status: "ok", service: "send-dm" }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const { campaign_id, limit: batchLimit } = body;

    if (!campaign_id) {
      return jsonRes({ error: "Missing campaign_id" }, 400, cors);
    }

    // Fetch campaign
    const { data: campaign, error: cErr } = await supabase
      .from("dm_campaigns")
      .select("*")
      .eq("id", campaign_id)
      .single();

    if (cErr || !campaign) {
      return jsonRes({ error: "Campaign not found" }, 404, cors);
    }

    if (campaign.status !== "active") {
      return jsonRes({ error: "Campaign not active" }, 400, cors);
    }

    // Get queued outreach items, grouped by wa_account_id, respecting daily limit
    const dailyLimit = campaign.daily_limit || 30;
    const maxBatch = Math.min(batchLimit || 50, 100);

    // Check how many were sent today per account
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);

    const { data: todayCounts } = await supabase
      .from("dm_outreach")
      .select("wa_account_id")
      .eq("campaign_id", campaign_id)
      .gte("sent_at", todayStart.toISOString())
      .not("sent_at", "is", null);

    const sentToday: Record<string, number> = {};
    for (const row of todayCounts ?? []) {
      sentToday[row.wa_account_id] = (sentToday[row.wa_account_id] || 0) + 1;
    }

    // Fetch queued items
    const { data: queued, error: qErr } = await supabase
      .from("dm_outreach")
      .select(`
        id, prospect_id, wa_account_id, message_text,
        prospects!inner(phone, display_name)
      `)
      .eq("campaign_id", campaign_id)
      .eq("status", "queued")
      .order("created_at")
      .limit(maxBatch);

    if (qErr || !queued?.length) {
      return jsonRes({ sent: 0, message: "No queued messages" }, 200, cors);
    }

    // Load wa_accounts
    const accountIds = [...new Set(queued.map((q) => q.wa_account_id))];
    const { data: accounts } = await supabase
      .from("wa_accounts")
      .select("id, green_api_url, green_api_id, green_api_token, phone_number")
      .in("id", accountIds)
      .eq("is_active", true)
      .eq("status", "connected");

    const accountMap = new Map<string, WaAccount>();
    for (const a of accounts ?? []) {
      accountMap.set(a.id, a as WaAccount);
    }

    let sentCount = 0;
    let skipped = 0;
    let failed = 0;

    for (const item of queued) {
      const account = accountMap.get(item.wa_account_id);
      if (!account) {
        skipped++;
        continue;
      }

      // Check daily limit for this account
      const todayCount = sentToday[item.wa_account_id] || 0;
      if (todayCount >= dailyLimit) {
        skipped++;
        continue;
      }

      const prospect = item.prospects as unknown as { phone: string; display_name: string };
      if (!prospect?.phone) {
        await supabase
          .from("dm_outreach")
          .update({ status: "failed" })
          .eq("id", item.id);
        failed++;
        continue;
      }

      // Send the DM
      const result = await sendWhatsAppDM(account, prospect.phone, item.message_text);

      if (result.ok) {
        const followUpAt = campaign.follow_up_hours
          ? new Date(Date.now() + campaign.follow_up_hours * 3600000).toISOString()
          : null;

        await supabase
          .from("dm_outreach")
          .update({
            status: "sent",
            sent_at: new Date().toISOString(),
            next_follow_up_at: followUpAt,
          })
          .eq("id", item.id);

        // Log in army_dms for inbox visibility
        await supabase.from("army_dms").insert({
          wa_account_id: account.id,
          sender_phone: account.phone_number,
          sender_name: "Army DM",
          direction: "outbound",
          content: item.message_text,
        });

        sentToday[item.wa_account_id] = (sentToday[item.wa_account_id] || 0) + 1;
        sentCount++;
      } else {
        console.error(`[send-dm] Failed for ${prospect.phone}:`, result.error);
        const isBlocked = result.error?.includes("blocked") || result.error?.includes("banned");
        await supabase
          .from("dm_outreach")
          .update({ status: isBlocked ? "blocked" : "failed" })
          .eq("id", item.id);
        failed++;
      }

      // Throttle: 3-6 second random delay between messages
      const delay = 3000 + Math.random() * 3000;
      await new Promise((r) => setTimeout(r, delay));
    }

    // Update campaign counters
    await supabase.rpc("update_dm_campaign_stats", { p_campaign_id: campaign_id });

    return jsonRes({ sent: sentCount, skipped, failed }, 200, cors);
  } catch (err) {
    console.error("[send-dm] Error:", err);
    return jsonRes({ error: (err as Error).message }, 500, cors);
  }
});

function jsonRes(data: unknown, status: number, cors: Record<string, string>): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}
