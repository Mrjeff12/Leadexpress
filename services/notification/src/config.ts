import 'dotenv/config';

function required(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Missing required env var: ${name}`);
  return val;
}

function parseRedis() {
  const url = process.env.REDIS_URL;
  if (url && !process.env.REDIS_HOST) {
    try {
      const parsed = new URL(url);
      const useTls = parsed.protocol === 'rediss:';
      return {
        host: parsed.hostname || '127.0.0.1',
        port: Number(parsed.port || 6379),
        password: parsed.password || undefined,
        username: parsed.username || undefined,
        ...(useTls ? { tls: {} } : {}),
      };
    } catch { /* fall through */ }
  }
  return {
    host: process.env.REDIS_HOST ?? '127.0.0.1',
    port: Number(process.env.REDIS_PORT ?? 6379),
    password: process.env.REDIS_PASSWORD || undefined,
  };
}

export const config = {
  redis: {
    ...parseRedis(),
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
