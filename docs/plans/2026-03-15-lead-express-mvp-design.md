# Lead Express — MVP Design Document

> Created: 2026-03-15
> Status: APPROVED
> Author: Jeff + Claude Expert Team

---

## 1. Vision

Lead Express is a smart lead routing platform for home service contractors in the US.
We listen to WhatsApp groups where leads are posted, parse them with AI, and send
filtered, relevant leads to contractors via Telegram — based on their profession,
zip code, and plan tier.

**One sentence:** "Stop scrolling 20 WhatsApp groups. Get only the jobs that match you."

---

## 2. Target Market

### Phase 1 — Israeli contractors in South Florida
- HVAC / AC Install & Repair
- General Renovation / Remodeling
- Fencing & Railing
- Garage Cleaning / Pressure Washing

### Phase 2 — Expand to
- Other communities (Russian, Brazilian, Hispanic)
- Other geographies (NY/NJ, Texas, California)
- Other professions (plumbing, electrical, painting, landscaping)

---

## 3. How It Works

```
WhatsApp Groups (our accounts listen)
        |
        v
OpenAI API parses each message:
  -> profession, zip code, budget, urgency
        |
        v
Matching Engine:
  -> Find all contractors matching profession + zip
  -> Respect plan limits (max groups, max professions, max zips)
        |
        v
Telegram Bot sends to ALL matching contractors:
  "AC Install - Miami 33101 - Budget ~$2K - Today"
        |
        v
Contractor sees it, goes back to group, calls the customer.
We DON'T intermediate the sale. We just filter and deliver.
```

### Key Principle: We are a FILTER, not a marketplace.
- No payment between contractor and customer
- No "did you close?" tracking in V1
- No round robin — all matching contractors see the lead
- Just like the WhatsApp group, but smart and filtered

---

## 4. Pricing

| | Starter $149/mo | Pro $249/mo | Unlimited $399/mo |
|--|-----------------|-------------|-------------------|
| WhatsApp groups monitored | 5 | 15 | Unlimited |
| Professions | 1 | 3 | Unlimited |
| Zip codes | 3 | 8 | Unlimited |
| Leads | Unlimited | Unlimited | Unlimited |
| Weekly Telegram report | - | Yes | Yes |
| Smart morning message | - | - | Yes (Phase 2) |
| AI schedule builder | - | - | Yes (Phase 2) |
| Dashboard | Basic | Advanced | Full + stats |

- Payment: Stripe Subscriptions
- Billing: Monthly, cancel anytime
- Setup fee: $199 one-time (optional — test both with/without)

---

## 5. Users & Roles

| Role | What they do | Interface |
|------|-------------|-----------|
| Contractor | Pays subscription, receives leads via Telegram | Dashboard + Telegram |
| Admin (Jeff) | Manages everything — contractors, groups, leads, revenue | Admin Dashboard |
| Supplier | Phase 2 — WhatsApp group admins earning commissions | Supplier Dashboard (future) |

---

## 6. Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Frontend | React 19 + Vite + TypeScript + Tailwind + shadcn | Already have it, modern |
| Backend/DB | Supabase (Auth, PostgreSQL, Edge Functions) | Fast to build, managed |
| WhatsApp | Node.js + whatsapp-web.js | Most stable WA library |
| AI Parsing | OpenAI API (GPT-4o-mini) | Cheap, fast, accurate |
| Outbound | Telegram Bot API | Free, no bans, rich messages |
| Payments | Stripe Subscriptions | Industry standard |
| Queue | Redis + BullMQ (Upstash) | Reliable message pipeline |
| Hosting | Hetzner VPS (WA listener) + Vercel (dashboard) | Cheap, reliable |
| Design | emitly-style: cream/green, glass cards, clean | Per reference images |
| Language | Bilingual: English + Hebrew | Market requirement |

---

## 7. Architecture

```
+--------------------------------------------------+
|              HETZNER VPS (Docker)                 |
|                                                   |
|  wa-listener-1 --+                                |
|  wa-listener-2 --+--> Redis/BullMQ               |
|                       |                           |
|                  parser-worker (OpenAI)            |
|                       |                           |
|                  matching-worker                   |
|                       |                           |
|                  notification-worker --> Telegram  |
|                       |                           |
|                  telegram-bot (webhooks)           |
+--------------------------------------------------+
          |
          v
+--------------------------------------------------+
|              SUPABASE (Cloud)                     |
|                                                   |
|  PostgreSQL (profiles, contractors, leads, etc.)  |
|  Auth (signup, login, JWT)                        |
|  Edge Functions (Stripe webhooks)                 |
|  Realtime (dashboard live updates)                |
+--------------------------------------------------+
          |
          v
+--------------------------------------------------+
|              VERCEL (Free)                        |
|                                                   |
|  React Dashboard (contractor + admin)             |
+--------------------------------------------------+
```

---

## 8. Database Schema (MVP — 6 tables)

```sql
-- Extends Supabase auth.users
CREATE TABLE profiles (
  id                UUID PRIMARY KEY REFERENCES auth.users(id),
  role              TEXT NOT NULL DEFAULT 'contractor',  -- 'contractor' | 'admin'
  full_name         TEXT NOT NULL,
  phone             TEXT,
  telegram_chat_id  BIGINT UNIQUE,
  preferred_locale  TEXT NOT NULL DEFAULT 'en',  -- 'en' | 'he'
  timezone          TEXT NOT NULL DEFAULT 'America/New_York',
  is_active         BOOLEAN NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE plans (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug              TEXT NOT NULL UNIQUE,  -- 'starter', 'pro', 'unlimited'
  name              TEXT NOT NULL,
  price_cents       INTEGER NOT NULL,      -- 14900 = $149
  max_groups        SMALLINT NOT NULL,
  max_professions   SMALLINT NOT NULL,
  max_zip_codes     SMALLINT NOT NULL,
  stripe_price_id   TEXT UNIQUE,
  is_active         BOOLEAN NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE subscriptions (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  plan_id                 UUID NOT NULL REFERENCES plans(id),
  stripe_subscription_id  TEXT UNIQUE,
  stripe_customer_id      TEXT NOT NULL,
  status                  TEXT NOT NULL DEFAULT 'active',
  current_period_end      TIMESTAMPTZ NOT NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE contractors (
  user_id         UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  professions     TEXT[] NOT NULL DEFAULT '{}',
  zip_codes       TEXT[] NOT NULL DEFAULT '{}',
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE groups (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wa_group_id     TEXT NOT NULL UNIQUE,
  name            TEXT NOT NULL,
  category        TEXT,  -- 'hvac', 'renovation', 'fencing', 'cleaning'
  status          TEXT NOT NULL DEFAULT 'active',
  message_count   INTEGER NOT NULL DEFAULT 0,
  last_message_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE leads (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id        UUID NOT NULL REFERENCES groups(id),
  wa_message_id   TEXT UNIQUE,
  content_hash    TEXT,  -- SHA256 of normalized message for dedup
  raw_message     TEXT NOT NULL,
  profession      TEXT,
  zip_code        TEXT,
  city            TEXT,
  budget_range    TEXT,
  urgency         TEXT DEFAULT 'warm',  -- 'hot', 'warm', 'cold'
  parsed_summary  TEXT,  -- clean summary for Telegram
  status          TEXT NOT NULL DEFAULT 'new',
  sent_to_count   INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_profiles_telegram ON profiles(telegram_chat_id) WHERE telegram_chat_id IS NOT NULL;
CREATE INDEX idx_profiles_role ON profiles(role);
CREATE INDEX idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status) WHERE status = 'active';
CREATE INDEX idx_contractors_active ON contractors(is_active) WHERE is_active = true;
CREATE INDEX idx_groups_status ON groups(status) WHERE status = 'active';
CREATE INDEX idx_leads_created ON leads(created_at DESC);
CREATE INDEX idx_leads_hash ON leads(content_hash) WHERE content_hash IS NOT NULL;
CREATE INDEX idx_leads_profession_zip ON leads(profession, zip_code);
```

---

## 9. Contractor Dashboard Pages

| Page | Description | Starter | Pro | Unlimited |
|------|------------|---------|-----|-----------|
| Overview | KPIs: leads this month, groups monitored | Yes | Yes | Yes |
| My Leads | Feed of all leads sent to you, with filters | Yes | Yes | Yes |
| Groups | See which WA groups are being monitored for you | Yes | Yes | Yes |
| Settings | Professions, zip codes, Telegram connection | Yes | Yes | Yes |
| Plan & Billing | Current plan, upgrade, Stripe portal | Yes | Yes | Yes |

---

## 10. Admin Dashboard Pages

| Page | Description |
|------|-------------|
| Overview | MRR, active contractors, leads today, groups, WA health |
| Contractors | All contractors — name, plan, leads received, status, actions |
| Leads | All leads — source group, profession, zip, status, sent to whom |
| Groups | All WA groups — name, status, message count, quality |
| Revenue | MRR breakdown by plan, new signups, churn, failed payments |
| WA Health | WhatsApp session status, account health, last heartbeat |
| Settings | Plans config, professions list, system settings |

---

## 11. Telegram Bot Messages

### New Lead:
```
NEW LEAD - HVAC

AC Install - Miami, FL 33101
Budget: ~$2,000
3 bedrooms, central AC
Available: Today

Source: Miami HVAC Leads group
```

### Weekly Report (Pro + Unlimited):
```
WEEKLY REPORT - Mar 8-15

Leads received: 23
  - HVAC: 18
  - Renovation: 5

Top areas:
  33101 (Miami): 8 leads
  33139 (Miami Beach): 6 leads
  33178 (Doral): 4 leads

Your plan: Pro ($249/mo)
Groups monitored: 12/15
```

### Morning Message (Unlimited, Phase 2):
```
Good morning Moshe!

Today (Tuesday):
- 10:00 AM: AC Install, Miami 33101, $2,000 (confirmed)

New leads in your area:
- AC Repair, Miami Beach 33139, $800, Today 3PM
  (12 min from your morning job!)

This week: 3 jobs, ~$8,800 estimated
```

---

## 12. Onboarding Flow

```
Step 1: Sign Up (30 sec)
  -> Name, email, phone, password

Step 2: What do you do? (30 sec)
  -> Select: HVAC | Renovation | Fencing | Cleaning

Step 3: Where do you work? (30 sec)
  -> Enter zip codes or select on map

Step 4: Connect Telegram (20 sec)
  -> Click link -> opens Telegram -> /start -> connected

Step 5: Send group links (optional)
  -> "Paste WhatsApp group invite links you're already in"

Step 6: Choose plan + pay
  -> Starter $149 | Pro $249 | Unlimited $399
  -> Stripe Checkout
```

---

## 13. WhatsApp Listener Rules

- 2-3 dedicated WhatsApp accounts (NOT contractor accounts)
- Max 35-50 groups per account
- READ ONLY — never send messages from listener accounts
- Warm up new accounts gradually (5 groups/day)
- Use residential proxies (1 per account)
- Persistent session storage (Docker volumes)
- Health checks every 30 seconds
- Auto-reconnect with exponential backoff
- Backup accounts pre-warmed and ready

---

## 14. OpenAI Parsing Prompt

```
You are a lead parser for home services in the US.
Extract the following from this WhatsApp message:

- profession: one of [hvac, renovation, fencing, cleaning, other, not_a_lead]
- zip_code: US zip code if mentioned (5 digits)
- city: city name if mentioned
- budget_min: number in USD
- budget_max: number in USD
- urgency: "hot" (today/tomorrow), "warm" (this week), "cold" (future/no date)
- summary: clean 1-line English summary for a contractor

If the message is NOT a lead (just chat, meme, greeting), set profession to "not_a_lead".

Message: "{message}"

Return JSON only.
```

---

## 15. Design Reference

Style: emitly dashboard
- Colors: Cream/olive green background, white cards, green accents
- Cards: Soft shadows, rounded corners (16-20px), glass effect
- Sidebar: Left-aligned, green active state pill
- Typography: Clean, modern, Inter font
- KPIs: Large numbers + small % change badges
- Bilingual: English primary, Hebrew toggle

---

## 16. Build Timeline

| Week | What | Details |
|------|------|---------|
| 1 | Foundation | Supabase DB + Auth + Stripe + project setup |
| 2 | Core Engine | WA Listener + OpenAI Parser + Redis/BullMQ |
| 3 | Delivery | Telegram Bot + Matching logic + notifications |
| 4 | Contractor UI | Dashboard: signup, onboarding, settings, leads, billing |
| 5 | Admin UI | Dashboard: contractors, leads, groups, revenue, WA health |
| 6 | Polish | Design (emitly style), testing, bilingual, edge cases |
| 7 | Launch | Beta with 5-10 contractors, iterate |

---

## 17. Phase 2 Features (AFTER MVP works)

| Feature | When | Why |
|---------|------|-----|
| Smart morning message (Gold) | Month 2 | Upgrade incentive |
| AI schedule builder (Gold) | Month 3 | Premium value |
| Supplier payouts | Month 3 | Build supply moat |
| Round Robin smart | Month 4 | If contractors complain about competition |
| "Did you close?" tracking | Month 4 | Prove ROI |
| Mobile app / PWA | Month 6 | Better UX |
| More professions + cities | Ongoing | Growth |

---

## 18. Success Metrics

| Metric | Month 1 | Month 3 | Month 6 |
|--------|---------|---------|---------|
| Active contractors | 10 | 30 | 75 |
| MRR | $1,500 | $5,000 | $15,000 |
| Leads/day | 20 | 50 | 150 |
| WA groups monitored | 20 | 50 | 120 |
| Churn (monthly) | <15% | <10% | <5% |

---

## 19. Monthly Costs (at 100 contractors)

| Item | Cost |
|------|------|
| Hetzner VPS (8GB) | $12 |
| Supabase Pro | $25 |
| Upstash Redis | $3 |
| OpenAI API | $10 |
| Residential proxies (2-3) | $30 |
| Domain + DNS | $1 |
| Vercel (free tier) | $0 |
| Telegram Bot API | $0 |
| **Total** | **~$81/mo** |

Revenue at 100 contractors: ~$20,000/mo
Net margin: ~99.6%

---

## 20. Expert Review Scores

| Expert | Area | Score | Key Recommendation |
|--------|------|-------|-------------------|
| DB Architect | Database | 4/10 -> Fixed | Simplified to 6 tables for MVP |
| Business Strategist | Business | 6.5/10 | Raise prices, accelerate Phase 2 |
| System Architect | Architecture | 6.5/10 | Add Redis/BullMQ, dedup, monitoring |

All critical recommendations have been incorporated into this plan.
