-- ============================================================
-- P1 Security Fixes: RLS hardening + role escalation prevention
-- ============================================================

-- ── FIX 1: Leads table — ensure anon cannot read ──
-- The existing leads_read policy (from 021) uses is_admin() OR matched_contractors,
-- which already implies auth.uid() is set. But let's be explicit and add an
-- auth.uid() IS NOT NULL guard so anon keys are definitively blocked.
DROP POLICY IF EXISTS leads_read ON public.leads;
CREATE POLICY leads_read ON public.leads
  FOR SELECT USING (
    auth.uid() IS NOT NULL
    AND (
      public.is_admin()
      OR (auth.uid() = ANY(matched_contractors))
    )
  );
-- NOTE: The real per-lead gating (canSeeLeadDetails) lives in the frontend.
-- This RLS policy is a safety net to block anon and unmatched users at the DB level.

-- ── FIX 2: Prevent self-escalation of the `roles` array column ──
-- Migration 012 only protects the scalar `role` column. This adds protection
-- for the `roles` text[] array column added in migration 034.
DROP POLICY IF EXISTS profiles_update ON public.profiles;
CREATE POLICY profiles_update ON public.profiles
  FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (
    -- Admin can update anything
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
    OR
    (
      -- Non-admin: scalar role must stay the same
      role = (SELECT role FROM public.profiles WHERE id = auth.uid())
      AND
      -- Non-admin: roles array must stay the same
      roles IS NOT DISTINCT FROM (SELECT roles FROM public.profiles WHERE id = auth.uid())
    )
  );

-- ── FIX 6: Enable RLS on phone_locks and cron_runs (service_role only) ──
ALTER TABLE phone_locks ENABLE ROW LEVEL SECURITY;
ALTER TABLE cron_runs ENABLE ROW LEVEL SECURITY;
-- No public policies — only service_role can access these tables.
