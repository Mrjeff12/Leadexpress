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

  supabase: {
    url: required('SUPABASE_URL'),
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY ?? required('SUPABASE_SERVICE_KEY'),
  },

  twilio: {
    accountSid: required('TWILIO_ACCOUNT_SID'),
    authToken: required('TWILIO_AUTH_TOKEN'),
    whatsappFrom: required('TWILIO_WA_FROM'), // e.g. "whatsapp:+14155238886"
    checkinTemplateName: process.env.WA_CHECKIN_TEMPLATE ?? 'daily_checkin',
    templateLanguage: process.env.WA_TEMPLATE_LANG ?? 'he',
  },

  cron: {
    checkinSchedule: process.env.CHECKIN_CRON ?? '0 7 * * *', // 07:00 daily
    timezone: process.env.CHECKIN_TIMEZONE ?? 'America/New_York',
  },

  server: {
    port: Number(process.env.PORT ?? 3002),
  },

  queues: {
    waNotifications: 'wa-notifications',
  },
} as const;
