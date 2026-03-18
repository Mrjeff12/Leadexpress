-- 020: Fix subcontractor feature bugs

-- Bug 1: Fix get_job_order_by_token - uses wrong column names (summary/description instead of parsed_summary/raw_message)
CREATE OR REPLACE FUNCTION get_job_order_by_token(token UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'id', jo.id,
    'lead_id', jo.lead_id,
    'contractor_id', jo.contractor_id,
    'subcontractor_id', jo.subcontractor_id,
    'deal_type', jo.deal_type,
    'deal_value', jo.deal_value,
    'status', jo.status,
    'created_at', jo.created_at,
    'updated_at', jo.updated_at,
    'contractor_name', COALESCE(p.business_name, p.full_name, 'A contractor'),
    'lead', json_build_object(
      'city', l.city,
      'zip_code', l.zip_code,
      'urgency', l.urgency,
      'summary', l.parsed_summary,
      'description', l.raw_message,
      'sender_id', CASE WHEN jo.status = 'accepted' THEN l.sender_id ELSE NULL END
    )
  ) INTO result
  FROM public.job_orders jo
  JOIN public.leads l ON jo.lead_id = l.id
  JOIN public.profiles p ON jo.contractor_id = p.id
  WHERE jo.access_token = token;

  -- Mark as viewed
  UPDATE public.job_orders SET viewed_at = COALESCE(viewed_at, now()) WHERE access_token = token;

  RETURN result;
END;
$$;

-- Bug 7: Fix update_job_order_status_by_token - add status validation + prevent re-accepting
CREATE OR REPLACE FUNCTION update_job_order_status_by_token(token UUID, new_status TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
  current_status TEXT;
BEGIN
  -- Validate status value
  IF new_status NOT IN ('accepted', 'rejected') THEN
    RAISE EXCEPTION 'Invalid status: %. Allowed: accepted, rejected', new_status;
  END IF;

  -- Check current status
  SELECT status INTO current_status FROM public.job_orders WHERE access_token = token;

  IF current_status IS NULL THEN
    RAISE EXCEPTION 'Job order not found';
  END IF;

  IF current_status != 'pending' THEN
    RAISE EXCEPTION 'Job order already %', current_status;
  END IF;

  UPDATE public.job_orders
  SET status = new_status, responded_at = now(), updated_at = now()
  WHERE access_token = token;

  SELECT get_job_order_by_token(token) INTO result;

  RETURN result;
END;
$$;
