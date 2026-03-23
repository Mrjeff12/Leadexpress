import { useState, useEffect, useCallback } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'

const CHECKOUT_GRACE_KEY = 'le_checkout_success_at'

export default function RequireSubscription({ children }: { children: React.ReactNode }) {
  const { effectiveUserId } = useAuth()
  const [searchParams] = useSearchParams()
  const [status, setStatus] = useState<'loading' | 'active' | 'inactive' | 'error'>('loading')

  // If user just returned from Stripe checkout, store a grace timestamp
  useEffect(() => {
    if (searchParams.get('success') === 'true') {
      sessionStorage.setItem(CHECKOUT_GRACE_KEY, Date.now().toString())
    }
  }, [searchParams])

  const check = useCallback(async () => {
    if (!effectiveUserId) {
      setStatus('inactive')
      return false
    }

    const { data, error } = await supabase
      .from('subscriptions')
      .select('status, current_period_end')
      .eq('user_id', effectiveUserId)
      .maybeSingle()

    if (error) {
      setStatus('error')
      return false
    }

    // If trial has expired, auto-downgrade to free plan
    if (data?.status === 'trialing' && new Date(data.current_period_end) < new Date()) {
      await supabase.rpc('expire_trial')
      // Don't block — let them in as free user
    }

    const validStatuses = ['active', 'trialing']
    if (data && validStatuses.includes(data.status)) {
      setStatus('active')
      sessionStorage.removeItem(CHECKOUT_GRACE_KEY)
      return true
    }

    // No subscription or expired = free tier access (not blocked)
    setStatus('active')
    return true
  }, [effectiveUserId])

  useEffect(() => {
    let cancelled = false
    let pollTimer: ReturnType<typeof setTimeout>

    async function run() {
      const isActive = await check()
      if (cancelled) return

      if (!isActive) {
        // Check if we're in the post-checkout grace period (2 minutes)
        const graceAt = sessionStorage.getItem(CHECKOUT_GRACE_KEY)
        if (graceAt && Date.now() - parseInt(graceAt) < 120_000) {
          // Webhook hasn't processed yet — retry every 2 seconds
          pollTimer = setTimeout(() => {
            if (!cancelled) run()
          }, 2000)
        } else {
          setStatus('inactive')
        }
      }
    }

    run()
    return () => {
      cancelled = true
      clearTimeout(pollTimer)
    }
  }, [check])

  if (status === 'loading') return null
  if (status === 'error') {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="le-bg" />
        <div className="le-grain" />
        <div className="flex flex-col items-center gap-4 animate-fade-in">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white text-sm"
            style={{ background: 'hsl(14 99% 57%)' }}>
            LE
          </div>
          <p className="text-sm" style={{ color: 'hsl(40 4% 42%)' }}>Something went wrong. Please try again.</p>
          <button
            onClick={() => { setStatus('loading'); window.location.reload() }}
            className="px-4 py-2 text-sm font-medium rounded-xl text-white transition-all bg-gradient-to-r from-[#fe5b25] to-[#ff7a4d] hover:from-[#e54e1a] hover:to-[#fe5b25] shadow-sm"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }
  if (status === 'inactive') return <Navigate to="/subscription" replace />
  return <>{children}</>
}
