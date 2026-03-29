import { supabase } from '../lib/supabase.js';
import { sendText } from '../lib/twilio.js';
import pino from 'pino';

const log = pino({ name: 'lead-action' });

function buildContactLink(senderId: string | null, profession: string, city: string | null): string | null {
  if (!senderId) return null;
  const phone = senderId.replace(/@.*$/, '');
  if (!phone || phone.length < 8) return null;
  const msg = encodeURIComponent(
    `Hi! I'm a ${profession} contractor reaching out about your request${city ? ` in ${city}` : ''}. I'm available — when works for you?`,
  );
  return `https://wa.me/${phone}?text=${msg}`;
}

export async function handleLeadClaim(phone: string, leadId: string): Promise<void> {
  const { data: lead } = await supabase
    .from('leads')
    .select('id, profession, city, sender_id, parsed_summary')
    .eq('id', leadId)
    .maybeSingle();

  if (!lead) {
    await sendText(phone, 'This lead is no longer available.');
    return;
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('whatsapp_phone', phone)
    .maybeSingle();

  if (profile) {
    supabase.from('pipeline_events').insert({
      stage: 'lead_claimed',
      lead_id: leadId,
      detail: { contractor_id: profile.id, channel: 'whatsapp' },
    }).then(() => {});
  }

  const typedLead = lead as { sender_id?: string; profession?: string; city?: string };
  const link = buildContactLink(typedLead.sender_id ?? null, typedLead.profession ?? '', typedLead.city ?? null);
  const msg = link
    ? `✅ Great! Here's the contact:\n\n👉 ${link}\n\nGood luck! 🤞`
    : `✅ Lead claimed! Good luck 🤞`;

  await sendText(phone, msg);
  log.info({ leadId, phone }, 'Lead claim handled');
}

export async function handleLeadPass(phone: string, leadId: string): Promise<void> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('whatsapp_phone', phone)
    .maybeSingle();

  if (profile) {
    await supabase.from('pipeline_events').insert({
      stage: 'lead_passed',
      detail: { lead_id: leadId, contractor_id: profile.id },
    });
  }
  await sendText(phone, 'OK, skipped. Next one coming! 👍');
}
