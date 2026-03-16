import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../lib/auth'
import { useI18n } from '../lib/i18n'
import { supabase } from '../lib/supabase'
import { useContractorSettings } from '../hooks/useContractorSettings'
import { PROFESSIONS } from '../lib/professions'
import { DAY_KEYS, DAY_LABELS, type WorkingHours, type DayKey } from '../lib/working-hours'
import { Link } from 'react-router-dom'
import {
  Zap,
  CalendarDays,
  Hash,
  Clock,
  MapPin,
  ChevronRight,
  Wifi,
  WifiOff,
  Sparkles,
  Pencil,
  Send,
} from 'lucide-react'
import CoverageMap from '../components/settings/CoverageMap'

/* ───────────────────── Types ───────────────────── */

type Urgency = 'hot' | 'warm' | 'cold'

interface Lead {
  id: string
  profession: string
  parsed_summary: string | null
  raw_message: string | null
  city: string | null
  zip_code: string | null
  urgency: Urgency
  budget_range: string | null
  sender_id: string | null
  created_at: string
  group_name: string | null
}

function formatSender(senderId: string | null): string {
  if (!senderId) return ''
  // "972544777297@c.us" → "+972544777297"
  return '+' + senderId.replace(/@.*$/, '')
}

/* ───────────────────── Animated Counter ───────────────────── */

function AnimatedNumber({ value, duration = 800 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    let start = 0
    const startTime = performance.now()

    function tick(now: number) {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      const current = Math.round(eased * value)

      if (current !== start) {
        start = current
        setDisplay(current)
      }

      if (progress < 1) requestAnimationFrame(tick)
    }

    requestAnimationFrame(tick)
  }, [value, duration])

  return <span ref={ref}>{display}</span>
}

/* ───────────────────── Helpers ───────────────────── */

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString()
}

function compactSchedule(hours: WorkingHours, locale: string): string {
  const groups: { days: DayKey[]; start: string; end: string }[] = []

  for (const day of DAY_KEYS) {
    const s = hours[day]
    if (!s.enabled) continue
    const last = groups[groups.length - 1]
    if (last && last.start === s.start && last.end === s.end) {
      last.days.push(day)
    } else {
      groups.push({ days: [day], start: s.start, end: s.end })
    }
  }

  if (groups.length === 0) return locale === 'he' ? 'אין ימי עבודה' : 'No working days'

  return groups.map((g) => {
    const labels = DAY_LABELS
    const first = locale === 'he' ? labels[g.days[0]].he : labels[g.days[0]].en.slice(0, 3)
    const last = g.days.length > 1
      ? (locale === 'he' ? labels[g.days[g.days.length - 1]].he : labels[g.days[g.days.length - 1]].en.slice(0, 3))
      : null
    const range = last ? `${first}–${last}` : first
    return `${range} ${g.start}–${g.end}`
  }).join(' · ')
}

/* ───────────────────── (no mock data — real Supabase) ───────────────────── */

/* ───────────────────── Component ───────────────────── */

export default function ContractorDashboard() {
  const { profile } = useAuth()
  const { locale, t } = useI18n()
  const { professions: selectedProfs, zipCodes, workingHours, loading: settingsLoading } = useContractorSettings()

  const [leads, setLeads] = useState<Lead[]>([])
  const [telegramConnected, setTelegramConnected] = useState(true)
  const [planName, setPlanName] = useState('Starter')

  const displayName = profile?.full_name ?? 'Contractor'
  const firstName = displayName.split(' ')[0]

  /* ── Supabase fetch ── */
  useEffect(() => {
    if (!profile?.id) return
    let cancelled = false

    async function fetchData() {
      const { data: leadsData } = await supabase
        .from('leads')
        .select('id, profession, parsed_summary, raw_message, city, zip_code, urgency, budget_range, sender_id, created_at, groups ( name )')
        .order('created_at', { ascending: false })
        .limit(10)

      if (leadsData && !cancelled) {
        setLeads(leadsData.map((row: any) => ({
          ...row,
          group_name: row.groups?.name ?? null,
        })))
      }

      const { data: subData } = await supabase
        .from('subscriptions')
        .select('status, plans ( name )')
        .eq('user_id', profile!.id)
        .maybeSingle()

      if (subData && !cancelled) {
        const fetchedPlan = (subData.plans as any)?.name as string | undefined
        if (fetchedPlan) setPlanName(fetchedPlan)
      }

      const { data: profData } = await supabase
        .from('profiles')
        .select('telegram_chat_id')
        .eq('id', profile!.id)
        .maybeSingle()

      if (profData && !cancelled) {
        setTelegramConnected(!!profData.telegram_chat_id)
      }
    }

    fetchData()
    return () => { cancelled = true }
  }, [profile?.id])

  /* ── KPIs ── */
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const weekStart = todayStart - 6 * 86_400_000
  const leadsToday = leads.filter((l) => new Date(l.created_at).getTime() >= todayStart).length
  const leadsWeek = leads.filter((l) => new Date(l.created_at).getTime() >= weekStart).length
  const leadsTotal = leads.length

  const hour = now.getHours()
  const greeting = locale === 'he'
    ? (hour < 12 ? 'בוקר טוב' : hour < 18 ? 'צהריים טובים' : 'ערב טוב')
    : (hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening')

  /* ── Profession lookup ── */
  const profLookup = Object.fromEntries(PROFESSIONS.map((p) => [p.id, p]))

  const urgencyColors: Record<Urgency, string> = {
    hot: 'bg-red-50 text-red-600',
    warm: 'bg-amber-50 text-amber-600',
    cold: 'bg-blue-50 text-blue-600',
  }

  if (settingsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4 animate-fade-in">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-400 to-green-600 flex items-center justify-center animate-pulse">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <p className="text-sm font-medium text-stone-500">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative" style={{ height: '100vh', minHeight: 600 }}>

      {/* ════════ FULL-PAGE MAP (background) ════════ */}
      <div className="absolute inset-0 z-0">
        <CoverageMap zipCodes={zipCodes} />
      </div>

      {/* Subtle vignette for panel readability */}
      <div className="absolute inset-0 z-[1] pointer-events-none"
        style={{
          background: 'linear-gradient(135deg, rgba(255,255,255,0.5) 0%, transparent 40%, transparent 60%, rgba(255,255,255,0.3) 100%)',
        }}
      />

      {/* ════════ LEFT FLOATING PANEL (Profile + KPIs + Professions + Schedule) ════════ */}
      <div
        className="floating-panel p-6 animate-fade-in"
        style={{ top: 24, left: 24, width: 340, maxHeight: 'calc(100vh - 80px)', overflowY: 'auto' }}
      >
        {/* Greeting */}
        <div className="mb-5">
          <p className="text-[11px] font-semibold text-stone-400 uppercase tracking-[0.1em]">{greeting}</p>
          <h1 className="text-2xl font-extrabold text-stone-900 tracking-tight leading-tight mt-1">
            {t('dash.welcome')}, {firstName}
          </h1>
          <div className="flex items-center gap-2 mt-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-gradient-to-r from-emerald-50 to-green-50 text-emerald-700 border border-emerald-100">
              <Sparkles className="w-3 h-3" />
              {planName}
            </span>
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${telegramConnected ? 'bg-emerald-50 text-emerald-600' : 'bg-stone-100 text-stone-400'}`}>
              {telegramConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
              {telegramConnected ? 'Telegram' : 'Offline'}
            </span>
          </div>
        </div>

        {/* KPI Strip */}
        <div className="grid grid-cols-3 gap-2 mb-5">
          {[
            { value: leadsToday, label: locale === 'he' ? 'היום' : 'Today', icon: Zap, gradient: 'from-amber-400 to-orange-500' },
            { value: leadsWeek, label: locale === 'he' ? 'השבוע' : 'Week', icon: CalendarDays, gradient: 'from-blue-400 to-indigo-500' },
            { value: leadsTotal, label: locale === 'he' ? 'סה"כ' : 'Total', icon: Hash, gradient: 'from-violet-400 to-purple-500' },
          ].map((kpi) => (
            <div key={kpi.label} className="rounded-2xl bg-white/60 border border-white/80 p-3 text-center">
              <div className={`w-7 h-7 rounded-xl bg-gradient-to-br ${kpi.gradient} flex items-center justify-center mx-auto mb-1.5`}>
                <kpi.icon className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
              </div>
              <p className="text-xl font-extrabold text-stone-900 tracking-tight leading-none">
                <AnimatedNumber value={kpi.value} duration={600} />
              </p>
              <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wide mt-0.5">{kpi.label}</p>
            </div>
          ))}
        </div>

        {/* Divider */}
        <div className="h-px bg-stone-200/60 mb-4" />

        {/* Professions Showcase */}
        <div className="mb-4">
          <p className="text-[11px] font-semibold text-stone-400 uppercase tracking-[0.1em] mb-2.5">
            {locale === 'he' ? 'מקצועות' : 'My Services'}
          </p>
          <div className="grid grid-cols-4 gap-1.5">
            {PROFESSIONS.map((prof) => {
              const active = selectedProfs.includes(prof.id)
              return (
                <div
                  key={prof.id}
                  className={[
                    'flex flex-col items-center gap-1 rounded-2xl py-2.5 px-1 text-center transition-all duration-200',
                    active
                      ? 'bg-emerald-50/80 ring-1.5 ring-emerald-200 shadow-sm'
                      : 'opacity-25',
                  ].join(' ')}
                  title={locale === 'he' ? prof.he : prof.en}
                >
                  <span className="text-lg leading-none">{prof.emoji}</span>
                  <span className="text-[9px] font-semibold text-stone-600 truncate w-full leading-tight">
                    {locale === 'he' ? prof.he : prof.en}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-stone-200/60 mb-4" />

        {/* Schedule Compact */}
        <div className="mb-3">
          <p className="text-[11px] font-semibold text-stone-400 uppercase tracking-[0.1em] mb-2">
            {locale === 'he' ? 'שעות עבודה' : 'Schedule'}
          </p>
          <div className="flex items-center gap-1.5 flex-wrap">
            {DAY_KEYS.map((day) => {
              const s = workingHours[day]
              return (
                <span
                  key={day}
                  className={[
                    'inline-flex items-center px-2 py-1 rounded-lg text-[10px] font-semibold transition-all',
                    s.enabled
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                      : 'bg-stone-50 text-stone-300 border border-stone-100',
                  ].join(' ')}
                  title={s.enabled ? `${s.start}–${s.end}` : 'Off'}
                >
                  {locale === 'he' ? DAY_LABELS[day].he.charAt(0) : DAY_LABELS[day].en.slice(0, 2)}
                </span>
              )
            })}
          </div>
          <p className="text-[10px] text-stone-400 mt-1.5">
            {compactSchedule(workingHours, locale)}
          </p>
        </div>

        {/* Edit link */}
        <Link
          to="/settings"
          className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600 hover:text-emerald-700 transition-colors mt-2"
        >
          <Pencil className="w-3 h-3" />
          {locale === 'he' ? 'ערוך הגדרות' : 'Edit settings'}
        </Link>
      </div>

      {/* ════════ BOTTOM-RIGHT FLOATING PANEL (Recent Leads) ════════ */}
      <div
        className="floating-panel p-5 animate-fade-in"
        style={{ bottom: 24, right: 24, width: 560, maxHeight: 340, animationDelay: '150ms' }}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-stone-800 flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-stone-100 to-stone-50 flex items-center justify-center border border-stone-100">
              <Send size={12} className="text-stone-500" />
            </div>
            {t('dash.recent_leads')}
          </h2>
          <Link
            to="/leads"
            className="text-[11px] font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-0.5 transition-colors"
          >
            {locale === 'he' ? 'הכל' : 'View all'}
            <ChevronRight size={12} />
          </Link>
        </div>

        {/* Horizontal scroll — dual-layer lead cards */}
        <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
          {leads.slice(0, 8).map((lead) => {
            const prof = profLookup[lead.profession]
            return (
              <div
                key={lead.id}
                className="shrink-0 w-[260px] rounded-2xl bg-white/70 border border-white/80 overflow-hidden hover:bg-white hover:shadow-md transition-all cursor-pointer group"
              >
                {/* ─── Top layer: AI Summary ─── */}
                <div className="p-3.5 pb-2.5">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-base">{prof?.emoji ?? '📋'}</span>
                    <span className="text-[11px] font-semibold text-stone-600 truncate">
                      {prof ? (locale === 'he' ? prof.he : prof.en) : lead.profession}
                    </span>
                    <span className={`ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded-full ${urgencyColors[lead.urgency]}`}>
                      {lead.urgency === 'hot' ? '🔥' : lead.urgency === 'warm' ? '⏰' : '❄️'}
                    </span>
                  </div>
                  <p className="text-[12px] text-stone-700 font-medium line-clamp-2 leading-snug mb-2">
                    {lead.parsed_summary ?? lead.raw_message?.slice(0, 80) ?? '—'}
                  </p>
                  <div className="flex items-center gap-2 text-[10px] text-stone-400">
                    {lead.city && (
                      <span className="flex items-center gap-0.5">
                        <MapPin size={10} />
                        {lead.city}
                      </span>
                    )}
                    {lead.budget_range && (
                      <span className="font-semibold text-stone-500">{lead.budget_range}</span>
                    )}
                    <span className="ml-auto flex items-center gap-0.5">
                      <Clock size={10} />
                      {timeAgo(lead.created_at)}
                    </span>
                  </div>
                </div>

                {/* ─── Bottom layer: Original WhatsApp message + metadata ─── */}
                <div className="border-t border-stone-100 bg-stone-50/60 px-3.5 py-2.5">
                  {lead.raw_message && (
                    <p className="text-[10px] text-stone-400 line-clamp-2 leading-relaxed mb-1.5 font-mono whitespace-pre-line">
                      {lead.raw_message}
                    </p>
                  )}
                  <div className="flex items-center gap-2 text-[9px] text-stone-400">
                    {lead.group_name && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600 font-semibold truncate max-w-[120px]">
                        💬 {lead.group_name}
                      </span>
                    )}
                    {lead.sender_id && (
                      <span className="text-stone-400 truncate max-w-[100px]">
                        {formatSender(lead.sender_id)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}

          {leads.length === 0 && (
            <div className="flex items-center justify-center w-full py-6 text-sm text-stone-400">
              {locale === 'he' ? 'אין לידים עדיין' : 'No leads yet'}
            </div>
          )}
        </div>
      </div>

      {/* ════════ TOP-RIGHT: ZIP Count Badge ════════ */}
      <div
        className="floating-panel px-4 py-2.5 animate-fade-in flex items-center gap-2"
        style={{ top: 24, right: 24, animationDelay: '200ms' }}
      >
        <MapPin className="w-3.5 h-3.5 text-emerald-600" />
        <span className="text-[12px] font-semibold text-stone-700">
          {zipCodes.length} {locale === 'he' ? 'אזורים' : 'zones'}
        </span>
      </div>
    </div>
  )
}
