# Subcontractors Teaser (Locked Feature Upsell) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Show Subcontractors/Jobs as locked teaser pages with blur + animated story overlay for Starter/Pro users, driving upgrades to Unlimited.

**Architecture:** A reusable `FeatureTeaser` component wraps mock content behind blur with an animated step-by-step overlay. The sidebar always shows Subcontractors/Jobs (with lock icon for non-Unlimited). Each page checks `canManageSubs` to decide teaser vs real view.

**Tech Stack:** React, Tailwind CSS, CSS keyframes, Lucide icons, existing `useSubscriptionAccess` hook

---

### Task 1: Add Lock Icon Import to Sidebar

**Files:**
- Modify: `apps/dashboard/src/components/Sidebar.tsx:5-15`

**Step 1: Add Lock import**

In `Sidebar.tsx`, add `Lock` to the lucide-react imports:

```tsx
import {
  LayoutDashboard,
  Zap,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Users,
  Briefcase,
  Settings,
  CreditCard,
  Lock,
} from 'lucide-react'
```

**Step 2: Commit**

```bash
git add apps/dashboard/src/components/Sidebar.tsx
git commit -m "chore: add Lock icon import to Sidebar"
```

---

### Task 2: Always Show Subcontractors/Jobs in Sidebar (with Lock)

**Files:**
- Modify: `apps/dashboard/src/components/Sidebar.tsx:18-45`

**Step 1: Update NavItem type to support lock**

Replace the NavItem type (line 18-22) with:

```tsx
type NavItem = {
  label: string
  to: string
  icon: React.ComponentType<{ className?: string }>
  locked?: boolean
}
```

**Step 2: Always include Subcontractors/Jobs, mark as locked when needed**

Replace the `contractorNav` array (lines 37-45) with:

```tsx
const contractorNav: NavItem[] = [
  { label: t('nav.dashboard'), to: '/', icon: LayoutDashboard },
  { label: t('nav.leads'), to: '/leads', icon: Zap },
  { label: locale === 'he' ? 'קבוצות לסריקה' : 'Group Scan', to: '/group-scan', icon: Users },
  { label: t('nav.subcontractors'), to: '/subcontractors', icon: Users, locked: !canManageSubs },
  { label: locale === 'he' ? 'עבודות' : 'Jobs', to: '/jobs', icon: Briefcase, locked: !canManageSubs },
]
```

**Step 3: Render lock icon in nav items**

Replace the NavLink rendering block (lines 89-107) with:

```tsx
{contractorNav.map((item) => (
  <NavLink
    key={item.to}
    to={item.to}
    end={item.to === '/'}
    className={() => {
      const isActive = item.to === '/' ? location.pathname === '/' : location.pathname.startsWith(item.to)
      return [
        'sidebar-link',
        isActive ? 'active' : '',
        collapsed ? 'justify-center px-0' : '',
        item.locked ? 'opacity-70' : '',
      ].join(' ')
    }}
    title={item.label}
  >
    <item.icon className="w-[18px] h-[18px] shrink-0" />
    {!collapsed && (
      <span className="truncate flex items-center gap-1.5">
        {item.label}
        {item.locked && <Lock className="w-3 h-3 text-stone-400" />}
      </span>
    )}
  </NavLink>
))}
```

**Step 4: Verify in browser**

Open localhost:5173 as a Starter/Pro user. Confirm:
- Subcontractors and Jobs appear in sidebar with lock icon
- Clicking them navigates to the page

**Step 5: Commit**

```bash
git add apps/dashboard/src/components/Sidebar.tsx
git commit -m "feat: always show Subcontractors/Jobs in sidebar with lock icon for non-Unlimited"
```

---

### Task 3: Create FeatureTeaser Component

**Files:**
- Create: `apps/dashboard/src/components/FeatureTeaser.tsx`

**Step 1: Create the reusable teaser component**

Create `apps/dashboard/src/components/FeatureTeaser.tsx` with the full component:

```tsx
import { useState, useEffect } from 'react'
import { Lock, ArrowRight, Sparkles, Send, BarChart3, DollarSign, Zap } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useI18n } from '../lib/i18n'

interface TeaserStep {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
  visual: React.ReactNode
}

interface FeatureTeaserProps {
  steps: TeaserStep[]
  featureName: string
  price: number
  planName: string
  children: React.ReactNode // mock content behind blur
}

export default function FeatureTeaser({ steps, featureName, price, planName, children }: FeatureTeaserProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const navigate = useNavigate()
  const { locale } = useI18n()
  const he = locale === 'he'

  // Auto-advance steps in a loop
  useEffect(() => {
    const interval = setInterval(() => {
      setIsTransitioning(true)
      setTimeout(() => {
        setCurrentStep((prev) => (prev + 1) % steps.length)
        setIsTransitioning(false)
      }, 400)
    }, 3500)
    return () => clearInterval(interval)
  }, [steps.length])

  const step = steps[currentStep]
  const StepIcon = step.icon

  return (
    <div className="relative w-full h-full min-h-[calc(100vh-4rem)] overflow-hidden">
      {/* Blurred mock content */}
      <div className="absolute inset-0 pointer-events-none select-none" style={{ filter: 'blur(8px)', opacity: 0.5 }}>
        {children}
      </div>

      {/* Dark overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/50 to-black/60" />

      {/* Centered teaser card */}
      <div className="relative z-10 flex items-center justify-center min-h-[calc(100vh-4rem)] p-6">
        <div className="w-full max-w-lg">
          {/* Lock badge */}
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-xl flex items-center justify-center border border-white/10">
              <Lock className="w-7 h-7 text-white/80" />
            </div>
          </div>

          {/* Feature name */}
          <h1 className="text-center text-2xl font-extrabold text-white mb-2">
            {featureName}
          </h1>
          <p className="text-center text-sm text-white/50 mb-8">
            {he ? `זמין בחבילת ${planName}` : `Available on ${planName} plan`}
          </p>

          {/* Animated story card */}
          <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/10 p-6 mb-6 min-h-[220px] flex flex-col items-center justify-center">
            <div
              className={`transition-all duration-400 flex flex-col items-center text-center ${
                isTransitioning ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'
              }`}
            >
              {/* Step icon */}
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#fe5b25] to-[#e04d1c] flex items-center justify-center mb-4 shadow-lg shadow-orange-500/20">
                <StepIcon className="w-6 h-6 text-white" />
              </div>

              {/* Step title */}
              <h3 className="text-lg font-bold text-white mb-2">
                {step.title}
              </h3>

              {/* Step description */}
              <p className="text-sm text-white/60 max-w-xs">
                {step.description}
              </p>

              {/* Step visual */}
              <div className="mt-4">
                {step.visual}
              </div>
            </div>
          </div>

          {/* Progress dots */}
          <div className="flex justify-center gap-2 mb-8">
            {steps.map((_, i) => (
              <button
                key={i}
                onClick={() => {
                  setIsTransitioning(true)
                  setTimeout(() => {
                    setCurrentStep(i)
                    setIsTransitioning(false)
                  }, 300)
                }}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === currentStep ? 'w-6 bg-[#fe5b25]' : 'w-1.5 bg-white/20 hover:bg-white/40'
                }`}
              />
            ))}
          </div>

          {/* CTA */}
          <button
            onClick={() => navigate('/subscription')}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-[#fe5b25] to-[#e04d1c] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-orange-600/30 hover:shadow-orange-600/50 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <Sparkles className="w-4 h-4" />
            {he
              ? `שדרג ל-${planName} — $${price}/חודש`
              : `Upgrade to ${planName} — $${price}/mo`
            }
          </button>

          {/* Secondary link */}
          <button
            onClick={() => navigate('/subscription')}
            className="w-full mt-3 py-2 text-xs font-medium text-white/40 hover:text-white/70 transition-colors flex items-center justify-center gap-1"
          >
            {he ? 'השוואת חבילות' : 'Compare all plans'}
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add apps/dashboard/src/components/FeatureTeaser.tsx
git commit -m "feat: create reusable FeatureTeaser component with animated story overlay"
```

---

### Task 4: Add Teaser View to Subcontractors Page

**Files:**
- Modify: `apps/dashboard/src/pages/Subcontractors.tsx`

**Step 1: Add imports at top of Subcontractors.tsx**

Add these imports after the existing imports:

```tsx
import { useSubscriptionAccess } from '../hooks/useSubscriptionAccess'
import FeatureTeaser from '../components/FeatureTeaser'
import { Send as SendIcon, BarChart3, DollarSign, Zap as ZapIcon } from 'lucide-react'
```

**Step 2: Add plan check and teaser view**

Inside the `Subcontractors` component function, right after the existing state declarations (after line ~59), add:

```tsx
const { canManageSubs } = useSubscriptionAccess()

// If user doesn't have Unlimited, show teaser
if (!canManageSubs) {
  const teaserSteps = [
    {
      icon: ZapIcon,
      title: 'A Lead Comes In',
      description: "You receive a lead you can't handle yourself — but someone in your network can.",
      visual: (
        <div className="bg-white/10 rounded-xl px-4 py-3 text-left border border-white/10">
          <div className="text-xs text-white/40 mb-1">New Lead</div>
          <div className="text-sm font-semibold text-white">Chimney Repair — Miami, FL</div>
          <div className="text-xs text-white/50 mt-1">1766 Black Bear Circle, 38016</div>
        </div>
      ),
    },
    {
      icon: SendIcon,
      title: 'Forward to Your Sub',
      description: 'Send the lead to a trusted subcontractor via WhatsApp with one click.',
      visual: (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
            <span className="text-lg">💬</span>
          </div>
          <div className="bg-green-500/20 rounded-xl px-3 py-2 text-left border border-green-500/20">
            <div className="text-xs text-green-300">WhatsApp Message Sent</div>
            <div className="text-xs text-white/60 mt-0.5">Hey Mike, got a chimney job in Miami...</div>
          </div>
        </div>
      ),
    },
    {
      icon: BarChart3,
      title: 'Track Every Deal',
      description: 'Monitor job status, sub responses, and deal progress in real-time.',
      visual: (
        <div className="flex gap-2">
          {['Pending', 'Accepted', 'Completed'].map((s, i) => (
            <div key={s} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
              i === 2 ? 'bg-green-500/20 text-green-300' : i === 1 ? 'bg-blue-500/20 text-blue-300' : 'bg-white/10 text-white/50'
            }`}>
              {s}
            </div>
          ))}
        </div>
      ),
    },
    {
      icon: DollarSign,
      title: 'Set Your Terms',
      description: 'Choose percentage splits or fixed prices — you control the deal.',
      visual: (
        <div className="bg-white/10 rounded-xl px-4 py-3 border border-white/10 text-center">
          <div className="text-2xl font-black text-green-400">$200</div>
          <div className="text-xs text-white/50 mt-1">Your earnings on this deal</div>
        </div>
      ),
    },
  ]

  return (
    <FeatureTeaser
      steps={teaserSteps}
      featureName="Manage Your Subcontractors"
      price={399}
      planName="Unlimited"
    >
      {/* Mock content behind blur */}
      <div className="p-6 space-y-6">
        {/* Mock stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Active Subs', value: '4', color: 'bg-blue-50 text-blue-600' },
            { label: 'Jobs This Month', value: '12', color: 'bg-green-50 text-green-600' },
            { label: 'Revenue Shared', value: '$8,400', color: 'bg-orange-50 text-orange-600' },
          ].map((s) => (
            <div key={s.label} className={`rounded-2xl p-4 ${s.color}`}>
              <div className="text-2xl font-bold">{s.value}</div>
              <div className="text-xs opacity-60">{s.label}</div>
            </div>
          ))}
        </div>
        {/* Mock table */}
        <div className="bg-white rounded-2xl shadow-sm border border-stone-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-stone-100 text-stone-400 text-xs">
              <th className="px-4 py-3 text-left">Name</th>
              <th className="px-4 py-3 text-left">Trade</th>
              <th className="px-4 py-3 text-left">Active Jobs</th>
              <th className="px-4 py-3 text-left">Status</th>
            </tr></thead>
            <tbody>
              {[
                { name: 'Mike Johnson', trade: 'Plumbing', jobs: 3, status: 'Active' },
                { name: 'Sarah Chen', trade: 'Electrical', jobs: 2, status: 'Active' },
                { name: 'Carlos Rivera', trade: 'HVAC', jobs: 1, status: 'New' },
                { name: 'Tom Williams', trade: 'Roofing', jobs: 4, status: 'Active' },
              ].map((r) => (
                <tr key={r.name} className="border-b border-stone-50">
                  <td className="px-4 py-3 font-medium text-stone-800">{r.name}</td>
                  <td className="px-4 py-3 text-stone-500">{r.trade}</td>
                  <td className="px-4 py-3 text-stone-500">{r.jobs}</td>
                  <td className="px-4 py-3"><span className="px-2 py-0.5 rounded-full bg-green-50 text-green-600 text-xs">{r.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </FeatureTeaser>
  )
}
```

**Step 3: Verify in browser**

Navigate to `/subcontractors` as a Starter or Pro user. Confirm:
- Mock data visible behind blur
- Animated story cycles through 4 steps
- CTA button navigates to `/subscription`
- Progress dots are clickable

**Step 4: Commit**

```bash
git add apps/dashboard/src/pages/Subcontractors.tsx
git commit -m "feat: add teaser view with animated story to Subcontractors page for non-Unlimited users"
```

---

### Task 5: Add Teaser View to Jobs Page

**Files:**
- Modify: `apps/dashboard/src/pages/JobsDashboard.tsx`

**Step 1: Add imports at top of JobsDashboard.tsx**

Add these imports after the existing imports:

```tsx
import { useSubscriptionAccess } from '../hooks/useSubscriptionAccess'
import FeatureTeaser from '../components/FeatureTeaser'
import { Send as SendIcon, BarChart3, DollarSign as DollarIcon, Zap as ZapIcon } from 'lucide-react'
```

**Step 2: Add plan check and teaser view**

Inside the `JobsDashboard` component function, early in the function body (after hook calls), add the same pattern:

```tsx
const { canManageSubs } = useSubscriptionAccess()

if (!canManageSubs) {
  const teaserSteps = [
    {
      icon: ZapIcon,
      title: 'Forward Leads as Jobs',
      description: 'Turn any lead into a job order and assign it to your subcontractor network.',
      visual: (
        <div className="bg-white/10 rounded-xl px-4 py-3 text-left border border-white/10">
          <div className="text-xs text-white/40 mb-1">New Job Order</div>
          <div className="text-sm font-semibold text-white">Garage Door Install — Osprey, FL</div>
          <div className="text-xs text-white/50 mt-1">Assigned to: Mike Johnson</div>
        </div>
      ),
    },
    {
      icon: BarChart3,
      title: 'Track Job Progress',
      description: 'See every job from assignment to completion with real-time status updates.',
      visual: (
        <div className="flex gap-2">
          {['Pending', 'In Progress', 'Completed'].map((s, i) => (
            <div key={s} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
              i === 2 ? 'bg-green-500/20 text-green-300' : i === 1 ? 'bg-blue-500/20 text-blue-300' : 'bg-white/10 text-white/50'
            }`}>
              {s}
            </div>
          ))}
        </div>
      ),
    },
    {
      icon: DollarIcon,
      title: 'Financial Tracking',
      description: 'Monitor payments, revenue splits, and overdue invoices all in one place.',
      visual: (
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-white/10 rounded-lg px-3 py-2 border border-white/10">
            <div className="text-lg font-bold text-green-400">$12.4k</div>
            <div className="text-[10px] text-white/50">Total Revenue</div>
          </div>
          <div className="bg-white/10 rounded-lg px-3 py-2 border border-white/10">
            <div className="text-lg font-bold text-blue-400">8</div>
            <div className="text-[10px] text-white/50">Active Jobs</div>
          </div>
        </div>
      ),
    },
    {
      icon: SendIcon,
      title: 'Sub Portal Access',
      description: 'Subs get their own portal to view, accept, and update jobs — no app needed.',
      visual: (
        <div className="bg-white/10 rounded-xl px-4 py-3 border border-white/10 text-center">
          <div className="text-sm font-semibold text-white mb-1">🔗 Subcontractor Portal</div>
          <div className="text-xs text-white/50">One-click link via WhatsApp</div>
        </div>
      ),
    },
  ]

  return (
    <FeatureTeaser
      steps={teaserSteps}
      featureName="Jobs CRM Dashboard"
      price={399}
      planName="Unlimited"
    >
      {/* Mock content behind blur */}
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Active Jobs', value: '8', color: 'bg-blue-50 text-blue-600' },
            { label: 'Completed', value: '24', color: 'bg-green-50 text-green-600' },
            { label: 'Revenue', value: '$12,400', color: 'bg-orange-50 text-orange-600' },
            { label: 'Overdue', value: '2', color: 'bg-red-50 text-red-600' },
          ].map((s) => (
            <div key={s.label} className={`rounded-2xl p-4 ${s.color}`}>
              <div className="text-2xl font-bold">{s.value}</div>
              <div className="text-xs opacity-60">{s.label}</div>
            </div>
          ))}
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-stone-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-stone-100 text-stone-400 text-xs">
              <th className="px-4 py-3 text-left">Job</th>
              <th className="px-4 py-3 text-left">Sub</th>
              <th className="px-4 py-3 text-left">Deal</th>
              <th className="px-4 py-3 text-left">Status</th>
            </tr></thead>
            <tbody>
              {[
                { job: 'Chimney Repair', sub: 'Mike Johnson', deal: '$500 fixed', status: 'Active' },
                { job: 'Garage Door', sub: 'Sarah Chen', deal: '20%', status: 'Pending' },
                { job: 'Lock Change', sub: 'Carlos Rivera', deal: '$200 fixed', status: 'Completed' },
                { job: 'HVAC Install', sub: 'Tom Williams', deal: '15%', status: 'Active' },
              ].map((r) => (
                <tr key={r.job} className="border-b border-stone-50">
                  <td className="px-4 py-3 font-medium text-stone-800">{r.job}</td>
                  <td className="px-4 py-3 text-stone-500">{r.sub}</td>
                  <td className="px-4 py-3 text-stone-500">{r.deal}</td>
                  <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs ${
                    r.status === 'Completed' ? 'bg-green-50 text-green-600' : r.status === 'Pending' ? 'bg-yellow-50 text-yellow-600' : 'bg-blue-50 text-blue-600'
                  }`}>{r.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </FeatureTeaser>
  )
}
```

**Step 3: Verify in browser**

Navigate to `/jobs` as a Starter or Pro user. Confirm same behavior as Subcontractors teaser.

**Step 4: Commit**

```bash
git add apps/dashboard/src/pages/JobsDashboard.tsx
git commit -m "feat: add teaser view with animated story to Jobs page for non-Unlimited users"
```

---

### Task 6: Final Verification & Polish

**Step 1: Test as Unlimited user**

Switch to an Unlimited user. Confirm:
- Subcontractors and Jobs show WITHOUT lock icon in sidebar
- Pages load the real content (no teaser)

**Step 2: Test as Starter/Pro user**

Switch to a Starter or Pro user. Confirm:
- Lock icons appear in sidebar next to Subcontractors and Jobs
- Both teaser pages show blur + animated story
- CTA navigates to /subscription
- Animation loops smoothly
- Progress dots are clickable and work

**Step 3: Test sidebar collapsed state**

Collapse the sidebar. Confirm:
- Lock icon does NOT show in collapsed mode (only shows with labels)
- Navigation still works

**Step 4: Commit final state**

```bash
git add -A
git commit -m "feat: complete locked feature teaser for Subcontractors & Jobs with animated story upsell"
```
