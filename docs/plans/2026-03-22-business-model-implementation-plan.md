# Business Model & GTM Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement the new "Free + Premium $79" business model, update landing page messaging, add Network Points system, add group links to onboarding, and build an Admin Growth Dashboard — everything needed to launch Phase 1 tomorrow.

**Architecture:** Database migration adds `network_points`, `network_level`, and `lead_feedback` tables. Stripe plans updated to Free + Premium ($79). Landing page messaging rewritten. Onboarding wizard gets a 4th step (group links). Admin gets a new "Growth" department with a real-time dashboard tracking Phase 1 KPIs.

**Tech Stack:** React + TypeScript, Tailwind CSS, Supabase (PostgreSQL + Edge Functions), Stripe, Twilio/WhatsApp

---

## Task 1: Database Migration — New Business Model Schema

**Files:**
- Create: `supabase/migrations/038_business_model_v2.sql`

**Step 1: Write the migration**

```sql
-- 038: Business Model V2 — Free + Premium, Network Points, Lead Feedback

-- ═══ 1. Update plans table ═══
-- Remove old 3-tier plans, replace with Free + Premium

-- First, add a 'free' plan
INSERT INTO public.plans (slug, name, price_cents, max_professions, max_zip_codes)
VALUES ('free', 'Free', 0, -1, -1)
ON CONFLICT (slug) DO UPDATE SET
  name = 'Free',
  price_cents = 0,
  max_professions = -1,
  max_zip_codes = -1;

-- Rename and reprice: 'starter' → keep for legacy, add 'premium'
INSERT INTO public.plans (slug, name, price_cents, max_professions, max_zip_codes)
VALUES ('premium', 'Premium', 7900, -1, -1)
ON CONFLICT (slug) DO UPDATE SET
  name = 'Premium',
  price_cents = 7900,
  max_professions = -1,
  max_zip_codes = -1;

-- NOTE: Do NOT delete old plans — existing subscribers keep their plan.
-- Old plans (starter/pro/unlimited) remain in DB but are hidden from UI.

-- ═══ 2. Network Points ═══
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS network_points INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS network_level TEXT NOT NULL DEFAULT 'member'
    CHECK (network_level IN ('member', 'insider', 'partner', 'vip'));

-- Points ledger for auditability
CREATE TABLE IF NOT EXISTS public.network_points_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  action TEXT NOT NULL,  -- 'add_group', 'active_30d', 'referral', 'feedback', 'scam_report', 'forward_job'
  points INTEGER NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.network_points_log ENABLE ROW LEVEL SECURITY;

-- Users can read their own points log
CREATE POLICY "Users read own points"
  ON public.network_points_log FOR SELECT
  USING (auth.uid() = user_id);

-- Only service role can insert (via edge functions / triggers)
CREATE POLICY "Service inserts points"
  ON public.network_points_log FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- ═══ 3. Lead Feedback ═══
CREATE TABLE IF NOT EXISTS public.lead_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  rating TEXT NOT NULL CHECK (rating IN ('got_job', 'not_relevant', 'scam')),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(lead_id, user_id)
);

ALTER TABLE public.lead_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own feedback"
  ON public.lead_feedback FOR ALL
  USING (auth.uid() = user_id);

-- ═══ 4. Teaser tracking (for free/expired users) ═══
-- Track how many teasers sent per week to enforce 3/week limit
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS teasers_sent_this_week INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS teaser_week_start DATE;

-- ═══ 5. Group links on contractor profile ═══
-- (groups table likely exists, but ensure contractor can submit links)
CREATE TABLE IF NOT EXISTS public.contractor_group_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  invite_link TEXT NOT NULL,
  group_name TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'joined', 'failed', 'left')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.contractor_group_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own group links"
  ON public.contractor_group_links FOR ALL
  USING (auth.uid() = user_id);

-- Admins can read all
CREATE POLICY "Admins read all group links"
  ON public.contractor_group_links FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Admins can update status (joined/failed)
CREATE POLICY "Admins update group link status"
  ON public.contractor_group_links FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ═══ 6. Function: Award points + auto-level-up ═══
CREATE OR REPLACE FUNCTION public.award_network_points(
  p_user_id UUID,
  p_action TEXT,
  p_points INTEGER,
  p_metadata JSONB DEFAULT '{}'
) RETURNS void AS $$
DECLARE
  new_total INTEGER;
  new_level TEXT;
BEGIN
  -- Insert log entry
  INSERT INTO public.network_points_log (user_id, action, points, metadata)
  VALUES (p_user_id, p_action, p_points, p_metadata);

  -- Update total
  UPDATE public.profiles
  SET network_points = network_points + p_points
  WHERE id = p_user_id
  RETURNING network_points INTO new_total;

  -- Calculate level
  new_level := CASE
    WHEN new_total >= 1000 THEN 'vip'
    WHEN new_total >= 500 THEN 'partner'
    WHEN new_total >= 200 THEN 'insider'
    ELSE 'member'
  END;

  -- Update level if changed
  UPDATE public.profiles
  SET network_level = new_level
  WHERE id = p_user_id AND network_level != new_level;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Step 2: Apply migration**

Run: `supabase db push` or apply via Supabase MCP tool

**Step 3: Commit**

```bash
git add supabase/migrations/038_business_model_v2.sql
git commit -m "feat: add business model v2 schema — network points, lead feedback, group links"
```

---

## Task 2: Update Stripe — Create Premium Plan + Free Plan

**Files:**
- Modify: `supabase/migrations/038_business_model_v2.sql` (add Stripe IDs after creating in Stripe dashboard)
- Modify: `apps/dashboard/src/hooks/useSubscriptionBilling.ts`
- Modify: `apps/dashboard/src/hooks/useSubscriptionAccess.ts`

**Step 1: Create Stripe product/prices**

In Stripe Dashboard:
- Create product "Premium" with price $79/month and yearly equivalent
- Note the `prod_XXX`, `price_XXX` (monthly), `price_XXX` (yearly) IDs

**Step 2: Update migration with Stripe IDs**

Add to migration:
```sql
UPDATE public.plans SET
  stripe_product_id = 'prod_XXXXX',  -- replace with real ID
  stripe_price_id = 'price_XXXXX',   -- monthly
  stripe_yearly_price_id = 'price_XXXXX'  -- yearly
WHERE slug = 'premium';
```

**Step 3: Update useSubscriptionAccess.ts**

Replace the current hook to support the new model:

```typescript
import { useState, useEffect } from 'react'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'

type PlanTier = 'free' | 'premium' | 'starter' | 'pro' | 'unlimited' // legacy plans kept

interface SubscriptionAccess {
  planName: PlanTier
  isPremium: boolean
  isFree: boolean
  isLegacy: boolean // starter/pro/unlimited from before
  networkPoints: number
  networkLevel: string
  canSeeLeadDetails: boolean
  loading: boolean
}

export function useSubscriptionAccess(): SubscriptionAccess {
  const { effectiveUserId } = useAuth()
  const [planName, setPlanName] = useState<PlanTier>('free')
  const [networkPoints, setNetworkPoints] = useState(0)
  const [networkLevel, setNetworkLevel] = useState('member')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!effectiveUserId) {
      setLoading(false)
      return
    }

    let cancelled = false

    async function fetch() {
      // Fetch subscription
      const { data: subData } = await supabase
        .from('subscriptions')
        .select('status, plans ( slug, name )')
        .eq('user_id', effectiveUserId)
        .in('status', ['active', 'trialing'])
        .maybeSingle()

      // Fetch profile for network points
      const { data: profile } = await supabase
        .from('profiles')
        .select('network_points, network_level')
        .eq('id', effectiveUserId)
        .maybeSingle()

      if (!cancelled) {
        if (subData) {
          const plan = subData.plans as any
          setPlanName((plan?.slug || 'free') as PlanTier)
        }
        if (profile) {
          setNetworkPoints(profile.network_points || 0)
          setNetworkLevel(profile.network_level || 'member')
        }
        setLoading(false)
      }
    }

    fetch()
    return () => { cancelled = true }
  }, [effectiveUserId])

  const isPremium = ['premium', 'pro', 'unlimited'].includes(planName)
  const isFree = planName === 'free' || planName === 'starter'
  const isLegacy = ['starter', 'pro', 'unlimited'].includes(planName)

  return {
    planName,
    isPremium,
    isFree,
    isLegacy,
    networkPoints,
    networkLevel,
    canSeeLeadDetails: isPremium || isLegacy, // legacy users keep access
    loading,
  }
}
```

**Step 4: Commit**

```bash
git add apps/dashboard/src/hooks/useSubscriptionAccess.ts
git commit -m "feat: update subscription access hook for Free + Premium model"
```

---

## Task 3: Update Landing Page — Messaging & Pricing

**Files:**
- Modify: `apps/landing/src/i18n/en.json`
- Modify: `apps/landing/src/i18n/he.json`
- Modify: `apps/landing/src/components/PricingSection.tsx`

**Step 1: Rewrite en.json**

Replace the full content of `en.json` with updated messaging per the design doc:

Key changes:
- `hero.title1` → "Your WhatsApp groups are full of jobs."
- `hero.titleHighlight` → "" (remove or simplify)
- `hero.title2` → "Our AI finds them for you."
- `hero.subtitle` → "Lead Express watches your groups around the clock and sends you only the jobs that match your trade and area — straight to your WhatsApp."
- `hero.cta1` → "Start 7-Day Free Trial"
- `hero.trustedBy` → "Join contractors who stopped scrolling and started working."
- `workflow.cards[0].title` → "Tell us what you do" / desc: "Pick your trade and the counties you work in."
- `workflow.cards[1].title` → "Share your groups" / desc: "Paste your WhatsApp group invite links. We join and start scanning within 24 hours."
- `workflow.cards[2].title` → "Get matched jobs on WhatsApp" / desc: "Our AI reads every message, finds real job requests, and sends you only what fits."
- `pricing.plans` → Replace 3 plans with 2: Free and Premium ($79/mo)
- `faq.items` → Update per design doc (remove "our own list of groups", add Network Points FAQ, update forwarding FAQ)
- `cta.title` → "Stop scrolling. Start getting jobs."
- `cta.desc` → "Your WhatsApp groups are full of work right now. Let our AI filter the noise and send you only what matters."

**Step 2: Update PricingSection.tsx**

Rewrite to show 2-column layout (Free vs Premium):

```tsx
import { Check } from 'lucide-react'
import { useLang } from '../i18n/LanguageContext'

const DASHBOARD_URL = 'https://app.leadexpress.co.il'

export default function PricingSection() {
  const { t } = useLang()

  return (
    <section id="pricing" className="section-padding bg-cream">
      <div className="max-w-5xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-medium mb-4">{t.pricing.title}</h2>
          <p className="text-gray-subtle/70">{t.pricing.subtitle}</p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-3xl mx-auto">
          {t.pricing.plans.map((plan: any, i: number) => {
            const isPremium = i === 1
            return (
              <div
                key={i}
                className={`rounded-2xl p-8 flex flex-col transition-all duration-300 hover:-translate-y-2 ${
                  isPremium
                    ? 'bg-primary text-white shadow-xl shadow-primary/20'
                    : 'bg-white border border-dark/5'
                }`}
              >
                {isPremium && (
                  <span className="self-start text-[10px] font-semibold bg-white text-primary px-3 py-1 rounded-full mb-4">
                    7-Day Free Trial
                  </span>
                )}
                <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                <p className={`text-sm mb-6 ${isPremium ? 'text-white/70' : 'text-gray-subtle/60'}`}>
                  {plan.desc}
                </p>

                <div className="mb-8">
                  <span className="text-5xl font-bold">{plan.price}</span>
                  {plan.period && (
                    <span className={`text-sm ${isPremium ? 'text-white/60' : 'text-gray-subtle/50'}`}>
                      {plan.period}
                    </span>
                  )}
                </div>

                <ul className="space-y-3 mb-8 flex-1">
                  {plan.features.map((f: string, fi: number) => (
                    <li key={fi} className="flex items-start gap-3 text-sm">
                      <Check className={`w-4 h-4 shrink-0 mt-0.5 ${isPremium ? 'text-white' : 'text-primary'}`} />
                      <span className={isPremium ? 'text-white/90' : ''}>{f}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => {
                    if (isPremium) {
                      window.location.href = `${DASHBOARD_URL}/login?mode=signup&plan=premium`
                    } else {
                      window.location.href = `${DASHBOARD_URL}/login?mode=signup&plan=free`
                    }
                  }}
                  className={`w-full py-3.5 rounded-full text-sm font-semibold transition-all duration-300 cursor-pointer ${
                    isPremium
                      ? 'bg-white text-primary hover:bg-white/90'
                      : 'border border-dark/10 hover:bg-dark hover:text-white'
                  }`}
                >
                  {plan.cta}
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
```

**Step 3: Update he.json** with Hebrew translations matching the new messaging.

**Step 4: Commit**

```bash
git add apps/landing/src/i18n/en.json apps/landing/src/i18n/he.json apps/landing/src/components/PricingSection.tsx
git commit -m "feat: update landing page — new messaging, Free + Premium pricing"
```

---

## Task 4: Update Landing Page — Simplify Sections for Day 1 Messaging

**Files:**
- Modify: `apps/landing/src/App.tsx`
- Modify: `apps/landing/src/components/NetworkSection.tsx` (or replace with new Hero)
- Modify: `apps/landing/src/components/TestimonialsSection.tsx`

**Step 1: Reorder/simplify App.tsx**

Update section order to match the new narrative:
1. Hero (new messaging)
2. How It Works (3 steps including "Share your groups")
3. Features (scanning, matching, WhatsApp delivery)
4. Forward Jobs section (Rebeca forwarding)
5. Network Points teaser (levels preview)
6. Testimonials (remove fake numbers)
7. Pricing (Free vs Premium)
8. FAQ
9. CTA
10. Footer

**Step 2: Update NetworkSection or Hero** with new title/subtitle per design doc.

**Step 3: Fix testimonials** — remove "Trusted by 19,000+" and "500+" inflated numbers. Replace with authentic early-stage messaging like "Built for contractors who are tired of scrolling."

**Step 4: Commit**

```bash
git add apps/landing/src/
git commit -m "feat: simplify landing page sections for Phase 1 launch"
```

---

## Task 5: Add Group Links to Onboarding Wizard

**Files:**
- Modify: `apps/dashboard/src/pages/OnboardingWizard.tsx`
- Create: `apps/dashboard/src/components/settings/GroupLinksPanel.tsx`
- Modify: `apps/dashboard/src/hooks/useContractorSettings.ts`

**Step 1: Create GroupLinksPanel component**

```tsx
// apps/dashboard/src/components/settings/GroupLinksPanel.tsx
import { useState } from 'react'
import { Plus, Link, Loader2, X, CheckCircle, Clock } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'

interface GroupLink {
  id: string
  invite_link: string
  group_name: string | null
  status: 'pending' | 'joined' | 'failed'
  created_at: string
}

interface Props {
  links: GroupLink[]
  onAdd: (link: string) => Promise<void>
  onRemove: (id: string) => Promise<void>
  compact?: boolean
}

export default function GroupLinksPanel({ links, onAdd, onRemove, compact }: Props) {
  const [input, setInput] = useState('')
  const [adding, setAdding] = useState(false)

  async function handleAdd() {
    const trimmed = input.trim()
    if (!trimmed) return
    setAdding(true)
    await onAdd(trimmed)
    setInput('')
    setAdding(false)
  }

  return (
    <div className="space-y-4">
      {/* Input */}
      <div className="flex gap-2">
        <input
          type="url"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="https://chat.whatsapp.com/..."
          className="flex-1 px-4 py-2.5 rounded-xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
        />
        <button
          onClick={handleAdd}
          disabled={!input.trim() || adding}
          className="px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-medium disabled:opacity-50 flex items-center gap-2"
        >
          {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Add
        </button>
      </div>

      {/* Hint */}
      <p className="text-xs text-stone-400">
        Paste WhatsApp group invite links. We'll join within 24 hours and start scanning for jobs.
        +10 Network Points per group!
      </p>

      {/* Links list */}
      {links.length > 0 && (
        <div className="space-y-2">
          {links.map((link) => (
            <div key={link.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-stone-50">
              <Link className="w-4 h-4 text-stone-400 shrink-0" />
              <span className="text-sm text-stone-600 truncate flex-1">
                {link.group_name || link.invite_link}
              </span>
              {link.status === 'joined' && <CheckCircle className="w-4 h-4 text-green-500" />}
              {link.status === 'pending' && <Clock className="w-4 h-4 text-amber-500" />}
              <button onClick={() => onRemove(link.id)} className="text-stone-300 hover:text-red-400">
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

**Step 2: Add step 3 "Share your groups" to OnboardingWizard.tsx**

Insert between step 2 (Service Areas) and step 3 (Schedule) — making it a new step 3, and Schedule becomes step 4.

Add to the `steps` array:
```typescript
{
  label: he ? 'קבוצות' : 'Your Groups',
  icon: Link,
  desc: he
    ? 'שתף לינקים של קבוצות WhatsApp שלך — אנחנו מצטרפים ומתחילים לסרוק'
    : "Share your WhatsApp group links — we'll join and start scanning for jobs",
},
```

Add GroupLinksPanel rendering for `step === 2` (the new step index).

**Step 3: Add group link CRUD to useContractorSettings or create a new hook**

```typescript
// Add to useContractorSettings.ts or create useContractorGroupLinks.ts
async function addGroupLink(inviteLink: string) {
  const { error } = await supabase
    .from('contractor_group_links')
    .insert({ user_id: effectiveUserId, invite_link: inviteLink })
  if (!error) {
    // Award network points
    await supabase.rpc('award_network_points', {
      p_user_id: effectiveUserId,
      p_action: 'add_group',
      p_points: 10,
      p_metadata: { invite_link: inviteLink }
    })
    refetch()
  }
}
```

**Step 4: Commit**

```bash
git add apps/dashboard/src/components/settings/GroupLinksPanel.tsx apps/dashboard/src/pages/OnboardingWizard.tsx apps/dashboard/src/hooks/
git commit -m "feat: add group links step to onboarding wizard"
```

---

## Task 6: Network Points Display — Dashboard Widget

**Files:**
- Create: `apps/dashboard/src/components/NetworkPointsCard.tsx`
- Modify: `apps/dashboard/src/pages/ContractorDashboard.tsx`

**Step 1: Create NetworkPointsCard**

A card showing:
- Current level with badge color (Member/Insider/Partner/VIP)
- Points progress bar to next level
- Points breakdown (recent activity)

```tsx
// apps/dashboard/src/components/NetworkPointsCard.tsx
import { useSubscriptionAccess } from '../hooks/useSubscriptionAccess'
import { Star, Shield, Award, Crown } from 'lucide-react'

const LEVELS = [
  { key: 'member', label: 'Member', points: 0, icon: Star, color: '#94a3b8' },
  { key: 'insider', label: 'Insider', points: 200, icon: Shield, color: '#22c55e' },
  { key: 'partner', label: 'Partner', points: 500, icon: Award, color: '#eab308' },
  { key: 'vip', label: 'VIP', points: 1000, icon: Crown, color: '#ef4444' },
]

export default function NetworkPointsCard() {
  const { networkPoints, networkLevel } = useSubscriptionAccess()

  const currentIdx = LEVELS.findIndex((l) => l.key === networkLevel)
  const current = LEVELS[currentIdx] || LEVELS[0]
  const next = LEVELS[currentIdx + 1]

  const progress = next
    ? ((networkPoints - current.points) / (next.points - current.points)) * 100
    : 100

  return (
    <div className="rounded-2xl bg-white border border-stone-100 p-5">
      <div className="flex items-center gap-3 mb-4">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: current.color + '20', color: current.color }}
        >
          <current.icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-sm font-semibold text-stone-800">{current.label}</p>
          <p className="text-xs text-stone-400">{networkPoints} points</p>
        </div>
      </div>

      {next && (
        <>
          <div className="h-2 bg-stone-100 rounded-full overflow-hidden mb-2">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.min(100, progress)}%`,
                backgroundColor: next.color,
              }}
            />
          </div>
          <p className="text-xs text-stone-400">
            {next.points - networkPoints} points to {next.label}
          </p>
        </>
      )}
    </div>
  )
}
```

**Step 2: Add to ContractorDashboard.tsx**

Import and render `<NetworkPointsCard />` in the dashboard layout.

**Step 3: Commit**

```bash
git add apps/dashboard/src/components/NetworkPointsCard.tsx apps/dashboard/src/pages/ContractorDashboard.tsx
git commit -m "feat: add Network Points card to contractor dashboard"
```

---

## Task 7: Lead Feedback System

**Files:**
- Create: `apps/dashboard/src/components/LeadFeedbackButtons.tsx`
- Modify: Lead notification WhatsApp template (Twilio content)
- Modify: `supabase/functions/whatsapp-webhook/index.ts` (handle feedback replies)

**Step 1: Create LeadFeedbackButtons component (dashboard)**

```tsx
// apps/dashboard/src/components/LeadFeedbackButtons.tsx
import { useState } from 'react'
import { ThumbsUp, ThumbsDown, AlertTriangle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'

interface Props {
  leadId: string
  existingRating?: string
}

export default function LeadFeedbackButtons({ leadId, existingRating }: Props) {
  const { effectiveUserId } = useAuth()
  const [rating, setRating] = useState(existingRating)
  const [saving, setSaving] = useState(false)

  async function submit(r: 'got_job' | 'not_relevant' | 'scam') {
    setSaving(true)
    const { error } = await supabase
      .from('lead_feedback')
      .upsert({ lead_id: leadId, user_id: effectiveUserId, rating: r })

    if (!error) {
      setRating(r)
      // Award points
      const points = r === 'scam' ? 25 : 5
      await supabase.rpc('award_network_points', {
        p_user_id: effectiveUserId,
        p_action: r === 'scam' ? 'scam_report' : 'feedback',
        p_points: points,
        p_metadata: { lead_id: leadId, rating: r },
      })
    }
    setSaving(false)
  }

  if (rating) {
    const labels: Record<string, string> = {
      got_job: 'Got the job!',
      not_relevant: 'Not relevant',
      scam: 'Reported',
    }
    return <span className="text-xs text-stone-400">{labels[rating]}</span>
  }

  return (
    <div className="flex gap-2">
      <button onClick={() => submit('got_job')} disabled={saving}
        className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-green-600 bg-green-50 hover:bg-green-100">
        <ThumbsUp className="w-3 h-3" /> Got job
      </button>
      <button onClick={() => submit('not_relevant')} disabled={saving}
        className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-stone-500 bg-stone-50 hover:bg-stone-100">
        <ThumbsDown className="w-3 h-3" /> Not relevant
      </button>
      <button onClick={() => submit('scam')} disabled={saving}
        className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-red-500 bg-red-50 hover:bg-red-100">
        <AlertTriangle className="w-3 h-3" /> Scam
      </button>
    </div>
  )
}
```

**Step 2: Integrate into LeadsFeed.tsx** — add `<LeadFeedbackButtons leadId={lead.id} />` to each lead card.

**Step 3: Commit**

```bash
git add apps/dashboard/src/components/LeadFeedbackButtons.tsx apps/dashboard/src/pages/LeadsFeed.tsx
git commit -m "feat: add lead feedback system with Network Points rewards"
```

---

## Task 8: Update Subscription Page

**Files:**
- Modify: `apps/dashboard/src/pages/Subscription.tsx`

**Step 1: Rewrite Subscription.tsx**

Replace the 3-plan layout with a 2-plan layout (Free vs Premium).
- Show current plan status
- If free: show upgrade CTA with feature comparison
- If premium: show billing management
- Legacy plans (starter/pro/unlimited): show as "Legacy plan — all features included"
- Keep Stripe checkout/portal integration

**Step 2: Update PLAN_CONFIG**

```typescript
const PLAN_CONFIG: Record<string, {...}> = {
  free: {
    icon: Zap,
    features: [
      'Unlimited WhatsApp groups',
      'Lead notifications (preview only)',
      'Forward jobs via Rebeca',
      'Earn Network Points',
    ],
    gradient: 'from-slate-50 to-white',
    iconBg: 'bg-slate-100 text-slate-600',
    accentColor: 'slate',
  },
  premium: {
    icon: Crown,
    badge: '7-Day Free Trial',
    features: [
      'Everything in Free',
      'Full lead details + contact info',
      'Unlimited leads',
      'Full dashboard + weekly report',
      'Priority support',
      'Network Points x2',
    ],
    gradient: 'from-[#fe5b25] to-[#e04d1c]',
    iconBg: 'bg-white/20 text-white',
    accentColor: 'orange',
  },
}
```

**Step 3: Commit**

```bash
git add apps/dashboard/src/pages/Subscription.tsx
git commit -m "feat: update subscription page for Free + Premium model"
```

---

## Task 9: Admin Growth Dashboard

**Files:**
- Create: `apps/dashboard/src/pages/admin/GrowthDashboard.tsx`
- Create: `apps/dashboard/src/hooks/useGrowthMetrics.ts`
- Modify: `apps/dashboard/src/config/departmentConfig.ts` (add Growth department)

**Step 1: Create useGrowthMetrics hook**

```typescript
// apps/dashboard/src/hooks/useGrowthMetrics.ts
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export interface GrowthMetrics {
  // Key metrics
  payingUsers: number
  freeUsers: number
  mrr: number
  conversionRate: number

  // Targets
  payingTarget: number  // 500

  // Funnel
  leadsDeliveredThisWeek: number
  jobsForwardedThisWeek: number
  teasersSentThisWeek: number
  teaserConversionRate: number

  // Engagement
  totalGroupsInPool: number
  groupsAddedThisWeek: number
  feedbackGivenThisWeek: number
  feedbackRate: number

  // Network Points distribution
  levelDistribution: { member: number; insider: number; partner: number; vip: number }

  // Churn
  churnRate: number
  activeTrials: number
  trialConversionRate: number

  // Trends (last 30 days, daily)
  dailyPayingUsers: { date: string; count: number }[]
  dailyMrr: { date: string; amount: number }[]

  // Recent activity
  recentActivity: { type: string; description: string; created_at: string }[]

  loading: boolean
}

export function useGrowthMetrics(): GrowthMetrics {
  const [metrics, setMetrics] = useState<GrowthMetrics>({
    payingUsers: 0, freeUsers: 0, mrr: 0, conversionRate: 0,
    payingTarget: 500,
    leadsDeliveredThisWeek: 0, jobsForwardedThisWeek: 0,
    teasersSentThisWeek: 0, teaserConversionRate: 0,
    totalGroupsInPool: 0, groupsAddedThisWeek: 0,
    feedbackGivenThisWeek: 0, feedbackRate: 0,
    levelDistribution: { member: 0, insider: 0, partner: 0, vip: 0 },
    churnRate: 0, activeTrials: 0, trialConversionRate: 0,
    dailyPayingUsers: [], dailyMrr: [],
    recentActivity: [],
    loading: true,
  })

  useEffect(() => {
    async function fetch() {
      // Parallel queries for all metrics
      const [
        { count: payingCount },
        { count: freeCount },
        { count: trialCount },
        { count: groupCount },
        { data: levelData },
      ] = await Promise.all([
        supabase.from('subscriptions').select('*', { count: 'exact', head: true })
          .in('status', ['active']),
        supabase.from('profiles').select('*', { count: 'exact', head: true })
          .eq('role', 'contractor'),
        supabase.from('subscriptions').select('*', { count: 'exact', head: true })
          .eq('status', 'trialing'),
        supabase.from('contractor_group_links').select('*', { count: 'exact', head: true }),
        supabase.from('profiles').select('network_level'),
      ])

      const paying = payingCount || 0
      const free = (freeCount || 0) - paying
      const distribution = { member: 0, insider: 0, partner: 0, vip: 0 }
      levelData?.forEach((p: any) => {
        if (p.network_level in distribution) {
          distribution[p.network_level as keyof typeof distribution]++
        }
      })

      setMetrics(prev => ({
        ...prev,
        payingUsers: paying,
        freeUsers: Math.max(0, free),
        mrr: paying * 7900, // cents
        conversionRate: free > 0 ? (paying / (paying + free)) * 100 : 0,
        totalGroupsInPool: groupCount || 0,
        activeTrials: trialCount || 0,
        levelDistribution: distribution,
        loading: false,
      }))
    }

    fetch()
  }, [])

  return metrics
}
```

**Step 2: Create GrowthDashboard.tsx**

Full admin page with:
- Phase progress bar (0/500 paying)
- 4 KPI cards (MRR, Paying Users, Free Users, Conversion Rate)
- Growth chart (line chart, paying users + MRR over time vs target)
- Funnel metrics (leads delivered, jobs forwarded, teasers sent)
- Engagement cards (groups in pool, feedback rate, active users)
- Network Points level distribution (bar chart)
- Churn & trial health
- Recent activity feed

Use the existing admin design patterns (glass cards, clean layout, orange accent).

**Step 3: Add Growth department to departmentConfig.ts**

```typescript
{
  id: 'growth',
  nameEn: 'Growth',
  nameHe: 'צמיחה',
  color: '#22c55e',
  icon: TrendingUp,
  basePath: 'growth',
  tabs: [
    { key: 'dashboard', labelEn: 'Dashboard', labelHe: 'דשבורד', path: '', fullBleed: true },
  ],
  kpis: [
    { key: 'paying_users', labelEn: 'Paying Users', labelHe: 'משלמים', format: 'number' },
    { key: 'mrr', labelEn: 'MRR', labelHe: 'MRR', format: 'currency' },
    { key: 'conversion', labelEn: 'Conversion', labelHe: 'המרה', format: 'percent' },
    { key: 'groups', labelEn: 'Groups', labelHe: 'קבוצות', format: 'number' },
  ],
},
```

**Step 4: Wire into DepartmentLayout**

Ensure the Growth dashboard renders correctly when navigating to `/admin/growth`.

**Step 5: Commit**

```bash
git add apps/dashboard/src/pages/admin/GrowthDashboard.tsx apps/dashboard/src/hooks/useGrowthMetrics.ts apps/dashboard/src/config/departmentConfig.ts
git commit -m "feat: add Admin Growth Dashboard for Phase 1 tracking"
```

---

## Task 10: Teaser Message Logic for Non-Paying Users

**Files:**
- Modify: `supabase/functions/whatsapp-webhook/index.ts` or lead notification edge function
- Create: `supabase/functions/send-lead-teaser/index.ts` (if separate)

**Step 1: Add teaser logic**

When sending a lead notification:
1. Check if user has active subscription
2. If YES → send full lead details + contact button
3. If NO → check teasers_sent_this_week < 3
   - If under limit → send teaser: "There's a [trade] job in [county] that matches you. Upgrade to see details."
   - Include upgrade link
   - Increment teasers_sent_this_week
4. Reset teasers_sent_this_week on Monday (cron or check teaser_week_start)

**Step 2: Create Twilio content template for teaser**

```
TEASER template:
"🔔 A {trade} job was just posted in {county} that matches your profile.

Posted {time_ago} — {urgency_emoji}

→ Upgrade to see full details and contact them:
{upgrade_link}

You have {remaining} free previews this week."
```

**Step 3: Commit**

```bash
git add supabase/functions/
git commit -m "feat: add teaser messages for non-paying users (max 3/week)"
```

---

## Task 11: Onboarding — Replace ZIP Codes with Counties

**Files:**
- Modify: `apps/dashboard/src/components/settings/CoverageMap.tsx`
- Modify: `apps/dashboard/src/pages/OnboardingWizard.tsx`
- Modify: `apps/dashboard/src/lib/us-geo.ts`
- Create: `supabase/migrations/039_zip_to_county.sql`

**Step 1: Migration — add counties column**

```sql
-- 039: Add counties support alongside zip codes
ALTER TABLE public.contractors
  ADD COLUMN IF NOT EXISTS counties TEXT[] DEFAULT '{}';

-- Keep zip_codes for backward compatibility
-- Future: phase out zip_codes, use counties as primary
```

**Step 2: Update CoverageMap to show county selection**

Replace ZIP code input with county search/select. Use US county data (FIPS codes).

**Step 3: Update OnboardingWizard step 2** — change label from "Service Areas (ZIP)" to "Service Areas (Counties)", use county selector.

**Step 4: Commit**

```bash
git add supabase/migrations/039_zip_to_county.sql apps/dashboard/src/
git commit -m "feat: replace ZIP codes with counties in onboarding and settings"
```

---

## Task Summary

| Task | Description | Priority |
|---|---|---|
| 1 | Database migration (points, feedback, group links) | 🔴 Critical |
| 2 | Stripe + subscription access hook update | 🔴 Critical |
| 3 | Landing page messaging & pricing | 🔴 Critical |
| 4 | Landing page section simplification | 🟡 High |
| 5 | Group links in onboarding | 🔴 Critical |
| 6 | Network Points dashboard widget | 🟡 High |
| 7 | Lead feedback system | 🟡 High |
| 8 | Subscription page update | 🔴 Critical |
| 9 | Admin Growth Dashboard | 🟡 High |
| 10 | Teaser message logic | 🔴 Critical |
| 11 | ZIP to Counties migration | 🟡 High |

**Recommended execution order:** 1 → 2 → 3 → 5 → 8 → 10 → 4 → 6 → 7 → 9 → 11
