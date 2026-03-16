# WhatsApp-First Contractor Registration

## Overview

Enable contractors to register and start receiving leads entirely through WhatsApp,
eliminating the need to visit the website for initial signup. Triggered by outbound
marketing campaigns that direct contractors to send a message to our WhatsApp number.

**Campaign promise:** "Send a message → 4 questions → start getting filtered leads."

## Flow (4 steps + confirm)

```
Unknown phone sends message
│
▼  (phone not found in profiles)
│
├─ Step 1: PROFESSION + STATE ──────────────────────────┐
│  Bot: "Welcome to LeadExpress! 🔧                     │
│        4 quick questions and you'll start getting      │
│        filtered leads straight to WhatsApp.            │
│                                                        │
│        What type of work do you do?                    │
│        1️⃣ ❄️ HVAC    2️⃣ 🔨 Renovation                │
│        3️⃣ 🧱 Fencing  4️⃣ ✨ Cleaning                 │
│        5️⃣ 🔑 Locksmith 6️⃣ 🚰 Plumbing               │
│        7️⃣ ⚡ Electrical 8️⃣ 📋 Other                  │
│                                                        │
│        Reply with numbers. Example: 1, 6"              │
│                                                        │
│  User: "1, 6"                                          │
│                                                        │
│  Bot: "HVAC & Plumbing — great!                        │
│        Which state do you work in?                     │
│        1️⃣ 🌴 Florida                                  │
│        2️⃣ 🗽 New York                                 │
│        3️⃣ 🤠 Texas"                                   │
│                                                        │
│  Note: profession + state are two exchanges in one     │
│  logical step. State selection happens as a sub-step   │
│  within the same 'profession_and_state' step.          │
├────────────────────────────────────────────────────────┘
│
├─ Step 2: CITIES ──────────────────────────────────────┐
│  Bot: "Florida — select your service cities.           │
│        Reply with numbers:                             │
│        1️⃣ Miami  2️⃣ Fort Lauderdale  ...              │
│        Example: 1, 3, 5"                               │
│                                                        │
│  User: "1, 3"                                          │
│  → ZIP codes auto-populated from city-zips mapping     │
├────────────────────────────────────────────────────────┘
│
├─ Step 3: NAME ────────────────────────────────────────┐
│  Bot: "Almost done! What's your full name?"            │
│  User: "John Smith"                                    │
├────────────────────────────────────────────────────────┘
│
├─ Step 4: EMAIL ───────────────────────────────────────┐
│  Bot: "Last one — what's your email?                   │
│        (We'll send you a dashboard login link)"        │
│  User: "john@gmail.com"                                │
│  → Validate email format (strict regex)                │
│  → Check email not already in auth.users               │
├────────────────────────────────────────────────────────┘
│
├─ CONFIRM ─────────────────────────────────────────────┐
│  Bot: "Your profile:                                   │
│        👤 John Smith (john@gmail.com)                  │
│        🔧 HVAC, Plumbing                              │
│        📍 Miami, Fort Lauderdale (32 ZIPs)            │
│        📅 Mon-Fri                                     │
│                                                        │
│        Reply YES to confirm or REDO to start over."    │
├────────────────────────────────────────────────────────┘
│
▼  User: "YES"
│
ACCOUNT CREATION:
│
├─ 1. supabase.auth.admin.createUser({
│        email, email_confirm: true,
│        user_metadata: { full_name }
│     })
│     → Trigger handle_new_user() auto-creates profile
│
├─ 2. UPDATE profiles SET
│        phone = {phone},
│        whatsapp_phone = {phone}
│     WHERE id = {new_user_id}
│
├─ 3. INSERT contractors (
│        user_id, professions, zip_codes,
│        working_days: [1,2,3,4,5],
│        is_active: true, wa_notify: true
│     )
│
├─ 4. INSERT subscriptions (
│        user_id, plan_id: starter,
│        status: 'trialing',
│        current_period_end: NOW() + 7 days
│     )
│
├─ 5. supabase.auth.admin.generateLink({
│        type: 'magiclink', email
│     })
│
└─ 6. Send WhatsApp confirmation + magic link
│
▼
Bot: "✅ All set, John!
      You'll start receiving matching leads here.
      📧 Dashboard login link sent to john@gmail.com
      Send MENU anytime for options."
```

## State Management

```typescript
interface WaRegistrationState {
  phone: string;
  step: 'profession' | 'state_select' | 'city' | 'name' | 'email' | 'confirm';
  professions: string[];
  stateName: string;       // "FL" / "NY" / "TX"
  cities: string[];
  zipCodes: string[];
  fullName: string;
  email: string;
}
```

- Redis key: `le:wa-register:{phone}`
- TTL: 1 hour
- Separate from existing `WaOnboardState` (no userId at creation time)

## Message Router (priority order)

```
Incoming message
│
├─ 1. Check registration lock (Redis SETNX le:wa-lock:{phone})
│     → If locked, skip (prevent race conditions)
│
├─ 2. getRegistrationState(phone)
│     → handleRegistrationStep()
│
├─ 3. getOnboardState(phone)
│     → handleOnboardingStep()       [existing]
│
├─ 4. findProfileByWhatsApp(phone)
│     → handleExistingUser()         [existing]
│
├─ 5. findProfileByPhone(phone)
│     → handleFirstContact()         [existing]
│
├─ 6. checkOptOut(phone)
│     → silently ignore              [new]
│
└─ 7. Nothing found
      → startRegistration(phone)     [new — replaces "visit website"]
```

## Required Migrations (before implementation)

### Migration 009: Registration prerequisites

```sql
-- 1. Add 'trialing' to subscription status CHECK
ALTER TABLE public.subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_status_check;
ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_status_check
  CHECK (status IN ('active', 'past_due', 'canceled', 'paused', 'trialing'));

-- 2. Unique constraint on whatsapp_phone
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_whatsapp_phone_unique
  UNIQUE (whatsapp_phone);

-- 3. Unique index on phone (where not null)
CREATE UNIQUE INDEX idx_profiles_phone_unique
  ON public.profiles (phone)
  WHERE phone IS NOT NULL;

-- 4. Opt-out tracking table
CREATE TABLE public.wa_opt_outs (
  phone       TEXT PRIMARY KEY,
  opted_out_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.wa_opt_outs ENABLE ROW LEVEL SECURITY;
CREATE POLICY wa_opt_outs_admin ON public.wa_opt_outs
  FOR ALL USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );
```

## Edge Cases

| Case | Behavior |
|------|----------|
| Phone already in profiles | Existing flow (handleFirstContact), no registration |
| Email already in auth.users | "This email already has an account. Try a different email." Stay on email step |
| Invalid email format | "That doesn't look right. Please send your email (e.g. name@gmail.com)" |
| TTL expires mid-registration | Next message: "Your previous session timed out. Let's start fresh!" → restart |
| User sends STOP/CANCEL | Clear state, add to wa_opt_outs, never message again |
| User sends MENU/HELP mid-flow | "You're on step 2/4. Send CONTINUE to resume or REDO to restart." |
| createUser() fails | Log error, keep state in Redis. "Something went wrong. Send YES to try again." |
| Concurrent messages (race) | Redis SETNX lock per phone, second message gets "One moment..." |
| Rate limit exceeded | "We're experiencing high demand. Please try again in a few minutes." |

## Security

1. **Per-phone lock**: Redis `SETNX le:wa-lock:{phone}` with 30s TTL prevents race conditions
2. **Rate limiting**: Max 50 new registrations/hour globally (Redis counter)
3. **Opt-out compliance**: STOP/UNSUBSCRIBE honored globally via wa_opt_outs table
4. **Email verification**: magic link serves as email verification
5. **No password stored**: account created with auto-generated password, user sets own via magic link

## Working Days Default

Working days default to Mon-Fri `[1,2,3,4,5]`. Contractors can change via
MENU → "Update working days" after registration. This reduces registration
from 6 steps to 4 steps + confirm.

## Magic Link Strategy

- **Immediate**: sent right after account creation with dashboard context
- **Day 2 reminder**: if user hasn't logged into dashboard, send WhatsApp reminder
  "📧 Don't forget — your dashboard is ready: [magic link]"
- **Day 6 reminder**: "Your trial ends tomorrow. Visit leadexpress.com to upgrade."

## Architecture Notes

- Registration logic lives in `services/whatsapp-notify/src/handlers/registration.ts` (new file)
- Reuses existing helpers: `parseSelections()`, `getCitiesByState()`, `getAllZipsForCities()`
- Reuses existing `sendText()` for all WhatsApp messages
- Uses Supabase service key (admin API) for createUser + generateLink
- Existing onboarding flow (`onboarding.ts`) unchanged — only the "not found" branch is redirected
