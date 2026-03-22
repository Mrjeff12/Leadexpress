-- Returns subscriber emails for admin use
-- Uses SECURITY DEFINER to access auth.users (which RLS can't reach)
CREATE OR REPLACE FUNCTION public.admin_subscriber_emails()
RETURNS TABLE(user_id UUID, email TEXT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT s.user_id, u.email::TEXT
  FROM public.subscriptions s
  JOIN auth.users u ON u.id = s.user_id;
$$;

-- Only admins can call this
REVOKE EXECUTE ON FUNCTION public.admin_subscriber_emails() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_subscriber_emails() TO authenticated;
