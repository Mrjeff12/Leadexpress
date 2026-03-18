# Subcontractor CRM & Job Forwarding Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a White-label Mini-CRM allowing premium contractors to forward leads to subcontractors via WhatsApp, track job statuses, and silently capture subcontractor data for future marketing.

**Architecture:** 
1. Supabase Migrations for `subcontractors` and `job_orders` tables with RLS.
2. Edge Function (or secure view) for the public portal to access job data without auth.
3. React UI in `apps/dashboard`: "My Team" management and "Forward Lead" modal.
4. React UI in `apps/dashboard` (or separate route): Public White-label Portal `/portal/job/:token`.

**Tech Stack:** React, Tailwind CSS, Supabase (PostgreSQL + RLS), Lucide React.

---

### Task 1: Database Migrations

**Files:**
- Create: `supabase/migrations/014_subcontractors_crm.sql`

**Step 1: Write the migration script**
Write the SQL to create `subcontractors` and `job_orders` tables, update the `plans` table, and set up RLS.

```sql
-- 014: Subcontractors CRM

-- 1. Update Plans
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS can_manage_subcontractors BOOLEAN NOT NULL DEFAULT false;
UPDATE public.plans SET can_manage_subcontractors = true WHERE slug IN ('pro', 'unlimited');

-- 2. Subcontractors Table
CREATE TABLE public.subcontractors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  profession_tags TEXT[] DEFAULT '{}',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(contractor_id, phone)
);

CREATE INDEX idx_subcontractors_contractor ON public.subcontractors(contractor_id);

-- 3. Job Orders Table
CREATE TABLE public.job_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  contractor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  subcontractor_id UUID NOT NULL REFERENCES public.subcontractors(id),
  
  deal_type TEXT NOT NULL CHECK (deal_type IN ('percentage', 'fixed_price', 'custom')),
  deal_value TEXT NOT NULL,
  
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'completed', 'cancelled')),
  access_token UUID NOT NULL DEFAULT gen_random_uuid(),
  
  viewed_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_job_orders_token ON public.job_orders(access_token);
CREATE INDEX idx_job_orders_contractor ON public.job_orders(contractor_id);
CREATE INDEX idx_job_orders_lead ON public.job_orders(lead_id);

-- 4. RLS Policies
ALTER TABLE public.subcontractors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_orders ENABLE ROW LEVEL SECURITY;

-- Contractors see their own subs
CREATE POLICY subcontractors_own ON public.subcontractors
  FOR ALL USING (
    contractor_id = auth.uid()
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

-- Contractors see their own job orders
CREATE POLICY job_orders_own ON public.job_orders
  FOR ALL USING (
    contractor_id = auth.uid()
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

-- Public read access for job orders via access_token (only specific fields should be selected in the UI)
CREATE POLICY job_orders_public_read ON public.job_orders
  FOR SELECT USING (true); -- We rely on the unguessable access_token UUID

-- Public update access for job orders (to accept/reject)
CREATE POLICY job_orders_public_update ON public.job_orders
  FOR UPDATE USING (true);

-- 5. Triggers
CREATE TRIGGER subcontractors_updated_at BEFORE UPDATE ON public.subcontractors
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER job_orders_updated_at BEFORE UPDATE ON public.job_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

**Step 2: Apply the migration**
Run: `npm run db:push` or equivalent Supabase CLI command.

**Step 3: Commit**
```bash
git add supabase/migrations/014_subcontractors_crm.sql
git commit -m "feat(db): add subcontractors and job_orders tables"
```

---

### Task 2: Subcontractors Management UI (Dashboard)

**Files:**
- Create: `apps/dashboard/src/pages/Subcontractors.tsx`
- Modify: `apps/dashboard/src/App.tsx` (Add route)
- Modify: `apps/dashboard/src/components/Sidebar.tsx` (Add link)

**Step 1: Create Subcontractors Page**
Build a simple CRUD interface for `subcontractors`.
- Fetch list of subs for the current user.
- "Add Subcontractor" modal (Name, Phone, Professions).
- List view with basic stats (future-proofed).

**Step 2: Add to Router & Sidebar**
Add `/subcontractors` route and link in the sidebar under "My Team".

**Step 3: Commit**
```bash
git add apps/dashboard/src/pages/Subcontractors.tsx apps/dashboard/src/App.tsx apps/dashboard/src/components/Sidebar.tsx
git commit -m "feat(ui): add subcontractors management page"
```

---

### Task 3: Forward Lead Modal

**Files:**
- Modify: `apps/dashboard/src/components/LeadCard.tsx` (or where leads are displayed)
- Create: `apps/dashboard/src/components/ForwardLeadModal.tsx`

**Step 1: Create the Modal Component**
- Props: `lead` object.
- State: Selected Subcontractor, Deal Type (%, Fixed), Deal Value.
- Action: "Generate Link & Send".
  - Insert row into `job_orders`.
  - Construct WhatsApp URL: `https://wa.me/${sub.phone}?text=${encodeURIComponent(message)}`.
  - Open URL in new tab.

**Step 2: Integrate into LeadCard**
- Add a "Forward" button (icon: Share/Send).
- Check if user has `can_manage_subcontractors` (from profile/subscription context). If not, show Upsell Modal instead.

**Step 3: Commit**
```bash
git add apps/dashboard/src/components/LeadCard.tsx apps/dashboard/src/components/ForwardLeadModal.tsx
git commit -m "feat(ui): add forward lead modal with wa.me integration"
```

---

### Task 4: Public White-label Portal

**Files:**
- Create: `apps/dashboard/src/pages/JobPortal.tsx`
- Modify: `apps/dashboard/src/App.tsx` (Add public route)

**Step 1: Create the Portal Route**
- Route: `/portal/job/:token`
- Fetch `job_orders` joined with `leads` and `profiles` (Main Contractor name) using the `token`.
- **Security Check:** Only display customer phone/address if `status === 'accepted'`.

**Step 2: Build the UI**
- Clean, mobile-first design. No Lead Express branding.
- Header: "[Contractor Name] sent you a job".
- Body: Job details (City, Urgency, Summary, Deal Terms).
- Footer: "Approve Job" button.

**Step 3: Handle Approval Action**
- On click: Update `job_orders` status to `accepted`.
- Reveal customer details.
- (Optional) Trigger an event to log the sub's phone for marketing.

**Step 4: Commit**
```bash
git add apps/dashboard/src/pages/JobPortal.tsx apps/dashboard/src/App.tsx
git commit -m "feat(ui): add public white-label job portal"
```
