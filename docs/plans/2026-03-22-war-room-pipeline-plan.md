# War Room Pipeline Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform the War Room CRM inbox into a full 8-stage customer lifecycle pipeline with visual funnel header and filtered chat list.

**Architecture:** Modify the existing `AdminInbox.tsx` page — add `trial_expired` stage to the DB enum, add `trial_ends_at` field, replace the flat KPI bar with a connected-dot funnel pipeline, keep the 3-panel chat layout below. The `useProspectDetailData` hook and realtime subscriptions stay unchanged.

**Tech Stack:** React + TypeScript, Supabase (Postgres), Lucide icons, TailwindCSS, TanStack Query

---

### Task 1: Database Migration — Add trial_expired stage and trial_ends_at column

**Files:**
- Create: `supabase/migrations/040_add_trial_expired_stage.sql`

**Step 1: Write the migration SQL**

```sql
-- Add trial_expired to prospect_stage enum
ALTER TYPE prospect_stage ADD VALUE IF NOT EXISTS 'trial_expired' AFTER 'demo_trial';

-- Add trial tracking column
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz;

-- Backfill: any demo_trial prospects created > 7 days ago should be trial_expired
UPDATE prospects
SET stage = 'trial_expired'
WHERE stage = 'demo_trial'
  AND created_at < now() - interval '7 days';
```

**Step 2: Apply migration via Supabase**

Run: `npx supabase db push` or apply via Supabase dashboard.

**Step 3: Commit**

```bash
git add supabase/migrations/040_add_trial_expired_stage.sql
git commit -m "feat: add trial_expired stage and trial_ends_at column"
```

---

### Task 2: Update STAGES config in AdminInbox.tsx

**Files:**
- Modify: `apps/dashboard/src/pages/AdminInbox.tsx:36-44`

**Step 1: Add trial_expired stage and Clock icon import**

Add `Clock` to the lucide imports (line ~14), then update the STAGES array:

```typescript
import {
  ArrowRight, Phone, MessageCircle, Send, Loader2,
  ChevronDown, Check, CheckCheck, CircleDot, Sparkles, DollarSign,
  XCircle, PhoneCall, Edit3, Calendar, X, Plus,
  AlertTriangle, Zap, Copy, Clock,
  Search, Inbox, Users
} from 'lucide-react'
```

```typescript
const STAGES = [
  { key: 'prospect',        label: 'Prospect',        he: 'פרוספקט',       icon: CircleDot,     color: '#5856D6', bg: '#F2F2F7' },
  { key: 'reached_out',     label: 'Reached Out',     he: 'יצרנו קשר',     icon: Phone,         color: '#fe5b25', bg: '#F2F2F7' },
  { key: 'in_conversation', label: 'In Conversation', he: 'בשיחה',         icon: MessageCircle, color: '#AF52DE', bg: '#F2F2F7' },
  { key: 'onboarding',      label: 'Onboarding',      he: 'הרשמה',         icon: Zap,           color: '#007AFF', bg: '#F2F2F7' },
  { key: 'demo_trial',      label: 'Demo / Trial',    he: 'ניסיון',        icon: Sparkles,      color: '#FF9500', bg: '#F2F2F7' },
  { key: 'trial_expired',   label: 'Trial Expired',   he: 'ניסיון נגמר',   icon: Clock,         color: '#8E8E93', bg: '#F2F2F7' },
  { key: 'paying',          label: 'Paying',          he: 'משלם',          icon: DollarSign,    color: '#34C759', bg: '#F2F2F7' },
  { key: 'churned',         label: 'Churned',         he: 'נטש',           icon: XCircle,       color: '#FF3B30', bg: '#F2F2F7' },
] as const
```

Note: `onboarding` moved after `in_conversation` (more logical flow — you talk first, then onboard).

**Step 2: Verify the page renders with no errors**

Open the War Room CRM Inbox and confirm the filter buttons show all 8 stages, the stage counts render, and the stage dropdown in the right panel shows all options.

**Step 3: Commit**

```bash
git add apps/dashboard/src/pages/AdminInbox.tsx
git commit -m "feat: add trial_expired stage to STAGES config"
```

---

### Task 3: Replace KPI bar with Pipeline Funnel Header

**Files:**
- Modify: `apps/dashboard/src/pages/AdminInbox.tsx:184-206` (the TOP KPI BAR section)

**Step 1: Replace the top KPI bar with a pipeline funnel**

Replace the entire `{/* ═══ TOP KPI BAR ═══ */}` div (lines 184-206) with this pipeline funnel component:

```tsx
{/* ═══ PIPELINE FUNNEL HEADER ═══ */}
<div className="shrink-0 bg-white/60 backdrop-blur-2xl border-b border-black/[0.03] px-8 pt-5 pb-4 z-20 relative">
  {/* Title row */}
  <div className="flex items-center justify-between mb-5">
    <div className="flex flex-col">
      <h1 className="text-2xl font-semibold tracking-tight text-[#1C1C1E]">{he ? 'חדר מלחמה' : 'War Room'}</h1>
      <div className="flex items-center gap-2 mt-1">
        <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
        <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#8E8E93]">{he ? 'פייפליין' : 'Pipeline'}</p>
      </div>
    </div>
    <div className="relative group">
      <Search className="w-4 h-4 absolute top-1/2 -translate-y-1/2 text-[#8E8E93] transition-colors group-focus-within:text-[#fe5b25]" style={{ left: he ? 'auto' : 12, right: he ? 12 : 'auto' }} strokeWidth={2.5} />
      <input
        value={listSearch} onChange={e => setListSearch(e.target.value)}
        placeholder={he ? 'חיפוש...' : 'Search...'}
        className="w-[220px] h-9 rounded-xl border-none text-[13px] outline-none transition-all bg-black/[0.03] focus:bg-white focus:ring-4 focus:ring-[#fe5b25]/5 shadow-inner"
        style={{ paddingLeft: he ? 12 : 36, paddingRight: he ? 36 : 12, color: C.dark }}
      />
    </div>
  </div>

  {/* Funnel Pipeline */}
  <div className="flex items-center gap-0">
    {STAGES.map((s, i) => {
      const count = stageCounts[s.key] || 0
      const isActive = filterStage === s.key
      const isAll = filterStage === 'all'
      const maxCount = Math.max(...Object.values(stageCounts), 1)
      const barWidth = Math.max(8, (count / maxCount) * 100)

      return (
        <div key={s.key} className="flex items-center flex-1 min-w-0">
          {/* Stage Node */}
          <button
            onClick={() => setFilterStage(isActive ? 'all' : s.key)}
            className={`flex flex-col items-center flex-1 min-w-0 px-1 py-2 rounded-2xl transition-all cursor-pointer group ${isActive ? 'bg-white shadow-lg scale-105' : isAll ? 'hover:bg-white/50' : 'opacity-40 hover:opacity-70'}`}
          >
            {/* Icon + Count */}
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center mb-2 transition-all shadow-sm ${isActive ? 'shadow-lg' : ''}`}
              style={{
                background: isActive || isAll ? s.color + '15' : '#f5f5f5',
                color: isActive || isAll ? s.color : '#8E8E93',
              }}
            >
              <s.icon className="w-5 h-5" strokeWidth={2} />
            </div>

            {/* Count */}
            <span className="text-lg font-bold leading-none mb-1" style={{ color: isActive ? s.color : '#1C1C1E' }}>
              {count.toLocaleString()}
            </span>

            {/* Label */}
            <span className="text-[9px] font-bold uppercase tracking-wider text-[#8E8E93] truncate max-w-full px-1 text-center leading-tight">
              {he ? s.he : s.label}
            </span>

            {/* Mini bar */}
            <div className="w-full h-1 mt-2 rounded-full bg-black/[0.04] overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${barWidth}%`,
                  background: isActive || isAll ? s.color : '#D1D1D6',
                }}
              />
            </div>
          </button>

          {/* Connector line between stages */}
          {i < STAGES.length - 1 && (
            <div className="w-4 h-[2px] shrink-0" style={{ background: isAll ? '#D1D1D6' : 'transparent' }} />
          )}
        </div>
      )
    })}
  </div>
</div>
```

**Step 2: Remove the old search box from the left panel**

Since search is now in the pipeline header, remove the search input from the left panel header (lines ~214-224). Keep only the stage filter buttons — OR remove those too since the pipeline header handles filtering. Replace with a simpler header:

```tsx
{/* Header */}
<div className="shrink-0 p-4 border-b border-black/[0.02]">
  <div className="flex items-center justify-between">
    <span className="text-[11px] font-black uppercase tracking-[0.15em] text-[#8E8E93]">
      {filterStage === 'all' ? (he ? 'כל הלקוחות' : 'All Clients') : (he ? getStage(filterStage).he : getStage(filterStage).label)}
    </span>
    <span className="text-[11px] font-bold text-[#8E8E93]">
      {filteredList.length}
    </span>
  </div>
</div>
```

**Step 3: Verify the pipeline renders correctly**

- Open War Room → CRM Inbox
- Verify 8 stages appear as connected dots with counts
- Click a stage → contact list filters to that stage
- Click same stage again → returns to "all"
- Mini bars show relative volumes

**Step 4: Commit**

```bash
git add apps/dashboard/src/pages/AdminInbox.tsx
git commit -m "feat: replace KPI bar with visual pipeline funnel header"
```

---

### Task 4: Add trial countdown to CRM panel

**Files:**
- Modify: `apps/dashboard/src/pages/AdminInbox.tsx` (right panel, after stage selector ~line 526)
- Modify: `apps/dashboard/src/hooks/useProspectDetailData.ts:5-19` (add `trial_ends_at` to Prospect interface)

**Step 1: Add trial_ends_at to Prospect interface**

In `useProspectDetailData.ts`, add to the `Prospect` interface:

```typescript
export interface Prospect {
  // ... existing fields ...
  trial_ends_at: string | null  // ADD THIS
}
```

**Step 2: Add trial countdown display in the CRM panel**

After the stage selector in AdminInbox.tsx (after line ~547, before the Tabs Header), add:

```tsx
{/* Trial Countdown */}
{prospect.stage === 'demo_trial' && prospect.trial_ends_at && (
  <div className="mt-3 px-5 py-3 rounded-2xl bg-[#FF9500]/10 border border-[#FF9500]/20">
    <div className="flex items-center justify-between">
      <span className="text-[11px] font-bold uppercase tracking-wider text-[#FF9500]">
        {he ? 'ניסיון נגמר' : 'Trial ends'}
      </span>
      <span className="text-[14px] font-bold text-[#FF9500]">
        {relD(prospect.trial_ends_at, he)}
      </span>
    </div>
  </div>
)}
{prospect.stage === 'trial_expired' && (
  <div className="mt-3 px-5 py-3 rounded-2xl bg-[#8E8E93]/10 border border-[#8E8E93]/20">
    <div className="flex items-center gap-2">
      <Clock className="w-4 h-4 text-[#8E8E93]" />
      <span className="text-[12px] font-bold text-[#8E8E93]">
        {he ? 'תקופת הניסיון הסתיימה' : 'Trial period has ended'}
      </span>
    </div>
  </div>
)}
```

**Step 3: Verify countdown displays**

- Select a prospect in demo_trial stage
- Verify countdown shows (or "Trial period ended" for trial_expired)
- Change stage → countdown disappears

**Step 4: Commit**

```bash
git add apps/dashboard/src/pages/AdminInbox.tsx apps/dashboard/src/hooks/useProspectDetailData.ts
git commit -m "feat: add trial countdown to CRM panel"
```

---

### Task 5: Final polish — pagination guard for large prospect lists

**Files:**
- Modify: `apps/dashboard/src/pages/AdminInbox.tsx` (contact list section, ~line 252)

**Step 1: Add a visible count limit with "load more" for large filtered lists**

Replace the filteredList rendering (line ~252-298) to show max 50 at a time with a load-more button:

Add state near the top of the component:
```typescript
const [displayLimit, setDisplayLimit] = useState(50)
```

Reset limit when filter changes:
```typescript
useEffect(() => { setDisplayLimit(50) }, [filterStage, listSearch])
```

In the list rendering section, slice the filteredList:
```tsx
{filteredList.slice(0, displayLimit).map((p, idx) => {
  // ... existing card rendering ...
})}
{filteredList.length > displayLimit && (
  <button
    onClick={() => setDisplayLimit(prev => prev + 50)}
    className="w-full py-4 text-center text-[13px] font-bold text-[#fe5b25] hover:bg-[#fe5b25]/5 rounded-2xl transition-colors"
  >
    {he ? `הצג עוד ${Math.min(50, filteredList.length - displayLimit)} מתוך ${filteredList.length - displayLimit} נותרים` : `Show ${Math.min(50, filteredList.length - displayLimit)} more of ${filteredList.length - displayLimit} remaining`}
  </button>
)}
```

**Step 2: Verify pagination**

- Filter to "Prospect" (2952 items)
- Only 50 cards render initially
- "Show more" button appears at bottom
- Clicking it loads 50 more
- Switching stages resets to 50

**Step 3: Commit**

```bash
git add apps/dashboard/src/pages/AdminInbox.tsx
git commit -m "feat: add pagination guard for large prospect lists"
```

---

## Summary of Changes

| Task | What | Files |
|------|------|-------|
| 1 | DB: add `trial_expired` enum + `trial_ends_at` column | migration SQL |
| 2 | Update STAGES config (8 stages, reorder) | AdminInbox.tsx |
| 3 | Replace KPI bar with pipeline funnel header | AdminInbox.tsx |
| 4 | Trial countdown in CRM panel | AdminInbox.tsx, useProspectDetailData.ts |
| 5 | Pagination guard for large lists | AdminInbox.tsx |
