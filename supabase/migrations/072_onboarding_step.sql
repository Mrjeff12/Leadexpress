-- Add onboarding tracking to contractors
ALTER TABLE contractors
ADD COLUMN IF NOT EXISTS onboarding_step TEXT DEFAULT 'registered';

-- Index for Rebeca nudge queries
CREATE INDEX IF NOT EXISTS idx_contractors_onboarding_step
ON contractors (onboarding_step)
WHERE onboarding_step IS DISTINCT FROM 'push_enabled';

-- Track when last nudge was sent (avoid spam)
ALTER TABLE contractors
ADD COLUMN IF NOT EXISTS onboarding_nudge_sent_at TIMESTAMPTZ;
