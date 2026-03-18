import { useState, useEffect } from 'react'
import { Lock, ArrowRight, Sparkles } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useI18n } from '../lib/i18n'

interface TeaserStep {
  title: string
  subtitle: string
  visual: React.ReactNode
  duration?: number // ms per step, default 4000
}

interface FeatureTeaserProps {
  steps: TeaserStep[]
  featureName: string
  price: number
  planName: string
  children: React.ReactNode
}

export default function FeatureTeaser({ steps, featureName, price, planName, children }: FeatureTeaserProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [phase, setPhase] = useState<'enter' | 'visible' | 'exit'>('enter')
  const navigate = useNavigate()
  const { locale } = useI18n()
  const he = locale === 'he'

  useEffect(() => {
    const dur = steps[currentStep]?.duration || 4000

    // Enter phase
    setPhase('enter')
    const visibleTimer = setTimeout(() => setPhase('visible'), 50)

    // Start exit
    const exitTimer = setTimeout(() => setPhase('exit'), dur - 500)

    // Advance step
    const advanceTimer = setTimeout(() => {
      setCurrentStep((prev) => (prev + 1) % steps.length)
    }, dur)

    return () => {
      clearTimeout(visibleTimer)
      clearTimeout(exitTimer)
      clearTimeout(advanceTimer)
    }
  }, [currentStep, steps])

  const step = steps[currentStep]

  const animClass =
    phase === 'enter'
      ? 'opacity-0 translate-y-6 scale-95'
      : phase === 'visible'
      ? 'opacity-100 translate-y-0 scale-100'
      : 'opacity-0 -translate-y-4 scale-95'

  return (
    <div className="relative w-full h-full min-h-[calc(100vh-4rem)] overflow-hidden">
      {/* Blurred mock content */}
      <div className="absolute inset-0 pointer-events-none select-none" style={{ filter: 'blur(8px)', opacity: 0.4 }}>
        {children}
      </div>

      {/* Dark overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/60 to-black/70" />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center min-h-[calc(100vh-4rem)] py-8 px-6">
        {/* Top: Lock + title */}
        <div className="flex flex-col items-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-xl flex items-center justify-center border border-white/10 mb-4">
            <Lock className="w-5 h-5 text-white/80" />
          </div>
          <h1 className="text-xl font-extrabold text-white mb-1">{featureName}</h1>
          <p className="text-xs text-white/40">
            {he ? `זמין בחבילת ${planName}` : `Available on ${planName} plan`}
          </p>
        </div>

        {/* Step label */}
        <div className="mb-3 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/10 mb-2">
            <span className="text-[10px] font-bold text-white/50 uppercase tracking-wider">
              Step {currentStep + 1}/{steps.length}
            </span>
          </div>
          <h2 className="text-lg font-bold text-white">{step.title}</h2>
          <p className="text-sm text-white/50 mt-1">{step.subtitle}</p>
        </div>

        {/* Animated visual — the "demo" */}
        <div className="flex-1 flex items-center justify-center w-full max-w-2xl">
          <div
            className={`w-full transition-all duration-500 ease-out ${animClass}`}
          >
            {step.visual}
          </div>
        </div>

        {/* Progress dots */}
        <div className="flex justify-center gap-2 mt-6 mb-4">
          {steps.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentStep(i)}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === currentStep ? 'w-8 bg-[#fe5b25]' : i < currentStep ? 'w-1.5 bg-[#fe5b25]/40' : 'w-1.5 bg-white/20'
              }`}
            />
          ))}
        </div>

        {/* CTA */}
        <button
          onClick={() => navigate('/subscription')}
          className="w-full max-w-sm py-4 rounded-2xl bg-gradient-to-r from-[#fe5b25] to-[#e04d1c] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-orange-600/30 hover:shadow-orange-600/50 transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
          <Sparkles className="w-4 h-4" />
          {he
            ? `שדרג ל-${planName} — $${price}/חודש`
            : `Upgrade to ${planName} — $${price}/mo`
          }
        </button>

        <button
          onClick={() => navigate('/subscription')}
          className="mt-2 py-2 text-xs font-medium text-white/40 hover:text-white/70 transition-colors flex items-center gap-1"
        >
          {he ? 'השוואת חבילות' : 'Compare all plans'}
          <ArrowRight className="w-3 h-3" />
        </button>
      </div>
    </div>
  )
}
