-- 009_wa_registration.sql
-- Prerequisites for WhatsApp-first contractor registration

-- 1. Add 'trialing' to subscription status CHECK
ALTER TABLE public.subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_status_check;
ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_status_check
  CHECK (status IN ('active', 'past_due', 'canceled', 'paused', 'trialing'));

-- 2. Unique constraint on whatsapp_phone (prevent duplicate WA registrations)
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_whatsapp_phone_unique
  UNIQUE (whatsapp_phone);

-- 3. Unique index on phone where not null
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_phone_unique
  ON public.profiles (phone)
  WHERE phone IS NOT NULL;

-- 4. Opt-out tracking table (TCPA/WhatsApp compliance)
CREATE TABLE IF NOT EXISTS public.wa_opt_outs (
  phone        TEXT PRIMARY KEY,
  opted_out_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.wa_opt_outs ENABLE ROW LEVEL SECURITY;

CREATE POLICY wa_opt_outs_admin ON public.wa_opt_outs
  FOR ALL USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );
