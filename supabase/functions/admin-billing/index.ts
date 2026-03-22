import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import Stripe from "npm:stripe@17";
import { getCorsHeaders } from "../_shared/cors.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!);

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function json(body: unknown, corsHeaders: Record<string, string>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ---------------------------------------------------------------------------
// Action handlers
// ---------------------------------------------------------------------------

async function handlePayments(params: Record<string, unknown>) {
  const listParams: Stripe.ChargeListParams = {
    limit: (params.limit as number) || 50,
    expand: ["data.customer"],
  };
  if (params.starting_after) listParams.starting_after = params.starting_after as string;
  if (params.created_gte || params.created_lte) {
    listParams.created = {} as Stripe.RangeQueryParam;
    if (params.created_gte) (listParams.created as Stripe.RangeQueryParam).gte = params.created_gte as number;
    if (params.created_lte) (listParams.created as Stripe.RangeQueryParam).lte = params.created_lte as number;
  }

  const charges = await stripe.charges.list(listParams);

  const data = charges.data.map((ch) => {
    const customerObj =
      typeof ch.customer === "object" && ch.customer !== null
        ? (ch.customer as Stripe.Customer)
        : null;

    return {
      id: ch.id,
      amount: ch.amount,
      currency: ch.currency,
      status: ch.status,
      description: ch.description,
      created: ch.created,
      refunded: ch.refunded,
      amount_refunded: ch.amount_refunded,
      receipt_url: ch.receipt_url,
      invoice: ch.invoice,
      payment_method_brand: ch.payment_method_details?.card?.brand ?? ch.payment_method_details?.type ?? null,
      payment_method_last4: ch.payment_method_details?.card?.last4 ?? null,
      payment_method_type: ch.payment_method_details?.type ?? null,
      customer_email: customerObj?.email ?? null,
      customer_name: customerObj?.name ?? null,
      failure_message: ch.failure_message,
    };
  });

  return { data, has_more: charges.has_more };
}

async function handleInvoices(params: Record<string, unknown>) {
  const listParams: Stripe.InvoiceListParams = {
    limit: (params.limit as number) || 50,
    expand: ["data.customer"],
  };
  if (params.starting_after) listParams.starting_after = params.starting_after as string;
  if (params.status) listParams.status = params.status as Stripe.InvoiceListParams.Status;

  const invoices = await stripe.invoices.list(listParams);

  const data = invoices.data.map((inv) => {
    const customerObj =
      typeof inv.customer === "object" && inv.customer !== null
        ? (inv.customer as Stripe.Customer)
        : null;

    return {
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
      customer_email: customerObj?.email ?? null,
      customer_name: customerObj?.name ?? null,
    };
  });

  return { data, has_more: invoices.has_more };
}

async function handleBalance() {
  const balance = await stripe.balance.retrieve();
  return {
    available: balance.available.map((b) => ({ amount: b.amount, currency: b.currency })),
    pending: balance.pending.map((b) => ({ amount: b.amount, currency: b.currency })),
  };
}

async function handleKpis() {
  // Start of current month (UTC)
  const now = new Date();
  const startOfMonth = Math.floor(
    new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).getTime() / 1000,
  );

  const charges = await stripe.charges.list({
    created: { gte: startOfMonth },
    limit: 100,
  });

  let totalCollected = 0;
  let succeededCount = 0;
  let failedCount = 0;
  let refundedCount = 0;
  let refundedAmount = 0;

  for (const ch of charges.data) {
    if (ch.status === "succeeded") {
      succeededCount++;
      totalCollected += ch.amount;
    } else if (ch.status === "failed") {
      failedCount++;
    }
    if (ch.refunded) {
      refundedCount++;
      refundedAmount += ch.amount_refunded;
    }
  }

  const disputes = await stripe.disputes.list({
    created: { gte: startOfMonth },
    limit: 100,
  });

  return {
    total_collected: totalCollected,
    succeeded_count: succeededCount,
    failed_count: failedCount,
    refunded_count: refundedCount,
    refunded_amount: refundedAmount,
    dispute_count: disputes.data.length,
  };
}

async function handleRefund(params: Record<string, unknown>) {
  if (!params.chargeId) throw new Error("chargeId is required");

  const refundParams: Stripe.RefundCreateParams = {
    charge: params.chargeId as string,
  };
  if (params.amount) refundParams.amount = params.amount as number;

  const refund = await stripe.refunds.create(refundParams);

  return {
    id: refund.id,
    status: refund.status,
    amount: refund.amount,
  };
}

async function handleAlerts() {
  // Recent disputes from Stripe
  const disputes = await stripe.disputes.list({ limit: 10 });
  const disputeData = disputes.data.map((d) => ({
    id: d.id,
    amount: d.amount,
    currency: d.currency,
    reason: d.reason,
    status: d.status,
    created: d.created,
    charge: d.charge,
  }));

  // Recent failed charges from Stripe
  const failedCharges = await stripe.charges.list({
    limit: 10,
  });
  const failedData = failedCharges.data
    .filter((ch) => ch.status === "failed")
    .map((ch) => ({
      id: ch.id,
      amount: ch.amount,
      currency: ch.currency,
      created: ch.created,
      failure_message: ch.failure_message,
      description: ch.description,
    }));

  // Past-due subscriptions from local DB
  const { data: pastDueSubs } = await supabase
    .from("subscriptions")
    .select(
      "user_id, status, current_period_end, stripe_customer_id, plans ( slug, name ), profiles ( full_name )",
    )
    .eq("status", "past_due");

  return {
    disputes: disputeData,
    failed_payments: failedData,
    past_due: pastDueSubs ?? [],
  };
}

// ---------------------------------------------------------------------------
// Coupons
// ---------------------------------------------------------------------------

async function handleCoupons() {
  const coupons = await stripe.coupons.list({ limit: 50 });
  const data = coupons.data.map((c) => ({
    id: c.id,
    name: c.name,
    percent_off: c.percent_off,
    amount_off: c.amount_off,
    currency: c.currency,
    duration: c.duration,
    duration_in_months: c.duration_in_months,
    max_redemptions: c.max_redemptions,
    times_redeemed: c.times_redeemed,
    valid: c.valid,
    created: c.created,
  }));
  return { data };
}

async function handleCreateCoupon(params: Record<string, unknown>) {
  const couponParams: Stripe.CouponCreateParams = {
    duration: (params.duration as Stripe.CouponCreateParams["duration"]) || "once",
  };
  if (params.name) couponParams.name = params.name as string;
  if (params.percent_off) couponParams.percent_off = params.percent_off as number;
  if (params.amount_off) {
    couponParams.amount_off = params.amount_off as number;
    couponParams.currency = (params.currency as string) || "usd";
  }
  if (params.duration_in_months) couponParams.duration_in_months = params.duration_in_months as number;
  if (params.max_redemptions) couponParams.max_redemptions = params.max_redemptions as number;

  const coupon = await stripe.coupons.create(couponParams);
  return { id: coupon.id, name: coupon.name, valid: coupon.valid };
}

async function handleDeleteCoupon(params: Record<string, unknown>) {
  if (!params.couponId) throw new Error("couponId is required");
  const deleted = await stripe.coupons.del(params.couponId as string);
  return { id: deleted.id, deleted: deleted.deleted };
}

// ---------------------------------------------------------------------------
// Products & Prices
// ---------------------------------------------------------------------------

async function handleProducts() {
  const [products, prices] = await Promise.all([
    stripe.products.list({ limit: 50, active: undefined }),
    stripe.prices.list({ limit: 100, expand: ["data.product"] }),
  ]);

  const pricesByProduct = new Map<string, Array<{
    id: string; unit_amount: number | null; currency: string;
    interval: string | null; active: boolean; nickname: string | null;
  }>>();

  for (const p of prices.data) {
    const prodId = typeof p.product === "string" ? p.product : (p.product as Stripe.Product).id;
    if (!pricesByProduct.has(prodId)) pricesByProduct.set(prodId, []);
    pricesByProduct.get(prodId)!.push({
      id: p.id,
      unit_amount: p.unit_amount,
      currency: p.currency,
      interval: p.recurring?.interval ?? null,
      active: p.active,
      nickname: p.nickname,
    });
  }

  const data = products.data.map((prod) => ({
    id: prod.id,
    name: prod.name,
    description: prod.description,
    active: prod.active,
    created: prod.created,
    images: prod.images,
    metadata: prod.metadata,
    prices: pricesByProduct.get(prod.id) || [],
  }));

  return { data };
}

async function handleCreateProduct(params: Record<string, unknown>) {
  if (!params.name) throw new Error("name is required");
  const product = await stripe.products.create({
    name: params.name as string,
    description: (params.description as string) || undefined,
  });
  return { id: product.id, name: product.name };
}

async function handleCreatePrice(params: Record<string, unknown>) {
  if (!params.productId || !params.unit_amount) throw new Error("productId and unit_amount are required");
  const price = await stripe.prices.create({
    product: params.productId as string,
    unit_amount: params.unit_amount as number,
    currency: (params.currency as string) || "usd",
    recurring: params.interval ? { interval: params.interval as Stripe.PriceCreateParams.Recurring.Interval } : undefined,
    nickname: (params.nickname as string) || undefined,
  });
  return { id: price.id, unit_amount: price.unit_amount, active: price.active };
}

async function handleToggleProduct(params: Record<string, unknown>) {
  if (!params.productId) throw new Error("productId is required");
  const product = await stripe.products.update(params.productId as string, {
    active: params.active as boolean,
  });
  return { id: product.id, active: product.active };
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // --- Auth ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, corsHeaders, 401);

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);
    if (authError || !user) return json({ error: "Unauthorized" }, corsHeaders, 401);

    // --- Admin check ---
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || profile.role !== "admin") {
      return json({ error: "Forbidden" }, corsHeaders, 403);
    }

    // --- Route action ---
    const body = await req.json();
    const { action, ...params } = body as { action: string; [key: string]: unknown };

    let result: unknown;

    switch (action) {
      case "payments":
        result = await handlePayments(params);
        break;
      case "invoices":
        result = await handleInvoices(params);
        break;
      case "balance":
        result = await handleBalance();
        break;
      case "kpis":
        result = await handleKpis();
        break;
      case "refund":
        result = await handleRefund(params);
        break;
      case "alerts":
        result = await handleAlerts();
        break;
      case "coupons":
        result = await handleCoupons();
        break;
      case "create_coupon":
        result = await handleCreateCoupon(params);
        break;
      case "delete_coupon":
        result = await handleDeleteCoupon(params);
        break;
      case "products":
        result = await handleProducts();
        break;
      case "create_product":
        result = await handleCreateProduct(params);
        break;
      case "create_price":
        result = await handleCreatePrice(params);
        break;
      case "toggle_product":
        result = await handleToggleProduct(params);
        break;
      default:
        return json({ error: `Unknown action: ${action}` }, corsHeaders, 400);
    }

    return json(result, corsHeaders);
  } catch (err) {
    console.error("[admin-billing] Error:", err);
    return json({ error: (err as Error).message }, corsHeaders, 500);
  }
});
