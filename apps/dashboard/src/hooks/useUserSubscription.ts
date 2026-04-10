import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export type PlanTier = 'free' | 'premium' | 'starter' | 'pro' | 'unlimited'

export interface PlanData {
  id: string
  slug: string
  name: string
  price_cents: number
  stripe_price_id: string | null
  stripe_yearly_price_id: string | null
  stripe_product_id: string | null
  max_groups: number
  max_professions: number
  max_zip_codes: number
  max_counties?: number
}

export interface SubscriptionData {
  status: string
  current_period_end: string
  stripe_subscription_id: string | null
  stripe_customer_id: string
  plan: PlanData
}

export interface Invoice {
  id: string
  number: string | null
  status: string
  amount_due: number
  amount_paid: number
  currency: string
  created: number
  hosted_invoice_url: string | null
  invoice_pdf: string | null
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function normalizePlanName(raw?: string | null): PlanTier {
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

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useUserSubscription() {
  const { effectiveUserId } = useAuth()

  // --- Subscription core ---
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null)
  const [loading, setLoading] = useState(true)

  // --- Billing extras (plans list, invoices, action state) ---
  const [plans, setPlans] = useState<PlanData[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [actionLoading, setActionLoading] = useState(false)

  // --- Access / network ---
  const [networkPoints, setNetworkPoints] = useState(0)
  const [networkLevel, setNetworkLevel] = useState('newcomer')

  // ------------------------------------------------------------------
  // Single query to load subscription + plan, all plans, and profile
  // ------------------------------------------------------------------
  const loadSubscription = useCallback(async () => {
    if (!effectiveUserId) {
      setLoading(false)
      return
    }

    const [subRes, plansRes, profileRes] = await Promise.all([
      supabase
        .from('subscriptions')
        .select(
          'status, current_period_end, stripe_subscription_id, stripe_customer_id, plans (*)',
        )
        .eq('user_id', effectiveUserId)
        .maybeSingle(),
      supabase
        .from('plans')
        .select('*')
        .eq('is_active', true)
        .order('price_cents'),
      supabase
        .from('profiles')
        .select('id')
        .eq('id', effectiveUserId)
        .maybeSingle(),
    ])

    if (subRes.data) {
      setSubscription({
        ...subRes.data,
        plan: subRes.data.plans as unknown as PlanData,
      })
    } else {
      setSubscription(null)
    }

    if (plansRes.data) setPlans(plansRes.data as PlanData[])

    if (profileRes.data) {
      // network_points/network_level columns not yet in DB — default to 0/member
      setNetworkPoints(0)
      setNetworkLevel(deriveNetworkLevel(0))
    }

    setLoading(false)
  }, [effectiveUserId])

  useEffect(() => {
    loadSubscription()
  }, [loadSubscription])

  // ------------------------------------------------------------------
  // Invoice loading (separate edge-function call, non-critical)
  // ------------------------------------------------------------------
  const loadInvoices = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke('get-invoices')
      if (!error && data?.invoices) setInvoices(data.invoices)
    } catch {
      // Silently fail -- invoices are non-critical
    }
  }, [])

  useEffect(() => {
    loadInvoices()
  }, [loadInvoices])

  // ------------------------------------------------------------------
  // Billing actions
  // ------------------------------------------------------------------
  const subscribe = useCallback(
    async (_priceId: string, planSlug: string, billingInterval: 'monthly' | 'yearly') => {
      setActionLoading(true)
      try {
        const { data, error } = await supabase.functions.invoke('create-checkout-session', {
          body: { planSlug, billingInterval },
        })
        if (error) throw error
        if (data?.url) window.location.href = data.url
      } finally {
        setActionLoading(false)
      }
    },
    [],
  )

  const changePlan = useCallback(
    async (newPriceId: string) => {
      setActionLoading(true)
      try {
        const { error } = await supabase.functions.invoke('update-subscription', {
          body: { newPriceId },
        })
        if (error) throw error
        await loadSubscription()
      } finally {
        setActionLoading(false)
      }
    },
    [loadSubscription],
  )

  const openPortal = useCallback(async () => {
    setActionLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('create-portal-session')
      if (error) throw error
      if (data?.url) window.location.href = data.url
    } finally {
      setActionLoading(false)
    }
  }, [])

  // ------------------------------------------------------------------
  // Derived values -- subscription status
  // ------------------------------------------------------------------
  const isActive = subscription?.status === 'active' || subscription?.status === 'trialing'
  const isTrialing = subscription?.status === 'trialing'
  const hasStripeSubscription = !!subscription?.stripe_subscription_id

  // ------------------------------------------------------------------
  // Derived values -- plan tier / access
  // ------------------------------------------------------------------
  const planName: PlanTier = subscription
    ? normalizePlanName(subscription.plan?.name)
    : 'free'

  const isLegacy = planName === 'starter' || planName === 'premium'
  const isPro = planName === 'pro'
  const isUnlimited = planName === 'unlimited'
  const isPremium = isPro || isUnlimited || planName === 'premium'
  const isFree = planName === 'free'
  const canSeeLeadDetails = isPremium || isLegacy
  const canManageSubs = planName === 'premium' || planName === 'unlimited'

  // ------------------------------------------------------------------
  // Derived values -- plan limits
  // ------------------------------------------------------------------
  const computedMaxProfessions = (() => {
    if (!subscription) return -1
    if (planName === 'free' || planName === 'premium') return -1
    return subscription.plan?.max_professions ?? -1
  })()

  const computedMaxZipCodes = (() => {
    if (!subscription) return -1
    if (planName === 'free' || planName === 'premium') return -1
    return subscription.plan?.max_zip_codes ?? -1
  })()

  const computedMaxCounties = (() => {
    if (!subscription) return 1
    return (subscription.plan as any)?.max_counties ?? -1
  })()

  return {
    // Core subscription
    subscription,
    loading,
    refetch: loadSubscription,

    // Billing
    plans,
    invoices,
    actionLoading,
    subscribe,
    changePlan,
    openPortal,
    loadInvoices,

    // Status flags
    isActive,
    isTrialing,
    hasStripeSubscription,

    // Plan tier / access
    planName,
    isPremium,
    isFree,
    isLegacy,
    isPro,
    isUnlimited,
    canSeeLeadDetails,
    canManageSubs,

    // Plan limits
    maxProfessions: computedMaxProfessions,
    maxZipCodes: computedMaxZipCodes,
    maxCounties: computedMaxCounties,

    // Network
    networkPoints,
    networkLevel,
  }
}
