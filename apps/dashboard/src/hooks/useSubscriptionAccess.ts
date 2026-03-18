import { useState, useEffect } from 'react'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'

export function useSubscriptionAccess() {
  const { effectiveUserId } = useAuth()
  const [planName, setPlanName] = useState('Starter')
  const [canManageSubs, setCanManageSubs] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!effectiveUserId) {
      setLoading(false)
      return
    }

    let cancelled = false

    async function fetchSub() {
      const { data: subData } = await supabase
        .from('subscriptions')
        .select('status, plans ( name, can_manage_subcontractors )')
        .eq('user_id', effectiveUserId)
        .maybeSingle()

      if (!cancelled) {
        if (subData) {
          const plan = subData.plans as any
          const fetchedPlan = plan?.name as string | undefined
          if (fetchedPlan) setPlanName(fetchedPlan)
          setCanManageSubs(
            plan?.can_manage_subcontractors === true || 
            fetchedPlan === 'Pro' || 
            fetchedPlan === 'Unlimited'
          )
        }
        setLoading(false)
      }
    }

    fetchSub()

    return () => { cancelled = true }
  }, [effectiveUserId])

  return { planName, canManageSubs, loading }
}
