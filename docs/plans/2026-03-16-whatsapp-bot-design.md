# WhatsApp Bot Design — LeadExpress

## Overview

WhatsApp bot for contractor onboarding, daily availability check-in, and lead delivery via Twilio WhatsApp API. Runs alongside the existing Telegram bot — contractors can use either or both.

## Architecture

```
Contractor sends message
       ↓
Twilio Sandbox/Number
       ↓
Supabase Edge Function (whatsapp-webhook)
       ↓
  ┌─ Onboarding flow (state in Redis)
  ├─ Check-in response handler
  ├─ Lead claim/pass handler
  └─ Menu/settings handler
       ↓
Supabase DB (profiles, contractors, leads)
```

Outbound messages (check-in cron, lead notifications) sent via Twilio REST API from whatsapp-notify service.

## Identity

Contractor identified by phone number — no tokens or codes. Phone from incoming WhatsApp message matched against `profiles.phone` or `profiles.whatsapp_phone`.

### Phone Lookup Logic

```
incoming phone number
  → match profiles.whatsapp_phone (already linked)
  → match profiles.phone (first time)
  → no match → "Visit leadexpress.com to start your free trial"
```

### Subscription Enforcement (5 Layers)

| Layer | Where | Check |
|-------|-------|-------|
| 1. First contact | Webhook | phone → profile → subscription active/trialing |
| 2. Check-in cron | Cron job | query filters subscription.status IN (active, trialing) |
| 3. Check-in reply | Webhook | verify subscription before marking available |
| 4. Lead matching | Matcher | query includes subscriptions.status = 'active' |
| 5. Lead sending | Worker | final check before API call |

Expired trial or canceled subscription → blocked at every layer. No holes.

## Onboarding Flow (3 steps)

### Step 1: Professions

```
"Welcome to LeadExpress! 🔧
What type of work do you do? Tap all that apply:"

Interactive List:
  ❄️ HVAC / AC
  🔨 Renovation
  🧱 Fencing & Railing
  ✨ Cleaning
  🔑 Locksmith
  🚰 Plumbing
  ⚡ Electrical
  📋 Other

After selecting: [✅ Done]
```

### Step 2: Service Area

```
"Where do you work? Type a city name:"

User: "Miami"

"Got it! Miami, FL (33125-33199, 28 ZIP codes)
Want to add more cities?"

[➕ Add city]  [✅ Done]
```

City → auto-resolve to state + ZIP codes behind the scenes. Contractor can add multiple cities. Optional ZIP refinement via "Customize" button.

### Step 3: Working Days

```
"Which days do you work?"

[Mon] [Tue] [Wed] [Thu] [Fri] [Sat] [Sun]

After selecting: [✅ Done]
```

### Confirmation

```
"✅ All set!

🔧 HVAC, Plumbing
📍 Miami, Hollywood (28 ZIP codes)
📅 Mon-Fri

You'll start getting leads tomorrow morning.
Send MENU anytime for options."
```

Saves to DB: contractors.professions, contractors.zip_codes, profiles.whatsapp_phone, contractors.wa_notify=true, contractors.working_days (new field).

## Daily Check-in

### Schedule
- Sent at 07:00 AM ET (configurable)
- Only on contractor's selected working days
- Only to active subscribers with wa_notify=true

### Message (Twilio Template)

```
"☀️ Good morning {name}!
🔥 {count} new leads in your area yesterday.

[✅ I'm available]  [❌ Off today]"
```

### Response Handling

- "I'm available" → available_today=true, wa_window_until=now+24h
- "Off today" → available_today=false (but still opens 24h window for future re-activation)
- No response → not available, no leads sent
- Both buttons open the 24h free messaging window (any reply = incoming message)

### Re-engagement

If contractor hasn't responded to check-in for 3+ days, next check-in adds:
```
"We missed you! Reply to stay active."
```

## Lead Notification

### Format

```
🔥 *NEW LEAD — HVAC*

❄️ _"AC unit not working, needs immediate
repair in Delray Beach"_

📍 Delray Beach, 33446
💰 $199+
⏰ 🔥 ASAP

[👉 Contact Now]  [❌ Pass]
```

Dynamic fields — only shown when data exists:
- parsed_summary: always
- city + zip_code: always (if available)
- budget_range: only if parsed
- urgency: always (hot/warm/cold with emoji)
- phone/name/address: never shown directly — accessed via Contact Now

### Contact Now Button

Opens WhatsApp deep link to the lead poster (sender_id):

```
wa.me/{sender_phone}?text=Hi!+I'm+a+licensed+{profession}+
reaching+out+about+your+{summary_short}+request+in+{city}.+
I'm+available+and+can+help.+When+works+for+you?
```

sender_phone extracted from lead.sender_id (e.g., "972544777297@c.us" → "972544777297").

### Post-Claim Feedback

After contractor taps "Contact Now":
```
"✅ Lead claimed! Good luck 🤞
Reply DONE when finished, or PASS if not interested."
```

Tracks: claimed_at, claimed_by, outcome (done/pass).

### Pass Button

Logs the pass, does not show lead again. No penalty.

## Menu System

Single command: **MENU** (or any unrecognized text shows menu hint)

```
"📋 *LeadExpress Menu*"

[⚙️ My Settings]
[📍 Update Areas]
[🔧 Update Trades]
[📅 Working Days]
[⏸️ Pause Leads]
```

- My Settings: shows current profile summary + subscription status + leads this month
- Update Areas: re-enter cities flow
- Update Trades: re-select professions
- Working Days: re-select days
- Pause Leads: toggles wa_notify (with confirmation)

## Data Model Changes

### New field: contractors.working_days

```sql
ALTER TABLE contractors
  ADD COLUMN working_days INTEGER[] NOT NULL DEFAULT '{1,2,3,4,5}';
-- 0=Sun, 1=Mon, ..., 6=Sat (JS Date.getDay() convention)
```

### City-to-ZIP mapping

New reference table or static JSON mapping:
```
{state, city} → [zip_codes]
```

Source: USPS ZIP code database or static mapping for FL/NY/TX.

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Webhook | Supabase Edge Function (already deployed) |
| Outbound messages | Twilio REST API (whatsapp-notify service) |
| Onboarding state | Redis (1h TTL, key: le:wa-onboard:{phone}) |
| Check-in cron | node-cron in whatsapp-notify service |
| Interactive buttons | Twilio Interactive Messages API |
| City→ZIP mapping | Static JSON (packages/shared/src/city-zips.json) |
| Lead deep links | wa.me/{phone}?text={encoded_message} |

## WhatsApp Interactive Messages

Twilio supports WhatsApp interactive messages via ContentSid or inline:
- **Button messages**: up to 3 buttons (for check-in, claim/pass)
- **List messages**: up to 10 items with sections (for profession selection, city selection)

## File Structure

```
services/whatsapp-notify/
  src/
    webhook.ts          → update: route to handlers
    handlers/
      onboarding.ts     → profession, city, working days flow
      checkin.ts         → check-in response handler
      lead-action.ts    → claim/pass handler
      menu.ts           → settings and menu handler
    city-zips.ts        → city to ZIP code resolver
    interactive.ts      → WhatsApp button/list message builders
    checkin-cron.ts     → update: working days filter, lead count
    whatsapp-client.ts  → update: add interactive message support

supabase/functions/whatsapp-webhook/
  index.ts              → update: route to handlers, add onboarding
```
