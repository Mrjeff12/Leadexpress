-- ============================================================
-- 093: Link prospects to contractors via contractor_id FK
-- ============================================================

-- 1. Add nullable FK column
ALTER TABLE public.prospects
  ADD COLUMN contractor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX idx_prospects_contractor_id ON public.prospects(contractor_id)
  WHERE contractor_id IS NOT NULL;

-- 2. Backfill existing matches by phone
UPDATE public.prospects p
SET contractor_id = pr.id
FROM public.profiles pr
JOIN public.contractors c ON c.user_id = pr.id
WHERE pr.phone = p.phone
  AND p.contractor_id IS NULL;

-- 3. Trigger: auto-link when a new contractor signs up
CREATE OR REPLACE FUNCTION public.link_prospect_on_contractor_insert()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_phone TEXT;
BEGIN
  -- Get the phone from the profile
  SELECT phone INTO v_phone
  FROM public.profiles
  WHERE id = NEW.user_id;

  IF v_phone IS NOT NULL THEN
    UPDATE public.prospects
    SET contractor_id = NEW.user_id,
        updated_at = now()
    WHERE phone = v_phone
      AND contractor_id IS NULL;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_link_prospect_on_contractor_insert
  AFTER INSERT ON public.contractors
  FOR EACH ROW
  EXECUTE FUNCTION public.link_prospect_on_contractor_insert();

-- 4. Update RLS: contractors can see their own prospect record
CREATE POLICY "contractors_view_own_prospect"
  ON public.prospects
  FOR SELECT
  USING (contractor_id = auth.uid());
