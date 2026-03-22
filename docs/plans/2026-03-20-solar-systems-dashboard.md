# Solar Systems Dashboard Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign the admin neural network as separate "solar systems" — each department is its own cluster with orbiting data nodes, connected by pipeline lines.

**Architecture:** Brain at center-left, Channels solar system on far left (groups orbit it), Clients solar system on right (professions ring → contractors orbit each profession with status dots), support hubs spread across bottom. Pipeline flows left→right.

**Tech Stack:** React, SVG + HTML overlay, Supabase (useNetworkData hook), Tailwind CSS, Lucide icons

---

### Task 1: Rewrite AdminCanvas.tsx with Solar System Layout

**Files:**
- Modify: `apps/dashboard/src/components/admin/AdminCanvas.tsx`

**Layout (1400×800 viewBox):**
```
Brain: (420, 390) — center-left, the core
Channels: (140, 390) — far left, groups orbit r=55
Scanner: (285, 265) — upper-left, between channels→brain
Bot: (420, 140) — above brain
Clients: (950, 380) — right side, BIG solar system
  └ Professions ring: r=155 from Clients center
  └ Contractors orbit: r=55 from their profession
Finance: (560, 660) — bottom center
Partners: (210, 650) — bottom left
Intel: (760, 660) — bottom right
Settings: (1200, 660) — far bottom right
```

**Connections (real pipeline):**
1. Channels → Brain (leads in)
2. Scanner → Brain (scans)
3. Brain → Clients (lead distribution) — thickest
4. Clients → Finance (subscriptions)
5. Bot ↔ Brain (AI)
6. Brain → Intel (analytics)
7. Partners → Clients (referrals)
8. Settings → Brain (config)

### Task 2: Verify Build

Run: `cd apps/dashboard && npx vite build`
Expected: Build succeeds with no TypeScript errors
