# Prospect ↔ Contractor Link Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a direct FK link between `prospects` and `contractors` so the system auto-matches them by phone on signup, and admins can manually link/unlink. Replaces the current 3-query runtime phone-lookup with a single join.

**Architecture:** Add `contractor_id UUID` nullable FK on `prospects` table. A DB trigger on `contractors` INSERT auto-matches by phone. A new admin UI action allows manual linking. The existing `useProspectDetailData` hook switches from phone-lookup to direct FK join. The Stripe webhook RPC gains the same optimization.

**Tech Stack:** PostgreSQL (migration + trigger), React/TanStack Query (frontend), Supabase RLS

---

### Task 1: Database Migration — Add `contractor_id` Column + Auto-Match Trigger

**Files:**
- Create: `supabase/migrations/093_prospect_contractor_link.sql`

- [ ] **Step 1: Write the migration**

```sql
-- ============================================================
-- 093: Link prospects to contractors via contractor_id FK
-- ============================================================

-- 1. Add nullable FK column
ALTER TABLE public.prospects
  ADD COLUMN contractor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX idx_prospects_contractor_id ON public.prospects(contractor_id)
  WHERE contractor_id IS NOT NULL;

-- 2. Backfill existing matches by phone
UPDATE public.prospects p
SET contractor_id = pr.id
FROM public.profiles pr
JOIN public.contractors c ON c.user_id = pr.id
WHERE pr.phone = p.phone
  AND p.contractor_id IS NULL;

-- 3. Trigger: auto-link when a new contractor signs up
CREATE OR REPLACE FUNCTION public.link_prospect_on_contractor_insert()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_phone TEXT;
BEGIN
  -- Get the phone from the profile
  SELECT phone INTO v_phone
  FROM public.profiles
  WHERE id = NEW.user_id;

  IF v_phone IS NOT NULL THEN
    UPDATE public.prospects
    SET contractor_id = NEW.user_id,
        updated_at = now()
    WHERE phone = v_phone
      AND contractor_id IS NULL;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_link_prospect_on_contractor_insert
  AFTER INSERT ON public.contractors
  FOR EACH ROW
  EXECUTE FUNCTION public.link_prospect_on_contractor_insert();

-- 4. Update RLS: contractors can see their own prospect record
CREATE POLICY "contractors_view_own_prospect"
  ON public.prospects
  FOR SELECT
  USING (contractor_id = auth.uid());
```

- [ ] **Step 2: Apply migration to dev branch**

Run: `supabase db push` or apply via Supabase MCP tool
Expected: Migration applies cleanly, backfill populates existing matches

- [ ] **Step 3: Verify backfill**

```sql
SELECT count(*) FROM prospects WHERE contractor_id IS NOT NULL;
-- Should match: SELECT count(*) FROM prospects p JOIN profiles pr ON pr.phone = p.phone JOIN contractors c ON c.user_id = pr.id;
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/093_prospect_contractor_link.sql
git commit -m "feat: add contractor_id FK to prospects with auto-link trigger"
```

---

### Task 2: Update Shared Types

**Files:**
- Modify: `packages/shared/src/types.ts` (line ~163-190, Prospect interface)

- [ ] **Step 1: Add contractor_id to Prospect type**

In `packages/shared/src/types.ts`, add `contractor_id` to the `Prospect` interface:

```typescript
// In the Prospect interface, add after group_ids:
  contractorId: string | null
```

- [ ] **Step 2: Add contractor_id to the hook's Prospect interface**

In `apps/dashboard/src/hooks/useProspectDetailData.ts`, add to the `Prospect` interface (after `group_ids`):

```typescript
  contractor_id: string | null
```

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/types.ts apps/dashboard/src/hooks/useProspectDetailData.ts
git commit -m "feat: add contractor_id to Prospect types"
```

---

### Task 3: Simplify useProspectDetailData Hook — Replace Phone Lookup with FK Join

**Files:**
- Modify: `apps/dashboard/src/hooks/useProspectDetailData.ts:133-174`

- [ ] **Step 1: Replace the contractorQuery implementation**

Replace the current `contractorQuery` (lines 133-174) that does 3 separate queries with a single query using the FK:

```typescript
  // Fetch linked contractor profile (via direct FK)
  const contractorId = prospectQuery.data?.contractor_id
  const contractorQuery = useQuery({
    queryKey: ['admin', 'prospects', 'contractor', contractorId ?? ''],
    enabled: Boolean(contractorId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contractors')
        .select(`
          user_id, professions, zip_codes, working_days, wa_notify, is_active,
          profiles!inner(full_name, phone, preferred_locale, counties),
          subscriptions(status, plan)
        `)
        .eq('user_id', contractorId)
        .single()
      if (error) throw error
      if (!data) return null

      const profile = (data as any).profiles
      const sub = (data as any).subscriptions?.[0]
      return {
        user_id: data.user_id,
        professions: data.professions,
        zip_codes: data.zip_codes,
        working_days: data.working_days,
        wa_notify: data.wa_notify,
        is_active: data.is_active,
        full_name: profile.full_name,
        phone: profile.phone,
        counties: profile.counties ?? [],
        preferred_locale: profile.preferred_locale,
        subscription_status: sub?.status ?? null,
        subscription_plan: sub?.plan ?? null,
      } as LinkedContractor
    },
    staleTime: 60_000,
  })
```

- [ ] **Step 2: Verify the dashboard still shows linked contractor info on prospect detail page**

Open a prospect that has a linked contractor and confirm the contractor card renders correctly.

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/src/hooks/useProspectDetailData.ts
git commit -m "refactor: use contractor_id FK instead of phone lookup for prospect-contractor link"
```

---

### Task 4: Admin Manual Link/Unlink UI

**Files:**
- Modify: `apps/dashboard/src/pages/ProspectDetail.tsx` (add link/unlink action)

- [ ] **Step 1: Add link/unlink RPC**

Create a simple RPC in the migration file (append to `093_prospect_contractor_link.sql` or create `094_prospect_link_rpc.sql`):

```sql
-- Admin RPC: manually link/unlink a prospect to a contractor
CREATE OR REPLACE FUNCTION public.admin_link_prospect_contractor(
  p_prospect_id UUID,
  p_contractor_id UUID  -- NULL to unlink
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only admins
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'admin only';
  END IF;

  -- Validate contractor exists (if linking)
  IF p_contractor_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM contractors WHERE user_id = p_contractor_id) THEN
      RAISE EXCEPTION 'contractor not found';
    END IF;
  END IF;

  UPDATE prospects
  SET contractor_id = p_contractor_id,
      updated_at = now()
  WHERE id = p_prospect_id;

  -- Log event
  INSERT INTO prospect_events (prospect_id, event_type, old_value, new_value, changed_by)
  VALUES (
    p_prospect_id,
    'profile_updated',
    NULL,
    CASE WHEN p_contractor_id IS NOT NULL
      THEN 'linked to contractor ' || p_contractor_id::TEXT
      ELSE 'unlinked from contractor'
    END,
    auth.uid()
  );
END;
$$;
```

- [ ] **Step 2: Add link/unlink button to ProspectDetail page**

In the contractor card section of `ProspectDetail.tsx`, add:
- If `contractor_id` is set: show an "Unlink" button that calls `admin_link_prospect_contractor(prospect_id, null)`
- If `contractor_id` is null: show a "Link Contractor" button that opens a search dialog (search `profiles` by phone/name), then calls `admin_link_prospect_contractor(prospect_id, selected_contractor_id)`

This is a UI task — the exact implementation depends on the existing component patterns in ProspectDetail.tsx. The RPC handles all validation.

- [ ] **Step 3: Test link/unlink flow**

1. Open a prospect without a linked contractor
2. Click "Link Contractor" → search by name → select → verify contractor card appears
3. Click "Unlink" → verify contractor card disappears
4. Check `prospect_events` table for the logged events

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/094_prospect_link_rpc.sql apps/dashboard/src/pages/ProspectDetail.tsx
git commit -m "feat: admin manual link/unlink prospect-contractor with RPC + UI"
```

---

### Task 5: Optimize Stripe Webhook RPC

**Files:**
- Modify: `supabase/migrations/051_stripe_webhook_rpc.sql` (or create new migration that replaces the function)

- [ ] **Step 1: Create migration that updates handle_stripe_event to also set contractor_id**

Create `supabase/migrations/095_stripe_rpc_set_contractor_id.sql`:

```sql
-- When Stripe confirms payment, ensure the prospect is linked to the contractor
-- This handles the case where contractor signed up but trigger missed (edge case)
CREATE OR REPLACE FUNCTION public.handle_stripe_event(
  p_stripe_subscription_id TEXT,
  p_event_type TEXT,
  p_detail JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prospect_id UUID;
  v_old_stage TEXT;
  v_old_sub TEXT;
  v_phone TEXT;
  v_name TEXT;
  v_user_id UUID;
BEGIN
  -- Lookup: subscription → profile → prospect (same as before)
  SELECT p.id, p.stage::TEXT, p.sub_status, p.phone, p.display_name, pr.id
  INTO v_prospect_id, v_old_stage, v_old_sub, v_phone, v_name, v_user_id
  FROM prospects p
  JOIN profiles pr ON pr.phone = p.phone
  JOIN subscriptions s ON s.user_id = pr.id
  WHERE s.stripe_subscription_id = p_stripe_subscription_id
  LIMIT 1;

  IF v_prospect_id IS NULL THEN RETURN NULL; END IF;

  -- Auto-link contractor_id if not already set
  IF v_user_id IS NOT NULL THEN
    UPDATE prospects
    SET contractor_id = v_user_id
    WHERE id = v_prospect_id AND contractor_id IS NULL;
  END IF;

  -- ... rest of existing logic unchanged (stage/sub_status updates) ...
  -- NOTE: The implementing engineer should copy the full function body from
  -- migration 051 and add only the contractor_id update block above.
  -- The rest of the function (CASE statements for event types) stays identical.

  RETURN v_prospect_id;
END;
$$;
```

- [ ] **Step 2: Verify with test Stripe event**

Trigger a test `invoice.payment_succeeded` event and confirm the prospect gets `contractor_id` set.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/095_stripe_rpc_set_contractor_id.sql
git commit -m "feat: Stripe webhook auto-links contractor_id on payment"
```

---

### Task 6: Update prospect_with_groups View

**Files:**
- Create: `supabase/migrations/096_prospect_view_contractor_id.sql`

- [ ] **Step 1: Recreate the view to include contractor_id**

```sql
-- Add contractor_id to the prospect_with_groups view
CREATE OR REPLACE VIEW public.prospect_with_groups AS
SELECT
  p.*,
  COALESCE(
    ARRAY(
      SELECT g.name
      FROM public.groups g
      WHERE g.id = ANY(p.group_ids)
    ),
    '{}'
  ) AS group_names
FROM public.prospects p;
```

Note: Since `p.*` already includes `contractor_id` after migration 093, this view may not need changes if it already uses `SELECT p.*`. Verify by checking the current view definition first.

- [ ] **Step 2: Verify the view includes contractor_id**

```sql
SELECT contractor_id FROM prospect_with_groups LIMIT 1;
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/096_prospect_view_contractor_id.sql
git commit -m "fix: ensure prospect_with_groups view includes contractor_id"
```
