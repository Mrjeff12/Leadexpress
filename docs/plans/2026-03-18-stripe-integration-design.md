# Stripe Integration Design — LeadExpress

**Date:** 2026-03-18
**Status:** Approved
**Stripe Account:** MasterLeadFlow sandbox (`acct_1TCE2cCrhYJDA3GP`)

## Overview

End-to-end Stripe integration for LeadExpress: subscription billing, invoices, customer portal, coupons, and annual pricing. Contractors subscribe via Stripe Checkout, manage billing via Customer Portal, and see plan/invoice info in the dashboard.

## Architecture

```
Contractor Dashboard          Stripe                    Supabase
┌─────────────┐    ┌──────────────────┐    ┌─────────────────┐
│ Subscription │───>│ Checkout Session  │    │ Edge Function    │
│ Page         │    │ (hosted payment)  │───>│ (webhook handler)│
│              │<───│                  │    │        │         │
│ Plan Info    │    │ Customer Portal   │    │        ▼         │
│ Invoices     │───>│ (billing mgmt)   │    │ subscriptions    │
│              │    │                  │    │ plans            │
└─────────────┘    └──────────────────┘    │ profiles         │
                                           └─────────────────┘
```

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Payment UX | Stripe Checkout (redirect) | Fastest, PCI-compliant, all payment methods |
| Billing management | Customer Portal + dashboard info | Portal for payment/cancel, dashboard for viewing |
| Trial expiry | Block access + paywall | Strong conversion pressure |
| Webhook host | Supabase Edge Function | Serverless, close to DB, in-stack |
| Plan changes | Prorate immediately | Standard SaaS, Stripe handles math |
| Pricing | Monthly + Annual | ~17% discount for annual |
| Discounts | Coupon/promo code support | Via Stripe Checkout discounts param |

## Products & Pricing

### Monthly

| Plan | Price | Features |
|------|-------|----------|
| Starter | $149/mo | 3 professions, 10 zip codes, email support |
| Pro | $249/mo | All professions, 25 zip codes, priority support, morning digest |
| Unlimited | $399/mo | Unlimited everything, VIP support, AI suggestions, priority delivery |

### Annual (~17% savings)

| Plan | Monthly equiv | Annual price |
|------|--------------|-------------|
| Starter | $124/mo | $1,490/yr |
| Pro | $207/mo | $2,490/yr |
| Unlimited | $332/mo | $3,990/yr |

## Database Changes

### plans table additions

```sql
ALTER TABLE plans ADD COLUMN stripe_product_id TEXT UNIQUE;
ALTER TABLE plans ADD COLUMN stripe_yearly_price_id TEXT UNIQUE;
-- stripe_price_id already exists (monthly)
```

### subscriptions table (existing, no changes needed)

Fields already present: `stripe_subscription_id`, `stripe_customer_id`, `status`, `current_period_end`.

## Stripe Webhook Events

Edge Function at `/functions/v1/stripe-webhook` handles:

| Event | Action |
|-------|--------|
| `checkout.session.completed` | Create/activate subscription in DB, link Stripe customer ID |
| `customer.subscription.updated` | Sync plan, status, period end |
| `customer.subscription.deleted` | Mark subscription canceled |
| `invoice.payment_succeeded` | Update status to active |
| `invoice.payment_failed` | Update status to past_due |
| `customer.subscription.trial_will_end` | Trigger 3-day warning notification |

## Subscription Flows

### New Subscription

1. Contractor clicks "Subscribe" on plan card
2. Dashboard calls Edge Function `create-checkout-session`
3. Edge Function creates Stripe Checkout Session with plan price
4. Contractor redirected to Stripe Checkout → pays
5. Webhook `checkout.session.completed` → updates `subscriptions` table
6. Contractor redirected to `/subscription?success=true`

### Trial Expiry → Paywall

1. Trial period ends (7 days after registration)
2. Webhook `customer.subscription.updated` with `status: past_due` or `canceled`
3. Dashboard checks subscription status on load
4. If not `active` or `trialing` → show full-screen paywall
5. Paywall shows plan cards with "Subscribe Now" CTAs
6. Only `/subscription` and `/profile` routes accessible

### Upgrade/Downgrade

1. Contractor clicks "Upgrade" or "Downgrade" on plan card
2. Dashboard calls Edge Function `update-subscription`
3. Edge Function calls Stripe API to update subscription with proration
4. Webhook `customer.subscription.updated` → syncs new plan to DB
5. Dashboard refreshes to show new plan

### Manage Billing

1. Contractor clicks "Manage Billing"
2. Dashboard calls Edge Function `create-portal-session`
3. Edge Function creates Stripe Customer Portal session
4. Contractor redirected to portal (update card, view invoices, cancel)
5. Portal actions trigger webhooks → DB stays in sync

## Dashboard UI

### Subscription Page

- **Current plan card** with usage stats and active discount badge
- **Plan comparison grid** with Monthly/Annual toggle
- **Subscribe / Upgrade / Downgrade** buttons → Stripe Checkout
- **Recent invoices** list (fetched via Edge Function from Stripe)
- **"Manage Billing"** button → Stripe Customer Portal

### Paywall Component

- Full-screen overlay on all routes except `/subscription`, `/profile`
- Shows plan comparison with pricing
- "Subscribe Now" CTAs per plan
- Trial expired message if applicable

## Coupon Support

- Coupons created via Stripe Dashboard or API
- Checkout Session includes `allow_promotion_codes: true`
- Promo code input shown on Stripe Checkout page
- Active discount displayed on subscription card in dashboard

## Edge Functions

| Function | Purpose |
|----------|---------|
| `stripe-webhook` | Handle all Stripe webhook events |
| `create-checkout-session` | Generate Checkout Session for new subscriptions |
| `create-portal-session` | Generate Customer Portal session |
| `update-subscription` | Handle upgrade/downgrade with proration |
| `get-invoices` | Fetch customer invoices from Stripe |

## Security

- Webhook signature verification via `stripe-signature` header
- Stripe secret key only in Edge Function env vars
- Checkout/Portal sessions created server-side only
- Frontend only receives session URLs, never secret keys
- RLS policies ensure users only see their own subscription data
