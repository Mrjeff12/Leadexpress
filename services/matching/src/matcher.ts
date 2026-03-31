import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Queue } from 'bullmq';
import type { Logger } from 'pino';
import { config } from './config.js';

export interface Lead {
  id: string;
  profession: string;
  zip_code: string | null;
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
  sms_opt_out: boolean;
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

/** Fisher-Yates shuffle -- ensures fair rotation across matching contractors */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
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

/**
 * 4-tier notification cascade:
 *   Tier 1: WhatsApp free-form (open 24h window)
 *   Tier 2: WhatsApp Content Template (closed window — bypasses 24h rule)
 *   Tier 3: Web Push (existing push-worker)
 *   Tier 4: SMS via Twilio (US numbers only, last resort)
 *   Push is ALSO sent additively alongside any primary tier.
 */
export async function matchLead(
  lead: Lead,
  notificationQueue: Queue,
  log: Logger,
  waNotificationQueue?: Queue,
  pushNotificationQueue?: Queue,
  waTemplateQueue?: Queue,
  smsQueue?: Queue,
): Promise<number> {
  const start = performance.now();

  let query = supabase
    .from('contractors')
    .select(`
      user_id,
      professions,
      zip_codes,
      wa_notify,
      available_today,
      wa_window_until,
      sms_opt_out,
      profiles!inner(
        telegram_chat_id,
        full_name,
        whatsapp_phone,
        subscriptions!inner(status, plan_id)
      )
    `)
    .eq('is_active', true)
    .eq('profiles.status', 'active')
    .in('profiles.subscriptions.status', ['active', 'trialing'])
    .contains('professions', [lead.profession]);

  if (lead.zip_code) {
    query = query.contains('zip_codes', [lead.zip_code]);
  } else {
    log.warn(
      { leadId: lead.id, profession: lead.profession },
      'Lead has no zip_code — skipping matching',
    );
    await updateLeadStatus(lead.id, 'new', 0, []);
    return 0;
  }

  const { data: matches, error } = await query;

  if (error) {
    throw new Error(`Supabase query failed: ${error.message}`);
  }

  const allContractors = (matches ?? []) as unknown as MatchedContractor[];

  // Fetch push subscriptions BEFORE filtering — contractors with only push should not be excluded
  const allContractorIds = allContractors.map((c) => c.user_id);
  const { data: pushSubs } = allContractorIds.length > 0
    ? await supabase.from('push_subscriptions').select('user_id').in('user_id', allContractorIds)
    : { data: [] };
  const contractorsWithPush = new Set((pushSubs ?? []).map((s: { user_id: string }) => s.user_id));

  // Filter: must have at least one notification channel (WA, Telegram, OR Push)
  const contractors = allContractors.filter(
    (c) => c.profiles.whatsapp_phone || c.profiles.telegram_chat_id || contractorsWithPush.has(c.user_id),
  );

  if (contractors.length === 0) {
    log.info(
      { leadId: lead.id, profession: lead.profession, zip: lead.zip_code },
      'No matching contractors found',
    );
    await updateLeadStatus(lead.id, 'new', 0, []);
    return 0;
  }

  const capped = shuffle(contractors).slice(0, config.matching.maxContractorsPerLead);
  const contractorIds = capped.map((c) => c.user_id);

  // Batch-load reconnect throttle state (1h window — reduced from 12h to avoid missing leads)
  const oneHourAgo = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString();
  const twelveHoursAgo = oneHourAgo; // alias for backward compat
  const { data: throttleRows } = await supabase
    .from('reconnect_throttle')
    .select('contractor_id, channel')
    .in('contractor_id', contractorIds)
    .gt('sent_at', twelveHoursAgo);

  const throttled = new Map<string, Set<string>>();
  for (const row of throttleRows ?? []) {
    if (!throttled.has(row.contractor_id)) throttled.set(row.contractor_id, new Set());
    throttled.get(row.contractor_id)!.add(row.channel);
  }

  const isThrottled = (cId: string, channel: string) => throttled.get(cId)?.has(channel) ?? false;

  const whatsappMessage = formatWhatsAppMessage(lead);
  const telegramMessage = formatTelegramMessage(lead);

  type BulkJob = { name: string; data: Record<string, unknown>; opts: Record<string, unknown> };
  const waJobs: BulkJob[] = [];
  const waTemplateJobs: BulkJob[] = [];
  const telegramJobs: BulkJob[] = [];
  const pushJobs: BulkJob[] = [];
  const smsJobs: BulkJob[] = [];

  const notificationRows: Array<{ lead_id: string; contractor_id: string; channel: string; delivery_status: string; cascade_position: number }> = [];

  let tier1 = 0, tier2 = 0, tier3 = 0, tier4 = 0, unreachable = 0;

  for (const contractor of capped) {
    let primaryChannel: string | null = null;
    let cascadePos = 0;

    // ── Tier 1: WhatsApp free-form (open 24h window) ──
    const hasWaWindow =
      contractor.wa_notify &&
      contractor.available_today &&
      contractor.wa_window_until &&
      new Date(contractor.wa_window_until) > new Date() &&
      contractor.profiles.whatsapp_phone;

    if (hasWaWindow) {
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
      primaryChannel = 'whatsapp';
      cascadePos = 1;
      tier1++;
    }

    // ── Tier 2: WhatsApp Content Template (closed window) ──
    if (!primaryChannel && contractor.profiles.whatsapp_phone && !isThrottled(contractor.user_id, 'whatsapp_template')) {
      waTemplateJobs.push({
        name: 'send-wa-template',
        data: {
          leadId: lead.id,
          contractorId: contractor.user_id,
          whatsappPhone: contractor.profiles.whatsapp_phone,
          contractorName: contractor.profiles.full_name,
          profession: lead.profession,
          city: lead.city,
          summary: lead.summary,
          urgency: lead.urgency,
        },
        opts: {
          jobId: `wa-tpl-${lead.id}-${contractor.user_id}`,
          attempts: 3,
          backoff: { type: 'exponential' as const, delay: 2000 },
        },
      });
      primaryChannel = 'whatsapp_template';
      cascadePos = 2;
      tier2++;
    }

    // ── Tier 2b: Telegram (if configured — fallback before push) ──
    if (!primaryChannel && contractor.profiles.telegram_chat_id) {
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
      primaryChannel = 'telegram';
      cascadePos = 2;
    }

    // ── Tier 3: Web Push as primary (if no other channel worked) ──
    if (!primaryChannel && contractorsWithPush.has(contractor.user_id)) {
      const professionLabel = lead.profession.replace(/_/g, ' ').toUpperCase();
      const location = [lead.city, lead.zip_code].filter(Boolean).join(', ');
      pushJobs.push({
        name: 'send-push-notification',
        data: {
          leadId: lead.id,
          contractorId: contractor.user_id,
          title: `🔥 New ${professionLabel} Lead`,
          body: `${location} — ${lead.urgency === 'hot' ? 'ASAP' : lead.urgency === 'warm' ? 'This Week' : 'Flexible'}`,
          url: '/leads',
        },
        opts: {
          jobId: `push-notif-${lead.id}-${contractor.user_id}`,
          attempts: 2,
          backoff: { type: 'exponential' as const, delay: 1000 },
        },
      });
      primaryChannel = 'push';
      cascadePos = 3;
      tier3++;
    }

    // ── Tier 4: SMS — DISABLED until business verification is complete ──
    // if (
    //   !primaryChannel &&
    //   contractor.profiles.whatsapp_phone?.startsWith('+1') &&
    //   !contractor.sms_opt_out &&
    //   !isThrottled(contractor.user_id, 'sms')
    // ) { ... }

    // ── Push ALWAYS (sent for every contractor that has push, regardless of primary) ──
    if (contractorsWithPush.has(contractor.user_id)) {
      const professionLabel = lead.profession.replace(/_/g, ' ').toUpperCase();
      const location = [lead.city, lead.zip_code].filter(Boolean).join(', ');

      // Piggyback window nudge: if WA window closes within 4h, add nudge to push body
      const windowClosingSoon = contractor.wa_window_until
        && new Date(contractor.wa_window_until) > new Date()
        && new Date(contractor.wa_window_until).getTime() - Date.now() < 4 * 60 * 60 * 1000;

      const urgencyText = lead.urgency === 'hot' ? 'ASAP' : lead.urgency === 'warm' ? 'This Week' : 'Flexible';
      const pushBody = windowClosingSoon
        ? `${location} — ${urgencyText}\nReply in WhatsApp to keep instant updates`
        : `${location} — ${urgencyText}`;

      pushJobs.push({
        name: 'send-push-notification',
        data: {
          leadId: lead.id,
          contractorId: contractor.user_id,
          title: `New ${professionLabel} Lead`,
          body: pushBody,
          url: '/leads',
        },
        opts: {
          jobId: `push-notif-${lead.id}-${contractor.user_id}`,
          attempts: 2,
          backoff: { type: 'exponential' as const, delay: 1000 },
        },
      });
    }

    if (!primaryChannel) {
      unreachable++;
      log.warn({ contractorId: contractor.user_id, leadId: lead.id }, 'Contractor unreachable — no notification channel available');
    }

    // Track notification rows
    if (primaryChannel) {
      notificationRows.push({
        lead_id: lead.id,
        contractor_id: contractor.user_id,
        channel: primaryChannel,
        delivery_status: 'queued',
        cascade_position: cascadePos,
      });
    }
  }

  // ── Enqueue all jobs in bulk ──
  if (waJobs.length > 0 && waNotificationQueue) await waNotificationQueue.addBulk(waJobs);
  if (waTemplateJobs.length > 0 && waTemplateQueue) await waTemplateQueue.addBulk(waTemplateJobs);
  if (telegramJobs.length > 0) await notificationQueue.addBulk(telegramJobs);
  if (pushJobs.length > 0 && pushNotificationQueue) await pushNotificationQueue.addBulk(pushJobs);
  if (smsJobs.length > 0 && smsQueue) await smsQueue.addBulk(smsJobs);

  const notifiedContractorIds = new Set<string>();
  for (const j of [...waJobs, ...waTemplateJobs, ...telegramJobs, ...pushJobs, ...smsJobs]) {
    notifiedContractorIds.add(j.data.contractorId as string);
  }
  const totalSent = notifiedContractorIds.size;

  if (notificationRows.length > 0) {
    const { error: notifErr } = await supabase
      .from('lead_notifications')
      .upsert(notificationRows, { onConflict: 'lead_id,contractor_id,channel', ignoreDuplicates: true });
    if (notifErr) {
      log.warn({ error: notifErr }, 'Failed to insert lead_notifications rows');
    }
  }

  const matchedContractorIds = capped.map(c => c.user_id);
  await updateLeadStatus(lead.id, 'sent', totalSent, matchedContractorIds);

  const durationMs = Math.round(performance.now() - start);
  log.info(
    {
      leadId: lead.id,
      profession: lead.profession,
      zip: lead.zip_code,
      totalMatches: contractors.length,
      tier1_wa: tier1,
      tier2_template: tier2,
      tier3_push: tier3,
      tier4_sms: tier4,
      unreachable,
      sentTotal: totalSent,
      durationMs,
    },
    'Lead matched — cascade notifications enqueued',
  );

  return totalSent;
}

async function updateLeadStatus(
  leadId: string,
  status: string,
  sentToCount: number,
  matchedContractors: string[],
): Promise<void> {
  const { error } = await supabase
    .from('leads')
    .update({ 
      status, 
      sent_to_count: sentToCount,
      matched_contractors: matchedContractors 
    })
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
