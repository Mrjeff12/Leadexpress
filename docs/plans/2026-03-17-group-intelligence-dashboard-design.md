# Group Intelligence Dashboard — Design Document

**Date:** 2026-03-17
**Approach:** Scoreboard + Drill-Down (replaces AdminGroups)
**Audience:** Admin only (Jeff)

---

## Overview

Replace the minimal AdminGroups page with a full Group Intelligence Dashboard that provides:
1. **Scoreboard** — at-a-glance ranking of all groups by health/quality
2. **Group Detail** — deep dive into any group with 4 tabs

All data is derived from existing tables: `groups`, `group_members`, `pipeline_events`, `leads`.

---

## Page 1: Group Scoreboard (replaces AdminGroups)

### Top Section — 4 KPI Cards
| Card | Source | Computation |
|------|--------|-------------|
| Total Groups | `groups` | `COUNT(*)` |
| Active Groups | `groups` | `COUNT(*) WHERE status = 'active'` |
| Avg Lead Yield | `pipeline_events` | `AVG(leads_created / messages_received)` per group |
| Groups Needing Attention | Computed | Groups with Score < 30 |

### Main Section — Sortable/Filterable Table

**Columns:**
| Column | Source | Description |
|--------|--------|-------------|
| Score (0-100) | Computed | Weighted composite score (see formula below) |
| Group Name | `groups.name` | Clickable → drill-down |
| Status | `groups.status` | Badge: active/paused/disconnected |
| Lead Yield % | `pipeline_events` | leads_created / received × 100 |
| Sellers | `group_members` | known_sellers / total_members |
| Activity Level | `pipeline_events` | Messages in last 7 days, shown as bar |
| Last Lead | `leads.created_at` | Time since last lead from this group |
| Actions | — | View button → Group Detail |

### Group Score Formula

```
Score = (Lead_Yield_Norm × 0.40)
      + (Seller_Pressure_Inv × 0.25)
      + (Activity_Norm × 0.20)
      + (Freshness_Norm × 0.15)
```

Where:
- **Lead_Yield_Norm** = min(lead_yield / 0.20, 1.0) × 100
  - 20% yield = perfect score; scales linearly below
- **Seller_Pressure_Inv** = (1 - seller_ratio) × 100
  - 0% sellers = 100; 100% sellers = 0
- **Activity_Norm** = min(messages_7d / 50, 1.0) × 100
  - 50+ messages/week = perfect; scales linearly below
- **Freshness_Norm** = max(0, 100 - hours_since_last_lead × 2)
  - Lead today = ~100; 2 days ago = ~50; 4+ days = 0

**Score Color:**
- 🟢 70-100 = Healthy
- 🟡 40-69 = Needs attention
- 🔴 0-39 = Problem

### Filters
- Status: active / paused / disconnected / all
- Category: dropdown of profession types
- Search: free-text on group name

---

## Page 2: Group Detail

### Header
- Group name (large)
- Score badge (colored circle with number)
- Status badge
- Category badge
- "Pause/Resume Group" button

### Tab 1: Overview (default)

**6 KPI Cards:**
| Card | Computation |
|------|-------------|
| Total Messages | `pipeline_events WHERE stage='received'` |
| Leads Created | `pipeline_events WHERE stage='lead_created'` |
| Lead Yield % | leads / messages × 100 |
| Active Members | `group_members WHERE last_seen_at > now() - 7d` |
| Known Sellers | `group_members WHERE classification='seller'` |
| Days Active | `now() - groups.created_at` |

**Lead Funnel Chart:**
Horizontal bar chart showing pipeline stages:
- Messages Received → Quick Filtered → Sender Filtered → AI Not Lead → Leads Created
- Each bar shows count + percentage

**Activity Over Time:**
Recharts AreaChart — daily message count for last 30 days
- Area 1 (light): total messages
- Area 2 (dark overlay): leads created
- Tooltip showing exact counts on hover

### Tab 2: Members

**Member Table:**
| Column | Source | Description |
|--------|--------|-------------|
| Name | `group_members.display_name` | Sender name or phone |
| Classification | `group_members.classification` | Badge: buyer/seller/bot/unknown/admin |
| Messages | `group_members.total_messages` | Total count |
| Leads | `group_members.lead_messages` | Messages that became leads |
| Seller Ratio | service / total × 100 | Higher = more likely seller |
| Last Seen | `group_members.last_seen_at` | Relative time |
| Override | `group_members.manual_override` | Edit button → change classification |

**Override Action:**
- Click edit → dropdown: buyer / seller / bot / admin
- Saves to `group_members.manual_override = true` + updates classification
- Affects future smart-filter decisions for this sender

### Tab 3: Recent Messages

**Message Feed:**
- Color-coded by outcome:
  - 🟢 Green border = became a lead (has lead_id in pipeline_events)
  - 🔴 Red border = filtered as seller spam
  - ⚪ Gray border = filtered (quick_filter) or AI said not a lead
- Each message shows:
  - Sender name + classification badge
  - Timestamp (relative)
  - Message text (truncated to 200 chars, expandable)
  - If lead: link to lead detail + profession badge
- Pagination: load 50 at a time, "Load More" button

**Data source:** WA-Listener API `GET /api/messages/:groupId` enriched with pipeline_events

### Tab 4: Market Intelligence

**Computed from `leads` WHERE `group_id` = current group:**

**Top Professions:**
- Bar chart or pill badges showing % breakdown of professions
- e.g., HVAC 34%, Roofing 22%, Garage Door 18%

**Hot Regions:**
- Top states/cities by lead count from this group
- e.g., FL 45%, TX 23%, NY 12%

**Budget Range:**
- Distribution of budget_range values
- Most common range highlighted

**Urgency Mix:**
- Donut chart: Hot / Warm / Cold percentages

**Repeat Requesters:**
- List of senders who posted 2+ lead messages
- Shows: name, count of requests, professions requested, last request date
- These are high-value prospects who haven't found a contractor

---

## Data Architecture

### New Queries Needed

All queries use existing tables — no schema changes required.

1. **Group Score computation** — aggregation query joining groups + pipeline_events + group_members + leads
2. **Lead Funnel per group** — `pipeline_events GROUP BY stage WHERE group_id = ?`
3. **Activity timeline** — `pipeline_events WHERE group_id = ? GROUP BY DATE(created_at)`
4. **Market intel** — `leads WHERE group_id = ? GROUP BY profession/state/urgency`
5. **Repeat requesters** — `leads WHERE group_id = ? GROUP BY sender_id HAVING COUNT > 1`

### Performance Considerations

- Group Score should be computed in a single query with CTEs (not N+1)
- Activity timeline limited to 30 days
- Member table: paginate if >100 members
- Messages tab: lazy-load, 50 per page
- Market Intelligence: cached on tab switch (staleTime: 60s via react-query)

### Realtime

- Subscribe to `pipeline_events` INSERT → update activity/funnel counts
- Subscribe to `group_members` changes → update member list
- No realtime needed for Market Intelligence (stale data is fine)

---

## Tech Stack (existing)

- **UI**: React + Tailwind + Radix UI components
- **Charts**: Recharts (AreaChart, BarChart)
- **Data**: @tanstack/react-query + Supabase client
- **Icons**: Lucide React
- **Routing**: React Router (existing admin layout)

---

## File Structure

```
apps/dashboard/src/
├── pages/
│   ├── AdminGroups.tsx          ← REPLACE with Scoreboard
│   └── AdminGroupDetail.tsx     ← NEW: drill-down page
├── hooks/
│   ├── useGroupScoreboard.ts    ← NEW: scores + table data
│   └── useGroupDetail.ts        ← NEW: detail page data
└── lib/
    └── group-score.ts           ← NEW: score computation logic
```
