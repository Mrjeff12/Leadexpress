-- ============================================================================
-- Migration 088: Complete group automation pipeline
-- ============================================================================
-- Activates member sync, prospect scoring, enrichment, and auto-import.
-- Adds reply tracking, lead attribution, and group health analytics.
-- ============================================================================

-- ════════════════════════════════════════════════════════════════════════════
-- 1. NEW CRON JOBS
-- ════════════════════════════════════════════════════════════════════════════

-- Sync group members every 2 hours
SELECT cron.schedule('sync-group-members', '17 */2 * * *', $$
  SELECT net.http_post(
    url := 'https://zyytzwlvtuhgbjpalbgd.supabase.co/functions/v1/sync-group-members',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp5eXR6d2x2dHVoZ2JqcGFsYmdkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzYyNTM2MiwiZXhwIjoyMDg5MjAxMzYyfQ.E_PyB-keVdYCXT1-_d3XA6nwShmBYumbg04-r_D9Mao"}'::jsonb,
    body := '{}'::jsonb
  );
$$);

-- Score prospects every 6 hours (direct SQL — no edge function needed)
SELECT cron.schedule('score-prospects', '42 */6 * * *', $$
  SELECT score_prospects();
$$);

-- Auto-import group members → prospects every 4 hours
SELECT cron.schedule('auto-import-prospects', '7 */4 * * *', $$
  SELECT net.http_post(
    url := 'https://zyytzwlvtuhgbjpalbgd.supabase.co/functions/v1/auto-import-prospects',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp5eXR6d2x2dHVoZ2JqcGFsYmdkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzYyNTM2MiwiZXhwIjoyMDg5MjAxMzYyfQ.E_PyB-keVdYCXT1-_d3XA6nwShmBYumbg04-r_D9Mao"}'::jsonb,
    body := '{}'::jsonb
  );
$$);

-- Enrich members (avatars, about, profession detection) every hour
SELECT cron.schedule('enrich-members', '33 * * * *', $$
  SELECT net.http_post(
    url := 'https://zyytzwlvtuhgbjpalbgd.supabase.co/functions/v1/enrich-members',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp5eXR6d2x2dHVoZ2JqcGFsYmdkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzYyNTM2MiwiZXhwIjoyMDg5MjAxMzYyfQ.E_PyB-keVdYCXT1-_d3XA6nwShmBYumbg04-r_D9Mao"}'::jsonb,
    body := '{}'::jsonb
  );
$$);

-- ════════════════════════════════════════════════════════════════════════════
-- 2. PROSPECT REPLY TRACKING
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE prospects
  ADD COLUMN IF NOT EXISTS reply_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_replied_at timestamptz,
  ADD COLUMN IF NOT EXISTS avg_reply_time_minutes integer;

-- ════════════════════════════════════════════════════════════════════════════
-- 3. LEAD-TO-PROSPECT ATTRIBUTION
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS source_prospect_id uuid REFERENCES prospects(id);

-- Index for "leads from this prospect's group" queries
CREATE INDEX IF NOT EXISTS idx_leads_source_prospect ON leads(source_prospect_id)
  WHERE source_prospect_id IS NOT NULL;

-- ════════════════════════════════════════════════════════════════════════════
-- 4. GROUP DAILY STATS
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS group_daily_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups(id),
  stat_date date NOT NULL DEFAULT CURRENT_DATE,
  message_count integer DEFAULT 0,
  lead_count integer DEFAULT 0,
  new_members integer DEFAULT 0,
  left_members integer DEFAULT 0,
  UNIQUE(group_id, stat_date)
);

ALTER TABLE group_daily_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read group stats" ON group_daily_stats
  FOR SELECT USING (is_admin());

-- ════════════════════════════════════════════════════════════════════════════
-- 5. GROUP HEALTH VIEW
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW group_health AS
SELECT
  g.id,
  g.name,
  g.status,
  g.total_members,
  g.known_admins,
  g.last_synced_at,
  wa.label as scanner_name,
  wa.status as scanner_status,
  -- Activity: leads in last 7 days
  (SELECT COUNT(*) FROM leads l WHERE l.group_id = g.id AND l.created_at > now() - interval '7 days') as leads_7d,
  -- Activity: leads in last 30 days
  (SELECT COUNT(*) FROM leads l WHERE l.group_id = g.id AND l.created_at > now() - interval '30 days') as leads_30d,
  -- Member churn: left in last 7 days
  (SELECT COUNT(*) FROM group_members gm WHERE gm.group_id = g.id AND gm.left_group_at > now() - interval '7 days') as left_7d,
  -- Seller ratio
  CASE WHEN g.total_members > 0 THEN
    ROUND(100.0 * (SELECT COUNT(*) FROM group_members gm WHERE gm.group_id = g.id AND gm.classification = 'seller' AND gm.left_group_at IS NULL) / g.total_members)
  ELSE 0 END as seller_pct,
  -- Health score: 0-100
  CASE
    WHEN g.status != 'active' THEN 0
    WHEN wa.status = 'disconnected' THEN 10
    ELSE LEAST(100,
      COALESCE((SELECT COUNT(*) FROM leads l WHERE l.group_id = g.id AND l.created_at > now() - interval '7 days'), 0) * 10
      + CASE WHEN g.total_members > 50 THEN 20 WHEN g.total_members > 10 THEN 10 ELSE 5 END
      + CASE WHEN g.known_admins > 0 THEN 10 ELSE 0 END
      + CASE WHEN g.last_synced_at > now() - interval '6 hours' THEN 10 ELSE 0 END
    )
  END as health_score
FROM groups g
LEFT JOIN wa_accounts wa ON wa.id = g.wa_account_id
ORDER BY health_score DESC;

-- ════════════════════════════════════════════════════════════════════════════
-- 6. SYSTEM ALERTS TABLE (if not exists)
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS system_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL,
  severity text NOT NULL DEFAULT 'info',
  title text NOT NULL,
  message text,
  read_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE system_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage alerts" ON system_alerts
  FOR ALL USING (is_admin());

-- Daily stats aggregation cron (midnight)
SELECT cron.schedule('aggregate-group-stats', '5 0 * * *', $$
  INSERT INTO group_daily_stats (group_id, stat_date, message_count, lead_count, new_members, left_members)
  SELECT
    g.id,
    CURRENT_DATE - 1,
    COALESCE((SELECT COUNT(*) FROM job_queue jq WHERE jq.payload->>'groupId' = g.id::text AND jq.queue = 'raw_messages' AND jq.created_at >= CURRENT_DATE - 1 AND jq.created_at < CURRENT_DATE), 0),
    COALESCE((SELECT COUNT(*) FROM leads l WHERE l.group_id = g.id AND l.created_at >= CURRENT_DATE - 1 AND l.created_at < CURRENT_DATE), 0),
    COALESCE((SELECT COUNT(*) FROM group_members gm WHERE gm.group_id = g.id AND gm.joined_group_at >= CURRENT_DATE - 1 AND gm.joined_group_at < CURRENT_DATE), 0),
    COALESCE((SELECT COUNT(*) FROM group_members gm WHERE gm.group_id = g.id AND gm.left_group_at >= CURRENT_DATE - 1 AND gm.left_group_at < CURRENT_DATE), 0)
  FROM groups g
  WHERE g.status = 'active'
  ON CONFLICT (group_id, stat_date) DO UPDATE SET
    message_count = EXCLUDED.message_count,
    lead_count = EXCLUDED.lead_count,
    new_members = EXCLUDED.new_members,
    left_members = EXCLUDED.left_members;
$$);
