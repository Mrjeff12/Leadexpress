-- Prospect Auto-Scoring RPC
-- Classifies prospects as hot/warm/cold/stale based on WhatsApp group activity
-- Called by watchdog every 6 hours

CREATE OR REPLACE FUNCTION score_prospects()
RETURNS TABLE (scored INTEGER, hot INTEGER, warm INTEGER, cold INTEGER, stale INTEGER)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_scored INTEGER := 0;
  v_hot INTEGER := 0;
  v_warm INTEGER := 0;
  v_cold INTEGER := 0;
  v_stale INTEGER := 0;
  r RECORD;
BEGIN
  FOR r IN
    SELECT p.id, p.wa_id, p.sub_status AS old_sub,
      -- Count active groups (not left)
      (SELECT count(DISTINCT gm.group_id)
       FROM group_members gm
       WHERE gm.wa_sender_id = p.wa_id AND gm.left_group_at IS NULL) AS active_groups,
      -- Is admin in any group?
      EXISTS(SELECT 1 FROM group_members gm
             WHERE gm.wa_sender_id = p.wa_id AND gm.classification = 'admin') AS is_admin,
      -- Is buyer in any group?
      EXISTS(SELECT 1 FROM group_members gm
             WHERE gm.wa_sender_id = p.wa_id AND gm.classification = 'buyer') AS is_buyer,
      -- Is seller in any group?
      EXISTS(SELECT 1 FROM group_members gm
             WHERE gm.wa_sender_id = p.wa_id AND gm.classification = 'seller') AS is_seller,
      -- Most recent seen in any group
      (SELECT max(gm.last_seen_at) FROM group_members gm
       WHERE gm.wa_sender_id = p.wa_id) AS latest_seen,
      -- Most recent join
      (SELECT max(gm.joined_group_at) FROM group_members gm
       WHERE gm.wa_sender_id = p.wa_id AND gm.left_group_at IS NULL) AS latest_join
    FROM prospects p
    WHERE p.stage = 'prospect'
      AND p.archived_at IS NULL
  LOOP
    DECLARE new_sub TEXT;
    BEGIN
      -- HOT: admin, 3+ groups, buyer, or joined in last 14 days
      IF r.is_admin
         OR r.active_groups >= 3
         OR r.is_buyer
         OR (r.latest_join IS NOT NULL AND r.latest_join > now() - interval '14 days')
      THEN
        new_sub := 'hot';
        v_hot := v_hot + 1;
      -- WARM: 2+ groups, seen in 30 days (non-seller), or joined in 30 days
      ELSIF r.active_groups >= 2
         OR (r.latest_seen IS NOT NULL AND r.latest_seen > now() - interval '30 days' AND NOT r.is_seller)
         OR (r.latest_join IS NOT NULL AND r.latest_join > now() - interval '30 days')
      THEN
        new_sub := 'warm';
        v_warm := v_warm + 1;
      -- STALE: not seen in 90+ days, or left all groups
      ELSIF r.latest_seen IS NULL
         OR r.latest_seen < now() - interval '90 days'
         OR r.active_groups = 0
      THEN
        new_sub := 'stale';
        v_stale := v_stale + 1;
      -- COLD: everything else (1 group, not seen in 30-90 days, or seller)
      ELSE
        new_sub := 'cold';
        v_cold := v_cold + 1;
      END IF;

      -- Only update if changed
      IF r.old_sub IS DISTINCT FROM new_sub THEN
        UPDATE prospects SET sub_status = new_sub, sub_status_changed_at = now()
        WHERE id = r.id;
        v_scored := v_scored + 1;
      END IF;
    END;
  END LOOP;

  RETURN QUERY SELECT v_scored, v_hot, v_warm, v_cold, v_stale;
END;
$$;
