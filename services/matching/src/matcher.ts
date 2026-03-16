import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Queue } from 'bullmq';
import type { Logger } from 'pino';
import { config } from './config.js';

export interface Lead {
  id: string;
  profession: string;
  zip_code: string;
  city: string | null;
  budget_range: string | null;
  urgency: 'hot' | 'warm' | 'cold';
  summary: string;
  source_name: string | null;
}

interface MatchedContractor {
  user_id: string;
  professions: string[];
  zip_codes: string[];
  wa_notify: boolean;
  available_today: boolean;
  wa_window_until: string | null;
  profiles: {
    telegram_chat_id: number | null;
    full_name: string;
    whatsapp_phone: string | null;
    subscriptions: Array<{
      status: string;
      plan_id: string;
    }>;
  };
}

const PROFESSION_EMOJI: Record<string, string> = {
  hvac: '❄️',
  air_duct: '🌬️',
  chimney: '🏠',
  dryer_vent: '🌀',
  garage_door: '🚗',
  locksmith: '🔑',
  roofing: '🏗️',
  plumbing: '🚰',
  electrical: '⚡',
  painting: '🎨',
  cleaning: '✨',
  carpet_cleaning: '🧹',
  renovation: '🔨',
  fencing: '🧱',
  landscaping: '🌿',
  tiling: '🔲',
  kitchen: '🍳',
  bathroom: '🚿',
  pool: '🏊',
  moving: '📦',
  other: '📋',
};

const supabase: SupabaseClient = createClient(
  config.supabase.url,
  config.supabase.serviceKey,
);

export async function matchLead(
  lead: Lead,
  notificationQueue: Queue,
  log: Logger,
  waNotificationQueue?: Queue,
): Promise<number> {
  const start = performance.now();

  // Find all matching contractors:
  // - active contractor record
  // - active subscription
  // - has telegram OR whatsapp configured
  // - matching profession AND zip_code
  // Join path: contractors → profiles → subscriptions
  // (no direct FK between contractors and subscriptions)
  const { data: matches, error } = await supabase
    .from('contractors')
    .select(`
      user_id,
      professions,
      zip_codes,
      wa_notify,
      available_today,
      wa_window_until,
      profiles!inner(
        telegram_chat_id,
        full_name,
        whatsapp_phone,
        subscriptions!inner(status, plan_id)
      )
    `)
    .eq('is_active', true)
    .eq('profiles.subscriptions.status', 'active')
    .contains('professions', [lead.profession])
    .contains('zip_codes', [lead.zip_code]);

  if (error) {
    throw new Error(`Supabase query failed: ${error.message}`);
  }

  // Filter: must have at least one notification channel
  const contractors = ((matches ?? []) as unknown as MatchedContractor[]).filter(
    (c) => c.profiles.telegram_chat_id || c.profiles.whatsapp_phone,
  );

  if (contractors.length === 0) {
    log.info(
      { leadId: lead.id, profession: lead.profession, zip: lead.zip_code },
      'No matching contractors found',
    );
    await updateLeadStatus(lead.id, 'new', 0);
    return 0;
  }

  // Cap the number of contractors
  const capped = contractors.slice(0, config.matching.maxContractorsPerLead);

  const telegramMessage = formatTelegramMessage(lead);
  const whatsappMessage = formatWhatsAppMessage(lead);

  const telegramJobs: Array<{ name: string; data: Record<string, unknown>; opts: Record<string, unknown> }> = [];
  const waJobs: Array<{ name: string; data: Record<string, unknown>; opts: Record<string, unknown> }> = [];

  for (const contractor of capped) {
    const hasWaWindow =
      contractor.wa_notify &&
      contractor.available_today &&
      contractor.wa_window_until &&
      new Date(contractor.wa_window_until) > new Date() &&
      contractor.profiles.whatsapp_phone;

    if (hasWaWindow) {
      // Route to WhatsApp (free — within 24h window)
      waJobs.push({
        name: 'send-wa-notification',
        data: {
          leadId: lead.id,
          contractorId: contractor.user_id,
          whatsappPhone: contractor.profiles.whatsapp_phone,
          contractorName: contractor.profiles.full_name,
          message: whatsappMessage,
        },
        opts: {
          jobId: `wa-notif-${lead.id}-${contractor.user_id}`,
          attempts: 3,
          backoff: { type: 'exponential' as const, delay: 2000 },
        },
      });
    } else if (contractor.profiles.telegram_chat_id) {
      // Fallback to Telegram (always free)
      telegramJobs.push({
        name: 'send-notification',
        data: {
          leadId: lead.id,
          contractorId: contractor.user_id,
          telegramChatId: contractor.profiles.telegram_chat_id,
          contractorName: contractor.profiles.full_name,
          message: telegramMessage,
          profession: lead.profession,
          urgency: lead.urgency,
        },
        opts: {
          jobId: `notif-${lead.id}-${contractor.user_id}`,
          attempts: 3,
          backoff: { type: 'exponential' as const, delay: 2000 },
        },
      });
    }
  }

  // Enqueue to both queues
  if (telegramJobs.length > 0) {
    await notificationQueue.addBulk(telegramJobs);
  }
  if (waJobs.length > 0 && waNotificationQueue) {
    await waNotificationQueue.addBulk(waJobs);
  }

  const totalSent = telegramJobs.length + waJobs.length;
  await updateLeadStatus(lead.id, 'sent', totalSent);

  const durationMs = Math.round(performance.now() - start);
  log.info(
    {
      leadId: lead.id,
      profession: lead.profession,
      zip: lead.zip_code,
      totalMatches: contractors.length,
      sentTelegram: telegramJobs.length,
      sentWhatsApp: waJobs.length,
      sentTotal: totalSent,
      durationMs,
    },
    'Lead matched and notifications enqueued',
  );

  return totalSent;
}

async function updateLeadStatus(
  leadId: string,
  status: string,
  sentToCount: number,
): Promise<void> {
  const { error } = await supabase
    .from('leads')
    .update({ status, sent_to_count: sentToCount })
    .eq('id', leadId);

  if (error) {
    throw new Error(`Failed to update lead status: ${error.message}`);
  }
}

function formatWhatsAppMessage(lead: Lead): string {
  const emoji = PROFESSION_EMOJI[lead.profession] ?? '📋';
  const professionLabel = lead.profession.toUpperCase();
  const location = [lead.city, lead.zip_code].filter(Boolean).join(', ');

  const budgetLine = lead.budget_range ? `\n💰 Budget: ${lead.budget_range}` : '';

  const urgencyMap: Record<string, string> = {
    hot: '🔥 ASAP — Today/Tomorrow',
    warm: '⚡ This Week',
    cold: '❄️ Flexible',
  };
  const urgencyLine = urgencyMap[lead.urgency] ?? '';

  const sourceLine = lead.source_name ? `\n📍 Source: ${lead.source_name}` : '';

  return [
    `🔥 *NEW LEAD — ${professionLabel}*`,
    '',
    `${emoji} _"${lead.summary}"_`,
    '',
    `📍 *Location:* ${location}`,
    budgetLine,
    `⏰ *Urgency:* ${urgencyLine}`,
    sourceLine,
  ]
    .filter((line) => line !== undefined)
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function formatTelegramMessage(lead: Lead): string {
  const emoji = PROFESSION_EMOJI[lead.profession] ?? '📋';
  const professionLabel = lead.profession.toUpperCase();
  const location = [lead.city, lead.zip_code].filter(Boolean).join(', ');

  const budgetLine = lead.budget_range
    ? `\n💰 Budget: ${lead.budget_range}`
    : '';

  const urgencyMap: Record<string, string> = {
    hot: '🔥 ASAP — Today/Tomorrow',
    warm: '⚡ This Week',
    cold: '❄️ Flexible',
  };
  const urgencyLine = urgencyMap[lead.urgency] ?? '';

  const sourceLine = lead.source_name
    ? `\n📍 Source: ${lead.source_name}`
    : '';

  return [
    `🔥 <b>NEW LEAD — ${professionLabel}</b>`,
    '',
    `${emoji} <i>"${lead.summary}"</i>`,
    '',
    `📍 <b>Location:</b> ${location}`,
    budgetLine,
    `⏰ <b>Urgency:</b> ${urgencyLine}`,
    sourceLine,
  ]
    .filter((line) => line !== undefined)
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
