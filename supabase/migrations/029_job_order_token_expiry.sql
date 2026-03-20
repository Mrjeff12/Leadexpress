-- 029: Add token expiry to job orders for security

-- 1. Add expiry column with 7-day default
ALTER TABLE public.job_orders
  ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMPTZ DEFAULT now() + INTERVAL '7 days';

-- 2. Update get_job_order_by_token to reject expired tokens
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
      'summary', l.summary,
      'description', l.description,
      'sender_id', CASE WHEN jo.status = 'accepted' THEN l.sender_id ELSE NULL END
    )
  ) INTO result
  FROM public.job_orders jo
  JOIN public.leads l ON jo.lead_id = l.id
  JOIN public.profiles p ON jo.contractor_id = p.id
  WHERE jo.access_token = token
    AND (jo.token_expires_at IS NULL OR jo.token_expires_at > now());

  RETURN result;
END;
$$;
