import { CheckCircle2, Circle, Briefcase, Star, Zap, Clock, MessageSquare } from 'lucide-react'
import { useContractorProfile } from '../hooks/useContractorProfile'
import TrustBadge from './TrustBadge'

type Tier = 'new' | 'verified' | 'trusted' | 'elite'

interface Criterion {
  icon: typeof Briefcase
  label: string
  current: number
  required: number
  unit?: string
  met: boolean
}

const NEXT_TIER: Record<Tier, Tier | null> = {
  new: 'verified',
  verified: 'trusted',
  trusted: 'elite',
  elite: null,
}

function buildCriteria(
  tier: Tier,
  stats: {
    job_orders_completed: number
    avg_response_mins: number | null
    member_since: string
    network_points: number
  },
  profile: {
    avg_rating: number
    review_count: number
  },
): Criterion[] {
  const completed = stats.job_orders_completed
  const rating = profile.avg_rating
  const reviewCount = profile.review_count
  const tenureDays = stats.member_since
    ? Math.floor((Date.now() - new Date(stats.member_since).getTime()) / 86_400_000)
    : 0

  // Approximate response rate from avg_response_mins (use as proxy)
  // In reality we'd need a separate query; for the card we show a rough indicator
  const responseRate = completed > 0 ? Math.min(100, Math.round((completed / Math.max(completed, 1)) * 100)) : 0

  const next = NEXT_TIER[tier]

  if (next === 'verified') {
    // Verified requires Stripe Identity only — no performance criteria
    return []
  }

  if (next === 'trusted') {
    return [
      { icon: Briefcase, label: 'Completed jobs', current: completed, required: 10, met: completed >= 10 },
      { icon: Star, label: 'Average rating', current: rating, required: 4.0, met: rating >= 4.0 },
    ]
  }

  if (next === 'elite') {
    return [
      { icon: Briefcase, label: 'Completed jobs', current: completed, required: 30, met: completed >= 30 },
      { icon: Star, label: 'Average rating', current: rating, required: 4.5, met: rating >= 4.5 },
      { icon: MessageSquare, label: 'Reviews received', current: reviewCount, required: 10, met: reviewCount >= 10 },
    ]
  }

  return []
}

export default function TierProgressCard() {
  const { data, isLoading } = useContractorProfile()

  if (isLoading || !data) {
    return (
      <div className="glass-panel p-6 animate-pulse">
        <div className="h-6 w-40 bg-white/10 rounded mb-4" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-5 w-full bg-white/5 rounded" />
          ))}
        </div>
      </div>
    )
  }

  const tier = data.profile.tier
  const nextTier = NEXT_TIER[tier]
  const criteria = buildCriteria(tier, data.stats, data.profile)
  const metCount = criteria.filter((c) => c.met).length
  const progress = criteria.length > 0 ? Math.round((metCount / criteria.length) * 100) : 100

  return (
    <div className="glass-panel p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white/70 uppercase tracking-wider">Trust Tier</h3>
        <TrustBadge tier={tier} size="lg" />
      </div>

      {/* Elite celebration */}
      {!nextTier && (
        <div className="text-center py-4 space-y-2">
          <p className="text-2xl">🏆</p>
          <p className="text-white font-semibold">You've reached the highest level!</p>
          <p className="text-white/50 text-sm">
            You are recognized as an Elite professional in the MasterLeadFlow network.
          </p>
        </div>
      )}

      {/* Progress to next tier */}
      {nextTier && (
        <>
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs text-white/50">
              <span>
                Progress to <span className="capitalize font-medium text-white/70">{nextTier}</span>
              </span>
              <span>
                {metCount}/{criteria.length}
              </span>
            </div>
            <div className="h-2 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-400 transition-all duration-700"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Criteria checklist */}
          <ul className="space-y-3">
            {criteria.map((c) => {
              const Icon = c.icon
              const Check = c.met ? CheckCircle2 : Circle
              return (
                <li key={c.label} className="flex items-center gap-3 text-sm">
                  <Check
                    size={18}
                    className={c.met ? 'text-green-400 shrink-0' : 'text-white/20 shrink-0'}
                  />
                  <Icon size={16} className="text-white/40 shrink-0" />
                  <span className={c.met ? 'text-white/80' : 'text-white/50'}>{c.label}</span>
                  <span className="ml-auto font-mono text-xs tabular-nums">
                    <span className={c.met ? 'text-green-400' : 'text-white/70'}>
                      {typeof c.current === 'number' && c.current % 1 !== 0
                        ? c.current.toFixed(1)
                        : c.current}
                    </span>
                    <span className="text-white/30">
                      /{c.required}
                      {c.unit ?? ''}
                    </span>
                  </span>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </div>
  )
}
