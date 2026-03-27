-- 067: Enable nudge engine cron jobs (was disabled in 056)
-- Service role key is read from DB setting app.service_role_key (set separately via SQL editor, not committed to git)

-- Onboarding nudges: every 15 min
SELECT cron.schedule(
  'nudge-onboarding',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://zyytzwlvtuhgbjpalbgd.supabase.co/functions/v1/process-nudges',
    headers := json_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    )::jsonb,
    body := '{"stage": "onboarding"}'::jsonb
  );
  $$
);

-- Trial nudges: hourly at :17
SELECT cron.schedule(
  'nudge-trial',
  '17 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://zyytzwlvtuhgbjpalbgd.supabase.co/functions/v1/process-nudges',
    headers := json_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    )::jsonb,
    body := '{"stage": "trial"}'::jsonb
  );
  $$
);

-- Win-back nudges: every 6h at :23
SELECT cron.schedule(
  'nudge-winback',
  '23 */6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://zyytzwlvtuhgbjpalbgd.supabase.co/functions/v1/process-nudges',
    headers := json_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    )::jsonb,
    body := '{"stage": "win_back"}'::jsonb
  );
  $$
);

-- Paying user nudges: daily at 09:03 UTC
SELECT cron.schedule(
  'nudge-paying',
  '3 9 * * *',
  $$
  SELECT net.http_post(
    url := 'https://zyytzwlvtuhgbjpalbgd.supabase.co/functions/v1/process-nudges',
    headers := json_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    )::jsonb,
    body := '{"stage": "paying"}'::jsonb
  );
  $$
);
