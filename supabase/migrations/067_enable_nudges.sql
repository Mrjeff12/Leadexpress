-- 067: Enable nudge engine cron jobs (was disabled in 056)
-- Service role key is read from DB setting app.service_role_key (set separately via SQL editor, not committed to git)

CREATE EXTENSION IF NOT EXISTS pg_net;

-- Onboarding nudges: every 15 min
SELECT cron.unschedule('nudge-onboarding') FROM cron.job WHERE jobname = 'nudge-onboarding';
SELECT cron.schedule(
  'nudge-onboarding',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://zyytzwlvtuhgbjpalbgd.supabase.co/functions/v1/process-nudges',
    headers := json_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
    )::jsonb,
    body := '{"stage": "onboarding"}'::jsonb
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
    headers := json_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
    )::jsonb,
    body := '{"stage": "trial"}'::jsonb
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
    headers := json_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
    )::jsonb,
    body := '{"stage": "win_back"}'::jsonb
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
    headers := json_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
    )::jsonb,
    body := '{"stage": "paying"}'::jsonb
  );
  $$
);
