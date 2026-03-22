import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS });
  }

  try {
    // Load Twilio secrets from DB
    const { data: secrets } = await supabase.rpc('get_twilio_secrets');
    if (!secrets?.TWILIO_ACCOUNT_SID || !secrets?.TWILIO_AUTH_TOKEN) {
      return new Response(JSON.stringify({ error: 'No Twilio secrets' }), {
        status: 500,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const SID = secrets.TWILIO_ACCOUNT_SID;
    const TOKEN = secrets.TWILIO_AUTH_TOKEN;
    const FROM = secrets.TWILIO_WA_FROM || 'whatsapp:+18623582898';
    const AUTH = 'Basic ' + btoa(`${SID}:${TOKEN}`);

    const body = await req.json().catch(() => ({}));
    const pageSize = body.pageSize || 100;

    // Fetch outgoing (from bot) and incoming (to bot) in parallel
    const baseUrl = `https://api.twilio.com/2010-04-01/Accounts/${SID}/Messages.json`;

    const [outRes, inRes] = await Promise.all([
      fetch(`${baseUrl}?From=${encodeURIComponent(FROM)}&PageSize=${pageSize}`, {
        headers: { Authorization: AUTH },
      }),
      fetch(`${baseUrl}?To=${encodeURIComponent(FROM)}&PageSize=${pageSize}`, {
        headers: { Authorization: AUTH },
      }),
    ]);

    const outData = await outRes.json();
    const inData = await inRes.json();

    // Merge and deduplicate by SID
    const allMessages = [
      ...(outData.messages || []),
      ...(inData.messages || []),
    ];

    const seen = new Set<string>();
    const unique = allMessages.filter((m: { sid: string }) => {
      if (seen.has(m.sid)) return false;
      seen.add(m.sid);
      return true;
    });

    // Sort by date descending
    unique.sort((a: { date_sent: string }, b: { date_sent: string }) =>
      new Date(b.date_sent).getTime() - new Date(a.date_sent).getTime()
    );

    return new Response(
      JSON.stringify({
        messages: unique.map((m: Record<string, unknown>) => ({
          sid: m.sid,
          from: m.from,
          to: m.to,
          body: m.body,
          date_sent: m.date_sent,
          direction: m.direction,
          status: m.status,
          num_media: m.num_media,
        })),
        total: unique.length,
        bot_number: FROM,
      }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('[warroom]', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
});
