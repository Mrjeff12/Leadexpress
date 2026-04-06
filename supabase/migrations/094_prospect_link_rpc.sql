-- ============================================================
-- 094: Admin RPC to manually link/unlink prospect <-> contractor
-- ============================================================

CREATE OR REPLACE FUNCTION public.admin_link_prospect_contractor(
  p_prospect_id UUID,
  p_contractor_id UUID  -- NULL to unlink
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only admins
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'admin only';
  END IF;

  -- Validate contractor exists (if linking)
  IF p_contractor_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM contractors WHERE user_id = p_contractor_id) THEN
      RAISE EXCEPTION 'contractor not found';
    END IF;
  END IF;

  UPDATE prospects
  SET contractor_id = p_contractor_id,
      updated_at = now()
  WHERE id = p_prospect_id;

  -- Log event
  INSERT INTO prospect_events (prospect_id, event_type, old_value, new_value, changed_by)
  VALUES (
    p_prospect_id,
    'profile_updated',
    NULL,
    CASE WHEN p_contractor_id IS NOT NULL
      THEN 'linked to contractor ' || p_contractor_id::TEXT
      ELSE 'unlinked from contractor'
    END,
    auth.uid()
  );
END;
$$;
