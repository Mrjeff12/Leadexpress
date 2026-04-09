-- ============================================================
-- 103: evaluate_publisher_tiers() + cron
-- Auto-promotes publishers: new → verified → established → premium
-- based on jobs published, ratings, and tenure.
-- ============================================================

CREATE OR REPLACE FUNCTION public.evaluate_publisher_tiers()
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_rec           RECORD;
  v_new_tier      TEXT;
  v_published     INTEGER;
  v_completed     INTEGER;
  v_avg_rating    NUMERIC;
  v_review_count  INTEGER;
  v_tenure_days   INTEGER;
  v_changed       INTEGER := 0;
  v_reason        TEXT;
BEGIN
  FOR v_rec IN
    SELECT pp.user_id, pp.tier AS current_tier
    FROM publisher_profiles pp
  LOOP
    -- Jobs published (broadcasts created)
    SELECT count(*) INTO v_published
    FROM job_broadcasts
    WHERE publisher_id = v_rec.user_id;

    -- Jobs completed (assigned broadcasts)
    SELECT count(*) INTO v_completed
    FROM job_broadcasts
    WHERE publisher_id = v_rec.user_id AND status = 'assigned';

    -- Average rating from visible reviews
    SELECT COALESCE(AVG(overall), 0), count(*)
    INTO v_avg_rating, v_review_count
    FROM reviews
    WHERE reviewee_id = v_rec.user_id AND is_visible = true;

    -- Tenure in days
    SELECT EXTRACT(DAY FROM now() - p.created_at)::integer
    INTO v_tenure_days
    FROM profiles p
    WHERE p.id = v_rec.user_id;

    -- Determine tier (never downgrade from 'verified' if identity-verified)
    v_new_tier := v_rec.current_tier;

    -- new → verified: requires Stripe Identity (handled by webhook, not here)
    -- So we skip 'new' → 'verified' promotion in this function.

    -- verified → established
    IF v_rec.current_tier IN ('verified')
       AND v_completed >= 5
       AND v_avg_rating >= 4.0
       AND v_tenure_days >= 30 THEN
      v_new_tier := 'established';
    END IF;

    -- established → premium
    IF v_rec.current_tier IN ('verified', 'established')
       AND v_completed >= 20
       AND v_avg_rating >= 4.5
       AND v_review_count >= 10
       AND v_tenure_days >= 90 THEN
      v_new_tier := 'premium';
    END IF;

    -- If tier changed, record it
    IF v_new_tier != v_rec.current_tier THEN
      v_reason := format(
        'published=%s completed=%s rating=%s tenure=%sd reviews=%s',
        v_published, v_completed, ROUND(v_avg_rating, 2),
        v_tenure_days, v_review_count
      );

      INSERT INTO tier_history (user_id, old_tier, new_tier, reason)
      VALUES (v_rec.user_id, v_rec.current_tier, v_new_tier, v_reason);

      UPDATE publisher_profiles
      SET tier = v_new_tier,
          jobs_published = v_published,
          jobs_completed = v_completed,
          avg_rating = v_avg_rating,
          review_count = v_review_count,
          updated_at = now()
      WHERE user_id = v_rec.user_id;

      v_changed := v_changed + 1;
    END IF;
  END LOOP;

  RETURN v_changed;
END;
$$;

GRANT EXECUTE ON FUNCTION public.evaluate_publisher_tiers() TO authenticated;

-- Schedule daily at 2:15am UTC (15 min after contractor tiers)
SELECT cron.schedule(
  'evaluate-publisher-tiers',
  '15 2 * * *',
  $$SELECT public.evaluate_publisher_tiers()$$
);
