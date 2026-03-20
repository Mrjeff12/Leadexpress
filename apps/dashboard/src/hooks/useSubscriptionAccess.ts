import { useState, useEffect } from 'react'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'

export function useSubscriptionAccess() {
  const { effectiveUserId } = useAuth()
  const [planName, setPlanName] = useState('Starter')
  const [maxProfessions, setMaxProfessions] = useState(1)
  const [maxZipCodes, setMaxZipCodes] = useState(3)
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
        .select('status, plans ( name, max_professions, max_zip_codes )')
        .eq('user_id', effectiveUserId)
        .maybeSingle()

      if (!cancelled) {
        if (subData) {
          const plan = subData.plans as any
          const fetchedPlan = plan?.name as string | undefined
          if (fetchedPlan) setPlanName(fetchedPlan)
          if (plan?.max_professions != null) setMaxProfessions(plan.max_professions)
          if (plan?.max_zip_codes != null) setMaxZipCodes(plan.max_zip_codes)
          // Only Unlimited plan can manage subcontractors
          setCanManageSubs(fetchedPlan === 'Unlimited')
        }
        setLoading(false)
      }
    }

    fetchSub()

    return () => { cancelled = true }
  }, [effectiveUserId])

  return { planName, maxProfessions, maxZipCodes, canManageSubs, loading }
}
