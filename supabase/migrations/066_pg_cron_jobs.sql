-- 066: pg_cron automation — available_today reset + wa_onboard_state TTL cleanup

-- Requires pg_cron extension (already enabled on Supabase Pro/Team)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Job 1: Reset available_today at 04:00 UTC daily (= midnight ET = 06:00 IL)
SELECT cron.schedule(
  'reset-available-today',
  '0 4 * * *',
  $$UPDATE public.profiles SET available_today = false WHERE available_today = true$$
);

-- Job 2: Delete stale wa_onboard_state rows every hour (2h TTL)
SELECT cron.schedule(
  'clean-wa-onboard-state',
  '0 * * * *',
  $$DELETE FROM public.wa_onboard_state WHERE updated_at < NOW() - INTERVAL '2 hours'$$
);
