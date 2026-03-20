-- ============================================================
-- 033: Community Partner Program
-- Partners earn 15% recurring commission on referred subscribers
-- ============================================================

-- ============================================================
-- Tables
-- ============================================================

-- Community Partners
CREATE TABLE public.community_partners (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  slug              TEXT NOT NULL UNIQUE,
  display_name      TEXT NOT NULL,
  bio               TEXT,
  avatar_url        TEXT,
  cover_image_url   TEXT,
  location          TEXT,
  service_areas     TEXT[] DEFAULT '{}',
  specialties       TEXT[] DEFAULT '{}',
  commission_rate   NUMERIC(5,4) NOT NULL DEFAULT 0.1500,
  status            TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'suspended', 'rejected')),
  verified_at       TIMESTAMPTZ,
  balance_cache_cents INTEGER NOT NULL DEFAULT 0,
  stats             JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_community_partners_slug ON public.community_partners(slug);
CREATE INDEX idx_community_partners_status ON public.community_partners(status) WHERE status = 'active';
CREATE INDEX idx_community_partners_user ON public.community_partners(user_id);
CREATE INDEX idx_community_partners_created ON public.community_partners(created_at DESC);

-- Partner Linked Groups
CREATE TABLE public.partner_linked_groups (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id  UUID NOT NULL REFERENCES public.community_partners(id) ON DELETE CASCADE,
  group_id    UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  verified    BOOLEAN NOT NULL DEFAULT false,
  linked_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(partner_id, group_id)
);

CREATE INDEX idx_partner_linked_groups_partner ON public.partner_linked_groups(partner_id);
CREATE INDEX idx_partner_linked_groups_group ON public.partner_linked_groups(group_id);

-- Partner Referrals
CREATE TABLE public.partner_referrals (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id       UUID NOT NULL REFERENCES public.community_partners(id) ON DELETE CASCADE,
  referred_user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  referral_source  TEXT NOT NULL DEFAULT 'link'
    CHECK (referral_source IN ('link', 'group', 'manual')),
  converted_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_partner_referrals_partner ON public.partner_referrals(partner_id);
CREATE INDEX idx_partner_referrals_referred ON public.partner_referrals(referred_user_id);
CREATE INDEX idx_partner_referrals_converted ON public.partner_referrals(converted_at)
  WHERE converted_at IS NOT NULL;
CREATE INDEX idx_partner_referrals_created ON public.partner_referrals(created_at DESC);

-- Partner Commissions
CREATE TABLE public.partner_commissions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id        UUID NOT NULL REFERENCES public.community_partners(id) ON DELETE CASCADE,
  referral_id       UUID REFERENCES public.partner_referrals(id) ON DELETE SET NULL,
  type              TEXT NOT NULL CHECK (type IN ('earning', 'withdrawal', 'credit', 'refund_clawback')),
  amount_cents      INTEGER NOT NULL,
  status            TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'paid', 'rejected', 'reversed')),
  stripe_invoice_id TEXT,
  stripe_payout_id  TEXT,
  note              TEXT,
  approved_at       TIMESTAMPTZ,
  paid_at           TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_partner_commissions_partner ON public.partner_commissions(partner_id);
CREATE INDEX idx_partner_commissions_status ON public.partner_commissions(status);
CREATE INDEX idx_partner_commissions_type ON public.partner_commissions(type, partner_id);
CREATE INDEX idx_partner_commissions_invoice ON public.partner_commissions(stripe_invoice_id)
  WHERE stripe_invoice_id IS NOT NULL;
CREATE INDEX idx_partner_commissions_created ON public.partner_commissions(created_at DESC);

-- ============================================================
-- RLS Policies
-- ============================================================

ALTER TABLE public.community_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_linked_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_commissions ENABLE ROW LEVEL SECURITY;

-- community_partners: public reads active partners
CREATE POLICY community_partners_public_read ON public.community_partners
  FOR SELECT USING (status = 'active' OR user_id = auth.uid() OR public.is_admin());

-- community_partners: partners update their own record
CREATE POLICY community_partners_own_update ON public.community_partners
  FOR UPDATE USING (user_id = auth.uid());

-- community_partners: admins have full access
CREATE POLICY community_partners_admin_all ON public.community_partners
  FOR ALL USING (public.is_admin());

-- partner_linked_groups: partners read their own
CREATE POLICY partner_linked_groups_own_select ON public.partner_linked_groups
  FOR SELECT USING (
    partner_id IN (SELECT id FROM public.community_partners WHERE user_id = auth.uid())
    OR public.is_admin()
  );

-- partner_linked_groups: admins have full access
CREATE POLICY partner_linked_groups_admin_all ON public.partner_linked_groups
  FOR ALL USING (public.is_admin());

-- partner_referrals: partners read their own
CREATE POLICY partner_referrals_own_select ON public.partner_referrals
  FOR SELECT USING (
    partner_id IN (SELECT id FROM public.community_partners WHERE user_id = auth.uid())
    OR public.is_admin()
  );

-- partner_referrals: admins have full access
CREATE POLICY partner_referrals_admin_all ON public.partner_referrals
  FOR ALL USING (public.is_admin());

-- partner_commissions: partners read their own
CREATE POLICY partner_commissions_own_select ON public.partner_commissions
  FOR SELECT USING (
    partner_id IN (SELECT id FROM public.community_partners WHERE user_id = auth.uid())
    OR public.is_admin()
  );

-- partner_commissions: admins have full access
CREATE POLICY partner_commissions_admin_all ON public.partner_commissions
  FOR ALL USING (public.is_admin());

-- ============================================================
-- Triggers
-- ============================================================

-- updated_at trigger on community_partners
CREATE TRIGGER community_partners_updated_at BEFORE UPDATE ON public.community_partners
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Balance cache trigger on partner_commissions
CREATE OR REPLACE FUNCTION public.update_partner_balance_cache()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.community_partners
  SET balance_cache_cents = COALESCE((
    SELECT SUM(amount_cents)
    FROM public.partner_commissions
    WHERE partner_id = COALESCE(NEW.partner_id, OLD.partner_id)
      AND status IN ('approved', 'paid')
  ), 0)
  WHERE id = COALESCE(NEW.partner_id, OLD.partner_id);
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_update_partner_balance
  AFTER INSERT OR UPDATE OF status, amount_cents OR DELETE
  ON public.partner_commissions
  FOR EACH ROW EXECUTE FUNCTION public.update_partner_balance_cache();

-- ============================================================
-- RPC Functions
-- ============================================================

-- Admin: get partner program overview stats
CREATE OR REPLACE FUNCTION public.get_partner_overview()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSONB;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  SELECT jsonb_build_object(
    'total_partners', (SELECT COUNT(*) FROM community_partners),
    'active_partners', (SELECT COUNT(*) FROM community_partners WHERE status = 'active'),
    'pending_partners', (SELECT COUNT(*) FROM community_partners WHERE status = 'pending'),
    'total_referrals', (SELECT COUNT(*) FROM partner_referrals),
    'converted_referrals', (SELECT COUNT(*) FROM partner_referrals WHERE converted_at IS NOT NULL),
    'total_commissions_cents', COALESCE((
      SELECT SUM(amount_cents) FROM partner_commissions
      WHERE type = 'earning' AND status IN ('approved', 'paid')
    ), 0),
    'pending_commissions_cents', COALESCE((
      SELECT SUM(amount_cents) FROM partner_commissions
      WHERE type = 'earning' AND status = 'pending'
    ), 0),
    'pending_withdrawals', (
      SELECT COUNT(*) FROM partner_commissions
      WHERE type = 'withdrawal' AND status = 'pending'
    ),
    'linked_groups', (SELECT COUNT(*) FROM partner_linked_groups)
  ) INTO result;

  RETURN result;
END;
$$;

-- Admin: approve a pending partner
CREATE OR REPLACE FUNCTION public.approve_partner(partner_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  UPDATE community_partners
  SET status = 'active', verified_at = now()
  WHERE id = partner_id AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Partner not found or not in pending status';
  END IF;
END;
$$;

-- Admin: process a pending withdrawal (mark as paid)
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
  SET status = 'paid', paid_at = now()
  WHERE id = commission_id AND type = 'withdrawal' AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Withdrawal not found or not in pending status';
  END IF;
END;
$$;

-- Public: get partner leaderboard (active partners ranked by referrals)
CREATE OR REPLACE FUNCTION public.get_partner_leaderboard(limit_count INTEGER DEFAULT 10)
RETURNS TABLE (
  partner_id UUID,
  display_name TEXT,
  slug TEXT,
  avatar_url TEXT,
  referral_count BIGINT,
  converted_count BIGINT,
  total_earned_cents BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    cp.id AS partner_id,
    cp.display_name,
    cp.slug,
    cp.avatar_url,
    COUNT(DISTINCT pr.id) AS referral_count,
    COUNT(DISTINCT pr.id) FILTER (WHERE pr.converted_at IS NOT NULL) AS converted_count,
    COALESCE(SUM(pc.amount_cents) FILTER (
      WHERE pc.type = 'earning' AND pc.status IN ('approved', 'paid')
    ), 0) AS total_earned_cents
  FROM community_partners cp
  LEFT JOIN partner_referrals pr ON pr.partner_id = cp.id
  LEFT JOIN partner_commissions pc ON pc.partner_id = cp.id
  WHERE cp.status = 'active'
  GROUP BY cp.id, cp.display_name, cp.slug, cp.avatar_url
  ORDER BY referral_count DESC, converted_count DESC
  LIMIT limit_count;
END;
$$;

-- Admin: approve commissions older than 14 days
CREATE OR REPLACE FUNCTION public.approve_mature_commissions()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  approved_count INTEGER;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  UPDATE partner_commissions
  SET status = 'approved', approved_at = now()
  WHERE type = 'earning'
    AND status = 'pending'
    AND created_at < now() - INTERVAL '14 days';

  GET DIAGNOSTICS approved_count = ROW_COUNT;
  RETURN approved_count;
END;
$$;

-- Partner: get own live stats
CREATE OR REPLACE FUNCTION public.get_my_partner_stats()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  partner_record RECORD;
  result JSONB;
BEGIN
  SELECT * INTO partner_record
  FROM community_partners
  WHERE user_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No partner record found for current user';
  END IF;

  SELECT jsonb_build_object(
    'partner_id', partner_record.id,
    'status', partner_record.status,
    'commission_rate', partner_record.commission_rate,
    'balance_cents', partner_record.balance_cache_cents,
    'total_referrals', (
      SELECT COUNT(*) FROM partner_referrals
      WHERE partner_id = partner_record.id
    ),
    'converted_referrals', (
      SELECT COUNT(*) FROM partner_referrals
      WHERE partner_id = partner_record.id AND converted_at IS NOT NULL
    ),
    'total_earned_cents', COALESCE((
      SELECT SUM(amount_cents) FROM partner_commissions
      WHERE partner_id = partner_record.id
        AND type = 'earning' AND status IN ('approved', 'paid')
    ), 0),
    'pending_earnings_cents', COALESCE((
      SELECT SUM(amount_cents) FROM partner_commissions
      WHERE partner_id = partner_record.id
        AND type = 'earning' AND status = 'pending'
    ), 0),
    'total_withdrawn_cents', COALESCE((
      SELECT ABS(SUM(amount_cents)) FROM partner_commissions
      WHERE partner_id = partner_record.id
        AND type = 'withdrawal' AND status IN ('approved', 'paid')
    ), 0),
    'linked_groups', (
      SELECT COUNT(*) FROM partner_linked_groups
      WHERE partner_id = partner_record.id
    ),
    'this_month_earned_cents', COALESCE((
      SELECT SUM(amount_cents) FROM partner_commissions
      WHERE partner_id = partner_record.id
        AND type = 'earning'
        AND status IN ('approved', 'paid')
        AND created_at >= date_trunc('month', now())
    ), 0)
  ) INTO result;

  RETURN result;
END;
$$;

-- ============================================================
-- Grant execute on all functions to authenticated
-- ============================================================

GRANT EXECUTE ON FUNCTION public.get_partner_overview() TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_partner(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_withdrawal(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_partner_leaderboard(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_mature_commissions() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_partner_stats() TO authenticated;
