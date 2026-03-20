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

    // Verify the lead exists and this user is in matched_contractors
    const { data: existingLead } = await supabase
      .from("leads")
      .select("id, status, matched_contractors")
      .eq("id", leadId)
      .maybeSingle();

    if (!existingLead) {
      console.error(`[claim-redirect] Lead ${leadId} not found`);
      return new Response("Lead not found", { status: 404 });
    }

    // Verify user was actually matched to this lead
    const matchedContractors = existingLead.matched_contractors || [];
    if (matchedContractors.length > 0 && !matchedContractors.includes(userId)) {
      console.error(`[claim-redirect] User ${userId} not matched to lead ${leadId}`);
      return new Response("You are not eligible for this lead", { status: 403 });
    }

    // Claim the lead (only if still available)
    const { data: lead, error } = await supabase
      .from("leads")
      .update({
        status: "claimed",
        claimed_by: userId,
        claimed_at: new Date().toISOString(),
      })
      .eq("id", leadId)
      .eq("status", "sent")
      .select("id")
      .maybeSingle();

    if (error) {
      console.error("[claim-redirect] DB error:", error);
    }

    if (lead) {
      console.log(`[claim-redirect] Lead ${leadId} claimed by ${userId}`);
    } else {
      console.log(`[claim-redirect] Lead ${leadId} already claimed or not available`);
    }

    // Redirect to WhatsApp chat regardless
    const waUrl = `https://wa.me/${phone}${msg ? "?text=" + encodeURIComponent(msg) : ""}`;
    return Response.redirect(waUrl, 302);
  } catch (err) {
    console.error("[claim-redirect] Error:", err);
    return new Response("Something went wrong. Please try again.", { status: 400 });
  }
});
