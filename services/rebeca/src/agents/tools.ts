// Tool definitions for the onboarding agent.
// NO strict:true — allows partial saves without requiring all fields in 'required'.
export const ONBOARDING_TOOLS = [
  {
    type: 'function' as const,
    name: 'save_profile',
    description: 'Save collected contractor profile fields. Call whenever new info is gathered — even if only one field is known.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Full name of the contractor' },
        professions: {
          type: 'array',
          items: { type: 'string' },
          description: 'Trade keys: hvac, air_duct, renovation, plumbing, electrical, painting, roofing, flooring, fencing, cleaning, locksmith, landscaping, chimney, garage_doors, security, windows',
        },
        state: { type: 'string', description: 'US state code: FL, NY, TX' },
        cities: {
          type: 'array',
          items: { type: 'string' },
          description: 'City keys: miami, fort_lauderdale, hollywood, hialeah, coral_gables, boca_raton, west_palm, pompano, delray, homestead, doral, pembroke_pines, miramar, plantation, sunrise, weston, aventura, miami_beach, manhattan, brooklyn, queens, bronx, staten_island, yonkers, long_island, houston, dallas, san_antonio, austin',
        },
        working_days: {
          type: 'array',
          items: { type: 'integer' },
          description: 'Days of week: 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat, 7=Sun',
        },
      },
      additionalProperties: false,
    },
  },
  {
    type: 'function' as const,
    name: 'complete_onboarding',
    description: 'Call ONLY when all required fields are collected AND the user has confirmed the summary. Required: at least one profession, a state, and at least one city.',
    parameters: {
      type: 'object',
      required: ['confirmed'],
      properties: {
        confirmed: { type: 'boolean', description: 'Must be true' },
      },
      additionalProperties: false,
    },
  },
];

export const ONBOARDING_AGENT_INSTRUCTIONS = `Your name is Rebeca. You help contractors set up their profile via WhatsApp.

You need to collect these fields:
1. **name** — full name
2. **professions** — one or more trades from the available list
3. **state** — US state (currently: FL, NY, TX)
4. **cities** — cities within that state where they work
5. **working_days** — which days they work (1=Mon..7=Sun)

RULES:
- Default: HEBREW. Switch to English only if the user writes in English.
- Israeli tone: warm, direct, casual. Like a friend on WhatsApp.
- Keep messages SHORT — 2-3 sentences max.
- Extract ALL information you can from EACH message. If a user says "אני יוסי, אינסטלטור מפלורידה" — that's name + profession + state in one shot.
- After getting each piece of info, call save_profile immediately, then ask for the NEXT missing piece.
- When all fields are collected, show a summary and ask for confirmation.
- On confirmation, call complete_onboarding with confirmed: true.
- NEVER ask for information you already have.
- Available cities per state:
  FL: Miami, Fort Lauderdale, Hollywood, Hialeah, Coral Gables, Boca Raton, West Palm Beach, Pompano Beach, Delray Beach, Homestead, Doral, Pembroke Pines, Miramar, Plantation, Sunrise, Weston, Aventura, Miami Beach
  NY: Manhattan, Brooklyn, Queens, Bronx, Staten Island, Yonkers, Long Island
  TX: Houston, Dallas, San Antonio, Austin`;
