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
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response("Unauthorized", { status: 401 });

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return new Response("Unauthorized", { status: 401 });

    // Get or create Stripe customer (pattern from create-checkout-session)
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
        .maybeSingle();

      const customer = await stripe.customers.create({
        email: user.email,
        name: profile?.full_name || undefined,
        metadata: { supabase_user_id: user.id },
      });
      customerId = customer.id;

      await supabase
        .from("subscriptions")
        .upsert(
          { user_id: user.id, stripe_customer_id: customerId },
          { onConflict: "user_id" },
        );
    }

    // Create the SetupIntent — no charge, just saves a payment method for later
    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ["card"],
      usage: "off_session",
      metadata: {
        supabase_user_id: user.id,
        source: "onboarding_wizard",
      },
    });

    return new Response(
      JSON.stringify({
        client_secret: setupIntent.client_secret,
        customer_id: customerId,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[create-setup-intent] Error:", err);
    return new Response(
      JSON.stringify({ error: "Failed to create setup intent" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
