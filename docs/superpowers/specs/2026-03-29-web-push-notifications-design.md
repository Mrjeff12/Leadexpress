# Web Push Notifications — Design Spec
**Date:** 2026-03-29
**Status:** Approved

---

## Goal

Allow contractors to receive native push notifications on their phone/desktop when a new lead arrives — even when the dashboard is closed. Activated once via a persistent banner that appears until the contractor enables it.

---

## Architecture

```
[Magic Link → Dashboard]
       ↓
[PushBanner — persistent until enabled]
       ↓ contractor clicks "Enable"
[Browser permission prompt]
       ↓ granted
[Register push subscription → save to push_subscriptions table]
       ↓
[Lead arrives → matching service → adds job to push-notifications queue]
       ↓
[notification service push-worker → Web Push API → browser]
       ↓
[Contractor sees notification on phone/desktop — app closed or open]
```

---

## Notification Channel Priority (updated)

```
1. Push Notification  → always available if subscribed (free)
2. WhatsApp           → if wa_window_until > now (free within session)
3. SMS                → fallback (Twilio, ~$0.008/msg) — future
4. Telegram           → bonus if telegram_chat_id set
```

Push is first because it's free, instant, and has no time-window restriction.

---

## Components

### 1. Supabase — `push_subscriptions` table

```sql
CREATE TABLE push_subscriptions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  endpoint    text NOT NULL,
  p256dh      text NOT NULL,
  auth        text NOT NULL,
  user_agent  text,
  created_at  timestamptz DEFAULT now(),
  UNIQUE(user_id, endpoint)
);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
-- Contractors can only manage their own subscriptions
CREATE POLICY "own subscriptions" ON push_subscriptions
  FOR ALL USING (auth.uid() = user_id);
```

### 2. Service Worker — `apps/dashboard/public/sw.js`

A minimal service worker that:
- Listens for `push` events
- Displays a notification with title, body, icon, and a click action that opens the dashboard
- Handles `notificationclick` to focus or open the dashboard tab

No caching logic — keep it simple and focused on push only.

### 3. Frontend — `usePushNotifications.ts` hook

Responsibilities:
- Check if push is supported in this browser
- Check current permission state (`granted` / `denied` / `default`)
- Register service worker on first call
- Subscribe to push using VAPID public key
- POST subscription to `/api/push/subscribe` (Supabase Edge Function or direct Supabase insert)
- Return `{ status, enable, isLoading }`

### 4. Frontend — `PushBanner.tsx`

- Shown on every dashboard page until `status === 'granted'`
- Fixed banner at the top (below navbar) — not dismissible until enabled
- Copy: "🔔 Enable notifications so you never miss a lead — works even when this tab is closed"
- CTA button: "Enable Notifications"
- On iOS: shows extra note "Add this page to your Home Screen first for best results"
- Once granted: banner disappears permanently (stored in `push_subscriptions` presence)

### 5. Backend — VAPID Keys

- Generate once: `web-push generate-vapid-keys`
- Store as env vars: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (mailto:admin@...)
- Public key exposed to frontend via `VITE_VAPID_PUBLIC_KEY`

### 6. Backend — Push subscription endpoint

A lightweight Supabase Edge Function `push-subscribe`:
- Receives `{ endpoint, keys: { p256dh, auth } }` from frontend
- Inserts into `push_subscriptions` using service role
- Returns `{ ok: true }`

Alternatively: direct Supabase client insert from frontend (RLS allows it).
**Decision:** Direct frontend insert — simpler, no edge function needed.

### 7. `notification` service — `push-worker.ts`

New file added to `services/notification/src/`:
- Listens on BullMQ queue `push-notifications`
- Job payload: `{ leadId, contractorId, title, body }`
- Fetches all `push_subscriptions` for `contractorId`
- Sends Web Push via `web-push` npm library using VAPID keys
- On 410 Gone response (subscription expired): deletes from DB
- Logs success/failure to `pipeline_events`

### 8. `matching` service — updated routing

In `matcher.ts`, before checking WA window:
1. Query `push_subscriptions` for each matched contractor
2. If subscriptions exist → enqueue to `push-notifications` queue
3. Then also check WA window / Telegram as before (push is additive, not exclusive)

Push is sent **in addition to** other channels for the first 30 days, then can be made the primary channel once adoption is high enough.

---

## Data Flow — Lead Arrives

```
1. matching/matcher.ts fetches matched contractors
2. For each contractor:
   a. Check push_subscriptions → if any: add job to push-notifications queue
   b. Check wa_window_until   → if open: add job to wa-notifications queue
   c. Check telegram_chat_id  → if set: add job to notifications queue
3. notification/push-worker.ts picks up push job → sends to all browser subscriptions
4. contractor receives native push notification
5. contractor taps notification → opens dashboard → sees lead
```

---

## iOS Consideration

iOS 16.4+ supports Web Push but only for PWAs added to Home Screen. The banner will detect iOS and show an additional instruction: "Tap Share → Add to Home Screen first."

Detection: `navigator.userAgent` includes `iPhone` or `iPad` + `!window.navigator.standalone`.

---

## Environment Variables

| Variable | Where | Description |
|----------|-------|-------------|
| `VAPID_PUBLIC_KEY` | notification service + dashboard | VAPID public key |
| `VAPID_PRIVATE_KEY` | notification service only | VAPID private key (secret) |
| `VAPID_SUBJECT` | notification service | `mailto:admin@leadexpress.io` |
| `VITE_VAPID_PUBLIC_KEY` | dashboard build | Same as public key |

---

## Out of Scope

- SMS notifications (separate feature, future)
- Push notification analytics / read receipts
- Per-lead-type notification preferences
- Notification grouping / batching
