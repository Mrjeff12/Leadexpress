-- 021: Stripe billing integration
-- Adds product/price IDs to plans table for Stripe integration

-- Add annual pricing and product ID columns
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS stripe_product_id TEXT UNIQUE;
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS stripe_yearly_price_id TEXT UNIQUE;

-- Ensure 'trialing' is valid subscription status
ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_status_check;
ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_status_check
  CHECK (status IN ('active', 'past_due', 'canceled', 'paused', 'trialing'));

-- Update Starter plan with Stripe IDs
UPDATE public.plans SET
  stripe_product_id = 'prod_UAbFTVwYWk7DVL',
  stripe_price_id = 'price_1TCG3GCrhYJDA3GP0xRjchip',
  stripe_yearly_price_id = 'price_1TCG3HCrhYJDA3GPBRu988i5',
  price_cents = 14900
WHERE slug = 'starter';

-- Update Pro plan with Stripe IDs
UPDATE public.plans SET
  stripe_product_id = 'prod_UAbFIpGzPFHXcG',
  stripe_price_id = 'price_1TCG3ICrhYJDA3GPz3ZBafI6',
  stripe_yearly_price_id = 'price_1TCG3JCrhYJDA3GPuRl1zPHZ',
  price_cents = 24900
WHERE slug = 'pro';

-- Update Unlimited plan with Stripe IDs
UPDATE public.plans SET
  stripe_product_id = 'prod_UAbFYxk6NnONoM',
  stripe_price_id = 'price_1TCG3KCrhYJDA3GPBomzzCga',
  stripe_yearly_price_id = 'price_1TCG3LCrhYJDA3GPYGpu9dIH',
  price_cents = 39900
WHERE slug = 'unlimited';
