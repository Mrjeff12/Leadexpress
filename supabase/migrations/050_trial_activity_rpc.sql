CREATE OR REPLACE FUNCTION update_trial_sub_statuses()
RETURNS TABLE (just_started INTEGER, receiving INTEGER, engaged INTEGER, no_leads INTEGER, inactive INTEGER, expiring INTEGER)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_started INTEGER := 0;
  v_receiving INTEGER := 0;
  v_engaged INTEGER := 0;
  v_no_leads INTEGER := 0;
  v_inactive INTEGER := 0;
  v_expiring INTEGER := 0;
  r RECORD;
BEGIN
  FOR r IN
    SELECT p.id, p.sub_status AS old_sub, p.trial_ends_at, p.created_at AS trial_start,
      p.display_name, p.phone,
      EXTRACT(EPOCH FROM (now() - COALESCE(
        (SELECT pe.created_at FROM prospect_events pe
         WHERE pe.prospect_id = p.id AND pe.event_type = 'stage_change' AND pe.new_value = 'demo_trial'
         ORDER BY pe.created_at DESC LIMIT 1),
        p.created_at
      )))::integer / 3600 AS hours_in_trial,
      (SELECT count(*) FROM lead_contact_events lce
       JOIN profiles pr ON pr.id = lce.user_id
       WHERE pr.phone = p.phone) AS leads_viewed,
      GREATEST(
        (SELECT max(lce.created_at) FROM lead_contact_events lce
         JOIN profiles pr ON pr.id = lce.user_id WHERE pr.phone = p.phone),
        (SELECT max(pm.sent_at) FROM prospect_messages pm
         WHERE pm.prospect_id = p.id AND pm.direction = 'incoming')
      ) AS last_activity
    FROM prospects p
    WHERE p.stage = 'demo_trial' AND p.archived_at IS NULL
      AND p.sub_status NOT IN ('wants_to_pay')
  LOOP
    DECLARE
      new_sub TEXT;
      days_to_expire NUMERIC;
      days_inactive NUMERIC;
    BEGIN
      days_to_expire := CASE WHEN r.trial_ends_at IS NOT NULL
        THEN EXTRACT(EPOCH FROM (r.trial_ends_at - now())) / 86400.0
        ELSE 999 END;
      days_inactive := CASE WHEN r.last_activity IS NOT NULL
        THEN EXTRACT(EPOCH FROM (now() - r.last_activity)) / 86400.0
        ELSE r.hours_in_trial / 24.0 END;

      IF days_to_expire <= 3 AND days_to_expire > 0 THEN
        new_sub := 'expiring';
        v_expiring := v_expiring + 1;
      ELSIF r.leads_viewed > 0 THEN
        new_sub := 'engaged';
        v_engaged := v_engaged + 1;
      ELSIF r.hours_in_trial >= 48 AND r.leads_viewed = 0 THEN
        new_sub := 'no_leads';
        v_no_leads := v_no_leads + 1;
      ELSIF days_inactive >= 3 THEN
        new_sub := 'inactive';
        v_inactive := v_inactive + 1;
      ELSIF r.hours_in_trial < 24 THEN
        new_sub := 'just_started';
        v_started := v_started + 1;
      ELSE
        new_sub := 'receiving_leads';
        v_receiving := v_receiving + 1;
      END IF;

      IF r.old_sub IS DISTINCT FROM new_sub THEN
        UPDATE prospects SET sub_status = new_sub, sub_status_changed_at = now()
        WHERE id = r.id;
      END IF;
    END;
  END LOOP;

  RETURN QUERY SELECT v_started, v_receiving, v_engaged, v_no_leads, v_inactive, v_expiring;
END;
$$;
