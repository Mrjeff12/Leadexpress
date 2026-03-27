import 'dotenv/config';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function parseRedis() {
  const url = process.env.REDIS_URL;
  if (url && !process.env.REDIS_HOST) {
    try {
      const parsed = new URL(url);
      const useTls = parsed.protocol === 'rediss:';
      return {
        host: parsed.hostname || 'localhost',
        port: Number(parsed.port || 6379),
        password: parsed.password || undefined,
        username: parsed.username || undefined,
        ...(useTls ? { tls: {} } : {}),
      };
    } catch { /* fall through */ }
  }
  return {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
    password: process.env.REDIS_PASSWORD,
  };
}

export const config = {
  redis: {
    ...parseRedis(),
    maxRetriesPerRequest: null as null,
  },

  supabase: {
    url: requireEnv('SUPABASE_URL'),
    serviceKey: requireEnv('SUPABASE_SERVICE_KEY'),
  },

  greenApi: {
    apiUrl: requireEnv('GREEN_API_URL'),
    idInstance: requireEnv('GREEN_API_ID'),
    apiToken: requireEnv('GREEN_API_TOKEN'),
  },

  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID ?? '',
    authToken: process.env.TWILIO_AUTH_TOKEN ?? '',
    whatsappFrom: process.env.TWILIO_WA_FROM ?? '',
  },

  whatsapp: {
    accountId: process.env.WA_ACCOUNT_ID ?? 'default',
  },

  queue: {
    name: 'raw-messages',
  },

  features: {
    enableAutoJoinQueue: process.env.ENABLE_AUTO_JOIN_QUEUE === 'true',
  },

  health: {
    heartbeatIntervalMs: 30_000,
    heartbeatKey: `wa-listener:heartbeat:${process.env.WA_ACCOUNT_ID ?? 'default'}`,
    heartbeatTtlSeconds: 90,
  },

  alerts: {
    adminPhone: process.env.ADMIN_ALERT_PHONE ?? '',
    pollIntervalMs: 10_000,
  },

  dedup: {
    ttlSeconds: 3600, // 1 hour
    keyPrefix: 'wa:dedup:',
  },

  polling: {
    intervalMs: 5_000, // poll Green API every 5 seconds
  },

  scanner: {
    phone: process.env.SCANNER_PHONE ?? '+17542763406',
  },
} as const;
