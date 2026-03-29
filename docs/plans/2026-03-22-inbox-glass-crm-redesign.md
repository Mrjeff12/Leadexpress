# Inbox Glass CRM Redesign

**Date**: 2026-03-22
**Status**: Approved
**Approach**: Glass CRM — full glassmorphic redesign matching dashboard design language

## Problem

The AdminInbox page uses a flat, utilitarian design that doesn't match the premium Apple-refined glass aesthetic used throughout the rest of the Lead Express dashboard. The CRM card is also missing critical fields for operators.

## Design Decisions

- **Style**: Glass panels with `backdrop-blur(32px)`, floating panels, cream background with grain overlay
- **CRM Card**: Full card with Quick Actions, Lead Intelligence, 24h Window, Tags, Stage Timeline
- **Contact List**: Glass panel with hover-lift cards, last message preview, 24h window indicator dots
- **Chat Area**: Cream background, redesigned bubbles with delivery status, glass header + input

## Design Tokens

| Token | Value |
|-------|-------|
| Page bg | `#FBFBFD` + radial orange gradients + grain |
| Glass panel | `rgba(255,255,255,0.85)` + `blur(32px) saturate(180%)` |
| Panel radius | `24px` |
| Panel border | `1px solid rgba(0,0,0,0.04)` |
| Panel shadow | `0 10px 40px -10px rgba(0,0,0,0.05)` |
| Card radius | `16px` |
| Section headers | `10px` uppercase, `tracking-wider`, `#8E8E93` |
| Primary text | `#1C1C1E`, `13-14px`, `font-semibold` |
| Secondary text | `#8E8E93`, `11-12px` |
| Accent | `#fe5b25` |
| Success | `#34C759` |
| Warning | `#FF9500` |
| Danger | `#FF3B30` |
| Hover | `translateY(-1px)` + shadow-md |
| Transitions | `0.35s cubic-bezier(0.4, 0, 0.2, 1)` |

## Layout

```
┌──────────┬─────────────────────┬────────────┐
│ Contact  │     Chat Area       │  CRM Card  │
│  List    │   cream + grain     │            │
│  glass   │   floating bubbles  │  glass     │
│  panel   │   glass header      │  panel     │
│  320px   │      flex-1         │  320px     │
└──────────┴─────────────────────┴────────────┘
```

## 1. Contact List Panel

### Wrapper
- Glass panel: `rgba(255,255,255,0.85)`, `blur(32px)`, `rounded-3xl`
- Width: `320px`

### Search + Filter
- Search input: `rounded-2xl`, glass bg, `backdrop-blur(16px)`
- Stage filter: horizontal scrollable pills (`rounded-full`), each with stage color dot + count
- Active pill: filled with stage color at 10% opacity

### Contact Cards
- `rounded-2xl`, `bg-white`, `border border-black/[0.04]`
- Hover: `translateY(-1px)`, `shadow-md`, `border-black/[0.08]`
- Active (selected): `ring-2 ring-[#fe5b25]/20`, `bg-[#fe5b25]/[0.02]`
- Content:
  - Avatar (40px) + Name + Phone
  - Stage badge pill (colored dot + label)
  - Last message preview (1 line, truncated, `text-[11px] text-[#8E8E93]`)
  - Timestamp (relative: "2m ago", "1h ago")
  - 24h window dot: green/orange/red circle (6px) in top-right corner
  - Unread count badge (if applicable)

## 2. Chat Area

### Background
- `#FBFBFD` cream with CSS grain overlay at 0.15 opacity
- Subtle radial gradients at corners: `rgba(254,91,37,0.02)`

### Header
- Glass panel: `rgba(255,255,255,0.9)`, `blur(24px)`, bottom border only
- Avatar (40px) + Name + Phone + Online status dot
- Stage pill badge
- Action icons: call, WhatsApp link, copy phone

### Message Bubbles
- Outgoing: `bg-[#1C1C1E]`, `text-white`, `rounded-[20px] rounded-br-[6px]`
- Incoming: `bg-white`, `border border-black/[0.06]`, `shadow-xs`, `rounded-[20px] rounded-bl-[6px]`
- Max width: `75%`
- Timestamp: `text-[10px]` inside bubble, bottom-right
- Delivery ticks: `✓` sent (gray), `✓✓` delivered (gray), `✓✓` read (blue `#007AFF`)
- System events: centered pill with icon, `rounded-full`, `bg-black/[0.03]`, `text-[11px]`

### Date Separators
- Centered pill: `rounded-full`, `bg-black/[0.04]`, `px-4 py-1`, `text-[11px] font-medium text-[#8E8E93]`

### Channel Selector
- Already implemented with profile pics ✅
- Style upgrade: glass background, `rounded-2xl` pills

### Input Area
- Glass panel: `rgba(255,255,255,0.9)`, `blur(24px)`, top border
- Textarea: `rounded-[24px]`, `bg-black/[0.03]`, focus: `bg-white ring-4 ring-[#fe5b25]/5`
- Send button: `rounded-2xl`, `bg-[#1C1C1E]`, hover glow
- Quick reply trigger (⚡): `rounded-2xl`, subtle bg

## 3. CRM Card (Right Sidebar)

### Wrapper
- Glass panel: `rgba(255,255,255,0.85)`, `blur(32px)`, `rounded-3xl`
- Width: `320px`
- Internal scrollable area with `scrollbar-hide`

### Profile Header Section
- Avatar: `56px`, `rounded-2xl` (not circle — matches dashboard style)
- Name: `text-[16px] font-bold`
- Phone: `text-[12px] text-[#8E8E93]`
- Action icons row: call, WhatsApp, copy — `rounded-xl` buttons with hover
- Stage selector: `rounded-xl` dropdown with color dot

### Quick Actions Section
- Header: `QUICK ACTIONS`, `text-[10px] uppercase tracking-wider`
- Buttons grid (2x2):
  - "Send Template" — `bg-[#fe5b25]/[0.06]`, `text-[#fe5b25]`
  - "Schedule Call" — `bg-[#007AFF]/[0.06]`, `text-[#007AFF]`
  - "Mark VIP" — `bg-[#FF9500]/[0.06]`, `text-[#FF9500]`
  - "Add Tag" — `bg-black/[0.03]`, `text-[#8E8E93]`
- Each: `rounded-xl`, `text-[11px] font-semibold`, icon + label, `h-9`

### Lead Intelligence Section
- Header: `LEAD INTELLIGENCE`
- Lead Score: progress bar with gradient `#fe5b25` → `#34C759`, value label
- Source: icon + "Rebeca Bot → Group Name"
- Messages stats: "12 sent · 8 received"
- Engagement level: colored dot + label (High/Medium/Low)
- Avg response time: "~2h"

### Registered Contractor Section (existing, restyled)
- Green glass card: `bg-[#34C759]/[0.04]`, `border border-[#34C759]/20`
- Trades, Service Area, Counties, Working Days — existing data, cleaner layout

### 24h Window Section (existing, restyled)
- Progress bar added under countdown (visual percentage of time remaining)
- Color transitions: green → orange (< 4h) → red (expired)

### Dates & Timeline Section
- Created, Last contact, Trial end dates (existing)
- NEW: Mini stage timeline — vertical dots connected by line showing stage progression with dates

### Follow-up Section (existing)
- Same functionality, glass-styled inputs

### Tags Section (NEW)
- Horizontal pills: `rounded-full`, removable (x button)
- "+ Add tag" button opens inline input
- Predefined: VIP, Hot, Follow-up, Priority
- Custom tags supported

### Notes Section (existing)
- Same functionality, glass-styled textarea

### Source Groups Section (existing)
- Same, cleaner styling

## 4. New Data Requirements

### Database additions needed:
- `prospect_tags` table or `tags` array column on `prospects`
- Lead score computation (based on message count, response rate, stage progression)

### Computed in frontend:
- Message stats (count sent/received from messages array)
- Engagement level (derived from message frequency)
- Average response time (computed from message timestamps)
- Stage timeline (from prospect_events)
- 24h window (already implemented)

## 5. Responsive Considerations

- Below 1200px: CRM card collapses to a slide-out drawer
- Below 900px: Contact list becomes a slide-out drawer too
- Mobile: Single-column chat with swipe gestures for panels
