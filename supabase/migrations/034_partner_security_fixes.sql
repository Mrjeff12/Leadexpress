-- ============================================================
-- 034: Partner Security Fixes
-- 1. Replace dangerous UPDATE policy with safe RPC
-- 2. Add payout columns to community_partners
-- 3. Atomic withdrawal request with SELECT FOR UPDATE
-- 4. Atomic apply-credit request with SELECT FOR UPDATE
-- 5. Fix process_withdrawal to transition pending → paid
-- ============================================================

-- ============================================================
-- Fix 1: Remove permissive UPDATE policy, replace with RPC
-- The old policy let partners update ANY column (commission_rate,
-- status, balance_cache_cents, verified_at, stats, etc.)
-- ============================================================

DROP POLICY IF EXISTS community_partners_own_update ON public.community_partners;

-- ============================================================
-- Fix 4: Add payout columns (needed by update_partner_profile)
-- ============================================================

ALTER TABLE public.community_partners ADD COLUMN IF NOT EXISTS payout_method text;
ALTER TABLE public.community_partners ADD COLUMN IF NOT EXISTS payout_details text;
ALTER TABLE public.community_partners ADD COLUMN IF NOT EXISTS stripe_connect_id text;
ALTER TABLE public.community_partners ADD COLUMN IF NOT EXISTS stripe_onboarded boolean DEFAULT false;

-- ============================================================
-- Safe profile update via RPC (SECURITY DEFINER bypasses RLS)
-- Partners can only update: display_name, bio, location,
-- service_areas, specialties, slug, payout_method, payout_details
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_partner_profile(
  p_display_name text DEFAULT NULL,
  p_bio text DEFAULT NULL,
  p_location text DEFAULT NULL,
  p_service_areas text[] DEFAULT NULL,
  p_specialties text[] DEFAULT NULL,
  p_slug text DEFAULT NULL,
  p_payout_method text DEFAULT NULL,
  p_payout_details text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE community_partners SET
    display_name  = COALESCE(p_display_name, display_name),
    bio           = COALESCE(p_bio, bio),
    location      = COALESCE(p_location, location),
    service_areas = COALESCE(p_service_areas, service_areas),
    specialties   = COALESCE(p_specialties, specialties),
    slug          = COALESCE(p_slug, slug),
    payout_method = COALESCE(p_payout_method, payout_method),
    payout_details = COALESCE(p_payout_details, payout_details)
  WHERE user_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Partner not found for current user';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_partner_profile(text, text, text, text[], text[], text, text, text) TO authenticated;

-- ============================================================
-- Fix 3: Atomic withdrawal request with SELECT FOR UPDATE
-- Inserts as 'pending' — balance is NOT affected until admin
-- calls process_withdrawal which sets status = 'paid',
-- triggering the balance cache update.
-- ============================================================

CREATE OR REPLACE FUNCTION public.request_withdrawal(
  p_amount_cents integer,
  p_note text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_partner_id uuid;
  v_balance integer;
  v_withdrawal_id uuid;
BEGIN
  -- Lock the partner row to prevent concurrent balance checks
  SELECT id, balance_cache_cents INTO v_partner_id, v_balance
  FROM community_partners
  WHERE user_id = auth.uid() AND status = 'active'
  FOR UPDATE;

  IF v_partner_id IS NULL THEN
    RAISE EXCEPTION 'Partner not found or not active';
  END IF;

  IF p_amount_cents < 5000 THEN
    RAISE EXCEPTION 'Minimum withdrawal is $50';
  END IF;

  IF p_amount_cents > v_balance THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;

  -- Insert as 'pending': balance won't drop until admin approves (→ 'paid')
  INSERT INTO partner_commissions (partner_id, type, amount_cents, status, note)
  VALUES (v_partner_id, 'withdrawal', -p_amount_cents, 'pending', p_note)
  RETURNING id INTO v_withdrawal_id;

  RETURN v_withdrawal_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_withdrawal(integer, text) TO authenticated;

-- ============================================================
-- Atomic apply-credit request with SELECT FOR UPDATE
-- Credits are auto-approved (applied immediately to subscription)
-- so the balance drops right away via the trigger.
-- ============================================================

CREATE OR REPLACE FUNCTION public.request_apply_credit(
  p_amount_cents integer
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_partner_id uuid;
  v_balance integer;
  v_credit_id uuid;
BEGIN
  -- Lock the partner row to prevent concurrent balance checks
  SELECT id, balance_cache_cents INTO v_partner_id, v_balance
  FROM community_partners
  WHERE user_id = auth.uid() AND status = 'active'
  FOR UPDATE;

  IF v_partner_id IS NULL THEN
    RAISE EXCEPTION 'Partner not found or not active';
  END IF;

  IF p_amount_cents < 500 THEN
    RAISE EXCEPTION 'Minimum credit is $5';
  END IF;

  IF p_amount_cents > v_balance THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;

  -- Credits are auto-approved so balance drops immediately via trigger
  INSERT INTO partner_commissions (partner_id, type, amount_cents, status, note)
  VALUES (v_partner_id, 'credit', -p_amount_cents, 'approved', 'Applied as subscription credit')
  RETURNING id INTO v_credit_id;

  RETURN v_credit_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_apply_credit(integer) TO authenticated;

-- ============================================================
-- Fix 5: Ensure process_withdrawal transitions pending → paid
-- The existing function in 033 already does this correctly:
--   SET status = 'paid', paid_at = now()
--   WHERE ... status = 'pending'
-- Re-creating with explicit approved_at for audit trail.
-- ============================================================

CREATE OR REPLACE FUNCTION public.process_withdrawal(commission_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  UPDATE partner_commissions
  SET status = 'paid',
      approved_at = COALESCE(approved_at, now()),
      paid_at = now()
  WHERE id = commission_id
    AND type = 'withdrawal'
    AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Withdrawal not found or not in pending status';
  END IF;
END;
$$;
