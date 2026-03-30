-- 079: Fix nudge cron stage name mismatches
-- Migration 068 sends wrong stage names:
--   nudge-trial    sends "trial"    but process-nudges expects "demo_trial"
--   nudge-winback  sends "win_back" but process-nudges expects "churned"
-- Also adds missing trial_expired cron job.

-- Fix nudge-trial: "trial" → "demo_trial"
SELECT cron.unschedule('nudge-trial') FROM cron.job WHERE jobname = 'nudge-trial';
SELECT cron.schedule(
  'nudge-trial',
  '17 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://zyytzwlvtuhgbjpalbgd.supabase.co/functions/v1/process-nudges',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp5eXR6d2x2dHVoZ2JqcGFsYmdkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzYyNTM2MiwiZXhwIjoyMDg5MjAxMzYyfQ.E_PyB-keVdYCXT1-_d3XA6nwShmBYumbg04-r_D9Mao"}'::jsonb,
    body := '{"stage":"demo_trial"}'::jsonb
  );
  $$
);

-- Fix nudge-winback: "win_back" → "churned"
SELECT cron.unschedule('nudge-winback') FROM cron.job WHERE jobname = 'nudge-winback';
SELECT cron.schedule(
  'nudge-winback',
  '23 */6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://zyytzwlvtuhgbjpalbgd.supabase.co/functions/v1/process-nudges',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp5eXR6d2x2dHVoZ2JqcGFsYmdkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzYyNTM2MiwiZXhwIjoyMDg5MjAxMzYyfQ.E_PyB-keVdYCXT1-_d3XA6nwShmBYumbg04-r_D9Mao"}'::jsonb,
    body := '{"stage":"churned"}'::jsonb
  );
  $$
);

-- Add missing trial_expired cron job: every 6h at :37
SELECT cron.schedule(
  'nudge-trial-expired',
  '37 */6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://zyytzwlvtuhgbjpalbgd.supabase.co/functions/v1/process-nudges',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp5eXR6d2x2dHVoZ2JqcGFsYmdkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzYyNTM2MiwiZXhwIjoyMDg5MjAxMzYyfQ.E_PyB-keVdYCXT1-_d3XA6nwShmBYumbg04-r_D9Mao"}'::jsonb,
    body := '{"stage":"trial_expired"}'::jsonb
  );
  $$
);
