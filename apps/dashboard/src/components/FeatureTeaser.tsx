import { useState, useEffect } from 'react'
import { Lock, ArrowRight, Sparkles } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useI18n } from '../lib/i18n'

interface TeaserStep {
  icon: string       // emoji for the pipeline card
  label: string      // short label for pipeline card
  title: string      // full title shown above visual
  subtitle: string   // description shown above visual
  visual: React.ReactNode
  duration?: number  // ms per step, default 4500
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
    const dur = steps[currentStep]?.duration || 4500

    setPhase('enter')
    const visibleTimer = setTimeout(() => setPhase('visible'), 50)
    const exitTimer = setTimeout(() => setPhase('exit'), dur - 500)
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
      <div className="relative z-10 flex flex-col items-center min-h-[calc(100vh-4rem)] py-6 px-6">
        {/* Top: Lock + title (compact) */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-xl flex items-center justify-center border border-white/10">
            <Lock className="w-4 h-4 text-white/80" />
          </div>
          <div>
            <h1 className="text-lg font-extrabold text-white leading-tight">{featureName}</h1>
            <p className="text-[10px] text-white/40">
              {he ? `זמין בחבילת ${planName}` : `Available on ${planName} plan`}
            </p>
          </div>
        </div>

        {/* Pipeline — step cards */}
        <div className="w-full max-w-2xl mb-5">
          <div className="flex items-center justify-center gap-1">
            {steps.map((s, i) => {
              const isActive = i === currentStep
              const isDone = i < currentStep
              return (
                <div key={i} className="flex items-center">
                  <button
                    onClick={() => setCurrentStep(i)}
                    className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all duration-300 min-w-[64px] ${
                      isActive
                        ? 'bg-[#fe5b25] shadow-lg shadow-orange-500/30 scale-110'
                        : isDone
                        ? 'bg-white/15 hover:bg-white/20'
                        : 'bg-white/5 hover:bg-white/10'
                    }`}
                  >
                    <span className={`text-base transition-transform duration-300 ${isActive ? 'scale-125' : ''}`}>
                      {s.icon}
                    </span>
                    <span className={`text-[9px] font-bold uppercase tracking-wider leading-none ${
                      isActive ? 'text-white' : isDone ? 'text-white/60' : 'text-white/30'
                    }`}>
                      {s.label}
                    </span>
                  </button>
                  {/* Connector line between cards */}
                  {i < steps.length - 1 && (
                    <div className={`w-4 h-[2px] transition-colors duration-300 ${
                      i < currentStep ? 'bg-[#fe5b25]/60' : 'bg-white/10'
                    }`} />
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Step title + subtitle */}
        <div className="mb-3 text-center">
          <h2 className="text-lg font-bold text-white">{step.title}</h2>
          <p className="text-sm text-white/50 mt-1 max-w-md">{step.subtitle}</p>
        </div>

        {/* Animated visual */}
        <div className="flex-1 flex items-center justify-center w-full max-w-2xl">
          <div className={`w-full transition-all duration-500 ease-out ${animClass}`}>
            {step.visual}
          </div>
        </div>

        {/* CTA */}
        <div className="mt-4 w-full max-w-sm">
          <button
            onClick={() => navigate('/subscription')}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-[#fe5b25] to-[#e04d1c] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-orange-600/30 hover:shadow-orange-600/50 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <Sparkles className="w-4 h-4" />
            {he
              ? `שדרג ל-${planName} — $${price}/חודש`
              : `Upgrade to ${planName} — $${price}/mo`
            }
          </button>

          <button
            onClick={() => navigate('/subscription')}
            className="w-full mt-2 py-2 text-xs font-medium text-white/40 hover:text-white/70 transition-colors flex items-center justify-center gap-1"
          >
            {he ? 'השוואת חבילות' : 'Compare all plans'}
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  )
}
