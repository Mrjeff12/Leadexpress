-- ============================================================
-- 106: Accept / Reject Job Order RPCs
-- Allows assigned contractor to accept or reject a pending job.
-- ============================================================
BEGIN;

DROP FUNCTION IF EXISTS public.accept_job_order(UUID);
DROP FUNCTION IF EXISTS public.reject_job_order(UUID);

-- ─── accept_job_order ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.accept_job_order(p_job_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_job RECORD;
BEGIN
  SELECT * INTO v_job
  FROM job_orders
  WHERE id = p_job_order_id
  FOR UPDATE;

  IF v_job IS NULL THEN
    RAISE EXCEPTION 'Job order not found';
  END IF;

  IF v_job.assigned_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Only the assigned contractor can accept this job';
  END IF;

  IF v_job.status != 'pending' THEN
    RAISE EXCEPTION 'Job can only be accepted from pending status (current: %)', v_job.status;
  END IF;

  UPDATE job_orders
  SET status = 'accepted',
      responded_at = now(),
      updated_at = now()
  WHERE id = p_job_order_id;

  -- Log event
  INSERT INTO job_events (job_order_id, event_type, description, created_by)
  VALUES (p_job_order_id, 'accepted', 'Job accepted by contractor', auth.uid());

  RETURN jsonb_build_object(
    'job_order_id', p_job_order_id,
    'status', 'accepted'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_job_order(UUID) TO authenticated;


-- ─── reject_job_order ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.reject_job_order(p_job_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_job RECORD;
BEGIN
  SELECT * INTO v_job
  FROM job_orders
  WHERE id = p_job_order_id
  FOR UPDATE;

  IF v_job IS NULL THEN
    RAISE EXCEPTION 'Job order not found';
  END IF;

  IF v_job.assigned_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Only the assigned contractor can reject this job';
  END IF;

  IF v_job.status != 'pending' THEN
    RAISE EXCEPTION 'Job can only be rejected from pending status (current: %)', v_job.status;
  END IF;

  -- 1. Mark job_order as rejected
  UPDATE job_orders
  SET status = 'rejected',
      responded_at = now(),
      updated_at = now()
  WHERE id = p_job_order_id;

  -- 2. Log event
  INSERT INTO job_events (job_order_id, event_type, description, created_by)
  VALUES (p_job_order_id, 'rejected', 'Job rejected by contractor', auth.uid());

  -- 3. Reopen the broadcast so publisher can choose another contractor
  IF v_job.broadcast_id IS NOT NULL THEN
    UPDATE job_broadcasts
    SET status = 'open',
        updated_at = now()
    WHERE id = v_job.broadcast_id
      AND status = 'assigned';

    -- Reset the chosen response back to interested
    UPDATE job_broadcast_responses
    SET status = 'interested'
    WHERE broadcast_id = v_job.broadcast_id
      AND contractor_id = auth.uid()
      AND status = 'chosen';

    -- Re-open closed responses so publisher has full pool again
    UPDATE job_broadcast_responses
    SET status = 'interested'
    WHERE broadcast_id = v_job.broadcast_id
      AND status = 'closed';
  END IF;

  RETURN jsonb_build_object(
    'job_order_id', p_job_order_id,
    'status', 'rejected',
    'broadcast_reopened', v_job.broadcast_id IS NOT NULL
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.reject_job_order(UUID) TO authenticated;

COMMIT;
