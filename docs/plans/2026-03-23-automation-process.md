# Automation Process — Full Pipeline

## Overview

Each stage has sub-statuses. Automations move prospects between sub-statuses based on time, events, and conditions. This document defines the exact process for each stage.

---

## 1. PROSPECT (Scoring every 6h)

**RPC:** `score_prospects()`

```
[New prospect extracted from group]
        |
        v
    ┌─ COLD ─────────────────────────────────┐
    │  Default state for new prospects        │
    │  Trigger: extracted from WhatsApp group │
    └─────────────────────────────────────────┘
        |                           |
        | Active in 2+ groups       | No activity 30d
        | last 7 days               |
        v                           v
    ┌─ WARM ──────────┐     ┌─ STALE ─────────┐
    │  Shows interest  │     │  Inactive        │
    └──────────────────┘     └──────────────────┘
        |                           |
        | Replied to                | Left all groups
        | any message               |
        v                           v
    ┌─ HOT ───────────┐     ┌─ INVALID ────────┐
    │  Ready to reach  │     │  Can't contact   │
    │  out to          │     └──────────────────┘
    └──────────────────┘
        |
        | Admin sends first message
        v
    → REACHED OUT stage
```

**When prospect becomes HOT:**
- Alert admin via dashboard notification
- Prospect appears in "ready to contact" list

---

## 2. REACHED OUT (Auto Follow-Up every hour)

**RPC (to build):** `execute_auto_followups()`

```
[Admin sends first message (Touch 1)]
        |
        v
    ┌─ NOT_SENT ──────────────────────────────┐
    │  Message queued in Twilio               │
    │  Template: first_touch category         │
    └─────────────────────────────────────────┘
        |
        | Twilio callback: delivered
        v
    ┌─ UNREAD ────────────────────────────────┐
    │  Delivered but not read                 │
    │  Automation: Twilio read receipts       │
    └─────────────────────────────────────────┘
        |                           |
        | Twilio callback:          | Prospect replies
        | read, no reply 24h        |     → IN_CONVERSATION
        v
    ┌─ READ_NO_REPLY ─────────────────────────┐
    │  Read but no response                   │
    │  Wait 3 days from first message         │
    └─────────────────────────────────────────┘
        |
        | Day 3: auto send Touch 2
        | Template: follow_up category, touch_number=2
        v
    ┌─ FOLLOWUP_1 ────────────────────────────┐
    │  First follow-up sent                   │
    │  Template variants:                     │
    │   - follow_up_direct                    │
    │   - follow_up_numbers                   │
    │   - follow_up_success                   │
    │   - follow_up_question                  │
    │  (random selection or A/B test)         │
    └─────────────────────────────────────────┘
        |                           |
        | Day 7: auto send          | Prospect replies
        | Touch 3                   |     → IN_CONVERSATION
        v
    ┌─ FOLLOWUP_2 ────────────────────────────┐
    │  Second follow-up sent                  │
    │  Template: follow_up, touch_number=3    │
    │  Variants:                              │
    │   - last_touch_friendly                 │
    │   - last_touch_fomo                     │
    └─────────────────────────────────────────┘
        |                           |
        | No reply after 3 days     | Prospect replies
        |                           |     → IN_CONVERSATION
        v
    ┌─ NO_RESPONSE ───────────────────────────┐
    │  All 3 touches exhausted                │
    │  No further automatic contact           │
    │  Admin can manually re-engage later     │
    └─────────────────────────────────────────┘

    ┌─ NOT_INTERESTED ────────────────────────┐
    │  Prospect explicitly said no            │
    │  Detected by keyword: "לא מעוניין",     │
    │  "לא רלוונטי", "תפסיק", "stop"         │
    │  → No further contact                   │
    └─────────────────────────────────────────┘
```

**Follow-Up Schedule:**
| Touch | Day | Template Category | Action |
|-------|-----|-------------------|--------|
| 1 | 0 | first_touch | Admin sends manually |
| 2 | 3 | follow_up (touch_number=2) | Auto-send by RPC |
| 3 | 7 | follow_up (touch_number=3) | Auto-send by RPC |
| — | 10 | — | Mark NO_RESPONSE |

**Follow-Up RPC Logic:**
```sql
-- Find prospects needing follow-up
SELECT p.id, p.sub_status, p.sub_status_changed_at
FROM prospects p
WHERE p.pipeline_stage = 'reached_out'
  AND p.sub_status IN ('read_no_reply', 'followup_1')
  AND p.sub_status_changed_at < NOW() - INTERVAL '3 days'
```

---

## 3. IN CONVERSATION (Waiting-on-us every 5m)

**RPC:** `update_conversation_sub_statuses()`

```
[Prospect replied to outreach]
        |
        v
    ┌─ ACTIVE ────────────────────────────────┐
    │  Active conversation happening          │
    │  Last message: incoming, < 30 min ago   │
    └─────────────────────────────────────────┘
        |              |              |
        | Mentions     | No agent     | Agent replied,
        | price/cost   | reply 5m+    | no response 24h
        v              v              v
    ┌─ ASKING    ┌─ WAITING     ┌─ WAITING
    │  PRICE     │  ON US!      │  ON THEM
    └────────────┘  └────────────┘  └────────────────┐
        |              |              |               |
        | Payment      | Agent        | No response   |
        | link sent    | replies      | 72h           |
        v              v              v               |
    ┌─ SENT_LINK ┐  → ACTIVE    ┌─ GONE_QUIET ──────┘
    │            │              │  Dead conversation  │
    └────────────┘              └─────────────────────┘
        |
        | Clicked link
        v
    → ONBOARDING or DEMO_TRIAL stage

    ┌─ SCHEDULED ─────────────────────────────┐
    │  Demo/call scheduled                    │
    │  Set manually by agent                  │
    └─────────────────────────────────────────┘
        |
        | After meeting
        v
    → ONBOARDING stage
```

**Alerts:**
- `waiting_on_us` count > 0 → Dashboard red badge + Telegram alert to admin
- `gone_quiet` count increases → Weekly summary alert

---

## 4. ONBOARDING (Step tracking)

**RPC (to build):** `advance_onboarding_step()`

```
[Prospect agreed to try the service]
        |
        v
    ┌─ FIRST_NAME ────────────────────────────┐
    │  Bot asks: "מה השם שלך?"               │
    │  Wait for name response                 │
    └─────────────────────────────────────────┘
        |
        | Name confirmed
        v
    ┌─ PROFESSION ────────────────────────────┐
    │  Bot asks: "מה המקצוע שלך?"            │
    │  Buttons: plumber, electrician, etc.    │
    └─────────────────────────────────────────┘
        |
        | Trades selected
        v
    ┌─ CITY_STATE ────────────────────────────┐
    │  Bot asks: "באיזה מדינה אתה עובד?"     │
    │  State selection                        │
    └─────────────────────────────────────────┘
        |
        | State selected
        v
    ┌─ CITY ──────────────────────────────────┐
    │  Bot asks: "באיזה ערים?"               │
    │  City/zip selection                     │
    └─────────────────────────────────────────┘
        |
        | Cities confirmed
        v
    ┌─ WORKING_DAYS ──────────────────────────┐
    │  Bot asks: "באילו ימים אתה עובד?"      │
    │  Day selection                          │
    └─────────────────────────────────────────┘
        |
        | Schedule set
        v
    ┌─ CONFIRM ───────────────────────────────┐
    │  Bot shows summary, asks to confirm     │
    │  "הנה הפרופיל שלך, מאשר?"             │
    └─────────────────────────────────────────┘
        |
        | Profile confirmed
        v
    ┌─ GROUPS ────────────────────────────────┐
    │  Bot adds to matching groups            │
    │  First leads delivered                  │
    └─────────────────────────────────────────┘
        |
        | Groups assigned
        v
    → DEMO_TRIAL stage (sub_status: just_started)
```

**Timeout:** If no response for 48h at any step → send reminder. After 7 days → mark stale, alert admin.

---

## 5. DEMO / TRIAL (Activity detection hourly)

**RPC:** `update_trial_sub_statuses()`

```
[Onboarding complete, trial started]
        |
        v
    ┌─ JUST_STARTED ──────────────────────────┐
    │  Trial day 0                            │
    │  Monitoring: lead delivery + opens      │
    └─────────────────────────────────────────┘
        |                           |
        | First lead delivered      | No leads after 48h
        v                           v
    ┌─ RECEIVING_LEADS ──┐   ┌─ NO_LEADS! ──────────┐
    │  Getting leads     │   │  Alert admin!         │
    │  Monitoring opens  │   │  Check matching rules │
    └────────────────────┘   └───────────────────────┘
        |
        | Opened 3+ leads
        v
    ┌─ ENGAGED ───────────────────────────────┐
    │  Actively using the service             │
    │  Good conversion candidate              │
    └─────────────────────────────────────────┘
        |                           |
        | Trial ends in 2 days      | Stops opening leads
        v                           v
    ┌─ EXPIRING ─────────┐   ┌─ INACTIVE ───────────┐
    │  Send payment link  │   │  Send re-engagement  │
    │  + urgency message  │   │  message             │
    └─────────────────────┘   └──────────────────────┘
        |
        | Clicked payment link
        v
    ┌─ WANTS_TO_PAY ──────────────────────────┐
    │  Hot conversion opportunity!            │
    │  Alert admin immediately                │
    └─────────────────────────────────────────┘
        |                           |
        | Payment successful        | Trial expires
        v                           v
    → PAYING stage              → TRIAL_EXPIRED stage
```

**Trial Duration:** 7 days (configurable)

---

## 6. TRIAL EXPIRED

```
    ┌─ WAS_ACTIVE ────────────────────────────┐
    │  Used the service, engaged              │
    │  Best re-engagement candidate           │
    │  Send: discount offer                   │
    └─────────────────────────────────────────┘
        |
        | Discount offer sent
        v
    ┌─ GOT_OFFER ─────────────────────────────┐
    │  Offer sent, waiting for response       │
    │  7 day window                           │
    └─────────────────────────────────────────┘
        |                           |
        | Accepted offer            | No action 7d
        v                           v
    → PAYING stage              ┌─ DECLINED ──────────┐
                                │  Move to cold list   │
                                └──────────────────────┘

    ┌─ BARELY_USED / NEVER_USED ──────────────┐
    │  Low priority for re-engagement         │
    │  Quarterly check-in only                │
    └─────────────────────────────────────────┘

    ┌─ PAYMENT_FAILED ────────────────────────┐
    │  Wanted to pay but card failed          │
    │  High priority! Contact immediately     │
    │  Send: payment retry link               │
    └─────────────────────────────────────────┘
```

---

## 7. PAYING (Stripe webhooks — real-time)

**RPC:** `handle_stripe_event()`

```
    ┌─ HEALTHY ───────────────────────────────┐
    │  Active subscriber, using service       │
    │  Payment current                        │
    └─────────────────────────────────────────┘
        |              |              |
        | 50+ leads    | <5 leads     | Stripe payment
        | claimed/mo   | last 14d     | failed
        v              v              v
    ┌─ POWER_USER  ┌─ LOW_USAGE   ┌─ PAYMENT_FAILING ─┐
    │  Upsell      │  Check if    │  Alert admin!      │
    │  candidate   │  area issue  │  Retry payment     │
    └──────────────┘  └────────────┘  └──────────────────┘
                          |
                          | No leads available
                          v
                    ┌─ LOW_LEADS ──────────────┐
                    │  Coverage problem         │
                    │  Expand matching rules    │
                    │  or add groups for area   │
                    └──────────────────────────┘

    ┌─ SUPPORT_ISSUE ─────────────────────────┐
    │  Complaint or technical problem         │
    │  Set manually by admin                  │
    └─────────────────────────────────────────┘

    ┌─ UPGRADE_CANDIDATE ─────────────────────┐
    │  Power user ready for premium plan      │
    │  Set manually or by usage threshold     │
    └─────────────────────────────────────────┘
```

**On payment failure:**
1. Stripe webhook fires → `handle_stripe_event()`
2. Sub-status → `payment_failing`
3. Alert admin via Telegram
4. Auto-send WhatsApp: "היי {name}, יש בעיה בתשלום..."
5. After 3 failed retries → stage → CHURNED

---

## 8. CHURNED (Stripe webhooks — real-time)

```
    ┌─ RECENT ────────────────────────────────┐
    │  Churned < 30 days ago                  │
    │  Best win-back window                   │
    │  Send: "חסר לנו אותך" message           │
    └─────────────────────────────────────────┘
        |
        | 30+ days passed
        v
    ┌─ OLD ───────────────────────────────────┐
    │  Churned 30+ days ago                   │
    │  Low priority                           │
    └─────────────────────────────────────────┘

    ┌─ PAYMENT_FAILED ────────────────────────┐
    │  Churned due to payment issues          │
    │  May want to come back                  │
    │  Send: payment retry link               │
    └─────────────────────────────────────────┘

    ┌─ NO_VALUE ──────────────────────────────┐
    │  Left because service wasn't useful     │
    │  Need to understand why                 │
    └─────────────────────────────────────────┘

    ┌─ SEASONAL ──────────────────────────────┐
    │  Construction seasonal worker           │
    │  Will likely return in spring           │
    │  Send: seasonal re-activation message   │
    └─────────────────────────────────────────┘

    ┌─ COMPETITOR ────────────────────────────┐
    │  Left for competitor                    │
    │  Monitor for return                     │
    └─────────────────────────────────────────┘

    ┌─ CLOSED ────────────────────────────────┐
    │  Business closed / retired              │
    │  No re-engagement                       │
    └─────────────────────────────────────────┘
```

---

## Implementation Order

### Phase 1: Enable Existing RPCs (1 day)
1. Enable `pg_cron` extension on Supabase
2. Schedule 3 jobs:
   - `score_prospects()` — every 6 hours
   - `update_conversation_sub_statuses()` — every 5 minutes
   - `update_trial_sub_statuses()` — every hour

### Phase 2: Auto Follow-Up Engine (2-3 days)
1. Create `execute_auto_followups()` RPC
2. Add template selection logic (random or A/B)
3. Queue messages via Twilio content API
4. Schedule RPC every hour via pg_cron
5. Add "not interested" keyword detection

### Phase 3: Onboarding Bot (2-3 days)
1. Create `advance_onboarding_step()` RPC
2. Wire to WhatsApp webhook response handler
3. Add timeout/reminder logic
4. Auto-transition to DEMO_TRIAL on completion

### Phase 4: Alerts + Notifications (1 day)
1. Wire `waiting_on_us` alerts to Telegram
2. Wire `payment_failing` alerts to admin WhatsApp
3. Wire `no_leads` alerts to admin dashboard
4. Wire `wants_to_pay` alerts (high priority)

### Phase 5: Re-engagement (1-2 days)
1. Trial expired win-back messages
2. Churned re-activation campaigns
3. Seasonal re-engagement
