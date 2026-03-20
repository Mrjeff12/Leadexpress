import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import Stripe from "npm:stripe@17";
import { getCorsHeaders } from "../_shared/cors.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!);

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

Deno.serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response("Unauthorized", { status: 401 });

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return new Response("Unauthorized", { status: 401 });

    const { amount_cents } = await req.json();

    if (!amount_cents || amount_cents <= 0) {
      return new Response(JSON.stringify({ error: "amount_cents must be positive" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get partner's Stripe customer ID (needed for coupon application)
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!sub?.stripe_customer_id || sub.stripe_customer_id === "") {
      return new Response(JSON.stringify({ error: "No billing account found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 1: Atomic balance deduction via RPC
    const { data: commissionId, error: rpcError } = await supabase.rpc('request_apply_credit', {
      p_amount_cents: amount_cents,
    });

    if (rpcError) {
      console.error("[partner-apply-credit] RPC error:", rpcError);
      const status = rpcError.message.includes("Insufficient") ? 400
        : rpcError.message.includes("active partner") ? 403
        : 500;
      return new Response(JSON.stringify({ error: rpcError.message }), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 2: Create one-time Stripe coupon and apply to customer
    try {
      const coupon = await stripe.coupons.create({
        amount_off: amount_cents,
        currency: "usd",
        duration: "once",
        max_redemptions: 1,
        name: `Partner credit - ${amount_cents / 100} USD`,
      });

      await stripe.customers.update(sub.stripe_customer_id, {
        coupon: coupon.id,
      });
    } catch (stripeErr) {
      // Step 3: Stripe failed — reverse the balance deduction
      console.error("[partner-apply-credit] Stripe error, reversing commission:", stripeErr);
      await supabase
        .from("partner_commissions")
        .update({ status: "reversed" })
        .eq("id", commissionId);

      return new Response(JSON.stringify({ error: "Failed to apply Stripe credit. Balance has been restored." }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ credit_applied_cents: amount_cents }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[partner-apply-credit] Error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
