-- ============================================================
-- 096: Add contractor_id to prospect_with_groups view
-- ============================================================

DROP VIEW IF EXISTS prospect_with_groups;
CREATE VIEW prospect_with_groups AS
SELECT id, wa_id, phone, display_name, profile_pic_url, wa_sender_id,
  profession_tags, group_ids, contractor_id, stage, assigned_wa_account_id, notes,
  last_contact_at, next_followup_at, archived_at, created_at, updated_at,
  onboarding_step, onboarding_started_at, onboarding_last_activity_at,
  sub_status, sub_status_changed_at,
  COALESCE((SELECT array_agg(g.name ORDER BY g.name) FROM groups g WHERE g.id = ANY(p.group_ids)), '{}'::text[]) AS group_names
FROM prospects p;

GRANT SELECT ON prospect_with_groups TO authenticated;
GRANT SELECT ON prospect_with_groups TO anon;
