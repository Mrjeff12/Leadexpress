-- ============================================================
-- 059: Trust Tiers & Portfolio — tier evaluation + portfolio showcase
-- ============================================================
BEGIN;

-- ============================================================
-- 1. tier_history — track tier promotions / demotions
-- ============================================================
CREATE TABLE public.tier_history (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  old_tier      TEXT NOT NULL,
  new_tier      TEXT NOT NULL,
  reason        TEXT,
  evaluated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tier_history_user ON public.tier_history(user_id, evaluated_at DESC);

ALTER TABLE public.tier_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY th_own_read ON public.tier_history
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY th_admin ON public.tier_history
  FOR ALL USING (public.is_admin());


-- ============================================================
-- 2. portfolio_items — contractor work showcase
-- ============================================================
CREATE TABLE public.portfolio_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  job_order_id    UUID REFERENCES public.job_orders(id) ON DELETE SET NULL,
  title           TEXT NOT NULL,
  description     TEXT,
  category        TEXT,
  image_url       TEXT NOT NULL,
  before_url      TEXT,
  display_order   SMALLINT NOT NULL DEFAULT 0,
  is_featured     BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_portfolio_user ON public.portfolio_items(user_id, display_order);

ALTER TABLE public.portfolio_items ENABLE ROW LEVEL SECURITY;

-- Users can CRUD their own items
CREATE POLICY pi_own ON public.portfolio_items
  FOR ALL USING (user_id = auth.uid());

-- Everyone can read all portfolio items (public showcase)
CREATE POLICY pi_public_read ON public.portfolio_items
  FOR SELECT USING (true);

-- Admin can do anything
CREATE POLICY pi_admin ON public.portfolio_items
  FOR ALL USING (public.is_admin());


-- ============================================================
-- 3. evaluate_tiers() — batch tier evaluation function
-- ============================================================
CREATE OR REPLACE FUNCTION public.evaluate_tiers()
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_rec           RECORD;
  v_new_tier      TEXT;
  v_completed     INTEGER;
  v_avg_rating    NUMERIC;
  v_response_rate NUMERIC;
  v_tenure_days   INTEGER;
  v_review_count  INTEGER;
  v_total_orders  INTEGER;
  v_responded     INTEGER;
  v_changed       INTEGER := 0;
  v_reason        TEXT;
  v_points        INTEGER;
BEGIN
  FOR v_rec IN
    SELECT cp.user_id, cp.tier AS current_tier
    FROM contractor_profiles cp
  LOOP
    -- Completed jobs
    SELECT count(*) INTO v_completed
    FROM job_orders
    WHERE contractor_id = v_rec.user_id AND status = 'completed';

    -- Average rating from visible reviews
    SELECT COALESCE(AVG(overall), 0), count(*)
    INTO v_avg_rating, v_review_count
    FROM reviews
    WHERE reviewee_id = v_rec.user_id AND is_visible = true;

    -- Response rate: orders with responded_at / total orders
    SELECT count(*) INTO v_total_orders
    FROM job_orders
    WHERE contractor_id = v_rec.user_id;

    SELECT count(*) INTO v_responded
    FROM job_orders
    WHERE contractor_id = v_rec.user_id AND responded_at IS NOT NULL;

    IF v_total_orders > 0 THEN
      v_response_rate := (v_responded::numeric / v_total_orders::numeric) * 100;
    ELSE
      v_response_rate := 0;
    END IF;

    -- Tenure in days
    SELECT EXTRACT(DAY FROM now() - p.created_at)::integer
    INTO v_tenure_days
    FROM profiles p
    WHERE p.id = v_rec.user_id;

    -- Determine tier
    v_new_tier := 'new';

    IF v_completed >= 1 AND v_tenure_days >= 7 THEN
      v_new_tier := 'verified';
    END IF;

    IF v_completed >= 5
       AND v_avg_rating >= 4.0
       AND v_response_rate >= 70
       AND v_tenure_days >= 30 THEN
      v_new_tier := 'trusted';
    END IF;

    IF v_completed >= 20
       AND v_avg_rating >= 4.5
       AND v_response_rate >= 85
       AND v_tenure_days >= 90
       AND v_review_count >= 10 THEN
      v_new_tier := 'elite';
    END IF;

    -- If tier changed, record it
    IF v_new_tier != v_rec.current_tier THEN
      v_reason := format(
        'jobs=%s rating=%s response=%s%% tenure=%sd reviews=%s',
        v_completed, ROUND(v_avg_rating, 2), ROUND(v_response_rate, 1),
        v_tenure_days, v_review_count
      );

      -- Insert history
      INSERT INTO tier_history (user_id, old_tier, new_tier, reason)
      VALUES (v_rec.user_id, v_rec.current_tier, v_new_tier, v_reason);

      -- Update contractor profile
      UPDATE contractor_profiles
      SET tier = v_new_tier, updated_at = now()
      WHERE user_id = v_rec.user_id;

      -- Award network points for promotion
      IF v_new_tier = 'verified' THEN v_points := 100;
      ELSIF v_new_tier = 'trusted' THEN v_points := 250;
      ELSIF v_new_tier = 'elite' THEN v_points := 500;
      ELSE v_points := 0;
      END IF;

      IF v_points > 0 THEN
        PERFORM award_network_points(
          v_rec.user_id,
          'tier_promotion',
          v_points,
          jsonb_build_object(
            'old_tier', v_rec.current_tier,
            'new_tier', v_new_tier
          )
        );
      END IF;

      v_changed := v_changed + 1;
    END IF;
  END LOOP;

  RETURN v_changed;
END;
$$;

GRANT EXECUTE ON FUNCTION public.evaluate_tiers() TO authenticated;

COMMIT;
