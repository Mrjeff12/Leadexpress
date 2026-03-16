-- ============================================================
-- 005: Prospects CRM — Contractor Sales Pipeline
-- ============================================================
-- prospects  = technicians we want to sell our filtering service to
-- leads      = parsed messages from people looking for services (unchanged)
-- These are SEPARATE concepts: leads are the product, prospects are our customers
-- ============================================================

-- 1. Prospect stage enum
CREATE TYPE prospect_stage AS ENUM (
  'prospect',        -- imported from groups, not yet contacted
  'reached_out',     -- we sent first message / called
  'in_conversation', -- active dialog (WA / phone / visited site)
  'demo_trial',      -- signed up for trial or saw demo
  'paying',          -- active paying customer
  'churned'          -- canceled / left
);

-- 2. Main prospects table
CREATE TABLE prospects (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wa_id           TEXT UNIQUE NOT NULL,                          -- "972501234567@c.us"
  phone           TEXT NOT NULL,                                 -- "+972501234567"
  display_name    TEXT,
  profile_pic_url TEXT,                                          -- from GREEN-API getAvatar

  -- Intelligence (linked to existing group_members)
  wa_sender_id    TEXT,                                          -- links to group_members.wa_sender_id
  profession_tags TEXT[] DEFAULT '{}',                           -- inferred from group categories
  group_ids       UUID[] DEFAULT '{}',                           -- which groups they belong to (FK array to groups.id)

  -- Sales pipeline
  stage           prospect_stage NOT NULL DEFAULT 'prospect',
  assigned_wa_account_id UUID REFERENCES wa_accounts(id),       -- which phone handles outreach
  notes           TEXT DEFAULT '',

  -- Tracking
  last_contact_at   TIMESTAMPTZ,
  next_followup_at  TIMESTAMPTZ,
  archived_at       TIMESTAMPTZ,                                -- soft archive

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX idx_prospects_stage ON prospects(stage);
CREATE INDEX idx_prospects_wa_id ON prospects(wa_id);
CREATE INDEX idx_prospects_phone ON prospects(phone);
CREATE INDEX idx_prospects_next_followup ON prospects(next_followup_at) WHERE next_followup_at IS NOT NULL;
CREATE INDEX idx_prospects_archived ON prospects(archived_at) WHERE archived_at IS NULL;

-- Auto-update updated_at
CREATE TRIGGER set_prospects_updated_at
  BEFORE UPDATE ON prospects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 3. Prospect messages — full bidirectional chat history
CREATE TABLE prospect_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id     UUID NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
  wa_account_id   UUID REFERENCES wa_accounts(id),              -- which phone sent/received

  direction       TEXT NOT NULL CHECK (direction IN ('outgoing', 'incoming')),
  message_type    TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'document', 'audio', 'video', 'location', 'contact')),
  content         TEXT NOT NULL,
  media_url       TEXT,                                          -- for non-text messages

  wa_message_id   TEXT,                                          -- GREEN-API message ID
  content_hash    TEXT,                                          -- SHA256 for dedup

  -- Delivery tracking
  sent_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  delivered_at    TIMESTAMPTZ,
  read_at         TIMESTAMPTZ,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_prospect_messages_prospect ON prospect_messages(prospect_id, sent_at DESC);
CREATE INDEX idx_prospect_messages_wa_id ON prospect_messages(wa_message_id);

-- 4. Prospect events — full audit trail
CREATE TABLE prospect_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id     UUID NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,

  event_type      TEXT NOT NULL CHECK (event_type IN (
    'stage_change',     -- moved pipeline stage
    'note_added',       -- admin added a note
    'call_logged',      -- phone call happened
    'message_sent',     -- outbound WA message
    'message_received', -- inbound WA message
    'payment',          -- payment event
    'imported',         -- initial import from group
    'profile_updated',  -- info changed
    'assigned',         -- assigned to wa_account
    'archived',         -- moved to archive
    'restored'          -- restored from archive
  )),

  old_value       TEXT,                                          -- e.g. old stage
  new_value       TEXT,                                          -- e.g. new stage
  detail          JSONB DEFAULT '{}',                            -- extra context

  changed_by      UUID REFERENCES profiles(id),                 -- which admin
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_prospect_events_prospect ON prospect_events(prospect_id, created_at DESC);
CREATE INDEX idx_prospect_events_type ON prospect_events(event_type);

-- 5. RLS Policies
ALTER TABLE prospects ENABLE ROW LEVEL SECURITY;
ALTER TABLE prospect_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE prospect_events ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
CREATE POLICY admin_all_prospects ON prospects
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY admin_all_prospect_messages ON prospect_messages
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY admin_all_prospect_events ON prospect_events
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Service role bypass (for wa-listener service)
-- Supabase service_role key already bypasses RLS

-- 6. Helper view: prospect with group names (avoids denormalization)
CREATE OR REPLACE VIEW prospect_with_groups AS
SELECT
  p.*,
  COALESCE(
    (SELECT array_agg(g.name ORDER BY g.name)
     FROM groups g
     WHERE g.id = ANY(p.group_ids)),
    '{}'
  ) AS group_names
FROM prospects p;

-- 7. Function to import group members as prospects
CREATE OR REPLACE FUNCTION import_group_members_as_prospects(
  p_group_id UUID,
  p_members JSONB  -- array of {wa_id, phone, display_name, profile_pic_url}
) RETURNS INTEGER AS $$
DECLARE
  member JSONB;
  imported_count INTEGER := 0;
  v_group_category TEXT;
BEGIN
  -- Get group category for profession tagging
  SELECT category INTO v_group_category FROM groups WHERE id = p_group_id;

  FOR member IN SELECT * FROM jsonb_array_elements(p_members)
  LOOP
    INSERT INTO prospects (wa_id, phone, display_name, profile_pic_url, group_ids, profession_tags, wa_sender_id)
    VALUES (
      member->>'wa_id',
      member->>'phone',
      member->>'display_name',
      member->>'profile_pic_url',
      ARRAY[p_group_id],
      CASE WHEN v_group_category IS NOT NULL THEN ARRAY[v_group_category] ELSE '{}' END,
      member->>'wa_id'
    )
    ON CONFLICT (wa_id) DO UPDATE SET
      display_name = COALESCE(EXCLUDED.display_name, prospects.display_name),
      profile_pic_url = COALESCE(EXCLUDED.profile_pic_url, prospects.profile_pic_url),
      group_ids = (
        SELECT array_agg(DISTINCT val)
        FROM unnest(prospects.group_ids || ARRAY[p_group_id]) AS val
      ),
      profession_tags = (
        SELECT array_agg(DISTINCT val)
        FROM unnest(prospects.profession_tags ||
          CASE WHEN v_group_category IS NOT NULL THEN ARRAY[v_group_category] ELSE '{}' END
        ) AS val
      ),
      updated_at = now();

    imported_count := imported_count + 1;
  END LOOP;

  RETURN imported_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
