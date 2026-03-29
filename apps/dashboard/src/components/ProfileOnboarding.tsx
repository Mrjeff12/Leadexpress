import { useState } from 'react'
import { X, ArrowRight, ArrowLeft, Sparkles, User, Briefcase, CheckCircle2 } from 'lucide-react'
import { useContractorProfile } from '../hooks/useContractorProfile'
import { useI18n } from '../lib/i18n'

interface ProfileOnboardingProps {
  onClose: () => void
}

export default function ProfileOnboarding({ onClose }: ProfileOnboardingProps) {
  const { locale } = useI18n()
  const isHe = locale === 'he'
  const { data, save, isSaving, publishProfile, isPublishing } = useContractorProfile()

  const [step, setStep] = useState(0)
  const [headline, setHeadline] = useState(data?.profile?.headline ?? '')
  const [bio, setBio] = useState(data?.profile?.bio ?? '')
  const [acceptsPercentage, setAcceptsPercentage] = useState(data?.profile?.accepts_percentage ?? false)
  const [acceptsFixed, setAcceptsFixed] = useState(data?.profile?.accepts_fixed ?? false)
  const [acceptsSubwork, setAcceptsSubwork] = useState(data?.profile?.accepts_subwork ?? false)
  const [minJob, setMinJob] = useState(data?.profile?.min_job_value?.toString() ?? '')
  const [maxJob, setMaxJob] = useState(data?.profile?.max_job_value?.toString() ?? '')
  const [published, setPublished] = useState(false)

  const steps = [
    {
      icon: Sparkles,
      title: isHe ? 'ברוך הבא! בוא נגדיר את הפרופיל שלך' : "Welcome! Let's set up your profile",
      subtitle: isHe ? 'פרופיל מלא עוזר ללקוחות למצוא אותך' : 'A complete profile helps clients find you',
    },
    {
      icon: Briefcase,
      title: isHe ? 'העדפות עבודה' : 'Work Preferences',
      subtitle: isHe ? 'ספר לנו איזה סוג עבודות אתה מחפש' : 'Tell us what kind of work you prefer',
    },
    {
      icon: CheckCircle2,
      title: isHe ? 'כמעט סיימנו!' : 'Almost done!',
      subtitle: isHe ? 'סקירה ופרסום הפרופיל שלך' : 'Review and publish your profile',
    },
  ]

  const handleSaveStep1 = async () => {
    await save({ headline: headline || null, bio: bio || null })
    setStep(1)
  }

  const handleSaveStep2 = async () => {
    await save({
      accepts_percentage: acceptsPercentage,
      accepts_fixed: acceptsFixed,
      accepts_subwork: acceptsSubwork,
      min_job_value: minJob ? Number(minJob) : null,
      max_job_value: maxJob ? Number(maxJob) : null,
    })
    setStep(2)
  }

  const handlePublish = async () => {
    try {
      await publishProfile()
      setPublished(true)
      setTimeout(onClose, 1500)
    } catch {
      // slug generation may fail — just close
      onClose()
    }
  }

  const currentStep = steps[step]
  const StepIcon = currentStep.icon

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in">
      <div
        className="relative w-full max-w-lg mx-4 bg-white rounded-3xl shadow-2xl overflow-hidden animate-scale-in"
        dir={isHe ? 'rtl' : 'ltr'}
      >
        {/* Skip button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 rounded-xl bg-stone-100 text-stone-400 hover:bg-stone-200 hover:text-stone-600 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Progress bar */}
        <div className="flex gap-1.5 px-6 pt-6">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                i <= step ? 'bg-[#fe5b25]' : 'bg-stone-200'
              }`}
            />
          ))}
        </div>

        {/* Header */}
        <div className="px-6 pt-5 pb-2 text-center">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#fe5b25] to-[#e04d1c] flex items-center justify-center mx-auto mb-3">
            <StepIcon className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-xl font-bold text-stone-900 mb-1">{currentStep.title}</h2>
          <p className="text-sm text-stone-400">{currentStep.subtitle}</p>
        </div>

        {/* Step content */}
        <div className="px-6 py-5">

          {/* ── Step 1: Headline + Bio ── */}
          {step === 0 && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-500 mb-1.5">
                  {isHe ? 'כותרת מקצועית' : 'Professional Headline'}
                </label>
                <input
                  type="text"
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                  placeholder={isHe ? 'לדוגמה: חשמלאי מוסמך עם 10 שנות ניסיון' : 'e.g. Licensed Electrician with 10 years experience'}
                  className="w-full rounded-xl border border-stone-200 px-4 py-3 text-sm text-stone-800 placeholder:text-stone-300 focus:outline-none focus:ring-2 focus:ring-[#fe5b25]/20 focus:border-[#fe5b25]/50 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-stone-500 mb-1.5">
                  {isHe ? 'ביוגרפיה' : 'Bio'}
                </label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={4}
                  placeholder={isHe ? 'ספר על עצמך, הניסיון שלך, ומה מייחד אותך...' : 'Tell clients about yourself, your experience, and what makes you stand out...'}
                  className="w-full rounded-xl border border-stone-200 px-4 py-3 text-sm text-stone-800 placeholder:text-stone-300 focus:outline-none focus:ring-2 focus:ring-[#fe5b25]/20 focus:border-[#fe5b25]/50 transition-all resize-none"
                />
                <p className="text-[10px] text-stone-300 mt-1">
                  {bio.length}/50 {isHe ? 'תווים מינימום' : 'chars min'}
                </p>
              </div>
            </div>
          )}

          {/* ── Step 2: Work Preferences ── */}
          {step === 1 && (
            <div className="space-y-4">
              <p className="text-xs font-bold text-stone-400 uppercase tracking-wide mb-2">
                {isHe ? 'סוגי עבודה מקובלים' : 'Accepted Work Types'}
              </p>

              {[
                { label: isHe ? 'עבודה באחוזים' : 'Percentage-based', value: acceptsPercentage, toggle: () => setAcceptsPercentage(!acceptsPercentage) },
                { label: isHe ? 'מחיר קבוע' : 'Fixed price', value: acceptsFixed, toggle: () => setAcceptsFixed(!acceptsFixed) },
                { label: isHe ? 'קבלנות משנה' : 'Subcontracting', value: acceptsSubwork, toggle: () => setAcceptsSubwork(!acceptsSubwork) },
              ].map((item) => (
                <button
                  key={item.label}
                  onClick={item.toggle}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all ${
                    item.value
                      ? 'bg-[#fff4ef] border-[#fdd5c5] text-[#c43d10]'
                      : 'bg-white border-stone-200 text-stone-600 hover:border-stone-300'
                  }`}
                >
                  <span className="text-sm font-semibold">{item.label}</span>
                  <div className={`w-8 h-4 rounded-full transition-colors ${item.value ? 'bg-[#fe5b25]' : 'bg-stone-300'}`}>
                    <div className={`w-3 h-3 rounded-full bg-white shadow mt-0.5 transition-transform ${item.value ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </div>
                </button>
              ))}

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-xs font-bold text-stone-500 mb-1.5">
                    {isHe ? 'ערך עבודה מינימלי' : 'Min Job Value'}
                  </label>
                  <input
                    type="number"
                    value={minJob}
                    onChange={(e) => setMinJob(e.target.value)}
                    placeholder="$0"
                    className="w-full rounded-xl border border-stone-200 px-3 py-2.5 text-sm text-stone-800 placeholder:text-stone-300 focus:outline-none focus:ring-2 focus:ring-[#fe5b25]/20 focus:border-[#fe5b25]/50 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-500 mb-1.5">
                    {isHe ? 'ערך עבודה מקסימלי' : 'Max Job Value'}
                  </label>
                  <input
                    type="number"
                    value={maxJob}
                    onChange={(e) => setMaxJob(e.target.value)}
                    placeholder="$10,000"
                    className="w-full rounded-xl border border-stone-200 px-3 py-2.5 text-sm text-stone-800 placeholder:text-stone-300 focus:outline-none focus:ring-2 focus:ring-[#fe5b25]/20 focus:border-[#fe5b25]/50 transition-all"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ── Step 3: Summary + Publish ── */}
          {step === 2 && (
            <div className="space-y-3">
              {published ? (
                <div className="text-center py-6">
                  <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
                    <CheckCircle2 className="w-8 h-8 text-green-500" />
                  </div>
                  <p className="text-lg font-bold text-stone-900">
                    {isHe ? 'הפרופיל פורסם!' : 'Profile Published!'}
                  </p>
                </div>
              ) : (
                <>
                  {[
                    { label: isHe ? 'כותרת' : 'Headline', value: headline || (isHe ? 'לא הוזן' : 'Not set'), filled: !!headline },
                    { label: isHe ? 'ביוגרפיה' : 'Bio', value: bio ? `${bio.slice(0, 60)}...` : (isHe ? 'לא הוזן' : 'Not set'), filled: !!bio },
                    { label: isHe ? 'אחוזים' : 'Percentage', value: acceptsPercentage ? '✓' : '—', filled: acceptsPercentage },
                    { label: isHe ? 'מחיר קבוע' : 'Fixed Price', value: acceptsFixed ? '✓' : '—', filled: acceptsFixed },
                    { label: isHe ? 'קבלנות משנה' : 'Subcontracting', value: acceptsSubwork ? '✓' : '—', filled: acceptsSubwork },
                    { label: isHe ? 'טווח מחירים' : 'Price Range', value: minJob || maxJob ? `$${minJob || '0'} – $${maxJob || '∞'}` : (isHe ? 'לא הוזן' : 'Not set'), filled: !!(minJob || maxJob) },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className={`flex items-center justify-between px-4 py-2.5 rounded-xl border ${
                        item.filled ? 'bg-green-50/60 border-green-100' : 'bg-stone-50 border-stone-100'
                      }`}
                    >
                      <span className="text-xs font-semibold text-stone-500">{item.label}</span>
                      <span className={`text-xs font-bold ${item.filled ? 'text-green-600' : 'text-stone-300'}`}>
                        {item.value}
                      </span>
                    </div>
                  ))}

                  <button
                    onClick={handlePublish}
                    disabled={isPublishing}
                    className="w-full mt-4 py-3 px-4 rounded-xl bg-[#fe5b25] text-white font-bold text-sm hover:bg-[#e04d1c] disabled:opacity-60 transition-colors shadow-sm flex items-center justify-center gap-2"
                  >
                    {isPublishing ? (
                      <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    ) : (
                      <Sparkles className="w-4 h-4" />
                    )}
                    {isHe ? 'פרסם פרופיל' : 'Publish Profile'}
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Navigation buttons */}
        {!published && (
          <div className="flex items-center justify-between px-6 pb-6">
            {step > 0 ? (
              <button
                onClick={() => setStep(step - 1)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-stone-500 hover:bg-stone-100 transition-colors"
              >
                <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
                {isHe ? 'חזור' : 'Back'}
              </button>
            ) : (
              <div />
            )}

            {step < 2 && (
              <button
                onClick={step === 0 ? handleSaveStep1 : handleSaveStep2}
                disabled={isSaving}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#fe5b25] text-white text-sm font-bold hover:bg-[#e04d1c] disabled:opacity-60 transition-colors shadow-sm"
              >
                {isSaving ? (
                  <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                ) : (
                  <>
                    {isHe ? 'הבא' : 'Next'}
                    <ArrowRight className="w-4 h-4 rtl:rotate-180" />
                  </>
                )}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
