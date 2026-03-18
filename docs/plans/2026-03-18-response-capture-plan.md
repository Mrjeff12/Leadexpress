# Response Capture Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Capture contractor responses ("K?", "I'll take it") from WhatsApp groups, classify messages as lead_publication/contractor_response/chat, and fix dashboard labels.

**Architecture:** Extract reply context from Green API, bypass smart filter for replies/response patterns, add message_type to AI parser, save responses to new group_responses table, update dashboard labels and add Active Contractors section.

**Tech Stack:** TypeScript (Node.js services), PostgreSQL (Supabase), OpenAI GPT-4, React + Recharts

**Design doc:** `docs/plans/2026-03-18-response-capture-design.md`

---

### Task 1: Database Migration — group_responses table

**Files:**
- Create: `supabase/migrations/018_group_responses.sql`

**Step 1: Create the migration file**

```sql
-- 018: Add group_responses table for tracking contractor responses to leads

CREATE TABLE public.group_responses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id        UUID NOT NULL REFERENCES groups(id),
  wa_message_id   TEXT UNIQUE,
  sender_id       TEXT NOT NULL,
  message         TEXT NOT NULL,
  quoted_message_id TEXT,
  linked_lead_id  UUID REFERENCES leads(id),
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

**Step 2: Apply migration to Supabase**

Use the Supabase MCP tool `apply_migration` with project_id `zyytzwlvtuhgbjpalbgd`.

**Step 3: Commit**

```bash
git add supabase/migrations/018_group_responses.sql
git commit -m "feat(db): add group_responses table for contractor response tracking"
```

---

### Task 2: Listener — Extract Reply Context

**Files:**
- Modify: `services/wa-listener/src/listener.ts` (lines 248-285)
- Modify: `services/wa-listener/src/smart-filter.ts` (MessageContext interface, line 15-22)

**Step 1: Update MessageContext interface**

In `services/wa-listener/src/smart-filter.ts`, find the `MessageContext` interface (lines 15-22) and add two fields:

```typescript
export interface MessageContext {
  messageId: string;
  groupId: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
  quotedMessageId: string | null;   // NEW
  quotedText: string | null;         // NEW
}
```

**Step 2: Extract reply context in listener**

In `services/wa-listener/src/listener.ts`, after the text extraction (line 251) and before the messageId (line 255), add:

```typescript
// Extract reply/quote context from Green API
const quotedMessageId = body.messageData?.extendedTextMessageData?.stanzaId ?? null;
const quotedText = body.messageData?.extendedTextMessageData?.quotedMessage?.textMessage ?? null;
```

Then update the `runSmartFilter` call (lines 278-285) to include the new fields:

```typescript
const filterResult = await runSmartFilter({
  messageId,
  groupId: chatId,
  senderId,
  senderName,
  text,
  timestamp: body.timestamp,
  quotedMessageId,   // NEW
  quotedText,        // NEW
});
```

**Step 3: Update the enqueue payload**

Find where the message is enqueued to the parser queue (after line 309). The job data sent to BullMQ needs the new fields. Find the `queue.add()` call and add:

```typescript
quotedMessageId,
quotedText,
```

**Step 4: Commit**

```bash
git add services/wa-listener/src/listener.ts services/wa-listener/src/smart-filter.ts
git commit -m "feat(listener): extract WhatsApp reply context (quotedMessageId, quotedText)"
```

---

### Task 3: Smart Filter — Bypass for Replies + Response Patterns

**Files:**
- Modify: `services/wa-listener/src/smart-filter.ts` (quickFilter function, lines 31-53)

**Step 1: Add response patterns constant**

After the existing constants (line 29, after `EMOJI_ONLY`), add:

```typescript
const RESPONSE_PATTERNS = [
  /^k\??$/i,
  /^(yes|yeah|yep|yea)\b/i,
  /^interested\b/i,
  /^i.?ll take/i,
  /^dm\b|^pm\b/i,
  /^(how much|price|cost)\b/i,
  /^(available|free)\b/i,
  /^(send|sent)\b/i,
  /^mine\b/i,
  /^(אני לוקח|אני רוצה|מעוניין|שלי)/i,
];

export function isResponsePattern(text: string): boolean {
  const trimmed = text.trim();
  return RESPONSE_PATTERNS.some(p => p.test(trimmed));
}
```

**Step 2: Update quickFilter to accept context**

Change the `quickFilter` function signature and logic:

```typescript
export function quickFilter(text: string, ctx?: { quotedMessageId?: string | null }): FilterResult | null {
  // If this is a reply to another message, bypass length check
  if (ctx?.quotedMessageId) {
    return null; // pass — it's a reply, let AI classify it
  }

  // If matches response patterns, bypass length check
  if (isResponsePattern(text)) {
    return null; // pass — likely a contractor response
  }

  // Too short (only for non-replies, non-response-patterns)
  if (text.length < MIN_TEXT_LENGTH) {
    return { action: 'skip', stage: 'quick_filtered', reason: 'too_short' };
  }

  // ... rest of checks (emoji_only, bot_message, media_only) stay the same ...
```

**Step 3: Update runSmartFilter to pass context**

Find the `runSmartFilter` function. Where it calls `quickFilter(ctx.text)`, change to:

```typescript
const quickResult = quickFilter(ctx.text, { quotedMessageId: ctx.quotedMessageId });
```

**Step 4: Commit**

```bash
git add services/wa-listener/src/smart-filter.ts
git commit -m "feat(filter): bypass quick filter for replies and response patterns"
```

---

### Task 4: AI Parser — Add message_type Classification

**Files:**
- Modify: `services/parser/src/parser.ts` (schema + prompt)

**Step 1: Update Zod schema**

In `services/parser/src/parser.ts`, update `ParsedLeadSchema` (lines 20-29):

```typescript
const ParsedLeadSchema = z.object({
  is_lead: z.boolean(),
  message_type: z.enum(['lead_publication', 'contractor_response', 'chat']).catch('chat'),  // NEW
  profession: z.enum(PROFESSIONS).catch('other'),
  zip_code: z.string().regex(/^\d{5}$/).nullable().catch(null),
  city: z.string().nullable().catch(null),
  budget_min: z.number().nullable().catch(null),
  budget_max: z.number().nullable().catch(null),
  urgency: z.enum(['hot', 'warm', 'cold']).catch('cold'),
  summary: z.string().min(1).catch('No summary available'),
});
```

**Step 2: Update system prompt**

In the `SYSTEM_PROMPT` string, add after line 36 (the `is_lead` definition), before `- profession`:

```
- message_type: one of "lead_publication", "contractor_response", "chat"
  • "lead_publication": Someone posting a JOB or LEAD to the group — includes location, profession, time window. Examples:
    - "California 95301, Chimney, Wed 2-4pm, Who can take?"
    - "Fort Walton Beach FL 32548, 3 AC units, full duct cleaning, Tomorrow 3-5"
    These ARE leads (is_lead = true).
  • "contractor_response": Someone RESPONDING to a posted job — short replies indicating interest. Examples:
    - "K?", "I'll take it", "Interested", "DM me", "Mine", "How much?"
    - "אני לוקח", "שלי", "מעוניין"
    These are NOT leads (is_lead = false) but are valuable contractor signals.
  • "chat": General conversation, greetings, questions, memes, group rules, recruiting, ads.
    These are NOT leads (is_lead = false).
```

Also update the `parseMessage` function signature to accept optional quoted context:

```typescript
export async function parseMessage(
  text: string,
  log: Logger,
  quotedText?: string | null,
): Promise<{ parsed: ParsedLead; usage: OpenAI.CompletionUsage | undefined; durationMs: number }> {
```

And update the user message sent to OpenAI to include quoted context when available:

```typescript
const userMessage = quotedText
  ? `[Replying to: "${quotedText.slice(0, 200)}"]\n\n${text}`
  : text;

const response = await openai.chat.completions.create({
  // ...
  messages: [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userMessage },  // changed from `text`
  ],
```

**Step 3: Commit**

```bash
git add services/parser/src/parser.ts
git commit -m "feat(parser): add message_type classification (lead_publication/contractor_response/chat)"
```

---

### Task 5: Parser Worker — Save Responses to group_responses

**Files:**
- Modify: `services/parser/src/worker.ts` (processJob function)

**Step 1: Update RawMessagePayload interface**

In `services/parser/src/worker.ts`, add to the interface (line 32-40):

```typescript
interface RawMessagePayload {
  messageId: string;
  groupId: string;
  body: string;
  sender: string | null;
  senderId?: string;
  timestamp: number;
  accountId: string;
  quotedMessageId?: string | null;  // NEW
  quotedText?: string | null;        // NEW
}
```

**Step 2: Pass quotedText to parseMessage**

Find where `parseMessage` is called (line 125):

```typescript
const { parsed, usage, durationMs } = await parseMessage(text, jobLog, job.data.quotedText);
```

**Step 3: Handle contractor_response after AI parsing**

After the `if (!parsed.is_lead)` block (lines 141-153), but BEFORE the return, add a check for contractor_response:

```typescript
// ---- skip non-leads ----
if (!parsed.is_lead) {
  jobLog.info({ durationMs, message_type: parsed.message_type }, 'Not a lead');

  // Save contractor responses to group_responses table
  if (parsed.message_type === 'contractor_response') {
    const groupUuid = await resolveGroupUuid(groupId);
    if (groupUuid) {
      // Try to link to the quoted lead
      let linkedLeadId: string | null = null;
      if (job.data.quotedMessageId) {
        const { data: linkedLead } = await supabase
          .from('leads')
          .select('id')
          .eq('wa_message_id', job.data.quotedMessageId)
          .maybeSingle();
        if (linkedLead) linkedLeadId = linkedLead.id;
      }

      await supabase.from('group_responses').insert({
        group_id: groupUuid,
        wa_message_id: messageId,
        sender_id: senderId || 'unknown',
        message: text.slice(0, 500),
        quoted_message_id: job.data.quotedMessageId || null,
        linked_lead_id: linkedLeadId,
      });

      await logPipelineEvent('response_captured', {
        groupId,
        waMessageId: messageId,
        senderId,
        accountId,
        detail: { linked_lead_id: linkedLeadId, has_quote: !!job.data.quotedMessageId },
      });

      jobLog.info({ linkedLeadId }, 'Contractor response saved');
    }
  } else {
    await logPipelineEvent('no_lead', {
      groupId,
      waMessageId: messageId,
      senderId,
      accountId,
      detail: { reason: 'ai_classified_not_lead', durationMs },
    });
  }
  return;
}
```

**Step 4: Commit**

```bash
git add services/parser/src/worker.ts
git commit -m "feat(parser): save contractor responses to group_responses table with lead linking"
```

---

### Task 6: Dashboard — Fix Labels + Active Contractors

**Files:**
- Modify: `apps/dashboard/src/hooks/useGroupDetail.ts`
- Modify: `apps/dashboard/src/pages/AdminGroupDetail.tsx`

**Step 1: Add responses query to useGroupDetail**

In `apps/dashboard/src/hooks/useGroupDetail.ts`, add a new type and fetcher:

```typescript
export interface ActiveContractor {
  sender_id: string
  response_count: number
  last_response: string
}

async function fetchResponses(groupId: string): Promise<ActiveContractor[]> {
  const { data } = await supabase
    .from('group_responses')
    .select('sender_id, created_at')
    .eq('group_id', groupId)

  if (!data || data.length === 0) return []

  const map: Record<string, { count: number; last: string }> = {}
  data.forEach((r: any) => {
    if (!map[r.sender_id]) map[r.sender_id] = { count: 0, last: r.created_at }
    map[r.sender_id].count++
    if (r.created_at > map[r.sender_id].last) map[r.sender_id].last = r.created_at
  })

  return Object.entries(map)
    .map(([sender_id, v]) => ({ sender_id, response_count: v.count, last_response: v.last }))
    .sort((a, b) => b.response_count - a.response_count)
}
```

Add the query to the hook:

```typescript
const responsesQuery = useQuery({
  queryKey: [...baseKey, 'responses'],
  queryFn: () => fetchResponses(groupId!),
  enabled: !!groupId,
  staleTime: 60_000,
})
```

Add to return: `responses: responsesQuery.data,`

Also add a count query for the KPI:

```typescript
async function fetchResponseCount(groupId: string): Promise<number> {
  const { count } = await supabase
    .from('group_responses')
    .select('*', { count: 'exact', head: true })
    .eq('group_id', groupId)
  return count || 0
}

const responseCountQuery = useQuery({
  queryKey: [...baseKey, 'responseCount'],
  queryFn: () => fetchResponseCount(groupId!),
  enabled: !!groupId,
})
```

Add to return: `responseCount: responseCountQuery.data ?? 0,`

**Step 2: Fix labels in AdminGroupDetail.tsx**

Find "Repeat Requesters" text and change to "Top Lead Publishers".
Find "High-value prospects who posted 2+ requests" and change to "Most active lead sources in this group".

**Step 3: Add "Active Contractors" section to Market Intel tab**

After the "Top Lead Publishers" section, add:

```tsx
{/* Active Contractors */}
<div className="glass-panel p-5">
  <h3 className="text-sm font-semibold mb-1" style={{ color: 'hsl(40 8% 10%)' }}>
    {he ? 'קבלנים פעילים' : 'Active Contractors'}
  </h3>
  <p className="text-xs mb-4" style={{ color: 'hsl(40 4% 42%)' }}>
    {he ? 'קבלנים שמגיבים על פרסומי עבודות' : 'Contractors responding to job postings'}
  </p>
  {responses && responses.length > 0 ? (
    <table className="w-full text-sm">
      <thead>
        <tr style={{ color: 'hsl(40 4% 42%)' }} className="border-b" style={{ borderColor: 'hsl(40 4% 90%)' }}>
          <th className="text-left py-2 text-xs font-medium">{he ? 'קבלן' : 'Contractor'}</th>
          <th className="text-left py-2 text-xs font-medium">{he ? 'תגובות' : 'Responses'}</th>
          <th className="text-left py-2 text-xs font-medium">{he ? 'אחרונה' : 'Last Response'}</th>
        </tr>
      </thead>
      <tbody>
        {responses.slice(0, 15).map((c) => (
          <tr key={c.sender_id} className="border-b" style={{ borderColor: 'hsl(40 4% 94%)' }}>
            <td className="py-2 text-xs" style={{ color: 'hsl(40 8% 10%)' }}>{c.sender_id}</td>
            <td className="py-2 text-xs font-bold" style={{ color: 'hsl(155 44% 30%)' }}>{c.response_count}</td>
            <td className="py-2 text-xs" style={{ color: 'hsl(40 4% 42%)' }}>{relativeTime(c.last_response)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  ) : (
    <p className="text-xs text-center py-4" style={{ color: 'hsl(40 4% 55%)' }}>
      {he ? 'אין תגובות עדיין' : 'No contractor responses yet'}
    </p>
  )}
</div>
```

**Step 4: Add "Responses" KPI card to Overview tab**

In the 6-KPI grid in Overview tab, replace "Known Sellers" (which shows 0 for most groups) with "Responses":

```tsx
<div className="glass-panel p-5">
  <div className="flex items-center gap-2 mb-2">
    <MessageSquare className="w-4 h-4" style={{ color: 'hsl(155 44% 30%)' }} />
    <span className="text-xs" style={{ color: 'hsl(40 4% 42%)' }}>
      {he ? 'תגובות' : 'Responses'}
    </span>
  </div>
  <p className="text-2xl font-bold" style={{ color: 'hsl(40 8% 10%)' }}>{responseCount}</p>
</div>
```

Make sure to destructure `responses` and `responseCount` from `useGroupDetail`.

**Step 5: Commit**

```bash
git add apps/dashboard/src/hooks/useGroupDetail.ts apps/dashboard/src/pages/AdminGroupDetail.tsx
git commit -m "feat(groups): fix labels (Top Lead Publishers) + add Active Contractors section"
```

---

### Task 7: Final Verification

**Step 1: TypeScript check**

```bash
cd apps/dashboard && npx tsc --noEmit
```

**Step 2: Verify backend compiles**

```bash
cd services/wa-listener && npx tsc --noEmit
cd services/parser && npx tsc --noEmit
```

**Step 3: Verify dashboard renders**

Start dev server, navigate to a group detail → Market Intel tab. Should show:
- "Top Lead Publishers" (renamed from "Repeat Requesters")
- "Active Contractors" section (empty until responses flow)

**Step 4: Commit any fixes**

```bash
git add -A
git commit -m "feat: Response Capture complete — contractor responses + label fixes"
```
