-- supabase/migrations/069_push_subscriptions.sql

CREATE TABLE public.push_subscriptions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  endpoint    text NOT NULL,
  p256dh      text NOT NULL,
  auth        text NOT NULL,
  user_agent  text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, endpoint)
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Contractors can read/write only their own subscriptions
CREATE POLICY "push_subscriptions_own"
  ON public.push_subscriptions
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Service role (backend) can read all subscriptions to send pushes
-- (service role bypasses RLS by default — no extra policy needed)

COMMENT ON TABLE public.push_subscriptions IS
  'Browser Web Push subscriptions for contractors. Each row is one browser/device.';
