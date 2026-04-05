import { Worker, Queue, UnrecoverableError } from 'bullmq';
import type { Logger } from 'pino';
import { config } from './config.js';
import { sendTextMessage } from './whatsapp-client.js';

export interface WaNotificationJob {
  leadId: string;
  contractorId: string;
  whatsappPhone: string;
  contractorName: string;
  message: string;
}

/**
 * BullMQ worker that sends lead notifications via WhatsApp.
 * Only processes contractors who have an open 24h window (free messages).
 */
export function createWaNotificationWorker(log: Logger): { worker: Worker; cleanup: () => Promise<void> } {
  // Fallback queue for when WA delivery fails permanently
  const pushQueue = new Queue('push-notifications', { connection: config.redis });

  const worker = new Worker<WaNotificationJob>(
    config.queues.waNotifications,
    async (job) => {
      const { leadId, contractorId, whatsappPhone, contractorName, message } = job.data;

      const jobLog = log.child({
        jobId: job.id,
        leadId,
        contractorId,
        phone: whatsappPhone,
      });

      jobLog.info({ contractorName }, 'Sending WhatsApp lead notification');

      const result = await sendTextMessage(whatsappPhone, message, jobLog);

      if (result.success) {
        jobLog.info({ messageId: result.messageId }, 'WhatsApp notification sent');
        return { sent: true, messageId: result.messageId };
      }

      if (result.rateLimited) {
        const delayMs = (result.retryAfter ?? 60) * 1000;
        throw new Error(`Rate limited — retry after ${delayMs}ms`);
      }

      // Permanent failure (wrong number, etc.)
      if (result.error?.includes('not a valid WhatsApp account')) {
        throw new UnrecoverableError(`Invalid WhatsApp number: ${whatsappPhone}`);
      }

      throw new Error(`WhatsApp send failed: ${result.error}`);
    },
    {
      connection: config.redis,
      concurrency: 10,
      removeOnComplete: { count: 1000 },
      removeOnFail: { count: 5000 },
      limiter: {
        max: 70, // WhatsApp allows ~80/sec, stay under
        duration: 1000,
      },
    },
  );

  worker.on('completed', (job, result) => {
    log.info({ jobId: job?.id, result }, 'WA notification job completed');
  });

  worker.on('failed', async (job, err) => {
    log.error({ jobId: job?.id, err: err.message, attempts: job?.attemptsMade }, 'WA notification job failed');

    // If all retries exhausted, enqueue fallback (Push)
    if (job && job.attemptsMade >= (job.opts.attempts ?? 3)) {
      const { leadId, contractorId } = job.data;
      log.info({ contractorId, leadId }, 'WA delivery failed permanently, attempting fallback');
      try {
        await enqueuePushFallback(pushQueue, contractorId, leadId, log);
      } catch (fallbackErr: unknown) {
        const msg = fallbackErr instanceof Error ? fallbackErr.message : 'unknown';
        log.error({ contractorId, leadId, err: msg }, 'Failed to enqueue fallback notification');
      }
    }
  });

  worker.on('error', (err) => {
    log.error({ err: err.message }, 'WA worker error');
  });

  const cleanup = async () => {
    await pushQueue.close();
    await worker.close();
  };

  return { worker, cleanup };
}

/**
 * When WA delivery fails permanently, fall back to push notifications.
 */
async function enqueuePushFallback(
  pushQueue: Queue,
  contractorId: string,
  leadId: string,
  log: Logger,
): Promise<void> {
  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(config.supabase.url, config.supabase.serviceKey);

  const { data: pushSub } = await supabase
    .from('push_subscriptions')
    .select('user_id')
    .eq('user_id', contractorId)
    .limit(1)
    .maybeSingle();

  if (pushSub) {
    await pushQueue.add('send-push-notification', {
      leadId,
      contractorId,
      title: 'New Lead Available',
      body: 'Tap to view details',
      url: '/leads',
    }, {
      jobId: `fallback-push-${leadId}-${contractorId}`,
      attempts: 2,
      backoff: { type: 'exponential', delay: 1000 },
    });
    log.info({ contractorId, leadId }, 'Fallback: enqueued push notification');
    return;
  }

  log.warn({ contractorId, leadId }, 'No fallback channel available (no push subscription)');
}
