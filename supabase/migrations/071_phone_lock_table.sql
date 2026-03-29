-- Replace broken advisory locks (don't work with PgBouncer connection pooling)
-- with a table-based lock that auto-expires after 30 seconds.

CREATE TABLE IF NOT EXISTS phone_locks (
  phone_hash BIGINT PRIMARY KEY,
  locked_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Try to acquire lock: insert row, or if stale (>30s), take it over
CREATE OR REPLACE FUNCTION try_phone_lock(lock_key BIGINT)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
BEGIN
  -- Delete stale locks (older than 30 seconds)
  DELETE FROM phone_locks WHERE phone_hash = lock_key AND locked_at < now() - interval '30 seconds';

  -- Try to insert (acquire lock)
  BEGIN
    INSERT INTO phone_locks (phone_hash, locked_at) VALUES (lock_key, now());
    RETURN TRUE;
  EXCEPTION WHEN unique_violation THEN
    RETURN FALSE;
  END;
END;
$$;

-- Release lock: just delete the row
CREATE OR REPLACE FUNCTION release_phone_lock(lock_key BIGINT)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM phone_locks WHERE phone_hash = lock_key;
END;
$$;
