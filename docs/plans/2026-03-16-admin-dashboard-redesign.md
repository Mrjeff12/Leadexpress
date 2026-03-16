# Admin Dashboard Redesign - Design Document

**Date:** 2026-03-16
**Status:** Approved

## Problem

The current admin sidebar mixes contractor navigation (My Leads, Profile, Subscription, Telegram) with admin management items. Admin is NOT a contractor - they manage the business. The sidebar is disorganized and doesn't scale for a full management panel.

## Decision

**Approach: Grouped Sidebar** - A dedicated admin layout with a categorized sidebar, completely separate from the contractor experience.

## Architecture

### Route Separation

When a user logs in:
- `role === 'contractor'` → existing `AppShell` + `Sidebar` + contractor routes
- `role === 'admin'` → new `AdminLayout` + `AdminSidebar` + admin routes

Admin never sees contractor UI. Contractor never sees admin UI.

### Routing Structure

```
/login                    → Login (shared)

/                         → ContractorDashboard (contractor only)
/leads                    → LeadsFeed
/profile                  → Profile
/subscription             → Subscription
/telegram                 → TelegramConnect
/settings                 → ServiceSettings

/admin                    → AdminDashboard (admin only)
/admin/leads              → AdminLeads
/admin/prospects          → AdminProspects
/admin/prospects/:id      → ProspectDetail
/admin/contractors        → AdminContractors
/admin/whatsapp           → AdminWhatsApp
/admin/groups             → AdminGroups
/admin/message-templates  → MessageTemplates (NEW)
/admin/subscriptions      → Subscriptions (NEW)
/admin/revenue            → Revenue (NEW)
/admin/analytics          → Analytics (NEW)
/admin/activity-log       → ActivityLog (NEW)
/admin/professions        → Professions (NEW)
/admin/service-areas      → ServiceAreas (NEW)
/admin/system-settings    → SystemSettings (NEW)
```

## Admin Sidebar Structure

```
╭─────────────────────────╮
│  LE  LeadExpress        │
│       Admin Panel       │
├─────────────────────────┤
│                         │
│  🏠 Dashboard           │
│                         │
│  ── Business Mgmt ──    │
│  ⚡ Leads               │
│  👤 Prospects           │
│  👷 Contractors         │
│                         │
│  ── Channels ──         │
│  📱 WhatsApp            │
│  📡 Groups              │
│  ✉️  Message Templates   │
│                         │
│  ── Finance ──          │
│  💳 Subscriptions       │
│  📊 Revenue             │
│                         │
│  ── Reports ──          │
│  📈 Analytics           │
│  📋 Activity Log        │
│                         │
│  ── Settings ──         │
│  🔧 Professions         │
│  🗺️  Service Areas       │
│  ⚙️  System              │
│                         │
├─────────────────────────┤
│  👤 Jeff (Admin)        │
│  🚪 Logout              │
╰─────────────────────────╯
```

### Sidebar Behavior
- Category headers are non-clickable labels with muted styling
- Categories are collapsible (click to fold/unfold)
- Active item highlighted with forest green accent
- Collapsible sidebar (icon-only mode) preserved from current design
- RTL support preserved
- Same glass-panel aesthetic as current design

## New Pages Specification

### Message Templates (`/admin/message-templates`)
- CRUD for WhatsApp/Telegram message templates
- Dynamic variables: `{{contractor_name}}`, `{{lead_type}}`, `{{lead_location}}`
- Preview panel showing rendered template
- Active/inactive toggle per template

### Subscriptions & Billing (`/admin/subscriptions`)
- Table: contractor name, plan (Starter/Pro/Unlimited), status (active/past_due/cancelled)
- Filters by plan type and status
- Payment history per contractor (expandable row)
- Failed payment alerts

### Revenue (`/admin/revenue`)
- MRR (Monthly Recurring Revenue) KPI card
- Revenue over time line chart (last 12 months)
- Breakdown by plan type (pie/bar chart)
- Growth rate indicator

### Analytics (`/admin/analytics`)
- Leads per day/week/month (line chart)
- Conversion rates (lead → assignment → completion)
- Top performing contractors (table)
- Hot zones map (leads by area)
- Profession distribution (bar chart)

### Activity Log (`/admin/activity-log`)
- Chronological event table
- Columns: timestamp, user, action, details
- Filters: by event type, by user, by date range
- Event types: login, lead_created, lead_assigned, contractor_registered, payment_received, settings_changed

### Professions Management (`/admin/professions`)
- Table of all professions with icon, color, name (EN/HE)
- Enable/disable toggle
- Add new profession form
- Edit existing profession (name, icon, color)

### Service Areas (`/admin/service-areas`)
- Map view showing all active ZIP codes
- Table of ZIP codes with assigned contractor count
- Add/remove ZIP codes
- Bulk import capability

### System Settings (`/admin/system-settings`)
- Business name & logo
- Default language (EN/HE)
- Notification preferences (email, WhatsApp, Telegram)
- API keys management (Mapbox, Supabase displayed read-only)
- Timezone setting

## Existing Pages - Upgrades

### Admin Dashboard (`/admin`)
- Add weekly trend mini-chart to each KPI card
- Add system alerts section (failed payments, disconnected WhatsApp, inactive contractors)
- Add quick action buttons (add contractor, view latest leads)

### Admin Leads (`/admin/leads`)
- Add CSV export
- Add filter by assigned contractor
- Add lead statistics summary bar

### Admin Contractors (`/admin/contractors`)
- Add filter by profession and subscription status
- Add bulk actions (send message, change plan)
- Improve contractor detail view

### Admin Groups (`/admin/groups`)
- Add member management
- Add mute/activate toggle
- Better status indicators

## Components to Create

1. `AdminLayout` - wrapper with AdminSidebar + main content area
2. `AdminSidebar` - new grouped sidebar component
3. `SidebarCategory` - collapsible category with label + items
4. `KpiCard` (enhanced) - with optional mini-chart
5. `DataTable` (reusable) - sortable, filterable table for multiple pages
6. `StatBar` - summary statistics bar
7. `AlertCard` - system alert component

## i18n Keys to Add

All new pages need EN + HE translations:
- `nav.admin.message_templates`
- `nav.admin.subscriptions`
- `nav.admin.revenue`
- `nav.admin.analytics`
- `nav.admin.activity_log`
- `nav.admin.professions`
- `nav.admin.service_areas`
- `nav.admin.system_settings`
- Category labels: `nav.category.business`, `nav.category.channels`, `nav.category.finance`, `nav.category.reports`, `nav.category.settings`
- All page-specific content keys

## Design System

Stays consistent with existing LeadExpress design:
- Tailwind CSS + shadcn/ui components
- Glass-panel aesthetic
- Forest green accent color
- Plus Jakarta Sans + Outfit fonts
- Apple-inspired shadow system
- Spring/bounce animations
