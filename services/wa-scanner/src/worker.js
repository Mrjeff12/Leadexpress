const { Client, LocalAuth } = require('whatsapp-web.js')
const qrcode = require('qrcode-terminal')
const Redis = require('ioredis')
const { supabase, enqueueMessage, log, sleep, randomDelay, ACCOUNT_ID, redisConnection } = require('./utils')

// ─── Redis for deduplication ────────────────────────────
let dedupRedis = null

function getDedupRedis() {
  if (!dedupRedis) {
    const redisUrl = process.env.REDIS_URL
    if (redisUrl) {
      dedupRedis = new Redis(redisUrl, { maxRetriesPerRequest: null })
    } else {
      dedupRedis = new Redis({
        host: redisConnection.host,
        port: redisConnection.port,
        password: redisConnection.password,
        maxRetriesPerRequest: null,
      })
    }
    dedupRedis.on('error', (err) => {
      log('error', `Dedup Redis error: ${err.message}`)
    })
  }
  return dedupRedis
}

async function isDuplicate(messageId) {
  try {
    const redis = getDedupRedis()
    const key = `dedup:scanner:${messageId}`
    const result = await redis.set(key, '1', 'EX', 3600, 'NX') // 1h TTL
    return result === null // null = key already existed
  } catch (err) {
    log('error', `Dedup check failed: ${err.message}`)
    return false // on error, allow processing
  }
}

// ─── Smart Pre-Filter (simplified version of listener's 3-stage filter) ─────
const MIN_TEXT_LENGTH = 8
const BOT_PATTERNS = /^(ברוכים הבאים|Welcome|הקבוצה נוצרה|Group created|Admin changed)/i
const MEDIA_ONLY_PATTERN = /^(📷|🎵|🎥|📎|📄|🎤)?\s*$/
const EMOJI_ONLY = /^[\p{Emoji}\s]+$/u

// US ZIP codes
const ZIP_PATTERN = /\b\d{5}\b/

// Job/trade keywords (EN + HE)
const JOB_KEYWORDS = [
  'hvac', 'ac', 'air duct', 'airduct', 'dryer vent', 'chimney', 'garage door', 'garage',
  'locksmith', 'roofing', 'roof', 'shingles', 'carpet', 'cleaning', 'renovation', 'remodel',
  'fence', 'fencing', 'plumber', 'plumbing', 'electrician', 'painting', 'tiling',
  'landscaping', 'lawn', 'kitchen', 'bathroom', 'pool', 'moving', 'repair', 'fix',
  'install', 'installation', 'service call', 'google lead', 'off track', 'thermostat',
  // Hebrew
  'מזגן', 'מזגנים', 'מיזוג', 'צ׳ימני', 'צימני', 'ארובה', 'גראג׳', 'גראג',
  'מנעולן', 'גגות', 'גג', 'שטיחים', 'ניקוי', 'שיפוץ', 'שיפוצים', 'גדר', 'גדרות',
  'שרברב', 'אינסטלטור', 'חשמלאי', 'צביעה', 'ריצוף', 'גינון', 'מטבח', 'אמבטיה',
  'בריכה', 'הובלה', 'תיקון', 'התקנה',
]

// Buyer intent keywords
const BUYER_INTENT = [
  'מחפש', 'מחפשת', 'צריך', 'צריכה', 'looking for', 'need',
  'מכיר', 'ממליץ', 'recommend', 'quote', 'estimate', 'הצעת מחיר',
  'מישהו', 'someone', 'anybody', 'anyone', 'עזרה', 'help',
  'tomorrow', 'today', 'מחר', 'היום', 'customer want', 'homeowner',
]

// Location keywords (major US cities)
const LOCATION_KEYWORDS = [
  'miami', 'fort lauderdale', 'hollywood', 'boca raton', 'tampa', 'orlando',
  'new york', 'brooklyn', 'queens', 'long island', 'philadelphia', 'boston',
  'atlanta', 'charlotte', 'houston', 'dallas', 'austin', 'phoenix', 'las vegas',
  'denver', 'los angeles', 'san diego', 'san francisco', 'seattle', 'chicago',
  'detroit', 'cleveland', 'columbus',
  // Hebrew
  'מיאמי', 'ניו יורק', 'לוס אנג׳לס', 'שיקגו', 'פילדלפיה', 'יוסטון',
  'פלורידה', 'טקסס', 'קליפורניה',
]

function shouldProcess(msg) {
  const text = msg.body

  // Skip media-only (no text body)
  if (!text || text.trim() === '') return false

  // Skip too short
  if (text.length < MIN_TEXT_LENGTH) return false

  // Skip bot/system messages
  if (BOT_PATTERNS.test(text)) return false

  // Skip media-only placeholders
  if (MEDIA_ONLY_PATTERN.test(text)) return false

  // Skip emoji-only
  if (EMOJI_ONLY.test(text)) return false

  const lower = text.toLowerCase()
  let signals = 0

  // Check for ZIP code
  if (ZIP_PATTERN.test(text)) signals++

  // Check for job/trade keywords
  for (const kw of JOB_KEYWORDS) {
    if (lower.includes(kw)) { signals++; break }
  }

  // Check for buyer intent
  for (const kw of BUYER_INTENT) {
    if (lower.includes(kw)) { signals++; break }
  }

  // Check for location
  for (const loc of LOCATION_KEYWORDS) {
    if (lower.includes(loc)) { signals++; break }
  }

  // Pass if 2+ signals, or 1 signal + long message (>50 chars)
  if (signals >= 2) return true
  if (signals >= 1 && text.length > 50) return true

  return false
}

// ─── Pipeline event logging to Supabase ─────────────────
async function logPipelineEvent(groupWaId, messageId, senderId, stage, detail = {}) {
  try {
    // Resolve group UUID
    const { data: group } = await supabase
      .from('groups')
      .select('id')
      .eq('wa_group_id', groupWaId)
      .single()

    await supabase.from('pipeline_events').insert({
      group_id: group?.id || null,
      wa_message_id: messageId,
      sender_id: senderId,
      stage,
      detail,
      lead_id: null,
    })
  } catch (err) {
    log('error', `Pipeline event log failed: ${err.message}`)
  }
}

// ─── Config ──────────────────────────────────────────────
const PROXY = process.env.PROXY || null
const PHONE = process.env.PHONE || 'unknown'
const POLL_INTERVAL_MS = 2 * 60 * 1000        // 2 min
const JOIN_DELAY_MIN_MS = 60 * 1000            // 60s min between joins
const JOIN_DELAY_MAX_MS = 120 * 1000           // 120s max
const MAX_JOINS_PER_DAY = 3                    // Conservative per account
const HEALTH_INTERVAL_MS = 30 * 1000           // 30s heartbeat

// ─── Daily join counter ──────────────────────────────────
let joinsToday = 0
let lastJoinDate = new Date().toDateString()
let _joinsLoadedFromDb = false

async function loadJoinsFromDb() {
  if (_joinsLoadedFromDb) return
  try {
    const { data } = await supabase
      .from('scanner_accounts')
      .select('joins_today')
      .eq('account_id', ACCOUNT_ID)
      .single()
    if (data?.joins_today) joinsToday = data.joins_today
    _joinsLoadedFromDb = true
  } catch { /* will default to 0 */ }
}

async function resetDailyCounter() {
  const today = new Date().toDateString()
  if (today !== lastJoinDate) {
    joinsToday = 0
    lastJoinDate = today
    // Also reset in DB
    const { error } = await supabase.from('scanner_accounts')
      .update({ joins_today: 0, joins_today_reset_at: new Date().toISOString() })
      .eq('account_id', ACCOUNT_ID)
    if (error) log('error', `Failed to reset daily counter: ${error.message}`)
  }
}

// ─── Puppeteer args + proxy auth ─────────────────────────
const puppeteerArgs = ['--no-sandbox', '--disable-setuid-sandbox']
let proxyAuth = undefined
if (PROXY) {
  try {
    const proxyUrl = new URL(PROXY)
    puppeteerArgs.push(`--proxy-server=${proxyUrl.protocol}//${proxyUrl.hostname}:${proxyUrl.port}`)
    if (proxyUrl.username && proxyUrl.password) {
      proxyAuth = { username: decodeURIComponent(proxyUrl.username), password: decodeURIComponent(proxyUrl.password) }
    }
    log('info', `Using proxy: ${proxyUrl.hostname}:${proxyUrl.port} (auth: ${proxyAuth ? 'yes' : 'no'})`)
  } catch (e) {
    log('error', `Invalid PROXY URL: ${PROXY}`)
  }
}

// ─── WhatsApp Client ─────────────────────────────────────
const client = new Client({
  authStrategy: new LocalAuth({ dataPath: '/app/data/.wwebjs_auth' }),
  proxyAuthentication: proxyAuth,
  puppeteer: {
    headless: true,
    args: puppeteerArgs,
  },
})

// ─── QR Code ─────────────────────────────────────────────
let latestQR = null

client.on('qr', async (qr) => {
  latestQR = qr
  log('info', 'QR code generated — scan with phone')
  qrcode.generate(qr, { small: true })

  await updateAccountStatus('qr_needed')
})

client.on('authenticated', async () => {
  latestQR = null
  log('info', 'Authenticated')
})

client.on('auth_failure', async (msg) => {
  log('error', `Auth failed: ${msg}`)
  await updateAccountStatus('disconnected', msg)
})

client.on('ready', async () => {
  log('info', `Scanner ready! Phone: ${PHONE}`)
  await updateAccountStatus('active')

  // Start loops
  pollPendingGroups()
  setInterval(pollPendingGroups, POLL_INTERVAL_MS)
  setInterval(sendHeartbeat, HEALTH_INTERVAL_MS)
  sendHeartbeat()
})

client.on('disconnected', async (reason) => {
  log('error', `Disconnected: ${reason}`)
  await updateAccountStatus('disconnected', reason)
  // Try to reconnect after 30s
  setTimeout(() => {
    log('info', 'Attempting reconnection...')
    client.initialize()
  }, 30000)
})

// ─── Listen to group messages ────────────────────────────
client.on('message', async (msg) => {
  try {
    const chat = await msg.getChat()
    if (!chat.isGroup) return

    const groupWaId = chat.id._serialized

    // Check if I'm primary for this group
    const { data: assignment } = await supabase
      .from('scanner_account_groups')
      .select('role')
      .eq('group_wa_id', groupWaId)
      .eq('account_id', (await getAccountDbId()))
      .single()

    // Only primary writes to queue
    if (!assignment || assignment.role !== 'primary') return

    const waMessageId = msg.id._serialized
    const senderId = msg.author || null

    // ── FIX 1: Smart pre-filter — skip junk before enqueue ──
    if (!shouldProcess(msg)) {
      await logPipelineEvent(groupWaId, waMessageId, senderId, 'scanner_filtered', {
        reason: !msg.body ? 'no_text' : msg.body.length < MIN_TEXT_LENGTH ? 'too_short' : 'no_signals',
        textLength: msg.body?.length || 0,
      })
      return
    }

    // ── FIX 2: Redis dedup — skip already-seen messages ──
    if (await isDuplicate(waMessageId)) {
      log('debug', `Duplicate message skipped: ${waMessageId}`)
      return
    }

    // ── FIX 4: Log pipeline event — message received ──
    await logPipelineEvent(groupWaId, waMessageId, senderId, 'received', {
      groupName: chat.name,
      textLength: msg.body.length,
      source: 'scanner',
    })

    // Get or create group in groups table
    let { data: group } = await supabase
      .from('groups')
      .select('id')
      .eq('wa_group_id', groupWaId)
      .single()

    if (!group) {
      const { data: newGroup } = await supabase
        .from('groups')
        .upsert({
          wa_group_id: groupWaId,
          name: chat.name || 'Unknown Group',
          status: 'active',
        }, { onConflict: 'wa_group_id' })
        .select('id')
        .single()
      group = newGroup
    }

    if (!group) return

    // Enqueue to BullMQ (same format as Green API listener)
    try {
      await enqueueMessage({
        messageId: waMessageId,
        groupId: groupWaId,
        body: msg.body,
        sender: senderId,
        senderId: senderId,
        timestamp: msg.timestamp || Math.floor(Date.now() / 1000),
        accountId: ACCOUNT_ID,
      })

      // ── FIX 4: Log pipeline event — enqueued ──
      await logPipelineEvent(groupWaId, waMessageId, senderId, 'enqueued', {
        source: 'scanner',
      })

      log('info', `Message queued from ${chat.name}`, {
        preview: msg.body.substring(0, 50),
      })
    } catch (enqueueErr) {
      // ── FIX 4: Log pipeline event — enqueue failed ──
      await logPipelineEvent(groupWaId, waMessageId, senderId, 'enqueue_failed', {
        error: String(enqueueErr),
        source: 'scanner',
      })
      throw enqueueErr
    }
  } catch (err) {
    log('error', `Message handler error: ${err.message}`)
  }
})

// ─── Poll for pending groups to join ─────────────────────
async function pollPendingGroups() {
  await loadJoinsFromDb()
  await resetDailyCounter()

  if (joinsToday >= MAX_JOINS_PER_DAY) return

  try {
    // Check if there are pending scan requests assigned to this account
    // OR unassigned pending requests we can pick up
    const [contractorRes, adminRes] = await Promise.all([
      supabase
        .from('contractor_group_scan_requests')
        .select('id, invite_code, invite_link_raw')
        .eq('status', 'pending')
        .not('invite_code', 'is', null)
        .order('created_at', { ascending: true })
        .limit(1),
      supabase
        .from('admin_group_scan_entries')
        .select('id, invite_code, invite_link_raw')
        .eq('status', 'pending')
        .not('invite_code', 'is', null)
        .order('created_at', { ascending: true })
        .limit(1),
    ])

    const pending = [
      ...(contractorRes.data || []).map(r => ({ ...r, source: 'contractor' })),
      ...(adminRes.data || []).map(r => ({ ...r, source: 'admin' })),
    ]

    if (pending.length === 0) return

    // Only join one group per poll cycle
    const entry = pending[0]
    await joinGroup(entry)
    joinsToday++

    // Update counter in DB
    await supabase
      .from('scanner_accounts')
      .update({ joins_today: joinsToday })
      .eq('account_id', ACCOUNT_ID)
  } catch (err) {
    log('error', `Poll error: ${err.message}`)
  }
}

// ─── Join a single group ─────────────────────────────────
async function joinGroup(entry) {
  const { id, invite_code, source } = entry
  const table = source === 'contractor'
    ? 'contractor_group_scan_requests'
    : 'admin_group_scan_entries'

  log('info', `Joining group: ${invite_code} (${source})`)

  // Random delay before join (anti-pattern detection)
  const delay = randomDelay(JOIN_DELAY_MIN_MS, JOIN_DELAY_MAX_MS)
  log('info', `Waiting ${Math.round(delay / 1000)}s before join...`)
  await sleep(delay)

  try {
    const chatId = await client.acceptInvite(invite_code)
    log('info', `Joined! Chat ID: ${chatId}`)

    const chat = await client.getChatById(chatId)
    const groupName = chat.name || null
    const memberCount = chat.participants ? chat.participants.length : null
    const waGroupId = typeof chatId === 'string' ? chatId : chatId._serialized

    // Update scan request
    await supabase
      .from(table)
      .update({
        status: 'joined',
        join_method: 'auto',
        group_name: groupName,
        member_count: memberCount,
      })
      .eq('id', id)

    // Upsert group
    await supabase
      .from('groups')
      .upsert({
        wa_group_id: waGroupId,
        name: groupName || `Group ${invite_code.substring(0, 8)}`,
        status: 'active',
      }, { onConflict: 'wa_group_id' })

    // Register this account as primary for the group
    // (first account to join becomes primary)
    const accountDbId = await getAccountDbId()
    if (accountDbId) {
      const { data: existing } = await supabase
        .from('scanner_account_groups')
        .select('id')
        .eq('group_wa_id', waGroupId)
        .eq('role', 'primary')
        .single()

      await supabase
        .from('scanner_account_groups')
        .upsert({
          account_id: accountDbId,
          group_wa_id: waGroupId,
          role: existing ? 'backup' : 'primary',
        }, { onConflict: 'account_id,group_wa_id' })

      // Update groups_joined count
      await supabase
        .from('scanner_accounts')
        .update({ groups_joined: (await getGroupCount()) })
        .eq('account_id', ACCOUNT_ID)
    }

    log('info', `Joined: ${groupName || 'Unknown'} — ${memberCount || '?'} members`)
  } catch (err) {
    const errorMsg = err.message || String(err)
    log('error', `Failed to join ${invite_code}: ${errorMsg}`)

    const isPrivate = errorMsg.includes('revoked') || errorMsg.includes('private')

    await supabase
      .from(table)
      .update({
        status: isPrivate ? 'blocked_private' : 'failed',
        last_error: errorMsg.substring(0, 500),
      })
      .eq('id', id)
  }
}

// ─── Health / Status ─────────────────────────────────────
async function sendHeartbeat() {
  try {
    await supabase
      .from('scanner_accounts')
      .update({ last_health_at: new Date().toISOString() })
      .eq('account_id', ACCOUNT_ID)
  } catch (err) {
    log('error', `Heartbeat error: ${err.message}`)
  }
}

async function updateAccountStatus(status, error = null) {
  try {
    const update = { status, last_health_at: new Date().toISOString() }
    if (error) update.last_error = String(error).substring(0, 500)
    await supabase
      .from('scanner_accounts')
      .update(update)
      .eq('account_id', ACCOUNT_ID)
  } catch (err) {
    log('error', `Status update error: ${err.message}`)
  }
}

// ─── DB helpers ──────────────────────────────────────────
let _accountDbId = null

async function getAccountDbId() {
  if (_accountDbId) return _accountDbId
  const { data } = await supabase
    .from('scanner_accounts')
    .select('id')
    .eq('account_id', ACCOUNT_ID)
    .single()
  _accountDbId = data?.id || null
  return _accountDbId
}

async function getGroupCount() {
  const accountDbId = await getAccountDbId()
  if (!accountDbId) return 0
  const { count } = await supabase
    .from('scanner_account_groups')
    .select('id', { count: 'exact', head: true })
    .eq('account_id', accountDbId)
  return count || 0
}

// ─── Graceful shutdown ───────────────────────────────────
async function shutdown() {
  log('info', 'Shutting down...')
  await updateAccountStatus('disconnected')
  if (dedupRedis) {
    await dedupRedis.quit().catch(() => {})
    dedupRedis = null
  }
  await client.destroy().catch(() => {})
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

// ─── Start ───────────────────────────────────────────────
log('info', `Initializing scanner [${ACCOUNT_ID}] [${PHONE}]`)
client.initialize()
