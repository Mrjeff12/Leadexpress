-- 018: Add group_responses table for tracking contractor responses to leads

CREATE TABLE public.group_responses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id        UUID NOT NULL REFERENCES groups(id),
  wa_message_id   TEXT UNIQUE,
  sender_id       TEXT NOT NULL,
  message         TEXT NOT NULL,
  quoted_message_id TEXT,
  linked_lead_id  UUID REFERENCES leads(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_gr_group ON group_responses(group_id, created_at DESC);
CREATE INDEX idx_gr_sender ON group_responses(sender_id);
CREATE INDEX idx_gr_lead ON group_responses(linked_lead_id) WHERE linked_lead_id IS NOT NULL;

ALTER TABLE group_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY gr_admin_read ON group_responses
  FOR SELECT USING (public.is_admin());

CREATE POLICY gr_service_write ON group_responses
  FOR INSERT WITH CHECK (true);
