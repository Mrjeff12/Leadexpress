import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'

interface PlanData {
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
}

interface SubscriptionData {
  status: string
  current_period_end: string
  stripe_subscription_id: string | null
  stripe_customer_id: string
  plan: PlanData
}

interface Invoice {
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

export function useSubscriptionBilling() {
  const { effectiveUserId } = useAuth()
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null)
  const [plans, setPlans] = useState<PlanData[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)

  // Load subscription + plans
  useEffect(() => {
    if (!effectiveUserId) { setLoading(false); return }

    async function load() {
      const [subRes, plansRes] = await Promise.all([
        supabase
          .from('subscriptions')
          .select('status, current_period_end, stripe_subscription_id, stripe_customer_id, plans (*)')
          .eq('user_id', effectiveUserId)
          .maybeSingle(),
        supabase
          .from('plans')
          .select('*')
          .eq('is_active', true)
          .order('price_cents'),
      ])

      if (subRes.data) {
        setSubscription({
          ...subRes.data,
          plan: subRes.data.plans as unknown as PlanData,
        })
      }
      if (plansRes.data) setPlans(plansRes.data as PlanData[])
      setLoading(false)
    }

    load()
  }, [effectiveUserId])

  // Load invoices
  const loadInvoices = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke('get-invoices')
      if (!error && data?.invoices) setInvoices(data.invoices)
    } catch {
      // Silently fail — invoices are non-critical
    }
  }, [])

  useEffect(() => { loadInvoices() }, [loadInvoices])

  // Create checkout session → redirect to Stripe
  const subscribe = useCallback(async (priceId: string, planSlug: string, billingInterval: 'monthly' | 'yearly') => {
    setActionLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout-session', {
        body: { priceId, planSlug, billingInterval },
      })
      if (error) throw error
      if (data?.url) window.location.href = data.url
    } finally {
      setActionLoading(false)
    }
  }, [])

  // Upgrade/downgrade existing subscription
  const changePlan = useCallback(async (newPriceId: string) => {
    setActionLoading(true)
    try {
      const { error } = await supabase.functions.invoke('update-subscription', {
        body: { newPriceId },
      })
      if (error) throw error
      window.location.reload()
    } finally {
      setActionLoading(false)
    }
  }, [])

  // Open Stripe Customer Portal
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

  const isActive = subscription?.status === 'active' || subscription?.status === 'trialing'
  const isTrialing = subscription?.status === 'trialing'
  const hasStripeSubscription = !!subscription?.stripe_subscription_id

  return {
    subscription,
    plans,
    invoices,
    loading,
    actionLoading,
    isActive,
    isTrialing,
    hasStripeSubscription,
    subscribe,
    changePlan,
    openPortal,
    loadInvoices,
  }
}
