# Lead Pipeline — Production Readiness Design
**Date:** 2026-03-27
**Scope:** Full system audit, bug fixes, Render deployment, pg_cron, nudge activation
**Approach:** Bottom-Up (fix code → deploy → activate automation)

---

## 1. System Architecture

Two competing send paths currently exist. The goal is to make both work correctly and deduplicate:

```
[WhatsApp Group]
      ↓
  wa-listener  ──→  Redis: raw-messages
      ↓
    parser     ──→  Redis: parsed-leads
      ↓
   matching   ──→  Redis: wa-notifications   Redis: notifications
      ↓                      ↓                       ↓
                   whatsapp-notify            notification (Telegram)
                   (Twilio free text)

─── Second path (Edge Function, already deployed) ───
[Dashboard: New Job Posted]
      ↓
 broadcast-job ──→ whatsapp-webhook (direct Twilio send)
```

**Rule:** Both paths must check `lead_notifications(lead_id, contractor_id)` UNIQUE before sending. First insert wins; duplicate insert is silently ignored.

---

## 2. Phase 1 — Bug Fixes (10 bugs)

### 2.1 Critical (break core functionality)

**Bug #1 — FIXED: handleClaim empty profession/city**
- File: `supabase/functions/whatsapp-webhook/index.ts:1180`
- Status: ✅ Fixed in current session
- Fix: `handleClaim` now fetches `profession`, `city`, `sender_id` from DB when params are empty

**Bug #2 — MARKETING template sent to US numbers**
- File: `supabase/functions/whatsapp-webhook/index.ts` — `sendLeadNotification()` line 1155
- Problem: Always sends `CONTENT.LEAD_NOTIFY` (MARKETING) — blocked for US `+1` numbers silently
- Fix: `const notifyTemplate = phone.startsWith('+1') ? CONTENT.LEAD_NOTIFY_BTN : CONTENT.LEAD_NOTIFY;`
- Note: `LEAD_NOTIFY_BTN` (env: `TWILIO_CONTENT_LEAD_NOTIFY_BTN`) must be UTILITY category — verify in Twilio Console before deploy. If not UTILITY, create a new UTILITY template and add SID to secrets.

**Bug #3 — No subscription check in post-job loop**
- File: `supabase/functions/whatsapp-webhook/index.ts` line 3230
- Problem: Query on `contractors` table uses only `is_active=true` + `wa_notify=true` — no subscription check
- Fix: Join with `profiles` to get `whatsapp_phone` (consolidating N+1) AND add subscription filter via inner join or subquery on `subscriptions` table where `status='active'`
- Implementation note: confirm `subscriptions` table column names (`user_id`, `status`) in migration 022

**Bug #4 — No zip_code filter in post-job loop**
- File: `supabase/functions/whatsapp-webhook/index.ts` line 3230
- Problem: Query on `contractors` table doesn't filter by zip — sends to all matching-profession contractors nationwide
- Fix: Add `.overlaps('zip_codes', [job.zip_code])` if `job.zip_code` is available, or `.contains('zip_codes', [job.zip_code])`
- Implementation note: verify `job` object has `zip_code` field (check `start_post_job` handler for what fields are collected)

### 2.2 Medium (degrade reliability)

**Bug #5 — Duplicate sends (two competing systems)**
- Problem: Edge Function + Matching Worker can both send same lead to same contractor
- Fix: Create `lead_notifications` table with `UNIQUE(lead_id, contractor_id)`. Both paths INSERT before sending; on conflict do nothing → skip send.
- Migration: `065_lead_notifications_dedup.sql`

**Bug #6 — wa_onboard_state lead context collision**
- File: `supabase/functions/whatsapp-webhook/index.ts` (`sendLeadNotification`)
- Problem: UPSERT on `step='lead_pending'` overwrites if contractor gets 2 leads before replying
- Fix: Include `lead_id` in the upsert key, or store array of pending leads in `data`
- Chosen fix: store as array `data.pendingLeads: [{leadId, senderPhone, profession, city}]`

**Bug #7 — N+1 queries in post-job notification loop**
- File: `supabase/functions/whatsapp-webhook/index.ts` lines 3249-3254
- Problem: Per contractor: `SELECT whatsapp_phone FROM profiles WHERE id = contractor.user_id` — one query per contractor
- Fix: Change initial contractors query to join profiles: `.select('user_id, professions, zip_codes, profiles!inner(whatsapp_phone)')` — returns all data in one query

**Bug #8 — No error handling in notification loop**
- File: `supabase/functions/whatsapp-webhook/index.ts` lines 3249-3268
- Problem: `await sendLeadNotification(...)` throws → entire loop stops → remaining contractors never notified
- Fix:
```typescript
for (const contractor of (matches || [])) {
  try {
    // ... send notification
  } catch (err) {
    console.error('[post-job] Failed to notify contractor', contractor.user_id, err);
    // continue to next contractor
  }
}
```

### 2.3 Low (automation / infra)

**Bug #9 — available_today never resets**
- Problem: Contractors who checked in stay "available" forever
- Fix: pg_cron job at 04:00 UTC daily (= midnight ET / 06:00 IL)

**Bug #10 — wa_onboard_state no TTL**
- Problem: Stale lead context rows accumulate, never deleted
- Fix: pg_cron job every hour deletes rows older than 2 hours

---

## 3. Phase 2 — Render Deployment

### 3.1 Services to deploy (all as Docker workers)

| Service | Dockerfile | Redis queues | Key env vars |
|---------|-----------|-------------|-------------|
| `wa-listener` | `services/wa-listener/Dockerfile` | Produces: `raw-messages` | `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `REDIS_URL`, `WA_SESSION_*` |
| `parser` | `services/parser/Dockerfile` | Consumes: `raw-messages` → Produces: `parsed-leads` | + `OPENAI_API_KEY` |
| `matching` | `services/matching/Dockerfile` | Consumes: `parsed-leads` → Produces: `wa-notifications`, `notifications` | + `MATCHING_MAX_CONTRACTORS` |
| `whatsapp-notify` | `services/whatsapp-notify/Dockerfile` | Consumes: `wa-notifications` | + `TWILIO_*` |
| `notification` | `services/notification/Dockerfile` | Consumes: `notifications` | + `TELEGRAM_BOT_TOKEN` |

### 3.2 render.yaml structure

```yaml
services:
  - type: worker
    name: wa-listener
    dockerfilePath: services/wa-listener/Dockerfile
    envVars: [...]

  - type: worker
    name: parser
    dockerfilePath: services/parser/Dockerfile
    envVars: [...]

  - type: worker
    name: matching
    dockerfilePath: services/matching/Dockerfile
    envVars: [...]

  - type: worker
    name: whatsapp-notify
    dockerfilePath: services/whatsapp-notify/Dockerfile
    envVars: [...]

  - type: worker
    name: notification
    dockerfilePath: services/notification/Dockerfile
    envVars: [...]
```

### 3.3 Redis
- Use Render's managed Redis or Upstash Redis
- All 5 services share the same `REDIS_URL`
- `REDIS_URL` added as a shared environment variable group in Render

---

## 4. Phase 3 — Database / pg_cron

### 4.1 New migration: `065_lead_notifications_dedup.sql`
```sql
CREATE TABLE IF NOT EXISTS lead_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  contractor_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  channel text NOT NULL DEFAULT 'whatsapp', -- 'whatsapp' | 'telegram'
  sent_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(lead_id, contractor_id)
);
```

### 4.2 New migration: `066_pg_cron_jobs.sql`
```sql
-- Reset available_today at midnight ET (04:00 UTC)
SELECT cron.schedule('reset-available-today', '0 4 * * *',
  $$UPDATE profiles SET available_today = false WHERE available_today = true$$
);

-- Clean stale wa_onboard_state rows every hour
SELECT cron.schedule('clean-wa-onboard-state', '0 * * * *',
  $$DELETE FROM wa_onboard_state WHERE updated_at < NOW() - INTERVAL '2 hours'$$
);
```

### 4.3 Enable nudge pg_cron (migration 056)
- Uncomment the cron.schedule calls in `056_nudge_engine.sql` or add new migration `067_enable_nudges.sql`
- Apply via `supabase db push`

---

## 5. Phase 4 — Activation & E2E Testing

### 5.1 Nudge engine
- Set `DRY_RUN = false` in `supabase/functions/process-nudges/index.ts`
- Deploy: `supabase functions deploy process-nudges`

### 5.2 E2E test flow (manual)
1. Contractor sends WhatsApp → check-in recorded → `available_today=true`, `wa_window_until` set
2. New job posted in dashboard → broadcast-job Edge Function fires → contractor receives lead notification
3. Contractor replies "claim" → contact link sent with correct name/city/profession
4. Same contractor claims again → `lead_notifications` dedup blocks duplicate
5. Second contractor claims same lead → succeeds (no exclusive lock)
6. At 04:00 UTC → `available_today` resets to false
7. Nudge fires next morning → contractor gets morning ping → replies → window extends

### 5.3 Monitoring checklist
- [ ] Render service logs for each worker (no crash loops)
- [ ] Redis queue depths (BullMQ dashboard or logs)
- [ ] `pipeline_events` table rows growing as expected
- [ ] `lead_notifications` table showing dedup working
- [ ] Twilio delivery reports — no MARKETING rejections on US numbers

---

## 6. Files Changed Summary

| File | Change |
|------|--------|
| `supabase/functions/whatsapp-webhook/index.ts` | Bugs #1(done), #2, #3, #4, #6, #7, #8 |
| `supabase/migrations/065_lead_notifications_dedup.sql` | New — Bug #5 |
| `supabase/migrations/066_pg_cron_jobs.sql` | New — Bugs #9, #10 |
| `supabase/migrations/067_enable_nudges.sql` | New — enable nudge cron |
| `supabase/functions/process-nudges/index.ts` | DRY_RUN = false |
| `render.yaml` | New — deploy all 5 workers |

---

## 7. Out of Scope
- Stripe billing changes
- Landing page / Dashboard UI changes
- Telegram bot new features
- Partner program changes
