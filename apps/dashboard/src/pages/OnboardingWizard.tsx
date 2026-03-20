import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useContractorSettings } from '../hooks/useContractorSettings'
import { useSubscriptionAccess } from '../hooks/useSubscriptionAccess'
import { PROFESSIONS, type ProfessionId } from '../lib/professions'
import { DAY_KEYS, DAY_LABELS, type DayKey } from '../lib/working-hours'
import { useI18n } from '../lib/i18n'
import { useToast } from '../components/hooks/use-toast'
import CoverageMap from '../components/settings/CoverageMap'
import {
  ArrowRight,
  ArrowLeft,
  Check,
  MapPin,
  Clock,
  Sparkles,
  Loader2,
  Plus,
  X,
  Zap,
} from 'lucide-react'

export default function OnboardingWizard() {
  const navigate = useNavigate()
  const { locale } = useI18n()
  const he = locale === 'he'
  const { toast } = useToast()
  const { maxProfessions, maxZipCodes } = useSubscriptionAccess()
  const {
    professions,
    zipCodes,
    workingHours,
    saving,
    toggleProfession,
    addZipCode,
    addZipCodes,
    removeZipCode,
    setWorkingHours,
    save,
  } = useContractorSettings()

  const [step, setStep] = useState(0)
  const [zipInput, setZipInput] = useState('')
  // Track transition direction for slide animation
  const [slideDir, setSlideDir] = useState<'left' | 'right'>('left')
  const [animating, setAnimating] = useState(false)
  const [visibleStep, setVisibleStep] = useState(0)

  // Use dynamic plan limits from the database (-1 means unlimited)
  const maxProf = maxProfessions
  const maxZips = maxZipCodes

  const steps = [
    {
      label: he ? 'מקצועות' : 'Trades',
      icon: Sparkles,
      desc: he
        ? 'בחר את סוגי העבודה שלך ונתאים לך לידים רלוונטיים'
        : "Pick your trades so we send you the right leads",
    },
    {
      label: he ? 'אזורי שירות' : 'Service Areas',
      icon: MapPin,
      desc: he
        ? 'סמן את האזורים שלך ונחבר אותך ללידים באזור'
        : "Mark your zones and we'll match you with nearby leads",
    },
    {
      label: he ? 'שעות עבודה' : 'Schedule',
      icon: Clock,
      desc: he
        ? 'הגדר מתי אתה זמין כדי שנשלח לידים בזמן הנכון'
        : "Set your hours so leads arrive when you're available",
    },
  ]

  function canNext(): boolean {
    if (step === 0) return professions.length > 0
    if (step === 1) return zipCodes.length > 0
    return true
  }

  function goToStep(target: number) {
    if (target === step || animating) return
    setSlideDir(target > step ? 'left' : 'right')
    setAnimating(true)
    // Start exit animation, then swap content, then enter
    setTimeout(() => {
      setStep(target)
      setVisibleStep(target)
      setTimeout(() => setAnimating(false), 30)
    }, 200)
  }

  function handleAddZip() {
    const cleaned = zipInput.trim().replace(/\D/g, '')
    if (cleaned.length === 5) {
      if (maxZips > 0 && zipCodes.length >= maxZips) return
      addZipCode(cleaned)
      setZipInput('')
    }
  }

  async function handleFinish() {
    try {
      await save()
      // Force reload to clear RequireSetup cache
      window.location.href = '/'
    } catch (err) {
      console.error('Save failed:', err)
      toast({
        title: he ? 'שמירה נכשלה' : 'Save failed',
        description: he ? 'לא הצלחנו לשמור את ההגדרות. נסה שוב.' : 'Could not save your settings. Please try again.',
        variant: 'destructive',
      })
    }
  }

  // Inline style for slide transitions
  const slideStyle: React.CSSProperties = {
    transition: 'opacity 0.25s ease, transform 0.25s ease',
    opacity: animating ? 0 : 1,
    transform: animating
      ? `translateX(${slideDir === 'left' ? '-24px' : '24px'})`
      : 'translateX(0)',
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-white">
      {/* ── Top bar ── */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-white text-[11px]"
            style={{ background: 'linear-gradient(135deg, #fe5b25, #e04d1c)' }}
          >
            <img src="/icon.png" alt="Lead Express" className="w-full h-full rounded-lg" />
          </div>
          <span className="text-sm font-bold text-zinc-800">Lead Express</span>
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
            width: `${((step + 1) / 3) * 100}%`,
            background: 'linear-gradient(90deg, #fe5b25, #ff8a5c)',
          }}
        />
      </div>

      {/* ── Welcome header ── */}
      <div className="text-center pt-5 pb-2 px-4">
        <h2 className="text-lg font-bold text-zinc-800">
          {he ? 'בוא נגדיר את החשבון שלך' : "Let's set up your account"}
        </h2>
        <p className="text-xs text-zinc-400 mt-0.5">
          {he ? '3 שלבים קצרים — תסיים תוך שניות' : 'Just 3 quick steps — you\'ll be done in seconds'}
        </p>
      </div>

      {/* ── Step indicator with connecting lines ── */}
      <div className="flex items-center justify-center gap-0 py-3 px-4">
        {steps.map((s, i) => {
          const Icon = s.icon
          const done = i < step
          const active = i === step
          return (
            <div key={i} className="flex items-center">
              {/* Connecting line before (skip first) */}
              {i > 0 && (
                <div
                  className="h-[2px] transition-all duration-500"
                  style={{
                    width: 48,
                    background: i <= step
                      ? 'linear-gradient(90deg, #fe5b25, #ff8a5c)'
                      : '#e4e4e7',
                  }}
                />
              )}
              {/* Step circle + label */}
              <div className="flex flex-col items-center gap-1.5 relative">
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300 ${
                    done
                      ? 'bg-[#fe5b25] text-white scale-100'
                      : active
                      ? 'text-white shadow-lg shadow-[#fe5b25]/30 scale-110'
                      : 'bg-zinc-100 text-zinc-400 scale-100'
                  }`}
                  style={
                    active
                      ? { background: 'linear-gradient(135deg, #fe5b25, #e04d1c)' }
                      : undefined
                  }
                >
                  {done ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <Icon className="w-4 h-4" />
                  )}
                </div>
                <span
                  className={`text-[11px] font-semibold whitespace-nowrap transition-colors duration-300 ${
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

      {/* ── Content area with slide transition ── */}
      <div className="flex-1 overflow-y-auto px-6 pb-32">
        <div
          className={`mx-auto ${step === 1 ? 'max-w-5xl' : 'max-w-2xl'}`}
          style={slideStyle}
        >
          {/* ─── Step 0: Professions ─── */}
          {visibleStep === 0 && (
            <div className="space-y-5">
              <div className="text-center">
                <h1 className="text-2xl font-bold text-zinc-900">
                  {he ? 'מה סוג העבודה שלך?' : 'What type of work do you do?'}
                </h1>
                <p className="text-sm text-zinc-500 mt-1">
                  {steps[0].desc}
                  {maxProf > 0 && (
                    <span className="ml-2 text-[#fe5b25] font-semibold">
                      ({professions.length}/{maxProf})
                    </span>
                  )}
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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

          {/* ─── Step 1: Service Areas with Map ─── */}
          {visibleStep === 1 && (
            <div className="space-y-4">
              <div className="text-center">
                <h1 className="text-2xl font-bold text-zinc-900">
                  {he ? 'אזורי השירות שלך' : 'Your service areas'}
                </h1>
                <p className="text-sm text-zinc-500 mt-1">
                  {steps[1].desc}
                  {maxZips > 0 && (
                    <span className="ml-2 text-[#fe5b25] font-semibold">
                      ({zipCodes.length}/{maxZips})
                    </span>
                  )}
                </p>
              </div>

              {/* Guidance tips */}
              {zipCodes.length === 0 && (
                <div className="flex gap-3 justify-center flex-wrap">
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#fff4ef] border border-[#fee8df] text-xs text-[#e04d1c]">
                    <MapPin className="w-3.5 h-3.5" />
                    {he ? 'לחץ על ZIP במפה' : 'Click a ZIP on the map'}
                  </div>
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 border border-blue-100 text-xs text-blue-600">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    {he ? 'חפש עיר להוסיף כל האזורים' : 'Search a city to add all its ZIPs'}
                  </div>
                </div>
              )}

              {/* Full CoverageMap — same as dashboard */}
              <div className="rounded-2xl overflow-hidden border border-zinc-200 shadow-sm" style={{ height: 'calc(100vh - 420px)', minHeight: 350 }}>
                <CoverageMap
                  zipCodes={zipCodes}
                  onAddZip={(zip) => addZipCode(zip)}
                  onRemoveZip={(zip) => removeZipCode(zip)}
                  onBatchAddZips={(zips) => addZipCodes(zips)}
                />
              </div>

              {/* ZIP chips below map */}
              {zipCodes.length > 0 && (
                <div className="flex flex-wrap gap-2 justify-center">
                  {zipCodes.map((zip) => (
                    <span
                      key={zip}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#fff4ef] text-[#e04d1c] text-sm font-semibold border border-[#fee8df]"
                    >
                      {zip}
                      <button
                        type="button"
                        onClick={() => removeZipCode(zip)}
                        className="hover:bg-[#fee8df] rounded-full p-0.5 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ─── Step 2: Working Hours ─── */}
          {visibleStep === 2 && (
            <div className="space-y-5">
              <div className="text-center">
                <h1 className="text-2xl font-bold text-zinc-900">
                  {he ? 'שעות העבודה שלך' : 'Your working hours'}
                </h1>
                <p className="text-sm text-zinc-500 mt-1">
                  {steps[2].desc}
                </p>
              </div>

              {/* Quick presets */}
              <div className="flex gap-2 justify-center">
                {[
                  { label: he ? 'ראשון-חמישי' : 'Mon\u2013Fri', days: ['mon','tue','wed','thu','fri'] as DayKey[] },
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

              {/* Day toggles */}
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
                            className="rounded-lg border border-zinc-200 px-2 py-1 text-xs font-mono text-zinc-700 outline-none focus:border-[#fe5b25] w-[90px]"
                          />
                          <span className="text-zinc-400 text-xs">{'\u2013'}</span>
                          <input
                            type="time"
                            value={schedule.end}
                            onChange={(e) => {
                              setWorkingHours((prev) => ({
                                ...prev,
                                [day]: { ...prev[day], end: e.target.value },
                              }))
                            }}
                            className="rounded-lg border border-zinc-200 px-2 py-1 text-xs font-mono text-zinc-700 outline-none focus:border-[#fe5b25] w-[90px]"
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
      <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t border-zinc-100 px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          {step > 0 ? (
            <button
              type="button"
              onClick={() => goToStep(step - 1)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-zinc-600 hover:bg-zinc-50 transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
              {he ? 'חזרה' : 'Back'}
            </button>
          ) : (
            <div />
          )}

          {step < 2 ? (
            <button
              type="button"
              disabled={!canNext() || animating}
              onClick={() => goToStep(step + 1)}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40 transition-all shadow-md shadow-[#fe5b25]/20"
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
              className="flex items-center gap-2 px-8 py-3 rounded-xl text-sm font-bold text-white transition-all shadow-lg shadow-[#fe5b25]/30"
              style={{ background: 'linear-gradient(135deg, #fe5b25, #e04d1c)' }}
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              {he ? 'סיום והתחלה' : "Finish & Start"}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
