# Distribution Network — Implementation Plan

## Context

LeadExpress currently extracts leads from WhatsApp groups and distributes them to matched contractors. We're adding a **Distribution Network** — a two-sided marketplace where **publishers** (contractors with extra leads, marketing agencies, referral agents) can submit jobs/leads, and the platform distributes them to matched contractors via private WhatsApp outreach.

**Why now:** We already have the matching engine (profession + zip_code), WhatsApp outreach (Green API), and negotiation flow (job_orders). The Distribution Network closes the loop by adding the **supply side** — people who bring leads into the system.

**Revenue model:** Platform fee via Stripe Connect (application_fee on each transaction). Publishers and contractors each connect their own Stripe accounts.

**Key insight from research:** Sharetribe's reverse marketplace pattern + Thumbtack's lead pricing model + Stripe Connect Express = proven architecture for service marketplaces.

---

## Architecture Overview

**Approach:** Unified Lead Pool — all leads (scanner, publisher, referral) flow into the existing `leads` table with `source_type` differentiation. Reuses 90% of existing matching, RLS, and pipeline infrastructure.

**User model:** Role switching — same user can be both contractor and publisher (like Uber driver/rider). Toggle in sidebar.

---

## Phase 1: Data Model Extensions

### Files to modify:
- New migration: `supabase/migrations/033_distribution_network.sql`

### Schema changes:

```sql
-- 1. Add publisher capabilities to profiles
ALTER TABLE profiles ADD COLUMN roles text[] DEFAULT '{contractor}';
-- Possible values: ['contractor'], ['publisher'], ['contractor','publisher']
ALTER TABLE profiles ADD COLUMN stripe_connect_id text;
ALTER TABLE profiles ADD COLUMN stripe_onboarded boolean DEFAULT false;
ALTER TABLE profiles ADD COLUMN publisher_verified boolean DEFAULT false;
ALTER TABLE profiles ADD COLUMN publisher_bio text;
ALTER TABLE profiles ADD COLUMN publisher_company_name text;

-- 2. Extend leads table for publisher-submitted leads
ALTER TABLE leads ADD COLUMN source_type text DEFAULT 'scanner';
-- Values: 'scanner' | 'publisher' | 'referral'
ALTER TABLE leads ADD COLUMN publisher_id uuid REFERENCES profiles(id);
ALTER TABLE leads ADD COLUMN lead_price_type text;
-- Values: 'per_lead' | 'percentage' | 'fixed'
ALTER TABLE leads ADD COLUMN lead_price numeric;
-- per_lead: dollar amount; percentage: 0-100; fixed: dollar amount
ALTER TABLE leads ADD COLUMN deal_status text DEFAULT 'open';
-- Values: 'open' | 'claimed' | 'in_progress' | 'completed' | 'disputed' | 'cancelled'

-- 3. Deals table — tracks the transaction between publisher and contractor
CREATE TABLE deals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES leads(id) NOT NULL,
  publisher_id uuid REFERENCES profiles(id) NOT NULL,
  contractor_id uuid REFERENCES profiles(id) NOT NULL,
  status text DEFAULT 'pending',
  -- 'pending' | 'accepted' | 'in_progress' | 'completed' | 'paid' | 'disputed' | 'cancelled'
  agreed_price numeric,
  agreed_price_type text, -- 'per_lead' | 'percentage' | 'fixed'
  platform_fee_percent numeric DEFAULT 10,
  stripe_payment_intent_id text,
  stripe_transfer_id text,
  completed_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 4. Deal events (reuse pipeline_events pattern)
CREATE TABLE deal_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid REFERENCES deals(id) NOT NULL,
  event_type text NOT NULL,
  -- 'created' | 'accepted' | 'rejected' | 'started' | 'completed' | 'payment_initiated' | 'paid' | 'disputed' | 'cancelled'
  actor_id uuid REFERENCES profiles(id),
  actor_role text, -- 'publisher' | 'contractor' | 'system'
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- 5. RLS policies
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_events ENABLE ROW LEVEL SECURITY;

-- Publishers see deals where they are publisher
CREATE POLICY deals_publisher ON deals FOR SELECT
  USING (publisher_id = auth.uid());

-- Contractors see deals where they are contractor
CREATE POLICY deals_contractor ON deals FOR SELECT
  USING (contractor_id = auth.uid());

-- Admins see all
CREATE POLICY deals_admin ON deals FOR ALL
  USING (public.is_admin());
```

### Key design decisions:
- **Separate `deals` table** (not inline in leads) — because a deal is a relationship between publisher + contractor + lead, with its own lifecycle
- **`deal_events`** follows the same pattern as `pipeline_events` — full audit trail
- **RLS** ensures publisher sees only their deals, contractor sees only theirs

---

## Phase 2: Stripe Connect Integration

### Files to create/modify:
- New edge function: `supabase/functions/stripe-connect-onboard/index.ts`
- New edge function: `supabase/functions/stripe-connect-webhook/index.ts`
- Modify: `supabase/functions/stripe-webhook/index.ts` (add Connect events)
- Reuse: `supabase/functions/_shared/` for Stripe client

### Flow:
1. User clicks "Connect Stripe" → edge function creates Express Account → returns onboarding URL
2. User completes Stripe-hosted onboarding (5 min, Stripe handles KYC)
3. Webhook receives `account.updated` → set `stripe_onboarded = true`
4. When deal completes: create PaymentIntent with `application_fee_amount` and `transfer_data.destination`

### Stripe Connect model: **Standard** (Express accounts)
- Each user connects their own Stripe account
- LeadExpress takes application_fee on each transaction
- Stripe handles all compliance, KYC, payouts
- No escrow needed — Stripe manages fund flow

---

## Phase 3: Publisher Dashboard UI

### Files to create/modify:
- New page: `apps/dashboard/src/pages/PublisherDashboard.tsx`
- New page: `apps/dashboard/src/pages/PublishLead.tsx`
- New page: `apps/dashboard/src/pages/PublisherDeals.tsx`
- Modify: `apps/dashboard/src/components/Sidebar.tsx` (add role toggle + publisher nav)
- Modify: `apps/dashboard/src/lib/auth.tsx` (add role context)

### Publisher mode includes:
1. **Publish Lead form** — profession, location, description, pricing (per_lead/percentage/fixed), photos
2. **My Published Leads** — status tracking (open/claimed/completed)
3. **My Deals** — transaction history, payment status
4. **Earnings** — dashboard showing revenue from deals
5. **Stripe Connect** — onboarding status, payout settings

### Contractor mode additions:
1. **LeadsFeed** — already exists, add filter for `source_type` (scanner vs publisher)
2. **Lead detail** — show publisher info, pricing, "Claim" button for publisher leads
3. **My Deals** — deals where contractor is the receiver

### Role toggle:
- Sidebar shows current role with toggle switch
- "Contractor" shows existing nav (Leads, Jobs, Subcontractors)
- "Publisher" shows new nav (Publish, My Leads, Deals, Earnings)
- Users with both roles can switch freely

---

## Phase 4: Deal Flow (Transaction State Machine)

Inspired by Sharetribe's declarative transaction process:

```
[lead_published] ─── publisher submits lead
       │
       ▼
[matched] ─── system matches to contractors (existing matching engine)
       │
       ▼
[distributed] ─── sent to matched contractors via Green API (private message)
       │
       ▼
[claimed] ─── contractor claims the lead (first-come or selected)
       │
       ▼
[in_progress] ─── work is being done
       │
       ▼
[completed] ─── one party marks as complete, other confirms
       │
       ▼
[paid] ─── Stripe Connect processes payment with platform fee
       │
       ▼
[reviewed] ─── optional: both parties rate each other

At any point: → [cancelled] or → [disputed]
```

### Auto-transitions (time-based):
- Lead not claimed in 48h → auto-remind matched contractors
- Lead not claimed in 7 days → expire lead, notify publisher
- Deal not marked complete in 30 days → auto-prompt both parties
- Dispute not resolved in 14 days → escalate to admin

### Existing infrastructure reused:
- `pipeline_events` pattern → `deal_events`
- `matched_contractors[]` on leads → same matching
- `job_orders` negotiation flow → similar accept/reject UX
- Green API outreach → same private messaging

---

## Phase 5: Publisher Landing Page

### Files to create/modify:
- New page: `apps/landing/src/pages/Publishers.tsx`
- Modify: `apps/landing/src/App.tsx` (add route)
- Modify: `apps/landing/src/components/Footer.tsx` (add link)

### Content:
- Hero: "Distribute Your Leads to 5,000+ Verified Contractors"
- Value props: instant distribution, verified contractors, Stripe payments, full tracking
- CTA: "Start Publishing" → sign up with publisher role
- Trust signals: number of contractors, groups, completed deals

---

## Phase 6: Publisher Verification

### Simple verification to start:
1. **Stripe Connect KYC** — Stripe verifies identity + banking (automatic)
2. **Phone verification** — already exists via WhatsApp
3. **Publisher bio + company** — basic profile info
4. **Admin approval** — manual review for first-time publishers (optional toggle)

### Future (Phase 2):
- License verification
- Review/rating system
- Trust score based on deal history
- Automatic approval after X successful deals

---

## Implementation Order

1. **Migration** — schema changes (deals, deal_events, profiles extensions)
2. **Stripe Connect edge functions** — onboarding + webhook
3. **Publisher Dashboard** — publish lead form, deals view, earnings
4. **Deal Flow** — claim mechanism, status transitions, deal_events
5. **Contractor LeadsFeed** — show publisher leads, claim button, pricing
6. **Green API integration** — distribute publisher leads to matched contractors
7. **Publisher Landing Page** — marketing + signup
8. **Verification** — Stripe KYC + admin approval

---

## Verification Plan

### How to test end-to-end:
1. Create test user, add 'publisher' to roles
2. Submit a test lead via PublishLead form
3. Verify lead appears in `leads` table with `source_type = 'publisher'`
4. Verify matching engine finds contractors (check `matched_contractors[]`)
5. Switch to contractor user, verify lead appears in LeadsFeed
6. Claim the lead, verify deal is created in `deals` table
7. Walk through deal status transitions
8. Test Stripe Connect onboarding (test mode)
9. Test payment flow with Stripe test cards
10. Verify platform fee is collected

### Existing tests to ensure don't break:
- LeadsFeed still works for scanner leads
- RLS still isolates contractors
- Pipeline events still track correctly
- Subscription access still gates features

---

## Key Files Reference

### Existing (to reuse/modify):
- `supabase/migrations/021_lead_distribution_history.sql` — matching logic
- `supabase/migrations/014_subcontractors_crm.sql` — job_orders pattern
- `apps/dashboard/src/pages/LeadsFeed.tsx` — lead browsing
- `apps/dashboard/src/components/ForwardLeadModal.tsx` — lead forwarding UX
- `apps/dashboard/src/components/Sidebar.tsx` — navigation
- `apps/dashboard/src/hooks/useSubscriptionAccess.ts` — feature gating
- `supabase/functions/stripe-webhook/index.ts` — Stripe events
- `supabase/functions/_shared/` — shared utilities

### New:
- `supabase/migrations/033_distribution_network.sql`
- `supabase/functions/stripe-connect-onboard/index.ts`
- `supabase/functions/stripe-connect-webhook/index.ts`
- `apps/dashboard/src/pages/PublisherDashboard.tsx`
- `apps/dashboard/src/pages/PublishLead.tsx`
- `apps/dashboard/src/pages/PublisherDeals.tsx`
- `apps/landing/src/pages/Publishers.tsx`
