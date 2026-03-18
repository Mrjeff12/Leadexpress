-- 027_scanner_accounts.sql

-- Scanner accounts: one row per WhatsApp phone number
CREATE TABLE public.scanner_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id text NOT NULL UNIQUE,           -- e.g. 'scan-1', 'scan-2'
  phone_number text NOT NULL,                -- e.g. '+1234567890'
  proxy_url text,                            -- e.g. 'socks5://user:pass@ip:port'
  status text NOT NULL DEFAULT 'disconnected'
    CHECK (status IN ('active','qr_needed','banned','disconnected')),
  groups_joined integer NOT NULL DEFAULT 0,
  joins_today integer NOT NULL DEFAULT 0,
  joins_today_reset_at timestamptz NOT NULL DEFAULT now(),
  last_health_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_scanner_accounts_status ON public.scanner_accounts(status);

-- Junction: which account is in which group, as primary or backup
CREATE TABLE public.scanner_account_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.scanner_accounts(id) ON DELETE CASCADE,
  group_wa_id text NOT NULL,
  role text NOT NULL DEFAULT 'backup' CHECK (role IN ('primary','backup')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(account_id, group_wa_id)
);

CREATE INDEX idx_scanner_account_groups_group ON public.scanner_account_groups(group_wa_id);
CREATE INDEX idx_scanner_account_groups_role ON public.scanner_account_groups(role, group_wa_id);

-- RLS: service key only (no browser access needed)
ALTER TABLE public.scanner_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scanner_account_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "scanner_accounts_admin_all" ON public.scanner_accounts
  FOR ALL USING (public.is_admin());

CREATE POLICY "scanner_account_groups_admin_all" ON public.scanner_account_groups
  FOR ALL USING (public.is_admin());

-- Trigger for updated_at
CREATE TRIGGER update_scanner_accounts_updated_at
  BEFORE UPDATE ON public.scanner_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
