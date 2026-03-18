import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import Stripe from "npm:stripe@17";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!);

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
    // Fallback: try from subscription metadata
    if (session.subscription) {
      const sub = await stripe.subscriptions.retrieve(session.subscription as string);
      return handleSubscriptionUpdated(sub);
    }
    console.warn("[webhook] checkout.session.completed missing metadata");
    return;
  }

  const { data: plan } = await supabase
    .from("plans")
    .select("id")
    .eq("slug", planSlug)
    .single();

  if (!plan) {
    console.error(`[webhook] Plan not found: ${planSlug}`);
    return;
  }

  const subscription = await stripe.subscriptions.retrieve(session.subscription as string);

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
    console.warn("[webhook] subscription.updated missing supabase_user_id");
    return;
  }

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

  if (plan) updates.plan_id = plan.id;

  await supabase.from("subscriptions").update(updates).eq("user_id", userId);
  console.log(`[webhook] Subscription updated: user=${userId}, status=${subscription.status}`);
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const userId = subscription.metadata?.supabase_user_id;
  if (!userId) return;

  await supabase.from("subscriptions").update({ status: "canceled" }).eq("user_id", userId);
  console.log(`[webhook] Subscription canceled: user=${userId}`);
}

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  if (!invoice.subscription) return;

  const sub = await stripe.subscriptions.retrieve(invoice.subscription as string);
  const userId = sub.metadata?.supabase_user_id;
  if (!userId) return;

  await supabase.from("subscriptions").update({
    status: "active",
    current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
  }).eq("user_id", userId);

  console.log(`[webhook] Invoice paid: user=${userId}`);
}

async function handleInvoiceFailed(invoice: Stripe.Invoice) {
  if (!invoice.subscription) return;

  const sub = await stripe.subscriptions.retrieve(invoice.subscription as string);
  const userId = sub.metadata?.supabase_user_id;
  if (!userId) return;

  await supabase.from("subscriptions").update({ status: "past_due" }).eq("user_id", userId);
  console.log(`[webhook] Invoice failed: user=${userId}`);
}
