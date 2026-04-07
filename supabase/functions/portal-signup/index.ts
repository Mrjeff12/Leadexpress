import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

/**
 * portal-signup: Light signup for publishers who approve a job via the portal.
 * Creates a profile + contractor record and links the job order.
 */

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const corsHeaders = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const { name, phone, job_order_id } = await req.json() as {
      name: string;
      phone: string;
      job_order_id: string;
    };

    if (!name?.trim() || !phone?.trim()) {
      return new Response(JSON.stringify({ error: "name and phone required" }), {
        status: 400, headers: corsHeaders,
      });
    }

    const cleanPhone = phone.trim().startsWith("+") ? phone.trim() : `+${phone.trim()}`;

    // Check if user already exists by phone
    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .eq("whatsapp_phone", cleanPhone)
      .maybeSingle();

    let userId: string;

    if (existing) {
      userId = existing.id;
    } else {
      // Create auth user
      const { data: authUser, error: authErr } = await supabase.auth.admin.createUser({
        phone: cleanPhone,
        user_metadata: { full_name: name.trim() },
      });

      if (authErr) {
        console.error("[portal-signup] Auth error:", authErr.message);
        // Try email-based if phone fails
        const fakeEmail = `${cleanPhone.replace(/\D/g, "")}@portal.masterleadflow.com`;
        const { data: fallback, error: fallbackErr } = await supabase.auth.admin.createUser({
          email: fakeEmail,
          user_metadata: { full_name: name.trim() },
        });
        if (fallbackErr) {
          return new Response(JSON.stringify({ error: "signup_failed" }), {
            status: 500, headers: corsHeaders,
          });
        }
        userId = fallback.user.id;
      } else {
        userId = authUser.user.id;
      }

      // Ensure profile exists
      await supabase.from("profiles").upsert({
        id: userId,
        full_name: name.trim(),
        whatsapp_phone: cleanPhone,
      });

      // Create contractor record (publisher is also a contractor in the system)
      await supabase.from("contractors").upsert({
        user_id: userId,
        wa_notify: true,
        professions: [],
        zip_codes: [],
      });
    }

    // Link job order to this publisher
    if (job_order_id) {
      await supabase
        .from("job_orders")
        .update({ subcontractor_id: userId })
        .eq("id", job_order_id);

      // Log event
      await supabase.from("pipeline_events").insert({
        stage: "publisher_signed_up_via_portal",
        detail: { user_id: userId, job_order_id, phone: cleanPhone },
      });
    }

    // Create a prospect record for CRM tracking
    await supabase.from("prospects").upsert(
      {
        phone: cleanPhone,
        display_name: name.trim(),
        source: "portal_signup",
        stage: "demo_trial",
        user_id: userId,
      },
      { onConflict: "phone" },
    );

    return new Response(JSON.stringify({ ok: true, userId }), {
      headers: corsHeaders,
    });
  } catch (err) {
    console.error("[portal-signup] Error:", err);
    return new Response(JSON.stringify({ error: "internal" }), {
      status: 500, headers: corsHeaders,
    });
  }
});
