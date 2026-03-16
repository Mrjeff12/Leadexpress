import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { createClient } from '@supabase/supabase-js'
import Redis from 'ioredis'
import pino from 'pino'

import { config } from './config.js'
import { setupWebhook } from './setup.js'
import { createWebhookRouter } from './webhook.js'

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport:
    process.env.NODE_ENV !== 'production'
      ? { target: 'pino/file', options: { destination: 1 } }
      : undefined,
})

// ---------------------------------------------------------------------------
// Clients
// ---------------------------------------------------------------------------

const redis = new Redis(config.redisUrl, {
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    const delay = Math.min(times * 200, 5000)
    logger.warn({ attempt: times, delay }, 'Redis reconnecting')
    return delay
  },
})

redis.on('connect', () => logger.info('Connected to Redis'))
redis.on('error', (err) => logger.error({ err }, 'Redis error'))

const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey, {
  auth: { persistSession: false },
})

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

const app = new Hono()

// Health check
app.get('/health', (c) =>
  c.json({ status: 'ok', service: 'telegram-bot', uptime: process.uptime() })
)

// Mount webhook routes
const webhookRouter = createWebhookRouter({
  redis,
  supabase,
  logger,
  webhookSecret: config.telegramWebhookSecret || undefined,
})
app.route('/', webhookRouter)

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

async function start() {
  // Register webhook URL with Telegram
  try {
    await setupWebhook(
      config.telegramBotToken,
      config.telegramWebhookUrl,
      logger,
      config.telegramWebhookSecret || undefined,
    )
  } catch (err) {
    logger.error({ err }, 'Failed to register Telegram webhook')
    process.exit(1)
  }

  serve({ fetch: app.fetch, port: config.port }, (info) => {
    logger.info({ port: info.port }, 'Telegram bot service started')
  })
}

// Graceful shutdown
function shutdown(signal: string) {
  logger.info({ signal }, 'Shutting down')
  redis.disconnect()
  process.exit(0)
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))

start().catch((err) => {
  logger.fatal({ err }, 'Failed to start')
  process.exit(1)
})
