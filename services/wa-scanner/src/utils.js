const { createClient } = require('@supabase/supabase-js')
const { Queue } = require('bullmq')

// ─── Environment ─────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY
const ACCOUNT_ID = process.env.ACCOUNT_ID || 'scan-1'

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY')
  process.exit(1)
}

// ─── Supabase ────────────────────────────────────────────
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// ─── Redis config (supports REDIS_URL with optional TLS) ─
function parseRedis() {
  const url = process.env.REDIS_URL
  if (url && !process.env.REDIS_HOST) {
    try {
      const parsed = new URL(url)
      const useTls = parsed.protocol === 'rediss:'
      return {
        host: parsed.hostname || 'localhost',
        port: Number(parsed.port || 6379),
        password: parsed.password || undefined,
        ...(useTls ? { tls: {} } : {}),
      }
    } catch { /* fall through */ }
  }
  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
  }
}

const redisConnection = {
  ...parseRedis(),
  maxRetriesPerRequest: null,
}

let rawMessageQueue = null

function getQueue() {
  if (!rawMessageQueue) {
    rawMessageQueue = new Queue('raw-messages', {
      connection: redisConnection,
      defaultJobOptions: {
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 5000 },
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
      },
    })
    rawMessageQueue.on('error', (err) => {
      log('error', `Queue error: ${err.message}`)
    })
  }
  return rawMessageQueue
}

async function enqueueMessage(job) {
  const q = getQueue()
  await q.add('raw-message', job, {
    jobId: `msg-${job.messageId.replace(/:/g, '-')}`,
  })
}

// ─── Logging ─────────────────────────────────────────────
function log(level, msg, data = {}) {
  const ts = new Date().toISOString()
  const prefix = `[${ts}] [${ACCOUNT_ID}] [${level.toUpperCase()}]`
  if (level === 'error') {
    console.error(prefix, msg, data)
  } else {
    console.log(prefix, msg, Object.keys(data).length ? data : '')
  }
}

// ─── Helpers ─────────────────────────────────────────────
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function randomDelay(minMs, maxMs) {
  return Math.floor(Math.random() * (maxMs - minMs) + minMs)
}

module.exports = {
  supabase,
  getQueue,
  enqueueMessage,
  redisConnection,
  log,
  sleep,
  randomDelay,
  ACCOUNT_ID,
}
