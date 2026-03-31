-- Quick reply templates for Admin Inbox
CREATE TABLE IF NOT EXISTS quick_reply_templates (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  body text NOT NULL,
  category text DEFAULT 'general',
  is_active boolean DEFAULT true,
  sort_order int DEFAULT 0,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE quick_reply_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY qrt_admin ON quick_reply_templates FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Seed initial templates (migrated from hardcoded QUICK_REPLIES)
INSERT INTO quick_reply_templates (title, body, category, sort_order) VALUES
  ('Intro', 'Hi {name}! I''m from MasterLeadFlow. We help {profession} contractors get more jobs. Interested?', 'outreach', 0),
  ('Follow-up', 'Hey {name}! Following up on my last message.', 'outreach', 1),
  ('Demo', 'Want to try our platform for free?', 'outreach', 2),
  ('Pricing', 'Plans start at $79/mo. Want details?', 'outreach', 3);
