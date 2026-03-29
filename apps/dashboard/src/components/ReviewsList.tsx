import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import StarRating from './StarRating'
import ReviewCard, { type ReviewData } from './ReviewCard'
import { Sparkles, Loader2, ThumbsUp } from 'lucide-react'

/* ───────────────── Types ───────────────── */

interface ReviewsListProps {
  userId: string
  avgRating?: number
  reviewCount?: number
}

/* ───────────────── Component ───────────────── */

export default function ReviewsList({
  userId,
  avgRating: externalAvg,
  reviewCount: externalCount,
}: ReviewsListProps) {
  const [reviews, setReviews] = useState<ReviewData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      const { data } = await supabase.rpc('get_reviews_for_user', {
        p_user_id: userId,
      })
      if (!cancelled && data) setReviews(data as ReviewData[])
      if (!cancelled) setLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [userId])

  /* ── Computed stats ── */
  const count = externalCount ?? reviews.length
  const avg =
    externalAvg ??
    (reviews.length > 0
      ? reviews.reduce((s, r) => s + r.overall, 0) / reviews.length
      : 0)

  const distribution = [5, 4, 3, 2, 1].map((star) => {
    const n = reviews.filter((r) => Math.round(r.overall) === star).length
    return { star, count: n, pct: reviews.length > 0 ? (n / reviews.length) * 100 : 0 }
  })

  const hireAgainPct =
    reviews.length > 0
      ? Math.round(
          (reviews.filter((r) => r.would_hire_again === true).length /
            reviews.filter((r) => r.would_hire_again != null).length) *
            100
        ) || 0
      : 0

  /* ── Loading state ── */
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-white/40">
        <Loader2 size={24} className="animate-spin" />
      </div>
    )
  }

  /* ── Empty state ── */
  if (reviews.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-white/40 space-y-2">
        <Sparkles size={32} className="text-white/20" />
        <p className="text-sm font-medium">No reviews yet</p>
        <p className="text-xs text-white/30">Reviews will appear here once submitted.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* ── Summary header ── */}
      <div className="rounded-2xl border border-white/15 bg-white/5 backdrop-blur-md p-5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          {/* Big star + number */}
          <div className="flex items-center gap-3">
            <span className="text-3xl font-bold text-white">{avg.toFixed(1)}</span>
            <div className="space-y-0.5">
              <StarRating rating={avg} size="md" />
              <p className="text-xs text-white/40">
                {count} review{count !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          {/* Distribution bars */}
          <div className="flex-1 space-y-1">
            {distribution.map((d) => (
              <div key={d.star} className="flex items-center gap-2 text-xs">
                <span className="w-3 text-right text-white/50">{d.star}</span>
                <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-orange-500 to-pink-500 transition-all duration-500"
                    style={{ width: `${d.pct}%` }}
                  />
                </div>
                <span className="w-7 text-right text-white/40">{d.count}</span>
              </div>
            ))}
          </div>

          {/* Would hire again */}
          {reviews.some((r) => r.would_hire_again != null) && (
            <div className="flex flex-col items-center justify-center px-4">
              <div className="flex items-center gap-1.5 text-emerald-400">
                <ThumbsUp size={18} />
                <span className="text-2xl font-bold">{hireAgainPct}%</span>
              </div>
              <p className="text-xs text-white/40 mt-0.5">would hire again</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Review cards ── */}
      <div className="space-y-3">
        {reviews.map((review) => (
          <ReviewCard key={review.id} review={review} />
        ))}
      </div>
    </div>
  )
}
