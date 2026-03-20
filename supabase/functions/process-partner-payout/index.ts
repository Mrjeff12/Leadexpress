import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "npm:stripe@17";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
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

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    // ── Auth: caller must be an admin ──────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check admin role via profiles table
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || profile.role !== "admin") {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Parse body ─────────────────────────────────────────────
    const { commission_id } = await req.json();
    if (!commission_id) {
      return new Response(JSON.stringify({ error: "Missing commission_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Look up the commission record ──────────────────────────
    const { data: commission, error: commErr } = await supabase
      .from("partner_commissions")
      .select("id, partner_id, amount_cents, type, status")
      .eq("id", commission_id)
      .single();

    if (commErr || !commission) {
      return new Response(JSON.stringify({ error: "Commission record not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (commission.type !== "withdrawal") {
      return new Response(JSON.stringify({ error: "Commission is not a withdrawal" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (commission.status !== "pending") {
      return new Response(JSON.stringify({ error: "Withdrawal is not in pending status" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Look up partner's Stripe Connect account ───────────────
    const { data: partner, error: partnerErr } = await supabase
      .from("community_partners")
      .select("id, display_name, stripe_connect_id, stripe_onboarded")
      .eq("id", commission.partner_id)
      .single();

    if (partnerErr || !partner) {
      return new Response(JSON.stringify({ error: "Partner not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!partner.stripe_connect_id || !partner.stripe_onboarded) {
      return new Response(
        JSON.stringify({
          error: "Partner does not have a connected Stripe account",
          code: "NO_CONNECT_ACCOUNT",
        }),
        {
          status: 422,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // ── Execute the Stripe transfer ────────────────────────────
    // amount_cents is negative for withdrawals, so we use Math.abs
    const transfer = await stripe.transfers.create({
      amount: Math.abs(commission.amount_cents),
      currency: "usd",
      destination: partner.stripe_connect_id,
      metadata: {
        commission_id: commission.id,
        partner_id: commission.partner_id,
      },
    });

    // ── Update the commission record ───────────────────────────
    const { error: updateErr } = await supabase
      .from("partner_commissions")
      .update({
        status: "paid",
        stripe_payout_id: transfer.id,
        approved_at: new Date().toISOString(),
        paid_at: new Date().toISOString(),
      })
      .eq("id", commission_id)
      .eq("status", "pending"); // optimistic lock

    if (updateErr) {
      console.error("[process-partner-payout] DB update error:", updateErr);
      // Transfer already went through — log for manual reconciliation
      return new Response(
        JSON.stringify({
          error: "Transfer succeeded but DB update failed. Transfer ID: " + transfer.id,
          transfer_id: transfer.id,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    console.log(
      `[process-partner-payout] Paid ${partner.display_name} $${(Math.abs(commission.amount_cents) / 100).toFixed(2)} — transfer ${transfer.id}`,
    );

    return new Response(
      JSON.stringify({
        success: true,
        transfer_id: transfer.id,
        amount_cents: Math.abs(commission.amount_cents),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error("[process-partner-payout] Error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
