-- Add trial_expired to prospect_stage enum
ALTER TYPE prospect_stage ADD VALUE IF NOT EXISTS 'trial_expired' AFTER 'demo_trial';

-- Add trial tracking column
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz;

-- Backfill: any demo_trial prospects created > 7 days ago should be trial_expired
UPDATE prospects
SET stage = 'trial_expired'
WHERE stage = 'demo_trial'
  AND created_at < now() - interval '7 days';
