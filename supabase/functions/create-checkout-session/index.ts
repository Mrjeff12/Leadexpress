import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import Stripe from "npm:stripe@17";
import { getCorsHeaders } from "../_shared/cors.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!);

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const DASHBOARD_URL = Deno.env.get("DASHBOARD_URL") || "https://app.leadexpress.com";

Deno.serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
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

    const { priceId, planSlug, billingInterval, refCode } = await req.json();
    if (!priceId || !planSlug) {
      return new Response(JSON.stringify({ error: "Missing priceId or planSlug" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate referral partner if refCode provided
    let refPartnerSlug: string | undefined;
    if (refCode) {
      const { data: partner } = await supabase
        .from("community_partners")
        .select("id, slug, user_id, status")
        .eq("slug", refCode)
        .eq("status", "active")
        .maybeSingle();

      // Only apply if partner exists, is active, and is not self-referral
      if (partner && partner.user_id !== user.id) {
        refPartnerSlug = partner.slug;
      }
    }

    // Get or create Stripe customer
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();

    let customerId = sub?.stripe_customer_id;

    if (!customerId || customerId === "") {
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

      // Always persist customer ID so it survives abandoned checkouts
      await supabase
        .from("subscriptions")
        .upsert(
          { user_id: user.id, stripe_customer_id: customerId },
          { onConflict: "user_id" },
        );
    }

    // Create Checkout Session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: true,
      success_url: `${DASHBOARD_URL}/subscription?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${DASHBOARD_URL}/subscription?canceled=true`,
      metadata: {
        supabase_user_id: user.id,
        plan_slug: planSlug,
        billing_interval: billingInterval || "monthly",
        ...(refPartnerSlug && { ref_partner_slug: refPartnerSlug }),
      },
      subscription_data: {
        trial_period_days: 7,
        metadata: {
          supabase_user_id: user.id,
          plan_slug: planSlug,
          billing_interval: billingInterval || "monthly",
          ...(refPartnerSlug && { ref_partner_slug: refPartnerSlug }),
        },
      },
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[checkout] Error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
