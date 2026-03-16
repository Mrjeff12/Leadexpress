-- Onboarding state for WhatsApp bot (replaces Redis since Edge Functions can't use it)
CREATE TABLE IF NOT EXISTS wa_onboard_state (
  phone   TEXT PRIMARY KEY,
  step    TEXT NOT NULL DEFAULT 'profession',
  data    JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-cleanup: rows older than 2 hours are stale onboarding sessions
CREATE INDEX idx_wa_onboard_state_updated ON wa_onboard_state (updated_at);
