import OpenAI from 'openai';
import { z } from 'zod';
import { config } from './config.js';
import type { Logger } from 'pino';

// ---------------------------------------------------------------------------
// Zod schema — validates + coerces the OpenAI JSON response
// ---------------------------------------------------------------------------
const PROFESSIONS = [
  'hvac', 'air_duct', 'chimney', 'dryer_vent',
  'garage_door', 'locksmith', 'roofing',
  'plumbing', 'electrical', 'painting',
  'cleaning', 'carpet_cleaning',
  'renovation', 'fencing', 'landscaping',
  'tiling', 'kitchen', 'bathroom', 'pool',
  'moving',
  'other', 'not_a_lead',
] as const;

const ParsedLeadSchema = z.object({
  is_lead: z.boolean(),
  message_type: z.enum(['lead_publication', 'contractor_response', 'chat']).catch('chat'),
  profession: z.enum(PROFESSIONS).catch('other'),
  zip_code: z.string().regex(/^\d{5}$/).nullable().catch(null),
  city: z.string().nullable().catch(null),
  budget_min: z.number().nullable().catch(null),
  budget_max: z.number().nullable().catch(null),
  urgency: z.enum(['hot', 'warm', 'cold']).catch('cold'),
  summary: z.string().min(1).catch('No summary available'),
});

export type ParsedLead = z.infer<typeof ParsedLeadSchema>;

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
  • "lead_publication": Someone posting a JOB or LEAD to the group — includes location, profession, time window. Examples:
    - "California 95301, Chimney, Wed 2-4pm, Who can take?"
    - "Fort Walton Beach FL 32548, 3 AC units, full duct cleaning, Tomorrow 3-5"
    - "32539\nGarage\nToday\nK?"
    These ARE leads (is_lead = true).
  • "contractor_response": Someone RESPONDING to a posted job — short replies indicating interest. Examples:
    - "K?", "I'll take it", "Interested", "DM me", "Mine", "How much?"
    - "אני לוקח", "שלי", "מעוניין"
    - Any reply quoting a job posting
    These are NOT leads (is_lead = false) but are valuable contractor signals.
  • "chat": General conversation, greetings, questions, memes, group rules, recruiting, service ads, job seeking.
    These are NOT leads (is_lead = false).
- profession: one of [${PROFESSIONS.filter(p => p !== 'not_a_lead').map(p => `"${p}"`).join(', ')}]
  Use the MOST SPECIFIC profession. Examples:
  - "chimney sweep" / "צ׳ימני" / "ארובה" → "chimney"
  - "air duct cleaning" / "אייר דאקט" / "ניקוי תעלות" → "air_duct"
  - "dryer vent" / "דרייר ונט" → "dryer_vent"
  - "garage door" / "דלת מוסך" / "גראג׳" → "garage_door"
  - "locksmith" / "מנעולן" / "car key" → "locksmith"
  - "roofing" / "גגות" / "shingles" → "roofing"
  - "AC" / "HVAC" / "מזגן" / "thermostat" / "heat pump" → "hvac"
  - "carpet cleaning" / "שטיחים" → "carpet_cleaning"
  - "painting" / "צביעה" → "painting"
  - "plumbing" / "שרברב" / "אינסטלטור" → "plumbing"
  - "electrician" / "חשמלאי" → "electrical"
  - "landscaping" / "גינון" / "lawn" → "landscaping"
  - "tiling" / "ריצוף" → "tiling"
  - "pool" / "בריכה" → "pool"
  - "moving" / "הובלה" → "moving"
  - "kitchen remodel" / "bathroom remodel" → "kitchen" or "bathroom"
  Only use "other" if NO specific profession matches.
  IMPORTANT: Messages often come in SHORT DISPATCH format like:
    "City, State ZIP\\n*Chimney*\\n99$ service call\\nTomorrow 9-11"
    "32539\\nGarage\\nToday\\nK?"
    "41031 צימיני להיום מי יכול לקחת ?"
  These ARE real leads — extract the profession from keywords even if the message is very short.
  "garage" / "גראג׳" alone → "garage_door"
  "צימיני" / "chiminy" / "chimney" → "chimney"
  "gate repair" / "access control" / "אקסס קונטרול" / "magnet lock" → "locksmith"
- zip_code: US zip code if mentioned (5 digits), or null
- city: city name if mentioned (always in English, translate Hebrew city names), or null
- budget_min: number in USD or null
- budget_max: number in USD or null
- urgency: "hot" (today/tomorrow/ASAP), "warm" (this week), "cold" (future/no date mentioned)
- summary: clean 1-line English summary suitable for sending to a contractor

The message may be in English, Hebrew, Spanish, or mixed. Parse it regardless of language.
Translate Hebrew city names to English (e.g., "סיאטל" → "Seattle", "לואיוויל" → "Louisville").
If the message is NOT a service lead, set is_lead to false and leave other fields null.

Return JSON only, no markdown.`;

const openai = new OpenAI({ apiKey: config.openai.apiKey });

export async function parseMessage(
  text: string,
  log: Logger,
  quotedText?: string | null,
): Promise<{ parsed: ParsedLead; usage: OpenAI.CompletionUsage | undefined; durationMs: number }> {
  const start = performance.now();

  const userMessage = quotedText
    ? `[Replying to: "${quotedText.slice(0, 200)}"]\n\n${text}`
    : text;

  const response = await openai.chat.completions.create({
    model: config.openai.model,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userMessage },
    ],
    temperature: 0.1,
    max_tokens: 512,
  });

  const durationMs = Math.round(performance.now() - start);
  const usage = response.usage ?? undefined;
  const raw = response.choices[0]?.message?.content;

  if (!raw) {
    throw new Error('OpenAI returned empty content');
  }

  let parsed: ParsedLead;
  try {
    const rawObj = JSON.parse(raw);
    parsed = ParsedLeadSchema.parse(rawObj);
  } catch (validationError) {
    log.error({ raw, validationError }, 'OpenAI response failed schema validation');
    throw new Error(`OpenAI response validation failed: ${validationError}`);
  }

  // Normalise profession when not a lead
  if (!parsed.is_lead) {
    parsed.profession = 'not_a_lead';
  }

  log.info(
    {
      durationMs,
      promptTokens: usage?.prompt_tokens,
      completionTokens: usage?.completion_tokens,
      totalTokens: usage?.total_tokens,
      isLead: parsed.is_lead,
    },
    'OpenAI parse complete',
  );

  return { parsed, usage, durationMs };
}
