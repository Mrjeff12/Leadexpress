# Group Intelligence Dashboard — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the minimal AdminGroups page with a Scoreboard + Drill-Down dashboard that ranks groups by health score and provides deep per-group analytics with market intelligence.

**Architecture:** Two pages — a Scoreboard (sortable table with computed Group Score) and a Group Detail page (4 tabs: Overview, Members, Messages, Market Intel). All data from existing Supabase tables via react-query hooks. No schema changes.

**Tech Stack:** React, Tailwind, Recharts, @tanstack/react-query, @supabase/supabase-js, Radix UI, Lucide icons.

**Design doc:** `docs/plans/2026-03-17-group-intelligence-dashboard-design.md`

---

### Task 1: Score Computation Logic

**Files:**
- Create: `apps/dashboard/src/lib/group-score.ts`

**Step 1: Create score computation module**

```typescript
// apps/dashboard/src/lib/group-score.ts

export interface GroupScoreInput {
  leadYield: number       // leads_created / messages_received (0-1)
  sellerRatio: number     // known_sellers / total_members (0-1)
  messages7d: number      // messages received in last 7 days
  hoursSinceLastLead: number // hours since most recent lead
}

export interface GroupScoreResult {
  score: number           // 0-100
  color: 'green' | 'yellow' | 'red'
  components: {
    leadYield: number
    sellerPressure: number
    activity: number
    freshness: number
  }
}

export function computeGroupScore(input: GroupScoreInput): GroupScoreResult {
  const leadYieldNorm = Math.min(input.leadYield / 0.20, 1.0) * 100
  const sellerPressureInv = (1 - input.sellerRatio) * 100
  const activityNorm = Math.min(input.messages7d / 50, 1.0) * 100
  const freshnessNorm = Math.max(0, 100 - input.hoursSinceLastLead * 2)

  const score = Math.round(
    leadYieldNorm * 0.40 +
    sellerPressureInv * 0.25 +
    activityNorm * 0.20 +
    freshnessNorm * 0.15
  )

  const color = score >= 70 ? 'green' : score >= 40 ? 'yellow' : 'red'

  return {
    score,
    color,
    components: {
      leadYield: Math.round(leadYieldNorm),
      sellerPressure: Math.round(sellerPressureInv),
      activity: Math.round(activityNorm),
      freshness: Math.round(freshnessNorm),
    },
  }
}

export function getScoreColorClass(color: GroupScoreResult['color']): string {
  switch (color) {
    case 'green': return 'bg-emerald-100 text-emerald-700'
    case 'yellow': return 'bg-amber-100 text-amber-700'
    case 'red': return 'bg-red-100 text-red-700'
  }
}
```

**Step 2: Commit**

```bash
git add apps/dashboard/src/lib/group-score.ts
git commit -m "feat(groups): add group score computation logic"
```

---

### Task 2: Scoreboard Data Hook

**Files:**
- Create: `apps/dashboard/src/hooks/useGroupScoreboard.ts`

**Step 1: Create the hook**

This hook fetches all groups with their pipeline stats in a single efficient query, then computes scores client-side.

```typescript
// apps/dashboard/src/hooks/useGroupScoreboard.ts

import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { queryClient } from '../lib/queryClient'
import { computeGroupScore, type GroupScoreResult } from '../lib/group-score'

const SCOREBOARD_KEY = ['admin', 'group-scoreboard'] as const

export interface GroupRow {
  id: string
  name: string
  wa_group_id: string
  status: string
  category: string | null
  total_members: number
  known_sellers: number
  known_buyers: number
  message_count: number
  last_message_at: string | null
  created_at: string
  // Computed fields
  messagesReceived: number
  leadsCreated: number
  messages7d: number
  leadYield: number
  lastLeadAt: string | null
  score: GroupScoreResult
}

async function fetchScoreboardData(): Promise<GroupRow[]> {
  // 1. Fetch all groups
  const { data: groups, error: gErr } = await supabase
    .from('groups')
    .select('*')
    .order('created_at', { ascending: false })

  if (gErr || !groups) throw gErr || new Error('No groups')

  // 2. For each group, fetch pipeline stats via aggregate queries
  // Use RPC or manual queries since supabase-js doesn't support GROUP BY easily
  const groupIds = groups.map((g: any) => g.id)

  // Pipeline events: count received + lead_created per group
  const { data: pipeStats } = await supabase
    .from('pipeline_events')
    .select('group_id, stage')
    .in('group_id', groupIds)
    .in('stage', ['received', 'lead_created'])

  // Pipeline events last 7 days: count received per group
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const { data: recent } = await supabase
    .from('pipeline_events')
    .select('group_id')
    .in('group_id', groupIds)
    .eq('stage', 'received')
    .gte('created_at', sevenDaysAgo)

  // Latest lead per group
  const { data: latestLeads } = await supabase
    .from('leads')
    .select('group_id, created_at')
    .in('group_id', groupIds)
    .order('created_at', { ascending: false })

  // Aggregate pipeline stats
  const received: Record<string, number> = {}
  const leads: Record<string, number> = {}
  const msgs7d: Record<string, number> = {}
  const lastLead: Record<string, string> = {}

  pipeStats?.forEach((e: any) => {
    if (e.stage === 'received') received[e.group_id] = (received[e.group_id] || 0) + 1
    if (e.stage === 'lead_created') leads[e.group_id] = (leads[e.group_id] || 0) + 1
  })

  recent?.forEach((e: any) => {
    msgs7d[e.group_id] = (msgs7d[e.group_id] || 0) + 1
  })

  latestLeads?.forEach((l: any) => {
    if (!lastLead[l.group_id]) lastLead[l.group_id] = l.created_at
  })

  // Build rows
  return groups.map((g: any) => {
    const messagesReceived = received[g.id] || 0
    const leadsCreated = leads[g.id] || 0
    const messages7d_count = msgs7d[g.id] || 0
    const leadYield = messagesReceived > 0 ? leadsCreated / messagesReceived : 0
    const lastLeadAt = lastLead[g.id] || null
    const hoursSinceLastLead = lastLeadAt
      ? (Date.now() - new Date(lastLeadAt).getTime()) / (1000 * 60 * 60)
      : 999

    const score = computeGroupScore({
      leadYield,
      sellerRatio: g.total_members > 0 ? (g.known_sellers || 0) / g.total_members : 0,
      messages7d: messages7d_count,
      hoursSinceLastLead,
    })

    return {
      id: g.id,
      name: g.name,
      wa_group_id: g.wa_group_id,
      status: g.status,
      category: g.category,
      total_members: g.total_members || 0,
      known_sellers: g.known_sellers || 0,
      known_buyers: g.known_buyers || 0,
      message_count: g.message_count || 0,
      last_message_at: g.last_message_at,
      created_at: g.created_at,
      messagesReceived: messagesReceived,
      leadsCreated: leadsCreated,
      messages7d: messages7d_count,
      leadYield,
      lastLeadAt,
      score,
    }
  })
}

export function useGroupScoreboard() {
  const query = useQuery({
    queryKey: SCOREBOARD_KEY,
    queryFn: fetchScoreboardData,
    refetchInterval: 30_000,
  })

  // Realtime: invalidate on new pipeline events
  useEffect(() => {
    const channel = supabase
      .channel('group-scoreboard-rt')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pipeline_events' }, () => {
        queryClient.invalidateQueries({ queryKey: SCOREBOARD_KEY })
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  return query
}
```

**Step 2: Commit**

```bash
git add apps/dashboard/src/hooks/useGroupScoreboard.ts
git commit -m "feat(groups): add scoreboard data hook with score computation"
```

---

### Task 3: Scoreboard Page (replace AdminGroups)

**Files:**
- Modify: `apps/dashboard/src/pages/AdminGroups.tsx` (full rewrite)

**Step 1: Rewrite AdminGroups as Scoreboard**

Replace the entire file with the Scoreboard implementation:
- 4 KPI cards at top (Total Groups, Active, Avg Yield, Needing Attention)
- Filters row (status dropdown, category dropdown, search input)
- Sortable table with Score, Name, Status, Lead Yield, Sellers, Activity, Last Lead, Actions
- Score shown as colored badge (green/yellow/red)
- Activity shown as a mini progress bar
- Last Lead shown as relative time ("2h ago", "3d ago")
- "View" button navigates to `/admin/groups/:id`

**Key patterns to follow:**
- Use `glass-panel` class for cards
- Use `badge`, `badge-green` classes for status badges
- Use `useI18n()` for Hebrew/English labels
- Use `useNavigate()` for drill-down navigation
- Use Lucide icons: `TrendingUp`, `TrendingDown`, `AlertTriangle`, `Eye`, `Search`, `Filter`
- State: `sortBy`, `sortDir`, `statusFilter`, `categoryFilter`, `searchQuery`
- Sort and filter client-side (data is small: <100 groups)

**Step 2: Verify scoreboard renders**

Run: dev server, navigate to `/admin/groups`
Expected: KPI cards + sortable table with group scores

**Step 3: Commit**

```bash
git add apps/dashboard/src/pages/AdminGroups.tsx
git commit -m "feat(groups): replace AdminGroups with Group Intelligence Scoreboard"
```

---

### Task 4: Group Detail Data Hook

**Files:**
- Create: `apps/dashboard/src/hooks/useGroupDetail.ts`

**Step 1: Create the hook**

This hook provides all data for the Group Detail page, organized by tab:

```typescript
// apps/dashboard/src/hooks/useGroupDetail.ts

import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { queryClient } from '../lib/queryClient'

// --- Types ---

export interface GroupInfo {
  id: string
  name: string
  wa_group_id: string
  status: string
  category: string | null
  total_members: number
  known_sellers: number
  known_buyers: number
  created_at: string
}

export interface FunnelStep {
  stage: string
  count: number
  pct: number
}

export interface ActivityDay {
  date: string
  messages: number
  leads: number
}

export interface MemberRow {
  id: string
  wa_sender_id: string
  display_name: string | null
  classification: string
  total_messages: number
  lead_messages: number
  service_messages: number
  last_seen_at: string | null
  manual_override: boolean
}

export interface MessageRow {
  wa_message_id: string
  sender_id: string
  sender_name: string | null
  sender_classification: string
  body: string
  timestamp: string
  outcome: 'lead' | 'seller_filtered' | 'filtered' | 'no_lead'
  lead_id: string | null
  profession: string | null
}

export interface MarketIntel {
  professions: { name: string; count: number; pct: number }[]
  regions: { name: string; count: number; pct: number }[]
  urgency: { level: string; count: number; pct: number }[]
  repeatRequesters: {
    sender_id: string
    display_name: string | null
    request_count: number
    professions: string[]
    last_request: string
  }[]
}

// --- Fetchers ---

async function fetchGroupInfo(groupId: string): Promise<GroupInfo> {
  const { data, error } = await supabase
    .from('groups')
    .select('*')
    .eq('id', groupId)
    .single()
  if (error || !data) throw error || new Error('Group not found')
  return data as GroupInfo
}

async function fetchFunnel(groupId: string): Promise<FunnelStep[]> {
  const { data } = await supabase
    .from('pipeline_events')
    .select('stage')
    .eq('group_id', groupId)

  if (!data) return []

  const counts: Record<string, number> = {}
  data.forEach((e: any) => {
    counts[e.stage] = (counts[e.stage] || 0) + 1
  })

  const total = counts['received'] || 1
  const stages = ['received', 'quick_filtered', 'sender_filtered', 'no_lead', 'lead_created']
  return stages
    .filter(s => counts[s])
    .map(s => ({ stage: s, count: counts[s] || 0, pct: Math.round(((counts[s] || 0) / total) * 100) }))
}

async function fetchActivity(groupId: string): Promise<ActivityDay[]> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const { data } = await supabase
    .from('pipeline_events')
    .select('stage, created_at')
    .eq('group_id', groupId)
    .in('stage', ['received', 'lead_created'])
    .gte('created_at', thirtyDaysAgo)
    .order('created_at', { ascending: true })

  if (!data) return []

  const dayMap: Record<string, { messages: number; leads: number }> = {}
  data.forEach((e: any) => {
    const day = e.created_at.slice(0, 10)
    if (!dayMap[day]) dayMap[day] = { messages: 0, leads: 0 }
    if (e.stage === 'received') dayMap[day].messages++
    if (e.stage === 'lead_created') dayMap[day].leads++
  })

  return Object.entries(dayMap)
    .map(([date, v]) => ({ date, ...v }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

async function fetchMembers(groupId: string): Promise<MemberRow[]> {
  const { data } = await supabase
    .from('group_members')
    .select('*')
    .eq('group_id', groupId)
    .order('total_messages', { ascending: false })

  return (data || []) as MemberRow[]
}

async function fetchMarketIntel(groupId: string): Promise<MarketIntel> {
  const { data: leads } = await supabase
    .from('leads')
    .select('profession, state, urgency, sender_id, created_at')
    .eq('group_id', groupId)

  if (!leads || leads.length === 0) {
    return { professions: [], regions: [], urgency: [], repeatRequesters: [] }
  }

  // Professions
  const profMap: Record<string, number> = {}
  leads.forEach((l: any) => { if (l.profession) profMap[l.profession] = (profMap[l.profession] || 0) + 1 })
  const professions = Object.entries(profMap)
    .map(([name, count]) => ({ name, count, pct: Math.round((count / leads.length) * 100) }))
    .sort((a, b) => b.count - a.count)

  // Regions
  const regMap: Record<string, number> = {}
  leads.forEach((l: any) => { if (l.state) regMap[l.state] = (regMap[l.state] || 0) + 1 })
  const regions = Object.entries(regMap)
    .map(([name, count]) => ({ name, count, pct: Math.round((count / leads.length) * 100) }))
    .sort((a, b) => b.count - a.count)

  // Urgency
  const urgMap: Record<string, number> = {}
  leads.forEach((l: any) => { if (l.urgency) urgMap[l.urgency] = (urgMap[l.urgency] || 0) + 1 })
  const urgency = Object.entries(urgMap)
    .map(([level, count]) => ({ level, count, pct: Math.round((count / leads.length) * 100) }))

  // Repeat requesters
  const senderMap: Record<string, { count: number; profs: Set<string>; last: string }> = {}
  leads.forEach((l: any) => {
    if (!l.sender_id) return
    if (!senderMap[l.sender_id]) senderMap[l.sender_id] = { count: 0, profs: new Set(), last: '' }
    senderMap[l.sender_id].count++
    if (l.profession) senderMap[l.sender_id].profs.add(l.profession)
    if (l.created_at > senderMap[l.sender_id].last) senderMap[l.sender_id].last = l.created_at
  })

  const repeatRequesters = Object.entries(senderMap)
    .filter(([, v]) => v.count >= 2)
    .map(([sender_id, v]) => ({
      sender_id,
      display_name: null as string | null,  // Will be enriched below
      request_count: v.count,
      professions: Array.from(v.profs),
      last_request: v.last,
    }))
    .sort((a, b) => b.request_count - a.request_count)

  return { professions, regions, urgency, repeatRequesters }
}

// --- Hook ---

export function useGroupDetail(groupId: string | undefined) {
  const baseKey = ['admin', 'group-detail', groupId]

  const infoQuery = useQuery({
    queryKey: [...baseKey, 'info'],
    queryFn: () => fetchGroupInfo(groupId!),
    enabled: !!groupId,
  })

  const funnelQuery = useQuery({
    queryKey: [...baseKey, 'funnel'],
    queryFn: () => fetchFunnel(groupId!),
    enabled: !!groupId,
  })

  const activityQuery = useQuery({
    queryKey: [...baseKey, 'activity'],
    queryFn: () => fetchActivity(groupId!),
    enabled: !!groupId,
  })

  const membersQuery = useQuery({
    queryKey: [...baseKey, 'members'],
    queryFn: () => fetchMembers(groupId!),
    enabled: !!groupId,
  })

  const marketQuery = useQuery({
    queryKey: [...baseKey, 'market'],
    queryFn: () => fetchMarketIntel(groupId!),
    enabled: !!groupId,
    staleTime: 60_000,
  })

  // Realtime for pipeline events + members
  useEffect(() => {
    if (!groupId) return
    const channel = supabase
      .channel(`group-detail-${groupId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pipeline_events', filter: `group_id=eq.${groupId}` }, () => {
        queryClient.invalidateQueries({ queryKey: [...baseKey, 'funnel'] })
        queryClient.invalidateQueries({ queryKey: [...baseKey, 'activity'] })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'group_members', filter: `group_id=eq.${groupId}` }, () => {
        queryClient.invalidateQueries({ queryKey: [...baseKey, 'members'] })
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [groupId])

  return {
    info: infoQuery.data,
    funnel: funnelQuery.data,
    activity: activityQuery.data,
    members: membersQuery.data,
    market: marketQuery.data,
    isLoading: infoQuery.isLoading,
    isError: infoQuery.isError,
  }
}
```

**Step 2: Commit**

```bash
git add apps/dashboard/src/hooks/useGroupDetail.ts
git commit -m "feat(groups): add group detail data hook with funnel/activity/market intel"
```

---

### Task 5: Group Detail Page — Overview Tab

**Files:**
- Create: `apps/dashboard/src/pages/AdminGroupDetail.tsx`

**Step 1: Create the page with Overview tab**

Structure:
- Header: group name, score badge, status badge, category, back button
- 6 KPI cards (Total Messages, Leads, Yield %, Active Members, Known Sellers, Days Active)
- Lead Funnel: horizontal BarChart (Recharts) showing pipeline stages
- Activity Over Time: AreaChart (Recharts) — 30 days, messages + leads overlay
- Tab navigation: Overview | Members | Messages | Market Intel

**Key patterns:**
- `useParams<{ id: string }>()` to get group ID from URL
- `useGroupDetail(id)` for all data
- `useNavigate()` for back button → `/admin/groups`
- `useI18n()` for Hebrew/English
- Recharts `BarChart` for funnel, `AreaChart` for timeline
- Tab state via `useState<'overview' | 'members' | 'messages' | 'market'>('overview')`

**Funnel stage labels (Hebrew/English):**
- received → "התקבלו" / "Received"
- quick_filtered → "סינון מהיר" / "Quick Filtered"
- sender_filtered → "שולח מוכר" / "Seller Filtered"
- no_lead → "לא ליד" / "Not a Lead"
- lead_created → "ליד נוצר" / "Lead Created"

**Step 2: Add route to AdminLayout**

In `apps/dashboard/src/components/AdminLayout.tsx`, add:
```tsx
import AdminGroupDetail from '../pages/AdminGroupDetail'
// In Routes:
<Route path="/groups/:id" element={<AdminGroupDetail />} />
```

**Step 3: Verify page renders**

Run: dev server, click on a group row in Scoreboard
Expected: Header + KPI cards + Funnel chart + Activity chart

**Step 4: Commit**

```bash
git add apps/dashboard/src/pages/AdminGroupDetail.tsx apps/dashboard/src/components/AdminLayout.tsx
git commit -m "feat(groups): add Group Detail page with Overview tab (KPIs, funnel, activity chart)"
```

---

### Task 6: Group Detail — Members Tab

**Files:**
- Modify: `apps/dashboard/src/pages/AdminGroupDetail.tsx`

**Step 1: Add Members tab content**

When tab === 'members', render:
- Sortable table: Name, Classification (badge), Messages, Leads, Seller Ratio (%), Last Seen (relative), Override (edit button)
- Classification badges: buyer → green, seller → red, bot → gray, unknown → outline, admin → blue
- Override: click edit → Radix `Select` dropdown with options: buyer, seller, bot, admin
- On override select: `supabase.from('group_members').update({ classification, manual_override: true }).eq('id', member.id)`
- Invalidate members query after mutation

**Step 2: Verify members tab**

Navigate to group detail → Members tab
Expected: sortable member table with classification badges and override dropdowns

**Step 3: Commit**

```bash
git add apps/dashboard/src/pages/AdminGroupDetail.tsx
git commit -m "feat(groups): add Members tab with classification override"
```

---

### Task 7: Group Detail — Messages Tab

**Files:**
- Modify: `apps/dashboard/src/pages/AdminGroupDetail.tsx`

**Step 1: Add Messages tab content**

When tab === 'messages':
- Fetch messages from WA-Listener API: `GET /api/messages/${group.wa_group_id}?limit=50`
  - The API base URL should come from `import.meta.env.VITE_LISTENER_URL` (check existing pattern in useAdminWhatsAppData.ts)
- Render as vertical feed (not table):
  - Each message is a `glass-panel` card with left border color:
    - Green: `border-l-4 border-emerald-400` if outcome is lead
    - Red: `border-l-4 border-red-400` if sender is seller
    - Gray: `border-l-4 border-gray-200` otherwise
  - Show: sender name + classification badge, relative time, message text (truncated 200 chars with "Show more")
  - If lead: profession badge + link to lead
- "Load More" button at bottom (increment offset by 50)

**Step 2: Verify messages tab**

Navigate to group detail → Messages tab
Expected: color-coded message feed with sender badges

**Step 3: Commit**

```bash
git add apps/dashboard/src/pages/AdminGroupDetail.tsx
git commit -m "feat(groups): add Messages tab with color-coded message feed"
```

---

### Task 8: Group Detail — Market Intelligence Tab

**Files:**
- Modify: `apps/dashboard/src/pages/AdminGroupDetail.tsx`

**Step 1: Add Market Intelligence tab**

When tab === 'market':
- **Top Professions**: Horizontal bar chart (Recharts BarChart) or pill badges showing top professions with percentages
- **Hot Regions**: Pill badges showing top states with counts
- **Urgency Mix**: Three colored cards (hot=red, warm=amber, cold=blue) showing percentage
- **Repeat Requesters**: Table showing sender_id, request count, professions list, last request date
  - Highlight these as "high-value prospects" with a flame icon

Each section in its own `glass-panel`.

If no leads for this group, show empty state: "No leads from this group yet"

**Step 2: Verify market intel tab**

Navigate to group detail → Market Intelligence tab
Expected: profession breakdown, region stats, urgency mix, repeat requesters

**Step 3: Commit**

```bash
git add apps/dashboard/src/pages/AdminGroupDetail.tsx
git commit -m "feat(groups): add Market Intelligence tab with profession/region/urgency analytics"
```

---

### Task 9: Sidebar Navigation Update

**Files:**
- Modify: `apps/dashboard/src/components/AdminSidebar.tsx`

**Step 1: Update the nav item**

In the `channels` category, update the Groups nav item:
- Change icon from `Radio` to `BarChart3` (import from lucide-react)
- Keep label: "קבוצות" / "Groups"
- Keep path: `/admin/groups`

This is a minimal change — the route already exists, we're just updating the icon to reflect the new intelligence dashboard.

**Step 2: Commit**

```bash
git add apps/dashboard/src/components/AdminSidebar.tsx
git commit -m "feat(groups): update sidebar icon for Group Intelligence"
```

---

### Task 10: Final Verification & Polish

**Step 1: Full flow test**

Navigate through the complete flow:
1. `/admin/groups` → Scoreboard loads with scores, sorting works, filters work
2. Click a group → Detail page loads with Overview tab (KPIs, funnel, activity chart)
3. Members tab → table loads, classification override works
4. Messages tab → feed loads with color coding
5. Market Intelligence tab → analytics display correctly
6. Back button → returns to Scoreboard

**Step 2: Check for console errors**

Open browser devtools, check for React warnings or Supabase errors.

**Step 3: Fix any issues found**

Address any rendering, data, or styling issues.

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat(groups): Group Intelligence Dashboard complete — scoreboard + detail with 4 tabs"
```
