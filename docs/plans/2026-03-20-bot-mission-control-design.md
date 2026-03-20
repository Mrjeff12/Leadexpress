# Bot Mission Control — Design Document

**Date**: 2026-03-20
**Status**: Approved
**Author**: Jeff + Claude

---

## Overview

Transform the LeadExpress WhatsApp bot from a monolithic 1,538-line Edge Function into a **multi-agent architecture** with a **visual management UI** (Bot Mission Control). All agent config (instructions, tools, handoffs, guardrails) lives in the database and is editable via a React Flow canvas — changes take effect immediately without redeployment.

## Goals

1. **Multi-Agent**: Split monolith into 6 focused agents with handoff routing
2. **Live Editing**: Edit prompts, tools, models, handoffs from the UI
3. **Zero-Deploy Updates**: DB-driven config — no Edge Function redeploy needed
4. **Visual Flow**: React Flow canvas shows agent topology + handoff connections
5. **Full Control**: Create/delete tools, guardrails, model selection per agent

---

## Database Schema

### `bot_agents`

| Column | Type | Description |
|--------|------|-------------|
| id | uuid PK | |
| slug | text UNIQUE | "router", "lead_agent", etc. |
| name | text | "🔥 Lead Agent" |
| description | text | Short description for canvas |
| instructions | text | System prompt (editable) |
| model | text | "gpt-4o-mini" / "gpt-4o" |
| temperature | float | 0.0 – 1.0, default 0.3 |
| handoff_targets | text[] | ["settings_agent", "chat_agent"] |
| guardrails | jsonb | {max_tokens, blocked_words, pii_filter, language_lock} |
| position_x | float | Canvas X position |
| position_y | float | Canvas Y position |
| color | text | Node color hex |
| icon | text | Emoji icon |
| is_entry_point | boolean | true for Router only |
| is_active | boolean | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### `bot_tools`

| Column | Type | Description |
|--------|------|-------------|
| id | uuid PK | |
| slug | text UNIQUE | "show_menu", "claim_lead" |
| name | text | "Show Menu" |
| description | text | For OpenAI function schema |
| parameters | jsonb | JSON Schema of params |
| handler_type | text | "db_query" / "db_mutation" / "api_call" / "edge_function" / "internal" |
| handler_config | jsonb | {table, action, fields} or {url, method} |
| is_active | boolean | |
| created_at | timestamptz | |

### `bot_agent_tools` (junction)

| Column | Type |
|--------|------|
| agent_id | uuid FK → bot_agents |
| tool_id | uuid FK → bot_tools |
| PRIMARY KEY | (agent_id, tool_id) |

---

## Multi-Agent Architecture

### 6 Agents

```
🤖 Router Agent (entry point)
│  model: gpt-4o-mini
│  instructions: "Classify user intent. Handoff to the correct agent.
│    If lead-related → lead_agent. If settings → settings_agent.
│    If onboarding needed → onboarding_agent. If posting job → post_job_agent.
│    Otherwise → chat_agent. Never answer directly — always handoff."
│  tools: none
│  handoffs: [onboarding, lead, settings, post_job, chat]
│
├──→ 📋 Onboarding Agent
│     instructions: "Guide contractor through 4-step setup: profession, city, days, confirm."
│     tools: save_profile, show_professions, show_cities
│     handoffs: → router (on complete)
│
├──→ 🔥 Lead Agent
│     instructions: "Help contractor claim or pass leads. Show urgency/budget."
│     tools: claim_lead, pass_lead, show_lead_details
│     handoffs: → router
│
├──→ ⚙️ Settings Agent
│     instructions: "Help update profile: trades, areas, days, pause/resume."
│     tools: update_trades, update_areas, update_days, pause_leads, resume_leads, show_settings
│     handoffs: → router
│
├──→ 📝 Post Job Agent
│     instructions: "Collect job details (profession, city, description, urgency, budget) and publish."
│     tools: publish_job
│     handoffs: → router
│
└──→ 💬 Chat Agent
      instructions: "General assistant. Short WhatsApp-friendly answers."
      tools: show_menu, show_stats, checkin_available, checkin_off
      handoffs: → router (if intent changes)
```

### Routing Logic

```
Incoming message
  → Pre-routing (button payloads, connection codes, onboarding state)
  → If free-text: Router Agent classifies → handoff to target
  → Target agent responds with tools + handoff back capability
  → Session tracks: current_agent, previous_response_id
```

### Session Enhancement

```
wa_agent_sessions (updated):
  + current_agent_slug  text  -- tracks which agent is active
  + handoff_history     jsonb -- [{from, to, reason, timestamp}]
```

---

## UI — Bot Mission Control

### Page Location

`/admin/bot` — accessible from admin sidebar

### Layout

```
┌─────────────────────────────────────────────────────────────┐
│  🛸 Bot Mission Control                  [+ Agent] [Deploy] │
├─────────────────────────────────────────────┬───────────────┤
│                                             │               │
│           React Flow Canvas                 │  Editor Panel │
│                                             │  (slide-in)   │
│   Agents as nodes                           │               │
│   Handoffs as animated edges                │  Tabs:        │
│   Click node → open editor                  │  Instructions │
│   Drag to reposition                        │  Tools        │
│   Zoom/pan                                  │  Handoffs     │
│                                             │  Guardrails   │
│                                             │  Test         │
│                                             │               │
├─────────────────────────────────────────────┴───────────────┤
│  Status bar: 6 agents │ 11 tools │ Last edit: just now      │
└─────────────────────────────────────────────────────────────┘
```

### Node Design (Space Theme)

- Dark background (#0a0a1a)
- Glowing nodes with colored borders per agent
- Animated dashed edges for handoffs
- Pulse animation on entry-point node (Router)
- Status indicator: green dot = active, gray = inactive

### Editor Panel Tabs

**Instructions Tab:**
- Name, description (inline edit)
- Model dropdown (gpt-4o-mini / gpt-4o)
- Temperature slider
- Full-height code editor for system prompt (monaco-like textarea)

**Tools Tab:**
- List of assigned tools with toggle on/off
- [+ New Tool] button → modal: name, description, params JSON, handler config
- Click tool → expand inline editor for params/handler
- Drag tool from global pool to assign

**Handoffs Tab:**
- Visual list of handoff targets
- [+ Add Handoff] → dropdown of other agents
- Remove handoff with X button

**Guardrails Tab:**
- Max tokens (number input)
- Blocked words (tag input)
- PII filter toggle
- Language lock dropdown (Auto / English / Hebrew)

**Test Tab:**
- Text input to simulate a message
- Shows: which agent handles, what tools called, response
- Dry-run mode (no DB side effects)

---

## Edge Function Refactor

### Before (hardcoded)
```typescript
const SYSTEM_PROMPT = "You are LeadExpress AI..."
const tools = [{ name: "show_menu", ... }, ...]
```

### After (DB-driven)
```typescript
// Load all active agents with their tools
const { data: agents } = await supabase
  .from('bot_agents')
  .select('*, bot_agent_tools(bot_tools(*))')
  .eq('is_active', true)

// Get or create session (now tracks current_agent)
const session = await getOrCreateSession(phone)

// Pre-routing: buttons, codes, onboarding
const preRouted = handlePreRouting(message, session)
if (preRouted) return preRouted

// Router agent classifies intent
const router = agents.find(a => a.is_entry_point)
const classification = await classifyIntent(router, message, session)

// Handoff to target agent
const target = agents.find(a => a.slug === classification.target_agent)
const response = await runAgent(target, message, session)

// Handle tool calls from response
for (const toolCall of response.tool_calls) {
  await executeToolHandler(toolCall, target.tools)
}
```

---

## Implementation Order

1. **DB Migration** — Create tables
2. **Seed Data** — Extract current config into 6 agents + 11 tools
3. **UI: Bot Mission Control** — React Flow canvas + editor panel
4. **Edge Function Refactor** — Dynamic loading + multi-agent router
5. **Test** — Edit on UI → verify bot behavior changes
6. **Polish** — Animations, test tab, deploy button

---

## Tech Stack

- **Canvas**: React Flow (already in project)
- **Editor**: Textarea with syntax hints (keep it simple)
- **State**: React Query for fetching/mutating bot_agents
- **Theme**: Space dark theme (consistent with admin canvas)
- **DB**: Supabase (direct reads, no cache for now)
