// services/notification/src/push-worker.ts
import { Worker } from 'bullmq';
import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';
import IORedis from 'ioredis';
import type { Logger } from 'pino';
import { config } from './config.js';

export interface PushNotificationJob {
  leadId: string;
  contractorId: string;
  title: string;
  body: string;
  url?: string;
}

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
);

function makeRedis() {
  return process.env.REDIS_URL
    ? new IORedis(process.env.REDIS_URL, { maxRetriesPerRequest: null })
    : new IORedis({ ...config.redis });
}

export function createPushWorker(log: Logger): { worker: Worker | null; cleanup: () => Promise<void> } {
  if (!config.vapid.publicKey || !config.vapid.privateKey) {
    log.warn('VAPID keys not configured — push-worker disabled');
    return {
      worker: null,
      cleanup: async () => {},
    };
  }

  webpush.setVapidDetails(
    config.vapid.subject,
    config.vapid.publicKey,
    config.vapid.privateKey,
  );

  const connection = makeRedis();

  const worker = new Worker<PushNotificationJob>(
    config.queues.pushNotifications,
    async (job) => {
      const { leadId, contractorId, title, body, url } = job.data;
      const jobLog = log.child({ jobId: job.id, leadId, contractorId });

      const { data: subs, error } = await supabase
        .from('push_subscriptions')
        .select('id, endpoint, p256dh, auth')
        .eq('user_id', contractorId);

      if (error) {
        throw new Error(`Failed to fetch push subscriptions: ${error.message}`);
      }

      if (!subs || subs.length === 0) {
        jobLog.info('No push subscriptions found — skipping');
        return { sent: 0 };
      }

      const payload = JSON.stringify({ title, body, leadId, url: url ?? '/' });
      let sentCount = 0;
      const expiredIds: string[] = [];

      for (const sub of subs) {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload,
          );
          sentCount++;
        } catch (err: any) {
          if (err.statusCode === 410 || err.statusCode === 404) {
            jobLog.info({ endpoint: sub.endpoint }, 'Push subscription expired — queuing for deletion');
            expiredIds.push(sub.id);
          } else {
            jobLog.warn({ endpoint: sub.endpoint, statusCode: err.statusCode, err: err.message }, 'Push send failed');
          }
        }
      }

      if (expiredIds.length > 0) {
        await supabase.from('push_subscriptions').delete().in('id', expiredIds);
        jobLog.info({ count: expiredIds.length }, 'Deleted expired push subscriptions');
      }

      await supabase.from('pipeline_events').insert({
        stage: 'push_sent',
        lead_id: leadId,
        detail: { contractorId, sent: sentCount, expired: expiredIds.length },
      });

      jobLog.info({ sent: sentCount, total: subs.length }, 'Push notifications sent');
      return { sent: sentCount };
    },
    {
      connection,
      concurrency: config.worker.concurrency,
      removeOnComplete: { count: 1000 },
      removeOnFail: { count: 5000 },
    },
  );

  worker.on('completed', (job, result) => {
    log.info({ jobId: job?.id, result }, 'Push job completed');
  });

  worker.on('failed', (job, err) => {
    log.error({ jobId: job?.id, err: err.message }, 'Push job failed');
  });

  worker.on('error', (err) => {
    log.error({ err: err.message }, 'Push worker error');
  });

  const cleanup = async () => {
    await worker.close();
  };

  return { worker, cleanup };
}
