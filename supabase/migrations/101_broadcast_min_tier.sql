-- ============================================================
-- 101: Add min_tier to job_broadcasts
-- Allows publishers to optionally require a minimum contractor
-- tier for their broadcasts. NULL = all tiers welcome.
-- ============================================================

ALTER TABLE public.job_broadcasts
  ADD COLUMN min_tier TEXT DEFAULT NULL
  CHECK (min_tier IS NULL OR min_tier IN ('verified', 'trusted', 'elite'));

COMMENT ON COLUMN public.job_broadcasts.min_tier IS
  'Minimum contractor tier required. NULL = all tiers welcome.';
