-- ============================================================
-- Security fixes: prevent role self-escalation
-- ============================================================

-- Drop the existing UPDATE policy (no WITH CHECK)
DROP POLICY IF EXISTS profiles_update ON public.profiles;

-- Recreate with WITH CHECK that prevents role changes by non-admins
CREATE POLICY profiles_update ON public.profiles
  FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (
    -- Admin can update anything
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
    OR
    -- Non-admin: role must stay the same (cannot self-escalate)
    role = (SELECT role FROM public.profiles WHERE id = auth.uid())
  );
