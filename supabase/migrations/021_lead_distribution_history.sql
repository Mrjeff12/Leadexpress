-- 021: Add matched_contractors array to leads to prevent retroactive access
ALTER TABLE public.leads 
ADD COLUMN matched_contractors UUID[] DEFAULT '{}'::UUID[];

-- Update RLS policy to use the new matched_contractors array
DROP POLICY IF EXISTS leads_read ON public.leads;
CREATE POLICY leads_read ON public.leads
  FOR SELECT USING (
    public.is_admin()
    OR (auth.uid() = ANY(matched_contractors))
  );

-- Backfill existing leads: for any lead already in the system, 
-- we'll populate matched_contractors based on current contractor settings 
-- so existing users don't suddenly lose access to leads they already saw.
UPDATE public.leads l
SET matched_contractors = ARRAY(
  SELECT c.user_id 
  FROM public.contractors c
  WHERE c.is_active = true
    AND l.profession = ANY(c.professions)
    AND (l.zip_code IS NULL OR l.zip_code = ANY(c.zip_codes))
)
WHERE matched_contractors = '{}'::UUID[];
