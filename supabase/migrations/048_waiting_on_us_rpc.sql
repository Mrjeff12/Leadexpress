-- ============================================================
-- 048_waiting_on_us_rpc.sql — Conversation sub-status automation
-- Detects: waiting_on_us, waiting_on_them, active, gone_quiet
-- ============================================================

-- RPC 1: detect_waiting_on_us — returns prospects waiting for our reply (for alerts)
CREATE OR REPLACE FUNCTION detect_waiting_on_us()
RETURNS TABLE (
  prospect_id UUID,
  prospect_name TEXT,
  prospect_phone TEXT,
  minutes_waiting INTEGER,
  current_sub TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  WITH last_messages AS (
    SELECT DISTINCT ON (pm.prospect_id)
      pm.prospect_id,
      pm.direction,
      pm.sent_at
    FROM prospect_messages pm
    JOIN prospects p ON p.id = pm.prospect_id
    WHERE p.stage = 'in_conversation'
      AND p.archived_at IS NULL
    ORDER BY pm.prospect_id, pm.sent_at DESC
  )
  SELECT
    p.id AS prospect_id,
    COALESCE(p.display_name, p.phone)::TEXT AS prospect_name,
    p.phone::TEXT AS prospect_phone,
    (EXTRACT(EPOCH FROM (now() - lm.sent_at))::integer / 60) AS minutes_waiting,
    p.sub_status::TEXT AS current_sub
  FROM last_messages lm
  JOIN prospects p ON p.id = lm.prospect_id
  WHERE lm.direction = 'incoming'
    AND lm.sent_at < now() - interval '30 minutes';
$$;

-- RPC 2: update_conversation_sub_statuses — bulk update all in_conversation sub-statuses
CREATE OR REPLACE FUNCTION update_conversation_sub_statuses()
RETURNS TABLE (waiting_on_us INTEGER, waiting_on_them INTEGER, active INTEGER, gone_quiet INTEGER)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_wou INTEGER := 0;
  v_wot INTEGER := 0;
  v_active INTEGER := 0;
  v_quiet INTEGER := 0;
  r RECORD;
BEGIN
  FOR r IN
    SELECT p.id, p.sub_status AS old_sub,
      (SELECT direction FROM prospect_messages pm
       WHERE pm.prospect_id = p.id ORDER BY pm.sent_at DESC LIMIT 1) AS last_direction,
      (SELECT sent_at FROM prospect_messages pm
       WHERE pm.prospect_id = p.id ORDER BY pm.sent_at DESC LIMIT 1) AS last_msg_at,
      (SELECT sent_at FROM prospect_messages pm
       WHERE pm.prospect_id = p.id AND pm.direction = 'incoming' ORDER BY pm.sent_at DESC LIMIT 1) AS last_incoming_at
    FROM prospects p
    WHERE p.stage = 'in_conversation' AND p.archived_at IS NULL
      AND (p.sub_status IS NULL OR p.sub_status NOT IN ('scheduled', 'sent_link', 'not_interested', 'asking_price', 'hesitating'))
  LOOP
    DECLARE new_sub TEXT; minutes_since INTEGER;
    BEGIN
      minutes_since := EXTRACT(EPOCH FROM (now() - COALESCE(r.last_msg_at, now())))::integer / 60;

      IF r.last_direction = 'incoming' AND minutes_since >= 30 THEN
        new_sub := 'waiting_on_us';
        v_wou := v_wou + 1;
      ELSIF r.last_direction = 'incoming' AND minutes_since < 30 THEN
        new_sub := 'active';
        v_active := v_active + 1;
      ELSIF r.last_direction = 'outgoing' AND minutes_since >= 10080 THEN
        -- 7 days no reply = gone quiet
        new_sub := 'gone_quiet';
        v_quiet := v_quiet + 1;
      ELSIF r.last_direction = 'outgoing' THEN
        new_sub := 'waiting_on_them';
        v_wot := v_wot + 1;
      ELSE
        new_sub := 'active';
        v_active := v_active + 1;
      END IF;

      IF r.old_sub IS DISTINCT FROM new_sub THEN
        UPDATE prospects SET sub_status = new_sub, sub_status_changed_at = now() WHERE id = r.id;
      END IF;
    END;
  END LOOP;

  RETURN QUERY SELECT v_wou, v_wot, v_active, v_quiet;
END;
$$;
