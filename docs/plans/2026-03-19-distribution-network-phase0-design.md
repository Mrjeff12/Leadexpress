# Distribution Network — Phase 0: AI-Assisted Publishing (Free Tier)

## Context

Building on the comprehensive Distribution Network plan (see `2026-03-19-distribution-network-full-design.md`), this is Phase 0 — a free, frictionless publishing experience that lets publishers distribute leads through LeadExpress without any payment infrastructure.

**Strategy:** Let publishers get addicted to the distribution power first. Add monetization later.

**Key innovation:** Instead of boring forms, publishers interact with an AI assistant that crafts professional job postings from natural language (text or voice).

---

## What Phase 0 Does

```
Publisher says "I have a job" (Dashboard chat OR WhatsApp)
       │
       ▼
AI extracts: profession, location, description
       │
       ▼
AI formats professional posting, sends for approval
       │
       ▼
Publisher confirms → Lead enters system
       │
       ▼
Existing matching engine → contractors see in Feed
       │
       ▼
Contractor contacts publisher directly (no payment)
```

**What's NOT in Phase 0:** Stripe Connect, payments, deals table, earnings dashboard, landing page.

---

## Two Publishing Channels

### Channel 1: Dashboard AI Chat

A chat-style interface in the dashboard where the publisher talks to an AI that:
1. Understands natural language ("I have a client who needs chimney cleaning in Miami")
2. Extracts structured data (profession, ZIP, description)
3. Formats a professional posting
4. Asks for confirmation
5. Publishes to the system

**UI:** Full-screen chat page, similar to ChatGPT/Claude interface. Messages flow naturally. The AI response includes a styled "job card preview" that the publisher can approve or edit.

### Channel 2: WhatsApp Bot

Same flow but through WhatsApp (Green API):
1. Publisher sends message: "I have a job to publish" (or Hebrew equivalent)
2. Bot responds: "Go ahead! Send me a voice message or text describing the job 🎙️"
3. Publisher sends voice note or text
4. Bot uses Whisper API to transcribe voice → OpenAI to parse
5. Bot sends back formatted job card for approval
6. Publisher confirms → published

**Voice support** is critical — contractors in the field want to speak, not type.

---

## Data Model Changes

### profiles table
```sql
-- Add roles support (keep existing 'role' column for backward compat)
ALTER TABLE profiles ADD COLUMN roles text[] DEFAULT ARRAY['contractor'];

-- Backfill existing contractors
UPDATE profiles SET roles = ARRAY['contractor'] WHERE role = 'contractor';
UPDATE profiles SET roles = ARRAY['admin'] WHERE role = 'admin';

-- Publisher-specific fields
ALTER TABLE profiles ADD COLUMN publisher_bio text;
ALTER TABLE profiles ADD COLUMN publisher_company_name text;
ALTER TABLE profiles ADD COLUMN publisher_verified boolean DEFAULT false;
```

### leads table
```sql
-- Source tracking
ALTER TABLE leads ADD COLUMN source_type text DEFAULT 'scanner';
-- Values: 'scanner' | 'publisher' | 'referral'

ALTER TABLE leads ADD COLUMN publisher_id uuid REFERENCES profiles(id);

-- Make group_id nullable (publisher leads don't come from groups)
ALTER TABLE leads ALTER COLUMN group_id DROP NOT NULL;
```

**Note:** No deals table, no payment fields, no pricing. Just source tracking.

---

## AI Publishing Engine

### Shared Logic (used by both Dashboard + WhatsApp)

Edge function: `supabase/functions/ai-publish-lead/index.ts`

**Input:** Raw text (from chat) or transcribed voice (from Whisper)
**Output:** Structured lead data + formatted posting

**OpenAI Prompt Strategy:**
```
System: You are a lead publishing assistant for LeadExpress, a contractor
marketplace. Extract job details from the user's message and format a
professional posting.

Extract:
- profession (must match one of: [list of valid professions])
- state (US state)
- city
- zip_code (if mentioned)
- description (rewrite professionally, 2-3 sentences)
- urgency (low/medium/high — infer from context)
- client_phone (if mentioned)

Respond in JSON format:
{
  "profession": "...",
  "state": "...",
  "city": "...",
  "zip_code": "...",
  "description": "...",
  "urgency": "...",
  "client_phone": "...",
  "formatted_posting": "...",
  "confidence": 0.0-1.0,
  "missing_fields": ["..."]
}

If critical info is missing (profession or location), ask a follow-up question.
```

### Voice Transcription (WhatsApp voice notes)

Edge function: `supabase/functions/transcribe-voice/index.ts`

- Receives voice note URL from Green API webhook
- Downloads audio file
- Sends to OpenAI Whisper API
- Returns transcription text
- Feeds into ai-publish-lead

---

## Dashboard Chat UI

### New Page: `PublishChat.tsx`

**Design:** Modern chat interface with:
- Message bubbles (user = right, AI = left)
- AI responses include a styled "Job Card Preview" component
- Card has: profession badge, location, description, urgency indicator
- Two buttons on card: "✅ Publish" and "✏️ Edit"
- Edit opens inline editing of the structured fields
- Publish → calls API → shows success with matched contractor count

**Chat Flow States:**
1. `idle` — Show welcome message: "Tell me about a job you want to publish"
2. `processing` — AI is parsing the message (typing indicator)
3. `preview` — Showing job card for approval
4. `editing` — User is editing fields
5. `published` — Success state with stats
6. `follow_up` — AI asking for missing info

**Conversation Memory:** Keep chat history in component state (not persisted). Each publishing session is independent.

### Publisher's "My Leads" view

Simple list showing leads where `publisher_id = auth.uid()`:
- Lead title, profession, location
- Status: published / matched (X contractors)
- Date published
- Number of views (from pipeline_events)

---

## WhatsApp Bot Flow

### Trigger Detection

In `whatsapp-webhook/index.ts`, add intent detection:

**Trigger phrases (English + Hebrew):**
- "I have a job", "publish a job", "post a job", "distribute a job"
- "יש לי עבודה", "רוצה לפרסם", "לפרסם עבודה"

**Flow:**
```
1. Detect "publish" intent in incoming message
2. Check if sender is registered + has 'publisher' in roles
   - If not registered: "Sign up at [dashboard URL] to publish jobs"
   - If registered but not publisher: "Enable publisher mode in your dashboard"
3. If sender sent text: parse with ai-publish-lead
4. If sender sent voice note: transcribe with Whisper → parse with ai-publish-lead
5. Send back formatted card with WhatsApp interactive buttons:
   - "✅ Publish" button
   - "✏️ Edit" button
   - "❌ Cancel" button
6. On "Publish" → create lead → send confirmation with matched count
7. On "Edit" → ask "What would you like to change?"
8. On "Cancel" → "OK, cancelled. Send me another job anytime!"
```

### WhatsApp Message Formatting
```
📋 *Job Ready to Publish*
━━━━━━━━━━━━━━━━━━━━

🔧 *Profession:* Chimney Cleaning
📍 *Location:* Miami, FL 33101
📝 *Description:*
Residential chimney cleaning needed. Single-family
home in the Miami area. Standard cleaning service.

⚡ *Urgency:* Medium

━━━━━━━━━━━━━━━━━━━━
Ready to publish to matching contractors?
```

---

## Sidebar Role Toggle

### How it works:

```
┌─────────────────────┐
│  🔧 Contractor Mode │  ← Current
│  ─────────────────── │
│  📊 Dashboard        │
│  📋 Leads Feed       │
│  👷 Subcontractors   │
│  💼 Jobs             │
│  💳 Subscription     │
│                      │
│  ─────────────────── │
│  🔄 Switch to        │
│     Publisher Mode    │
└─────────────────────┘

         ↕ Toggle

┌─────────────────────┐
│  📢 Publisher Mode   │  ← After switch
│  ─────────────────── │
│  💬 Publish Job      │  ← AI Chat
│  📋 My Published     │  ← List of published leads
│                      │
│  ─────────────────── │
│  🔄 Switch to        │
│     Contractor Mode   │
└─────────────────────┘
```

**Implementation:**
- `activeRole` stored in localStorage + auth context
- Sidebar renders different nav items based on activeRole
- Only show toggle if `roles.length > 1` (user has both roles)
- First time: prompt "Would you also like to publish jobs?" → adds 'publisher' to roles

---

## Matching & Distribution

**Reuse existing matching 100%:**

When a publisher lead is created:
1. Insert into `leads` table with `source_type = 'publisher'`, `publisher_id = auth.uid()`
2. Existing trigger/function matches `profession + zip_code` → fills `matched_contractors[]`
3. Contractors see the lead in LeadsFeed (RLS already filters by matched_contractors)

**LeadsFeed changes:**
- Add badge: "📢 From Publisher" (vs "📡 From Scanner")
- Show publisher name/company
- Different card accent color for publisher leads
- No pricing info (Phase 0 is free)

---

## Files to Create/Modify

### New Files:
1. `supabase/migrations/033_distribution_network_phase0.sql` — schema changes
2. `supabase/functions/ai-publish-lead/index.ts` — AI parsing engine
3. `supabase/functions/transcribe-voice/index.ts` — Whisper transcription
4. `apps/dashboard/src/pages/PublishChat.tsx` — AI chat publishing UI
5. `apps/dashboard/src/pages/MyPublishedLeads.tsx` — publisher's lead list
6. `apps/dashboard/src/components/JobCardPreview.tsx` — preview component for chat

### Modified Files:
1. `apps/dashboard/src/components/Sidebar.tsx` — role toggle + publisher nav
2. `apps/dashboard/src/lib/auth.tsx` — roles array + activeRole + switchRole
3. `apps/dashboard/src/pages/LeadsFeed.tsx` — publisher badge + source filter
4. `apps/dashboard/src/App.tsx` — add routes for publisher pages
5. `supabase/functions/whatsapp-webhook/index.ts` — add publish intent detection + flow

---

## Implementation Order

### Day 1: Foundation
- [ ] Migration 033 (roles, source_type, publisher_id)
- [ ] Auth context (roles array, activeRole, switchRole)
- [ ] Sidebar role toggle

### Day 2: AI Publishing Engine
- [ ] ai-publish-lead edge function (OpenAI structured extraction)
- [ ] transcribe-voice edge function (Whisper API)
- [ ] Test with sample inputs

### Day 3: Dashboard Chat
- [ ] PublishChat page (chat UI + AI integration)
- [ ] JobCardPreview component
- [ ] Publish flow (confirm → insert lead → trigger matching)

### Day 4: WhatsApp Bot
- [ ] Detect publish intent in whatsapp-webhook
- [ ] Voice note handling (download → transcribe → parse)
- [ ] Interactive buttons (publish/edit/cancel)
- [ ] Confirmation flow

### Day 5: LeadsFeed + My Published
- [ ] LeadsFeed: publisher badge, source filter
- [ ] MyPublishedLeads page
- [ ] End-to-end testing

---

## Verification Plan

1. Create test user, add 'publisher' to roles
2. Toggle to Publisher Mode in sidebar
3. Open PublishChat, type "I have a client who needs plumbing in Houston TX 77001"
4. Verify AI returns structured data + formatted card
5. Click Publish → verify lead in database with source_type='publisher'
6. Verify matching fills matched_contractors
7. Switch to contractor user → verify lead appears in Feed with publisher badge
8. Test WhatsApp flow: send text to bot → verify same parsing
9. Test voice note: send voice note → verify Whisper transcription → parsing
10. Verify existing scanner leads still work normally
