# Secure Jobs Landing Page — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.
> **REQUIRED DESIGN SKILL:** Use frontend-design:frontend-design for all UI implementation to ensure premium, WOW-level design quality.

**Goal:** Build a public marketing landing page at `/secure-jobs` that sells the job transfer & rating system with a story-driven, emotionally compelling flow.

**Architecture:** Single-file React page component (`SecureJobs.tsx`) with no backend dependencies. Uses Intersection Observer for scroll-triggered animations, Lucide icons, and existing Tailwind + glass-panel design system. Public route (no auth required). React Helmet for SEO meta tags.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, Lucide React, React Helmet, existing CSS animations from `index.css`

**Design Reference:** Must match the premium quality of `PartnerHome.tsx` and `ContractorDirectory.tsx` — glass panels, stagger animations, gradient backgrounds, hover effects, premium shadows.

---

### Task 1: Create the SecureJobs page file with Hero section

**Files:**
- Create: `apps/dashboard/src/pages/SecureJobs.tsx`

**Step 1: Create the page with Section 1 (Hero)**

Create `SecureJobs.tsx` with:
- Full-page wrapper with dark gradient hero (navy `#0a0f1e` → black)
- Subtle animated grid/dot pattern background (CSS)
- MLF branding badge (top-left, same pattern as ContractorDirectory hero)
- Headline: "Pass Jobs. Not Risk." — large, bold, white
- Subheadline: "Hire verified subs. Get rated. Build your reputation. Track every job from handshake to completion — all in one platform."
- Three animated step icons in a row: Verify (ShieldCheck) → Transfer (ArrowRightLeft) → Track (BarChart3) — each with label, appearing sequentially with stagger animation
- CTA button: "Join Free — Start Hiring with Confidence" — orange `#fe5b25` with glow/pulse animation
- Below CTA: "No credit card required. 2-minute setup." in muted text
- Mobile responsive (stacks vertically on small screens)

**Imports needed:**
```tsx
import { Helmet } from 'react-helmet-async'
import { useNavigate } from 'react-router-dom'
import { ShieldCheck, ArrowRightLeft, BarChart3, Dice5, Ghost, HeartHandshake, Star, CheckCircle, LayoutDashboard, MessageSquare, TrendingUp, ArrowRight } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
```

**Step 2: Verify Hero renders**

Run the dev server and navigate to `/secure-jobs` to verify the Hero section renders correctly with animations.

**Step 3: Commit**

```bash
git add apps/dashboard/src/pages/SecureJobs.tsx
git commit -m "feat: add SecureJobs landing page with Hero section"
```

---

### Task 2: Add public route in App.tsx

**Files:**
- Modify: `apps/dashboard/src/App.tsx`

**Step 1: Add lazy import**

Add after the `ContractorDirectory` lazy import (line 40):
```tsx
const SecureJobs = lazy(() => import('./pages/SecureJobs'))
```

**Step 2: Add route**

Add a new `<Route>` inside the public routes section (after the `/directory` route, around line 248):
```tsx
<Route path="/secure-jobs" element={<SecureJobs />} />
```

**Step 3: Verify route works**

Navigate to `/secure-jobs` in the browser — should render the Hero section without requiring login.

**Step 4: Commit**

```bash
git add apps/dashboard/src/App.tsx
git commit -m "feat: add /secure-jobs public route"
```

---

### Task 3: Add Section 2 — "The Problem"

**Files:**
- Modify: `apps/dashboard/src/pages/SecureJobs.tsx`

**Step 1: Add The Problem section**

Below the Hero, add Section 2:
- White/off-white background (`#faf9f6`)
- Section title: "Passing Jobs Today? It's All Based on Luck."
- Three glass-panel cards in a responsive grid (1 col mobile, 3 col desktop):

**Card 1 — "No Information"** (Dice5 icon, red/orange tint)
"You give a job to someone you don't know. No reviews. No history. Just a phone number from a WhatsApp group."

**Card 2 — "No Control"** (Ghost icon, purple tint)
"They stop answering. They do bad work. They take the money and disappear. You have no way to protect yourself."

**Card 3 — "Both Sides Lose"** (HeartHandshake icon, amber tint)
"Your sub also takes a risk. They do the work, but sometimes don't get paid. Without trust — everyone loses."

- Summary line below cards: "This happens every day. Billions in jobs move with zero protection. Until now."
- Cards should animate in with stagger effect when scrolled into view (Intersection Observer)

**Step 2: Verify section renders with animations**

**Step 3: Commit**

```bash
git add apps/dashboard/src/pages/SecureJobs.tsx
git commit -m "feat: add Problem section to SecureJobs page"
```

---

### Task 4: Add Section 3 — "The Solution"

**Files:**
- Modify: `apps/dashboard/src/pages/SecureJobs.tsx`

**Step 1: Add The Solution section**

- Background: subtle gradient from white to very light orange (`#fff8f5`)
- Title: "We Built the Missing Layer of Trust"
- Subtitle: "Think of us as the safety net between you and your sub. We verify, track, and rate — so you don't have to hope for the best."
- Three steps in a horizontal flow with connecting lines/arrows between them:

**Step 1 — Verify** (ShieldCheck, green)
"Every sub on our platform is verified. Real identity. Real work history. Real ratings from real people."

**Step 2 — Transfer** (ArrowRightLeft, orange)
"Send a job to your sub with one click. They get all the details. You get a dashboard to follow everything."

**Step 3 — Track** (BarChart3, blue)
"See the job status in real time. When it's done — both sides rate each other. Good work builds reputation. Bad work gets flagged."

- Highlight box (glass panel with orange left border):
"Your sub doesn't have an account yet? No problem. Send them a link to join — it takes 2 minutes. Then transfer the job directly."

- Steps animate in sequentially with stagger
- On mobile: vertical flow instead of horizontal

**Step 2: Verify section renders**

**Step 3: Commit**

```bash
git add apps/dashboard/src/pages/SecureJobs.tsx
git commit -m "feat: add Solution section to SecureJobs page"
```

---

### Task 5: Add Section 4 — "Trust System"

**Files:**
- Modify: `apps/dashboard/src/pages/SecureJobs.tsx`

**Step 1: Add Trust System section**

- White background
- Title: "Trust Goes Both Ways"
- Subtitle: "After every job, both sides rate each other. Over time, the best people rise to the top."
- Two glass-panel columns side by side (stacked on mobile):

**Column A — "When You Hire a Sub"**
- ⭐ Rate their work quality
- ⭐ Rate their communication
- ⭐ Rate if they finished on time
- ✅ "Would you hire them again?"

**Column B — "When You Are the Sub"**
- ⭐ Rate if they paid on time
- ⭐ Rate their communication
- ⭐ Rate if the job was as described
- ✅ "Would you work with them again?"

- Below columns: Tier badges in a row with connecting arrows:
  🟢 New → 🔵 Verified → 🟣 Trusted → 🟡 Elite
- Each badge is a styled pill/circle with label
- Explanation text: "The more jobs you complete and the better your ratings — the higher your tier. Higher tier = more trust = more jobs."

**Step 2: Verify section renders**

**Step 3: Commit**

```bash
git add apps/dashboard/src/pages/SecureJobs.tsx
git commit -m "feat: add Trust System section to SecureJobs page"
```

---

### Task 6: Add Section 5 — "Dashboard"

**Files:**
- Modify: `apps/dashboard/src/pages/SecureJobs.tsx`

**Step 1: Add Dashboard section**

- Dark background (navy/charcoal `#0f172a`) for contrast
- Title: "Your Jobs. One Dashboard. Full Control." (white text)
- Subtitle: "No more chasing updates on WhatsApp. See everything in one place."
- Stylized dashboard mockup area:
  - Create a visual "fake dashboard" UI using glass panels on dark background
  - Show 3-4 fake job cards with status indicators (Active, Completed, Pending)
  - Add subtle glow effect (`box-shadow` with orange tint)
  - Slight 3D perspective tilt with CSS `transform: perspective(1000px) rotateY(-5deg)`
- Three feature points below the mockup:
  📋 **Job Status** — "See which jobs are active, completed, or waiting — in real time."
  💬 **Communication Log** — "All messages and updates in one place. No more scrolling through chats."
  📊 **Performance Over Time** — "Track your ratings, completed jobs, and reputation score as you grow."
- Summary: "This is not just a tool. It's your professional profile — and it follows you everywhere."

**Step 2: Verify dark section renders with proper contrast**

**Step 3: Commit**

```bash
git add apps/dashboard/src/pages/SecureJobs.tsx
git commit -m "feat: add Dashboard section to SecureJobs page"
```

---

### Task 7: Add Section 6 — "CTA" (Final)

**Files:**
- Modify: `apps/dashboard/src/pages/SecureJobs.tsx`

**Step 1: Add final CTA section**

- Dark gradient background matching Hero (creates full-circle feeling)
- Title: "Ready to Pass Jobs the Smart Way?" (white, large)
- Subtitle: "Join for free. Set up your profile in 2 minutes. Start building your reputation today."
- Large CTA button: "Join Free Now →" (orange `#fe5b25`, animated glow pulse)
  - `onClick` navigates to `/login`
- Three checkmarks below button:
  ✓ No credit card needed
  ✓ Free to join
  ✓ Takes 2 minutes
- MLF footer branding (same as ContractorDirectory footer)

**Step 2: Verify full page scroll experience**

Scroll through the entire page end-to-end. Verify:
- All 6 sections render correctly
- Animations trigger on scroll
- Mobile responsive (check at 375px width)
- CTA button navigates to `/login`
- No console errors

**Step 3: Commit**

```bash
git add apps/dashboard/src/pages/SecureJobs.tsx
git commit -m "feat: add CTA section and complete SecureJobs page"
```

---

### Task 8: Add SEO meta tags and final polish

**Files:**
- Modify: `apps/dashboard/src/pages/SecureJobs.tsx`

**Step 1: Add Helmet meta tags**

At the top of the component return, add:
```tsx
<Helmet>
  <title>Pass Jobs. Not Risk. | MasterLeadFlow</title>
  <meta name="description" content="Hire verified subs. Get rated. Build your reputation. Track every job from handshake to completion — the trust platform for contractors." />
  <meta property="og:title" content="Pass Jobs. Not Risk. | MasterLeadFlow" />
  <meta property="og:description" content="The missing layer of trust for the construction industry. Verify, transfer, and track jobs with confidence." />
  <meta property="og:type" content="website" />
</Helmet>
```

**Step 2: Add smooth scroll behavior**

Ensure the page wrapper has `scroll-behavior: smooth` and sections have proper spacing.

**Step 3: Final visual QA**

- Desktop (1280px): verify all sections, animations, spacing
- Tablet (768px): verify grid collapses correctly
- Mobile (375px): verify single column, readable text, CTA accessible

**Step 4: Commit**

```bash
git add apps/dashboard/src/pages/SecureJobs.tsx
git commit -m "feat: add SEO meta tags and polish SecureJobs page"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Hero section + page scaffold | Create `SecureJobs.tsx` |
| 2 | Public route in App.tsx | Modify `App.tsx` |
| 3 | Section 2 — The Problem | Modify `SecureJobs.tsx` |
| 4 | Section 3 — The Solution | Modify `SecureJobs.tsx` |
| 5 | Section 4 — Trust System | Modify `SecureJobs.tsx` |
| 6 | Section 5 — Dashboard | Modify `SecureJobs.tsx` |
| 7 | Section 6 — CTA | Modify `SecureJobs.tsx` |
| 8 | SEO + Polish + QA | Modify `SecureJobs.tsx` |
