import { useState, useEffect } from 'react'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'

export type PlanTier = 'free' | 'premium' | 'starter' | 'pro' | 'unlimited'

function normalizePlanName(raw?: string | null): PlanTier {
  if (!raw) return 'free'
  const lower = raw.toLowerCase().trim()
  if (lower === 'premium') return 'premium'
  if (lower === 'starter') return 'starter'
  if (lower === 'pro') return 'pro'
  if (lower === 'unlimited') return 'unlimited'
  if (lower === 'free') return 'free'
  return 'free'
}

function deriveNetworkLevel(points: number): string {
  if (points >= 1000) return 'diamond'
  if (points >= 500) return 'gold'
  if (points >= 200) return 'silver'
  if (points >= 50) return 'bronze'
  return 'newcomer'
}

export function useSubscriptionAccess() {
  const { effectiveUserId } = useAuth()

  const [planName, setPlanName] = useState<PlanTier>('free')
  const [maxProfessions, setMaxProfessions] = useState(1)
  const [maxZipCodes, setMaxZipCodes] = useState(3)
  const [canManageSubs, setCanManageSubs] = useState(false)
  const [networkPoints, setNetworkPoints] = useState(0)
  const [networkLevel, setNetworkLevel] = useState('newcomer')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!effectiveUserId) {
      setLoading(false)
      return
    }

    let cancelled = false

    async function fetchData() {
      // Fetch subscription and profile in parallel
      const [subResult, profileResult] = await Promise.all([
        supabase
          .from('subscriptions')
          .select('status, plans ( name, max_professions, max_zip_codes )')
          .eq('user_id', effectiveUserId)
          .in('status', ['active', 'trialing'])
          .maybeSingle(),
        supabase
          .from('profiles')
          .select('network_points, network_level')
          .eq('id', effectiveUserId)
          .maybeSingle(),
      ])

      if (cancelled) return

      // Process subscription data
      const subData = subResult.data
      if (subData) {
        const plan = subData.plans as any
        const fetchedPlan = normalizePlanName(plan?.name)
        setPlanName(fetchedPlan)

        // New model (free/premium) gets unlimited professions & zip codes
        if (fetchedPlan === 'free' || fetchedPlan === 'premium') {
          setMaxProfessions(-1)
          setMaxZipCodes(-1)
        } else {
          // Legacy plans: use plan limits from DB
          if (plan?.max_professions != null) setMaxProfessions(plan.max_professions)
          if (plan?.max_zip_codes != null) setMaxZipCodes(plan.max_zip_codes)
        }

        setCanManageSubs(fetchedPlan === 'unlimited')
      } else {
        // No active subscription = free tier
        setPlanName('free')
        setMaxProfessions(-1)
        setMaxZipCodes(-1)
        setCanManageSubs(false)
      }

      // Process profile data
      const profileData = profileResult.data
      if (profileData) {
        const points = profileData.network_points ?? 0
        setNetworkPoints(points)
        setNetworkLevel(profileData.network_level ?? deriveNetworkLevel(points))
      }

      setLoading(false)
    }

    fetchData()

    return () => { cancelled = true }
  }, [effectiveUserId])

  // Derived booleans
  const isLegacy = planName === 'starter' || planName === 'pro' || planName === 'unlimited'
  const isPremium = planName === 'premium' || planName === 'pro' || planName === 'unlimited'
  const isFree = planName === 'free' || (planName === 'starter' && !isPremium)
  const canSeeLeadDetails = isPremium || isLegacy

  return {
    // New fields
    planName,
    isPremium,
    isFree,
    isLegacy,
    canSeeLeadDetails,
    networkPoints,
    networkLevel,
    loading,
    // Backward-compatible fields
    maxProfessions,
    maxZipCodes,
    canManageSubs,
  }
}
