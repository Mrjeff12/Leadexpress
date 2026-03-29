-- ============================================================
-- 060: Work Preferences for Contractor Profiles
-- Adds fields for what types of jobs a contractor accepts
-- and exposes whatsapp_phone in public profile for CTA
-- ============================================================

BEGIN;

-- 1. Add work preference columns
ALTER TABLE public.contractor_profiles
  ADD COLUMN IF NOT EXISTS accepts_percentage BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS accepts_fixed BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS accepts_subwork BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS min_job_value INTEGER,
  ADD COLUMN IF NOT EXISTS max_job_value INTEGER;

-- 2. Update get_public_profile to return work preferences + whatsapp_phone
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

COMMIT;
