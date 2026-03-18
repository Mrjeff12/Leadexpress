const { Client, LocalAuth } = require('whatsapp-web.js')
const qrcode = require('qrcode-terminal')
const { supabase, enqueueMessage, log, sleep, randomDelay, ACCOUNT_ID } = require('./utils')

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

function resetDailyCounter() {
  const today = new Date().toDateString()
  if (today !== lastJoinDate) {
    joinsToday = 0
    lastJoinDate = today
    // Also reset in DB
    supabase.from('scanner_accounts')
      .update({ joins_today: 0, joins_today_reset_at: new Date().toISOString() })
      .eq('account_id', ACCOUNT_ID)
      .then(() => {})
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

    // Skip empty/short messages
    if (!msg.body || msg.body.length < 10) return

    const waMessageId = msg.id._serialized

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
    await enqueueMessage({
      messageId: waMessageId,
      groupId: groupWaId,
      body: msg.body,
      sender: msg.author || null,
      senderId: msg.author || null,
      timestamp: msg.timestamp || Math.floor(Date.now() / 1000),
      accountId: ACCOUNT_ID,
    })

    log('info', `Message queued from ${chat.name}`, {
      preview: msg.body.substring(0, 50),
    })
  } catch (err) {
    log('error', `Message handler error: ${err.message}`)
  }
})

// ─── Poll for pending groups to join ─────────────────────
async function pollPendingGroups() {
  resetDailyCounter()

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
  await client.destroy().catch(() => {})
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

// ─── Start ───────────────────────────────────────────────
log('info', `Initializing scanner [${ACCOUNT_ID}] [${PHONE}]`)
client.initialize()
