# Protocol WATCHDOG — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Multi-instance WhatsApp management with health monitoring, auto-sync, alerts, and group discovery.

**Architecture:** Event-driven reactor (state changes) + safety-net cron (health pings, delta sync) + intelligence layer (link scanner, lazy enrichment). Instances are always either `scraper` (read groups) or `sender` (outbound DMs), never hybrid. State stored in Redis for real-time, DB for persistence.

**Tech Stack:** TypeScript, Supabase (Postgres), Redis/BullMQ, Green API, Twilio (alerts)

---

## Phase 0: Data Cleanup & Migration

### Task 1: Archive Old Instance Groups

**Files:**
- Modify: `supabase/migrations/044_watchdog_multi_instance.sql` (create new)

**Step 1: Write migration SQL**

```sql
-- ============================================================
-- 044_watchdog_multi_instance.sql
-- Phase 0: Data cleanup + Phase 1: Schema changes
-- ============================================================

-- ── Phase 0: Archive groups not in current instance ──────────
-- The 13 old-instance groups that are no longer accessible
-- Keep data but mark them so delta sync skips them
ALTER TABLE groups
  ADD COLUMN IF NOT EXISTS instance_status TEXT DEFAULT 'active'
    CHECK (instance_status IN ('active', 'not_in_instance', 'archived')),
  ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sync_status TEXT DEFAULT 'never'
    CHECK (sync_status IN ('never', 'syncing', 'synced', 'failed'));

-- ── Phase 1a: wa_accounts — add role + priority ─────────────
-- Keep wa_accounts lean: identity + credentials + role
ALTER TABLE wa_accounts
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'scraper'
    CHECK (role IN ('scraper', 'sender')),
  ADD COLUMN IF NOT EXISTS priority INTEGER NOT NULL DEFAULT 0;

-- Update status CHECK to include new states
ALTER TABLE wa_accounts DROP CONSTRAINT IF EXISTS wa_accounts_status_check;
ALTER TABLE wa_accounts ADD CONSTRAINT wa_accounts_status_check
  CHECK (status IN ('disconnected', 'waiting_qr', 'connecting', 'connected', 'blocked', 'yellow_card'));

-- ── Phase 1b: wa_account_state (frequent health updates) ────
CREATE TABLE IF NOT EXISTS wa_account_state (
  wa_account_id UUID PRIMARY KEY REFERENCES wa_accounts(id) ON DELETE CASCADE,
  last_health_check TIMESTAMPTZ,
  last_health_ok BOOLEAN DEFAULT true,
  last_sync_at TIMESTAMPTZ,
  last_error TEXT,
  last_error_at TIMESTAMPTZ,
  reconnect_attempts INTEGER NOT NULL DEFAULT 0,
  max_reconnect_attempts INTEGER NOT NULL DEFAULT 5,
  error_count_24h INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Phase 1c: wa_account_rate_limits (sender only) ──────────
CREATE TABLE IF NOT EXISTS wa_account_rate_limits (
  wa_account_id UUID PRIMARY KEY REFERENCES wa_accounts(id) ON DELETE CASCADE,
  daily_message_limit INTEGER NOT NULL DEFAULT 200,
  messages_sent_today INTEGER NOT NULL DEFAULT 0,
  last_reset_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Phase 1d: pending_groups ─────────────────────────────────
CREATE TABLE IF NOT EXISTS pending_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_link TEXT NOT NULL,
  invite_code TEXT NOT NULL,
  source_group_id UUID REFERENCES groups(id) ON DELETE SET NULL,
  source_wa_sender_id TEXT,
  source_wa_message_id TEXT,
  discovered_by_account_id UUID REFERENCES wa_accounts(id) ON DELETE SET NULL,
  group_name TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'joining', 'joined', 'failed', 'ignored', 'duplicate')),
  assigned_account_id UUID REFERENCES wa_accounts(id) ON DELETE SET NULL,
  joined_group_id UUID REFERENCES groups(id) ON DELETE SET NULL,
  last_error TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  reviewed_by UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Partial unique: prevent duplicate ACTIVE processing of same invite
CREATE UNIQUE INDEX IF NOT EXISTS idx_pending_groups_active_invite
  ON pending_groups (invite_code)
  WHERE status IN ('pending', 'approved', 'joining');

-- ── Phase 1e: system_alerts ──────────────────────────────────
CREATE TABLE IF NOT EXISTS system_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wa_account_id UUID REFERENCES wa_accounts(id) ON DELETE SET NULL,
  alert_type TEXT NOT NULL CHECK (alert_type IN (
    'instance_disconnected', 'instance_reconnected', 'instance_degraded',
    'health_check_failed', 'health_check_recovered',
    'rate_limit_approaching', 'rate_limit_hit',
    'pending_group_discovered',
    'account_blocked', 'account_yellow_card',
    'daily_summary', 'sync_completed', 'custom'
  )),
  severity TEXT NOT NULL DEFAULT 'warning'
    CHECK (severity IN ('info', 'warning', 'critical')),
  title TEXT NOT NULL,
  message TEXT,
  detail JSONB NOT NULL DEFAULT '{}'::jsonb,
  channel TEXT NOT NULL DEFAULT 'whatsapp'
    CHECK (channel IN ('whatsapp', 'dashboard', 'log_only')),
  delivered BOOLEAN NOT NULL DEFAULT false,
  delivered_at TIMESTAMPTZ,
  -- Dedup: auto-computed key = type + account
  dedupe_key TEXT GENERATED ALWAYS AS (
    alert_type || ':' || COALESCE(wa_account_id::text, 'global')
  ) STORED,
  dedupe_window_minutes INTEGER NOT NULL DEFAULT 30,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Phase 1f: wa_account_health_log ──────────────────────────
CREATE TABLE IF NOT EXISTS wa_account_health_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wa_account_id UUID NOT NULL REFERENCES wa_accounts(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  is_healthy BOOLEAN NOT NULL,
  response_time_ms INTEGER,
  groups_active INTEGER,
  messages_today INTEGER,
  error_count INTEGER DEFAULT 0,
  detail JSONB NOT NULL DEFAULT '{}'::jsonb,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Phase 1g: sync_events (delta sync tracking) ─────────────
CREATE TABLE IF NOT EXISTS sync_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  wa_sender_id TEXT,
  event_type TEXT NOT NULL
    CHECK (event_type IN ('member_joined', 'member_left', 'admin_promoted', 'admin_demoted', 'group_discovered', 'group_removed')),
  detail JSONB DEFAULT '{}'::jsonb,
  sync_run_id TEXT,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Indexes ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_wa_accounts_role ON wa_accounts(role) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_groups_wa_account ON groups(wa_account_id) WHERE wa_account_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_groups_sync ON groups(last_synced_at NULLS FIRST) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_pending_groups_status ON pending_groups(status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_system_alerts_undelivered ON system_alerts(created_at) WHERE delivered = false;
CREATE INDEX IF NOT EXISTS idx_system_alerts_dedupe ON system_alerts(dedupe_key, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_health_log_account_time ON wa_account_health_log(wa_account_id, checked_at DESC);
CREATE INDEX IF NOT EXISTS idx_health_log_cleanup ON wa_account_health_log(checked_at);
CREATE INDEX IF NOT EXISTS idx_sync_events_group ON sync_events(group_id, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_group_members_unenriched ON group_members(last_enriched_at NULLS FIRST)
  WHERE last_enriched_at IS NULL AND left_group_at IS NULL;

-- ── RLS ──────────────────────────────────────────────────────
ALTER TABLE pending_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_account_health_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_account_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_account_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY admin_pending_groups ON pending_groups FOR ALL USING (public.is_admin());
CREATE POLICY admin_system_alerts ON system_alerts FOR ALL USING (public.is_admin());
CREATE POLICY admin_health_log ON wa_account_health_log FOR ALL USING (public.is_admin());
CREATE POLICY admin_account_state ON wa_account_state FOR ALL USING (public.is_admin());
CREATE POLICY admin_rate_limits ON wa_account_rate_limits FOR ALL USING (public.is_admin());
CREATE POLICY admin_sync_events ON sync_events FOR ALL USING (public.is_admin());

-- ── RPC: send_alert (with dedup) ─────────────────────────────
CREATE OR REPLACE FUNCTION send_alert(
  p_account_id UUID,
  p_type TEXT,
  p_severity TEXT,
  p_title TEXT,
  p_message TEXT DEFAULT NULL,
  p_detail JSONB DEFAULT '{}'::jsonb,
  p_channel TEXT DEFAULT 'whatsapp',
  p_dedupe_minutes INTEGER DEFAULT 30
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_dedupe_key TEXT;
  v_existing BOOLEAN;
  v_id UUID;
BEGIN
  v_dedupe_key := p_type || ':' || COALESCE(p_account_id::text, 'global');

  SELECT EXISTS (
    SELECT 1 FROM system_alerts
    WHERE dedupe_key = v_dedupe_key
      AND created_at > now() - (p_dedupe_minutes || ' minutes')::interval
  ) INTO v_existing;

  IF v_existing THEN RETURN NULL; END IF;

  INSERT INTO system_alerts (wa_account_id, alert_type, severity, title, message, detail, channel, dedupe_window_minutes)
  VALUES (p_account_id, p_type, p_severity, p_title, p_message, p_detail, p_channel, p_dedupe_minutes)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- ── RPC: increment_message_count (atomic, no lock) ───────────
CREATE OR REPLACE FUNCTION increment_message_count(p_account_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  UPDATE wa_account_rate_limits
  SET messages_sent_today = messages_sent_today + 1
  WHERE wa_account_id = p_account_id
    AND messages_sent_today < daily_message_limit;
  RETURN FOUND;
END;
$$;

-- ── RPC: record_health_check ─────────────────────────────────
CREATE OR REPLACE FUNCTION record_health_check(
  p_account_id UUID,
  p_status TEXT,
  p_is_healthy BOOLEAN,
  p_response_time_ms INTEGER DEFAULT NULL,
  p_groups_active INTEGER DEFAULT NULL,
  p_detail JSONB DEFAULT '{}'::jsonb
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO wa_account_state (wa_account_id, last_health_check, last_health_ok)
  VALUES (p_account_id, now(), p_is_healthy)
  ON CONFLICT (wa_account_id) DO UPDATE SET
    last_health_check = now(),
    last_health_ok = p_is_healthy,
    reconnect_attempts = CASE WHEN p_is_healthy THEN 0 ELSE wa_account_state.reconnect_attempts END,
    error_count_24h = CASE WHEN p_is_healthy THEN 0 ELSE wa_account_state.error_count_24h END,
    updated_at = now();

  INSERT INTO wa_account_health_log (wa_account_id, status, is_healthy, response_time_ms, groups_active, detail)
  VALUES (p_account_id, p_status, p_is_healthy, p_response_time_ms, p_groups_active, p_detail);
END;
$$;

-- ── RPC: upsert_pending_group (idempotent) ───────────────────
CREATE OR REPLACE FUNCTION upsert_pending_group(
  p_invite_link TEXT,
  p_invite_code TEXT,
  p_source_group_id UUID DEFAULT NULL,
  p_source_wa_sender_id TEXT DEFAULT NULL,
  p_source_wa_message_id TEXT DEFAULT NULL,
  p_discovered_by UUID DEFAULT NULL,
  p_group_name TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_id UUID;
BEGIN
  -- Check if active entry exists
  SELECT id INTO v_id FROM pending_groups
  WHERE invite_code = p_invite_code AND status IN ('pending', 'approved', 'joining');

  IF v_id IS NOT NULL THEN RETURN v_id; END IF;

  INSERT INTO pending_groups (invite_link, invite_code, source_group_id, source_wa_sender_id,
    source_wa_message_id, discovered_by_account_id, group_name)
  VALUES (p_invite_link, p_invite_code, p_source_group_id, p_source_wa_sender_id,
    p_source_wa_message_id, p_discovered_by, p_group_name)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- ── RPC: cleanup_old_health_logs (>7 days) ───────────────────
CREATE OR REPLACE FUNCTION cleanup_old_health_logs() RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE deleted INTEGER;
BEGIN
  DELETE FROM wa_account_health_log WHERE checked_at < now() - interval '7 days';
  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted;
END;
$$;

-- ── DB Trigger: auto-alert on status change ──────────────────
CREATE OR REPLACE FUNCTION trg_wa_account_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    PERFORM send_alert(
      NEW.id,
      CASE NEW.status
        WHEN 'disconnected' THEN 'instance_disconnected'
        WHEN 'connected' THEN 'instance_reconnected'
        WHEN 'blocked' THEN 'account_blocked'
        WHEN 'yellow_card' THEN 'account_yellow_card'
        ELSE 'custom'
      END,
      CASE NEW.status
        WHEN 'disconnected' THEN 'critical'
        WHEN 'blocked' THEN 'critical'
        WHEN 'yellow_card' THEN 'warning'
        WHEN 'connected' THEN 'info'
        ELSE 'info'
      END,
      'Instance ' || COALESCE(NEW.label, NEW.id::text) || ': ' || NEW.status,
      'Changed from ' || OLD.status || ' to ' || NEW.status,
      jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status),
      CASE WHEN NEW.status IN ('disconnected', 'blocked') THEN 'whatsapp' ELSE 'dashboard' END,
      10
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS wa_account_status_change ON wa_accounts;
CREATE TRIGGER wa_account_status_change
  AFTER UPDATE OF status ON wa_accounts
  FOR EACH ROW EXECUTE FUNCTION trg_wa_account_status_change();

-- ── Seed: state + rate_limits for existing account ───────────
INSERT INTO wa_account_state (wa_account_id)
SELECT id FROM wa_accounts WHERE is_active = true
ON CONFLICT DO NOTHING;

INSERT INTO wa_account_rate_limits (wa_account_id)
SELECT id FROM wa_accounts WHERE is_active = true
ON CONFLICT DO NOTHING;
```

**Step 2: Apply migration**

Run: `Apply via Supabase MCP tool with project_id zyytzwlvtuhgbjpalbgd`

**Step 3: Save migration file locally**

Save to: `supabase/migrations/044_watchdog_multi_instance.sql`

**Step 4: Commit**

```bash
git add supabase/migrations/044_watchdog_multi_instance.sql
git commit -m "feat: add WATCHDOG multi-instance schema — tables, RPCs, triggers, indexes"
```

---

## Phase 1: Alert Service

### Task 2: Create Alert Service

**Files:**
- Create: `services/wa-listener/src/alerts.ts`

The alert service sends WhatsApp messages via Twilio to ADMIN_ALERT_PHONE and logs to system_alerts.
It polls `system_alerts WHERE delivered = false` and dispatches via Twilio.
Dedup is handled by the `send_alert` RPC (DB-level, not app-level).

Key design decisions:
- Uses Twilio (not Green API) for alerts — works even when Green API is down
- Polls undelivered alerts every 10 seconds
- Formats messages for WhatsApp readability

**Step 1: Implement alerts.ts**

Core functions:
- `sendAlert(type, severity, title, message, accountId?)` — calls `send_alert` RPC, then dispatches
- `dispatchUndelivered()` — poll DB for undelivered, send via Twilio, mark delivered
- `startAlertPoller()` / `stopAlertPoller()` — interval management
- `sendTwilioWhatsApp(phone, message)` — raw Twilio send

**Step 2: Integrate into index.ts**

Add Phase 5: `startAlertPoller()` after listener starts.

**Step 3: Test manually**

Insert a test alert via SQL, verify it arrives on WhatsApp +972542922277.

**Step 4: Commit**

```bash
git add services/wa-listener/src/alerts.ts
git commit -m "feat: add WATCHDOG alert service — Twilio WhatsApp alerts with dedup"
```

---

### Task 3: Wire State Changes to Alerts + Persist to DB

**Files:**
- Modify: `services/wa-listener/src/api.ts` — persist state to Redis + DB
- Modify: `services/wa-listener/src/listener.ts` — update DB status on state change
- Modify: `services/wa-listener/src/config.ts` — add ADMIN_ALERT_PHONE

Key design decisions (from expert critiques):
- Real-time state in Redis (fast), DB updates only on transitions (durable)
- The DB trigger on wa_accounts.status auto-creates the alert row
- listener.ts updates wa_accounts.status which triggers the alert
- api.ts reads state from Redis for /api/status endpoint

**Step 1: Update config.ts — add alert phone**

```typescript
alerts: {
  adminPhone: process.env.ADMIN_ALERT_PHONE ?? '',
  pollIntervalMs: 10_000,
},
```

**Step 2: Update listener.ts — persist state to DB**

In `processNotification`, when `stateInstanceChanged`:
```typescript
if (state === 'authorized') {
  setConnected();
  // Update DB — triggers alert via DB trigger
  await supabase.from('wa_accounts').update({ status: 'connected', connected_since: new Date().toISOString() })
    .eq('green_api_id', config.greenApi.idInstance);
} else if (state === 'notAuthorized' || state === 'blocked') {
  setDisconnected();
  await supabase.from('wa_accounts').update({ status: state === 'blocked' ? 'blocked' : 'disconnected' })
    .eq('green_api_id', config.greenApi.idInstance);
}
```

**Step 3: Update api.ts — read state from Redis + persist transitions**

Replace in-memory variables with Redis hash `wa:state:{idInstance}`.

**Step 4: Test disconnect/reconnect cycle**

Disconnect instance in Green API console, verify:
1. wa_accounts.status updates to 'disconnected'
2. system_alerts row created (via trigger)
3. WhatsApp alert received on +972542922277

**Step 5: Commit**

```bash
git add services/wa-listener/src/listener.ts services/wa-listener/src/api.ts services/wa-listener/src/config.ts
git commit -m "feat: persist instance state to DB, trigger alerts on disconnect"
```

---

## Phase 2: Link Scanner + Micro-Insert

### Task 4: Add Link Scanner to Message Processing

**Files:**
- Modify: `services/wa-listener/src/listener.ts`

Key design decisions (from expert critiques):
- Link scanner runs BEFORE smart-filter (captures links even from sellers)
- Regex: `(?:https?://)?chat\.whatsapp\.com/([A-Za-z0-9_-]+)` (broader than original)
- Also catches `wa.me` patterns
- Calls `upsert_pending_group` RPC (idempotent)

**Step 1: Add link scanner function**

```typescript
const GROUP_LINK_REGEX = /(?:https?:\/\/)?chat\.whatsapp\.com\/([A-Za-z0-9_-]+)/gi;

async function scanForGroupLinks(text: string, groupId: string, senderId: string, messageId: string): Promise<void> {
  const matches = [...text.matchAll(GROUP_LINK_REGEX)];
  if (matches.length === 0) return;

  const groupUuid = await resolveGroupUuid(groupId); // reuse from smart-filter

  for (const match of matches) {
    const inviteCode = match[1];
    const inviteLink = `https://chat.whatsapp.com/${inviteCode}`;

    await supabase.rpc('upsert_pending_group', {
      p_invite_link: inviteLink,
      p_invite_code: inviteCode,
      p_source_group_id: groupUuid,
      p_source_wa_sender_id: senderId,
      p_source_wa_message_id: messageId,
    });

    logger.info({ inviteCode, groupId, senderId }, 'Group invite link discovered');
  }
}
```

**Step 2: Wire into processNotification — BEFORE smart-filter**

After text extraction, before `runSmartFilter()`:
```typescript
await scanForGroupLinks(text, chatId, senderId, messageId);
```

**Step 3: Commit**

```bash
git add services/wa-listener/src/listener.ts
git commit -m "feat: add group invite link scanner to message processing"
```

---

### Task 5: Add Micro-Insert for Unknown Senders

**Files:**
- Modify: `services/wa-listener/src/smart-filter.ts`

Key design decisions (from expert critiques):
- Use `ON CONFLICT DO NOTHING` (not DO UPDATE) to avoid race with delta sync
- Set `joined_group_at = NULL` (unknown, not fake "now")
- Add `discovered_via` to distinguish message-discovered vs sync-discovered
- Export `invalidateSenderCache()` for SyncEngine to call

**Step 1: Update updateSenderStats to use upsert**

Replace the SELECT-then-INSERT pattern (lines 376-444) with:
```typescript
const { error } = await supabase
  .from('group_members')
  .upsert({
    group_id: groupUuid,
    wa_sender_id: senderId,
    display_name: senderName,
    total_messages: 1,
    lead_messages: wasLead ? 1 : 0,
    service_messages: hasPhoneInMessage ? 1 : 0,
    classification: 'unknown',
    last_seen_at: new Date().toISOString(),
  }, { onConflict: 'group_id,wa_sender_id', ignoreDuplicates: false });
```

NOTE: For existing records, use a separate UPDATE to increment counters (not overwrite).

**Step 2: Export cache invalidation**

```typescript
export function invalidateSenderCache(groupWaId: string, senderId: string): void {
  senderCache.delete(`${groupWaId}:${senderId}`);
}
```

**Step 3: Commit**

```bash
git add services/wa-listener/src/smart-filter.ts
git commit -m "feat: upsert group members on message, export cache invalidation"
```

---

## Phase 3: Unified Sync Engine

### Task 6: Create SyncEngine Module

**Files:**
- Create: `services/wa-listener/src/sync-engine.ts`

This replaces: `sync-members-local.mjs`, `sync-admins-local.mjs`, `enrich-admins-local.mjs`, and both edge functions.

Key design decisions (from expert critiques):
- Single `syncGroup(groupId, opts)` with options flags
- Batch upsert via Supabase `.upsert()` with `onConflict`
- Batch UPDATE for left members (single query with IN clause)
- Emit sync_events for joins/leaves/admin changes
- Call `invalidateSenderCache()` on reclassifications
- Stagger API calls with configurable delay (default 1000ms)
- Exponential backoff on 429 responses

Core functions:
- `syncAllGroups(accountId)` — iterate active groups, call syncGroup each
- `syncGroup(groupId, opts)` — getGroupData, diff, batch upsert/update
- `enrichMembers(opts)` — prioritized: P0 admins, P1 lead senders, P2 unknown, P3 stale
- `discoverNewGroups(accountId)` — GetContacts vs DB, flag new groups
- `onboardInstance(accountId)` — full protocol: discover, sync, enrich, history

**Step 1: Implement sync-engine.ts**

The sync logic per group:
```
1. getGroupData(groupId) → participants[]
2. Load existing group_members from DB
3. Diff:
   - In API but not DB → new members (batch INSERT)
   - In DB but not API → left members (batch UPDATE left_group_at)
   - In both, isAdmin changed → update classification
4. Write sync_events for all changes
5. Update groups.total_members, known_admins, last_synced_at
6. Invalidate sender cache for reclassified members
```

**Step 2: Implement enrichment with priority tiers**

```
Priority order:
  P0: classification='admin' AND last_enriched_at IS NULL
  P1: members who sent leads in last 24h AND last_enriched_at IS NULL
  P2: classification='unknown' AND last_enriched_at IS NULL
  P3: last_enriched_at < now() - 30 days
Cap: 200 per run
```

Per member: `getAvatar` + `getContactInfo`, 200ms delay between calls.

**Step 3: Commit**

```bash
git add services/wa-listener/src/sync-engine.ts
git commit -m "feat: unified SyncEngine — batch sync, enrichment, group discovery"
```

---

## Phase 4: Watchdog Scheduler

### Task 7: Create Watchdog Scheduler

**Files:**
- Create: `services/wa-listener/src/watchdog.ts`
- Modify: `services/wa-listener/src/index.ts` — add Phase 5

The watchdog runs as part of the wa-listener process but uses `setInterval` with staggered timers to avoid blocking the poll loop.

Key design decisions (from expert critiques):
- Silence detector instead of fixed health ping: if no notification in 10 min → ping
- Delta sync staggered: 1 group every 5 minutes across the 4-hour window
- Enrichment runs as BullMQ queue (dedicated `enrichment` queue, concurrency 1)
- Daily summary at 08:00 local time

Core jobs:
```
silenceDetector: check lastNotificationAt, if >10min → getStateInstance
deltaSyncScheduler: every 5 min, sync next group in rotation
enrichmentScheduler: after each sync batch, queue P0-P3 members
dailySummary: at 08:00, aggregate stats and send WhatsApp
healthLogCleanup: every 24h, call cleanup_old_health_logs RPC
```

**Step 1: Implement watchdog.ts**

**Step 2: Add enrichment BullMQ queue**

```typescript
// In queue.ts, add:
const enrichQueue = new Queue('enrichment', { connection: redisConfig,
  defaultJobOptions: { removeOnComplete: 100, removeOnFail: 500, attempts: 3 }
});
```

**Step 3: Wire into index.ts**

```typescript
// Phase 5: startWatchdog
logger.info('Phase 5: startWatchdog...');
await startWatchdog();
```

**Step 4: Test delta sync**

Run sync for one group, verify:
- group_members updated
- sync_events created for new/left
- groups.last_synced_at updated
- sender cache invalidated for reclassified

**Step 5: Commit**

```bash
git add services/wa-listener/src/watchdog.ts services/wa-listener/src/queue.ts services/wa-listener/src/index.ts
git commit -m "feat: WATCHDOG scheduler — silence detector, staggered sync, enrichment queue"
```

---

## Phase 5: Instance Onboarding

### Task 8: Implement Onboarding Protocol

**Files:**
- Modify: `services/wa-listener/src/sync-engine.ts` — add `onboardInstance()`
- Modify: `services/wa-listener/src/listener.ts` — trigger onboard on `authorized`

Key design decisions (from expert critiques):
- 5-minute delay after authorization before GetContacts (warm-up)
- Retry GetContacts with backoff if empty array
- Stagger getGroupData calls at 2-second intervals
- getChatHistory with count=500 (test real ceiling)
- Log onboarding progress to pipeline_events
- Alert admin with summary when complete

Flow:
```
authorized event received
  → wait 5 minutes (Green API warm-up)
  → GetContacts(group=true) with retry
  → for each group:
      match wa_group_id to DB
      NEW → INSERT to groups, emit sync_event
      EXISTING → merge members
      DB-only → mark instance_status='not_in_instance'
  → enrichAdmins (P0 priority)
  → getChatHistory(500) per group → parse missed leads via BullMQ
  → send summary alert: "Scraper ready — X groups, Y members, Z missed leads"
```

**Step 1: Implement in sync-engine.ts**

**Step 2: Wire trigger in listener.ts**

When `stateInstanceChanged: authorized`:
```typescript
// Don't block the poll loop — run onboarding async
setTimeout(() => onboardInstance(accountId).catch(err =>
  logger.error({ err }, 'Onboarding failed')
), 5 * 60 * 1000); // 5-minute warm-up delay
```

**Step 3: Test with current instance**

Re-authorize instance, verify onboarding runs and populates data.

**Step 4: Commit**

```bash
git add services/wa-listener/src/sync-engine.ts services/wa-listener/src/listener.ts
git commit -m "feat: instance onboarding protocol — auto-discover groups, sync, enrich"
```

---

## Phase 6: Dashboard Integration

### Task 9: Instance Health Panel in Inbox

**Files:**
- Modify: `apps/dashboard/src/pages/AdminInbox.tsx`

Add a small health banner at the top of the Inbox showing:
- Instance status (green/yellow/red dot)
- Last sync time
- Pending groups count (with link to review)
- Active alerts count

Query: `supabase.rpc('get_instance_status')` — create this RPC:
```sql
CREATE OR REPLACE FUNCTION get_instance_status()
RETURNS TABLE (account_id UUID, label TEXT, role TEXT, status TEXT, is_healthy BOOLEAN,
  last_sync_at TIMESTAMPTZ, groups_count BIGINT, pending_groups_count BIGINT,
  active_alerts_count BIGINT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT wa.id, wa.label, wa.role, wa.status, COALESCE(ws.last_health_ok, true),
    ws.last_sync_at,
    (SELECT count(*) FROM groups g WHERE g.wa_account_id = wa.id AND g.status = 'active'),
    (SELECT count(*) FROM pending_groups WHERE status = 'pending'),
    (SELECT count(*) FROM system_alerts WHERE delivered = false AND severity IN ('warning', 'critical'))
  FROM wa_accounts wa
  LEFT JOIN wa_account_state ws ON ws.wa_account_id = wa.id
  WHERE wa.is_active = true ORDER BY wa.role, wa.priority;
$$;
```

**Step 1: Add RPC to migration**

**Step 2: Build health banner component**

**Step 3: Add pending groups review modal**

**Step 4: Commit**

```bash
git add apps/dashboard/src/pages/AdminInbox.tsx supabase/migrations/044_watchdog_multi_instance.sql
git commit -m "feat: instance health banner + pending groups in Inbox"
```

---

## Security Cleanup

### Task 10: Remove Hardcoded Credentials

**Files:**
- Delete or gitignore: `sync-members-local.mjs`, `sync-admins-local.mjs`, `enrich-admins-local.mjs`
- Modify: `.gitignore`

These scripts have Green API credentials hardcoded. Now that the SyncEngine handles all sync logic, they are obsolete.

**Step 1: Add to .gitignore**

```
# Deprecated local sync scripts with hardcoded credentials
sync-members-local.mjs
sync-admins-local.mjs
enrich-admins-local.mjs
```

**Step 2: Remove from git tracking**

```bash
git rm --cached sync-members-local.mjs sync-admins-local.mjs enrich-admins-local.mjs
git commit -m "security: remove scripts with hardcoded Green API credentials"
```

---

## Verification Checklist

After all phases complete, verify:

- [ ] Instance disconnect → alert on WhatsApp within 1 minute
- [ ] Instance reconnect → onboarding protocol runs after 5-min warm-up
- [ ] Delta sync runs every 4 hours (staggered, 1 group/5 min)
- [ ] New members detected and inserted with sync_events
- [ ] Left members detected and marked with left_group_at
- [ ] Admin status changes detected and enriched
- [ ] Group invite links captured from messages
- [ ] Pending groups visible in dashboard
- [ ] Enrichment queue processes P0→P1→P2→P3 priority
- [ ] Daily summary alert at 08:00
- [ ] No hardcoded credentials in tracked files
- [ ] Sender cache invalidated on reclassification
- [ ] Rate limiting works for sender instances
