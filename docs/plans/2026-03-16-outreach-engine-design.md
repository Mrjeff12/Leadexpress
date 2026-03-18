# Outreach Engine — Design Document

**Date:** 2026-03-16
**Goal:** Build a multi-channel outreach system to convert WhatsApp group members into Lead Express paying customers
**Target:** 2,000 free trial signups in month 1 → convert to $99/month

---

## 1. Product Overview

### What It Is
An outreach engine integrated into the Lead Express admin dashboard that manages the full prospect lifecycle:
Personal WhatsApp → Follow-ups → Voice Bot → Trial Activation → Payment Conversion → Referral

### Core Channels
1. **Personal WhatsApp** (Green API) — cold outreach, feels human, "hey I'm from the same group"
2. **Company WhatsApp** (Twilio) — trial activation messages, lead delivery, payment reminders
3. **Voice Bot** (Biotix/external) — for prospects who don't respond to WhatsApp
4. **Pixel/Retargeting** (future) — Facebook/Instagram ads to warm prospects
5. **Referral Program** — paying users invite friends for free month

### Why Green API for Outreach
- Messages look 100% personal (not business account)
- Matches the "hey I'm from your group" angle
- Already integrated in wa-listener service
- Cost effective (~$15/month per number)
- Multiple numbers rotation prevents bans

---

## 2. The Growth Funnel

```
LAYER 1 — COLD OUTREACH (Volume)
  Personal WhatsApp: "Hey I'm from the same group..."
  Target: all prospects in stage "prospect"
  Goal: 10,000+ reached/month

LAYER 2 — NURTURE (Follow-up)
  Day 3: Follow-up with real data ("8 leads in your area this week")
  Day 7: Voice Bot call for non-responders

LAYER 3 — ACTIVATION (Trial)
  Company WhatsApp Bot: welcome → setup → first lead < 24h
  Daily summaries, value proof throughout trial week

LAYER 4 — CONVERSION (Payment)
  Day 6: "Trial ends tomorrow — 23 leads delivered"
  Day 7: Subscribe CTA
  Day 10: Voice Bot for non-converters
  Retarget with Pixel ads (future)

LAYER 5 — EXPANSION (Referral + Retention)
  Day 3 of payment: "Refer a friend, get 1 month free"
  Churned users: win-back flow after 30 days
```

---

## 3. Data Model

### New Tables

#### `flows`
The reusable playbook — a sequence of steps across channels.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID PK | |
| name | TEXT | "Cold Outreach v1" |
| description | TEXT | |
| status | ENUM | draft, active, paused, archived |
| target_filter | JSONB | {stages, groups, professions, areas} |
| entry_rules | ENUM | manual, auto_new_prospects |
| exit_rules | JSONB | ["replied", "trial_started", "opted_out"] |
| throttle_config | JSONB | {per_number_daily, delay_min_sec, delay_max_sec} |
| stats_cache | JSONB | Cached aggregate stats for dashboard |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

#### `flow_steps`
Each node in the visual flow canvas.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID PK | |
| flow_id | UUID FK | → flows |
| position | INTEGER | Order in sequence |
| step_type | ENUM | send_whatsapp, send_voice, wait, condition, exit |
| channel | ENUM | whatsapp_personal, whatsapp_business, voice, null |
| delay_hours | INTEGER | Wait time after previous step |
| condition_field | TEXT | For condition nodes: "replied", "delivered", "read" |
| condition_true_step_id | UUID | Branch if true |
| condition_false_step_id | UUID | Branch if false |
| canvas_x | FLOAT | X position on visual canvas |
| canvas_y | FLOAT | Y position on visual canvas |
| created_at | TIMESTAMPTZ | |

#### `flow_variants`
A/B message variants per step.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID PK | |
| step_id | UUID FK | → flow_steps |
| name | TEXT | "Referral angle", "Pain point angle" |
| content | TEXT | Message body with {{variables}} |
| voice_script | TEXT | For voice bot steps |
| weight | INTEGER | A/B split weight (e.g. 50) |
| stats_sent | INTEGER | Cached count |
| stats_delivered | INTEGER | |
| stats_read | INTEGER | |
| stats_replied | INTEGER | |
| created_at | TIMESTAMPTZ | |

#### `flow_enrollments`
Each prospect's journey through a flow.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID PK | |
| flow_id | UUID FK | → flows |
| prospect_id | UUID FK | → prospects |
| current_step_id | UUID FK | → flow_steps (nullable) |
| status | ENUM | active, completed, replied, opted_out, paused |
| enrolled_at | TIMESTAMPTZ | |
| last_step_at | TIMESTAMPTZ | |
| next_step_at | TIMESTAMPTZ | When the next step should execute |
| exited_at | TIMESTAMPTZ | |
| exit_reason | TEXT | |

#### `flow_sends`
Every message/call actually executed.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID PK | |
| enrollment_id | UUID FK | → flow_enrollments |
| step_id | UUID FK | → flow_steps |
| variant_id | UUID FK | → flow_variants |
| wa_account_id | UUID FK | → wa_accounts (for WhatsApp sends) |
| channel | ENUM | whatsapp_personal, whatsapp_business, voice |
| status | ENUM | queued, sending, sent, delivered, read, replied, failed |
| content_rendered | TEXT | Actual message sent (variables replaced) |
| wa_message_id | TEXT | Green API / Twilio message ID |
| error_message | TEXT | |
| queued_at | TIMESTAMPTZ | |
| sent_at | TIMESTAMPTZ | |
| delivered_at | TIMESTAMPTZ | |
| read_at | TIMESTAMPTZ | |
| replied_at | TIMESTAMPTZ | |

#### `flow_daily_stats` (materialized for fast analytics)

| Column | Type | Description |
|--------|------|-------------|
| id | UUID PK | |
| flow_id | UUID FK | |
| step_id | UUID FK | |
| variant_id | UUID FK | |
| date | DATE | |
| sent | INTEGER | |
| delivered | INTEGER | |
| read | INTEGER | |
| replied | INTEGER | |
| converted | INTEGER | Trial started |
| failed | INTEGER | |

### Modifications to Existing Tables

#### `wa_accounts` — add columns
- `daily_limit` INTEGER DEFAULT 50
- `warmup_day` INTEGER DEFAULT 0 (auto-increments, controls ramp-up)
- `health_score` INTEGER DEFAULT 100 (decreases on warnings)
- `last_warning_at` TIMESTAMPTZ
- `auto_paused` BOOLEAN DEFAULT false
- `purpose` ENUM ('listener', 'outreach', 'both')

---

## 4. Architecture

### New Service: `outreach-engine`

```
services/outreach-engine/
├── src/
│   ├── index.ts              — Service entry, starts scheduler
│   ├── config.ts             — Env vars, limits
│   ├── scheduler.ts          — BullMQ: checks next_step_at, enqueues sends
│   ├── sender/
│   │   ├── whatsapp.ts       — Green API sender with rotation
│   │   ├── voice.ts          — Biotix/external voice API integration
│   │   └── number-manager.ts — Account rotation, warmup, health tracking
│   ├── flow-engine.ts        — Evaluates conditions, advances enrollments
│   ├── webhook-handler.ts    — Receives delivery/read/reply webhooks
│   └── analytics.ts          — Aggregates stats into flow_daily_stats
```

### Message Flow

```
1. Scheduler (cron every 60s)
   → Query: enrollments WHERE next_step_at <= now() AND status = 'active'
   → For each: evaluate step, pick variant (weighted random), enqueue

2. BullMQ Queue "outreach-sends"
   → Worker picks up job
   → number-manager selects best wa_account (round-robin, respect limits)
   → sender sends via Green API / Voice API
   → Update flow_sends status
   → Random delay (45-120s) before next job

3. Webhook receives delivery/read/reply
   → Update flow_sends timestamps
   → If reply AND exit_rules includes "replied" → exit enrollment
   → Log to prospect_messages + prospect_events

4. Flow Engine (after each send completes)
   → Check condition nodes
   → Advance to next step or branch
   → Set next_step_at on enrollment
```

### Number Protection Strategy

```
Per-number limits (configurable per wa_account):
  - Warmup schedule: Day 1-3: 10/day, Day 4-7: 25/day,
    Day 8-14: 50/day, Day 15+: 80/day, Max: 120/day
  - Random delay: 45-120 seconds between messages
  - Business hours only: 9am-8pm target timezone (EST/CST/PST)
  - Auto-pause on warning detection
  - Health score: starts 100, -20 per warning, pause at <40

Rotation logic:
  - Round-robin across healthy accounts
  - Skip paused/unhealthy accounts
  - Prefer accounts that haven't sent to this prospect's group before
```

---

## 5. Dashboard UI — Space Flow Canvas

### Design Language
Inspired by the Biotix voice bot platform (callme-renovation):
- **Dark space theme** — deep dark background (#0a0a0f), subtle star particles
- **Infinite canvas** — zoom in/out, pan, minimap in corner
- **Glow nodes** — each step is a card with subtle glow effect
- **Connection lines** — curved/animated lines between nodes with particle flow
- **Real-time stats** — live numbers on each node

### Page: `/admin/campaigns` (Campaign Flow Builder)

#### Top Performance Bar
```
┌─────────────────────────────────────────────────────────────────┐
│ ⚡ OUTREACH ENGINE    │ SENT │ DELIVERED │ READ │ REPLIED │ TRIAL│
│    LIVE               │ 4,521│   3,890   │2,104 │   623   │  312 │
│                       │      │   86.0%   │46.5% │  13.8%  │ 6.9% │
└─────────────────────────────────────────────────────────────────┘
```

#### Canvas — Flow Visualization
Each flow displayed as connected nodes on infinite dark canvas:

**Node Types:**
1. **Audience Node** (purple glow) — shows filter criteria + count
2. **WhatsApp Node** (green glow) — message step, shows sent/read/replied
3. **Voice Node** (blue glow) — call step, shows called/answered/interested
4. **Wait Node** (gray) — "Wait 3 days"
5. **Condition Node** (yellow/diamond) — "Replied?" with yes/no branches
6. **Exit Node** (red/green) — "→ Trial" or "→ Not Interested"

**Each node shows:**
```
┌─────────────────────────┐
│ 📱 WhatsApp Step 1      │
│ "Referral Angle"        │
│─────────────────────────│
│ Sent: 2,450  │ Read: 42%│
│ Replied: 14% │ A/B: 🏆A │
└─────────────────────────┘
```

**Interactions:**
- Click node → side panel with details, edit variant, view A/B results
- Drag to reposition
- Zoom with scroll/pinch
- Click connection line → see flow stats between steps
- "+" button between nodes to insert new step

#### Bottom Stats Bar
```
┌──────────────────────────────────────────────────┐
│ 9,450 REACHED │ 1,890 REPLIED │ 312 TRIAL │ 89 PAID │
└──────────────────────────────────────────────────┘
```

#### Right Sidebar (when node selected)
- Node details + edit
- A/B variant performance comparison
- Message preview
- Prospect list for this step

### Page: `/admin/campaigns/analytics`
Standard dashboard page (not space theme) with:
- Conversion funnel chart
- A/B test results per variant
- Daily send/reply/convert trends
- Per-number health status
- Per-group performance (which groups convert best)

---

## 6. Message Tactics & Templates

### Cold Outreach Variants (A/B Test)

**Variant A — Referral Angle (recommended first)**
```
Hey {{name}}, we're both in {{group_name}} 👋
I use a smart system that filters all the messages in the group
and sends me only the leads in my work area and my type of work.
An AI bot filters the leads directly to my WhatsApp.
It helps me get only the jobs that match me.
To get a discount I need to bring 2 friends and honestly
I don't have anyone so I sent to you, maybe you'd be interested :)
Sorry if not!
```

**Variant B — Social Proof**
```
Hey {{name}}, saw you're in {{group_name}}.
Me and a few other {{profession}} guys from the group use a tool
that filters only the relevant leads from the group straight to WhatsApp.
Saves hours of scrolling. They're giving a free trial week.
Want me to send you the link?
```

**Variant C — Pain Point**
```
Hey {{name}}, quick question — do you actually read all the messages
in {{group_name}}? There are like 200 a day 😅
I was missing jobs until I found this AI tool that sends me only
the leads in my area. Free trial if you want to check it out.
```

**Variant D — FOMO / Data**
```
Hey {{name}}, this week there were {{lead_count}} {{profession}} leads
posted in {{group_name}} in your area. Did you catch them all?
I use a filter that sends me only the matching ones.
Happy to share if you're interested.
```

### Follow-up (Day 3, no reply)
```
Hey {{name}}, sent you something a few days ago.
Since then there were {{recent_lead_count}} new {{profession}} leads
in {{group_name}} in {{area}}. Want me to show you which ones?
```

### Voice Bot Script (Day 7, no reply to WhatsApp)
```
Hi {{name}}, this is Lead Express. I saw you're in
{{group_count}} WhatsApp groups for {{profession}} work.
Last week there were {{lead_count}} leads in your area
that you probably missed. We have an AI tool that filters
the right leads directly to your WhatsApp.
Want to try it free for a week?
```

---

## 7. Variable System

Available template variables:
- `{{name}}` — prospect display name
- `{{group_name}}` — specific shared group name
- `{{profession}}` — their trade (HVAC, plumbing, etc.)
- `{{area}}` — their work area / city
- `{{lead_count}}` — real lead count from their groups (pulled from DB)
- `{{recent_lead_count}}` — leads in last X days
- `{{group_count}}` — how many groups they're in

Variables are resolved at send-time from prospect data + live lead counts.

---

## 8. Number Management

### Warmup Schedule
| Day | Max sends/day | Notes |
|-----|--------------|-------|
| 1-3 | 10 | Send only to "warm" contacts first |
| 4-7 | 25 | Expand to cold prospects |
| 8-14 | 50 | Standard pace |
| 15-21 | 80 | Near full capacity |
| 22+ | 120 | Full capacity (don't exceed) |

### Health Monitoring
- Track if messages are being delivered (delivery rate)
- Track if number gets "this account has been banned" errors
- Auto-pause number if health_score < 40
- Alert admin in dashboard when number paused
- Suggest adding new numbers when capacity is near limit

### Capacity Planning (Month 1)
| Week | Numbers | Sends/day | Weekly | Cumulative |
|------|---------|-----------|--------|------------|
| 1 | 3 (warmup) | 100 | 700 | 700 |
| 2 | 5 | 250 | 1,750 | 2,450 |
| 3 | 7 | 400 | 2,800 | 5,250 |
| 4 | 10 | 600 | 4,200 | 9,450 |

---

## 9. Tech Stack

| Component | Technology |
|-----------|-----------|
| Flow Builder Canvas | React Flow (reactflow.dev) + custom space theme |
| Particle effects | tsparticles (stars background) |
| Job Queue | BullMQ + Redis (already in project) |
| WhatsApp Sending | Green API (already integrated) |
| Voice Bot | External API (Biotix or similar) |
| Database | Supabase/PostgreSQL |
| Real-time updates | Supabase Realtime subscriptions |
| Charts/Analytics | Recharts (already in project) |

---

## 10. What NOT to Build (Phase 1)

- ❌ Visual drag-and-drop flow creation (use preset templates, edit via forms)
- ✅ Visual flow DISPLAY on space canvas with live stats
- ❌ SMS channel
- ❌ Email channel
- ❌ Pixel/retargeting integration (Phase 2)
- ❌ Referral program mechanics (Phase 2)
- ❌ Auto-enrollment rules (start with manual campaign launch)

### Phase 2 (After proving the funnel works)
- Drag-and-drop flow builder
- Referral program with tracking links
- Facebook Pixel integration
- Auto-enrollment for new prospects
- Win-back flows for churned users
- Premium tier upsell flows
