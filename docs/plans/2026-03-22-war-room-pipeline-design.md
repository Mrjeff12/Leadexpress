# War Room Pipeline Design

**Date:** 2026-03-22
**Status:** Approved

## Overview

Transform the War Room CRM inbox into a full customer lifecycle pipeline — from prospect discovery through payment and churn. Visual funnel header with filtered chat list below.

## Pipeline Stages (8 total)

```
prospect → reached_out → in_conversation → onboarding → demo_trial → paying
                                                            ↓            ↓
                                                      trial_expired   churned
```

| # | Stage | Color | Description |
|---|-------|-------|-------------|
| 1 | prospect | #5856D6 (indigo) | Found in WhatsApp group, not yet contacted |
| 2 | reached_out | #fe5b25 (orange) | First message sent |
| 3 | in_conversation | #AF52DE (purple) | They replied, active back-and-forth |
| 4 | onboarding | #007AFF (blue) | Setting up profile, choosing service areas |
| 5 | demo_trial | #FF9500 (amber) | Active 7-day free trial |
| 6 | trial_expired | #8E8E93 (gray) | Trial ended without converting — warm re-engagement target |
| 7 | paying | #34C759 (green) | Active paying customer ($79/mo) |
| 8 | churned | #FF3B30 (red) | Was paying, cancelled |

## UI Layout

### Top: Funnel Pipeline Header
- Horizontal connected dots showing all 8 stages
- Each dot shows stage name + count badge
- Small bar chart under each showing relative volume
- Clicking a stage filters the contact list below
- "All" option shows all contacts with colored stage badges
- Search bar + refresh button

### Left: Contact List (filtered by selected stage)
- Each card shows: phone/name, stage badge, last message preview, timestamp
- Sorted by last_contact_at descending
- Infinite scroll (paginated, not loading all at once)
- Double filter: stage + text search

### Center: Chat Area
- Unchanged from current implementation
- Message history with selected contact
- Input bar with quick replies

### Right: CRM Panel
- Stage dropdown (change stage inline)
- Trial countdown (if in demo_trial)
- Follow-up scheduler
- Notes editor
- Quick actions (Send Intro, Send Pricing, Extend Trial)

## Database Changes

### 1. Add `trial_expired` to prospect_stage enum
```sql
ALTER TYPE prospect_stage ADD VALUE 'trial_expired' AFTER 'demo_trial';
```

### 2. Add trial tracking field
```sql
ALTER TABLE prospects ADD COLUMN trial_ends_at timestamptz;
```

### 3. Auto-expire trigger (optional future phase)
Cron job or Supabase scheduled function to move `demo_trial` → `trial_expired` when `trial_ends_at < now()`.

## Key Technical Notes

- Reuses existing `AdminInbox.tsx` architecture (3-panel layout)
- Reuses `useProspectDetailData` hook for data fetching
- Realtime subscriptions already exist on `prospects`, `prospect_messages`, `prospect_events`
- The funnel header is the main new component
- Pagination needed for the Prospect stage (2952+ contacts)
