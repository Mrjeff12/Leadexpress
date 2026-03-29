# Rebeca Service Refactor — Design Spec
**Date:** 2026-03-29
**Status:** Approved
**Reviewers:** Backend Architect, Bot Specialist, DevOps (parallel agent review)

---

## Problem Statement

The current WhatsApp bot ("Rebeca") is split across two systems:

1. `supabase/functions/whatsapp-webhook/index.ts` — 3500-line monolith on Deno/Edge Function runtime. Handles all inbound WhatsApp messages. State in Supabase.
2. `services/whatsapp-notify/` — Render service. Handles outbound lead notifications + has a duplicate registration flow. State in Redis.

This split causes:
- Split-brain: two systems can respond to the same inbound message
- Dual state stores (Redis + Supabase) with no sync
- AI onboarding silently broken (`strict: true` on tools with no `required` array)
- Silent data corruption on registration (5 non-atomic writes)
- No Twilio signature validation
- 60-second Edge Function timeout incompatible with OpenAI API calls
- Impossible to add features without touching a 3500-line file

---

## Solution: `services/rebeca/`

One consolidated Render web service that owns **all** WhatsApp communication with contractors.

The lead pipeline (`wa-listener → parser → matching`) is **not touched** — it works correctly.

---

## Architecture

### Before
```
Twilio inbound → supabase/functions/whatsapp-webhook (3500 lines, Deno)
                 └── state: wa_onboard_state + wa_agent_sessions (Supabase)
                           + le:wa-register:* (Redis)

[wa-notifications queue] → services/whatsapp-notify (Render)
                           └── also handles inbound webhook
                           └── state: Redis
```

### After
```
Twilio inbound ──────────────────────────────────────────┐
                                                          ▼
[wa-notifications queue] → services/rebeca/ (Render web service)
                           └── state: wa_onboard_state (Supabase ONLY)
```

### Pipeline (unchanged)
```
Green API → wa-listener → [raw-messages] → parser → [parsed-leads] → matching
                                                                          ↓
                              [wa-notifications] ──────────────→ rebeca worker
                              [notifications]    ──────────────→ notification (Telegram)
```

---

## File Structure

```
services/rebeca/
├── src/
│   ├── index.ts                  ← entry: starts server + worker + cron
│   ├── server.ts                 ← Hono app with Twilio signature middleware
│   ├── router.ts                 ← per-phone routing with Postgres advisory lock
│   │
│   ├── handlers/
│   │   ├── onboarding.ts         ← AI onboarding (new contractor setup)
│   │   ├── sales.ts              ← AI sales (unknown prospect)
│   │   ├── known-user.ts         ← menu / subscription / profile updates
│   │   └── lead-action.ts        ← claim / pass on lead notifications
│   │
│   ├── outbound/
│   │   ├── worker.ts             ← BullMQ consumer: wa-notifications → send lead
│   │   ├── checkin.ts            ← daily availability cron + idempotency guard
│   │   └── nudges.ts             ← lifecycle nudge sending
│   │
│   ├── agents/
│   │   ├── client.ts             ← OpenAI Responses API wrapper
│   │   └── tools.ts              ← tool definitions (no strict:true)
│   │
│   └── lib/
│       ├── state.ts              ← read/write wa_onboard_state (single table)
│       ├── profile.ts            ← single-query profile lookup
│       ├── twilio.ts             ← sendText / sendButtons / verifySignature
│       ├── i18n.ts               ← t(phone, key) for all user-facing strings
│       └── secrets.ts            ← env vars / Supabase vault loader
│
├── Dockerfile
├── package.json
└── tsconfig.json
```

---

## Routing Logic (`router.ts`)

```
Inbound message from phone X
  ↓
Acquire Postgres advisory lock for phone X (pg_try_advisory_xact_lock)
  ↓
Is it a button payload? → lead-action handler
  ↓ no
Is it a LE-{code} connection code? → handleConnectionCode
  ↓ no
Is it a WhatsApp group link? → handleGroupLink
  ↓ no
Does wa_onboard_state exist for phone? → onboarding handler
  ↓ no
Does profiles.whatsapp_phone = phone? → known-user handler
  ↓ no
Does profiles.phone = phone? → link whatsapp_phone + known-user handler
  ↓ no
→ sales handler (AI prospect engagement)
  ↓
Release lock
```

**Lock implementation:** `SELECT pg_try_advisory_xact_lock(hashtext($phone))` — atomic, auto-releases at transaction end, no TTL management needed.

---

## State Management

### Single table: `wa_onboard_state`

```sql
-- Existing table, extended
wa_onboard_state (
  phone TEXT PRIMARY KEY,
  step TEXT,          -- 'ai' | 'confirm' | 'groups' | 'menu' | done
  data JSONB,         -- collected fields + openai_response_id merged here
  updated_at TIMESTAMPTZ
)
```

The `data` JSONB contains:
```json
{
  "userId": "...",
  "language": "he",
  "collected": {
    "name": "...",
    "professions": [...],
    "state": "FL",
    "cities": [...],
    "working_days": [1,2,3,4,5]
  },
  "openai_response_id": "resp_...",    ← merged from wa_agent_sessions
  "session_started_at": "2026-03-29T..."  ← for 25-day expiry
}
```

**`wa_agent_sessions` table is deprecated** — `openai_response_id` moves into `wa_onboard_state.data`.

### No Redis for bot state
Redis is used only by BullMQ pipeline queues. All bot state is Supabase.

---

## Critical Bug Fixes

### 1. Twilio Signature Validation
Every inbound request validated against `X-Twilio-Signature` header using HMAC-SHA1.

```typescript
// server.ts middleware — runs before all routes
async function twilioSignatureMiddleware(c, next) {
  const isValid = validateTwilioSignature(
    c.req.raw,
    await c.req.text(),
    process.env.TWILIO_AUTH_TOKEN
  );
  if (!isValid) return c.text('Forbidden', 403);
  await next();
}
```

### 2. Atomic Registration
Account creation wrapped in a helper that rolls back on partial failure:

```typescript
// lib/registration.ts
async function createContractorAccount(data: OnboardData): Promise<void> {
  // Check idempotency: if profile already has contractor record, skip
  const existing = await supabase.from('contractors')
    .select('user_id').eq('user_id', data.userId).maybeSingle();
  if (existing.data) return; // already created, safe to retry

  // All writes in sequence with explicit error propagation
  // If any step fails, log + return error so caller can retry
}
```

### 3. Per-Phone Mutex
```typescript
// router.ts
const lock = await supabase.rpc('try_phone_lock', { phone });
if (!lock) {
  await sendText(phone, t(phone, 'processing'));
  return;
}
try {
  await routeToHandler(phone, text);
} finally {
  await supabase.rpc('release_phone_lock', { phone });
}
```

### 4. max_output_tokens: 500
Increased from 300 to handle Hebrew text + function call in same response.

### 5. complete_onboarding Validation
```typescript
if (item.name === 'complete_onboarding') {
  const c = collected;
  const missing = [];
  if (!c.professions?.length) missing.push('professions');
  if (!c.state) missing.push('state');
  if (!c.cities?.length) missing.push('cities');
  if (missing.length > 0) {
    // Ask AI to keep going, don't complete
    await sendText(phone, t(phone, 'incomplete_profile'));
    return;
  }
  await executeOnboardingCompletion(phone, onboardData);
}
```

### 6. OpenAI Session Expiry
```typescript
// agents/client.ts
const SESSION_MAX_AGE_DAYS = 25;
const sessionAge = daysSince(session.session_started_at);
if (sessionAge > SESSION_MAX_AGE_DAYS) {
  delete body.previous_response_id; // start fresh
  await state.clearSessionId(phone);
}
```

### 7. i18n Helper
```typescript
// lib/i18n.ts
const STRINGS = {
  he: {
    processing: 'רגע, מעבד את ההודעה הקודמת...',
    profession_fallback: 'מה המקצוע שלך? (למשל: אינסטלציה, חשמל, ניקוי צנרות)',
    subscription_expired: 'היי {{name}}! המנוי שלך פג תוקף.\nכנס ל-masterleadflow.com להארכה.',
    // ...
  },
  en: {
    processing: 'One moment, processing your previous message...',
    profession_fallback: 'What trade do you work in? (e.g. plumbing, electrical, HVAC)',
    subscription_expired: 'Hi {{name}}! Your subscription has expired.\nVisit masterleadflow.com to renew.',
    // ...
  }
};

export function t(phone: string, key: string, vars?: Record<string, string>): string {
  const lang = phone.startsWith('+972') ? 'he' : 'en';
  let str = STRINGS[lang][key] ?? STRINGS.en[key] ?? key;
  if (vars) Object.entries(vars).forEach(([k, v]) => { str = str.replace(`{{${k}}}`, v); });
  return str;
}
```

### 8. Profile Lookup — Single Query
```typescript
// lib/profile.ts
async function findProfile(phone: string) {
  const stripped = phone.replace(/^\+/, '');
  const { data } = await supabase
    .from('profiles')
    .select('id, full_name')
    .or(`whatsapp_phone.eq.${phone},phone.eq.${phone},phone.eq.${stripped}`)
    .maybeSingle();
  return data;
}
```

### 9. Subscription Check — Only for Set-Up Users
Subscription expiry message fires **only after** confirming contractor has professions/zip_codes set. New users go through onboarding without seeing the expiry message.

---

## OpenAI Tools (no strict:true)

```typescript
// agents/tools.ts
export const ONBOARDING_TOOLS = [
  {
    type: 'function',
    name: 'save_profile',
    description: 'Save collected contractor profile fields. Call whenever new info is gathered.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        professions: { type: 'array', items: { type: 'string' } },
        state: { type: 'string' },
        cities: { type: 'array', items: { type: 'string' } },
        working_days: { type: 'array', items: { type: 'integer' } },
      },
      additionalProperties: false,
      // No strict: true — allows partial saves
    },
  },
  {
    type: 'function',
    name: 'complete_onboarding',
    description: 'Call only when ALL fields are collected and user confirmed. Creates contractor account.',
    parameters: {
      type: 'object',
      required: ['confirmed'],
      properties: { confirmed: { type: 'boolean' } },
      additionalProperties: false,
    },
  },
];
```

---

## Outbound Worker

```typescript
// outbound/worker.ts
const worker = new Worker('wa-notifications', async (job) => {
  const { phone, message, leadId } = job.data;

  // Check 24h window
  const contractor = await supabase.from('contractors')
    .select('wa_window_until, wa_notify')
    .eq('user_id', job.data.userId)
    .single();

  if (!contractor.data?.wa_notify) return;
  if (!isWindowOpen(contractor.data.wa_window_until)) return;

  await twilio.sendText(phone, message);
}, {
  limiter: { max: 70, duration: 1000 }, // WhatsApp rate limit
  concurrency: 10,
});
```

---

## Cron: Daily Check-In

```typescript
// outbound/checkin.ts
// Guard: skip if already ran today
async function alreadyRanToday(): Promise<boolean> {
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabase
    .from('cron_runs')
    .select('id')
    .eq('job', 'daily_checkin')
    .eq('run_date', today)
    .maybeSingle();
  return !!data;
}
```

---

## Migration Plan

1. Deploy `services/rebeca/` to Render alongside existing services
2. Verify `/health` and `/webhooks/whatsapp` respond correctly
3. Update Twilio webhook URL → rebeca URL
4. Send test message, verify routing works
5. Monitor logs for 10 minutes
6. Remove `services/whatsapp-notify/` from `render.yaml`
7. Delete `supabase/functions/whatsapp-webhook/`
8. Run migration to deprecate `wa_agent_sessions` table (move data to `wa_onboard_state`)

---

## What Gets Deleted

| Item | Replaced By |
|------|-------------|
| `supabase/functions/whatsapp-webhook/` | `services/rebeca/handlers/` |
| `services/whatsapp-notify/` | `services/rebeca/` |
| Redis bot state (`le:wa-register:*`) | `wa_onboard_state` (Supabase) |
| `wa_agent_sessions` table | `wa_onboard_state.data.openai_response_id` |

## What Stays

| Item | Reason |
|------|--------|
| `services/wa-listener/` | Works correctly |
| `services/parser/` | Works correctly |
| `services/matching/` | Works correctly |
| `services/notification/` | Telegram delivery, works |
| `services/telegram-bot/` | Claim/pass via Telegram |
| BullMQ + Redis | Pipeline rate limiting |
| `wa_onboard_state` table | Canonical bot state |
| `supabase/functions/process-nudges/` | Scheduling logic stays |
| All other Edge Functions | Stripe, auth, admin — unchanged |
