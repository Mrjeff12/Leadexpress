-- ============================================================
-- Lead Express — Initial Schema
-- ============================================================

-- Profiles (extends auth.users)
CREATE TABLE public.profiles (
  id                UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role              TEXT NOT NULL DEFAULT 'contractor' CHECK (role IN ('contractor', 'admin')),
  full_name         TEXT NOT NULL,
  phone             TEXT,
  telegram_chat_id  BIGINT UNIQUE,
  preferred_locale  TEXT NOT NULL DEFAULT 'en' CHECK (preferred_locale IN ('en', 'he')),
  timezone          TEXT NOT NULL DEFAULT 'America/New_York',
  is_active         BOOLEAN NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_profiles_telegram ON public.profiles(telegram_chat_id) WHERE telegram_chat_id IS NOT NULL;
CREATE INDEX idx_profiles_role ON public.profiles(role);

-- Plans
CREATE TABLE public.plans (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug              TEXT NOT NULL UNIQUE CHECK (slug IN ('starter', 'pro', 'unlimited')),
  name              TEXT NOT NULL,
  price_cents       INTEGER NOT NULL,
  max_groups        SMALLINT NOT NULL,     -- -1 = unlimited
  max_professions   SMALLINT NOT NULL,     -- -1 = unlimited
  max_zip_codes     SMALLINT NOT NULL,     -- -1 = unlimited
  stripe_price_id   TEXT UNIQUE,
  is_active         BOOLEAN NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed plans
INSERT INTO public.plans (slug, name, price_cents, max_groups, max_professions, max_zip_codes) VALUES
  ('starter', 'Starter', 14900, 5, 1, 3),
  ('pro', 'Pro', 24900, 15, 3, 8),
  ('unlimited', 'Unlimited', 39900, -1, -1, -1);

-- Subscriptions
CREATE TABLE public.subscriptions (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan_id                 UUID NOT NULL REFERENCES public.plans(id),
  stripe_subscription_id  TEXT UNIQUE,
  stripe_customer_id      TEXT NOT NULL DEFAULT '',
  status                  TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'past_due', 'canceled', 'paused')),
  current_period_end      TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '30 days'),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_subscriptions_user ON public.subscriptions(user_id);
CREATE INDEX idx_subscriptions_status ON public.subscriptions(status) WHERE status = 'active';

-- Contractors
CREATE TABLE public.contractors (
  user_id       UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  professions   TEXT[] NOT NULL DEFAULT '{}',
  zip_codes     TEXT[] NOT NULL DEFAULT '{}',
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_contractors_active ON public.contractors(is_active) WHERE is_active = true;

-- WhatsApp Groups
CREATE TABLE public.groups (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wa_group_id     TEXT NOT NULL UNIQUE,
  name            TEXT NOT NULL,
  category        TEXT CHECK (category IN ('hvac', 'renovation', 'fencing', 'cleaning')),
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'disconnected', 'banned')),
  message_count   INTEGER NOT NULL DEFAULT 0,
  last_message_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_groups_status ON public.groups(status) WHERE status = 'active';
CREATE INDEX idx_groups_wa ON public.groups(wa_group_id);

-- Leads
CREATE TABLE public.leads (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id        UUID NOT NULL REFERENCES public.groups(id),
  wa_message_id   TEXT UNIQUE,
  content_hash    TEXT,
  raw_message     TEXT NOT NULL,
  profession      TEXT CHECK (profession IN ('hvac', 'renovation', 'fencing', 'cleaning', 'other')),
  zip_code        TEXT,
  city            TEXT,
  budget_range    TEXT,
  urgency         TEXT NOT NULL DEFAULT 'warm' CHECK (urgency IN ('hot', 'warm', 'cold')),
  parsed_summary  TEXT,
  status          TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'parsed', 'sent', 'expired')),
  sent_to_count   INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_leads_created ON public.leads(created_at DESC);
CREATE INDEX idx_leads_hash ON public.leads(content_hash) WHERE content_hash IS NOT NULL;
CREATE INDEX idx_leads_profession_zip ON public.leads(profession, zip_code);
CREATE INDEX idx_leads_status ON public.leads(status);

-- ============================================================
-- RLS Policies
-- ============================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contractors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- Plans: everyone can read
CREATE POLICY plans_read ON public.plans FOR SELECT USING (true);

-- Profiles: users see their own; admins see all
CREATE POLICY profiles_self ON public.profiles
  FOR ALL USING (
    id = auth.uid()
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

-- Subscriptions: users see their own; admins see all
CREATE POLICY subscriptions_own ON public.subscriptions
  FOR ALL USING (
    user_id = auth.uid()
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

-- Contractors: users see their own; admins see all
CREATE POLICY contractors_own ON public.contractors
  FOR ALL USING (
    user_id = auth.uid()
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

-- Groups: everyone can read
CREATE POLICY groups_read ON public.groups FOR SELECT USING (true);
CREATE POLICY groups_admin ON public.groups
  FOR ALL USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

-- Leads: contractors see leads sent to them (for now, all leads); admins see all
CREATE POLICY leads_read ON public.leads
  FOR SELECT USING (true);
CREATE POLICY leads_admin ON public.leads
  FOR ALL USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

-- ============================================================
-- Auto-update updated_at trigger
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER subscriptions_updated_at BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER contractors_updated_at BEFORE UPDATE ON public.contractors
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- Auto-create profile on signup
-- ============================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, role, full_name)
  VALUES (
    NEW.id,
    'contractor',
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'New User')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
