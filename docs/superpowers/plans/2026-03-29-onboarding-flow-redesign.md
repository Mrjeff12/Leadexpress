# Onboarding Flow Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the contractor onboarding flow: credentials first → PWA install with CSS animation → push notifications. Track abandonment and auto-nudge via WhatsApp.

**Architecture:** Three-step wizard flow (credentials → install → notifications) with shared progress bar component. CSS-only looping animation replaces static install mockups. New `onboarding_step` column on `contractors` table tracks progress for Rebeca nudges.

**Tech Stack:** React + Tailwind CSS (existing), Supabase (Postgres + Edge Functions), Rebeca WhatsApp service (node-cron + Twilio)

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `apps/dashboard/src/components/OnboardingProgress.tsx` | Create | Shared progress bar (Step X of 3) |
| `apps/dashboard/src/components/InstallAnimation.tsx` | Create | CSS-only looping animation (iOS + Android) |
| `apps/dashboard/src/components/EnableAlertsScreen.tsx` | Create | Full-screen push notification permission step |
| `apps/dashboard/src/components/PushBanner.tsx` | Create | Dashboard fallback banner for push |
| `apps/dashboard/src/pages/CompleteAccount.tsx` | Modify | Remove install step, credentials-only, update onboarding_step |
| `apps/dashboard/src/pages/Install.tsx` | Modify | Replace static mockups with InstallAnimation, add progress bar |
| `apps/dashboard/src/pages/AutoLogin.tsx` | Modify | Set onboarding_step = 'registered' after session |
| `apps/dashboard/src/pages/ContractorDashboard.tsx` | Modify | Add PushBanner component |
| `apps/dashboard/src/App.tsx` | Modify | Add /enable-alerts route |
| `supabase/migrations/072_onboarding_step.sql` | Create | Add onboarding_step column to contractors |

---

### Task 1: Database Migration — onboarding_step column

**Files:**
- Create: `supabase/migrations/072_onboarding_step.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Add onboarding tracking to contractors
ALTER TABLE contractors
ADD COLUMN IF NOT EXISTS onboarding_step TEXT DEFAULT 'registered';

-- Index for Rebeca nudge queries
CREATE INDEX IF NOT EXISTS idx_contractors_onboarding_step
ON contractors (onboarding_step)
WHERE onboarding_step IS DISTINCT FROM 'push_enabled';

-- Track when last nudge was sent (avoid spam)
ALTER TABLE contractors
ADD COLUMN IF NOT EXISTS onboarding_nudge_sent_at TIMESTAMPTZ;
```

- [ ] **Step 2: Apply migration to production via Supabase MCP**

Run the SQL above against project `zyytzwlvtuhgbjpalbgd` using the `execute_sql` MCP tool.

- [ ] **Step 3: Verify the column exists**

Run via MCP:
```sql
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'contractors' AND column_name IN ('onboarding_step', 'onboarding_nudge_sent_at');
```

Expected: 2 rows, `onboarding_step` TEXT default `'registered'`, `onboarding_nudge_sent_at` TIMESTAMPTZ.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/072_onboarding_step.sql
git commit -m "feat: add onboarding_step tracking column to contractors"
```

---

### Task 2: OnboardingProgress Component

**Files:**
- Create: `apps/dashboard/src/components/OnboardingProgress.tsx`

- [ ] **Step 1: Create the shared progress bar component**

```tsx
interface OnboardingProgressProps {
  current: 1 | 2 | 3
  labels?: [string, string, string]
}

export default function OnboardingProgress({ current, labels = ['Account', 'Install', 'Alerts'] }: OnboardingProgressProps) {
  const pct = current === 1 ? 17 : current === 2 ? 50 : 83

  return (
    <div className="w-full px-1 mb-6">
      {/* Step label */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-gray-500">Step {current} of 3</span>
        <span className="text-xs font-medium text-[#fe5b25]">{labels[current - 1]}</span>
      </div>
      {/* Bar */}
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #fe5b25, #ff7a50)' }}
        />
      </div>
      {/* Dots */}
      <div className="flex justify-between mt-2">
        {labels.map((label, i) => {
          const step = i + 1
          const done = step < current
          const active = step === current
          return (
            <div key={label} className="flex flex-col items-center gap-1">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
                done ? 'bg-green-500 text-white' :
                active ? 'bg-[#fe5b25] text-white shadow-md shadow-orange-200' :
                'bg-gray-100 text-gray-400'
              }`}>
                {done ? '✓' : step}
              </div>
              <span className={`text-[10px] font-medium ${active ? 'text-gray-900' : 'text-gray-400'}`}>
                {label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/dashboard/src/components/OnboardingProgress.tsx
git commit -m "feat: add OnboardingProgress shared component"
```

---

### Task 3: InstallAnimation Component

**Files:**
- Create: `apps/dashboard/src/components/InstallAnimation.tsx`

- [ ] **Step 1: Create the CSS animation component**

This is the core animated component. It shows a phone mockup with a finger cursor that taps through the 3 install steps in a continuous loop.

```tsx
import { useState, useEffect } from 'react'

type Platform = 'ios' | 'android'

interface InstallAnimationProps {
  platform: Platform
}

// Animation phases: 0=idle, 1=tap-share, 2=share-sheet, 3=tap-add-to-home, 4=confirm-dialog, 5=tap-add, 6=success
const PHASE_DURATIONS = [1000, 2500, 1000, 2500, 1000, 2000, 2000] // ms per phase
const TOTAL_DURATION = PHASE_DURATIONS.reduce((a, b) => a + b, 0) // ~12s

export default function InstallAnimation({ platform }: InstallAnimationProps) {
  const [phase, setPhase] = useState(0)
  const [activeStep, setActiveStep] = useState(0) // 0, 1, 2 for dot indicators

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>
    let currentPhase = 0

    function nextPhase() {
      currentPhase = (currentPhase + 1) % 7
      setPhase(currentPhase)
      setActiveStep(currentPhase < 2 ? 0 : currentPhase < 4 ? 1 : 2)
      timeout = setTimeout(nextPhase, PHASE_DURATIONS[currentPhase])
    }

    timeout = setTimeout(nextPhase, PHASE_DURATIONS[0])
    return () => clearTimeout(timeout)
  }, [])

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Phone frame */}
      <div className="relative w-[220px] h-[400px]">
        {/* Phone bezel */}
        <div className="absolute inset-0 rounded-[2rem] border-[3px] border-gray-800 bg-white overflow-hidden shadow-xl">
          {/* Notch */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[80px] h-[22px] bg-gray-800 rounded-b-2xl z-30" />

          {/* Screen content */}
          <div className="absolute inset-[3px] top-[22px] bottom-[3px] overflow-hidden bg-white rounded-b-[1.7rem]">
            {platform === 'ios' ? (
              <IOSScreenContent phase={phase} />
            ) : (
              <AndroidScreenContent phase={phase} />
            )}
          </div>
        </div>

        {/* Animated finger */}
        <AnimatedFinger phase={phase} platform={platform} />
      </div>

      {/* Step indicator dots */}
      <div className="flex items-center gap-3">
        {['Share', 'Select', 'Confirm'].map((label, i) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full transition-all duration-300 ${
              i === activeStep ? 'bg-[#fe5b25] scale-125' : i < activeStep ? 'bg-green-400' : 'bg-gray-200'
            }`} />
            <span className={`text-[10px] font-medium transition-colors ${
              i === activeStep ? 'text-gray-700' : 'text-gray-400'
            }`}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── iOS Screen Content ── */
function IOSScreenContent({ phase }: { phase: number }) {
  return (
    <div className="h-full flex flex-col">
      {/* App content area */}
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="flex items-center gap-1.5">
          <div className="w-8 h-8 rounded-lg bg-[#fe5b25] flex items-center justify-center">
            <span className="text-[10px] text-white font-bold">M</span>
          </div>
          <span className="text-xs font-semibold text-gray-800">MasterLeadFlow</span>
        </div>
      </div>

      {/* Safari bottom bar */}
      <div className={`bg-[#f2f2f7] border-t border-gray-200 px-4 py-2 flex items-center justify-around transition-opacity ${phase >= 2 && phase <= 5 ? 'opacity-30' : ''}`}>
        <span className="text-gray-400 text-sm">‹</span>
        <span className="text-gray-300 text-sm">›</span>
        {/* Share button */}
        <div className={`relative transition-all ${phase === 1 ? 'scale-110' : ''}`}>
          <svg className={`w-5 h-5 transition-colors ${phase === 1 ? 'text-[#fe5b25]' : 'text-[#007AFF]'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 12v7a2 2 0 002 2h12a2 2 0 002-2v-7" />
            <polyline points="16 6 12 2 8 6" />
            <line x1="12" y1="2" x2="12" y2="15" />
          </svg>
          {phase === 1 && <div className="absolute inset-[-6px] rounded-full border-2 border-[#fe5b25] animate-ping opacity-40" />}
        </div>
        <span className="text-gray-400 text-sm">▢</span>
        <span className="text-gray-400 text-sm">⊞</span>
      </div>

      {/* Share sheet overlay */}
      <div className={`absolute inset-x-0 bottom-0 transition-transform duration-500 ease-out ${
        phase >= 2 && phase <= 5 ? 'translate-y-0' : 'translate-y-full'
      }`}>
        <div className="bg-[#f2f2f7] rounded-t-2xl shadow-2xl" style={{ paddingBottom: 'env(safe-area-inset-bottom, 8px)' }}>
          <div className="w-8 h-1 bg-gray-300 rounded-full mx-auto mt-2 mb-3" />

          {/* Share sheet items */}
          <div className="bg-white mx-2 rounded-xl overflow-hidden mb-2">
            <div className="px-3 py-2 border-b border-gray-100 flex items-center gap-2 opacity-40">
              <span className="text-xs">📋</span>
              <span className="text-[11px] text-gray-900">Copy</span>
            </div>
            {/* Add to Home Screen */}
            <div className={`px-3 py-2 border-b border-gray-100 flex items-center gap-2 transition-all ${
              phase === 3 ? 'bg-[#fe5b25]/10' : ''
            }`}>
              <span className="text-xs">➕</span>
              <span className={`text-[11px] font-medium transition-colors ${phase === 3 ? 'text-[#fe5b25] font-semibold' : 'text-gray-900'}`}>
                Add to Home Screen
              </span>
            </div>
            <div className="px-3 py-2 flex items-center gap-2 opacity-40">
              <span className="text-xs">🔖</span>
              <span className="text-[11px] text-gray-900">Add Bookmark</span>
            </div>
          </div>

          {/* Confirm dialog (appears at phase 4+) */}
          {phase >= 4 && (
            <div className="bg-white mx-2 rounded-xl p-3 mb-2 animate-in">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] text-[#007AFF]">Cancel</span>
                <span className="text-[11px] font-semibold">Add to Home Screen</span>
                <span className={`text-[11px] font-bold transition-colors ${phase === 5 ? 'text-[#fe5b25]' : 'text-[#007AFF]'}`}>Add</span>
              </div>
              <div className="flex items-center gap-2 bg-gray-50 rounded-lg p-2">
                <div className="w-8 h-8 rounded-lg bg-[#fe5b25] flex items-center justify-center">
                  <span className="text-[8px] text-white font-bold">MLF</span>
                </div>
                <div>
                  <p className="text-[10px] font-medium text-gray-900">MasterLeadFlow</p>
                  <p className="text-[8px] text-gray-400">app.masterleadflow.com</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Success overlay */}
      {phase === 6 && (
        <div className="absolute inset-0 bg-white/90 flex flex-col items-center justify-center animate-in z-20">
          <div className="w-14 h-14 rounded-2xl bg-[#fe5b25] flex items-center justify-center mb-3 shadow-lg animate-bounce-once">
            <span className="text-lg text-white font-bold">MLF</span>
          </div>
          <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center -mt-2 mb-2">
            <span className="text-white text-sm font-bold">✓</span>
          </div>
          <p className="text-xs font-semibold text-gray-900">Added to Home Screen!</p>
        </div>
      )}
    </div>
  )
}

/* ── Android Screen Content ── */
function AndroidScreenContent({ phase }: { phase: number }) {
  return (
    <div className="h-full flex flex-col">
      {/* Chrome top bar */}
      <div className="bg-white px-3 py-2 flex items-center gap-2 border-b border-gray-100">
        <div className="flex-1 bg-[#f1f3f4] rounded-full px-2 py-1 flex items-center gap-1">
          <span className="text-[8px]">🔒</span>
          <span className="text-[9px] text-gray-500 flex-1">app.masterleadflow.com</span>
        </div>
        {/* 3-dot menu */}
        <div className={`flex flex-col gap-[2px] px-1 py-1 transition-all ${phase === 1 ? 'scale-125' : ''}`}>
          <div className={`w-[3px] h-[3px] rounded-full ${phase === 1 ? 'bg-[#fe5b25]' : 'bg-gray-600'}`} />
          <div className={`w-[3px] h-[3px] rounded-full ${phase === 1 ? 'bg-[#fe5b25]' : 'bg-gray-600'}`} />
          <div className={`w-[3px] h-[3px] rounded-full ${phase === 1 ? 'bg-[#fe5b25]' : 'bg-gray-600'}`} />
        </div>
      </div>

      {/* App content */}
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="flex items-center gap-1.5">
          <div className="w-8 h-8 rounded-lg bg-[#fe5b25] flex items-center justify-center">
            <span className="text-[10px] text-white font-bold">M</span>
          </div>
          <span className="text-xs font-semibold text-gray-800">MasterLeadFlow</span>
        </div>
      </div>

      {/* Dropdown menu overlay */}
      {phase >= 2 && phase <= 5 && (
        <div className="absolute top-[48px] right-2 z-20 animate-in">
          <div className="bg-white rounded-lg shadow-xl border border-gray-200 w-[160px] overflow-hidden">
            {['New tab', 'Bookmarks', 'History'].map(item => (
              <div key={item} className="px-3 py-1.5 opacity-40">
                <span className="text-[10px] text-gray-700">{item}</span>
              </div>
            ))}
            <div className={`px-3 py-1.5 transition-all ${phase === 3 ? 'bg-[#fe5b25]/10' : ''}`}>
              <span className={`text-[10px] font-medium transition-colors ${phase === 3 ? 'text-[#fe5b25] font-semibold' : 'text-gray-900'}`}>
                Add to Home screen
              </span>
            </div>
            {['Share...', 'Find in page'].map(item => (
              <div key={item} className="px-3 py-1.5 opacity-40">
                <span className="text-[10px] text-gray-700">{item}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Install confirmation dialog */}
      {phase >= 4 && phase <= 5 && (
        <div className="absolute inset-0 bg-black/20 flex items-center justify-center z-30 animate-in">
          <div className="bg-white rounded-2xl shadow-xl w-[180px] p-4">
            <p className="text-[11px] font-semibold text-center mb-2">Add to Home screen</p>
            <div className="flex items-center gap-2 bg-gray-50 rounded-lg p-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-[#fe5b25] flex items-center justify-center">
                <span className="text-[8px] text-white font-bold">MLF</span>
              </div>
              <div>
                <p className="text-[9px] font-medium">MasterLeadFlow</p>
                <p className="text-[7px] text-gray-400">masterleadflow.com</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button className="flex-1 py-1.5 text-[9px] text-gray-500 bg-gray-100 rounded-lg">Cancel</button>
              <button className={`flex-1 py-1.5 text-[9px] font-bold text-white rounded-lg transition-colors ${
                phase === 5 ? 'bg-[#fe5b25]' : 'bg-[#1a73e8]'
              }`}>Add</button>
            </div>
          </div>
        </div>
      )}

      {/* Success */}
      {phase === 6 && (
        <div className="absolute inset-0 bg-white/90 flex flex-col items-center justify-center animate-in z-20">
          <div className="w-14 h-14 rounded-2xl bg-[#fe5b25] flex items-center justify-center mb-3 shadow-lg animate-bounce-once">
            <span className="text-lg text-white font-bold">MLF</span>
          </div>
          <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center -mt-2 mb-2">
            <span className="text-white text-sm font-bold">✓</span>
          </div>
          <p className="text-xs font-semibold text-gray-900">Added to Home Screen!</p>
        </div>
      )}
    </div>
  )
}

/* ── Animated Finger Cursor ── */
function AnimatedFinger({ phase, platform }: { phase: number; platform: Platform }) {
  // Finger positions relative to phone frame (percentage-based)
  const positions: Record<Platform, Record<number, { x: number; y: number; visible: boolean; tapping: boolean }>> = {
    ios: {
      0: { x: 110, y: 100, visible: false, tapping: false },
      1: { x: 50, y: 90, visible: true, tapping: true },   // Share button
      2: { x: 80, y: 100, visible: false, tapping: false },
      3: { x: 55, y: 72, visible: true, tapping: true },   // Add to Home Screen
      4: { x: 80, y: 100, visible: false, tapping: false },
      5: { x: 78, y: 62, visible: true, tapping: true },   // Add button
      6: { x: 110, y: 100, visible: false, tapping: false },
    },
    android: {
      0: { x: 110, y: 100, visible: false, tapping: false },
      1: { x: 88, y: 12, visible: true, tapping: true },   // 3-dot menu
      2: { x: 110, y: 100, visible: false, tapping: false },
      3: { x: 70, y: 30, visible: true, tapping: true },   // Add to Home screen
      4: { x: 110, y: 100, visible: false, tapping: false },
      5: { x: 62, y: 58, visible: true, tapping: true },   // Add button
      6: { x: 110, y: 100, visible: false, tapping: false },
    },
  }

  const pos = positions[platform][phase] || { x: 110, y: 100, visible: false, tapping: false }

  return (
    <div
      className={`absolute transition-all duration-500 ease-in-out z-40 ${pos.visible ? 'opacity-100' : 'opacity-0'}`}
      style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
    >
      {/* Finger circle */}
      <div className={`w-8 h-8 rounded-full bg-gray-800/20 border-2 border-gray-800/30 backdrop-blur-sm transition-transform duration-150 ${
        pos.tapping ? 'animate-tap' : ''
      }`}>
        <div className="w-2 h-2 bg-white/40 rounded-full mt-1.5 ml-1.5" />
      </div>
      {/* Tap ripple */}
      {pos.tapping && (
        <div className="absolute inset-0 rounded-full border-2 border-[#fe5b25]/40 animate-ping" />
      )}
    </div>
  )
}
```

The component also needs these CSS keyframes — they'll be added inline via a `<style>` tag in the Install page (Task 5).

- [ ] **Step 2: Commit**

```bash
git add apps/dashboard/src/components/InstallAnimation.tsx
git commit -m "feat: add CSS-only install animation component (iOS + Android)"
```

---

### Task 4: EnableAlertsScreen Component

**Files:**
- Create: `apps/dashboard/src/components/EnableAlertsScreen.tsx`

- [ ] **Step 1: Create the full-screen notification permission screen**

```tsx
import { Bell, Loader2, CheckCircle } from 'lucide-react'
import { usePushNotifications } from '../hooks/usePushNotifications'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import OnboardingProgress from './OnboardingProgress'

export default function EnableAlertsScreen() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const { status: pushStatus, enable: enablePush, isLoading } = usePushNotifications()

  async function updateStep(step: string) {
    if (!profile?.id) return
    const { data: contractor } = await supabase
      .from('contractors')
      .select('user_id')
      .eq('user_id', profile.id)
      .maybeSingle()
    if (contractor) {
      await supabase.from('contractors').update({ onboarding_step: step }).eq('user_id', profile.id)
    }
  }

  async function handleEnable() {
    await enablePush()
    await updateStep('push_enabled')
    navigate('/')
  }

  async function handleSkip() {
    navigate('/')
  }

  // Auto-skip if unsupported (not in PWA on iOS)
  if (pushStatus === 'unsupported') {
    navigate('/')
    return null
  }

  // Already granted
  if (pushStatus === 'granted') {
    updateStep('push_enabled')
    navigate('/')
    return null
  }

  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* Safe area top padding */}
      <div className="pt-safe" />

      <div className="flex-1 flex flex-col px-6 pt-8 pb-6 max-w-md mx-auto w-full">
        <OnboardingProgress current={3} />

        <div className="flex-1 flex flex-col items-center justify-center text-center">
          {/* Bell icon with pulse */}
          <div className="relative mb-6">
            <div className="w-20 h-20 rounded-full bg-[#fe5b25]/10 flex items-center justify-center">
              <Bell className="w-10 h-10 text-[#fe5b25]" />
            </div>
            <div className="absolute inset-0 rounded-full border-2 border-[#fe5b25]/20 animate-ping" />
          </div>

          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Turn on lead alerts
          </h1>
          <p className="text-gray-500 text-sm mb-3 max-w-[280px]">
            Get notified instantly when a new job matches your area. Don't miss out.
          </p>

          {/* Trial badge */}
          <div className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-amber-50 border border-amber-200 mb-8">
            <span className="text-sm">⚡</span>
            <span className="text-amber-700 text-xs font-semibold">Required for your 7-day free trial</span>
          </div>
        </div>

        {/* Bottom action area */}
        <div className="space-y-3 pb-4">
          <button
            onClick={handleEnable}
            disabled={isLoading}
            className="w-full py-4 rounded-2xl text-base font-semibold text-white flex items-center justify-center gap-2 transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
            style={{ background: '#fe5b25', boxShadow: '0 4px 24px #fe5b2535' }}
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <Bell className="w-5 h-5" />
                Enable Alerts
              </>
            )}
          </button>

          <button
            onClick={handleSkip}
            className="w-full py-3 text-sm text-gray-400 hover:text-gray-600 transition-colors"
          >
            Skip for now
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/dashboard/src/components/EnableAlertsScreen.tsx
git commit -m "feat: add EnableAlertsScreen component for onboarding step 3"
```

---

### Task 5: Redesign Install Page

**Files:**
- Modify: `apps/dashboard/src/pages/Install.tsx`

- [ ] **Step 1: Rewrite Install.tsx to use animation + progress bar**

Replace the entire file. Keep the existing logic for:
- `detectPlatform()`, `isStandalone()`, `isWebView()`
- WebView detection and "Open in Safari/Chrome" flow
- Android native `beforeinstallprompt` handling
- Polling for standalone mode
- Desktop skip

Replace the static mockup sections (IOSStep1/2/3, AndroidStep1/2/3, StepCard) with the `InstallAnimation` component.

Key changes:
1. Import `OnboardingProgress` and `InstallAnimation`
2. Remove all `IOSStep*`, `AndroidStep*`, `StepCard` functions
3. Replace the mobile install guide section with `<InstallAnimation platform={platform} />`
4. Add `OnboardingProgress current={2}` at top
5. Update heading text: "Install the app to get instant lead alerts"
6. Add subtext: "Required to start your 7-day free trial"
7. Update `onboarding_step` to `'installed'` on confirmation
8. Add CSS keyframes for `animate-in`, `animate-tap`, `animate-bounce-once`
9. After install confirmed, navigate to `/enable-alerts` instead of `/complete-account`

The full rewrite should preserve:
- `detectPlatform()` — lines 6-12
- `isStandalone()` — lines 14-17
- `isWebView()` — lines 19-23
- `deferredPrompt` handling — lines 338-352
- Platform detection with `?p=ios` / `?p=android` URL params — lines 302-307

```tsx
// Key structure of the rewritten file:
import OnboardingProgress from '../components/OnboardingProgress'
import InstallAnimation from '../components/InstallAnimation'

export default function Install() {
  // ... keep detectPlatform, isStandalone, isWebView, deferredPrompt logic ...

  async function updateOnboardingStep() {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase.from('contractors').update({ onboarding_step: 'installed' }).eq('user_id', user.id)
    }
  }

  function handleConfirmInstalled() {
    updateOnboardingStep()
    if (isStandalone()) {
      setInstalled(true)
      setTimeout(() => navigate('/enable-alerts'), 1200)
    } else {
      navigate('/enable-alerts')
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <div className="flex-1 flex flex-col px-5 pt-8 pb-6 max-w-md mx-auto w-full">
        <OnboardingProgress current={2} />

        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-4">
          <img src="/icon.png" alt="" className="w-7 h-7 rounded-xl" />
          <span className="text-sm font-semibold text-gray-900">MasterLeadFlow</span>
        </div>

        <div className="text-center mb-4">
          <h1 className="text-xl font-bold text-gray-900 mb-1">
            Install the app
          </h1>
          <p className="text-gray-500 text-sm">
            Get instant lead alerts on your phone
          </p>
          <p className="text-amber-600 text-xs font-medium mt-1">
            ⚡ Required for your 7-day free trial
          </p>
        </div>

        {/* Animation or native install or webview warning */}
        {inWebView ? (
          <WebViewWarning platform={platform} />
        ) : deferredPrompt ? (
          <NativeInstallButton onInstall={handleNativeInstall} />
        ) : platform === 'desktop' ? (
          <DesktopSkip onContinue={() => navigate('/enable-alerts')} />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center">
            <InstallAnimation platform={platform} />
          </div>
        )}

        {/* CTA buttons */}
        {!inWebView && !deferredPrompt && platform !== 'desktop' && (
          <div className="space-y-3 mt-4">
            <button onClick={() => setShowConfirm(true)} className="w-full py-4 rounded-2xl ...">
              Done — I've added it!
            </button>
            <button onClick={() => navigate('/enable-alerts')} className="w-full py-3 text-sm text-gray-400 ...">
              Skip for now
            </button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes animate-in { from { opacity: 0; transform: scale(0.97) translateY(4px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        .animate-in { animation: animate-in 0.25s ease-out; }
        @keyframes tap { 0%,100% { transform: scale(1); } 50% { transform: scale(0.85); } }
        .animate-tap { animation: tap 0.3s ease-in-out; }
        @keyframes bounce-once { 0% { transform: scale(0) translateY(-20px); } 60% { transform: scale(1.1) translateY(0); } 80% { transform: scale(0.95); } 100% { transform: scale(1); } }
        .animate-bounce-once { animation: bounce-once 0.6s ease-out; }
      `}</style>
    </div>
  )
}
```

- [ ] **Step 2: Verify build compiles**

```bash
cd apps/dashboard && npx vite build 2>&1 | tail -5
```

Expected: Build succeeds with no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/src/pages/Install.tsx
git commit -m "feat: redesign Install page with CSS animation and progress bar"
```

---

### Task 6: Modify CompleteAccount — Credentials Only

**Files:**
- Modify: `apps/dashboard/src/pages/CompleteAccount.tsx`

- [ ] **Step 1: Simplify CompleteAccount to credentials-only**

Key changes to the existing file:

1. **Remove** the `'install'` step from the `Step` type — change to `type Step = 'form' | 'done'`
2. **Remove** the `isMobile()` and `isStandalone()` functions — no longer needed
3. **Remove** the install step render block (lines 199-228)
4. **Remove** the notifications step render block (lines 378-425) and `NotifMockupIOS`/`NotifMockupAndroid` components (lines 460-540)
5. **Remove** the `usePushNotifications` import and hook usage
6. **Remove** the `handleEnableNotifications` and `handleSkipNotifications` functions
7. **Add** `OnboardingProgress current={1}` at top of the form
8. **Change** initial step state to always be `'form'`
9. **After** successful submit, update `onboarding_step = 'credentials_set'` then navigate to `/install`
10. **Remove** the `StepPill` component — replaced by `OnboardingProgress`

Changes to `handleSubmit` (after the successful update-account call):

```tsx
// After successful update:
// Update onboarding step
supabase.from('contractors').update({ onboarding_step: 'credentials_set' }).eq('user_id', profile!.id)

setLoading(false)
setStep('done')
setTimeout(() => navigate('/install'), 1500)
```

Add import:
```tsx
import OnboardingProgress from '../components/OnboardingProgress'
```

Remove imports no longer needed: `Bell`, `BellRing`, `Smartphone`, `usePushNotifications`

- [ ] **Step 2: Verify build**

```bash
cd apps/dashboard && npx vite build 2>&1 | tail -5
```

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/src/pages/CompleteAccount.tsx
git commit -m "feat: simplify CompleteAccount to credentials-only step 1/3"
```

---

### Task 7: Modify AutoLogin — Set onboarding_step

**Files:**
- Modify: `apps/dashboard/src/pages/AutoLogin.tsx`

- [ ] **Step 1: Add onboarding_step update after session set**

After the successful `supabase.auth.setSession()` call (line 68), add:

```tsx
// Set onboarding step for tracking
try {
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    await supabase.from('contractors').update({ onboarding_step: 'registered' }).eq('user_id', user.id)
  }
} catch {} // non-critical, don't block login flow
```

This goes between the `setStatus('success')` line and the `safePath` redirect logic.

- [ ] **Step 2: Commit**

```bash
git add apps/dashboard/src/pages/AutoLogin.tsx
git commit -m "feat: set onboarding_step=registered in AutoLogin"
```

---

### Task 8: Add /enable-alerts Route

**Files:**
- Modify: `apps/dashboard/src/App.tsx`

- [ ] **Step 1: Add the route and lazy import**

Add lazy import near the top of App.tsx with the other lazy imports:

```tsx
const EnableAlerts = lazy(() => import('./components/EnableAlertsScreen'))
```

Add route after the `/install` route (line 247):

```tsx
<Route path="/enable-alerts" element={<RequireAuth><EnableAlerts /></RequireAuth>} />
```

- [ ] **Step 2: Commit**

```bash
git add apps/dashboard/src/App.tsx
git commit -m "feat: add /enable-alerts route"
```

---

### Task 9: PushBanner Component + Dashboard Integration

**Files:**
- Create: `apps/dashboard/src/components/PushBanner.tsx`
- Modify: `apps/dashboard/src/pages/ContractorDashboard.tsx`

- [ ] **Step 1: Create PushBanner component**

```tsx
import { useState } from 'react'
import { Bell, X } from 'lucide-react'
import { usePushNotifications } from '../hooks/usePushNotifications'
import { useNavigate } from 'react-router-dom'

export default function PushBanner() {
  const { status } = usePushNotifications()
  const navigate = useNavigate()
  const [dismissed, setDismissed] = useState(() => sessionStorage.getItem('push_banner_dismissed') === '1')

  if (dismissed || status !== 'default') return null

  function handleDismiss() {
    sessionStorage.setItem('push_banner_dismissed', '1')
    setDismissed(true)
  }

  return (
    <div className="mx-4 mt-3 mb-1 flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 shadow-sm">
      <Bell className="w-4 h-4 text-amber-600 flex-shrink-0" />
      <p className="text-xs text-amber-800 font-medium flex-1">
        Enable alerts to start your free trial
      </p>
      <button
        onClick={() => navigate('/enable-alerts')}
        className="px-3 py-1.5 rounded-lg bg-[#fe5b25] text-white text-xs font-semibold hover:brightness-110 transition-all flex-shrink-0"
      >
        Enable
      </button>
      <button onClick={handleDismiss} className="text-amber-400 hover:text-amber-600 transition-colors flex-shrink-0">
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Add PushBanner to ContractorDashboard**

In `ContractorDashboard.tsx`, add import:

```tsx
import PushBanner from '../components/PushBanner'
```

Then add `<PushBanner />` early in the component's return JSX — right after any existing banners (like ImpersonationBanner) and before the main content. Find the main return statement and add it as the first child inside the main wrapper.

- [ ] **Step 3: Verify build**

```bash
cd apps/dashboard && npx vite build 2>&1 | tail -5
```

- [ ] **Step 4: Commit**

```bash
git add apps/dashboard/src/components/PushBanner.tsx apps/dashboard/src/pages/ContractorDashboard.tsx
git commit -m "feat: add push notification fallback banner to dashboard"
```

---

### Task 10: Deploy & Verify

- [ ] **Step 1: Build full dashboard**

```bash
cd /Users/bigjeff/Desktop/Leadexpress && cd apps/dashboard && npx vite build
```

Expected: Build succeeds.

- [ ] **Step 2: Deploy to Vercel**

```bash
cd /Users/bigjeff/Desktop/Leadexpress && npx vercel --prod --yes
```

- [ ] **Step 3: Test the flow manually**

Open `https://app.masterleadflow.com/complete-account` and verify:
1. Progress bar shows "Step 1 of 3"
2. Email + password form works
3. After submit → navigates to `/install`
4. Install page shows animation looping
5. After "Done" → navigates to `/enable-alerts`
6. Enable alerts screen shows with bell icon
7. Dashboard shows push banner if skipped

---

### Task 11: Rebeca Onboarding Nudges (Future — separate PR)

> **Note:** This task involves Rebeca service changes and new WhatsApp templates. It should be implemented in a separate branch/PR after Tasks 1-10 are deployed and tested.

**Files:**
- Create: `services/rebeca/src/outbound/onboarding-nudge.ts`
- Modify: `services/rebeca/src/index.ts` (add cron schedule)

- [ ] **Step 1: Create nudge checker**

```typescript
// services/rebeca/src/outbound/onboarding-nudge.ts
import cron from 'node-cron'
import { supabase } from '../supabase'
import { sendWhatsAppTemplate } from '../twilio'

interface StuckContractor {
  user_id: string
  phone: string
  onboarding_step: string
  full_name: string
  created_at: string
  onboarding_nudge_sent_at: string | null
}

const NUDGE_CONFIG = {
  registered: { waitMinutes: 15, template: 'onboarding_nudge_credentials' },
  credentials_set: { waitMinutes: 10, template: 'onboarding_nudge_install' },
  installed: { waitMinutes: 5, template: 'onboarding_nudge_alerts' },
} as const

export function startOnboardingNudgeCron() {
  // Run every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    try {
      await checkAndNudge()
    } catch (err) {
      console.error('[onboarding-nudge] Error:', err)
    }
  })
  console.log('[onboarding-nudge] Cron started — checking every 5 minutes')
}

async function checkAndNudge() {
  for (const [step, config] of Object.entries(NUDGE_CONFIG)) {
    const cutoff = new Date(Date.now() - config.waitMinutes * 60 * 1000).toISOString()

    // Find contractors stuck at this step
    const { data: stuck } = await supabase
      .from('contractors')
      .select('user_id, onboarding_step, onboarding_nudge_sent_at, profiles!inner(phone, full_name)')
      .eq('onboarding_step', step)
      .lt('updated_at', cutoff)
      .or(`onboarding_nudge_sent_at.is.null,onboarding_nudge_sent_at.lt.${cutoff}`)
      .limit(20)

    if (!stuck?.length) continue

    for (const contractor of stuck) {
      const profile = (contractor as any).profiles
      if (!profile?.phone) continue

      // Generate a fresh magic link for this user
      const { data: magicLink } = await supabase.functions.invoke('magic-login', {
        body: {
          action: 'create',
          phone: profile.phone,
          redirect_path: step === 'registered' ? '/complete-account'
            : step === 'credentials_set' ? '/install'
            : '/enable-alerts',
        },
      })

      if (!magicLink?.url) continue

      // Send WhatsApp template
      await sendWhatsAppTemplate(profile.phone, config.template, {
        name: profile.full_name?.split(' ')[0] || 'there',
        link: magicLink.url,
      })

      // Mark nudge sent
      await supabase
        .from('contractors')
        .update({ onboarding_nudge_sent_at: new Date().toISOString() })
        .eq('user_id', contractor.user_id)

      console.log(`[onboarding-nudge] Sent ${config.template} to ${profile.phone}`)
    }
  }
}
```

- [ ] **Step 2: Register the cron in Rebeca's entry point**

Add to `services/rebeca/src/index.ts`:

```typescript
import { startOnboardingNudgeCron } from './outbound/onboarding-nudge'

// After existing cron registrations:
startOnboardingNudgeCron()
```

- [ ] **Step 3: Create WhatsApp templates in Twilio**

Three templates needed (submit via Twilio console or API):
1. `onboarding_nudge_credentials` — "Hey {{1}}! You're one minute away from getting leads. Tap here to set up your password → {{2}}"
2. `onboarding_nudge_install` — "Almost there {{1}}! Save the app to your home screen to get instant job alerts → {{2}}"
3. `onboarding_nudge_alerts` — "Last step {{1}}! Enable notifications to start your 7-day free trial → {{2}}"

- [ ] **Step 4: Commit**

```bash
git add services/rebeca/src/outbound/onboarding-nudge.ts services/rebeca/src/index.ts
git commit -m "feat: add Rebeca onboarding nudge cron for abandoned signups"
```
