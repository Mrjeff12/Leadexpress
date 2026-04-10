# Post Job Flow — Redesign Spec

## Problem

The current post-job flow via Rebeca (WhatsApp bot) uses GPT with `function_call: 'auto'`,
which is unreliable. GPT sometimes responds with text ("מפרסם עכשיו!") without actually
calling the publish function. It also "digs" — asking the same question repeatedly when
the user doesn't have a description, creating a frustrating experience.

## Solution

Free-form text input + forced GPT extraction into a strict schema + deterministic validation.
The bot never advances to publish until all required fields are present.

## Schema

```typescript
interface PostJobSchema {
  profession: string;    // REQUIRED — mapped to enum
  zip_code: string;      // REQUIRED — 5-digit US zip
  city: string;          // auto-resolved from zip, or extracted
  state: string;         // auto-resolved from zip, or extracted
  urgency: 'today' | 'tomorrow' | 'this_week' | 'flexible';  // REQUIRED
  description: string;   // OPTIONAL — auto-generated if missing
  budget: string;        // OPTIONAL
  schedule: string;      // OPTIONAL — "9-11 AM", "Thursday 6-8pm"
}
```

Required to publish: `profession` + `zip_code` + `urgency`

## GPT Role

GPT is used ONLY as a field extractor:
- Receives conversation history
- MUST call `extract_fields` (forced function_call — never returns text)
- Extracts any fields it can identify from the latest message
- Maps Hebrew/slang to enum values
- Our code merges extracted fields into accumulated state

GPT does NOT:
- Decide when to publish (our code does)
- Generate conversational responses (our code sends templated messages)
- Have any way to respond with free text

## Flow

### Entry
User selects "Post Job" from menu or sends "פרסם" / "POST".

Bot sends:
```
📝 פרסום עבודה

ספר לי על העבודה — מקצוע, zip code, ומתי.
אפשר הכל בהודעה אחת או שלב אחרי שלב.

דוגמה: "garage door 33132 tomorrow"
שלח *בטל* לביטול.
```

### Each Message
1. User sends free text (Hebrew or English, voice transcription, etc.)
2. GPT `extract_fields` (forced) → extracts fields from message
3. Code merges new fields into accumulated state
4. Code checks what's missing:
   - If missing required fields → send specific ask (templated, not GPT)
   - If all required present → confirm + publish

### Missing Field Prompts (templated, bilingual)

**Missing profession:**
```
🔧 מה סוג העבודה?

1. 🚪 Garage Door    6. ❄️ HVAC
2. 💨 Air Duct       7. 🔨 Renovation
3. 🔑 Locksmith      8. 🚰 Plumbing
4. 🧹 Chimney        9. ⚡ Electrical
5. 💨 Dryer Vent    10. 🎨 Painting

שלח מספר או כתוב מקצוע
```

**Missing zip_code:**
```
📍 מה ה-zip code?

שלח zip code (למשל: 33132)
או עיר + state (למשל: Miami FL)
```

**Missing urgency:**
```
⏰ מתי העבודה?

1. 🔴 היום
2. 🟡 מחר
3. 🟠 השבוע
4. 🟢 גמיש
```

### Confirmation
When all required fields are present:
```
✅ מוכן לפרסום:

🚪 Garage Door
📍 Miami, FL 33132
🔴 היום
📝 Off track (or auto: "Garage door service needed")

שלח *כן* לפרסום או *בטל* לביטול
```

User sends "כן" / "yes" / "1" → `publishJob()` → clear state.

### One-Shot Example
User: "garage door 44039 tomorrow off track"
→ GPT extracts: `{profession: "garage_door", zip_code: "44039", urgency: "tomorrow", description: "off track"}`
→ All required present → show confirmation → publish

## GPT System Prompt

```
You are a field extractor for job postings. Extract structured data from the user's messages.

You MUST call extract_fields. NEVER respond with text.

FIELDS TO EXTRACT:
- profession: Map to one of: garage_door, air_duct, locksmith, chimney, dryer_vent, hvac, 
  renovation, plumbing, electrical, painting, roofing, fencing, cleaning, carpet_cleaning,
  landscaping, pool, tiling, windows, bathroom, kitchen, moving, other
  Hebrew: "מזגן/AC"→hvac, "גדר"→fencing, "ניקיון"→cleaning, "צביעה"→painting, 
  "שיפוץ"→renovation, "אינסטלציה"→plumbing, "חשמל"→electrical, "גג"→roofing, 
  "דלת גראז'"→garage_door, "דאקט"→air_duct, "ארובה"→chimney, "מנעולן"→locksmith
  Numbers 1-10 map to: garage_door, air_duct, locksmith, chimney, dryer_vent, hvac, 
  renovation, plumbing, electrical, painting
- zip_code: 5-digit US zip code
- city: City name (translate Hebrew to English)
- state: US state abbreviation
- urgency: "today/היום/urgent/1"→today, "tomorrow/מחר/2"→tomorrow, 
  "this week/השבוע/3"→this_week, "flexible/גמיש/4"→flexible
- description: Brief job description. Generate from context if user says "תמציא"/"make one up".
  Strip personal info (phones, addresses, names).
- budget: Budget if mentioned (e.g. "$90", "50%", "20% commission")
- schedule: Time window if mentioned (e.g. "9-11 AM", "Thursday 6-8pm")
- cancel: true if user wants to cancel

ONLY extract fields you find in the messages. Do not guess or hallucinate.
```

## State Shape

```typescript
{
  userId: string;
  messages: Array<{role: string; content: string}>;
  fields: {
    profession?: string;
    zip_code?: string;
    city?: string;
    state?: string;
    urgency?: string;
    description?: string;
    budget?: string;
    schedule?: string;
  };
  step: 'collecting' | 'confirming';
}
```

## Edge Cases

- **User sends number only:** "3" → map to profession #3 (locksmith) if profession missing, 
  or urgency "this_week" if urgency missing. GPT prompt handles this via context.
- **User sends zip + city together:** "Miami 33132" → extract both
- **Hebrew + English mix:** GPT handles bilingual extraction
- **Voice messages:** Already transcribed before reaching this flow
- **Cancel at any point:** "בטל" / "cancel" / "stop" → exit flow
- **Timeout:** wa_onboard_state cleaned up by existing cron after 24h

## What Changes

| File | Change |
|------|--------|
| `supabase/functions/whatsapp-webhook/index.ts` | Replace `POST_JOB_EXTRACT_SYSTEM`, `EXTRACT_FUNCTIONS`, `startPostJob`, `handlePostJobMessage` |
| `publishJob()` | Add `zip_code`, `state`, `schedule` to lead insert |

## What Stays

- `publishJob()` core logic (create lead → match contractors → notify)
- `STEP_PROFESSIONS` list (reuse for numbered display)
- Entry points (menu_post_job, start_post_job)
- `wa_onboard_state` table for state management
