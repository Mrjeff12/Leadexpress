-- 025: Add missing INSERT policy for contractors table
-- The upsert in useContractorSettings was failing with 403
-- because only SELECT and UPDATE policies existed

CREATE POLICY contractors_insert ON public.contractors
  FOR INSERT WITH CHECK (user_id = auth.uid());
