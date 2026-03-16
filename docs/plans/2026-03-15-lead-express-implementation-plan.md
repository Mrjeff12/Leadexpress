# Lead Express — Implementation Plan

> Created: 2026-03-15
> Design Doc: ./2026-03-15-lead-express-mvp-design.md
> Timeline: 7 weeks to MVP

---

## Week 1: Foundation

### 1.1 Project Setup
- [ ] Initialize monorepo structure:
  ```
  leadexpress/
  ├── apps/dashboard/        # React (reuse existing whatsapp-main)
  ├── services/
  │   ├── wa-listener/       # Node.js + whatsapp-web.js
  │   ├── parser/            # OpenAI parser worker
  │   ├── matching/          # Matching engine worker
  │   ├── notification/      # Telegram sender worker
  │   └── telegram-bot/      # Telegram webhook handler
  ├── packages/shared/       # Types, constants, utils
  ├── supabase/migrations/   # SQL migrations
  ├── docker-compose.yml
  └── package.json
  ```
- [ ] Set up pnpm workspaces
- [ ] Configure TypeScript, ESLint across all packages
- [ ] Create shared types package (Lead, Contractor, Plan, etc.)

### 1.2 Supabase Setup
- [ ] Create Supabase project
- [ ] Run migration: create all 6 tables (profiles, plans, subscriptions, contractors, groups, leads)
- [ ] Add indexes
- [ ] Enable RLS policies:
  - Contractors see only their own profile
  - Admin sees everything
- [ ] Seed plans table:
  - Starter: $149/mo, 5 groups, 1 profession, 3 zips
  - Pro: $249/mo, 15 groups, 3 professions, 8 zips
  - Unlimited: $399/mo, unlimited everything
- [ ] Configure Auth (email + password)
- [ ] Test: signup, login, profile creation

### 1.3 Stripe Integration
- [ ] Create Stripe account + products + prices
- [ ] Create Supabase Edge Function: `stripe-webhook`
  - Handle: checkout.session.completed
  - Handle: customer.subscription.updated
  - Handle: customer.subscription.deleted
  - Handle: invoice.payment_failed
- [ ] Create Stripe Checkout flow (called from dashboard)
- [ ] Create Stripe Customer Portal link (manage subscription)
- [ ] Test: full subscription lifecycle (signup -> pay -> cancel)

### Week 1 Deliverable:
> Database ready, auth working, Stripe subscriptions functional.
> A user can sign up, choose a plan, pay, and see their profile.

---

## Week 2: Core Engine

### 2.1 WhatsApp Listener Service
- [ ] Set up Node.js service with whatsapp-web.js
- [ ] Implement session persistence (LocalAuth with Docker volume)
- [ ] Implement group message handler:
  ```typescript
  client.on('message', async (msg) => {
    if (!isMonitoredGroup(msg.from)) return;
    // dedup by message ID
    // push to Redis queue
  });
  ```
- [ ] Implement health check (heartbeat every 30s to Redis)
- [ ] Implement reconnection with exponential backoff
- [ ] Implement graceful shutdown (save session before exit)
- [ ] Create Docker container with Puppeteer
- [ ] Test: connect to 2-3 test groups, verify messages arrive

### 2.2 Redis + BullMQ Setup
- [ ] Set up Upstash Redis (or local Redis in Docker)
- [ ] Create queues:
  - `raw-messages` (WA listener -> parser)
  - `parsed-leads` (parser -> matching)
  - `notifications` (matching -> Telegram)
- [ ] Configure retry policies (3 attempts, exponential backoff)
- [ ] Test: push message to queue, verify worker picks it up

### 2.3 OpenAI Parser Worker
- [ ] Create parser worker that consumes `raw-messages` queue
- [ ] Implement OpenAI structured output call:
  ```
  Input: raw WhatsApp message
  Output: { profession, zip_code, city, budget_min, budget_max,
            urgency, summary, is_lead: boolean }
  ```
- [ ] Implement content-based dedup (SHA256 hash of normalized message)
- [ ] Filter: if is_lead = false, skip
- [ ] Save parsed lead to Supabase `leads` table
- [ ] Push to `parsed-leads` queue
- [ ] Test: 20 sample messages (English, Hebrew, Spanglish, non-leads)

### Week 2 Deliverable:
> WhatsApp messages flow into Redis, get parsed by OpenAI,
> and appear as structured leads in the database.

---

## Week 3: Delivery

### 3.1 Matching Engine Worker
- [ ] Create worker that consumes `parsed-leads` queue
- [ ] Implement matching logic:
  ```sql
  SELECT c.user_id, p.telegram_chat_id
  FROM contractors c
  JOIN profiles p ON p.id = c.user_id
  JOIN subscriptions s ON s.user_id = c.user_id
  WHERE c.is_active = true
    AND s.status = 'active'
    AND lead.profession = ANY(c.professions)
    AND lead.zip_code = ANY(c.zip_codes)
  ```
- [ ] Respect plan limits (check max_groups, max_professions, max_zips)
- [ ] Update lead.sent_to_count
- [ ] Push matched contractors to `notifications` queue
- [ ] Test: create test contractors, verify matching works

### 3.2 Telegram Bot
- [ ] Create Telegram bot via @BotFather
- [ ] Implement webhook handler (Express/Hono):
  - `/start` command: link Telegram chat_id to user profile
  - Handle inline button callbacks (future use)
- [ ] Implement notification worker:
  - Consume `notifications` queue
  - Format lead as Telegram message:
    ```
    NEW LEAD - HVAC

    AC Install - Miami, FL 33101
    Budget: ~$2,000
    3 bedrooms, central AC
    Available: Today
    ```
  - Send via Telegram Bot API
  - Handle errors + retry
- [ ] Implement rate limiting (max 30 msgs/sec Telegram limit)
- [ ] Test: end-to-end flow — WA message -> parsed -> matched -> Telegram delivered

### 3.3 Docker Compose
- [ ] Create docker-compose.yml with all services:
  - wa-listener-1, wa-listener-2
  - redis
  - parser-worker
  - matching-worker
  - notification-worker
  - telegram-bot
- [ ] Configure volumes for WA sessions + Redis persistence
- [ ] Configure environment variables (.env)
- [ ] Test: `docker compose up` — full pipeline works

### Week 3 Deliverable:
> End-to-end pipeline working: WhatsApp message arrives in a group,
> gets parsed, matched to contractors, and delivered via Telegram.

---

## Week 4: Contractor Dashboard

### 4.1 Refactor Existing React App
- [ ] Convert existing whatsapp-main to Lead Express branding
- [ ] Switch from RTL-only to LTR default with Hebrew toggle
- [ ] Update Sidebar with Lead Express navigation:
  - Overview
  - My Leads
  - Groups
  - Settings
  - Plan & Billing
- [ ] Update Header with Lead Express logo + user menu
- [ ] Remove unused pages (SalesBot, Campaigns, Organizations, etc.)

### 4.2 Auth Pages
- [ ] Sign Up page (email, password)
- [ ] Login page
- [ ] Connect to Supabase Auth
- [ ] Protected routes (redirect to login if not authenticated)
- [ ] Role-based routing (contractor vs admin)

### 4.3 Onboarding Flow
- [ ] Step 1: Profile (name, phone)
- [ ] Step 2: Professions (multi-select: HVAC, Renovation, Fencing, Cleaning)
- [ ] Step 3: Zip Codes (input up to N zips based on plan)
- [ ] Step 4: Connect Telegram (show QR/link, verify connection)
- [ ] Step 5: Group Links (optional — paste WA group invite links)
- [ ] Step 6: Choose Plan + Stripe Checkout redirect
- [ ] Save all data to Supabase on completion

### 4.4 Dashboard Pages
- [ ] **Overview**: KPIs (leads this month, groups monitored, plan info)
- [ ] **My Leads**: List of all leads sent to this contractor
  - Filter by profession, zip, date
  - Lead card: profession icon, location, budget, urgency badge, timestamp
- [ ] **Groups**: List of WA groups being monitored
  - Show: name, category, message count, last activity
- [ ] **Settings**: Edit professions, zip codes, Telegram reconnect
- [ ] **Plan & Billing**: Current plan, upgrade button, Stripe portal link

### 4.5 Design (emitly style)
- [ ] Implement cream/olive green color palette
- [ ] Sidebar with green active pill
- [ ] Glass cards with soft shadows
- [ ] KPI cards with trend badges
- [ ] Clean typography (Inter font)
- [ ] Responsive (mobile-friendly)

### Week 4 Deliverable:
> Contractor can sign up, go through onboarding, connect Telegram,
> choose plan, pay, and see their leads in a beautiful dashboard.

---

## Week 5: Admin Dashboard

### 5.1 Admin Layout
- [ ] Create separate admin layout/section (same app, role-gated)
- [ ] Admin Sidebar:
  - Overview
  - Contractors
  - Leads
  - Groups
  - Revenue
  - WA Health
  - Settings

### 5.2 Admin Overview
- [ ] KPI cards:
  - MRR (sum of active subscriptions)
  - Active contractors
  - Leads today / this week / this month
  - Active groups
  - WA session status (healthy/disconnected)
- [ ] Recent activity feed
- [ ] Quick alerts (failed payments, disconnected WA)

### 5.3 Contractors Management
- [ ] Table: name, email, plan, leads received, status, joined date
- [ ] Search + filter by plan, status
- [ ] Click -> contractor detail:
  - Profile info
  - Subscription & billing history
  - Leads received (list)
  - Groups assigned
  - Actions: pause, upgrade, delete

### 5.4 Leads Management
- [ ] Table: lead summary, source group, profession, zip, status, sent to, time
- [ ] Search + filter by profession, zip, status, date range
- [ ] Click -> lead detail:
  - Raw message
  - Parsed fields
  - Which contractors received it
  - Timeline

### 5.5 Groups Management
- [ ] Table: group name, category, status, message count, last activity
- [ ] Add group (paste WA group ID)
- [ ] Pause/activate group
- [ ] Stats per group: messages/day, leads/day, quality score

### 5.6 Revenue Dashboard
- [ ] MRR chart (monthly trend)
- [ ] Breakdown by plan tier
- [ ] New signups this month
- [ ] Churn count + rate
- [ ] Failed payments list
- [ ] Link to Stripe dashboard

### 5.7 WA Health
- [ ] Per-account status: connected/disconnected, last heartbeat
- [ ] Groups per account
- [ ] Message throughput (msgs/hour)
- [ ] Alerts if account goes down

### Week 5 Deliverable:
> Admin can see all contractors, all leads, all groups,
> revenue metrics, and WhatsApp connection health.

---

## Week 6: Polish & Testing

### 6.1 Design Polish
- [ ] Final emitly-style design pass on all pages
- [ ] Animations and transitions
- [ ] Loading states and skeletons
- [ ] Empty states ("No leads yet — they're coming!")
- [ ] Error states and error boundaries
- [ ] Toast notifications

### 6.2 Bilingual Support
- [ ] i18n setup (react-i18next or similar)
- [ ] English strings (primary)
- [ ] Hebrew strings
- [ ] Language toggle in header
- [ ] RTL support when Hebrew is selected

### 6.3 Edge Cases
- [ ] Handle WA listener disconnection gracefully
- [ ] Handle OpenAI API failures (retry + fallback)
- [ ] Handle Telegram delivery failures
- [ ] Handle Stripe webhook failures
- [ ] Handle duplicate leads across groups
- [ ] Handle non-lead messages (chatter, memes, images)
- [ ] Handle contractor with expired subscription

### 6.4 Testing
- [ ] Test full onboarding flow
- [ ] Test lead pipeline end-to-end (WA -> Telegram)
- [ ] Test Stripe subscription lifecycle
- [ ] Test WA reconnection
- [ ] Test with real WhatsApp groups (2-3 test groups)
- [ ] Test with 5 beta contractors
- [ ] Load test: 100 messages in 10 minutes

### 6.5 Deployment
- [ ] Set up Hetzner VPS
- [ ] Deploy Docker containers
- [ ] Set up SSL + domain
- [ ] Deploy dashboard to Vercel
- [ ] Configure DNS
- [ ] Set up monitoring (UptimeRobot + Sentry)
- [ ] Set up log collection

### Week 6 Deliverable:
> Everything polished, tested, and deployed.
> Ready for beta users.

---

## Week 7: Beta Launch

### 7.1 Beta Users
- [ ] Recruit 5-10 Israeli contractors in South Florida
- [ ] Help them through onboarding (hands-on)
- [ ] Monitor lead delivery quality
- [ ] Collect feedback daily
- [ ] Fix issues in real-time

### 7.2 Growth Setup
- [ ] Create "Lead of the Week" Telegram channel
- [ ] Prepare referral program ($50 off for referrer)
- [ ] Create simple landing page (on the dashboard domain)
- [ ] Prepare "First Job Free" guarantee copy

### 7.3 Iterate
- [ ] Adjust OpenAI parsing prompt based on real messages
- [ ] Add/remove professions based on demand
- [ ] Adjust matching logic if needed
- [ ] Tune notification frequency
- [ ] Fix any bugs from beta feedback

### Week 7 Deliverable:
> 5-10 paying contractors using the platform daily.
> Product-market fit validation.

---

## Post-MVP Roadmap

| Month | Feature | Impact |
|-------|---------|--------|
| 2 | Weekly Telegram report (Pro+) | Retention |
| 2 | More professions (plumbing, electrical) | Growth |
| 3 | Smart morning message (Unlimited) | Upgrade incentive |
| 3 | Supplier dashboard + payouts | Supply moat |
| 4 | "Did you close?" follow-up | ROI proof |
| 4 | AI schedule builder (Unlimited) | Premium value |
| 5 | Expand to NY/NJ | Growth |
| 6 | Mobile app / PWA | UX improvement |

---

## Quick Reference: Key Commands

```bash
# Start everything locally
docker compose up

# Run just the dashboard
cd apps/dashboard && pnpm dev

# Deploy to Hetzner
ssh root@your-server 'cd /app && docker compose pull && docker compose up -d'

# Supabase migrations
npx supabase db push

# Check WA listener health
curl http://your-server:3000/health
```

---

## Files to Create First (Week 1, Day 1)

1. `/package.json` — monorepo root
2. `/pnpm-workspace.yaml` — workspace config
3. `/supabase/migrations/001_initial_schema.sql` — 6 tables
4. `/packages/shared/src/types.ts` — shared TypeScript types
5. `/apps/dashboard/` — refactored from whatsapp-main
6. `/.env.example` — all required environment variables
7. `/docker-compose.yml` — all services
