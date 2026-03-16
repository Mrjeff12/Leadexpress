import 'dotenv/config';

function required(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Missing required env var: ${name}`);
  return val;
}

export const config = {
  redis: {
    host: process.env.REDIS_HOST ?? '127.0.0.1',
    port: Number(process.env.REDIS_PORT ?? 6379),
    password: process.env.REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: null as null, // required by BullMQ
  },

  telegram: {
    botToken: required('TELEGRAM_BOT_TOKEN'),
  },

  worker: {
    concurrency: Number(process.env.WORKER_CONCURRENCY ?? 10),
  },

  rateLimiter: {
    max: Number(process.env.RATE_LIMIT_MAX ?? 25),
    duration: Number(process.env.RATE_LIMIT_DURATION ?? 1000),
  },

  queues: {
    notifications: 'notifications',
  },
} as const;
