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
      case "charge.refunded":
        await handleChargeRefunded(event.data.object as Stripe.Charge);
        break;

      // ── Stripe Connect events ──────────────────────────────────────
      case "account.updated": {
        const account = event.data.object as Stripe.Account;
        if (account.details_submitted && account.charges_enabled) {
          const { error } = await supabase
            .from("community_partners")
            .update({ stripe_onboarded: true })
            .eq("stripe_connect_id", account.id);
          if (error) {
            console.error("[webhook] Failed to update partner onboarding:", error.message);
          } else {
            console.log(`[webhook] Partner onboarded: connect_account=${account.id}`);
          }
        }
        break;
      }

      case "transfer.created": {
        const transfer = event.data.object as Stripe.Transfer;
        if (transfer.metadata?.commission_id) {
          const { error } = await supabase
            .from("partner_commissions")
            .update({
              stripe_payout_id: transfer.id,
              status: "paid",
              paid_at: new Date().toISOString(),
            })
            .eq("id", transfer.metadata.commission_id);
          if (error) {
            console.error("[webhook] Failed to update commission with transfer:", error.message);
          } else {
            console.log(
              `[webhook] Commission paid: id=${transfer.metadata.commission_id}, transfer=${transfer.id}`,
            );
          }
        }
        break;
      }

      // ── Plan/Price sync events ─────────────────────────────────────
      case "product.updated":
        await handleProductUpdated(event.data.object as Stripe.Product);
        break;
      case "price.updated":
        await handlePriceUpdated(event.data.object as Stripe.Price);
        break;
      case "price.created":
        await handlePriceCreated(event.data.object as Stripe.Price);
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

  // ── Create partner referral if checkout had a ref code ───────────────
  const refPartnerSlug = session.metadata?.ref_partner_slug;
  if (refPartnerSlug) {
    try {
      const { data: partner } = await supabase
        .from("community_partners")
        .select("id, user_id, status")
        .eq("slug", refPartnerSlug)
        .eq("status", "active")
        .maybeSingle();

      if (!partner) {
        console.warn(`[webhook] Referral partner not found or inactive: slug=${refPartnerSlug}`);
      } else if (partner.user_id === userId) {
        console.warn(`[webhook] Self-referral blocked: user=${userId}, partner=${partner.id}`);
      } else {
        const { error: refErr } = await supabase
          .from("partner_referrals")
          .insert({
            partner_id: partner.id,
            referred_user_id: userId,
            referral_source: "link",
          })
          .select("id")
          .maybeSingle();

        // 23505 = unique_violation (user already referred)
        if (refErr && refErr.code !== "23505") {
          console.error("[webhook] Failed to create partner referral:", refErr.message);
        } else if (refErr?.code === "23505") {
          console.log(`[webhook] Referral already exists for user=${userId}, skipping`);
        } else {
          console.log(`[webhook] Partner referral created: partner=${partner.id}, user=${userId}`);
        }
      }
    } catch (err) {
      console.error("[webhook] Partner referral creation error (non-blocking):", err);
    }
  }
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

  // ── Partner commission tracking ──────────────────────────────────────
  await trackPartnerCommission(userId, invoice);
}

async function handleInvoiceFailed(invoice: Stripe.Invoice) {
  if (!invoice.subscription) return;

  const sub = await stripe.subscriptions.retrieve(invoice.subscription as string);
  const userId = sub.metadata?.supabase_user_id;
  if (!userId) return;

  await supabase.from("subscriptions").update({ status: "past_due" }).eq("user_id", userId);
  console.log(`[webhook] Invoice failed: user=${userId}`);
}

async function handleChargeRefunded(charge: Stripe.Charge) {
  const invoiceId = charge.invoice as string | null;
  if (!invoiceId) {
    console.log("[webhook] charge.refunded — no invoice attached, skipping commission clawback");
    return;
  }

  try {
    // Find the earning commission tied to this invoice
    const { data: earning, error: earningErr } = await supabase
      .from("partner_commissions")
      .select("id, partner_id, referral_id, amount_cents, status")
      .eq("stripe_invoice_id", invoiceId)
      .eq("type", "earning")
      .maybeSingle();

    if (earningErr) {
      console.error("[webhook] Error looking up earning for clawback:", earningErr.message);
      return;
    }

    if (!earning) {
      console.log(`[webhook] charge.refunded — no partner commission for invoice ${invoiceId}`);
      return;
    }

    // Insert refund_clawback (negative amount)
    const { error: clawbackErr } = await supabase.from("partner_commissions").insert({
      partner_id: earning.partner_id,
      referral_id: earning.referral_id,
      type: "refund_clawback",
      amount_cents: -Math.abs(earning.amount_cents),
      status: "approved",
      stripe_invoice_id: invoiceId,
      note: `Clawback for refunded charge ${charge.id}`,
    });

    if (clawbackErr) {
      console.error("[webhook] Failed to insert refund clawback:", clawbackErr.message);
      return;
    }

    console.log(`[webhook] Refund clawback created: partner=${earning.partner_id}, amount=-${earning.amount_cents}`);

    // If original commission is still pending, reverse it
    if (earning.status === "pending") {
      const { error: reverseErr } = await supabase
        .from("partner_commissions")
        .update({ status: "reversed" })
        .eq("id", earning.id);

      if (reverseErr) {
        console.error("[webhook] Failed to reverse original commission:", reverseErr.message);
      } else {
        console.log(`[webhook] Original commission ${earning.id} reversed`);
      }
    }
  } catch (err) {
    console.error("[webhook] Commission clawback error (non-blocking):", err);
  }
}

// ── Plan / Price Sync Handlers ────────────────────────────────────────────

async function handleProductUpdated(product: Stripe.Product) {
  const { data: plan, error: lookupErr } = await supabase
    .from("plans")
    .select("id, name, is_active")
    .eq("stripe_product_id", product.id)
    .maybeSingle();

  if (lookupErr) {
    console.error("[webhook] product.updated — lookup error:", lookupErr.message);
    return;
  }

  if (!plan) {
    console.log(`[webhook] product.updated — no plan found for product ${product.id}, skipping`);
    return;
  }

  const updates: Record<string, unknown> = { name: product.name };
  if (!product.active) {
    updates.is_active = false;
  }

  const { error: updateErr } = await supabase
    .from("plans")
    .update(updates)
    .eq("id", plan.id);

  if (updateErr) {
    console.error("[webhook] product.updated — failed to update plan:", updateErr.message);
  } else {
    console.log(
      `[webhook] product.updated — plan ${plan.id} synced: name="${product.name}", active=${product.active}`,
    );
  }
}

async function handlePriceUpdated(price: Stripe.Price) {
  const productId = typeof price.product === "string" ? price.product : price.product?.id;
  if (!productId) {
    console.warn("[webhook] price.updated — no product ID on price, skipping");
    return;
  }

  const { data: plan, error: lookupErr } = await supabase
    .from("plans")
    .select("id, stripe_price_id, stripe_yearly_price_id, price_cents")
    .eq("stripe_product_id", productId)
    .maybeSingle();

  if (lookupErr) {
    console.error("[webhook] price.updated — lookup error:", lookupErr.message);
    return;
  }

  if (!plan) {
    console.log(`[webhook] price.updated — no plan found for product ${productId}, skipping`);
    return;
  }

  if (!price.active) {
    console.warn(
      `[webhook] price.updated — price ${price.id} is now inactive (plan ${plan.id})`,
    );
  }

  if (price.id === plan.stripe_price_id) {
    const { error: updateErr } = await supabase
      .from("plans")
      .update({ price_cents: price.unit_amount })
      .eq("id", plan.id);

    if (updateErr) {
      console.error("[webhook] price.updated — failed to update price_cents:", updateErr.message);
    } else {
      console.log(
        `[webhook] price.updated — plan ${plan.id} price_cents updated to ${price.unit_amount}`,
      );
    }
  } else if (price.id === plan.stripe_yearly_price_id) {
    console.log(
      `[webhook] price.updated — yearly price ${price.id} updated for plan ${plan.id} (tracked separately)`,
    );
  } else {
    console.log(
      `[webhook] price.updated — price ${price.id} does not match plan ${plan.id} monthly/yearly price IDs, skipping`,
    );
  }
}

async function handlePriceCreated(price: Stripe.Price) {
  const productId = typeof price.product === "string" ? price.product : price.product?.id;
  if (!productId) {
    console.warn("[webhook] price.created — no product ID on price, skipping");
    return;
  }

  const { data: plan, error: lookupErr } = await supabase
    .from("plans")
    .select("id, stripe_price_id, stripe_yearly_price_id")
    .eq("stripe_product_id", productId)
    .maybeSingle();

  if (lookupErr) {
    console.error("[webhook] price.created — lookup error:", lookupErr.message);
    return;
  }

  if (!plan) {
    console.log(`[webhook] price.created — no plan found for product ${productId}, skipping`);
    return;
  }

  const interval = price.recurring?.interval;
  const updates: Record<string, unknown> = {};

  if (interval === "month" && !plan.stripe_price_id) {
    updates.stripe_price_id = price.id;
    updates.price_cents = price.unit_amount;
  } else if (interval === "year" && !plan.stripe_yearly_price_id) {
    updates.stripe_yearly_price_id = price.id;
  }

  if (Object.keys(updates).length === 0) {
    console.log(
      `[webhook] price.created — price ${price.id} (interval=${interval}) not auto-linked to plan ${plan.id} (slots already filled or one-time price)`,
    );
    return;
  }

  const { error: updateErr } = await supabase
    .from("plans")
    .update(updates)
    .eq("id", plan.id);

  if (updateErr) {
    console.error("[webhook] price.created — failed to update plan:", updateErr.message);
  } else {
    console.log(
      `[webhook] price.created — plan ${plan.id} linked: ${JSON.stringify(updates)}`,
    );
  }
}

// ── Partner Commission Helpers ────────────────────────────────────────────

async function trackPartnerCommission(userId: string, invoice: Stripe.Invoice) {
  try {
    const invoiceId = invoice.id;
    const amountPaid = invoice.amount_paid;

    if (!amountPaid || amountPaid <= 0) {
      console.log("[webhook] Invoice amount is zero, skipping commission");
      return;
    }

    // Look up referral for this user
    const { data: referral, error: refErr } = await supabase
      .from("partner_referrals")
      .select("id, partner_id, converted_at")
      .eq("referred_user_id", userId)
      .maybeSingle();

    if (refErr) {
      console.error("[webhook] Error looking up partner referral:", refErr.message);
      return;
    }

    if (!referral) return; // User was not referred — nothing to do

    // Get partner record and verify active status
    const { data: partner, error: partnerErr } = await supabase
      .from("community_partners")
      .select("id, user_id, commission_rate, status")
      .eq("id", referral.partner_id)
      .single();

    if (partnerErr || !partner) {
      console.error("[webhook] Partner not found for referral:", partnerErr?.message);
      return;
    }

    if (partner.status !== "active") {
      console.log(`[webhook] Partner ${partner.id} is not active (${partner.status}), skipping commission`);
      return;
    }

    // Self-referral guard
    if (partner.user_id === userId) {
      console.warn(`[webhook] Self-referral blocked: user=${userId}, partner=${partner.id}`);
      return;
    }

    // Idempotency: check for duplicate commission on this invoice
    const { data: existing } = await supabase
      .from("partner_commissions")
      .select("id")
      .eq("stripe_invoice_id", invoiceId)
      .eq("type", "earning")
      .maybeSingle();

    if (existing) {
      console.log(`[webhook] Commission already exists for invoice ${invoiceId}, skipping`);
      return;
    }

    // Calculate commission (amount_paid is in cents)
    const commissionCents = Math.floor(amountPaid * Number(partner.commission_rate));

    if (commissionCents <= 0) {
      console.log("[webhook] Calculated commission is zero, skipping");
      return;
    }

    // Insert earning commission
    const { error: insertErr } = await supabase.from("partner_commissions").insert({
      partner_id: partner.id,
      referral_id: referral.id,
      type: "earning",
      amount_cents: commissionCents,
      status: "pending",
      stripe_invoice_id: invoiceId,
      note: `Commission on invoice ${invoiceId}`,
    });

    if (insertErr) {
      console.error("[webhook] Failed to insert commission:", insertErr.message);
      return;
    }

    console.log(`[webhook] Commission created: partner=${partner.id}, amount=${commissionCents}c, invoice=${invoiceId}`);

    // Mark referral as converted if this is the first payment
    if (!referral.converted_at) {
      const { error: convertErr } = await supabase
        .from("partner_referrals")
        .update({ converted_at: new Date().toISOString() })
        .eq("id", referral.id);

      if (convertErr) {
        console.error("[webhook] Failed to update referral converted_at:", convertErr.message);
      } else {
        console.log(`[webhook] Referral ${referral.id} marked as converted`);
      }
    }
  } catch (err) {
    console.error("[webhook] Commission tracking error (non-blocking):", err);
  }
}
