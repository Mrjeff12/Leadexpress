-- Add onboarding sub-step tracking to prospects
ALTER TABLE prospects
  ADD COLUMN IF NOT EXISTS onboarding_step TEXT,
  ADD COLUMN IF NOT EXISTS onboarding_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS onboarding_last_activity_at TIMESTAMPTZ;

-- Index for admin queries
CREATE INDEX IF NOT EXISTS idx_prospects_onboarding
  ON prospects (onboarding_step, onboarding_last_activity_at DESC)
  WHERE stage = 'onboarding' AND onboarding_step IS NOT NULL;

-- Backfill from wa_onboard_state for any currently stuck prospects
UPDATE prospects p
SET onboarding_step = ws.step,
    onboarding_started_at = COALESCE(p.created_at, now()),
    onboarding_last_activity_at = ws.updated_at
FROM wa_onboard_state ws
WHERE p.phone = ws.phone
  AND p.stage = 'onboarding';
