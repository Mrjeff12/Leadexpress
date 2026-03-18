import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { AlertTriangle, X } from 'lucide-react'

export default function SubscriptionBanner() {
  const { effectiveUserId } = useAuth()
  const [status, setStatus] = useState<string | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (!effectiveUserId) return

    supabase
      .from('subscriptions')
      .select('status')
      .eq('user_id', effectiveUserId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setStatus(data.status)
      })
  }, [effectiveUserId])

  if (dismissed || !status) return null
  if (status === 'active' || status === 'trialing') return null

  const isPastDue = status === 'past_due'
  const isCanceled = status === 'canceled'

  if (!isPastDue && !isCanceled) return null

  return (
    <div className={`fixed top-0 left-0 right-0 z-50 px-4 py-3 flex items-center justify-center gap-3 text-sm font-medium ${
      isPastDue
        ? 'bg-amber-500 text-white'
        : 'bg-red-500 text-white'
    }`}>
      <AlertTriangle className="w-4 h-4 flex-shrink-0" />
      <span>
        {isPastDue
          ? 'Your payment failed. Please update your payment method to keep receiving leads.'
          : 'Your subscription has been canceled. Resubscribe to continue receiving leads.'}
      </span>
      <Link
        to="/subscription"
        className="px-3 py-1 rounded-full bg-white/20 hover:bg-white/30 text-xs font-bold transition-all"
      >
        {isPastDue ? 'Update Payment' : 'Resubscribe'}
      </Link>
      <button
        onClick={() => setDismissed(true)}
        className="ml-2 hover:bg-white/20 rounded-full p-1 transition-all"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}
