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

- is_lead: boolean (false if it's just chat, meme, greeting, or not a service request)
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
- zip_code: US zip code if mentioned (5 digits), or null
- city: city name if mentioned, or null
- budget_min: number in USD or null
- budget_max: number in USD or null
- urgency: "hot" (today/tomorrow), "warm" (this week), "cold" (future/no date mentioned)
- summary: clean 1-line English summary suitable for sending to a contractor

The message may be in English, Hebrew, Spanish, or mixed. Parse it regardless of language.
If the message is NOT a service lead, set is_lead to false and leave other fields null.

Return JSON only, no markdown.`;

const openai = new OpenAI({ apiKey: config.openai.apiKey });

export async function parseMessage(
  text: string,
  log: Logger,
): Promise<{ parsed: ParsedLead; usage: OpenAI.CompletionUsage | undefined; durationMs: number }> {
  const start = performance.now();

  const response = await openai.chat.completions.create({
    model: config.openai.model,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: text },
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
