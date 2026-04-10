-- ============================================================
-- 107: Auto-expire stale leads (72h TTL)
-- Runs every 6 hours via pg_cron.
-- ============================================================

SELECT cron.schedule(
  'expire-stale-leads',
  '0 */6 * * *',
  $$UPDATE public.leads
    SET status = 'expired'
    WHERE status IN ('new', 'parsed', 'sent')
      AND created_at < now() - interval '72 hours';$$
);
