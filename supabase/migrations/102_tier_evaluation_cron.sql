-- ============================================================
-- 102: Schedule tier evaluation cron job
-- Runs evaluate_tiers() daily at 2am UTC to auto-promote
-- contractors from verified → trusted → elite based on
-- performance metrics (completed jobs, rating, reviews).
-- ============================================================

SELECT cron.schedule(
  'evaluate-tiers',
  '0 2 * * *',
  $$SELECT public.evaluate_tiers()$$
);
