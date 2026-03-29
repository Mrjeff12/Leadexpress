import { timeAgo } from '../lib/shared'
import StarRating from './StarRating'
import { ThumbsUp, MessageSquareQuote } from 'lucide-react'

/* ───────────────── Types ───────────────── */

export interface ReviewData {
  id: string
  overall: number
  quality: number | null
  communication: number | null
  timeliness: number | null
  would_hire_again: boolean | null
  review_text: string
  response_text: string | null
  responded_at: string | null
  created_at: string
  reviewer_name: string | null
}

interface ReviewCardProps {
  review: ReviewData
}

/* ───────────────── Helpers ───────────────── */

function getInitials(name: string | null): string {
  if (!name) return '?'
  return name
    .split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

/* ───────────────── Component ───────────────── */

export default function ReviewCard({ review }: ReviewCardProps) {
  return (
    <div className="rounded-xl border border-white/15 bg-white/5 backdrop-blur-md p-4 space-y-3">
      {/* Header: avatar + name + date */}
      <div className="flex items-center gap-3">
        <div className="flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-full bg-gradient-to-br from-orange-500 to-pink-500 text-white text-xs font-bold">
          {getInitials(review.reviewer_name)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate">
            {review.reviewer_name || 'Anonymous'}
          </p>
          <p className="text-xs text-white/40">{timeAgo(review.created_at)}</p>
        </div>
      </div>

      {/* Star rating row */}
      <div className="flex items-center gap-3 flex-wrap">
        <StarRating rating={review.overall} size="sm" />
        {review.quality != null && (
          <span className="text-xs text-white/50">Quality: {review.quality}/5</span>
        )}
        {review.communication != null && (
          <span className="text-xs text-white/50">Comms: {review.communication}/5</span>
        )}
        {review.timeliness != null && (
          <span className="text-xs text-white/50">Timeliness: {review.timeliness}/5</span>
        )}
      </div>

      {/* Would hire again badge */}
      {review.would_hire_again && (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 px-2.5 py-0.5 text-xs font-medium text-emerald-300">
          <ThumbsUp size={12} /> Would hire again
        </span>
      )}

      {/* Review text */}
      <p className="text-sm text-white/80 leading-relaxed whitespace-pre-line">
        {review.review_text}
      </p>

      {/* Response from reviewee */}
      {review.response_text && (
        <div className="ml-4 rounded-lg border border-white/10 bg-white/5 p-3 space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-medium text-white/60">
            <MessageSquareQuote size={12} />
            Response
            {review.responded_at && (
              <span className="text-white/30">&middot; {timeAgo(review.responded_at)}</span>
            )}
          </div>
          <p className="text-sm text-white/70 leading-relaxed whitespace-pre-line">
            {review.response_text}
          </p>
        </div>
      )}
    </div>
  )
}
