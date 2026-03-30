import { useState, useEffect, useRef, useCallback, useMemo, lazy, Suspense } from 'react'
import { useAuth } from '../lib/auth'
import { useI18n } from '../lib/i18n'
import { timeAgo } from '../lib/shared'
import { supabase } from '../lib/supabase'
import { useContractorSettings } from '../hooks/useContractorSettings'
import { PROFESSIONS, type ProfessionId } from '../lib/professions'
import { DAY_KEYS, DAY_LABELS, type WorkingHours, type DayKey } from '../lib/working-hours'
import { Link } from 'react-router-dom'
import {
  Zap,
  CalendarDays,
  Hash,
  Phone,
  Clock,
  MapPin,
  ChevronRight,
  ChevronDown,
  Wifi,
  WifiOff,
  Sparkles,
  Check,
  CheckCircle2,
  Send,
  X,
  SlidersHorizontal,
  Eye,
  Bell,
  Download,
} from 'lucide-react'
const CoverageMap = lazy(() => import('../components/settings/CoverageMap'))
import ForwardLeadModal from '../components/ForwardLeadModal'
import UpsellModal from '../components/UpsellModal'
import NetworkPointsCard from '../components/NetworkPointsCard'
import ProfileCompletionBar from '../components/ProfileCompletionBar'
import ProfileOnboarding from '../components/ProfileOnboarding'
import { useContractorProfile } from '../hooks/useContractorProfile'
import { useSubscriptionAccess } from '../hooks/useSubscriptionAccess'
import { usePushNotifications } from '../hooks/usePushNotifications'
import InstallAnimation, { SwipeConfirmButton } from '../components/InstallAnimation'
import OnboardingProgress from '../components/OnboardingProgress'
import EnableAlertsScreen from '../components/EnableAlertsScreen'
import { useOnboardingOverlay } from '../components/OnboardingOverlayContext'

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
  const { profile, effectiveUserId, impersonatedProfile } = useAuth()
  const { locale, t } = useI18n()
  const {
    professions: selectedProfs,
    zipCodes,
    workingHours,
    loading: settingsLoading,
    addZipCode,
    addZipCodes,
    removeZipCode,
    toggleProfession,
    setWorkingHours,
    save: saveSettings,
    saving,
    saved,
    planLimits,
  } = useContractorSettings()

  const [leads, setLeads] = useState<Lead[]>([])
  const [contactedCount, setContactedCount] = useState(0)
  const [telegramConnected, setTelegramConnected] = useState(true)
  const [counties, setCounties] = useState<string[]>([])
  const [forwardLead, setForwardLead] = useState<Lead | null>(null)
  const [showUpsell, setShowUpsell] = useState(false)

  const [upsellContext, setUpsellContext] = useState<'zones' | 'professions' | 'subs'>('subs')
  const [newZip, setNewZip] = useState('')
  const [showProfPicker, setShowProfPicker] = useState(false)
  const [showScheduleEditor, setShowScheduleEditor] = useState(false)
  const profPickerRef = useRef<HTMLDivElement>(null)
  const scheduleRef = useRef<HTMLDivElement>(null)
  
  const { planName, canManageSubs } = useSubscriptionAccess()
  const { data: contractorData } = useContractorProfile()
  const { status: pushStatus, enable: enablePush, isLoading: pushLoading } = usePushNotifications()
  const [pushDismissed, setPushDismissed] = useState(() => sessionStorage.getItem('push_banner_dismissed') === '1')
  const [viewStats, setViewStats] = useState<{ views_this_week: number } | null>(null)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [onboardingStep, setOnboardingStep] = useState<string | null>(null)
  const { setActive: setOnboardingOverlayActive } = useOnboardingOverlay()

  // Fetch onboarding step to show install/alerts overlay
  useEffect(() => {
    if (!effectiveUserId) return
    supabase.from('contractors').select('onboarding_step').eq('user_id', effectiveUserId).maybeSingle()
      .then(({ data, error }) => {
        if (error) { console.warn('Failed to fetch onboarding_step:', error); return }
        if (data?.onboarding_step && data.onboarding_step !== 'push_enabled') {
          setOnboardingStep(data.onboarding_step)
        }
      })
  }, [effectiveUserId])

  // Auto-advance onboarding steps (in useEffect, not during render)
  useEffect(() => {
    if (!onboardingStep || !effectiveUserId) return

    const standalone = window.matchMedia('(display-mode: standalone)').matches
      || ('standalone' in navigator && (navigator as any).standalone === true)
    const mobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)

    // Desktop or already installed → skip install step
    if ((onboardingStep === 'registered' || onboardingStep === 'credentials_set') && (!mobile || standalone)) {
      supabase.from('contractors').update({ onboarding_step: 'installed' }).eq('user_id', effectiveUserId)
        .then(() => setOnboardingStep('installed'))
      return
    }

    // Push already granted/unsupported/denied → skip alerts step
    if (onboardingStep === 'installed' && pushStatus !== 'loading' && pushStatus !== 'default') {
      supabase.from('contractors').update({ onboarding_step: 'push_enabled' }).eq('user_id', effectiveUserId)
        .then(() => setOnboardingStep(null))
    }
  }, [onboardingStep, pushStatus, effectiveUserId])

  // Signal to AppShell whether onboarding overlay is active (hides sidebar/banners)
  useEffect(() => {
    const isOverlayActive = onboardingStep !== null && onboardingStep !== 'push_enabled'
    setOnboardingOverlayActive(isOverlayActive)
    return () => setOnboardingOverlayActive(false)
  }, [onboardingStep, setOnboardingOverlayActive])

  // Fetch profile view stats
  useEffect(() => {
    if (!effectiveUserId || !contractorData?.profile?.slug) return
    supabase.rpc('get_profile_view_stats', { p_user_id: effectiveUserId })
      .then(({ data }) => { if (data) setViewStats(data) })
  }, [effectiveUserId, contractorData?.profile?.slug])

  // Show onboarding modal when profile is very incomplete
  useEffect(() => {
    if (!contractorData) return
    const completeness = contractorData.profile?.profile_completeness ?? 100
    const dismissed = localStorage.getItem('mlf_onboarding_dismissed') === 'true'
    if (completeness < 30 && !dismissed) {
      setShowOnboarding(true)
    }
  }, [contractorData])

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (profPickerRef.current && !profPickerRef.current.contains(e.target as Node)) {
        setShowProfPicker(false)
      }
      if (scheduleRef.current && !scheduleRef.current.contains(e.target as Node)) {
        setShowScheduleEditor(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Debounced auto-save — use ref so the timeout always calls the latest save function
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const saveRef = useRef(saveSettings)
  saveRef.current = saveSettings
  const debouncedSave = useCallback(() => {
    clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = setTimeout(() => saveRef.current(), 600)
  }, [])

  const handleToggleProfession = (id: ProfessionId) => {
    // If adding (not removing) and at limit → upsell
    if (!selectedProfs.includes(id) && planLimits.maxProfessions > 0 && selectedProfs.length >= planLimits.maxProfessions) {
      setUpsellContext('professions')
      setShowUpsell(true)
      return
    }
    toggleProfession(id)
    debouncedSave()
  }

  const handleToggleDay = (day: DayKey) => {
    setWorkingHours((prev: WorkingHours) => ({ ...prev, [day]: { ...prev[day], enabled: !prev[day].enabled } }))
    debouncedSave()
  }

  const handleSetTime = (day: DayKey, field: 'start' | 'end', value: string) => {
    setWorkingHours((prev: WorkingHours) => ({ ...prev, [day]: { ...prev[day], [field]: value } }))
    debouncedSave()
  }

  const handleAddZip = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newZip.trim()) return
    // Check if at plan limit before trying
    if (planLimits.maxZipCodes > 0 && zipCodes.length >= planLimits.maxZipCodes) {
      setUpsellContext('zones')
      setShowUpsell(true)
      return
    }
    const added = addZipCode(newZip)
    if (added) {
      setNewZip('')
      debouncedSave()
    }
  }

  const handleRemoveZip = (zip: string) => {
    removeZipCode(zip)
    debouncedSave()
  }

  const activeProfile = impersonatedProfile || profile
  const displayName = activeProfile?.full_name ?? 'Contractor'
  const firstName = displayName.split(' ')[0]

  /* ── Supabase fetch ── */
  useEffect(() => {
    if (!effectiveUserId) return
    let cancelled = false

    async function fetchData() {
      let query = supabase
        .from('leads')
        .select('id, profession, parsed_summary, raw_message, city, zip_code, urgency, budget_range, sender_id, created_at, groups ( name )')
        .order('created_at', { ascending: false })
        .limit(50)

      // Apply same filters as My Leads page so counts stay in sync
      if (selectedProfs.length > 0) query = query.in('profession', selectedProfs)
      if (zipCodes.length > 0) query = query.in('zip_code', zipCodes)

      const { data: leadsData } = await query

      if (leadsData && !cancelled) {
        setLeads(leadsData.map((row: any) => ({
          ...row,
          group_name: row.groups?.name ?? null,
        })))
      }

      const { data: profData } = await supabase
        .from('profiles')
        .select('telegram_chat_id, counties')
        .eq('id', effectiveUserId)
        .maybeSingle()

      if (profData && !cancelled) {
        setTelegramConnected(!!profData.telegram_chat_id)
        if (profData.counties) setCounties(profData.counties)
      }

      // Fetch how many leads this user contacted
      const { count } = await supabase
        .from('lead_contact_events')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', effectiveUserId)

      if (!cancelled && count !== null) {
        setContactedCount(count)
      }
    }

    fetchData()
    return () => { cancelled = true }
  }, [effectiveUserId, selectedProfs, zipCodes])

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
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#fe5b25] to-[#e04d1c] flex items-center justify-center animate-pulse">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <p className="text-sm font-medium text-stone-500">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  // Show install overlay on mobile (auto-advance handled by useEffect above)
  if (onboardingStep === 'registered' || onboardingStep === 'credentials_set') {
    const platform = /iPhone|iPad|iPod/i.test(navigator.userAgent) ? 'ios' as const
      : /Android/i.test(navigator.userAgent) ? 'android' as const : null
    const standalone = window.matchMedia('(display-mode: standalone)').matches
      || ('standalone' in navigator && (navigator as any).standalone === true)

    // Only show overlay on mobile + not standalone (desktop/standalone auto-advances via useEffect)
    if (platform && !standalone) {
      const advanceInstallStep = async () => {
        try {
          if (!effectiveUserId) { console.error('No effectiveUserId'); return }
          const { error } = await supabase.from('contractors').update({ onboarding_step: 'installed' }).eq('user_id', effectiveUserId)
          if (error) console.error('Update onboarding_step failed:', error)
        } catch (err) {
          console.error('Install step error:', err)
        }
        setOnboardingStep('installed')
      }

      // Android: try native install prompt first (one tap!)
      const handleAndroidInstall = async () => {
        const deferredPrompt = (window as any).__pwaInstallPrompt
        if (deferredPrompt) {
          deferredPrompt.prompt()
          const { outcome } = await deferredPrompt.userChoice
          if (outcome === 'accepted') {
            ;(window as any).__pwaInstallPrompt = null
            advanceInstallStep()
          }
        }
      }

      const isAndroidWithPrompt = platform === 'android' && !!(window as any).__pwaInstallPrompt

      return (
        <div className="min-h-screen flex flex-col bg-white">
          <div className="flex-1 flex flex-col px-5 pt-8 pb-6 max-w-md mx-auto w-full">
            <OnboardingProgress current={2} />
            <div className="flex items-center justify-center gap-2 mb-3">
              <img src="/icon.png" alt="" className="w-7 h-7 rounded-xl" />
              <span className="text-sm font-semibold text-gray-900">MasterLeadFlow</span>
            </div>
            <div className="text-center mb-3">
              <h1 className="text-xl font-bold text-gray-900 mb-1">Get instant lead alerts</h1>
              <p className="text-gray-500 text-sm">Install the app to receive job notifications the moment they match your area</p>
              <div className="mt-2 mx-auto max-w-[280px] bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                <p className="text-amber-700 text-xs font-semibold">⚠️ Required step</p>
                <p className="text-amber-600 text-[11px] mt-0.5">Without installing, you won't get notified and other contractors will grab your leads first</p>
              </div>
              <p className="text-[11px] text-gray-400 mt-2">✅ 5,000+ contractors already get instant alerts</p>
            </div>

            {isAndroidWithPrompt ? (
              /* Android with native prompt — skip animation, one-tap install */
              <div className="flex-1 flex flex-col items-center justify-center gap-6">
                <div className="w-24 h-24 rounded-[20px] bg-[#fe5b25] flex items-center justify-center shadow-xl shadow-[#fe5b25]/20">
                  <span className="text-white font-bold text-2xl">MLF</span>
                </div>
                <div className="text-center">
                  <p className="text-base font-semibold text-gray-800">One tap to install</p>
                  <p className="text-sm text-gray-400 mt-1">Takes 2 seconds</p>
                </div>
                <button
                  onClick={handleAndroidInstall}
                  className="w-full max-w-[280px] py-4 rounded-2xl text-lg font-bold text-white flex items-center justify-center gap-3 transition-all hover:brightness-110 active:scale-[0.97]"
                  style={{ background: '#fe5b25', boxShadow: '0 6px 30px #fe5b2540' }}
                >
                  <Download className="w-6 h-6" />
                  Install Now
                </button>
              </div>
            ) : (
              /* iOS or Android without prompt — show step-by-step animation */
              <>
                <div className="flex-1 flex flex-col items-center justify-center">
                  <InstallAnimation platform={platform} />
                </div>
                <div className="space-y-3 mt-4">
                  <p className="text-center text-xs text-gray-400 font-medium">
                    ✅ After installing, swipe to continue
                  </p>
                  <SwipeConfirmButton
                    onConfirm={advanceInstallStep}
                    label="Swipe after installing →"
                  />
                </div>
              </>
            )}

            <button
              onClick={advanceInstallStep}
              className="w-full py-2 mt-2 text-[11px] text-gray-300 hover:text-gray-500 transition-colors text-center"
            >
              skip
            </button>
          </div>
        </div>
      )
    }
  }

  // Show enable alerts overlay (auto-advance for non-default handled by useEffect)
  if (onboardingStep === 'installed' && pushStatus === 'default') {
    return <EnableAlertsScreen onComplete={() => setOnboardingStep(null)} />
  }

  return (
    <div className="relative md:h-screen" style={{ minHeight: 600 }}>

      {/* ════════ MOBILE HOME ════════ */}
      <div className="md:hidden min-h-screen bg-gradient-to-b from-gray-50 via-white to-gray-50 pb-28 overflow-y-auto no-scrollbar">
        <div className="px-4 pt-5 space-y-4">

          {/* Greeting + plan */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-stone-400 font-medium">{greeting}</p>
              <h1 className="text-xl font-extrabold text-stone-900 tracking-tight">Hi, {firstName} 👋</h1>
            </div>
            <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-orange-50 text-[#e04d1c] border border-orange-100 flex items-center gap-1">
              <Sparkles className="w-3 h-3" />{planName}
            </span>
          </div>

          {/* Hot lead card */}
          {leads.length > 0 && (() => {
            const lead = leads[0]
            const prof = profLookup[lead.profession]
            return (
              <Link
                to={`/leads/${lead.id}`}
                className="block rounded-3xl p-4 shadow-lg shadow-orange-200/40 active:scale-[0.98] transition-transform"
                style={{ background: 'linear-gradient(135deg, #fe5b25, #e04d1c)' }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-white/80 text-xs font-semibold">Latest Lead</span>
                  <span className="text-white text-xs bg-white/20 px-2 py-0.5 rounded-full font-semibold">
                    {lead.urgency === 'hot' ? '🔥 Hot' : lead.urgency === 'warm' ? '⏰ Warm' : '❄️ Cold'}
                  </span>
                </div>
                <p className="text-white font-bold text-sm leading-snug mb-3 line-clamp-2">
                  {lead.parsed_summary ?? lead.raw_message?.slice(0, 100) ?? '—'}
                </p>
                <div className="flex items-center gap-3 text-white/70 text-xs">
                  <span>{prof?.emoji ?? '📋'} {prof ? prof.en : lead.profession}</span>
                  {lead.city && <span>📍 {lead.city}</span>}
                  <span className="ml-auto">{timeAgo(lead.created_at)}</span>
                </div>
              </Link>
            )
          })()}

          {/* KPI grid */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { value: leadsToday, label: 'Today', color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100' },
              { value: leadsWeek, label: 'Week', color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100' },
              { value: leadsTotal, label: 'Total', color: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-100' },
              { value: contactedCount, label: 'Contacts', color: 'text-[#e04d1c]', bg: 'bg-orange-50', border: 'border-orange-100' },
            ].map(kpi => (
              <div key={kpi.label} className={`rounded-2xl ${kpi.bg} border ${kpi.border} p-3 text-center`}>
                <p className={`text-lg font-extrabold ${kpi.color} leading-none`}>
                  <AnimatedNumber value={kpi.value} duration={600} />
                </p>
                <p className="text-[9px] font-semibold text-stone-400 uppercase tracking-wide mt-1">{kpi.label}</p>
              </div>
            ))}
          </div>

          {/* Profile completion */}
          {contractorData && (contractorData.profile?.profile_completeness ?? 100) < 100 && (
            <ProfileCompletionBar
              completeness={contractorData.profile?.profile_completeness ?? 0}
              profile={contractorData}
            />
          )}

          {/* Recent leads */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-stone-800">Recent Leads</h2>
              <Link to="/leads" className="text-xs font-bold text-[#fe5b25]">View all →</Link>
            </div>
            <div className="space-y-2">
              {leads.slice(0, 5).map(lead => {
                const prof = profLookup[lead.profession]
                const borderColor = lead.urgency === 'hot' ? '#fe5b25' : lead.urgency === 'warm' ? '#f59e0b' : '#3b82f6'
                return (
                  <Link
                    key={lead.id}
                    to={`/leads/${lead.id}`}
                    className="block rounded-2xl bg-white border border-stone-100 p-3.5 shadow-sm active:scale-[0.98] transition-transform"
                    style={{ borderLeft: `3px solid ${borderColor}` }}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm">{prof?.emoji ?? '📋'}</span>
                      <span className="text-xs font-bold text-stone-700">{prof?.en ?? lead.profession}</span>
                      <span className="ml-auto text-[10px] text-stone-400">{timeAgo(lead.created_at)}</span>
                    </div>
                    <p className="text-xs text-stone-500 line-clamp-2 leading-relaxed">
                      {lead.parsed_summary ?? lead.raw_message?.slice(0, 80) ?? '—'}
                    </p>
                    {lead.city && <p className="text-[10px] text-stone-400 mt-1">📍 {lead.city}</p>}
                  </Link>
                )
              })}
              {leads.length === 0 && (
                <div className="rounded-2xl bg-stone-50 border border-stone-100 p-6 text-center">
                  <p className="text-stone-400 text-sm">No leads yet</p>
                  <p className="text-stone-300 text-xs mt-1">Add services and areas to start receiving leads</p>
                </div>
              )}
            </div>
          </div>

          {/* Services */}
          <div className="rounded-2xl bg-white border border-stone-100 p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-stone-500 uppercase tracking-wider">My Services</h3>
              <Link to="/profile" className="text-xs text-[#fe5b25] font-bold">Edit →</Link>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {selectedProfs.length > 0 ? selectedProfs.map(id => {
                const p = profLookup[id]
                return p ? (
                  <span key={id} className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-orange-50 border border-orange-100 rounded-xl text-xs font-semibold text-orange-700">
                    {p.emoji} {p.en}
                  </span>
                ) : null
              }) : <span className="text-xs text-stone-400">No services selected</span>}
            </div>
          </div>

          {/* Service Areas */}
          <div className="rounded-2xl bg-white border border-stone-100 p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-stone-500 uppercase tracking-wider">Service Areas</h3>
              <span className="text-xs text-stone-400">
                {counties.length > 0 ? `${counties.length} counties` : `${zipCodes.length} zones`}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {counties.length > 0 ? counties.map(c => (
                <span key={c} className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-blue-50 border border-blue-100 rounded-xl text-xs font-semibold text-blue-700">
                  <MapPin className="w-3 h-3" />{c}
                </span>
              )) : zipCodes.slice(0, 8).map(z => (
                <span key={z} className="px-2.5 py-1.5 bg-stone-50 border border-stone-100 rounded-xl text-xs font-mono text-stone-600">{z}</span>
              ))}
              {counties.length === 0 && zipCodes.length === 0 && (
                <span className="text-xs text-stone-400">No areas added yet</span>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* ════════ MAP ════════ */}
      {/* Desktop only */}
      <div className="hidden md:block fixed inset-0 z-0">
        <Suspense fallback={<div className="w-full h-full bg-gray-100 animate-pulse" />}>
        <CoverageMap
          zipCodes={zipCodes}
          onAddZip={(zip) => {
            addZipCode(zip); debouncedSave()
          }}
          onRemoveZip={(zip) => { removeZipCode(zip); debouncedSave() }}
          onBatchAddZips={(zips) => {
            // Enforce county limit — each batch = 1 county/city selection
            if (planLimits.maxCounties > 0 && counties.length >= planLimits.maxCounties) {
              setUpsellContext('zones'); setShowUpsell(true); return
            }
            addZipCodes(zips); debouncedSave()
          }}
        />
        </Suspense>
      </div>

      {/* Soft vignette for panel readability — desktop only */}
      <div className="hidden md:block fixed inset-0 z-[1] pointer-events-none"
        style={{
          background: `
            linear-gradient(to right, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0.15) 30%, transparent 50%),
            linear-gradient(to bottom, rgba(255,255,255,0.2) 0%, transparent 30%, transparent 70%, rgba(255,255,255,0.25) 100%)
          `,
        }}
      />

      {/* ════════ MAIN PANEL — Desktop only ════════ */}
      <div
        className="hidden md:block floating-panel p-5 animate-fade-in no-scrollbar overflow-y-auto"
        style={{ top: 24, left: 24, width: 340, maxHeight: 'calc(100vh - 80px)' }}
      >
        {/* Greeting — compact on mobile */}
        <div className="mb-3 md:mb-5">
          <h1 className="text-lg md:text-2xl font-extrabold text-stone-900 tracking-tight leading-tight">
            <span className="md:hidden">Hi, {firstName} 👋</span>
            <span className="hidden md:inline">
              <span className="block text-[11px] font-semibold text-stone-400 uppercase tracking-[0.1em] mb-1">{greeting}</span>
              {t('dash.welcome')}, {firstName}
            </span>
          </h1>
          {/* Plan badge — hidden on mobile (shown in header instead) */}
          <div className="hidden md:flex items-center gap-2 mt-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-gradient-to-r from-[#fff4ef] to-[#fff4ef] text-[#c43d10] border border-[#fee8df]">
              <Sparkles className="w-3 h-3" />
              {planName}
            </span>
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${telegramConnected ? 'bg-[#fff4ef] text-[#e04d1c]' : 'bg-stone-100 text-stone-400'}`}>
              {telegramConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
              {telegramConnected ? 'Telegram' : 'Offline'}
            </span>
          </div>
        </div>

        {/* Push Notification Banner */}
        {(pushStatus === 'default' || pushStatus === 'unsupported') && !pushDismissed && (
          <div className="mb-3 md:mb-4 rounded-xl bg-gradient-to-r from-[#fff4ef] to-white border border-[#fee8df] p-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#fe5b25] flex items-center justify-center shrink-0">
              <Bell className="w-4.5 h-4.5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-bold text-stone-900 leading-tight">
                {locale === 'he' ? 'לא לפספס לידים!' : "Don't miss new leads!"}
              </p>
              <p className="text-[11px] text-stone-500 mt-0.5">
                {pushStatus === 'unsupported'
                  ? (locale === 'he' ? 'הוסף למסך הבית כדי לקבל התראות על לידים חדשים' : 'Add to home screen to receive lead notifications')
                  : (locale === 'he' ? 'הפעל התראות כדי לקבל לידים ברגע שהם מגיעים' : 'Enable notifications to get leads the moment they arrive')
                }
              </p>
            </div>
            {pushStatus === 'default' ? (
              <button
                onClick={async () => { await enablePush(); if (effectiveUserId) supabase.from('contractors').update({ onboarding_step: 'push_enabled' }).eq('user_id', effectiveUserId); setPushDismissed(true); sessionStorage.setItem('push_banner_dismissed', '1') }}
                disabled={pushLoading}
                className="shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-bold text-white bg-[#fe5b25] hover:bg-[#e04d1c] transition-colors disabled:opacity-50"
              >
                {pushLoading ? '...' : locale === 'he' ? 'הפעל' : 'Enable'}
              </button>
            ) : (
              <Link
                to="/install"
                className="shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-bold text-white bg-[#fe5b25] hover:bg-[#e04d1c] transition-colors"
              >
                {locale === 'he' ? 'התקן' : 'Install'}
              </Link>
            )}
            <button
              onClick={() => { setPushDismissed(true); sessionStorage.setItem('push_banner_dismissed', '1') }}
              className="shrink-0 p-1 text-stone-300 hover:text-stone-500 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* KPI Strip */}
        <div className="grid grid-cols-4 gap-1.5 md:gap-2 mb-4 md:mb-5">
          {[
            { value: leadsToday, label: locale === 'he' ? 'היום' : 'Today', icon: Zap, gradient: 'from-amber-400 to-orange-500' },
            { value: leadsWeek, label: locale === 'he' ? 'השבוע' : 'Week', icon: CalendarDays, gradient: 'from-blue-400 to-indigo-500' },
            { value: leadsTotal, label: locale === 'he' ? 'סה"כ' : 'Total', icon: Hash, gradient: 'from-violet-400 to-purple-500' },
            { value: contactedCount, label: locale === 'he' ? 'פניות שלי' : 'My Contacts', icon: Phone, gradient: 'from-[#fe5b25] to-[#e04d1c]' },
          ].map((kpi) => (
            <div key={kpi.label} className="rounded-xl md:rounded-2xl bg-white/60 border border-white/80 p-2 md:p-3 text-center">
              <div className={`w-6 h-6 md:w-7 md:h-7 rounded-lg md:rounded-xl bg-gradient-to-br ${kpi.gradient} flex items-center justify-center mx-auto mb-1`}>
                <kpi.icon className="w-3 h-3 md:w-3.5 md:h-3.5 text-white" strokeWidth={2.5} />
              </div>
              <p className="text-lg md:text-xl font-extrabold text-stone-900 tracking-tight leading-none">
                <AnimatedNumber value={kpi.value} duration={600} />
              </p>
              <p className="text-[9px] md:text-[10px] font-semibold text-stone-400 uppercase tracking-wide mt-0.5">{kpi.label}</p>
            </div>
          ))}
        </div>

        {/* Profile Completion + Views */}
        <div className="mb-5 space-y-4">
          {contractorData && (contractorData.profile?.profile_completeness ?? 100) < 100 && (
            <ProfileCompletionBar
              completeness={contractorData.profile?.profile_completeness ?? 0}
              profile={contractorData}
            />
          )}
          {contractorData?.profile?.slug && viewStats && (
            <div className="glass-panel p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#fff4ef] flex items-center justify-center">
                <Eye className="w-4.5 h-4.5 text-[#fe5b25]" />
              </div>
              <div>
                <p className="text-lg font-bold text-stone-900 leading-none">{viewStats.views_this_week}</p>
                <p className="text-[11px] text-stone-400 font-medium mt-0.5">
                  {locale === 'he' ? 'צפיות בפרופיל השבוע' : 'Profile views this week'}
                </p>
              </div>
              <Link
                to={`/pro/${contractorData.profile.slug}`}
                className="ml-auto text-[10px] font-bold text-[#fe5b25] hover:underline"
              >
                {locale === 'he' ? 'צפה בפרופיל' : 'View profile'}
              </Link>
            </div>
          )}
          <NetworkPointsCard />
        </div>

        {/* ═══ Lead Filter Preferences Header ═══ */}
        <div className="rounded-2xl bg-gradient-to-r from-[#fff4ef]/80 to-[#fff4ef]/60 border border-[#fee8df]/60 p-3.5 mb-5">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-[#fe5b25]/10 flex items-center justify-center">
                <SlidersHorizontal className="w-3.5 h-3.5 text-[#e04d1c]" />
              </div>
              <span className="text-[12px] font-extrabold text-stone-800">
                {locale === 'he' ? 'הגדרות פילטר לידים' : 'Lead Preferences'}
              </span>
            </div>
            {saving && (
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 border border-amber-100">
                <div className="w-2.5 h-2.5 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
                <span className="text-[9px] font-bold text-amber-600">
                  {locale === 'he' ? 'שומר...' : 'Saving...'}
                </span>
              </div>
            )}
            {saved && !saving && (
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#fff4ef] border border-[#fdd5c5] animate-fade-in">
                <CheckCircle2 className="w-3 h-3 text-[#fe5b25]" strokeWidth={2.5} />
                <span className="text-[9px] font-bold text-[#e04d1c]">
                  {locale === 'he' ? 'נשמר' : 'Saved'}
                </span>
              </div>
            )}
          </div>
          <p className="text-[10px] text-stone-400 font-medium leading-relaxed">
            {locale === 'he'
              ? 'לידים שתואמים לפילטרים האלו יישלחו אליך אוטומטית'
              : 'Leads matching these filters will be sent to you automatically'}
          </p>
        </div>

        {/* ── Professions (inline picker) ── */}
        <div className="mb-5 relative" ref={profPickerRef}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <p className="text-[11px] font-bold text-stone-400 uppercase tracking-[0.12em]">
                {locale === 'he' ? 'המקצועות שלי' : 'My Services'}
              </p>
              {planLimits.maxProfessions > 0 && (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  selectedProfs.length >= planLimits.maxProfessions
                    ? 'bg-[#fff4ef] text-[#e04d1c]'
                    : 'bg-stone-100 text-stone-500'
                }`}>
                  {selectedProfs.length}/{planLimits.maxProfessions}
                </span>
              )}
            </div>
            <button
              onClick={() => setShowProfPicker(!showProfPicker)}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[#fff4ef] text-[#e04d1c] text-[10px] font-bold hover:bg-[#fee8df] transition-colors"
            >
              {showProfPicker ? <X className="w-3 h-3" /> : <span className="text-sm leading-none">+</span>}
              {!showProfPicker && (locale === 'he' ? 'ערוך' : 'Edit')}
            </button>
          </div>
          
          <div className="flex flex-wrap gap-1.5">
            {selectedProfs.length > 0 ? (
              selectedProfs.map((profId) => {
                const prof = profLookup[profId]
                if (!prof) return null
                return (
                  <button
                    key={profId}
                    onClick={() => handleToggleProfession(profId)}
                    className="group flex items-center gap-1.5 bg-white/80 border border-[#fee8df] rounded-xl py-1.5 px-2.5 shadow-sm hover:border-red-200 hover:bg-red-50/50 transition-all"
                  >
                    <span className="text-sm">{prof.emoji}</span>
                    <span className="text-[10px] font-bold text-stone-700 group-hover:text-red-500 transition-colors">
                      {locale === 'he' ? prof.he : prof.en}
                    </span>
                    <X className="w-3 h-3 text-stone-300 group-hover:text-red-400 transition-colors" />
                  </button>
                )
              })
            ) : (
              <button
                onClick={() => setShowProfPicker(true)}
                className="text-[11px] text-[#fe5b25] font-bold hover:underline"
              >
                {locale === 'he' ? '+ בחר מקצועות' : '+ Choose professions'}
              </button>
            )}
          </div>

          {/* Profession Picker Dropdown */}
          {showProfPicker && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl border border-black/5 z-50 overflow-hidden animate-scale-in">
              <div className="max-h-[240px] overflow-y-auto p-2 space-y-0.5 no-scrollbar">
                {PROFESSIONS.map((prof) => {
                  const active = selectedProfs.includes(prof.id)
                  return (
                    <button
                      key={prof.id}
                      onClick={() => handleToggleProfession(prof.id)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left transition-all ${
                        active ? 'bg-[#fff4ef] text-[#a33310]' : 'text-stone-600 hover:bg-stone-50'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                        active ? 'bg-[#fe5b25] border-[#fe5b25]' : 'border-stone-300'
                      }`}>
                        {active && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                      </div>
                      <span className="text-sm">{prof.emoji}</span>
                      <span className="text-[11px] font-bold flex-1 truncate">
                        {locale === 'he' ? prof.he : prof.en}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="h-px bg-stone-200/40 mb-5" />

        {/* ── Service Areas (Counties) ── */}
        <div className="mb-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] font-bold text-stone-400 uppercase tracking-[0.12em]">
              Service Areas
            </p>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-stone-100 text-stone-500">
              {counties.length > 0 ? `${counties.length} counties` : `${zipCodes.length} zones`}
            </span>
          </div>

          {counties.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {counties.map((county) => (
                <span key={county} className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white/60 border border-stone-100 rounded-xl text-[11px] font-semibold text-stone-600">
                  <MapPin className="w-3 h-3 text-[#fe5b25]" />
                  {county}
                </span>
              ))}
            </div>
          ) : (
            <>
              <form onSubmit={handleAddZip} className="relative mb-3">
                <input
                  type="text"
                  value={newZip}
                  onChange={(e) => setNewZip(e.target.value)}
                  placeholder="Add ZIP Code..."
                  className="w-full bg-white/50 border border-stone-100 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-[#fe5b25]/20 focus:border-[#fe5b25]/50 transition-all"
                />
                <button
                  type="submit"
                  disabled={saving || !newZip.trim()}
                  className="absolute right-1.5 top-1.5 w-6 h-6 rounded-lg bg-[#fe5b25] text-white flex items-center justify-center hover:bg-[#e04d1c] disabled:opacity-50 transition-colors"
                >
                  <span className="text-lg leading-none">+</span>
                </button>
              </form>

              <div className="flex flex-wrap gap-1.5 max-h-[80px] overflow-y-auto no-scrollbar">
                {zipCodes.map((zip) => (
                  <span key={zip} className="group inline-flex items-center gap-1 px-2 py-1 bg-white/40 border border-stone-100 rounded-lg text-[10px] font-mono font-bold text-stone-500">
                    {zip}
                    <button
                      onClick={() => handleRemoveZip(zip)}
                      className="w-3.5 h-3.5 rounded-full bg-stone-200/80 text-stone-400 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all opacity-0 group-hover:opacity-100"
                    >
                      <X className="w-2 h-2" />
                    </button>
                  </span>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Divider */}
        <div className="h-px bg-stone-200/40 mb-5" />

        {/* ── Business Hours (inline editor) ── */}
        <div className="mb-2" ref={scheduleRef}>
          <button
            onClick={() => setShowScheduleEditor(!showScheduleEditor)}
            className="flex items-center justify-between w-full mb-3 group"
          >
            <p className="text-[11px] font-bold text-stone-400 uppercase tracking-[0.12em]">
              {locale === 'he' ? 'שעות פעילות' : 'Business Hours'}
            </p>
            <ChevronDown className={`w-3.5 h-3.5 text-stone-400 transition-transform ${showScheduleEditor ? 'rotate-180' : ''}`} />
          </button>

          {!showScheduleEditor ? (
            /* Compact summary view */
            <div
              onClick={() => setShowScheduleEditor(true)}
              className="bg-white/40 rounded-2xl p-3 border border-stone-100 cursor-pointer hover:bg-white/60 transition-all"
            >
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-3.5 h-3.5 text-[#fe5b25]" />
                <span className="text-[11px] font-bold text-stone-700">
                  {compactSchedule(workingHours, locale)}
                </span>
              </div>
              <div className="flex gap-1">
                {DAY_KEYS.map((day) => (
                  <div
                    key={day}
                    className={`flex-1 h-1.5 rounded-full ${workingHours[day].enabled ? 'bg-[#fe5b25]' : 'bg-stone-200'}`}
                    title={locale === 'he' ? DAY_LABELS[day].he : DAY_LABELS[day].en}
                  />
                ))}
              </div>
            </div>
          ) : (
            /* Full inline schedule editor */
            <div className="space-y-1.5 animate-scale-in">
              {DAY_KEYS.map((day) => {
                const schedule = workingHours[day]
                const label = locale === 'he' ? DAY_LABELS[day].he : DAY_LABELS[day].en.slice(0, 3)
                return (
                  <div
                    key={day}
                    className={`flex items-center gap-2 rounded-xl px-2.5 py-2 transition-all ${
                      schedule.enabled ? 'bg-white/80 border border-stone-100' : 'bg-stone-50/50 border border-transparent opacity-60'
                    }`}
                  >
                    <button
                      onClick={() => handleToggleDay(day)}
                      className={`relative w-8 h-4 rounded-full transition-colors shrink-0 ${
                        schedule.enabled ? 'bg-[#fe5b25]' : 'bg-stone-300'
                      }`}
                    >
                      <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${
                        schedule.enabled ? 'translate-x-4' : 'translate-x-0.5'
                      }`} />
                    </button>
                    <span className="text-[11px] font-bold text-stone-700 w-10">{label}</span>
                    {schedule.enabled ? (
                      <div className="flex items-center gap-1 ml-auto">
                        <input
                          type="time"
                          value={schedule.start}
                          onChange={(e) => handleSetTime(day, 'start', e.target.value)}
                          className="rounded-lg border border-stone-200 px-1.5 py-0.5 text-[10px] font-bold text-stone-700 outline-none focus:border-[#fe5b25] w-[72px] bg-transparent"
                        />
                        <span className="text-[10px] text-stone-400">–</span>
                        <input
                          type="time"
                          value={schedule.end}
                          onChange={(e) => handleSetTime(day, 'end', e.target.value)}
                          className="rounded-lg border border-stone-200 px-1.5 py-0.5 text-[10px] font-bold text-stone-700 outline-none focus:border-[#fe5b25] w-[72px] bg-transparent"
                        />
                      </div>
                    ) : (
                      <span className="ml-auto text-[10px] text-stone-400 italic">
                        {locale === 'he' ? 'סגור' : 'Off'}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="h-px bg-stone-200/40 mb-5" />

        {/* Spacer — extra on mobile for tab bar */}
        <div className="h-2 md:h-2" />
        <div className="h-20 md:hidden" />
      </div>

      {/* ════════ RECENT LEADS — inside bottom sheet on mobile, floating on desktop ════════ */}
      <div
        className="hidden md:block floating-panel p-5 animate-fade-in"
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
            className="text-[11px] font-semibold text-[#e04d1c] hover:text-[#c43d10] flex items-center gap-0.5 transition-colors"
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
                  <div className="flex items-center justify-between text-[9px] text-stone-400">
                    <div className="flex items-center gap-2">
                      {lead.group_name && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#fff4ef] text-[#e04d1c] font-semibold truncate max-w-[120px]">
                          💬 {lead.group_name}
                        </span>
                      )}
                      {lead.sender_id && (
                        <span className="text-stone-400 truncate max-w-[100px]">
                          {formatSender(lead.sender_id)}
                        </span>
                      )}
                    </div>
                    
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        if (canManageSubs) {
                          setForwardLead(lead)
                        } else {
                          setShowUpsell(true)
                        }
                      }}
                      className="p-1.5 rounded-lg bg-white border border-stone-200 text-stone-500 hover:text-[#e04d1c] hover:border-[#fdd5c5] hover:bg-[#fff4ef] transition-colors"
                      title={locale === 'he' ? 'העבר לקבלן משנה' : 'Forward to Subcontractor'}
                    >
                      <Send size={12} />
                    </button>
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

      {/* Forward Lead Modal */}
      <ForwardLeadModal
        lead={forwardLead}
        isOpen={!!forwardLead}
        onClose={() => setForwardLead(null)}
      />

      {/* Upsell Modal */}
      <UpsellModal
        isOpen={showUpsell}
        onClose={() => setShowUpsell(false)}
        currentPlan={planName.toLowerCase()}
        context={upsellContext}
        currentUsage={{ professions: selectedProfs.length, zips: zipCodes.length }}
      />

      {/* Onboarding Modal */}
      {showOnboarding && (
        <ProfileOnboarding
          onClose={() => {
            setShowOnboarding(false)
            localStorage.setItem('mlf_onboarding_dismissed', 'true')
          }}
        />
      )}
    </div>
  )
}
