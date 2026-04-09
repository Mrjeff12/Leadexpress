import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

/**
 * portal-signup: Light signup for publishers who approve a job via the portal.
 *
 * Actions:
 *   check  — Check if a phone number belongs to an existing user. Returns { exists, name }.
 *   signup — (default) Create/find user, generate magic link, send WhatsApp login link.
 */

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const SITE_URL = Deno.env.get("SITE_URL") || "https://app.masterleadflow.com";

const corsHeaders = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
};

// ── Twilio WhatsApp helpers ─────────────────────────────────────────────────
let TWILIO_SID = "";
let TWILIO_TOKEN = "";
let TWILIO_FROM = "";
let _secretsLoaded = false;

async function loadTwilioSecrets() {
  if (_secretsLoaded) return;
  const { data, error } = await supabase.rpc("get_twilio_secrets");
  if (error || !data) {
    console.error("[portal-signup] Failed to load Twilio secrets:", error);
    return;
  }
  TWILIO_SID = data.TWILIO_ACCOUNT_SID || "";
  TWILIO_TOKEN = data.TWILIO_AUTH_TOKEN || "";
  TWILIO_FROM = data.TWILIO_WA_FROM || "";
  _secretsLoaded = true;
}

async function sendWhatsApp(to: string, body: string): Promise<boolean> {
  const toWa = to.startsWith("whatsapp:")
    ? to
    : `whatsapp:${to.startsWith("+") ? to : "+" + to}`;
  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: "Basic " + btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`),
        },
        body: new URLSearchParams({ From: TWILIO_FROM, To: toWa, Body: body })
          .toString(),
      },
    );
    return res.ok || res.status === 201;
  } catch (err) {
    console.error("[portal-signup] WhatsApp send error:", err);
    return false;
  }
}

// ── Main handler ────────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const body = await req.json();
    const action = body.action || "signup";

    // ── ACTION: check — does this phone exist? ──
    if (action === "check") {
      const phone = body.phone?.trim();
      if (!phone) {
        return new Response(
          JSON.stringify({ error: "phone required" }),
          { status: 400, headers: corsHeaders },
        );
      }
      const cleanPhone = phone.startsWith("+") ? phone : `+${phone}`;
      const { data: existing } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("whatsapp_phone", cleanPhone)
        .maybeSingle();

      return new Response(
        JSON.stringify({
          exists: !!existing,
          name: existing?.full_name || null,
          user_id: existing?.id || null,
        }),
        { headers: corsHeaders },
      );
    }

    // ── ACTION: signup — create/find user + magic link + WhatsApp ──
    const { name, phone, job_order_id, lead_address, lead_phone, commission_pct } = body as {
      name?: string;
      phone: string;
      job_order_id?: string;
      lead_address?: string;
      lead_phone?: string;
      commission_pct?: string;
    };

    if (!phone?.trim()) {
      return new Response(
        JSON.stringify({ error: "phone required" }),
        { status: 400, headers: corsHeaders },
      );
    }

    const cleanPhone = phone.trim().startsWith("+")
      ? phone.trim()
      : `+${phone.trim()}`;

    // Check if user already exists by phone
    const { data: existing } = await supabase
      .from("profiles")
      .select("id, full_name")
      .eq("whatsapp_phone", cleanPhone)
      .maybeSingle();

    let userId: string;
    let isNew = false;
    let userName = existing?.full_name || name?.trim() || "";

    if (existing) {
      userId = existing.id;
    } else {
      // Name is required for new users
      if (!name?.trim()) {
        return new Response(
          JSON.stringify({ error: "name required for new users" }),
          { status: 400, headers: corsHeaders },
        );
      }
      isNew = true;

      // Create auth user
      const { data: authUser, error: authErr } = await supabase.auth.admin
        .createUser({
          phone: cleanPhone,
          user_metadata: { full_name: name.trim() },
        });

      if (authErr) {
        console.error("[portal-signup] Auth error:", authErr.message);
        // Try email-based if phone fails
        const fakeEmail =
          `${cleanPhone.replace(/\D/g, "")}@portal.masterleadflow.com`;
        const { data: fallback, error: fallbackErr } = await supabase.auth
          .admin.createUser({
            email: fakeEmail,
            user_metadata: { full_name: name.trim() },
          });
        if (fallbackErr) {
          return new Response(
            JSON.stringify({ error: "signup_failed" }),
            { status: 500, headers: corsHeaders },
          );
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

      // Create contractor record
      await supabase.from("contractors").upsert({
        user_id: userId,
        wa_notify: true,
        professions: [],
        zip_codes: [],
      });

      userName = name.trim();
    }

    // Link job order — mode-aware
    const signupMode = body.mode || "publisher_signup";

    if (job_order_id) {
      if (signupMode === "contractor_signup") {
        // ── Reverse portal: contractor signs up via publisher's invite ──
        await supabase
          .from("job_orders")
          .update({ contractor_id: userId })
          .eq("id", job_order_id);

        await supabase.from("pipeline_events").insert({
          stage: isNew ? "contractor_signed_up_via_portal" : "contractor_linked_via_portal",
          detail: { user_id: userId, job_order_id, phone: cleanPhone, is_new: isNew },
        });

        // Notify the publisher that a contractor accepted
        try {
          const { data: jobOrder } = await supabase
            .from("job_orders")
            .select("publisher_user_id")
            .eq("id", job_order_id)
            .single();
          if (jobOrder?.publisher_user_id) {
            const { data: pubProfile } = await supabase
              .from("profiles")
              .select("whatsapp_phone, full_name")
              .eq("id", jobOrder.publisher_user_id)
              .single();
            if (pubProfile?.whatsapp_phone) {
              await loadTwilioSecrets();
              const msg = isNew
                ? `🎉 ${userName} just accepted your job and signed up!\n\nYou can now track and manage the job together in the dashboard.`
                : `👍 ${userName} accepted your job!\n\nEverything is set up in the dashboard.`;
              await sendWhatsApp(pubProfile.whatsapp_phone, msg);
            }
          }
        } catch (e) {
          console.error("[portal-signup] Publisher notification error:", e);
        }
      } else {
        // ── Standard portal: publisher signs up via contractor's invite ──
        const updatePayload: Record<string, unknown> = {
          publisher_user_id: userId,
        };
        if (lead_address) updatePayload.customer_address = lead_address;
        if (lead_phone) updatePayload.customer_phone = lead_phone;
        if (commission_pct) updatePayload.commission_pct = Number(commission_pct) || null;

        await supabase
          .from("job_orders")
          .update(updatePayload)
          .eq("id", job_order_id);

        await supabase.from("pipeline_events").insert({
          stage: isNew ? "publisher_signed_up_via_portal" : "publisher_linked_via_portal",
          detail: { user_id: userId, job_order_id, phone: cleanPhone, is_new: isNew },
        });

        // Notify the sub-contractor that publisher signed up
        try {
          const { data: jobOrder } = await supabase
            .from("job_orders")
            .select("contractor_id")
            .eq("id", job_order_id)
            .single();
          if (jobOrder?.contractor_id) {
            const { data: conProfile } = await supabase
              .from("profiles")
              .select("whatsapp_phone, full_name")
              .eq("id", jobOrder.contractor_id)
              .single();
            if (conProfile?.whatsapp_phone) {
              await loadTwilioSecrets();
              const msg = isNew
                ? `🎉 ${userName} just signed up through your job link!\n\nThe publisher is now on MasterLeadFlow. You'll both be able to track and manage the job.`
                : `👍 ${userName} confirmed the job through your link!\n\nEverything is set up in the dashboard.`;
              await sendWhatsApp(conProfile.whatsapp_phone, msg);
            }
          }
        } catch (e) {
          console.error("[portal-signup] Contractor notification error:", e);
        }
      }
    }

    // Create a prospect record for CRM tracking
    await supabase.from("prospects").upsert(
      {
        phone: cleanPhone,
        display_name: userName,
        source: "portal_signup",
        stage: "demo_trial",
        user_id: userId,
      },
      { onConflict: "phone" },
    );

    // ── Generate magic link ──
    const redirectPath = job_order_id ? `/jobs/${job_order_id}` : "/";
    const { data: tokenRow, error: tokenErr } = await supabase
      .from("magic_login_tokens")
      .insert({
        user_id: userId,
        redirect_path: redirectPath,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
      })
      .select("token")
      .single();

    if (tokenErr) {
      console.error("[portal-signup] Token error:", tokenErr);
      // Still return success even if token fails — user was created
      return new Response(
        JSON.stringify({ ok: true, userId, isNew, magicLinkSent: false }),
        { headers: corsHeaders },
      );
    }

    const magicLink = `${SITE_URL}/auto-login?token=${tokenRow.token}`;

    // ── Send WhatsApp with magic link ──
    await loadTwilioSecrets();
    const waMessage = isNew
      ? `🎉 Welcome to MasterLeadFlow, ${userName}!\n\nYour job is ready in your dashboard. Tap the link below to log in:\n\n👉 ${magicLink}\n\nThis link expires in 24 hours.`
      : `👋 Hey ${userName}!\n\nA new job was linked to your account. Tap below to view it:\n\n👉 ${magicLink}\n\nThis link expires in 24 hours.`;

    const waSent = await sendWhatsApp(cleanPhone, waMessage);
    console.log(
      `[portal-signup] WhatsApp ${waSent ? "sent" : "FAILED"} to ${cleanPhone}`,
    );

    return new Response(
      JSON.stringify({
        ok: true,
        userId,
        isNew,
        userName,
        magicLinkSent: waSent,
      }),
      { headers: corsHeaders },
    );
  } catch (err) {
    console.error("[portal-signup] Error:", err);
    return new Response(JSON.stringify({ error: "internal" }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
