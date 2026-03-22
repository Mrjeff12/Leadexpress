import { useState } from 'react'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'

interface Props {
  leadId: string
  existingRating?: string
}

const RATINGS = [
  { key: 'got_job',      label: 'Got job',      emoji: '\uD83D\uDC4D', color: '#22c55e', bg: 'rgba(34,197,94,0.08)', border: 'rgba(34,197,94,0.2)', activeColor: '#16a34a' },
  { key: 'not_relevant', label: 'Not relevant',  emoji: '\uD83D\uDC4E', color: '#71717a', bg: 'rgba(113,113,122,0.08)', border: 'rgba(113,113,122,0.2)', activeColor: '#52525b' },
  { key: 'scam',         label: 'Scam',          emoji: '\u26A0\uFE0F', color: '#ef4444', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.2)', activeColor: '#dc2626' },
] as const

export default function LeadFeedbackButtons({ leadId, existingRating }: Props) {
  const { effectiveUserId } = useAuth()
  const [rating, setRating] = useState<string | null>(existingRating ?? null)
  const [submitting, setSubmitting] = useState(false)

  async function handleRate(selectedRating: string) {
    if (!effectiveUserId || submitting || rating) return
    setSubmitting(true)

    try {
      // Upsert feedback
      await supabase
        .from('lead_feedback')
        .upsert(
          { lead_id: leadId, user_id: effectiveUserId, rating: selectedRating },
          { onConflict: 'lead_id,user_id' }
        )

      // Award network points
      await supabase.rpc('award_network_points', {
        p_user_id: effectiveUserId,
        p_action: selectedRating === 'scam' ? 'scam_report' : 'feedback',
        p_points: selectedRating === 'scam' ? 25 : 5,
        p_metadata: { lead_id: leadId, rating: selectedRating },
      })

      setRating(selectedRating)
    } catch (err) {
      console.error('Failed to submit feedback:', err)
    } finally {
      setSubmitting(false)
    }
  }

  // Show completed state
  if (rating) {
    const r = RATINGS.find((x) => x.key === rating)
    if (!r) return null
    return (
      <span
        className="inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg"
        style={{ background: r.bg, color: r.activeColor, border: `1px solid ${r.border}` }}
      >
        {r.emoji} {r.label}
      </span>
    )
  }

  return (
    <div className="flex items-center gap-1.5">
      {RATINGS.map((r) => (
        <button
          key={r.key}
          onClick={(e) => {
            e.stopPropagation()
            handleRate(r.key)
          }}
          disabled={submitting}
          className="text-xs font-semibold px-2 py-1 rounded-lg transition-all hover:scale-105 disabled:opacity-50"
          style={{
            background: r.bg,
            color: r.color,
            border: `1px solid ${r.border}`,
          }}
        >
          {r.emoji} {r.label}
        </button>
      ))}
    </div>
  )
}
