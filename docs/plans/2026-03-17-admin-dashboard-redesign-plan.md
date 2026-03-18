# Implementation Plan: Admin Dashboard Redesign (Apple Floating Glass)

## Phase 1: Global Styles & Foundation
- [ ] Update `index.css` or global styles for the new background (`#FBFBFD`) and grain texture.
- [ ] Define CSS variables for the glass effect (blur, semi-transparent white, soft shadows).

## Phase 2: Sidebar Refinement
- [ ] Redesign `AdminSidebar.tsx` to use the glassmorphism effect.
- [ ] Refine navigation items with thinner icons and smoother active states.
- [ ] Add subtle hover and click animations.

## Phase 3: Dashboard Layout & KPI Cards
- [ ] Update `AdminDashboard.tsx` layout to use a more spacious grid.
- [ ] Re-implement `KpiCard` as "Glass Tiles" with refined typography.
- [ ] Add staggered entrance animations using CSS or Framer Motion (if available).

## Phase 4: Lists & Alerts
- [ ] Redesign the "Recent Leads" table to be a clean, spaced-out list with hover effects.
- [ ] Update "System Alerts" and "Quick Actions" to match the new aesthetic.
- [ ] Ensure all status badges (Hot, Sent, etc.) use the new deep pastel palette.

## Phase 5: Polishing & Micro-interactions
- [ ] Add subtle "lift" animations on card hover.
- [ ] Refine all spacing (padding/margins) for a more "airy" feel.
- [ ] Final check for visual consistency and performance.
