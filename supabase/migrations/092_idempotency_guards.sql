-- 092: Idempotency guards — prevent duplicate sends and messages on retries

-- 1. Broadcast send dedup log
CREATE TABLE IF NOT EXISTS public.broadcast_sent_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  broadcast_id  uuid NOT NULL REFERENCES public.job_broadcasts(id) ON DELETE CASCADE,
  contractor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  sent_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE(broadcast_id, contractor_id)
);
ALTER TABLE public.broadcast_sent_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_only" ON public.broadcast_sent_log
  USING (auth.role() = 'service_role');

-- 2. Twilio inbound message dedup
CREATE TABLE IF NOT EXISTS public.twilio_message_dedup (
  message_sid text PRIMARY KEY,
  created_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.twilio_message_dedup ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_only" ON public.twilio_message_dedup
  USING (auth.role() = 'service_role');

-- Cleanup old entries (called by pg_cron)
CREATE OR REPLACE FUNCTION public.cleanup_twilio_message_dedup()
RETURNS void LANGUAGE sql AS $$
  DELETE FROM public.twilio_message_dedup WHERE created_at < now() - interval '7 days';
$$;

-- Schedule cleanup (if pg_cron available)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule('cleanup-twilio-dedup', '17 3 * * *',
      'SELECT public.cleanup_twilio_message_dedup()');
  END IF;
END $$;

-- 3. Unique index on prospect_messages.wa_message_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_prospect_messages_wa_dedup
  ON public.prospect_messages(wa_message_id)
  WHERE wa_message_id IS NOT NULL;
