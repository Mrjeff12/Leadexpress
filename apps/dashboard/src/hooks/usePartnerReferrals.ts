import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'

export interface PartnerReferral {
  id: string
  partner_id: string
  referred_user_id: string
  referral_source: string
  converted_at: string | null
  created_at: string
  // Joined fields
  user_name: string | null
  user_email: string | null
  plan_name: string | null
  subscription_status: string | null
  monthly_commission_cents: number
}

export function usePartnerReferrals() {
  const { effectiveUserId } = useAuth()
  const [referrals, setReferrals] = useState<PartnerReferral[]>([])
  const [loading, setLoading] = useState(true)
  const [totalCount, setTotalCount] = useState(0)

  const loadReferrals = useCallback(async () => {
    if (!effectiveUserId) { setLoading(false); return }

    // Get partner id first
    const { data: partner } = await supabase
      .from('community_partners')
      .select('id, commission_rate')
      .eq('user_id', effectiveUserId)
      .maybeSingle()

    if (!partner) { setLoading(false); return }

    const { data, error, count } = await supabase
      .from('partner_referrals')
      .select(`
        id, partner_id, referred_user_id, referral_source, converted_at, created_at,
        profiles!partner_referrals_referred_user_id_fkey ( full_name, id )
      `, { count: 'exact' })
      .eq('partner_id', partner.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[usePartnerReferrals] error:', error)
      setLoading(false)
      return
    }

    // For each referral, fetch subscription info
    const referralIds = (data ?? []).map(r => r.referred_user_id)
    let subMap: Record<string, { plan_name: string; status: string; price_cents: number }> = {}

    if (referralIds.length > 0) {
      const { data: subs } = await supabase
        .from('subscriptions')
        .select('user_id, status, plans ( name, price_cents )')
        .in('user_id', referralIds)

      if (subs) {
        for (const sub of subs) {
          const plan = sub.plans as any
          subMap[sub.user_id] = {
            plan_name: plan?.name ?? null,
            status: sub.status,
            price_cents: plan?.price_cents ?? 0,
          }
        }
      }
    }

    const mapped: PartnerReferral[] = (data ?? []).map((r: any) => {
      const sub = subMap[r.referred_user_id]
      const commissionCents = sub
        ? Math.round(sub.price_cents * partner.commission_rate)
        : 0

      return {
        id: r.id,
        partner_id: r.partner_id,
        referred_user_id: r.referred_user_id,
        referral_source: r.referral_source,
        converted_at: r.converted_at,
        created_at: r.created_at,
        user_name: r.profiles?.full_name ?? null,
        user_email: null,
        plan_name: sub?.plan_name ?? null,
        subscription_status: sub?.status ?? null,
        monthly_commission_cents: commissionCents,
      }
    })

    setReferrals(mapped)
    setTotalCount(count ?? 0)
    setLoading(false)
  }, [effectiveUserId])

  useEffect(() => {
    loadReferrals()
  }, [loadReferrals])

  return {
    referrals,
    loading,
    totalCount,
    refetch: loadReferrals,
  }
}
