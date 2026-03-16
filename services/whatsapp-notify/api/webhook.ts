import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
);

const POSITIVE_WORDS = [
  'כן', 'yes', 'yeah', 'yep', 'y', 'ok', 'אוקי',
  'זמין', 'available', 'sure', 'בטח', 'כמובן',
  '1', '👍', 'yea', 'ya', 'ken', 'betach',
];

function isPositiveResponse(text: string): boolean {
  return POSITIVE_WORDS.some((word) => text.includes(word));
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Health check
  if (req.method === 'GET') {
    return res.status(200).json({ status: 'ok', service: 'whatsapp-notify-webhook' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Twilio sends application/x-www-form-urlencoded
  const { From, Body, MessageSid } = req.body ?? {};
  const phone = (From ?? '').replace('whatsapp:', '');
  const text = (Body ?? '').trim().toLowerCase();

  console.log(`[webhook] Received: phone=${phone}, text=${text}, sid=${MessageSid}`);

  if (phone && isPositiveResponse(text)) {
    // Find contractor by WhatsApp phone
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('whatsapp_phone', phone)
      .single();

    if (profile) {
      const windowUntil = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      await supabase
        .from('contractors')
        .update({ available_today: true, wa_window_until: windowUntil })
        .eq('user_id', profile.id);

      console.log(`[webhook] Contractor ${profile.id} marked available until ${windowUntil}`);
    } else {
      console.log(`[webhook] No contractor found for phone ${phone}`);
    }
  }

  // Twilio expects TwiML response
  res.setHeader('Content-Type', 'text/xml');
  return res.status(200).send('<Response></Response>');
}
