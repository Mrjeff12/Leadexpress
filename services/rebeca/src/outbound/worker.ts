import { Worker, Queue, UnrecoverableError } from 'bullmq';
import Redis from 'ioredis';
import { config } from '../config.js';
import { supabase } from '../lib/supabase.js';
import { sendText } from '../lib/twilio.js';
import pino from 'pino';

const log = pino({ name: 'wa-worker' });

interface WaNotificationJob {
  leadId: string;
  userId: string;
  phone: string;
  message: string;
  contentSid?: string;
}

export function createWorker(redis: Redis) {
  // Fallback queues for when WA window expires
  const telegramQueue = new Queue('notifications', { connection: redis });
  const pushQueue = new Queue('push-notifications', { connection: redis });

  const worker = new Worker<WaNotificationJob>(
    config.queues.waNotifications,
    async (job) => {
      const { phone, message, userId, leadId } = job.data;

      const { data: contractor } = await supabase
        .from('contractors')
        .select('wa_notify, wa_window_until')
        .eq('user_id', userId)
        .maybeSingle();

      if (!contractor?.wa_notify) {
        log.info({ userId }, 'WA notify disabled, skipping');
        return;
      }

      const windowOpen = contractor.wa_window_until
        ? new Date(contractor.wa_window_until) > new Date()
        : false;

      if (!windowOpen) {
        log.info({ userId }, 'WA window closed, attempting fallback notification');
        await enqueueFallback(telegramQueue, pushQueue, userId, leadId, message, log);
        return;
      }

      await sendText(phone, message);
      log.info({ userId, phone: phone.slice(-4) }, 'Lead notification sent');
    },
    {
      connection: redis,
      concurrency: 10,
      limiter: { max: 70, duration: 1000 },
      removeOnComplete: { count: 1000 },
      removeOnFail: { count: 5000 },
    },
  );

  worker.on('failed', (job, err) => {
    if (err instanceof UnrecoverableError) {
      log.error({ jobId: job?.id, err: err.message }, 'Unrecoverable WA job failure');
    } else {
      log.warn({ jobId: job?.id, err: err.message }, 'WA job failed, will retry');
    }
  });

  return {
    worker,
    cleanup: async () => {
      await telegramQueue.close();
      await pushQueue.close();
      await worker.close();
    },
  };
}

/**
 * When a WA message is dropped (window expired), fall back to Telegram,
 * then push notifications if Telegram is unavailable.
 */
async function enqueueFallback(
  telegramQueue: Queue,
  pushQueue: Queue,
  userId: string,
  leadId: string,
  message: string,
  logger: typeof log,
): Promise<void> {
  // Check if the contractor has a Telegram chat ID
  const { data: profile } = await supabase
    .from('profiles')
    .select('telegram_chat_id, full_name')
    .eq('id', userId)
    .maybeSingle();

  if (profile?.telegram_chat_id) {
    await telegramQueue.add('send-notification', {
      leadId,
      contractorId: userId,
      telegramChatId: profile.telegram_chat_id,
      contractorName: profile.full_name,
      message,
    }, {
      jobId: `fallback-tg-${leadId}-${userId}`,
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
    });
    logger.info({ userId, leadId }, 'Fallback: enqueued Telegram notification');
    return;
  }

  // No Telegram — try push notification
  const { data: pushSub } = await supabase
    .from('push_subscriptions')
    .select('user_id')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();

  if (pushSub) {
    await pushQueue.add('send-push-notification', {
      leadId,
      contractorId: userId,
      title: 'New Lead Available',
      body: 'Tap to view details',
      url: '/leads',
    }, {
      jobId: `fallback-push-${leadId}-${userId}`,
      attempts: 2,
      backoff: { type: 'exponential', delay: 1000 },
    });
    logger.info({ userId, leadId }, 'Fallback: enqueued push notification');
    return;
  }

  logger.warn({ userId, leadId }, 'No fallback channel available (no Telegram or push subscription)');
}
