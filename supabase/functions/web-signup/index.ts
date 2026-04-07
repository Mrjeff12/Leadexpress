import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { checkRateLimit, rateLimitResponse } from "../_shared/rate-limit.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const SITE_URL = Deno.env.get("SITE_URL") || "https://app.masterleadflow.com";

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: CORS });
}

function normalizePhone(raw: string): string {
  const cleaned = raw.replace(/[\s\-()]/g, "");
  return cleaned.startsWith("+") ? cleaned : `+${cleaned}`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!checkRateLimit(ip, 5, 60_000)) return rateLimitResponse(CORS);

  try {
    const { name, email, password, phone, country_code, professions, counties, state, working_days } = await req.json() as {
      name: string;
      email?: string;
      password?: string;
      phone: string;
      country_code?: string;
      professions: string[];
      counties: string[];
      state?: string;
      working_days?: number[];
    };

    // Validate required fields
    if (!name?.trim()) return json({ error: "name_required" }, 400);
    if (!phone?.trim()) return json({ error: "phone_required" }, 400);
    if (!professions?.length) return json({ error: "professions_required" }, 400);
    if (!counties?.length) return json({ error: "counties_required" }, 400);

    const prefix = country_code || "+1";
    const digits = phone.replace(/\D/g, "");
    const fullPhone = normalizePhone(`${prefix}${digits}`);

    // Check if user already exists
    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .or(`whatsapp_phone.eq.${fullPhone},phone.eq.${fullPhone}`)
      .maybeSingle();

    if (existing) {
      // User exists — generate magic link and send them to dashboard
      const loginUrl = await generateMagicLink(existing.id);
      return json({ ok: true, login_url: loginUrl, existing: true });
    }

    // 1. Create auth user with email+password if provided
    const userEmail = email?.trim() || `${digits}@signup.masterleadflow.com`;
    const { data: authUser, error: authErr } = await supabase.auth.admin.createUser({
      email: userEmail,
      email_confirm: true,
      phone: fullPhone,
      phone_confirm: true,
      ...(password ? { password } : {}),
      user_metadata: { full_name: name.trim(), source: "web_signup" },
    });

    if (authErr) {
      console.error("[web-signup] Auth error:", authErr.message);
      // Fallback: try without phone (phone might already exist)
      const { data: fallback, error: fallbackErr } = await supabase.auth.admin.createUser({
        email: userEmail,
        email_confirm: true,
        ...(password ? { password } : {}),
        user_metadata: { full_name: name.trim(), source: "web_signup" },
      });
      if (fallbackErr) {
        console.error("[web-signup] Fallback auth error:", fallbackErr.message);
        return json({ error: "signup_failed" }, 500);
      }
      var userId = fallback.user.id;
    } else {
      var userId = authUser.user.id;
    }

    // 2. Update profile
    const { error: profileErr } = await supabase.from("profiles").upsert({
      id: userId,
      full_name: name.trim(),
      whatsapp_phone: fullPhone,
      phone: fullPhone,
      counties: counties,
    });
    if (profileErr) console.error("[web-signup] Profile error:", profileErr.message);

    // 3. Create contractor record
    const { error: contractorErr } = await supabase.from("contractors").insert({
      user_id: userId,
      professions: professions,
      zip_codes: [],
      wa_notify: true,
      is_active: true,
      working_days: working_days ?? [0, 1, 2, 3, 4, 5],
    });

    if (contractorErr) {
      console.error("[web-signup] Contractor error:", contractorErr.message);
    }

    // 4. Create trial subscription
    const { data: plan } = await supabase
      .from("plans")
      .select("id")
      .eq("slug", "premium")
      .limit(1)
      .maybeSingle();

    if (plan) {
      await supabase.from("subscriptions").insert({
        user_id: userId,
        plan_id: plan.id,
        status: "trialing",
        current_period_end: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      });
    }

    // 5. Create/update prospect
    const { error: prospectErr } = await supabase.from("prospects").upsert(
      {
        phone: fullPhone,
        wa_id: `${fullPhone.replace("+", "")}@c.us`,
        display_name: name.trim(),
        source: "web_signup",
        stage: "demo_trial",
        contractor_id: userId,
        profession_tags: professions,
      },
      { onConflict: "wa_id" },
    );
    if (prospectErr) console.error("[web-signup] Prospect error:", prospectErr.message);

    // 6. Generate magic login link
    const loginUrl = await generateMagicLink(userId);

    console.log(`[web-signup] Created user ${userId} for ${fullPhone}`);

    return json({ ok: true, login_url: loginUrl });
  } catch (err) {
    console.error("[web-signup] Error:", err);
    return json({ error: "internal" }, 500);
  }
});

async function generateMagicLink(userId: string): Promise<string> {
  const { data: tokenRow, error } = await supabase
    .from("magic_login_tokens")
    .insert({
      user_id: userId,
      redirect_path: "/",
      expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    })
    .select("token")
    .single();

  if (error || !tokenRow) {
    console.error("[web-signup] Magic token error:", error?.message);
    return `${SITE_URL}/login`;
  }

  return `${SITE_URL}/auto-login?token=${tokenRow.token}`;
}
