-- 082: Notification cascade — multi-tier fallback system
-- Expand channel options, per-channel dedup, reconnect throttle

-- 1. Expand channel constraint to include template WA and SMS
ALTER TABLE lead_notifications DROP CONSTRAINT IF EXISTS lead_notifications_channel_check;
ALTER TABLE lead_notifications ADD CONSTRAINT lead_notifications_channel_check
  CHECK (channel IN ('whatsapp', 'whatsapp_template', 'telegram', 'push', 'sms'));

-- 2. Replace UNIQUE(lead_id, contractor_id) with per-channel uniqueness
ALTER TABLE lead_notifications DROP CONSTRAINT IF EXISTS lead_notifications_lead_id_contractor_id_key;
ALTER TABLE lead_notifications ADD CONSTRAINT lead_notifications_lead_contractor_channel_key
  UNIQUE (lead_id, contractor_id, channel);

-- 3. Add cascade_position to track which tier delivered
ALTER TABLE lead_notifications ADD COLUMN IF NOT EXISTS cascade_position smallint;

-- 4. Reconnect throttle table
CREATE TABLE IF NOT EXISTS public.reconnect_throttle (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id   uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  channel         text NOT NULL CHECK (channel IN ('whatsapp_template', 'push', 'sms')),
  sent_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE(contractor_id, channel)
);

ALTER TABLE public.reconnect_throttle ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_only" ON public.reconnect_throttle
  USING (auth.role() = 'service_role');
CREATE INDEX idx_reconnect_throttle_lookup
  ON reconnect_throttle(contractor_id, channel, sent_at);

-- 5. SMS opt-out flag
ALTER TABLE contractors ADD COLUMN IF NOT EXISTS sms_opt_out boolean DEFAULT false;

-- 6. Update window-reminder cron to every 5 min
SELECT cron.unschedule('window-reminder');
SELECT cron.schedule(
  'window-reminder',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://zyytzwlvtuhgbjpalbgd.supabase.co/functions/v1/send-window-reminder',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp5eXR6d2x2dHVoZ2JqcGFsYmdkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzYyNTM2MiwiZXhwIjoyMDg5MjAxMzYyfQ.E_PyB-keVdYCXT1-_d3XA6nwShmBYumbg04-r_D9Mao"}'::jsonb
  );
  $$
);
