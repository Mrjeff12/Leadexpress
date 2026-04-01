import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

interface TelegramJob {
  leadId: string;
  contractorId: string;
  telegramChatId: string;
  contractorName: string;
  message: string;
  profession?: string;
  urgency?: string;
}

async function sendTelegramMessage(chatId: string, html: string): Promise<boolean> {
  const res = await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: html,
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [[
          { text: "✅ Claim This Lead", callback_data: `claim:${Date.now()}` },
          { text: "❌ Pass", callback_data: `pass:${Date.now()}` },
        ]],
      },
    }),
  });
  return res.ok;
}

Deno.serve(async (req: Request) => {
  if (req.method === "GET") {
    return new Response(JSON.stringify({ status: "ok", service: "notify-telegram" }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const { data: jobs } = await supabase.rpc("claim_jobs", {
    p_queue: "notify_telegram", p_limit: 25,
  });

  if (!jobs?.length) {
    return new Response(JSON.stringify({ processed: 0 }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const results: string[] = [];

  for (const job of jobs) {
    const payload = job.payload as TelegramJob;
    try {
      const sent = await sendTelegramMessage(payload.telegramChatId, payload.message);
      if (sent) {
        await supabase.from("pipeline_events").insert({
          lead_id: payload.leadId, stage: "telegram_sent",
          detail: { contractorId: payload.contractorId },
        });
        await supabase.rpc("complete_job", { p_job_id: job.id });
        results.push(`sent:${payload.contractorId}`);
      } else {
        throw new Error("Telegram API returned non-ok");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "unknown";
      console.error(`[notify-telegram] Failed:`, msg);
      await supabase.rpc("fail_job", { p_job_id: job.id, p_error: msg });
      results.push(`error:${msg}`);
    }
  }

  return new Response(
    JSON.stringify({ processed: results.length, results }),
    { headers: { "Content-Type": "application/json" } },
  );
});
