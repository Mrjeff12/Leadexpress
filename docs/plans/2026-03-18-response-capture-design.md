# Response Capture + Group Dynamics Fix — Design Document

**Date:** 2026-03-18
**Approach:** Capture contractor responses from WhatsApp groups + fix dashboard labels to reflect actual group dynamics

---

## Problem

WhatsApp groups are **job marketplaces** with 3 participant types:
1. **Lead Publishers** — post jobs: "California 95301, Chimney, Wed 2-4pm, Who can take?"
2. **Contractors** — respond: "K?", "I'll take it", "DM me", "Interested"
3. **Spammers** — unrelated ads

Current system only captures type 1. Contractor responses are dropped by smart filter (too_short, no_signals) because they lack ZIP codes and job keywords. The dashboard labels these publishers as "Repeat Requesters" (implying they're unsatisfied customers), which is wrong — they're lead generators.

## Solution: 5 Parts

### Part 1: Listener — Capture Reply Context

**File:** `services/wa-listener/src/listener.ts`

Green API's `extendedTextMessageData` includes `stanzaId` (quoted message ID) and `quotedMessage` when a user replies to a message. Currently we only extract `text`.

**Change:** Extract reply metadata:
```typescript
const quotedMessageId = body.messageData?.extendedTextMessageData?.stanzaId ?? null
const quotedText = body.messageData?.extendedTextMessageData?.quotedMessage?.textMessage ?? null
```

Pass these to the parser worker via `RawMessagePayload`:
```typescript
interface RawMessagePayload {
  // ... existing fields ...
  quotedMessageId: string | null   // NEW: wa_message_id of the quoted message
  quotedText: string | null         // NEW: text content of the quoted message
}
```

### Part 2: Smart Filter — Don't Drop Replies

**File:** `services/wa-listener/src/smart-filter.ts`

**Current behavior:** Messages < 8 chars → dropped as "too_short"

**New behavior:**
1. If `quotedMessageId` is present → message is a reply → **bypass quick filter entirely**, tag as `is_reply: true`
2. If no reply context but message matches response patterns ("K?", "interested", "I'll take", "DM me") → tag as `response_candidate: true`, **don't drop**
3. All other short messages → drop as before

**Response patterns to detect** (new constant):
```typescript
const RESPONSE_PATTERNS = [
  /^k\??$/i,                    // K? K
  /^(yes|yeah|yep|yea)\b/i,    // Yes, Yeah
  /^interested\b/i,             // Interested
  /^i.?ll take/i,              // I'll take it
  /^dm\b|^pm\b/i,              // DM, DM me, PM
  /^(how much|price|cost)\b/i, // How much?
  /^(available|free)\b/i,      // Available, Free
  /^(send|sent)\b/i,           // Send details
  /^mine\b/i,                  // Mine
  /^(אני לוקח|אני רוצה|מעוניין|שלי)/i, // Hebrew responses
]
```

### Part 3: AI Parser — Message Type Classification

**File:** `services/parser/src/parser.ts`

**Add to output schema:**
```typescript
message_type: "lead_publication" | "contractor_response" | "chat"
```

**Update system prompt** to explain the 3 types:
- `lead_publication`: Someone posting a job with location, profession, and/or time window. This is a lead being offered to the group.
- `contractor_response`: Someone responding to a posted job. Short replies like "K?", "I'll take it", "Interested", "How much?", or quoting a lead post.
- `chat`: General conversation — greetings, questions, memes, group rules, recruiting.

**When `message_type = "contractor_response"`:**
- `is_lead = false` (it's not a new lead)
- But we save it separately as a group_response record

**When `message_type = "lead_publication"`:**
- `is_lead = true` (same as current behavior)
- This is what we've been calling "leads" all along

### Part 4: Database — group_responses table

**File:** `supabase/migrations/018_group_responses.sql`

```sql
CREATE TABLE public.group_responses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id        UUID NOT NULL REFERENCES groups(id),
  wa_message_id   TEXT UNIQUE,
  sender_id       TEXT NOT NULL,
  message         TEXT NOT NULL,
  quoted_message_id TEXT,            -- wa_message_id of quoted lead (if reply)
  linked_lead_id  UUID REFERENCES leads(id), -- resolved lead record (if found)
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_gr_group ON group_responses(group_id, created_at DESC);
CREATE INDEX idx_gr_sender ON group_responses(sender_id);
CREATE INDEX idx_gr_lead ON group_responses(linked_lead_id) WHERE linked_lead_id IS NOT NULL;

ALTER TABLE group_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY gr_admin_read ON group_responses
  FOR SELECT USING (public.is_admin());

CREATE POLICY gr_service_write ON group_responses
  FOR INSERT WITH CHECK (true);
```

**Lead linking logic** (in parser worker):
When saving a response with `quoted_message_id`:
1. Look up `leads` where `wa_message_id = quoted_message_id`
2. If found → set `linked_lead_id`
3. If not found → leave null (the quoted message might not be a lead)

### Part 5: Dashboard — Fix Labels + Active Contractors

**Files:** `apps/dashboard/src/pages/AdminGroupDetail.tsx`, `apps/dashboard/src/hooks/useGroupDetail.ts`

**Label changes:**
- "Repeat Requesters" → **"Top Lead Publishers"**
- Subtitle: "High-value prospects who posted 2+ requests" → **"Most active lead sources in this group"**

**New section in Market Intel tab: "Active Contractors"**
Query: `SELECT sender_id, COUNT(*) FROM group_responses WHERE group_id = ? GROUP BY sender_id ORDER BY count DESC LIMIT 20`

Display: Table with sender_id, response_count, last_response date.
These are the contractors who are actively taking jobs from this group.

**New KPI in Group Detail Overview:**
- Add "Responses" KPI card showing `COUNT(*) FROM group_responses WHERE group_id = ?`

---

## Data Flow (After Changes)

```
WhatsApp Message
  │
  ├─ Has quotedMessageId? ──→ is_reply = true, bypass quick filter
  │
  ├─ Matches RESPONSE_PATTERNS? ──→ response_candidate = true, bypass quick filter
  │
  ├─ < 8 chars, no reply, no pattern ──→ DROPPED (too_short)
  │
  └─ Passes to AI Parser
       │
       ├─ message_type = "lead_publication" ──→ Save as Lead (leads table)
       │
       ├─ message_type = "contractor_response" ──→ Save as Response (group_responses table)
       │                                            Link to quoted lead if available
       │
       └─ message_type = "chat" ──→ Log pipeline_event, discard
```

## Files Changed

```
services/wa-listener/src/listener.ts      ← extract reply context
services/wa-listener/src/smart-filter.ts   ← bypass filter for replies + response patterns
services/parser/src/parser.ts              ← add message_type to AI prompt + schema
services/parser/src/worker.ts              ← save to group_responses table
supabase/migrations/018_group_responses.sql ← new table
apps/dashboard/src/hooks/useGroupDetail.ts  ← query group_responses
apps/dashboard/src/pages/AdminGroupDetail.tsx ← fix labels + add Active Contractors
```

## Implementation Order

1. Migration (DB table)
2. Listener (reply context extraction)
3. Smart Filter (bypass for replies + response patterns)
4. Parser (message_type + save responses)
5. Dashboard (labels + Active Contractors section)
