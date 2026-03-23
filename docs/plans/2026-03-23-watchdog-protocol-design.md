# Protocol WATCHDOG — Multi-Instance WhatsApp Management System

**Date:** 2026-03-23
**Status:** Design — Pending Approval
**Author:** Claude + Jeff

---

## 1. Problem Statement

Lead Express monitors WhatsApp groups for contractor leads via Green API instances.
Currently the system has critical gaps:

- **Single instance, hardcoded** — credentials in ENV, state in memory, no multi-instance
- **No health monitoring** — instance disconnects go undetected until manual check
- **No automatic sync** — group members synced only when developer runs a script
- **No invite link capture** — group links sent by prospects are lost
- **No role separation** — same instance does both scraping and sending (ban risk)
- **4 duplicate sync scripts** — copy-pasted logic across local + edge functions

## 2. Goals

1. Support N dynamic instances (scraper vs sender, always separate)
2. Detect disconnects within 30 seconds, alert admin via WhatsApp
3. Auto-sync group members every 4 hours, detect joins/leaves
4. Capture group invite links from messages automatically
5. Enrich new members lazily (avatar, name, about)
6. Rate-limit sender instances to prevent bans
7. Unify all sync logic into a single reusable engine

## 3. Non-Goals

- Auto-join groups (admin reviews pending groups manually)
- Auto-failover between instances (alert + manual switch for now)
- Webhook push mode (keep polling as primary, evaluate webhook later)

## 4. Architecture

```
                    WATCHDOG ENGINE
    ┌──────────────────────────────────────────┐
    │                                          │
    │  ┌──────────┐ ┌──────────┐ ┌──────────┐ │
    │  │  EVENT    │ │  SAFETY  │ │  INTEL   │ │
    │  │  REACTOR  │ │  NET     │ │  LAYER   │ │
    │  │          │ │          │ │          │ │
    │  │ state    │ │ ping/30m │ │ lazy     │ │
    │  │ change   │ │ sync/4h  │ │ enrich   │ │
    │  │ new msg  │ │ cleanup  │ │ link     │ │
    │  │ new send │ │ /24h     │ │ scan     │ │
    │  └────┬─────┘ └────┬─────┘ └────┬─────┘ │
    │       └─────────────┼───────────┘        │
    │                     ▼                    │
    │           ┌──────────────────┐           │
    │           │  ACTION ROUTER   │           │
    │           │                  │           │
    │           │ DB writes        │           │
    │           │ WA alerts        │           │
    │           │ Enrich queue     │           │
    │           │ Onboarding       │           │
    │           └──────────────────┘           │
    └──────────────────────────────────────────┘
```

### 4.1 Instance Roles

| Aspect | Scraper | Sender |
|--------|---------|--------|
| Purpose | Listen to groups, extract leads | Send outreach to prospects |
| Direction | Inbound only | Outbound only |
| Groups | Yes — monitored | No |
| Prospects | No direct sends | Assigned via wa_account_id |
| Disconnect severity | CRITICAL | WARNING |
| Ban risk | Low | High |
| Rate limiting | N/A | daily_message_limit |

### 4.2 Event Reactor (integrated into wa-listener)

Modifications to existing listener.ts:

- `stateInstanceChanged: authorized` → run onboarding protocol, alert "Connected"
- `stateInstanceChanged: notAuthorized` → alert "Disconnected", attempt QR
- `stateInstanceChanged: blocked` → alert "BLOCKED", stop sends
- `stateInstanceChanged: yellowCard` → alert "Warning", reduce rate
- New sender in group message → micro-insert to group_members if missing
- Message contains `chat.whatsapp.com` → extract and save to pending_groups

### 4.3 Safety Net (cron-based)

| Job | Interval | What |
|-----|----------|------|
| Health ping | 30 min | getStateInstance per active instance |
| Delta sync | 4 hours | getGroupData for all groups, diff members |
| Enrichment | 4 hours (after sync) | getAvatar + getContactInfo for unenriched |
| Daily summary | 24 hours | Stats alert to admin |
| Health log cleanup | 24 hours | Prune logs older than 7 days |
| Message count reset | 24 hours | Reset sender daily counters |

### 4.4 Intelligence Layer (per incoming message)

1. **Link Scanner**: regex for `chat.whatsapp.com/[A-Za-z0-9]+` → upsert_pending_group
2. **Sender Detection**: if sender not in group_members → INSERT with joined_group_at=now
3. **Admin Detection**: during delta sync, update classification from getGroupData isAdmin
4. **Enrichment Queue**: new members get queued for lazy enrichment (low priority)

## 5. Instance Lifecycle

### 5.1 New Scraper Onboarding

```
QR Scan → authorized
  ↓
  1. GetContacts() → identify all groups
  2. For each group:
     a. Match wa_group_id to DB
     b. NEW → INSERT to groups table, alert admin
     c. EXISTING → merge members (delta sync)
     d. DB group NOT in API → mark status='not_in_instance'
  3. Enrich admins (avatar + about + name)
  4. getChatHistory(100) per group → parse missed leads
  5. Alert admin: "Scraper ready — X groups, Y members"
  6. Start listening
```

### 5.2 New Sender Onboarding

```
QR Scan → authorized
  ↓
  1. Verify phone number (getStateInstance)
  2. Set daily_message_limit based on warmup stage
  3. Assign unassigned prospects
  4. Alert admin: "Sender ready — phone +XXX"
  5. Ready for outbound campaigns
```

### 5.3 Disconnect Recovery

```
stateInstanceChanged: notAuthorized
  ↓
  1. Set status='disconnected', record last_error
  2. Increment reconnect_attempts
  3. If attempts < max (5):
     a. Call qr() → get QR code
     b. Store QR in DB (wa_accounts.qr_code)
     c. Alert admin: "Instance disconnected — scan QR: [link]"
  4. If attempts >= max:
     a. Alert admin: "CRITICAL — instance failed after 5 attempts"
     b. Mark is_active=false
```

## 6. Database Changes

### 6.1 ALTER wa_accounts

```sql
ADD COLUMN role TEXT NOT NULL DEFAULT 'scraper'
  CHECK (role IN ('scraper', 'sender'))
ADD COLUMN priority INTEGER NOT NULL DEFAULT 0
ADD COLUMN daily_message_limit INTEGER NOT NULL DEFAULT 200
ADD COLUMN messages_sent_today INTEGER NOT NULL DEFAULT 0
ADD COLUMN last_health_check TIMESTAMPTZ
ADD COLUMN last_health_ok BOOLEAN DEFAULT true
ADD COLUMN last_sync_at TIMESTAMPTZ
ADD COLUMN last_error TEXT
ADD COLUMN last_error_at TIMESTAMPTZ
ADD COLUMN reconnect_attempts INTEGER NOT NULL DEFAULT 0
ADD COLUMN max_reconnect_attempts INTEGER NOT NULL DEFAULT 5
ADD COLUMN error_count_24h INTEGER NOT NULL DEFAULT 0
```

### 6.2 NEW TABLE: pending_groups

```sql
pending_groups (
  id UUID PK
  invite_link TEXT NOT NULL
  invite_code TEXT NOT NULL UNIQUE
  source_group_id UUID FK(groups)
  source_wa_message_id TEXT
  discovered_by_account_id UUID FK(wa_accounts)
  group_name TEXT
  status TEXT CHECK (pending/approved/joining/joined/failed/ignored/duplicate)
  assigned_account_id UUID FK(wa_accounts)
  joined_group_id UUID FK(groups)
  last_error TEXT
  attempts INTEGER DEFAULT 0
  reviewed_by UUID FK(profiles)
  reviewed_at TIMESTAMPTZ
  created_at TIMESTAMPTZ
  updated_at TIMESTAMPTZ
)
```

### 6.3 NEW TABLE: system_alerts

```sql
system_alerts (
  id UUID PK
  wa_account_id UUID FK(wa_accounts)
  alert_type TEXT CHECK (instance_disconnected, instance_reconnected,
    health_check_failed, rate_limit_hit, pending_group_discovered,
    daily_summary, account_blocked, custom)
  severity TEXT CHECK (info/warning/critical)
  title TEXT NOT NULL
  message TEXT
  detail JSONB
  channel TEXT CHECK (whatsapp/dashboard/log_only)
  delivered BOOLEAN
  delivered_at TIMESTAMPTZ
  dedupe_key TEXT
  created_at TIMESTAMPTZ
)
```

### 6.4 NEW TABLE: wa_account_health_log

```sql
wa_account_health_log (
  id UUID PK
  wa_account_id UUID FK(wa_accounts) ON DELETE CASCADE
  status TEXT
  is_healthy BOOLEAN
  response_time_ms INTEGER
  groups_active INTEGER
  messages_today INTEGER
  detail JSONB
  checked_at TIMESTAMPTZ
)
```

### 6.5 New RPC Functions

- `get_instance_status()` — dashboard overview of all instances
- `record_health_check(account_id, status, is_healthy, ...)` — write health check
- `increment_message_count(account_id)` → returns false if limit hit
- `reset_daily_message_counts()` — cron daily reset
- `upsert_pending_group(invite_link, invite_code, ...)` — idempotent insert
- `cleanup_old_health_logs()` — prune >7 days

## 7. Code Changes

### 7.1 wa-listener refactor (MUST CHANGE)

| File | Change | Priority |
|------|--------|----------|
| config.ts | Dynamic instance loading from wa_accounts table (not ENV) | P0 |
| api.ts | Persist state to DB (not memory). Add /api/instances endpoint | P0 |
| health.ts | Include instance ID + role in heartbeat. Write to DB | P0 |
| listener.ts | Validate instanceData.idInstance on state changes | P1 |
| listener.ts | Add link scanner to processNotification | P1 |
| listener.ts | Add micro-insert for unknown senders | P1 |
| listener.ts | Add circuit breaker / backoff on repeated failures | P2 |

### 7.2 Unified Sync Engine (NEW)

Replace 4 duplicate scripts with single `SyncEngine`:

```
services/wa-listener/src/sync-engine.ts
  ├── syncAllGroups(accountId) — full delta sync
  ├── syncSingleGroup(groupId) — targeted sync
  ├── enrichMembers(options) — avatar + contact info
  ├── detectNewGroups(accountId) — compare GetContacts vs DB
  └── onboardInstance(accountId) — full onboarding protocol
```

### 7.3 Alert Service (NEW)

```
services/wa-listener/src/alerts.ts
  ├── sendAlert(type, severity, message, accountId?)
  ├── sendWhatsApp(phone, message) — via Twilio to ADMIN_ALERT_PHONE
  └── dedupeCheck(dedupeKey) — prevent alert storms
```

### 7.4 WATCHDOG Scheduler (NEW)

```
services/wa-listener/src/watchdog.ts
  ├── startWatchdog() — initialize all cron jobs
  ├── healthPing() — every 30 min
  ├── deltaSyncAll() — every 4 hours
  ├── enrichBatch() — after delta sync
  ├── dailySummary() — every 24 hours
  └── cleanupLogs() — every 24 hours
```

### 7.5 DO NOT TOUCH

- smart-filter.ts (3-stage pipeline)
- queue.ts (BullMQ structure)
- services/parser/* (parsing pipeline)
- services/matching/* (matching engine)
- Message deduplication (Redis)

## 8. Alert Routing

| Event | Severity | Channel | Message |
|-------|----------|---------|---------|
| Instance connected | info | WhatsApp | "Instance {label} connected" |
| Instance disconnected | critical | WhatsApp | "ALERT: {label} disconnected — scan QR" |
| Instance blocked | critical | WhatsApp | "BLOCKED: {label} — switch instance!" |
| yellowCard | warning | WhatsApp | "Warning on {label} — reducing rate" |
| New group link found | info | WhatsApp | "New group from {prospect}: {name}" |
| Rate limit approaching | warning | WhatsApp | "Sender {label}: 80% of daily limit" |
| Daily summary | info | WhatsApp | "Daily: +X members, -Y left, Z leads" |
| Health check failed 3x | critical | WhatsApp | "Instance {label} unresponsive" |

All alerts also logged to system_alerts table.
Admin phone: +972542922277 (via Twilio)

## 9. Implementation Phases

### Phase 1: Foundation (DB + Config) — Day 1
- Migration 044: wa_accounts columns, pending_groups, system_alerts, health_log
- config.ts: dynamic instance loading from DB
- api.ts: persist state to DB instead of memory

### Phase 2: Alert Service — Day 1
- alerts.ts: send WhatsApp via Twilio
- Integrate with listener state changes
- Test disconnect/reconnect alerts

### Phase 3: Unified Sync Engine — Day 2
- sync-engine.ts: replace 4 scripts with one module
- Delta sync: new/left/admin detection with events
- Link scanner in message processing

### Phase 4: Watchdog Scheduler — Day 2
- watchdog.ts: cron jobs for health, sync, enrichment
- Health ping every 30 min
- Delta sync every 4 hours

### Phase 5: Onboarding Protocol — Day 3
- New scraper: auto-discover groups, sync, enrich, parse history
- New sender: verify, set limits, assign prospects
- Dashboard: instance management panel

### Phase 6: Dashboard UI — Day 3
- Instance status cards in War Room
- Pending groups review panel
- Alert log viewer

## 10. Success Criteria

- [ ] Instance disconnect detected within 30 seconds
- [ ] Admin receives WhatsApp alert within 1 minute of disconnect
- [ ] New group members detected within 4 hours
- [ ] Group invite links captured automatically
- [ ] Sender instances rate-limited to prevent bans
- [ ] Zero duplicate sync logic (single SyncEngine)
- [ ] Dashboard shows all instance health in real-time
