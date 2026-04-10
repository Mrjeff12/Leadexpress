# AdminLeads Source Split — Design Spec

**Date:** 2026-04-09
**Status:** Approved
**Scope:** Upgrade existing `AdminLeads.tsx` to split leads by source (Scraped vs Published)

---

## Context

The current `AdminLeads.tsx` page shows all leads in a single feed without distinguishing their source. Leads come from two parallel pipelines:

1. **Scraped leads** (`source_type = 'scanner'`) — AI-extracted from WhatsApp group messages via Green API
2. **Published leads** (`source_type = 'publisher'`) — Contractors post jobs through the Rebeca bot (Twilio-based)

The `source_type` column already exists on the `leads` table (added in migration `034_distribution_network_phase0.sql`). The UI simply doesn't use it yet.

## Goal

Let the admin (Jeff, solo) see and filter leads by source so he can:
- Track scraped vs published volume independently
- See which contractors are publishing through Rebeca
- Compare conversion rates between sources
- Manage each pipeline with source-aware context

## Changes

### 1. Source Toggle Bar

Add a segmented control below the header, above the KPI cards:

```
[ All ]  [ Scraped (Groups) ]  [ Published (Rebeca) ]
```

- Filters all data on the page by `source_type`
- "All" shows both (current behavior)
- Active tab gets the same styling as the existing urgency toggle (white bg, shadow)
- Persisted in component state only (no URL param needed)

### 2. Source Badge on Each Lead Card

Add a small source indicator in the left column of each lead card (where time/group info already lives):

**Scraped leads:**
- Show group name
- Add small `SCRAPED` text badge in muted style

**Published leads:**
- Show contractor name (publisher) instead of group
- Add `VIA REBECA` text badge in muted style
- Show deal type if available from linked `job_broadcasts`

### Design Constraint: Icons

All profession/category icons use a single orange color (`#fe5b25`) with no background box, border, or container around them. Icons render naked — just the icon itself in orange.

### 3. KPIs Reflect Active Source

When a source tab is active, the 4 KPI cards (Total, Hot, Warm, Cold) and their sparklines update to show only that source's data. The urgency filter still works on top of the source filter.

Filter chain: `source_type → date → profession → search → urgency`

### 4. Query Enhancement

Current query fetches from `leads` with group join. Enhance to also fetch:

```ts
// Supabase JS query
supabase
  .from('leads')
  .select(`
    *, 
    group:groups(name),
    publisher:profiles!publisher_id(full_name, phone),
    broadcasts:job_broadcasts(deal_type, deal_value, status, 
      responses:job_broadcast_responses(count)
    )
  `)
  .order('created_at', { ascending: false })
  .limit(1000)
```

Both `publisher_id` and `source_type` columns already exist on `leads` (from migration `034_distribution_network_phase0.sql`).

### 5. Publisher Detail in Expanded View

When expanding a published lead, show additional publisher context:
- Publisher name and phone (from `profiles`)
- Deal type and value (from linked `job_broadcasts`)
- Number of responses received (from `job_broadcast_responses`)
- Source prospect info if available (`source_prospect_id`)

This replaces the "Original Message" section for published leads (they don't have a raw WhatsApp message).

## What Stays the Same

- Design language: glass panels, Outfit font, light theme, rounded corners
- All existing filters: urgency toggle, profession multi-select, date filter, search
- CSV export (will include `source_type` as new column)
- Real-time subscription for new leads
- Expand/collapse card behavior
- Potential contractor count calculation
- Delivered count display

## Files Modified

| File | Change |
|------|--------|
| `apps/dashboard/src/pages/AdminLeads.tsx` | Add source toggle, source badges, query enhancement, publisher detail |

## Data Dependencies

| Table | Column | Used For |
|-------|--------|----------|
| `leads` | `source_type` | Filter by source (`scanner` / `publisher`) |
| `leads` | `publisher_id` | Join to get publisher profile |
| `leads` | `source_prospect_id` | Show prospect origin for Rebeca leads |
| `profiles` | `full_name` | Publisher name display |
| `job_broadcasts` | `deal_type`, `deal_value`, `status` | Deal context for published leads |
| `job_broadcast_responses` | count | Response count for published leads |

## Out of Scope

- Jobs tracking dashboard (separate future spec)
- New admin pages or routes
- Database schema changes (all needed columns exist)
- Design system changes
