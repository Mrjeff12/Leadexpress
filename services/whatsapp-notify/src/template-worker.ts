import { Worker, Queue, UnrecoverableError } from 'bullmq';
import { createClient } from '@supabase/supabase-js';
import type { Logger } from 'pino';
import { config } from './config.js';
import { sendContentTemplate } from './whatsapp-client.js';

export interface WaTemplateNotificationJob {
  leadId: string;
  contractorId: string;
  whatsappPhone: string;
  contractorName: string;
  profession: string;
  city: string | null;
  summary: string;
  urgency: 'hot' | 'warm' | 'cold';
}

const PROFESSION_EMOJI: Record<string, string> = {
  hvac: '❄️', air_duct: '🌬️', chimney: '🏠', dryer_vent: '🌀',
  garage_door: '🚗', locksmith: '🔑', roofing: '🏗️', plumbing: '🚰',
  electrical: '⚡', painting: '🎨', cleaning: '✨', carpet_cleaning: '🧹',
  renovation: '🔨', fencing: '🧱', landscaping: '🌿', tiling: '🔲',
  kitchen: '🍳', bathroom: '🚿', pool: '🏊', moving: '📦', other: '📋',
};

const supabase = createClient(config.supabase.url, config.supabase.serviceKey);

/**
 * BullMQ worker that sends lead notifications via WhatsApp Content Templates.
 * Used when the 24h conversation window is closed — templates bypass the window.
 */
export function createWaTemplateWorker(log: Logger): { worker: Worker; cleanup: () => Promise<void> } {
  const pushQueue = new Queue('push-notifications', { connection: config.redis });

  const worker = new Worker<WaTemplateNotificationJob>(
    config.queues.waTemplateNotifications,
    async (job) => {
      const { leadId, contractorId, whatsappPhone, contractorName, profession, city, summary, urgency } = job.data;
      const jobLog = log.child({ jobId: job.id, leadId, contractorId, phone: whatsappPhone });

      // Pick the right template SID (BTN for US numbers, standard otherwise)
      const isUS = whatsappPhone.startsWith('+1') || whatsappPhone.startsWith('1');
      const contentSid = isUS ? config.contentTemplates.leadNotifyBtn : config.contentTemplates.leadNotify;

      if (!contentSid) {
        jobLog.warn('No content template SID configured — falling back to push');
        await enqueuePushFallback(pushQueue, leadId, contractorId, profession, city, log);
        return { sent: false, reason: 'no_template_sid' };
      }

      const emoji = PROFESSION_EMOJI[profession] ?? '📋';
      const location = city ?? 'your area';
      const urgencyLabel = urgency === 'hot' ? 'ASAP' : urgency === 'warm' ? 'This Week' : 'Flexible';

      const result = await sendContentTemplate(whatsappPhone, contentSid, {
        '1': emoji,
        '2': profession.replace(/_/g, ' ').toUpperCase(),
        '3': location,
        '4': urgencyLabel,
        '5': summary.substring(0, 100),
      }, jobLog);

      if (result.success) {
        // Record throttle to prevent repeat template sends within 12h
        await supabase.from('reconnect_throttle').upsert(
          { contractor_id: contractorId, channel: 'whatsapp_template', sent_at: new Date().toISOString() },
          { onConflict: 'contractor_id,channel' },
        );
        return { sent: true, messageId: result.messageId };
      }

      if (result.rateLimited) {
        throw new Error(`Rate limited — retry after ${result.retryAfter}s`);
      }

      if (result.error?.includes('not a valid WhatsApp account')) {
        throw new UnrecoverableError(`Invalid WhatsApp number: ${whatsappPhone}`);
      }

      throw new Error(`Template send failed: ${result.error}`);
    },
    {
      connection: config.redis,
      concurrency: 10,
      removeOnComplete: { count: 1000 },
      removeOnFail: { count: 5000 },
      limiter: { max: 70, duration: 1000 },
    },
  );

  worker.on('completed', (job, result) => {
    log.info({ jobId: job?.id, result }, 'WA template job completed');
  });

  worker.on('failed', async (job, err) => {
    log.error({ jobId: job?.id, err: err.message, attempts: job?.attemptsMade }, 'WA template job failed');

    if (job && job.attemptsMade >= (job.opts.attempts ?? 3)) {
      const { leadId, contractorId, whatsappPhone, profession, city } = job.data;
      log.info({ contractorId, leadId }, 'WA template failed permanently, cascading to push');
      try {
        await enqueuePushFallback(pushQueue, leadId, contractorId, profession, city, log);
      } catch (fallbackErr: unknown) {
        const msg = fallbackErr instanceof Error ? fallbackErr.message : 'unknown';
        log.error({ contractorId, leadId, err: msg }, 'Failed to enqueue template fallback');
      }
    }
  });

  worker.on('error', (err) => {
    log.error({ err: err.message }, 'WA template worker error');
  });

  const cleanup = async () => {
    await pushQueue.close();
    await worker.close();
  };

  return { worker, cleanup };
}

async function enqueuePushFallback(
  pushQueue: Queue,
  leadId: string,
  contractorId: string,
  profession: string,
  city: string | null,
  log: Logger,
): Promise<void> {
  const { data: pushSub } = await supabase
    .from('push_subscriptions')
    .select('user_id')
    .eq('user_id', contractorId)
    .limit(1)
    .maybeSingle();

  if (pushSub) {
    const profLabel = profession.replace(/_/g, ' ').toUpperCase();
    const location = city ?? 'your area';
    await pushQueue.add('send-push-notification', {
      leadId,
      contractorId,
      title: `🔥 New ${profLabel} Lead`,
      body: `${location} — Tap to connect and see details`,
      url: `https://wa.me/14155238886?text=${encodeURIComponent('👋')}`,
    }, {
      jobId: `fallback-push-${leadId}-${contractorId}`,
      attempts: 2,
      backoff: { type: 'exponential', delay: 1000 },
    });
    log.info({ contractorId, leadId }, 'Fallback: enqueued push from template worker');
  }
}
