-- ============================================================
-- 044_watchdog_multi_instance.sql
-- WATCHDOG Protocol: Multi-instance schema
-- ============================================================

-- Phase 0: Add columns to groups for sync tracking
ALTER TABLE groups
  ADD COLUMN IF NOT EXISTS instance_status TEXT DEFAULT 'active'
    CHECK (instance_status IN ('active', 'not_in_instance', 'archived')),
  ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sync_status TEXT DEFAULT 'never'
    CHECK (sync_status IN ('never', 'syncing', 'synced', 'failed'));

-- Phase 1a: wa_accounts — add role + priority
ALTER TABLE wa_accounts
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'scraper'
    CHECK (role IN ('scraper', 'sender')),
  ADD COLUMN IF NOT EXISTS priority INTEGER NOT NULL DEFAULT 0;

ALTER TABLE wa_accounts DROP CONSTRAINT IF EXISTS wa_accounts_status_check;
ALTER TABLE wa_accounts ADD CONSTRAINT wa_accounts_status_check
  CHECK (status IN ('disconnected', 'waiting_qr', 'connecting', 'connected', 'blocked', 'yellow_card'));

-- Phase 1b: wa_account_state
CREATE TABLE IF NOT EXISTS wa_account_state (
  wa_account_id UUID PRIMARY KEY REFERENCES wa_accounts(id) ON DELETE CASCADE,
  last_health_check TIMESTAMPTZ,
  last_health_ok BOOLEAN DEFAULT true,
  last_sync_at TIMESTAMPTZ,
  last_error TEXT,
  last_error_at TIMESTAMPTZ,
  reconnect_attempts INTEGER NOT NULL DEFAULT 0,
  max_reconnect_attempts INTEGER NOT NULL DEFAULT 5,
  error_count_24h INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Phase 1c: wa_account_rate_limits
CREATE TABLE IF NOT EXISTS wa_account_rate_limits (
  wa_account_id UUID PRIMARY KEY REFERENCES wa_accounts(id) ON DELETE CASCADE,
  daily_message_limit INTEGER NOT NULL DEFAULT 200,
  messages_sent_today INTEGER NOT NULL DEFAULT 0,
  last_reset_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Phase 1d: pending_groups
CREATE TABLE IF NOT EXISTS pending_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_link TEXT NOT NULL,
  invite_code TEXT NOT NULL,
  source_group_id UUID REFERENCES groups(id) ON DELETE SET NULL,
  source_wa_sender_id TEXT,
  source_wa_message_id TEXT,
  discovered_by_account_id UUID REFERENCES wa_accounts(id) ON DELETE SET NULL,
  group_name TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'joining', 'joined', 'failed', 'ignored', 'duplicate')),
  assigned_account_id UUID REFERENCES wa_accounts(id) ON DELETE SET NULL,
  joined_group_id UUID REFERENCES groups(id) ON DELETE SET NULL,
  last_error TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  reviewed_by UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_pending_groups_active_invite
  ON pending_groups (invite_code) WHERE status IN ('pending', 'approved', 'joining');

-- Phase 1e: system_alerts
CREATE TABLE IF NOT EXISTS system_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wa_account_id UUID REFERENCES wa_accounts(id) ON DELETE SET NULL,
  alert_type TEXT NOT NULL CHECK (alert_type IN (
    'instance_disconnected', 'instance_reconnected', 'instance_degraded',
    'health_check_failed', 'health_check_recovered',
    'rate_limit_approaching', 'rate_limit_hit',
    'pending_group_discovered',
    'account_blocked', 'account_yellow_card',
    'daily_summary', 'sync_completed', 'custom'
  )),
  severity TEXT NOT NULL DEFAULT 'warning'
    CHECK (severity IN ('info', 'warning', 'critical')),
  title TEXT NOT NULL,
  message TEXT,
  detail JSONB NOT NULL DEFAULT '{}'::jsonb,
  channel TEXT NOT NULL DEFAULT 'whatsapp'
    CHECK (channel IN ('whatsapp', 'dashboard', 'log_only')),
  delivered BOOLEAN NOT NULL DEFAULT false,
  delivered_at TIMESTAMPTZ,
  dedupe_key TEXT GENERATED ALWAYS AS (
    alert_type || ':' || COALESCE(wa_account_id::text, 'global')
  ) STORED,
  dedupe_window_minutes INTEGER NOT NULL DEFAULT 30,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Phase 1f: wa_account_health_log
CREATE TABLE IF NOT EXISTS wa_account_health_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wa_account_id UUID NOT NULL REFERENCES wa_accounts(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  is_healthy BOOLEAN NOT NULL,
  response_time_ms INTEGER,
  groups_active INTEGER,
  messages_today INTEGER,
  error_count INTEGER DEFAULT 0,
  detail JSONB NOT NULL DEFAULT '{}'::jsonb,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Phase 1g: sync_events
CREATE TABLE IF NOT EXISTS sync_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  wa_sender_id TEXT,
  event_type TEXT NOT NULL
    CHECK (event_type IN ('member_joined', 'member_left', 'admin_promoted', 'admin_demoted', 'group_discovered', 'group_removed')),
  detail JSONB DEFAULT '{}'::jsonb,
  sync_run_id TEXT,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_wa_accounts_role ON wa_accounts(role) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_groups_wa_account ON groups(wa_account_id) WHERE wa_account_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_groups_sync ON groups(last_synced_at NULLS FIRST) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_pending_groups_status ON pending_groups(status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_system_alerts_undelivered ON system_alerts(created_at) WHERE delivered = false;
CREATE INDEX IF NOT EXISTS idx_system_alerts_dedupe ON system_alerts(dedupe_key, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_health_log_account_time ON wa_account_health_log(wa_account_id, checked_at DESC);
CREATE INDEX IF NOT EXISTS idx_health_log_cleanup ON wa_account_health_log(checked_at);
CREATE INDEX IF NOT EXISTS idx_sync_events_group ON sync_events(group_id, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_group_members_unenriched ON group_members(last_enriched_at NULLS FIRST)
  WHERE last_enriched_at IS NULL AND left_group_at IS NULL;

-- RLS
ALTER TABLE pending_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_account_health_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_account_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_account_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY admin_pending_groups ON pending_groups FOR ALL USING (public.is_admin());
CREATE POLICY admin_system_alerts ON system_alerts FOR ALL USING (public.is_admin());
CREATE POLICY admin_health_log ON wa_account_health_log FOR ALL USING (public.is_admin());
CREATE POLICY admin_account_state ON wa_account_state FOR ALL USING (public.is_admin());
CREATE POLICY admin_rate_limits ON wa_account_rate_limits FOR ALL USING (public.is_admin());
CREATE POLICY admin_sync_events ON sync_events FOR ALL USING (public.is_admin());

-- RPC: send_alert (with dedup)
CREATE OR REPLACE FUNCTION send_alert(
  p_account_id UUID, p_type TEXT, p_severity TEXT, p_title TEXT,
  p_message TEXT DEFAULT NULL, p_detail JSONB DEFAULT '{}'::jsonb,
  p_channel TEXT DEFAULT 'whatsapp', p_dedupe_minutes INTEGER DEFAULT 30
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_dedupe_key TEXT; v_existing BOOLEAN; v_id UUID;
BEGIN
  v_dedupe_key := p_type || ':' || COALESCE(p_account_id::text, 'global');
  SELECT EXISTS (SELECT 1 FROM system_alerts WHERE dedupe_key = v_dedupe_key
    AND created_at > now() - (p_dedupe_minutes || ' minutes')::interval) INTO v_existing;
  IF v_existing THEN RETURN NULL; END IF;
  INSERT INTO system_alerts (wa_account_id, alert_type, severity, title, message, detail, channel, dedupe_window_minutes)
  VALUES (p_account_id, p_type, p_severity, p_title, p_message, p_detail, p_channel, p_dedupe_minutes)
  RETURNING id INTO v_id;
  RETURN v_id;
END; $$;

-- RPC: increment_message_count (atomic)
CREATE OR REPLACE FUNCTION increment_message_count(p_account_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  UPDATE wa_account_rate_limits SET messages_sent_today = messages_sent_today + 1
  WHERE wa_account_id = p_account_id AND messages_sent_today < daily_message_limit;
  RETURN FOUND;
END; $$;

-- RPC: record_health_check
CREATE OR REPLACE FUNCTION record_health_check(
  p_account_id UUID, p_status TEXT, p_is_healthy BOOLEAN,
  p_response_time_ms INTEGER DEFAULT NULL, p_groups_active INTEGER DEFAULT NULL,
  p_detail JSONB DEFAULT '{}'::jsonb
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  INSERT INTO wa_account_state (wa_account_id, last_health_check, last_health_ok)
  VALUES (p_account_id, now(), p_is_healthy)
  ON CONFLICT (wa_account_id) DO UPDATE SET
    last_health_check = now(), last_health_ok = p_is_healthy,
    reconnect_attempts = CASE WHEN p_is_healthy THEN 0 ELSE wa_account_state.reconnect_attempts END,
    error_count_24h = CASE WHEN p_is_healthy THEN 0 ELSE wa_account_state.error_count_24h END,
    updated_at = now();
  INSERT INTO wa_account_health_log (wa_account_id, status, is_healthy, response_time_ms, groups_active, detail)
  VALUES (p_account_id, p_status, p_is_healthy, p_response_time_ms, p_groups_active, p_detail);
END; $$;

-- RPC: upsert_pending_group
CREATE OR REPLACE FUNCTION upsert_pending_group(
  p_invite_link TEXT, p_invite_code TEXT,
  p_source_group_id UUID DEFAULT NULL, p_source_wa_sender_id TEXT DEFAULT NULL,
  p_source_wa_message_id TEXT DEFAULT NULL, p_discovered_by UUID DEFAULT NULL,
  p_group_name TEXT DEFAULT NULL
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_id UUID;
BEGIN
  SELECT id INTO v_id FROM pending_groups
  WHERE invite_code = p_invite_code AND status IN ('pending', 'approved', 'joining');
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;
  INSERT INTO pending_groups (invite_link, invite_code, source_group_id, source_wa_sender_id,
    source_wa_message_id, discovered_by_account_id, group_name)
  VALUES (p_invite_link, p_invite_code, p_source_group_id, p_source_wa_sender_id,
    p_source_wa_message_id, p_discovered_by, p_group_name)
  RETURNING id INTO v_id;
  RETURN v_id;
END; $$;

-- RPC: cleanup_old_health_logs
CREATE OR REPLACE FUNCTION cleanup_old_health_logs() RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE deleted INTEGER;
BEGIN
  DELETE FROM wa_account_health_log WHERE checked_at < now() - interval '7 days';
  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted;
END; $$;

-- RPC: get_instance_status
CREATE OR REPLACE FUNCTION get_instance_status()
RETURNS TABLE (account_id UUID, label TEXT, role TEXT, status TEXT, is_healthy BOOLEAN,
  last_sync_at TIMESTAMPTZ, groups_count BIGINT, pending_groups_count BIGINT,
  active_alerts_count BIGINT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT wa.id, wa.label, wa.role, wa.status, COALESCE(ws.last_health_ok, true),
    ws.last_sync_at,
    (SELECT count(*) FROM groups g WHERE g.wa_account_id = wa.id AND g.status = 'active'),
    (SELECT count(*) FROM pending_groups WHERE status = 'pending'),
    (SELECT count(*) FROM system_alerts WHERE delivered = false AND severity IN ('warning', 'critical'))
  FROM wa_accounts wa
  LEFT JOIN wa_account_state ws ON ws.wa_account_id = wa.id
  WHERE wa.is_active = true ORDER BY wa.role, wa.priority;
$$;

-- Trigger: auto-alert on wa_accounts status change
CREATE OR REPLACE FUNCTION trg_wa_account_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    PERFORM send_alert(
      NEW.id,
      CASE NEW.status
        WHEN 'disconnected' THEN 'instance_disconnected'
        WHEN 'connected' THEN 'instance_reconnected'
        WHEN 'blocked' THEN 'account_blocked'
        WHEN 'yellow_card' THEN 'account_yellow_card'
        ELSE 'custom'
      END,
      CASE NEW.status
        WHEN 'disconnected' THEN 'critical'
        WHEN 'blocked' THEN 'critical'
        WHEN 'yellow_card' THEN 'warning'
        WHEN 'connected' THEN 'info'
        ELSE 'info'
      END,
      'Instance ' || COALESCE(NEW.label, NEW.id::text) || ': ' || NEW.status,
      'Changed from ' || OLD.status || ' to ' || NEW.status,
      jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status),
      CASE WHEN NEW.status IN ('disconnected', 'blocked') THEN 'whatsapp' ELSE 'dashboard' END,
      10
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS wa_account_status_change ON wa_accounts;
CREATE TRIGGER wa_account_status_change
  AFTER UPDATE OF status ON wa_accounts
  FOR EACH ROW EXECUTE FUNCTION trg_wa_account_status_change();

-- Seed state + rate_limits for existing accounts
INSERT INTO wa_account_state (wa_account_id)
SELECT id FROM wa_accounts WHERE is_active = true ON CONFLICT DO NOTHING;

INSERT INTO wa_account_rate_limits (wa_account_id)
SELECT id FROM wa_accounts WHERE is_active = true ON CONFLICT DO NOTHING;
