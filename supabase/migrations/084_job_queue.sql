-- ============================================================================
-- Migration 084: Job Queue table (replaces BullMQ + Redis)
-- ============================================================================
-- This table serves as a universal job queue for the lead processing pipeline.
-- It replaces the Redis/BullMQ queue system with a Postgres-native approach
-- using pg_cron + Edge Functions for processing.
--
-- Queue names: raw_messages, parsed_leads, notify_telegram, notify_whatsapp,
--              notify_whatsapp_template, notify_push, notify_sms
-- ============================================================================

CREATE TABLE IF NOT EXISTS job_queue (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  queue           text NOT NULL,
  payload         jsonb NOT NULL,
  status          text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'dead')),
  attempts        int NOT NULL DEFAULT 0,
  max_attempts    int NOT NULL DEFAULT 3,
  next_retry_at   timestamptz DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  started_at      timestamptz,
  completed_at    timestamptz,
  error           text,
  -- Dedup: replaces Redis SET NX with UNIQUE constraint
  dedup_key       text
);

-- Unique partial index for dedup (only non-dead entries)
CREATE UNIQUE INDEX IF NOT EXISTS idx_job_queue_dedup
  ON job_queue (dedup_key)
  WHERE dedup_key IS NOT NULL AND status != 'dead';

-- Main polling index: pending/failed jobs ready for processing
CREATE INDEX IF NOT EXISTS idx_job_queue_poll
  ON job_queue (queue, status, next_retry_at)
  WHERE status IN ('pending', 'failed');

-- Cleanup index: completed jobs by timestamp
CREATE INDEX IF NOT EXISTS idx_job_queue_cleanup
  ON job_queue (status, completed_at)
  WHERE status IN ('completed', 'dead');

-- ============================================================================
-- Cleanup cron: remove completed jobs after 24h, mark dead after max attempts
-- ============================================================================
SELECT cron.schedule('clean-job-queue', '0 * * * *', $$
  -- Delete completed jobs older than 24 hours
  DELETE FROM public.job_queue
  WHERE status = 'completed'
    AND completed_at < now() - interval '24 hours';

  -- Mark permanently failed jobs as dead
  UPDATE public.job_queue
  SET status = 'dead'
  WHERE status = 'failed'
    AND attempts >= max_attempts
    AND created_at < now() - interval '48 hours';

  -- Delete dead jobs older than 7 days
  DELETE FROM public.job_queue
  WHERE status = 'dead'
    AND created_at < now() - interval '7 days';
$$);

-- ============================================================================
-- Dedup cleanup: remove old dedup keys so messages can be re-processed
-- (replaces Redis TTL of 2 hours)
-- ============================================================================
SELECT cron.schedule('clean-job-dedup', '*/30 * * * *', $$
  DELETE FROM public.job_queue
  WHERE dedup_key IS NOT NULL
    AND status = 'completed'
    AND completed_at < now() - interval '2 hours';
$$);

-- ============================================================================
-- Helper function: claim a batch of jobs for processing (atomic)
-- Used by Edge Functions to safely claim jobs without race conditions
-- ============================================================================
CREATE OR REPLACE FUNCTION claim_jobs(
  p_queue text,
  p_limit int DEFAULT 5
)
RETURNS SETOF job_queue
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  UPDATE job_queue
  SET status = 'processing',
      started_at = now(),
      attempts = attempts + 1
  WHERE id IN (
    SELECT id FROM job_queue
    WHERE queue = p_queue
      AND (status = 'pending' OR (status = 'failed' AND next_retry_at <= now()))
    ORDER BY created_at
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
END;
$$;

-- ============================================================================
-- Helper function: mark job completed
-- ============================================================================
CREATE OR REPLACE FUNCTION complete_job(p_job_id uuid)
RETURNS void
LANGUAGE sql
AS $$
  UPDATE job_queue
  SET status = 'completed', completed_at = now()
  WHERE id = p_job_id;
$$;

-- ============================================================================
-- Helper function: mark job failed with retry scheduling
-- Uses exponential backoff: 5s, 10s, 20s, 40s...
-- ============================================================================
CREATE OR REPLACE FUNCTION fail_job(p_job_id uuid, p_error text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_attempts int;
  v_max int;
BEGIN
  SELECT attempts, max_attempts INTO v_attempts, v_max
  FROM job_queue WHERE id = p_job_id;

  IF v_attempts >= v_max THEN
    UPDATE job_queue
    SET status = 'dead', error = p_error
    WHERE id = p_job_id;
  ELSE
    UPDATE job_queue
    SET status = 'failed',
        error = p_error,
        next_retry_at = now() + (power(2, v_attempts) * interval '5 seconds')
    WHERE id = p_job_id;
  END IF;
END;
$$;

-- ============================================================================
-- Helper function: enqueue a job with optional dedup
-- ============================================================================
CREATE OR REPLACE FUNCTION enqueue_job(
  p_queue text,
  p_payload jsonb,
  p_dedup_key text DEFAULT NULL,
  p_max_attempts int DEFAULT 3
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO job_queue (queue, payload, dedup_key, max_attempts)
  VALUES (p_queue, p_payload, p_dedup_key, p_max_attempts)
  ON CONFLICT (dedup_key) WHERE dedup_key IS NOT NULL AND status != 'dead'
  DO NOTHING
  RETURNING id INTO v_id;

  RETURN v_id; -- NULL if dedup hit
END;
$$;
