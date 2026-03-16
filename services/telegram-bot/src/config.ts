import 'dotenv/config'

function required(key: string): string {
  const value = process.env[key]
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`)
  }
  return value
}

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),

  telegramBotToken: required('TELEGRAM_BOT_TOKEN'),
  telegramWebhookUrl: required('TELEGRAM_WEBHOOK_URL'),
  telegramWebhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET || '',

  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',

  supabaseUrl: required('SUPABASE_URL'),
  supabaseServiceKey: required('SUPABASE_SERVICE_KEY'),
} as const
