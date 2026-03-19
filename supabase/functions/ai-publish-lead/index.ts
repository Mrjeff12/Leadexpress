import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getCorsHeaders } from "../_shared/cors.ts";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;
const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const VALID_PROFESSIONS = [
  "hvac", "air_duct", "chimney", "dryer_vent", "garage_door", "locksmith",
  "roofing", "plumbing", "electrical", "painting", "cleaning", "carpet_cleaning",
  "renovation", "fencing", "landscaping", "tiling", "kitchen", "bathroom", "pool", "moving",
];

const SYSTEM_PROMPT = `You are a lead publishing assistant for LeadExpress, a US contractor marketplace.
Extract job details from the user's message and format a professional posting.

VALID PROFESSIONS (pick the closest match): ${VALID_PROFESSIONS.join(", ")}

Extract:
- profession (MUST match one from the list above)
- state (US state abbreviation, e.g. "FL")
- city (city name)
- zip_code (5-digit ZIP if mentioned, otherwise null)
- description (rewrite professionally in English, 2-3 sentences)
- urgency ("low" | "medium" | "high" — infer from context, default "medium")
- client_phone (phone number if mentioned, otherwise null)

Respond ONLY with valid JSON:
{
  "profession": "...",
  "state": "...",
  "city": "...",
  "zip_code": "...",
  "description": "...",
  "urgency": "...",
  "client_phone": null,
  "formatted_posting": "A nicely formatted 2-3 line posting for contractors",
  "confidence": 0.0-1.0,
  "missing_fields": []
}

If profession OR location cannot be determined, set confidence below 0.5 and list missing fields in the array.
If the user writes in Hebrew, still extract data and respond in the same JSON format, but keep the description in English.`;

Deno.serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    // Allow both JWT auth and service-role calls (from WhatsApp webhook)
    const publisherOverride = req.headers.get("x-publisher-id");
    let userId: string;

    if (publisherOverride) {
      // Called from WhatsApp webhook with service role — trust the header
      userId = publisherOverride;
    } else if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
      if (error || !user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      userId = user.id;
    } else {
      return new Response(JSON.stringify({ error: "No auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { text, action, lead_data } = await req.json();

    // ── ACTION: parse ──────────────────────────────────────────
    if (action === "parse") {
      if (!text) {
        return new Response(JSON.stringify({ error: "text is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: text },
          ],
          temperature: 0.3,
          response_format: { type: "json_object" },
        }),
      });

      if (!openaiRes.ok) {
        const errText = await openaiRes.text();
        return new Response(JSON.stringify({ error: `OpenAI error: ${errText}` }), {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const openaiData = await openaiRes.json();
      const parsed = JSON.parse(openaiData.choices[0].message.content);

      return new Response(JSON.stringify({ success: true, data: parsed }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── ACTION: publish ────────────────────────────────────────
    if (action === "publish") {
      if (!lead_data) {
        return new Response(JSON.stringify({ error: "lead_data is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Verify publisher role
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("roles")
        .eq("id", userId)
        .single();

      if (!profile?.roles?.includes("publisher")) {
        return new Response(JSON.stringify({ error: "Not a publisher" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Map urgency to the leads table format
      const urgencyMap: Record<string, string> = {
        high: "hot",
        medium: "warm",
        low: "cold",
      };

      // Insert lead
      const { data: lead, error: insertError } = await supabaseAdmin
        .from("leads")
        .insert({
          profession: lead_data.profession,
          city: lead_data.city,
          state: lead_data.state,
          zip_code: lead_data.zip_code || null,
          parsed_summary: lead_data.description,
          raw_message: lead_data.formatted_posting,
          urgency: urgencyMap[lead_data.urgency] || "warm",
          source_type: "publisher",
          publisher_id: userId,
          status: "parsed",
          sender_phone: lead_data.client_phone || null,
        })
        .select("id")
        .single();

      if (insertError) {
        console.error("Insert error:", insertError);
        return new Response(JSON.stringify({ error: insertError.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Match contractors by profession + zip_code
      let matchQuery = supabaseAdmin
        .from("contractors")
        .select("profile_id")
        .contains("professions", [lead_data.profession]);

      if (lead_data.zip_code) {
        matchQuery = matchQuery.contains("zip_codes", [lead_data.zip_code]);
      }

      const { data: matchedContractors } = await matchQuery;
      const matchedIds = (matchedContractors || []).map(
        (c: { profile_id: string }) => c.profile_id,
      );

      // Update lead with matched contractors
      if (matchedIds.length > 0) {
        await supabaseAdmin
          .from("leads")
          .update({ matched_contractors: matchedIds, status: "sent" })
          .eq("id", lead.id);
      }

      // Create pipeline event
      await supabaseAdmin.from("pipeline_events").insert({
        lead_id: lead.id,
        event_type: "publisher_submitted",
        metadata: {
          publisher_id: userId,
          matched_count: matchedIds.length,
          source: publisherOverride ? "whatsapp" : "dashboard",
        },
      });

      return new Response(
        JSON.stringify({
          success: true,
          lead_id: lead.id,
          matched_count: matchedIds.length,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ error: "Invalid action. Use 'parse' or 'publish'." }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("ai-publish-lead error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
