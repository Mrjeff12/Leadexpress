import { Worker, UnrecoverableError } from 'bullmq';
import type { Logger } from 'pino';
import IORedis from 'ioredis';
import { config } from './config.js';
import { sendTelegramMessage } from './telegram.js';

export interface NotificationJob {
  leadId: string;
  contractorId: string;
  telegramChatId: number;
  contractorName: string;
  message: string;         // pre-formatted HTML text from matcher
  profession?: string;
  urgency?: string;
}

function makeRedis() {
  return process.env.REDIS_URL
    ? new IORedis(process.env.REDIS_URL, { maxRetriesPerRequest: null })
    : new IORedis({ ...config.redis });
}

export function createNotificationWorker(log: Logger): { worker: Worker; cleanup: () => Promise<void> } {
  const connection = makeRedis();
  const worker = new Worker<NotificationJob>(
    config.queues.notifications,
    async (job) => {
      const { leadId, contractorId, telegramChatId, contractorName, message } = job.data;

      const jobLog = log.child({
        jobId: job.id,
        leadId,
        contractorId,
        chatId: telegramChatId,
      });

      jobLog.info({ contractorName }, 'Sending Telegram notification');

      // Inline keyboard: Claim / Pass buttons
      const buttons = [
        [
          { text: '✅ Claim This Lead', callback_data: `claim:${leadId}` },
          { text: '❌ Pass', callback_data: `pass:${leadId}` },
        ],
      ];

      const result = await sendTelegramMessage(telegramChatId, message, jobLog, buttons);

      if (result.success) {
        jobLog.info('Notification sent successfully');
        return { sent: true };
      }

      // User blocked the bot — no point retrying
      if (result.blocked) {
        throw new UnrecoverableError(`User ${telegramChatId} blocked the bot`);
      }

      // Rate limited — throw with delay so BullMQ retries
      if (result.rateLimited) {
        const delayMs = (result.retryAfter ?? 5) * 1000;
        throw new Error(`Rate limited — retry after ${delayMs}ms`);
      }

      // Other errors — let BullMQ retry with backoff
      throw new Error(`Telegram send failed: ${result.error}`);
    },
    {
      connection,
      concurrency: config.worker.concurrency,
      removeOnComplete: { count: 1000 },
      removeOnFail: { count: 5000 },
      limiter: {
        max: config.rateLimiter.max,
        duration: config.rateLimiter.duration,
      },
    },
  );

  worker.on('completed', (job, result) => {
    log.info({ jobId: job?.id, result }, 'Notification job completed');
  });

  worker.on('failed', (job, err) => {
    log.error({ jobId: job?.id, err: err.message, attempts: job?.attemptsMade }, 'Notification job failed');
  });

  worker.on('error', (err) => {
    log.error({ err: err.message }, 'Worker error');
  });

  const cleanup = async () => {
    await worker.close();
  };

  return { worker, cleanup };
}
