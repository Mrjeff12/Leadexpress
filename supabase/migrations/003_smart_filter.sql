-- ============================================================
-- Lead Express — Smart Filter: Member Intelligence & Pipeline Events
-- ============================================================

-- Group Members — track sender behavior for auto-classification
CREATE TABLE public.group_members (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id        UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  wa_sender_id    TEXT NOT NULL,                -- e.g. "972501234567@c.us"
  display_name    TEXT,
  contact_name    TEXT,
  classification  TEXT NOT NULL DEFAULT 'unknown'
                  CHECK (classification IN ('unknown', 'seller', 'buyer', 'bot', 'admin')),
  total_messages  INTEGER NOT NULL DEFAULT 0,
  lead_messages   INTEGER NOT NULL DEFAULT 0,   -- messages that were parsed as leads
  service_messages INTEGER NOT NULL DEFAULT 0,  -- messages offering services (has phone = seller signal)
  last_seen_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  classified_at   TIMESTAMPTZ,                  -- when auto-classification happened
  manual_override BOOLEAN NOT NULL DEFAULT false, -- admin manually set classification
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (group_id, wa_sender_id)
);

CREATE INDEX idx_gm_group ON public.group_members(group_id);
CREATE INDEX idx_gm_sender ON public.group_members(wa_sender_id);
CREATE INDEX idx_gm_class ON public.group_members(classification) WHERE classification = 'seller';

-- Pipeline Events — every step a message goes through (feeds Live Pipeline Feed)
CREATE TABLE public.pipeline_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id        UUID REFERENCES public.groups(id) ON DELETE SET NULL,
  wa_message_id   TEXT,
  sender_id       TEXT,
  stage           TEXT NOT NULL
                  CHECK (stage IN (
                    'received',       -- message arrived from Green API
                    'quick_filtered', -- dropped by quick filter (too short, media, bot)
                    'sender_filtered',-- dropped by sender intelligence (known seller)
                    'pattern_matched',-- passed pattern match (has location/job keywords)
                    'ai_parsing',     -- sent to OpenAI for parsing
                    'ai_parsed',      -- OpenAI returned result
                    'no_lead',        -- AI said not a lead
                    'lead_created',   -- lead record created
                    'matched',        -- matched to contractors
                    'sent',           -- sent via Telegram
                    'claimed',        -- contractor claimed the lead
                    'expired'         -- lead expired unclaimed
                  )),
  detail          JSONB DEFAULT '{}',  -- stage-specific data
  lead_id         UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pe_created ON public.pipeline_events(created_at DESC);
CREATE INDEX idx_pe_group ON public.pipeline_events(group_id, created_at DESC);
CREATE INDEX idx_pe_message ON public.pipeline_events(wa_message_id) WHERE wa_message_id IS NOT NULL;

-- RLS
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipeline_events ENABLE ROW LEVEL SECURITY;

-- Group members: admins only
CREATE POLICY gm_admin ON public.group_members
  FOR ALL USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

-- Pipeline events: admins can read
CREATE POLICY pe_admin_read ON public.pipeline_events
  FOR SELECT USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );
CREATE POLICY pe_service_write ON public.pipeline_events
  FOR INSERT WITH CHECK (true);  -- services write freely via service key

-- Auto-update trigger
CREATE TRIGGER gm_updated_at BEFORE UPDATE ON public.group_members
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- Add sender_id column to leads for linking back
-- ============================================================
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS sender_id TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS filter_stage TEXT DEFAULT 'ai_parsed';

-- ============================================================
-- Update groups table: add member tracking columns
-- ============================================================
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS total_members INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS known_sellers INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS known_buyers INTEGER NOT NULL DEFAULT 0;
