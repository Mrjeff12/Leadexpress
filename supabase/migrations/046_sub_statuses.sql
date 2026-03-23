-- ============================================================
-- 046_sub_statuses.sql — Universal sub-status for all stages
-- ============================================================

-- Add universal sub_status column
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS sub_status TEXT;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS sub_status_changed_at TIMESTAMPTZ;

-- Index for pipeline filtering
CREATE INDEX IF NOT EXISTS idx_prospects_sub_status
  ON prospects (stage, sub_status) WHERE sub_status IS NOT NULL;

-- Migrate existing onboarding_step data
UPDATE prospects
SET sub_status = onboarding_step,
    sub_status_changed_at = COALESCE(onboarding_last_activity_at, now())
WHERE stage = 'onboarding' AND onboarding_step IS NOT NULL AND sub_status IS NULL;

-- Trigger: sync onboarding_step writes → sub_status for backwards compat
CREATE OR REPLACE FUNCTION trg_sync_onboarding_to_sub_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.onboarding_step IS DISTINCT FROM OLD.onboarding_step THEN
    NEW.sub_status := NEW.onboarding_step;
    NEW.sub_status_changed_at := now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sync_onboarding_to_sub_status ON prospects;
CREATE TRIGGER sync_onboarding_to_sub_status
  BEFORE UPDATE OF onboarding_step ON prospects
  FOR EACH ROW EXECUTE FUNCTION trg_sync_onboarding_to_sub_status();

-- Recreate view to include new columns
DROP VIEW IF EXISTS prospect_with_groups;
CREATE VIEW prospect_with_groups AS
SELECT id, wa_id, phone, display_name, profile_pic_url, wa_sender_id,
  profession_tags, group_ids, stage, assigned_wa_account_id, notes,
  last_contact_at, next_followup_at, archived_at, created_at, updated_at,
  onboarding_step, onboarding_started_at, onboarding_last_activity_at,
  sub_status, sub_status_changed_at,
  COALESCE((SELECT array_agg(g.name ORDER BY g.name) FROM groups g WHERE g.id = ANY(p.group_ids)), '{}'::text[]) AS group_names
FROM prospects p;

GRANT SELECT ON prospect_with_groups TO authenticated;
GRANT SELECT ON prospect_with_groups TO anon;
