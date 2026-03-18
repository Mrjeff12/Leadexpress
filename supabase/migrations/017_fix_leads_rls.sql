-- 017: Fix leads RLS to use is_admin() helper (avoids self-referencing RLS on profiles)
DROP POLICY IF EXISTS leads_read ON public.leads;
CREATE POLICY leads_read ON public.leads
  FOR SELECT USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM contractors c
      WHERE c.user_id = auth.uid()
        AND c.is_active = true
        AND leads.profession = ANY(c.professions)
        AND leads.zip_code = ANY(c.zip_codes)
    )
  );
