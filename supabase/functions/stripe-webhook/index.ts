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

  // ── Idempotency gate: skip already-processed events ──────────────────
  const { data: alreadyProcessed } = await supabase
    .from("stripe_events_processed")
    .select("event_id")
    .eq("event_id", event.id)
    .maybeSingle();

  if (alreadyProcessed) {
    console.log(`[webhook] Event ${event.id} already processed, skipping`);
    return new Response(JSON.stringify({ received: true, dedup: true }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  await supabase.from("stripe_events_processed").insert({
    event_id: event.id,
    event_type: event.type,
  });

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdated(sub);
        await syncProspectSubStatus(sub.id, event.type, event.id, event.created);
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(sub);
        await syncProspectSubStatus(sub.id, event.type, event.id, event.created);
        break;
      }
      case "customer.subscription.paused": {
        const sub = event.data.object as Stripe.Subscription;
        await syncProspectSubStatus(sub.id, event.type, event.id, event.created);
        break;
      }
      case "invoice.payment_succeeded": {
        const inv = event.data.object as Stripe.Invoice;
        await handleInvoicePaid(inv);
        if (inv.subscription) {
          await syncProspectSubStatus(inv.subscription as string, event.type, event.id, event.created);
        }
        break;
      }
      case "invoice.payment_failed": {
        const inv = event.data.object as Stripe.Invoice;
        await handleInvoiceFailed(inv);
        if (inv.subscription) {
          await syncProspectSubStatus(inv.subscription as string, event.type, event.id, event.created);
        }
        break;
      }
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

      // ── Identity Verification events ────────────────────────────────
      case "identity.verification_session.verified":
      case "identity.verification_session.requires_input":
      case "identity.verification_session.canceled": {
        await handleIdentityVerification(event.data.object, event.type);
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

// ── Prospect sub-status sync (via handle_stripe_event RPC) ───────────────

async function syncProspectSubStatus(
  subscriptionId: string,
  eventType: string,
  stripeEventId: string,
  stripeCreated: number,
) {
  try {
    const { data, error } = await supabase.rpc("handle_stripe_event", {
      p_stripe_subscription_id: subscriptionId,
      p_event_type: eventType,
      p_detail: {
        stripe_event_id: stripeEventId,
        event_type: eventType,
        timestamp: stripeCreated,
      },
    });

    if (error) {
      console.error(`[webhook] handle_stripe_event error for ${eventType}:`, error.message);
    } else if (data) {
      console.log(`[webhook] Prospect sub-status updated: prospect=${data}, event=${eventType}`);
    }
  } catch (err) {
    console.error(`[webhook] handle_stripe_event exception (non-blocking):`, err);
  }
}

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

  // Atomic: upsert subscription + create partner referral
  const refPartnerSlug = session.metadata?.ref_partner_slug || null;

  const { error: rpcErr } = await supabase.rpc("handle_checkout_with_referral", {
    p_user_id: userId,
    p_plan_id: plan.id,
    p_stripe_sub_id: subscription.id,
    p_stripe_customer_id: session.customer as string,
    p_status: subscription.status === "trialing" ? "trialing" : "active",
    p_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
    p_ref_partner_slug: refPartnerSlug,
  });

  if (rpcErr) {
    console.error("[webhook] handle_checkout_with_referral error:", rpcErr.message);
  } else {
    console.log(`[webhook] Checkout completed (atomic): user=${userId}, plan=${planSlug}, ref=${refPartnerSlug || "none"}`);
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

  // Atomic: cancel subscription + churn prospect + set substatus
  const { error } = await supabase.rpc("handle_subscription_deleted_atomic", {
    p_user_id: userId,
    p_reason: "cancelled",
  });

  if (error) {
    console.error("[webhook] handle_subscription_deleted_atomic error:", error.message);
  } else {
    console.log(`[webhook] Subscription canceled (atomic): user=${userId}`);
  }
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

  // Atomic: set past_due + update prospect substatus
  const { error } = await supabase.rpc("handle_invoice_failed_atomic", {
    p_user_id: userId,
  });

  if (error) {
    console.error("[webhook] handle_invoice_failed_atomic error:", error.message);
  } else {
    console.log(`[webhook] Invoice failed (atomic): user=${userId}`);
  }
}

async function handleChargeRefunded(charge: Stripe.Charge) {
  const invoiceId = charge.invoice as string | null;
  if (!invoiceId) {
    console.log("[webhook] charge.refunded — no invoice attached, skipping commission clawback");
    return;
  }

  // Atomic: lookup earning + insert clawback + reverse original
  const { data: clawbackId, error } = await supabase.rpc("handle_charge_refunded_atomic", {
    p_invoice_id: invoiceId,
    p_charge_id: charge.id,
  });

  if (error) {
    console.error("[webhook] handle_charge_refunded_atomic error:", error.message);
  } else if (clawbackId) {
    console.log(`[webhook] Refund clawback created (atomic): clawback=${clawbackId}, charge=${charge.id}`);
  } else {
    console.log(`[webhook] charge.refunded — no partner commission for invoice ${invoiceId}`);
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

// ── Identity Verification Handler ─────────────────────────────────────────

async function handleIdentityVerification(session: any, eventType: string) {
  const sessionId = session.id;
  const userId = session.metadata?.supabase_user_id;

  if (!userId) {
    console.warn(`[webhook] identity event missing supabase_user_id: session=${sessionId}`);
    return;
  }

  const statusMap: Record<string, string> = {
    "identity.verification_session.verified": "verified",
    "identity.verification_session.requires_input": "requires_input",
    "identity.verification_session.canceled": "canceled",
  };

  const newStatus = statusMap[eventType] || "failed";

  const updates: Record<string, unknown> = {
    status: newStatus,
    updated_at: new Date().toISOString(),
  };

  if (newStatus === "verified") {
    updates.verified_at = new Date().toISOString();

    // Extract verified outputs if available
    try {
      const fullSession = await stripe.identity.verificationSessions.retrieve(
        sessionId,
        { expand: ["verified_outputs", "last_verification_report"] },
      );

      const outputs = (fullSession as any).verified_outputs;
      if (outputs) {
        if (outputs.first_name) updates.first_name = outputs.first_name;
        if (outputs.last_name) updates.last_name = outputs.last_name;
        if (outputs.dob) {
          updates.dob = `${outputs.dob.year}-${String(outputs.dob.month).padStart(2, "0")}-${String(outputs.dob.day).padStart(2, "0")}`;
        }
      }

      const report = (fullSession as any).last_verification_report;
      if (report?.document) {
        updates.document_type = report.document.type || null;
        updates.issuing_country = report.document.issuing_country || null;
        if (report.document.expiration_date) {
          const exp = report.document.expiration_date;
          updates.expiration_date = `${exp.year}-${String(exp.month).padStart(2, "0")}-${String(exp.day).padStart(2, "0")}`;
        }
      }
    } catch (err) {
      console.error("[webhook] Failed to retrieve verification details:", err);
    }
  }

  if (eventType === "identity.verification_session.requires_input") {
    const lastError = session.last_error;
    if (lastError) {
      updates.error_code = lastError.code || null;
      updates.error_reason = lastError.reason || null;
    }
  }

  // Atomic: update identity_verifications + profiles + contractor tier
  const { error } = await supabase.rpc("handle_identity_verified_atomic", {
    p_user_id: userId,
    p_stripe_session_id: sessionId,
    p_updates: updates,
  });

  if (error) {
    console.error(`[webhook] handle_identity_verified_atomic error:`, error.message);
  } else {
    console.log(`[webhook] Identity verification updated (atomic): user=${userId}, status=${newStatus}`);
  }
}
