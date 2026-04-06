-- ══════════════════════════════════════════════════
-- 098 — Army DMs (private messages to slave accounts)
-- ══════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS army_dms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wa_account_id uuid NOT NULL REFERENCES wa_accounts(id) ON DELETE CASCADE,
  sender_phone text NOT NULL,
  sender_name text,
  direction text NOT NULL CHECK (direction IN ('incoming','outgoing')),
  content text NOT NULL,
  wa_message_id text,
  sent_at timestamptz NOT NULL DEFAULT now(),
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_army_dms_account ON army_dms(wa_account_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_army_dms_sender ON army_dms(wa_account_id, sender_phone, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_army_dms_unread ON army_dms(wa_account_id, read) WHERE read = false;

ALTER TABLE army_dms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_army_dms" ON army_dms FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
