# Data Flow Fix + Group Intelligence Features — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix RLS so dashboard can read pipeline_events/group_members, then add health alerts, repeat requester badges, and seasonal trends.

**Architecture:** Migration to populate profiles + fix RLS policies. Client-side computed alerts from existing hook data. New Supabase queries for repeat requesters and trends.

**Tech Stack:** PostgreSQL (Supabase migrations), React, Recharts, @tanstack/react-query

**Design doc:** `docs/plans/2026-03-17-data-flow-fix-and-alerts-design.md`

---

### Task 1: RLS Fix Migration

**Files:**
- Create: `supabase/migrations/016_fix_pipeline_rls.sql`

**Step 1: Create the migration**

This migration does 3 things:
1. Auto-creates profile rows for new signups (trigger)
2. Inserts admin profile for all existing auth.users (Jeff)
3. Updates pipeline_events and group_members RLS to use `is_admin()` helper (from migration 015)
4. Adds UPDATE policy on group_members for admin (needed by Members tab override)

```sql
-- 016: Fix pipeline_events/group_members RLS + auto-populate profiles

-- 1. Trigger to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, role, full_name)
  VALUES (new.id, 'contractor', COALESCE(new.raw_user_meta_data->>'full_name', 'User'))
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. Backfill: set ALL existing auth.users as admin (they are Jeff)
INSERT INTO public.profiles (id, role, full_name)
SELECT id, 'admin', COALESCE(raw_user_meta_data->>'full_name', 'Admin')
FROM auth.users
ON CONFLICT (id) DO UPDATE SET role = 'admin';

-- 3. Fix pipeline_events RLS: use is_admin() helper
DROP POLICY IF EXISTS pe_admin_read ON public.pipeline_events;
CREATE POLICY pe_admin_read ON public.pipeline_events
  FOR SELECT USING (public.is_admin());

-- Keep existing service write policy (pe_service_write) untouched

-- 4. Fix group_members RLS: use is_admin() helper
DROP POLICY IF EXISTS gm_admin ON public.group_members;

CREATE POLICY gm_admin_select ON public.group_members
  FOR SELECT USING (public.is_admin());

CREATE POLICY gm_admin_update ON public.group_members
  FOR UPDATE USING (public.is_admin());

-- Keep existing service insert/update policies untouched
```

**Step 2: Run the migration**

The migration must be run against Supabase. Create a helper script:

```bash
# From project root:
node run-sql.js supabase/migrations/016_fix_pipeline_rls.sql
```

Or if `run-sql.js` doesn't accept file args, paste the SQL into the Supabase SQL editor.

**Step 3: Verify data is now visible**

Test from the dashboard: navigate to `/admin/groups`, click a group. The KPIs should now show real numbers (if WA Listener has been processing messages).

**Step 4: Commit**

```bash
git add supabase/migrations/016_fix_pipeline_rls.sql
git commit -m "fix(db): populate profiles + fix pipeline_events/group_members RLS for admin"
```

---

### Task 2: Health Alerts Banner

**Files:**
- Modify: `apps/dashboard/src/hooks/useGroupScoreboard.ts` — add `messages14d` field + prev week data
- Modify: `apps/dashboard/src/pages/AdminGroups.tsx` — add alerts section

**Step 1: Update the scoreboard hook to include prev-week data**

In `apps/dashboard/src/hooks/useGroupScoreboard.ts`, inside `fetchScoreboardData()`:

After the existing `sevenDaysAgo` query, add a query for 7-14 days ago:

```typescript
// Add after the "recent" query (7-day messages):
const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
const { data: prevWeek } = await supabase
  .from('pipeline_events')
  .select('group_id')
  .in('group_id', groupIds)
  .eq('stage', 'received')
  .gte('created_at', fourteenDaysAgo)
  .lt('created_at', sevenDaysAgo)
```

Add aggregation:
```typescript
const msgsPrev7d: Record<string, number> = {}
prevWeek?.forEach((e: any) => {
  msgsPrev7d[e.group_id] = (msgsPrev7d[e.group_id] || 0) + 1
})
```

Add to `GroupRow` interface:
```typescript
messagesPrev7d: number
```

Add to the return map:
```typescript
messagesPrev7d: msgsPrev7d[g.id] || 0,
```

Also add `repeatRequesters` count per group. Add a new query:
```typescript
const { data: repeats } = await supabase
  .from('leads')
  .select('group_id, sender_id')
  .in('group_id', groupIds)

const repeatCounts: Record<string, number> = {}
if (repeats) {
  const senderGroups: Record<string, Record<string, number>> = {}
  repeats.forEach((r: any) => {
    if (!r.sender_id) return
    const key = r.group_id
    if (!senderGroups[key]) senderGroups[key] = {}
    senderGroups[key][r.sender_id] = (senderGroups[key][r.sender_id] || 0) + 1
  })
  Object.entries(senderGroups).forEach(([gid, senders]) => {
    repeatCounts[gid] = Object.values(senders).filter(c => c >= 2).length
  })
}
```

Add to `GroupRow` interface:
```typescript
repeatRequesters: number
```

Add to the return map:
```typescript
repeatRequesters: repeatCounts[g.id] || 0,
```

**Step 2: Commit hook changes**

```bash
git add apps/dashboard/src/hooks/useGroupScoreboard.ts
git commit -m "feat(groups): add prev-week activity + repeat requester counts to scoreboard hook"
```

**Step 3: Add alerts banner to AdminGroups.tsx**

In `apps/dashboard/src/pages/AdminGroups.tsx`, add after the imports:

```typescript
import { ShieldAlert, Skull, TrendingDown, Flame } from 'lucide-react'
```

Add a new `useMemo` for alerts computation (after `kpis`):

```typescript
interface Alert {
  type: 'spam' | 'dead' | 'declining'
  groupId: string
  groupName: string
  message: string
}

const alerts = useMemo(() => {
  if (!groups) return []
  const result: Alert[] = []
  const now = Date.now()
  const threeDays = 3 * 24 * 60 * 60 * 1000

  groups.forEach((g) => {
    // Spam: seller ratio > 60%
    if (g.total_members > 0 && g.known_sellers / g.total_members > 0.6) {
      const pct = Math.round((g.known_sellers / g.total_members) * 100)
      result.push({
        type: 'spam',
        groupId: g.id,
        groupName: g.name,
        message: he ? `${pct}% מוכרים` : `${pct}% sellers`,
      })
    }
    // Dead: no messages in 3+ days
    if (g.last_message_at && now - new Date(g.last_message_at).getTime() > threeDays) {
      const days = Math.floor((now - new Date(g.last_message_at).getTime()) / (24 * 60 * 60 * 1000))
      result.push({
        type: 'dead',
        groupId: g.id,
        groupName: g.name,
        message: he ? `${days} ימים ללא פעילות` : `${days} days inactive`,
      })
    }
    // Declining: 50%+ drop from prev week
    if (g.messagesPrev7d > 10 && g.messages7d < g.messagesPrev7d * 0.5) {
      const drop = Math.round((1 - g.messages7d / g.messagesPrev7d) * 100)
      result.push({
        type: 'declining',
        groupId: g.id,
        groupName: g.name,
        message: he ? `ירידה של ${drop}%` : `${drop}% decline`,
      })
    }
  })
  return result
}, [groups, he])
```

Add the alerts banner JSX — insert between the filters `</div>` and the `{/* Table */}` comment:

```tsx
{/* Health Alerts */}
{alerts.length > 0 && (
  <div className="flex gap-3 overflow-x-auto pb-1">
    {alerts.map((alert, i) => {
      const config = {
        spam: { icon: ShieldAlert, bg: 'hsl(0 80% 93% / 0.5)', color: 'hsl(0 60% 50%)', label: he ? 'ספאם' : 'Spam' },
        dead: { icon: Skull, bg: 'hsl(40 4% 90%)', color: 'hsl(40 4% 42%)', label: he ? 'לא פעילה' : 'Inactive' },
        declining: { icon: TrendingDown, bg: 'hsl(40 80% 90% / 0.5)', color: 'hsl(40 80% 35%)', label: he ? 'ירידה' : 'Declining' },
      }[alert.type]
      const Icon = config.icon
      return (
        <button
          key={`${alert.type}-${alert.groupId}-${i}`}
          onClick={() => navigate(`/admin/groups/${alert.groupId}`)}
          className="glass-panel px-4 py-3 flex items-center gap-3 shrink-0 hover:shadow-lg transition-shadow"
        >
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: config.bg }}>
            <Icon className="w-4 h-4" style={{ color: config.color }} />
          </div>
          <div className="text-left">
            <p className="text-xs font-semibold" style={{ color: config.color }}>{config.label}</p>
            <p className="text-xs" style={{ color: 'hsl(40 4% 42%)' }}>
              {alert.groupName.slice(0, 25)} — {alert.message}
            </p>
          </div>
        </button>
      )
    })}
  </div>
)}
```

**Step 4: Add repeat requester badge to group name column**

In the table row, update the Group Name cell to include a flame badge:

```tsx
{/* Group Name */}
<td className="px-4 py-3">
  <div className="flex items-center gap-2">
    <button
      onClick={() => navigate(`/admin/groups/${row.id}`)}
      className="text-sm font-medium hover:underline text-left"
      style={{ color: 'hsl(40 8% 10%)' }}
    >
      {row.name}
    </button>
    {row.repeatRequesters > 0 && (
      <button
        onClick={() => navigate(`/admin/groups/${row.id}?tab=market`)}
        className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold"
        style={{ background: 'hsl(25 95% 90%)', color: 'hsl(25 95% 40%)' }}
        title={he ? `${row.repeatRequesters} מבקשים חוזרים` : `${row.repeatRequesters} repeat requesters`}
      >
        <Flame className="w-3 h-3" />
        {row.repeatRequesters}
      </button>
    )}
  </div>
</td>
```

**Step 5: Verify the scoreboard renders with alerts and badges**

Run dev server, navigate to `/admin/groups`.
Expected: alerts banner (if conditions met) + flame badges on groups with repeat requesters.

**Step 6: Commit**

```bash
git add apps/dashboard/src/pages/AdminGroups.tsx
git commit -m "feat(groups): add health alerts banner + repeat requester badges to scoreboard"
```

---

### Task 3: Seasonal Trends Chart

**Files:**
- Modify: `apps/dashboard/src/hooks/useGroupDetail.ts` — add trends query
- Modify: `apps/dashboard/src/pages/AdminGroupDetail.tsx` — add trends chart to Overview tab

**Step 1: Add trends fetcher to useGroupDetail**

In `apps/dashboard/src/hooks/useGroupDetail.ts`, add a new type and fetcher:

```typescript
export interface TrendMonth {
  month: string        // "2026-01"
  profession: string
  count: number
}

async function fetchTrends(groupId: string): Promise<TrendMonth[]> {
  const twelveMonthsAgo = new Date()
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12)

  const { data } = await supabase
    .from('leads')
    .select('profession, created_at')
    .eq('group_id', groupId)
    .gte('created_at', twelveMonthsAgo.toISOString())

  if (!data || data.length === 0) return []

  const map: Record<string, Record<string, number>> = {}
  data.forEach((l: any) => {
    const month = l.created_at.slice(0, 7) // "2026-03"
    const prof = l.profession || 'other'
    if (!map[month]) map[month] = {}
    map[month][prof] = (map[month][prof] || 0) + 1
  })

  const result: TrendMonth[] = []
  Object.entries(map).forEach(([month, profs]) => {
    Object.entries(profs).forEach(([profession, count]) => {
      result.push({ month, profession, count })
    })
  })

  return result.sort((a, b) => a.month.localeCompare(b.month))
}
```

Add the query to the hook:

```typescript
const trendsQuery = useQuery({
  queryKey: [...baseKey, 'trends'],
  queryFn: () => fetchTrends(groupId!),
  enabled: !!groupId,
  staleTime: 120_000,
})
```

Add to return:
```typescript
trends: trendsQuery.data,
```

**Step 2: Commit hook changes**

```bash
git add apps/dashboard/src/hooks/useGroupDetail.ts
git commit -m "feat(groups): add seasonal trends query to group detail hook"
```

**Step 3: Add trends chart to Overview tab in AdminGroupDetail**

In `apps/dashboard/src/pages/AdminGroupDetail.tsx`, in the Overview tab section, after the Activity Over Time chart, add:

```tsx
{/* Seasonal Trends */}
{trends && trends.length > 0 && (() => {
  // Get unique professions
  const professions = [...new Set(trends.map(t => t.profession))].sort()
  // Get unique months
  const months = [...new Set(trends.map(t => t.month))].sort()

  // Only show if we have 2+ months
  if (months.length < 2) return null

  // Build chart data: one object per month with each profession as a key
  const chartData = months.map(month => {
    const row: Record<string, any> = { month: month.slice(5) } // "03" from "2026-03"
    professions.forEach(p => {
      const entry = trends.find(t => t.month === month && t.profession === p)
      row[p] = entry?.count || 0
    })
    return row
  })

  const colors = [
    'hsl(220 60% 55%)', 'hsl(155 44% 45%)', 'hsl(0 60% 55%)',
    'hsl(40 80% 50%)', 'hsl(280 60% 55%)', 'hsl(180 60% 40%)',
  ]

  return (
    <div className="glass-panel p-5">
      <h3 className="text-sm font-semibold mb-4" style={{ color: 'hsl(40 8% 10%)' }}>
        {he ? 'מגמות עונתיות' : 'Seasonal Trends'}
      </h3>
      <ResponsiveContainer width="100%" height={250}>
        <AreaChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(40 4% 90%)" />
          <XAxis dataKey="month" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip />
          {professions.slice(0, 6).map((prof, i) => (
            <Area
              key={prof}
              type="monotone"
              dataKey={prof}
              stackId="1"
              stroke={colors[i % colors.length]}
              fill={colors[i % colors.length]}
              fillOpacity={0.3}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
})()}
```

Make sure `trends` is destructured from `useGroupDetail` in the component.

**Step 4: Verify trends chart renders**

Navigate to a group detail page. If there's lead data spanning 2+ months, the stacked area chart should appear below the Activity chart.

**Step 5: Commit**

```bash
git add apps/dashboard/src/pages/AdminGroupDetail.tsx
git commit -m "feat(groups): add seasonal trends chart to group detail Overview tab"
```

---

### Task 4: Final Verification

**Step 1: TypeScript check**

```bash
cd apps/dashboard && npx tsc --noEmit
```
Expected: no errors

**Step 2: Build check**

```bash
npx vite build
```
Expected: builds successfully

**Step 3: Full flow test**

1. Run migration 016 against Supabase
2. Navigate to `/admin/groups` — scoreboard should now show real pipeline data
3. Check alerts banner appears if any groups match conditions
4. Check flame badges on groups with repeat requesters
5. Click a group → Overview tab should show KPIs with real numbers
6. Scroll down to see seasonal trends (if data exists)
7. Members tab → should show real classified members
8. Messages tab → should show messages (if WA Listener API running)
9. Market Intel → should show profession/region breakdowns

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat(groups): data flow fix + health alerts + trends — complete"
```
