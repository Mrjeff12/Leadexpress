# Implementation Plan: Flow Fixes + PWA Push Notifications

**Spec:** `docs/superpowers/specs/2026-03-29-flow-fixes-pwa-push-design.md`
**Date:** 2026-03-29

## Existing Infrastructure (already built)

- `apps/dashboard/public/sw.js` — push + notificationclick handlers ✅
- `apps/dashboard/src/hooks/usePushNotifications.ts` — registers SW, requests permission, stores subscription ✅
- `apps/dashboard/src/components/PushBanner.tsx` — enable push banner (with iOS detection) ✅
- `supabase/migrations/069_push_subscriptions.sql` — push_subscriptions table ✅
- `services/notification/src/push-worker.ts` — BullMQ worker with web-push ✅
- VAPID keys configured ✅

## Missing Pieces

- `manifest.json` — required for PWA install prompt
- PWA meta tags in `index.html`
- Install guide page (`/install`)
- PWA install banner for dashboard
- Router group link bug fix
- MENU option 6 (dashboard link)
- PWA install message from Rebeca after groups
- CompleteAccount step reorder
- Window monitor edge function (triggers push when 24h closing)
- `last_push_reminder_at` column on contractors

## Steps

### Step 1: PWA Manifest + Meta Tags
- Create `apps/dashboard/public/manifest.json` with app name, icons, display: standalone, theme_color
- Add `<link rel="manifest">` to `apps/dashboard/index.html`
- Add apple-mobile-web-app meta tags

### Step 2: Router Group Link Bug Fix
- Edit `services/rebeca/src/router.ts`
- Before handling group link at priority 3, check if state exists at `groups` step
- If yes, delegate to `handleOnboarding` instead

### Step 3: MENU Option 6 — Dashboard Link
- Edit `services/rebeca/src/lib/i18n.ts` — add option 6 to menu strings (EN + HE)
- Edit `services/rebeca/src/handlers/known-user.ts` — handle input "6" → generateMagicLink → sendText
- Import generateMagicLink (extract to shared lib or inline)

### Step 4: PWA Install Message from Rebeca
- Edit `services/rebeca/src/handlers/onboarding.ts`
- In `handleGroupsStep`, after DONE/skip → send install message with link to /install
- Add install message strings to the handler

### Step 5: Install Page
- Create `apps/dashboard/src/pages/Install.tsx`
- OS detection (iOS/Android/Desktop)
- Step-by-step visual instructions per OS
- iOS: detect WebView → show "Open in Safari" first
- Auto-detect standalone mode → redirect to /complete-account if already installed
- Add route to router

### Step 6: CompleteAccount Step Reorder
- Edit `apps/dashboard/src/pages/CompleteAccount.tsx`
- New flow: install check → email/password → notifications
- On mobile: if not standalone, show "Install first" step pointing to /install
- On desktop: skip install step, go straight to email/password

### Step 7: PWA Install Banner
- Create `apps/dashboard/src/components/PWAInstallBanner.tsx`
- Persistent banner for non-standalone users
- Links to /install
- Dismissible per session, reappears next session
- Hidden when display-mode: standalone
- Add to App.tsx layout

### Step 8: DB Migration — contractors.last_push_reminder_at
- Create `supabase/migrations/070_push_reminder_tracking.sql`
- ALTER TABLE contractors ADD COLUMN last_push_reminder_at TIMESTAMPTZ

### Step 9: Window Monitor Edge Function
- Create `supabase/functions/send-window-reminder/index.ts`
- Query contractors where wa_window_until < NOW() + 2h AND > NOW()
- Join push_subscriptions
- Send web-push with wa.me link in data.url
- Update last_push_reminder_at
- Only send if last reminder > 12h ago

### Step 10: Service Worker Update
- Verify sw.js notificationclick handler opens data.url correctly
- Ensure wa.me links work from notification click
