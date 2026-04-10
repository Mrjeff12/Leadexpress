-- ============================================================
-- 104: DM Outreach Campaign System
-- Enables Army slaves to send personalized DMs to prospects
-- scraped from WhatsApp groups, inviting them to subscribe.
-- ============================================================
BEGIN;

-- ─── 1. dm_campaigns — campaign definitions ───
CREATE TABLE public.dm_campaigns (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT NOT NULL,
  template_id      UUID REFERENCES public.army_templates(id) ON DELETE SET NULL,
  -- Audience filters
  profession_filter TEXT[] DEFAULT NULL,       -- NULL = all professions
  country_filter   TEXT DEFAULT NULL,          -- NULL = all countries
  exclude_contacted_days INTEGER DEFAULT 30,   -- skip prospects contacted in last N days
  exclude_registered BOOLEAN DEFAULT true,     -- skip prospects already registered as users
  -- Delivery settings
  daily_limit      INTEGER NOT NULL DEFAULT 30,-- max DMs per slave per day
  follow_up_hours  INTEGER DEFAULT 48,         -- send follow-up after N hours (NULL = no follow-up)
  follow_up_template_id UUID REFERENCES public.army_templates(id) ON DELETE SET NULL,
  max_follow_ups   INTEGER DEFAULT 1,          -- max follow-up attempts
  -- Register link
  register_url     TEXT NOT NULL DEFAULT 'https://app.masterleadflow.com/register',
  utm_source       TEXT DEFAULT 'army_dm',
  utm_campaign     TEXT,                        -- auto-filled from campaign name
  -- State
  status           TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'paused', 'completed')),
  total_sent       INTEGER DEFAULT 0,
  total_replied    INTEGER DEFAULT 0,
  total_registered INTEGER DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_dm_campaigns_status ON public.dm_campaigns(status);

CREATE TRIGGER set_dm_campaigns_updated
  BEFORE UPDATE ON public.dm_campaigns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── 2. dm_outreach — per-prospect tracking ───
CREATE TABLE public.dm_outreach (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id      UUID NOT NULL REFERENCES public.dm_campaigns(id) ON DELETE CASCADE,
  prospect_id      UUID NOT NULL REFERENCES public.prospects(id) ON DELETE CASCADE,
  wa_account_id    UUID NOT NULL REFERENCES public.wa_accounts(id) ON DELETE CASCADE,
  -- Message tracking
  status           TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'sent', 'delivered', 'replied', 'interested', 'not_interested', 'registered', 'failed', 'blocked')),
  message_text     TEXT,                        -- actual sent message (after placeholder replacement)
  sent_at          TIMESTAMPTZ,
  delivered_at     TIMESTAMPTZ,
  replied_at       TIMESTAMPTZ,
  reply_text       TEXT,
  -- Follow-up tracking
  follow_up_count  INTEGER DEFAULT 0,
  last_follow_up_at TIMESTAMPTZ,
  next_follow_up_at TIMESTAMPTZ,
  -- Registration tracking
  registered_at    TIMESTAMPTZ,
  registered_user_id UUID REFERENCES public.profiles(id),
  -- Metadata
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(campaign_id, prospect_id)             -- one outreach per prospect per campaign
);

CREATE INDEX idx_dm_outreach_campaign ON public.dm_outreach(campaign_id, status);
CREATE INDEX idx_dm_outreach_prospect ON public.dm_outreach(prospect_id);
CREATE INDEX idx_dm_outreach_followup ON public.dm_outreach(next_follow_up_at)
  WHERE status = 'sent' AND next_follow_up_at IS NOT NULL;
CREATE INDEX idx_dm_outreach_wa ON public.dm_outreach(wa_account_id, sent_at);

CREATE TRIGGER set_dm_outreach_updated
  BEFORE UPDATE ON public.dm_outreach
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── 3. RLS ───
ALTER TABLE public.dm_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dm_outreach ENABLE ROW LEVEL SECURITY;

CREATE POLICY dm_campaigns_admin ON public.dm_campaigns
  FOR ALL USING (public.is_admin());

CREATE POLICY dm_outreach_admin ON public.dm_outreach
  FOR ALL USING (public.is_admin());

-- ─── 4. Helper: build personalized message ───
CREATE OR REPLACE FUNCTION public.build_dm_message(
  p_template TEXT,
  p_prospect_name TEXT,
  p_profession TEXT,
  p_city TEXT,
  p_register_url TEXT
)
RETURNS TEXT
LANGUAGE plpgsql IMMUTABLE
AS $$
BEGIN
  RETURN REPLACE(
    REPLACE(
      REPLACE(
        REPLACE(p_template, '{{name}}', COALESCE(p_prospect_name, 'Hi')),
        '{{profession}}', COALESCE(p_profession, 'contractor')
      ),
      '{{city}}', COALESCE(p_city, 'your area')
    ),
    '{{register_url}}', COALESCE(p_register_url, 'https://app.masterleadflow.com/register')
  );
END;
$$;

-- ─── 5. RPC: queue DM campaign prospects ───
CREATE OR REPLACE FUNCTION public.queue_dm_campaign(p_campaign_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_campaign    dm_campaigns%ROWTYPE;
  v_template    TEXT;
  v_prospect    RECORD;
  v_wa_accounts UUID[];
  v_wa_idx      INTEGER := 0;
  v_count       INTEGER := 0;
  v_register    TEXT;
  v_msg         TEXT;
BEGIN
  SELECT * INTO v_campaign FROM dm_campaigns WHERE id = p_campaign_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Campaign not found'; END IF;
  IF v_campaign.status != 'active' THEN RAISE EXCEPTION 'Campaign not active'; END IF;

  -- Get template body
  SELECT body INTO v_template FROM army_templates WHERE id = v_campaign.template_id;
  IF v_template IS NULL THEN RAISE EXCEPTION 'Template not found'; END IF;

  -- Get army wa_accounts
  SELECT array_agg(id) INTO v_wa_accounts
  FROM wa_accounts
  WHERE is_army = true AND is_active = true AND status = 'connected';

  IF v_wa_accounts IS NULL OR array_length(v_wa_accounts, 1) = 0 THEN
    RAISE EXCEPTION 'No active Army WhatsApp accounts';
  END IF;

  -- Find eligible prospects
  FOR v_prospect IN
    SELECT p.id, p.phone, p.display_name, p.profession_tags, p.country
    FROM prospects p
    WHERE p.phone IS NOT NULL
      AND p.stage NOT IN ('archived', 'blocked')
      -- Profession filter
      AND (v_campaign.profession_filter IS NULL
           OR p.profession_tags && v_campaign.profession_filter)
      -- Country filter
      AND (v_campaign.country_filter IS NULL
           OR p.country = v_campaign.country_filter)
      -- Not already in this campaign
      AND NOT EXISTS (
        SELECT 1 FROM dm_outreach d
        WHERE d.prospect_id = p.id AND d.campaign_id = p_campaign_id
      )
      -- Not contacted recently by any campaign
      AND (v_campaign.exclude_contacted_days = 0
           OR NOT EXISTS (
             SELECT 1 FROM dm_outreach d2
             WHERE d2.prospect_id = p.id
               AND d2.sent_at > now() - (v_campaign.exclude_contacted_days || ' days')::interval
           ))
      -- Not already a registered user
      AND (NOT v_campaign.exclude_registered
           OR p.user_id IS NULL)
    ORDER BY p.lead_count DESC NULLS LAST, p.created_at
  LOOP
    -- Round-robin slave assignment
    v_wa_idx := v_wa_idx + 1;
    IF v_wa_idx > array_length(v_wa_accounts, 1) THEN
      v_wa_idx := 1;
    END IF;

    -- Build personalized message
    v_register := v_campaign.register_url
      || '?utm_source=' || COALESCE(v_campaign.utm_source, 'army_dm')
      || '&utm_campaign=' || COALESCE(v_campaign.utm_campaign, v_campaign.name);

    v_msg := build_dm_message(
      v_template,
      v_prospect.display_name,
      COALESCE(v_prospect.profession_tags[1], NULL),
      v_prospect.country,
      v_register
    );

    INSERT INTO dm_outreach (campaign_id, prospect_id, wa_account_id, message_text, status)
    VALUES (p_campaign_id, v_prospect.id, v_wa_accounts[v_wa_idx], v_msg, 'queued');

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.queue_dm_campaign(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.build_dm_message(TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

COMMIT;
