-- ============================================================
-- 095: Stripe webhook RPC — also auto-link contractor_id
-- ============================================================
-- Safety net: when Stripe confirms payment, ensure prospect is
-- linked to the contractor (handles edge case where INSERT trigger missed).

CREATE OR REPLACE FUNCTION handle_stripe_event(
  p_stripe_subscription_id TEXT,
  p_event_type TEXT,
  p_detail JSONB DEFAULT '{}'::jsonb
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_prospect_id UUID;
  v_phone TEXT;
  v_name TEXT;
  v_new_sub TEXT;
  v_new_stage TEXT;
  v_old_stage TEXT;
  v_old_sub TEXT;
  v_user_id UUID;
BEGIN
  -- Find prospect via subscription → profile → phone → prospect
  SELECT p.id, p.stage::TEXT, p.sub_status, p.phone, p.display_name, pr.id
  INTO v_prospect_id, v_old_stage, v_old_sub, v_phone, v_name, v_user_id
  FROM prospects p
  JOIN profiles pr ON pr.phone = p.phone
  JOIN subscriptions s ON s.user_id = pr.id
  WHERE s.stripe_subscription_id = p_stripe_subscription_id
  LIMIT 1;

  IF v_prospect_id IS NULL THEN RETURN NULL; END IF;

  -- Auto-link contractor_id if not already set
  IF v_user_id IS NOT NULL THEN
    UPDATE prospects
    SET contractor_id = v_user_id
    WHERE id = v_prospect_id AND contractor_id IS NULL;
  END IF;

  -- Determine new stage + sub_status based on event
  v_new_stage := v_old_stage;
  v_new_sub := v_old_sub;

  CASE p_event_type
    WHEN 'invoice.payment_succeeded' THEN
      IF v_old_stage IN ('paying', 'demo_trial') THEN
        v_new_stage := 'paying';
        v_new_sub := 'healthy';
      END IF;

    WHEN 'invoice.payment_failed' THEN
      IF v_old_stage = 'paying' THEN
        v_new_sub := 'payment_failing';
      ELSIF v_old_stage = 'demo_trial' THEN
        v_new_stage := 'trial_expired';
        v_new_sub := 'payment_failed';
      END IF;

    WHEN 'customer.subscription.deleted' THEN
      IF v_old_stage = 'paying' THEN
        v_new_stage := 'churned';
        IF v_old_sub = 'payment_failing' THEN
          v_new_sub := 'payment_failed';
        ELSE
          v_new_sub := 'recent';
        END IF;
      END IF;

    WHEN 'customer.subscription.paused' THEN
      IF v_old_stage = 'paying' THEN
        v_new_sub := 'low_usage';
      END IF;

    WHEN 'customer.subscription.updated' THEN
      IF v_old_stage = 'paying' AND v_old_sub = 'payment_failing' THEN
        v_new_sub := 'healthy';
      END IF;

    ELSE
      RETURN NULL;
  END CASE;

  -- Update if changed
  IF v_new_stage IS DISTINCT FROM v_old_stage OR v_new_sub IS DISTINCT FROM v_old_sub THEN
    UPDATE prospects SET
      stage = v_new_stage::prospect_stage,
      sub_status = v_new_sub,
      sub_status_changed_at = now()
    WHERE id = v_prospect_id;

    INSERT INTO prospect_events (prospect_id, event_type, old_value, new_value, detail)
    VALUES (v_prospect_id,
      CASE WHEN v_new_stage != v_old_stage THEN 'stage_change' ELSE 'sub_status_change' END,
      COALESCE(v_old_stage || ':' || v_old_sub, v_old_stage),
      COALESCE(v_new_stage || ':' || v_new_sub, v_new_stage),
      p_detail
    );

    IF p_event_type = 'invoice.payment_failed' THEN
      PERFORM send_alert(NULL, 'custom', 'critical',
        '💳 Payment failed: ' || COALESCE(v_name, v_phone),
        'Subscription payment failed for ' || COALESCE(v_name, v_phone) || ' (' || v_phone || '). Follow up immediately!',
        p_detail, 'whatsapp', 720);
    END IF;

    IF p_event_type = 'customer.subscription.deleted' THEN
      PERFORM send_alert(NULL, 'custom', 'warning',
        '😞 Churned: ' || COALESCE(v_name, v_phone),
        COALESCE(v_name, v_phone) || ' (' || v_phone || ') cancelled. Reason: ' || COALESCE(v_new_sub, 'unknown'),
        p_detail, 'whatsapp', 1440);
    END IF;
  END IF;

  RETURN v_prospect_id;
END;
$$;
