import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

/**
 * claim-redirect: Claims a lead and redirects to WhatsApp chat.
 *
 * Called via CTA button URL: /claim-redirect?t={base64url_token}
 * Token is base64url-encoded JSON: { l: leadId, u: userId, p: phone, m: msg }
 *
 * Flow:
 * 1. Decode token → get lead ID, contractor ID, sender phone
 * 2. Claim lead in DB (update status, set claimed_by)
 * 3. 302 redirect → wa.me/{phone}?text={msg}
 */

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const token = url.searchParams.get("t");

  if (!token) {
    return new Response("Missing token", { status: 400 });
  }

  try {
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
