-- Migration 064: Create missing tables referenced in code but not in prior migrations
-- Tables: job_events, telegram_link_tokens, campaigns

-- ══════════════════════════════════════════════════════════════
-- 1. job_events — timeline/audit log for job_orders
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.job_events (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  job_order_id uuid NOT NULL REFERENCES public.job_orders(id) ON DELETE CASCADE,
  event_type  text NOT NULL,  -- created, sent, viewed, accepted, rejected, completed, payment, note, reminder
  description text,
  created_by  uuid REFERENCES auth.users(id),
  created_at  timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_job_events_order ON public.job_events(job_order_id, created_at DESC);

ALTER TABLE public.job_events ENABLE ROW LEVEL SECURITY;

-- Users can see events for job_orders they own or are assigned to
CREATE POLICY job_events_select ON public.job_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.job_orders jo
      WHERE jo.id = job_events.job_order_id
        AND (
          jo.contractor_id = auth.uid()
          OR jo.assigned_user_id = auth.uid()
          OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
        )
    )
  );

-- Users can insert events for job_orders they own or are assigned to
CREATE POLICY job_events_insert ON public.job_events
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.job_orders jo
      WHERE jo.id = job_events.job_order_id
        AND (
          jo.contractor_id = auth.uid()
          OR jo.assigned_user_id = auth.uid()
          OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
        )
    )
  );

-- ══════════════════════════════════════════════════════════════
-- 2. telegram_link_tokens — one-time tokens for Telegram bot linking
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.telegram_link_tokens (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  token      text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_telegram_link_token ON public.telegram_link_tokens(token);

ALTER TABLE public.telegram_link_tokens ENABLE ROW LEVEL SECURITY;

-- Users can only manage their own tokens
CREATE POLICY telegram_tokens_own ON public.telegram_link_tokens
  FOR ALL USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ══════════════════════════════════════════════════════════════
-- 3. campaigns — admin broadcast campaigns for prospect nudges
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.campaigns (
  id                uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name              text NOT NULL,
  stage_filter      text NOT NULL DEFAULT 'prospect',
  sub_status_filter text NOT NULL DEFAULT 'hot',
  template_slug     text NOT NULL,
  status            text NOT NULL DEFAULT 'draft',  -- draft, scheduled, sending, sent, failed
  sent_count        int DEFAULT 0,
  delivered_count   int DEFAULT 0,
  read_count        int DEFAULT 0,
  scheduled_at      timestamptz,
  created_at        timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

-- Admin-only access
CREATE POLICY campaigns_admin ON public.campaigns
  FOR ALL USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  )
  WITH CHECK (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

-- ══════════════════════════════════════════════════════════════
-- 4. Add missing columns to job_orders (used in JobDetailPanel)
-- ══════════════════════════════════════════════════════════════
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='job_orders' AND column_name='payment_status') THEN
    ALTER TABLE public.job_orders ADD COLUMN payment_status text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='job_orders' AND column_name='payment_amount') THEN
    ALTER TABLE public.job_orders ADD COLUMN payment_amount numeric;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='job_orders' AND column_name='payment_date') THEN
    ALTER TABLE public.job_orders ADD COLUMN payment_date timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='job_orders' AND column_name='payment_due_at') THEN
    ALTER TABLE public.job_orders ADD COLUMN payment_due_at timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='job_orders' AND column_name='job_amount') THEN
    ALTER TABLE public.job_orders ADD COLUMN job_amount numeric;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='job_orders' AND column_name='customer_name') THEN
    ALTER TABLE public.job_orders ADD COLUMN customer_name text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='job_orders' AND column_name='customer_address') THEN
    ALTER TABLE public.job_orders ADD COLUMN customer_address text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='job_orders' AND column_name='scheduled_date') THEN
    ALTER TABLE public.job_orders ADD COLUMN scheduled_date date;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='job_orders' AND column_name='notes') THEN
    ALTER TABLE public.job_orders ADD COLUMN notes text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='job_orders' AND column_name='completed_at') THEN
    ALTER TABLE public.job_orders ADD COLUMN completed_at timestamptz;
  END IF;
END $$;
