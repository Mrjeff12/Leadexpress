# Subcontractors Teaser Page — Locked Feature Upsell

**Date:** 2026-03-18
**Status:** Approved

## Goal

Show the Subcontractors/Jobs feature to ALL plan tiers as a locked teaser page, enticing Starter and Pro users to upgrade to Unlimited ($399/mo). Currently these features are completely hidden from non-Unlimited users.

## Approach

**Blur + Mock Data + Animated Story Overlay**

Users see the real Subcontractors page layout with fake data behind a blur, overlaid with a looping step-by-step animation that tells the story of lead forwarding.

## Changes

### 1. Sidebar (`Sidebar.tsx`)

- Show "Subcontractors" and "Jobs" links for ALL plans
- For Starter/Pro: add a lock icon next to the label
- Links navigate to the same routes (`/subcontractors`, `/jobs`)

### 2. Routing (no change needed)

Routes already exist. The page component itself handles the gating logic.

### 3. Subcontractors Page — Teaser View

When `canManageSubs === false`, render:

**Background layer:**
- Mock subcontractors table (4 fake rows: names, professions, job counts, status)
- Mock stats cards: "4 Active Subs", "12 Jobs This Month", "$8,400 Revenue Shared"
- Everything behind `filter: blur(8px)` + `pointer-events: none`

**Overlay layer (centered, semi-transparent dark bg):**
- Looping 4-step animation (~12s total cycle):

  **Step 1 — "A Lead Comes In" (3s)**
  - Slide-in animation of a lead card: "Chimney Repair — Miami, FL"
  - Text: "You receive a lead you can't handle"

  **Step 2 — "Forward to Your Sub" (3s)**
  - Arrow animation transferring lead → sub avatar + WhatsApp bubble
  - Text: "Forward it to a trusted subcontractor"

  **Step 3 — "Track the Deal" (3s)**
  - Progress bar animation: pending → accepted → completed
  - Text: "Track every job and deal in real-time"

  **Step 4 — "Earn Together" (3s)**
  - Revenue split visual + light confetti
  - Text: "Set your terms — percentage or fixed price"

- Progress dots at bottom showing current step
- Fade transitions between steps

**Below animation:**
- CTA button (orange, large): "Upgrade to Unlimited — $399/mo"
- Secondary link: "Compare all plans →"

### 4. Jobs Page — Same Pattern

Apply identical teaser logic to the Jobs page with relevant mock data and messaging.

### 5. Backend

No backend changes needed. All logic is frontend-only using the existing `useSubscriptionAccess` hook.

## Files to Modify

1. `apps/dashboard/src/components/Sidebar.tsx` — always show Subcontractors/Jobs with lock icon
2. `apps/dashboard/src/pages/Subcontractors.tsx` — add teaser view when locked
3. `apps/dashboard/src/pages/JobsDashboard.tsx` — add teaser view when locked
4. New: `apps/dashboard/src/components/FeatureTeaser.tsx` — reusable teaser overlay with animation

## Tech Notes

- Animation: CSS keyframes + React state for step transitions (no external libs)
- Mock data: hardcoded in the teaser component
- Blur: CSS `backdrop-filter: blur(8px)` on the background layer
- The teaser component should be reusable for future locked features
