# Contractor Dashboard — Floating Command Center

## Summary

Replace the current contractor dashboard with a full-page Google Map background and floating glass panels. The map is the canvas — professions, KPIs, working hours, and recent leads float on top as frosted-glass panels. Read-only showcase; editing stays at `/settings`.

## Layout

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  ┌─────────────────────┐                                        │
│  │ Welcome, Carlos     │          GOOGLE MAP                    │
│  │ ┌────┬────┬────┐    │          (100% of main area)           │
│  │ │ 3  │ 8  │ 47 │    │                                        │
│  │ │today│week│tot │    │          - ZIP polygons (colored)      │
│  │ └────┴────┴────┘    │          - Lead pins (recent)          │
│  │                     │          - Auto-center on coverage     │
│  │ ❄️ HVAC    💨 Air   │                                        │
│  │ 🔧 Plumb   ⚡ Elec  │                                        │
│  │ 🎨 Paint   🔨 Reno  │                                        │
│  │ (selected glow)     │                                        │
│  │                     │                                        │
│  │ Mon-Fri 9-18        │    ┌──────────────────────────────┐    │
│  │ Sat-Sun OFF         │    │  Recent Leads (floating)     │    │
│  │         [Edit ✏️]    │    │  [Card] [Card] [Card] →      │    │
│  └─────────────────────┘    └──────────────────────────────┘    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Design Principles

- **Map = full page background** — fills entire main content area (right of sidebar)
- **Floating panels** — `backdrop-blur-xl`, `bg-white/70`, `rounded-3xl`, strong shadow
- **Read-only** — dashboard is a showcase, not editable. "Edit" link goes to `/settings`
- **Apple aesthetic** — Plus Jakarta Sans, spring animations, layered shadows
- **Staggered entrance** — panels animate in with delay cascade

## Components

### 1. Full-Page Map (Background)
- Google Maps via `@vis.gl/react-google-maps`
- `position: absolute; inset: 0` filling the main area
- ZIP code polygons for contractor's coverage zones
- Lead pins for recent leads (last 7 days)
- Auto-centers on contractor's ZIP centroids
- Subtle dark overlay at edges for panel readability
- Fallback: gradient placeholder if no API key

### 2. Left Floating Panel (Profile Card)
- Position: top-left, `left-6 top-6`
- Width: ~340px
- Sections:
  - **Greeting + Name**: "Good morning, Carlos" with plan badge
  - **KPI Strip**: 3 inline mini cards (Today / Week / Total)
  - **Professions Grid**: 4-col icon grid, selected ones have emerald glow ring
  - **Schedule Compact**: "Mon–Fri 09:00–18:00 · Sat–Sun off" as pill strip
  - **Edit button**: Small ghost link → `/settings`

### 3. Bottom-Right Floating Panel (Leads)
- Position: bottom-right, `right-6 bottom-6`
- Width: ~520px, max-height: ~240px
- Horizontal scroll of recent lead cards (3-4 visible)
- Each card: profession emoji, summary (1 line), city, time ago
- "View all →" link to `/leads`

### 4. Top-Right Floating Badges
- Telegram status (green dot if connected)
- Plan badge (Starter/Pro/Unlimited)

## Mobile (< 1024px)
- Map becomes 300px hero at top
- Panels stack vertically below map (no floating)
- Left panel → full width
- Leads panel → full width, horizontal scroll

## Data Flow
- Reuse `useContractorSettings` hook for professions, zipCodes, workingHours
- Supabase query for recent leads (existing logic from ContractorDashboard)
- Supabase query for subscription status
- All read-only — no save/persist on this page

## Route Changes
- `/` → New floating command center dashboard
- `/settings` → Existing ServiceSettings (editable)
- Old ContractorDashboard.tsx → replaced entirely

## Tech
- React 19, Tailwind CSS
- `@vis.gl/react-google-maps` (already installed)
- Existing CSS variables and animations from index.css
- New CSS: `.floating-panel` class with stronger backdrop blur
