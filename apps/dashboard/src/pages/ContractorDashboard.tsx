import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../lib/auth'
import { useI18n } from '../lib/i18n'
import { supabase } from '../lib/supabase'
import { Link } from 'react-router-dom'
import {
  Zap,
  CalendarDays,
  Hash,
  Clock,
  MapPin,
  DollarSign,
  Send,
  User,
  ChevronRight,
  Wifi,
  WifiOff,
  ArrowUpRight,
  TrendingUp,
  Sparkles,
} from 'lucide-react'

/* ───────────────────────── Profession Config ───────────────────────── */

type Profession = 'hvac' | 'renovation' | 'fencing' | 'cleaning'

const PROFESSIONS: Record<Profession, { emoji: string; en: string; he: string; gradient: string }> = {
  hvac:       { emoji: '❄️', en: 'HVAC',           he: 'מזגנים',       gradient: 'from-blue-500/10 to-cyan-500/5' },
  renovation: { emoji: '🔨', en: 'Renovation',     he: 'שיפוצים',     gradient: 'from-orange-500/10 to-amber-500/5' },
  fencing:    { emoji: '🧱', en: 'Fencing',         he: 'גדרות',       gradient: 'from-violet-500/10 to-purple-500/5' },
  cleaning:   { emoji: '✨', en: 'Garage Cleaning', he: 'ניקוי גראז׳', gradient: 'from-emerald-500/10 to-teal-500/5' },
}

/* ───────────────────────── Types ───────────────────────── */

type Urgency = 'hot' | 'warm' | 'cold'

interface Lead {
  id: string
  profession: Profession
  summary: string
  city: string
  zip: string
  urgency: Urgency
  budget: number | null
  created_at: string
}

interface ContractorProfile {
  id: string
  telegram_connected: boolean
  created_at: string
}

/* ───────────────────────── Animated Counter ───────────────────────── */

function AnimatedNumber({ value, duration = 800 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    let start = 0
    const startTime = performance.now()

    function tick(now: number) {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      const current = Math.round(eased * value)

      if (current !== start) {
        start = current
        setDisplay(current)
      }

      if (progress < 1) {
        requestAnimationFrame(tick)
      }
    }

    requestAnimationFrame(tick)
  }, [value, duration])

  return <span ref={ref}>{display}</span>
}

/* ───────────────────────── Helpers ───────────────────────── */

function timeAgo(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diffMs = now - then
  const mins = Math.floor(diffMs / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString()
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
  })
}

function daysRemaining(endDate: string): number {
  const diff = new Date(endDate).getTime() - Date.now()
  return Math.max(0, Math.ceil(diff / 86_400_000))
}

/* ───────────────────────── Mock Data ───────────────────────── */

const MOCK_CONTRACTOR: ContractorProfile = {
  id: '1',
  telegram_connected: true,
  created_at: '2025-09-12T00:00:00Z',
}

const MOCK_LEADS: Lead[] = [
  { id: '1',  profession: 'hvac',       summary: 'Central AC not cooling — 3-bed home in Aventura',                   city: 'Aventura',        zip: '33180', urgency: 'hot',  budget: 4500,  created_at: new Date(Date.now() - 12 * 60_000).toISOString() },
  { id: '2',  profession: 'renovation', summary: 'Full kitchen remodel, quartz counters, new cabinetry',              city: 'Hollywood',       zip: '33019', urgency: 'warm', budget: 25000, created_at: new Date(Date.now() - 45 * 60_000).toISOString() },
  { id: '3',  profession: 'fencing',    summary: 'PVC privacy fence for backyard, ~120 linear ft',                    city: 'Pembroke Pines',  zip: '33028', urgency: 'warm', budget: 6000,  created_at: new Date(Date.now() - 2 * 3600_000).toISOString() },
  { id: '4',  profession: 'cleaning',   summary: 'Full garage cleanout, 2-car garage with storage units',             city: 'Davie',           zip: '33324', urgency: 'cold', budget: null,  created_at: new Date(Date.now() - 4 * 3600_000).toISOString() },
  { id: '5',  profession: 'hvac',       summary: 'Mini-split installation for converted garage office',               city: 'Coral Springs',   zip: '33071', urgency: 'hot',  budget: 3200,  created_at: new Date(Date.now() - 6 * 3600_000).toISOString() },
  { id: '6',  profession: 'renovation', summary: 'Master bathroom renovation — walk-in shower + double vanity',       city: 'Weston',          zip: '33326', urgency: 'hot',  budget: 18000, created_at: new Date(Date.now() - 8 * 3600_000).toISOString() },
  { id: '7',  profession: 'fencing',    summary: 'Aluminum pool fence, meets code, ~80 ft',                           city: 'Plantation',      zip: '33317', urgency: 'cold', budget: 4200,  created_at: new Date(Date.now() - 12 * 3600_000).toISOString() },
  { id: '8',  profession: 'cleaning',   summary: 'Garage deep clean + epoxy floor coating prep',                      city: 'Miramar',         zip: '33023', urgency: 'warm', budget: 800,   created_at: new Date(Date.now() - 18 * 3600_000).toISOString() },
  { id: '9',  profession: 'hvac',       summary: 'Duct cleaning + AC tune-up, 4-bed house',                           city: 'Sunrise',         zip: '33351', urgency: 'cold', budget: null,  created_at: new Date(Date.now() - 24 * 3600_000).toISOString() },
  { id: '10', profession: 'renovation', summary: 'Flooring replacement — 1,200 sq ft, LVP throughout',               city: 'Fort Lauderdale', zip: '33301', urgency: 'warm', budget: 9500,  created_at: new Date(Date.now() - 30 * 3600_000).toISOString() },
]

/* ───────────────────────── Component ───────────────────────── */

export default function ContractorDashboard() {
  const { profile } = useAuth()
  const { t } = useI18n()

  const [leads, setLeads] = useState<Lead[]>(MOCK_LEADS)
  const [contractor, setContractor] = useState<ContractorProfile>(MOCK_CONTRACTOR)
  const [loading, setLoading] = useState(false)
  const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(null)
  const [trialEnd, setTrialEnd] = useState<string | null>(null)
  const [planName, setPlanName] = useState<string>('Starter')

  const displayName = profile?.full_name ?? 'Contractor'
  const firstName = displayName.split(' ')[0]

  /* ── Supabase data fetch (ready for production) ── */
  useEffect(() => {
    if (!profile?.id) return

    let cancelled = false

    async function fetchData() {
      setLoading(true)

      const { data: contractorData } = await supabase
        .from('contractors')
        .select('id, telegram_connected, created_at')
        .eq('profile_id', profile!.id)
        .maybeSingle()

      if (contractorData && !cancelled) {
        setContractor(contractorData as ContractorProfile)
      }

      const { data: leadsData } = await supabase
        .from('leads')
        .select('id, profession, summary, city, zip, urgency, budget, created_at')
        .eq('contractor_id', contractorData?.id ?? profile!.id)
        .order('created_at', { ascending: false })
        .limit(10)

      if (leadsData && !cancelled) {
        setLeads(leadsData as Lead[])
      }

      const { data: subData } = await supabase
        .from('subscriptions')
        .select('status, current_period_end, plans ( name )')
        .eq('user_id', profile!.id)
        .maybeSingle()

      if (subData && !cancelled) {
        setSubscriptionStatus(subData.status ?? null)
        setTrialEnd(subData.current_period_end ?? null)
        const fetchedPlanName = (subData.plans as any)?.name as string | undefined
        if (fetchedPlanName) setPlanName(fetchedPlanName)
      }

      if (!cancelled) setLoading(false)
    }

    fetchData()
    return () => { cancelled = true }
  }, [profile?.id])

  /* ── KPI calculations ── */
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const weekStart = todayStart - 6 * 86_400_000

  const leadsToday = leads.filter((l) => new Date(l.created_at).getTime() >= todayStart).length
  const leadsWeek = leads.filter((l) => new Date(l.created_at).getTime() >= weekStart).length
  const leadsTotal = leads.length
  const activeSince = formatDate(contractor.created_at)

  /* ── Urgency helpers ── */
  const urgencyLabel: Record<Urgency, string> = {
    hot:  t('lead.hot'),
    warm: t('lead.warm'),
    cold: t('lead.cold'),
  }

  /* ── Greeting based on time ── */
  const hour = now.getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  /* ── Render ── */
  if (loading) {
    return (
      <div className="animate-fade-in flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-400 to-green-600 flex items-center justify-center animate-pulse">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <div className="flex flex-col items-center gap-1">
            <p className="text-sm font-medium text-stone-600">Loading your dashboard</p>
            <div className="w-32 h-1 rounded-full bg-stone-100 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-green-400 to-emerald-500 rounded-full"
                style={{ animation: 'shimmer 1.5s ease-in-out infinite', width: '40%' }} />
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8 max-w-[1120px] mx-auto">

      {/* ════════════════════ Hero Header ════════════════════ */}
      <header className="animate-fade-in pt-2">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="space-y-1">
            <p className="text-[13px] font-medium text-stone-400 tracking-wide">
              {greeting}
            </p>
            <h1 className="text-[2.25rem] font-extrabold tracking-tight text-stone-900 leading-[1.1]">
              {t('dash.welcome')}, {firstName}
            </h1>
            <p className="text-[15px] text-stone-400 mt-1.5">
              Here's what's happening with your leads.
            </p>
          </div>

          {/* Plan badge — premium pill */}
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-[13px] font-semibold
              bg-gradient-to-r from-emerald-50 to-green-50 text-emerald-700
              border border-emerald-100
              shadow-sm">
              <Sparkles className="w-3.5 h-3.5" />
              {planName} {t('dash.plan')}
            </span>
          </div>
        </div>
      </header>

      {/* ════════════════════ KPI Cards ════════════════════ */}
      <section className="stagger-kpi grid grid-cols-2 lg:grid-cols-4 gap-4">

        {/* Leads Today — hero card */}
        <div className="kpi-card p-6 group cursor-default">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-sm">
              <Zap className="w-5 h-5 text-white" strokeWidth={2.5} />
            </div>
            <div className="flex items-center gap-1 text-emerald-600 opacity-0 group-hover:opacity-100 transition-opacity">
              <TrendingUp className="w-3.5 h-3.5" />
              <span className="text-[11px] font-bold">+12%</span>
            </div>
          </div>
          <div className="space-y-1">
            <p className="kpi-value text-[2.5rem]">
              <AnimatedNumber value={leadsToday} duration={600} />
            </p>
            <p className="kpi-sub">{t('dash.leads_today')}</p>
          </div>
        </div>

        {/* This Week */}
        <div className="kpi-card p-6 cursor-default">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center shadow-sm">
              <CalendarDays className="w-5 h-5 text-white" strokeWidth={2} />
            </div>
          </div>
          <div className="space-y-1">
            <p className="kpi-value text-[2.5rem]">
              <AnimatedNumber value={leadsWeek} duration={700} />
            </p>
            <p className="kpi-sub">{t('dash.leads_week')}</p>
          </div>
        </div>

        {/* Total Leads */}
        <div className="kpi-card p-6 cursor-default">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-400 to-purple-500 flex items-center justify-center shadow-sm">
              <Hash className="w-5 h-5 text-white" strokeWidth={2.5} />
            </div>
          </div>
          <div className="space-y-1">
            <p className="kpi-value text-[2.5rem]">
              <AnimatedNumber value={leadsTotal} duration={900} />
            </p>
            <p className="kpi-sub">{t('dash.leads_total')}</p>
          </div>
        </div>

        {/* Active Since */}
        <div className="kpi-card p-6 cursor-default">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-400 to-green-500 flex items-center justify-center shadow-sm">
              <Clock className="w-5 h-5 text-white" strokeWidth={2} />
            </div>
          </div>
          <div className="space-y-1">
            <p className="kpi-value text-[1.75rem]">{activeSince}</p>
            <p className="kpi-sub">{t('dash.active_since')}</p>
          </div>
        </div>
      </section>

      {/* ════════════════════ Main Content Grid ════════════════════ */}
      <div className="grid lg:grid-cols-[1fr_300px] gap-8">

        {/* ──────── Recent Leads Feed ──────── */}
        <section className="animate-fade-in" style={{ animationDelay: '200ms' }}>
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-xl font-bold text-stone-800 tracking-tight flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-stone-100 to-stone-50 flex items-center justify-center border border-stone-100">
                <Send size={15} className="text-stone-500" strokeWidth={2} />
              </div>
              {t('dash.recent_leads')}
            </h2>
            <Link
              to="/leads"
              className="text-[13px] font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 transition-colors group"
            >
              View all
              <ArrowUpRight size={14} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </Link>
          </div>

          {leads.length === 0 ? (
            <div className="glass-panel p-12 text-center animate-fade-in">
              <div className="w-16 h-16 rounded-3xl bg-stone-50 flex items-center justify-center mx-auto mb-4">
                <Send size={28} className="text-stone-300" />
              </div>
              <p className="text-stone-400 text-sm leading-relaxed max-w-xs mx-auto">
                {t('dash.no_leads')}
              </p>
            </div>
          ) : (
            <div className="stagger-children space-y-3">
              {leads.map((lead) => {
                const prof = PROFESSIONS[lead.profession]
                return (
                  <article
                    key={lead.id}
                    className={`lead-card lead-card--${lead.profession} p-5 group cursor-pointer`}
                  >
                    <div className="flex items-start justify-between gap-4">

                      {/* Left: content */}
                      <div className="flex-1 min-w-0">
                        {/* Top row: profession + urgency */}
                        <div className="flex items-center gap-2.5 mb-2 flex-wrap">
                          <span className={`prof-pill prof-pill--${lead.profession}`}>
                            {prof.emoji} {prof.en}
                            <span className="opacity-50 mx-0.5">/</span>
                            {prof.he}
                          </span>
                          <span className={`urgency-${lead.urgency}`}>
                            {urgencyLabel[lead.urgency]}
                          </span>
                        </div>

                        {/* Summary */}
                        <p className="text-[14px] text-stone-700 leading-relaxed mb-3 line-clamp-2 font-medium">
                          {lead.summary}
                        </p>

                        {/* Meta row */}
                        <div className="flex items-center gap-4 text-[12px] text-stone-400 flex-wrap">
                          <span className="flex items-center gap-1.5">
                            <MapPin size={13} strokeWidth={2} />
                            {lead.city}, {lead.zip}
                          </span>
                          {lead.budget != null && (
                            <span className="flex items-center gap-1.5 font-semibold text-stone-500">
                              <DollarSign size={13} strokeWidth={2} />
                              ${lead.budget.toLocaleString()}
                            </span>
                          )}
                          <span className="flex items-center gap-1.5">
                            <Clock size={13} strokeWidth={2} />
                            {timeAgo(lead.created_at)}
                          </span>
                        </div>
                      </div>

                      {/* Right: arrow */}
                      <div className="w-8 h-8 rounded-xl bg-stone-50 flex items-center justify-center shrink-0 mt-1
                        group-hover:bg-emerald-50 group-hover:text-emerald-600 transition-all">
                        <ChevronRight size={16} className="text-stone-300 group-hover:text-emerald-500 transition-colors" />
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </section>

        {/* ──────── Quick Status Sidebar ──────── */}
        <aside className="space-y-4 animate-slide-in" style={{ animationDelay: '300ms' }}>
          <h2 className="text-[13px] font-bold text-stone-400 uppercase tracking-[0.1em] mb-1">
            Quick Status
          </h2>

          {/* Telegram connection — premium card */}
          <div className="glass-panel p-5 overflow-hidden relative">
            {contractor.telegram_connected && (
              <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-emerald-50 to-transparent rounded-bl-[40px]" />
            )}
            <div className="flex items-start gap-3.5 relative">
              {contractor.telegram_connected ? (
                <>
                  <div className="relative mt-0.5">
                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-400 to-green-500 flex items-center justify-center shadow-sm">
                      <Wifi size={18} className="text-white" strokeWidth={2.5} />
                    </div>
                    <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-400 rounded-full border-2 border-white">
                      <span className="absolute inset-0 rounded-full animate-ping bg-emerald-400 opacity-50" />
                    </span>
                  </div>
                  <div>
                    <p className="text-[14px] font-bold text-stone-800">
                      Telegram Connected
                    </p>
                    <p className="text-[12px] text-stone-400 mt-0.5 leading-relaxed">
                      Leads are delivered in real-time
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-10 h-10 rounded-2xl bg-stone-100 flex items-center justify-center mt-0.5">
                    <WifiOff size={18} className="text-stone-400" strokeWidth={2} />
                  </div>
                  <div>
                    <p className="text-[14px] font-bold text-stone-800">
                      Telegram Disconnected
                    </p>
                    <p className="text-[12px] text-stone-400 mt-0.5 leading-relaxed">
                      Connect to start receiving leads
                    </p>
                    <Link
                      to="/telegram"
                      className="inline-flex items-center gap-1 mt-2 text-[12px] font-semibold text-emerald-600 hover:text-emerald-700 transition-colors"
                    >
                      Connect now
                      <ArrowUpRight size={12} />
                    </Link>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Current plan — elegant display */}
          <div className="glass-panel p-5">
            <p className="text-[11px] text-stone-400 uppercase tracking-[0.1em] font-semibold mb-2">
              {t('sub.current_plan')}
            </p>
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-extrabold text-stone-800 tracking-tight">
                {planName}
              </p>
              {subscriptionStatus === 'trialing' ? (
                <span className="text-[11px] font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                  Trial{trialEnd ? ` · ${daysRemaining(trialEnd)}d left` : ''}
                </span>
              ) : (
                <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                  Active
                </span>
              )}
            </div>
          </div>

          {/* Profile link — premium card button */}
          <Link
            to="/profile"
            className="glass-panel p-5 flex items-center gap-3.5 group transition-all hover:border-emerald-100"
          >
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-stone-100 to-stone-50 flex items-center justify-center
              group-hover:from-emerald-50 group-hover:to-green-50 transition-all border border-stone-100 group-hover:border-emerald-100">
              <User size={18} className="text-stone-400 group-hover:text-emerald-600 transition-colors" strokeWidth={2} />
            </div>
            <div className="flex-1">
              <p className="text-[14px] font-bold text-stone-700 group-hover:text-stone-800 transition-colors">
                {t('profile.title')}
              </p>
              <p className="text-[11px] text-stone-400">View and edit your profile</p>
            </div>
            <ChevronRight size={16} className="text-stone-300 group-hover:text-emerald-500 group-hover:translate-x-0.5 transition-all" />
          </Link>

          {/* Subscription link */}
          <Link
            to="/subscription"
            className="glass-panel p-5 flex items-center gap-3.5 group transition-all hover:border-emerald-100"
          >
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-stone-100 to-stone-50 flex items-center justify-center
              group-hover:from-emerald-50 group-hover:to-green-50 transition-all border border-stone-100 group-hover:border-emerald-100">
              <TrendingUp size={18} className="text-stone-400 group-hover:text-emerald-600 transition-colors" strokeWidth={2} />
            </div>
            <div className="flex-1">
              <p className="text-[14px] font-bold text-stone-700 group-hover:text-stone-800 transition-colors">
                {t('sub.title')}
              </p>
              <p className="text-[11px] text-stone-400">Manage your plan</p>
            </div>
            <ChevronRight size={16} className="text-stone-300 group-hover:text-emerald-500 group-hover:translate-x-0.5 transition-all" />
          </Link>
        </aside>
      </div>
    </div>
  )
}
