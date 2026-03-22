-- 039: Add counties support + teaser tracking columns
-- Counties replace ZIP codes as primary geographic matching unit
-- Teaser columns track weekly lead previews for non-paying users

-- Counties array for geographic matching
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS counties TEXT[] DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_profiles_counties
  ON public.profiles USING GIN (counties);

-- Teaser rate limiting (max 3/week for non-paying users)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS teasers_sent_this_week INTEGER DEFAULT 0;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS teaser_week_start TIMESTAMPTZ;
