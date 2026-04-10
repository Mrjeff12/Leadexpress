import { useEffect, useState } from 'react'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'

export type StepKey =
  | 'credentials'
  | 'phone'
  | 'profession'
  | 'area'
  | 'hours'
  | 'credit_card'

export interface OnboardingPlan {
  loading: boolean
  steps: StepKey[]
  existing: {
    phone?: string
    professions?: string[]
    zipCodes?: string[]
    counties?: string[]
    workingDays?: number[]
    hasPaymentMethod?: boolean
  }
  refresh: () => Promise<void>
}

/**
 * Computes which onboarding steps are needed for the current user based on
 * what's already populated in the DB. Rebeca users typically skip phone,
 * profession, area, and hours because Rebeca already collected them.
 */
export function useOnboardingPlan(): OnboardingPlan {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [steps, setSteps] = useState<StepKey[]>([])
  const [existing, setExisting] = useState<OnboardingPlan['existing']>({})

  async function compute() {
    if (!user) {
      setLoading(false)
      return
    }
    setLoading(true)

    const [contractorRes, profileRes, subRes] = await Promise.all([
      supabase
        .from('contractors')
        .select('professions, zip_codes, working_days')
        .eq('user_id', user.id)
        .maybeSingle(),
      supabase
        .from('profiles')
        .select('whatsapp_phone, phone, counties')
        .eq('id', user.id)
        .maybeSingle(),
      supabase
        .from('subscriptions')
        .select('stripe_payment_method_id')
        .eq('user_id', user.id)
        .maybeSingle(),
    ])

    const contractor = contractorRes.data
    const profile = profileRes.data
    const sub = subRes.data

    const isOAuth =
      !!user.app_metadata?.provider && user.app_metadata.provider !== 'email'
    // Heuristic: auto-generated Rebeca/signup emails mean credentials not set.
    const hasRealEmail =
      !!user.email &&
      !user.email.endsWith('@app.masterleadflow.com') &&
      !user.email.endsWith('@signup.masterleadflow.com')

    const next: StepKey[] = []

    if (!isOAuth && !hasRealEmail) next.push('credentials')
    if (!profile?.whatsapp_phone && !profile?.phone) next.push('phone')
    if (!contractor?.professions?.length) next.push('profession')
    if (!(contractor?.zip_codes?.length || profile?.counties?.length)) next.push('area')
    if (!contractor?.working_days?.length) next.push('hours')
    if (!sub?.stripe_payment_method_id) next.push('credit_card')

    setSteps(next)
    setExisting({
      phone: profile?.whatsapp_phone || profile?.phone || undefined,
      professions: contractor?.professions || undefined,
      zipCodes: contractor?.zip_codes || undefined,
      counties: profile?.counties || undefined,
      workingDays: contractor?.working_days || undefined,
      hasPaymentMethod: !!sub?.stripe_payment_method_id,
    })
    setLoading(false)
  }

  useEffect(() => {
    compute()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  return { loading, steps, existing, refresh: compute }
}
