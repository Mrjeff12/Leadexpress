import { Worker, UnrecoverableError } from 'bullmq';
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
  const worker = new Worker<WaNotificationJob>(
    config.queues.waNotifications,
    async (job) => {
      const { phone, message, userId } = job.data;

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
        log.debug({ userId }, 'WA window closed, skipping notification');
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
      await worker.close();
    },
  };
}
