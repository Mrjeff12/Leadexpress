-- Migration 034: Distribution Network Phase 0
-- Adds publisher role support and lead source tracking
-- Enables role switching (contractor ↔ publisher) and AI-assisted lead publishing

BEGIN;

-- ============================================================
-- 1. Add roles array to profiles (keep existing 'role' for backward compat)
-- ============================================================
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS roles text[] DEFAULT ARRAY['contractor'];
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS publisher_bio text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS publisher_company_name text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS publisher_verified boolean DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}';

-- Backfill existing users based on their current role
UPDATE profiles SET roles = ARRAY[role::text]
WHERE roles IS NULL OR array_length(roles, 1) IS NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_roles ON profiles USING GIN(roles);

-- ============================================================
-- 2. Extend leads table for publisher sources
-- ============================================================
ALTER TABLE leads ADD COLUMN IF NOT EXISTS source_type text DEFAULT 'scanner';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS publisher_id uuid REFERENCES profiles(id);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS sender_phone text;

-- Make group_id nullable (publisher leads don't come from groups)
ALTER TABLE leads ALTER COLUMN group_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_leads_source_type ON leads(source_type);
CREATE INDEX IF NOT EXISTS idx_leads_publisher_id ON leads(publisher_id);

-- ============================================================
-- 3. RLS: Publishers can read their own published leads
-- ============================================================
CREATE POLICY leads_publisher_read ON leads FOR SELECT
  USING (publisher_id = auth.uid());

-- Publishers can insert leads (only their own, only publisher source)
CREATE POLICY leads_publisher_insert ON leads FOR INSERT
  WITH CHECK (
    publisher_id = auth.uid()
    AND source_type = 'publisher'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND 'publisher' = ANY(roles)
    )
  );

COMMIT;
