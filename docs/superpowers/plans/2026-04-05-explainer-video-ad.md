# Explainer Video Ad — "Two Worlds Connect" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a 50-second Remotion promotional video with split-screen concept showing GC and Sub sides connecting via MasterLeadFlow.

**Architecture:** Single Remotion composition (`ExplainerAd`) orchestrates 5 scene components via frame-based interpolation. Shared UI components (PhoneMockup, LeadCard, etc.) are adapted from landing page visual patterns into Remotion inline-style components. The composition is embedded via `@remotion/player` in a preview page.

**Tech Stack:** Remotion 4.x, React, TypeScript, `@remotion/player` (already installed)

**Spec:** `docs/superpowers/specs/2026-04-05-explainer-video-ad-design.md`

---

## File Structure

```
apps/landing/src/remotion/
  ExplainerAd.tsx                    # Main composition — constants, scene orchestration
  explainer/
    shared/
      theme.ts                       # Design system constants (colors, fonts, sizes)
      PhoneMockup.tsx                # Reusable dark phone frame wrapper
      LeadCardAd.tsx                 # Lead card (profession, urgency, location)
      SubCardAd.tsx                  # Subcontractor selection card
      WhatsAppMessageAd.tsx          # WhatsApp bubble (dark WA theme)
      KpiCardAd.tsx                  # KPI stat card with count-up
      LogoAd.tsx                     # MasterLeadFlow logo
    Scene1Hook.tsx                   # "Two Worlds" split screen
    Scene2GCSide.tsx                 # GC flow — lead → pick sub → send
    Scene3SubSide.tsx                # Sub flow — receive → view → accept
    Scene4Merge.tsx                  # Dashboard merge — "Everyone wins"
    Scene5CTA.tsx                    # CTA with tagline + button
```

---

## Task 1: Theme & Shared Constants

**Files:**
- Create: `apps/landing/src/remotion/explainer/shared/theme.ts`

- [ ] **Step 1: Create theme file with all design tokens**

```ts
// apps/landing/src/remotion/explainer/shared/theme.ts

/* ─── Design System (matches tailwind.config.js + landing page) ─── */
export const COLORS = {
  cream: '#faf9f6',
  creamDark: '#f5f2ed',
  dark: '#0b0707',
  graySubtle: '#3b3b3b',
  primary: '#fe5b25',
  primaryDark: '#e04d1c',
  whatsapp: '#25D366',
  success: '#10b981',
  blue: '#3b82f6',
  purple: '#8b5cf6',
  red: '#FF3B30',
  amber: '#FF9500',
  cardBorder: '#efeff1',
  waDark: '#0b141a',
  waBubble: '#202c33',
  waBubbleGreen: '#DCF8C6',
} as const

export const FONT = {
  family: 'Inter, system-ui, -apple-system, sans-serif',
  heading: { fontWeight: 500, letterSpacing: '-0.04em' } as const,
  bold: { fontWeight: 700 } as const,
  semibold: { fontWeight: 600 } as const,
} as const

export const SHADOW = {
  card: '0 4px 24px rgba(0,0,0,0.06)',
  cardHover: '0 8px 40px rgba(0,0,0,0.1)',
  phone: '0 25px 80px rgba(0,0,0,0.25)',
} as const

/* ─── Timing ─── */
export const FPS = 30
export const SCENE_1_START = 0
export const SCENE_2_START = 90
export const SCENE_3_START = 540
export const SCENE_4_START = 900
export const SCENE_5_START = 1260
export const TOTAL_FRAMES = 1500
export const WIDTH = 1920
export const HEIGHT = 1080

/* ─── Helpers ─── */
import { spring, interpolate } from 'remotion'

export function sp(
  frame: number,
  fps: number,
  delay: number,
  cfg?: { damping?: number; stiffness?: number }
) {
  return spring({
    frame,
    fps,
    delay,
    config: { damping: cfg?.damping ?? 12, stiffness: cfg?.stiffness ?? 140 },
  })
}

export function fadeIn(frame: number, start: number, duration = 20) {
  return interpolate(frame, [start, start + duration], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
}

export function fadeOut(frame: number, start: number, duration = 20) {
  return interpolate(frame, [start, start + duration], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/landing/src/remotion/explainer/shared/theme.ts
git commit -m "feat(video): add design system theme constants for explainer ad"
```

---

## Task 2: Shared UI Components

**Files:**
- Create: `apps/landing/src/remotion/explainer/shared/PhoneMockup.tsx`
- Create: `apps/landing/src/remotion/explainer/shared/LeadCardAd.tsx`
- Create: `apps/landing/src/remotion/explainer/shared/SubCardAd.tsx`
- Create: `apps/landing/src/remotion/explainer/shared/WhatsAppMessageAd.tsx`
- Create: `apps/landing/src/remotion/explainer/shared/KpiCardAd.tsx`
- Create: `apps/landing/src/remotion/explainer/shared/LogoAd.tsx`

- [ ] **Step 1: Create PhoneMockup — dark phone frame wrapper**

```tsx
// apps/landing/src/remotion/explainer/shared/PhoneMockup.tsx
import { AbsoluteFill } from 'remotion'
import { COLORS, SHADOW } from './theme'

export function PhoneMockup({
  children,
  width = 280,
  scale = 1,
  opacity = 1,
  x = 0,
  y = 0,
}: {
  children: React.ReactNode
  width?: number
  scale?: number
  opacity?: number
  x?: number
  y?: number
}) {
  const height = width * (17 / 9)
  return (
    <div
      style={{
        width,
        height,
        background: COLORS.dark,
        borderRadius: width * 0.09,
        padding: width * 0.022,
        boxShadow: SHADOW.phone,
        transform: `scale(${scale}) translate(${x}px, ${y}px)`,
        opacity,
        flexShrink: 0,
      }}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          borderRadius: width * 0.075,
          overflow: 'hidden',
          background: COLORS.cream,
          position: 'relative',
        }}
      >
        {/* Status bar */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: `${width * 0.025}px ${width * 0.05}px`,
            fontSize: width * 0.035,
            color: COLORS.graySubtle,
            fontWeight: 600,
          }}
        >
          <span>11:20</span>
          <div style={{ display: 'flex', gap: 3, fontSize: width * 0.028 }}>
            <span>📶</span>
            <span>🔋</span>
          </div>
        </div>
        {/* Content */}
        <div style={{ flex: 1, overflow: 'hidden', height: '100%' }}>
          {children}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create LeadCardAd — adapted from LeadsFeedShowcase**

```tsx
// apps/landing/src/remotion/explainer/shared/LeadCardAd.tsx
import { COLORS, FONT, SHADOW } from './theme'

const urgencyStyles = {
  Hot: { bg: 'rgba(255,59,48,0.12)', text: '#FF3B30' },
  Warm: { bg: 'rgba(255,149,0,0.12)', text: '#FF9500' },
}

interface LeadCardProps {
  profession: string
  icon: string
  color: string
  summary: string
  location: string
  urgency: 'Hot' | 'Warm'
  time: string
  group: string
  scale?: number
  opacity?: number
  x?: number
  y?: number
}

export function LeadCardAd({
  profession,
  icon,
  color,
  summary,
  location,
  urgency,
  time,
  group,
  scale = 1,
  opacity = 1,
  x = 0,
  y = 0,
}: LeadCardProps) {
  const u = urgencyStyles[urgency]
  return (
    <div
      style={{
        transform: `scale(${scale}) translate(${x}px, ${y}px)`,
        opacity,
        background: '#fff',
        borderRadius: 16,
        border: `1px solid ${COLORS.cardBorder}`,
        boxShadow: SHADOW.card,
        padding: 14,
        width: 230,
        fontFamily: FONT.family,
      }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <div
          style={{
            width: 24,
            height: 24,
            borderRadius: 7,
            background: `${color}15`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 12,
          }}
        >
          {icon}
        </div>
        <span style={{ fontSize: 11, fontWeight: 700, color }}>{profession}</span>
        <span
          style={{
            fontSize: 8,
            fontWeight: 700,
            color: u.text,
            background: u.bg,
            padding: '1px 5px',
            borderRadius: 4,
            marginLeft: 'auto',
          }}
        >
          {urgency === 'Hot' ? '🔥 Hot' : '☀️ Warm'}
        </span>
      </div>
      {/* Summary */}
      <p
        style={{
          fontSize: 10,
          fontWeight: 500,
          color: COLORS.dark,
          margin: 0,
          lineHeight: 1.5,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {summary}
      </p>
      {/* Footer */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: 8,
          fontSize: 8,
          color: COLORS.graySubtle,
          opacity: 0.6,
        }}
      >
        <span>📍 {location}</span>
        <span>{time}</span>
      </div>
      <div
        style={{
          marginTop: 4,
          fontSize: 7,
          color: COLORS.graySubtle,
          opacity: 0.4,
          fontWeight: 600,
        }}
      >
        {group}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create SubCardAd — subcontractor selection card**

```tsx
// apps/landing/src/remotion/explainer/shared/SubCardAd.tsx
import { COLORS, FONT, SHADOW } from './theme'

interface SubCardProps {
  initials: string
  name: string
  trade: string
  jobs: number
  rating: number
  selected?: boolean
  scale?: number
  opacity?: number
  y?: number
}

export function SubCardAd({
  initials,
  name,
  trade,
  jobs,
  rating,
  selected = false,
  scale = 1,
  opacity = 1,
  y = 0,
}: SubCardProps) {
  return (
    <div
      style={{
        transform: `scale(${scale}) translateY(${y}px)`,
        opacity,
        background: '#fff',
        borderRadius: 14,
        border: selected ? `2px solid ${COLORS.primary}` : `1px solid ${COLORS.cardBorder}`,
        boxShadow: selected ? `0 4px 20px rgba(254,91,37,0.15)` : SHADOW.card,
        padding: 12,
        width: 210,
        fontFamily: FONT.family,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 16,
          background: selected
            ? `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.primaryDark})`
            : 'linear-gradient(135deg, #fee8df, #fff4ef)',
          border: selected ? 'none' : '1.5px solid #fdd5c5',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 11,
          fontWeight: 700,
          color: selected ? '#fff' : COLORS.primaryDark,
        }}
      >
        {selected ? '✓' : initials}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: COLORS.dark }}>{name}</div>
        <div style={{ fontSize: 8, color: COLORS.graySubtle, opacity: 0.6 }}>
          🔧 {trade} · {jobs} jobs · {'⭐'.repeat(Math.min(rating, 5))}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Create WhatsAppMessageAd — WA bubble**

```tsx
// apps/landing/src/remotion/explainer/shared/WhatsAppMessageAd.tsx
import { COLORS, FONT, SHADOW } from './theme'

export function WhatsAppMessageAd({
  opacity = 1,
  scale = 1,
  y = 0,
  width = 230,
}: {
  opacity?: number
  scale?: number
  y?: number
  width?: number
}) {
  return (
    <div
      style={{
        opacity,
        transform: `scale(${scale}) translateY(${y}px)`,
        width,
        borderRadius: 14,
        overflow: 'hidden',
        boxShadow: SHADOW.card,
        fontFamily: FONT.family,
      }}
    >
      {/* WA Header */}
      <div
        style={{
          background: '#1f2c34',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 12px',
        }}
      >
        <div
          style={{
            width: 26,
            height: 26,
            borderRadius: 13,
            background: `${COLORS.whatsapp}30`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 12,
            color: COLORS.whatsapp,
            fontWeight: 700,
          }}
        >
          M
        </div>
        <div>
          <div style={{ color: '#e9edef', fontSize: 10, fontWeight: 600 }}>MasterLeadFlow</div>
          <div style={{ color: '#8696a0', fontSize: 8 }}>online</div>
        </div>
      </div>
      {/* Messages */}
      <div
        style={{
          background: COLORS.waDark,
          padding: 8,
          display: 'flex',
          flexDirection: 'column',
          gap: 5,
        }}
      >
        {/* Outgoing */}
        <div style={{ alignSelf: 'flex-end', maxWidth: '85%' }}>
          <div
            style={{
              background: '#005c4b',
              borderRadius: '10px 3px 10px 10px',
              padding: '7px 9px',
            }}
          >
            <p style={{ fontSize: 9, color: '#e9edef', margin: 0, lineHeight: 1.6 }}>
              🔔 New job for you!
              <br />
              🏠 <b>Roofing — Hurricane damage</b>
              <br />
              📍 Homestead, FL 33033
              <br />
              💰 Deal: <b>20% of job value</b>
              <br />
              <span style={{ color: '#53bdeb', fontSize: 8 }}>
                👉 portal.masterleadflow.com/j/abc
              </span>
            </p>
            <div style={{ fontSize: 7, color: '#ffffff80', textAlign: 'right', marginTop: 2 }}>
              2:15 PM <span style={{ color: '#53bdeb', fontWeight: 700 }}>✓✓</span>
            </div>
          </div>
        </div>
        {/* Incoming reply */}
        <div style={{ alignSelf: 'flex-start', maxWidth: '60%' }}>
          <div
            style={{
              background: COLORS.waBubble,
              borderRadius: '3px 10px 10px 10px',
              padding: '6px 9px',
            }}
          >
            <p style={{ fontSize: 9, color: '#e9edef', margin: 0 }}>I'm in! Accepting now 🤝</p>
            <div style={{ fontSize: 7, color: '#ffffff50', textAlign: 'right', marginTop: 2 }}>
              2:16 PM
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Create KpiCardAd — stat card with interpolated count**

```tsx
// apps/landing/src/remotion/explainer/shared/KpiCardAd.tsx
import { useCurrentFrame, useVideoConfig, interpolate } from 'remotion'
import { COLORS, FONT, sp } from './theme'

interface KpiCardProps {
  label: string
  value: number
  prefix?: string
  suffix?: string
  color: string
  delay: number
  opacity?: number
}

export function KpiCardAd({
  label,
  value,
  prefix = '',
  suffix = '',
  color,
  delay,
  opacity = 1,
}: KpiCardProps) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const enter = sp(frame, fps, delay)
  const countProgress = interpolate(frame, [delay, delay + 40], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  const displayValue = Math.round(value * countProgress)

  return (
    <div
      style={{
        opacity: enter * opacity,
        transform: `translateY(${interpolate(enter, [0, 1], [20, 0])}px)`,
        background: '#fff',
        borderRadius: 14,
        border: `1px solid ${COLORS.cardBorder}`,
        padding: '14px 18px',
        minWidth: 160,
        fontFamily: FONT.family,
      }}
    >
      <div style={{ fontSize: 11, color: COLORS.graySubtle, opacity: 0.6, marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 28, fontWeight: 800, color }}>
        {prefix}
        {displayValue}
        {suffix}
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Create LogoAd — MasterLeadFlow logo from Navbar**

```tsx
// apps/landing/src/remotion/explainer/shared/LogoAd.tsx
import { COLORS, FONT } from './theme'

export function LogoAd({
  scale = 1,
  opacity = 1,
  showText = true,
}: {
  scale?: number
  opacity?: number
  showText?: boolean
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        transform: `scale(${scale})`,
        opacity,
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          background: COLORS.primary,
          borderRadius: 12,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="white"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 2L2 7l10 5 10-5-10-5z" />
          <path d="M2 17l10 5 10-5" />
          <path d="M2 12l10 5 10-5" />
        </svg>
      </div>
      {showText && (
        <span
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: COLORS.dark,
            fontFamily: FONT.family,
            letterSpacing: '-0.02em',
          }}
        >
          MasterLeadFlow
        </span>
      )}
    </div>
  )
}
```

- [ ] **Step 7: Commit all shared components**

```bash
git add apps/landing/src/remotion/explainer/shared/
git commit -m "feat(video): add shared UI components for explainer ad

PhoneMockup, LeadCardAd, SubCardAd, WhatsAppMessageAd, KpiCardAd, LogoAd"
```

---

## Task 3: Scene 1 — "Two Worlds" Hook

**Files:**
- Create: `apps/landing/src/remotion/explainer/Scene1Hook.tsx`

- [ ] **Step 1: Create Scene1Hook**

```tsx
// apps/landing/src/remotion/explainer/Scene1Hook.tsx
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from 'remotion'
import { COLORS, FONT, sp, SCENE_1_START, SCENE_2_START } from './shared/theme'
import { PhoneMockup } from './shared/PhoneMockup'
import { LeadCardAd } from './shared/LeadCardAd'

const LEADS = [
  {
    profession: 'HVAC',
    icon: '❄️',
    color: '#0284c7',
    summary: 'Central AC not cooling — 2,400 sq ft house, unit from 2008.',
    location: 'Miami, FL 33130',
    urgency: 'Hot' as const,
    time: '2m ago',
    group: 'South FL Contractors',
  },
  {
    profession: 'Roofing',
    icon: '🏠',
    color: '#dc2626',
    summary: 'Hurricane damage on tile roof, multiple leaks in bedroom.',
    location: 'Homestead, FL 33033',
    urgency: 'Hot' as const,
    time: '8m ago',
    group: 'Miami Dade Roofers',
  },
  {
    profession: 'Electrical',
    icon: '⚡',
    color: '#f59e0b',
    summary: 'Panel upgrade 100A to 200A, adding EV charger circuit.',
    location: 'Boca Raton, FL 33431',
    urgency: 'Warm' as const,
    time: '15m ago',
    group: 'Palm Beach Electricians',
  },
]

export function Scene1Hook() {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const localFrame = frame - SCENE_1_START

  // Animations
  const leftIn = sp(frame, fps, 5, { damping: 14 })
  const rightIn = sp(frame, fps, 12, { damping: 14 })

  // Lead cards stagger
  const card0 = sp(frame, fps, 10)
  const card1 = sp(frame, fps, 18)
  const card2 = sp(frame, fps, 26)
  const cardScales = [card0, card1, card2]

  // Flying lead animation (frames 50-80)
  const flyProgress = interpolate(localFrame, [50, 80], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  const flyX = interpolate(flyProgress, [0, 1], [-200, 200])
  const flyScale = interpolate(flyProgress, [0, 0.5, 1], [1, 1.2, 0.8])
  const flyOpacity = interpolate(flyProgress, [0, 0.3, 0.7, 1], [0, 1, 1, 0])

  // Right side glow on lead arrival
  const rightGlow = interpolate(flyProgress, [0.6, 1], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  // "What if" text
  const textIn = sp(frame, fps, 75, { damping: 10 })

  // Pulse for overwhelm effect
  const pulse = Math.sin(localFrame * 0.15) * 0.05 + 1

  return (
    <AbsoluteFill
      style={{
        background: COLORS.cream,
        fontFamily: FONT.family,
        display: 'flex',
        flexDirection: 'row',
      }}
    >
      {/* Dot grid background */}
      <AbsoluteFill
        style={{
          opacity: 0.03,
          backgroundImage: `radial-gradient(circle at 1px 1px, ${COLORS.whatsapp} 1px, transparent 0)`,
          backgroundSize: '50px 50px',
          pointerEvents: 'none',
        }}
      />

      {/* Left side — GC */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          opacity: leftIn,
          transform: `translateX(${interpolate(leftIn, [0, 1], [-60, 0])}px)`,
        }}
      >
        {/* Orange glow */}
        <div
          style={{
            position: 'absolute',
            top: '30%',
            left: '50%',
            width: 400,
            height: 400,
            borderRadius: '50%',
            background: `radial-gradient(circle, rgba(254,91,37,0.08) 0%, transparent 70%)`,
            transform: 'translate(-50%, -50%)',
            filter: 'blur(60px)',
            pointerEvents: 'none',
          }}
        />
        {/* Phone with stacked leads */}
        <PhoneMockup width={240}>
          <div style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {LEADS.map((lead, i) => (
              <LeadCardAd
                key={i}
                {...lead}
                scale={cardScales[i]}
                opacity={cardScales[i]}
              />
            ))}
          </div>
        </PhoneMockup>
        {/* Red pulse overlay on cards */}
        <div
          style={{
            position: 'absolute',
            top: '20%',
            left: '35%',
            width: 20,
            height: 20,
            borderRadius: '50%',
            background: COLORS.red,
            opacity: interpolate(pulse, [0.95, 1.05], [0.3, 0.8]),
            filter: 'blur(8px)',
            pointerEvents: 'none',
          }}
        />
        {/* Text + Badge */}
        <div style={{ textAlign: 'center', marginTop: 24 }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: 'rgba(254,91,37,0.12)',
              color: COLORS.primary,
              borderRadius: 20,
              padding: '4px 14px',
              fontSize: 11,
              fontWeight: 600,
              marginBottom: 10,
            }}
          >
            General Contractor
          </div>
          <div
            style={{
              fontSize: 26,
              color: COLORS.dark,
              ...FONT.heading,
            }}
          >
            Too many leads
          </div>
        </div>
      </div>

      {/* Center divider */}
      <div
        style={{
          width: 1,
          background: `${COLORS.dark}10`,
          alignSelf: 'stretch',
          margin: '80px 0',
        }}
      />

      {/* Right side — Sub */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          opacity: rightIn,
          transform: `translateX(${interpolate(rightIn, [0, 1], [60, 0])}px)`,
        }}
      >
        {/* Green glow — intensifies when lead arrives */}
        <div
          style={{
            position: 'absolute',
            top: '30%',
            left: '50%',
            width: 400,
            height: 400,
            borderRadius: '50%',
            background: `radial-gradient(circle, rgba(37,211,102,${0.04 + rightGlow * 0.12}) 0%, transparent 70%)`,
            transform: 'translate(-50%, -50%)',
            filter: 'blur(60px)',
            pointerEvents: 'none',
          }}
        />
        {/* Phone with empty WA screen */}
        <PhoneMockup width={240}>
          <div style={{ background: COLORS.waDark, height: '100%' }}>
            {/* WA header */}
            <div
              style={{
                background: '#1f2c34',
                padding: '10px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  background: `${COLORS.whatsapp}20`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: COLORS.whatsapp,
                  fontSize: 14,
                }}
              >
                💬
              </div>
              <div>
                <div style={{ color: '#e9edef', fontSize: 11, fontWeight: 600 }}>WhatsApp</div>
                <div style={{ color: '#8696a0', fontSize: 8 }}>No new messages</div>
              </div>
            </div>
            {/* Empty state */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: 200,
                color: '#8696a0',
                fontSize: 10,
                opacity: 0.5,
              }}
            >
              Waiting for jobs...
            </div>
          </div>
        </PhoneMockup>
        {/* Text + Badge */}
        <div style={{ textAlign: 'center', marginTop: 24 }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: `${COLORS.whatsapp}15`,
              color: COLORS.whatsapp,
              borderRadius: 20,
              padding: '4px 14px',
              fontSize: 11,
              fontWeight: 600,
              marginBottom: 10,
            }}
          >
            Subcontractor
          </div>
          <div
            style={{
              fontSize: 26,
              color: COLORS.dark,
              ...FONT.heading,
            }}
          >
            Not enough work
          </div>
        </div>
      </div>

      {/* Flying lead card */}
      {flyOpacity > 0 && (
        <div
          style={{
            position: 'absolute',
            top: '40%',
            left: '50%',
            transform: `translate(calc(-50% + ${flyX}px), -50%) scale(${flyScale})`,
            opacity: flyOpacity,
            zIndex: 10,
          }}
        >
          <LeadCardAd
            profession="Roofing"
            icon="🏠"
            color="#dc2626"
            summary="Hurricane damage on tile roof"
            location="Homestead, FL"
            urgency="Hot"
            time="8m ago"
            group=""
          />
        </div>
      )}

      {/* "What if you could connect them?" */}
      <div
        style={{
          position: 'absolute',
          bottom: 60,
          left: 0,
          right: 0,
          textAlign: 'center',
          opacity: textIn,
          transform: `translateY(${interpolate(textIn, [0, 1], [20, 0])}px)`,
        }}
      >
        <div
          style={{
            fontSize: 36,
            color: COLORS.dark,
            ...FONT.heading,
          }}
        >
          What if you could connect them?
        </div>
      </div>
    </AbsoluteFill>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/landing/src/remotion/explainer/Scene1Hook.tsx
git commit -m "feat(video): add Scene 1 — Two Worlds hook with split screen"
```

---

## Task 4: Scene 2 — "GC Side"

**Files:**
- Create: `apps/landing/src/remotion/explainer/Scene2GCSide.tsx`

- [ ] **Step 1: Create Scene2GCSide**

```tsx
// apps/landing/src/remotion/explainer/Scene2GCSide.tsx
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from 'remotion'
import { COLORS, FONT, sp, SCENE_2_START, SCENE_3_START } from './shared/theme'
import { PhoneMockup } from './shared/PhoneMockup'
import { LeadCardAd } from './shared/LeadCardAd'
import { SubCardAd } from './shared/SubCardAd'
import { WhatsAppMessageAd } from './shared/WhatsAppMessageAd'

const SUBS = [
  { initials: 'MJ', name: 'Mike Johnson', trade: 'Roofing', jobs: 12, rating: 5 },
  { initials: 'SC', name: 'Sarah Chen', trade: 'Roofing', jobs: 8, rating: 4 },
  { initials: 'CR', name: 'Carlos Rivera', trade: 'Roofing', jobs: 5, rating: 4 },
]

export function Scene2GCSide() {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const local = frame - SCENE_2_START

  // Scene visibility
  const sceneIn = interpolate(frame, [SCENE_2_START, SCENE_2_START + 30], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  const sceneOut = interpolate(frame, [SCENE_3_START - 30, SCENE_3_START], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  const vis = sceneIn * sceneOut

  // Phase timing (relative to scene start)
  const PHASE_LEAD = 0
  const PHASE_SUBS = 120
  const PHASE_SELECT = 240
  const PHASE_SEND = 330

  // Lead card
  const leadIn = sp(frame, fps, SCENE_2_START + PHASE_LEAD + 10, { damping: 10 })

  // Sub cards stagger
  const sub0 = sp(frame, fps, SCENE_2_START + PHASE_SUBS, { damping: 12 })
  const sub1 = sp(frame, fps, SCENE_2_START + PHASE_SUBS + 10, { damping: 12 })
  const sub2 = sp(frame, fps, SCENE_2_START + PHASE_SUBS + 20, { damping: 12 })
  const subScales = [sub0, sub1, sub2]

  // Selection highlight
  const selectProgress = interpolate(local, [PHASE_SELECT, PHASE_SELECT + 15], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  // WA send
  const sendProgress = interpolate(local, [PHASE_SEND, PHASE_SEND + 30], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  const waScale = sp(frame, fps, SCENE_2_START + PHASE_SEND, { damping: 10 })
  const waFlyX = interpolate(sendProgress, [0.7, 1], [0, 800], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  // Phase text
  let phaseTitle = 'A lead comes in'
  let phaseSub = "A job you can't take — but someone in your network can."
  if (local >= PHASE_SUBS - 10) {
    phaseTitle = 'Pick your sub'
    phaseSub = 'Choose from your trusted network.'
  }
  if (local >= PHASE_SELECT - 10) {
    phaseTitle = 'Pick your sub'
    phaseSub = 'Mike Johnson — perfect match.'
  }
  if (local >= PHASE_SEND - 10) {
    phaseTitle = 'Send with one tap'
    phaseSub = 'WhatsApp message with all the details.'
  }

  const titleIn = sp(frame, fps, SCENE_2_START + 5)

  const floatY = Math.sin(frame * 0.035) * 3

  return (
    <AbsoluteFill
      style={{
        background: COLORS.cream,
        fontFamily: FONT.family,
        opacity: vis,
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
      }}
    >
      {/* Dot grid */}
      <AbsoluteFill
        style={{
          opacity: 0.03,
          backgroundImage: `radial-gradient(circle at 1px 1px, ${COLORS.whatsapp} 1px, transparent 0)`,
          backgroundSize: '50px 50px',
          pointerEvents: 'none',
        }}
      />

      {/* Left — GC Phone (60%) */}
      <div
        style={{
          flex: 6,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
        }}
      >
        {/* Orange glow */}
        <div
          style={{
            position: 'absolute',
            top: '35%',
            left: '45%',
            width: 500,
            height: 500,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(254,91,37,0.06) 0%, transparent 70%)',
            transform: 'translate(-50%, -50%)',
            filter: 'blur(80px)',
            pointerEvents: 'none',
          }}
        />

        <PhoneMockup width={300} y={floatY}>
          <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {/* Lead card */}
            <div style={{ opacity: leadIn, transform: `translateY(${interpolate(leadIn, [0, 1], [20, 0])}px)` }}>
              <LeadCardAd
                profession="Roofing"
                icon="🏠"
                color="#dc2626"
                summary="Hurricane damage on tile roof, multiple leaks in master bedroom and garage."
                location="Homestead, FL 33033"
                urgency="Hot"
                time="8m ago"
                group="Miami Dade Roofers"
              />
            </div>

            {/* Sub selection list */}
            {local >= PHASE_SUBS - 5 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
                {SUBS.map((sub, i) => (
                  <SubCardAd
                    key={sub.initials}
                    {...sub}
                    selected={i === 0 && selectProgress > 0.5}
                    opacity={subScales[i]}
                    scale={subScales[i]}
                    y={interpolate(subScales[i], [0, 1], [12, 0])}
                  />
                ))}
              </div>
            )}

            {/* WA message composing */}
            {local >= PHASE_SEND - 5 && (
              <div
                style={{
                  transform: `translateX(${waFlyX}px)`,
                  marginTop: 6,
                }}
              >
                <WhatsAppMessageAd opacity={waScale} scale={waScale} width={260} />
              </div>
            )}
          </div>
        </PhoneMockup>
      </div>

      {/* Right — blurred hint (40%) */}
      <div
        style={{
          flex: 4,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          filter: 'blur(12px)',
          opacity: 0.2,
        }}
      >
        <PhoneMockup width={180}>
          <div
            style={{
              background: COLORS.waDark,
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#8696a0',
              fontSize: 10,
            }}
          >
            Waiting...
          </div>
        </PhoneMockup>
      </div>

      {/* Phase title overlay */}
      <div
        style={{
          position: 'absolute',
          top: 50,
          left: 0,
          right: 0,
          textAlign: 'center',
          opacity: titleIn,
        }}
      >
        <h2
          style={{
            fontSize: 40,
            margin: 0,
            color: COLORS.dark,
            ...FONT.heading,
          }}
        >
          {phaseTitle}
        </h2>
        <p style={{ fontSize: 16, color: COLORS.graySubtle, opacity: 0.6, marginTop: 8 }}>
          {phaseSub}
        </p>
      </div>
    </AbsoluteFill>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/landing/src/remotion/explainer/Scene2GCSide.tsx
git commit -m "feat(video): add Scene 2 — GC side lead flow"
```

---

## Task 5: Scene 3 — "Sub Side"

**Files:**
- Create: `apps/landing/src/remotion/explainer/Scene3SubSide.tsx`

- [ ] **Step 1: Create Scene3SubSide**

```tsx
// apps/landing/src/remotion/explainer/Scene3SubSide.tsx
import { useMemo } from 'react'
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from 'remotion'
import { COLORS, FONT, sp, SCENE_3_START, SCENE_4_START } from './shared/theme'
import { PhoneMockup } from './shared/PhoneMockup'
import { WhatsAppMessageAd } from './shared/WhatsAppMessageAd'

export function Scene3SubSide() {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const local = frame - SCENE_3_START

  // Scene visibility
  const sceneIn = interpolate(frame, [SCENE_3_START, SCENE_3_START + 30], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  const sceneOut = interpolate(frame, [SCENE_4_START - 30, SCENE_4_START], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  const vis = sceneIn * sceneOut

  // Phase timing
  const PHASE_NOTIFY = 0
  const PHASE_OPEN = 80
  const PHASE_DETAIL = 160
  const PHASE_ACCEPT = 260

  // Notification
  const notifyIn = sp(frame, fps, SCENE_3_START + PHASE_NOTIFY + 15, { damping: 14 })

  // Message open
  const msgIn = sp(frame, fps, SCENE_3_START + PHASE_OPEN, { damping: 10 })

  // Detail card
  const detailIn = sp(frame, fps, SCENE_3_START + PHASE_DETAIL, { damping: 10 })

  // Accept
  const acceptProgress = interpolate(local, [PHASE_ACCEPT, PHASE_ACCEPT + 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  const acceptScale = sp(frame, fps, SCENE_3_START + PHASE_ACCEPT + 5, { damping: 8, stiffness: 200 })

  // Confetti
  const confetti = useMemo(
    () =>
      Array.from({ length: 24 }, () => ({
        x: Math.random() * 300 - 150,
        y: Math.random() * -200 - 50,
        size: Math.random() * 6 + 3,
        color: Math.random() > 0.5 ? COLORS.primary : COLORS.whatsapp,
        rotation: Math.random() * 360,
        speed: Math.random() * 2 + 1,
      })),
    []
  )
  const confettiVis = interpolate(local, [PHASE_ACCEPT + 10, PHASE_ACCEPT + 60], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  // Phase text
  let phaseTitle = 'Job lands on your phone'
  let phaseSub = 'A WhatsApp notification with all the details.'
  if (local >= PHASE_OPEN - 10) {
    phaseTitle = 'See the deal'
    phaseSub = 'Clear terms — profession, location, your cut.'
  }
  if (local >= PHASE_ACCEPT - 10) {
    phaseTitle = 'Accept instantly'
    phaseSub = 'One tap — you're on the job.'
  }

  const titleIn = sp(frame, fps, SCENE_3_START + 5)
  const floatY = Math.sin(frame * 0.035) * 3

  return (
    <AbsoluteFill
      style={{
        background: COLORS.cream,
        fontFamily: FONT.family,
        opacity: vis,
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
      }}
    >
      {/* Dot grid */}
      <AbsoluteFill
        style={{
          opacity: 0.03,
          backgroundImage: `radial-gradient(circle at 1px 1px, ${COLORS.whatsapp} 1px, transparent 0)`,
          backgroundSize: '50px 50px',
          pointerEvents: 'none',
        }}
      />

      {/* Left — blurred GC hint (40%) */}
      <div
        style={{
          flex: 4,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          filter: 'blur(12px)',
          opacity: 0.2,
        }}
      >
        <PhoneMockup width={180}>
          <div style={{ background: '#fff', height: '100%', padding: 10, opacity: 0.5 }}>
            <div
              style={{
                width: '80%',
                height: 12,
                background: COLORS.cardBorder,
                borderRadius: 6,
                marginBottom: 8,
              }}
            />
            <div
              style={{
                width: '60%',
                height: 12,
                background: COLORS.cardBorder,
                borderRadius: 6,
              }}
            />
          </div>
        </PhoneMockup>
      </div>

      {/* Right — Sub Phone (60%) */}
      <div
        style={{
          flex: 6,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
        }}
      >
        {/* Green glow */}
        <div
          style={{
            position: 'absolute',
            top: '35%',
            left: '55%',
            width: 500,
            height: 500,
            borderRadius: '50%',
            background: `radial-gradient(circle, rgba(37,211,102,0.08) 0%, transparent 70%)`,
            transform: 'translate(-50%, -50%)',
            filter: 'blur(80px)',
            pointerEvents: 'none',
          }}
        />

        <PhoneMockup width={300} y={floatY}>
          <div style={{ background: COLORS.waDark, height: '100%', position: 'relative' }}>
            {/* WA Header */}
            <div
              style={{
                background: '#1f2c34',
                padding: '10px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 15,
                  background: `${COLORS.whatsapp}20`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: COLORS.whatsapp,
                  fontSize: 14,
                  fontWeight: 700,
                }}
              >
                M
              </div>
              <div>
                <div style={{ color: '#e9edef', fontSize: 11, fontWeight: 600 }}>MasterLeadFlow</div>
                <div style={{ color: '#8696a0', fontSize: 8 }}>online</div>
              </div>
            </div>

            {/* Push notification bar */}
            {local >= PHASE_NOTIFY && local < PHASE_OPEN + 30 && (
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 8,
                  right: 8,
                  background: 'rgba(255,255,255,0.95)',
                  borderRadius: 12,
                  padding: '8px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                  opacity: notifyIn * (local < PHASE_OPEN ? 1 : interpolate(local, [PHASE_OPEN, PHASE_OPEN + 30], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })),
                  transform: `translateY(${interpolate(notifyIn, [0, 1], [-40, 4])}px)`,
                  zIndex: 10,
                }}
              >
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 7,
                    background: COLORS.whatsapp,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    fontSize: 14,
                  }}
                >
                  💬
                </div>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: COLORS.dark }}>MasterLeadFlow</div>
                  <div style={{ fontSize: 8, color: COLORS.graySubtle }}>🔔 New job in your area!</div>
                </div>
              </div>
            )}

            {/* WA message */}
            <div style={{ padding: 10 }}>
              {local >= PHASE_OPEN && (
                <div
                  style={{
                    opacity: msgIn,
                    transform: `translateY(${interpolate(msgIn, [0, 1], [15, 0])}px)`,
                  }}
                >
                  <WhatsAppMessageAd width={250} />
                </div>
              )}
            </div>

            {/* Job detail card overlay */}
            {local >= PHASE_DETAIL && (
              <div
                style={{
                  position: 'absolute',
                  bottom: 80,
                  left: 10,
                  right: 10,
                  background: '#fff',
                  borderRadius: 16,
                  padding: 16,
                  boxShadow: '0 -8px 40px rgba(0,0,0,0.2)',
                  opacity: detailIn,
                  transform: `translateY(${interpolate(detailIn, [0, 1], [40, 0])}px)`,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      background: '#dc262615',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 16,
                    }}
                  >
                    🏠
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.dark }}>Roofing — Hurricane Damage</div>
                    <div style={{ fontSize: 9, color: COLORS.graySubtle, opacity: 0.6 }}>📍 Homestead, FL 33033</div>
                  </div>
                </div>
                {/* Deal terms */}
                <div
                  style={{
                    display: 'flex',
                    gap: 12,
                    padding: '10px 0',
                    borderTop: `1px solid ${COLORS.cardBorder}`,
                    borderBottom: `1px solid ${COLORS.cardBorder}`,
                    marginBottom: 12,
                  }}
                >
                  <div style={{ textAlign: 'center', flex: 1 }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: COLORS.success }}>20%</div>
                    <div style={{ fontSize: 8, color: COLORS.graySubtle, opacity: 0.5 }}>Your cut</div>
                  </div>
                  <div style={{ width: 1, background: COLORS.cardBorder }} />
                  <div style={{ textAlign: 'center', flex: 1 }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: COLORS.primary }}>~$480</div>
                    <div style={{ fontSize: 8, color: COLORS.graySubtle, opacity: 0.5 }}>Estimated</div>
                  </div>
                </div>
                {/* Accept button */}
                <div
                  style={{
                    background:
                      acceptProgress > 0.5
                        ? COLORS.success
                        : COLORS.dark,
                    borderRadius: 50,
                    padding: '10px 0',
                    textAlign: 'center',
                    color: '#fff',
                    fontSize: 13,
                    fontWeight: 700,
                    transform: acceptProgress > 0.5 ? `scale(${acceptScale * 0.1 + 0.95})` : 'scale(1)',
                    transition: 'background 0.2s',
                  }}
                >
                  {acceptProgress > 0.5 ? '✅ Accepted!' : 'Accept Job →'}
                </div>
              </div>
            )}
          </div>
        </PhoneMockup>

        {/* Confetti */}
        {confettiVis > 0 &&
          confetti.map((c, i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                width: c.size,
                height: c.size,
                borderRadius: c.size > 5 ? 2 : '50%',
                background: c.color,
                opacity: Math.max(0, 1 - confettiVis) * 0.8,
                transform: `translate(${c.x * confettiVis}px, ${c.y * confettiVis * c.speed}px) rotate(${c.rotation + confettiVis * 360}deg)`,
                pointerEvents: 'none',
              }}
            />
          ))}
      </div>

      {/* Phase title */}
      <div
        style={{
          position: 'absolute',
          top: 50,
          left: 0,
          right: 0,
          textAlign: 'center',
          opacity: titleIn,
        }}
      >
        <h2 style={{ fontSize: 40, margin: 0, color: COLORS.dark, ...FONT.heading }}>
          {phaseTitle}
        </h2>
        <p style={{ fontSize: 16, color: COLORS.graySubtle, opacity: 0.6, marginTop: 8 }}>
          {phaseSub}
        </p>
      </div>
    </AbsoluteFill>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/landing/src/remotion/explainer/Scene3SubSide.tsx
git commit -m "feat(video): add Scene 3 — Sub side receive and accept flow"
```

---

## Task 6: Scene 4 — "Merge — Everyone Wins"

**Files:**
- Create: `apps/landing/src/remotion/explainer/Scene4Merge.tsx`

- [ ] **Step 1: Create Scene4Merge**

```tsx
// apps/landing/src/remotion/explainer/Scene4Merge.tsx
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from 'remotion'
import { COLORS, FONT, sp, SCENE_4_START, SCENE_5_START } from './shared/theme'
import { KpiCardAd } from './shared/KpiCardAd'

const KPIS = [
  { label: 'Active Jobs', value: 24, color: COLORS.blue },
  { label: 'Completed', value: 142, color: COLORS.success },
  { label: 'Revenue', value: 48, prefix: '$', suffix: 'K', color: COLORS.primary },
  { label: 'Success Rate', value: 87, suffix: '%', color: COLORS.purple },
]

const TABLE_ROWS = [
  { job: '🏠 Roofing', loc: 'Homestead, FL', sub: 'Mike J.', deal: '20%', status: 'Accepted', statusBg: '#dbeafe', statusColor: '#1d4ed8', earned: '$480' },
  { job: '🔧 Plumbing', loc: 'Miami, FL', sub: 'Carlos R.', deal: '15%', status: 'Done', statusBg: '#dcfce7', statusColor: '#15803d', earned: '$320' },
  { job: '⚡ Electrical', loc: 'Boca Raton, FL', sub: 'Sarah C.', deal: '$500', status: 'Active', statusBg: '#fef3c7', statusColor: '#b45309', earned: '$500' },
]

export function Scene4Merge() {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const local = frame - SCENE_4_START

  // Scene visibility
  const sceneIn = interpolate(frame, [SCENE_4_START, SCENE_4_START + 30], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  const sceneOut = interpolate(frame, [SCENE_5_START - 30, SCENE_5_START], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  const vis = sceneIn * sceneOut

  // Dashboard enter
  const dashIn = sp(frame, fps, SCENE_4_START + 30, { damping: 12 })

  // Table rows stagger
  const row0 = sp(frame, fps, SCENE_4_START + 120)
  const row1 = sp(frame, fps, SCENE_4_START + 135)
  const row2 = sp(frame, fps, SCENE_4_START + 150)
  const rowAnims = [row0, row1, row2]

  // Avatars
  const avatarIn = sp(frame, fps, SCENE_4_START + 180, { damping: 10 })

  // "Everyone wins" text
  const textIn = sp(frame, fps, SCENE_4_START + 220, { damping: 10 })

  // Arrow pulse
  const arrowPulse = Math.sin(frame * 0.08) * 0.15 + 0.85

  return (
    <AbsoluteFill
      style={{
        background: COLORS.cream,
        fontFamily: FONT.family,
        opacity: vis,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* Dot grid */}
      <AbsoluteFill
        style={{
          opacity: 0.03,
          backgroundImage: `radial-gradient(circle at 1px 1px, ${COLORS.whatsapp} 1px, transparent 0)`,
          backgroundSize: '50px 50px',
          pointerEvents: 'none',
        }}
      />

      {/* "Everyone wins" title */}
      <div
        style={{
          opacity: textIn,
          transform: `translateY(${interpolate(textIn, [0, 1], [15, 0])}px)`,
          marginBottom: 40,
          textAlign: 'center',
        }}
      >
        <h2 style={{ fontSize: 48, margin: 0, color: COLORS.dark, ...FONT.heading }}>
          Everyone wins.
        </h2>
      </div>

      {/* Dashboard container */}
      <div
        style={{
          opacity: dashIn,
          transform: `scale(${interpolate(dashIn, [0, 1], [0.9, 1])}) translateY(${interpolate(dashIn, [0, 1], [30, 0])}px)`,
          width: 900,
        }}
      >
        {/* KPI row */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 20, justifyContent: 'center' }}>
          {KPIS.map((kpi, i) => (
            <KpiCardAd
              key={kpi.label}
              label={kpi.label}
              value={kpi.value}
              prefix={kpi.prefix}
              suffix={kpi.suffix}
              color={kpi.color}
              delay={SCENE_4_START + 50 + i * 12}
            />
          ))}
        </div>

        {/* Table */}
        <div
          style={{
            background: '#fff',
            borderRadius: 16,
            overflow: 'hidden',
            border: `1px solid ${COLORS.cardBorder}`,
            boxShadow: '0 4px 24px rgba(0,0,0,0.04)',
          }}
        >
          {/* Header */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '2fr 1.5fr 1fr 1fr 1fr',
              padding: '12px 20px',
              borderBottom: `1px solid ${COLORS.cardBorder}`,
              fontSize: 10,
              color: COLORS.graySubtle,
              opacity: 0.5,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}
          >
            <span>Job</span>
            <span>Subcontractor</span>
            <span>Deal</span>
            <span>Status</span>
            <span>Earned</span>
          </div>
          {/* Rows */}
          {TABLE_ROWS.map((r, i) => (
            <div
              key={r.job}
              style={{
                display: 'grid',
                gridTemplateColumns: '2fr 1.5fr 1fr 1fr 1fr',
                padding: '14px 20px',
                borderBottom: i < 2 ? `1px solid ${COLORS.cardBorder}` : 'none',
                alignItems: 'center',
                opacity: rowAnims[i],
                transform: `translateX(${interpolate(rowAnims[i], [0, 1], [20, 0])}px)`,
                background: i === 0 ? 'rgba(254,91,37,0.02)' : 'transparent',
              }}
            >
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.dark }}>{r.job}</div>
                <div style={{ fontSize: 9, color: COLORS.graySubtle, opacity: 0.5 }}>{r.loc}</div>
              </div>
              <span style={{ fontSize: 12, color: COLORS.graySubtle }}>{r.sub}</span>
              <span style={{ fontSize: 12, fontFamily: 'monospace', color: COLORS.graySubtle }}>{r.deal}</span>
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  background: r.statusBg,
                  color: r.statusColor,
                  padding: '3px 8px',
                  borderRadius: 6,
                  display: 'inline-block',
                  width: 'fit-content',
                }}
              >
                {r.status}
              </span>
              <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.success }}>{r.earned}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Avatars on sides */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: 80,
          transform: `translateY(-50%) scale(${avatarIn})`,
          opacity: avatarIn,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 28,
            background: '#fff',
            border: `3px solid ${COLORS.primary}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 20,
            fontWeight: 800,
            color: COLORS.primary,
            boxShadow: `0 4px 20px rgba(254,91,37,0.2)`,
          }}
        >
          GC
        </div>
        <span style={{ fontSize: 10, fontWeight: 600, color: COLORS.graySubtle }}>General Contractor</span>
      </div>

      {/* Arrow left */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: 160,
          transform: 'translateY(-50%)',
          opacity: avatarIn * arrowPulse,
        }}
      >
        <svg width={60} height={24} viewBox="0 0 60 24">
          <line x1={0} y1={12} x2={48} y2={12} stroke={COLORS.success} strokeWidth={2} strokeDasharray="6 4" />
          <polygon points="48,6 60,12 48,18" fill={COLORS.success} />
        </svg>
      </div>

      {/* Arrow right */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          right: 160,
          transform: 'translateY(-50%) scaleX(-1)',
          opacity: avatarIn * arrowPulse,
        }}
      >
        <svg width={60} height={24} viewBox="0 0 60 24">
          <line x1={0} y1={12} x2={48} y2={12} stroke={COLORS.success} strokeWidth={2} strokeDasharray="6 4" />
          <polygon points="48,6 60,12 48,18" fill={COLORS.success} />
        </svg>
      </div>

      {/* Sub avatar */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          right: 80,
          transform: `translateY(-50%) scale(${avatarIn})`,
          opacity: avatarIn,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 28,
            background: '#fff',
            border: `3px solid ${COLORS.whatsapp}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 20,
            fontWeight: 800,
            color: COLORS.whatsapp,
            boxShadow: `0 4px 20px rgba(37,211,102,0.2)`,
          }}
        >
          SC
        </div>
        <span style={{ fontSize: 10, fontWeight: 600, color: COLORS.graySubtle }}>Subcontractor</span>
      </div>
    </AbsoluteFill>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/landing/src/remotion/explainer/Scene4Merge.tsx
git commit -m "feat(video): add Scene 4 — merge dashboard with KPIs and table"
```

---

## Task 7: Scene 5 — CTA

**Files:**
- Create: `apps/landing/src/remotion/explainer/Scene5CTA.tsx`

- [ ] **Step 1: Create Scene5CTA**

```tsx
// apps/landing/src/remotion/explainer/Scene5CTA.tsx
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from 'remotion'
import { COLORS, FONT, sp, SCENE_5_START, TOTAL_FRAMES } from './shared/theme'
import { LogoAd } from './shared/LogoAd'

export function Scene5CTA() {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const sceneIn = interpolate(frame, [SCENE_5_START, SCENE_5_START + 30], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  const logoIn = sp(frame, fps, SCENE_5_START + 20, { damping: 12 })
  const taglineIn = sp(frame, fps, SCENE_5_START + 50, { damping: 10 })
  const ctaIn = sp(frame, fps, SCENE_5_START + 80, { damping: 10 })
  const urlIn = sp(frame, fps, SCENE_5_START + 100, { damping: 12 })

  // CTA pulse
  const pulse = Math.sin(frame * 0.06) * 0.03 + 1

  return (
    <AbsoluteFill
      style={{
        background: COLORS.cream,
        fontFamily: FONT.family,
        opacity: sceneIn,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 32,
      }}
    >
      {/* Dot grid */}
      <AbsoluteFill
        style={{
          opacity: 0.03,
          backgroundImage: `radial-gradient(circle at 1px 1px, ${COLORS.whatsapp} 1px, transparent 0)`,
          backgroundSize: '50px 50px',
          pointerEvents: 'none',
        }}
      />

      {/* Green glow */}
      <div
        style={{
          position: 'absolute',
          top: '40%',
          left: '50%',
          width: 600,
          height: 600,
          borderRadius: '50%',
          background: `radial-gradient(circle, rgba(37,211,102,0.08) 0%, transparent 70%)`,
          transform: 'translate(-50%, -50%)',
          filter: 'blur(100px)',
          pointerEvents: 'none',
        }}
      />

      {/* Logo */}
      <div
        style={{
          opacity: logoIn,
          transform: `scale(${interpolate(logoIn, [0, 1], [0.8, 1.2])})`,
        }}
      >
        <LogoAd scale={1} />
      </div>

      {/* Tagline */}
      <div
        style={{
          opacity: taglineIn,
          transform: `translateY(${interpolate(taglineIn, [0, 1], [20, 0])}px)`,
          textAlign: 'center',
        }}
      >
        <h1
          style={{
            fontSize: 56,
            margin: 0,
            color: COLORS.dark,
            fontWeight: 700,
            letterSpacing: '-0.04em',
            lineHeight: 1.1,
          }}
        >
          Get jobs. Send jobs.{' '}
          <span style={{ color: COLORS.success }}>Get paid.</span>
        </h1>
      </div>

      {/* CTA Button */}
      <div
        style={{
          opacity: ctaIn,
          transform: `scale(${interpolate(ctaIn, [0, 1], [0.8, 1]) * pulse})`,
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 10,
            background: COLORS.whatsapp,
            color: '#fff',
            borderRadius: 50,
            padding: '18px 40px',
            fontSize: 20,
            fontWeight: 700,
            boxShadow: `0 8px 30px rgba(37,211,102,0.3)`,
          }}
        >
          <svg viewBox="0 0 24 24" fill="currentColor" width={22} height={22}>
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
          </svg>
          Start Free →
        </div>
      </div>

      {/* URL */}
      <div
        style={{
          opacity: urlIn,
          transform: `translateY(${interpolate(urlIn, [0, 1], [10, 0])}px)`,
        }}
      >
        <span
          style={{
            fontSize: 18,
            color: COLORS.graySubtle,
            opacity: 0.5,
            fontWeight: 500,
            letterSpacing: '0.02em',
          }}
        >
          masterleadflow.com
        </span>
      </div>
    </AbsoluteFill>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/landing/src/remotion/explainer/Scene5CTA.tsx
git commit -m "feat(video): add Scene 5 — CTA with tagline and Start Free button"
```

---

## Task 8: Main Composition & Preview Page

**Files:**
- Create: `apps/landing/src/remotion/ExplainerAd.tsx`
- Modify: `apps/landing/src/App.tsx` (or routing file) — add preview route

- [ ] **Step 1: Create ExplainerAd main composition**

```tsx
// apps/landing/src/remotion/ExplainerAd.tsx
import { AbsoluteFill, Sequence } from 'remotion'
import {
  FPS,
  SCENE_1_START,
  SCENE_2_START,
  SCENE_3_START,
  SCENE_4_START,
  SCENE_5_START,
  TOTAL_FRAMES,
  WIDTH,
  HEIGHT,
} from './explainer/shared/theme'
import { Scene1Hook } from './explainer/Scene1Hook'
import { Scene2GCSide } from './explainer/Scene2GCSide'
import { Scene3SubSide } from './explainer/Scene3SubSide'
import { Scene4Merge } from './explainer/Scene4Merge'
import { Scene5CTA } from './explainer/Scene5CTA'

export const ExplainerAd: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: '#faf9f6' }}>
      <Sequence from={SCENE_1_START} durationInFrames={SCENE_2_START + 30}>
        <Scene1Hook />
      </Sequence>
      <Sequence from={SCENE_2_START} durationInFrames={SCENE_3_START - SCENE_2_START + 30}>
        <Scene2GCSide />
      </Sequence>
      <Sequence from={SCENE_3_START} durationInFrames={SCENE_4_START - SCENE_3_START + 30}>
        <Scene3SubSide />
      </Sequence>
      <Sequence from={SCENE_4_START} durationInFrames={SCENE_5_START - SCENE_4_START + 30}>
        <Scene4Merge />
      </Sequence>
      <Sequence from={SCENE_5_START} durationInFrames={TOTAL_FRAMES - SCENE_5_START}>
        <Scene5CTA />
      </Sequence>
    </AbsoluteFill>
  )
}

export const EXPLAINER_DURATION = TOTAL_FRAMES
export const EXPLAINER_FPS = FPS
export const EXPLAINER_WIDTH = WIDTH
export const EXPLAINER_HEIGHT = HEIGHT
```

- [ ] **Step 2: Add a preview page**

Find the app's routing file and add a `/preview-ad` route that embeds the `<Player>` component:

```tsx
// Add to the appropriate page or create apps/landing/src/pages/PreviewAd.tsx
import { Player } from '@remotion/player'
import {
  ExplainerAd,
  EXPLAINER_DURATION,
  EXPLAINER_FPS,
  EXPLAINER_WIDTH,
  EXPLAINER_HEIGHT,
} from '../remotion/ExplainerAd'

export default function PreviewAd() {
  return (
    <div
      style={{
        background: '#111',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 40,
      }}
    >
      <div style={{ width: '100%', maxWidth: 1200 }}>
        <Player
          component={ExplainerAd}
          durationInFrames={EXPLAINER_DURATION}
          fps={EXPLAINER_FPS}
          compositionWidth={EXPLAINER_WIDTH}
          compositionHeight={EXPLAINER_HEIGHT}
          controls
          style={{ width: '100%', borderRadius: 12, overflow: 'hidden' }}
          autoPlay
        />
      </div>
    </div>
  )
}
```

Check the existing routing pattern (likely in `App.tsx` or a router file) and add the route. Follow the same pattern used for `SecureJobs` page.

- [ ] **Step 3: Commit**

```bash
git add apps/landing/src/remotion/ExplainerAd.tsx apps/landing/src/pages/PreviewAd.tsx
git commit -m "feat(video): add main ExplainerAd composition and preview page"
```

- [ ] **Step 4: Run the dev server, navigate to `/preview-ad`, and verify the video plays**

Run: `cd apps/landing && npm run dev`

Check: Open `http://localhost:5173/preview-ad` (or whatever port), verify all 5 scenes render and transition correctly.

- [ ] **Step 5: Fix any issues found during preview, then commit**

```bash
git add -A
git commit -m "fix(video): address preview issues in explainer ad"
```

---

## Task 9: Wire Route into App Router

**Files:**
- Modify: App routing file (check existing pattern)

- [ ] **Step 1: Find the router and add the preview-ad route**

Check `apps/landing/src/App.tsx` or `apps/landing/src/main.tsx` for routing. Add a route for `/preview-ad` pointing to `PreviewAd` component, following the same pattern as existing routes like `/secure-jobs`.

- [ ] **Step 2: Verify navigation works**

Navigate to `/preview-ad` in browser and confirm the Player renders with controls.

- [ ] **Step 3: Commit**

```bash
git add apps/landing/src/App.tsx
git commit -m "feat(video): wire preview-ad route into app router"
```
