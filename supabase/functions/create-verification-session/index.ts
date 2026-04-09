import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import Stripe from "npm:stripe@17";
import { getCorsHeaders } from "../_shared/cors.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!);

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const DASHBOARD_URL = Deno.env.get("DASHBOARD_URL") || "https://app.masterleadflow.com";

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
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if user already has a verified or pending verification
    const { data: existing } = await supabase
      .from("identity_verifications")
      .select("id, status, stripe_session_id")
      .eq("user_id", user.id)
      .in("status", ["verified", "pending", "processing"])
      .maybeSingle();

    if (existing?.status === "verified") {
      return new Response(
        JSON.stringify({ error: "already_verified", message: "Identity already verified" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // If there's an existing pending/processing session, return its URL
    if (existing?.stripe_session_id && (existing.status === "pending" || existing.status === "processing")) {
      try {
        const existingSession = await stripe.identity.verificationSessions.retrieve(existing.stripe_session_id);
        if (existingSession.status !== "canceled" && existingSession.url) {
          return new Response(
            JSON.stringify({ url: existingSession.url, sessionId: existing.stripe_session_id }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
      } catch {
        // Session expired or invalid, create new one
      }
    }

    // Get user profile for prefilling
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, phone")
      .eq("id", user.id)
      .single();

    // Create Stripe Identity Verification Session
    const session = await stripe.identity.verificationSessions.create({
      type: "document",
      metadata: {
        supabase_user_id: user.id,
      },
      options: {
        document: {
          require_matching_selfie: true,
        },
      },
      return_url: `${DASHBOARD_URL}/verify-identity?completed=true`,
    });

    // Upsert verification record
    // Delete old failed/canceled records for this user first
    await supabase
      .from("identity_verifications")
      .delete()
      .eq("user_id", user.id)
      .in("status", ["failed", "canceled", "requires_input"]);

    await supabase.from("identity_verifications").insert({
      user_id: user.id,
      stripe_session_id: session.id,
      status: "pending",
    });

    console.log(`[identity] Verification session created: user=${user.id}, session=${session.id}`);

    return new Response(
      JSON.stringify({ url: session.url, sessionId: session.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[identity] Error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
