# Job Portal Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite `JobPortal.tsx` from a confusing "approve job" page into a story-driven publisher conversion page with 5 scrollable sections.

**Architecture:** Single-file rewrite of `JobPortal.tsx`. Same React component, same Supabase RPC calls, same `portal-signup` edge function. No backend changes. The page becomes a scrollable story: Hero → Value Cards → Trust → Signup Form → Success Screen. The "approve" action is replaced with "confirm + signup" in one flow.

**Tech Stack:** React, TypeScript, Lucide icons, Supabase client (all already in use). Inline styles + Tailwind utility classes (existing pattern). Image asset from landing page public folder.

---

### Task 1: Copy team image to dashboard public folder

**Files:**
- Copy: `apps/landing/public/contractors-team.webp` → `apps/dashboard/public/contractors-team.webp`

- [ ] **Step 1: Copy the image**

```bash
cp /Users/bigjeff/Desktop/Leadexpress/apps/landing/public/contractors-team.webp /Users/bigjeff/Desktop/Leadexpress/apps/dashboard/public/contractors-team.webp
```

- [ ] **Step 2: Verify the file exists**

```bash
ls -la /Users/bigjeff/Desktop/Leadexpress/apps/dashboard/public/contractors-team.webp
```

Expected: File exists, ~338KB

- [ ] **Step 3: Commit**

```bash
cd /Users/bigjeff/Desktop/Leadexpress
git add apps/dashboard/public/contractors-team.webp
git commit -m "feat(portal): add team image for trust section"
```

---

### Task 2: Rewrite JobPortal.tsx — Shell, types, state, and data fetching

Keep the existing `Shell` wrapper, types, and data fetching logic. Update state to remove the separate "approve then signup" two-step flow — the new page goes straight from the story sections to a signup form (no "approve" button).

**Files:**
- Modify: `apps/dashboard/src/pages/JobPortal.tsx`

- [ ] **Step 1: Replace the entire file with the new implementation**

Replace the full content of `JobPortal.tsx` with this code:

```tsx
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import {
  MapPin, CheckCircle, XCircle, Globe, Shield, Loader2, Star,
  Users, Zap, ArrowRight, ClipboardList, RefreshCw, Award
} from 'lucide-react'

// ── Types & helpers ─────────────────────────────────────────────────────────
type PortalLang = 'en' | 'he'
const t = (lang: PortalLang, en: string, he: string) => lang === 'he' ? he : en

interface Job {
  id: string
  lead_id: string
  contractor_id: string
  subcontractor_id: string | null
  deal_type: string
  deal_value: string
  status: string
  created_at: string
  updated_at: string
  contractor_name: string
  lead: {
    city: string | null
    zip_code: string | null
    urgency: string | null
    summary: string | null
    description: string | null
    sender_id: string | null
    profession: string | null
  }
}

const BRAND = '#fe5b25'
const BRAND_DARK = '#e04d1c'
const BG = '#faf9f6'

// ── Main Component ──────────────────────────────────────────────────────────
export default function JobPortal() {
  const { token } = useParams<{ token: string }>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [job, setJob] = useState<Job | null>(null)
  const [signupName, setSignupName] = useState('')
  const [signupPhone, setSignupPhone] = useState('')
  const [signupLoading, setSignupLoading] = useState(false)
  const [signupDone, setSignupDone] = useState(false)
  const [lang, setLang] = useState<PortalLang>(() => {
    const saved = localStorage.getItem('le-portal-lang') as PortalLang | null
    return saved === 'he' ? 'he' : 'en'
  })

  const toggleLang = () => {
    const next = lang === 'en' ? 'he' : 'en'
    setLang(next)
    localStorage.setItem('le-portal-lang', next)
  }

  useEffect(() => {
    async function fetchJob() {
      if (!token) return
      try {
        const { data, error: rpcError } = await supabase.rpc('get_job_order_by_token', { token })
        if (rpcError) throw rpcError
        if (!data) throw new Error('Job not found')
        const jobData = data as unknown as Job
        setJob(jobData)
        // Pre-fill phone from WhatsApp sender ID
        if (jobData.lead?.sender_id) {
          const phone = jobData.lead.sender_id.replace(/@.*$/, '')
          setSignupPhone(phone.startsWith('+') ? phone : `+${phone}`)
        }
        // Auto-accept the job since the deal is already done
        if (jobData.status === 'pending') {
          await supabase.rpc('update_job_order_status_by_token', { token, new_status: 'accepted' })
        }
        // Track page view
        supabase.from('job_orders').update({ viewed_at: new Date().toISOString() }).eq('id', jobData.id).then(() => {})
      } catch (err: any) {
        setError(err.message || 'Failed to load')
      } finally {
        setLoading(false)
      }
    }
    fetchJob()
  }, [token])

  const handleSignup = async () => {
    if (!signupName.trim() || !signupPhone.trim()) return
    setSignupLoading(true)
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/portal-signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: signupName.trim(), phone: signupPhone.trim(), job_order_id: job?.id }),
      })
      if (res.ok) setSignupDone(true)
      else alert(t(lang, 'Registration failed. Try again.', 'ההרשמה נכשלה. נסה שוב.'))
    } catch {
      alert(t(lang, 'Network error.', 'שגיאת רשת.'))
    } finally {
      setSignupLoading(false)
    }
  }

  // Derived data
  const contractorName = job?.contractor_name || t(lang, 'A contractor', 'קבלן')
  const lead = job?.lead || { city: null, zip_code: null, urgency: null, summary: null, description: null, sender_id: null, profession: null }
  const profession = (lead.profession || '').replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())
  const location = [lead.city, lead.zip_code].filter(Boolean).join(', ') || t(lang, 'Your area', 'האזור שלך')

  // ── Loading state ──
  if (loading) {
    return (
      <Shell lang={lang} toggleLang={toggleLang}>
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin" style={{ color: BRAND }} />
            <p className="text-sm" style={{ color: '#9a9590' }}>{t(lang, 'Loading...', 'טוען...')}</p>
          </div>
        </div>
      </Shell>
    )
  }

  // ── Error state ──
  if (error || !job) {
    return (
      <Shell lang={lang} toggleLang={toggleLang}>
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6">
          <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{ background: '#fef2ef' }}>
            <XCircle className="w-10 h-10" style={{ color: '#e8a99a' }} />
          </div>
          <h1 className="text-xl font-bold" style={{ color: '#1a1614' }}>{t(lang, 'Link Expired', 'הקישור פג תוקף')}</h1>
          <p className="text-sm text-center" style={{ color: '#9a9590', maxWidth: 280 }}>
            {t(lang, 'This job link is no longer valid.', 'קישור העבודה הזה כבר לא תקף.')}
          </p>
        </div>
      </Shell>
    )
  }

  // ── Success screen (after signup) ──
  if (signupDone) {
    return (
      <Shell lang={lang} toggleLang={toggleLang}>
        <div className="flex-1 flex flex-col items-center justify-center px-6 gap-5">
          <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{ background: '#ecfdf5' }}>
            <CheckCircle className="w-10 h-10 text-emerald-500" />
          </div>
          <h1 className="text-2xl font-bold text-center" style={{ color: '#1a1614', letterSpacing: '-0.04em' }}>
            {t(lang, "You're in!", 'אתה בפנים!')}
          </h1>
          <p className="text-sm text-center" style={{ color: '#7a7570', maxWidth: 300, lineHeight: 1.7 }}>
            {t(lang,
              `The job with ${contractorName} is waiting for you in your dashboard.`,
              `העבודה עם ${contractorName} מחכה לך בדשבורד.`
            )}
          </p>
          <p className="text-xs text-center" style={{ color: '#b5b0ab', maxWidth: 280, lineHeight: 1.6 }}>
            {t(lang,
              "We'll send you a link to access your dashboard shortly.",
              'נשלח לך בקרוב לינק לגישה לדשבורד שלך.'
            )}
          </p>
          <div className="flex items-center gap-2 mt-2 px-4 py-2 rounded-full" style={{ background: '#fff4ef' }}>
            <Zap className="w-4 h-4" style={{ color: BRAND }} />
            <span className="text-xs font-semibold" style={{ color: BRAND_DARK }}>
              MasterLeadFlow
            </span>
          </div>
        </div>
      </Shell>
    )
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // MAIN PAGE: Scrollable story — Hero → Value → Trust → Signup
  // ══════════════════════════════════════════════════════════════════════════════
  return (
    <Shell lang={lang} toggleLang={toggleLang}>
      <div className="flex-1">

        {/* ── Section 1: Hero — "What happened?" ── */}
        <div className="relative overflow-hidden" style={{
          background: `linear-gradient(135deg, ${BRAND} 0%, ${BRAND_DARK} 50%, #c43d10 100%)`,
          padding: '44px 24px 60px',
        }}>
          <div className="absolute top-0 right-0 w-64 h-64 rounded-full opacity-10" style={{ background: '#fff', transform: 'translate(30%, -50%)' }} />
          <div className="absolute bottom-0 left-0 w-40 h-40 rounded-full opacity-[0.07]" style={{ background: '#fff', transform: 'translate(-30%, 40%)' }} />

          <div className="relative max-w-md mx-auto text-center">
            {/* Contractor avatar */}
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 text-2xl font-bold"
              style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', backdropFilter: 'blur(8px)', border: '2px solid rgba(255,255,255,0.3)' }}>
              {contractorName.charAt(0).toUpperCase()}
            </div>

            <h1 className="text-[22px] font-bold text-white mb-2" style={{ letterSpacing: '-0.04em', lineHeight: 1.3 }}>
              {t(lang,
                `${contractorName} took your job ✅`,
                `${contractorName} לקח את העבודה שלך ✅`
              )}
            </h1>

            {/* Job badge */}
            <div className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 mt-2"
              style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(4px)' }}>
              <MapPin className="w-3.5 h-3.5 text-white/70" />
              <span className="text-sm text-white/90 font-medium">
                {profession}{profession && location ? ' · ' : ''}{location}
              </span>
            </div>

            <p className="text-sm text-white/60 mt-4" style={{ lineHeight: 1.6 }}>
              {t(lang,
                "The deal is set. Let's manage it in one place.",
                'העבודה סגורה. בוא ננהל אותה במקום אחד.'
              )}
            </p>
          </div>
        </div>

        {/* ── Section 2: Value Cards — "What's in it for me?" ── */}
        <div className="px-5 -mt-6 max-w-md mx-auto">
          <div className="grid gap-3">
            {[
              {
                icon: <ClipboardList className="w-5 h-5" style={{ color: BRAND }} />,
                bg: '#fff4ef',
                titleEn: 'Track this job',
                titleHe: 'עקוב אחרי העבודה',
                descEn: 'Status, commission, contact details — all in one place',
                descHe: 'סטטוס, עמלה, פרטי קשר — הכל במקום אחד',
              },
              {
                icon: <RefreshCw className="w-5 h-5" style={{ color: '#3b82f6' }} />,
                bg: '#eff6ff',
                titleEn: 'Next time it\'s automatic',
                titleHe: 'בפעם הבאה זה אוטומטי',
                descEn: 'Post a job? AI connects you to a sub-contractor in minutes',
                descHe: 'פרסמת עבודה? AI מחבר אותך לקבלן משנה תוך דקות',
              },
              {
                icon: <Award className="w-5 h-5" style={{ color: '#16a34a' }} />,
                bg: '#ecfdf5',
                titleEn: 'Build your reputation',
                titleHe: 'בנה את המוניטין שלך',
                descEn: 'Get and give ratings. Good sub-contractors will want to work with you',
                descHe: 'קבל ותן דירוגים. קבלני משנה טובים ירצו לעבוד איתך',
              },
            ].map((card, i) => (
              <div key={i} className="flex items-start gap-3.5 rounded-2xl p-4"
                style={{ background: '#fff', border: '1px solid #efece8', boxShadow: '0 2px 8px rgba(26,22,20,0.04)' }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: card.bg }}>
                  {card.icon}
                </div>
                <div>
                  <p className="text-[14px] font-bold mb-0.5" style={{ color: '#1a1614' }}>
                    {t(lang, card.titleEn, card.titleHe)}
                  </p>
                  <p className="text-[13px]" style={{ color: '#7a7570', lineHeight: 1.5 }}>
                    {t(lang, card.descEn, card.descHe)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Section 3: Trust — "Who are you?" ── */}
        <div className="px-5 mt-8 max-w-md mx-auto">
          <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #efece8' }}>
            <img
              src="/contractors-team.webp"
              alt="Contractor team"
              className="w-full h-40 object-cover"
              style={{ objectPosition: 'center 30%' }}
            />
            <div className="p-4 text-center" style={{ background: '#fff' }}>
              <p className="text-[14px] font-bold mb-2" style={{ color: '#1a1614', letterSpacing: '-0.02em' }}>
                MasterLeadFlow
              </p>
              <p className="text-[13px] mb-3" style={{ color: '#7a7570', lineHeight: 1.5 }}>
                {t(lang,
                  'The platform connecting general contractors with sub-contractors',
                  'הפלטפורמה שמחברת קבלנים ראשיים לקבלני משנה'
                )}
              </p>
              <div className="flex items-center justify-center gap-1.5">
                {[1,2,3,4,5].map(i => (
                  <Star key={i} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                ))}
                <span className="text-[11px] ml-1" style={{ color: '#b5b0ab' }}>
                  4.9 · 500+ {t(lang, 'contractors', 'קבלנים')} · FL, TX, CA, NY
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Section 4: CTA + Signup — "What do I do?" ── */}
        <div className="px-5 mt-8 pb-10 max-w-md mx-auto">
          <div className="rounded-2xl overflow-hidden" style={{ background: '#fff', border: '1px solid #efece8', boxShadow: '0 8px 32px rgba(26,22,20,0.08)' }}>
            <div className="px-5 py-4" style={{ borderBottom: '1px solid #f5f3f0' }}>
              <h2 className="text-[15px] font-bold text-center" style={{ color: '#1a1614' }}>
                {t(lang,
                  'Enter your details to see the job in your dashboard',
                  'הכנס פרטים כדי לראות את העבודה בדשבורד'
                )}
              </h2>
            </div>
            <div className="px-5 py-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: '#9a9590' }}>
                  {t(lang, 'YOUR NAME', 'השם שלך')}
                </label>
                <input
                  type="text"
                  value={signupName}
                  onChange={e => setSignupName(e.target.value)}
                  placeholder={t(lang, 'Full name', 'שם מלא')}
                  className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none transition-all"
                  style={{ border: '1.5px solid #e8e4e0', background: '#faf9f7', color: '#1a1614' }}
                  onFocus={e => { e.target.style.borderColor = BRAND; e.target.style.boxShadow = `0 0 0 3px ${BRAND}20` }}
                  onBlur={e => { e.target.style.borderColor = '#e8e4e0'; e.target.style.boxShadow = 'none' }}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: '#9a9590' }}>
                  {t(lang, 'PHONE NUMBER', 'מספר טלפון')}
                </label>
                <input
                  type="tel"
                  value={signupPhone}
                  onChange={e => setSignupPhone(e.target.value)}
                  placeholder="+1 555 123 4567"
                  className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none transition-all"
                  style={{ border: '1.5px solid #e8e4e0', background: '#faf9f7', color: '#1a1614' }}
                  dir="ltr"
                  onFocus={e => { e.target.style.borderColor = BRAND; e.target.style.boxShadow = `0 0 0 3px ${BRAND}20` }}
                  onBlur={e => { e.target.style.borderColor = '#e8e4e0'; e.target.style.boxShadow = 'none' }}
                />
              </div>
            </div>
            <div className="px-5 pb-5">
              <button
                onClick={handleSignup}
                disabled={signupLoading || !signupName.trim() || !signupPhone.trim()}
                className="w-full rounded-xl py-4 text-[15px] font-bold text-white transition-all active:scale-[0.98] disabled:opacity-40"
                style={{ background: `linear-gradient(135deg, ${BRAND}, ${BRAND_DARK})`, boxShadow: '0 6px 20px rgba(254,91,37,0.35)' }}
              >
                {signupLoading
                  ? <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                  : <span className="flex items-center justify-center gap-2">
                      {t(lang, 'Take me to my job', 'קח אותי לעבודה שלי')}
                      <ArrowRight className="w-4 h-4" />
                    </span>}
              </button>
              <div className="flex items-center justify-center gap-4 mt-4">
                <span className="flex items-center gap-1 text-[11px]" style={{ color: '#b5b0ab' }}>
                  <Shield className="w-3 h-3" /> {t(lang, 'Secure', 'מאובטח')}
                </span>
                <span className="text-[11px]" style={{ color: '#d5d0cb' }}>·</span>
                <span className="text-[11px]" style={{ color: '#b5b0ab' }}>
                  {t(lang, 'Free forever', 'חינם לנצח')}
                </span>
                <span className="text-[11px]" style={{ color: '#d5d0cb' }}>·</span>
                <span className="text-[11px]" style={{ color: '#b5b0ab' }}>
                  {t(lang, 'No credit card', 'ללא כ.א.')}
                </span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </Shell>
  )
}

// ── Shell wrapper (unchanged) ───────────────────────────────────────────────
function Shell({ lang, toggleLang, children }: { lang: PortalLang; toggleLang: () => void; children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: BG, fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }} dir={lang === 'he' ? 'rtl' : 'ltr'}>
      <div className="flex items-center justify-between px-5 py-3.5" style={{ background: '#fff', borderBottom: '1px solid #eae6e2' }}>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-bold text-xs" style={{ background: BRAND }}>M</div>
          <span className="text-sm font-bold" style={{ color: '#1a1614', letterSpacing: '-0.02em' }}>MasterLeadFlow</span>
        </div>
        <button
          onClick={toggleLang}
          className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold transition-all hover:opacity-80"
          style={{ background: '#f5f3f0', color: '#9a9590' }}
        >
          <Globe className="w-3 h-3" />
          {lang === 'en' ? 'עברית' : 'EN'}
        </button>
      </div>
      {children}
    </div>
  )
}
```

- [ ] **Step 2: Verify the file compiles**

```bash
cd /Users/bigjeff/Desktop/Leadexpress && npx tsc --noEmit apps/dashboard/src/pages/JobPortal.tsx 2>&1 | head -20
```

Expected: No errors (or only pre-existing project-wide errors unrelated to this file)

- [ ] **Step 3: Commit**

```bash
cd /Users/bigjeff/Desktop/Leadexpress
git add apps/dashboard/src/pages/JobPortal.tsx
git commit -m "feat(portal): rewrite job portal as story-driven conversion page

Replaces 'Approve Job' flow with scrollable story:
- Hero: contractor took your job (fact, not request)
- Value cards: track job, AI matching, reputation
- Trust: team image + social proof
- Signup: 'Take me to my job' CTA
- Auto-accepts job on page load (deal already done)"
```

---

### Task 3: Visual QA — run dev server and verify

**Files:** None (verification only)

- [ ] **Step 1: Start the dashboard dev server**

```bash
cd /Users/bigjeff/Desktop/Leadexpress/apps/dashboard && npm run dev
```

- [ ] **Step 2: Open the portal page in browser**

Navigate to the same URL from the screenshot: `http://localhost:5173/portal/job/4b4c5c70-5540-460a-bcb4-e53df418c4dc`

Verify:
1. Hero shows "מוטי took your job ✅" with profession + location badge
2. Three value cards are visible below the hero
3. Team image loads in trust section
4. Signup form with "Take me to my job" button at bottom
5. Language toggle switches between EN and HE correctly
6. RTL layout works properly in Hebrew mode
7. Mobile responsive (resize to 375px width)

- [ ] **Step 3: Test the signup flow**

Fill in name and phone, click the CTA button. Verify:
1. Button shows loading spinner
2. On success: success screen shows "You're in!" with contractor name
3. On error: alert appears

- [ ] **Step 4: Final commit if any tweaks were needed**

```bash
cd /Users/bigjeff/Desktop/Leadexpress
git add -A
git commit -m "fix(portal): visual tweaks from QA"
```
