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
      className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#141414] p-6 space-y-6 shadow-lg"
    >
      <h3 className="text-lg font-semibold text-white" style={{ fontFamily: 'Outfit, sans-serif', letterSpacing: '-0.03em' }}>
        Review {revieweeName}
      </h3>

      {/* Overall rating (required) */}
      <div className="space-y-1">
        <label className="text-sm font-medium text-[#a1a1a6]">
          Overall rating <span className="text-[#ff453a]">*</span>
        </label>
        <StarRating rating={overall} onChange={setOverall} size="lg" />
      </div>

      {/* Sub-ratings */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="space-y-1">
          <label className="text-sm font-medium text-[#636366]">Quality of work</label>
          <StarRating rating={quality} onChange={setQuality} size="md" />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-[#636366]">Communication</label>
          <StarRating rating={communication} onChange={setCommunication} size="md" />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-[#636366]">Timeliness</label>
          <StarRating rating={timeliness} onChange={setTimeliness} size="md" />
        </div>
      </div>

      {/* Would hire again */}
      <div className="space-y-1">
        <label className="text-sm font-medium text-[#a1a1a6]">Would you hire again?</label>
        <div className="flex gap-2 mt-1">
          <button
            type="button"
            onClick={() => setWouldHireAgain(wouldHireAgain === true ? null : true)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              wouldHireAgain === true
                ? 'bg-[rgba(48,209,88,0.15)] text-[#30d158] border border-[rgba(48,209,88,0.3)]'
                : 'bg-[#1c1c1e] text-[#636366] border border-[rgba(255,255,255,0.1)] hover:bg-[#2c2c2e]'
            }`}
          >
            <ThumbsUp size={16} /> Yes
          </button>
          <button
            type="button"
            onClick={() => setWouldHireAgain(wouldHireAgain === false ? null : false)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              wouldHireAgain === false
                ? 'bg-[rgba(255,69,58,0.15)] text-[#ff453a] border border-[rgba(255,69,58,0.3)]'
                : 'bg-[#1c1c1e] text-[#636366] border border-[rgba(255,255,255,0.1)] hover:bg-[#2c2c2e]'
            }`}
          >
            <ThumbsDown size={16} /> No
          </button>
        </div>
      </div>

      {/* Review text */}
      <div className="space-y-1">
        <label className="text-sm font-medium text-[#a1a1a6]">
          Your review <span className="text-[#ff453a]">*</span>
        </label>
        <textarea
          value={reviewText}
          onChange={(e) => setReviewText(e.target.value)}
          placeholder="Share your experience working with this person..."
          rows={4}
          className="w-full rounded-lg border border-[rgba(255,255,255,0.1)] bg-[#1c1c1e] px-3 py-2 text-sm text-white placeholder-[#48484a] focus:outline-none focus:border-[#ff6b35] focus:ring-1 focus:ring-[#ff6b35]/50 resize-none transition-colors"
        />
        <div className="flex justify-between text-xs">
          <span className={reviewText.trim().length < 20 ? 'text-[#636366]' : 'text-[#30d158]'}>
            {reviewText.trim().length < 20
              ? `${20 - reviewText.trim().length} more characters needed`
              : 'Looks good!'}
          </span>
          <span className="text-[#636366]">{reviewText.trim().length} chars</span>
        </div>
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={!canSubmit}
        className="flex items-center justify-center gap-2 w-full rounded-lg bg-[#ff6b35] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_0_20px_rgba(255,107,53,0.3)] transition-all hover:brightness-110 active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
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
