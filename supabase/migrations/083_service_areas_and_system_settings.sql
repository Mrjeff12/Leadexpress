-- ============================================================
-- 083: Service Areas + System Settings tables
-- ============================================================

-- ── Service Areas ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS service_areas (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zip_code        TEXT NOT NULL UNIQUE,
  city            TEXT NOT NULL DEFAULT '',
  state           TEXT NOT NULL DEFAULT '',
  contractor_count INTEGER NOT NULL DEFAULT 0,
  is_active       BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE service_areas ENABLE ROW LEVEL SECURITY;
CREATE POLICY admin_service_areas ON service_areas FOR ALL USING (public.is_admin());

-- ── System Settings (key-value store) ──────────────────────
CREATE TABLE IF NOT EXISTS system_settings (
  key         TEXT PRIMARY KEY,
  value       JSONB NOT NULL DEFAULT '{}',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY admin_system_settings ON system_settings FOR ALL USING (public.is_admin());

-- Seed default settings
INSERT INTO system_settings (key, value) VALUES
  ('business_name', '"MasterLeadFlow"'),
  ('default_language', '"en"'),
  ('timezone', '"America/New_York"'),
  ('notifications', '{"email": true, "whatsapp": true, "telegram": true, "sms": false}')
ON CONFLICT (key) DO NOTHING;
