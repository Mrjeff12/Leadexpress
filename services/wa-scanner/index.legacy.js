/**
 * WhatsApp Group Scanner
 *
 * Polls Supabase for pending group scan requests,
 * joins groups via invite link, and listens for lead messages.
 *
 * Uses whatsapp-web.js on a SEPARATE phone number (expendable).
 * Green API stays on the main number for outreach.
 */

const { Client, LocalAuth } = require('whatsapp-web.js')
const qrcode = require('qrcode-terminal')
const { createClient } = require('@supabase/supabase-js')

// ─── Config ──────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY
const POLL_INTERVAL_MS = 2 * 60 * 1000       // Check for pending groups every 2 min
const JOIN_DELAY_MS = 60 * 1000              // Wait 60s between joins (anti-ban)
const MAX_JOINS_PER_DAY = 5                   // Max groups to join per day (safe limit)

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// Track daily joins
let joinsToday = 0
let lastJoinDate = new Date().toDateString()

function resetDailyCounter() {
  const today = new Date().toDateString()
  if (today !== lastJoinDate) {
    joinsToday = 0
    lastJoinDate = today
  }
}

// ─── WhatsApp Client ─────────────────────────────────────
const client = new Client({
  authStrategy: new LocalAuth({ dataPath: './.wwebjs_auth' }),
  puppeteer: {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  },
})

// ─── QR Code ─────────────────────────────────────────────
client.on('qr', (qr) => {
  console.log('\n📱 Scan this QR code with the SCANNER phone number:\n')
  qrcode.generate(qr, { small: true })
  console.log('\n⚠️  Use a SEPARATE number, not your main WhatsApp!\n')
})

client.on('authenticated', () => {
  console.log('✅ Authenticated successfully')
})

client.on('auth_failure', (msg) => {
  console.error('❌ Auth failed:', msg)
})

client.on('ready', () => {
  console.log('🚀 WhatsApp Scanner is ready!')
  console.log(`   Polling every ${POLL_INTERVAL_MS / 1000}s`)
  console.log(`   Max ${MAX_JOINS_PER_DAY} joins/day, ${JOIN_DELAY_MS / 1000}s between joins`)

  // Start polling for pending groups
  pollPendingGroups()
  setInterval(pollPendingGroups, POLL_INTERVAL_MS)
})

// ─── Listen to group messages ────────────────────────────
client.on('message', async (msg) => {
  try {
    const chat = await msg.getChat()
    if (!chat.isGroup) return

    // Only process groups we joined via scanner
    const groupId = chat.id._serialized
    const { data: knownGroup } = await supabase
      .from('groups')
      .select('id')
      .eq('wa_group_id', groupId)
      .single()

    if (!knownGroup) return

    // Skip non-text messages
    if (!msg.body || msg.body.length < 10) return

    // Deduplicate by wa_message_id
    const waMessageId = msg.id._serialized
    const { data: existing } = await supabase
      .from('leads')
      .select('id')
      .eq('wa_message_id', waMessageId)
      .single()

    if (existing) return

    // Save as raw lead — the parser service will process it
    const { error } = await supabase
      .from('leads')
      .insert({
        group_id: knownGroup.id,
        wa_message_id: waMessageId,
        raw_message: msg.body,
        status: 'new',
      })

    if (error) {
      // Unique constraint = duplicate, ignore
      if (error.code === '23505') return
      console.error('Failed to save lead:', error.message)
    } else {
      console.log(`📩 New lead from ${chat.name}: ${msg.body.substring(0, 50)}...`)
    }
  } catch (err) {
    console.error('Error processing message:', err.message)
  }
})

// ─── Poll DB for pending groups ──────────────────────────
async function pollPendingGroups() {
  resetDailyCounter()

  if (joinsToday >= MAX_JOINS_PER_DAY) {
    console.log(`⏸️  Daily join limit reached (${MAX_JOINS_PER_DAY}). Waiting for tomorrow.`)
    return
  }

  try {
    // Get pending entries from both tables via the queue view
    // We query both tables directly since views + service key work better
    const [contractorRes, adminRes] = await Promise.all([
      supabase
        .from('contractor_group_scan_requests')
        .select('id, invite_code, invite_link_raw')
        .eq('status', 'pending')
        .not('invite_code', 'is', null)
        .order('created_at', { ascending: true })
        .limit(MAX_JOINS_PER_DAY - joinsToday),
      supabase
        .from('admin_group_scan_entries')
        .select('id, invite_code, invite_link_raw')
        .eq('status', 'pending')
        .not('invite_code', 'is', null)
        .order('created_at', { ascending: true })
        .limit(MAX_JOINS_PER_DAY - joinsToday),
    ])

    const pending = [
      ...(contractorRes.data || []).map(r => ({ ...r, source: 'contractor' })),
      ...(adminRes.data || []).map(r => ({ ...r, source: 'admin' })),
    ]

    if (pending.length === 0) return

    console.log(`\n🔍 Found ${pending.length} pending group(s) to join`)

    for (const entry of pending) {
      if (joinsToday >= MAX_JOINS_PER_DAY) break

      await joinGroup(entry)
      joinsToday++

      // Delay between joins (anti-ban)
      if (joinsToday < MAX_JOINS_PER_DAY && pending.indexOf(entry) < pending.length - 1) {
        console.log(`⏳ Waiting ${JOIN_DELAY_MS / 1000}s before next join...`)
        await sleep(JOIN_DELAY_MS)
      }
    }
  } catch (err) {
    console.error('Poll error:', err.message)
  }
}

// ─── Join a single group ─────────────────────────────────
async function joinGroup(entry) {
  const { id, invite_code, source } = entry
  const table = source === 'contractor'
    ? 'contractor_group_scan_requests'
    : 'admin_group_scan_entries'

  console.log(`🔗 Joining group: ${invite_code} (${source})`)

  try {
    // Accept the invite
    const chatId = await client.acceptInvite(invite_code)
    console.log(`✅ Joined! Chat ID: ${chatId}`)

    // Get group metadata
    const chat = await client.getChatById(chatId)
    const groupName = chat.name || null
    const memberCount = chat.participants ? chat.participants.length : null

    // Update scan request status
    await supabase
      .from(table)
      .update({
        status: 'joined',
        join_method: 'auto',
        group_name: groupName,
        member_count: memberCount,
      })
      .eq('id', id)

    // Upsert into groups table so leads can reference it
    const waGroupId = chatId._serialized || chatId
    const { error: groupError } = await supabase
      .from('groups')
      .upsert({
        wa_group_id: waGroupId,
        name: groupName || `Group ${invite_code.substring(0, 8)}`,
        status: 'active',
      }, {
        onConflict: 'wa_group_id',
      })

    if (groupError) {
      console.error('Failed to upsert group:', groupError.message)
    }

    console.log(`📊 ${groupName || 'Unknown'} — ${memberCount || '?'} members`)

  } catch (err) {
    const errorMsg = err.message || String(err)
    console.error(`❌ Failed to join ${invite_code}:`, errorMsg)

    // Determine failure type
    const isPrivate = errorMsg.includes('invite') && errorMsg.includes('revoked')
      || errorMsg.includes('private')

    await supabase
      .from(table)
      .update({
        status: isPrivate ? 'blocked_private' : 'failed',
        last_error: errorMsg.substring(0, 500),
      })
      .eq('id', id)
  }
}

// ─── Helpers ─────────────────────────────────────────────
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ─── Graceful shutdown ───────────────────────────────────
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down scanner...')
  await client.destroy()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  console.log('\n🛑 Shutting down scanner...')
  await client.destroy()
  process.exit(0)
})

// ─── Start ───────────────────────────────────────────────
console.log('🔄 Initializing WhatsApp Scanner...')
console.log('   This may take a minute on first run (downloading Chromium)\n')
client.initialize()
