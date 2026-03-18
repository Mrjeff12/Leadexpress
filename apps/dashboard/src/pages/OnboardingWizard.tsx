import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useContractorSettings } from '../hooks/useContractorSettings'
import { useSubscriptionAccess } from '../hooks/useSubscriptionAccess'
import { PROFESSIONS, type ProfessionId } from '../lib/professions'
import { DAY_KEYS, DAY_LABELS, type DayKey } from '../lib/working-hours'
import { useI18n } from '../lib/i18n'
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
} from 'lucide-react'

const PLAN_LIMITS: Record<string, { professions: number; zips: number }> = {
  Starter: { professions: 3, zips: 10 },
  Pro: { professions: -1, zips: 25 },
  Unlimited: { professions: -1, zips: -1 },
}

export default function OnboardingWizard() {
  const navigate = useNavigate()
  const { locale } = useI18n()
  const he = locale === 'he'
  const { planName } = useSubscriptionAccess()
  const {
    professions,
    zipCodes,
    workingHours,
    saving,
    toggleProfession,
    addZipCode,
    removeZipCode,
    setWorkingHours,
    save,
  } = useContractorSettings()

  const [step, setStep] = useState(0)
  const [zipInput, setZipInput] = useState('')

  const limits = PLAN_LIMITS[planName] ?? PLAN_LIMITS.Starter
  const maxProf = limits.professions
  const maxZips = limits.zips

  const steps = [
    { label: he ? 'מקצועות' : 'Trades', icon: Sparkles },
    { label: he ? 'אזורי שירות' : 'Service Areas', icon: MapPin },
    { label: he ? 'שעות עבודה' : 'Schedule', icon: Clock },
  ]

  function canNext(): boolean {
    if (step === 0) return professions.length > 0
    if (step === 1) return zipCodes.length > 0
    return true
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
    await save()
    navigate('/', { replace: true })
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-white">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-white text-[11px]"
            style={{ background: 'linear-gradient(135deg, #fe5b25, #e04d1c)' }}
          >
            LE
          </div>
          <span className="text-sm font-bold text-zinc-800">Lead Express</span>
        </div>
        <span className="text-xs text-zinc-400">
          {he ? `שלב ${step + 1} מתוך 3` : `Step ${step + 1} of 3`}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-zinc-100">
        <div
          className="h-full transition-all duration-500 ease-out"
          style={{
            width: `${((step + 1) / 3) * 100}%`,
            background: 'linear-gradient(90deg, #fe5b25, #ff8a5c)',
          }}
        />
      </div>

      {/* Step indicator */}
      <div className="flex justify-center gap-8 py-5">
        {steps.map((s, i) => {
          const Icon = s.icon
          const done = i < step
          const active = i === step
          return (
            <div key={i} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                done ? 'bg-[#fe5b25] text-white' :
                active ? 'bg-[#fe5b25] text-white shadow-lg shadow-[#fe5b25]/30' :
                'bg-zinc-100 text-zinc-400'
              }`}>
                {done ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
              </div>
              <span className={`text-xs font-medium hidden sm:block ${active ? 'text-zinc-900' : 'text-zinc-400'}`}>
                {s.label}
              </span>
            </div>
          )
        })}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 pb-32">
        <div className="max-w-2xl mx-auto">

          {/* ─── Step 0: Professions ─── */}
          {step === 0 && (
            <div className="animate-fade-in space-y-6">
              <div className="text-center">
                <h1 className="text-2xl font-bold text-zinc-900">
                  {he ? 'מה סוג העבודה שלך?' : 'What type of work do you do?'}
                </h1>
                <p className="text-sm text-zinc-500 mt-1">
                  {he ? 'בחר את המקצועות שלך כדי לקבל לידים מתאימים' : 'Select your trades to get matching leads'}
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

          {/* ─── Step 1: ZIP Codes ─── */}
          {step === 1 && (
            <div className="animate-fade-in space-y-6">
              <div className="text-center">
                <h1 className="text-2xl font-bold text-zinc-900">
                  {he ? 'אזורי השירות שלך' : 'Your service areas'}
                </h1>
                <p className="text-sm text-zinc-500 mt-1">
                  {he ? 'הוסף ZIP codes של האזורים שאתה משרת' : 'Add ZIP codes for the areas you serve'}
                  {maxZips > 0 && (
                    <span className="ml-2 text-[#fe5b25] font-semibold">
                      ({zipCodes.length}/{maxZips})
                    </span>
                  )}
                </p>
              </div>

              {/* ZIP input */}
              <div className="flex gap-2 max-w-sm mx-auto">
                <input
                  type="text"
                  value={zipInput}
                  onChange={(e) => setZipInput(e.target.value.replace(/\D/g, '').slice(0, 5))}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddZip()}
                  placeholder={he ? 'הזן ZIP Code...' : 'Enter ZIP Code...'}
                  maxLength={5}
                  className="flex-1 rounded-xl border border-zinc-200 px-4 py-3 text-sm outline-none focus:border-[#fe5b25] focus:ring-2 focus:ring-[#fee8df] transition-all text-center font-mono text-lg tracking-widest"
                />
                <button
                  type="button"
                  onClick={handleAddZip}
                  disabled={zipInput.length !== 5 || (maxZips > 0 && zipCodes.length >= maxZips)}
                  className="w-12 h-12 rounded-xl bg-[#fe5b25] text-white flex items-center justify-center hover:bg-[#e04d1c] disabled:opacity-30 transition-all shadow-sm"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>

              {/* ZIP chips */}
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

              {zipCodes.length === 0 && (
                <div className="text-center py-8">
                  <MapPin className="w-12 h-12 text-zinc-200 mx-auto mb-2" />
                  <p className="text-sm text-zinc-400">
                    {he ? 'הוסף לפחות ZIP code אחד' : 'Add at least one ZIP code to continue'}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ─── Step 2: Working Hours ─── */}
          {step === 2 && (
            <div className="animate-fade-in space-y-6">
              <div className="text-center">
                <h1 className="text-2xl font-bold text-zinc-900">
                  {he ? 'שעות העבודה שלך' : 'Your working hours'}
                </h1>
                <p className="text-sm text-zinc-500 mt-1">
                  {he ? 'מתי אתה זמין לקבל לידים?' : 'When are you available to receive leads?'}
                </p>
              </div>

              {/* Quick presets */}
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

      {/* Bottom nav */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-zinc-100 px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          {step > 0 ? (
            <button
              type="button"
              onClick={() => setStep(step - 1)}
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
              disabled={!canNext()}
              onClick={() => setStep(step + 1)}
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
              {he ? 'סיום והתחלה' : 'Finish & Start'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
