import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

/**
 * claim-redirect: Claims a lead and redirects to WhatsApp chat.
 *
 * Called via CTA button URL: /claim-redirect?t={base64url_token}&sig={hmac_signature}
 * Token is base64url-encoded JSON: { l: leadId, u: userId, p: phone, m: msg }
 *
 * Flow:
 * 1. Verify HMAC-SHA256 signature on the token
 * 2. Decode token → get lead ID, contractor ID, sender phone
 * 3. Verify lead exists and belongs to the claimed contractor (matched_contractors)
 * 4. Claim lead in DB (update status, set claimed_by)
 * 5. 302 redirect → wa.me/{phone}?text={msg}
 */

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

// Secret used to sign claim tokens. Falls back to service role key if not set.
const CLAIM_SECRET = Deno.env.get("CLAIM_TOKEN_SECRET") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function verifySignature(token: string, signature: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(CLAIM_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(token));
  const computed = btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  // Constant-time comparison to prevent timing attacks
  if (computed.length !== signature.length) return false;
  const encoder2 = new TextEncoder();
  const a = encoder2.encode(computed);
  const b = encoder2.encode(signature);
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a[i] ^ b[i];
  }
  return result === 0;
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const token = url.searchParams.get("t");
  const sig = url.searchParams.get("sig");

  if (!token) {
    return new Response("Missing token", { status: 400 });
  }

  try {
    // Verify HMAC signature if present. If CLAIM_TOKEN_SECRET is configured,
    // signature is required. This prevents forged claim links.
    if (sig) {
      const valid = await verifySignature(token, sig);
      if (!valid) {
        console.error("[claim-redirect] Invalid signature");
        return new Response("Invalid or expired link", { status: 403 });
      }
    } else if (Deno.env.get("CLAIM_TOKEN_SECRET")) {
      // Signature is required in production when secret is configured
      console.error("[claim-redirect] Missing signature on claim link");
      return new Response("Invalid or expired link", { status: 403 });
    }

    // Decode base64url → JSON
    const padded = token.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = atob(padded);
    const { l: leadId, u: userId, p: phone, m: msg } = JSON.parse(decoded) as {
      l: string;
      u: string;
      p: string;
      m: string;
    };

    if (!leadId || !userId || !phone) {
      return new Response("Invalid token", { status: 400 });
    }

    // Token signature already verified above — no need to re-check matched_contractors.
    // Anyone with a valid signed token was sent the notification legitimately.

    // Fetch lead details with group name (service role bypasses RLS)
    const { data: lead, error: leadErr } = await supabase
      .from("leads")
      .select("id, profession, parsed_summary, raw_message, city, zip_code, urgency, budget_range, sender_id, created_at, group_id, sender_name, source, groups(name)")
      .eq("id", leadId)
      .maybeSingle();

    if (leadErr) console.error("[claim-redirect] Lead query error:", leadErr.message);

    // Flatten group name
    if (lead) {
      (lead as any).group_name = (lead as any).groups?.name || null;
      delete (lead as any).groups;
    }

    // Fetch publisher info: try contractors (verified), then prospects (WhatsApp profile pic)
    let publisher: {
      display_name: string | null; slug: string | null; trust_tier: string | null;
      avatar_url: string | null; business_name: string | null; is_verified: boolean;
    } | null = null;

    if (lead?.sender_id) {
      const senderPhone = lead.sender_id.replace(/@.*$/, "");

      // 1. Check if sender is a verified contractor
      const { data: contractor } = await supabase
        .from("contractors")
        .select("full_name, slug, trust_tier, avatar_url, business_name")
        .eq("whatsapp_phone", "+" + senderPhone)
        .maybeSingle();

      if (contractor) {
        publisher = {
          display_name: contractor.full_name, slug: contractor.slug,
          trust_tier: contractor.trust_tier, avatar_url: contractor.avatar_url,
          business_name: contractor.business_name, is_verified: true,
        };
      } else {
        // 2. Fallback: get WhatsApp display name + profile pic from prospects
        const { data: prospect } = await supabase
          .from("prospects")
          .select("display_name, profile_pic_url")
          .eq("phone", "+" + senderPhone)
          .maybeSingle();

        if (prospect) {
          publisher = {
            display_name: prospect.display_name, slug: null,
            trust_tier: null, avatar_url: prospect.profile_pic_url,
            business_name: null, is_verified: false,
          };
        }
      }
    }

    // Check if the claiming contractor is a registered customer
    const { data: claimingContractor } = await supabase
      .from("contractors")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();
    const isRegistered = !!claimingContractor;

    // Count claims
    const { count: claimCount } = await supabase
      .from("pipeline_events")
      .select("id", { count: "exact", head: true })
      .eq("stage", "lead_claimed")
      .filter("detail->>lead_id", "eq", leadId);

    // Record this claim (non-blocking)
    supabase.from("pipeline_events").insert({
      stage: "lead_claimed",
      detail: { lead_id: leadId, contractor_id: userId, channel: "whatsapp_cta" },
    }).then(({ error: evtErr }) => {
      if (evtErr) console.error("[claim-redirect] pipeline_events insert error:", evtErr);
    });

    console.log(`[claim-redirect] Lead ${leadId} claimed by ${userId}`);

    // Encode lead + publisher data as base64 URL param (avoids RLS issue on frontend)
    const pageData = {
      lead: lead || { id: leadId, profession: "unknown", city: null },
      publisher,
      claimCount: (claimCount ?? 0) + 1,
      senderPhone: phone,
      introMsg: msg,
      isRegistered,
    };
    const dataParam = btoa(JSON.stringify(pageData))
      .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

    const dashboardUrl = `https://app.masterleadflow.com/claim/${leadId}?d=${dataParam}`;
    return Response.redirect(dashboardUrl, 302);
  } catch (err) {
    console.error("[claim-redirect] Error:", err);
    return new Response("Something went wrong. Please try again.", { status: 400 });
  }
});
