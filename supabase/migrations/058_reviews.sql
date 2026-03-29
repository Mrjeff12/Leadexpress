-- ============================================================
-- 058: Reviews — mutual contractor-to-contractor rating system
-- ============================================================
BEGIN;

-- 1. Reviews table
CREATE TABLE public.reviews (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_order_id     UUID NOT NULL REFERENCES public.job_orders(id) ON DELETE CASCADE,
  reviewer_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reviewee_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- Star ratings (1-5)
  overall          SMALLINT NOT NULL CHECK (overall BETWEEN 1 AND 5),
  quality          SMALLINT CHECK (quality BETWEEN 1 AND 5),
  communication    SMALLINT CHECK (communication BETWEEN 1 AND 5),
  timeliness       SMALLINT CHECK (timeliness BETWEEN 1 AND 5),
  would_hire_again BOOLEAN,

  -- Review text
  review_text      TEXT NOT NULL CHECK (length(review_text) >= 20),

  -- Response from reviewee
  response_text    TEXT,
  responded_at     TIMESTAMPTZ,

  -- Visibility: hidden until both sides submit or 14 days pass
  is_visible       BOOLEAN NOT NULL DEFAULT false,

  -- Moderation
  is_flagged       BOOLEAN NOT NULL DEFAULT false,
  flag_reason      TEXT,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Anti-fraud: one review per job per reviewer
  UNIQUE(job_order_id, reviewer_id)
);

CREATE INDEX idx_reviews_reviewee ON public.reviews(reviewee_id, is_visible, created_at DESC);
CREATE INDEX idx_reviews_reviewer ON public.reviews(reviewer_id, created_at DESC);
CREATE INDEX idx_reviews_job ON public.reviews(job_order_id);
CREATE INDEX idx_reviews_pending ON public.reviews(is_visible, created_at) WHERE is_visible = false;

-- Updated-at trigger
CREATE TRIGGER set_reviews_updated_at
  BEFORE UPDATE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- Read: visible reviews are public; own reviews always visible; admin sees all
CREATE POLICY reviews_read ON public.reviews
  FOR SELECT USING (
    is_visible = true
    OR reviewer_id = auth.uid()
    OR reviewee_id = auth.uid()
    OR public.is_admin()
  );

-- Insert: only authenticated users for jobs they're part of
CREATE POLICY reviews_insert ON public.reviews
  FOR INSERT WITH CHECK (
    reviewer_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM job_orders jo
      WHERE jo.id = job_order_id
        AND jo.status = 'completed'
        AND (jo.contractor_id = auth.uid())
    )
  );

-- Update: reviewee can add response; reviewer can edit within 48h; admin
CREATE POLICY reviews_update ON public.reviews
  FOR UPDATE USING (
    (reviewee_id = auth.uid() AND response_text IS NULL)
    OR (reviewer_id = auth.uid() AND created_at > now() - INTERVAL '48 hours')
    OR public.is_admin()
  );


-- ============================================================
-- 2. Review Disputes
-- ============================================================
CREATE TABLE public.review_disputes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id   UUID NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
  reporter_id UUID NOT NULL REFERENCES public.profiles(id),
  reason      TEXT NOT NULL CHECK (reason IN ('fake', 'offensive', 'wrong_person', 'spam', 'other')),
  description TEXT,
  status      TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'investigating', 'upheld', 'dismissed')),
  resolved_by UUID REFERENCES public.profiles(id),
  resolved_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(review_id, reporter_id)
);

ALTER TABLE public.review_disputes ENABLE ROW LEVEL SECURITY;

CREATE POLICY rd_own ON public.review_disputes
  FOR ALL USING (reporter_id = auth.uid() OR public.is_admin());


-- ============================================================
-- 3. Trigger: auto-reveal reviews when both sides submit
-- ============================================================
CREATE OR REPLACE FUNCTION public.auto_reveal_reviews()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- If both sides have reviewed this job order, reveal both
  IF (SELECT count(*) FROM reviews WHERE job_order_id = NEW.job_order_id) >= 2 THEN
    UPDATE reviews
    SET is_visible = true, updated_at = now()
    WHERE job_order_id = NEW.job_order_id AND is_visible = false;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_reveal_reviews
  AFTER INSERT ON public.reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_reveal_reviews();


-- ============================================================
-- 4. Trigger: update contractor rating when review becomes visible
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_contractor_rating()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.is_visible = true AND (OLD IS NULL OR OLD.is_visible = false) THEN
    UPDATE contractor_profiles
    SET
      avg_rating = COALESCE((
        SELECT ROUND(AVG(overall)::numeric, 2)
        FROM reviews
        WHERE reviewee_id = NEW.reviewee_id AND is_visible = true
      ), 0),
      review_count = COALESCE((
        SELECT count(*)
        FROM reviews
        WHERE reviewee_id = NEW.reviewee_id AND is_visible = true
      ), 0),
      updated_at = now()
    WHERE user_id = NEW.reviewee_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_update_contractor_rating
  AFTER INSERT OR UPDATE OF is_visible ON public.reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.update_contractor_rating();


-- ============================================================
-- 5. RPC: submit_review (with validation)
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
  -- Validate job exists and is completed
  SELECT * INTO v_job FROM job_orders WHERE id = p_job_order_id;
  IF v_job IS NULL THEN RAISE EXCEPTION 'Job order not found'; END IF;
  IF v_job.status != 'completed' THEN RAISE EXCEPTION 'Job must be completed before reviewing'; END IF;

  -- Validate reviewer is part of the job
  IF v_job.contractor_id != v_reviewer_id THEN
    RAISE EXCEPTION 'You are not part of this job order';
  END IF;

  -- Validate time window (30 days)
  IF v_job.updated_at < now() - INTERVAL '30 days' THEN
    RAISE EXCEPTION 'Review window has expired (30 days)';
  END IF;

  -- Validate reviewee is the other party
  IF p_reviewee_id = v_reviewer_id THEN
    RAISE EXCEPTION 'Cannot review yourself';
  END IF;

  -- Insert review
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

  -- Award network points for reviewing
  PERFORM award_network_points(v_reviewer_id, 'review_submitted', 50, jsonb_build_object(
    'review_id', v_review_id,
    'job_order_id', p_job_order_id
  ));

  RETURN v_review_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_review(UUID, UUID, SMALLINT, SMALLINT, SMALLINT, SMALLINT, BOOLEAN, TEXT) TO authenticated;


-- ============================================================
-- 6. RPC: get_reviews_for_user (public)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_reviews_for_user(p_user_id UUID, p_limit INTEGER DEFAULT 20)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN COALESCE((
    SELECT jsonb_agg(row_to_json(r))
    FROM (
      SELECT
        rv.id, rv.overall, rv.quality, rv.communication, rv.timeliness,
        rv.would_hire_again, rv.review_text, rv.response_text, rv.responded_at,
        rv.created_at,
        p.full_name AS reviewer_name
      FROM reviews rv
      JOIN profiles p ON p.id = rv.reviewer_id
      WHERE rv.reviewee_id = p_user_id
        AND rv.is_visible = true
        AND rv.is_flagged = false
      ORDER BY rv.created_at DESC
      LIMIT p_limit
    ) r
  ), '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_reviews_for_user(UUID, INTEGER) TO anon, authenticated;

COMMIT;
