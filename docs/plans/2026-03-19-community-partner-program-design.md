# Community Partner Program - Full Design Document

**Date:** 2026-03-19
**Status:** Approved for implementation
**Scope:** Database, Backend, Landing Page, Partner Dashboard, Admin Panel

---

## 1. Overview

WhatsApp group owners become "Community Partners" who earn 15% recurring commission on every contractor that subscribes through them. Partners get a branded page, analytics dashboard, and wallet system.

**Core Proposition:** "You provide the arena. We provide the technology."

### Key Decisions
- Partners are NOT a separate role - they are contractors with an additional `community_partners` record
- Single referral code per partner (the slug)
- Computed balance via trigger-maintained `balance_cache_cents` column
- Commission lifecycle: `pending` (14 days) → `approved` → `paid`
- First-touch attribution (one partner per referred user)

---

## 2. Database Architecture

### Migration: `033_community_partners.sql`

#### Table: `community_partners`
```sql
CREATE TABLE public.community_partners (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  slug            TEXT NOT NULL UNIQUE,
  display_name    TEXT NOT NULL,
  bio             TEXT,
  avatar_url      TEXT,
  cover_image_url TEXT,
  location        TEXT,
  service_areas   TEXT[] DEFAULT '{}',
  specialties     TEXT[] DEFAULT '{}',
  commission_rate NUMERIC(5,4) NOT NULL DEFAULT 0.1500,
  status          TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','active','suspended','rejected')),
  verified_at     TIMESTAMPTZ,
  balance_cache_cents INTEGER NOT NULL DEFAULT 0,
  stats           JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_community_partners_slug ON public.community_partners(slug);
CREATE INDEX idx_community_partners_status ON public.community_partners(status) WHERE status = 'active';
CREATE INDEX idx_community_partners_user ON public.community_partners(user_id);
```

#### Table: `partner_linked_groups`
```sql
CREATE TABLE public.partner_linked_groups (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id  UUID NOT NULL REFERENCES public.community_partners(id) ON DELETE CASCADE,
  group_id    UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  verified    BOOLEAN NOT NULL DEFAULT false,
  linked_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(partner_id, group_id)
);

CREATE INDEX idx_partner_linked_groups_partner ON public.partner_linked_groups(partner_id);
CREATE INDEX idx_partner_linked_groups_group ON public.partner_linked_groups(group_id);
```

#### Table: `partner_referrals`
```sql
CREATE TABLE public.partner_referrals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id      UUID NOT NULL REFERENCES public.community_partners(id) ON DELETE CASCADE,
  referred_user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  referral_source  TEXT NOT NULL DEFAULT 'link'
    CHECK (referral_source IN ('link','group','manual')),
  converted_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_partner_referrals_partner ON public.partner_referrals(partner_id);
CREATE INDEX idx_partner_referrals_referred ON public.partner_referrals(referred_user_id);
CREATE INDEX idx_partner_referrals_converted ON public.partner_referrals(converted_at)
  WHERE converted_at IS NOT NULL;
```

#### Table: `partner_commissions`
```sql
CREATE TABLE public.partner_commissions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id      UUID NOT NULL REFERENCES public.community_partners(id) ON DELETE CASCADE,
  referral_id     UUID REFERENCES public.partner_referrals(id) ON DELETE SET NULL,
  type            TEXT NOT NULL CHECK (type IN ('earning','withdrawal','credit','refund_clawback')),
  amount_cents    INTEGER NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','paid','rejected','reversed')),
  stripe_invoice_id TEXT,
  stripe_payout_id  TEXT,
  note            TEXT,
  approved_at     TIMESTAMPTZ,
  paid_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_partner_commissions_partner ON public.partner_commissions(partner_id);
CREATE INDEX idx_partner_commissions_status ON public.partner_commissions(status);
CREATE INDEX idx_partner_commissions_type ON public.partner_commissions(type, partner_id);
CREATE INDEX idx_partner_commissions_invoice ON public.partner_commissions(stripe_invoice_id)
  WHERE stripe_invoice_id IS NOT NULL;
CREATE INDEX idx_partner_commissions_created ON public.partner_commissions(created_at DESC);
```

#### Trigger: Balance Cache
```sql
CREATE OR REPLACE FUNCTION public.update_partner_balance_cache()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.community_partners
  SET balance_cache_cents = COALESCE((
    SELECT SUM(amount_cents)
    FROM public.partner_commissions
    WHERE partner_id = COALESCE(NEW.partner_id, OLD.partner_id)
      AND status IN ('approved', 'paid')
  ), 0)
  WHERE id = COALESCE(NEW.partner_id, OLD.partner_id);
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_update_partner_balance
  AFTER INSERT OR UPDATE OF status, amount_cents OR DELETE
  ON public.partner_commissions
  FOR EACH ROW EXECUTE FUNCTION public.update_partner_balance_cache();
```

#### RLS Policies
- `community_partners`: public reads active partners, partners update own, admins all
- `partner_linked_groups`: partners read own, admins write all
- `partner_referrals`: partners read own, admins write all
- `partner_commissions`: partners read own, admins write all

#### RPC Functions
- `get_partner_overview()` - admin dashboard stats
- `approve_partner(UUID)` - activate pending partner
- `process_withdrawal(UUID)` - mark withdrawal as paid
- `get_partner_leaderboard(INTEGER)` - ranked partners
- `approve_mature_commissions()` - approve 14-day-old pending commissions
- `get_my_partner_stats()` - partner's own live stats

---

## 3. Backend (Edge Functions)

### 3.1 Modify: `stripe-webhook/index.ts`

On `invoice.payment_succeeded`:
1. Find user from subscription metadata
2. Check `partner_referrals` for this user
3. If referred + partner active: calculate commission (amount_paid x rate)
4. Guard against duplicate (check stripe_invoice_id)
5. Insert `partner_commissions` (type=earning, status=pending)
6. If first payment: mark referral as converted

On `charge.refunded`:
1. Find commission by stripe_invoice_id
2. Create refund_clawback entry (negative amount)
3. Reverse original if still pending

### 3.2 Modify: `create-checkout-session/index.ts`

Accept `refCode` in request body, validate partner exists and is active, store `ref_partner_slug` in Stripe session + subscription metadata. On checkout.completed, create `partner_referrals` row.

### 3.3 New: `partner-signup/index.ts`
- Auth: JWT required
- Creates community_partners record with generated slug
- Status: pending (or auto-active for MVP)

### 3.4 New: `partner-withdraw/index.ts`
- Auth: JWT required
- Validates balance >= amount, minimum $50
- Inserts withdrawal commission (negative amount, pending)

### 3.5 New: `partner-apply-credit/index.ts`
- Auth: JWT required
- Creates Stripe coupon on partner's own subscription
- Inserts credit commission

### Referral Tracking Flow
1. Partner shares `leadexpress.co/join/slug` or `?ref=slug`
2. Landing page stores ref in localStorage + cookie (30 days)
3. Signup passes ref to user metadata
4. Checkout passes ref to Stripe metadata
5. Webhook creates referral record on checkout.completed
6. Commission created on each invoice.payment_succeeded
7. Cron approves 14-day-old commissions daily

---

## 4. Landing Page - Partner Pages

### Route Structure
```
/partners           → PartnersPage (main conversion page)
/community          → CommunityDirectory (all verified partners)
/community/:slug    → PartnerProfile (individual partner page)
/join/:code         → JoinRedirect (stores ref, redirects to signup)
```

### `/partners` Page Sections (in order)

1. **PartnerHero** - "Your Group Makes Money. Just Not for You."
   - Two-column: copy + animated dashboard preview
   - CTA: "Become a Partner"

2. **TheLossSection** - "Every Day, Leads Leave Your Group. You Get Nothing."
   - Dark section with 3 stat cards: 47 leads/week, $0 your earnings, $517/mo potential
   - "Everyone is on mute. Jobs get buried."

3. **PartnerIdentitySection** - "You're Not an Affiliate. You're a Community Partner."
   - Branded page, Verified badge, Partner Dashboard features

4. **EarningsCalculator** - "See What Your Community Is Worth"
   - Interactive: group size slider, conversion rate, plan selector
   - Live calculation: "Your Monthly Earnings: $XXX"
   - Progress bar: "5 referrals = YOUR subscription is FREE"

5. **HowPartnershipWorks** - "You Provide the Arena. We Provide the Technology."
   - 4 steps: Get Link → Share → Members Subscribe → Earn 15%
   - WhatsApp message mockup

6. **PartnerVisibilitySection** - "See Every Lead. Every Subscriber. Every Dollar."
   - Dashboard mockup with KPIs and activity feed

7. **PartnerSocialProof** - "Yossi from NJ Already Makes $600/Month"
   - Featured testimonial + 3 smaller cards

8. **PartnerTiersSection** - "The More You Refer, The Less You Pay"
   - 3 tiers: 1-2 refs = 20% off, 3-4 = 50% off, 5+ = FREE

9. **PartnerFAQ** - 8 questions covering earnings, effort, payments, groups

10. **PartnerCTA** - "Your Community. Your Revenue."

### Design System
- Match existing: orange gradients, glass morphism, Outfit font
- Dark sections: bg-[#0b0707] with white/5 cards
- Light sections: alternate bg-cream / bg-white
- Badge pills: bg-[#fe5b25]/10 border-[#fe5b25]/20

---

## 5. Partner Dashboard (in main dashboard app)

### Routes
```
/partner/join       → PartnerOnboarding (3-step wizard)
/partner            → PartnerHome (KPIs, earnings chart, activity)
/partner/referrals  → PartnerReferrals (all referred users)
/partner/communities → PartnerCommunities (linked groups)
/partner/wallet     → PartnerWallet (balance, transactions, withdraw)
/partner/settings   → PartnerSettings (profile, slug, payout)
/partner/share      → PartnerShare (referral link, QR, templates)
```

### Sidebar Addition
New "Partner" section (icon: Handshake) appears only for users with active community_partners record:
- Partner Home, Referrals, Communities, Wallet, Share

### Route Guard: RequirePartner
Checks community_partners record exists and is active. Redirects to /partner/join if not.

### Key Pages

**Partner Home** - 4 KPI cards (earnings, referrals, communities, commission rate) + earnings area chart + recent activity list + quick actions

**Referrals** - Card-based list with search/filter, status badges, per-referral commission display

**Communities** - Linked WhatsApp groups with analytics per group, "Link New Group" modal

**Wallet** - Gradient balance hero card + withdraw/credit buttons + transaction history with type/status filters

**Share** - Referral link with copy, QR code generator, 3 pre-written message templates (WhatsApp, Email, Social)

**Settings** - Profile form, slug editor with availability check, payout preferences

### Partner Onboarding (3 steps)
1. Welcome/value prop
2. Profile setup (name, slug, location, bio)
3. Link first group (optional skip)

### Hooks
- `usePartnerProfile()` - partner data + mutations
- `usePartnerStats()` - KPIs + chart data
- `usePartnerReferrals()` - referral list
- `usePartnerCommissions()` - transactions with pagination
- `usePartnerCommunities()` - linked groups
- `usePartnerWithdraw()` - withdrawal mutation
- `usePartnerApplyCredit()` - credit mutation

---

## 6. Admin Panel

### Canvas Addition
New "Partners" department node (color: #ec4899, icon: Handshake) with KPIs: Active Partners, Pending Approval, Commissions Pending

### Admin Pages

**Partner Overview** (`/admin/partners`) - 6 KPI cards, quick actions (review apps, process withdrawals, approve mature commissions), leaderboard table, recent activity feed

**Partner List** (`/admin/partners/list`) - Searchable/filterable table with status management, bulk approve/reject, click-through to detail

**Partner Detail** (`/admin/partners/list/:id`) - Full partner profile with: approve/reject/suspend actions, commission rate editor, linked groups table, referrals table, commissions table, manual commission entry, impersonation

**Withdrawal Queue** (`/admin/partners/withdrawals`) - Pending withdrawals with "Mark as Paid" / "Reject" actions, processed history

**Commission Log** (`/admin/partners/commissions`) - All commissions with filters (type, status, date range, partner), CSV export

### Admin Actions
| Action | RPC/Query |
|--------|-----------|
| Approve partner | `rpc('approve_partner', id)` |
| Reject partner | `update status='rejected'` |
| Suspend partner | `update status='suspended'` |
| Change commission rate | `update commission_rate` |
| Process withdrawal | `rpc('process_withdrawal', id)` |
| Manual commission | `insert partner_commissions` |
| Approve mature commissions | `rpc('approve_mature_commissions')` |
| Impersonate | `impersonate(partner.user_id)` |

---

## 7. Implementation Phases

### Phase 1: Foundation (MVP)
- Migration 033: all tables, RLS, triggers, RPCs
- Modify stripe-webhook: commission on payment
- Modify create-checkout-session: ref code tracking
- partner-signup edge function
- Basic partner dashboard: Home + Share + Referrals
- Sidebar partner section

### Phase 2: Public Presence
- Landing /partners page (all 10 sections)
- /join/:code redirect
- /community directory
- /community/:slug profile

### Phase 3: Full Dashboard
- Wallet + withdraw/credit
- Communities + group linking
- Settings + slug editor
- Partner onboarding wizard
- QR code + share templates

### Phase 4: Admin
- Partners department on canvas
- Partner overview + list + detail
- Withdrawal queue
- Commission log
- Admin actions (approve, suspend, manual commission)

---

## 8. Edge Cases

| Case | Handling |
|------|----------|
| Partner cancels own subscription | No impact on partner status |
| Referred user upgrades/downgrades | Commission based on actual invoice amount |
| Referred user gets refund | Clawback entry created |
| Referred user cancels | No more invoices = no more commissions |
| Partner suspended | Stops earning, existing balance remains |
| Duplicate invoice webhook | Idempotency guard on stripe_invoice_id |
| Self-referral attempt | Check partner.user_id != checkout user_id |
| Multiple partners claim same user | First-touch wins (UNIQUE on referred_user_id) |

---

## 9. New Dependencies
- `qrcode.react` - QR code generation for Share page
- No other new dependencies needed
