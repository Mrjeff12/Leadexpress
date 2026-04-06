-- ══════════════════════════════════════════════════
-- 097 — Army (WhatsApp slave management)
-- ══════════════════════════════════════════════════

-- Extend wa_accounts for army usage
ALTER TABLE wa_accounts
  ADD COLUMN IF NOT EXISTS is_army boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS army_role text CHECK (army_role IN ('publisher','responder','contractor')),
  ADD COLUMN IF NOT EXISTS army_alias text;

-- Army assignments: which account operates in which group
CREATE TABLE IF NOT EXISTS army_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wa_account_id uuid NOT NULL REFERENCES wa_accounts(id) ON DELETE CASCADE,
  group_wa_id text NOT NULL,
  group_name text,
  role_in_group text NOT NULL CHECK (role_in_group IN ('publisher','responder','contractor')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (wa_account_id, group_wa_id, role_in_group)
);

-- Army templates: message templates by category
CREATE TABLE IF NOT EXISTS army_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL CHECK (category IN ('job_post','response','contractor_promo')),
  name text NOT NULL,
  body text NOT NULL,
  placeholders jsonb NOT NULL DEFAULT '[]',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Army schedule: planned + sent messages
CREATE TABLE IF NOT EXISTS army_schedule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_wa_id text NOT NULL,
  wa_account_id uuid NOT NULL REFERENCES wa_accounts(id) ON DELETE CASCADE,
  template_id uuid REFERENCES army_templates(id) ON DELETE SET NULL,
  message_type text NOT NULL CHECK (message_type IN ('job_post','response','contractor_promo')),
  scheduled_at timestamptz NOT NULL,
  sent_at timestamptz,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','failed')),
  rendered_message text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Army config: key-value settings
CREATE TABLE IF NOT EXISTS army_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value text NOT NULL
);

-- Seed default config
INSERT INTO army_config (key, value) VALUES
  ('enabled', 'true'),
  ('activity_window_start', '07:00'),
  ('activity_window_end', '21:00'),
  ('response_delay_min', '5'),
  ('response_delay_max', '30')
ON CONFLICT (key) DO NOTHING;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_army_assignments_group ON army_assignments(group_wa_id);
CREATE INDEX IF NOT EXISTS idx_army_assignments_account ON army_assignments(wa_account_id);
CREATE INDEX IF NOT EXISTS idx_army_schedule_status ON army_schedule(status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_army_schedule_group_date ON army_schedule(group_wa_id, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_wa_accounts_army ON wa_accounts(is_army) WHERE is_army = true;

-- RLS (admin only — service_role bypasses, anon blocked)
ALTER TABLE army_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE army_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE army_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE army_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_army_assignments" ON army_assignments FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "admin_army_templates" ON army_templates FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "admin_army_schedule" ON army_schedule FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "admin_army_config" ON army_config FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
