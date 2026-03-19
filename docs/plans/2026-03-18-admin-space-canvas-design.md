# Admin Space Canvas — Design Document

**Date:** 2026-03-18
**Status:** Approved

## Overview

Replace the current sidebar-based admin navigation with a spatial "office floor" canvas. The admin landing page becomes a React Flow canvas with 6 department cards. Clicking a card opens a full-page view with tabs for sub-pages.

## Two Modes

### 1. Canvas Mode (`/admin`)
- React Flow canvas with zoom/pan (scroll to zoom, drag to pan)
- Dark space theme background (`#0f0f1a`)
- 6 department nodes arranged in a 3×2 grid
- Each node shows: icon, department name, 2-3 live KPI numbers
- Nodes are **locked** (not draggable) — only zoom/pan
- Dashed flow arrows between related departments (visual only, not interactive)
- Bottom hint: "Click a card to enter | Scroll to zoom | Drag to pan"
- Top bar: Logo + user avatar + logout

### 2. Department Mode (`/admin/{department}/*`)
- Full-page layout, no sidebar
- Top bar with:
  - "← Back to Map" button (navigates to `/admin`)
  - Horizontal tabs for sub-pages within the department
  - Active tab indicator (colored underline matching department color)
- Content area below tabs renders the existing page components
- Escape key also returns to canvas

## 6 Departments

### War Room (חדר מלחמה)
- **Route:** `/admin/warroom`
- **Color:** `#ff6b35` (orange-red)
- **KPIs:** Hot leads count, Prospects waiting, Unread messages
- **Tabs:**
  - Inbox → existing `AdminInbox` component
  - Leads → existing `AdminLeads` (filtered to hot/urgent)
  - Prospects → existing `AdminProspects`

### Clients (לקוחות)
- **Route:** `/admin/clients`
- **Color:** `#10b981` (green)
- **KPIs:** Active contractors, Service areas, Leads on map
- **Tabs:**
  - Contractors → existing `AdminContractors`
  - Service Areas → existing `ServiceAreas`
  - Leads Map → existing `LeadsMap`

### Channels (ערוצים)
- **Route:** `/admin/channels`
- **Color:** `#8b5cf6` (purple)
- **KPIs:** WA connections active, Active groups, Scans pending
- **Tabs:**
  - WhatsApp → existing `AdminWhatsApp`
  - Groups → existing `AdminGroups` + `AdminGroupScanQueue`
  - Templates → existing `MessageTemplates`

### Finance (כספים)
- **Route:** `/admin/finance`
- **Color:** `#f59e0b` (amber)
- **KPIs:** Active subscriptions, MRR
- **Tabs:**
  - Subscriptions → existing `Subscriptions`
  - Revenue → existing `Revenue`

### Intelligence (מודיעין)
- **Route:** `/admin/intel`
- **Color:** `#3b82f6` (blue)
- **KPIs:** Leads today, Conversion rate
- **Tabs:**
  - Analytics → existing `Analytics`
  - Activity Log → existing `ActivityLog`

### Settings (הגדרות)
- **Route:** `/admin/settings`
- **Color:** `#6b7280` (gray)
- **KPIs:** Professions count, "System Config" label
- **Tabs:**
  - Professions → existing `Professions`
  - System → existing `SystemSettings`

## Card Design (Custom React Flow Node)

- Size: ~280×200px
- Background: department color at 10% opacity + backdrop-blur
- Border: 2px solid department color
- Rounded corners (16px)
- Content:
  - Department name (22px, department color)
  - 2-3 KPI lines (18px, white/gray)
  - Optional status dot (green = active)
- Hover: scale(1.03) + glow shadow intensifies
- Click: navigates to department route

## Technology

- **Canvas:** `@xyflow/react` (React Flow v12)
- **Nodes:** Custom React Flow nodes with `draggable: false`
- **Theme:** Dark background, glass-morphism cards
- **KPI Data:** Supabase queries (reuse existing patterns from AdminDashboard)
- **Routing:** React Router — `/admin` renders canvas, `/admin/{dept}/*` renders department layout
- **RTL:** Full Hebrew support, `dir="rtl"` when `locale === 'he'`
- **Animation:** CSS transitions for card hover, React Flow built-in zoom/pan smooth scrolling

## Route Mapping (Old → New)

| Old Route | New Route | Department | Tab |
|-----------|-----------|------------|-----|
| `/admin` | `/admin` | Canvas | — |
| `/admin/inbox` | `/admin/warroom` | War Room | Inbox |
| `/admin/leads` | `/admin/warroom/leads` | War Room | Leads |
| `/admin/prospects` | `/admin/warroom/prospects` | War Room | Prospects |
| `/admin/prospects/:id` | `/admin/warroom/prospects/:id` | War Room | Prospect Detail |
| `/admin/contractors` | `/admin/clients` | Clients | Contractors |
| `/admin/contractors/:id` | `/admin/clients/contractors/:id` | Clients | Contractor Detail |
| `/admin/service-areas` | `/admin/clients/service-areas` | Clients | Service Areas |
| `/admin/leads-map` | `/admin/clients/map` | Clients | Leads Map |
| `/admin/whatsapp` | `/admin/channels` | Channels | WhatsApp |
| `/admin/groups` | `/admin/channels/groups` | Channels | Groups |
| `/admin/groups/:id` | `/admin/channels/groups/:id` | Channels | Group Detail |
| `/admin/group-scan` | `/admin/channels/scan` | Channels | Group Scan |
| `/admin/message-templates` | `/admin/channels/templates` | Channels | Templates |
| `/admin/subscriptions` | `/admin/finance` | Finance | Subscriptions |
| `/admin/revenue` | `/admin/finance/revenue` | Finance | Revenue |
| `/admin/analytics` | `/admin/intel` | Intelligence | Analytics |
| `/admin/activity-log` | `/admin/intel/activity` | Intelligence | Activity Log |
| `/admin/professions` | `/admin/settings` | Settings | Professions |
| `/admin/system-settings` | `/admin/settings/system` | Settings | System |

## Components to Create

1. **`AdminCanvas.tsx`** — React Flow canvas with 6 department nodes
2. **`DepartmentNode.tsx`** — Custom React Flow node component
3. **`DepartmentLayout.tsx`** — Full-page layout with back button + tabs
4. **`useAdminKPIs.ts`** — Hook to fetch live KPI data for all departments

## Components to Modify

1. **`AdminLayout.tsx`** — Remove sidebar, add routing for canvas vs department mode
2. **`AdminSidebar.tsx`** — Remove (replaced by canvas)

## What Stays the Same

All existing page components (AdminInbox, AdminLeads, AdminContractors, etc.) remain unchanged. They are simply re-mounted inside the new DepartmentLayout with tabs instead of the old sidebar layout.
