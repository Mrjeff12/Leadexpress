import { Star, Shield, Award, Crown } from 'lucide-react'
import { useSubscriptionAccess } from '../hooks/useSubscriptionAccess'

const LEVELS = [
  { name: 'Member',  threshold: 0,    color: '#94a3b8', icon: Star },
  { name: 'Insider', threshold: 200,  color: '#22c55e', icon: Shield },
  { name: 'Partner', threshold: 500,  color: '#eab308', icon: Award },
  { name: 'VIP',     threshold: 1000, color: '#ef4444', icon: Crown },
] as const

function getCurrentLevel(points: number) {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (points >= LEVELS[i].threshold) return { current: LEVELS[i], next: LEVELS[i + 1] ?? null, index: i }
  }
  return { current: LEVELS[0], next: LEVELS[1], index: 0 }
}

export default function NetworkPointsCard() {
  const { networkPoints, loading } = useSubscriptionAccess()

  if (loading) return null

  const { current, next } = getCurrentLevel(networkPoints)
  const Icon = current.icon

  // Progress calculation
  const progressStart = current.threshold
  const progressEnd = next ? next.threshold : current.threshold
  const progressPct = next
    ? Math.min(((networkPoints - progressStart) / (progressEnd - progressStart)) * 100, 100)
    : 100
  const pointsToNext = next ? progressEnd - networkPoints : 0

  return (
    <div className="rounded-2xl bg-white border border-stone-100 p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: `${current.color}15`, color: current.color }}
          >
            <Icon className="w-4 h-4" strokeWidth={2} />
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-stone-400 block">
              Network Level
            </span>
            <span className="text-sm font-bold" style={{ color: current.color }}>
              {current.name}
            </span>
          </div>
        </div>
        <div className="text-right">
          <span className="text-xl font-extrabold text-stone-900 tracking-tight">{networkPoints}</span>
          <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide ml-1">pts</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-2 rounded-full bg-stone-100 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{
            width: `${progressPct}%`,
            background: `linear-gradient(90deg, ${current.color}, ${next?.color ?? current.color})`,
          }}
        />
      </div>

      {/* Footer text */}
      <p className="text-[11px] font-medium text-stone-400 mt-2">
        {next ? (
          <>
            <span className="font-bold text-stone-500">{pointsToNext}</span> points to{' '}
            <span className="font-bold" style={{ color: next.color }}>{next.name}</span>
          </>
        ) : (
          <span className="font-bold" style={{ color: current.color }}>Max level reached!</span>
        )}
      </p>
    </div>
  )
}
