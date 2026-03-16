# WhatsApp-First Registration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable contractors to register entirely through WhatsApp — 4 questions + name + email → account created → leads start flowing.

**Architecture:** New `registration.ts` handler in whatsapp-notify service. Reuses existing helpers (sendText, city-zips, parseSelections). Rewires webhook.ts to route unknown phones to registration instead of ignoring. DB migration adds 'trialing' status, unique phone constraints, and opt-out table.

**Tech Stack:** TypeScript, Hono, Redis (ioredis), Supabase (admin API via service key), Twilio WhatsApp

**Design doc:** `docs/plans/2026-03-16-whatsapp-registration-design.md`

---

## Task 1: Database Migration — Registration Prerequisites

**Files:**
- Create: `supabase/migrations/009_wa_registration.sql`

**Step 1: Write the migration**

```sql
-- 009_wa_registration.sql
-- Prerequisites for WhatsApp-first contractor registration

-- 1. Add 'trialing' to subscription status CHECK
ALTER TABLE public.subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_status_check;
ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_status_check
  CHECK (status IN ('active', 'past_due', 'canceled', 'paused', 'trialing'));

-- 2. Unique constraint on whatsapp_phone (prevent duplicate WA registrations)
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_whatsapp_phone_unique
  UNIQUE (whatsapp_phone);

-- 3. Unique index on phone where not null
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_phone_unique
  ON public.profiles (phone)
  WHERE phone IS NOT NULL;

-- 4. Opt-out tracking table (TCPA/WhatsApp compliance)
CREATE TABLE IF NOT EXISTS public.wa_opt_outs (
  phone        TEXT PRIMARY KEY,
  opted_out_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.wa_opt_outs ENABLE ROW LEVEL SECURITY;

CREATE POLICY wa_opt_outs_admin ON public.wa_opt_outs
  FOR ALL USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );
```

**Step 2: Apply the migration locally**

Run: `npx supabase migration up` (or apply via Supabase dashboard)
Expected: Migration applies without errors.

**Step 3: Verify constraints**

Run against local Supabase SQL editor:
```sql
-- Should succeed:
INSERT INTO public.subscriptions (user_id, plan_id, status, stripe_customer_id, current_period_end)
VALUES ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000000', 'trialing', '', now() + interval '7 days');

-- Should fail (duplicate phone):
-- Test only if you have test data
```

**Step 4: Commit**

```bash
git add supabase/migrations/009_wa_registration.sql
git commit -m "feat: migration 009 — add trialing status, unique phone constraints, opt-out table"
```

---

## Task 2: Registration State & Helpers

**Files:**
- Create: `services/whatsapp-notify/src/handlers/registration.ts`

**Step 1: Create the registration state interface and Redis helpers**

```typescript
// services/whatsapp-notify/src/handlers/registration.ts

import type Redis from 'ioredis';
import type { Logger } from 'pino';

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

const REGISTER_PREFIX = 'le:wa-register:';
const REGISTER_TTL = 3600; // 1 hour
const LOCK_PREFIX = 'le:wa-lock:';
const LOCK_TTL = 30; // 30 seconds

export type RegistrationStep =
  | 'profession'
  | 'state_select'
  | 'city'
  | 'name'
  | 'email'
  | 'confirm';

export interface WaRegistrationState {
  phone: string;
  step: RegistrationStep;
  professions: string[];
  stateName: string;
  cities: string[];
  zipCodes: string[];
  fullName: string;
  email: string;
}

// ---------------------------------------------------------------------------
// Redis helpers
// ---------------------------------------------------------------------------

export async function getRegistrationState(
  redis: Redis,
  phone: string,
): Promise<WaRegistrationState | null> {
  const raw = await redis.get(`${REGISTER_PREFIX}${phone}`);
  if (!raw) return null;
  return JSON.parse(raw) as WaRegistrationState;
}

export async function setRegistrationState(
  redis: Redis,
  phone: string,
  state: WaRegistrationState,
): Promise<void> {
  await redis.set(`${REGISTER_PREFIX}${phone}`, JSON.stringify(state), 'EX', REGISTER_TTL);
}

export async function clearRegistrationState(
  redis: Redis,
  phone: string,
): Promise<void> {
  await redis.del(`${REGISTER_PREFIX}${phone}`);
}

export async function acquireLock(redis: Redis, phone: string): Promise<boolean> {
  const result = await redis.set(`${LOCK_PREFIX}${phone}`, '1', 'EX', LOCK_TTL, 'NX');
  return result === 'OK';
}

export async function releaseLock(redis: Redis, phone: string): Promise<void> {
  await redis.del(`${LOCK_PREFIX}${phone}`);
}
```

**Step 2: Verify it compiles**

Run: `cd services/whatsapp-notify && npx tsc --noEmit`
Expected: No errors.

**Step 3: Commit**

```bash
git add services/whatsapp-notify/src/handlers/registration.ts
git commit -m "feat: registration state interface and Redis helpers"
```

---

## Task 3: Rate Limiting & Opt-Out Helpers

**Files:**
- Modify: `services/whatsapp-notify/src/handlers/registration.ts`

**Step 1: Add rate limiting and opt-out functions**

Append to `registration.ts`:

```typescript
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config.js';

const supabase: SupabaseClient = createClient(config.supabase.url, config.supabase.serviceKey);

// ---------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------

const RATE_LIMIT_KEY = 'le:wa-register-count';
const RATE_LIMIT_MAX = 50; // per hour
const RATE_LIMIT_WINDOW = 3600;

export async function checkRateLimit(redis: Redis): Promise<boolean> {
  const count = await redis.incr(RATE_LIMIT_KEY);
  if (count === 1) {
    await redis.expire(RATE_LIMIT_KEY, RATE_LIMIT_WINDOW);
  }
  return count <= RATE_LIMIT_MAX;
}

// ---------------------------------------------------------------------------
// Opt-out
// ---------------------------------------------------------------------------

export async function isOptedOut(phone: string): Promise<boolean> {
  const { data } = await supabase
    .from('wa_opt_outs')
    .select('phone')
    .eq('phone', phone)
    .maybeSingle();
  return !!data;
}

export async function recordOptOut(phone: string): Promise<void> {
  await supabase
    .from('wa_opt_outs')
    .upsert({ phone, opted_out_at: new Date().toISOString() });
}

// ---------------------------------------------------------------------------
// Email validation
// ---------------------------------------------------------------------------

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email.trim().toLowerCase());
}

export async function isEmailTaken(email: string): Promise<boolean> {
  // Use admin API to check if email exists in auth.users
  const { data } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1 });
  // More efficient: query directly
  const { data: users, error } = await supabase.auth.admin.listUsers();
  if (error || !users) return false;
  return users.users.some((u) => u.email === email.trim().toLowerCase());
}
```

**Step 2: Refactor isEmailTaken to be efficient**

The `listUsers` approach doesn't scale. Use a direct query instead:

```typescript
export async function isEmailTaken(email: string): Promise<boolean> {
  // profiles.id references auth.users.id, and auth triggers set email
  // Use the Supabase admin getUserByEmail (not available), so query auth.users via RPC
  // Simplest: try to create and see if it fails, OR use a dedicated RPC function
  // For now: use admin.listUsers with filter — Supabase doesn't support email filter natively
  // Best approach: just try createUser and handle the "already registered" error
  // We'll handle this in the account creation step instead
  return false; // placeholder — duplicate check happens at createUser time
}
```

Actually, the cleanest approach is to catch the duplicate error at `createUser()` time (Task 5). Remove `isEmailTaken` and handle it there. Replace with a simpler approach:

```typescript
// Email duplicate check happens at createUser() time (Task 5).
// If email exists, createUser returns an error we handle gracefully.
```

**Step 3: Verify compilation**

Run: `cd services/whatsapp-notify && npx tsc --noEmit`
Expected: No errors.

**Step 4: Commit**

```bash
git add services/whatsapp-notify/src/handlers/registration.ts
git commit -m "feat: rate limiting, opt-out, and email validation helpers"
```

---

## Task 4: Registration Step Handlers

**Files:**
- Modify: `services/whatsapp-notify/src/handlers/registration.ts`

**Step 1: Add the step handlers — profession + state selection**

Append to `registration.ts`:

```typescript
import { sendText } from '../interactive.js';
import { PROFESSIONS } from './onboarding.js';
import { getCitiesByState, getAllZipsForCities } from '../city-zips.js';

// Re-use parseSelections from onboarding
function parseSelections(text: string, options: readonly { key: string; label: string }[]): string[] {
  const trimmed = text.trim().toLowerCase();
  const numbers = trimmed.match(/\d+/g)?.map(Number) ?? [];
  if (numbers.length > 0) {
    return numbers
      .filter((n) => n >= 1 && n <= options.length)
      .map((n) => options[n - 1].key);
  }
  const words = trimmed.split(/[,\s]+/).filter(Boolean);
  const matched = words
    .map((w) => options.find((o) => o.key.includes(w) || o.label.toLowerCase().includes(w)))
    .filter(Boolean)
    .map((o) => o!.key);
  return [...new Set(matched)];
}

// ---------------------------------------------------------------------------
// Start registration (entry point for unknown phones)
// ---------------------------------------------------------------------------

export async function startRegistration(
  phone: string,
  redis: Redis,
  log: Logger,
): Promise<void> {
  // Check opt-out
  if (await isOptedOut(phone)) {
    log.info({ phone }, 'Phone is opted out — ignoring');
    return;
  }

  // Check rate limit
  if (!(await checkRateLimit(redis))) {
    await sendText(phone, `We're experiencing high demand. Please try again in a few minutes.`, log);
    return;
  }

  const state: WaRegistrationState = {
    phone,
    step: 'profession',
    professions: [],
    stateName: '',
    cities: [],
    zipCodes: [],
    fullName: '',
    email: '',
  };
  await setRegistrationState(redis, phone, state);

  const profList = PROFESSIONS.map((p, i) => `${i + 1}️⃣ ${p.emoji} ${p.label}`).join('\n');

  await sendText(
    phone,
    `Welcome to LeadExpress! 🔧\n\n4 quick questions and you'll start getting filtered leads straight to WhatsApp.\n\nWhat type of work do you do?\n${profList}\n\nReply with numbers. Example: *1, 6*`,
    log,
  );
}

// ---------------------------------------------------------------------------
// Handle registration step (dispatcher)
// ---------------------------------------------------------------------------

export async function handleRegistrationStep(
  phone: string,
  text: string,
  redis: Redis,
  log: Logger,
): Promise<boolean> {
  const state = await getRegistrationState(redis, phone);
  if (!state) return false;

  const trimmed = text.trim().toLowerCase();

  // Global commands
  if (trimmed === 'stop' || trimmed === 'unsubscribe' || trimmed === 'cancel') {
    await clearRegistrationState(redis, phone);
    await recordOptOut(phone);
    await sendText(phone, `You've been unsubscribed. You won't receive any more messages from us.`, log);
    return true;
  }

  if (trimmed === 'redo' || trimmed === 'start over') {
    await clearRegistrationState(redis, phone);
    await startRegistration(phone, redis, log);
    return true;
  }

  if (trimmed === 'menu' || trimmed === 'help') {
    const stepNum = stepNumber(state.step);
    await sendText(
      phone,
      `You're on step ${stepNum}/4.\nSend *CONTINUE* to resume or *REDO* to restart.`,
      log,
    );
    return true;
  }

  switch (state.step) {
    case 'profession':
      await handleProfessionStep(phone, text, state, redis, log);
      return true;
    case 'state_select':
      await handleStateSelectStep(phone, text, state, redis, log);
      return true;
    case 'city':
      await handleCityStep(phone, text, state, redis, log);
      return true;
    case 'name':
      await handleNameStep(phone, text, state, redis, log);
      return true;
    case 'email':
      await handleEmailStep(phone, text, state, redis, log);
      return true;
    case 'confirm':
      await handleConfirmStep(phone, text, state, redis, log);
      return true;
    default:
      return false;
  }
}

function stepNumber(step: RegistrationStep): number {
  const map: Record<RegistrationStep, number> = {
    profession: 1, state_select: 1, city: 2, name: 3, email: 4, confirm: 4,
  };
  return map[step];
}

// ---------------------------------------------------------------------------
// Step 1a: Profession selection
// ---------------------------------------------------------------------------

async function handleProfessionStep(
  phone: string,
  text: string,
  state: WaRegistrationState,
  redis: Redis,
  log: Logger,
): Promise<void> {
  const selected = parseSelections(text, PROFESSIONS);

  if (selected.length === 0) {
    await sendText(
      phone,
      `Reply with numbers (1-8) separated by commas.\nExample: *1, 6* for HVAC and Plumbing`,
      log,
    );
    return;
  }

  state.professions = selected;
  state.step = 'state_select';
  await setRegistrationState(redis, phone, state);

  const selectedLabels = selected
    .map((key) => {
      const p = PROFESSIONS.find((pr) => pr.key === key);
      return p ? `${p.emoji} ${p.label}` : key;
    })
    .join(', ');

  await sendText(
    phone,
    `${selectedLabels} — great!\n\nWhich state do you work in?\n1️⃣ 🌴 Florida\n2️⃣ 🗽 New York\n3️⃣ 🤠 Texas`,
    log,
  );
}

// ---------------------------------------------------------------------------
// Step 1b: State selection (sub-step of step 1)
// ---------------------------------------------------------------------------

async function handleStateSelectStep(
  phone: string,
  text: string,
  state: WaRegistrationState,
  redis: Redis,
  log: Logger,
): Promise<void> {
  const trimmed = text.trim().toLowerCase();
  const stateMap: Record<string, string> = {
    '1': 'FL', 'fl': 'FL', 'florida': 'FL',
    '2': 'NY', 'ny': 'NY', 'new york': 'NY',
    '3': 'TX', 'tx': 'TX', 'texas': 'TX',
  };
  const selectedState = stateMap[trimmed];

  if (!selectedState) {
    await sendText(phone, `Reply *1* for Florida, *2* for New York, or *3* for Texas.`, log);
    return;
  }

  state.stateName = selectedState;
  state.step = 'city';
  await setRegistrationState(redis, phone, state);

  const cities = getCitiesByState(selectedState);
  const cityList = cities.map((c, i) => `${i + 1}️⃣ ${c.label}`).join('\n');

  await sendText(
    phone,
    `*${selectedState}* — select your service cities.\nReply with numbers separated by commas:\n\n${cityList}\n\nExample: *1, 3, 5*`,
    log,
  );
}

// ---------------------------------------------------------------------------
// Step 2: City selection
// ---------------------------------------------------------------------------

async function handleCityStep(
  phone: string,
  text: string,
  state: WaRegistrationState,
  redis: Redis,
  log: Logger,
): Promise<void> {
  const cities = getCitiesByState(state.stateName);
  const numbers = text.match(/\d+/g)?.map(Number) ?? [];
  const validNumbers = numbers.filter((n) => n >= 1 && n <= cities.length);

  if (validNumbers.length === 0) {
    await sendText(phone, `Reply with city numbers (1-${cities.length}) separated by commas.`, log);
    return;
  }

  const selectedCityKeys = validNumbers.map((n) => cities[n - 1].id);
  const selectedCityLabels = validNumbers.map((n) => cities[n - 1].label);
  const zips = getAllZipsForCities(state.stateName, selectedCityKeys);

  state.cities = selectedCityKeys;
  state.zipCodes = zips;
  state.step = 'name';
  await setRegistrationState(redis, phone, state);

  await sendText(
    phone,
    `${selectedCityLabels.join(', ')} (${zips.length} ZIP codes) ✅\n\nAlmost done! What's your full name?`,
    log,
  );
}

// ---------------------------------------------------------------------------
// Step 3: Name
// ---------------------------------------------------------------------------

async function handleNameStep(
  phone: string,
  text: string,
  state: WaRegistrationState,
  redis: Redis,
  log: Logger,
): Promise<void> {
  const name = text.trim();

  if (name.length < 2 || name.length > 100) {
    await sendText(phone, `Please enter your full name (2-100 characters).`, log);
    return;
  }

  state.fullName = name;
  state.step = 'email';
  await setRegistrationState(redis, phone, state);

  await sendText(
    phone,
    `Thanks, ${name}! 👋\n\nLast one — what's your email?\n(We'll send you a dashboard login link)`,
    log,
  );
}

// ---------------------------------------------------------------------------
// Step 4: Email
// ---------------------------------------------------------------------------

async function handleEmailStep(
  phone: string,
  text: string,
  state: WaRegistrationState,
  redis: Redis,
  log: Logger,
): Promise<void> {
  const email = text.trim().toLowerCase();

  if (!isValidEmail(email)) {
    await sendText(
      phone,
      `That doesn't look right. Please send your email (e.g. name@gmail.com)`,
      log,
    );
    return;
  }

  state.email = email;
  state.step = 'confirm';
  await setRegistrationState(redis, phone, state);

  const profLabels = state.professions
    .map((key) => {
      const p = PROFESSIONS.find((pr) => pr.key === key);
      return p ? `${p.emoji} ${p.label}` : key;
    })
    .join(', ');

  const cityLabels = state.cities.length > 3
    ? `${state.cities.length} cities`
    : state.cities.join(', ');

  await sendText(
    phone,
    `*Your profile:*\n\n👤 ${state.fullName} (${state.email})\n🔧 ${profLabels}\n📍 ${cityLabels} (${state.zipCodes.length} ZIPs)\n📅 Mon-Fri\n\nReply *YES* to confirm or *REDO* to start over.`,
    log,
  );
}
```

**Step 2: Verify compilation**

Run: `cd services/whatsapp-notify && npx tsc --noEmit`
Expected: No errors.

**Step 3: Commit**

```bash
git add services/whatsapp-notify/src/handlers/registration.ts
git commit -m "feat: registration step handlers — profession, state, city, name, email"
```

---

## Task 5: Account Creation (Confirm Step)

**Files:**
- Modify: `services/whatsapp-notify/src/handlers/registration.ts`

**Step 1: Add the confirm step with account creation**

Append to `registration.ts`:

```typescript
// ---------------------------------------------------------------------------
// Confirm & Create Account
// ---------------------------------------------------------------------------

function isPositive(text: string): boolean {
  const positiveWords = ['yes', 'y', 'yeah', 'yep', 'ok', 'sure', 'confirm', 'כן', '1', '👍'];
  return positiveWords.some((w) => text.includes(w));
}

async function handleConfirmStep(
  phone: string,
  text: string,
  state: WaRegistrationState,
  redis: Redis,
  log: Logger,
): Promise<void> {
  const trimmed = text.trim().toLowerCase();

  if (trimmed === 'redo' || trimmed === 'no' || trimmed === 'start over') {
    await clearRegistrationState(redis, phone);
    await startRegistration(phone, redis, log);
    return;
  }

  if (!isPositive(trimmed)) {
    await sendText(phone, `Reply *YES* to confirm or *REDO* to start over.`, log);
    return;
  }

  log.info({ phone, email: state.email, name: state.fullName }, 'Creating account from WhatsApp registration');

  try {
    // 1. Create auth user (triggers handle_new_user → creates profile)
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: state.email,
      email_confirm: true,
      user_metadata: { full_name: state.fullName },
    });

    if (authError) {
      if (authError.message?.includes('already been registered') || authError.message?.includes('already exists')) {
        await sendText(
          phone,
          `This email already has an account.\nTry a different email, or visit leadexpress.com to log in.\n\nSend *REDO* to start over.`,
          log,
        );
        state.step = 'email';
        state.email = '';
        await setRegistrationState(redis, phone, state);
        return;
      }
      throw authError;
    }

    const userId = authData.user.id;

    // 2. Update profile with phone numbers (trigger already created the profile row)
    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        phone,
        whatsapp_phone: phone,
      })
      .eq('id', userId);

    if (profileError) {
      log.error({ profileError, userId }, 'Failed to update profile with phone');
      // Non-fatal — continue
    }

    // 3. Create contractor record
    const { error: contractorError } = await supabase.from('contractors').insert({
      user_id: userId,
      professions: state.professions,
      zip_codes: state.zipCodes,
      working_days: [1, 2, 3, 4, 5], // Mon-Fri default
      is_active: true,
      wa_notify: true,
    });

    if (contractorError) {
      log.error({ contractorError, userId }, 'Failed to create contractor');
      throw contractorError;
    }

    // 4. Create trial subscription (find starter plan first)
    const { data: starterPlan } = await supabase
      .from('plans')
      .select('id')
      .eq('slug', 'starter')
      .eq('is_active', true)
      .single();

    if (starterPlan) {
      const trialEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      await supabase.from('subscriptions').insert({
        user_id: userId,
        plan_id: starterPlan.id,
        status: 'trialing',
        stripe_customer_id: '',
        current_period_end: trialEnd,
      });
    }

    // 5. Generate magic link
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: state.email,
    });

    let magicLinkMessage = '';
    if (linkData?.properties?.action_link && !linkError) {
      magicLinkMessage = `\n\n📧 Dashboard login link sent to ${state.email}`;
      // Note: generateLink returns the link but doesn't email it.
      // We send it directly via WhatsApp for convenience.
      await sendText(
        phone,
        `📧 Your dashboard login:\n${linkData.properties.action_link}\n\nBookmark this or check your email.`,
        log,
      );
    }

    // 6. Clear registration state
    await clearRegistrationState(redis, phone);

    // 7. Send success message
    await sendText(
      phone,
      `✅ *All set, ${state.fullName}!*\n\nYou'll start receiving matching leads right here on WhatsApp.${magicLinkMessage}\n\nSend *MENU* anytime for options.`,
      log,
    );

    log.info(
      { userId, phone, email: state.email, professions: state.professions, zipCount: state.zipCodes.length },
      'WhatsApp registration complete',
    );
  } catch (err) {
    log.error({ err, phone, email: state.email }, 'Registration failed');
    await sendText(
      phone,
      `Something went wrong. Please send *YES* to try again, or visit leadexpress.com to register.`,
      log,
    );
    // Keep state in Redis so they can retry
  }
}
```

**Step 2: Verify compilation**

Run: `cd services/whatsapp-notify && npx tsc --noEmit`
Expected: No errors.

**Step 3: Commit**

```bash
git add services/whatsapp-notify/src/handlers/registration.ts
git commit -m "feat: account creation on confirm — auth user, profile, contractor, trial subscription, magic link"
```

---

## Task 6: Rewire Webhook Router

**Files:**
- Modify: `services/whatsapp-notify/src/webhook.ts` (full rewrite of processIncoming)
- Modify: `services/whatsapp-notify/src/index.ts` (pass Redis to webhook)

**Step 1: Update index.ts to create Redis client and pass to webhook**

In `services/whatsapp-notify/src/index.ts`, add Redis import and pass to webhook:

```typescript
// Add at top:
import Redis from 'ioredis';

// After line 8 (const log = ...):
const redis = new Redis({
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
  maxRetriesPerRequest: config.redis.maxRetriesPerRequest,
});

// Change line 29:
// FROM: const app = createWebhookApp(log);
// TO:
const app = createWebhookApp(log, redis);
```

Also add redis to graceful shutdown:

```typescript
// In shutdown function, add before process.exit:
redis.disconnect();
```

**Step 2: Rewrite webhook.ts with full routing**

Replace `services/whatsapp-notify/src/webhook.ts` entirely:

```typescript
import { Hono } from 'hono';
import { createClient } from '@supabase/supabase-js';
import type { Logger } from 'pino';
import type Redis from 'ioredis';
import { config } from './config.js';
import {
  getRegistrationState,
  handleRegistrationStep,
  startRegistration,
  acquireLock,
  releaseLock,
  isOptedOut,
} from './handlers/registration.js';
import {
  getOnboardState,
  handleOnboardingStep,
  handleFirstContact,
} from './handlers/onboarding.js';
import { sendText } from './interactive.js';

const supabase = createClient(config.supabase.url, config.supabase.serviceKey);

export function createWebhookApp(log: Logger, redis: Redis): Hono {
  const app = new Hono();

  app.get('/health', (c) => c.json({ status: 'ok', service: 'whatsapp-notify' }));

  app.post('/webhooks/whatsapp', async (c) => {
    const body = await c.req.parseBody();
    const from = (body.From as string) ?? '';
    const text = (body.Body as string) ?? '';
    const messageSid = (body.MessageSid as string) ?? '';
    const phone = from.replace('whatsapp:', '');

    log.info({ phone, text: text.substring(0, 50), messageSid }, 'Received WhatsApp message');

    processIncoming(phone, text.trim(), redis, log).catch((err) => {
      log.error({ err }, 'Error processing incoming WhatsApp');
    });

    c.header('Content-Type', 'text/xml');
    return c.body('<Response></Response>', 200);
  });

  return app;
}

async function processIncoming(
  phone: string,
  text: string,
  redis: Redis,
  log: Logger,
): Promise<void> {
  // 1. Acquire per-phone lock (prevent race conditions)
  if (!(await acquireLock(redis, phone))) {
    log.debug({ phone }, 'Phone locked — skipping concurrent message');
    return;
  }

  try {
    // 2. Check registration in progress
    const regState = await getRegistrationState(redis, phone);
    if (regState) {
      await handleRegistrationStep(phone, text, redis, log);
      return;
    }

    // 3. Check onboarding in progress
    const onboardState = await getOnboardState(redis, phone);
    if (onboardState) {
      await handleOnboardingStep(phone, text, redis, log);
      return;
    }

    // 4. Check if known user (by whatsapp_phone)
    const { data: waProfile } = await supabase
      .from('profiles')
      .select('id, full_name, whatsapp_phone')
      .eq('whatsapp_phone', phone)
      .maybeSingle();

    if (waProfile) {
      await handleKnownUser(phone, text, waProfile, redis, log);
      return;
    }

    // 5. Check if known user (by phone)
    const { data: phoneProfile } = await supabase
      .from('profiles')
      .select('id, full_name, phone, whatsapp_phone')
      .eq('phone', phone)
      .maybeSingle();

    if (phoneProfile) {
      await handleFirstContact(phone, log, redis);
      return;
    }

    // 6. Check opt-out
    if (await isOptedOut(phone)) {
      log.info({ phone }, 'Opted-out phone — ignoring');
      return;
    }

    // 7. Unknown phone — start registration!
    log.info({ phone }, 'New phone — starting WhatsApp registration');
    await startRegistration(phone, redis, log);
  } finally {
    await releaseLock(redis, phone);
  }
}

async function handleKnownUser(
  phone: string,
  text: string,
  profile: { id: string; full_name: string },
  redis: Redis,
  log: Logger,
): Promise<void> {
  const trimmed = text.trim().toLowerCase();

  // Check for daily check-in positive response
  if (isPositiveResponse(trimmed)) {
    await markContractorAvailable(phone, profile.id, log);
    return;
  }

  // Handle MENU command
  if (trimmed === 'menu' || trimmed === 'help') {
    await sendText(
      phone,
      `*LeadExpress Menu*\n\n1️⃣ STATUS — Check your account\n2️⃣ PROFILE — Update professions & areas\n3️⃣ STOP — Unsubscribe\n\nReply with a keyword.`,
      log,
    );
    return;
  }

  // Handle STOP
  if (trimmed === 'stop' || trimmed === 'unsubscribe') {
    await recordOptOut(phone);
    await sendText(phone, `You've been unsubscribed. You won't receive any more messages from us.`, log);
    return;
  }

  log.debug({ phone, text: trimmed }, 'Unrecognized message from known user');
}

function isPositiveResponse(text: string): boolean {
  const positiveWords = [
    'כן', 'yes', 'yeah', 'yep', 'y', 'ok', 'אוקי',
    'זמין', 'available', 'sure', 'בטח', 'כמובן',
    '1', '👍', 'yea', 'ya', 'ken', 'betach',
  ];
  return positiveWords.some((word) => text.includes(word));
}

async function markContractorAvailable(
  phone: string,
  userId: string,
  log: Logger,
): Promise<void> {
  const windowUntil = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const { error } = await supabase
    .from('contractors')
    .update({ available_today: true, wa_window_until: windowUntil })
    .eq('user_id', userId);

  if (error) {
    log.error({ error, userId }, 'Failed to mark contractor available');
    return;
  }
  log.info({ userId, phone, windowUntil }, 'Contractor marked available — 24h window open');
}

// Import recordOptOut from registration
import { recordOptOut } from './handlers/registration.js';
```

**Step 3: Verify compilation**

Run: `cd services/whatsapp-notify && npx tsc --noEmit`
Expected: No errors.

**Step 4: Commit**

```bash
git add services/whatsapp-notify/src/webhook.ts services/whatsapp-notify/src/index.ts
git commit -m "feat: rewire webhook router — registration, onboarding, known user, opt-out"
```

---

## Task 7: Update Shared Types

**Files:**
- Modify: `packages/shared/src/types.ts`

**Step 1: Add 'trialing' to SubscriptionStatus**

In `packages/shared/src/types.ts`, find the `SubscriptionStatus` type and add 'trialing':

```typescript
// FROM:
export type SubscriptionStatus = 'active' | 'past_due' | 'canceled' | 'paused';

// TO:
export type SubscriptionStatus = 'active' | 'past_due' | 'canceled' | 'paused' | 'trialing';
```

**Step 2: Verify compilation**

Run: `cd packages/shared && npx tsc --noEmit`
Expected: No errors.

**Step 3: Commit**

```bash
git add packages/shared/src/types.ts
git commit -m "feat: add trialing to SubscriptionStatus type"
```

---

## Task 8: Export Registration from Onboarding Module

**Files:**
- Modify: `services/whatsapp-notify/src/handlers/onboarding.ts`

**Step 1: Export parseSelections and PROFESSIONS**

The `parseSelections` function in `onboarding.ts` (line 402) is currently private. We need to either:
- Export it from onboarding.ts, OR
- Keep the copy in registration.ts (already done in Task 4)

Since `PROFESSIONS` is already exported (line 23), and `parseSelections` is a simple utility, **keep the copy in registration.ts** to avoid coupling. No changes needed to onboarding.ts.

Also verify `handleFirstContact` and `getOnboardState` are exported (they already are at lines 40 and 468).

**Step 2: Commit**

No changes needed — skip this task.

---

## Task 9: Integration Test — Manual Smoke Test

**Files:**
- No new files

**Step 1: Start the service locally**

```bash
cd services/whatsapp-notify
cp .env.example .env  # ensure env vars are set
npm run dev
```

**Step 2: Simulate an incoming message from unknown phone**

```bash
curl -X POST http://localhost:3002/webhooks/whatsapp \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "From=whatsapp%3A%2B15551234567&Body=hello&MessageSid=SM_test_001"
```

Expected: Bot sends welcome message with profession selection.

**Step 3: Simulate step responses**

```bash
# Step 1: Profession
curl -X POST http://localhost:3002/webhooks/whatsapp \
  -d "From=whatsapp%3A%2B15551234567&Body=1%2C%206&MessageSid=SM_test_002"

# Step 1b: State
curl -X POST http://localhost:3002/webhooks/whatsapp \
  -d "From=whatsapp%3A%2B15551234567&Body=1&MessageSid=SM_test_003"

# Step 2: Cities
curl -X POST http://localhost:3002/webhooks/whatsapp \
  -d "From=whatsapp%3A%2B15551234567&Body=1%2C%203&MessageSid=SM_test_004"

# Step 3: Name
curl -X POST http://localhost:3002/webhooks/whatsapp \
  -d "From=whatsapp%3A%2B15551234567&Body=John%20Smith&MessageSid=SM_test_005"

# Step 4: Email
curl -X POST http://localhost:3002/webhooks/whatsapp \
  -d "From=whatsapp%3A%2B15551234567&Body=john%40gmail.com&MessageSid=SM_test_006"

# Confirm
curl -X POST http://localhost:3002/webhooks/whatsapp \
  -d "From=whatsapp%3A%2B15551234567&Body=yes&MessageSid=SM_test_007"
```

**Step 4: Verify in Supabase**

Check that auth.users, profiles, contractors, and subscriptions all have the new records.

**Step 5: Test edge cases**

- Send STOP → verify opt-out recorded
- Send from same phone again → should be handled as known user
- Send with duplicate email → should get error message

---

## Task 10: Dashboard — Display Trial Status

**Files:**
- Modify: `apps/dashboard/src/pages/ContractorDashboard.tsx`
- Modify: `apps/dashboard/src/pages/Subscription.tsx`

**Step 1: Add trial badge to dashboard**

In `ContractorDashboard.tsx`, find the plan display section and add trial awareness:

```typescript
// In the Quick Status sidebar section where plan is displayed,
// add a check for 'trialing' status to show trial days remaining:

{subscription?.status === 'trialing' && (
  <div className="text-sm text-amber-400">
    Trial — {daysRemaining(subscription.current_period_end)} days left
  </div>
)}
```

Helper function:
```typescript
function daysRemaining(endDate: string): number {
  const diff = new Date(endDate).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}
```

**Step 2: Add trial banner to Subscription page**

In `Subscription.tsx`, add a trial banner at the top when status is 'trialing'.

**Step 3: Commit**

```bash
git add apps/dashboard/src/pages/ContractorDashboard.tsx apps/dashboard/src/pages/Subscription.tsx
git commit -m "feat: display trial status and days remaining in dashboard"
```

---

## Task Summary

| Task | Description | Est. |
|------|-------------|------|
| 1 | DB Migration — CHECK, UNIQUE, opt-outs | 5 min |
| 2 | Registration state & Redis helpers | 5 min |
| 3 | Rate limiting & opt-out helpers | 5 min |
| 4 | Registration step handlers (6 steps) | 15 min |
| 5 | Account creation (confirm step) | 10 min |
| 6 | Rewire webhook router | 10 min |
| 7 | Update shared types | 2 min |
| 8 | Export verification (no changes needed) | 1 min |
| 9 | Integration smoke test | 10 min |
| 10 | Dashboard trial display | 5 min |
