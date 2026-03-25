-- ============================================================
-- 062: Job Broadcast System
-- Enables contractors to broadcast jobs to the network,
-- receive interest from matching contractors, and choose
-- from responding contractors based on profiles and ratings.
-- ============================================================
BEGIN;

-- ============================================================
-- 1. job_broadcasts — published job opportunities
-- ============================================================
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
  sent_count       INTEGER NOT NULL DEFAULT 0,
  expires_at       TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '72 hours'),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_jb_publisher ON public.job_broadcasts(publisher_id, status);
CREATE INDEX idx_jb_lead ON public.job_broadcasts(lead_id);
CREATE INDEX idx_jb_open ON public.job_broadcasts(status, expires_at)
  WHERE status = 'open';

CREATE TRIGGER set_jb_updated_at
  BEFORE UPDATE ON public.job_broadcasts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE public.job_broadcasts ENABLE ROW LEVEL SECURITY;

CREATE POLICY jb_publisher ON public.job_broadcasts
  FOR ALL USING (
    publisher_id = auth.uid()
    OR public.is_admin()
  );

CREATE POLICY jb_responders_read ON public.job_broadcasts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.job_broadcast_responses
      WHERE broadcast_id = id AND contractor_id = auth.uid()
    )
  );


-- ============================================================
-- 2. job_broadcast_responses — contractor interest
-- ============================================================
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
  ON public.job_broadcast_responses(broadcast_id) WHERE status = 'chosen';

CREATE INDEX idx_jbr_broadcast ON public.job_broadcast_responses(broadcast_id, status);
CREATE INDEX idx_jbr_contractor ON public.job_broadcast_responses(contractor_id);

ALTER TABLE public.job_broadcast_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY jbr_own ON public.job_broadcast_responses
  FOR ALL USING (
    contractor_id = auth.uid()
    OR public.is_admin()
  );

CREATE POLICY jbr_publisher_read ON public.job_broadcast_responses
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.job_broadcasts
      WHERE id = broadcast_id AND publisher_id = auth.uid()
    )
  );


-- ============================================================
-- 3. contractor_invites — invite unregistered contractors
-- ============================================================
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
  CHECK (status != 'registered' OR invited_user_id IS NOT NULL),
  UNIQUE(inviter_id, phone)
);

CREATE INDEX idx_ci_phone ON public.contractor_invites(phone, status);
CREATE INDEX idx_ci_inviter ON public.contractor_invites(inviter_id);

ALTER TABLE public.contractor_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY ci_own ON public.contractor_invites
  FOR ALL USING (
    inviter_id = auth.uid()
    OR invited_user_id = auth.uid()
    OR public.is_admin()
  );


-- ============================================================
-- 4. Add columns to job_orders
-- ============================================================
ALTER TABLE public.job_orders
  ADD COLUMN IF NOT EXISTS assigned_user_id UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS broadcast_id UUID REFERENCES public.job_broadcasts(id);

CREATE INDEX IF NOT EXISTS idx_jo_assigned_user ON public.job_orders(assigned_user_id)
  WHERE assigned_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_jo_broadcast ON public.job_orders(broadcast_id)
  WHERE broadcast_id IS NOT NULL;

-- Update RLS: assigned_user can read their job_orders
DROP POLICY IF EXISTS job_orders_own ON public.job_orders;
CREATE POLICY job_orders_own ON public.job_orders
  FOR ALL USING (
    contractor_id = auth.uid()
    OR assigned_user_id = auth.uid()
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );


-- ============================================================
-- 5. GIN indexes for contractor matching performance
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_contractors_professions_gin
  ON public.contractors USING GIN (professions);
CREATE INDEX IF NOT EXISTS idx_contractors_zip_codes_gin
  ON public.contractors USING GIN (zip_codes);


-- ============================================================
-- 6. Fix reviews RLS — allow both parties to submit reviews
-- ============================================================
DROP POLICY IF EXISTS reviews_insert ON public.reviews;

CREATE POLICY reviews_insert ON public.reviews
  FOR INSERT WITH CHECK (
    reviewer_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM job_orders jo
      WHERE jo.id = job_order_id
        AND jo.status = 'completed'
        AND (jo.contractor_id = auth.uid() OR jo.assigned_user_id = auth.uid())
    )
  );


-- ============================================================
-- 7. Update submit_review to allow both parties
-- ============================================================
CREATE OR REPLACE FUNCTION public.submit_review(
  p_job_order_id UUID,
  p_reviewee_id UUID,
  p_overall SMALLINT,
  p_quality SMALLINT DEFAULT NULL,
  p_communication SMALLINT DEFAULT NULL,
  p_timeliness SMALLINT DEFAULT NULL,
  p_would_hire_again BOOLEAN DEFAULT NULL,
  p_review_text TEXT DEFAULT ''
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_reviewer_id UUID := auth.uid();
  v_job RECORD;
  v_review_id UUID;
BEGIN
  SELECT * INTO v_job FROM job_orders WHERE id = p_job_order_id;
  IF v_job IS NULL THEN RAISE EXCEPTION 'Job order not found'; END IF;
  IF v_job.status != 'completed' THEN RAISE EXCEPTION 'Job must be completed before reviewing'; END IF;

  IF v_job.contractor_id != v_reviewer_id
    AND COALESCE(v_job.assigned_user_id, '00000000-0000-0000-0000-000000000000'::uuid) != v_reviewer_id THEN
    RAISE EXCEPTION 'You are not part of this job order';
  END IF;

  IF v_job.updated_at < now() - INTERVAL '30 days' THEN
    RAISE EXCEPTION 'Review window has expired (30 days)';
  END IF;

  IF p_reviewee_id = v_reviewer_id THEN
    RAISE EXCEPTION 'Cannot review yourself';
  END IF;

  INSERT INTO reviews (
    job_order_id, reviewer_id, reviewee_id,
    overall, quality, communication, timeliness,
    would_hire_again, review_text
  ) VALUES (
    p_job_order_id, v_reviewer_id, p_reviewee_id,
    p_overall, p_quality, p_communication, p_timeliness,
    p_would_hire_again, p_review_text
  )
  RETURNING id INTO v_review_id;

  PERFORM award_network_points(v_reviewer_id, 'review_submitted', 50, jsonb_build_object(
    'review_id', v_review_id,
    'job_order_id', p_job_order_id
  ));

  RETURN v_review_id;
END;
$$;


-- ============================================================
-- 8. choose_contractor_for_broadcast — atomic assignment
-- ============================================================
CREATE OR REPLACE FUNCTION public.choose_contractor_for_broadcast(
  p_broadcast_id UUID,
  p_contractor_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_broadcast RECORD;
  v_job_order_id UUID;
  v_result JSONB;
BEGIN
  -- Lock and validate
  SELECT * INTO v_broadcast
  FROM job_broadcasts
  WHERE id = p_broadcast_id AND status = 'open'
  FOR UPDATE;

  IF v_broadcast IS NULL THEN
    RAISE EXCEPTION 'Broadcast is no longer open';
  END IF;

  IF v_broadcast.publisher_id != auth.uid() THEN
    RAISE EXCEPTION 'Only the publisher can choose a contractor';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM job_broadcast_responses
    WHERE broadcast_id = p_broadcast_id
      AND contractor_id = p_contractor_id
      AND status = 'interested'
  ) THEN
    RAISE EXCEPTION 'Contractor has not expressed interest';
  END IF;

  -- 1. Update broadcast
  UPDATE job_broadcasts
  SET status = 'assigned', updated_at = now()
  WHERE id = p_broadcast_id;

  -- 2. Mark chosen
  UPDATE job_broadcast_responses
  SET status = 'chosen'
  WHERE broadcast_id = p_broadcast_id AND contractor_id = p_contractor_id;

  -- 3. Close others
  UPDATE job_broadcast_responses
  SET status = 'closed'
  WHERE broadcast_id = p_broadcast_id
    AND contractor_id != p_contractor_id
    AND status = 'interested';

  -- 4. Create job_order
  INSERT INTO job_orders (
    lead_id, contractor_id, assigned_user_id, broadcast_id,
    deal_type, deal_value, status
  ) VALUES (
    v_broadcast.lead_id,
    v_broadcast.publisher_id,
    p_contractor_id,
    p_broadcast_id,
    v_broadcast.deal_type,
    v_broadcast.deal_value,
    'pending'
  )
  RETURNING id INTO v_job_order_id;

  -- 5. Build result
  SELECT jsonb_build_object(
    'job_order_id', v_job_order_id,
    'broadcast_id', p_broadcast_id,
    'publisher_id', v_broadcast.publisher_id,
    'chosen_contractor_id', p_contractor_id,
    'lead_id', v_broadcast.lead_id,
    'deal_type', v_broadcast.deal_type,
    'deal_value', v_broadcast.deal_value,
    'closed_contractor_ids', (
      SELECT COALESCE(jsonb_agg(contractor_id), '[]'::jsonb)
      FROM job_broadcast_responses
      WHERE broadcast_id = p_broadcast_id AND status = 'closed'
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.choose_contractor_for_broadcast(UUID, UUID) TO authenticated;


-- ============================================================
-- 9. respond_to_broadcast — contractor expresses interest
-- ============================================================
CREATE OR REPLACE FUNCTION public.respond_to_broadcast(p_broadcast_id UUID)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_broadcast RECORD;
  v_response_id UUID;
BEGIN
  SELECT * INTO v_broadcast FROM job_broadcasts WHERE id = p_broadcast_id;

  IF v_broadcast IS NULL THEN
    RAISE EXCEPTION 'Broadcast not found';
  END IF;
  IF v_broadcast.status != 'open' THEN
    RAISE EXCEPTION 'Broadcast is no longer accepting responses';
  END IF;
  IF v_broadcast.expires_at < now() THEN
    UPDATE job_broadcasts SET status = 'expired' WHERE id = p_broadcast_id;
    RAISE EXCEPTION 'Broadcast has expired';
  END IF;
  IF v_broadcast.publisher_id = auth.uid() THEN
    RAISE EXCEPTION 'Cannot respond to your own broadcast';
  END IF;

  INSERT INTO job_broadcast_responses (broadcast_id, contractor_id)
  VALUES (p_broadcast_id, auth.uid())
  ON CONFLICT (broadcast_id, contractor_id) DO NOTHING
  RETURNING id INTO v_response_id;

  RETURN v_response_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.respond_to_broadcast(UUID) TO authenticated;


-- ============================================================
-- 10. handle_invite_registration — auto-link on signup
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_invite_registration(p_phone TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_invite RECORD;
  v_result JSONB := '[]'::jsonb;
BEGIN
  FOR v_invite IN
    SELECT * FROM contractor_invites
    WHERE phone = p_phone AND status = 'pending'
  LOOP
    UPDATE contractor_invites
    SET status = 'registered', invited_user_id = v_user_id
    WHERE id = v_invite.id;

    PERFORM award_network_points(v_invite.inviter_id, 'invite_converted', 100, jsonb_build_object(
      'invite_id', v_invite.id,
      'invited_user_id', v_user_id
    ));

    v_result := v_result || jsonb_build_object(
      'invite_id', v_invite.id,
      'inviter_id', v_invite.inviter_id,
      'broadcast_id', v_invite.broadcast_id
    );
  END LOOP;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.handle_invite_registration(TEXT) TO authenticated;


-- ============================================================
-- 11. get_broadcast_responses — for publisher dashboard
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_broadcast_responses(p_broadcast_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM job_broadcasts
    WHERE id = p_broadcast_id
      AND (publisher_id = auth.uid() OR public.is_admin())
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(r ORDER BY r.created_at)
    FROM (
      SELECT
        jbr.id,
        jbr.contractor_id,
        jbr.status,
        jbr.created_at,
        p.full_name,
        cp.slug,
        cp.headline,
        cp.avg_rating,
        cp.review_count,
        cp.tier,
        cp.insurance_verified,
        cp.license_number,
        c.professions
      FROM job_broadcast_responses jbr
      JOIN profiles p ON p.id = jbr.contractor_id
      LEFT JOIN contractor_profiles cp ON cp.user_id = jbr.contractor_id
      LEFT JOIN contractors c ON c.user_id = jbr.contractor_id
      WHERE jbr.broadcast_id = p_broadcast_id
    ) r
  ), '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_broadcast_responses(UUID) TO authenticated;


-- ============================================================
-- 12. Update calculate_contractor_stats to count both sides
-- ============================================================
CREATE OR REPLACE FUNCTION public.calculate_contractor_stats(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'leads_contacted', COALESCE((SELECT count(*) FROM lead_contact_events WHERE user_id = p_user_id), 0),
    'successful_jobs', COALESCE((SELECT count(*) FROM lead_feedback WHERE user_id = p_user_id AND rating = 'got_job'), 0),
    'feedbacks_given', COALESCE((SELECT count(*) FROM lead_feedback WHERE user_id = p_user_id), 0),
    'groups_active', COALESCE((
      SELECT count(DISTINCT id)
      FROM contractor_group_links
      WHERE user_id = p_user_id AND status = 'joined'
    ), 0),
    'job_orders_total', COALESCE((
      SELECT count(*) FROM job_orders
      WHERE contractor_id = p_user_id OR assigned_user_id = p_user_id
    ), 0),
    'job_orders_completed', COALESCE((
      SELECT count(*) FROM job_orders
      WHERE (contractor_id = p_user_id OR assigned_user_id = p_user_id) AND status = 'completed'
    ), 0),
    'avg_response_mins', (
      SELECT ROUND(EXTRACT(EPOCH FROM avg(responded_at - created_at)) / 60)
      FROM job_orders
      WHERE (contractor_id = p_user_id OR assigned_user_id = p_user_id) AND responded_at IS NOT NULL
    ),
    'member_since', (SELECT created_at FROM profiles WHERE id = p_user_id),
    'network_points', COALESCE((SELECT network_points FROM profiles WHERE id = p_user_id), 0),
    'network_level', COALESCE((SELECT network_level FROM profiles WHERE id = p_user_id), 'member'),
    'available_today', COALESCE((SELECT available_today FROM contractors WHERE user_id = p_user_id), false)
  ) INTO result;

  RETURN result;
END;
$$;

COMMIT;
