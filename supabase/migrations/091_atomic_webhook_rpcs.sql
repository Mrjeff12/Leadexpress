-- ============================================================================
-- Migration 091: Atomic RPCs + Idempotency Gate + Job Queue Watchdog
-- ============================================================================
-- Fixes non-hermetic multi-step operations across 6 webhook handlers,
-- the lead processing pipeline, and adds infrastructure safety.
-- ============================================================================

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ STRATEGY 1: Atomic RPCs for webhook handlers                            ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

-- ── RPC 1: handle_subscription_deleted_atomic ─────────────────────────────
-- Atomically: cancel subscription + churn prospect + set substatus
CREATE OR REPLACE FUNCTION handle_subscription_deleted_atomic(
  p_user_id UUID,
  p_reason TEXT DEFAULT 'cancelled'
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_prospect_id UUID;
BEGIN
  UPDATE subscriptions SET status = 'canceled' WHERE user_id = p_user_id;

  SELECT id INTO v_prospect_id
  FROM prospects WHERE user_id = p_user_id LIMIT 1;

  IF v_prospect_id IS NOT NULL THEN
    UPDATE prospects SET stage = 'churned' WHERE id = v_prospect_id;
    PERFORM set_churned_substatus(v_prospect_id, p_reason);
  END IF;
END;
$$;

-- ── RPC 2: handle_invoice_failed_atomic ───────────────────────────────────
-- Atomically: set past_due + update prospect substatus
CREATE OR REPLACE FUNCTION handle_invoice_failed_atomic(
  p_user_id UUID
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_prospect_id UUID;
BEGIN
  UPDATE subscriptions SET status = 'past_due' WHERE user_id = p_user_id;

  SELECT id INTO v_prospect_id
  FROM prospects WHERE user_id = p_user_id LIMIT 1;

  IF v_prospect_id IS NOT NULL THEN
    PERFORM set_churned_substatus(v_prospect_id, 'payment_failed');
    UPDATE prospects SET sub_status = 'payment_failing' WHERE id = v_prospect_id;
  END IF;
END;
$$;

-- ── RPC 3: handle_identity_verified_atomic ────────────────────────────────
-- Atomically: update identity_verifications + profiles + contractor_profiles
CREATE OR REPLACE FUNCTION handle_identity_verified_atomic(
  p_user_id UUID,
  p_stripe_session_id TEXT,
  p_updates JSONB
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  -- Update identity verification record
  UPDATE identity_verifications
  SET status = COALESCE(p_updates->>'status', status),
      verified_at = CASE WHEN p_updates->>'status' = 'verified'
                         THEN COALESCE((p_updates->>'verified_at')::timestamptz, now())
                         ELSE verified_at END,
      first_name = COALESCE(p_updates->>'first_name', first_name),
      last_name = COALESCE(p_updates->>'last_name', last_name),
      dob = COALESCE(p_updates->>'dob', dob),
      document_type = COALESCE(p_updates->>'document_type', document_type),
      issuing_country = COALESCE(p_updates->>'issuing_country', issuing_country),
      expiration_date = COALESCE(p_updates->>'expiration_date', expiration_date),
      error_code = COALESCE(p_updates->>'error_code', error_code),
      error_reason = COALESCE(p_updates->>'error_reason', error_reason),
      updated_at = now()
  WHERE stripe_session_id = p_stripe_session_id;

  -- If verified, update profile + contractor tier
  IF p_updates->>'status' = 'verified' THEN
    UPDATE profiles SET identity_verified = true WHERE id = p_user_id;

    UPDATE contractor_profiles
    SET tier = 'verified'
    WHERE user_id = p_user_id AND tier = 'new';
  END IF;
END;
$$;

-- ── RPC 4: handle_charge_refunded_atomic ──────────────────────────────────
-- Atomically: lookup earning + insert clawback + reverse original
CREATE OR REPLACE FUNCTION handle_charge_refunded_atomic(
  p_invoice_id TEXT,
  p_charge_id TEXT
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_earning RECORD;
  v_clawback_id UUID;
BEGIN
  -- Find the earning for this invoice
  SELECT id, partner_id, referral_id, amount_cents, status
  INTO v_earning
  FROM partner_commissions
  WHERE stripe_invoice_id = p_invoice_id AND type = 'earning'
  LIMIT 1;

  IF v_earning IS NULL THEN RETURN NULL; END IF;

  -- Insert clawback
  INSERT INTO partner_commissions (partner_id, referral_id, type, amount_cents, status, stripe_invoice_id, note)
  VALUES (v_earning.partner_id, v_earning.referral_id, 'refund_clawback',
          -ABS(v_earning.amount_cents), 'approved', p_invoice_id,
          'Clawback for refunded charge ' || p_charge_id)
  RETURNING id INTO v_clawback_id;

  -- Reverse original if still pending
  IF v_earning.status = 'pending' THEN
    UPDATE partner_commissions SET status = 'reversed' WHERE id = v_earning.id;
  END IF;

  RETURN v_clawback_id;
END;
$$;

-- ── RPC 5: handle_checkout_with_referral ──────────────────────────────────
-- Atomically: upsert subscription + insert partner referral
CREATE OR REPLACE FUNCTION handle_checkout_with_referral(
  p_user_id UUID,
  p_plan_id UUID,
  p_stripe_sub_id TEXT,
  p_stripe_customer_id TEXT,
  p_status TEXT,
  p_period_end TIMESTAMPTZ,
  p_ref_partner_slug TEXT DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_partner_id UUID;
  v_partner_user_id UUID;
BEGIN
  -- Upsert subscription
  INSERT INTO subscriptions (user_id, plan_id, stripe_subscription_id, stripe_customer_id, status, current_period_end)
  VALUES (p_user_id, p_plan_id, p_stripe_sub_id, p_stripe_customer_id, p_status, p_period_end)
  ON CONFLICT (user_id)
  DO UPDATE SET plan_id = EXCLUDED.plan_id,
               stripe_subscription_id = EXCLUDED.stripe_subscription_id,
               stripe_customer_id = EXCLUDED.stripe_customer_id,
               status = EXCLUDED.status,
               current_period_end = EXCLUDED.current_period_end;

  -- Insert partner referral if ref slug provided
  IF p_ref_partner_slug IS NOT NULL THEN
    SELECT id, user_id INTO v_partner_id, v_partner_user_id
    FROM community_partners
    WHERE slug = p_ref_partner_slug AND status = 'active'
    LIMIT 1;

    IF v_partner_id IS NOT NULL AND v_partner_user_id IS DISTINCT FROM p_user_id THEN
      INSERT INTO partner_referrals (partner_id, referred_user_id, referral_source)
      VALUES (v_partner_id, p_user_id, 'link')
      ON CONFLICT (referred_user_id) DO NOTHING;
    END IF;
  END IF;
END;
$$;

-- ── RPC 6: create_job_from_claim ──────────────────────────────────────────
-- Atomically: insert job_order + log pipeline_event
CREATE OR REPLACE FUNCTION create_job_from_claim(
  p_lead_id UUID,
  p_contractor_id UUID,
  p_customer_name TEXT DEFAULT NULL,
  p_customer_address TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
) RETURNS TABLE(id UUID, access_token UUID)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_job_id UUID;
  v_token UUID;
BEGIN
  INSERT INTO job_orders (lead_id, contractor_id, deal_type, deal_value, status,
                          customer_name, customer_address, notes, token_expires_at)
  VALUES (p_lead_id, p_contractor_id, 'custom', 'TBD', 'accepted',
          p_customer_name, p_customer_address, p_notes,
          now() + interval '30 days')
  RETURNING job_orders.id, job_orders.access_token INTO v_job_id, v_token;

  INSERT INTO pipeline_events (stage, detail)
  VALUES ('job_created_from_claim', jsonb_build_object(
    'lead_id', p_lead_id,
    'contractor_id', p_contractor_id,
    'job_order_id', v_job_id
  ));

  RETURN QUERY SELECT v_job_id, v_token;
END;
$$;


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ STRATEGY 2: Stripe Webhook Idempotency Gate                             ║
-- ╚═════════════════════════════════════════════════════════════════��═════════╝

CREATE TABLE IF NOT EXISTS public.stripe_events_processed (
  event_id     TEXT PRIMARY KEY,
  event_type   TEXT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Cleanup: delete processed events older than 7 days (hourly)
SELECT cron.schedule('clean-stripe-events', '0 * * * *', $$
  DELETE FROM public.stripe_events_processed
  WHERE processed_at < now() - interval '7 days';
$$);


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ STRATEGY 3: Job Queue Watchdog                                          ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

-- Detect stuck jobs in "processing" state and mark them failed for retry
SELECT cron.schedule('watchdog-stuck-jobs', '*/5 * * * *', $$
  UPDATE job_queue
  SET status = 'failed',
      error  = 'watchdog: stuck in processing >10 min'
  WHERE status = 'processing'
    AND started_at < now() - interval '10 minutes';
$$);


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ STRATEGY 4: Lead Pipeline Atomic RPCs                                   ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

-- ── RPC 7: finalize_parsed_lead ───────────────────────────────────────────
-- Atomically: insert lead + update sender stats + log event + enqueue match
CREATE OR REPLACE FUNCTION finalize_parsed_lead(
  p_lead JSONB,
  p_content_hash TEXT,
  p_group_id UUID,
  p_sender_id TEXT DEFAULT NULL,
  p_message_id TEXT DEFAULT NULL,
  p_has_phone BOOLEAN DEFAULT false
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_lead_id UUID;
  v_member_id UUID;
BEGIN
  -- Insert lead (ON CONFLICT = dedup)
  INSERT INTO leads (
    group_id, wa_message_id, content_hash, raw_message,
    sender_id, sender_name, profession, zip_code, city, state,
    latitude, longitude, budget_range, urgency, parsed_summary,
    filter_stage, status, review_status
  )
  VALUES (
    p_group_id, p_lead->>'wa_message_id', p_content_hash, p_lead->>'raw_message',
    p_lead->>'sender_id', p_lead->>'sender_name', p_lead->>'profession',
    p_lead->>'zip_code', p_lead->>'city', p_lead->>'state',
    (p_lead->>'latitude')::DOUBLE PRECISION, (p_lead->>'longitude')::DOUBLE PRECISION,
    p_lead->>'budget_range', p_lead->>'urgency', p_lead->>'parsed_summary',
    'ai_parsed', 'parsed', 'pending'
  )
  ON CONFLICT (content_hash) DO NOTHING
  RETURNING id INTO v_lead_id;

  -- Dedup hit — another process already created this lead
  IF v_lead_id IS NULL THEN RETURN NULL; END IF;

  -- Update sender stats
  IF p_group_id IS NOT NULL AND p_sender_id IS NOT NULL THEN
    SELECT id INTO v_member_id
    FROM group_members
    WHERE group_id = p_group_id AND wa_sender_id = p_sender_id
    LIMIT 1;

    IF v_member_id IS NOT NULL THEN
      UPDATE group_members
      SET lead_messages = lead_messages + 1,
          service_messages = service_messages + CASE WHEN p_has_phone THEN 1 ELSE 0 END
      WHERE id = v_member_id;
    END IF;
  END IF;

  -- Enqueue for matching
  PERFORM enqueue_job('parsed_leads', jsonb_build_object('leadId', v_lead_id), NULL, 3);

  -- Log pipeline event
  INSERT INTO pipeline_events (group_id, wa_message_id, sender_id, stage, lead_id, detail)
  VALUES (p_group_id, p_message_id, p_sender_id, 'lead_created', v_lead_id,
          jsonb_build_object(
            'profession', p_lead->>'profession',
            'city', p_lead->>'city',
            'urgency', p_lead->>'urgency'
          ));

  RETURN v_lead_id;
END;
$$;

-- ── RPC 8: finalize_lead_match ────────────────────────────────────────────
-- Atomically: update lead status + log pipeline event
CREATE OR REPLACE FUNCTION finalize_lead_match(
  p_lead_id UUID,
  p_matched_contractor_ids UUID[],
  p_sent_count INT
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  UPDATE leads
  SET status = 'sent',
      sent_to_count = p_sent_count,
      matched_contractors = p_matched_contractor_ids
  WHERE id = p_lead_id;

  INSERT INTO pipeline_events (lead_id, stage, detail)
  VALUES (p_lead_id, 'matched', jsonb_build_object(
    'matched', array_length(p_matched_contractor_ids, 1),
    'sent', p_sent_count
  ));
END;
$$;
