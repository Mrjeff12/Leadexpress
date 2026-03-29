-- ============================================================
-- 061: Complete Profile System
-- Avatar photos, auto-creation trigger, profile views tracking,
-- contractor directory search RPC
-- ============================================================

BEGIN;

-- 1. Avatar URL field
ALTER TABLE public.contractor_profiles
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- 2. Auto-create contractor_profiles when a contractor is created
CREATE OR REPLACE FUNCTION public.auto_create_contractor_profile()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO contractor_profiles (user_id)
  VALUES (NEW.user_id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_contractor_created ON public.contractors;
CREATE TRIGGER on_contractor_created
  AFTER INSERT ON public.contractors
  FOR EACH ROW EXECUTE FUNCTION auto_create_contractor_profile();

-- 3. Profile views tracking
CREATE TABLE IF NOT EXISTS public.profile_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  viewer_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pv_profile ON public.profile_views(profile_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pv_viewer ON public.profile_views(viewer_user_id, created_at DESC);

ALTER TABLE public.profile_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY pv_insert ON public.profile_views FOR INSERT WITH CHECK (true);
CREATE POLICY pv_read_own ON public.profile_views FOR SELECT
  USING (profile_user_id = auth.uid() OR viewer_user_id = auth.uid());

-- 4. Record profile view (rate-limited: 1 per viewer per profile per hour)
CREATE OR REPLACE FUNCTION public.record_profile_view(p_slug TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_profile_user_id UUID;
  v_viewer UUID := auth.uid();
BEGIN
  SELECT user_id INTO v_profile_user_id
  FROM contractor_profiles WHERE slug = p_slug;

  IF v_profile_user_id IS NULL THEN RETURN; END IF;
  -- Don't count self-views
  IF v_viewer = v_profile_user_id THEN RETURN; END IF;

  -- Rate limit: 1 view per viewer per profile per hour
  IF v_viewer IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM profile_views
      WHERE profile_user_id = v_profile_user_id
        AND viewer_user_id = v_viewer
        AND created_at > now() - interval '1 hour'
    ) THEN RETURN; END IF;
  END IF;

  INSERT INTO profile_views (profile_user_id, viewer_user_id)
  VALUES (v_profile_user_id, v_viewer);
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_profile_view(TEXT) TO anon, authenticated;

-- 5. Get profile view stats for own profile
CREATE OR REPLACE FUNCTION public.get_profile_view_stats(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'total_views', (SELECT count(*) FROM profile_views WHERE profile_user_id = p_user_id),
    'views_this_week', (SELECT count(*) FROM profile_views WHERE profile_user_id = p_user_id AND created_at > now() - interval '7 days'),
    'views_today', (SELECT count(*) FROM profile_views WHERE profile_user_id = p_user_id AND created_at > now() - interval '1 day')
  ) INTO result;
  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_profile_view_stats(UUID) TO authenticated;

-- 6. Update get_public_profile to include avatar_url
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
    'whatsapp_phone', p.whatsapp_phone,
    'avatar_url', cp.avatar_url,
    'accepts_percentage', cp.accepts_percentage,
    'accepts_fixed', cp.accepts_fixed,
    'accepts_subwork', cp.accepts_subwork,
    'min_job_value', cp.min_job_value,
    'max_job_value', cp.max_job_value,
    'stats', calculate_contractor_stats(cp.user_id)
  ) INTO result
  FROM contractor_profiles cp
  JOIN profiles p ON p.id = cp.user_id
  LEFT JOIN contractors c ON c.user_id = cp.user_id
  WHERE cp.user_id = v_user_id;

  RETURN result;
END;
$$;

-- 7. Search contractors RPC for directory page
CREATE OR REPLACE FUNCTION public.search_contractors(
  p_query TEXT DEFAULT NULL,
  p_profession TEXT DEFAULT NULL,
  p_state TEXT DEFAULT NULL,
  p_tier TEXT DEFAULT NULL,
  p_available BOOLEAN DEFAULT NULL,
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_agg(row_data) INTO result
  FROM (
    SELECT jsonb_build_object(
      'user_id', cp.user_id,
      'slug', cp.slug,
      'full_name', p.full_name,
      'business_name', cp.business_name,
      'headline', cp.headline,
      'avatar_url', cp.avatar_url,
      'professions', c.professions,
      'zip_codes', c.zip_codes,
      'counties', p.counties,
      'tier', cp.tier,
      'avg_rating', cp.avg_rating,
      'review_count', cp.review_count,
      'available_today', c.available_today,
      'background_check', cp.background_check,
      'member_since', p.created_at
    ) AS row_data
    FROM contractor_profiles cp
    JOIN profiles p ON p.id = cp.user_id
    LEFT JOIN contractors c ON c.user_id = cp.user_id
    WHERE cp.slug IS NOT NULL
      AND (p_query IS NULL OR (
        p.full_name ILIKE '%' || p_query || '%'
        OR cp.business_name ILIKE '%' || p_query || '%'
        OR cp.headline ILIKE '%' || p_query || '%'
      ))
      AND (p_profession IS NULL OR p_profession = ANY(c.professions))
      AND (p_tier IS NULL OR cp.tier = p_tier)
      AND (p_available IS NULL OR c.available_today = p_available)
    ORDER BY cp.reputation_score DESC NULLS LAST, cp.review_count DESC, p.created_at ASC
    LIMIT p_limit OFFSET p_offset
  ) sub;

  RETURN COALESCE(result, '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_contractors(TEXT, TEXT, TEXT, TEXT, BOOLEAN, INTEGER, INTEGER) TO anon, authenticated;

COMMIT;
