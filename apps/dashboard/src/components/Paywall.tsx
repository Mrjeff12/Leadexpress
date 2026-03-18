import { useState, useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'

export default function RequireSubscription({ children }: { children: React.ReactNode }) {
  const { effectiveUserId } = useAuth()
  const [status, setStatus] = useState<'loading' | 'active' | 'inactive'>('loading')

  useEffect(() => {
    if (!effectiveUserId) {
      setStatus('inactive')
      return
    }

    async function check() {
      const { data } = await supabase
        .from('subscriptions')
        .select('status')
        .eq('user_id', effectiveUserId)
        .in('status', ['active', 'trialing'])
        .maybeSingle()

      setStatus(data ? 'active' : 'inactive')
    }

    check()
  }, [effectiveUserId])

  if (status === 'loading') return null
  if (status === 'inactive') return <Navigate to="/subscription" replace />
  return <>{children}</>
}
