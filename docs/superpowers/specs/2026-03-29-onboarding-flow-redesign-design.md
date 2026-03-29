# Onboarding Flow Redesign — Design Spec

**Date:** 2026-03-29
**Goal:** Streamline the contractor onboarding experience from WhatsApp magic link to fully activated PWA with push notifications. Make it feel like a native app install flow — simple, guided, impossible to get lost.

## Core Priorities
1. Credentials first (email + password) — so even if they abandon, they have an account
2. PWA install — save to home screen with clear animated guide
3. Push notifications — required messaging tied to 7-day free trial activation
4. Abandonment tracking — know exactly where each user dropped off, auto-nudge via WhatsApp

---

## Flow

```
WhatsApp Magic Link
    ↓
AutoLogin (token exchange → session)
    → onboarding_step = 'registered'
    ↓
Step 1/3: Set Credentials (CompleteAccount)
    → Email + Password form
    → onboarding_step = 'credentials_set'
    ↓
Step 2/3: Install App (/install page)
    → Looping CSS animation showing exact steps
    → Platform-specific (iOS Safari / Android Chrome)
    → onboarding_step = 'installed'
    ↓
Step 3/3: Enable Alerts
    → Full-screen native-feeling permission screen
    → Triggers browser Notification.requestPermission()
    → onboarding_step = 'push_enabled'
    ↓
Dashboard ✅
    → Fallback banner if push not granted
```

---

## Step 1: Set Credentials

**Location:** `/complete-account` (existing page, modified)

**UI:**
- Full-screen mobile-first layout, no navbar/header
- Progress bar at top: `Step 1 of 3 ████░░░░░░`
- Clean white background
- Large friendly heading: "Set up your login"
- Subtext: "You'll use this to sign in from your app"
- Email input (pre-filled if available from magic link)
- Password input with show/hide toggle
- Confirm password input
- Large CTA button: "Continue" (`#fe5b25`, full-width, rounded-2xl, shadow)
- No skip option — this step is mandatory

**Behavior:**
- On success: update `onboarding_step = 'credentials_set'`, navigate to `/install`
- On error: inline error message below the field
- Duplicate email: "This email is already in use"

---

## Step 2: Install App

**Location:** `/install` (existing page, redesigned)

**UI:**
- Full-screen, no navbar
- Progress bar at top: `Step 2 of 3 ██████░░░░`
- Heading: "Install the app to get instant lead alerts"
- Subtext: "Required to start your 7-day free trial"

### CSS Animation (replaces static mockups)

**Phone mockup frame:**
- Rounded rectangle with notch (CSS-drawn)
- White interior, platform-accurate UI elements
- Sized to ~60% of screen width, centered

**Animation sequence (iOS) — 15s loop:**

| Time | What happens |
|------|-------------|
| 0-1s | Phone appears with Safari bottom bar |
| 1-4s | Finger slides in from bottom-right, taps Share icon. Share icon pulses with orange glow |
| 4-5s | Share sheet slides up from bottom |
| 5-8s | Finger moves to "Add to Home Screen" row, taps it. Row highlights orange |
| 8-9s | Confirmation dialog appears |
| 9-12s | Finger moves to "Add" button (top-right), taps it |
| 12-13s | Success: app icon drops onto home screen with bounce animation |
| 13-15s | Pause with checkmark, then fade and restart |

**Animation sequence (Android) — 15s loop:**

| Time | What happens |
|------|-------------|
| 0-1s | Phone appears with Chrome top bar |
| 1-4s | Finger taps ⋮ menu (top-right). Menu icon pulses |
| 4-5s | Dropdown menu appears |
| 5-8s | Finger moves to "Add to Home screen" row, taps it |
| 8-9s | Install confirmation dialog appears |
| 9-12s | Finger taps "Add" button |
| 12-13s | App icon appears on home screen with bounce |
| 13-15s | Pause, loop restart |

**Finger element:**
- Circle (~20px) with slight shadow + small "tail" pointing direction of movement
- Color: semi-transparent dark, like a real finger shadow
- Movement: ease-in-out CSS transitions between positions
- Tap effect: brief scale-down (0.9) then scale-up (1.0)

**Step indicator dots** below animation:
- 3 dots, active dot matches current animation phase
- `● ○ ○` → `○ ● ○` → `○ ○ ●`

**Below animation:**
- CTA button: "Done — I've added it!" (`#fe5b25`)
- When tapped: checks `isStandalone()`. If true → update step → navigate. If false → show confirmation dialog
- Small link: "Skip for now" (gray, understated)

**Special cases:**
- WebView detected (WhatsApp browser): show "Open in Safari/Chrome" button first
- Android with `beforeinstallprompt`: show native install button instead of animation
- Desktop: skip this step entirely, go to step 3

---

## Step 3: Enable Alerts

**Location:** Inline in the onboarding wizard flow (after returning from /install) or as full-screen overlay when entering dashboard

**UI — Full screen, app-like:**
- Progress bar: `Step 3 of 3 ██████████`
- Large bell icon (🔔) centered, with subtle pulse animation
- Heading: "Turn on lead alerts"
- Subtext: "Get notified instantly when a new job matches your area. Don't miss out."
- Badge/pill: "Required for your 7-day free trial"
- Large CTA: "🔔 Enable Alerts" (`#fe5b25`, full-width)
- Small link: "Skip for now"

**Design language:**
- Feels like an iOS/Android system permission pre-screen
- White background, centered content, generous spacing
- Large touch targets (min 48px height)
- Rounded corners on everything (2xl)
- Shadows on buttons for depth

**Behavior:**
- Tap "Enable" → calls `Notification.requestPermission()`
- If `granted`: update `onboarding_step = 'push_enabled'`, navigate to dashboard with success toast
- If `denied`: show "You can enable this later in Settings" → navigate to dashboard
- If `unsupported` (not in PWA on iOS): auto-skip this step, don't show it

---

## Dashboard Fallback Banner

**When:** User is on dashboard AND push permission is `'default'` (not yet asked) or was skipped

**UI:**
- Sticky banner at top of dashboard (below any impersonation banner)
- Compact: single row, icon + text + button
- "🔔 Enable alerts to start your free trial" + "Enable" button
- Dismissible (X button), but returns next session if still not granted
- Uses `sessionStorage('push_banner_dismissed')` for dismiss state

---

## Abandonment Tracking

### Database

New column on `contractors` table:

```sql
ALTER TABLE contractors
ADD COLUMN IF NOT EXISTS onboarding_step TEXT DEFAULT 'registered';
```

Values: `'registered'` → `'credentials_set'` → `'installed'` → `'push_enabled'`

### Update Points

| Event | New Value | Updated By |
|-------|-----------|------------|
| Magic link exchanged successfully | `registered` | AutoLogin.tsx |
| Email + password saved | `credentials_set` | CompleteAccount.tsx |
| Confirmed app installed | `installed` | Install.tsx |
| Push permission granted | `push_enabled` | Notification step / Dashboard |

### Rebeca Auto-Nudges

Rebeca checks `onboarding_step` for users who haven't completed setup:

| Stuck at | Wait time | WhatsApp message |
|----------|-----------|-----------------|
| `registered` | 15 min | "Hey! You're one minute away from getting leads. Tap here to set up your password →" + magic link to `/complete-account` |
| `credentials_set` | 10 min | "Almost there! Save the app to your home screen to get instant job alerts →" + magic link to `/install` |
| `installed` | 5 min | "Last step! Enable notifications to start your 7-day free trial →" + magic link to dashboard with push prompt |

Each message includes a **fresh magic link** that auto-logs them in and redirects to the correct step.

### Implementation

- New Supabase cron job or Rebeca scheduled check (every 5 minutes)
- Query: `SELECT * FROM contractors WHERE onboarding_step != 'push_enabled' AND created_at < now() - interval 'X minutes'`
- Track `last_nudge_sent_at` to avoid spam (max 1 nudge per step per user)
- Add `nudge_count` column to limit total nudges (max 3 per user)

---

## Files to Modify

1. **`apps/dashboard/src/pages/CompleteAccount.tsx`** — Rewrite: remove install step, add progress bar, credentials-only flow, update onboarding_step
2. **`apps/dashboard/src/pages/Install.tsx`** — Redesign: replace static mockups with CSS animation, add progress bar, update onboarding_step
3. **`apps/dashboard/src/pages/AutoLogin.tsx`** — Add: set `onboarding_step = 'registered'` after successful login
4. **`apps/dashboard/src/pages/ContractorDashboard.tsx`** — Add: push notification fallback banner
5. **New: `apps/dashboard/src/components/InstallAnimation.tsx`** — CSS animation component (iOS + Android variants)
6. **New: `apps/dashboard/src/components/EnableAlertsStep.tsx`** — Step 3 full-screen notification permission screen
7. **New: `apps/dashboard/src/components/OnboardingProgress.tsx`** — Shared progress bar component (Step X of 3)
8. **`supabase/migrations/XXX_onboarding_step.sql`** — Add column to contractors
9. **Rebeca nudge logic** — New scheduled check + WhatsApp templates for each abandonment stage
