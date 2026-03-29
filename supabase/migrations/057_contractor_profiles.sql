-- ============================================================
-- 057: Contractor Profiles — professional profile extension
-- ============================================================
BEGIN;

-- 1. contractor_profiles table
CREATE TABLE public.contractor_profiles (
  user_id             UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  slug                TEXT UNIQUE,
  headline            TEXT,
  bio                 TEXT,
  years_experience    SMALLINT,
  business_name       TEXT,
  license_number      TEXT,
  insurance_verified  BOOLEAN NOT NULL DEFAULT false,
  background_check    TEXT NOT NULL DEFAULT 'none'
    CHECK (background_check IN ('none', 'pending', 'passed', 'failed')),
  languages           TEXT[] DEFAULT '{English}',
  team_size           SMALLINT DEFAULT 1,
  website_url         TEXT,

  -- Computed / cached fields (updated by triggers or functions)
  avg_rating          NUMERIC(3,2) NOT NULL DEFAULT 0,
  review_count        INTEGER NOT NULL DEFAULT 0,
  completion_rate     NUMERIC(5,2) NOT NULL DEFAULT 0,
  avg_response_mins   INTEGER,
  reputation_score    INTEGER NOT NULL DEFAULT 0,
  tier                TEXT NOT NULL DEFAULT 'new'
    CHECK (tier IN ('new', 'verified', 'trusted', 'elite')),
  profile_completeness SMALLINT NOT NULL DEFAULT 0,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_cp_slug ON public.contractor_profiles(slug) WHERE slug IS NOT NULL;
CREATE INDEX idx_cp_tier ON public.contractor_profiles(tier);
CREATE INDEX idx_cp_reputation ON public.contractor_profiles(reputation_score DESC);

-- Updated-at trigger
CREATE TRIGGER set_cp_updated_at
  BEFORE UPDATE ON public.contractor_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE public.contractor_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY cp_own ON public.contractor_profiles
  FOR ALL USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY cp_public_read ON public.contractor_profiles
  FOR SELECT USING (slug IS NOT NULL);


-- ============================================================
-- 2. generate_contractor_slug
-- ============================================================
CREATE OR REPLACE FUNCTION public.generate_contractor_slug(p_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_name TEXT;
  v_slug TEXT;
  v_suffix INTEGER := 0;
  v_candidate TEXT;
BEGIN
  SELECT COALESCE(
    cp.business_name,
    p.full_name,
    'pro'
  ) INTO v_name
  FROM profiles p
  LEFT JOIN contractor_profiles cp ON cp.user_id = p.id
  WHERE p.id = p_user_id;

  -- Slugify: lowercase, replace non-alphanum with dashes, trim dashes
  v_slug := lower(regexp_replace(trim(COALESCE(v_name, 'pro')), '[^a-zA-Z0-9]+', '-', 'g'));
  v_slug := trim(BOTH '-' FROM v_slug);
  IF v_slug = '' THEN v_slug := 'pro'; END IF;

  -- Ensure uniqueness
  v_candidate := v_slug;
  WHILE EXISTS (
    SELECT 1 FROM contractor_profiles
    WHERE slug = v_candidate AND user_id != p_user_id
  ) LOOP
    v_suffix := v_suffix + 1;
    v_candidate := v_slug || '-' || v_suffix;
  END LOOP;

  RETURN v_candidate;
END;
$$;


-- ============================================================
-- 3. calculate_profile_completeness
-- ============================================================
CREATE OR REPLACE FUNCTION public.calculate_profile_completeness(p_user_id UUID)
RETURNS SMALLINT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  score SMALLINT := 0;
  v_p   RECORD;
  v_c   RECORD;
  v_cp  RECORD;
BEGIN
  SELECT * INTO v_p FROM profiles WHERE id = p_user_id;
  SELECT * INTO v_c FROM contractors WHERE user_id = p_user_id;
  SELECT * INTO v_cp FROM contractor_profiles WHERE user_id = p_user_id;

  -- Base info (40 pts)
  IF v_p.full_name IS NOT NULL AND v_p.full_name != '' THEN score := score + 10; END IF;
  IF v_p.phone IS NOT NULL AND v_p.phone != '' THEN score := score + 5; END IF;
  IF v_p.whatsapp_phone IS NOT NULL THEN score := score + 5; END IF;
  IF v_c IS NOT NULL AND v_c.professions IS NOT NULL AND array_length(v_c.professions, 1) > 0 THEN score := score + 10; END IF;
  IF v_c IS NOT NULL AND v_c.zip_codes IS NOT NULL AND array_length(v_c.zip_codes, 1) > 0 THEN score := score + 10; END IF;

  -- Extended profile (40 pts)
  IF v_cp IS NOT NULL THEN
    IF v_cp.headline IS NOT NULL AND v_cp.headline != '' THEN score := score + 10; END IF;
    IF v_cp.bio IS NOT NULL AND length(v_cp.bio) >= 50 THEN score := score + 10; END IF;
    IF v_cp.years_experience IS NOT NULL THEN score := score + 5; END IF;
    IF v_cp.business_name IS NOT NULL AND v_cp.business_name != '' THEN score := score + 5; END IF;
    IF v_cp.languages IS NOT NULL AND array_length(v_cp.languages, 1) > 0 THEN score := score + 5; END IF;
    IF v_cp.license_number IS NOT NULL AND v_cp.license_number != '' THEN score := score + 5; END IF;
  END IF;

  -- Activity signals (20 pts)
  IF EXISTS (SELECT 1 FROM lead_contact_events WHERE user_id = p_user_id LIMIT 1) THEN score := score + 5; END IF;
  IF EXISTS (SELECT 1 FROM lead_feedback WHERE user_id = p_user_id LIMIT 1) THEN score := score + 5; END IF;
  -- Portfolio: 10 pts (will count once portfolio_items table exists)
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'portfolio_items' AND schemaname = 'public') THEN
    IF EXISTS (SELECT 1 FROM portfolio_items WHERE user_id = p_user_id LIMIT 1) THEN score := score + 10; END IF;
  END IF;

  RETURN LEAST(score, 100);
END;
$$;


-- ============================================================
-- 4. calculate_contractor_stats — aggregate existing data
-- ============================================================
CREATE OR REPLACE FUNCTION public.calculate_contractor_stats(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'leads_contacted', COALESCE((SELECT count(*) FROM lead_contact_events WHERE user_id = p_user_id), 0),
    'successful_jobs', COALESCE((SELECT count(*) FROM lead_feedback WHERE user_id = p_user_id AND rating = 'got_job'), 0),
    'feedbacks_given', COALESCE((SELECT count(*) FROM lead_feedback WHERE user_id = p_user_id), 0),
    'groups_active', COALESCE((
      SELECT count(DISTINCT id)
      FROM contractor_group_links
      WHERE user_id = p_user_id AND status = 'joined'
    ), 0),
    'job_orders_total', COALESCE((SELECT count(*) FROM job_orders WHERE contractor_id = p_user_id), 0),
    'job_orders_completed', COALESCE((SELECT count(*) FROM job_orders WHERE contractor_id = p_user_id AND status = 'completed'), 0),
    'avg_response_mins', (
      SELECT ROUND(EXTRACT(EPOCH FROM avg(responded_at - created_at)) / 60)
      FROM job_orders
      WHERE contractor_id = p_user_id AND responded_at IS NOT NULL
    ),
    'member_since', (SELECT created_at FROM profiles WHERE id = p_user_id),
    'network_points', COALESCE((SELECT network_points FROM profiles WHERE id = p_user_id), 0),
    'network_level', COALESCE((SELECT network_level FROM profiles WHERE id = p_user_id), 'member'),
    'available_today', COALESCE((SELECT available_today FROM contractors WHERE user_id = p_user_id), false)
  ) INTO result;

  RETURN result;
END;
$$;


-- ============================================================
-- 5. get_public_profile — for public profile page (no auth)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_public_profile(p_slug TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  result JSONB;
BEGIN
  SELECT user_id INTO v_user_id FROM contractor_profiles WHERE slug = p_slug;
  IF v_user_id IS NULL THEN RETURN NULL; END IF;

  SELECT jsonb_build_object(
    'user_id', cp.user_id,
    'slug', cp.slug,
    'headline', cp.headline,
    'bio', cp.bio,
    'years_experience', cp.years_experience,
    'business_name', cp.business_name,
    'license_number', cp.license_number,
    'insurance_verified', cp.insurance_verified,
    'background_check', cp.background_check,
    'languages', cp.languages,
    'team_size', cp.team_size,
    'website_url', cp.website_url,
    'avg_rating', cp.avg_rating,
    'review_count', cp.review_count,
    'completion_rate', cp.completion_rate,
    'tier', cp.tier,
    'profile_completeness', cp.profile_completeness,
    'full_name', p.full_name,
    'counties', p.counties,
    'professions', c.professions,
    'zip_codes', c.zip_codes,
    'available_today', c.available_today,
    'member_since', p.created_at,
    'stats', calculate_contractor_stats(cp.user_id)
  ) INTO result
  FROM contractor_profiles cp
  JOIN profiles p ON p.id = cp.user_id
  LEFT JOIN contractors c ON c.user_id = cp.user_id
  WHERE cp.user_id = v_user_id;

  RETURN result;
END;
$$;

-- Grant execute to anon + authenticated for public profile
GRANT EXECUTE ON FUNCTION public.get_public_profile(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_profile_completeness(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_contractor_stats(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_contractor_slug(UUID) TO authenticated;


-- ============================================================
-- 6. Seed: auto-create contractor_profiles for existing contractors
-- ============================================================
INSERT INTO contractor_profiles (user_id, bio, business_name, profile_completeness)
SELECT
  c.user_id,
  p.publisher_bio,
  p.publisher_company_name,
  0
FROM contractors c
JOIN profiles p ON p.id = c.user_id
ON CONFLICT DO NOTHING;

COMMIT;
