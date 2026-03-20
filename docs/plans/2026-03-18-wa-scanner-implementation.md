# WhatsApp Multi-Account Scanner — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a Docker-based multi-account WhatsApp group scanner that joins groups via invite links, listens to messages, and feeds them into the existing BullMQ raw-messages pipeline.

**Architecture:** Each WhatsApp account runs in its own Docker container with a unique phone number and SOCKS5 proxy. A coordinator API container manages health checks, QR authentication, and join orchestration. All workers push messages to the same BullMQ `raw-messages` queue consumed by the existing parser → matching → notification pipeline.

**Tech Stack:** whatsapp-web.js, Express, BullMQ, Supabase (service key), Docker Compose, SOCKS5 proxies via puppeteer-extra proxy plugin

**Design Doc:** `docs/plans/2026-03-18-wa-scanner-multi-account-design.md`

---

### Task 1: Supabase Migration — Scanner Account Tables

**Files:**
- Create: `supabase/migrations/027_scanner_accounts.sql`

**Step 1: Write the migration**

```sql
-- 027_scanner_accounts.sql

-- Scanner accounts: one row per WhatsApp phone number
CREATE TABLE public.scanner_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id text NOT NULL UNIQUE,           -- e.g. 'scan-1', 'scan-2'
  phone_number text NOT NULL,                -- e.g. '+1234567890'
  proxy_url text,                            -- e.g. 'socks5://user:pass@ip:port'
  status text NOT NULL DEFAULT 'disconnected'
    CHECK (status IN ('active','qr_needed','banned','disconnected')),
  groups_joined integer NOT NULL DEFAULT 0,
  joins_today integer NOT NULL DEFAULT 0,
  joins_today_reset_at timestamptz NOT NULL DEFAULT now(),
  last_health_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_scanner_accounts_status ON public.scanner_accounts(status);

-- Junction: which account is in which group, as primary or backup
CREATE TABLE public.scanner_account_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.scanner_accounts(id) ON DELETE CASCADE,
  group_wa_id text NOT NULL,
  role text NOT NULL DEFAULT 'backup' CHECK (role IN ('primary','backup')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(account_id, group_wa_id)
);

CREATE INDEX idx_scanner_account_groups_group ON public.scanner_account_groups(group_wa_id);
CREATE INDEX idx_scanner_account_groups_role ON public.scanner_account_groups(role, group_wa_id);

-- RLS: service key only (no browser access needed)
ALTER TABLE public.scanner_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scanner_account_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "scanner_accounts_admin_all" ON public.scanner_accounts
  FOR ALL USING (public.is_admin());

CREATE POLICY "scanner_account_groups_admin_all" ON public.scanner_account_groups
  FOR ALL USING (public.is_admin());

-- Trigger for updated_at
CREATE TRIGGER update_scanner_accounts_updated_at
  BEFORE UPDATE ON public.scanner_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
```

**Step 2: Run migration**

```bash
node run-migration.js 027_scanner_accounts
# Or apply directly via Supabase dashboard SQL editor
```

**Step 3: Commit**

```bash
git add supabase/migrations/027_scanner_accounts.sql
git commit -m "feat: add scanner_accounts + scanner_account_groups tables"
```

---

### Task 2: Shared Utilities — Supabase + Redis + Logging

**Files:**
- Create: `services/wa-scanner/src/utils.js`

**Step 1: Write utils.js**

```js
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
```

**Step 2: Commit**

```bash
git add services/wa-scanner/src/utils.js
git commit -m "feat: scanner shared utils — supabase, bullmq, logging"
```

---

### Task 3: Worker — WhatsApp Client per Account

**Files:**
- Rewrite: `services/wa-scanner/src/worker.js` (replaces old `index.js`)
- Delete: `services/wa-scanner/index.js`

**Step 1: Write worker.js**

This is the main per-container process. Each container runs one instance with its own ACCOUNT_ID, PHONE, and PROXY env vars.

```js
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

// ─── Puppeteer args ──────────────────────────────────────
const puppeteerArgs = ['--no-sandbox', '--disable-setuid-sandbox']
if (PROXY) {
  // SOCKS5 proxy: socks5://user:pass@host:port
  // Puppeteer needs --proxy-server=socks5://host:port
  // Auth handled separately via page.authenticate if needed
  try {
    const proxyUrl = new URL(PROXY)
    puppeteerArgs.push(`--proxy-server=${proxyUrl.protocol}//${proxyUrl.hostname}:${proxyUrl.port}`)
    log('info', `Using proxy: ${proxyUrl.hostname}:${proxyUrl.port}`)
  } catch (e) {
    log('error', `Invalid PROXY URL: ${PROXY}`)
  }
}

// ─── WhatsApp Client ─────────────────────────────────────
const client = new Client({
  authStrategy: new LocalAuth({ dataPath: '/app/data/.wwebjs_auth' }),
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
```

**Step 2: Delete old index.js**

```bash
rm services/wa-scanner/index.js
```

**Step 3: Commit**

```bash
git add services/wa-scanner/src/worker.js
git rm services/wa-scanner/index.js
git commit -m "feat: scanner worker — multi-account with proxy, heartbeat, primary/backup"
```

---

### Task 4: Coordinator API Server

**Files:**
- Create: `services/wa-scanner/src/api.js`

**Step 1: Write api.js**

The coordinator exposes health/status endpoints and serves QR codes to the admin dashboard.

```js
const express = require('express')
const { supabase, log } = require('./utils')

const PORT = process.env.API_PORT || 4000
const HEALTH_TIMEOUT_MS = 90 * 1000 // 90s = considered dead

const app = express()
app.use(express.json())

// ─── GET /health — All accounts status ───────────────────
app.get('/health', async (req, res) => {
  try {
    const { data: accounts } = await supabase
      .from('scanner_accounts')
      .select('account_id, phone_number, status, groups_joined, joins_today, last_health_at, last_error')
      .order('account_id')

    const now = Date.now()
    const enriched = (accounts || []).map(a => ({
      ...a,
      is_alive: a.last_health_at
        ? (now - new Date(a.last_health_at).getTime()) < HEALTH_TIMEOUT_MS
        : false,
    }))

    const active = enriched.filter(a => a.is_alive).length
    const total = enriched.length

    res.json({
      status: active > 0 ? 'operational' : 'degraded',
      active_accounts: active,
      total_accounts: total,
      accounts: enriched,
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ─── GET /accounts/:id/groups — Groups for an account ────
app.get('/accounts/:accountId/groups', async (req, res) => {
  try {
    const { data: account } = await supabase
      .from('scanner_accounts')
      .select('id')
      .eq('account_id', req.params.accountId)
      .single()

    if (!account) return res.status(404).json({ error: 'Account not found' })

    const { data: groups } = await supabase
      .from('scanner_account_groups')
      .select('group_wa_id, role, joined_at')
      .eq('account_id', account.id)
      .order('joined_at', { ascending: false })

    res.json(groups || [])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ─── POST /accounts — Register a new account ────────────
app.post('/accounts', async (req, res) => {
  try {
    const { account_id, phone_number, proxy_url } = req.body
    if (!account_id || !phone_number) {
      return res.status(400).json({ error: 'account_id and phone_number required' })
    }

    const { data, error } = await supabase
      .from('scanner_accounts')
      .upsert({
        account_id,
        phone_number,
        proxy_url: proxy_url || null,
        status: 'disconnected',
      }, { onConflict: 'account_id' })
      .select()
      .single()

    if (error) return res.status(400).json({ error: error.message })
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ─── Failover check (runs every 60s) ────────────────────
async function checkFailovers() {
  try {
    const cutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString() // 5 min ago

    // Find primary assignments where account is dead
    const { data: deadPrimaries } = await supabase
      .from('scanner_account_groups')
      .select(`
        id, group_wa_id, account_id,
        scanner_accounts!inner(account_id, status, last_health_at)
      `)
      .eq('role', 'primary')
      .or(`status.eq.banned,status.eq.disconnected,last_health_at.lt.${cutoff}`, {
        referencedTable: 'scanner_accounts',
      })

    if (!deadPrimaries || deadPrimaries.length === 0) return

    for (const dead of deadPrimaries) {
      // Find a healthy backup for this group
      const { data: backup } = await supabase
        .from('scanner_account_groups')
        .select(`
          id, account_id,
          scanner_accounts!inner(account_id, status, last_health_at)
        `)
        .eq('group_wa_id', dead.group_wa_id)
        .eq('role', 'backup')
        .eq('scanner_accounts.status', 'active')
        .gt('scanner_accounts.last_health_at', cutoff)
        .limit(1)
        .single()

      if (backup) {
        // Demote dead primary → backup
        await supabase
          .from('scanner_account_groups')
          .update({ role: 'backup' })
          .eq('id', dead.id)

        // Promote backup → primary
        await supabase
          .from('scanner_account_groups')
          .update({ role: 'primary' })
          .eq('id', backup.id)

        log('info', `Failover: ${dead.group_wa_id} — demoted ${dead.scanner_accounts.account_id}, promoted ${backup.scanner_accounts.account_id}`)
      }
    }
  } catch (err) {
    log('error', `Failover check error: ${err.message}`)
  }
}

// Run failover check every 60s
setInterval(checkFailovers, 60 * 1000)

// ─── Start ───────────────────────────────────────────────
app.listen(PORT, () => {
  log('info', `Scanner API running on port ${PORT}`)
})
```

**Step 2: Commit**

```bash
git add services/wa-scanner/src/api.js
git commit -m "feat: scanner coordinator API — health, accounts, failover"
```

---

### Task 5: Dockerfile

**Files:**
- Create: `services/wa-scanner/Dockerfile`

**Step 1: Write Dockerfile**

```dockerfile
FROM node:20-slim

# Install Chromium dependencies for whatsapp-web.js
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libxss1 \
    xdg-utils \
    --no-install-recommends \
  && rm -rf /var/lib/apt/lists/*

# Tell Puppeteer to use installed Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

COPY src/ ./src/

# Default command: worker (override for api)
CMD ["node", "src/worker.js"]
```

**Step 2: Create .dockerignore**

```
node_modules
data
.wwebjs_auth
*.md
```

**Step 3: Commit**

```bash
git add services/wa-scanner/Dockerfile services/wa-scanner/.dockerignore
git commit -m "feat: scanner Dockerfile with Chromium for whatsapp-web.js"
```

---

### Task 6: Docker Compose for Scanner VPS

**Files:**
- Create: `services/wa-scanner/docker-compose.yml`
- Create: `services/wa-scanner/.env.example`

**Step 1: Write docker-compose.yml**

```yaml
version: '3.8'

services:
  # ─── Coordinator API ───────────────────────────────
  scanner-api:
    build: .
    command: node src/api.js
    ports:
      - "4000:4000"
    environment:
      - API_PORT=4000
    env_file: .env
    restart: unless-stopped
    deploy:
      resources:
        limits:
          memory: 256M

  # ─── Scanner Account 1 ────────────────────────────
  scan-1:
    build: .
    environment:
      - ACCOUNT_ID=scan-1
      - PHONE=${SCAN_1_PHONE}
      - PROXY=${SCAN_1_PROXY:-}
    env_file: .env
    volumes:
      - ./data/scan-1:/app/data
    restart: unless-stopped
    deploy:
      resources:
        limits:
          memory: 512M

  # ─── Scanner Account 2 ────────────────────────────
  scan-2:
    build: .
    environment:
      - ACCOUNT_ID=scan-2
      - PHONE=${SCAN_2_PHONE}
      - PROXY=${SCAN_2_PROXY:-}
    env_file: .env
    volumes:
      - ./data/scan-2:/app/data
    restart: unless-stopped
    deploy:
      resources:
        limits:
          memory: 512M

  # ─── Scanner Account 3 ────────────────────────────
  scan-3:
    build: .
    environment:
      - ACCOUNT_ID=scan-3
      - PHONE=${SCAN_3_PHONE}
      - PROXY=${SCAN_3_PROXY:-}
    env_file: .env
    volumes:
      - ./data/scan-3:/app/data
    restart: unless-stopped
    deploy:
      resources:
        limits:
          memory: 512M

# Add more scan-N services as needed by copying the pattern above
```

**Step 2: Write .env.example**

```bash
# Supabase (same as main project)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-key

# Redis (connect to main server's Redis, or use Redis Cloud)
REDIS_HOST=your-main-server-ip
REDIS_PORT=6379
REDIS_PASSWORD=

# Scanner Account 1
SCAN_1_PHONE=+1234567890
SCAN_1_PROXY=socks5://user:pass@proxy1:1080

# Scanner Account 2
SCAN_2_PHONE=+1234567891
SCAN_2_PROXY=socks5://user:pass@proxy2:1080

# Scanner Account 3
SCAN_3_PHONE=+1234567892
SCAN_3_PROXY=socks5://user:pass@proxy3:1080
```

**Step 3: Commit**

```bash
git add services/wa-scanner/docker-compose.yml services/wa-scanner/.env.example
git commit -m "feat: scanner docker-compose with 3 accounts + coordinator"
```

---

### Task 7: Update package.json Dependencies

**Files:**
- Modify: `services/wa-scanner/package.json`

**Step 1: Update package.json with all needed deps**

```json
{
  "name": "wa-scanner",
  "version": "2.0.0",
  "description": "Multi-account WhatsApp group scanner with Docker + proxy support",
  "scripts": {
    "start": "node src/worker.js",
    "api": "node src/api.js"
  },
  "dependencies": {
    "whatsapp-web.js": "^1.26.0",
    "qrcode-terminal": "^0.12.0",
    "@supabase/supabase-js": "^2.49.1",
    "bullmq": "^5.34.0",
    "express": "^4.21.0"
  }
}
```

**Step 2: Install and generate lockfile**

```bash
cd services/wa-scanner && npm install
```

**Step 3: Commit**

```bash
git add services/wa-scanner/package.json services/wa-scanner/package-lock.json
git commit -m "feat: scanner dependencies — bullmq, express, whatsapp-web.js"
```

---

### Task 8: .gitignore for Scanner

**Files:**
- Create: `services/wa-scanner/.gitignore`

**Step 1: Write .gitignore**

```
node_modules/
data/
.wwebjs_auth/
.env
```

**Step 2: Commit**

```bash
git add services/wa-scanner/.gitignore
git commit -m "chore: scanner gitignore — sessions, data, env"
```

---

### Task 9: Seed Scanner Accounts in DB

**Step 1: Register accounts in Supabase**

Run this SQL in Supabase dashboard (or via a seed script) for initial accounts:

```sql
INSERT INTO public.scanner_accounts (account_id, phone_number, proxy_url, status)
VALUES
  ('scan-1', '+1XXXXXXXXXX', 'socks5://user:pass@proxy1:1080', 'disconnected'),
  ('scan-2', '+1XXXXXXXXXX', 'socks5://user:pass@proxy2:1080', 'disconnected'),
  ('scan-3', '+1XXXXXXXXXX', 'socks5://user:pass@proxy3:1080', 'disconnected')
ON CONFLICT (account_id) DO NOTHING;
```

Replace phone numbers and proxy URLs with real values.

---

### Task 10: Test Single Account Locally (Smoke Test)

**Step 1: Start one worker locally without Docker**

```bash
cd services/wa-scanner
SUPABASE_URL=https://zyytzwlvtuhgbjpalbgd.supabase.co \
SUPABASE_SERVICE_KEY=<key> \
REDIS_HOST=localhost \
REDIS_PORT=6379 \
ACCOUNT_ID=scan-1 \
PHONE=+1234567890 \
node src/worker.js
```

**Step 2: Verify**
- QR code should appear in terminal
- After scanning: `Scanner ready!` log
- Status in `scanner_accounts` table should update to `active`
- Heartbeat should update every 30s

**Step 3: Test coordinator API**

```bash
SUPABASE_URL=https://zyytzwlvtuhgbjpalbgd.supabase.co \
SUPABASE_SERVICE_KEY=<key> \
node src/api.js
```

Then: `curl http://localhost:4000/health`

Expected: JSON with accounts list and status

---

### Task 11: Deploy to VPS

**Step 1: Provision VPS**

Hetzner CX31 (8GB RAM, 4 vCPU) — ~$15/month

**Step 2: Install Docker**

```bash
curl -fsSL https://get.docker.com | sh
```

**Step 3: Clone and configure**

```bash
git clone <repo> /opt/wa-scanner
cd /opt/wa-scanner/services/wa-scanner
cp .env.example .env
# Edit .env with real values
```

**Step 4: Build and start**

```bash
docker compose build
docker compose up -d
```

**Step 5: Check logs for QR codes**

```bash
docker compose logs scan-1 -f
# Scan QR code with phone 1
docker compose logs scan-2 -f
# Scan QR code with phone 2
```

**Step 6: Verify health**

```bash
curl http://localhost:4000/health
```

---

## Summary of Files

| File | Purpose |
|------|---------|
| `supabase/migrations/027_scanner_accounts.sql` | DB tables for accounts + group assignments |
| `services/wa-scanner/src/utils.js` | Shared: Supabase, BullMQ, logging |
| `services/wa-scanner/src/worker.js` | Per-account scanner (one per container) |
| `services/wa-scanner/src/api.js` | Coordinator: health, failover, account management |
| `services/wa-scanner/Dockerfile` | Docker image with Chromium |
| `services/wa-scanner/docker-compose.yml` | Multi-container orchestration |
| `services/wa-scanner/.env.example` | Environment template |
| `services/wa-scanner/.gitignore` | Ignore sessions/data |
| `services/wa-scanner/package.json` | Dependencies |
