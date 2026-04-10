import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, ArrowLeft, Check, Loader2, Zap } from 'lucide-react'
import { useI18n } from '../lib/i18n'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { useToast } from '../components/hooks/use-toast'
import { useContractorSettings } from '../hooks/useContractorSettings'
import { useSubscriptionAccess } from '../hooks/useSubscriptionAccess'
import { useOnboardingPlan, type StepKey } from '../hooks/useOnboardingPlan'
import type { SelectedArea } from '../components/settings/ServiceAreaSelector'
import CredentialsStep from '../components/onboarding/CredentialsStep'
import PhoneStep from '../components/onboarding/PhoneStep'
import ProfessionStep from '../components/onboarding/ProfessionStep'
import AreaStep from '../components/onboarding/AreaStep'
import HoursStep from '../components/onboarding/HoursStep'
import CreditCardStep from '../components/onboarding/CreditCardStep'

export default function OnboardingWizard() {
  const { locale } = useI18n()
  const he = locale === 'he'
  const { toast } = useToast()
  const { user } = useAuth()
  const { maxProfessions } = useSubscriptionAccess()
  const { loading: planLoading, steps, refresh } = useOnboardingPlan()

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

  const [stepIndex, setStepIndex] = useState(0)
  const [waPhone, setWaPhone] = useState('')
  const [waCountry, setWaCountry] = useState<'+1' | '+972'>(he ? '+972' : '+1')
  const [selectedAreas, setSelectedAreas] = useState<SelectedArea[]>([])

  const currentStep: StepKey | undefined = steps[stepIndex]

  // When wizard computes no steps, immediately hand off to dashboard.
  useEffect(() => {
    if (!planLoading && steps.length === 0) {
      window.location.href = '/'
    }
  }, [planLoading, steps.length])

  function goNext() {
    if (stepIndex < steps.length - 1) {
      setStepIndex((i) => i + 1)
    } else {
      finishWizard()
    }
  }

  function goBack() {
    if (stepIndex > 0) setStepIndex((i) => i - 1)
  }

  async function saveWhatsAppPhone() {
    if (!user) return
    const full = `${waCountry}${waPhone.replace(/\D/g, '')}`
    await supabase
      .from('profiles')
      .update({ whatsapp_phone: full, phone: full })
      .eq('id', user.id)
  }

  async function saveAreasAndHours() {
    await save()
    if (user && selectedAreas.length > 0) {
      const countyNames = selectedAreas.map((a) => a.county)
      await supabase.from('profiles').update({ counties: countyNames }).eq('id', user.id)
    }
  }

  async function canProceed(): Promise<boolean> {
    if (!currentStep) return true
    switch (currentStep) {
      case 'phone': {
        const digits = waPhone.replace(/\D/g, '')
        const minLen = waCountry === '+972' ? 9 : 10
        return digits.length >= minLen
      }
      case 'profession':
        return professions.length > 0
      case 'area':
        return selectedAreas.length > 0 || zipCodes.length > 0
      case 'hours':
        return true
      default:
        return true
    }
  }

  async function handleNextClick() {
    const ok = await canProceed()
    if (!ok) return

    if (currentStep === 'phone') await saveWhatsAppPhone()
    if (currentStep === 'hours' || currentStep === 'area') {
      try {
        await saveAreasAndHours()
      } catch {
        toast({
          title: he ? 'שמירה נכשלה' : 'Save failed',
          description: he ? 'נסה שוב' : 'Please try again.',
          variant: 'destructive',
        })
        return
      }
    }
    goNext()
  }

  async function finishWizard() {
    await refresh()
    window.location.href = '/'
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

  // Steps that handle their own Next button (credentials, credit card)
  const selfCompletingSteps: StepKey[] = ['credentials', 'credit_card']
  const showBottomNav = currentStep && !selfCompletingSteps.includes(currentStep)

  const progressLabel = useMemo(() => {
    if (steps.length === 0) return ''
    return `${stepIndex + 1} / ${steps.length}`
  }, [stepIndex, steps.length])

  if (planLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-white">
        <Loader2 className="w-6 h-6 animate-spin text-[#fe5b25]" />
      </div>
    )
  }

  if (!currentStep) {
    return null
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
            <img src="/icon.png" alt="MasterLeadFlow" className="w-full h-full rounded-lg" />
          </div>
          <span className="text-sm font-bold text-zinc-800">MasterLeadFlow</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-zinc-400">
          <Zap className="w-3.5 h-3.5 text-[#fe5b25]" />
          <span>{progressLabel}</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-zinc-100">
        <div
          className="h-full transition-all duration-500 ease-out"
          style={{
            width: `${((stepIndex + 1) / steps.length) * 100}%`,
            background: 'linear-gradient(90deg, #fe5b25, #ff8a5c)',
          }}
        />
      </div>

      {/* Welcome header */}
      <div className="text-center pt-5 pb-2 px-4">
        <h2 className="text-base md:text-lg font-bold text-zinc-800">
          {he ? 'בוא נגדיר את החשבון שלך' : "Let's set up your account"}
        </h2>
        <p className="text-xs text-zinc-400 mt-0.5">
          {he
            ? `${steps.length} שלבים קצרים — תסיים תוך שניות`
            : `${steps.length} quick steps — done in seconds`}
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 md:px-6 pb-32">
        <div className={`w-full mx-auto ${currentStep === 'area' ? 'md:max-w-5xl' : 'md:max-w-2xl'}`}>
          {currentStep === 'credentials' && <CredentialsStep onComplete={goNext} />}
          {currentStep === 'phone' && (
            <PhoneStep
              phone={waPhone}
              country={waCountry}
              onPhoneChange={setWaPhone}
              onCountryChange={setWaCountry}
            />
          )}
          {currentStep === 'profession' && (
            <ProfessionStep
              professions={professions}
              maxProf={maxProfessions}
              onToggle={toggleProfession}
            />
          )}
          {currentStep === 'area' && (
            <AreaStep
              selectedAreas={selectedAreas}
              onAddArea={handleAddArea}
              onRemoveArea={handleRemoveArea}
            />
          )}
          {currentStep === 'hours' && (
            <HoursStep workingHours={workingHours} setWorkingHours={setWorkingHours} />
          )}
          {currentStep === 'credit_card' && <CreditCardStep onComplete={finishWizard} />}
        </div>
      </div>

      {/* Bottom nav — only for steps that don't manage their own buttons */}
      {showBottomNav && (
        <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t border-zinc-100 px-4 md:px-6 py-3 md:py-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <div className="max-w-2xl mx-auto flex items-center justify-between">
            {stepIndex > 0 ? (
              <button
                type="button"
                onClick={goBack}
                className="flex items-center gap-2 px-4 md:px-5 py-3 md:py-2.5 rounded-xl text-sm font-semibold text-zinc-600 hover:bg-zinc-50 transition-all"
              >
                <ArrowLeft className="w-4 h-4" />
                {he ? 'חזרה' : 'Back'}
              </button>
            ) : (
              <div />
            )}

            <button
              type="button"
              onClick={handleNextClick}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-3 md:py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40 transition-all shadow-md shadow-[#fe5b25]/20"
              style={{ background: 'linear-gradient(135deg, #fe5b25, #e04d1c)' }}
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : stepIndex === steps.length - 1 ? (
                <>
                  <Check className="w-4 h-4" />
                  {he ? 'סיום' : 'Finish'}
                </>
              ) : (
                <>
                  {he ? 'הבא' : 'Next'}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
