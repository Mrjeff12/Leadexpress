import { Queue } from 'bullmq';
import IORedis from 'ioredis';
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
  quotedMessageId?: string | null;
  quotedText?: string | null;
}

let queue: Queue<RawMessageJob> | null = null;
let joinQueue: Queue<any> | null = null;

function makeRedis() {
  return process.env.REDIS_URL
    ? new IORedis(process.env.REDIS_URL, { maxRetriesPerRequest: null })
    : new IORedis({ ...config.redis });
}

export function getJoinQueue(): Queue<any> | null {
  if (!config.features.enableAutoJoinQueue) {
    return null;
  }
  if (!joinQueue) {
    joinQueue = new Queue('group-join-jobs', {
      connection: makeRedis(),
      defaultJobOptions: {
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 500 },
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
      },
    });
    joinQueue.on('error', (err) => {
      logger.error({ err }, 'Join Queue error');
    });
    logger.info('BullMQ join-queue producer initialized');
  }
  return joinQueue;
}

export function getQueue(): Queue<RawMessageJob> {
  if (!queue) {
    queue = new Queue<RawMessageJob>(config.queue.name, {
      connection: makeRedis(),
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
