import 'dotenv/config';

function required(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Missing required env var: ${name}`);
  return val;
}

function optional(name: string): string | undefined {
  return process.env[name] || undefined;
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
    maxRetriesPerRequest: null as null,
  },

  telegram: {
    botToken: required('TELEGRAM_BOT_TOKEN'),
  },

  vapid: {
    publicKey: optional('VAPID_PUBLIC_KEY'),
    privateKey: optional('VAPID_PRIVATE_KEY'),
    subject: optional('VAPID_SUBJECT') ?? 'mailto:admin@leadexpress.io',
  },

  worker: {
    concurrency: Number(process.env.WORKER_CONCURRENCY ?? 10),
  },

  rateLimiter: {
    max: Number(process.env.RATE_LIMIT_MAX ?? 25),
    duration: Number(process.env.RATE_LIMIT_DURATION ?? 1000),
  },

  twilio: {
    accountSid: optional('TWILIO_ACCOUNT_SID') ?? '',
    authToken: optional('TWILIO_AUTH_TOKEN') ?? '',
    smsFrom: optional('TWILIO_SMS_FROM') ?? '',
  },

  supabase: {
    url: optional('SUPABASE_URL') ?? '',
    serviceKey: optional('SUPABASE_SERVICE_KEY') ?? optional('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  },

  queues: {
    notifications: 'notifications',
    pushNotifications: 'push-notifications',
    smsNotifications: 'sms-notifications',
  },
} as const;
