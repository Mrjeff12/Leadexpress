# Distribution Network Phase 0 — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let publishers submit leads via AI chat (dashboard) and WhatsApp bot (voice/text), distribute to matched contractors for free — no payments.

**Architecture:** Extend existing `profiles` with `roles[]` for role switching. Publisher leads enter the same `leads` table with `source_type='publisher'`. Existing matching engine distributes to contractors. Two publishing channels: Dashboard AI chat + WhatsApp bot with Whisper voice transcription.

**Tech Stack:** React + TypeScript (dashboard), Supabase Edge Functions (Deno), OpenAI GPT-4o-mini (parsing) + Whisper (voice), Green API/Twilio (WhatsApp), TailwindCSS.

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/033_distribution_network_phase0.sql`

**Step 1: Write migration**

```sql
-- Migration: Distribution Network Phase 0
-- Adds publisher role support and lead source tracking

-- 1. Add roles array to profiles (keep existing 'role' for backward compat)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS roles text[] DEFAULT ARRAY['contractor'];
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS publisher_bio text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS publisher_company_name text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS publisher_verified boolean DEFAULT false;

-- Backfill existing users
UPDATE profiles SET roles = ARRAY[role::text] WHERE roles IS NULL OR roles = ARRAY['contractor'];

-- 2. Extend leads table for publisher sources
ALTER TABLE leads ADD COLUMN IF NOT EXISTS source_type text DEFAULT 'scanner';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS publisher_id uuid REFERENCES profiles(id);

-- Make group_id nullable (publisher leads don't come from groups)
ALTER TABLE leads ALTER COLUMN group_id DROP NOT NULL;

-- 3. Index for publisher queries
CREATE INDEX IF NOT EXISTS idx_leads_source_type ON leads(source_type);
CREATE INDEX IF NOT EXISTS idx_leads_publisher_id ON leads(publisher_id);
CREATE INDEX IF NOT EXISTS idx_profiles_roles ON profiles USING GIN(roles);

-- 4. RLS: Publishers can read their own published leads
CREATE POLICY leads_publisher_read ON leads FOR SELECT
  USING (publisher_id = auth.uid());

-- 5. RLS: Publishers can insert leads
CREATE POLICY leads_publisher_insert ON leads FOR INSERT
  WITH CHECK (
    publisher_id = auth.uid()
    AND source_type = 'publisher'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND 'publisher' = ANY(roles)
    )
  );
```

**Step 2: Apply migration**

Run: `cd /Users/bigjeff/Desktop/Leadexpress && supabase db push`
Expected: Migration applies successfully.

**Step 3: Verify schema**

Run: `supabase db reset --dry-run` or check in Supabase dashboard that columns exist.

**Step 4: Commit**

```bash
git add supabase/migrations/033_distribution_network_phase0.sql
git commit -m "feat: add distribution network schema - roles, source_type, publisher_id"
```

---

## Task 2: Auth Context — Role Switching

**Files:**
- Modify: `apps/dashboard/src/lib/auth.tsx`

**Step 1: Extend UserRole and Profile types**

In `apps/dashboard/src/lib/auth.tsx`, find the existing types and extend:

```typescript
// Change UserRole to include publisher
export type UserRole = 'contractor' | 'admin' | 'publisher';

// Extend Profile type — add after existing fields
export interface Profile {
  id: string;
  full_name: string | null;
  role: UserRole;
  roles: UserRole[];           // NEW
  telegram_chat_id: number | null;
  publisher_bio?: string | null;           // NEW
  publisher_company_name?: string | null;  // NEW
  publisher_verified?: boolean;            // NEW
}
```

**Step 2: Add activeRole state to AuthContext**

Add to the context interface:

```typescript
interface AuthContextType {
  // ... existing fields ...
  activeRole: UserRole;                    // NEW
  switchRole: (role: UserRole) => void;    // NEW
  isPublisher: boolean;                    // NEW
  addPublisherRole: () => Promise<void>;   // NEW
}
```

**Step 3: Implement role switching in AuthProvider**

Inside the `AuthProvider` component, add:

```typescript
const [activeRole, setActiveRole] = useState<UserRole>(() => {
  return (localStorage.getItem('le_active_role') as UserRole) || 'contractor';
});

const switchRole = useCallback((role: UserRole) => {
  if (profile?.roles?.includes(role)) {
    setActiveRole(role);
    localStorage.setItem('le_active_role', role);
  }
}, [profile]);

const isPublisher = useMemo(() => {
  return profile?.roles?.includes('publisher') ?? false;
}, [profile]);

const addPublisherRole = useCallback(async () => {
  if (!user) return;
  const newRoles = [...(profile?.roles || ['contractor']), 'publisher'];
  const { error } = await supabase
    .from('profiles')
    .update({ roles: newRoles })
    .eq('id', user.id);
  if (!error) {
    await refreshProfile();
    switchRole('publisher');
  }
}, [user, profile, refreshProfile, switchRole]);
```

**Step 4: Update profile fetch to include new fields**

Find the profile fetch query (likely `supabase.from('profiles').select('*')`) and ensure `roles` is included. If it's already `select('*')`, no change needed.

**Step 5: Commit**

```bash
git add apps/dashboard/src/lib/auth.tsx
git commit -m "feat: add role switching to auth context - publisher/contractor toggle"
```

---

## Task 3: Sidebar Role Toggle

**Files:**
- Modify: `apps/dashboard/src/components/Sidebar.tsx`

**Step 1: Add publisher nav items**

After the existing `contractorNavItems` array, add:

```typescript
const publisherNavItems: NavItem[] = [
  { label: t('nav.publishJob'), to: '/publish', icon: MessageSquarePlus },
  { label: t('nav.myPublished'), to: '/my-published', icon: FileText },
];
```

Import `MessageSquarePlus` and `FileText` from `lucide-react`.

**Step 2: Add role toggle component**

Create a toggle section in the sidebar, below the nav items:

```tsx
{/* Role Toggle — only show if user has both roles or can become publisher */}
{(isPublisher || activeRole === 'contractor') && (
  <div className="px-3 py-2 border-t border-white/10">
    {isPublisher ? (
      <button
        onClick={() => switchRole(activeRole === 'contractor' ? 'publisher' : 'contractor')}
        className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm
                   bg-white/5 hover:bg-white/10 transition-colors text-white/70"
      >
        <ArrowLeftRight className="w-4 h-4" />
        {activeRole === 'contractor'
          ? 'Switch to Publisher Mode'
          : 'Switch to Contractor Mode'}
      </button>
    ) : (
      <button
        onClick={addPublisherRole}
        className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm
                   bg-emerald-500/10 hover:bg-emerald-500/20 transition-colors text-emerald-400"
      >
        <Plus className="w-4 h-4" />
        Become a Publisher
      </button>
    )}
  </div>
)}
```

Import `ArrowLeftRight`, `Plus` from `lucide-react`.

**Step 3: Conditionally render nav items based on activeRole**

Replace the nav items rendering section to switch between contractor and publisher:

```tsx
const navItems = activeRole === 'publisher' ? publisherNavItems : contractorNavItems;
```

Use `navItems` in the existing map rendering.

**Step 4: Add role badge at top of sidebar**

Near the logo/username area:

```tsx
{activeRole === 'publisher' && (
  <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-emerald-500/20 text-emerald-400">
    Publisher
  </span>
)}
```

**Step 5: Commit**

```bash
git add apps/dashboard/src/components/Sidebar.tsx
git commit -m "feat: add role toggle to sidebar - contractor/publisher mode switching"
```

---

## Task 4: App Routes for Publisher Pages

**Files:**
- Modify: `apps/dashboard/src/App.tsx`

**Step 1: Add publisher route imports**

```typescript
import PublishChat from './pages/PublishChat';
import MyPublishedLeads from './pages/MyPublishedLeads';
```

**Step 2: Add routes inside the authenticated contractor routes section**

Find the contractor routes block and add alongside existing routes:

```tsx
<Route path="/publish" element={<PublishChat />} />
<Route path="/my-published" element={<MyPublishedLeads />} />
```

These don't need `RequireSubscription` — publishing is free in Phase 0.

**Step 3: Commit**

```bash
git add apps/dashboard/src/App.tsx
git commit -m "feat: add publisher routes - /publish and /my-published"
```

---

## Task 5: AI Publishing Edge Function

**Files:**
- Create: `supabase/functions/ai-publish-lead/index.ts`

**Step 1: Create the edge function**

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const VALID_PROFESSIONS = [
  'hvac', 'air_duct', 'chimney', 'dryer_vent', 'garage_door', 'locksmith',
  'roofing', 'plumbing', 'electrical', 'painting', 'cleaning', 'carpet_cleaning',
  'renovation', 'fencing', 'landscaping', 'tiling', 'kitchen', 'bathroom', 'pool', 'moving'
];

const SYSTEM_PROMPT = `You are a lead publishing assistant for LeadExpress, a US contractor marketplace.

Extract job details from the user's message and format a professional posting.

VALID PROFESSIONS (you MUST pick one): ${VALID_PROFESSIONS.join(', ')}

Extract:
- profession (MUST match one from the list above, pick closest match)
- state (US state abbreviation, e.g. "FL")
- city (city name)
- zip_code (5-digit ZIP if mentioned, otherwise null)
- description (rewrite professionally in English, 2-3 sentences. Make it sound like a real job posting.)
- urgency ("low" | "medium" | "high" — infer from context, default "medium")
- client_phone (if mentioned, format as string, otherwise null)

Respond ONLY with valid JSON:
{
  "profession": "...",
  "state": "...",
  "city": "...",
  "zip_code": "...",
  "description": "...",
  "urgency": "...",
  "client_phone": null,
  "formatted_posting": "A nicely formatted 2-3 line posting",
  "confidence": 0.0-1.0,
  "missing_fields": []
}

If profession OR location cannot be determined, set confidence below 0.5 and list missing fields.
If the user writes in Hebrew, still extract and respond in the same JSON format but keep description in English.`;

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify user
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { text, action, lead_data } = await req.json();

    // Action: parse — AI extracts structured data from natural language
    if (action === "parse") {
      const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: text },
          ],
          temperature: 0.3,
          response_format: { type: "json_object" },
        }),
      });

      const openaiData = await openaiRes.json();
      const parsed = JSON.parse(openaiData.choices[0].message.content);

      return new Response(JSON.stringify({ success: true, data: parsed }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Action: publish — insert lead into database
    if (action === "publish") {
      // Verify publisher role
      const { data: profile } = await supabase
        .from("profiles")
        .select("roles")
        .eq("id", user.id)
        .single();

      if (!profile?.roles?.includes("publisher")) {
        return new Response(JSON.stringify({ error: "Not a publisher" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Insert lead
      const { data: lead, error: insertError } = await supabase
        .from("leads")
        .insert({
          profession: lead_data.profession,
          city: lead_data.city,
          state: lead_data.state,
          zip_code: lead_data.zip_code,
          parsed_summary: lead_data.description,
          raw_message: lead_data.formatted_posting,
          urgency: lead_data.urgency === "high" ? "hot" : lead_data.urgency === "low" ? "cold" : "warm",
          source_type: "publisher",
          publisher_id: user.id,
          status: "parsed",
          sender_phone: lead_data.client_phone,
        })
        .select()
        .single();

      if (insertError) {
        return new Response(JSON.stringify({ error: insertError.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Trigger matching — find contractors with matching profession + zip_code
      const matchQuery = supabase
        .from("contractors")
        .select("profile_id")
        .contains("professions", [lead_data.profession]);

      if (lead_data.zip_code) {
        matchQuery.contains("zip_codes", [lead_data.zip_code]);
      }

      const { data: matchedContractors } = await matchQuery;
      const matchedIds = matchedContractors?.map((c: any) => c.profile_id) || [];

      if (matchedIds.length > 0) {
        await supabase
          .from("leads")
          .update({ matched_contractors: matchedIds, status: "sent" })
          .eq("id", lead.id);
      }

      // Create pipeline event
      await supabase.from("pipeline_events").insert({
        lead_id: lead.id,
        event_type: "publisher_submitted",
        metadata: {
          publisher_id: user.id,
          matched_count: matchedIds.length,
          source: "dashboard",
        },
      });

      return new Response(
        JSON.stringify({
          success: true,
          lead_id: lead.id,
          matched_count: matchedIds.length,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
```

**Step 2: Commit**

```bash
git add supabase/functions/ai-publish-lead/
git commit -m "feat: add AI publishing edge function - parse + publish actions"
```

---

## Task 6: Voice Transcription Edge Function

**Files:**
- Create: `supabase/functions/transcribe-voice/index.ts`

**Step 1: Create the edge function**

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { audio_url } = await req.json();

    if (!audio_url) {
      return new Response(JSON.stringify({ error: "audio_url required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Download audio from URL (Green API voice note URL)
    const audioRes = await fetch(audio_url);
    if (!audioRes.ok) {
      return new Response(JSON.stringify({ error: "Failed to download audio" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const audioBlob = await audioRes.blob();

    // Send to Whisper API
    const formData = new FormData();
    formData.append("file", audioBlob, "voice.ogg");
    formData.append("model", "whisper-1");
    formData.append("language", "en"); // Can detect auto, but default English

    const whisperRes = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
      },
      body: formData,
    });

    const whisperData = await whisperRes.json();

    return new Response(
      JSON.stringify({
        success: true,
        text: whisperData.text,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
```

**Step 2: Commit**

```bash
git add supabase/functions/transcribe-voice/
git commit -m "feat: add Whisper voice transcription edge function"
```

---

## Task 7: JobCardPreview Component

**Files:**
- Create: `apps/dashboard/src/components/JobCardPreview.tsx`

**Step 1: Create the component**

```tsx
import { MapPin, Wrench, Zap, Phone, Check, Pencil } from 'lucide-react';
import { PROFESSIONS } from '../lib/professions';

interface ParsedLead {
  profession: string;
  state: string;
  city: string;
  zip_code: string | null;
  description: string;
  urgency: string;
  client_phone: string | null;
  formatted_posting: string;
  confidence: number;
  missing_fields: string[];
}

interface JobCardPreviewProps {
  data: ParsedLead;
  onPublish: () => void;
  onEdit: () => void;
  isPublishing?: boolean;
}

export default function JobCardPreview({ data, onPublish, onEdit, isPublishing }: JobCardPreviewProps) {
  const prof = PROFESSIONS.find((p) => p.id === data.profession);
  const urgencyColors: Record<string, string> = {
    low: 'bg-blue-500/20 text-blue-400',
    medium: 'bg-yellow-500/20 text-yellow-400',
    high: 'bg-red-500/20 text-red-400',
  };

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-4 max-w-md">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">{prof?.emoji || '🔧'}</span>
          <span className="font-semibold text-white">{prof?.en || data.profession}</span>
        </div>
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${urgencyColors[data.urgency] || urgencyColors.medium}`}>
          {data.urgency}
        </span>
      </div>

      {/* Location */}
      <div className="flex items-center gap-1.5 text-sm text-white/60 mb-2">
        <MapPin className="w-3.5 h-3.5" />
        <span>{data.city}, {data.state} {data.zip_code || ''}</span>
      </div>

      {/* Description */}
      <p className="text-sm text-white/80 mb-3 leading-relaxed">
        {data.formatted_posting}
      </p>

      {/* Client phone if available */}
      {data.client_phone && (
        <div className="flex items-center gap-1.5 text-sm text-white/50 mb-3">
          <Phone className="w-3.5 h-3.5" />
          <span>{data.client_phone}</span>
        </div>
      )}

      {/* Confidence indicator */}
      {data.confidence < 0.7 && (
        <div className="text-xs text-yellow-400/80 mb-3">
          ⚠️ Low confidence — please verify details before publishing
        </div>
      )}

      {/* Missing fields warning */}
      {data.missing_fields?.length > 0 && (
        <div className="text-xs text-red-400/80 mb-3">
          Missing: {data.missing_fields.join(', ')}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2 mt-4">
        <button
          onClick={onPublish}
          disabled={isPublishing || (data.missing_fields?.length > 0)}
          className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2
                     bg-emerald-500 hover:bg-emerald-600 disabled:bg-white/10
                     disabled:text-white/30 rounded-lg text-sm font-medium
                     transition-colors text-white"
        >
          <Check className="w-4 h-4" />
          {isPublishing ? 'Publishing...' : 'Publish'}
        </button>
        <button
          onClick={onEdit}
          className="flex items-center justify-center gap-1.5 px-4 py-2
                     bg-white/10 hover:bg-white/15 rounded-lg text-sm
                     font-medium transition-colors text-white/70"
        >
          <Pencil className="w-4 h-4" />
          Edit
        </button>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add apps/dashboard/src/components/JobCardPreview.tsx
git commit -m "feat: add JobCardPreview component for AI chat publishing"
```

---

## Task 8: PublishChat Page (AI Chat UI)

**Files:**
- Create: `apps/dashboard/src/pages/PublishChat.tsx`

**Step 1: Create the AI chat publishing page**

```tsx
import { useState, useRef, useEffect } from 'react';
import { Send, Bot, Loader2, Plus } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import JobCardPreview from '../components/JobCardPreview';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  parsed_data?: any;
  published?: { lead_id: string; matched_count: number };
}

export default function PublishChat() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: "Hey! Tell me about a job you want to publish. Just describe it naturally — I'll format it professionally and find matching contractors.\n\nExample: \"I have a client who needs chimney cleaning in Miami, FL 33101\"",
    },
  ]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const addMessage = (msg: Omit<Message, 'id'>) => {
    const newMsg = { ...msg, id: crypto.randomUUID() };
    setMessages((prev) => [...prev, newMsg]);
    return newMsg;
  };

  const handleSend = async () => {
    if (!input.trim() || isProcessing) return;

    const userText = input.trim();
    setInput('');
    addMessage({ role: 'user', content: userText });
    setIsProcessing(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke('ai-publish-lead', {
        body: { text: userText, action: 'parse' },
      });

      if (res.error) throw new Error(res.error.message);

      const parsed = res.data.data;

      if (parsed.confidence < 0.5 || parsed.missing_fields?.length > 0) {
        const missing = parsed.missing_fields?.join(' and ') || 'some details';
        addMessage({
          role: 'assistant',
          content: `I need a bit more info — could you tell me the ${missing}?`,
        });
      } else {
        addMessage({
          role: 'assistant',
          content: "Here's your job posting — ready to publish?",
          parsed_data: parsed,
        });
      }
    } catch (err: any) {
      addMessage({
        role: 'assistant',
        content: `Something went wrong: ${err.message}. Try again?`,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePublish = async (msgId: string, data: any) => {
    setIsPublishing(true);
    try {
      const res = await supabase.functions.invoke('ai-publish-lead', {
        body: { action: 'publish', lead_data: data },
      });

      if (res.error) throw new Error(res.error.message);

      // Update the message to show published state
      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgId
            ? { ...m, published: { lead_id: res.data.lead_id, matched_count: res.data.matched_count } }
            : m
        )
      );

      addMessage({
        role: 'assistant',
        content: `Published! 🎉 ${res.data.matched_count} contractors will see this in their feed.\n\nWant to publish another job?`,
      });
    } catch (err: any) {
      addMessage({
        role: 'assistant',
        content: `Failed to publish: ${err.message}. Try again?`,
      });
    } finally {
      setIsPublishing(false);
    }
  };

  const handleEdit = (data: any) => {
    // Pre-fill the input with a correction prompt
    setInput(`Actually, change the profession to ... and location to ...`);
  };

  const startNewSession = () => {
    setMessages([
      {
        id: 'welcome',
        role: 'assistant',
        content: "Ready for another one! Tell me about the job.",
      },
    ]);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5 text-emerald-400" />
          <h1 className="text-lg font-semibold text-white">Publish a Job</h1>
        </div>
        <button
          onClick={startNewSession}
          className="flex items-center gap-1 px-3 py-1.5 text-xs bg-white/5
                     hover:bg-white/10 rounded-lg text-white/60 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          New
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                msg.role === 'user'
                  ? 'bg-emerald-500/20 text-white'
                  : 'bg-white/5 text-white/90'
              }`}
            >
              <p className="text-sm whitespace-pre-wrap">{msg.content}</p>

              {/* Job Card Preview */}
              {msg.parsed_data && !msg.published && (
                <div className="mt-3">
                  <JobCardPreview
                    data={msg.parsed_data}
                    onPublish={() => handlePublish(msg.id, msg.parsed_data)}
                    onEdit={() => handleEdit(msg.parsed_data)}
                    isPublishing={isPublishing}
                  />
                </div>
              )}

              {/* Published confirmation */}
              {msg.published && (
                <div className="mt-3 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                  <p className="text-sm text-emerald-400 font-medium">
                    ✅ Published — {msg.published.matched_count} contractors matched
                  </p>
                </div>
              )}
            </div>
          </div>
        ))}

        {isProcessing && (
          <div className="flex justify-start">
            <div className="bg-white/5 rounded-2xl px-4 py-3">
              <Loader2 className="w-4 h-4 animate-spin text-white/40" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-white/10">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder="Describe the job... e.g. 'Plumbing leak in Houston TX 77001'"
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3
                       text-sm text-white placeholder-white/30 focus:outline-none
                       focus:border-emerald-500/50 transition-colors"
            disabled={isProcessing}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isProcessing}
            className="px-4 py-3 bg-emerald-500 hover:bg-emerald-600
                       disabled:bg-white/10 disabled:text-white/30
                       rounded-xl transition-colors text-white"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add apps/dashboard/src/pages/PublishChat.tsx
git commit -m "feat: add AI chat publishing page - natural language to job postings"
```

---

## Task 9: My Published Leads Page

**Files:**
- Create: `apps/dashboard/src/pages/MyPublishedLeads.tsx`

**Step 1: Create the page**

```tsx
import { useState, useEffect } from 'react';
import { FileText, MapPin, Users, Clock } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { PROFESSIONS } from '../lib/professions';

interface PublishedLead {
  id: string;
  profession: string;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  parsed_summary: string | null;
  urgency: string;
  matched_contractors: string[] | null;
  created_at: string;
  status: string;
}

export default function MyPublishedLeads() {
  const { user } = useAuth();
  const [leads, setLeads] = useState<PublishedLead[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchLeads = async () => {
      const { data, error } = await supabase
        .from('leads')
        .select('id, profession, city, state, zip_code, parsed_summary, urgency, matched_contractors, created_at, status')
        .eq('publisher_id', user.id)
        .eq('source_type', 'publisher')
        .order('created_at', { ascending: false });

      if (!error && data) setLeads(data);
      setLoading(false);
    };
    fetchLeads();
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="flex items-center gap-2 mb-6">
        <FileText className="w-5 h-5 text-emerald-400" />
        <h1 className="text-xl font-semibold text-white">My Published Leads</h1>
        <span className="ml-2 px-2 py-0.5 text-xs bg-white/10 rounded-full text-white/60">
          {leads.length}
        </span>
      </div>

      {leads.length === 0 ? (
        <div className="text-center py-12 text-white/40">
          <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>No published leads yet.</p>
          <a href="/publish" className="text-emerald-400 text-sm hover:underline">
            Publish your first job →
          </a>
        </div>
      ) : (
        <div className="space-y-3">
          {leads.map((lead) => {
            const prof = PROFESSIONS.find((p) => p.id === lead.profession);
            const matchedCount = lead.matched_contractors?.length || 0;

            return (
              <div
                key={lead.id}
                className="bg-white/5 border border-white/10 rounded-xl p-4
                           hover:border-white/20 transition-colors"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{prof?.emoji || '🔧'}</span>
                    <span className="font-medium text-white">{prof?.en || lead.profession}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-white/40">
                    <Clock className="w-3 h-3" />
                    {new Date(lead.created_at).toLocaleDateString()}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 text-sm text-white/50 mb-2">
                  <MapPin className="w-3.5 h-3.5" />
                  {lead.city}, {lead.state} {lead.zip_code || ''}
                </div>

                {lead.parsed_summary && (
                  <p className="text-sm text-white/60 mb-3">{lead.parsed_summary}</p>
                )}

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1 text-xs text-emerald-400">
                    <Users className="w-3.5 h-3.5" />
                    {matchedCount} contractors matched
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add apps/dashboard/src/pages/MyPublishedLeads.tsx
git commit -m "feat: add My Published Leads page - publisher's lead tracking"
```

---

## Task 10: LeadsFeed — Publisher Badge

**Files:**
- Modify: `apps/dashboard/src/pages/LeadsFeed.tsx`

**Step 1: Add publisher badge to lead cards**

Find the lead card rendering section and add a source badge:

```tsx
{/* Add after the group_name display or near the lead header */}
{lead.source_type === 'publisher' ? (
  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs
                    rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
    📢 From Publisher
  </span>
) : (
  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs
                    rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/20">
    📡 {lead.group_name || 'Scanner'}
  </span>
)}
```

**Step 2: Update the Lead interface to include new fields**

```typescript
interface Lead {
  // ... existing fields ...
  source_type?: string;      // NEW
  publisher_id?: string;     // NEW
}
```

**Step 3: Add source_type to the leads query**

Find the Supabase query and add `source_type` to the select:

```typescript
.select('id, profession, parsed_summary, raw_message, city, zip_code, urgency, budget_range, sender_id, created_at, group_name, source_type, publisher_id')
```

**Step 4: Commit**

```bash
git add apps/dashboard/src/pages/LeadsFeed.tsx
git commit -m "feat: add publisher badge to LeadsFeed - distinguish scanner vs publisher leads"
```

---

## Task 11: WhatsApp Bot — Publish Intent

**Files:**
- Modify: `supabase/functions/whatsapp-webhook/index.ts`

**Step 1: Add publish intent detection**

Add a new function near the other handler functions:

```typescript
const PUBLISH_TRIGGERS_EN = ['publish a job', 'post a job', 'i have a job', 'distribute a job', 'have a lead'];
const PUBLISH_TRIGGERS_HE = ['יש לי עבודה', 'רוצה לפרסם', 'לפרסם עבודה', 'לפרסם ליד'];

function isPublishIntent(text: string): boolean {
  const lower = text.toLowerCase().trim();
  return PUBLISH_TRIGGERS_EN.some(t => lower.includes(t))
    || PUBLISH_TRIGGERS_HE.some(t => lower.includes(t));
}
```

**Step 2: Add publish flow handler**

```typescript
async function handlePublishFlow(phone: string, profile: any, messageBody: string, messageType: string, mediaUrl?: string) {
  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Check if user has publisher role
  if (!profile.roles?.includes('publisher')) {
    await sendWhatsAppMessage(phone,
      "To publish jobs, enable Publisher Mode in your dashboard first:\n" +
      "https://app.leadexpress.co.il\n\n" +
      "Go to Sidebar → 'Become a Publisher'"
    );
    return;
  }

  // If voice note, transcribe first
  let textToProcess = messageBody;
  if (messageType === 'audio' && mediaUrl) {
    try {
      const transcribeRes = await fetch(`${SUPABASE_URL}/functions/v1/transcribe-voice`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ audio_url: mediaUrl }),
      });
      const transcribeData = await transcribeRes.json();
      textToProcess = transcribeData.text;

      await sendWhatsAppMessage(phone, `🎙️ I heard: "${textToProcess}"\n\nProcessing...`);
    } catch (err) {
      await sendWhatsAppMessage(phone, "Sorry, couldn't process the voice note. Try sending a text message instead.");
      return;
    }
  }

  // Parse with AI
  try {
    const parseRes = await fetch(`${SUPABASE_URL}/functions/v1/ai-publish-lead`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: textToProcess, action: 'parse' }),
    });
    const parseData = await parseRes.json();
    const parsed = parseData.data;

    if (parsed.confidence < 0.5 || parsed.missing_fields?.length > 0) {
      const missing = parsed.missing_fields?.join(' and ') || 'details';
      await sendWhatsAppMessage(phone,
        `I need a bit more info — could you tell me the *${missing}*?\n\nJust reply with the details.`
      );
      // Store pending state — will continue on next message
      await supabaseAdmin.from('profiles')
        .update({ metadata: { pending_publish: parsed } })
        .eq('id', profile.id);
      return;
    }

    // Format and send for approval
    const jobCard = [
      '📋 *Job Ready to Publish*',
      '━━━━━━━━━━━━━━━━━━━━',
      '',
      `🔧 *Profession:* ${parsed.profession}`,
      `📍 *Location:* ${parsed.city}, ${parsed.state} ${parsed.zip_code || ''}`,
      `📝 *Description:*`,
      parsed.formatted_posting,
      '',
      `⚡ *Urgency:* ${parsed.urgency}`,
      parsed.client_phone ? `📞 *Client:* ${parsed.client_phone}` : '',
      '',
      '━━━━━━━━━━━━━━━━━━━━',
      'Reply *YES* to publish or *EDIT* to change',
    ].filter(Boolean).join('\n');

    await sendWhatsAppMessage(phone, jobCard);

    // Store pending publish data
    await supabaseAdmin.from('profiles')
      .update({ metadata: { pending_publish: parsed } })
      .eq('id', profile.id);

  } catch (err) {
    await sendWhatsAppMessage(phone, "Something went wrong processing your job. Try again?");
  }
}
```

**Step 3: Add confirmation handler**

```typescript
async function handlePublishConfirmation(phone: string, profile: any, messageBody: string) {
  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const lower = messageBody.toLowerCase().trim();

  if (lower === 'yes' || lower === 'כן' || lower === '✅') {
    const pending = profile.metadata?.pending_publish;
    if (!pending) {
      await sendWhatsAppMessage(phone, "No pending job to publish. Send me a new one!");
      return;
    }

    // Publish via edge function
    const publishRes = await fetch(`${SUPABASE_URL}/functions/v1/ai-publish-lead`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        'x-publisher-id': profile.id,
      },
      body: JSON.stringify({ action: 'publish', lead_data: pending }),
    });
    const publishData = await publishRes.json();

    // Clear pending state
    await supabaseAdmin.from('profiles')
      .update({ metadata: {} })
      .eq('id', profile.id);

    await sendWhatsAppMessage(phone,
      `✅ *Published!*\n\n${publishData.matched_count} contractors will see this job.\n\nSend me another job anytime!`
    );
  } else if (lower === 'edit' || lower === 'שנה' || lower === '✏️') {
    await sendWhatsAppMessage(phone, "What would you like to change? Just tell me and I'll update it.");
  } else if (lower === 'cancel' || lower === 'ביטול' || lower === '❌') {
    await supabaseAdmin.from('profiles')
      .update({ metadata: {} })
      .eq('id', profile.id);
    await sendWhatsAppMessage(phone, "Cancelled. Send me another job anytime!");
  }
}
```

**Step 4: Wire into existing routeMessage / handleKnownUser**

In the existing `handleKnownUser` function, add before the AI fallback:

```typescript
// Check for pending publish confirmation
if (profile.metadata?.pending_publish) {
  await handlePublishConfirmation(phone, profile, messageBody);
  return;
}

// Check for publish intent
if (isPublishIntent(messageBody) || messageType === 'audio') {
  await handlePublishFlow(phone, profile, messageBody, messageType, mediaUrl);
  return;
}
```

**Step 5: Commit**

```bash
git add supabase/functions/whatsapp-webhook/index.ts
git commit -m "feat: add WhatsApp publish flow - text + voice note support with AI parsing"
```

---

## Task 12: End-to-End Verification

**Step 1: Test migration**

Run: `cd /Users/bigjeff/Desktop/Leadexpress && supabase db push`
Expected: Migration 033 applies successfully.

**Step 2: Test auth role switching**

1. Open dashboard in browser
2. Check Sidebar shows "Become a Publisher" button
3. Click it → verify roles updated in DB
4. Verify toggle appears and switches nav items

**Step 3: Test AI publishing**

1. Navigate to `/publish`
2. Type: "I have a client who needs plumbing in Houston TX 77001"
3. Verify AI returns structured JobCardPreview
4. Click Publish → verify lead in Supabase leads table
5. Check `source_type = 'publisher'` and `publisher_id` set correctly

**Step 4: Test matching**

1. Verify `matched_contractors` populated for the published lead
2. Log in as a contractor with plumbing + Houston area
3. Verify lead appears in LeadsFeed with green "📢 From Publisher" badge

**Step 5: Test WhatsApp bot**

1. Send "I have a job to publish" to the bot number
2. Verify bot responds with formatting prompt
3. Send job description → verify AI parses and sends card
4. Reply "YES" → verify lead published

**Step 6: Test voice note (if possible)**

1. Send voice note to bot
2. Verify Whisper transcription
3. Verify AI parsing of transcription

**Step 7: Verify existing features unbroken**

1. Check scanner leads still appear in LeadsFeed
2. Check existing contractor features (subcontractors, jobs) work
3. Check admin panel still works
4. Check subscriptions still gate features

**Step 8: Final commit**

```bash
git add -A
git commit -m "feat: Distribution Network Phase 0 - AI-assisted publishing complete"
```

---

## Summary

| Task | What | ~Time |
|------|------|-------|
| 1 | Migration (roles, source_type, publisher_id) | 30min |
| 2 | Auth context (role switching) | 1hr |
| 3 | Sidebar (toggle + publisher nav) | 1hr |
| 4 | App routes | 15min |
| 5 | AI publish edge function (parse + publish) | 2hr |
| 6 | Voice transcription edge function (Whisper) | 1hr |
| 7 | JobCardPreview component | 1hr |
| 8 | PublishChat page (AI chat UI) | 2hr |
| 9 | MyPublishedLeads page | 1hr |
| 10 | LeadsFeed publisher badge | 30min |
| 11 | WhatsApp bot publish flow | 2hr |
| 12 | End-to-end verification | 1hr |
| **Total** | | **~13hr / 2-3 days** |
