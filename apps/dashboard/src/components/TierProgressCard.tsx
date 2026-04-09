import { CheckCircle2, Circle, Briefcase, Star, MessageSquare, ShieldCheck } from 'lucide-react'
import { useContractorProfile } from '../hooks/useContractorProfile'
import { useIdentityVerification } from '../hooks/useIdentityVerification'
import { useI18n } from '../lib/i18n'
import TrustBadge from './TrustBadge'
import { Link } from 'react-router-dom'

type Tier = 'new' | 'verified' | 'trusted' | 'elite'

interface Criterion {
  icon: typeof Briefcase
  label: string
  labelHe: string
  current: number
  required: number
  met: boolean
}

const NEXT_TIER: Record<Tier, Tier | null> = {
  new: 'verified',
  verified: 'trusted',
  trusted: 'elite',
  elite: null,
}

const TIER_LABEL_HE: Record<Tier, string> = {
  new: 'חדש',
  verified: 'מאומת',
  trusted: 'מהימן',
  elite: 'עילית',
}

function buildCriteria(
  tier: Tier,
  stats: { job_orders_completed: number; member_since: string; network_points: number; avg_response_mins: number | null },
  profile: { avg_rating: number; review_count: number },
): Criterion[] {
  const completed = stats.job_orders_completed
  const rating = profile.avg_rating
  const reviewCount = profile.review_count
  const next = NEXT_TIER[tier]

  if (next === 'verified') return [] // Stripe Identity only
  if (next === 'trusted') {
    return [
      { icon: Briefcase, label: 'Completed jobs', labelHe: 'עבודות שהושלמו', current: completed, required: 10, met: completed >= 10 },
      { icon: Star, label: 'Average rating', labelHe: 'דירוג ממוצע', current: rating, required: 4.0, met: rating >= 4.0 },
    ]
  }
  if (next === 'elite') {
    return [
      { icon: Briefcase, label: 'Completed jobs', labelHe: 'עבודות שהושלמו', current: completed, required: 30, met: completed >= 30 },
      { icon: Star, label: 'Average rating', labelHe: 'דירוג ממוצע', current: rating, required: 4.5, met: rating >= 4.5 },
      { icon: MessageSquare, label: 'Reviews received', labelHe: 'ביקורות שהתקבלו', current: reviewCount, required: 10, met: reviewCount >= 10 },
    ]
  }
  return []
}

export default function TierProgressCard() {
  const { data, isLoading } = useContractorProfile()
  const { isVerified, isPending: verifyPending, startVerification, actionLoading } = useIdentityVerification()
  const { locale } = useI18n()
  const isHe = locale === 'he'

  if (isLoading || !data) {
    return (
      <div className="glass-panel p-5 animate-pulse">
        <div className="h-5 w-32 bg-stone-200 rounded mb-3" />
        <div className="h-3 w-full bg-stone-100 rounded" />
      </div>
    )
  }

  const tier = data.profile.tier as Tier
  const nextTier = NEXT_TIER[tier]
  const criteria = buildCriteria(tier, data.stats, data.profile)
  const metCount = criteria.filter((c) => c.met).length
  const progress = criteria.length > 0 ? Math.round((metCount / criteria.length) * 100) : 100

  return (
    <div className="glass-panel p-5 space-y-4" dir={isHe ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-stone-400 uppercase tracking-wider">
          {isHe ? 'דרגת אמון' : 'Trust Tier'}
        </h3>
        <TrustBadge tier={tier} size="md" />
      </div>

      {/* Elite celebration */}
      {!nextTier && (
        <div className="text-center py-3 space-y-1.5">
          <p className="text-2xl">🏆</p>
          <p className="text-sm font-semibold text-stone-800">
            {isHe ? 'הגעת לדרגה הגבוהה ביותר!' : "You've reached the highest level!"}
          </p>
          <p className="text-xs text-stone-400">
            {isHe ? 'אתה מוכר כאיש מקצוע עילית ברשת' : 'You are recognized as an Elite professional'}
          </p>
        </div>
      )}

      {/* Verified requires Stripe Identity */}
      {nextTier === 'verified' && (
        <div className="space-y-3">
          <p className="text-sm text-stone-500">
            {isHe
              ? 'אמת את הזהות שלך כדי לקבל עדיפות בלידים חדשים'
              : 'Verify your identity to get priority on new leads'}
          </p>
          {verifyPending ? (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200">
              <ShieldCheck size={16} className="text-amber-600" />
              <span className="text-sm text-amber-700 font-medium">
                {isHe ? 'האימות בבדיקה...' : 'Verification pending...'}
              </span>
            </div>
          ) : (
            <button
              onClick={() => startVerification()}
              disabled={actionLoading}
              className="w-full py-2.5 rounded-xl bg-[#fe5b25] text-white text-sm font-bold hover:bg-[#e5501f] transition-all active:scale-[0.97] disabled:opacity-50"
            >
              {actionLoading
                ? (isHe ? 'טוען...' : 'Loading...')
                : (isHe ? '✓ אמת עכשיו — חינם' : '✓ Verify Now — Free')}
            </button>
          )}
        </div>
      )}

      {/* Progress to trusted/elite */}
      {nextTier && nextTier !== 'verified' && criteria.length > 0 && (
        <>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-stone-400">
              <span>
                {isHe ? 'התקדמות ל' : 'Progress to '}
                <span className="font-medium text-stone-600 capitalize">
                  {isHe ? TIER_LABEL_HE[nextTier] : nextTier}
                </span>
              </span>
              <span>{metCount}/{criteria.length}</span>
            </div>
            <div className="h-2 rounded-full bg-stone-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#fe5b25] to-amber-400 transition-all duration-700"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <ul className="space-y-2.5">
            {criteria.map((c) => {
              const Icon = c.icon
              const Check = c.met ? CheckCircle2 : Circle
              return (
                <li key={c.label} className="flex items-center gap-2.5 text-sm">
                  <Check size={16} className={c.met ? 'text-green-500 shrink-0' : 'text-stone-300 shrink-0'} />
                  <Icon size={14} className="text-stone-400 shrink-0" />
                  <span className={c.met ? 'text-stone-700' : 'text-stone-500'}>
                    {isHe ? c.labelHe : c.label}
                  </span>
                  <span className="ml-auto font-mono text-xs tabular-nums">
                    <span className={c.met ? 'text-green-500' : 'text-stone-600'}>
                      {typeof c.current === 'number' && c.current % 1 !== 0 ? c.current.toFixed(1) : c.current}
                    </span>
                    <span className="text-stone-300">/{c.required}</span>
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
