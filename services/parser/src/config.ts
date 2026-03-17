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

  openai: {
    apiKey: required('OPENAI_API_KEY'),
    model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
  },

  supabase: {
    url: required('SUPABASE_URL'),
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY ?? required('SUPABASE_SERVICE_KEY'),
  },

  worker: {
    concurrency: Number(process.env.WORKER_CONCURRENCY ?? 5),
  },

  queues: {
    rawMessages: 'raw-messages',
    parsedLeads: 'parsed-leads',
  },

  dedup: {
    ttlSeconds: Number(process.env.DEDUP_TTL_SECONDS ?? 7200), // 2 hours
  },
} as const;
