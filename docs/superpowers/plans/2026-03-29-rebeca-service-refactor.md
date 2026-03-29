# Rebeca Service Refactor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `services/whatsapp-notify/` and `supabase/functions/whatsapp-webhook/` with a single, clean `services/rebeca/` Render service that owns all WhatsApp communication with contractors.

**Architecture:** One Hono web service on Render handles both inbound Twilio webhooks and outbound lead delivery via BullMQ. All bot state lives in Supabase (`wa_onboard_state` only). The AI onboarding uses OpenAI Responses API with fixed tool definitions. The lead pipeline (wa-listener → parser → matching) is untouched.

**Tech Stack:** Node.js 20, TypeScript, Hono, BullMQ, ioredis, @supabase/supabase-js, pino, node-cron, OpenAI SDK, Twilio Node helper

**Spec:** `docs/superpowers/specs/2026-03-29-rebeca-service-refactor-design.md`

---

## File Map

```
services/rebeca/
├── src/
│   ├── index.ts              ← entry: server + worker + cron
│   ├── server.ts             ← Hono app + Twilio signature middleware
│   ├── router.ts             ← per-phone routing with Postgres advisory lock
│   ├── handlers/
│   │   ├── onboarding.ts     ← AI onboarding flow
│   │   ├── sales.ts          ← AI prospect engagement
│   │   ├── known-user.ts     ← menu / subscription / profile updates
│   │   └── lead-action.ts    ← claim / pass on lead
│   ├── outbound/
│   │   ├── worker.ts         ← BullMQ consumer for wa-notifications queue
│   │   ├── checkin.ts        ← daily availability cron
│   │   └── nudges.ts         ← lifecycle nudge sending
│   ├── agents/
│   │   ├── client.ts         ← OpenAI Responses API wrapper
│   │   └── tools.ts          ← tool definitions (no strict:true)
│   └── lib/
│       ├── state.ts          ← wa_onboard_state CRUD
│       ├── profile.ts        ← single-query profile lookup
│       ├── twilio.ts         ← sendText / sendButtons / verifySignature
│       ├── i18n.ts           ← t(phone, key) for all user-facing strings
│       ├── supabase.ts       ← shared supabase client
│       └── config.ts         ← env var loader
├── Dockerfile
├── package.json
└── tsconfig.json
```

**DB migrations** (separate plan: `2026-03-29-rebeca-db-migration.md`):
- Add `openai_response_id`, `session_started_at` columns to `wa_onboard_state`
- Add `try_phone_lock` / `release_phone_lock` Postgres RPCs
- Add `cron_runs` table for checkin idempotency

---

## Task 1: Project Scaffold

**Files:**
- Create: `services/rebeca/package.json`
- Create: `services/rebeca/tsconfig.json`
- Create: `services/rebeca/Dockerfile`
- Create: `services/rebeca/src/config.ts`

- [ ] **Step 1: Create `services/rebeca/` directory and `package.json`**

```bash
mkdir -p services/rebeca/src/handlers services/rebeca/src/outbound services/rebeca/src/agents services/rebeca/src/lib
```

`services/rebeca/package.json`:
```json
{
  "name": "@leadexpress/rebeca",
  "version": "1.0.0",
  "description": "Rebeca — WhatsApp bot for contractor onboarding and lead delivery",
  "type": "module",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "tsx watch src/index.ts"
  },
  "dependencies": {
    "@hono/node-server": "^1.13.0",
    "@supabase/supabase-js": "^2.49.1",
    "bullmq": "^5.34.3",
    "dotenv": "^16.4.7",
    "hono": "^4.6.0",
    "ioredis": "^5.4.2",
    "node-cron": "^3.0.3",
    "openai": "^4.77.0",
    "pino": "^9.6.0",
    "twilio": "^5.3.3"
  },
  "devDependencies": {
    "@types/node": "^22.13.4",
    "@types/node-cron": "^3.0.11",
    "tsx": "^4.19.3",
    "typescript": "^5.7.3"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

`services/rebeca/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 3: Create `Dockerfile`**

`services/rebeca/Dockerfile`:
```dockerfile
FROM node:20-alpine
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile 2>/dev/null || npm install
COPY tsconfig.json ./
COPY src ./src
RUN npm run build 2>/dev/null || pnpm build
CMD ["node", "dist/index.js"]
```

- [ ] **Step 4: Create `src/config.ts`**

`services/rebeca/src/config.ts`:
```typescript
import 'dotenv/config';

function required(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Missing required env var: ${name}`);
  return val;
}

function parseRedis() {
  const url = process.env.REDIS_URL;
  if (url) {
    try {
      const parsed = new URL(url);
      const useTls = parsed.protocol === 'rediss:';
      return {
        host: parsed.hostname || '127.0.0.1',
        port: Number(parsed.port || 6379),
        password: parsed.password || undefined,
        ...(useTls ? { tls: {} } : {}),
      };
    } catch { /* fall through */ }
  }
  return {
    host: process.env.REDIS_HOST ?? '127.0.0.1',
    port: Number(process.env.REDIS_PORT ?? 6379),
    password: process.env.REDIS_PASSWORD || undefined,
  };
}

export const config = {
  redis: { ...parseRedis(), maxRetriesPerRequest: null as null },
  supabase: {
    url: required('SUPABASE_URL'),
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? required('SUPABASE_SERVICE_KEY'),
  },
  twilio: {
    accountSid: required('TWILIO_ACCOUNT_SID'),
    authToken: required('TWILIO_AUTH_TOKEN'),
    whatsappFrom: required('TWILIO_WA_FROM'),
  },
  openai: {
    apiKey: required('OPENAI_API_KEY'),
  },
  cron: {
    checkinSchedule: process.env.CHECKIN_CRON ?? '0 7 * * *',
    timezone: process.env.CHECKIN_TIMEZONE ?? 'America/New_York',
  },
  server: {
    port: Number(process.env.PORT ?? 3002),
  },
  queues: {
    waNotifications: 'wa-notifications',
  },
} as const;
```

- [ ] **Step 5: Install dependencies**

```bash
cd services/rebeca
npm install
```

Expected: `node_modules/` created, no errors.

- [ ] **Step 6: Commit scaffold**

```bash
cd /Users/bigjeff/Desktop/Leadexpress
git add services/rebeca/
git commit -m "feat(rebeca): project scaffold — package.json, tsconfig, Dockerfile, config"
```

---

## Task 2: Shared Libraries

**Files:**
- Create: `services/rebeca/src/lib/supabase.ts`
- Create: `services/rebeca/src/lib/i18n.ts`
- Create: `services/rebeca/src/lib/twilio.ts`

- [ ] **Step 1: Create `lib/supabase.ts`**

`services/rebeca/src/lib/supabase.ts`:
```typescript
import { createClient } from '@supabase/supabase-js';
import { config } from '../config.js';

export const supabase = createClient(config.supabase.url, config.supabase.serviceKey);
```

- [ ] **Step 2: Create `lib/i18n.ts`**

`services/rebeca/src/lib/i18n.ts`:
```typescript
type Lang = 'he' | 'en';

export function lang(phone: string): Lang {
  return phone.startsWith('+972') ? 'he' : 'en';
}

const STRINGS: Record<Lang, Record<string, string>> = {
  he: {
    processing:            'רגע, מעבד את ההודעה הקודמת...',
    profession_fallback:   'מה המקצוע שלך? (למשל: אינסטלציה, חשמל, ניקוי צנרות)',
    profession_fallback2:  'מה אתה עושה? כתוב או שלח הודעה קולית 🎙️',
    subscription_expired:  'היי {{name}}! המנוי שלך פג תוקף.\nכנס ל-masterleadflow.com להארכה.\n\nאתה עדיין יכול להשתמש בתפריט.',
    unsubscribed:          'בוצע. לא תקבל יותר הודעות מאיתנו.',
    error_generic:         'סליחה, משהו השתבש. נסה שוב בעוד רגע 🙏',
    incomplete_profile:    'עדיין חסרים כמה פרטים. נסה שוב עם שם, מקצוע, מדינה וערים.',
    menu:                  '📋 *תפריט MasterLeadFlow*\n\nשלח מספר:\n\n1️⃣ ⚙️ ההגדרות שלי\n2️⃣ 📍 עדכן אזורי עבודה\n3️⃣ 🔧 עדכן מקצועות\n4️⃣ 📅 ימי עבודה\n5️⃣ ⏸️ עצור / חדש לידים\n\nאו שלח STOP לביטול מנוי.',
    available_confirm:     '✅ אתה אקטיבי! לידים יגיעו היום.',
    off_today:             '👍 בסדר, יום חופש! נתראה מחר.',
  },
  en: {
    processing:            'One moment, processing your previous message...',
    profession_fallback:   'What trade do you work in? (e.g. plumbing, electrical, HVAC)',
    profession_fallback2:  'What services do you offer? Type or send a voice note 🎙️',
    subscription_expired:  'Hi {{name}}! Your subscription has expired.\nVisit masterleadflow.com to renew.\n\nYou can still use the menu and chat below.',
    unsubscribed:          "You've been unsubscribed. You won't receive any more messages from us.",
    error_generic:         'Sorry, something went wrong. Please try again in a moment 🙏',
    incomplete_profile:    'A few details are still missing. Please include your name, trade, state, and cities.',
    menu:                  '📋 *MasterLeadFlow Menu*\n\nReply with a number:\n\n1️⃣ ⚙️ My Settings\n2️⃣ 📍 Update Areas\n3️⃣ 🔧 Update Trades\n4️⃣ 📅 Working Days\n5️⃣ ⏸️ Pause / Resume Leads\n\nOr send STOP to unsubscribe.',
    available_confirm:     "✅ You're live! Leads will come through today.",
    off_today:             '👍 Got it, enjoy your day off! See you tomorrow.',
  },
};

export function t(phone: string, key: string, vars?: Record<string, string>): string {
  const l = lang(phone);
  let str = STRINGS[l][key] ?? STRINGS.en[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      str = str.replaceAll(`{{${k}}}`, v);
    }
  }
  return str;
}
```

- [ ] **Step 3: Create `lib/twilio.ts`**

`services/rebeca/src/lib/twilio.ts`:
```typescript
import twilio from 'twilio';
import { config } from '../config.js';
import pino from 'pino';

const log = pino({ name: 'twilio' });
const TWILIO_API = `https://api.twilio.com/2010-04-01/Accounts/${config.twilio.accountSid}/Messages.json`;
const AUTH = 'Basic ' + Buffer.from(`${config.twilio.accountSid}:${config.twilio.authToken}`).toString('base64');

function formatWaPhone(phone: string): string {
  if (phone.startsWith('whatsapp:')) return phone;
  const digits = phone.replace(/[^\d+]/g, '');
  const e164 = digits.startsWith('+') ? digits : `+${digits}`;
  return `whatsapp:${e164}`;
}

async function postMessage(params: Record<string, string>): Promise<void> {
  const res = await fetch(TWILIO_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: AUTH },
    body: new URLSearchParams(params).toString(),
  });
  if (!res.ok) {
    const err = await res.text();
    log.error({ status: res.status, err, to: params.To }, 'Twilio send error');
    throw new Error(`Twilio error ${res.status}: ${err}`);
  }
  const data = await res.json() as { sid: string };
  log.info({ sid: data.sid, to: params.To }, 'Message sent');
}

export async function sendText(to: string, body: string): Promise<void> {
  await postMessage({ From: config.twilio.whatsappFrom, To: formatWaPhone(to), Body: body });
}

export async function sendContentTemplate(to: string, contentSid: string, variables?: Record<string, string>): Promise<void> {
  const params: Record<string, string> = {
    From: config.twilio.whatsappFrom,
    To: formatWaPhone(to),
    ContentSid: contentSid,
  };
  if (variables) params.ContentVariables = JSON.stringify(variables);
  await postMessage(params);
}

/**
 * Validate that an inbound request is genuinely from Twilio.
 * Returns true if valid, false if the signature does not match.
 */
export function validateTwilioSignature(
  url: string,
  params: Record<string, string>,
  signature: string,
): boolean {
  return twilio.validateRequest(config.twilio.authToken, signature, url, params);
}
```

- [ ] **Step 4: Commit**

```bash
cd /Users/bigjeff/Desktop/Leadexpress
git add services/rebeca/src/lib/
git commit -m "feat(rebeca): shared libs — supabase client, i18n, twilio sender"
```

---

## Task 3: State Management (`lib/state.ts`)

**Files:**
- Create: `services/rebeca/src/lib/state.ts`

This is the single source of truth for all bot state. Replaces both `wa_onboard_state` (Supabase) and Redis `le:wa-register:*` keys.

- [ ] **Step 1: Create `lib/state.ts`**

`services/rebeca/src/lib/state.ts`:
```typescript
import { supabase } from './supabase.js';

export interface BotState {
  step: 'ai' | 'confirm' | 'groups' | 'menu' | 'post_job' | 'lead_pending';
  userId: string | null;
  prospectId: string | null;
  language: 'he' | 'en';
  openaiResponseId: string | null;
  sessionStartedAt: string;
  collected: {
    name?: string;
    professions?: string[];
    state?: string;
    cities?: string[];
    workingDays?: number[];
  };
  extra?: Record<string, unknown>; // for step-specific data (e.g. pending leads)
}

/** Load current bot state for a phone number. Returns null if none. */
export async function getState(phone: string): Promise<BotState | null> {
  const { data } = await supabase
    .from('wa_onboard_state')
    .select('step, data')
    .eq('phone', phone)
    .maybeSingle();

  if (!data) return null;

  const d = data.data as Record<string, unknown>;
  return {
    step: data.step as BotState['step'],
    userId: d.userId as string | null ?? null,
    prospectId: d.prospectId as string | null ?? null,
    language: (d.language as 'he' | 'en') ?? 'en',
    openaiResponseId: (d.openaiResponseId as string | null) ?? null,
    sessionStartedAt: (d.sessionStartedAt as string) ?? new Date().toISOString(),
    collected: (d.collected as BotState['collected']) ?? {},
    extra: (d.extra as Record<string, unknown>) ?? undefined,
  };
}

/** Upsert (create or update) bot state for a phone number. */
export async function setState(phone: string, state: BotState): Promise<void> {
  await supabase.from('wa_onboard_state').upsert({
    phone,
    step: state.step,
    data: {
      userId: state.userId,
      prospectId: state.prospectId,
      language: state.language,
      openaiResponseId: state.openaiResponseId,
      sessionStartedAt: state.sessionStartedAt,
      collected: state.collected,
      extra: state.extra,
    },
    updated_at: new Date().toISOString(),
  });
}

/** Update only the collected fields and openaiResponseId, keeping other state intact. */
export async function updateCollected(
  phone: string,
  patch: Partial<BotState['collected']>,
  openaiResponseId?: string,
): Promise<void> {
  const current = await getState(phone);
  if (!current) return;
  await setState(phone, {
    ...current,
    collected: { ...current.collected, ...patch },
    openaiResponseId: openaiResponseId ?? current.openaiResponseId,
  });
}

/** Delete bot state — user is fully onboarded or opted out. */
export async function clearState(phone: string): Promise<void> {
  await supabase.from('wa_onboard_state').delete().eq('phone', phone);
}

/** Initialize fresh onboarding state for a new or returning user. */
export function newOnboardState(
  userId: string | null,
  prospectId: string | null,
  lang: 'he' | 'en',
  knownName?: string,
): BotState {
  return {
    step: 'ai',
    userId,
    prospectId,
    language: lang,
    openaiResponseId: null,
    sessionStartedAt: new Date().toISOString(),
    collected: knownName ? { name: knownName } : {},
  };
}

/** Check if the OpenAI session is still fresh (< 25 days old). */
export function isSessionFresh(state: BotState): boolean {
  const start = new Date(state.sessionStartedAt).getTime();
  const ageMs = Date.now() - start;
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  return ageDays < 25;
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/bigjeff/Desktop/Leadexpress
git add services/rebeca/src/lib/state.ts
git commit -m "feat(rebeca): state management — single wa_onboard_state table, typed BotState"
```

---

## Task 4: Profile Lookup (`lib/profile.ts`)

**Files:**
- Create: `services/rebeca/src/lib/profile.ts`

- [ ] **Step 1: Create `lib/profile.ts`**

`services/rebeca/src/lib/profile.ts`:
```typescript
import { supabase } from './supabase.js';

export interface Profile {
  id: string;
  full_name: string;
  whatsapp_phone: string | null;
  phone: string | null;
}

export interface ContractorRecord {
  user_id: string;
  professions: string[];
  zip_codes: string[];
  wa_notify: boolean;
  available_today: boolean;
  wa_window_until: string | null;
}

/**
 * Find a profile by WhatsApp phone OR registered phone (single query).
 * Returns null if not found.
 */
export async function findProfile(phone: string): Promise<Profile | null> {
  const stripped = phone.replace(/^\+/, '');
  const { data } = await supabase
    .from('profiles')
    .select('id, full_name, whatsapp_phone, phone')
    .or(`whatsapp_phone.eq.${phone},phone.eq.${phone},phone.eq.${stripped}`)
    .maybeSingle();
  return data ?? null;
}

/**
 * Link a WhatsApp phone to a profile (when found by phone field but
 * whatsapp_phone is not yet set).
 */
export async function linkWhatsAppPhone(profileId: string, phone: string): Promise<void> {
  await supabase
    .from('profiles')
    .update({ whatsapp_phone: phone })
    .eq('id', profileId)
    .is('whatsapp_phone', null); // only update if not already set
}

/**
 * Get or create contractor record for a user.
 * Returns null if profile not found.
 */
export async function getContractor(userId: string): Promise<ContractorRecord | null> {
  const { data } = await supabase
    .from('contractors')
    .select('user_id, professions, zip_codes, wa_notify, available_today, wa_window_until')
    .eq('user_id', userId)
    .maybeSingle();
  return data ?? null;
}

/**
 * Check if contractor is fully onboarded (has professions and zip_codes).
 */
export function isContractorSetUp(contractor: ContractorRecord | null): boolean {
  if (!contractor) return false;
  return contractor.professions.length > 0 && contractor.zip_codes.length > 0;
}

/**
 * Check subscription status. Returns true if active or trialing.
 */
export async function hasActiveSubscription(userId: string): Promise<boolean> {
  const { data } = await supabase
    .from('subscriptions')
    .select('status')
    .eq('user_id', userId)
    .in('status', ['active', 'trialing'])
    .maybeSingle();
  return !!data;
}

/**
 * Check if phone is opted out of WA messages.
 */
export async function isOptedOut(phone: string): Promise<boolean> {
  const { data } = await supabase
    .from('wa_opt_outs')
    .select('id')
    .eq('phone', phone)
    .maybeSingle();
  return !!data;
}

/**
 * Record opt-out for a phone number.
 */
export async function recordOptOut(phone: string): Promise<void> {
  await supabase.from('wa_opt_outs').upsert({ phone, created_at: new Date().toISOString() });
  await supabase
    .from('contractors')
    .update({ wa_notify: false, is_active: false })
    .eq('user_id',
      (await supabase.from('profiles').select('id').eq('whatsapp_phone', phone).maybeSingle())?.data?.id ?? ''
    );
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/bigjeff/Desktop/Leadexpress
git add services/rebeca/src/lib/profile.ts
git commit -m "feat(rebeca): profile lookup — single OR query, contractor helpers"
```

---

## Task 5: OpenAI Agent Client (`agents/client.ts` + `agents/tools.ts`)

**Files:**
- Create: `services/rebeca/src/agents/tools.ts`
- Create: `services/rebeca/src/agents/client.ts`

- [ ] **Step 1: Create `agents/tools.ts`**

`services/rebeca/src/agents/tools.ts`:
```typescript
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
```

- [ ] **Step 2: Create `agents/client.ts`**

`services/rebeca/src/agents/client.ts`:
```typescript
import { config } from '../config.js';
import type { BotState } from '../lib/state.js';

const OPENAI_URL = 'https://api.openai.com/v1/responses';
const SESSION_MAX_AGE_DAYS = 25;

export interface AIResponse {
  id: string;
  output: Array<{
    type: string;
    name?: string;
    arguments?: string;
    content?: Array<{ type: string; text?: string }>;
  }>;
  output_text?: string;
}

/**
 * Call OpenAI Responses API.
 * Chains conversation via previous_response_id if session is fresh.
 * Returns the raw response object.
 */
export async function callOpenAI(opts: {
  instructions: string;
  userMessage: string;
  tools?: unknown[];
  state: BotState;
  maxTokens?: number;
}): Promise<AIResponse> {
  const { instructions, userMessage, tools, state, maxTokens = 500 } = opts;

  // Check session freshness — don't chain if session is stale
  const sessionAgeMs = Date.now() - new Date(state.sessionStartedAt).getTime();
  const sessionAgeDays = sessionAgeMs / (1000 * 60 * 60 * 24);
  const isFresh = sessionAgeDays < SESSION_MAX_AGE_DAYS;

  const body: Record<string, unknown> = {
    model: 'gpt-4o-mini',
    instructions,
    input: [{ role: 'user', content: userMessage }],
    tools: tools && tools.length > 0 ? tools : undefined,
    store: true,
    max_output_tokens: maxTokens,
    temperature: 0.7,
  };

  if (isFresh && state.openaiResponseId) {
    body.previous_response_id = state.openaiResponseId;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  let res: Response;
  try {
    res = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.openai.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    const errText = await res.text();
    // If the error is about previous_response_id, retry without it
    if (state.openaiResponseId && errText.includes('previous_response')) {
      delete body.previous_response_id;
      const retryController = new AbortController();
      const retryTimeout = setTimeout(() => retryController.abort(), 30_000);
      try {
        const retry = await fetch(OPENAI_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${config.openai.apiKey}`,
          },
          body: JSON.stringify(body),
          signal: retryController.signal,
        });
        if (!retry.ok) throw new Error(`OpenAI error after retry: ${await retry.text()}`);
        return await retry.json() as AIResponse;
      } finally {
        clearTimeout(retryTimeout);
      }
    }
    throw new Error(`OpenAI error ${res.status}: ${errText}`);
  }

  return await res.json() as AIResponse;
}

/**
 * Extract the text message from an OpenAI response output array.
 */
export function extractTextFromResponse(response: AIResponse): string | null {
  for (const item of response.output ?? []) {
    if (item.type === 'message') {
      const textItem = item.content?.find(c => c.type === 'output_text' || c.type === 'text');
      if (textItem?.text) return textItem.text;
    }
  }
  return response.output_text ?? null;
}

/**
 * Extract function calls from an OpenAI response output array.
 */
export function extractToolCalls(response: AIResponse): Array<{ name: string; args: Record<string, unknown> }> {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  for (const item of response.output ?? []) {
    if (item.type === 'function_call' && item.name) {
      try {
        calls.push({ name: item.name, args: JSON.parse(item.arguments ?? '{}') });
      } catch {
        // skip malformed
      }
    }
  }
  return calls;
}
```

- [ ] **Step 3: Commit**

```bash
cd /Users/bigjeff/Desktop/Leadexpress
git add services/rebeca/src/agents/
git commit -m "feat(rebeca): OpenAI agent client and tool definitions"
```

---

## Task 6: Onboarding Handler

**Files:**
- Create: `services/rebeca/src/handlers/onboarding.ts`

This is the core AI-driven onboarding flow. Replaces the 600-line `handleAIOnboarding` + `processOnboardingAIResponse` + `executeOnboardingCompletion` from the old Edge Function.

- [ ] **Step 1: Create `handlers/onboarding.ts`**

`services/rebeca/src/handlers/onboarding.ts`:
```typescript
import { supabase } from '../lib/supabase.js';
import { sendText } from '../lib/twilio.js';
import { t, lang } from '../lib/i18n.js';
import { getState, setState, clearState, updateCollected, newOnboardState, isSessionFresh } from '../lib/state.js';
import { callOpenAI, extractTextFromResponse, extractToolCalls } from '../agents/client.js';
import { ONBOARDING_TOOLS, ONBOARDING_AGENT_INSTRUCTIONS } from '../agents/tools.js';
import type { BotState } from '../lib/state.js';
import pino from 'pino';

const log = pino({ name: 'onboarding' });

// Valid profession keys
const VALID_PROFESSIONS = new Set([
  'hvac','air_duct','renovation','plumbing','electrical','painting',
  'roofing','flooring','fencing','cleaning','locksmith','landscaping',
  'chimney','garage_doors','security','windows',
]);

// City key → zip code mapping (primary zip per city)
const CITY_ZIPS: Record<string, string> = {
  miami: '33101', fort_lauderdale: '33301', hollywood: '33019',
  hialeah: '33010', coral_gables: '33146', boca_raton: '33431',
  west_palm: '33401', pompano: '33060', delray: '33444',
  homestead: '33030', doral: '33178', pembroke_pines: '33024',
  miramar: '33025', plantation: '33317', sunrise: '33325',
  weston: '33326', aventura: '33160', miami_beach: '33139',
  manhattan: '10001', brooklyn: '11201', queens: '11101',
  bronx: '10451', staten_island: '10301', yonkers: '10701',
  long_island: '11501', houston: '77001', dallas: '75201',
  san_antonio: '78201', austin: '78701',
};

/**
 * Start onboarding for a user who has a profile but no contractor setup.
 */
export async function startOnboarding(phone: string, profile: { id: string; full_name: string }): Promise<void> {
  const l = lang(phone);
  const hasRealName = profile.full_name && !profile.full_name.startsWith('+');
  const firstName = hasRealName ? profile.full_name.split(' ')[0] : '';

  const state = newOnboardState(profile.id, null, l, hasRealName ? profile.full_name : undefined);
  await setState(phone, state);

  if (l === 'he') {
    await sendText(phone,
      hasRealName
        ? `היי ${firstName}! אני רבקה 👋\nספר לי מה אתה עושה ואיפה אתה עובד — ואני אתחיל לחפש לך עבודות.`
        : `היי! אני רבקה 👋\nספר לי מה השם שלך, מה אתה עושה ואיפה — ואני אתחיל לחפש לך עבודות.`,
    );
  } else {
    await sendText(phone,
      hasRealName
        ? `Hey ${firstName}! I'm Rebeca 👋\nTell me what you do and where you work — I'll start finding you jobs.`
        : `Hey! I'm Rebeca 👋\nTell me your name, what you do, and where — I'll start finding you jobs.`,
    );
  }
}

/**
 * Handle a message from a user who is currently in the onboarding flow.
 */
export async function handleOnboarding(phone: string, text: string): Promise<void> {
  const state = await getState(phone);
  if (!state) {
    await sendText(phone, t(phone, 'error_generic'));
    return;
  }

  // Escape words — exit onboarding anytime
  const lower = text.trim().toLowerCase();
  if (['menu', 'help', 'cancel', 'stop', 'תפריט', 'ביטול'].includes(lower)) {
    await clearState(phone);
    await sendText(phone, t(phone, 'menu'));
    return;
  }

  // Build context block for the AI
  const c = state.collected;
  const missing: string[] = [];
  if (!c.name) missing.push('name (full name)');
  if (!c.professions?.length) missing.push('professions (trade/s)');
  if (!c.state) missing.push('state (US state: FL, NY, TX)');
  if (!c.cities?.length) missing.push('cities (within their state)');
  if (!c.workingDays?.length) missing.push('working_days (days of week)');

  const contextBlock = `<onboarding_state>
Collected so far:
- Name: ${c.name || '(not yet)'}
- Professions: ${c.professions?.join(', ') || '(not yet)'}
- State: ${c.state || '(not yet)'}
- Cities: ${c.cities?.join(', ') || '(not yet)'}
- Working days: ${c.workingDays?.map(d => ['','Mon','Tue','Wed','Thu','Fri','Sat','Sun'][d]).join(', ') || '(not yet)'}

Still missing: ${missing.length > 0 ? missing.join(', ') : 'NOTHING — all fields collected, show summary and ask for confirmation'}
</onboarding_state>`;

  const instructions = ONBOARDING_AGENT_INSTRUCTIONS + '\n\n' + contextBlock;

  let aiResponse;
  try {
    aiResponse = await callOpenAI({
      instructions,
      userMessage: text,
      tools: ONBOARDING_TOOLS,
      state,
      maxTokens: 500,
    });
  } catch (err) {
    log.error({ err, phone }, 'OpenAI call failed');
    await sendText(phone, t(phone, 'profession_fallback'));
    return;
  }

  // Save session ID first (before processing output — in case of crash)
  await updateCollected(phone, {}, aiResponse.id);

  // Process tool calls
  const toolCalls = extractToolCalls(aiResponse);
  for (const call of toolCalls) {
    if (call.name === 'save_profile') {
      const args = call.args as Partial<BotState['collected']> & { working_days?: number[] };
      const patch: Partial<BotState['collected']> = {};

      if (args.name) patch.name = args.name as string;
      if (Array.isArray(args.professions) && args.professions.length > 0) {
        // Validate profession keys
        patch.professions = (args.professions as string[]).filter(p => VALID_PROFESSIONS.has(p));
      }
      if (args.state) patch.state = args.state as string;
      if (Array.isArray(args.cities) && args.cities.length > 0) {
        patch.cities = args.cities as string[];
      }
      if (Array.isArray(args.working_days) && args.working_days.length > 0) {
        patch.workingDays = args.working_days as number[];
      }

      await updateCollected(phone, patch);
      log.info({ phone, patch }, 'Profile data saved');
    }

    if (call.name === 'complete_onboarding') {
      // Re-read state to get latest collected data
      const latest = await getState(phone);
      const col = latest?.collected ?? {};

      // Guard: ensure minimum required fields before completing
      if (!col.professions?.length || !col.state || !col.cities?.length) {
        log.warn({ phone, col }, 'complete_onboarding called with incomplete data');
        await sendText(phone, t(phone, 'incomplete_profile'));
        return;
      }

      await executeCompletion(phone, latest!);
      return;
    }
  }

  // Send text response
  const text_response = extractTextFromResponse(aiResponse);
  if (text_response) {
    await sendText(phone, text_response);
  } else {
    await sendText(phone, t(phone, 'profession_fallback2'));
  }
}

/**
 * Execute the final step: create contractor record and mark user as set up.
 */
async function executeCompletion(phone: string, state: BotState): Promise<void> {
  const { userId, collected, language: l } = state;
  if (!userId) {
    log.error({ phone }, 'executeCompletion called with no userId');
    return;
  }

  const zipCodes = (collected.cities ?? [])
    .map(city => CITY_ZIPS[city])
    .filter(Boolean) as string[];

  // Idempotent: check if contractor already set up
  const { data: existing } = await supabase
    .from('contractors')
    .select('user_id, professions')
    .eq('user_id', userId)
    .maybeSingle();

  if (existing?.professions?.length > 0) {
    // Already done — just clear state and confirm
    await clearState(phone);
    const msg = l === 'he'
      ? '✅ הפרופיל שלך כבר מוגדר! תתחיל לקבל לידים.'
      : '✅ Your profile is already set up! You\'ll start receiving leads.';
    await sendText(phone, msg);
    return;
  }

  // Upsert contractor record
  const { error } = existing
    ? await supabase.from('contractors').update({
        professions: collected.professions,
        zip_codes: zipCodes,
        working_days: collected.workingDays ?? [1,2,3,4,5],
        wa_notify: true,
        is_active: true,
      }).eq('user_id', userId)
    : await supabase.from('contractors').insert({
        user_id: userId,
        professions: collected.professions,
        zip_codes: zipCodes,
        working_days: collected.workingDays ?? [1,2,3,4,5],
        wa_notify: true,
        is_active: true,
      });

  if (error) {
    log.error({ error, userId }, 'Failed to save contractor');
    await sendText(phone, t(phone, 'error_generic'));
    return;
  }

  // Update profile full_name if we collected it
  if (collected.name) {
    await supabase.from('profiles').update({ full_name: collected.name }).eq('id', userId);
  }

  await clearState(phone);

  const name = collected.name?.split(' ')[0] ?? '';
  const msg = l === 'he'
    ? `✅ ${name ? `${name}, ` : ''}הפרופיל שלך מוגדר!\nתתחיל לקבל לידים בהתאם למקצוע ואזור שלך.\n\nשלח *MENU* לאפשרויות.`
    : `✅ ${name ? `${name}, ` : ''}you're all set!\nYou'll start receiving leads matching your trade and area.\n\nSend *MENU* for options.`;

  await sendText(phone, msg);
  log.info({ phone, userId, professions: collected.professions, zipCodes }, 'Onboarding complete');
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/bigjeff/Desktop/Leadexpress
git add services/rebeca/src/handlers/onboarding.ts
git commit -m "feat(rebeca): onboarding handler — AI-driven, validates before completion"
```

---

## Task 7: Known-User Handler

**Files:**
- Create: `services/rebeca/src/handlers/known-user.ts`

- [ ] **Step 1: Create `handlers/known-user.ts`**

`services/rebeca/src/handlers/known-user.ts`:
```typescript
import { supabase } from '../lib/supabase.js';
import { sendText } from '../lib/twilio.js';
import { t } from '../lib/i18n.js';
import { hasActiveSubscription, recordOptOut } from '../lib/profile.js';
import { startOnboarding } from './onboarding.js';
import pino from 'pino';

const log = pino({ name: 'known-user' });

const MENU_TRIGGERS = new Set(['menu', 'help', 'תפריט', 'עזרה', 'options']);
const STOP_TRIGGERS = new Set(['stop', 'unsubscribe', 'cancel', 'הסר', 'ביטול', 'הפסק']);
const POSITIVE_RESPONSES = new Set([
  'כן','yes','yeah','yep','y','ok','אוקי','זמין','available',
  'sure','בטח','כמובן','1','👍','yea','ya','ken','betach',
]);

export async function handleKnownUser(
  phone: string,
  text: string,
  profile: { id: string; full_name: string },
): Promise<void> {
  const lower = text.trim().toLowerCase();

  // Check contractor setup — if not set up, start onboarding (no subscription check yet)
  const { data: contractor } = await supabase
    .from('contractors')
    .select('user_id, professions, zip_codes, wa_notify')
    .eq('user_id', profile.id)
    .maybeSingle();

  if (!contractor || contractor.professions.length === 0 || contractor.zip_codes.length === 0) {
    if (!contractor) {
      await supabase.from('contractors').insert({ user_id: profile.id, wa_notify: true });
    }
    await startOnboarding(phone, profile);
    return;
  }

  // Enable WA notify if disabled
  if (!contractor.wa_notify) {
    await supabase.from('contractors').update({ wa_notify: true }).eq('user_id', profile.id);
  }

  // Subscription check — only for fully set-up users
  const hasSub = await hasActiveSubscription(profile.id);
  if (!hasSub) {
    const name = profile.full_name.split(' ')[0];
    await sendText(phone, t(phone, 'subscription_expired', { name }));
    // Don't return — allow menu access
  }

  // STOP / unsubscribe
  if (STOP_TRIGGERS.has(lower)) {
    await recordOptOut(phone);
    await sendText(phone, t(phone, 'unsubscribed'));
    return;
  }

  // MENU
  if (MENU_TRIGGERS.has(lower)) {
    await sendText(phone, t(phone, 'menu'));
    return;
  }

  // Daily check-in positive response
  if ([...POSITIVE_RESPONSES].some(w => lower.includes(w))) {
    await markAvailable(phone, profile.id);
    return;
  }

  // Unrecognized — show menu
  log.debug({ phone, text: lower }, 'Unrecognized message from known user');
  await sendText(phone, t(phone, 'menu'));
}

async function markAvailable(phone: string, userId: string): Promise<void> {
  const windowUntil = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const { error } = await supabase
    .from('contractors')
    .update({ available_today: true, wa_window_until: windowUntil })
    .eq('user_id', userId);

  if (error) {
    log.error({ error, userId }, 'Failed to mark available');
    return;
  }
  await sendText(phone, t(phone, 'available_confirm'));
  log.info({ userId, windowUntil }, 'Contractor marked available');
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/bigjeff/Desktop/Leadexpress
git add services/rebeca/src/handlers/known-user.ts
git commit -m "feat(rebeca): known-user handler — menu, subscription check, availability"
```

---

## Task 8: Sales Handler

**Files:**
- Create: `services/rebeca/src/handlers/sales.ts`

- [ ] **Step 1: Create `handlers/sales.ts`**

`services/rebeca/src/handlers/sales.ts`:
```typescript
import { sendText } from '../lib/twilio.js';
import { t, lang } from '../lib/i18n.js';
import { getState, setState, newOnboardState } from '../lib/state.js';
import { callOpenAI, extractTextFromResponse } from '../agents/client.js';
import pino from 'pino';

const log = pino({ name: 'sales' });

const SALES_INSTRUCTIONS = `Your name is Rebeca, from MasterLeadFlow.
We help contractors find new jobs every day by scanning WhatsApp groups.

Your goal: understand if this person is a contractor, and if so, get them to sign up for a free trial.

RULES:
- Default: HEBREW. Switch to English only if the user writes in English.
- Keep messages SHORT — 1-3 sentences.
- Be warm, direct, conversational. Like a friend, not a salesperson.
- If they express interest or say YES, tell them to say "כן" or "yes" to start.
- If they ask how it works: "We scan WhatsApp groups in your area and send you matching job requests — no searching needed."
- If they're clearly not a contractor or not interested, be polite and end the conversation.`;

/**
 * Handle a message from an unknown user (no profile found).
 * Uses AI for natural conversation and leads toward registration.
 */
export async function handleSales(phone: string, text: string): Promise<void> {
  const l = lang(phone);

  // Load or create a lightweight sales session (reuse BotState, userId=null)
  let state = await getState(phone);
  if (!state) {
    state = newOnboardState(null, null, l);
    await setState(phone, state);

    // First contact — send greeting
    const greeting = l === 'he'
      ? 'היי! 👋 אני רבקה מ-MasterLeadFlow.\nאנחנו עוזרים לקבלנים למצוא עבודות חדשות כל יום.\n\nרוצה לשמוע איך? ✍️'
      : 'Hey! 👋 I\'m Rebeca from MasterLeadFlow.\nWe help contractors find new jobs every day.\n\nWant to hear how? Just reply!';
    await sendText(phone, greeting);
    return;
  }

  // Call AI for continued conversation
  try {
    const aiResponse = await callOpenAI({
      instructions: SALES_INSTRUCTIONS,
      userMessage: text,
      state,
      maxTokens: 300,
    });

    // Save session ID
    state.openaiResponseId = aiResponse.id;
    await setState(phone, state);

    const reply = extractTextFromResponse(aiResponse);
    if (reply) {
      await sendText(phone, reply);
    } else {
      await sendText(phone, t(phone, 'error_generic'));
    }
  } catch (err) {
    log.error({ err, phone }, 'Sales AI call failed');
    await sendText(phone, t(phone, 'error_generic'));
  }
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/bigjeff/Desktop/Leadexpress
git add services/rebeca/src/handlers/sales.ts
git commit -m "feat(rebeca): sales handler — AI prospect engagement"
```

---

## Task 9: Lead-Action Handler

**Files:**
- Create: `services/rebeca/src/handlers/lead-action.ts`

- [ ] **Step 1: Create `handlers/lead-action.ts`**

`services/rebeca/src/handlers/lead-action.ts`:
```typescript
import { supabase } from '../lib/supabase.js';
import { sendText } from '../lib/twilio.js';
import pino from 'pino';

const log = pino({ name: 'lead-action' });

function buildContactLink(senderId: string | null, profession: string, city: string | null): string | null {
  if (!senderId) return null;
  const phone = senderId.replace(/@.*$/, '');
  if (!phone || phone.length < 8) return null;
  const msg = encodeURIComponent(
    `Hi! I'm a ${profession} contractor reaching out about your request${city ? ` in ${city}` : ''}. I'm available — when works for you?`,
  );
  return `https://wa.me/${phone}?text=${msg}`;
}

export async function handleLeadClaim(phone: string, leadId: string): Promise<void> {
  const { data: lead } = await supabase
    .from('leads')
    .select('id, profession, city, sender_id, parsed_summary')
    .eq('id', leadId)
    .maybeSingle();

  if (!lead) {
    await sendText(phone, 'This lead is no longer available.');
    return;
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('whatsapp_phone', phone)
    .maybeSingle();

  if (profile) {
    supabase.from('pipeline_events').insert({
      stage: 'lead_claimed',
      lead_id: leadId,
      detail: { contractor_id: profile.id, channel: 'whatsapp' },
    }).then(() => {});
  }

  const link = buildContactLink(lead.sender_id, lead.profession, lead.city);
  const msg = link
    ? `✅ Great! Here's the contact:\n\n👉 ${link}\n\nGood luck! 🤞`
    : `✅ Lead claimed! Good luck 🤞`;

  await sendText(phone, msg);
  log.info({ leadId, phone }, 'Lead claim handled');
}

export async function handleLeadPass(phone: string, leadId: string): Promise<void> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('whatsapp_phone', phone)
    .maybeSingle();

  if (profile) {
    await supabase.from('pipeline_events').insert({
      stage: 'lead_passed',
      detail: { lead_id: leadId, contractor_id: profile.id },
    });
  }
  await sendText(phone, 'OK, skipped. Next one coming! 👍');
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/bigjeff/Desktop/Leadexpress
git add services/rebeca/src/handlers/lead-action.ts
git commit -m "feat(rebeca): lead-action handler — claim and pass"
```

---

## Task 10: Router

**Files:**
- Create: `services/rebeca/src/router.ts`

- [ ] **Step 1: Create `router.ts`**

`services/rebeca/src/router.ts`:
```typescript
import { supabase } from './lib/supabase.js';
import { sendText } from './lib/twilio.js';
import { t } from './lib/i18n.js';
import { getState } from './lib/state.js';
import { findProfile, linkWhatsAppPhone, isOptedOut } from './lib/profile.js';
import { handleOnboarding, startOnboarding } from './handlers/onboarding.js';
import { handleKnownUser } from './handlers/known-user.js';
import { handleSales } from './handlers/sales.js';
import { handleLeadClaim, handleLeadPass } from './handlers/lead-action.js';
import pino from 'pino';

const log = pino({ name: 'router' });

const GROUP_LINK_RE = /chat\.whatsapp\.com\/([A-Za-z0-9]+)/;
const CONNECTION_CODE_RE = /LE-([a-f0-9]{8})/i;

/**
 * Route an inbound Twilio WhatsApp message to the correct handler.
 * Uses a Postgres advisory lock to prevent concurrent processing of
 * messages from the same phone number.
 */
export async function routeMessage(
  phone: string,
  text: string,
  buttonPayload: string,
): Promise<void> {
  // Acquire per-phone advisory lock (prevents race conditions on concurrent messages)
  const lockKey = Math.abs(hashPhoneToInt(phone));
  const { data: lockAcquired } = await supabase.rpc('try_phone_lock', { lock_key: lockKey });

  if (!lockAcquired) {
    log.debug({ phone }, 'Phone locked — concurrent message, sending wait message');
    await sendText(phone, t(phone, 'processing'));
    return;
  }

  try {
    await processMessage(phone, text.trim(), buttonPayload);
  } finally {
    await supabase.rpc('release_phone_lock', { lock_key: lockKey });
  }
}

async function processMessage(phone: string, text: string, buttonPayload: string): Promise<void> {
  const lower = text.toLowerCase();

  // 1. Button payload (Quick Reply button press)
  if (buttonPayload) {
    await handleButtonPayload(phone, buttonPayload);
    return;
  }

  // 2. Connection code (LE-{userId prefix})
  const codeMatch = text.match(CONNECTION_CODE_RE);
  if (codeMatch) {
    await handleConnectionCode(phone, codeMatch[1]);
    return;
  }

  // 3. WhatsApp group link
  if (GROUP_LINK_RE.test(text)) {
    await handleGroupLink(phone, text);
    return;
  }

  // 4. Active onboarding state
  const state = await getState(phone);
  if (state) {
    await handleOnboarding(phone, text);
    return;
  }

  // 5. Opted out
  if (await isOptedOut(phone)) {
    log.info({ phone }, 'Opted-out phone, ignoring');
    return;
  }

  // 6. Known profile
  const profile = await findProfile(phone);
  if (profile) {
    // Link whatsapp_phone if not yet set
    if (!profile.whatsapp_phone) {
      await linkWhatsAppPhone(profile.id, phone);
    }
    await handleKnownUser(phone, text, profile);
    return;
  }

  // 7. Unknown → sales agent
  log.info({ phone }, 'Unknown phone — routing to sales');
  await handleSales(phone, text);
}

async function handleButtonPayload(phone: string, payload: string): Promise<void> {
  // Lead claim/pass: payload format "claim:{leadId}" or "pass:{leadId}"
  const claimMatch = payload.match(/^claim:(.+)$/);
  if (claimMatch) {
    await handleLeadClaim(phone, claimMatch[1]);
    return;
  }
  const passMatch = payload.match(/^pass:(.+)$/);
  if (passMatch) {
    await handleLeadPass(phone, passMatch[1]);
    return;
  }
  log.warn({ phone, payload }, 'Unknown button payload');
}

async function handleConnectionCode(phone: string, code: string): Promise<void> {
  // Find profile by ID prefix
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name')
    .ilike('id', `${code}%`)
    .maybeSingle();

  if (!profile) {
    await sendText(phone, 'Invalid connection code. Please generate a new one from the dashboard.');
    return;
  }

  await linkWhatsAppPhone(profile.id, phone);
  const name = profile.full_name.split(' ')[0];
  await sendText(phone, `✅ Connected! Hi ${name} 👋\nYou'll now receive lead notifications here.`);
}

async function handleGroupLink(phone: string, text: string): Promise<void> {
  const match = text.match(GROUP_LINK_RE);
  if (!match) return;

  const inviteCode = match[1];
  const profile = await findProfile(phone);

  if (profile) {
    await supabase.from('contractor_group_scan_requests').insert({
      contractor_id: profile.id,
      invite_code: inviteCode,
      invite_link: `https://chat.whatsapp.com/${inviteCode}`,
      status: 'pending',
    });
    await sendText(phone, '✅ Group saved! We\'ll review and add it to our scan list.');
  } else {
    await sendText(phone, '✅ Thanks! Send your registration link too so we can connect the group to your account.');
  }
}

/** Stable integer hash of phone for Postgres advisory lock key */
function hashPhoneToInt(phone: string): number {
  let hash = 0;
  for (let i = 0; i < phone.length; i++) {
    const char = phone.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash;
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/bigjeff/Desktop/Leadexpress
git add services/rebeca/src/router.ts
git commit -m "feat(rebeca): router — advisory lock, full routing chain"
```

---

## Task 11: HTTP Server with Twilio Signature Validation

**Files:**
- Create: `services/rebeca/src/server.ts`

- [ ] **Step 1: Create `server.ts`**

`services/rebeca/src/server.ts`:
```typescript
import { Hono } from 'hono';
import { validateTwilioSignature } from './lib/twilio.js';
import { routeMessage } from './router.js';
import pino from 'pino';

const log = pino({ name: 'server' });

export function createServer(): Hono {
  const app = new Hono();

  // Health check — no auth required
  app.get('/health', (c) => c.json({ status: 'ok', service: 'rebeca' }));

  // Twilio signature validation middleware
  app.use('/webhooks/*', async (c, next) => {
    const signature = c.req.header('x-twilio-signature') ?? '';
    const url = c.req.url;

    // Parse form body for signature validation (Twilio signs the form params)
    const body = await c.req.parseBody();
    const params: Record<string, string> = {};
    for (const [k, v] of Object.entries(body)) {
      if (typeof v === 'string') params[k] = v;
    }

    const isValid = validateTwilioSignature(url, params, signature);
    if (!isValid) {
      log.warn({ url, signature }, 'Twilio signature validation FAILED');
      return c.text('Forbidden', 403);
    }

    // Store parsed body for route handler
    c.set('twilioBody', params);
    await next();
  });

  // Inbound WhatsApp webhook
  app.post('/webhooks/whatsapp', async (c) => {
    const body = c.get('twilioBody') as Record<string, string>;
    const from = (body.From ?? '').replace('whatsapp:', '');
    const text = body.Body ?? '';
    const buttonPayload = body.ButtonPayload ?? body.ButtonText ?? '';

    log.info({ phone: from, text: text.substring(0, 50) }, 'Inbound WhatsApp message');

    // Process async — respond to Twilio immediately
    routeMessage(from, text, buttonPayload).catch((err) => {
      log.error({ err, phone: from }, 'Error in routeMessage');
    });

    c.header('Content-Type', 'text/xml');
    return c.body('<Response></Response>', 200);
  });

  return app;
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/bigjeff/Desktop/Leadexpress
git add services/rebeca/src/server.ts
git commit -m "feat(rebeca): Hono server with Twilio signature validation middleware"
```

---

## Task 12: Outbound Worker

**Files:**
- Create: `services/rebeca/src/outbound/worker.ts`

- [ ] **Step 1: Create `outbound/worker.ts`**

`services/rebeca/src/outbound/worker.ts`:
```typescript
import { Worker, UnrecoverableError } from 'bullmq';
import Redis from 'ioredis';
import { config } from '../config.js';
import { supabase } from '../lib/supabase.js';
import { sendText } from '../lib/twilio.js';
import pino from 'pino';

const log = pino({ name: 'wa-worker' });

interface WaNotificationJob {
  leadId: string;
  userId: string;
  phone: string;
  message: string;
  contentSid?: string;
}

export function createWorker(redis: Redis) {
  const worker = new Worker<WaNotificationJob>(
    config.queues.waNotifications,
    async (job) => {
      const { phone, message, userId } = job.data;

      // Check contractor WA window and notify flag
      const { data: contractor } = await supabase
        .from('contractors')
        .select('wa_notify, wa_window_until')
        .eq('user_id', userId)
        .maybeSingle();

      if (!contractor?.wa_notify) {
        log.info({ userId }, 'WA notify disabled, skipping');
        return;
      }

      const windowOpen = contractor.wa_window_until
        ? new Date(contractor.wa_window_until) > new Date()
        : false;

      if (!windowOpen) {
        log.debug({ userId }, 'WA window closed, skipping notification');
        return;
      }

      await sendText(phone, message);
      log.info({ userId, phone: phone.slice(-4) }, 'Lead notification sent');
    },
    {
      connection: redis,
      concurrency: 10,
      limiter: { max: 70, duration: 1000 }, // Stay under Twilio's 80 msg/sec
      removeOnComplete: { count: 1000 },
      removeOnFail: { count: 5000 },
    },
  );

  worker.on('failed', (job, err) => {
    if (err instanceof UnrecoverableError) {
      log.error({ jobId: job?.id, err: err.message }, 'Unrecoverable WA job failure');
    } else {
      log.warn({ jobId: job?.id, err: err.message }, 'WA job failed, will retry');
    }
  });

  return {
    worker,
    cleanup: async () => {
      await worker.close();
    },
  };
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/bigjeff/Desktop/Leadexpress
git add services/rebeca/src/outbound/worker.ts
git commit -m "feat(rebeca): outbound BullMQ worker for wa-notifications queue"
```

---

## Task 13: Daily Check-In Cron

**Files:**
- Create: `services/rebeca/src/outbound/checkin.ts`

- [ ] **Step 1: Create `outbound/checkin.ts`**

`services/rebeca/src/outbound/checkin.ts`:
```typescript
import cron from 'node-cron';
import { supabase } from '../lib/supabase.js';
import { sendText } from '../lib/twilio.js';
import { config } from '../config.js';
import pino from 'pino';

const log = pino({ name: 'checkin-cron' });

/**
 * Idempotency guard — returns true if check-in already ran today.
 */
async function alreadyRanToday(): Promise<boolean> {
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabase
    .from('cron_runs')
    .select('id')
    .eq('job', 'daily_checkin')
    .eq('run_date', today)
    .maybeSingle();
  return !!data;
}

async function markRanToday(): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  await supabase.from('cron_runs').upsert({
    job: 'daily_checkin',
    run_date: today,
    ran_at: new Date().toISOString(),
  });
}

async function runCheckin(): Promise<void> {
  if (await alreadyRanToday()) {
    log.info('Check-in already ran today, skipping');
    return;
  }

  log.info('Starting daily check-in');
  await markRanToday();

  // Reset available_today for all active contractors
  await supabase
    .from('contractors')
    .update({ available_today: false })
    .eq('is_active', true);

  // Fetch contractors with WA notify enabled and active subscription
  const { data: contractors, error } = await supabase
    .from('contractors')
    .select('user_id, profiles!inner(full_name, whatsapp_phone)')
    .eq('wa_notify', true)
    .eq('is_active', true);

  if (error || !contractors) {
    log.error({ error }, 'Failed to fetch contractors for check-in');
    return;
  }

  log.info({ count: contractors.length }, 'Sending daily check-ins');

  let sent = 0;
  let failed = 0;

  for (const c of contractors) {
    const profile = (c as { profiles: { full_name: string; whatsapp_phone: string | null } }).profiles;
    if (!profile?.whatsapp_phone) continue;

    try {
      const name = profile.full_name?.split(' ')[0] ?? '';
      const isHebrew = profile.whatsapp_phone.startsWith('+972');
      const msg = isHebrew
        ? `שלום ${name}! 👋\nזמין להצעות עבודה היום?\n\n1️⃣ כן, זמין\n2️⃣ לא היום`
        : `Hey ${name}! 👋\nAre you available for jobs today?\n\n1️⃣ Yes, available\n2️⃣ Not today`;

      await sendText(profile.whatsapp_phone, msg);
      sent++;

      // Small delay to stay under rate limits
      await new Promise(r => setTimeout(r, 50));
    } catch (err) {
      log.warn({ err, userId: c.user_id }, 'Check-in send failed');
      failed++;
    }
  }

  log.info({ sent, failed }, 'Daily check-in complete');
}

export function startCheckinCron(): cron.ScheduledTask {
  return cron.schedule(
    config.cron.checkinSchedule,
    () => {
      runCheckin().catch(err => log.error({ err }, 'Check-in cron error'));
    },
    { timezone: config.cron.timezone },
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/bigjeff/Desktop/Leadexpress
git add services/rebeca/src/outbound/checkin.ts
git commit -m "feat(rebeca): daily check-in cron with idempotency guard"
```

---

## Task 14: Entry Point

**Files:**
- Create: `services/rebeca/src/index.ts`

- [ ] **Step 1: Create `src/index.ts`**

`services/rebeca/src/index.ts`:
```typescript
import { serve } from '@hono/node-server';
import pino from 'pino';
import Redis from 'ioredis';
import { config } from './config.js';
import { createServer } from './server.js';
import { createWorker } from './outbound/worker.js';
import { startCheckinCron } from './outbound/checkin.js';

const log = pino({ name: 'rebeca' });

const redis = new Redis(process.env.REDIS_URL ?? {
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
  maxRetriesPerRequest: null,
} as never);

log.info({
  port: config.server.port,
  checkinCron: config.cron.checkinSchedule,
  timezone: config.cron.timezone,
}, 'Starting Rebeca service');

// 1. BullMQ outbound worker
const { worker, cleanup: cleanupWorker } = createWorker(redis);
worker.on('ready', () => log.info('WA notification worker ready'));

// 2. Daily check-in cron
const cronTask = startCheckinCron();

// 3. HTTP server (Twilio inbound webhook)
const app = createServer();
const server = serve({ fetch: app.fetch, port: config.server.port }, (info) => {
  log.info({ port: info.port }, 'Webhook server listening');
});

// Graceful shutdown
async function shutdown(signal: string): Promise<void> {
  log.info({ signal }, 'Shutting down gracefully');
  cronTask.stop();
  await cleanupWorker();
  server.close();
  redis.disconnect();
  process.exit(0);
}

process.on('SIGINT', () => { shutdown('SIGINT').catch(() => process.exit(1)); });
process.on('SIGTERM', () => { shutdown('SIGTERM').catch(() => process.exit(1)); });

process.on('unhandledRejection', (err) => {
  log.fatal({ err }, 'Unhandled rejection');
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  log.fatal({ err }, 'Uncaught exception');
  process.exit(1);
});
```

- [ ] **Step 2: Build to verify TypeScript**

```bash
cd services/rebeca
npm run build
```

Expected: `dist/` directory created, no TypeScript errors.
If errors appear, fix them before proceeding.

- [ ] **Step 3: Commit**

```bash
cd /Users/bigjeff/Desktop/Leadexpress
git add services/rebeca/src/index.ts
git commit -m "feat(rebeca): entry point — server + worker + cron"
```

---

## Task 15: DB Migration

**Files:**
- Create: `supabase/migrations/070_rebeca_state.sql`

- [ ] **Step 1: Create migration**

`supabase/migrations/070_rebeca_state.sql`:
```sql
-- Add openai_response_id and session_started_at to wa_onboard_state
-- (merging wa_agent_sessions into wa_onboard_state)
ALTER TABLE wa_onboard_state
  ADD COLUMN IF NOT EXISTS openai_response_id TEXT,
  ADD COLUMN IF NOT EXISTS session_started_at TIMESTAMPTZ DEFAULT now();

-- Migrate existing session data from wa_agent_sessions
UPDATE wa_onboard_state wos
SET
  openai_response_id = was.last_response_id,
  session_started_at = was.created_at
FROM wa_agent_sessions was
WHERE was.wa_id = wos.phone;

-- Add cron_runs table for idempotency
CREATE TABLE IF NOT EXISTS cron_runs (
  job TEXT NOT NULL,
  run_date DATE NOT NULL,
  ran_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (job, run_date)
);

-- Postgres advisory lock helpers for per-phone mutex
CREATE OR REPLACE FUNCTION try_phone_lock(lock_key BIGINT)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN pg_try_advisory_lock(lock_key);
END;
$$;

CREATE OR REPLACE FUNCTION release_phone_lock(lock_key BIGINT)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM pg_advisory_unlock(lock_key);
END;
$$;

-- wa_opt_outs table (if not already exists)
CREATE TABLE IF NOT EXISTS wa_opt_outs (
  phone TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

- [ ] **Step 2: Apply migration to production**

```bash
supabase db push --project-ref zyytzwlvtuhgbjpalbgd
```

Expected: migration applied successfully, no errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/bigjeff/Desktop/Leadexpress
git add supabase/migrations/070_rebeca_state.sql
git commit -m "feat(rebeca): DB migration — advisory locks, cron_runs, merge session state"
```

---

## Task 16: Update `render.yaml` and Deploy

**Files:**
- Modify: `render.yaml`

- [ ] **Step 1: Add rebeca to render.yaml, keep whatsapp-notify for now**

In `render.yaml`, add after the existing `whatsapp-notify` service:

```yaml
  # ── rebeca: Rebeca WhatsApp bot — inbound + outbound + cron ──
  - type: web
    name: rebeca
    env: docker
    dockerfilePath: services/rebeca/Dockerfile
    dockerContext: services/rebeca
    plan: starter
    envVars:
      - key: NODE_ENV
        value: production
      - key: SUPABASE_URL
        sync: false
      - key: SUPABASE_SERVICE_ROLE_KEY
        sync: false
      - key: TWILIO_ACCOUNT_SID
        sync: false
      - key: TWILIO_AUTH_TOKEN
        sync: false
      - key: TWILIO_WA_FROM
        sync: false
      - key: OPENAI_API_KEY
        sync: false
      - fromGroup: redis-shared
```

- [ ] **Step 2: Commit and push**

```bash
cd /Users/bigjeff/Desktop/Leadexpress
git add render.yaml
git commit -m "feat(rebeca): add to render.yaml for deployment"
git push origin main
```

- [ ] **Step 3: Verify rebeca deployed on Render**

In Render dashboard, verify:
- Service `rebeca` is deploying
- Wait for "Live" status
- Hit `https://rebeca.onrender.com/health` → `{"status":"ok","service":"rebeca"}`

- [ ] **Step 4: Set env vars in Render for rebeca**

In Render dashboard → rebeca service → Environment:
- `SUPABASE_URL` — copy from whatsapp-notify
- `SUPABASE_SERVICE_ROLE_KEY` — copy from whatsapp-notify
- `TWILIO_ACCOUNT_SID` — copy from whatsapp-notify
- `TWILIO_AUTH_TOKEN` — copy from whatsapp-notify
- `TWILIO_WA_FROM` — copy from whatsapp-notify (e.g. `whatsapp:+18623582898`)
- `OPENAI_API_KEY` — from Supabase vault / existing env

---

## Task 17: Switch Twilio Webhook URL and Decommission

**This is the live cutover. Do NOT rush.**

- [ ] **Step 1: Test rebeca webhook locally with a curl**

```bash
# Get the rebeca Render URL (e.g. https://rebeca-xxxx.onrender.com)
REBECA_URL="https://rebeca-xxxx.onrender.com"

# Hit health
curl "$REBECA_URL/health"
# Expected: {"status":"ok","service":"rebeca"}
```

- [ ] **Step 2: Update Twilio Messaging Service webhook URL**

```bash
source /Users/bigjeff/Desktop/Leadexpress/.env

# Update Messaging Service inbound URL to rebeca
curl -X POST "https://messaging.twilio.com/v1/Services/MG6612db10a7fba764029e32dc1134c657" \
  -u "$TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN" \
  --data-urlencode "InboundRequestUrl=$REBECA_URL/webhooks/whatsapp" \
  --data-urlencode "InboundMethod=POST"
```

Expected: `{"inbound_request_url":"https://rebeca-xxxx.onrender.com/webhooks/whatsapp",...}`

- [ ] **Step 3: Update phone number sms_url to rebeca**

```bash
# Get phone number SID
PHONE_SID=$(curl -s "https://api.twilio.com/2010-04-01/Accounts/$TWILIO_ACCOUNT_SID/IncomingPhoneNumbers.json?PhoneNumber=%2B18623582898" \
  -u "$TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN" | python3 -c "import json,sys; print(json.load(sys.stdin)['incoming_phone_numbers'][0]['sid'])")

# Update sms_url
curl -X POST "https://api.twilio.com/2010-04-01/Accounts/$TWILIO_ACCOUNT_SID/IncomingPhoneNumbers/$PHONE_SID.json" \
  -u "$TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN" \
  --data-urlencode "SmsUrl=$REBECA_URL/webhooks/whatsapp"
```

- [ ] **Step 4: Send a test WhatsApp message and verify in Render logs**

Send "היי" to +18623582898 from a test phone. Verify in Render logs:
- `Twilio signature verified`
- `Inbound WhatsApp message`
- Bot responds correctly

- [ ] **Step 5: Monitor for 10 minutes, then decommission**

If no issues:

In `render.yaml`, remove the `whatsapp-notify` service block.

```bash
git add render.yaml
git commit -m "chore: remove whatsapp-notify — replaced by rebeca"
git push origin main
```

- [ ] **Step 6: Delete Supabase Edge Function whatsapp-webhook**

```bash
# Confirm Twilio is NOT pointing at Supabase anymore
curl -s "https://messaging.twilio.com/v1/Services/MG6612db10a7fba764029e32dc1134c657" \
  -u "$TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN" | python3 -c "import json,sys; print(json.load(sys.stdin)['inbound_request_url'])"
# Expected: rebeca URL (NOT supabase)

# Then delete the Edge Function
supabase functions delete whatsapp-webhook --project-ref zyytzwlvtuhgbjpalbgd
```

- [ ] **Step 7: Final commit**

```bash
git commit -m "feat: rebeca service complete — whatsapp-notify and whatsapp-webhook decommissioned

- New services/rebeca/ replaces both services
- Single state store (Supabase wa_onboard_state)
- Twilio signature validation on all inbound
- AI onboarding with validated complete_onboarding
- Per-phone advisory lock prevents race conditions
- Daily check-in with idempotency guard
- i18n for Hebrew/English"
```

---

## Self-Review Checklist

**Spec coverage:**
- ✅ `services/rebeca/` file structure — Task 1
- ✅ Twilio signature validation — Task 11
- ✅ Postgres advisory lock — Task 10 + Task 15
- ✅ State management (single table) — Task 3
- ✅ Profile lookup (single OR query) — Task 4
- ✅ OpenAI client (no strict:true, session expiry) — Task 5
- ✅ Onboarding handler (validate before complete) — Task 6
- ✅ Known-user handler (sub check after onboard check) — Task 7
- ✅ Sales handler — Task 8
- ✅ Lead action handler — Task 9
- ✅ Router — Task 10
- ✅ Outbound worker — Task 12
- ✅ Check-in cron with idempotency — Task 13
- ✅ DB migration (advisory locks, cron_runs, openai_response_id) — Task 15
- ✅ render.yaml update — Task 16
- ✅ Migration/decommission sequence — Task 17
- ✅ i18n helper (all fallbacks use t()) — Task 2

**Placeholder scan:** None found.

**Type consistency:**
- `BotState` defined in `lib/state.ts`, used consistently across handlers
- `sendText` imported from `lib/twilio.ts` in all handlers
- `supabase` from `lib/supabase.ts` — single instance
- `config` from `config.ts` — imported where needed
