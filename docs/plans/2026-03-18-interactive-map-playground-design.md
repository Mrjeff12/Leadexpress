# Interactive Map Playground — Design Doc

**Date:** 2026-03-18
**Status:** Approved
**Scope:** Landing page MapSection overhaul

## Goal

Transform the landing page map from a passive auto-cycling demo into an **interactive playground** where visitors click US states and see matching leads in real time — a "try before you buy" experience.

## Current State

- SVG map (`USMap.tsx`) with auto-cycle through 3 filter steps
- 5 demo leads, 3 highlighted states
- No interactivity — visitor just watches

## Design

### Layout

```
┌─────────────────────────────────────────────────┐
│  Headline + Subtitle                            │
├─────────────────────────────────────────────────┤
│ ┌─ Selected State Tags ───────────────────────┐ │
│ │  [FL ×] [TX ×] [CA ×]                      │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ ┌─ SVG Map (60%) ────────────┐ ┌─ Lead Feed ─┐ │
│ │                             │ │ (40%)       │ │
│ │  Clickable states           │ │ Dynamic     │ │
│ │  Hover = tooltip            │ │ cards       │ │
│ │  Selected = orange glow     │ │ based on    │ │
│ │                             │ │ selection   │ │
│ └─────────────────────────────┘ └─────────────┘ │
│                                                 │
│ ┌─ Stats Bar (dark) ─────────────────────────┐  │
│ │ 🔥 847 leads  │ 📍 3 states  │ ⚡ $2.4M    │  │
│ └─────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
```

### Interactivity

1. **Click state** → toggles selection (fill orange + glow)
2. **Hover state** → tooltip with state name + "~N leads this week"
3. **Selected states** appear as tag pills above the map
4. **Lead feed** filters dynamically based on selected states
5. **Stats bar** updates with counting animation

### Animations

- **State select:** scale bounce (1.0 → 1.05 → 1.0) + fade to orange + drop-shadow glow
- **Lead cards:** stagger entrance (translateY + opacity, 100ms delay between cards)
- **Stats counter:** count-up (0 → target over 1.5s)
- **Tags:** slide-in spring animation on add, fade-out on remove
- **Empty state:** pulsing dots on FL, TX, CA + CTA text

### Visual Design

- **Section bg:** cream (consistent with site)
- **Unselected state:** `#f1f5f9` fill, `#e2e8f0` stroke
- **Hovered state:** `#fe5b25` 25% opacity + orange stroke
- **Selected state:** `#fe5b25` 60% opacity + glow `drop-shadow(0 0 8px rgba(254,91,37,0.4))`
- **Lead cards:** white, subtle border + shadow
- **Stats bar:** dark `#1a1a2e` bg with light text — visual section break
- **Tags:** orange pills with × button

### Demo Data

~20 leads across 8-10 states:
- FL, TX, CA, NY, IL, GA, OH, NC, AZ, PA
- 2-3 leads per state with varied trade types
- Realistic prices and zip codes
- Both English and Hebrew labels

### Responsive

- **Desktop (lg+):** Map 60% + Lead Feed 40% side by side
- **Tablet (md):** Map full-width, Feed stacks below
- **Mobile (sm):** Map full-width clickable, compact cards, stats wraps

### Performance

- Zero external dependencies — SVG + CSS animations + React state
- IntersectionObserver for lazy animation trigger
- Isolated state changes — no unnecessary re-renders

### i18n

Full Hebrew/English support for all text, tooltips, lead data, and CTA.

## Tech

- Modify existing `MapSection.tsx` — remove auto-cycle, add click/hover handlers
- Modify `USMap.tsx` — add `onStateClick`, `onStateHover` props if needed
- All CSS animations via Tailwind + inline styles
- No new dependencies
