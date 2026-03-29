# Flow Fixes + PWA Push Notifications — Design Spec

**Date:** 2026-03-29
**Status:** Approved

## Problem

1. Group link bug in router — wrong message during `groups` step
2. Skip CompleteAccount = user locked out (no way to log back in)
3. No "send me dashboard link" in MENU
4. Push notifications don't work from WhatsApp WebView
5. iOS requires PWA install for Web Push
6. Need push-based 24h window reopener (WhatsApp Business API limit)

## Solution Overview

```
WhatsApp (Rebeca)                  Dashboard (PWA)
─────────────────                  ─────────────────
Onboarding → Registration         Auto-login → Install PWA → Email/Pass → Push
     │                                    │
     ├─ "Install our app" msg             ├─ PWA Install Guide (/install)
     ├─ MENU option 6: Dashboard link     ├─ PWA Install Banner (persistent)
     └─ Groups collection                 └─ Service Worker (push + click)

         ┌────────────────────────┐
         │  24h Window Monitor    │
         │  (Edge Function/cron)  │
         └──────┬─────────────────┘
                │ window closing (<2h left)
                ▼
         Web Push Notification
         "Hey John, you have pending leads!"
                │ user taps
                ▼
         wa.me/rebeca?text=👋
                │
         Window reopened ✅
```

## Changes

### 1. Router: Group Link Priority Fix

In `router.ts`, when a group link is detected and user has active state at `groups` step, delegate to onboarding handler instead of `handleGroupLink`:

```ts
if (GROUP_LINK_RE.test(text)) {
  const state = await getState(phone);
  if (state?.step === 'groups') {
    await handleOnboarding(phone, text);
    return;
  }
  await handleGroupLink(phone, text);
  return;
}
```

### 2. MENU Option 6: Dashboard Link

Add to i18n menu strings:
```
6️⃣ 📱 Send Dashboard Link
```

In `known-user.ts`, handle input `6` → call `generateMagicLink(userId)` → send link via WhatsApp.

### 3. PWA Install Message from Rebeca

After groups step `DONE`, send additional message:

```
EN: 📱 One last tip, {name} — Install our app to get instant notifications
even when WhatsApp is quiet:
👉 https://app.masterleadflow.com/install
Takes 30 seconds. You'll never miss a lead!

HE: 📱 טיפ אחרון, {name} — התקן את האפליקציה שלנו כדי לקבל התרעות מיידיות
גם כשוואטסאפ שקט:
👉 https://app.masterleadflow.com/install
לוקח 30 שניות. לא תפספס אף ליד!
```

### 4. PWA Install Page (`/install`)

New page that detects OS and shows step-by-step instructions:

**Android:**
1. Tap ⋮ menu (top right)
2. Tap "Add to Home Screen"
3. Tap "Install"

**iOS:**
1. If in WebView → "Open in Safari" button first (using `window.open` with Safari URL)
2. Tap Share button ⬆️
3. Scroll down → "Add to Home Screen"
4. Tap "Add"

**Desktop:** Skip install, go directly to push permission request.

Auto-detect `display-mode: standalone` → if already installed, redirect to `/complete-account`.

### 5. CompleteAccount Flow Change

**New step order:**
```
Step 1: PWA Install Guide (mobile only, skip on desktop or if already standalone)
Step 2: Email + Password
Step 3: Enable Notifications (only if PWA installed or desktop)
```

If notifications step can't work (not standalone, not desktop) → skip and show PWA Install Banner on dashboard.

### 6. PWA Install Banner (Dashboard)

Persistent banner at top of dashboard for users who haven't installed PWA:

```
🔔 Get instant lead alerts — Install the app → [Install Now]
```

Links to `/install`. Dismissible but reappears next session. Hidden when `display-mode: standalone`.

### 7. Service Worker Updates

`public/sw.js` — handle notification click:

```js
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url;
  if (url) {
    event.waitUntil(clients.openWindow(url));
  }
});
```

### 8. Push Subscription Storage

```sql
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  endpoint TEXT NOT NULL,
  keys_p256dh TEXT NOT NULL,
  keys_auth TEXT NOT NULL,
  device_type TEXT DEFAULT 'unknown',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  UNIQUE(user_id, endpoint)
);

CREATE INDEX idx_push_subs_user ON push_subscriptions(user_id);
```

### 9. Window Monitor + Push Sender (Edge Function)

Edge function `send-window-reminder` triggered by pg_cron every 30 minutes:

```
1. Query contractors where wa_window_until < NOW() + 2 hours AND > NOW()
2. Join with push_subscriptions to get their push endpoints
3. Join with profiles to get first name
4. For each: send Web Push with:
   - title: "MasterLeadFlow"
   - body: "Hey {name}, you have pending leads! Tap to reconnect and see them 👉"
   - data.url: "https://wa.me/{rebeca_number}?text=👋"
5. Log sent notifications to avoid duplicates (last_push_sent_at on contractors)
```

Add column to contractors:
```sql
ALTER TABLE contractors ADD COLUMN IF NOT EXISTS last_push_reminder_at TIMESTAMPTZ;
```

Only send if `last_push_reminder_at` is NULL or > 12 hours ago.

### 10. VAPID Keys

Use existing VAPID keys from env vars (`VITE_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`).
Edge function needs `VAPID_PRIVATE_KEY` and `VAPID_PUBLIC_KEY` in its env.

## Files Changed

| File | Action |
|------|--------|
| `services/rebeca/src/router.ts` | Fix group link priority |
| `services/rebeca/src/handlers/onboarding.ts` | Add PWA install msg after groups |
| `services/rebeca/src/handlers/known-user.ts` | Handle MENU option 6 |
| `services/rebeca/src/lib/i18n.ts` | Add menu option 6 + install strings |
| `apps/dashboard/src/pages/Install.tsx` | **NEW** — PWA install guide |
| `apps/dashboard/src/pages/CompleteAccount.tsx` | Reorder steps: install → email → notifications |
| `apps/dashboard/src/components/PWAInstallBanner.tsx` | **NEW** — persistent install banner |
| `apps/dashboard/public/sw.js` | Add notificationclick handler |
| `supabase/migrations/065_push_subscriptions.sql` | **NEW** — push_subscriptions table + contractors column |
| `supabase/functions/send-window-reminder/index.ts` | **NEW** — cron-triggered push sender |
