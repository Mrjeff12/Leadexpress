# Inbox Glass CRM Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign the AdminInbox page to match the Lead Express glass-panel design language, and add missing CRM card features (Quick Actions, Lead Intelligence, Tags, Stage Timeline).

**Architecture:** Single-file rewrite of `AdminInbox.tsx` (861 lines). The component keeps all existing logic (state, actions, hooks) but gets a complete JSX/styling overhaul. New computed data (lead score, message stats, stage timeline) are derived from existing `messages` and `events` arrays — no DB changes needed for Phase 1. Tags require a new `prospect_tags` column (Phase 2).

**Tech Stack:** React, Tailwind CSS, Lucide icons, existing `useProspectDetailData` hook, Supabase.

**Design Reference:** `docs/plans/2026-03-22-inbox-glass-crm-redesign.md`

**File:** `apps/dashboard/src/pages/AdminInbox.tsx`

---

### Task 1: Update Design Tokens & Page Background

**Files:**
- Modify: `apps/dashboard/src/pages/AdminInbox.tsx:21-34` (design tokens)
- Modify: `apps/dashboard/src/pages/AdminInbox.tsx:220-227` (root wrapper)

**Step 1: Update design tokens**

Replace the `C` object with glass-design tokens:

```tsx
const C = {
  primary: '#fe5b25',
  dark: '#1C1C1E',
  cream: '#FBFBFD',
  border: 'rgba(0,0,0,0.04)',
  gray: '#3A3A3C',
  muted: '#8E8E93',
  wa: '#34C759',
  waDark: '#248A3D',
  bg: '#FBFBFD',
  glass: 'rgba(255, 255, 255, 0.85)',
  glassBorder: 'rgba(0,0,0,0.04)',
  card: '#FFFFFF',
  panelShadow: '0 10px 40px -10px rgba(0,0,0,0.05)',
  panelRadius: '24px',
  cardRadius: '16px',
  hoverShadow: '0 8px 24px rgba(0,0,0,0.06)',
  blur: 'blur(32px) saturate(180%)',
}
```

**Step 2: Update root wrapper**

Replace root div background with cream + radial gradients:

```tsx
<div
  className="animate-fade-in flex flex-col h-full w-full absolute inset-0 overflow-hidden"
  style={{
    fontFamily: "'Plus Jakarta Sans', 'Outfit', -apple-system, system-ui, sans-serif",
    background: `${C.cream}`,
    backgroundImage: 'radial-gradient(at 0% 0%, rgba(254,91,37,0.03) 0, transparent 50%), radial-gradient(at 100% 100%, rgba(255,138,92,0.03) 0, transparent 50%)',
  }}
>
```

**Step 3: Verify** — run `npx tsc --noEmit` and check the page loads with the new cream background.

**Step 4: Commit**

```bash
git add apps/dashboard/src/pages/AdminInbox.tsx
git commit -m "refactor(inbox): update design tokens to glass CRM system"
```

---

### Task 2: Restyle Pipeline Header

**Files:**
- Modify: `apps/dashboard/src/pages/AdminInbox.tsx:228-287` (pipeline header)

**Step 1: Update the pipeline header wrapper**

Change from `bg-white/80` to floating glass panel:

```tsx
<div className="shrink-0 z-20 relative mx-3 mt-3 rounded-3xl overflow-hidden" style={{ background: C.glass, backdropFilter: C.blur, border: `1px solid ${C.glassBorder}`, boxShadow: C.panelShadow }}>
```

**Step 2: Update search input**

Change to glass-styled search with `rounded-2xl`:

```tsx
<input
  value={listSearch} onChange={e => setListSearch(e.target.value)}
  placeholder={he ? 'חיפוש...' : 'Search...'}
  className="w-[200px] h-9 rounded-2xl border border-black/[0.06] text-[13px] font-medium outline-none transition-all bg-white/60 focus:bg-white focus:ring-2 focus:ring-[#fe5b25]/10 focus:border-[#fe5b25]/30 backdrop-blur-sm"
  style={{ paddingLeft: he ? 12 : 34, paddingRight: he ? 34 : 12, color: C.dark }}
/>
```

**Step 3: Update stage buttons** — change icon container from `rounded-lg` to `rounded-xl`, active state gets `shadow-md`:

```tsx
style={{
  background: isActive ? C.card : 'transparent',
  boxShadow: isActive ? '0 4px 16px rgba(0,0,0,0.06)' : 'none',
  opacity: isDimmed ? 0.35 : 1,
}}
```

**Step 4: Verify** — pipeline header should look like a floating glass card with rounded corners.

**Step 5: Commit**

```bash
git add apps/dashboard/src/pages/AdminInbox.tsx
git commit -m "style(inbox): restyle pipeline header as glass panel"
```

---

### Task 3: Restyle Contact List Panel

**Files:**
- Modify: `apps/dashboard/src/pages/AdminInbox.tsx:289-366` (left panel)

**Step 1: Update panel wrapper**

Replace flat sidebar with glass panel. Change `grid-cols-[300px_1fr_300px]` to `grid-cols-[320px_1fr_320px]` and gap `gap-3`. Add `p-3` to the main grid for margin around panels.

Main grid:
```tsx
<div className="flex-1 grid grid-cols-[320px_1fr_320px] gap-3 p-3 relative z-10 overflow-hidden">
```

Contact list panel:
```tsx
<div className="flex flex-col relative z-10 h-full overflow-hidden rounded-3xl" style={{ background: C.glass, backdropFilter: C.blur, border: `1px solid ${C.glassBorder}`, boxShadow: C.panelShadow }}>
```

**Step 2: Add last message preview to contact cards**

Add a computed `lastMessage` map before the render:

```tsx
const lastMessages = useMemo(() => {
  const map: Record<string, { text: string; time: string; direction: 'incoming' | 'outgoing' }> = {}
  for (const p of prospectList) {
    const msgs = messages // note: messages is for selected prospect only
    // We'll use last_contact_at from the list item instead
  }
  return map
}, [])
```

Actually, since `messages` is only for the selected prospect, use `p.last_message_preview` if available, or just show the phone + stage. For now, add a truncated preview line and 24h window dot indicator.

Contact card update — add inside the card after the stage badge row:

```tsx
{/* 24h window indicator dot */}
<div className="absolute top-3 right-3">
  <div className="w-2 h-2 rounded-full" style={{ background: '#34C759' }} title="24h window open" />
</div>
```

**Step 3: Update contact card styling**

```tsx
<button
  key={`${p.id}-${idx}`}
  onClick={() => setSelectedId(p.id)}
  className={`w-full flex items-center gap-3 p-3 text-left transition-all rounded-2xl relative overflow-hidden group
    ${isActive
      ? 'bg-white shadow-md ring-2 ring-[#fe5b25]/15'
      : 'hover:bg-white/60 hover:shadow-sm hover:-translate-y-[1px] active:scale-[0.98]'
    }`}
  style={{ direction: he ? 'rtl' : 'ltr' }}
>
```

**Step 4: Verify** — contact list should be a floating glass panel with cards that lift on hover.

**Step 5: Commit**

```bash
git add apps/dashboard/src/pages/AdminInbox.tsx
git commit -m "style(inbox): restyle contact list as glass panel with hover-lift cards"
```

---

### Task 4: Restyle Chat Area

**Files:**
- Modify: `apps/dashboard/src/pages/AdminInbox.tsx:368-557` (center panel)

**Step 1: Update chat container**

```tsx
<div className="flex flex-col relative z-0 h-full overflow-hidden rounded-3xl" style={{ background: C.card, boxShadow: '0 4px 24px rgba(0,0,0,0.04)', border: `1px solid ${C.glassBorder}` }}>
```

**Step 2: Update chat header** to glass-style:

```tsx
<div className="shrink-0 flex items-center gap-4 px-6 h-[72px] z-10 rounded-t-3xl" style={{ background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(24px)', borderBottom: `1px solid ${C.glassBorder}` }}>
```

**Step 3: Update chat background** to cream with grain:

```tsx
<div className="flex-1 overflow-y-auto px-6 py-6 space-y-4 scrollbar-hide" style={{ background: C.cream, backgroundImage: 'radial-gradient(at 50% 0%, rgba(254,91,37,0.02) 0, transparent 50%)' }}>
```

**Step 4: Update message bubbles** — rounder, cleaner:

Outgoing:
```tsx
className={`max-w-[70%] rounded-[20px] px-5 py-3 shadow-sm relative group
  ${out ? (isTwilio ? 'bg-[#1C1C1E] text-white' : 'bg-[#1C1C1E] text-white')
       : 'bg-white text-[#1C1C1E] border border-black/[0.06]'}`}
style={{
  borderBottomRightRadius: out ? 6 : 20,
  borderBottomLeftRadius: out ? 20 : 6,
  boxShadow: out ? 'none' : '0 1px 3px rgba(0,0,0,0.04)',
}}
```

Remove the floating channel badge on each message (the colored circle at -top-2). Instead, show a small subtle text indicator.

**Step 5: Update delivery ticks** — read ticks should be blue (#007AFF):

```tsx
{out && (
  msg.read_at
    ? <CheckCheck className="w-3.5 h-3.5 text-[#007AFF]" />
    : msg.delivered_at
      ? <CheckCheck className="w-3.5 h-3.5 text-white/50" />
      : <Check className="w-3.5 h-3.5 text-white/50" />
)}
```

**Step 6: Update date separators** — pill style:

```tsx
<div className="flex justify-center my-6">
  <span className="text-[11px] font-semibold px-4 py-1.5 rounded-full bg-black/[0.04] text-[#8E8E93]">
    {fmtDate(msg.sent_at)}
  </span>
</div>
```

**Step 7: Update input area** to glass bottom:

```tsx
<div className="shrink-0 z-30 flex flex-col rounded-b-3xl" style={{ background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(24px)', borderTop: `1px solid ${C.glassBorder}` }}>
```

**Step 8: Update message font** — change from `text-[16px]` to `text-[14px]` for denser chat:

```tsx
<p className="text-[14px] leading-[1.55] whitespace-pre-wrap font-medium text-start" ...>
```

**Step 9: Verify** — chat should have cream background, clean bubbles, glass header/input.

**Step 10: Commit**

```bash
git add apps/dashboard/src/pages/AdminInbox.tsx
git commit -m "style(inbox): restyle chat area with glass header/input and cream background"
```

---

### Task 5: Restyle CRM Card Panel — Structure & Profile

**Files:**
- Modify: `apps/dashboard/src/pages/AdminInbox.tsx:560-630` (right panel header)

**Step 1: Update panel wrapper** to glass:

```tsx
<div className="flex flex-col relative z-10 h-full overflow-hidden rounded-3xl" style={{ background: C.glass, backdropFilter: C.blur, border: `1px solid ${C.glassBorder}`, boxShadow: C.panelShadow }}>
```

**Step 2: Update profile header** — larger avatar (56px), rounded-2xl instead of circle:

```tsx
<Avatar src={prospect.profile_pic_url} name={pName(prospect)} waId={prospect.wa_id || prospect.phone} size={56} />
```

Update Avatar component to support `rounded-2xl`:

```tsx
const Avatar = ({ src, name, waId, size = 36, square = false }: { src?: string | null; name: string; waId: string; size?: number; square?: boolean }) => {
  const h = hue(waId)
  const radius = square ? '25%' : '50%'
  if (src) return <img src={src} alt="" className="object-cover shrink-0 shadow-sm border border-black/[0.05]" style={{ width: size, height: size, borderRadius: radius }} />
  return (
    <div className="flex items-center justify-center font-bold text-white shrink-0 shadow-sm" style={{ width: size, height: size, fontSize: size * 0.35, borderRadius: radius, background: `linear-gradient(135deg, hsl(${h} 50% 50%), hsl(${h + 30} 45% 45%))` }}>
      {name[0]?.toUpperCase() ?? '?'}
    </div>
  )
}
```

**Step 3: Update action icons** — `rounded-xl` with hover states:

```tsx
<div className="flex items-center gap-1.5 shrink-0">
  <a href={`tel:${prospect.phone}`} className="w-8 h-8 rounded-xl flex items-center justify-center bg-black/[0.03] hover:bg-black/[0.06] transition-all"><PhoneCall className="w-3.5 h-3.5 text-[#8E8E93]" /></a>
  <a href={`https://wa.me/${prospect.phone.replace(/[^0-9]/g, '')}`} target="_blank" rel="noreferrer" className="w-8 h-8 rounded-xl flex items-center justify-center bg-[#34C759]/8 hover:bg-[#34C759]/15 transition-all"><MessageCircle className="w-3.5 h-3.5 text-[#34C759]" /></a>
  <button onClick={copyPhone} className="w-8 h-8 rounded-xl flex items-center justify-center bg-black/[0.03] hover:bg-black/[0.06] transition-all">{copied ? <Check className="w-3.5 h-3.5 text-[#34C759]" /> : <Copy className="w-3.5 h-3.5 text-[#8E8E93]" />}</button>
</div>
```

**Step 4: Update stage selector** — `rounded-xl`:

```tsx
<button onClick={() => setStageMenuOpen(!stageMenuOpen)} className="flex items-center justify-between w-full h-9 px-3 rounded-xl text-[12px] font-semibold border border-black/[0.06] bg-white hover:border-black/[0.12] transition-all" style={{ color: stg.color }}>
```

**Step 5: Verify** — profile header should look premium with larger avatar and rounded action buttons.

**Step 6: Commit**

```bash
git add apps/dashboard/src/pages/AdminInbox.tsx
git commit -m "style(inbox): restyle CRM card profile header with glass panel"
```

---

### Task 6: Add Quick Actions Section

**Files:**
- Modify: `apps/dashboard/src/pages/AdminInbox.tsx` — insert after stage selector, before contractor info

**Step 1: Add Quick Actions** — 2x2 grid of action buttons:

Insert right after the trial status section (line ~630), before the divider:

```tsx
{/* ── Quick Actions ── */}
<div className="px-4 pb-3">
  <div className="text-[10px] font-semibold uppercase tracking-wider text-[#8E8E93] mb-2">{he ? 'פעולות מהירות' : 'Quick Actions'}</div>
  <div className="grid grid-cols-2 gap-1.5">
    <button onClick={() => setShowQR(true)} className="flex items-center gap-1.5 h-9 px-3 rounded-xl text-[11px] font-semibold bg-[#fe5b25]/[0.06] text-[#fe5b25] hover:bg-[#fe5b25]/[0.12] transition-all">
      <Send className="w-3.5 h-3.5" />{he ? 'שלח תבנית' : 'Template'}
    </button>
    <a href={`tel:${prospect.phone}`} className="flex items-center gap-1.5 h-9 px-3 rounded-xl text-[11px] font-semibold bg-[#007AFF]/[0.06] text-[#007AFF] hover:bg-[#007AFF]/[0.12] transition-all">
      <PhoneCall className="w-3.5 h-3.5" />{he ? 'שיחה' : 'Call'}
    </a>
    <button className="flex items-center gap-1.5 h-9 px-3 rounded-xl text-[11px] font-semibold bg-[#FF9500]/[0.06] text-[#FF9500] hover:bg-[#FF9500]/[0.12] transition-all">
      <Sparkles className="w-3.5 h-3.5" />{he ? 'VIP' : 'VIP'}
    </button>
    <button className="flex items-center gap-1.5 h-9 px-3 rounded-xl text-[11px] font-semibold bg-black/[0.03] text-[#8E8E93] hover:bg-black/[0.06] transition-all">
      <Plus className="w-3.5 h-3.5" />{he ? 'תגית' : 'Tag'}
    </button>
  </div>
</div>
```

**Step 2: Verify** — four action buttons in a 2x2 grid below stage selector.

**Step 3: Commit**

```bash
git add apps/dashboard/src/pages/AdminInbox.tsx
git commit -m "feat(inbox): add Quick Actions grid to CRM card"
```

---

### Task 7: Add Lead Intelligence Section

**Files:**
- Modify: `apps/dashboard/src/pages/AdminInbox.tsx` — add computed stats + JSX section

**Step 1: Add computed lead stats** after the `windowRemaining` state block (~line 197):

```tsx
// Lead Intelligence — computed from messages and events
const leadStats = useMemo(() => {
  if (!messages.length) return null
  const sent = messages.filter(m => m.direction === 'outgoing').length
  const received = messages.filter(m => m.direction === 'incoming').length
  const total = sent + received

  // Engagement: high if >5 incoming, medium if >2, low otherwise
  const engagement = received > 5 ? 'high' : received > 2 ? 'medium' : 'low'
  const engagementColor = engagement === 'high' ? '#34C759' : engagement === 'medium' ? '#FF9500' : '#8E8E93'

  // Lead score: 0-100 based on messages, stage progression, response rate
  const msgScore = Math.min(total * 3, 30)
  const responseScore = total > 0 ? Math.min((received / total) * 40, 40) : 0
  const stageIdx = STAGES.findIndex(s => s.key === (prospect?.stage ?? 'prospect'))
  const stageScore = Math.min(stageIdx * 5, 30)
  const score = Math.round(msgScore + responseScore + stageScore)

  // Avg response time
  let avgResponseMs = 0
  let responseCount = 0
  for (let i = 1; i < messages.length; i++) {
    if (messages[i].direction === 'incoming' && messages[i - 1].direction === 'outgoing') {
      avgResponseMs += new Date(messages[i].sent_at).getTime() - new Date(messages[i - 1].sent_at).getTime()
      responseCount++
    }
  }
  const avgResponseH = responseCount > 0 ? Math.round(avgResponseMs / responseCount / 3600000) : null

  return { sent, received, total, engagement, engagementColor, score, avgResponseH }
}, [messages, prospect?.stage])
```

**Step 2: Add Lead Intelligence JSX** — insert after Quick Actions, before contractor info:

```tsx
{/* ── Lead Intelligence ── */}
{leadStats && leadStats.total > 0 && (
  <div>
    <div className="text-[10px] font-semibold uppercase tracking-wider text-[#8E8E93] mb-2">{he ? 'מודיעין ליד' : 'Lead Intelligence'}</div>
    <div className="space-y-2.5">
      {/* Score bar */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] font-medium text-[#8E8E93]">{he ? 'ציון' : 'Score'}</span>
          <span className="text-[12px] font-bold text-[#1C1C1E]">{leadStats.score}/100</span>
        </div>
        <div className="h-2 rounded-full bg-black/[0.04] overflow-hidden">
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${leadStats.score}%`, background: `linear-gradient(90deg, #fe5b25, #34C759)` }} />
        </div>
      </div>
      {/* Stats row */}
      <div className="flex items-center gap-3 text-[11px]">
        <span className="text-[#8E8E93]">{he ? 'הודעות' : 'Messages'}:</span>
        <span className="font-semibold text-[#1C1C1E]">{leadStats.sent} {he ? 'נשלחו' : 'sent'} · {leadStats.received} {he ? 'התקבלו' : 'recv'}</span>
      </div>
      {/* Engagement */}
      <div className="flex items-center gap-2 text-[11px]">
        <span className="text-[#8E8E93]">{he ? 'מעורבות' : 'Engagement'}:</span>
        <div className="flex items-center gap-1">
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: leadStats.engagementColor }} />
          <span className="font-semibold capitalize" style={{ color: leadStats.engagementColor }}>{leadStats.engagement}</span>
        </div>
      </div>
      {/* Avg response */}
      {leadStats.avgResponseH !== null && (
        <div className="flex items-center gap-2 text-[11px]">
          <span className="text-[#8E8E93]">{he ? 'זמן תגובה ממוצע' : 'Avg response'}:</span>
          <span className="font-semibold text-[#1C1C1E]">~{leadStats.avgResponseH}h</span>
        </div>
      )}
    </div>
  </div>
)}
```

**Step 3: Verify** — lead score bar, message stats, engagement level should show for prospects with messages.

**Step 4: Commit**

```bash
git add apps/dashboard/src/pages/AdminInbox.tsx
git commit -m "feat(inbox): add Lead Intelligence section with score, stats, engagement"
```

---

### Task 8: Add 24h Window Progress Bar & Restyle Existing Sections

**Files:**
- Modify: `apps/dashboard/src/pages/AdminInbox.tsx:762-791` (24h window)
- Modify: `apps/dashboard/src/pages/AdminInbox.tsx:638-722` (contractor info)

**Step 1: Add progress bar** to 24h window countdown:

After the countdown numbers, add:

```tsx
{/* Progress bar */}
<div className="h-1.5 rounded-full bg-black/[0.04] overflow-hidden mt-2">
  <div className="h-full rounded-full transition-all duration-1000" style={{
    width: `${((windowRemaining.h * 3600 + windowRemaining.m * 60 + windowRemaining.s) / 86400) * 100}%`,
    background: windowRemaining.h < 4 ? '#FF9500' : '#34C759',
  }} />
</div>
```

**Step 2: Update all section styling** — change `rounded-lg` to `rounded-2xl` across:
- Contractor info card
- 24h window card
- Follow-up section
- Notes section

Replace all instances of `rounded-lg` inside the CRM card scrollable content with `rounded-2xl`.

**Step 3: Update section dividers** — from `h-px bg-black/[0.04]` to `h-px bg-black/[0.03] mx-1`:

```tsx
<div className="h-px bg-black/[0.03] mx-1" />
```

**Step 4: Verify** — 24h window should show a progress bar below the countdown, all sections should have rounded-2xl.

**Step 5: Commit**

```bash
git add apps/dashboard/src/pages/AdminInbox.tsx
git commit -m "style(inbox): add 24h progress bar, unify rounded-2xl across CRM sections"
```

---

### Task 9: Add Stage Timeline to Dates Section

**Files:**
- Modify: `apps/dashboard/src/pages/AdminInbox.tsx:752-760` (dates section)

**Step 1: Compute stage changes** from events — add to computed section:

```tsx
const stageChanges = useMemo(() => {
  return events
    .filter(e => e.event_type === 'stage_change')
    .map(e => ({
      from: e.old_value,
      to: e.new_value,
      date: e.created_at,
    }))
}, [events])
```

**Step 2: Add mini timeline** below dates:

```tsx
{/* Stage Timeline */}
{stageChanges.length > 0 && (
  <div className="mt-3">
    <div className="text-[10px] font-semibold uppercase tracking-wider text-[#8E8E93] mb-1.5">{he ? 'מסלול' : 'Journey'}</div>
    <div className="flex items-center gap-1 flex-wrap">
      {stageChanges.map((sc, i) => {
        const s = getStage(sc.to ?? '')
        return (
          <div key={i} className="flex items-center gap-1">
            {i > 0 && <ArrowRight className="w-2.5 h-2.5 text-[#D1D1D6]" />}
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: s.color + '12', color: s.color }}>
              {he ? s.he : s.label}
            </span>
          </div>
        )
      })}
    </div>
  </div>
)}
```

**Step 3: Verify** — stage progression should show as colored pills with arrows.

**Step 4: Commit**

```bash
git add apps/dashboard/src/pages/AdminInbox.tsx
git commit -m "feat(inbox): add stage journey timeline to CRM card dates section"
```

---

### Task 10: Final Polish & Type Check

**Files:**
- Modify: `apps/dashboard/src/pages/AdminInbox.tsx` (various small fixes)

**Step 1: Run type check**

```bash
cd apps/dashboard && npx tsc --noEmit
```

Fix any type errors.

**Step 2: Update empty state** — the "no conversation selected" and "no activity yet" empty states should match glass style:

Change the placeholder card from `rounded-[40px]` to `rounded-3xl`, shadow to `panelShadow`.

**Step 3: Verify visually** — check the full page in the browser:
- Pipeline header = floating glass card
- Contact list = glass panel with hover-lift cards
- Chat area = cream bg, clean bubbles, glass header/input
- CRM card = glass panel with Quick Actions, Lead Intelligence, Stage Timeline, 24h progress bar

**Step 4: Final commit**

```bash
git add apps/dashboard/src/pages/AdminInbox.tsx
git commit -m "style(inbox): final polish — glass CRM redesign complete"
```

---

## Summary

| Task | Description | Estimated |
|------|-------------|-----------|
| 1 | Design tokens + background | 3 min |
| 2 | Pipeline header glass | 5 min |
| 3 | Contact list panel | 8 min |
| 4 | Chat area restyle | 10 min |
| 5 | CRM card structure + profile | 8 min |
| 6 | Quick Actions section | 5 min |
| 7 | Lead Intelligence section | 8 min |
| 8 | 24h progress bar + section unify | 5 min |
| 9 | Stage timeline | 5 min |
| 10 | Final polish + type check | 5 min |

All tasks modify a single file. No database changes needed. All new data is computed from existing `messages` and `events` arrays.
