import { Queue } from 'bullmq';
import { config } from './config.js';
import { logger } from './logger.js';

export interface RawMessageJob {
  messageId: string;
  groupId: string;
  body: string;
  sender: string | null;
  senderId?: string;
  timestamp: number;
  accountId: string;
}

let queue: Queue<RawMessageJob> | null = null;

export function getQueue(): Queue<RawMessageJob> {
  if (!queue) {
    queue = new Queue<RawMessageJob>(config.queue.name, {
      connection: {
        host: config.redis.host,
        port: config.redis.port,
        password: config.redis.password,
        maxRetriesPerRequest: null,
        ...((config.redis as any).tls ? { tls: {} } : {}),
      },
      defaultJobOptions: {
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 5000 },
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
      },
    });

    queue.on('error', (err) => {
      logger.error({ err }, 'Queue error');
    });

    logger.info('BullMQ queue producer initialized');
  }

  return queue;
}

export async function enqueueMessage(job: RawMessageJob): Promise<void> {
  const q = getQueue();
  await q.add('raw-message', job, {
    jobId: `msg-${job.messageId.replace(/:/g, '-')}`,
  });
  logger.info(
    { messageId: job.messageId, groupId: job.groupId },
    'Message enqueued to raw-messages'
  );
}

export async function closeQueue(): Promise<void> {
  if (queue) {
    await queue.close();
    queue = null;
    logger.info('Queue closed');
  }
}
