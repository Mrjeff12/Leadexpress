-- ============================================================
-- P2 Security Fix: Ensure push_subscriptions has RLS enabled
-- ============================================================
-- Migration 069 creates push_subscriptions with RLS enabled,
-- but migration 070 uses CREATE TABLE IF NOT EXISTS without
-- enabling RLS. If 069 was skipped or failed, the table could
-- exist without RLS. This is a safety net.

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Ensure the user-scoped policy exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'push_subscriptions'
      AND policyname = 'push_subscriptions_own'
  ) THEN
    CREATE POLICY push_subscriptions_own
      ON public.push_subscriptions
      FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END
$$;
