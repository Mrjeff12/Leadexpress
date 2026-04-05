-- ============================================================================
-- Migration 089: Transaction safety — DB-level idempotency & reconciliation
-- ============================================================================

-- 1. Enforce commission idempotency at DB level (was only app-level check)
--    Prevents duplicate earnings for the same Stripe invoice.
CREATE UNIQUE INDEX IF NOT EXISTS idx_partner_commissions_invoice_type
  ON public.partner_commissions (stripe_invoice_id, type)
  WHERE stripe_invoice_id IS NOT NULL;

-- 2. Reconciliation log — tracks Stripe-vs-DB mismatches found by cron
CREATE TABLE IF NOT EXISTS public.reconciliation_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source      TEXT NOT NULL,              -- e.g. 'reconcile-payouts'
  entity_type TEXT NOT NULL,              -- e.g. 'commission', 'transfer'
  entity_id   TEXT NOT NULL,              -- commission UUID or Stripe transfer ID
  action      TEXT NOT NULL,              -- 'auto_fixed', 'needs_review'
  detail      JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_reconciliation_log_created ON public.reconciliation_log (created_at DESC);
CREATE INDEX idx_reconciliation_log_action  ON public.reconciliation_log (action) WHERE action = 'needs_review';
