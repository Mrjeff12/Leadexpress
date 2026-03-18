-- 016: Fix pipeline_events/group_members RLS + auto-populate profiles

-- 1. Trigger to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, role, full_name)
  VALUES (new.id, 'contractor', COALESCE(new.raw_user_meta_data->>'full_name', 'User'))
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. Backfill: set ALL existing auth.users as admin
INSERT INTO public.profiles (id, role, full_name)
SELECT id, 'admin', COALESCE(raw_user_meta_data->>'full_name', 'Admin')
FROM auth.users
ON CONFLICT (id) DO UPDATE SET role = 'admin';

-- 3. Fix pipeline_events RLS: use is_admin() helper
DROP POLICY IF EXISTS pe_admin_read ON public.pipeline_events;
CREATE POLICY pe_admin_read ON public.pipeline_events
  FOR SELECT USING (public.is_admin());

-- 4. Fix group_members RLS: use is_admin() helper
DROP POLICY IF EXISTS gm_admin ON public.group_members;

CREATE POLICY gm_admin_select ON public.group_members
  FOR SELECT USING (public.is_admin());

CREATE POLICY gm_admin_update ON public.group_members
  FOR UPDATE USING (public.is_admin());
