import { useState, useEffect } from 'react'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import ReviewCard, { type ReviewData } from '../components/ReviewCard'
import StarRating from '../components/StarRating'
import { Star, Loader2, Sparkles, ThumbsUp } from 'lucide-react'

/* ───────────────── Component ───────────────── */

export default function MyReviews() {
  const { effectiveUserId } = useAuth()
  const [reviews, setReviews] = useState<ReviewData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!effectiveUserId) return
    let cancelled = false

    async function load() {
      setLoading(true)
      const { data } = await supabase.rpc('get_reviews_for_user', {
        p_user_id: effectiveUserId!,
      })
      if (!cancelled && data) setReviews(data as ReviewData[])
      if (!cancelled) setLoading(false)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [effectiveUserId])

  /* ── Computed stats ── */
  const count = reviews.length
  const avg =
    count > 0 ? reviews.reduce((s, r) => s + r.overall, 0) / count : 0
  const hireAgainCount = reviews.filter(
    (r) => r.would_hire_again === true
  ).length
  const hireAgainTotal = reviews.filter(
    (r) => r.would_hire_again != null
  ).length
  const hireAgainPct =
    hireAgainTotal > 0 ? Math.round((hireAgainCount / hireAgainTotal) * 100) : 0

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#fe5b25' }} />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-20">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-2xl flex items-center justify-center"
          style={{ background: 'rgba(254,91,37,0.1)' }}
        >
          <Star className="w-5 h-5" style={{ color: '#fe5b25' }} />
        </div>
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#0b0707' }}>
            My Reviews
          </h1>
          <p className="text-sm" style={{ color: '#3b3b3b', opacity: 0.55 }}>
            Reviews from clients who have worked with you.
          </p>
        </div>
      </div>

      {/* Empty state */}
      {count === 0 ? (
        <div
          className="rounded-2xl p-10 text-center space-y-3"
          style={{
            background: 'white',
            border: '1px solid rgba(0,0,0,0.06)',
          }}
        >
          <Sparkles className="w-10 h-10 mx-auto" style={{ color: '#d1d5db' }} />
          <p className="text-base font-semibold" style={{ color: '#0b0707' }}>
            No reviews yet
          </p>
          <p className="text-sm" style={{ color: '#3b3b3b', opacity: 0.5 }}>
            Reviews will appear here after you complete jobs.
          </p>
        </div>
      ) : (
        <>
          {/* Summary card */}
          <div
            className="rounded-2xl p-5"
            style={{
              background: 'white',
              border: '1px solid rgba(0,0,0,0.06)',
            }}
          >
            <div className="flex items-center gap-6 flex-wrap">
              {/* Big rating */}
              <div className="text-center">
                <div
                  className="text-4xl font-extrabold"
                  style={{ color: '#0b0707' }}
                >
                  {avg.toFixed(1)}
                </div>
                <StarRating rating={avg} size="md" />
                <p className="text-xs mt-1" style={{ color: '#3b3b3b', opacity: 0.5 }}>
                  {count} review{count !== 1 ? 's' : ''}
                </p>
              </div>

              <div className="flex-1 h-px" style={{ background: 'rgba(0,0,0,0.06)' }} />

              {/* Would hire again */}
              {hireAgainTotal > 0 && (
                <div className="flex flex-col items-center">
                  <div className="flex items-center gap-1.5 text-emerald-600">
                    <ThumbsUp size={18} />
                    <span className="text-2xl font-bold">{hireAgainPct}%</span>
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: '#3b3b3b', opacity: 0.5 }}>
                    would hire again
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Review cards — dark container to match ReviewCard styling */}
          <div
            className="rounded-2xl p-4 space-y-3"
            style={{
              background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
            }}
          >
            {reviews.map((review) => (
              <ReviewCard key={review.id} review={review} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
