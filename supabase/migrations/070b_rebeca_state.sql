-- Add openai_response_id and session_started_at to wa_onboard_state
-- (merging wa_agent_sessions into wa_onboard_state)
ALTER TABLE wa_onboard_state
  ADD COLUMN IF NOT EXISTS openai_response_id TEXT,
  ADD COLUMN IF NOT EXISTS session_started_at TIMESTAMPTZ DEFAULT now();

-- Migrate existing session data from wa_agent_sessions (if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'wa_agent_sessions') THEN
    UPDATE wa_onboard_state wos
    SET
      openai_response_id = was.last_response_id,
      session_started_at = was.created_at
    FROM wa_agent_sessions was
    WHERE was.wa_id = wos.phone;
  END IF;
END $$;

-- Add cron_runs table for idempotency
CREATE TABLE IF NOT EXISTS cron_runs (
  job TEXT NOT NULL,
  run_date DATE NOT NULL,
  ran_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (job, run_date)
);

-- Postgres advisory lock helpers for per-phone mutex
CREATE OR REPLACE FUNCTION try_phone_lock(lock_key BIGINT)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN pg_try_advisory_lock(lock_key);
END;
$$;

CREATE OR REPLACE FUNCTION release_phone_lock(lock_key BIGINT)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM pg_advisory_unlock(lock_key);
END;
$$;

-- wa_opt_outs table (if not already exists)
CREATE TABLE IF NOT EXISTS wa_opt_outs (
  phone TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
