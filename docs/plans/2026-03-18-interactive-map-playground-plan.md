# Interactive Map Playground Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform the landing page MapSection from a passive auto-cycling demo into an interactive playground where visitors click US states and see matching leads in real time.

**Architecture:** Replace the auto-cycle state machine with a multi-select state model. USMap gets hover support via new `onStateHover` prop. MapSection becomes the controller: manages selected states, filters demo leads, and animates stats counters. All pure SVG + CSS — zero new deps.

**Tech Stack:** React, TypeScript, Tailwind CSS, existing USMap SVG component, existing i18n (`useLang`)

---

### Task 1: Add hover support to USMap component

**Files:**
- Modify: `apps/landing/src/components/USMap.tsx:65-76` (interface) and `:96-137` (component)

**Step 1: Add hover props to USMapProps interface**

```typescript
interface USMapProps {
  onStateClick?: (abbr: string, name: string) => void;
  onStateHover?: (abbr: string | null, name: string | null) => void;
  defaultFill?: string;
  defaultStroke?: string;
  stateStyles?: Record<string, StateStyle>;
  className?: string;
}
```

**Step 2: Wire hover events in path render**

In the `.map()` inside the component, add `onMouseEnter` and `onMouseLeave` to the `<path>`:

```tsx
<path
  key={abbr}
  d={d}
  data-state={abbr}
  data-name={name}
  fill={custom.fill ?? defaultFill}
  stroke={custom.stroke ?? defaultStroke}
  strokeWidth={1}
  strokeLinejoin="round"
  opacity={custom.opacity ?? 1}
  onClick={() => onStateClick?.(abbr, name)}
  onMouseEnter={() => onStateHover?.(abbr, name)}
  onMouseLeave={() => onStateHover?.(null, null)}
  className={
    onStateClick
      ? "cursor-pointer hover:opacity-75 transition-opacity duration-150"
      : undefined
  }
  aria-label={name}
>
  <title>{name}</title>
</path>
```

**Step 3: Verify** — no visual changes yet, just prop wiring. Confirm the landing dev server still works.

**Step 4: Commit**

```bash
git add apps/landing/src/components/USMap.tsx
git commit -m "feat(USMap): add onStateHover prop for hover events"
```

---

### Task 2: Expand demo data to ~20 leads across 10 states

**Files:**
- Modify: `apps/landing/src/components/MapSection.tsx:6-24` (data constants)

**Step 1: Replace DEMO_LEADS and state constants**

Replace the existing constants at the top of MapSection.tsx with:

```typescript
const POPULAR_STATES = ['FL', 'TX', 'CA'] // states that pulse in empty state

const DEMO_LEADS: DemoLead[] = [
  { state: 'FL', city: 'Miami', zip: '33101', trade: 'Plumbing', tradeHe: 'אינסטלציה', est: '$300-500' },
  { state: 'FL', city: 'Orlando', zip: '32801', trade: 'Roofing', tradeHe: 'איטום', est: '$500-1,200' },
  { state: 'FL', city: 'Tampa', zip: '33602', trade: 'Electrical', tradeHe: 'חשמל', est: '$200-400' },
  { state: 'TX', city: 'Houston', zip: '77001', trade: 'HVAC', tradeHe: 'מיזוג', est: '$400-800' },
  { state: 'TX', city: 'Dallas', zip: '75201', trade: 'Plumbing', tradeHe: 'אינסטלציה', est: '$150-350' },
  { state: 'TX', city: 'Austin', zip: '78701', trade: 'Painting', tradeHe: 'צביעה', est: '$250-600' },
  { state: 'CA', city: 'Los Angeles', zip: '90001', trade: 'Electrical', tradeHe: 'חשמל', est: '$200-400' },
  { state: 'CA', city: 'San Diego', zip: '92101', trade: 'HVAC', tradeHe: 'מיזוג', est: '$350-700' },
  { state: 'NY', city: 'Brooklyn', zip: '11201', trade: 'Plumbing', tradeHe: 'אינסטלציה', est: '$400-900' },
  { state: 'NY', city: 'Queens', zip: '11101', trade: 'Roofing', tradeHe: 'איטום', est: '$600-1,500' },
  { state: 'IL', city: 'Chicago', zip: '60601', trade: 'HVAC', tradeHe: 'מיזוג', est: '$300-650' },
  { state: 'IL', city: 'Naperville', zip: '60540', trade: 'Electrical', tradeHe: 'חשמל', est: '$180-400' },
  { state: 'GA', city: 'Atlanta', zip: '30301', trade: 'Painting', tradeHe: 'צביעה', est: '$200-500' },
  { state: 'GA', city: 'Savannah', zip: '31401', trade: 'Roofing', tradeHe: 'איטום', est: '$450-900' },
  { state: 'OH', city: 'Columbus', zip: '43201', trade: 'Plumbing', tradeHe: 'אינסטלציה', est: '$250-550' },
  { state: 'NC', city: 'Charlotte', zip: '28201', trade: 'HVAC', tradeHe: 'מיזוג', est: '$300-700' },
  { state: 'NC', city: 'Raleigh', zip: '27601', trade: 'Electrical', tradeHe: 'חשמל', est: '$200-450' },
  { state: 'AZ', city: 'Phoenix', zip: '85001', trade: 'Roofing', tradeHe: 'איטום', est: '$400-1,000' },
  { state: 'AZ', city: 'Tucson', zip: '85701', trade: 'HVAC', tradeHe: 'מיזוג', est: '$350-800' },
  { state: 'PA', city: 'Philadelphia', zip: '19101', trade: 'Plumbing', tradeHe: 'אינסטלציה', est: '$300-700' },
]

interface DemoLead {
  state: string
  city: string
  zip: string
  trade: string
  tradeHe: string
  est: string
}

// Fake lead-count per state for tooltip
const STATE_LEAD_COUNTS: Record<string, number> = {
  FL: 847, TX: 623, CA: 512, NY: 389, IL: 274,
  GA: 198, OH: 156, NC: 213, AZ: 187, PA: 234,
}
```

**Step 2: Remove old constants** — delete `ALL_STATES`, `HIGHLIGHT_STATES`, `FILTER_STEPS_EN`, `FILTER_STEPS_HE`.

**Step 3: Commit**

```bash
git add apps/landing/src/components/MapSection.tsx
git commit -m "feat(MapSection): expand demo data to 20 leads across 10 states"
```

---

### Task 3: Rewrite MapSection — interactive selection + hover tooltip

**Files:**
- Modify: `apps/landing/src/components/MapSection.tsx` (full rewrite of component body)

**Step 1: Replace state and effects**

Remove the old auto-cycle `step`, `visibleLeads` state and both `useEffect` hooks. Replace with:

```typescript
export default function MapSection() {
  const { lang } = useLang()
  const he = lang === 'he'
  const [selectedStates, setSelectedStates] = useState<string[]>([])
  const [hoveredState, setHoveredState] = useState<string | null>(null)
  const [visibleLeads, setVisibleLeads] = useState(0)
  const sectionRef = useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = useState(false)

  // IntersectionObserver — trigger animations when section enters viewport
  useEffect(() => {
    const el = sectionRef.current
    if (!el) return
    const obs = new IntersectionObserver(([entry]) => setIsVisible(entry.isIntersecting), { threshold: 0.2 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  // Toggle state selection
  const toggleState = (abbr: string) => {
    setSelectedStates(prev =>
      prev.includes(abbr) ? prev.filter(s => s !== abbr) : [...prev, abbr]
    )
  }

  // Filtered leads
  const matchedLeads = selectedStates.length > 0
    ? DEMO_LEADS.filter(l => selectedStates.includes(l.state))
    : []

  // Stagger lead card animation when selection changes
  useEffect(() => {
    setVisibleLeads(0)
    if (matchedLeads.length === 0) return
    const timeouts = matchedLeads.map((_, i) =>
      setTimeout(() => setVisibleLeads(i + 1), (i + 1) * 100)
    )
    return () => timeouts.forEach(clearTimeout)
  }, [selectedStates.join(',')]) // eslint-disable-line react-hooks/exhaustive-deps

  // Build state styles
  const stateStyles: Record<string, { fill: string; opacity?: number; stroke?: string }> = {}
  for (const abbr of selectedStates) {
    stateStyles[abbr] = { fill: '#fe5b25', opacity: 0.6, stroke: '#fe5b25' }
  }
  if (hoveredState && !selectedStates.includes(hoveredState)) {
    stateStyles[hoveredState] = { fill: '#fe5b25', opacity: 0.25, stroke: '#fe5b25' }
  }

  // Stats
  const totalLeads = selectedStates.reduce((sum, s) => sum + (STATE_LEAD_COUNTS[s] ?? 0), 0)
  const totalValue = Math.round(totalLeads * 2.8) // ~$2.8k per lead avg

  // ... JSX continues in next step
}
```

**Step 2: Write the JSX return**

```tsx
return (
  <section ref={sectionRef} className="section-padding bg-cream overflow-hidden">
    <div className="max-w-7xl mx-auto px-6">
      {/* Header */}
      <div className="text-center mb-12">
        <h2 className="text-3xl md:text-5xl font-medium mb-4">
          {he ? 'לידים בכל ארה״ב. בדיוק איפה שאתה עובד.' : 'Leads across all 50 states. Right where you work.'}
        </h2>
        <p className="text-gray-subtle/70 max-w-2xl mx-auto">
          {he
            ? 'לחץ על מדינה כדי לראות לידים מהאזור שלך בזמן אמת.'
            : 'Click any state to see matching leads from your area in real time.'}
        </p>
      </div>

      {/* Selected state tags */}
      {selectedStates.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 justify-center mb-6">
          {selectedStates.map(abbr => (
            <button
              key={abbr}
              onClick={() => toggleState(abbr)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#fe5b25] text-white text-xs font-bold transition-all hover:bg-[#e04d1c] animate-slide-in"
            >
              {abbr}
              <X size={12} />
            </button>
          ))}
          <button
            onClick={() => setSelectedStates([])}
            className="text-xs text-gray-subtle/50 hover:text-gray-subtle transition-colors"
          >
            {he ? 'נקה הכל' : 'Clear all'}
          </button>
        </div>
      )}

      <div className="grid lg:grid-cols-5 gap-8 items-start">
        {/* Map — 3 columns */}
        <div className="lg:col-span-3 relative">
          {/* Tooltip */}
          {hoveredState && (
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-full z-10 pointer-events-none">
              <div className="px-3 py-1.5 rounded-lg bg-dark text-white text-xs font-bold shadow-lg whitespace-nowrap">
                {hoveredState} — {STATE_LEAD_COUNTS[hoveredState]
                  ? (he ? `~${STATE_LEAD_COUNTS[hoveredState]} לידים השבוע` : `~${STATE_LEAD_COUNTS[hoveredState]} leads this week`)
                  : (he ? 'לחץ לבחירה' : 'Click to select')}
              </div>
            </div>
          )}

          <div className="relative">
            <USMap
              defaultFill="#f1f5f9"
              defaultStroke="#e2e8f0"
              stateStyles={stateStyles}
              onStateClick={(abbr) => toggleState(abbr)}
              onStateHover={(abbr) => setHoveredState(abbr)}
              className="w-full transition-all duration-300"
            />

            {/* Glow filter for selected states */}
            {selectedStates.length > 0 && (
              <div className="absolute inset-0 pointer-events-none">
                <svg className="w-full h-full absolute inset-0" style={{ filter: 'blur(20px)', opacity: 0.2 }}>
                  <USMap
                    defaultFill="transparent"
                    defaultStroke="transparent"
                    stateStyles={Object.fromEntries(selectedStates.map(s => [s, { fill: '#fe5b25', opacity: 1 }]))}
                    className="w-full"
                  />
                </svg>
              </div>
            )}

            {/* Empty state — pulsing dots on popular states */}
            {selectedStates.length === 0 && isVisible && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="text-center">
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/80 backdrop-blur border border-dark/5 shadow-sm">
                    <MousePointerClick size={14} className="text-[#fe5b25]" />
                    <span className="text-xs font-semibold text-gray-subtle">
                      {he ? 'לחץ על מדינה כדי להתחיל' : 'Click any state to start'}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Lead feed — 2 columns */}
        <div className="lg:col-span-2">
          <div className="bg-cream rounded-2xl p-6 border border-dark/5 min-h-[380px]">
            {/* Feed header */}
            <div className="flex items-center gap-3 mb-5 pb-4 border-b border-dark/5">
              <div className="w-8 h-8 rounded-lg bg-[#fe5b25]/10 flex items-center justify-center">
                <Zap size={16} className="text-[#fe5b25]" />
              </div>
              <div>
                <div className="text-sm font-semibold">
                  {he ? 'לידים בזמן אמת' : 'Live Lead Feed'}
                </div>
                <div className="text-[10px] text-gray-subtle/50">
                  {selectedStates.length === 0
                    ? (he ? 'בחר מדינה כדי לראות לידים...' : 'Select a state to see leads...')
                    : (he ? `${matchedLeads.length} לידים ב-${selectedStates.join(', ')}` : `${matchedLeads.length} leads in ${selectedStates.join(', ')}`)}
                </div>
              </div>
            </div>

            {/* Lead cards or placeholder */}
            {selectedStates.length === 0 ? (
              <div className="space-y-3">
                {[0, 1, 2].map(i => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-white/60 border border-dark/5">
                    <div className="w-2 h-2 rounded-full bg-dark/20" />
                    <div className="flex-1">
                      <div className="h-3 bg-dark/10 rounded w-3/4 mb-1.5" />
                      <div className="h-2 bg-dark/5 rounded w-1/2" />
                    </div>
                  </div>
                ))}
                <div className="text-center text-xs text-gray-subtle/40 pt-2">
                  {he ? 'ממתין לבחירה...' : 'Waiting for selection...'}
                </div>
              </div>
            ) : (
              <div className="space-y-3 max-h-[320px] overflow-y-auto">
                {matchedLeads.map((lead, i) => (
                  <div
                    key={`${lead.state}-${lead.city}`}
                    className={`p-3 rounded-xl bg-white border border-dark/5 shadow-sm transition-all duration-300 ${
                      i < visibleLeads ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-[#fe5b25]" />
                        <span className="text-xs font-semibold">{he ? lead.tradeHe : lead.trade}</span>
                      </div>
                      <span className="text-[10px] text-primary font-semibold">{lead.est}</span>
                    </div>
                    <div className="text-[11px] text-gray-subtle/60 ms-4">
                      📍 {lead.city}, {lead.state} {lead.zip}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stats bar */}
      {selectedStates.length > 0 && (
        <div className="mt-8 flex flex-wrap items-center justify-center gap-8 px-8 py-5 rounded-2xl bg-dark text-white">
          <StatItem icon={<Zap size={16} />} value={totalLeads} label={he ? 'לידים' : 'leads'} />
          <StatItem icon={<MapPin size={16} />} value={selectedStates.length} label={he ? 'מדינות' : 'states'} />
          <StatItem icon={<Filter size={16} />} value={totalValue} prefix="$" suffix="k" label={he ? 'שווי כולל' : 'total value'} />
        </div>
      )}
    </div>
  </section>
)
```

**Step 3: Add the StatItem helper component**

Add this above or below the MapSection component in the same file:

```typescript
function StatItem({ icon, value, label, prefix = '', suffix = '' }: {
  icon: React.ReactNode
  value: number
  label: string
  prefix?: string
  suffix?: string
}) {
  const [displayed, setDisplayed] = useState(0)
  const prevValue = useRef(0)

  useEffect(() => {
    const start = prevValue.current
    const end = value
    const duration = 1200
    const startTime = Date.now()

    const tick = () => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / duration, 1)
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplayed(Math.round(start + (end - start) * eased))
      if (progress < 1) requestAnimationFrame(tick)
    }

    requestAnimationFrame(tick)
    prevValue.current = end
  }, [value])

  return (
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-[#fe5b25]">
        {icon}
      </div>
      <div>
        <div className="text-xl font-bold tabular-nums">
          {prefix}{displayed.toLocaleString()}{suffix}
        </div>
        <div className="text-[10px] text-white/50 font-medium">{label}</div>
      </div>
    </div>
  )
}
```

**Step 4: Update imports**

Make sure the imports at the top of MapSection.tsx are:

```typescript
import { useState, useEffect, useRef } from 'react'
import { MapPin, Filter, Zap, X, MousePointerClick } from 'lucide-react'
import { useLang } from '../i18n/LanguageContext'
import USMap from './USMap'
```

**Step 5: Verify** — start the landing dev server, navigate to the map section, click states, verify leads appear.

**Step 6: Commit**

```bash
git add apps/landing/src/components/MapSection.tsx
git commit -m "feat(MapSection): interactive playground with click-to-select, live feed, animated stats"
```

---

### Task 4: Add CSS animations

**Files:**
- Modify: `apps/landing/tailwind.config.js` (add keyframes)
- Or: Add inline `<style>` in MapSection if preferred

**Step 1: Add slide-in animation to tailwind config**

```javascript
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#fe5b25',
        'primary-dark': '#e04d1c',
        dark: '#0b0707',
        cream: '#faf9f6',
        'cream-dark': '#f5f2ed',
        'gray-subtle': '#3b3b3b',
      },
      fontFamily: {
        display: ['Inter', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
        hebrew: ['Heebo', 'sans-serif'],
      },
      letterSpacing: {
        'tighter-biotix': '-0.05em',
      },
      keyframes: {
        'slide-in': {
          '0%': { opacity: '0', transform: 'translateX(-8px) scale(0.95)' },
          '100%': { opacity: '1', transform: 'translateX(0) scale(1)' },
        },
      },
      animation: {
        'slide-in': 'slide-in 0.3s ease-out',
      },
    },
  },
  plugins: [],
}
```

**Step 2: Verify** — tag pills should animate in when selecting a state.

**Step 3: Commit**

```bash
git add apps/landing/tailwind.config.js
git commit -m "feat: add slide-in keyframe animation for state tags"
```

---

### Task 5: SVG glow effect polish + hover tooltip positioning

**Files:**
- Modify: `apps/landing/src/components/MapSection.tsx` (tooltip positioning)

**Step 1: Improve tooltip positioning**

The tooltip currently sits at a fixed position above the map. For a better UX, track mouse position relative to the map container:

```typescript
const mapContainerRef = useRef<HTMLDivElement>(null)
const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 })

// Add to the map container div:
// onMouseMove={(e) => {
//   const rect = mapContainerRef.current?.getBoundingClientRect()
//   if (rect) setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top })
// }}
```

Update the tooltip JSX to use absolute positioning based on mouse:

```tsx
{hoveredState && (
  <div
    className="absolute z-10 pointer-events-none transition-all duration-75"
    style={{ left: tooltipPos.x, top: tooltipPos.y - 40 }}
  >
    <div className="px-3 py-1.5 rounded-lg bg-dark text-white text-xs font-bold shadow-lg whitespace-nowrap -translate-x-1/2">
      {hoveredState} — {STATE_LEAD_COUNTS[hoveredState]
        ? (he ? `~${STATE_LEAD_COUNTS[hoveredState]} לידים` : `~${STATE_LEAD_COUNTS[hoveredState]} leads`)
        : (he ? 'לחץ לבחירה' : 'Click to select')}
    </div>
  </div>
)}
```

**Step 2: Replace the blur-SVG glow with a simpler CSS approach**

Remove the nested `<svg>` glow layer and add an SVG `<defs>` filter approach or just use a CSS `drop-shadow` on the main USMap when states are selected:

```tsx
<USMap
  // ... existing props
  className={`w-full transition-all duration-300 ${
    selectedStates.length > 0 ? 'drop-shadow-[0_0_15px_rgba(254,91,37,0.25)]' : ''
  }`}
/>
```

Remove the glow `<div>` that renders a second USMap.

**Step 3: Verify** — hover should show tooltip following cursor, selected states have glow.

**Step 4: Commit**

```bash
git add apps/landing/src/components/MapSection.tsx
git commit -m "feat(MapSection): mouse-following tooltip + CSS glow polish"
```

---

### Task 6: Final verification & responsive testing

**Files:** None (verification only)

**Step 1: Test desktop** — Click FL, TX, CA. Verify:
- States turn orange with glow
- Tags appear above map
- Lead feed shows filtered leads with stagger animation
- Stats bar shows with counting animation
- Tooltip follows cursor on hover

**Step 2: Test mobile** — Resize to 375px wide. Verify:
- Map stacks full-width
- Lead feed stacks below
- Stats bar wraps
- Tapping states works

**Step 3: Test Hebrew** — Switch to Hebrew. Verify all text renders correctly and RTL layout.

**Step 4: Test empty state** — Clear all states. Verify:
- Placeholder skeleton cards appear
- CTA overlay shows "Click any state to start"
- No console errors

**Step 5: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: responsive and i18n polish for interactive map"
```
