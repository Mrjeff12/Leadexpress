-- 106_payment_method_on_subscriptions.sql
-- Adds a column to store the Stripe PaymentMethod id collected during onboarding
-- via SetupIntent (no charge). This is separate from stripe_subscription_id and
-- is set before the trial even converts — it represents "saved card for later".

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS stripe_payment_method_id TEXT;

COMMENT ON COLUMN public.subscriptions.stripe_payment_method_id IS
  'Stripe PaymentMethod id saved during onboarding via SetupIntent. Used to auto-charge when trial converts.';

-- Partial index for quick lookup of users who have NOT yet saved a card
-- (used to prompt them on the dashboard).
CREATE INDEX IF NOT EXISTS idx_subscriptions_no_payment_method
  ON public.subscriptions (user_id)
  WHERE stripe_payment_method_id IS NULL;
