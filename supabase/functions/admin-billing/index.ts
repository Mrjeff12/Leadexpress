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
      default:
        return json({ error: `Unknown action: ${action}` }, corsHeaders, 400);
    }

    return json(result, corsHeaders);
  } catch (err) {
    console.error("[admin-billing] Error:", err);
    return json({ error: (err as Error).message }, corsHeaders, 500);
  }
});
