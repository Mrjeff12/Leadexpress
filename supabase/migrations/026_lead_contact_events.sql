-- 026: Track when contractors click "Contact Advertiser" on a lead
-- Useful for: user dashboard stats, admin analytics, lead popularity

CREATE TABLE public.lead_contact_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id     UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookups per user and per lead
CREATE INDEX idx_lce_user    ON public.lead_contact_events(user_id, created_at DESC);
CREATE INDEX idx_lce_lead    ON public.lead_contact_events(lead_id);

-- RLS
ALTER TABLE public.lead_contact_events ENABLE ROW LEVEL SECURITY;

-- Users can insert their own events; admins can insert on behalf of impersonated users
CREATE POLICY lce_insert ON public.lead_contact_events
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    OR public.is_admin()
  );

-- Users can read their own events; admins can read all
CREATE POLICY lce_read ON public.lead_contact_events
  FOR SELECT USING (
    auth.uid() = user_id
    OR public.is_admin()
  );
