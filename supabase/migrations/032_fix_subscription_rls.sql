-- 032_fix_subscription_rls.sql
-- Fix critical RLS vulnerability: subscriptions_own grants FOR ALL,
-- allowing users to UPDATE their own subscription status (e.g. set status='active').
-- Solution: split into granular policies and move trial expiry server-side.

-- 1. Drop the overly-permissive policy
DROP POLICY IF EXISTS subscriptions_own ON public.subscriptions;

-- 2. SELECT: users see their own row; admins see all
CREATE POLICY subscriptions_select ON public.subscriptions
  FOR SELECT USING (
    user_id = auth.uid()
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

-- 3. INSERT: users can insert their own row (needed for checkout/onboarding flows)
CREATE POLICY subscriptions_insert ON public.subscriptions
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

-- 4. UPDATE: only admins can update subscriptions directly
CREATE POLICY subscriptions_update ON public.subscriptions
  FOR UPDATE USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

-- 5. DELETE: only admins can delete subscriptions
CREATE POLICY subscriptions_delete ON public.subscriptions
  FOR DELETE USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

-- 6. Security-definer function for trial expiry (bypasses RLS)
CREATE OR REPLACE FUNCTION public.expire_trial()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.subscriptions
  SET status = 'canceled'
  WHERE user_id = auth.uid()
    AND status = 'trialing'
    AND current_period_end < now();
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.expire_trial() TO authenticated;
