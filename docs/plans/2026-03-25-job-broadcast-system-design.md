# Job Broadcast System — Design Document

**Date:** 2026-03-25
**Status:** Approved

## Overview

Transform the manual contractor-to-subcontractor forwarding into an automated broadcast system where contractors publish job opportunities and the platform matches them with relevant contractors. Both sides verify each other through profiles, ratings, and trust tiers before committing.

## Core Flows

### Flow 1: Direct Send (registered contractor)
Contractor A picks a registered contractor from their network → job_order created directly.

### Flow 2: Invite New Contractor (not registered)
Contractor A enters phone + name → WhatsApp invite sent with registration link → after registration, pending job is auto-delivered.

### Flow 3: Broadcast to Network
Contractor A publishes job details → system sends WhatsApp to matching contractors (profession + area) → interested contractors respond → A reviews profiles/ratings → picks one → job_order created → others notified "job taken."

## Data Model

### New Table: `job_broadcasts`
```sql
CREATE TABLE public.job_broadcasts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id          UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  publisher_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  deal_type        TEXT NOT NULL CHECK (deal_type IN ('percentage', 'fixed_price', 'custom')),
  deal_value       TEXT NOT NULL,
  description      TEXT,
  status           TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'assigned', 'closed', 'expired')),
  max_recipients   INTEGER NOT NULL DEFAULT 50,
  expires_at       TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '72 hours'),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
```
- NO profession/zip/city columns — join through lead_id
- NO chosen_contractor_id — derive from job_orders WHERE broadcast_id = X
- max_recipients caps WhatsApp sends to control cost

### New Table: `job_broadcast_responses`
```sql
CREATE TABLE public.job_broadcast_responses (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  broadcast_id     UUID NOT NULL REFERENCES public.job_broadcasts(id) ON DELETE CASCADE,
  contractor_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status           TEXT NOT NULL DEFAULT 'interested'
    CHECK (status IN ('interested', 'chosen', 'closed')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(broadcast_id, contractor_id)
);

CREATE UNIQUE INDEX idx_one_chosen_per_broadcast
  ON job_broadcast_responses(broadcast_id) WHERE status = 'chosen';
```
- UNIQUE prevents double-response
- Partial unique index prevents double-assignment

### New Table: `contractor_invites`
```sql
CREATE TABLE public.contractor_invites (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inviter_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  phone            TEXT NOT NULL CHECK (phone ~ '^\+\d{7,15}$'),
  name             TEXT NOT NULL,
  broadcast_id     UUID REFERENCES public.job_broadcasts(id) ON DELETE SET NULL,
  status           TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'registered', 'expired')),
  invited_user_id  UUID REFERENCES public.profiles(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (status != 'registered' OR invited_user_id IS NOT NULL)
);
```
- Phone in E.164 format for reliable matching after registration
- broadcast_id nullable — invite can exist without a specific job

### Modified: `job_orders`
```sql
ALTER TABLE job_orders
  ADD COLUMN assigned_user_id UUID REFERENCES profiles(id),
  ADD COLUMN broadcast_id UUID REFERENCES job_broadcasts(id);
```
- NEW `assigned_user_id` (FK → profiles) for registered contractors
- NEW `broadcast_id` links to originating broadcast
- OLD `subcontractor_id` stays for backward compatibility

### Fix: `reviews` RLS + submit_review
Update `reviews_insert` policy and `submit_review()` function to allow BOTH parties to submit reviews:
- contractor_id (publisher) OR assigned_user_id (assignee) can review

### New Indexes
```sql
CREATE INDEX idx_contractors_professions_gin ON contractors USING GIN (professions);
CREATE INDEX idx_contractors_zip_codes_gin ON contractors USING GIN (zip_codes);
```

## Atomic Operations

### `choose_contractor_for_broadcast(p_broadcast_id, p_contractor_id)`
Single transaction that:
1. Validates broadcast is still `open`
2. Updates broadcast status → `assigned`
3. Marks chosen response → `chosen`
4. Creates job_order with assigned_user_id + broadcast_id
5. Marks all other responses → `closed`
6. Returns job_order data for WhatsApp notifications

### `handle_invite_registration(p_phone)`
Triggered when new user registers:
1. Finds pending invites by normalized phone
2. Updates invite status → `registered`, sets invited_user_id
3. If broadcast_id exists and broadcast is still open, auto-sends job notification

## RLS Policies

### job_broadcasts
- Publisher: full CRUD on own broadcasts
- Responding contractors: SELECT via subquery to responses
- Admin: all

### job_broadcast_responses
- Contractor: INSERT/SELECT own responses
- Publisher: SELECT responses to own broadcasts
- Admin: all

### contractor_invites
- Inviter: full CRUD on own invites
- Invited user (after registration): SELECT own invite
- Admin: all

## WhatsApp Templates

### Broadcast Notification (to potential contractors)
```
🔧 *New [profession] job in [city]!*

📋 Terms: [deal_type] [deal_value]
👤 From: [publisher_name] ([tier] ⭐[rating])

Interested?
[✅ Interested] [❌ Pass]
```

### Interest Notification (to publisher)
```
👋 *[contractor_name] is interested in your job!*

⭐ Rating: [rating] | 🏅 [tier]
📊 [completed_jobs] jobs completed

[👤 View Profile] [📋 View All Responses]
```

### Job Assigned (to chosen contractor)
```
🎉 *You've been selected for a job!*

View details and confirm:
[📋 View Job Details]
```

### Job Closed (to other respondents)
```
Thanks for your interest! This job has been assigned to another contractor.

Keep your profile updated to get more opportunities! 💪
```

### Invite (to unregistered contractor)
```
👋 *[inviter_name] wants to send you work on LeadExpress!*

Join now to see the job details and start receiving opportunities:
[🚀 Register Now]
```

## UI Changes

### ForwardLeadModal — Add Toggle
```
┌─────────────────────────────┐
│  Forward Job                 │
│                              │
│  ○ Send to specific person   │
│  ● Broadcast to network      │
│                              │
│  [Deal type] [Deal value]    │
│  [Description]               │
│                              │
│  [Broadcast 📡]              │
└─────────────────────────────┘
```

"Send to specific person" sub-options:
- Dropdown of registered contractors (from network)
- "Invite new" — phone + name input

### New: Broadcast Responses View
In JobsDashboard or JobDetailPanel, show list of interested contractors:
- Avatar, name, tier badge, rating, completed jobs
- Link to public profile
- "Choose" button per contractor

## Growth Engine

Every "Invite New Contractor" flow = new user acquisition:
1. Contractor A invites B to get work done
2. B registers, completes profile
3. B is now in the network, receives future broadcasts
4. B invites C for their own jobs
5. Viral loop

## Edge Cases

- **Zero matches:** Create broadcast, tell A "No matching contractors yet. We'll notify you when someone joins."
- **Expired broadcast + late response:** Webhook checks expiry before inserting response, sends "no longer available" message.
- **Race condition on choose:** `choose_contractor_for_broadcast()` uses `WHERE status = 'open'` — if already assigned, returns error.
- **Multiple broadcasts per lead:** Allowed — A might broadcast to plumbers AND electricians for the same renovation lead.
