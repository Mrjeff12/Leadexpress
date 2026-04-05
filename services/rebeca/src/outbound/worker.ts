import { Worker, Queue, UnrecoverableError } from 'bullmq';
import { config } from '../config.js';
import { supabase } from '../lib/supabase.js';
import { sendText } from '../lib/twilio.js';
import pino from 'pino';

const log = pino({ name: 'wa-worker' });

/** Matches the job shape produced by the matching service */
interface WaNotificationJob {
  leadId: string;
  contractorId: string;
  whatsappPhone: string;
  contractorName: string;
  message: string;
}

export function createWorker() {
  const pushQueue = new Queue('push-notifications', { connection: config.redis });

  const worker = new Worker<WaNotificationJob>(
    config.queues.waNotifications,
    async (job) => {
      const { whatsappPhone, message, contractorId, leadId, contractorName } = job.data;
      const jobLog = log.child({ jobId: job.id, leadId, contractorId, phone: whatsappPhone });

      const { data: contractor } = await supabase
        .from('contractors')
        .select('wa_notify, wa_window_until')
        .eq('user_id', contractorId)
        .maybeSingle();

      if (!contractor?.wa_notify) {
        jobLog.info('WA notify disabled, skipping');
        return;
      }

      const windowOpen = contractor.wa_window_until
        ? new Date(contractor.wa_window_until) > new Date()
        : false;

      if (!windowOpen) {
        jobLog.info('WA window closed, attempting fallback notification');
        await enqueuePushFallback(pushQueue, contractorId, leadId, jobLog);
        return;
      }

      await sendText(whatsappPhone, message);
      jobLog.info({ contractorName }, 'Lead notification sent');
    },
    {
      connection: config.redis,
      concurrency: 10,
      limiter: { max: 70, duration: 1000 },
      removeOnComplete: { count: 1000 },
      removeOnFail: { count: 5000 },
    },
  );

  worker.on('failed', async (job, err) => {
    if (err instanceof UnrecoverableError) {
      log.error({ jobId: job?.id, err: err.message }, 'Unrecoverable WA job failure');
    } else {
      log.warn({ jobId: job?.id, err: err.message }, 'WA job failed, will retry');
    }

    // If all retries exhausted, cascade to Push
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

  return {
    worker,
    cleanup: async () => {
      await pushQueue.close();
      await worker.close();
    },
  };
}

async function enqueuePushFallback(
  pushQueue: Queue,
  contractorId: string,
  leadId: string,
  logger: typeof log,
): Promise<void> {
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
    logger.info({ contractorId, leadId }, 'Fallback: enqueued push notification');
    return;
  }

  logger.warn({ contractorId, leadId }, 'No fallback channel available');
}
