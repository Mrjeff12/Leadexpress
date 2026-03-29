# Landing Page Tab Redesign — Get Jobs | Secure | Post Jobs

**Date:** 2026-03-26
**Status:** Approved

## Overview

Restructure the landing page from a linear two-path scroll into a three-tab toggle system. Contractors land on the page, see the hero + problem section, then choose between three clearly separated value propositions: **Get Jobs**, **Secure**, and **Post Jobs**.

## Goals

- Help contractors immediately understand the three core features
- Reduce cognitive overload from a long linear scroll
- Give Secure Jobs equal visibility alongside Get/Post
- Keep everything on one page (no route changes)

## Page Hierarchy (top to bottom)

```
NAVBAR (fixed)
HERO (unchanged — main CTA + value prop)
CHAOS TO ORDER (problem/solution — before/after WhatsApp)
CONTRACTORS SHOWCASE (team photo + stats)
─────────────────────────────────────
TAB CARDS: [ Get Jobs ] [ Secure ] [ Post Jobs ]
─────────────────────────────────────
  → Tab content (changes based on active tab)
─────────────────────────────────────
PRICING (unchanged)
FAQ (unchanged)
MAP (unchanged)
FOOTER (unchanged)
```

## Tab Navigation Component

### Tab Cards (initial state, in-page)

Three cards in a row, each with icon + short title.

| Tab | Icon | Label |
|-----|------|-------|
| Get Jobs | 📥 (inbox arrow) | Get Jobs |
| Secure | 🛡️ (shield) | Secure |
| Post Jobs | 📤 (megaphone) | Post Jobs |

**Active card styling:**
- Background: gradient orange (warm)
- Box-shadow: orange glow
- Icon: white, larger
- Text: bold, white
- Border: orange

**Inactive card styling:**
- Background: cream/transparent
- Border: subtle gray
- Icon: gray
- Text: regular weight
- Hover: light orange border

**Default active tab:** Get Jobs

### Sticky Behavior — Desktop

When the user scrolls past the tab cards, they transition into a **sticky sidebar** on the left side (RTL = right side):

- Vertical stack of three mini-cards (icon + short text)
- Fixed to the side of the viewport
- Active tab highlighted with glow
- Clicking a tab = smooth scroll to that section + switch content
- Auto-highlight: active tab updates based on which section is in viewport (IntersectionObserver)
- Smooth transition animation (~300ms) from inline cards to sidebar

```
┌────────┐
│ 📥     │ ← active, glowing
│Get Jobs│
├────────┤
│ 🛡️     │
│Secure  │
├────────┤
│ 📤     │
│Post    │
└────────┘
```

### Sticky Behavior — Mobile

When scrolling past the tab cards, they become a **sticky horizontal bar** below the navbar:

```
┌─────────────────────────────────────┐
│  NAVBAR                             │
├───────────┬───────────┬─────────────┤
│ 📥 Get   │ 🛡️ Secure │ 📤 Post    │
└───────────┴───────────┴─────────────┘
```

- Compact: icon + short label
- Active tab highlighted
- Same auto-highlight on scroll behavior

### Content Transition

- Fade-out / fade-in (200ms) when switching tabs
- No route change — DOM swap or conditional rendering
- Smooth scroll to top of tab content area when clicking a tab

## Tab Content

### TAB 1: Get Jobs (default)

**Story:** "We bring jobs to you — you don't have to search"

| # | Section | Description | Component |
|---|---------|-------------|-----------|
| 1 | Receive Jobs from Groups | AI scans your WhatsApp groups 24/7, filters by trade and area | ReceiveJobsSection (existing) |
| 2 | Rebeca Scanner | How the AI reads messages, identifies leads, sends to you | RebecaScannerSection (existing) |
| 3 | Receive Jobs from Contractors | Other contractors transfer jobs they can't take directly to you | New section (or adapted from SubcontractorShowcase) |
| 4 | Your Dashboard | Preview of the management interface — all jobs in one place | DashboardShowcase (existing) |
| 5 | Jobs Feed | Real-time feed of filtered, ready-to-claim jobs | LeadsFeedShowcase (existing) |

### TAB 2: Secure (middle)

**Story:** "Transfer jobs safely — every transaction is verified"

| # | Section | Description | Component |
|---|---------|-------------|-----------|
| 1 | Why Secure | The problem — transferring jobs via WhatsApp is unsafe, no tracking, no verification | New section |
| 2 | Transfer Process | Step by step: Offer → Accept → Transfer → Close | New section (pull content from existing SecureJobs page) |
| 3 | Contractor Verification | Verified profile, ratings, reviews, history | New section |
| 4 | Status Tracking | Both sides see exactly what's happening with the job | New section |

### TAB 3: Post Jobs

**Story:** "Post jobs directly to the right contractors — no group searching"

| # | Section | Description | Component |
|---|---------|-------------|-----------|
| 1 | Publish Jobs | Have a job you can't take? Publish in one click | SubcontractorShowcase (existing) |
| 2 | Smart Distribution | Rebeca finds matching contractors by trade and area | RebecaDistributorSection (existing) |
| 3 | Commissions | Earn money on every job you transfer | EarnMore section (existing) |

## New Components to Build

1. **TabNavigation** — The card-based tab switcher with sticky behavior
2. **TabContent** — Wrapper that manages active tab state and content transitions
3. **SecureWhySection** — Why secure transfers matter (new)
4. **SecureProcessSection** — Step-by-step transfer flow (new, adapt from SecureJobs page)
5. **SecureVerificationSection** — Contractor verification features (new)
6. **SecureTrackingSection** — Status tracking for both parties (new)
7. **ReceiveFromContractorsSection** — Getting jobs transferred from other contractors (new or adapted)

## What Stays Unchanged

- Navbar
- Hero (NetworkSection)
- ChaosToOrderSection
- ContractorsShowcase
- PricingSection
- FAQSection
- MapSection
- Footer

## What Gets Removed from Main Flow

- The linear Path 1 / Path 2 scroll structure
- Direct placement of ReceiveJobs → Dashboard → LeadsFeed → Subcontractor → EarnMore in sequence

These components still exist but are now rendered conditionally inside their respective tabs.

## Technical Notes

- Tab state managed via React useState (no routing)
- IntersectionObserver for auto-highlighting active tab on scroll
- CSS `position: sticky` for sidebar (desktop) and top bar (mobile)
- Breakpoint for sidebar → top bar: ~768px (md)
- Content sections wrapped in a container with `min-height` to avoid layout jumps on tab switch
- Existing section components reused as-is inside tab containers
- RTL support: sidebar sticks to right side, tab order preserved
