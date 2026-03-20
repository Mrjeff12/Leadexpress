import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getCorsHeaders } from "../_shared/cors.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function randomSuffix(): string {
  return Math.random().toString(36).substring(2, 6);
}

Deno.serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { display_name, slug: requestedSlug, bio, location, service_areas, specialties, group_link } = await req.json();
    if (!display_name) {
      return new Response(JSON.stringify({ error: "Missing display_name" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if already a partner
    const { data: existing } = await supabase
      .from("community_partners")
      .select("id, slug, status")
      .eq("user_id", user.id)
      .maybeSingle();

    if (existing) {
      return new Response(JSON.stringify({ error: "Already a partner", partner: existing }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate and resolve slug
    const slugRegex = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/;
    let slug: string;

    if (requestedSlug && typeof requestedSlug === "string") {
      const cleaned = requestedSlug.toLowerCase().trim();
      if (!slugRegex.test(cleaned)) {
        return new Response(JSON.stringify({ error: "Invalid slug: must be 3-30 chars, alphanumeric and hyphens only" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Check availability
      const { data: taken } = await supabase
        .from("community_partners")
        .select("id")
        .eq("slug", cleaned)
        .maybeSingle();

      if (taken) {
        return new Response(JSON.stringify({ error: "Slug is already taken" }), {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      slug = cleaned;
    } else {
      // Auto-generate from display_name
      slug = generateSlug(display_name);
      if (!slug) slug = "partner";

      const { data: collision } = await supabase
        .from("community_partners")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();

      if (collision) {
        slug = `${slug}-${randomSuffix()}`;
      }
    }

    // Insert partner record
    const { data: partner, error: insertError } = await supabase
      .from("community_partners")
      .insert({
        user_id: user.id,
        slug,
        display_name,
        bio: bio || null,
        location: location || null,
        service_areas: service_areas || [],
        specialties: specialties || [],
        commission_rate: 0.15,
        status: "pending",
        stats: group_link ? { pending_group_link: group_link } : {},
      })
      .select("id, slug, status")
      .single();

    if (insertError) {
      console.error("[partner-signup] Insert error:", insertError);
      return new Response(JSON.stringify({ error: insertError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ partner }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[partner-signup] Error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
