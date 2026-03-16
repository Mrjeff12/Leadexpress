-- ============================================================
-- Lead Express — Multi-Account WhatsApp Support
-- ============================================================

-- WhatsApp Accounts — each is a separate Green API instance
CREATE TABLE public.wa_accounts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label           TEXT NOT NULL,                          -- e.g. "Florida Home Services"
  region          TEXT NOT NULL DEFAULT 'us-fl',          -- market region code
  green_api_url   TEXT NOT NULL,                          -- e.g. "https://7107.api.greenapi.com"
  green_api_id    TEXT NOT NULL,                          -- instance ID
  green_api_token TEXT NOT NULL,                          -- API token
  phone_number    TEXT,                                   -- connected phone (set after QR scan)
  status          TEXT NOT NULL DEFAULT 'disconnected'
                  CHECK (status IN ('disconnected', 'waiting_qr', 'connecting', 'connected', 'blocked')),
  qr_code         TEXT,                                   -- base64 PNG (temporary, cleared after connect)
  connected_since TIMESTAMPTZ,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_wa_accounts_active ON public.wa_accounts(is_active) WHERE is_active = true;

-- Link groups to accounts (which WA number monitors which groups)
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS wa_account_id UUID REFERENCES public.wa_accounts(id);

-- RLS
ALTER TABLE public.wa_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY wa_accounts_admin ON public.wa_accounts
  FOR ALL USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

-- Auto-update trigger
CREATE TRIGGER wa_accounts_updated_at BEFORE UPDATE ON public.wa_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- Seed: current Green API account as first entry
-- ============================================================
-- NOTE: Insert your Green API credentials manually or via a seed script.
-- DO NOT commit real API tokens to version control.
--
-- Example:
-- INSERT INTO public.wa_accounts (label, region, green_api_url, green_api_id, green_api_token, status)
-- VALUES (
--   'Florida Home Services',
--   'us-fl',
--   'https://XXXX.api.greenapi.com',
--   'YOUR_INSTANCE_ID',
--   'YOUR_API_TOKEN',
--   'disconnected'
-- );

-- Link existing groups to the FL account
UPDATE public.groups
SET wa_account_id = (SELECT id FROM public.wa_accounts WHERE region = 'us-fl' LIMIT 1)
WHERE wa_account_id IS NULL;

-- Add pipeline_events link to account
ALTER TABLE public.pipeline_events ADD COLUMN IF NOT EXISTS wa_account_id UUID REFERENCES public.wa_accounts(id);
