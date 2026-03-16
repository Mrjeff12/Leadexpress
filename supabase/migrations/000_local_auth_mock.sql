-- ============================================================
-- Local Auth Mock — Simulates Supabase auth schema for local dev
-- Skip this file when deploying to Supabase (they have it built-in)
-- ============================================================

CREATE SCHEMA IF NOT EXISTS auth;

CREATE TABLE IF NOT EXISTS auth.users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email           TEXT UNIQUE,
  encrypted_password TEXT,
  raw_user_meta_data JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Mock auth.uid() — returns the current user's UUID from a session variable
-- In production Supabase manages this; locally we set it manually
CREATE OR REPLACE FUNCTION auth.uid()
RETURNS UUID AS $$
BEGIN
  RETURN COALESCE(
    current_setting('app.current_user_id', true)::UUID,
    '00000000-0000-0000-0000-000000000000'::UUID
  );
END;
$$ LANGUAGE plpgsql STABLE;
