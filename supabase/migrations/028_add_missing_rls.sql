-- ============================================================
-- 028: Add missing RLS policies for prospect_messages,
--      prospect_events, and wa_onboard_state
-- ============================================================

-- ============================================================
-- 1. prospect_messages — admin only
-- ============================================================

ALTER TABLE public.prospect_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pm_admin_select ON public.prospect_messages;
CREATE POLICY pm_admin_select ON public.prospect_messages
  FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS pm_admin_insert ON public.prospect_messages;
CREATE POLICY pm_admin_insert ON public.prospect_messages
  FOR INSERT WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS pm_admin_update ON public.prospect_messages;
CREATE POLICY pm_admin_update ON public.prospect_messages
  FOR UPDATE USING (public.is_admin());

-- ============================================================
-- 2. prospect_events — admin only
-- ============================================================

ALTER TABLE public.prospect_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pe_events_admin_select ON public.prospect_events;
CREATE POLICY pe_events_admin_select ON public.prospect_events
  FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS pe_events_admin_insert ON public.prospect_events;
CREATE POLICY pe_events_admin_insert ON public.prospect_events
  FOR INSERT WITH CHECK (public.is_admin());

-- ============================================================
-- 3. wa_onboard_state — deny all (service_role bypasses RLS)
-- ============================================================

ALTER TABLE public.wa_onboard_state ENABLE ROW LEVEL SECURITY;

-- No policies = all access denied for regular users.
-- The whatsapp-webhook edge function uses the service_role key,
-- which bypasses RLS entirely.
