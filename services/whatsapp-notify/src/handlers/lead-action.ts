import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Logger } from 'pino';
import { config } from '../config.js';
import { sendText } from '../interactive.js';

const supabase: SupabaseClient = createClient(config.supabase.url, config.supabase.serviceKey);

// ---------------------------------------------------------------------------
// Format lead notification for WhatsApp
// ---------------------------------------------------------------------------

const PROFESSION_EMOJI: Record<string, string> = {
  hvac: '❄️', renovation: '🔨', fencing: '🧱', cleaning: '✨',
  locksmith: '🔑', plumbing: '🚰', electrical: '⚡', other: '📋',
};

const URGENCY_LABEL: Record<string, string> = {
  hot: '🔥 ASAP',
  warm: '🟡 This week',
  cold: '🟢 Flexible',
};

interface LeadData {
  id: string;
  profession: string;
  city: string | null;
  zip_code: string | null;
  budget_range: string | null;
  urgency: string;
  parsed_summary: string;
  sender_id: string | null;
}

export function formatLeadMessage(lead: LeadData): string {
  const emoji = PROFESSION_EMOJI[lead.profession] ?? '📋';
  const profLabel = lead.profession.toUpperCase();
  const urgencyEmoji = lead.urgency === 'hot' ? '🔥' : lead.urgency === 'warm' ? '🟡' : '🟢';

  const lines: string[] = [
    `${urgencyEmoji} *NEW LEAD — ${profLabel}*`,
    '',
    `${emoji} _"${lead.parsed_summary}"_`,
  ];

  // Location (only if available)
  const location = [lead.city, lead.zip_code].filter(Boolean).join(', ');
  if (location) {
    lines.push('', `📍 ${location}`);
  }

  // Budget (only if available)
  if (lead.budget_range) {
    lines.push(`💰 ${lead.budget_range}`);
  }

  // Urgency
  const urgencyLabel = URGENCY_LABEL[lead.urgency] ?? '';
  if (urgencyLabel) {
    lines.push(`⏰ ${urgencyLabel}`);
  }

  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

// ---------------------------------------------------------------------------
// Build wa.me deep link for "Contact Now"
// ---------------------------------------------------------------------------

export function buildContactLink(lead: LeadData): string | null {
  if (!lead.sender_id) return null;

  // Extract phone from sender_id: "972544777297@c.us" → "972544777297"
  const phone = lead.sender_id.replace(/@.*$/, '');
  if (!phone || phone.length < 8) return null;

  const profession = lead.profession.replace(/_/g, ' ');
  const city = lead.city ?? 'your area';

  const message = encodeURIComponent(
    `Hi! I'm a licensed ${profession} contractor reaching out about your request in ${city}. I'm available and can help. When works for you?`,
  );

  return `https://wa.me/${phone}?text=${message}`;
}

// ---------------------------------------------------------------------------
// Handle claim/pass responses
// ---------------------------------------------------------------------------

export async function handleLeadClaim(
  phone: string,
  leadId: string,
  log: Logger,
): Promise<void> {
  // Find contractor
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('whatsapp_phone', phone)
    .maybeSingle();

  if (!profile) {
    log.warn({ phone }, 'Claim from unknown phone');
    return;
  }

  // Atomic claim: only if status = 'sent'
  const { data: lead, error } = await supabase
    .from('leads')
    .update({
      status: 'claimed',
      claimed_by: profile.id,
      claimed_at: new Date().toISOString(),
    })
    .eq('id', leadId)
    .eq('status', 'sent')
    .select('id, profession, city, sender_id, parsed_summary')
    .maybeSingle();

  if (error || !lead) {
    await sendText(phone, `This lead has already been claimed or is no longer available.`, log);
    return;
  }

  const contactLink = buildContactLink(lead as LeadData);

  if (contactLink) {
    await sendText(
      phone,
      `✅ Lead claimed! Good luck 🤞\n\n👉 Tap to contact: ${contactLink}\n\nReply *DONE* when finished or *PASS* if not interested.`,
      log,
    );
  } else {
    await sendText(
      phone,
      `✅ Lead claimed! Good luck 🤞\n\nReply *DONE* when finished or *PASS* if not interested.`,
      log,
    );
  }

  log.info({ leadId, contractorId: profile.id }, 'Lead claimed via WhatsApp');
}

export async function handleLeadPass(
  phone: string,
  leadId: string,
  log: Logger,
): Promise<void> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('whatsapp_phone', phone)
    .maybeSingle();

  if (!profile) return;

  // Log the pass
  await supabase.from('pipeline_events').insert({
    stage: 'lead_passed',
    detail: { lead_id: leadId, contractor_id: profile.id, channel: 'whatsapp' },
  });

  await sendText(phone, `OK, skipped. You'll get the next one! 👍`, log);
}
