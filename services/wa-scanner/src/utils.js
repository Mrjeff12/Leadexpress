const { createClient } = require('@supabase/supabase-js')
const { Queue } = require('bullmq')

// ─── Environment ─────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY
const REDIS_HOST = process.env.REDIS_HOST || 'localhost'
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379', 10)
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || undefined
const ACCOUNT_ID = process.env.ACCOUNT_ID || 'scan-1'

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY')
  process.exit(1)
}

// ─── Supabase ────────────────────────────────────────────
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// ─── BullMQ ──────────────────────────────────────────────
const redisConnection = {
  host: REDIS_HOST,
  port: REDIS_PORT,
  password: REDIS_PASSWORD,
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
