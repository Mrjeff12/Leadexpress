-- ============================================================
-- 038: Business Model V2 Schema
-- Network points, lead feedback, contractor group links,
-- new free/premium plans, teaser tracking
-- ============================================================

BEGIN;

-- ============================================================
-- 1. New Plans: free + premium (keep legacy starter/pro/unlimited)
-- ============================================================

-- Drop the old CHECK constraint that only allows starter/pro/unlimited
ALTER TABLE public.plans DROP CONSTRAINT IF EXISTS plans_slug_check;
ALTER TABLE public.plans ADD CONSTRAINT plans_slug_check
  CHECK (slug IN ('starter', 'pro', 'unlimited', 'free', 'premium'));

INSERT INTO public.plans (slug, name, price_cents, max_groups, max_professions, max_zip_codes)
VALUES
  ('free',    'Free',    0,    -1, -1, -1),
  ('premium', 'Premium', 7900, -1, -1, -1)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- 2. Network Points on profiles
-- ============================================================

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS network_points INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS network_level TEXT NOT NULL DEFAULT 'member';

-- Add CHECK constraint for network_level
ALTER TABLE public.profiles ADD CONSTRAINT profiles_network_level_check
  CHECK (network_level IN ('member', 'insider', 'partner', 'vip'));

CREATE INDEX IF NOT EXISTS idx_profiles_network_points ON public.profiles(network_points DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_network_level ON public.profiles(network_level);

-- ============================================================
-- 3. Network Points Log
-- ============================================================

CREATE TABLE public.network_points_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action      TEXT NOT NULL,
  points      INTEGER NOT NULL,
  metadata    JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_network_points_log_user ON public.network_points_log(user_id);
CREATE INDEX idx_network_points_log_action ON public.network_points_log(action);
CREATE INDEX idx_network_points_log_created ON public.network_points_log(created_at DESC);

ALTER TABLE public.network_points_log ENABLE ROW LEVEL SECURITY;

-- Users can read their own log entries
CREATE POLICY network_points_log_own_read ON public.network_points_log
  FOR SELECT USING (user_id = auth.uid());

-- Service role (SECURITY DEFINER functions) handles inserts;
-- no direct insert policy for regular users
CREATE POLICY network_points_log_service_insert ON public.network_points_log
  FOR INSERT WITH CHECK (false);

-- Admins can read all
CREATE POLICY network_points_log_admin_read ON public.network_points_log
  FOR SELECT USING (public.is_admin());

-- ============================================================
-- 4. Lead Feedback
-- ============================================================

CREATE TABLE public.lead_feedback (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id     UUID NOT NULL,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating      TEXT NOT NULL CHECK (rating IN ('got_job', 'not_relevant', 'scam')),
  comment     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(lead_id, user_id)
);

CREATE INDEX idx_lead_feedback_lead ON public.lead_feedback(lead_id);
CREATE INDEX idx_lead_feedback_user ON public.lead_feedback(user_id);
CREATE INDEX idx_lead_feedback_rating ON public.lead_feedback(rating);
CREATE INDEX idx_lead_feedback_created ON public.lead_feedback(created_at DESC);

ALTER TABLE public.lead_feedback ENABLE ROW LEVEL SECURITY;

-- Users manage their own feedback
CREATE POLICY lead_feedback_own_select ON public.lead_feedback
  FOR SELECT USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY lead_feedback_own_insert ON public.lead_feedback
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY lead_feedback_own_update ON public.lead_feedback
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY lead_feedback_own_delete ON public.lead_feedback
  FOR DELETE USING (user_id = auth.uid());

-- ============================================================
-- 5. Teaser Tracking on profiles
-- ============================================================

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS teasers_sent_this_week INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS teaser_week_start DATE;

-- ============================================================
-- 6. Contractor Group Links
-- ============================================================

CREATE TABLE public.contractor_group_links (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invite_link TEXT NOT NULL,
  group_name  TEXT,
  status      TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'joined', 'failed', 'left')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_contractor_group_links_user ON public.contractor_group_links(user_id);
CREATE INDEX idx_contractor_group_links_status ON public.contractor_group_links(status);
CREATE INDEX idx_contractor_group_links_created ON public.contractor_group_links(created_at DESC);

ALTER TABLE public.contractor_group_links ENABLE ROW LEVEL SECURITY;

-- Users manage their own group links
CREATE POLICY contractor_group_links_own_select ON public.contractor_group_links
  FOR SELECT USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY contractor_group_links_own_insert ON public.contractor_group_links
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY contractor_group_links_own_update ON public.contractor_group_links
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY contractor_group_links_own_delete ON public.contractor_group_links
  FOR DELETE USING (user_id = auth.uid());

-- Admins can read all and update status
CREATE POLICY contractor_group_links_admin_all ON public.contractor_group_links
  FOR ALL USING (public.is_admin());

-- ============================================================
-- 7. Function: award_network_points
-- ============================================================

CREATE OR REPLACE FUNCTION public.award_network_points(
  p_user_id  UUID,
  p_action   TEXT,
  p_points   INTEGER,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_total INTEGER;
  new_level TEXT;
BEGIN
  -- Insert log entry
  INSERT INTO network_points_log (user_id, action, points, metadata)
  VALUES (p_user_id, p_action, p_points, p_metadata);

  -- Update profile total and get new total
  UPDATE profiles
  SET network_points = network_points + p_points
  WHERE id = p_user_id
  RETURNING network_points INTO new_total;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User profile not found: %', p_user_id;
  END IF;

  -- Auto-calculate level based on thresholds
  IF new_total >= 1000 THEN
    new_level := 'vip';
  ELSIF new_total >= 500 THEN
    new_level := 'partner';
  ELSIF new_total >= 200 THEN
    new_level := 'insider';
  ELSE
    new_level := 'member';
  END IF;

  -- Update level if changed
  UPDATE profiles
  SET network_level = new_level
  WHERE id = p_user_id AND network_level IS DISTINCT FROM new_level;
END;
$$;

GRANT EXECUTE ON FUNCTION public.award_network_points(UUID, TEXT, INTEGER, JSONB) TO authenticated;

COMMIT;
