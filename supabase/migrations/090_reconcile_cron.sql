-- ============================================================================
-- Migration 090: Cron job for payout reconciliation (every 6 hours)
-- ============================================================================

SELECT cron.schedule('reconcile-payouts', '0 */6 * * *', $$
  SELECT net.http_post(
    url := 'https://zyytzwlvtuhgbjpalbgd.supabase.co/functions/v1/reconcile-payouts',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp5eXR6d2x2dHVoZ2JqcGFsYmdkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzYyNTM2MiwiZXhwIjoyMDg5MjAxMzYyfQ.E_PyB-keVdYCXT1-_d3XA6nwShmBYumbg04-r_D9Mao"}'::jsonb,
    body := '{}'::jsonb
  );
$$);
