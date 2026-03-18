# Stripe Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Complete end-to-end Stripe billing integration — products, checkout, webhooks, customer portal, invoices, coupons, annual pricing, and paywall.

**Architecture:** Supabase Edge Functions handle all Stripe server-side logic (checkout sessions, webhooks, portal sessions, invoice fetching). Dashboard frontend calls Edge Functions via Supabase's `functions.invoke()`. Stripe webhooks update the subscriptions table which the dashboard reads via existing queries.

**Tech Stack:** Stripe API (via `stripe` npm for Deno), Supabase Edge Functions (Deno), React dashboard (existing), Supabase PostgreSQL (existing schema).

---

### Task 1: Create Stripe Products & Prices

**Files:**
- None (Stripe API calls only)

**Step 1: Create the 3 products and 6 prices in Stripe**

Use the Stripe MCP tools to create:

1. Product "Starter" → monthly price $149 + yearly price $1,490
2. Product "Pro" → monthly price $249 + yearly price $2,490
3. Product "Unlimited" → monthly price $399 + yearly price $3,990

**Step 2: Record the IDs**

Save all product IDs and price IDs for use in the migration.

**Step 3: Commit — N/A (no file changes)**

---

### Task 2: Database Migration — Add Stripe Fields to Plans

**Files:**
- Create: `supabase/migrations/021_stripe_billing.sql`

**Step 1: Write migration SQL**

```sql
-- Add annual pricing and product ID to plans
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS stripe_product_id TEXT UNIQUE;
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS stripe_yearly_price_id TEXT UNIQUE;

-- Add 'trialing' to subscription status check constraint
ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_status_check;
ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_status_check
  CHECK (status IN ('active', 'past_due', 'canceled', 'paused', 'trialing'));

-- Update plans with Stripe IDs (replace with actual IDs from Task 1)
UPDATE public.plans SET
  stripe_product_id = '{{STARTER_PRODUCT_ID}}',
  stripe_price_id = '{{STARTER_MONTHLY_PRICE_ID}}',
  stripe_yearly_price_id = '{{STARTER_YEARLY_PRICE_ID}}'
WHERE slug = 'starter';

UPDATE public.plans SET
  stripe_product_id = '{{PRO_PRODUCT_ID}}',
  stripe_price_id = '{{PRO_MONTHLY_PRICE_ID}}',
  stripe_yearly_price_id = '{{PRO_YEARLY_PRICE_ID}}'
WHERE slug = 'pro';

UPDATE public.plans SET
  stripe_product_id = '{{UNLIMITED_PRODUCT_ID}}',
  stripe_price_id = '{{UNLIMITED_MONTHLY_PRICE_ID}}',
  stripe_yearly_price_id = '{{UNLIMITED_YEARLY_PRICE_ID}}'
WHERE slug = 'unlimited';

-- Update plan price_cents to match (if needed)
UPDATE public.plans SET price_cents = 14900 WHERE slug = 'starter';
UPDATE public.plans SET price_cents = 24900 WHERE slug = 'pro';
UPDATE public.plans SET price_cents = 39900 WHERE slug = 'unlimited';
```

**Step 2: Run the migration**

```bash
pnpm db:migrate
```

**Step 3: Commit**

```bash
git add supabase/migrations/021_stripe_billing.sql
git commit -m "feat(db): add stripe product/price IDs to plans table"
```

---

### Task 3: Edge Function — create-checkout-session

**Files:**
- Create: `supabase/functions/create-checkout-session/index.ts`

**Step 1: Write the edge function**

```typescript
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import Stripe from "https://esm.sh/stripe@17.7.0?target=deno";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2025-04-30.basil",
});

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const DASHBOARD_URL = Deno.env.get("DASHBOARD_URL") || "https://app.leadexpress.com";

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, content-type, x-client-info, apikey",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    // Authenticate user via Supabase JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response("Unauthorized", { status: 401 });

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return new Response("Unauthorized", { status: 401 });

    const { priceId, planSlug, billingInterval } = await req.json();
    if (!priceId || !planSlug) {
      return new Response(JSON.stringify({ error: "Missing priceId or planSlug" }), { status: 400 });
    }

    // Get or create Stripe customer
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();

    let customerId = sub?.stripe_customer_id;

    if (!customerId || customerId === "") {
      // Get user profile for email/name
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, phone")
        .eq("id", user.id)
        .single();

      const customer = await stripe.customers.create({
        email: user.email,
        name: profile?.full_name || undefined,
        metadata: { supabase_user_id: user.id },
      });
      customerId = customer.id;

      // Save customer ID
      await supabase
        .from("subscriptions")
        .update({ stripe_customer_id: customerId })
        .eq("user_id", user.id);
    }

    // Create Checkout Session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: true,
      success_url: `${DASHBOARD_URL}/subscription?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${DASHBOARD_URL}/subscription?canceled=true`,
      subscription_data: {
        metadata: {
          supabase_user_id: user.id,
          plan_slug: planSlug,
          billing_interval: billingInterval || "monthly",
        },
      },
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err) {
    console.error("[checkout] Error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
});
```

**Step 2: Commit**

```bash
git add supabase/functions/create-checkout-session/index.ts
git commit -m "feat(billing): add create-checkout-session edge function"
```

---

### Task 4: Edge Function — stripe-webhook

**Files:**
- Create: `supabase/functions/stripe-webhook/index.ts`

**Step 1: Write the webhook handler**

```typescript
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import Stripe from "https://esm.sh/stripe@17.7.0?target=deno";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2025-04-30.basil",
});

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig) return new Response("Missing signature", { status: 400 });

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, sig, WEBHOOK_SECRET);
  } catch (err) {
    console.error("[webhook] Signature verification failed:", err);
    return new Response("Invalid signature", { status: 400 });
  }

  console.log(`[webhook] ${event.type} — ${event.id}`);

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case "customer.subscription.updated":
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;

      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case "invoice.payment_succeeded":
        await handleInvoicePaid(event.data.object as Stripe.Invoice);
        break;

      case "invoice.payment_failed":
        await handleInvoiceFailed(event.data.object as Stripe.Invoice);
        break;

      default:
        console.log(`[webhook] Unhandled event: ${event.type}`);
    }
  } catch (err) {
    console.error(`[webhook] Handler error for ${event.type}:`, err);
    // Return 200 to prevent Stripe retries for handler errors
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" },
  });
});

// ── Handlers ──────────────────────────────────────────────────────────────

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  if (session.mode !== "subscription") return;

  const userId = session.metadata?.supabase_user_id;
  const planSlug = session.metadata?.plan_slug;
  if (!userId || !planSlug) {
    // Try from subscription metadata
    const sub = await stripe.subscriptions.retrieve(session.subscription as string);
    return handleSubscriptionUpdated(sub);
  }

  // Get plan ID from slug
  const { data: plan } = await supabase
    .from("plans")
    .select("id")
    .eq("slug", planSlug)
    .single();

  if (!plan) {
    console.error(`[webhook] Plan not found for slug: ${planSlug}`);
    return;
  }

  const subscription = await stripe.subscriptions.retrieve(session.subscription as string);

  // Upsert subscription
  await supabase.from("subscriptions").upsert(
    {
      user_id: userId,
      plan_id: plan.id,
      stripe_subscription_id: subscription.id,
      stripe_customer_id: session.customer as string,
      status: subscription.status === "trialing" ? "trialing" : "active",
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
    },
    { onConflict: "user_id" },
  );

  console.log(`[webhook] Subscription activated: user=${userId}, plan=${planSlug}`);
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const userId = subscription.metadata?.supabase_user_id;
  if (!userId) {
    console.warn("[webhook] No user ID in subscription metadata");
    return;
  }

  // Find the plan by price ID
  const priceId = subscription.items.data[0]?.price?.id;
  const { data: plan } = await supabase
    .from("plans")
    .select("id")
    .or(`stripe_price_id.eq.${priceId},stripe_yearly_price_id.eq.${priceId}`)
    .maybeSingle();

  const statusMap: Record<string, string> = {
    active: "active",
    past_due: "past_due",
    canceled: "canceled",
    unpaid: "past_due",
    trialing: "trialing",
    paused: "paused",
  };

  const updates: Record<string, unknown> = {
    stripe_subscription_id: subscription.id,
    stripe_customer_id: subscription.customer as string,
    status: statusMap[subscription.status] || "active",
    current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
  };

  if (plan) {
    updates.plan_id = plan.id;
  }

  await supabase
    .from("subscriptions")
    .update(updates)
    .eq("user_id", userId);

  console.log(`[webhook] Subscription updated: user=${userId}, status=${subscription.status}`);
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const userId = subscription.metadata?.supabase_user_id;
  if (!userId) return;

  await supabase
    .from("subscriptions")
    .update({ status: "canceled" })
    .eq("user_id", userId);

  console.log(`[webhook] Subscription canceled: user=${userId}`);
}

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  if (!invoice.subscription) return;

  const sub = await stripe.subscriptions.retrieve(invoice.subscription as string);
  const userId = sub.metadata?.supabase_user_id;
  if (!userId) return;

  await supabase
    .from("subscriptions")
    .update({
      status: "active",
      current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
    })
    .eq("user_id", userId);

  console.log(`[webhook] Invoice paid: user=${userId}`);
}

async function handleInvoiceFailed(invoice: Stripe.Invoice) {
  if (!invoice.subscription) return;

  const sub = await stripe.subscriptions.retrieve(invoice.subscription as string);
  const userId = sub.metadata?.supabase_user_id;
  if (!userId) return;

  await supabase
    .from("subscriptions")
    .update({ status: "past_due" })
    .eq("user_id", userId);

  console.log(`[webhook] Invoice failed: user=${userId}`);
}
```

**Step 2: Commit**

```bash
git add supabase/functions/stripe-webhook/index.ts
git commit -m "feat(billing): add stripe webhook handler edge function"
```

---

### Task 5: Edge Function — create-portal-session

**Files:**
- Create: `supabase/functions/create-portal-session/index.ts`

**Step 1: Write the portal session edge function**

```typescript
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import Stripe from "https://esm.sh/stripe@17.7.0?target=deno";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2025-04-30.basil",
});

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const DASHBOARD_URL = Deno.env.get("DASHBOARD_URL") || "https://app.leadexpress.com";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, content-type, x-client-info, apikey",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
    });
  }

  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response("Unauthorized", { status: 401 });

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return new Response("Unauthorized", { status: 401 });

    // Get Stripe customer ID
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!sub?.stripe_customer_id || sub.stripe_customer_id === "") {
      return new Response(JSON.stringify({ error: "No billing account found" }), { status: 404 });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: sub.stripe_customer_id,
      return_url: `${DASHBOARD_URL}/subscription`,
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err) {
    console.error("[portal] Error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
});
```

**Step 2: Commit**

```bash
git add supabase/functions/create-portal-session/index.ts
git commit -m "feat(billing): add create-portal-session edge function"
```

---

### Task 6: Edge Function — get-invoices

**Files:**
- Create: `supabase/functions/get-invoices/index.ts`

**Step 1: Write the invoices edge function**

```typescript
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import Stripe from "https://esm.sh/stripe@17.7.0?target=deno";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2025-04-30.basil",
});

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, content-type, x-client-info, apikey",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
      },
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response("Unauthorized", { status: 401 });

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return new Response("Unauthorized", { status: 401 });

    const { data: sub } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!sub?.stripe_customer_id || sub.stripe_customer_id === "") {
      return new Response(JSON.stringify({ invoices: [] }), {
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    const invoices = await stripe.invoices.list({
      customer: sub.stripe_customer_id,
      limit: 12,
    });

    const simplified = invoices.data.map((inv) => ({
      id: inv.id,
      number: inv.number,
      status: inv.status,
      amount_due: inv.amount_due,
      amount_paid: inv.amount_paid,
      currency: inv.currency,
      created: inv.created,
      period_start: inv.period_start,
      period_end: inv.period_end,
      hosted_invoice_url: inv.hosted_invoice_url,
      invoice_pdf: inv.invoice_pdf,
    }));

    return new Response(JSON.stringify({ invoices: simplified }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  } catch (err) {
    console.error("[invoices] Error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
});
```

**Step 2: Commit**

```bash
git add supabase/functions/get-invoices/index.ts
git commit -m "feat(billing): add get-invoices edge function"
```

---

### Task 7: Edge Function — update-subscription (upgrade/downgrade)

**Files:**
- Create: `supabase/functions/update-subscription/index.ts`

**Step 1: Write the upgrade/downgrade edge function**

```typescript
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import Stripe from "https://esm.sh/stripe@17.7.0?target=deno";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2025-04-30.basil",
});

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, content-type, x-client-info, apikey",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
    });
  }

  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response("Unauthorized", { status: 401 });

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return new Response("Unauthorized", { status: 401 });

    const { newPriceId } = await req.json();
    if (!newPriceId) {
      return new Response(JSON.stringify({ error: "Missing newPriceId" }), { status: 400 });
    }

    // Get current subscription
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("stripe_subscription_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!sub?.stripe_subscription_id) {
      return new Response(JSON.stringify({ error: "No active subscription" }), { status: 404 });
    }

    // Get current subscription from Stripe
    const subscription = await stripe.subscriptions.retrieve(sub.stripe_subscription_id);
    const currentItemId = subscription.items.data[0].id;

    // Update with proration
    const updated = await stripe.subscriptions.update(sub.stripe_subscription_id, {
      items: [{ id: currentItemId, price: newPriceId }],
      proration_behavior: "create_prorations",
    });

    return new Response(JSON.stringify({ status: updated.status }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  } catch (err) {
    console.error("[update-sub] Error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
});
```

**Step 2: Commit**

```bash
git add supabase/functions/update-subscription/index.ts
git commit -m "feat(billing): add update-subscription edge function for upgrades/downgrades"
```

---

### Task 8: Dashboard — Billing Hook (useSubscriptionBilling)

**Files:**
- Create: `apps/dashboard/src/hooks/useSubscriptionBilling.ts`

**Step 1: Write the billing hook**

```typescript
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'

interface PlanData {
  id: string
  slug: string
  name: string
  price_cents: number
  stripe_price_id: string | null
  stripe_yearly_price_id: string | null
  stripe_product_id: string | null
  max_groups: number
  max_professions: number
  max_zip_codes: number
}

interface SubscriptionData {
  status: string
  current_period_end: string
  stripe_subscription_id: string | null
  stripe_customer_id: string
  plan: PlanData
}

interface Invoice {
  id: string
  number: string | null
  status: string
  amount_due: number
  amount_paid: number
  currency: string
  created: number
  hosted_invoice_url: string | null
  invoice_pdf: string | null
}

export function useSubscriptionBilling() {
  const { effectiveUserId } = useAuth()
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null)
  const [plans, setPlans] = useState<PlanData[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)

  // Load subscription + plans
  useEffect(() => {
    if (!effectiveUserId) { setLoading(false); return }

    async function load() {
      const [subRes, plansRes] = await Promise.all([
        supabase
          .from('subscriptions')
          .select('status, current_period_end, stripe_subscription_id, stripe_customer_id, plans (*)')
          .eq('user_id', effectiveUserId)
          .maybeSingle(),
        supabase
          .from('plans')
          .select('*')
          .eq('is_active', true)
          .order('price_cents'),
      ])

      if (subRes.data) {
        setSubscription({
          ...subRes.data,
          plan: subRes.data.plans as unknown as PlanData,
        })
      }
      if (plansRes.data) setPlans(plansRes.data as PlanData[])
      setLoading(false)
    }

    load()
  }, [effectiveUserId])

  // Load invoices
  const loadInvoices = useCallback(async () => {
    const { data, error } = await supabase.functions.invoke('get-invoices')
    if (!error && data?.invoices) setInvoices(data.invoices)
  }, [])

  useEffect(() => { loadInvoices() }, [loadInvoices])

  // Create checkout session → redirect
  const subscribe = useCallback(async (priceId: string, planSlug: string, billingInterval: 'monthly' | 'yearly') => {
    setActionLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout-session', {
        body: { priceId, planSlug, billingInterval },
      })
      if (error) throw error
      if (data?.url) window.location.href = data.url
    } finally {
      setActionLoading(false)
    }
  }, [])

  // Upgrade/downgrade
  const changePlan = useCallback(async (newPriceId: string) => {
    setActionLoading(true)
    try {
      const { error } = await supabase.functions.invoke('update-subscription', {
        body: { newPriceId },
      })
      if (error) throw error
      // Reload subscription data
      window.location.reload()
    } finally {
      setActionLoading(false)
    }
  }, [])

  // Open portal
  const openPortal = useCallback(async () => {
    setActionLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('create-portal-session')
      if (error) throw error
      if (data?.url) window.location.href = data.url
    } finally {
      setActionLoading(false)
    }
  }, [])

  const isActive = subscription?.status === 'active' || subscription?.status === 'trialing'
  const isTrialing = subscription?.status === 'trialing'
  const hasStripeSubscription = !!subscription?.stripe_subscription_id

  return {
    subscription,
    plans,
    invoices,
    loading,
    actionLoading,
    isActive,
    isTrialing,
    hasStripeSubscription,
    subscribe,
    changePlan,
    openPortal,
    loadInvoices,
  }
}
```

**Step 2: Commit**

```bash
git add apps/dashboard/src/hooks/useSubscriptionBilling.ts
git commit -m "feat(billing): add useSubscriptionBilling hook"
```

---

### Task 9: Dashboard — Update Subscription Page

**Files:**
- Modify: `apps/dashboard/src/pages/Subscription.tsx`

**Step 1: Rewrite the Subscription page**

Replace the entire `Subscription.tsx` with the new version that:
- Uses `useSubscriptionBilling()` hook
- Adds Monthly/Annual toggle
- Shows plan cards with Subscribe/Upgrade/Downgrade/Current buttons
- Shows invoices list with links to hosted invoice pages
- Shows "Manage Billing" button → Stripe Customer Portal
- Shows success/canceled banners from URL params
- Shows trial banner with days remaining
- Shows active discount if present

Key changes:
- Replace hardcoded `PLANS` array with DB-fetched plans
- Add `billingInterval` state toggle (monthly/yearly)
- Plan card buttons call `subscribe()` (new sub) or `changePlan()` (existing sub)
- Billing section shows real invoices
- "Manage Billing" button calls `openPortal()`

**Step 2: Commit**

```bash
git add apps/dashboard/src/pages/Subscription.tsx
git commit -m "feat(billing): update subscription page with Stripe checkout & portal"
```

---

### Task 10: Dashboard — Paywall Component

**Files:**
- Create: `apps/dashboard/src/components/Paywall.tsx`
- Modify: `apps/dashboard/src/App.tsx` (wrap contractor routes)

**Step 1: Create Paywall component**

```typescript
// Paywall.tsx — full-screen overlay when subscription is not active
import { useSubscriptionBilling } from '../hooks/useSubscriptionBilling'
import { Navigate } from 'react-router-dom'

export default function RequireSubscription({ children }: { children: React.ReactNode }) {
  const { isActive, loading } = useSubscriptionBilling()

  if (loading) return null // parent shows loading

  // Allow access to subscription and profile pages always
  // This component wraps other routes only

  if (!isActive) {
    return <Navigate to="/subscription" replace />
  }

  return <>{children}</>
}
```

**Step 2: Wrap protected routes in App.tsx**

In `AppShell`, wrap routes that should be behind the paywall (everything except `/subscription` and `/profile`) with `<RequireSubscription>`.

Replace the routes block in AppShell:
```tsx
<Route path="/leads" element={<RequireSubscription><LeadsFeed /></RequireSubscription>} />
<Route path="/group-scan" element={<RequireSubscription><ContractorGroupScan /></RequireSubscription>} />
<Route path="/subcontractors" element={<RequireSubscription><Subcontractors /></RequireSubscription>} />
// ... etc for protected routes
// /subscription and /profile remain unwrapped
```

**Step 3: Commit**

```bash
git add apps/dashboard/src/components/Paywall.tsx apps/dashboard/src/App.tsx
git commit -m "feat(billing): add paywall redirect for inactive subscriptions"
```

---

### Task 11: Update Shared Types

**Files:**
- Modify: `packages/shared/src/types.ts`

**Step 1: Add stripe_product_id and stripe_yearly_price_id to Plan interface**

```typescript
export interface Plan {
  id: string
  slug: PlanSlug
  name: string
  price_cents: number
  max_groups: number
  max_professions: number
  max_zip_codes: number
  stripe_price_id: string | null
  stripe_product_id: string | null       // NEW
  stripe_yearly_price_id: string | null  // NEW
  is_active: boolean
  created_at: string
}
```

**Step 2: Commit**

```bash
git add packages/shared/src/types.ts
git commit -m "feat(types): add stripe_product_id and stripe_yearly_price_id to Plan"
```

---

### Task 12: Deploy Edge Functions & Set Env Vars

**Files:**
- None (deployment commands)

**Step 1: Set Stripe env vars in Supabase**

```bash
supabase secrets set STRIPE_SECRET_KEY=sk_test_...
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
supabase secrets set DASHBOARD_URL=https://app.leadexpress.com
```

**Step 2: Deploy edge functions**

```bash
supabase functions deploy create-checkout-session --no-verify-jwt
supabase functions deploy stripe-webhook --no-verify-jwt
supabase functions deploy create-portal-session --no-verify-jwt
supabase functions deploy get-invoices --no-verify-jwt
supabase functions deploy update-subscription --no-verify-jwt
```

Note: `--no-verify-jwt` because these functions handle auth internally (checkout/portal/invoices via Bearer token, webhook via Stripe signature).

**Step 3: Configure Stripe webhook endpoint**

In Stripe Dashboard → Developers → Webhooks:
- Endpoint URL: `https://<project-ref>.supabase.co/functions/v1/stripe-webhook`
- Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_succeeded`, `invoice.payment_failed`

**Step 4: Configure Customer Portal in Stripe Dashboard**

Stripe Dashboard → Settings → Billing → Customer Portal:
- Enable "Allow customers to update payment methods"
- Enable "Allow customers to cancel subscriptions"
- Enable "Allow customers to switch plans"
- Add all 6 prices (3 monthly + 3 annual)

---

### Task 13: End-to-End Testing

**Step 1: Test new subscription flow**

1. Log in as a contractor with expired trial
2. Verify paywall redirects to `/subscription`
3. Click "Subscribe" on Starter plan
4. Complete Stripe Checkout with test card `4242 4242 4242 4242`
5. Verify redirect back to dashboard
6. Verify subscription status = `active` in DB
7. Verify protected routes are accessible

**Step 2: Test upgrade flow**

1. Click "Upgrade" on Pro plan
2. Verify subscription updates with proration
3. Verify plan changes in DB

**Step 3: Test Customer Portal**

1. Click "Manage Billing"
2. Verify redirect to Stripe Portal
3. Test payment method update
4. Test cancel flow
5. Return to dashboard, verify status update

**Step 4: Test invoices**

1. Verify invoice list shows on subscription page
2. Click invoice link — verify hosted invoice opens

**Step 5: Test coupon**

1. Create test coupon in Stripe: `LAUNCH50` — 50% off first month
2. Start new checkout → enter promo code
3. Verify discount applied

---

## Summary of Edge Functions

| Function | Auth | Purpose |
|----------|------|---------|
| `create-checkout-session` | Bearer JWT | Creates Stripe Checkout Session for new/upgrade subscriptions |
| `stripe-webhook` | Stripe signature | Handles all Stripe events → updates DB |
| `create-portal-session` | Bearer JWT | Creates Stripe Customer Portal session |
| `get-invoices` | Bearer JWT | Fetches customer invoices from Stripe |
| `update-subscription` | Bearer JWT | Handles plan upgrades/downgrades with proration |

## Environment Variables Needed

| Variable | Where | Value |
|----------|-------|-------|
| `STRIPE_SECRET_KEY` | Supabase secrets | `sk_test_...` from Stripe Dashboard |
| `STRIPE_WEBHOOK_SECRET` | Supabase secrets | `whsec_...` from webhook endpoint config |
| `DASHBOARD_URL` | Supabase secrets | `https://app.leadexpress.com` |
