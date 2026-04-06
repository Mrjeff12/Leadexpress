import { useState, useEffect } from 'react'
import { useContractorSettings } from '../hooks/useContractorSettings'
import { useSubscriptionAccess } from '../hooks/useSubscriptionAccess'
import { PROFESSIONS } from '../lib/professions'
import { DAY_KEYS, DAY_LABELS, type DayKey } from '../lib/working-hours'
import { useI18n } from '../lib/i18n'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { useToast } from '../components/hooks/use-toast'
import { usePushNotifications } from '../hooks/usePushNotifications'
import ServiceAreaSelector, { type SelectedArea } from '../components/settings/ServiceAreaSelector'
import {
  ArrowRight,
  ArrowLeft,
  Check,
  MapPin,
  Clock,
  Sparkles,
  Loader2,
  Zap,
  Phone,
  Mail,
  Lock,
  Bell,
  Smartphone,
  AlertTriangle,
  Home,
} from 'lucide-react'

// Capture beforeinstallprompt early (Android only)
let _deferredInstallPrompt: any = null
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    _deferredInstallPrompt = e
  })
}

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    ('standalone' in navigator && (navigator as any).standalone === true)
  )
}

function isIOS(): boolean {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent)
}

type Phase = 'steps' | 'push' | 'install'

export default function OnboardingWizard() {
  const { locale } = useI18n()
  const he = locale === 'he'
  const { toast } = useToast()
  const { user } = useAuth()
  const { maxProfessions, maxZipCodes } = useSubscriptionAccess()
  const {
    professions,
    zipCodes,
    workingHours,
    saving,
    toggleProfession,
    addZipCodes,
    removeZipCodes,
    setWorkingHours,
    save,
  } = useContractorSettings()

  // Hierarchical service area selection (state → county → zips)
  const [selectedAreas, setSelectedAreas] = useState<SelectedArea[]>([])

  const { status: pushStatus, enable: enablePush, isLoading: pushLoading } = usePushNotifications()

  // Email/password for step 0
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [credSaving, setCredSaving] = useState(false)
  const [credError, setCredError] = useState('')

  const [waPhone, setWaPhone] = useState('')
  const [waCountry, setWaCountry] = useState<'+1' | '+972'>(he ? '+972' : '+1')

  const [step, setStep] = useState(0)
  const [phase, setPhase] = useState<Phase>('steps')
  const [slideDir, setSlideDir] = useState<'left' | 'right'>('left')
  const [animating, setAnimating] = useState(false)
  const [visibleStep, setVisibleStep] = useState(0)

  // Push enabling state for phase screen
  const [pushEnabling, setPushEnabling] = useState(false)
  // PWA install state
  const [canInstall, setCanInstall] = useState(false)

  const maxProf = maxProfessions

  // Check if credentials already set or user signed in via OAuth — skip step 0 if so
  const isOAuthUser = user?.app_metadata?.provider && user.app_metadata.provider !== 'email'

  useEffect(() => {
    if (!user) return

    // OAuth users (Google/Apple) already have a session — skip credentials step
    if (isOAuthUser) {
      // Mark credentials as set so they don't get stuck
      supabase.from('contractors').update({ onboarding_step: 'credentials_set' }).eq('user_id', user.id).then(() => {})
      setStep(1)
      setVisibleStep(1)
      return
    }

    supabase
      .from('contractors')
      .select('onboarding_step')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.onboarding_step && data.onboarding_step !== 'registered') {
          setStep(1)
          setVisibleStep(1)
        }
      })
  }, [user, isOAuthUser])

  // Detect beforeinstallprompt
  useEffect(() => {
    if (_deferredInstallPrompt) setCanInstall(true)
    function handler() { setCanInstall(true) }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const steps = [
    {
      label: he ? 'כניסה' : 'Account',
      icon: Mail,
      desc: he
        ? 'הגדר אימייל וסיסמא לכניסה לחשבון שלך'
        : 'Set your email and password to access your account',
    },
    {
      label: 'WhatsApp',
      icon: Phone,
      desc: he
        ? 'הזן את מספר הWhatsApp שלך כדי שנוכל לשלוח לך לידים'
        : 'Enter your WhatsApp number so we can send you leads',
    },
    {
      label: he ? 'שירותים' : 'Services',
      icon: Sparkles,
      desc: he
        ? 'בחר את סוגי העבודה שלך ונתאים לך לידים רלוונטיים'
        : "Pick your services so we send you the right leads",
    },
    {
      label: he ? 'אזורי שירות' : 'Service Areas',
      icon: MapPin,
      desc: he
        ? 'סמן את האזורים שלך ונחבר אותך ללידים באזור'
        : "Mark your zones and we'll match you with nearby leads",
    },
    {
      label: he ? 'שעות פעילות' : 'Active Hours',
      icon: Clock,
      desc: he
        ? 'הגדר מתי אתה זמין כדי שנשלח לידים בזמן הנכון'
        : "Set your hours so leads arrive when you're available",
    },
  ]

  function canNext(): boolean {
    if (step === 0) {
      const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
      return emailOk && password.length >= 6
    }
    if (step === 1) {
      const digits = waPhone.replace(/\D/g, '')
      const minLen = waCountry === '+972' ? 9 : 10
      return digits.length >= minLen
    }
    if (step === 2) return professions.length > 0
    if (step === 3) return selectedAreas.length > 0 || zipCodes.length > 0
    return true
  }

  async function saveCredentials(): Promise<boolean> {
    setCredSaving(true)
    setCredError('')
    try {
      const { data: fnData, error: fnError } = await supabase.functions.invoke('update-account', {
        body: { email, password },
      })
      if (fnError || fnData?.error) {
        setCredError(fnData?.error || fnError?.message || 'Failed to update account')
        setCredSaving(false)
        return false
      }
      supabase.from('profiles').update({ email }).eq('id', user!.id).then(() => {})
      await supabase.auth.signInWithPassword({ email, password }).catch(() => {})
      await supabase.from('contractors').update({ onboarding_step: 'credentials_set' }).eq('user_id', user!.id)
      setCredSaving(false)
      return true
    } catch {
      setCredError('Something went wrong. Please try again.')
      setCredSaving(false)
      return false
    }
  }

  async function saveWhatsAppPhone() {
    if (!user) return
    const fullPhone = `${waCountry}${waPhone.replace(/\D/g, '')}`
    const { error } = await supabase
      .from('profiles')
      .update({ whatsapp_phone: fullPhone, phone: fullPhone })
      .eq('id', user.id)
    if (error) console.error('Failed to save WhatsApp phone:', error)
  }

  function handleAddArea(area: SelectedArea) {
    setSelectedAreas((prev) => [...prev, area])
    addZipCodes(area.zips)
  }

  function handleRemoveArea(state: string, county: string) {
    const area = selectedAreas.find((a) => a.state === state && a.county === county)
    if (area) removeZipCodes(area.zips)
    setSelectedAreas((prev) => prev.filter((a) => !(a.state === state && a.county === county)))
  }

  function animateTo(target: number) {
    setSlideDir(target > step ? 'left' : 'right')
    setAnimating(true)
    setTimeout(() => {
      setStep(target)
      setVisibleStep(target)
      setTimeout(() => setAnimating(false), 30)
    }, 200)
  }

  async function goToStep(target: number) {
    if (target === step || animating) return
    if (step === 1 && target > 1) {
      saveWhatsAppPhone()
    }
    animateTo(target)
  }

  async function handleStep0Next() {
    if (animating || credSaving) return
    const ok = await saveCredentials()
    if (!ok) return
    animateTo(1)
  }

  async function handleFinish() {
    try {
      await save()
      // Save county names to profiles.counties if any were selected
      if (user && selectedAreas.length > 0) {
        const countyNames = selectedAreas.map((a) => a.county)
        supabase.from('profiles').update({ counties: countyNames }).eq('id', user.id).then(() => {})
      }
      // Go to completion phases
      if (pushStatus === 'granted' || pushStatus === 'unsupported') {
        setPhase('install')
      } else {
        setPhase('push')
      }
    } catch {
      toast({
        title: he ? 'שמירה נכשלה' : 'Save failed',
        description: he ? 'לא הצלחנו לשמור את ההגדרות. נסה שוב.' : 'Could not save your settings. Please try again.',
        variant: 'destructive',
      })
    }
  }

  async function handleEnablePush() {
    setPushEnabling(true)
    try {
      await enablePush()
    } catch {}
    setPushEnabling(false)
    setPhase('install')
  }

  async function handleInstallPWA() {
    if (_deferredInstallPrompt) {
      _deferredInstallPrompt.prompt()
      await _deferredInstallPrompt.userChoice
      _deferredInstallPrompt = null
      setCanInstall(false)
    }
    window.location.href = '/'
  }

  const slideStyle: React.CSSProperties = {
    transition: 'opacity 0.25s ease, transform 0.25s ease',
    opacity: animating ? 0 : 1,
    transform: animating
      ? `translateX(${slideDir === 'left' ? '-24px' : '24px'})`
      : 'translateX(0)',
  }

  // ── Completion: Push Notifications ──
  if (phase === 'push') {
    return (
      <div className="fixed inset-0 flex flex-col bg-white items-center justify-center p-6">
        <div className="w-full max-w-sm mx-auto text-center">
          {/* Icon */}
          <div className="relative mx-auto w-24 h-24 mb-6">
            <div className="w-24 h-24 rounded-full bg-[#fe5b25]/10 flex items-center justify-center">
              <Bell className="w-12 h-12 text-[#fe5b25]" />
            </div>
            <div className="absolute inset-0 rounded-full border-2 border-[#fe5b25]/20 animate-ping" />
            <div className="absolute -top-1 -right-1 w-7 h-7 rounded-full bg-red-500 flex items-center justify-center shadow-lg">
              <span className="text-white text-xs font-bold">1</span>
            </div>
          </div>

          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#fff4ef] text-[#fe5b25] text-xs font-semibold mb-4">
            <Zap className="w-3.5 h-3.5" />
            Almost done
          </div>

          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {he ? 'הפעל התראות' : 'Enable Notifications'}
          </h2>
          <p className="text-gray-500 text-sm mb-6 leading-relaxed">
            {he
              ? 'קבל התראה מיידית כשיש ליד חדש באזור שלך. אל תפספס עבודות.'
              : "Get notified instantly when a new job matches you. Don't miss leads."}
          </p>

          {/* Warning */}
          <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-6 text-left">
            <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-amber-800 text-xs font-semibold">
                {he ? 'ללא התראות' : 'Without notifications'}
              </p>
              <p className="text-amber-600 text-[11px] mt-0.5">
                {he
                  ? 'קבלנים אחרים יקבלו את הלידים לפניך.'
                  : "Other contractors will grab leads before you."}
              </p>
            </div>
          </div>

          <button
            onClick={handleEnablePush}
            disabled={pushEnabling || pushLoading}
            className="w-full py-4 rounded-2xl text-base font-semibold text-white flex items-center justify-center gap-2.5 transition-all active:scale-[0.97] disabled:opacity-50 mb-3"
            style={{ background: 'linear-gradient(135deg, #fe5b25, #e04d1c)', boxShadow: '0 4px 24px #fe5b2535' }}
          >
            {pushEnabling || pushLoading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <Bell className="w-5 h-5" />
                {he ? 'הפעל התראות' : 'Enable Notifications'}
              </>
            )}
          </button>

          <button
            onClick={() => setPhase('install')}
            className="w-full py-3 text-sm text-gray-400 hover:text-gray-600 transition-colors"
          >
            {he ? 'אחר כך' : 'Not now'}
          </button>
        </div>
      </div>
    )
  }

  // ── Completion: PWA Install ──
  if (phase === 'install') {
    const alreadyInstalled = isStandalone()
    if (alreadyInstalled) {
      window.location.href = '/'
      return null
    }
    const ios = isIOS()

    return (
      <div className="fixed inset-0 flex flex-col bg-white items-center justify-center p-6">
        <div className="w-full max-w-sm mx-auto text-center">
          {/* Icon */}
          <div className="relative mx-auto w-24 h-24 mb-6">
            <div className="w-24 h-24 rounded-full bg-purple-50 flex items-center justify-center">
              <Smartphone className="w-12 h-12 text-purple-600" />
            </div>
            <div className="absolute -top-1 -right-1 w-7 h-7 rounded-full bg-green-500 flex items-center justify-center shadow-lg">
              <span className="text-white text-xs font-bold">2</span>
            </div>
          </div>

          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-50 text-purple-600 text-xs font-semibold mb-4">
            <Home className="w-3.5 h-3.5" />
            {he ? 'שמור למסך הבית' : 'Save to Home Screen'}
          </div>

          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {he ? 'הוסף לדף הבית' : 'Install the App'}
          </h2>
          <p className="text-gray-500 text-sm mb-6 leading-relaxed">
            {he
              ? 'שמור את האפליקציה למסך הבית לגישה מהירה ולהתראות מיידיות.'
              : "Save the app to your home screen for instant access and fast alerts."}
          </p>

          {ios ? (
            /* iOS instructions */
            <div className="bg-gray-50 rounded-2xl p-4 mb-6 text-left space-y-3">
              <p className="text-xs font-semibold text-gray-700 mb-2">
                {he ? 'איך מוסיפים לדף הבית:' : 'How to add to Home Screen:'}
              </p>
              {[
                { icon: '1', text: he ? 'לחץ על כפתור השיתוף ↑ בספארי' : 'Tap the Share button ↑ in Safari' },
                { icon: '2', text: he ? 'גלול מטה ובחר "הוסף לדף הבית"' : 'Scroll down and tap "Add to Home Screen"' },
                { icon: '3', text: he ? 'לחץ "הוסף" בפינה הימנית עליונה' : 'Tap "Add" in the top right corner' },
              ].map((item) => (
                <div key={item.icon} className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-purple-100 text-purple-700 text-xs font-bold flex items-center justify-center flex-shrink-0">
                    {item.icon}
                  </div>
                  <span className="text-sm text-gray-600">{item.text}</span>
                </div>
              ))}
            </div>
          ) : canInstall ? (
            <button
              onClick={handleInstallPWA}
              className="w-full py-4 rounded-2xl text-base font-semibold text-white flex items-center justify-center gap-2.5 transition-all active:scale-[0.97] mb-3"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', boxShadow: '0 4px 24px rgba(109,40,217,0.25)' }}
            >
              <Smartphone className="w-5 h-5" />
              {he ? 'התקן אפליקציה' : 'Install App'}
            </button>
          ) : null}

          <button
            onClick={() => { window.location.href = '/' }}
            className={`w-full py-3 rounded-2xl font-semibold transition-all active:scale-[0.97] ${
              ios || !canInstall
                ? 'text-base text-white'
                : 'text-sm text-gray-400 hover:text-gray-600'
            }`}
            style={ios || !canInstall ? { background: 'linear-gradient(135deg, #fe5b25, #e04d1c)', boxShadow: '0 4px 24px #fe5b2535' } : {}}
          >
            {ios || !canInstall
              ? (he ? 'סיום והתחלה →' : "Let's Go →")
              : (he ? 'דלג' : 'Skip')}
          </button>
        </div>
      </div>
    )
  }

  // ── Main onboarding steps ──
  return (
    <div className="fixed inset-0 flex flex-col bg-white">
      {/* ── Top bar ── */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-white text-[11px]"
            style={{ background: 'linear-gradient(135deg, #fe5b25, #e04d1c)' }}
          >
            <img src="/icon.png" alt="MasterLeadFlow" className="w-full h-full rounded-lg" />
          </div>
          <span className="text-sm font-bold text-zinc-800">MasterLeadFlow</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-zinc-400">
          <Zap className="w-3.5 h-3.5 text-[#fe5b25]" />
          <span>{he ? '~30 שניות' : '~30 seconds'}</span>
        </div>
      </div>

      {/* ── Progress bar ── */}
      <div className="h-1 bg-zinc-100">
        <div
          className="h-full transition-all duration-500 ease-out"
          style={{
            width: `${((step - (isOAuthUser ? 1 : 0) + 1) / (steps.length - (isOAuthUser ? 1 : 0))) * 100}%`,
            background: 'linear-gradient(90deg, #fe5b25, #ff8a5c)',
          }}
        />
      </div>

      {/* ── Welcome header ── */}
      <div className="text-center pt-5 pb-2 px-4">
        <h2 className="text-base md:text-lg font-bold text-zinc-800">
          {he ? 'בוא נגדיר את החשבון שלך' : "Let's set up your account"}
        </h2>
        <p className="text-xs text-zinc-400 mt-0.5">
          {he
            ? `${isOAuthUser ? 4 : 5} שלבים קצרים — תסיים תוך שניות`
            : `Just ${isOAuthUser ? 4 : 5} quick steps — you'll be done in seconds`}
        </p>
      </div>

      {/* ── Step indicator ── */}
      <div className="flex items-center justify-center gap-0 py-3 px-4">
        {steps.filter((_, i) => !(isOAuthUser && i === 0)).map((s, _filteredIdx) => {
          const i = isOAuthUser ? _filteredIdx + 1 : _filteredIdx
          const Icon = s.icon
          const done = i < step
          const active = i === step
          return (
            <div key={i} className="flex items-center">
              {_filteredIdx > 0 && (
                <div
                  className="h-[2px] w-4 md:w-12 transition-all duration-500"
                  style={{
                    background: i <= step
                      ? 'linear-gradient(90deg, #fe5b25, #ff8a5c)'
                      : '#e4e4e7',
                  }}
                />
              )}
              <div className="flex flex-col items-center gap-1.5 relative">
                <div
                  className={`w-7 h-7 md:w-9 md:h-9 rounded-full flex items-center justify-center transition-all duration-300 ${
                    done
                      ? 'bg-[#fe5b25] text-white scale-100'
                      : active
                      ? 'text-white shadow-lg shadow-[#fe5b25]/30 scale-110'
                      : 'bg-zinc-100 text-zinc-400 scale-100'
                  }`}
                  style={active ? { background: 'linear-gradient(135deg, #fe5b25, #e04d1c)' } : undefined}
                >
                  {done ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                </div>
                <span
                  className={`text-[9px] md:text-[11px] font-semibold whitespace-nowrap transition-colors duration-300 ${
                    active ? 'text-zinc-800' : done ? 'text-[#fe5b25]' : 'text-zinc-400'
                  }`}
                >
                  {s.label}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Content area ── */}
      <div className="flex-1 overflow-y-auto px-4 md:px-6 pb-32">
        <div
          className={`w-full mx-auto ${step === 3 ? 'md:max-w-5xl' : 'md:max-w-2xl'}`}
          style={slideStyle}
        >

          {/* ─── Step 0: Email + Password ─── */}
          {visibleStep === 0 && (
            <div className="space-y-5">
              <div className="text-center">
                <h1 className="text-base md:text-lg font-bold text-zinc-900">
                  {he ? 'הגדר כניסה לחשבון' : 'Create your login'}
                </h1>
                <p className="text-sm text-zinc-500 mt-1">
                  {steps[0].desc}
                </p>
              </div>

              <div className="max-w-sm mx-auto space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-zinc-700 mb-1.5">
                    {he ? 'אימייל' : 'Email'}
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => { setEmail(e.target.value); setCredError('') }}
                      placeholder="you@example.com"
                      className="w-full pl-10 pr-4 py-3 rounded-xl border-2 border-zinc-200 bg-white text-sm text-zinc-800 placeholder:text-zinc-300 outline-none focus:border-[#fe5b25] transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-zinc-700 mb-1.5">
                    {he ? 'סיסמא' : 'Password'}
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => { setPassword(e.target.value); setCredError('') }}
                      placeholder={he ? 'לפחות 6 תווים' : 'At least 6 characters'}
                      className="w-full pl-10 pr-4 py-3 rounded-xl border-2 border-zinc-200 bg-white text-sm text-zinc-800 placeholder:text-zinc-300 outline-none focus:border-[#fe5b25] transition-colors"
                    />
                  </div>
                </div>

                {credError && (
                  <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600 text-center">
                    {credError}
                  </div>
                )}

                <div className="rounded-xl bg-[#fff4ef] border border-[#fee8df] px-4 py-3 text-xs text-[#e04d1c] text-center leading-relaxed">
                  {he
                    ? '🔒 תצטרך אותם כדי להתחבר בפעם הבאה ולקבל לידים'
                    : '🔒 Required to log in next time and receive leads'}
                </div>
              </div>
            </div>
          )}

          {/* ─── Step 1: WhatsApp Phone ─── */}
          {visibleStep === 1 && (
            <div className="space-y-5">
              <div className="text-center">
                <h1 className="text-base md:text-lg font-bold text-zinc-900">
                  {he ? 'מספר הWhatsApp שלך' : 'Your WhatsApp Number'}
                </h1>
                <p className="text-sm text-zinc-500 mt-1">
                  {steps[1].desc}
                </p>
              </div>

              <div className="max-w-sm mx-auto space-y-4">
                <label className="block text-sm font-semibold text-zinc-700 text-center">
                  {he ? 'מספר WhatsApp' : 'WhatsApp Number'}
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <select
                    value={waCountry}
                    onChange={(e) => setWaCountry(e.target.value as '+1' | '+972')}
                    className="w-full sm:w-auto rounded-xl border-2 border-zinc-200 bg-white px-3 py-3 text-sm font-semibold text-zinc-700 outline-none focus:border-[#fe5b25] transition-colors"
                  >
                    <option value="+1">🇺🇸 +1</option>
                    <option value="+972">🇮🇱 +972</option>
                  </select>
                  <input
                    type="tel"
                    placeholder={waCountry === '+972' ? '50-123-4567' : '(555) 123-4567'}
                    value={waPhone}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, '')
                      if (waCountry === '+972') {
                        let formatted = digits
                        if (digits.length > 2) formatted = digits.slice(0, 2) + '-' + digits.slice(2)
                        if (digits.length > 5) formatted = digits.slice(0, 2) + '-' + digits.slice(2, 5) + '-' + digits.slice(5, 9)
                        setWaPhone(formatted)
                      } else {
                        let formatted = digits
                        if (digits.length > 3) formatted = '(' + digits.slice(0, 3) + ') ' + digits.slice(3)
                        if (digits.length > 6) formatted = '(' + digits.slice(0, 3) + ') ' + digits.slice(3, 6) + '-' + digits.slice(6, 10)
                        setWaPhone(formatted)
                      }
                    }}
                    className="flex-1 rounded-xl border-2 border-zinc-200 bg-white px-4 py-3 text-sm font-semibold text-zinc-700 outline-none focus:border-[#fe5b25] transition-colors placeholder:text-zinc-300"
                  />
                </div>

                {waPhone.replace(/\D/g, '').length >= 10 && (
                  <div className="flex items-center gap-2 justify-center text-sm text-emerald-600 font-medium">
                    <Check className="w-4 h-4" />
                    {he ? 'מספר תקין' : 'Looks good!'}
                  </div>
                )}

                <div className="rounded-xl bg-[#fff4ef] border border-[#fee8df] px-4 py-3 text-xs text-[#e04d1c] text-center leading-relaxed">
                  {he
                    ? 'נשלח לך לידים ישירות בWhatsApp. ודא שזה המספר הנכון.'
                    : "We'll send leads directly to your WhatsApp. Make sure this is the right number."}
                </div>
              </div>
            </div>
          )}

          {/* ─── Step 2: Services ─── */}
          {visibleStep === 2 && (
            <div className="space-y-5">
              <div className="text-center">
                <h1 className="text-base md:text-lg font-bold text-zinc-900">
                  {he ? 'מה סוג העבודה שלך?' : 'What services do you offer?'}
                </h1>
                <p className="text-sm text-zinc-500 mt-1">
                  {steps[2].desc}
                  {maxProf > 0 && (
                    <span className="ml-2 text-[#fe5b25] font-semibold">
                      ({professions.length}/{maxProf})
                    </span>
                  )}
                </p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {PROFESSIONS.map((prof) => {
                  const selected = professions.includes(prof.id)
                  const atLimit = maxProf > 0 && professions.length >= maxProf && !selected
                  return (
                    <button
                      key={prof.id}
                      type="button"
                      disabled={atLimit}
                      onClick={() => toggleProfession(prof.id)}
                      className={`relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                        selected
                          ? 'border-[#fe5b25] bg-[#fff4ef] shadow-sm'
                          : atLimit
                          ? 'border-zinc-100 bg-zinc-50 opacity-40 cursor-not-allowed'
                          : 'border-zinc-200 bg-white hover:border-[#fe5b25]/40 hover:shadow-sm'
                      }`}
                    >
                      {selected && (
                        <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[#fe5b25] flex items-center justify-center">
                          <Check className="w-3 h-3 text-white" />
                        </div>
                      )}
                      <span className="text-2xl">{prof.emoji}</span>
                      <span className={`text-xs font-semibold text-center ${selected ? 'text-[#e04d1c]' : 'text-zinc-700'}`}>
                        {he ? prof.he : prof.en}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* ─── Step 3: Service Areas (hierarchical selector) ─── */}
          {visibleStep === 3 && (
            <ServiceAreaSelector
              selectedAreas={selectedAreas}
              onAddArea={handleAddArea}
              onRemoveArea={handleRemoveArea}
            />
          )}

          {/* ─── Step 4: Active Hours ─── */}
          {visibleStep === 4 && (
            <div className="space-y-5">
              <div className="text-center">
                <h1 className="text-base md:text-lg font-bold text-zinc-900">
                  {he ? 'שעות הפעילות שלך' : 'Your active hours'}
                </h1>
                <p className="text-sm text-zinc-500 mt-1">
                  {steps[4].desc}
                </p>
              </div>

              <div className="flex gap-2 justify-center">
                {[
                  { label: he ? 'ראשון-חמישי' : 'Mon–Fri', days: ['mon','tue','wed','thu','fri'] as DayKey[] },
                  { label: he ? 'כל יום' : 'Every day', days: DAY_KEYS },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => {
                      setWorkingHours((prev) => {
                        const next = { ...prev }
                        for (const key of DAY_KEYS) {
                          next[key] = { ...next[key], enabled: preset.days.includes(key) }
                        }
                        return next
                      })
                    }}
                    className="px-4 py-2 rounded-full text-xs font-semibold border border-zinc-200 text-zinc-600 hover:border-[#fe5b25] hover:text-[#fe5b25] transition-all"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              <div className="space-y-2 max-w-sm mx-auto">
                {DAY_KEYS.map((day) => {
                  const schedule = workingHours[day]
                  return (
                    <div
                      key={day}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${
                        schedule.enabled
                          ? 'border-[#fe5b25]/20 bg-[#fff4ef]'
                          : 'border-zinc-100 bg-zinc-50'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setWorkingHours((prev) => ({
                            ...prev,
                            [day]: { ...prev[day], enabled: !prev[day].enabled },
                          }))
                        }}
                        className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                          schedule.enabled
                            ? 'bg-[#fe5b25] border-[#fe5b25]'
                            : 'border-zinc-300 bg-white'
                        }`}
                      >
                        {schedule.enabled && <Check className="w-3 h-3 text-white" />}
                      </button>
                      <span className={`text-sm font-medium flex-1 ${schedule.enabled ? 'text-zinc-900' : 'text-zinc-400'}`}>
                        {he ? DAY_LABELS[day].he : DAY_LABELS[day].en}
                      </span>
                      {schedule.enabled && (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="time"
                            value={schedule.start}
                            onChange={(e) => {
                              setWorkingHours((prev) => ({
                                ...prev,
                                [day]: { ...prev[day], start: e.target.value },
                              }))
                            }}
                            className="rounded-lg border border-zinc-200 px-2 py-1 text-xs font-mono text-zinc-700 outline-none focus:border-[#fe5b25] w-[75px] md:w-[90px]"
                          />
                          <span className="text-zinc-400 text-xs">–</span>
                          <input
                            type="time"
                            value={schedule.end}
                            onChange={(e) => {
                              setWorkingHours((prev) => ({
                                ...prev,
                                [day]: { ...prev[day], end: e.target.value },
                              }))
                            }}
                            className="rounded-lg border border-zinc-200 px-2 py-1 text-xs font-mono text-zinc-700 outline-none focus:border-[#fe5b25] w-[75px] md:w-[90px]"
                          />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Bottom nav ── */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t border-zinc-100 px-4 md:px-6 py-3 md:py-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          {step > (isOAuthUser ? 1 : 0) ? (
            <button
              type="button"
              onClick={() => goToStep(step - 1)}
              className="flex items-center gap-2 px-4 md:px-5 py-3 md:py-2.5 rounded-xl text-sm font-semibold text-zinc-600 hover:bg-zinc-50 transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
              {he ? 'חזרה' : 'Back'}
            </button>
          ) : (
            <div />
          )}

          {step === 0 ? (
            <button
              type="button"
              disabled={!canNext() || credSaving || animating}
              onClick={handleStep0Next}
              className="flex items-center gap-2 px-6 py-3 md:py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40 transition-all shadow-md shadow-[#fe5b25]/20"
              style={{ background: 'linear-gradient(135deg, #fe5b25, #e04d1c)' }}
            >
              {credSaving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  {he ? 'הבא' : 'Next'}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          ) : step < steps.length - 1 ? (
            <button
              type="button"
              disabled={!canNext() || animating}
              onClick={() => goToStep(step + 1)}
              className="flex items-center gap-2 px-6 py-3 md:py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40 transition-all shadow-md shadow-[#fe5b25]/20"
              style={{ background: 'linear-gradient(135deg, #fe5b25, #e04d1c)' }}
            >
              {he ? 'הבא' : 'Next'}
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              disabled={saving}
              onClick={handleFinish}
              className="flex items-center gap-2 px-8 py-3 md:py-3 rounded-xl text-sm font-bold text-white transition-all shadow-lg shadow-[#fe5b25]/30"
              style={{ background: 'linear-gradient(135deg, #fe5b25, #e04d1c)' }}
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              {he ? 'סיום והתחלה' : 'Finish & Start'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
