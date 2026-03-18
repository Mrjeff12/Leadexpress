import { Lock, ArrowRight, Sparkles } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useI18n } from '../lib/i18n'
import { Player } from '@remotion/player'

interface FeatureTeaserProps {
  videoComponent: React.FC
  durationInFrames: number
  fps: number
  compositionWidth: number
  compositionHeight: number
  featureName: string
  price: number
  planName: string
  children: React.ReactNode
}

export default function FeatureTeaser({
  videoComponent,
  durationInFrames,
  fps,
  compositionWidth,
  compositionHeight,
  featureName,
  price,
  planName,
  children,
}: FeatureTeaserProps) {
  const navigate = useNavigate()
  const { locale } = useI18n()
  const he = locale === 'he'

  return (
    <div className="relative w-full h-full min-h-[calc(100vh-4rem)] overflow-hidden">
      {/* Blurred mock content */}
      <div className="absolute inset-0 pointer-events-none select-none" style={{ filter: 'blur(8px)', opacity: 0.3 }}>
        {children}
      </div>

      {/* Dark overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/70 to-black/80" />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center min-h-[calc(100vh-4rem)] py-6 px-4">
        {/* Top: Lock + title (compact) */}
        <div className="flex items-center gap-3 mb-4">
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

        {/* Remotion Player */}
        <div className="flex-1 flex items-center justify-center w-full max-w-3xl">
          <div className="w-full rounded-2xl overflow-hidden shadow-2xl shadow-black/40">
            <Player
              component={videoComponent}
              durationInFrames={durationInFrames}
              fps={fps}
              compositionWidth={compositionWidth}
              compositionHeight={compositionHeight}
              style={{ width: '100%' }}
              autoPlay
              loop
              controls={false}
            />
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
