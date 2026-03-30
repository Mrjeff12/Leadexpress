-- ============================================================================
-- Identity Verification (Stripe Identity)
-- ============================================================================

CREATE TABLE public.identity_verifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  stripe_session_id TEXT UNIQUE,
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','processing','verified','requires_input','canceled','failed')),
  -- Extracted document data (populated by webhook)
  first_name      TEXT,
  last_name       TEXT,
  dob             DATE,
  document_type   TEXT,   -- 'passport', 'driving_license', 'id_card'
  document_number TEXT,   -- encrypted / restricted
  issuing_country TEXT,
  expiration_date DATE,
  -- Metadata
  error_code      TEXT,   -- e.g. 'selfie_face_mismatch', 'document_expired'
  error_reason    TEXT,
  verified_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for user lookups
CREATE INDEX idx_identity_verifications_user ON public.identity_verifications(user_id);

-- Each user can only have one active/verified verification
CREATE UNIQUE INDEX idx_identity_verifications_user_active
  ON public.identity_verifications(user_id)
  WHERE status IN ('pending', 'processing', 'verified');

-- RLS
ALTER TABLE public.identity_verifications ENABLE ROW LEVEL SECURITY;

-- Users can read their own verification
CREATE POLICY "Users can view own verifications"
  ON public.identity_verifications FOR SELECT
  USING (auth.uid() = user_id);

-- Only service role can insert/update (via edge functions)
CREATE POLICY "Service role can manage verifications"
  ON public.identity_verifications FOR ALL
  USING (auth.role() = 'service_role');

-- Update profiles to track verification status
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS identity_verified BOOLEAN DEFAULT FALSE;
