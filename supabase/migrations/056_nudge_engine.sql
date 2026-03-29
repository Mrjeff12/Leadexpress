-- ============================================================
-- 056: Nudge Engine — tracking, RPCs, pg_cron
-- ============================================================

-- ─── 1. Add stats columns to prospects ───
ALTER TABLE prospects
  ADD COLUMN IF NOT EXISTS group_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS messages_scanned INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lead_count INTEGER DEFAULT 0;

-- ─── 2. Nudge log — track every nudge sent ───
CREATE TABLE IF NOT EXISTS nudge_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id UUID REFERENCES prospects(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  stage TEXT NOT NULL,
  sub_status TEXT,
  wave INTEGER NOT NULL,
  nudge_key TEXT NOT NULL,          -- e.g. 'onboarding.first_name.wave1'
  message_body TEXT NOT NULL,
  twilio_sid TEXT,                   -- Twilio message SID after send
  status TEXT DEFAULT 'pending',    -- pending, sent, delivered, read, failed
  created_at TIMESTAMPTZ DEFAULT now(),
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ
);

CREATE INDEX idx_nudge_log_phone ON nudge_log(phone);
CREATE INDEX idx_nudge_log_prospect ON nudge_log(prospect_id);
CREATE INDEX idx_nudge_log_stage ON nudge_log(stage, sub_status);
CREATE INDEX idx_nudge_log_created ON nudge_log(created_at DESC);

-- RLS: admin only
ALTER TABLE nudge_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin full access to nudge_log"
  ON nudge_log FOR ALL
  USING (auth.jwt() ->> 'role' = 'admin')
  WITH CHECK (auth.jwt() ->> 'role' = 'admin');

-- Service role bypass for edge functions
CREATE POLICY "Service role nudge_log"
  ON nudge_log FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ─── 3. RPC: Get stuck trial prospects ───
CREATE OR REPLACE FUNCTION get_stuck_trial()
RETURNS TABLE (
  phone TEXT,
  prospect_id UUID,
  display_name TEXT,
  sub_status TEXT,
  hours_in_status NUMERIC,
  nudges_sent BIGINT,
  group_count INTEGER,
  messages_scanned INTEGER,
  lead_count INTEGER
)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT
    p.phone,
    p.id AS prospect_id,
    p.display_name,
    p.sub_status,
    EXTRACT(EPOCH FROM (NOW() - p.sub_status_changed_at)) / 3600 AS hours_in_status,
    (SELECT COUNT(*) FROM nudge_log nl WHERE nl.prospect_id = p.id AND nl.stage = 'demo_trial') AS nudges_sent,
    p.group_count,
    p.messages_scanned,
    p.lead_count
  FROM prospects p
  WHERE p.stage = 'demo_trial'
    AND p.sub_status IN ('just_started', 'no_leads', 'inactive', 'expiring', 'wants_to_pay')
    AND p.sub_status_changed_at < NOW() - INTERVAL '5 hours'
  ORDER BY p.sub_status_changed_at ASC;
$$;

-- ─── 4. RPC: Get stuck trial_expired prospects ───
CREATE OR REPLACE FUNCTION get_stuck_trial_expired()
RETURNS TABLE (
  phone TEXT,
  prospect_id UUID,
  display_name TEXT,
  sub_status TEXT,
  days_expired NUMERIC,
  nudges_sent BIGINT,
  group_count INTEGER,
  messages_scanned INTEGER,
  lead_count INTEGER
)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT
    p.phone,
    p.id AS prospect_id,
    p.display_name,
    p.sub_status,
    EXTRACT(EPOCH FROM (NOW() - p.sub_status_changed_at)) / 86400 AS days_expired,
    (SELECT COUNT(*) FROM nudge_log nl WHERE nl.prospect_id = p.id AND nl.stage = 'trial_expired') AS nudges_sent,
    p.group_count,
    p.messages_scanned,
    p.lead_count
  FROM prospects p
  WHERE p.stage = 'trial_expired'
    AND p.sub_status IN ('had_leads', 'no_leads', 'was_active', 'barely_used', 'never_used', 'payment_failed', 'got_offer')
    AND p.sub_status NOT IN ('declined')
  ORDER BY p.sub_status_changed_at ASC;
$$;

-- ─── 5. RPC: Get stuck paying prospects (no leads / payment issues) ───
CREATE OR REPLACE FUNCTION get_stuck_paying()
RETURNS TABLE (
  phone TEXT,
  prospect_id UUID,
  display_name TEXT,
  sub_status TEXT,
  days_in_status NUMERIC,
  nudges_sent BIGINT,
  group_count INTEGER,
  messages_scanned INTEGER,
  lead_count INTEGER
)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT
    p.phone,
    p.id AS prospect_id,
    p.display_name,
    p.sub_status,
    EXTRACT(EPOCH FROM (NOW() - p.sub_status_changed_at)) / 86400 AS days_in_status,
    (SELECT COUNT(*) FROM nudge_log nl WHERE nl.prospect_id = p.id AND nl.stage = 'paying') AS nudges_sent,
    p.group_count,
    p.messages_scanned,
    p.lead_count
  FROM prospects p
  WHERE p.stage = 'paying'
    AND p.sub_status IN ('no_leads_week', 'low_leads', 'payment_failing', 'support_issue')
  ORDER BY p.sub_status_changed_at ASC;
$$;

-- ─── 6. RPC: Get stuck churned prospects ───
CREATE OR REPLACE FUNCTION get_stuck_churned()
RETURNS TABLE (
  phone TEXT,
  prospect_id UUID,
  display_name TEXT,
  sub_status TEXT,
  days_churned NUMERIC,
  nudges_sent BIGINT,
  group_count INTEGER,
  messages_scanned INTEGER,
  lead_count INTEGER
)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT
    p.phone,
    p.id AS prospect_id,
    p.display_name,
    p.sub_status,
    EXTRACT(EPOCH FROM (NOW() - p.sub_status_changed_at)) / 86400 AS days_churned,
    (SELECT COUNT(*) FROM nudge_log nl WHERE nl.prospect_id = p.id AND nl.stage = 'churned') AS nudges_sent,
    p.group_count,
    p.messages_scanned,
    p.lead_count
  FROM prospects p
  WHERE p.stage = 'churned'
    AND p.sub_status IN ('recent', 'payment_failed', 'no_value', 'seasonal')
    AND p.sub_status NOT IN ('old', 'competitor', 'closed')
  ORDER BY p.sub_status_changed_at ASC;
$$;

-- ─── 7. RPC: Nudge analytics summary ───
CREATE OR REPLACE FUNCTION get_nudge_analytics(p_days INTEGER DEFAULT 7)
RETURNS TABLE (
  stage TEXT,
  sub_status TEXT,
  wave INTEGER,
  total_sent BIGINT,
  total_delivered BIGINT,
  total_read BIGINT,
  avg_hours_to_read NUMERIC
)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT
    nl.stage,
    nl.sub_status,
    nl.wave,
    COUNT(*) AS total_sent,
    COUNT(*) FILTER (WHERE nl.status IN ('delivered', 'read')) AS total_delivered,
    COUNT(*) FILTER (WHERE nl.status = 'read') AS total_read,
    AVG(EXTRACT(EPOCH FROM (nl.read_at - nl.created_at)) / 3600)
      FILTER (WHERE nl.read_at IS NOT NULL) AS avg_hours_to_read
  FROM nudge_log nl
  WHERE nl.created_at > NOW() - (p_days || ' days')::interval
  GROUP BY nl.stage, nl.sub_status, nl.wave
  ORDER BY nl.stage, nl.sub_status, nl.wave;
$$;

-- ─── 8. Helper: Record a nudge send ───
CREATE OR REPLACE FUNCTION log_nudge(
  p_prospect_id UUID,
  p_phone TEXT,
  p_stage TEXT,
  p_sub_status TEXT,
  p_wave INTEGER,
  p_nudge_key TEXT,
  p_message_body TEXT,
  p_twilio_sid TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
AS $$
  INSERT INTO nudge_log (prospect_id, phone, stage, sub_status, wave, nudge_key, message_body, twilio_sid, status)
  VALUES (p_prospect_id, p_phone, p_stage, p_sub_status, p_wave, p_nudge_key, p_message_body, p_twilio_sid,
    CASE WHEN p_twilio_sid IS NOT NULL THEN 'sent' ELSE 'pending' END)
  RETURNING id;
$$;

-- ─── 9. pg_cron setup (ALL DISABLED — enable when ready) ───
-- Uncomment to enable:
-- CREATE EXTENSION IF NOT EXISTS pg_cron;
--
-- -- Onboarding nudges — every 15 minutes
-- SELECT cron.schedule('nudge-onboarding', '*/15 * * * *',
--   $$SELECT net.http_post(
--     url := current_setting('app.settings.supabase_url') || '/functions/v1/process-nudges',
--     headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')),
--     body := '{"stage": "onboarding"}'::jsonb
--   );$$
-- );
--
-- -- Trial nudges — every hour
-- SELECT cron.schedule('nudge-trial', '17 * * * *',
--   $$SELECT net.http_post(
--     url := current_setting('app.settings.supabase_url') || '/functions/v1/process-nudges',
--     headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')),
--     body := '{"stage": "demo_trial"}'::jsonb
--   );$$
-- );
--
-- -- Trial expired + churned — every 6 hours
-- SELECT cron.schedule('nudge-winback', '23 */6 * * *',
--   $$SELECT net.http_post(
--     url := current_setting('app.settings.supabase_url') || '/functions/v1/process-nudges',
--     headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')),
--     body := '{"stage": "trial_expired,churned"}'::jsonb
--   );$$
-- );
--
-- -- Paying customer check — daily at 9am
-- SELECT cron.schedule('nudge-paying', '3 9 * * *',
--   $$SELECT net.http_post(
--     url := current_setting('app.settings.supabase_url') || '/functions/v1/process-nudges',
--     headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')),
--     body := '{"stage": "paying"}'::jsonb
--   );$$
-- );
