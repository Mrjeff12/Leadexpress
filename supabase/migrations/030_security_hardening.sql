-- ============================================================
-- 030: Security Hardening & Performance Indexes
-- ============================================================

-- ============================================================
-- 1. Fix pipeline_events public INSERT policy
--    Old policy allowed WITH CHECK (true) — anyone could insert.
--    Restrict to admin-only.
-- ============================================================
DROP POLICY IF EXISTS "pe_service_write" ON public.pipeline_events;
CREATE POLICY "pe_service_write" ON public.pipeline_events
  FOR INSERT WITH CHECK (public.is_admin());

-- ============================================================
-- 2. Add connection code expiry to wa_onboard_state
--    Sessions older than 10 minutes should be treated as expired.
-- ============================================================
ALTER TABLE public.wa_onboard_state
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ DEFAULT now() + INTERVAL '10 minutes';

-- ============================================================
-- 3. Add missing FK indexes for performance
--    Only creates indexes that don't already exist in prior migrations.
-- ============================================================

-- leads.group_id (001 has idx_leads_profession_zip but not group_id alone)
CREATE INDEX IF NOT EXISTS idx_leads_group_id ON public.leads(group_id);

-- subscriptions.plan_id (001 has idx_subscriptions_user but not plan_id)
CREATE INDEX IF NOT EXISTS idx_subscriptions_plan_id ON public.subscriptions(plan_id);

-- job_orders.subcontractor_id (014 has idx_job_orders_contractor but not subcontractor_id)
CREATE INDEX IF NOT EXISTS idx_job_orders_subcontractor_id ON public.job_orders(subcontractor_id);

-- prospects.assigned_wa_account_id (005 has no index on this FK)
CREATE INDEX IF NOT EXISTS idx_prospects_assigned_wa_account
  ON public.prospects(assigned_wa_account_id)
  WHERE assigned_wa_account_id IS NOT NULL;
