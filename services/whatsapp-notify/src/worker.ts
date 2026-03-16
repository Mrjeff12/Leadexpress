import { Worker, UnrecoverableError } from 'bullmq';
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

  worker.on('failed', (job, err) => {
    log.error({ jobId: job?.id, err: err.message, attempts: job?.attemptsMade }, 'WA notification job failed');
  });

  worker.on('error', (err) => {
    log.error({ err: err.message }, 'WA worker error');
  });

  const cleanup = async () => {
    await worker.close();
  };

  return { worker, cleanup };
}
