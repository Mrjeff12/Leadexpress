import { useState, useEffect } from 'react'
import { Lock, ArrowRight, Sparkles } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useI18n } from '../lib/i18n'

interface TeaserStep {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
  visual: React.ReactNode
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
  const [isTransitioning, setIsTransitioning] = useState(false)
  const navigate = useNavigate()
  const { locale } = useI18n()
  const he = locale === 'he'

  useEffect(() => {
    const interval = setInterval(() => {
      setIsTransitioning(true)
      setTimeout(() => {
        setCurrentStep((prev) => (prev + 1) % steps.length)
        setIsTransitioning(false)
      }, 400)
    }, 3500)
    return () => clearInterval(interval)
  }, [steps.length])

  const step = steps[currentStep]
  const StepIcon = step.icon

  return (
    <div className="relative w-full h-full min-h-[calc(100vh-4rem)] overflow-hidden">
      {/* Blurred mock content */}
      <div className="absolute inset-0 pointer-events-none select-none" style={{ filter: 'blur(8px)', opacity: 0.5 }}>
        {children}
      </div>

      {/* Dark overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/50 to-black/60" />

      {/* Centered teaser card */}
      <div className="relative z-10 flex items-center justify-center min-h-[calc(100vh-4rem)] p-6">
        <div className="w-full max-w-lg">
          {/* Lock badge */}
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-xl flex items-center justify-center border border-white/10">
              <Lock className="w-7 h-7 text-white/80" />
            </div>
          </div>

          {/* Feature name */}
          <h1 className="text-center text-2xl font-extrabold text-white mb-2">
            {featureName}
          </h1>
          <p className="text-center text-sm text-white/50 mb-8">
            {he ? `זמין בחבילת ${planName}` : `Available on ${planName} plan`}
          </p>

          {/* Animated story card */}
          <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/10 p-6 mb-6 min-h-[220px] flex flex-col items-center justify-center">
            <div
              className={`transition-all duration-400 flex flex-col items-center text-center ${
                isTransitioning ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'
              }`}
            >
              {/* Step icon */}
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#fe5b25] to-[#e04d1c] flex items-center justify-center mb-4 shadow-lg shadow-orange-500/20">
                <StepIcon className="w-6 h-6 text-white" />
              </div>

              {/* Step title */}
              <h3 className="text-lg font-bold text-white mb-2">
                {step.title}
              </h3>

              {/* Step description */}
              <p className="text-sm text-white/60 max-w-xs">
                {step.description}
              </p>

              {/* Step visual */}
              <div className="mt-4">
                {step.visual}
              </div>
            </div>
          </div>

          {/* Progress dots */}
          <div className="flex justify-center gap-2 mb-8">
            {steps.map((_, i) => (
              <button
                key={i}
                onClick={() => {
                  setIsTransitioning(true)
                  setTimeout(() => {
                    setCurrentStep(i)
                    setIsTransitioning(false)
                  }, 300)
                }}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === currentStep ? 'w-6 bg-[#fe5b25]' : 'w-1.5 bg-white/20 hover:bg-white/40'
                }`}
              />
            ))}
          </div>

          {/* CTA */}
          <button
            onClick={() => navigate('/subscription')}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-[#fe5b25] to-[#e04d1c] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-orange-600/30 hover:shadow-orange-600/50 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <Sparkles className="w-4 h-4" />
            {he
              ? `שדרג ל-${planName} — $${price}/חודש`
              : `Upgrade to ${planName} — $${price}/mo`
            }
          </button>

          {/* Secondary link */}
          <button
            onClick={() => navigate('/subscription')}
            className="w-full mt-3 py-2 text-xs font-medium text-white/40 hover:text-white/70 transition-colors flex items-center justify-center gap-1"
          >
            {he ? 'השוואת חבילות' : 'Compare all plans'}
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  )
}
