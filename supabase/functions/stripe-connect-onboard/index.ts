import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "npm:stripe@17";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getCorsHeaders } from "../_shared/cors.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!);

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const DASHBOARD_URL = "https://app.leadexpress.com";

Deno.serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    // --- Auth ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response("Unauthorized", { status: 401 });
    }

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response("Unauthorized", { status: 401 });
    }

    // --- Look up active partner ---
    const { data: partner, error: partnerError } = await supabase
      .from("community_partners")
      .select("id, stripe_connect_id, stripe_onboarded, status")
      .eq("user_id", user.id)
      .maybeSingle();

    if (partnerError) {
      console.error("[stripe-connect-onboard] Partner lookup error:", partnerError);
      return new Response(JSON.stringify({ error: "Failed to look up partner" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!partner || partner.status !== "active") {
      return new Response(JSON.stringify({ error: "No active partner record found" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Already has Stripe Connect account ---
    if (partner.stripe_connect_id) {
      // Already fully onboarded — return login link to Express Dashboard
      if (partner.stripe_onboarded) {
        const loginLink = await stripe.accounts.createLoginLink(
          partner.stripe_connect_id,
        );
        return new Response(JSON.stringify({ url: loginLink.url }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Not yet onboarded — create a new Account Link to resume onboarding
      const accountLink = await stripe.accountLinks.create({
        account: partner.stripe_connect_id,
        refresh_url: `${DASHBOARD_URL}/partner/settings?stripe=refresh`,
        return_url: `${DASHBOARD_URL}/partner/settings?stripe=complete`,
        type: "account_onboarding",
      });

      return new Response(JSON.stringify({ url: accountLink.url }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- No Stripe account yet — create Express Account ---
    const account = await stripe.accounts.create({
      type: "express",
      country: "US",
      email: user.email,
      capabilities: {
        transfers: { requested: true },
      },
      metadata: {
        partner_id: partner.id,
        user_id: user.id,
      },
    });

    // Save stripe_connect_id to partner record
    const { error: updateError } = await supabase
      .from("community_partners")
      .update({ stripe_connect_id: account.id })
      .eq("id", partner.id);

    if (updateError) {
      console.error("[stripe-connect-onboard] Update error:", updateError);
      return new Response(JSON.stringify({ error: "Failed to save Stripe account" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create Account Link for onboarding flow
    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: `${DASHBOARD_URL}/partner/settings?stripe=refresh`,
      return_url: `${DASHBOARD_URL}/partner/settings?stripe=complete`,
      type: "account_onboarding",
    });

    return new Response(JSON.stringify({ url: accountLink.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[stripe-connect-onboard] Error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
