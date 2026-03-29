# Lead Pipeline — Production Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 10 bugs in the WhatsApp lead pipeline, deploy all 5 backend services on Render, add pg_cron automation, and activate the nudge engine.

**Architecture:** Bottom-up — patch Edge Function bugs first → apply DB migrations → create render.yaml → deploy workers → flip DRY_RUN=false.

**Tech Stack:** Supabase Edge Functions (Deno), Node.js workers (BullMQ + Redis), Twilio WhatsApp, pnpm workspaces, Render Docker workers, pg_cron.

**Spec:** `docs/superpowers/specs/2026-03-27-lead-pipeline-production-readiness-design.md`

---

## Phase 1 — Edge Function Bug Fixes

### Task 1: Bug #2 — US template routing in `sendLeadNotification`

**Files:**
- Modify: `supabase/functions/whatsapp-webhook/index.ts:1155`

**Context:** `CONTENT.LEAD_NOTIFY` is a MARKETING template — Twilio silently rejects it for US `+1` numbers outside the 24h window. `CONTENT.LEAD_NOTIFY_BTN` (env: `TWILIO_CONTENT_LEAD_NOTIFY_BTN`) must be UTILITY category.

- [ ] **Step 1: Verify LEAD_NOTIFY_BTN is UTILITY category**

  Go to Twilio Console → Content Templates → find `LEAD_NOTIFY_BTN` → confirm Category = UTILITY.
  If it says MARKETING: stop and create a new UTILITY template, add its SID to Supabase secrets as `TWILIO_CONTENT_LEAD_NOTIFY_BTN`, then continue.

- [ ] **Step 2: Replace the hardcoded template in `sendLeadNotification`**

  File: `supabase/functions/whatsapp-webhook/index.ts`
  Find line 1155 (inside `sendLeadNotification`):
  ```typescript
  // BEFORE
  await sendButtons(phone, CONTENT.LEAD_NOTIFY, {
  ```
  Replace with:
  ```typescript
  // Use UTILITY template for US (+1) numbers — MARKETING is blocked outside 24h window
  const notifyTemplate = phone.startsWith('+1') ? CONTENT.LEAD_NOTIFY_BTN : CONTENT.LEAD_NOTIFY;
  await sendButtons(phone, notifyTemplate, {
  ```

- [ ] **Step 3: Verify the change**

  ```bash
  grep -n "notifyTemplate\|LEAD_NOTIFY_BTN\|startsWith.*+1" supabase/functions/whatsapp-webhook/index.ts
  ```
  Expected output: lines showing `notifyTemplate`, `LEAD_NOTIFY_BTN`, and `+1` check.

- [ ] **Step 4: Commit**

  ```bash
  git add supabase/functions/whatsapp-webhook/index.ts
  git commit -m "fix: route US numbers to UTILITY template in sendLeadNotification"
  ```

---

### Task 2: Bug #6 — `wa_onboard_state` lead context collision

**Files:**
- Modify: `supabase/functions/whatsapp-webhook/index.ts:1164` (sendLeadNotification — write)
- Modify: `supabase/functions/whatsapp-webhook/index.ts:583` (case 'claim_lead' — read)

**Context:** Currently UPSERT overwrites the single `lead_pending` row. If two leads arrive before contractor replies, the first is lost. Fix: store `pendingLeads` array, pop from front on claim.

- [ ] **Step 1: Update `sendLeadNotification` to append to array**

  Find in `sendLeadNotification` (around line 1164):
  ```typescript
  // BEFORE
  await supabase.from('wa_onboard_state').upsert({
    phone,
    step: 'lead_pending',
    data: { leadId, senderPhone: senderPhone || '', profession: profLabel, city: cityLabel },
    updated_at: new Date().toISOString(),
  });
  ```
  Replace with:
  ```typescript
  // Append to pending leads array — handles multiple simultaneous leads without collision
  const { data: existingState } = await supabase
    .from('wa_onboard_state')
    .select('data')
    .eq('phone', phone)
    .eq('step', 'lead_pending')
    .maybeSingle();

  const existingLeads: Array<{ leadId: string; senderPhone: string; profession: string; city: string }> =
    (existingState?.data as { pendingLeads?: Array<{ leadId: string; senderPhone: string; profession: string; city: string }> })?.pendingLeads ?? [];

  await supabase.from('wa_onboard_state').upsert({
    phone,
    step: 'lead_pending',
    data: {
      pendingLeads: [
        ...existingLeads,
        { leadId, senderPhone: senderPhone || '', profession: profLabel, city: cityLabel },
      ],
    },
    updated_at: new Date().toISOString(),
  });
  ```

- [ ] **Step 2: Update `case 'claim_lead'` (first occurrence ~line 583) to pop from array**

  Find the block:
  ```typescript
  if (leadCtx?.data) {
    const ctx = leadCtx.data as { leadId: string; senderPhone: string; profession: string; city: string };
    // Clean up state after reading
    await supabase.from('wa_onboard_state').delete().eq('phone', phone).eq('step', 'lead_pending');
    await handleClaim(phone, ctx.leadId, profile.id, ctx.senderPhone, ctx.profession, ctx.city);
  }
  ```
  Replace with:
  ```typescript
  if (leadCtx?.data) {
    const ctx = leadCtx.data as { pendingLeads?: Array<{ leadId: string; senderPhone: string; profession: string; city: string }> };
    const pending = ctx.pendingLeads ?? [];
    const current = pending[0];
    if (!current) {
      await sendText(phone, `No pending lead found. Send *MENU* for options.`);
      break;
    }
    const remaining = pending.slice(1);
    if (remaining.length === 0) {
      await supabase.from('wa_onboard_state').delete().eq('phone', phone).eq('step', 'lead_pending');
    } else {
      await supabase.from('wa_onboard_state').upsert({
        phone,
        step: 'lead_pending',
        data: { pendingLeads: remaining },
        updated_at: new Date().toISOString(),
      });
    }
    await handleClaim(phone, current.leadId, profile.id, current.senderPhone, current.profession, current.city);
  }
  ```

- [ ] **Step 3: Commit**

  ```bash
  git add supabase/functions/whatsapp-webhook/index.ts
  git commit -m "fix: store pending leads as array to prevent collision on multiple simultaneous leads"
  ```

---

### Task 3: Bugs #3, #4, #7, #8 — Fix `publishJob` notification loop

**Files:**
- Modify: `supabase/functions/whatsapp-webhook/index.ts:3230–3268` (publishJob function)

**Context:** The contractor matching query has 4 bugs in one block:
- #3: no subscription check → sends to expired users
- #4: no zip filter → sends nationwide (TODO only, job has no zip_code yet)
- #7: N+1 queries → fetches whatsapp_phone per contractor
- #8: no try/catch → one failure stops all notifications

- [ ] **Step 1: Replace the matching query and notification loop**

  Find in `publishJob` (around line 3229):
  ```typescript
  // Find matching contractors (same profession, overlapping zip codes area)
  const { data: matches } = await supabase
    .from('contractors')
    .select('user_id, professions, zip_codes')
    .contains('professions', [job.profession])
    .eq('is_active', true)
    .eq('wa_notify', true)
    .neq('user_id', userId);

  const matchedIds = (matches || []).map(c => c.user_id);

  // Update lead with matched contractors
  if (matchedIds.length > 0) {
    await supabase.from('leads').update({
      status: 'sent',
      matched_contractors: matchedIds,
      sent_to_count: matchedIds.length,
    }).eq('id', lead.id);

    // Send notifications to matching contractors
    for (const contractor of (matches || [])) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('whatsapp_phone')
        .eq('id', contractor.user_id)
        .single();

      if (profile?.whatsapp_phone) {
        await sendLeadNotification(
          profile.whatsapp_phone,
          lead.id,
          contractor.user_id,
          job.profession,
          job.city,
          job.description,
          'Contractor Network',
          phone.replace('+', ''),
        );
      }
    }
  }
  ```

  Replace with:
  ```typescript
  // Find matching contractors — active subscription only, whatsapp_phone in one query (no N+1)
  // TODO(zip-filter): add .overlaps('zip_codes', [zip]) once job posting collects zip_code
  const { data: matches } = await supabase
    .from('contractors')
    .select(`
      user_id,
      zip_codes,
      profiles!inner(whatsapp_phone),
      subscriptions!inner(status)
    `)
    .contains('professions', [job.profession])
    .eq('is_active', true)
    .eq('wa_notify', true)
    .eq('subscriptions.status', 'active')
    .neq('user_id', userId)
    .limit(50);

  const matchedIds = (matches || []).map(c => c.user_id);

  // Update lead with matched contractors
  if (matchedIds.length > 0) {
    await supabase.from('leads').update({
      status: 'sent',
      matched_contractors: matchedIds,
      sent_to_count: matchedIds.length,
    }).eq('id', lead.id);

    // Send notifications — each wrapped in try/catch so one failure doesn't stop the rest
    for (const contractor of (matches || [])) {
      try {
        const waPhone = (contractor as { profiles: { whatsapp_phone: string } }).profiles?.whatsapp_phone;
        if (!waPhone) continue;
        await sendLeadNotification(
          waPhone,
          lead.id,
          contractor.user_id,
          job.profession,
          job.city,
          job.description,
          'Contractor Network',
          phone.replace('+', ''),
        );
      } catch (err) {
        console.error('[post-job] Failed to notify contractor', contractor.user_id, err);
      }
    }
  }
  ```

- [ ] **Step 2: Verify the change**

  ```bash
  grep -n "subscriptions.*inner\|profiles.*inner\|try.*catch\|TODO.*zip" supabase/functions/whatsapp-webhook/index.ts | tail -10
  ```
  Expected: lines showing the inner joins, try/catch, and TODO comment.

- [ ] **Step 3: Commit**

  ```bash
  git add supabase/functions/whatsapp-webhook/index.ts
  git commit -m "fix: post-job loop — active subscription filter, single JOIN query, error handling per contractor"
  ```

---

### Task 4: Deploy Edge Function to Supabase

- [ ] **Step 1: Deploy whatsapp-webhook**

  ```bash
  supabase functions deploy whatsapp-webhook --project-ref zyytzwlvtuhgbjpalbgd
  ```
  Expected: `Deployed whatsapp-webhook (version N)`

- [ ] **Step 2: Verify deployment**

  ```bash
  supabase functions list --project-ref zyytzwlvtuhgbjpalbgd
  ```
  Expected: `whatsapp-webhook` row shows updated version number.

- [ ] **Step 3: Smoke test — send a WhatsApp message to the bot number**

  Send "MENU" from a test number. Confirm bot responds. Check Supabase logs:
  ```bash
  supabase functions logs whatsapp-webhook --project-ref zyytzwlvtuhgbjpalbgd --tail
  ```
  Expected: no errors, 200 response logged.

---

## Phase 2 — Database Migrations

### Task 5: Migration 065 — Lead notifications dedup table

**Files:**
- Create: `supabase/migrations/065_lead_notifications_dedup.sql`

**Context:** Prevents both the Edge Function and the Matching Worker from sending the same lead to the same contractor twice. Both paths INSERT before sending; `ON CONFLICT DO NOTHING` silently skips duplicates.

- [ ] **Step 1: Create the migration file**

  ```sql
  -- 065: Lead notifications dedup — prevents double-send from competing systems
  CREATE TABLE IF NOT EXISTS public.lead_notifications (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id       uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
    contractor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    channel       text NOT NULL DEFAULT 'whatsapp' CHECK (channel IN ('whatsapp', 'telegram')),
    sent_at       timestamptz NOT NULL DEFAULT now(),
    UNIQUE(lead_id, contractor_id)
  );

  ALTER TABLE public.lead_notifications ENABLE ROW LEVEL SECURITY;

  -- Service role only (workers use service key)
  CREATE POLICY "service_role_only" ON public.lead_notifications
    USING (auth.role() = 'service_role');

  -- Index for fast lookups by lead
  CREATE INDEX idx_lead_notifications_lead ON public.lead_notifications(lead_id);
  ```

- [ ] **Step 2: Apply migration**

  ```bash
  supabase db push --project-ref zyytzwlvtuhgbjpalbgd
  ```
  Expected: `Applying migration 065_lead_notifications_dedup.sql`

- [ ] **Step 3: Verify table exists**

  ```bash
  supabase db execute --project-ref zyytzwlvtuhgbjpalbgd \
    "SELECT table_name FROM information_schema.tables WHERE table_name = 'lead_notifications';"
  ```
  Expected: one row returned.

- [ ] **Step 4: Add dedup INSERT to `sendLeadNotification` in whatsapp-webhook**

  Inside `sendLeadNotification`, before `await sendButtons(...)` (around line 1153), add:
  ```typescript
  // Dedup: skip if already sent this lead to this contractor (prevents double-send from competing systems)
  const { error: dedupError } = await supabase
    .from('lead_notifications')
    .insert({ lead_id: leadId, contractor_id: _userId, channel: 'whatsapp' });
  if (dedupError?.code === '23505') {
    // Unique constraint violation — already sent, skip silently
    console.log(`[lead-notify] Duplicate skipped: lead=${leadId} contractor=${_userId}`);
    return;
  }
  ```

- [ ] **Step 5: Commit**

  ```bash
  git add supabase/migrations/065_lead_notifications_dedup.sql supabase/functions/whatsapp-webhook/index.ts
  git commit -m "feat: add lead_notifications dedup table — prevents double-send across competing systems"
  ```

---

### Task 6: Migration 066 — pg_cron automation

**Files:**
- Create: `supabase/migrations/066_pg_cron_jobs.sql`

**Context:** Two automation jobs:
1. Reset `available_today=false` at 04:00 UTC (midnight ET / 06:00 IL) — so contractors must check in fresh each day
2. Delete stale `wa_onboard_state` rows every hour — rows older than 2h are dead context

- [ ] **Step 1: Create the migration file**

  ```sql
  -- 066: pg_cron automation — available_today reset + wa_onboard_state TTL cleanup

  -- Requires pg_cron extension (already enabled on Supabase Pro/Team)
  CREATE EXTENSION IF NOT EXISTS pg_cron;

  -- Job 1: Reset available_today at 04:00 UTC daily (= midnight ET = 06:00 IL)
  SELECT cron.schedule(
    'reset-available-today',
    '0 4 * * *',
    $$UPDATE public.profiles SET available_today = false WHERE available_today = true$$
  );

  -- Job 2: Delete stale wa_onboard_state rows every hour (2h TTL)
  SELECT cron.schedule(
    'clean-wa-onboard-state',
    '0 * * * *',
    $$DELETE FROM public.wa_onboard_state WHERE updated_at < NOW() - INTERVAL '2 hours'$$
  );
  ```

- [ ] **Step 2: Apply migration**

  ```bash
  supabase db push --project-ref zyytzwlvtuhgbjpalbgd
  ```
  Expected: `Applying migration 066_pg_cron_jobs.sql`

- [ ] **Step 3: Verify cron jobs registered**

  ```bash
  supabase db execute --project-ref zyytzwlvtuhgbjpalbgd \
    "SELECT jobname, schedule, command FROM cron.job ORDER BY jobname;"
  ```
  Expected: two rows — `clean-wa-onboard-state` and `reset-available-today`.

- [ ] **Step 4: Commit**

  ```bash
  git add supabase/migrations/066_pg_cron_jobs.sql
  git commit -m "feat: add pg_cron — reset available_today daily + clean stale wa_onboard_state hourly"
  ```

---

### Task 7: Migration 067 — Enable nudge engine cron

**Files:**
- Create: `supabase/migrations/067_enable_nudges.sql`

**Context:** Migration 056 defines the nudge schedule but all `cron.schedule` calls are commented out. This migration enables them. The `process-nudges` Edge Function URL is `https://zyytzwlvtuhgbjpalbgd.supabase.co/functions/v1/process-nudges`.

- [ ] **Step 1: Get the service role key to embed in cron HTTP call**

  ```bash
  supabase secrets list --project-ref zyytzwlvtuhgbjpalbgd | grep SERVICE_ROLE
  ```
  Copy the value — needed for the `Authorization` header in the cron HTTP request.

- [ ] **Step 2: Create the migration file**

  ⚠️ **SECURITY NOTE:** Do NOT embed the service role key in a file committed to git.
  The migration uses a Supabase Vault secret or a DB-level setting. Apply these two commands
  in Supabase SQL Editor (not as a migration file):

  ```sql
  -- First: store the key as a DB setting (run once in Supabase SQL editor, not committed to git)
  ALTER DATABASE postgres SET app.service_role_key = '<YOUR_SERVICE_ROLE_KEY>';
  ```

  Then create the migration file `supabase/migrations/067_enable_nudges.sql`:
  ```sql
  -- 067: Enable nudge engine cron jobs (was disabled in 056)
  -- Service role key is read from DB setting app.service_role_key (set separately, not in git)

  -- Onboarding nudges: every 15 min
  SELECT cron.schedule(
    'nudge-onboarding',
    '*/15 * * * *',
    $$
    SELECT net.http_post(
      url := 'https://zyytzwlvtuhgbjpalbgd.supabase.co/functions/v1/process-nudges',
      headers := json_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key')
      )::jsonb,
      body := '{"stage": "onboarding"}'::jsonb
    );
    $$
  );

  -- Trial nudges: hourly at :17
  SELECT cron.schedule(
    'nudge-trial',
    '17 * * * *',
    $$
    SELECT net.http_post(
      url := 'https://zyytzwlvtuhgbjpalbgd.supabase.co/functions/v1/process-nudges',
      headers := json_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key')
      )::jsonb,
      body := '{"stage": "trial"}'::jsonb
    );
    $$
  );

  -- Win-back nudges: every 6h at :23
  SELECT cron.schedule(
    'nudge-winback',
    '23 */6 * * *',
    $$
    SELECT net.http_post(
      url := 'https://zyytzwlvtuhgbjpalbgd.supabase.co/functions/v1/process-nudges',
      headers := json_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key')
      )::jsonb,
      body := '{"stage": "win_back"}'::jsonb
    );
    $$
  );

  -- Paying nudges: daily at 09:03 UTC
  SELECT cron.schedule(
    'nudge-paying',
    '3 9 * * *',
    $$
    SELECT net.http_post(
      url := 'https://zyytzwlvtuhgbjpalbgd.supabase.co/functions/v1/process-nudges',
      headers := json_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key')
      )::jsonb,
      body := '{"stage": "paying"}'::jsonb
    );
    $$
  );
  ```

- [ ] **Step 3: Apply migration**

  ```bash
  supabase db push --project-ref zyytzwlvtuhgbjpalbgd
  ```

- [ ] **Step 4: Verify all nudge jobs registered**

  ```bash
  supabase db execute --project-ref zyytzwlvtuhgbjpalbgd \
    "SELECT jobname, schedule FROM cron.job WHERE jobname LIKE 'nudge-%';"
  ```
  Expected: 4 rows (nudge-onboarding, nudge-trial, nudge-winback, nudge-paying).

- [ ] **Step 5: Commit**

  ```bash
  git add supabase/migrations/067_enable_nudges.sql
  git commit -m "feat: enable nudge engine pg_cron jobs (was disabled in 056)"
  ```

---

## Phase 3 — Render Deployment

### Task 8: Create `render.yaml`

**Files:**
- Create: `render.yaml` (repo root)

**Context:** 5 Docker worker services. All services except `matching` build from their own subdirectory. `matching` builds from repo root because it uses pnpm workspaces + `packages/shared`.

- [ ] **Step 1: Create render.yaml**

  ```yaml
  services:
    # ── wa-listener: scans WhatsApp groups, emits raw-messages to Redis ──
    - type: worker
      name: wa-listener
      env: docker
      dockerfilePath: services/wa-listener/Dockerfile
      dockerContext: services/wa-listener
      plan: starter
      envVars:
        - key: NODE_ENV
          value: production
        - key: SUPABASE_URL
          sync: false
        - key: SUPABASE_SERVICE_KEY
          sync: false
        - key: REDIS_URL
          fromGroup: redis-shared

    # ── parser: raw-messages → parsed-leads (OpenAI extraction) ──
    - type: worker
      name: parser
      env: docker
      dockerfilePath: services/parser/Dockerfile
      dockerContext: services/parser
      plan: starter
      envVars:
        - key: NODE_ENV
          value: production
        - key: SUPABASE_URL
          sync: false
        - key: SUPABASE_SERVICE_KEY
          sync: false
        - key: OPENAI_API_KEY
          sync: false
        - key: REDIS_URL
          fromGroup: redis-shared

    # ── matching: parsed-leads → wa-notifications + notifications ──
    # Builds from repo root (needs pnpm workspace + packages/shared)
    - type: worker
      name: matching
      env: docker
      dockerfilePath: services/matching/Dockerfile
      dockerContext: .
      plan: starter
      envVars:
        - key: NODE_ENV
          value: production
        - key: SUPABASE_URL
          sync: false
        - key: SUPABASE_SERVICE_KEY
          sync: false
        - key: MAX_CONTRACTORS_PER_LEAD
          value: "50"
        - key: REDIS_URL
          fromGroup: redis-shared

    # ── whatsapp-notify: wa-notifications → Twilio WhatsApp free text ──
    - type: worker
      name: whatsapp-notify
      env: docker
      dockerfilePath: services/whatsapp-notify/Dockerfile
      dockerContext: services/whatsapp-notify
      plan: starter
      envVars:
        - key: NODE_ENV
          value: production
        - key: SUPABASE_URL
          sync: false
        - key: SUPABASE_SERVICE_KEY
          sync: false
        - key: TWILIO_ACCOUNT_SID
          sync: false
        - key: TWILIO_AUTH_TOKEN
          sync: false
        - key: TWILIO_WA_FROM
          sync: false
        - key: REDIS_URL
          fromGroup: redis-shared

    # ── notification: notifications → Telegram messages ──
    - type: worker
      name: notification
      env: docker
      dockerfilePath: services/notification/Dockerfile
      dockerContext: services/notification
      plan: starter
      envVars:
        - key: NODE_ENV
          value: production
        - key: SUPABASE_URL
          sync: false
        - key: SUPABASE_SERVICE_KEY
          sync: false
        - key: TELEGRAM_BOT_TOKEN
          sync: false
        - key: REDIS_URL
          fromGroup: redis-shared

  envVarGroups:
    - name: redis-shared
      envVars:
        - key: REDIS_URL
          sync: false   # set manually in Render dashboard
  ```

- [ ] **Step 2: Verify file created**

  ```bash
  cat render.yaml | grep "name:"
  ```
  Expected: 5 service names printed.

- [ ] **Step 3: Commit**

  ```bash
  git add render.yaml
  git commit -m "feat: add render.yaml — deploy 5 worker services (wa-listener, parser, matching, whatsapp-notify, notification)"
  ```

---

### Task 9: Deploy to Render

- [ ] **Step 1: Create a Redis instance on Render (or Upstash)**

  Option A — Render managed Redis:
  - Go to Render Dashboard → New → Redis → name: `redis-shared` → Free plan → Create
  - Copy the `REDIS_URL` (starts with `redis://` or `rediss://` for TLS)

  Option B — Upstash (recommended for prod):
  - Go to upstash.com → Create database → Copy `REDIS_URL` (use TLS URL: `rediss://...`)

- [ ] **Step 2: Set the Redis URL in Render env var group**

  Render Dashboard → Env Groups → `redis-shared` → Add `REDIS_URL` → paste URL from step 1.

- [ ] **Step 3: Connect repo to Render via render.yaml**

  First check if any of these services already exist in your Render dashboard (wa-listener, parser, matching, whatsapp-notify, notification). If they do, update them manually instead of using Blueprint to avoid conflicts.

  If none exist yet:
  Render Dashboard → New → Blueprint → connect GitHub repo → Render auto-detects `render.yaml` → approve services → Deploy.

  If some already exist:
  Update each existing service's Docker settings to match the `render.yaml` config above (dockerfilePath, dockerContext). Add any missing services manually.

- [ ] **Step 4: Set secret env vars for each service**

  In Render Dashboard, for each service set the `sync: false` vars:

  | Service | Env Var | Value source |
  |---------|---------|-------------|
  | All | `SUPABASE_URL` | Supabase dashboard → Project Settings → API |
  | All | `SUPABASE_SERVICE_KEY` | Supabase dashboard → Project Settings → API → service_role key |
  | parser | `OPENAI_API_KEY` | OpenAI dashboard |
  | whatsapp-notify | `TWILIO_ACCOUNT_SID` | Twilio Console |
  | whatsapp-notify | `TWILIO_AUTH_TOKEN` | Twilio Console |
  | whatsapp-notify | `TWILIO_WA_FROM` | e.g. `whatsapp:+14155238886` |
  | notification | `TELEGRAM_BOT_TOKEN` | @BotFather |

- [ ] **Step 5: Verify all services are running**

  In Render Dashboard, all 5 services should show `Live` status.
  Check logs for each — no crash loops, no `Missing required env var` errors.

  For matching service specifically:
  - Logs should show: `[matching] Worker started, listening on queue: parsed-leads`

  For whatsapp-notify:
  - Logs should show: `[wa-notify] Worker started, listening on queue: wa-notifications`

---

## Phase 4 — Activation

### Task 10: Disable DRY_RUN in process-nudges

**Files:**
- Modify: `supabase/functions/process-nudges/index.ts:62`

- [ ] **Step 1: Flip the flag**

  File: `supabase/functions/process-nudges/index.ts`, line 62:
  ```typescript
  // BEFORE
  const DRY_RUN = true; // CHANGE TO false WHEN READY TO GO LIVE

  // AFTER
  const DRY_RUN = false;
  ```

- [ ] **Step 2: Deploy process-nudges**

  ```bash
  supabase functions deploy process-nudges --project-ref zyytzwlvtuhgbjpalbgd
  ```
  Expected: `Deployed process-nudges (version N)`

- [ ] **Step 3: Trigger manually to verify**

  ```bash
  curl -X POST \
    "https://zyytzwlvtuhgbjpalbgd.supabase.co/functions/v1/process-nudges" \
    -H "Authorization: Bearer $(supabase secrets list --project-ref zyytzwlvtuhgbjpalbgd | grep SERVICE_ROLE | awk '{print $2}')" \
    -H "Content-Type: application/json" \
    -d '{"stage": "onboarding"}'
  ```
  Expected JSON response: `{ "ok": true, "dry_run": false, "processed": N }`

- [ ] **Step 4: Commit**

  ```bash
  git add supabase/functions/process-nudges/index.ts
  git commit -m "feat: activate nudge engine — DRY_RUN=false"
  ```

---

### Task 11: E2E Verification Checklist

- [ ] **Check 1: Lead notification flow (post-job)**

  1. Open dashboard → post a new job as a customer (WhatsApp bot or dashboard)
  2. Confirm lead inserted in `leads` table
  3. Confirm matching contractors received WhatsApp notification
  4. Contractor replies "Claim" → confirm `lead_notifications` row inserted + contact link sent
  5. Same contractor claims same lead again → confirm **duplicate blocked** (check `lead_notifications` table — only 1 row)
  6. Second contractor claims same lead → confirm **succeeds** (second row in `lead_notifications`)

- [ ] **Check 2: US template routing**

  Send a lead notification to a `+1` US number test contractor.
  Check Twilio logs → confirm template SID used is `LEAD_NOTIFY_BTN` (UTILITY), not `LEAD_NOTIFY` (MARKETING).

- [ ] **Check 3: Subscription filter**

  Manually set a contractor's subscription to `canceled` in DB.
  Post a job. Confirm canceled contractor does **not** receive notification.

- [ ] **Check 4: Redis queue flow**

  In Render logs for `matching` service:
  - Should see `[matching] Processing lead ...` entries when leads arrive in `parsed-leads` queue.

  In `wa-notify` service logs:
  - Should see `[wa-notify] Sent WA to ...` entries.

- [ ] **Check 5: pg_cron jobs running**

  ```bash
  supabase db execute --project-ref zyytzwlvtuhgbjpalbgd \
    "SELECT jobname, last_run_time, status FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;"
  ```
  After 04:00 UTC next day: `reset-available-today` shows `succeeded`.
  After next full hour: `clean-wa-onboard-state` shows `succeeded`.

- [ ] **Check 6: Nudges firing**

  ```bash
  supabase db execute --project-ref zyytzwlvtuhgbjpalbgd \
    "SELECT * FROM cron.job_run_details WHERE jobname LIKE 'nudge-%' ORDER BY start_time DESC LIMIT 5;"
  ```
  Expected: `nudge-onboarding` rows showing `succeeded` every 15 min.

---

## Summary of All Files Touched

| File | Type | Task |
|------|------|------|
| `supabase/functions/whatsapp-webhook/index.ts` | Modified | Tasks 1, 2, 3, 5 |
| `supabase/functions/process-nudges/index.ts` | Modified | Task 10 |
| `supabase/migrations/065_lead_notifications_dedup.sql` | Created | Task 5 |
| `supabase/migrations/066_pg_cron_jobs.sql` | Created | Task 6 |
| `supabase/migrations/067_enable_nudges.sql` | Created | Task 7 |
| `render.yaml` | Created | Task 8 |
