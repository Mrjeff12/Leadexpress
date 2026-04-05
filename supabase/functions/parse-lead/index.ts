import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;
const OPENAI_MODEL = Deno.env.get("OPENAI_MODEL") ?? "gpt-4o-mini";

// ── Types ────────────────────────────────────────────────────────────────────
interface RawMessagePayload {
  messageId: string;
  groupId: string;
  body: string;
  sender: string | null;
  senderId: string | null;
  timestamp: number;
  accountId: string;
  quotedMessageId: string | null;
  quotedText: string | null;
}

interface ParsedLead {
  is_lead: boolean;
  message_type: "lead_publication" | "contractor_response" | "chat";
  profession: string;
  zip_code: string | null;
  city: string | null;
  budget_min: number | null;
  budget_max: number | null;
  urgency: "hot" | "warm" | "cold";
  summary: string;
}

// ── OpenAI System Prompt ─────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are a lead parser for home services in the US.
Extract the following from this WhatsApp group message:

- is_lead: boolean — true ONLY if a CUSTOMER is requesting a home service.
  Set is_lead to FALSE for ALL of these:
  • Job postings / recruiting ("looking for technicians", "מחפש טכנאי", "need workers")
  • Service provider ads / self-promotion ("we offer...", "שירותי לוגיסטיקה", company intros)
  • People looking for work ("looking for jobs", "מחפש למשוך עבודות", "סגירות גבוהות")
  • Lead buyers/sellers ("looking for leads", "מחפש מפרסמים", "quality leads")
  • General chat, memes, greetings, religious messages, group rules
  • Contractors offering their availability ("I have a vehicle and equipment", "אני נותן רכב")
- message_type: one of "lead_publication", "contractor_response", "chat"
  • "lead_publication": Someone posting a JOB or LEAD to the group
  • "contractor_response": Someone RESPONDING to a posted job (short replies indicating interest)
  • "chat": General conversation
- profession: one of ["hvac", "air_duct", "chimney", "dryer_vent", "garage_door", "locksmith", "roofing", "plumbing", "electrical", "painting", "cleaning", "carpet_cleaning", "renovation", "fencing", "landscaping", "tiling", "kitchen", "bathroom", "pool", "moving", "other"]
  Use the MOST SPECIFIC profession. "garage" alone → "garage_door", "צימיני" → "chimney".
  IMPORTANT: Messages often come in SHORT DISPATCH format like:
    "City, State ZIP\\nChimney\\n99$ service call\\nTomorrow 9-11"
    "32539\\nGarage\\nToday\\nK?"
  These ARE real leads.
- zip_code: US zip code if mentioned (5 digits), or null
- city: city name if mentioned (always in English, translate Hebrew city names), or null
- budget_min: number in USD or null
- budget_max: number in USD or null
- urgency: "hot" (today/tomorrow/ASAP), "warm" (this week), "cold" (future/no date mentioned)
- summary: clean 1-line English summary suitable for sending to a contractor

The message may be in English, Hebrew, Spanish, or mixed. Parse it regardless of language.
Return JSON only, no markdown.`;

// ── US ZIP → State + Coords ──────────────────────────────────────────────────
const STATE_COORDS: Record<string, { lat: number; lng: number }> = {
  AL:{lat:32.81,lng:-86.79},AK:{lat:61.37,lng:-152.40},AZ:{lat:33.73,lng:-111.43},
  AR:{lat:34.97,lng:-92.37},CA:{lat:36.12,lng:-119.68},CO:{lat:39.06,lng:-105.31},
  CT:{lat:41.60,lng:-72.76},DE:{lat:39.32,lng:-75.51},DC:{lat:38.90,lng:-77.03},
  FL:{lat:27.77,lng:-81.69},GA:{lat:33.04,lng:-83.64},HI:{lat:21.09,lng:-157.50},
  ID:{lat:44.24,lng:-114.48},IL:{lat:40.35,lng:-88.99},IN:{lat:39.85,lng:-86.26},
  IA:{lat:42.01,lng:-93.21},KS:{lat:38.53,lng:-96.73},KY:{lat:37.67,lng:-84.67},
  LA:{lat:31.17,lng:-91.87},ME:{lat:44.69,lng:-69.38},MD:{lat:39.06,lng:-76.80},
  MA:{lat:42.23,lng:-71.53},MI:{lat:43.33,lng:-84.54},MN:{lat:45.69,lng:-93.90},
  MS:{lat:32.74,lng:-89.68},MO:{lat:38.46,lng:-92.29},MT:{lat:46.92,lng:-110.45},
  NE:{lat:41.13,lng:-98.27},NV:{lat:38.31,lng:-117.06},NH:{lat:43.45,lng:-71.56},
  NJ:{lat:40.30,lng:-74.52},NM:{lat:34.84,lng:-106.25},NY:{lat:42.17,lng:-74.95},
  NC:{lat:35.63,lng:-79.81},ND:{lat:47.53,lng:-99.78},OH:{lat:40.39,lng:-82.76},
  OK:{lat:35.57,lng:-96.93},OR:{lat:44.57,lng:-122.07},PA:{lat:40.59,lng:-77.21},
  RI:{lat:41.68,lng:-71.51},SC:{lat:33.86,lng:-80.95},SD:{lat:44.30,lng:-99.44},
  TN:{lat:35.75,lng:-86.69},TX:{lat:31.05,lng:-97.56},UT:{lat:40.15,lng:-111.86},
  VT:{lat:44.05,lng:-72.71},VA:{lat:37.77,lng:-78.17},WA:{lat:47.40,lng:-121.49},
  WV:{lat:38.49,lng:-80.95},WI:{lat:44.27,lng:-89.62},WY:{lat:42.76,lng:-107.30},
};

const ZIP3_RANGES: [number, number, string][] = [
  [5,5,"NY"],[6,9,"PR"],[10,27,"MA"],[28,29,"RI"],[30,38,"NH"],[39,49,"ME"],
  [50,59,"VT"],[60,69,"CT"],[70,89,"NJ"],[100,149,"NY"],[150,196,"PA"],[197,199,"DE"],
  [200,205,"DC"],[206,219,"MD"],[220,246,"VA"],[247,268,"WV"],[270,289,"NC"],
  [290,299,"SC"],[300,319,"GA"],[320,349,"FL"],[350,369,"AL"],[370,385,"TN"],
  [386,397,"MS"],[398,399,"GA"],[400,427,"KY"],[430,458,"OH"],[460,479,"IN"],
  [480,499,"MI"],[500,528,"IA"],[530,549,"WI"],[550,567,"MN"],[570,577,"SD"],
  [580,588,"ND"],[590,599,"MT"],[600,629,"IL"],[630,658,"MO"],[660,679,"KS"],
  [680,693,"NE"],[700,714,"LA"],[716,729,"AR"],[730,749,"OK"],[750,799,"TX"],
  [800,816,"CO"],[820,831,"WY"],[832,838,"ID"],[840,847,"UT"],[850,865,"AZ"],
  [870,884,"NM"],[885,885,"TX"],[889,898,"NV"],[900,961,"CA"],[967,968,"HI"],
  [970,979,"OR"],[980,994,"WA"],[995,999,"AK"],
];

const zip3ToState = new Map<number, string>();
for (const [min, max, state] of ZIP3_RANGES) {
  for (let i = min; i <= max; i++) zip3ToState.set(i, state);
}

function getStateFromZip(zip: string | null): string | null {
  if (!zip) return null;
  const prefix = parseInt(zip.slice(0, 3), 10);
  return isNaN(prefix) ? null : (zip3ToState.get(prefix) ?? null);
}

// ── OpenAI call ──────────────────────────────────────────────────────────────
async function parseWithOpenAI(text: string, quotedText: string | null): Promise<ParsedLead> {
  let userMessage = text;
  if (quotedText) {
    userMessage = `[Replying to: "${quotedText}"]\n\n${text}`;
  }

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
      temperature: 0.1,
      max_tokens: 512,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  const raw = JSON.parse(data.choices[0].message.content);

  // Validate with safe defaults
  const VALID_PROFESSIONS = new Set([
    "hvac","air_duct","chimney","dryer_vent","garage_door","locksmith","roofing",
    "plumbing","electrical","painting","cleaning","carpet_cleaning","renovation",
    "fencing","landscaping","tiling","kitchen","bathroom","pool","moving","other","not_a_lead",
  ]);

  return {
    is_lead: typeof raw.is_lead === "boolean" ? raw.is_lead : false,
    message_type: ["lead_publication","contractor_response","chat"].includes(raw.message_type)
      ? raw.message_type : "chat",
    profession: VALID_PROFESSIONS.has(raw.profession) ? raw.profession : "other",
    zip_code: typeof raw.zip_code === "string" && /^\d{5}$/.test(raw.zip_code) ? raw.zip_code : null,
    city: typeof raw.city === "string" ? raw.city : null,
    budget_min: typeof raw.budget_min === "number" ? raw.budget_min : null,
    budget_max: typeof raw.budget_max === "number" ? raw.budget_max : null,
    urgency: ["hot","warm","cold"].includes(raw.urgency) ? raw.urgency : "cold",
    summary: typeof raw.summary === "string" && raw.summary.length > 0 ? raw.summary : "No summary available",
  };
}

// ── Format budget range string ───────────────────────────────────────────────
function formatBudgetRange(min: number | null, max: number | null): string | null {
  if (min && max) return `$${min}–$${max}`;
  if (min) return `$${min}+`;
  if (max) return `up to $${max}`;
  return null;
}

// ── Content hash for dedup ───────────────────────────────────────────────────
async function contentHash(text: string): Promise<string> {
  const normalized = text.toLowerCase().trim().replace(/\s+/g, " ");
  const encoded = new TextEncoder().encode(normalized);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ── Main handler ─────────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === "GET") {
    return new Response(JSON.stringify({ status: "ok", service: "parse-lead" }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // Claim pending raw_messages jobs
  const { data: jobs, error: claimErr } = await supabase.rpc("claim_jobs", {
    p_queue: "raw_messages",
    p_limit: 5,
  });

  if (claimErr || !jobs?.length) {
    return new Response(JSON.stringify({ processed: 0 }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const results: string[] = [];

  for (const job of jobs) {
    const payload = job.payload as RawMessagePayload;

    try {
      // Content-based dedup
      const hash = await contentHash(payload.body);
      const { data: existingLead } = await supabase
        .from("leads").select("id").eq("content_hash", hash).maybeSingle();

      if (existingLead) {
        await supabase.rpc("complete_job", { p_job_id: job.id });
        results.push(`dedup:${payload.messageId}`);
        continue;
      }

      // Parse with OpenAI
      const parsed = await parseWithOpenAI(payload.body, payload.quotedText);

      // Resolve group UUID
      const { data: group } = await supabase
        .from("groups").select("id").eq("wa_group_id", payload.groupId).single();

      // Log pipeline event
      await supabase.from("pipeline_events").insert({
        group_id: group?.id, wa_message_id: payload.messageId,
        sender_id: payload.senderId, stage: "ai_parsed",
        detail: { is_lead: parsed.is_lead, profession: parsed.profession, message_type: parsed.message_type },
      });

      // Handle contractor responses
      if (parsed.message_type === "contractor_response" && group) {
        await supabase.from("group_responses").insert({
          group_id: group.id, wa_message_id: payload.messageId,
          wa_sender_id: payload.senderId, sender_name: payload.sender,
          content: payload.body, response_type: "interest",
          quoted_message_id: payload.quotedMessageId,
        });
        await supabase.rpc("complete_job", { p_job_id: job.id });
        results.push(`response:${payload.messageId}`);
        continue;
      }

      // Not a lead
      if (!parsed.is_lead) {
        await supabase.from("pipeline_events").insert({
          group_id: group?.id, wa_message_id: payload.messageId,
          sender_id: payload.senderId, stage: "no_lead",
          detail: { reason: parsed.message_type, profession: parsed.profession },
        });
        await supabase.rpc("complete_job", { p_job_id: job.id });
        results.push(`no_lead:${payload.messageId}`);
        continue;
      }

      // It's a lead — insert
      const derivedState = getStateFromZip(parsed.zip_code);
      const coords = derivedState ? STATE_COORDS[derivedState] : null;
      const budgetRange = formatBudgetRange(parsed.budget_min, parsed.budget_max);

      // Atomic: insert lead + update stats + enqueue match + log event
      const hasPhone = /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/.test(payload.body);

      const { data: leadId, error: rpcErr } = await supabase.rpc("finalize_parsed_lead", {
        p_lead: {
          wa_message_id: payload.messageId,
          raw_message: payload.body,
          sender_id: payload.senderId ?? null,
          sender_name: payload.sender ?? null,
          profession: parsed.profession === "not_a_lead" ? "other" : parsed.profession,
          zip_code: parsed.zip_code,
          city: parsed.city,
          state: derivedState,
          latitude: coords?.lat ?? null,
          longitude: coords?.lng ?? null,
          budget_range: budgetRange,
          urgency: parsed.urgency,
          parsed_summary: parsed.summary,
        },
        p_content_hash: hash,
        p_group_id: group?.id ?? null,
        p_sender_id: payload.senderId ?? null,
        p_message_id: payload.messageId ?? null,
        p_has_phone: hasPhone,
      });

      if (rpcErr) {
        throw new Error(`finalize_parsed_lead failed: ${rpcErr.message}`);
      }

      if (!leadId) {
        // Dedup: lead with this content_hash already exists
        await supabase.rpc("complete_job", { p_job_id: job.id });
        results.push(`dedup_insert:${payload.messageId}`);
        continue;
      }

      await supabase.rpc("complete_job", { p_job_id: job.id });
      results.push(`lead:${leadId}`);

    } catch (err) {
      const msg = err instanceof Error ? err.message : "unknown";
      console.error(`[parse-lead] Job ${job.id} failed:`, msg);
      await supabase.rpc("fail_job", { p_job_id: job.id, p_error: msg });
      results.push(`error:${msg}`);
    }
  }

  return new Response(
    JSON.stringify({ processed: results.length, results }),
    { headers: { "Content-Type": "application/json" } },
  );
});
