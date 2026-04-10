# Smart Onboarding Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the contractor onboarding flow into a "smart wizard" that skips steps already filled by Rebeca (WhatsApp bot), adds a credit-card collection step (Stripe SetupIntent, no charge), and moves PWA install + push permission prompts out of the wizard into a non-blocking dashboard task checklist.

**Architecture:** Single smart wizard that reads existing contractor data on mount and dynamically builds its step list. Only missing fields are prompted. Rebeca users typically see 2 steps (credentials + credit card); website signups see up to 6. Credit card is collected via Stripe Elements + SetupIntent (no charge) and saved to a new `stripe_payment_method_id` column. Trial clock continues to start from Rebeca completion (Option B — no Rebeca-flow changes). PWA install and push permission become dismissible dashboard task cards inside `ProfileCompletionBar`.

**Tech Stack:** React + Vite + Tailwind (existing), Supabase (Postgres + Edge Functions), Stripe v17 (already installed in edge functions via `npm:stripe@17`), `@stripe/stripe-js` + `@stripe/react-stripe-js` (NEW — needs install).

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `supabase/migrations/106_payment_method_on_subscriptions.sql` | Create | Add `stripe_payment_method_id` column to `subscriptions` |
| `supabase/functions/create-setup-intent/index.ts` | Create | Create Stripe SetupIntent + customer, return client_secret |
| `supabase/functions/save-payment-method/index.ts` | Create | After SetupIntent succeeds, persist payment_method_id + attach as default |
| `apps/dashboard/src/lib/stripe.ts` | Create | Singleton `loadStripe()` wrapper with publishable key |
| `apps/dashboard/src/components/onboarding/CredentialsStep.tsx` | Create | Step 0 content — email/password + Google/Apple (extracted from current wizard + CompleteAccount) |
| `apps/dashboard/src/components/onboarding/PhoneStep.tsx` | Create | Step content — WhatsApp phone (extracted from current wizard) |
| `apps/dashboard/src/components/onboarding/ProfessionStep.tsx` | Create | Step content — profession grid (extracted from current wizard) |
| `apps/dashboard/src/components/onboarding/AreaStep.tsx` | Create | Step content — service area selector (extracted from current wizard) |
| `apps/dashboard/src/components/onboarding/HoursStep.tsx` | Create | Step content — working hours (extracted from current wizard) |
| `apps/dashboard/src/components/onboarding/CreditCardStep.tsx` | Create | NEW — Stripe Elements card form + Skip button |
| `apps/dashboard/src/hooks/useOnboardingPlan.ts` | Create | Computes which wizard steps are needed based on DB state |
| `apps/dashboard/src/pages/OnboardingWizard.tsx` | Rewrite | Shell that loads plan, renders steps dynamically, drops push/install phases |
| `apps/dashboard/src/pages/CompleteAccount.tsx` | Delete | Merged into wizard's CredentialsStep |
| `apps/dashboard/src/components/CompleteAccountBanner.tsx` | Modify | Also becomes obsolete if no credentials needed — verify and delete if unused |
| `apps/dashboard/src/hooks/usePWAInstall.ts` | Create | Hook exposing `canInstall`, `isInstalled`, `promptInstall()` |
| `apps/dashboard/src/hooks/usePushPermission.ts` | Create | Hook exposing `hasPermission`, `canRequest`, `requestPermission()` |
| `apps/dashboard/src/components/ProfileCompletionBar.tsx` | Modify | Add PWA + push tasks to checklist |
| `apps/dashboard/src/components/PWAInstallBanner.tsx` | Delete | Replaced by task in ProfileCompletionBar |
| `apps/dashboard/src/components/PushBanner.tsx` | Delete (pending verify) | Replaced by task in ProfileCompletionBar |
| `apps/dashboard/src/pages/AutoLogin.tsx` | Modify | Redirect to `/onboarding` instead of `/complete-account` |
| `apps/dashboard/src/App.tsx` | Modify | Remove `/complete-account` route, remove banners, remove `CompleteAccount` import |

---

## Environment & Setup Prerequisites

Before starting implementation, verify these environment variables exist:

**Supabase Edge Functions (Supabase dashboard → Settings → Edge Functions):**
- `STRIPE_SECRET_KEY` — already present (used by `create-checkout-session`)
- `SUPABASE_URL` — already present
- `SUPABASE_SERVICE_ROLE_KEY` — already present

**Frontend (apps/dashboard/.env.local and Vercel env):**
- `VITE_STRIPE_PUBLISHABLE_KEY` — **MUST ADD**. Matches the secret key's publishable counterpart.

---

## Phase 1: Backend — Stripe SetupIntent Infrastructure

### Task 1: DB Migration — Add `stripe_payment_method_id` column

**Files:**
- Create: `supabase/migrations/106_payment_method_on_subscriptions.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- 106_payment_method_on_subscriptions.sql
-- Adds a column to store the Stripe PaymentMethod id collected during onboarding
-- via SetupIntent (no charge). This is separate from stripe_subscription_id and
-- is set before the trial even converts — it represents "saved card for later".

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS stripe_payment_method_id TEXT;

COMMENT ON COLUMN public.subscriptions.stripe_payment_method_id IS
  'Stripe PaymentMethod id saved during onboarding via SetupIntent. Used to auto-charge when trial converts.';

-- Partial index for quick lookup of users who have NOT yet saved a card
-- (used to prompt them on the dashboard).
CREATE INDEX IF NOT EXISTS idx_subscriptions_no_payment_method
  ON public.subscriptions (user_id)
  WHERE stripe_payment_method_id IS NULL;
```

- [ ] **Step 2: Apply migration via Supabase MCP tool**

Use the `mcp__0d9c8720-37d4-4448-bd8c-304180af55eb__apply_migration` tool with:
- `project_id`: (the Leadexpress project id — verify via `list_projects` first)
- `name`: `payment_method_on_subscriptions`
- `query`: the SQL above

- [ ] **Step 3: Verify column exists**

Use `mcp__0d9c8720-37d4-4448-bd8c-304180af55eb__execute_sql`:

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'subscriptions'
  AND column_name = 'stripe_payment_method_id';
```

Expected: 1 row — `stripe_payment_method_id | text | YES`

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/106_payment_method_on_subscriptions.sql
git commit -m "feat(db): add stripe_payment_method_id column to subscriptions"
```

---

### Task 2: Edge Function — `create-setup-intent`

**Files:**
- Create: `supabase/functions/create-setup-intent/index.ts`

- [ ] **Step 1: Create the function directory and file**

```bash
mkdir -p supabase/functions/create-setup-intent
```

- [ ] **Step 2: Write the edge function**

Create `supabase/functions/create-setup-intent/index.ts`:

```typescript
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import Stripe from "npm:stripe@17";
import { getCorsHeaders } from "../_shared/cors.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!);
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

Deno.serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response("Unauthorized", { status: 401 });

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return new Response("Unauthorized", { status: 401 });

    // Get or create Stripe customer (reusing the pattern from create-checkout-session)
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();

    let customerId = sub?.stripe_customer_id;

    if (!customerId || customerId === "") {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, phone")
        .eq("id", user.id)
        .maybeSingle();

      const customer = await stripe.customers.create({
        email: user.email,
        name: profile?.full_name || undefined,
        metadata: { supabase_user_id: user.id },
      });
      customerId = customer.id;

      await supabase
        .from("subscriptions")
        .upsert(
          { user_id: user.id, stripe_customer_id: customerId },
          { onConflict: "user_id" },
        );
    }

    // Create the SetupIntent — no charge, just saves a payment method for later
    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ["card"],
      usage: "off_session",
      metadata: {
        supabase_user_id: user.id,
        source: "onboarding_wizard",
      },
    });

    return new Response(
      JSON.stringify({
        client_secret: setupIntent.client_secret,
        customer_id: customerId,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[create-setup-intent] Error:", err);
    return new Response(
      JSON.stringify({ error: "Failed to create setup intent" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
```

- [ ] **Step 3: Deploy via Supabase MCP**

Use `mcp__0d9c8720-37d4-4448-bd8c-304180af55eb__deploy_edge_function` with:
- `project_id`: (Leadexpress project id)
- `name`: `create-setup-intent`
- `entrypoint_path`: `index.ts`
- `verify_jwt`: `true`
- `files`: array with the file above

- [ ] **Step 4: Smoke test with curl**

Replace `<ANON_KEY>` and `<USER_JWT>` with real values from the browser (Network tab after login).

```bash
curl -i -X POST https://<project>.supabase.co/functions/v1/create-setup-intent \
  -H "Authorization: Bearer <USER_JWT>" \
  -H "apikey: <ANON_KEY>" \
  -H "Content-Type: application/json" \
  -d '{}'
```

Expected: `200 OK` with JSON body containing `client_secret` (starts with `seti_`) and `customer_id` (starts with `cus_`).

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/create-setup-intent/
git commit -m "feat(edge): add create-setup-intent function for onboarding card capture"
```

---

### Task 3: Edge Function — `save-payment-method`

**Files:**
- Create: `supabase/functions/save-payment-method/index.ts`

- [ ] **Step 1: Write the edge function**

Create `supabase/functions/save-payment-method/index.ts`:

```typescript
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import Stripe from "npm:stripe@17";
import { getCorsHeaders } from "../_shared/cors.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!);
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

Deno.serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response("Unauthorized", { status: 401 });

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return new Response("Unauthorized", { status: 401 });

    const { payment_method_id } = await req.json();
    if (!payment_method_id || typeof payment_method_id !== "string") {
      return new Response(
        JSON.stringify({ error: "Missing payment_method_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Look up the stripe customer
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();

    const customerId = sub?.stripe_customer_id;
    if (!customerId) {
      return new Response(
        JSON.stringify({ error: "No stripe customer for user. Call create-setup-intent first." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Make this the default payment method on the customer so Stripe will
    // auto-charge it when the trial converts.
    await stripe.customers.update(customerId, {
      invoice_settings: { default_payment_method: payment_method_id },
    });

    // Persist the id in our subscriptions table
    const { error: updateError } = await supabase
      .from("subscriptions")
      .update({ stripe_payment_method_id: payment_method_id })
      .eq("user_id", user.id);

    if (updateError) {
      console.error("[save-payment-method] DB update error:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to save payment method" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[save-payment-method] Error:", err);
    return new Response(
      JSON.stringify({ error: "Unexpected error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
```

- [ ] **Step 2: Deploy via Supabase MCP**

Same as Task 2 step 3 but with `name: save-payment-method`.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/save-payment-method/
git commit -m "feat(edge): add save-payment-method function"
```

---

## Phase 2: Frontend Stripe Wiring

### Task 4: Install Stripe packages and add publishable key

**Files:**
- Modify: `apps/dashboard/package.json`
- Create: `apps/dashboard/src/lib/stripe.ts`

- [ ] **Step 1: Install Stripe frontend packages**

```bash
cd apps/dashboard && npm install @stripe/stripe-js @stripe/react-stripe-js
```

Expected: both packages added to `dependencies` in `apps/dashboard/package.json`.

- [ ] **Step 2: Add publishable key to local .env**

Edit `apps/dashboard/.env.local` (create if missing) and add:

```
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

The user must provide the actual key — it's the publishable half of `STRIPE_SECRET_KEY` already configured on the edge functions. Tell the user: "Grab the publishable key from Stripe Dashboard → Developers → API keys and add it as `VITE_STRIPE_PUBLISHABLE_KEY` in `apps/dashboard/.env.local` AND in Vercel project settings."

- [ ] **Step 3: Create stripe singleton**

Create `apps/dashboard/src/lib/stripe.ts`:

```typescript
import { loadStripe, type Stripe } from '@stripe/stripe-js'

let stripePromise: Promise<Stripe | null> | null = null

export function getStripe(): Promise<Stripe | null> {
  if (!stripePromise) {
    const key = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
    if (!key) {
      console.error('[stripe] VITE_STRIPE_PUBLISHABLE_KEY is not set')
      return Promise.resolve(null)
    }
    stripePromise = loadStripe(key)
  }
  return stripePromise
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/dashboard/package.json apps/dashboard/package-lock.json apps/dashboard/src/lib/stripe.ts
git commit -m "feat(dashboard): add Stripe.js + singleton loader"
```

---

## Phase 3: Smart Onboarding Plan — Hook

### Task 5: Create `useOnboardingPlan` hook

**Files:**
- Create: `apps/dashboard/src/hooks/useOnboardingPlan.ts`

- [ ] **Step 1: Write the hook**

Create `apps/dashboard/src/hooks/useOnboardingPlan.ts`:

```typescript
import { useEffect, useState } from 'react'
import { useAuth } from '../lib/auth'
import { supabase } from './../lib/supabase'

export type StepKey =
  | 'credentials'
  | 'phone'
  | 'profession'
  | 'area'
  | 'hours'
  | 'credit_card'

export interface OnboardingPlan {
  loading: boolean
  steps: StepKey[]
  // Populated data for pre-fill (all optional)
  existing: {
    phone?: string
    professions?: string[]
    zipCodes?: string[]
    counties?: string[]
    workingDays?: number[]
    hasPaymentMethod?: boolean
  }
  refresh: () => Promise<void>
}

/**
 * Computes which onboarding steps are needed for the current user based on
 * what's already populated in the DB. Rebeca users typically skip phone,
 * profession, area, and hours because Rebeca already collected them.
 */
export function useOnboardingPlan(): OnboardingPlan {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [steps, setSteps] = useState<StepKey[]>([])
  const [existing, setExisting] = useState<OnboardingPlan['existing']>({})

  async function compute() {
    if (!user) {
      setLoading(false)
      return
    }
    setLoading(true)

    // Pull all data in parallel
    const [contractorRes, profileRes, subRes] = await Promise.all([
      supabase
        .from('contractors')
        .select('professions, zip_codes, working_days')
        .eq('user_id', user.id)
        .maybeSingle(),
      supabase
        .from('profiles')
        .select('whatsapp_phone, phone, counties')
        .eq('id', user.id)
        .maybeSingle(),
      supabase
        .from('subscriptions')
        .select('stripe_payment_method_id')
        .eq('user_id', user.id)
        .maybeSingle(),
    ])

    const contractor = contractorRes.data
    const profile = profileRes.data
    const sub = subRes.data

    const isOAuth =
      !!user.app_metadata?.provider && user.app_metadata.provider !== 'email'
    // Heuristic: if the user's email is the auto-generated WhatsApp one, they
    // haven't set real credentials yet. Same if no password (we can't detect
    // password directly — rely on email pattern instead).
    const hasRealEmail =
      !!user.email && !user.email.endsWith('@app.masterleadflow.com') && !user.email.endsWith('@signup.masterleadflow.com')

    const next: StepKey[] = []

    if (!isOAuth && !hasRealEmail) next.push('credentials')
    if (!profile?.whatsapp_phone && !profile?.phone) next.push('phone')
    if (!contractor?.professions?.length) next.push('profession')
    if (
      !(contractor?.zip_codes?.length || profile?.counties?.length)
    ) next.push('area')
    if (!contractor?.working_days?.length) next.push('hours')
    if (!sub?.stripe_payment_method_id) next.push('credit_card')

    setSteps(next)
    setExisting({
      phone: profile?.whatsapp_phone || profile?.phone || undefined,
      professions: contractor?.professions || undefined,
      zipCodes: contractor?.zip_codes || undefined,
      counties: profile?.counties || undefined,
      workingDays: contractor?.working_days || undefined,
      hasPaymentMethod: !!sub?.stripe_payment_method_id,
    })
    setLoading(false)
  }

  useEffect(() => {
    compute()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  return { loading, steps, existing, refresh: compute }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/dashboard/src/hooks/useOnboardingPlan.ts
git commit -m "feat(onboarding): add useOnboardingPlan hook"
```

---

## Phase 4: Extract Step Components

**Rationale:** `OnboardingWizard.tsx` is 908 lines with all step content inline. Before we make the wizard smart + dynamic, we split each step into its own component so the wizard shell stays small and each step is testable in isolation.

### Task 6: Extract `CredentialsStep`

**Files:**
- Create: `apps/dashboard/src/components/onboarding/CredentialsStep.tsx`

- [ ] **Step 1: Write the component**

Create `apps/dashboard/src/components/onboarding/CredentialsStep.tsx`:

```tsx
import { useState } from 'react'
import { Mail, Lock, Loader2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { useI18n } from '../../lib/i18n'

interface Props {
  onComplete: () => void
}

export default function CredentialsStep({ onComplete }: Props) {
  const { locale } = useI18n()
  const he = locale === 'he'
  const { user } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  const canSubmit = emailOk && password.length >= 6 && !saving

  async function handleGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/onboarding` },
    })
  }
  async function handleApple() {
    await supabase.auth.signInWithOAuth({
      provider: 'apple',
      options: { redirectTo: `${window.location.origin}/onboarding` },
    })
  }

  async function handleEmailSubmit() {
    if (!canSubmit || !user) return
    setSaving(true)
    setError('')
    try {
      const { data, error: fnErr } = await supabase.functions.invoke(
        'update-account',
        { body: { email, password } },
      )
      if (fnErr || data?.error) {
        setError(data?.error || fnErr?.message || 'Failed to update account')
        setSaving(false)
        return
      }
      await supabase.from('profiles').update({ email }).eq('id', user.id)
      await supabase.auth.signInWithPassword({ email, password }).catch(() => {})
      await supabase
        .from('contractors')
        .update({ onboarding_step: 'credentials_set' })
        .eq('user_id', user.id)
      setSaving(false)
      onComplete()
    } catch {
      setError('Something went wrong. Please try again.')
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="text-center">
        <h1 className="text-base md:text-lg font-bold text-zinc-900">
          {he ? 'הגדר כניסה לחשבון' : 'Create your login'}
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          {he
            ? 'הגדר אימייל וסיסמא לכניסה לחשבון שלך'
            : 'Set your email and password to access your account'}
        </p>
      </div>

      {/* Social buttons */}
      <div className="max-w-sm mx-auto grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={handleGoogle}
          className="flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-zinc-200 bg-white text-sm font-semibold text-zinc-700 hover:bg-zinc-50 transition-colors"
        >
          <span className="text-base">🔵</span>
          Google
        </button>
        <button
          type="button"
          onClick={handleApple}
          className="flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-zinc-200 bg-white text-sm font-semibold text-zinc-700 hover:bg-zinc-50 transition-colors"
        >
          <span className="text-base">🍎</span>
          Apple
        </button>
      </div>

      <div className="max-w-sm mx-auto flex items-center gap-3">
        <div className="h-px flex-1 bg-zinc-200" />
        <span className="text-xs text-zinc-400 uppercase">
          {he ? 'או' : 'or'}
        </span>
        <div className="h-px flex-1 bg-zinc-200" />
      </div>

      {/* Email + password form */}
      <div className="max-w-sm mx-auto space-y-4">
        <div>
          <label className="block text-sm font-semibold text-zinc-700 mb-1.5">
            {he ? 'אימייל' : 'Email'}
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                setError('')
              }}
              placeholder="you@example.com"
              className="w-full pl-10 pr-4 py-3 rounded-xl border-2 border-zinc-200 bg-white text-sm text-zinc-800 placeholder:text-zinc-300 outline-none focus:border-[#fe5b25] transition-colors"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-zinc-700 mb-1.5">
            {he ? 'סיסמא' : 'Password'}
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                setError('')
              }}
              placeholder={he ? 'לפחות 6 תווים' : 'At least 6 characters'}
              className="w-full pl-10 pr-4 py-3 rounded-xl border-2 border-zinc-200 bg-white text-sm text-zinc-800 placeholder:text-zinc-300 outline-none focus:border-[#fe5b25] transition-colors"
            />
          </div>
        </div>

        {error && (
          <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600 text-center">
            {error}
          </div>
        )}

        <button
          type="button"
          disabled={!canSubmit}
          onClick={handleEmailSubmit}
          className="w-full py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-40 transition-all shadow-md shadow-[#fe5b25]/20"
          style={{ background: 'linear-gradient(135deg, #fe5b25, #e04d1c)' }}
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin mx-auto" />
          ) : (
            he ? 'המשך' : 'Continue'
          )}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/dashboard/src/components/onboarding/CredentialsStep.tsx
git commit -m "feat(onboarding): extract CredentialsStep with Google/Apple/email"
```

---

### Task 7: Extract `PhoneStep`, `ProfessionStep`, `AreaStep`, `HoursStep`

**Files:**
- Create: `apps/dashboard/src/components/onboarding/PhoneStep.tsx`
- Create: `apps/dashboard/src/components/onboarding/ProfessionStep.tsx`
- Create: `apps/dashboard/src/components/onboarding/AreaStep.tsx`
- Create: `apps/dashboard/src/components/onboarding/HoursStep.tsx`

**Rationale:** These 4 steps are pure extractions from the current `OnboardingWizard.tsx` — same JSX, same logic. Each becomes a presentation component that takes state via props from the wizard shell.

- [ ] **Step 1: Create `PhoneStep.tsx`**

Copy lines 619–679 of current `OnboardingWizard.tsx` into the new file. Convert it to accept props:

```tsx
import { Check } from 'lucide-react'
import { useI18n } from '../../lib/i18n'

interface Props {
  phone: string
  country: '+1' | '+972'
  onPhoneChange: (value: string) => void
  onCountryChange: (country: '+1' | '+972') => void
}

export default function PhoneStep({ phone, country, onPhoneChange, onCountryChange }: Props) {
  const { locale } = useI18n()
  const he = locale === 'he'

  function format(raw: string) {
    const digits = raw.replace(/\D/g, '')
    if (country === '+972') {
      let f = digits
      if (digits.length > 2) f = digits.slice(0, 2) + '-' + digits.slice(2)
      if (digits.length > 5) f = digits.slice(0, 2) + '-' + digits.slice(2, 5) + '-' + digits.slice(5, 9)
      return f
    }
    let f = digits
    if (digits.length > 3) f = '(' + digits.slice(0, 3) + ') ' + digits.slice(3)
    if (digits.length > 6) f = '(' + digits.slice(0, 3) + ') ' + digits.slice(3, 6) + '-' + digits.slice(6, 10)
    return f
  }

  return (
    <div className="space-y-5">
      <div className="text-center">
        <h1 className="text-base md:text-lg font-bold text-zinc-900">
          {he ? 'מספר הWhatsApp שלך' : 'Your WhatsApp Number'}
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          {he
            ? 'הזן את מספר הWhatsApp שלך כדי שנוכל לשלוח לך לידים'
            : 'Enter your WhatsApp number so we can send you leads'}
        </p>
      </div>

      <div className="max-w-sm mx-auto space-y-4">
        <label className="block text-sm font-semibold text-zinc-700 text-center">
          {he ? 'מספר WhatsApp' : 'WhatsApp Number'}
        </label>
        <div className="flex flex-col sm:flex-row gap-2">
          <select
            value={country}
            onChange={(e) => onCountryChange(e.target.value as '+1' | '+972')}
            className="w-full sm:w-auto rounded-xl border-2 border-zinc-200 bg-white px-3 py-3 text-sm font-semibold text-zinc-700 outline-none focus:border-[#fe5b25] transition-colors"
          >
            <option value="+1">🇺🇸 +1</option>
            <option value="+972">🇮🇱 +972</option>
          </select>
          <input
            type="tel"
            placeholder={country === '+972' ? '50-123-4567' : '(555) 123-4567'}
            value={phone}
            onChange={(e) => onPhoneChange(format(e.target.value))}
            className="flex-1 rounded-xl border-2 border-zinc-200 bg-white px-4 py-3 text-sm font-semibold text-zinc-700 outline-none focus:border-[#fe5b25] transition-colors placeholder:text-zinc-300"
          />
        </div>

        {phone.replace(/\D/g, '').length >= 10 && (
          <div className="flex items-center gap-2 justify-center text-sm text-emerald-600 font-medium">
            <Check className="w-4 h-4" />
            {he ? 'מספר תקין' : 'Looks good!'}
          </div>
        )}

        <div className="rounded-xl bg-[#fff4ef] border border-[#fee8df] px-4 py-3 text-xs text-[#e04d1c] text-center leading-relaxed">
          {he
            ? 'נשלח לך לידים ישירות בWhatsApp. ודא שזה המספר הנכון.'
            : "We'll send leads directly to your WhatsApp. Make sure this is the right number."}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create `ProfessionStep.tsx`**

Extract from lines 682–730 of current wizard. Signature:

```tsx
import { Check } from 'lucide-react'
import { PROFESSIONS } from '../../lib/professions'
import { useI18n } from '../../lib/i18n'

interface Props {
  professions: string[]
  maxProf: number
  onToggle: (id: string) => void
}

export default function ProfessionStep({ professions, maxProf, onToggle }: Props) {
  const { locale } = useI18n()
  const he = locale === 'he'

  return (
    <div className="space-y-5">
      <div className="text-center">
        <h1 className="text-base md:text-lg font-bold text-zinc-900">
          {he ? 'מה סוג העבודה שלך?' : 'What services do you offer?'}
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          {he
            ? 'בחר את סוגי העבודה שלך ונתאים לך לידים רלוונטיים'
            : "Pick your services so we send you the right leads"}
          {maxProf > 0 && (
            <span className="ml-2 text-[#fe5b25] font-semibold">
              ({professions.length}/{maxProf})
            </span>
          )}
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {PROFESSIONS.map((prof) => {
          const selected = professions.includes(prof.id)
          const atLimit = maxProf > 0 && professions.length >= maxProf && !selected
          return (
            <button
              key={prof.id}
              type="button"
              disabled={atLimit}
              onClick={() => onToggle(prof.id)}
              className={`relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                selected
                  ? 'border-[#fe5b25] bg-[#fff4ef] shadow-sm'
                  : atLimit
                  ? 'border-zinc-100 bg-zinc-50 opacity-40 cursor-not-allowed'
                  : 'border-zinc-200 bg-white hover:border-[#fe5b25]/40 hover:shadow-sm'
              }`}
            >
              {selected && (
                <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[#fe5b25] flex items-center justify-center">
                  <Check className="w-3 h-3 text-white" />
                </div>
              )}
              <span className="text-2xl">{prof.emoji}</span>
              <span
                className={`text-xs font-semibold text-center ${
                  selected ? 'text-[#e04d1c]' : 'text-zinc-700'
                }`}
              >
                {he ? prof.he : prof.en}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create `AreaStep.tsx`**

Thin wrapper around existing `ServiceAreaSelector`:

```tsx
import ServiceAreaSelector, { type SelectedArea } from '../settings/ServiceAreaSelector'

interface Props {
  selectedAreas: SelectedArea[]
  onAddArea: (area: SelectedArea) => void
  onRemoveArea: (state: string, county: string) => void
}

export default function AreaStep({ selectedAreas, onAddArea, onRemoveArea }: Props) {
  return (
    <ServiceAreaSelector
      selectedAreas={selectedAreas}
      onAddArea={onAddArea}
      onRemoveArea={onRemoveArea}
    />
  )
}
```

- [ ] **Step 4: Create `HoursStep.tsx`**

Extract from lines 742–840 of current wizard. Signature:

```tsx
import { Check } from 'lucide-react'
import { DAY_KEYS, DAY_LABELS, type DayKey, type WorkingHours } from '../../lib/working-hours'
import { useI18n } from '../../lib/i18n'

interface Props {
  workingHours: WorkingHours
  setWorkingHours: React.Dispatch<React.SetStateAction<WorkingHours>>
}

export default function HoursStep({ workingHours, setWorkingHours }: Props) {
  const { locale } = useI18n()
  const he = locale === 'he'

  return (
    <div className="space-y-5">
      <div className="text-center">
        <h1 className="text-base md:text-lg font-bold text-zinc-900">
          {he ? 'שעות הפעילות שלך' : 'Your active hours'}
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          {he
            ? 'הגדר מתי אתה זמין כדי שנשלח לידים בזמן הנכון'
            : "Set your hours so leads arrive when you're available"}
        </p>
      </div>

      <div className="flex gap-2 justify-center">
        {[
          { label: he ? 'ראשון-חמישי' : 'Mon–Fri', days: ['mon', 'tue', 'wed', 'thu', 'fri'] as DayKey[] },
          { label: he ? 'כל יום' : 'Every day', days: DAY_KEYS },
        ].map((preset) => (
          <button
            key={preset.label}
            type="button"
            onClick={() => {
              setWorkingHours((prev) => {
                const next = { ...prev }
                for (const key of DAY_KEYS) {
                  next[key] = { ...next[key], enabled: preset.days.includes(key) }
                }
                return next
              })
            }}
            className="px-4 py-2 rounded-full text-xs font-semibold border border-zinc-200 text-zinc-600 hover:border-[#fe5b25] hover:text-[#fe5b25] transition-all"
          >
            {preset.label}
          </button>
        ))}
      </div>

      <div className="space-y-2 max-w-sm mx-auto">
        {DAY_KEYS.map((day) => {
          const schedule = workingHours[day]
          return (
            <div
              key={day}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${
                schedule.enabled
                  ? 'border-[#fe5b25]/20 bg-[#fff4ef]'
                  : 'border-zinc-100 bg-zinc-50'
              }`}
            >
              <button
                type="button"
                onClick={() => {
                  setWorkingHours((prev) => ({
                    ...prev,
                    [day]: { ...prev[day], enabled: !prev[day].enabled },
                  }))
                }}
                className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                  schedule.enabled
                    ? 'bg-[#fe5b25] border-[#fe5b25]'
                    : 'border-zinc-300 bg-white'
                }`}
              >
                {schedule.enabled && <Check className="w-3 h-3 text-white" />}
              </button>
              <span
                className={`text-sm font-medium flex-1 ${
                  schedule.enabled ? 'text-zinc-900' : 'text-zinc-400'
                }`}
              >
                {he ? DAY_LABELS[day].he : DAY_LABELS[day].en}
              </span>
              {schedule.enabled && (
                <div className="flex items-center gap-1.5">
                  <input
                    type="time"
                    value={schedule.start}
                    onChange={(e) => {
                      setWorkingHours((prev) => ({
                        ...prev,
                        [day]: { ...prev[day], start: e.target.value },
                      }))
                    }}
                    className="rounded-lg border border-zinc-200 px-2 py-1 text-xs font-mono text-zinc-700 outline-none focus:border-[#fe5b25] w-[75px] md:w-[90px]"
                  />
                  <span className="text-zinc-400 text-xs">–</span>
                  <input
                    type="time"
                    value={schedule.end}
                    onChange={(e) => {
                      setWorkingHours((prev) => ({
                        ...prev,
                        [day]: { ...prev[day], end: e.target.value },
                      }))
                    }}
                    className="rounded-lg border border-zinc-200 px-2 py-1 text-xs font-mono text-zinc-700 outline-none focus:border-[#fe5b25] w-[75px] md:w-[90px]"
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

> **Note on `WorkingHours` type:** Check `apps/dashboard/src/lib/working-hours.ts`. If the type isn't already exported, export it in that file before using it in the `HoursStep` props.

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/src/components/onboarding/
git commit -m "feat(onboarding): extract Phone/Profession/Area/Hours step components"
```

---

### Task 8: Build `CreditCardStep` with Stripe Elements

**Files:**
- Create: `apps/dashboard/src/components/onboarding/CreditCardStep.tsx`

- [ ] **Step 1: Write the component**

Create `apps/dashboard/src/components/onboarding/CreditCardStep.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { Loader2, Lock, Shield, CreditCard } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useI18n } from '../../lib/i18n'
import { getStripe } from '../../lib/stripe'

interface Props {
  /** Called when the card is saved OR the user clicks Skip. */
  onComplete: () => void
}

function InnerCardForm({ onComplete }: Props) {
  const { locale } = useI18n()
  const he = locale === 'he'
  const stripe = useStripe()
  const elements = useElements()

  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    supabase.functions
      .invoke('create-setup-intent', { body: {} })
      .then(({ data, error }) => {
        if (cancelled) return
        if (error || !data?.client_secret) {
          setError(error?.message || 'Could not initialize payment form')
          setLoading(false)
          return
        }
        setClientSecret(data.client_secret)
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function handleSubmit() {
    if (!stripe || !elements || !clientSecret) return
    setSubmitting(true)
    setError('')

    const card = elements.getElement(CardElement)
    if (!card) {
      setError('Card form not ready')
      setSubmitting(false)
      return
    }

    const result = await stripe.confirmCardSetup(clientSecret, {
      payment_method: { card },
    })

    if (result.error) {
      setError(result.error.message || 'Card could not be saved')
      setSubmitting(false)
      return
    }

    const paymentMethodId =
      typeof result.setupIntent.payment_method === 'string'
        ? result.setupIntent.payment_method
        : result.setupIntent.payment_method?.id

    if (!paymentMethodId) {
      setError('Could not read payment method id')
      setSubmitting(false)
      return
    }

    const { error: saveErr } = await supabase.functions.invoke(
      'save-payment-method',
      { body: { payment_method_id: paymentMethodId } },
    )
    if (saveErr) {
      setError('Saved with Stripe but failed to save in our system. Please contact support.')
      setSubmitting(false)
      return
    }

    setSubmitting(false)
    onComplete()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-[#fe5b25]" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-50 text-green-700 text-xs font-semibold mb-3">
          <Shield className="w-3.5 h-3.5" />
          {he ? '7 ימי ניסיון חינם' : '7-day free trial'}
        </div>
        <h1 className="text-base md:text-lg font-bold text-zinc-900">
          {he ? 'הוסף כרטיס אשראי' : 'Add a payment card'}
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          {he
            ? 'לא תחויב עכשיו. נחייב רק בסיום הניסיון, ותוכל לבטל בכל עת.'
            : "You won't be charged now. We'll only charge after your trial, and you can cancel anytime."}
        </p>
      </div>

      <div className="max-w-sm mx-auto space-y-4">
        <div className="rounded-xl border-2 border-zinc-200 bg-white px-4 py-4">
          <CardElement
            options={{
              style: {
                base: {
                  fontSize: '15px',
                  color: '#18181b',
                  '::placeholder': { color: '#a1a1aa' },
                },
                invalid: { color: '#dc2626' },
              },
            }}
          />
        </div>

        {error && (
          <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600 text-center">
            {error}
          </div>
        )}

        <div className="flex items-center gap-2 justify-center text-xs text-zinc-400">
          <Lock className="w-3 h-3" />
          {he ? 'מוצפן ומאובטח על ידי Stripe' : 'Encrypted & secured by Stripe'}
        </div>

        <button
          type="button"
          disabled={submitting || !stripe}
          onClick={handleSubmit}
          className="w-full py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-40 transition-all shadow-md shadow-[#fe5b25]/20 flex items-center justify-center gap-2"
          style={{ background: 'linear-gradient(135deg, #fe5b25, #e04d1c)' }}
        >
          {submitting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <CreditCard className="w-4 h-4" />
              {he ? 'הפעל ניסיון חינם' : 'Start free trial'}
            </>
          )}
        </button>

        <button
          type="button"
          onClick={onComplete}
          className="w-full py-3 text-sm text-zinc-400 hover:text-zinc-600 transition-colors"
        >
          {he ? 'דלג בינתיים' : 'Skip for now'}
        </button>
      </div>
    </div>
  )
}

export default function CreditCardStep({ onComplete }: Props) {
  const [stripePromise] = useState(() => getStripe())

  return (
    <Elements stripe={stripePromise}>
      <InnerCardForm onComplete={onComplete} />
    </Elements>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/dashboard/src/components/onboarding/CreditCardStep.tsx
git commit -m "feat(onboarding): add CreditCardStep with Stripe SetupIntent"
```

---

## Phase 5: Rewrite the Wizard Shell

### Task 9: Rewrite `OnboardingWizard.tsx` as a smart shell

**Files:**
- Modify: `apps/dashboard/src/pages/OnboardingWizard.tsx`

- [ ] **Step 1: Replace the file contents**

The old 908-line file becomes a thin shell that:
1. Loads the plan from `useOnboardingPlan`
2. Renders only the steps listed in `plan.steps`
3. Drops `push` and `install` phases entirely
4. Hands control back to the dashboard (`/`) at the end

Replace `apps/dashboard/src/pages/OnboardingWizard.tsx` with:

```tsx
import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, ArrowLeft, Check, Loader2, Zap } from 'lucide-react'
import { useI18n } from '../lib/i18n'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { useToast } from '../components/hooks/use-toast'
import { useContractorSettings } from '../hooks/useContractorSettings'
import { useSubscriptionAccess } from '../hooks/useSubscriptionAccess'
import { useOnboardingPlan, type StepKey } from '../hooks/useOnboardingPlan'
import type { SelectedArea } from '../components/settings/ServiceAreaSelector'
import CredentialsStep from '../components/onboarding/CredentialsStep'
import PhoneStep from '../components/onboarding/PhoneStep'
import ProfessionStep from '../components/onboarding/ProfessionStep'
import AreaStep from '../components/onboarding/AreaStep'
import HoursStep from '../components/onboarding/HoursStep'
import CreditCardStep from '../components/onboarding/CreditCardStep'

const STEP_LABELS: Record<StepKey, { en: string; he: string }> = {
  credentials: { en: 'Account', he: 'כניסה' },
  phone: { en: 'WhatsApp', he: 'WhatsApp' },
  profession: { en: 'Services', he: 'שירותים' },
  area: { en: 'Service Areas', he: 'אזורי שירות' },
  hours: { en: 'Active Hours', he: 'שעות פעילות' },
  credit_card: { en: 'Card', he: 'כרטיס' },
}

export default function OnboardingWizard() {
  const { locale } = useI18n()
  const he = locale === 'he'
  const { toast } = useToast()
  const { user } = useAuth()
  const { maxProfessions } = useSubscriptionAccess()
  const { loading: planLoading, steps, refresh } = useOnboardingPlan()

  const {
    professions,
    zipCodes,
    workingHours,
    saving,
    toggleProfession,
    addZipCodes,
    removeZipCodes,
    setWorkingHours,
    save,
  } = useContractorSettings()

  const [stepIndex, setStepIndex] = useState(0)
  const [waPhone, setWaPhone] = useState('')
  const [waCountry, setWaCountry] = useState<'+1' | '+972'>(he ? '+972' : '+1')
  const [selectedAreas, setSelectedAreas] = useState<SelectedArea[]>([])

  const currentStep: StepKey | undefined = steps[stepIndex]

  // When wizard computes no steps, immediately hand off to dashboard.
  useEffect(() => {
    if (!planLoading && steps.length === 0) {
      window.location.href = '/'
    }
  }, [planLoading, steps.length])

  function goNext() {
    if (stepIndex < steps.length - 1) {
      setStepIndex((i) => i + 1)
    } else {
      finishWizard()
    }
  }

  function goBack() {
    if (stepIndex > 0) setStepIndex((i) => i - 1)
  }

  async function saveWhatsAppPhone() {
    if (!user) return
    const full = `${waCountry}${waPhone.replace(/\D/g, '')}`
    await supabase
      .from('profiles')
      .update({ whatsapp_phone: full, phone: full })
      .eq('id', user.id)
  }

  async function saveAreasAndHours() {
    await save()
    if (user && selectedAreas.length > 0) {
      const countyNames = selectedAreas.map((a) => a.county)
      await supabase.from('profiles').update({ counties: countyNames }).eq('id', user.id)
    }
  }

  async function canProceed(): Promise<boolean> {
    if (!currentStep) return true
    switch (currentStep) {
      case 'phone': {
        const digits = waPhone.replace(/\D/g, '')
        const minLen = waCountry === '+972' ? 9 : 10
        return digits.length >= minLen
      }
      case 'profession':
        return professions.length > 0
      case 'area':
        return selectedAreas.length > 0 || zipCodes.length > 0
      case 'hours':
        return true
      default:
        return true
    }
  }

  async function handleNextClick() {
    const ok = await canProceed()
    if (!ok) return

    if (currentStep === 'phone') await saveWhatsAppPhone()
    if (currentStep === 'hours' || currentStep === 'area') {
      try {
        await saveAreasAndHours()
      } catch {
        toast({
          title: he ? 'שמירה נכשלה' : 'Save failed',
          description: he ? 'נסה שוב' : 'Please try again.',
          variant: 'destructive',
        })
        return
      }
    }
    goNext()
  }

  async function finishWizard() {
    await refresh()
    window.location.href = '/'
  }

  function handleAddArea(area: SelectedArea) {
    setSelectedAreas((prev) => [...prev, area])
    addZipCodes(area.zips)
  }

  function handleRemoveArea(state: string, county: string) {
    const area = selectedAreas.find((a) => a.state === state && a.county === county)
    if (area) removeZipCodes(area.zips)
    setSelectedAreas((prev) => prev.filter((a) => !(a.state === state && a.county === county)))
  }

  // Steps that handle their own Next button (credentials, credit card)
  const selfCompletingSteps: StepKey[] = ['credentials', 'credit_card']
  const showBottomNav = currentStep && !selfCompletingSteps.includes(currentStep)

  // Progress label
  const progressLabel = useMemo(() => {
    if (steps.length === 0) return ''
    return `${stepIndex + 1} / ${steps.length}`
  }, [stepIndex, steps.length])

  if (planLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-white">
        <Loader2 className="w-6 h-6 animate-spin text-[#fe5b25]" />
      </div>
    )
  }

  if (!currentStep) {
    return null // redirect effect will kick in
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-white">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-white text-[11px]"
            style={{ background: 'linear-gradient(135deg, #fe5b25, #e04d1c)' }}
          >
            <img src="/icon.png" alt="MasterLeadFlow" className="w-full h-full rounded-lg" />
          </div>
          <span className="text-sm font-bold text-zinc-800">MasterLeadFlow</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-zinc-400">
          <Zap className="w-3.5 h-3.5 text-[#fe5b25]" />
          <span>{progressLabel}</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-zinc-100">
        <div
          className="h-full transition-all duration-500 ease-out"
          style={{
            width: `${((stepIndex + 1) / steps.length) * 100}%`,
            background: 'linear-gradient(90deg, #fe5b25, #ff8a5c)',
          }}
        />
      </div>

      {/* Welcome header */}
      <div className="text-center pt-5 pb-2 px-4">
        <h2 className="text-base md:text-lg font-bold text-zinc-800">
          {he ? 'בוא נגדיר את החשבון שלך' : "Let's set up your account"}
        </h2>
        <p className="text-xs text-zinc-400 mt-0.5">
          {he
            ? `${steps.length} שלבים קצרים — תסיים תוך שניות`
            : `${steps.length} quick steps — done in seconds`}
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 md:px-6 pb-32">
        <div className={`w-full mx-auto ${currentStep === 'area' ? 'md:max-w-5xl' : 'md:max-w-2xl'}`}>
          {currentStep === 'credentials' && <CredentialsStep onComplete={goNext} />}
          {currentStep === 'phone' && (
            <PhoneStep
              phone={waPhone}
              country={waCountry}
              onPhoneChange={setWaPhone}
              onCountryChange={setWaCountry}
            />
          )}
          {currentStep === 'profession' && (
            <ProfessionStep
              professions={professions}
              maxProf={maxProfessions}
              onToggle={toggleProfession}
            />
          )}
          {currentStep === 'area' && (
            <AreaStep
              selectedAreas={selectedAreas}
              onAddArea={handleAddArea}
              onRemoveArea={handleRemoveArea}
            />
          )}
          {currentStep === 'hours' && (
            <HoursStep workingHours={workingHours} setWorkingHours={setWorkingHours} />
          )}
          {currentStep === 'credit_card' && <CreditCardStep onComplete={finishWizard} />}
        </div>
      </div>

      {/* Bottom nav — only for steps that don't manage their own buttons */}
      {showBottomNav && (
        <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t border-zinc-100 px-4 md:px-6 py-3 md:py-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <div className="max-w-2xl mx-auto flex items-center justify-between">
            {stepIndex > 0 ? (
              <button
                type="button"
                onClick={goBack}
                className="flex items-center gap-2 px-4 md:px-5 py-3 md:py-2.5 rounded-xl text-sm font-semibold text-zinc-600 hover:bg-zinc-50 transition-all"
              >
                <ArrowLeft className="w-4 h-4" />
                {he ? 'חזרה' : 'Back'}
              </button>
            ) : (
              <div />
            )}

            <button
              type="button"
              onClick={handleNextClick}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-3 md:py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40 transition-all shadow-md shadow-[#fe5b25]/20"
              style={{ background: 'linear-gradient(135deg, #fe5b25, #e04d1c)' }}
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : stepIndex === steps.length - 1 ? (
                <>
                  <Check className="w-4 h-4" />
                  {he ? 'סיום' : 'Finish'}
                </>
              ) : (
                <>
                  {he ? 'הבא' : 'Next'}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify the app builds**

Use `mcp__Claude_Preview__preview_start` with an existing server config, then check for build errors via `preview_logs` with `level: "error"`. If there are type errors, fix them in the extracted step components before continuing.

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/src/pages/OnboardingWizard.tsx
git commit -m "feat(onboarding): rewrite wizard as smart dynamic shell"
```

---

## Phase 6: Delete `CompleteAccount` and Update Routing

### Task 10: Delete `CompleteAccount.tsx` and remove routes

**Files:**
- Delete: `apps/dashboard/src/pages/CompleteAccount.tsx`
- Modify: `apps/dashboard/src/App.tsx`
- Modify: `apps/dashboard/src/pages/AutoLogin.tsx`

- [ ] **Step 1: Update `AutoLogin.tsx` to redirect to `/onboarding`**

Find the line in `AutoLogin.tsx` around line 111 that has:

```typescript
navigate(redirectPath || '/complete-account', { replace: true })
```

and change the fallback to:

```typescript
navigate(redirectPath || '/onboarding', { replace: true })
```

- [ ] **Step 2: Remove `/complete-account` route and imports from `App.tsx`**

In `apps/dashboard/src/App.tsx`:

1. Delete the lazy import line (~line 14):
```typescript
const CompleteAccount = lazyRetry(() => import('./pages/CompleteAccount'))
```

2. Delete the import of `CompleteAccountBanner` (~line 17):
```typescript
import CompleteAccountBanner from './components/CompleteAccountBanner'
```

3. Delete the banner render (~line 218):
```typescript
{!onboardingActive && <CompleteAccountBanner />}
```

4. Delete the route (~line 300):
```typescript
<Route path="/complete-account" element={<RequireAuth><CompleteAccount /></RequireAuth>} />
```

- [ ] **Step 3: Delete the file**

```bash
git rm apps/dashboard/src/pages/CompleteAccount.tsx
```

- [ ] **Step 4: Check `CompleteAccountBanner` usage**

```bash
grep -rn "CompleteAccountBanner" apps/dashboard/src/
```

Expected: no remaining references (only the import/render we just removed). If the file is now orphaned:

```bash
git rm apps/dashboard/src/components/CompleteAccountBanner.tsx
```

- [ ] **Step 5: Verify build**

Start preview server via `preview_start`, check `preview_logs` with `level: "error"`. Must be no errors referencing `CompleteAccount` or `CompleteAccountBanner`.

- [ ] **Step 6: Update Rebeca magic-link default redirect path**

In `supabase/functions/whatsapp-webhook/index.ts` around line 2803–2810, where it calls the `magic-login` function to generate a link, change `redirect_path: "/complete-account"` to `redirect_path: "/onboarding"`.

Search first:

```bash
grep -n "complete-account" supabase/functions/whatsapp-webhook/index.ts
```

Replace each occurrence with `/onboarding`.

- [ ] **Step 7: Deploy updated whatsapp-webhook**

Use `mcp__0d9c8720-37d4-4448-bd8c-304180af55eb__deploy_edge_function` with `name: whatsapp-webhook` and upload the full file contents (all files in the function directory). Pull current files first via `get_edge_function` to ensure you don't drop any shared files.

- [ ] **Step 8: Commit**

```bash
git add apps/dashboard/src/App.tsx apps/dashboard/src/pages/AutoLogin.tsx supabase/functions/whatsapp-webhook/
git rm --cached apps/dashboard/src/pages/CompleteAccount.tsx 2>/dev/null || true
git commit -m "refactor(onboarding): remove CompleteAccount, route magic links to /onboarding"
```

---

## Phase 7: Dashboard Task Checklist — PWA + Push

### Task 11: Create `usePWAInstall` hook

**Files:**
- Create: `apps/dashboard/src/hooks/usePWAInstall.ts`

- [ ] **Step 1: Write the hook**

```typescript
import { useEffect, useState } from 'react'

interface PWAInstallState {
  canInstall: boolean
  isInstalled: boolean
  isIOS: boolean
  promptInstall: () => Promise<'accepted' | 'dismissed' | 'unsupported'>
}

// Module-level storage — the beforeinstallprompt event fires once, we capture it.
let deferredPrompt: any = null
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferredPrompt = e
  })
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null
  })
}

function detectStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    ('standalone' in navigator && (navigator as any).standalone === true)
  )
}

function detectIOS(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iPhone|iPad|iPod/i.test(navigator.userAgent)
}

export function usePWAInstall(): PWAInstallState {
  const [canInstall, setCanInstall] = useState(!!deferredPrompt)
  const [isInstalled, setIsInstalled] = useState(detectStandalone())

  useEffect(() => {
    function onPrompt() {
      setCanInstall(true)
    }
    function onInstalled() {
      setIsInstalled(true)
      setCanInstall(false)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unsupported'> {
    if (!deferredPrompt) return 'unsupported'
    deferredPrompt.prompt()
    const choice = await deferredPrompt.userChoice
    deferredPrompt = null
    setCanInstall(false)
    return choice.outcome === 'accepted' ? 'accepted' : 'dismissed'
  }

  return {
    canInstall,
    isInstalled,
    isIOS: detectIOS(),
    promptInstall,
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/dashboard/src/hooks/usePWAInstall.ts
git commit -m "feat(dashboard): add usePWAInstall hook"
```

---

### Task 12: Create `usePushPermission` hook

**Files:**
- Create: `apps/dashboard/src/hooks/usePushPermission.ts`

**Note:** This repo already has `usePushNotifications.ts`. Read it first to understand the existing API:

```bash
cat apps/dashboard/src/hooks/usePushNotifications.ts | head -80
```

If `usePushNotifications` already exposes a simple `canRequest`/`requestPermission`/`hasPermission` shape, **skip creating a new hook** and use the existing one directly in the task list. Update Task 13 accordingly to import from `usePushNotifications` instead.

If the existing hook is coupled to the old `PushBanner` flow, create this thin wrapper:

- [ ] **Step 1: Write the hook** (only if existing hook is unsuitable)

```typescript
import { usePushNotifications } from './usePushNotifications'

export function usePushPermission() {
  const { status, enable, isLoading } = usePushNotifications()
  return {
    hasPermission: status === 'granted',
    canRequest: status !== 'granted' && status !== 'unsupported',
    isUnsupported: status === 'unsupported',
    requestPermission: enable,
    isLoading,
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/dashboard/src/hooks/usePushPermission.ts
git commit -m "feat(dashboard): add usePushPermission wrapper hook"
```

---

### Task 13: Add PWA + Push tasks to `ProfileCompletionBar`

**Files:**
- Modify: `apps/dashboard/src/components/ProfileCompletionBar.tsx`

- [ ] **Step 1: Update the component**

Edit `apps/dashboard/src/components/ProfileCompletionBar.tsx`:

1. Add imports at the top of the file:

```typescript
import { Smartphone, Bell } from 'lucide-react'
import { usePWAInstall } from '../hooks/usePWAInstall'
import { usePushPermission } from '../hooks/usePushPermission'
```

2. Right after the existing `CHECKLIST` array (around line 51), add a new list of "action tasks" (items that aren't DB fields but actions the user must take in the browser):

```typescript
interface ActionTask {
  key: string
  label: string
  labelHe: string
  points: number
  icon: React.ElementType
  done: boolean
  canPerform: boolean
  onClick: () => void | Promise<void>
  hidden?: boolean
}
```

3. Inside the `ProfileCompletionBar` component function (around line 108, after `const isHe = locale === 'he'`), add:

```typescript
  const pwa = usePWAInstall()
  const push = usePushPermission()

  const actionTasks: ActionTask[] = [
    {
      key: 'install_pwa',
      label: 'Add to home screen',
      labelHe: 'הוסף למסך הבית',
      points: 5,
      icon: Smartphone,
      done: pwa.isInstalled,
      canPerform: pwa.canInstall || pwa.isIOS,
      onClick: async () => {
        if (pwa.isIOS) {
          alert(
            isHe
              ? 'כדי להתקין: פתח בספארי → כפתור שיתוף → "הוסף לדף הבית"'
              : 'To install: open in Safari → Share button → "Add to Home Screen"',
          )
          return
        }
        await pwa.promptInstall()
      },
      hidden: pwa.isInstalled && typeof window !== 'undefined' && !pwa.canInstall,
    },
    {
      key: 'enable_push',
      label: 'Enable lead alerts',
      labelHe: 'אפשר התראות על לידים',
      points: 5,
      icon: Bell,
      done: push.hasPermission,
      canPerform: push.canRequest,
      onClick: async () => {
        if (push.canRequest) await push.requestPermission()
      },
      hidden: push.isUnsupported,
    },
  ]

  const visibleActionTasks = actionTasks.filter((t) => !t.hidden)
  const actionEarned = visibleActionTasks.reduce(
    (s, t) => s + (t.done ? t.points : 0),
    0,
  )
  const actionTotal = visibleActionTasks.reduce((s, t) => s + t.points, 0)
```

4. Update `percent` calculation to include action tasks:

```typescript
  const earned = CHECKLIST.reduce(
    (sum, item) => sum + (item.check(profile) ? item.points : 0),
    0,
  ) + actionEarned
  const percent = Math.min(Math.round((earned / (TOTAL_POINTS + actionTotal)) * 100), 100)
```

5. Inside the JSX, right before the "Incomplete items" block (around line 140), render the action tasks:

```tsx
      {/* Action tasks — PWA install + push permission */}
      {visibleActionTasks.some((t) => !t.done) && (
        <div className="space-y-2 mb-4">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">
            {isHe ? 'הגדרת התראות' : 'Notifications setup'}
          </p>
          {visibleActionTasks
            .filter((t) => !t.done)
            .map((t) => {
              const Icon = t.icon
              return (
                <button
                  key={t.key}
                  onClick={t.onClick}
                  disabled={!t.canPerform}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl
                             bg-purple-50/60 hover:bg-purple-100/80 disabled:opacity-50
                             transition-colors group"
                >
                  <Circle className="w-4 h-4 text-purple-500/50 flex-shrink-0" />
                  <Icon className="w-4 h-4 text-purple-600/70 flex-shrink-0" />
                  <span className="text-sm text-gray-700 flex-1 text-left rtl:text-right">
                    {isHe ? t.labelHe : t.label}
                  </span>
                  <span className="text-xs text-gray-400">+{t.points}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-purple-600 transition-colors rtl:rotate-180" />
                </button>
              )
            })}
        </div>
      )}
```

- [ ] **Step 2: Verify in preview**

Start preview, navigate to dashboard, confirm:
- On mobile viewport, the task list shows "Add to home screen" and "Enable lead alerts"
- Clicking "Add to home screen" fires the install prompt (or shows iOS instructions)
- Clicking "Enable lead alerts" fires `Notification.requestPermission`

Use `preview_resize` with preset `mobile` and `preview_screenshot` to verify visually.

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/src/components/ProfileCompletionBar.tsx
git commit -m "feat(dashboard): add PWA install + push permission as profile tasks"
```

---

### Task 14: Remove `PWAInstallBanner` and `PushBanner`

**Files:**
- Delete: `apps/dashboard/src/components/PWAInstallBanner.tsx`
- Delete: `apps/dashboard/src/components/PushBanner.tsx` (verify first)
- Modify: `apps/dashboard/src/App.tsx`

- [ ] **Step 1: Check what else uses `PushBanner`**

```bash
grep -rn "PushBanner\|PWAInstallBanner" apps/dashboard/src/
```

Expected: only imports in `App.tsx` and the component files themselves. If there are other usages, stop and tell the user.

- [ ] **Step 2: Remove references from `App.tsx`**

Delete imports (~line 16):
```typescript
import { PWAInstallBanner } from './components/PWAInstallBanner'
import PushBanner from './components/PushBanner'
```

Delete the render lines (~lines 216–217):
```typescript
{!onboardingActive && <PWAInstallBanner />}
{!onboardingActive && <PushBanner />}
```

- [ ] **Step 3: Delete the component files**

```bash
git rm apps/dashboard/src/components/PWAInstallBanner.tsx apps/dashboard/src/components/PushBanner.tsx
```

- [ ] **Step 4: Verify build**

Start `preview_start`, check `preview_logs` with `level: "error"`. No references to `PWAInstallBanner` or `PushBanner` should appear.

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/src/App.tsx
git commit -m "refactor(dashboard): remove PWA + push banners (moved to profile tasks)"
```

---

## Phase 8: End-to-End Verification

### Task 15: Manual test — Rebeca flow

- [ ] **Step 1: Start preview**

Use `preview_start` with an existing dashboard config.

- [ ] **Step 2: Create a test contractor via Rebeca**

Via Supabase MCP `execute_sql`, manually create a fully-Rebeca'd test user:

```sql
-- Insert a test auth user via supabase admin API is not possible from SQL.
-- Instead: pick an existing test user that already has contractor data and
-- clear their stripe_payment_method_id + unset a real email.
SELECT u.id, u.email, c.professions, c.zip_codes, c.working_days, s.stripe_payment_method_id
FROM auth.users u
LEFT JOIN contractors c ON c.user_id = u.id
LEFT JOIN subscriptions s ON s.user_id = u.id
WHERE u.email LIKE '%@app.masterleadflow.com' OR u.email LIKE '%@signup.masterleadflow.com'
LIMIT 5;
```

Pick one test user. Clear their payment method:

```sql
UPDATE subscriptions SET stripe_payment_method_id = NULL WHERE user_id = '<TEST_USER_ID>';
```

- [ ] **Step 3: Generate a magic link via Rebeca flow**

Use the `magic-login` function's `generate` action directly via curl with the service role key, or trigger Rebeca's confirmation manually. This part depends on your existing testing workflow — use whatever approach works fastest.

- [ ] **Step 4: Click the magic link in the preview browser**

Navigate to the magic link URL. Expected flow:
1. AutoLogin exchanges token
2. Redirects to `/onboarding`
3. Wizard loads → `useOnboardingPlan` computes only `['credentials', 'credit_card']` (assuming user has Rebeca data)
4. Credentials step appears → user fills email/password → clicks Continue
5. Credit card step appears → user fills a Stripe test card (`4242 4242 4242 4242`, any future date, any CVC) → clicks "Start free trial"
6. Redirects to dashboard
7. Dashboard shows task list with "Add to home screen" and "Enable lead alerts"

- [ ] **Step 5: Verify DB state after test**

```sql
SELECT u.email, s.stripe_payment_method_id, s.stripe_customer_id
FROM auth.users u
JOIN subscriptions s ON s.user_id = u.id
WHERE u.id = '<TEST_USER_ID>';
```

Expected: `stripe_payment_method_id` is populated with a `pm_...` value, `stripe_customer_id` is populated with a `cus_...` value, email updated to the one they typed.

---

### Task 16: Manual test — Website signup flow

- [ ] **Step 1: Create a brand-new user via the `/login?mode=signup` page**

Use the existing website signup flow with email+password OR Google OAuth. No Rebeca data.

- [ ] **Step 2: Verify wizard shows ALL steps**

Expected `plan.steps`: `['phone', 'profession', 'area', 'hours', 'credit_card']` (credentials is skipped because they just signed up with a real email or OAuth).

- [ ] **Step 3: Fill each step, verify data persists**

After each Next click, check the DB via SQL:

```sql
SELECT professions, zip_codes, working_days FROM contractors WHERE user_id = '<NEW_USER>';
SELECT whatsapp_phone, phone, counties FROM profiles WHERE id = '<NEW_USER>';
```

- [ ] **Step 4: Complete credit card with Stripe test card, verify landing on dashboard**

---

### Task 17: Final acceptance checklist

- [ ] PWA install prompt no longer fires on magic-link click
- [ ] `/complete-account` route returns 404 (or just silently not-found by the router)
- [ ] `/onboarding` loads for all new users
- [ ] Rebeca users see 2 steps (credentials + card) — verified by reading `steps` in devtools
- [ ] Website signup users see all remaining steps
- [ ] "Skip for now" on credit card step sends user to dashboard without crashing
- [ ] Dashboard shows "Add to home screen" and "Enable lead alerts" as tasks when not yet done
- [ ] Tasks disappear once completed (PWA installed, push granted)
- [ ] Existing paid users with `stripe_payment_method_id` set never see the credit card step
- [ ] No console errors in preview
- [ ] `grep -rn "CompleteAccount\|PWAInstallBanner\|PushBanner" apps/dashboard/src/` returns zero hits
- [ ] `grep -rn "phase === 'install'\|phase === 'push'" apps/dashboard/src/pages/OnboardingWizard.tsx` returns zero hits

---

## Rollback Plan

If anything goes wrong in production:

1. **Frontend:** `git revert` the merge commit; Vercel auto-redeploys the previous version.
2. **Edge functions:** The old `CompleteAccount` page still exists in git history. Re-deploy the previous `whatsapp-webhook` via Supabase dashboard (it keeps version history), and the old redirect target `/complete-account` will be back.
3. **DB migration:** The `stripe_payment_method_id` column is additive and nullable — no rollback needed. If you want to drop it:
   ```sql
   ALTER TABLE subscriptions DROP COLUMN IF EXISTS stripe_payment_method_id;
   ```

## Notes for the Implementer

- **Trial clock is NOT changed** (Option B). Rebeca continues to create the 7-day trial when she finishes the WhatsApp conversation. The credit card step only *saves* a payment method for later auto-charge; it does not restart the clock.
- **The wizard is idempotent:** re-entering it after completion shows zero steps and auto-redirects to `/`. This is intentional — it lets us direct abandoned users back to `/onboarding` via email/WhatsApp nudges without breaking their experience.
- **The old `onboarding_step` column is still used** by `CredentialsStep` and Rebeca nudges. Don't touch it.
- **Do NOT change `create-checkout-session`.** It's still used by the Paywall page for manual upgrades. This plan adds a *parallel* flow (SetupIntent) for onboarding card capture.
