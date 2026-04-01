import { Worker, Queue, UnrecoverableError } from 'bullmq';
import { config } from '../config.js';
import { supabase } from '../lib/supabase.js';
import { sendContentTemplate } from '../lib/twilio.js';
import pino from 'pino';

const log = pino({ name: 'wa-template-worker' });

/** Matches the job shape produced by the matching service */
interface WaTemplateNotificationJob {
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

export function createTemplateWorker() {
  const pushQueue = new Queue('push-notifications', { connection: config.redis });
  const smsQueue = new Queue(config.queues.smsNotifications, { connection: config.redis });

  const worker = new Worker<WaTemplateNotificationJob>(
    config.queues.waTemplateNotifications,
    async (job) => {
      const { leadId, contractorId, whatsappPhone, profession, city, summary, urgency } = job.data;
      const jobLog = log.child({ jobId: job.id, leadId, contractorId, phone: whatsappPhone });

      const isUS = whatsappPhone.startsWith('+1') || whatsappPhone.startsWith('1');
      const contentSid = isUS ? config.contentTemplates.leadNotifyBtn : config.contentTemplates.leadNotify;

      if (!contentSid) {
        jobLog.warn('No content template SID configured — falling back to push');
        await enqueuePushFallback(pushQueue, leadId, contractorId, profession, city);
        return { sent: false, reason: 'no_template_sid' };
      }

      const emoji = PROFESSION_EMOJI[profession] ?? '📋';
      const location = city ?? 'your area';
      const urgencyLabel = urgency === 'hot' ? 'ASAP' : urgency === 'warm' ? 'This Week' : 'Flexible';

      try {
        await sendContentTemplate(whatsappPhone, contentSid, {
          '1': emoji,
          '2': profession.replace(/_/g, ' ').toUpperCase(),
          '3': location,
          '4': urgencyLabel,
          '5': summary.substring(0, 100),
        });

        await supabase.from('reconnect_throttle').upsert(
          { contractor_id: contractorId, channel: 'whatsapp_template', sent_at: new Date().toISOString() },
          { onConflict: 'contractor_id,channel' },
        );

        jobLog.info('Template notification sent');
        return { sent: true };
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'unknown';
        if (msg.includes('not a valid WhatsApp account')) {
          throw new UnrecoverableError(`Invalid WhatsApp number: ${whatsappPhone}`);
        }
        throw new Error(`Template send failed: ${msg}`);
      }
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
      log.info({ contractorId, leadId }, 'WA template failed permanently, cascading to push/SMS');
      try {
        await enqueuePushFallback(pushQueue, leadId, contractorId, profession, city);

        if (whatsappPhone.startsWith('+1') && config.smsFrom) {
          await smsQueue.add('send-sms', {
            leadId,
            contractorId,
            phone: whatsappPhone,
            profession,
            city,
          }, {
            jobId: `fallback-sms-${leadId}-${contractorId}`,
            attempts: 2,
            backoff: { type: 'exponential', delay: 2000 },
          });
        }
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
    await smsQueue.close();
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
