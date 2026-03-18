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
}: FeatureTeaserProps) {
  const navigate = useNavigate()
  const { locale } = useI18n()
  const he = locale === 'he'

  return (
    <div
      className="w-full min-h-[calc(100vh-4rem)] flex flex-col items-center"
      style={{ background: 'linear-gradient(160deg, #1a1a2e 0%, #0f0f1a 40%, #1a0f0a 100%)' }}
    >
      {/* Top: Lock + title */}
      <div className="flex items-center gap-3 pt-6 pb-4 px-6">
        <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-xl flex items-center justify-center border border-white/[0.08]">
          <Lock className="w-4 h-4 text-white/70" />
        </div>
        <div>
          <h1 className="text-lg font-extrabold text-white leading-tight">{featureName}</h1>
          <p className="text-[10px] text-white/30 font-medium tracking-wide">
            {he ? `זמין בחבילת ${planName}` : `Available on ${planName} plan`}
          </p>
        </div>
      </div>

      {/* Remotion Player — seamless, no border/shadow */}
      <div className="flex-1 flex items-center justify-center w-full">
        <div className="w-full">
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
      <div className="py-5 px-6 w-full max-w-sm">
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
          className="w-full mt-2 py-2 text-xs font-medium text-white/30 hover:text-white/60 transition-colors flex items-center justify-center gap-1"
        >
          {he ? 'השוואת חבילות' : 'Compare all plans'}
          <ArrowRight className="w-3 h-3" />
        </button>
      </div>
    </div>
  )
}
