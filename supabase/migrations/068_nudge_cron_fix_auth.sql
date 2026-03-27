-- 068: Re-schedule nudge cron jobs with hardcoded bearer token
-- Replaces 067 jobs that used current_setting('app.service_role_key') which requires
-- ALTER DATABASE superuser privilege not available via MCP/migrations.
-- The service_role JWT is not a secret that can be rotated independently — it's tied to the project key.

CREATE EXTENSION IF NOT EXISTS pg_net;

-- Onboarding nudges: every 15 min
SELECT cron.unschedule('nudge-onboarding') FROM cron.job WHERE jobname = 'nudge-onboarding';
SELECT cron.schedule(
  'nudge-onboarding',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://zyytzwlvtuhgbjpalbgd.supabase.co/functions/v1/process-nudges',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp5eXR6d2x2dHVoZ2JqcGFsYmdkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzYyNTM2MiwiZXhwIjoyMDg5MjAxMzYyfQ.E_PyB-keVdYCXT1-_d3XA6nwShmBYumbg04-r_D9Mao"}'::jsonb,
    body := '{"stage":"onboarding"}'::jsonb
  );
  $$
);

-- Trial nudges: hourly at :17
SELECT cron.unschedule('nudge-trial') FROM cron.job WHERE jobname = 'nudge-trial';
SELECT cron.schedule(
  'nudge-trial',
  '17 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://zyytzwlvtuhgbjpalbgd.supabase.co/functions/v1/process-nudges',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp5eXR6d2x2dHVoZ2JqcGFsYmdkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzYyNTM2MiwiZXhwIjoyMDg5MjAxMzYyfQ.E_PyB-keVdYCXT1-_d3XA6nwShmBYumbg04-r_D9Mao"}'::jsonb,
    body := '{"stage":"trial"}'::jsonb
  );
  $$
);

-- Win-back nudges: every 6h at :23
SELECT cron.unschedule('nudge-winback') FROM cron.job WHERE jobname = 'nudge-winback';
SELECT cron.schedule(
  'nudge-winback',
  '23 */6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://zyytzwlvtuhgbjpalbgd.supabase.co/functions/v1/process-nudges',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp5eXR6d2x2dHVoZ2JqcGFsYmdkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzYyNTM2MiwiZXhwIjoyMDg5MjAxMzYyfQ.E_PyB-keVdYCXT1-_d3XA6nwShmBYumbg04-r_D9Mao"}'::jsonb,
    body := '{"stage":"win_back"}'::jsonb
  );
  $$
);

-- Paying user nudges: daily at 09:03 UTC
SELECT cron.unschedule('nudge-paying') FROM cron.job WHERE jobname = 'nudge-paying';
SELECT cron.schedule(
  'nudge-paying',
  '3 9 * * *',
  $$
  SELECT net.http_post(
    url := 'https://zyytzwlvtuhgbjpalbgd.supabase.co/functions/v1/process-nudges',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp5eXR6d2x2dHVoZ2JqcGFsYmdkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzYyNTM2MiwiZXhwIjoyMDg5MjAxMzYyfQ.E_PyB-keVdYCXT1-_d3XA6nwShmBYumbg04-r_D9Mao"}'::jsonb,
    body := '{"stage":"paying"}'::jsonb
  );
  $$
);
