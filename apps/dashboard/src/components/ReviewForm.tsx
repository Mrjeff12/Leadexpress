import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useToast } from './hooks/use-toast'
import StarRating from './StarRating'
import { ThumbsUp, ThumbsDown, Loader2, Send } from 'lucide-react'

/* ───────────────── Types ───────────────── */

interface ReviewFormProps {
  jobOrderId: string
  revieweeId: string
  revieweeName: string
  onSuccess: () => void
}

/* ───────────────── Component ───────────────── */

export default function ReviewForm({
  jobOrderId,
  revieweeId,
  revieweeName,
  onSuccess,
}: ReviewFormProps) {
  const { toast } = useToast()

  const [overall, setOverall] = useState(0)
  const [quality, setQuality] = useState(0)
  const [communication, setCommunication] = useState(0)
  const [timeliness, setTimeliness] = useState(0)
  const [wouldHireAgain, setWouldHireAgain] = useState<boolean | null>(null)
  const [reviewText, setReviewText] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const canSubmit =
    overall > 0 && reviewText.trim().length >= 20 && !submitting

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return

    setSubmitting(true)
    const { error } = await supabase.rpc('submit_review', {
      p_job_order_id: jobOrderId,
      p_reviewee_id: revieweeId,
      p_overall: overall,
      p_quality: quality || null,
      p_communication: communication || null,
      p_timeliness: timeliness || null,
      p_would_hire_again: wouldHireAgain,
      p_review_text: reviewText.trim(),
    })

    setSubmitting(false)

    if (error) {
      toast({
        title: 'Error submitting review',
        description: error.message,
        variant: 'destructive',
      })
      return
    }

    toast({ title: 'Review submitted!', description: 'Thank you for your feedback.' })
    onSuccess()
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-white/20 bg-white/10 backdrop-blur-xl p-6 space-y-6 shadow-lg"
    >
      <h3 className="text-lg font-semibold text-white">
        Review {revieweeName}
      </h3>

      {/* Overall rating (required) */}
      <div className="space-y-1">
        <label className="text-sm font-medium text-white/80">
          Overall rating <span className="text-red-400">*</span>
        </label>
        <StarRating rating={overall} onChange={setOverall} size="lg" />
      </div>

      {/* Sub-ratings */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="space-y-1">
          <label className="text-sm font-medium text-white/70">Quality of work</label>
          <StarRating rating={quality} onChange={setQuality} size="md" />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-white/70">Communication</label>
          <StarRating rating={communication} onChange={setCommunication} size="md" />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-white/70">Timeliness</label>
          <StarRating rating={timeliness} onChange={setTimeliness} size="md" />
        </div>
      </div>

      {/* Would hire again */}
      <div className="space-y-1">
        <label className="text-sm font-medium text-white/80">Would you hire again?</label>
        <div className="flex gap-2 mt-1">
          <button
            type="button"
            onClick={() => setWouldHireAgain(wouldHireAgain === true ? null : true)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              wouldHireAgain === true
                ? 'bg-emerald-500/30 text-emerald-300 border border-emerald-400/40'
                : 'bg-white/5 text-white/50 border border-white/10 hover:bg-white/10'
            }`}
          >
            <ThumbsUp size={16} /> Yes
          </button>
          <button
            type="button"
            onClick={() => setWouldHireAgain(wouldHireAgain === false ? null : false)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              wouldHireAgain === false
                ? 'bg-red-500/30 text-red-300 border border-red-400/40'
                : 'bg-white/5 text-white/50 border border-white/10 hover:bg-white/10'
            }`}
          >
            <ThumbsDown size={16} /> No
          </button>
        </div>
      </div>

      {/* Review text */}
      <div className="space-y-1">
        <label className="text-sm font-medium text-white/80">
          Your review <span className="text-red-400">*</span>
        </label>
        <textarea
          value={reviewText}
          onChange={(e) => setReviewText(e.target.value)}
          placeholder="Share your experience working with this person..."
          rows={4}
          className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-orange-500/50 resize-none"
        />
        <div className="flex justify-between text-xs">
          <span className={reviewText.trim().length < 20 ? 'text-white/40' : 'text-emerald-400'}>
            {reviewText.trim().length < 20
              ? `${20 - reviewText.trim().length} more characters needed`
              : 'Looks good!'}
          </span>
          <span className="text-white/40">{reviewText.trim().length} chars</span>
        </div>
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={!canSubmit}
        className="flex items-center justify-center gap-2 w-full rounded-lg bg-gradient-to-r from-orange-500 to-pink-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {submitting ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          <Send size={16} />
        )}
        {submitting ? 'Submitting...' : 'Submit Review'}
      </button>
    </form>
  )
}
