import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'

export interface PartnerStats {
  total_earnings_cents: number
  pending_earnings_cents: number
  total_referrals: number
  active_referrals: number
  total_communities: number
  commission_rate: number
  balance_cents: number
}

export interface DailyEarning {
  date: string
  amount_cents: number
}

export interface RecentActivity {
  id: string
  type: string
  amount_cents: number
  status: string
  note: string | null
  created_at: string
}

export function usePartnerStats() {
  const { effectiveUserId } = useAuth()
  const [stats, setStats] = useState<PartnerStats | null>(null)
  const [dailyEarnings, setDailyEarnings] = useState<DailyEarning[]>([])
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([])
  const [loading, setLoading] = useState(true)

  const loadStats = useCallback(async () => {
    if (!effectiveUserId) { setLoading(false); return }

    try {
      // Get partner record first
      const { data: partner } = await supabase
        .from('community_partners')
        .select('id, commission_rate, balance_cache_cents, stats')
        .eq('user_id', effectiveUserId)
        .maybeSingle()

      if (!partner) { setLoading(false); return }

      // Load stats, daily earnings, and recent activity in parallel
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

      const [referralsRes, commissionsTotalRes, pendingRes, communitiesRes, dailyRes, recentRes] = await Promise.all([
        // Total referrals
        supabase
          .from('partner_referrals')
          .select('id, converted_at', { count: 'exact' })
          .eq('partner_id', partner.id),
        // Total approved earnings
        supabase
          .from('partner_commissions')
          .select('amount_cents')
          .eq('partner_id', partner.id)
          .eq('type', 'earning')
          .in('status', ['approved', 'paid']),
        // Pending earnings
        supabase
          .from('partner_commissions')
          .select('amount_cents')
          .eq('partner_id', partner.id)
          .eq('type', 'earning')
          .eq('status', 'pending'),
        // Communities count
        supabase
          .from('partner_linked_groups')
          .select('id', { count: 'exact' })
          .eq('partner_id', partner.id),
        // Daily earnings (last 30 days)
        supabase
          .from('partner_commissions')
          .select('amount_cents, created_at')
          .eq('partner_id', partner.id)
          .eq('type', 'earning')
          .in('status', ['approved', 'paid'])
          .gte('created_at', thirtyDaysAgo.toISOString())
          .order('created_at'),
        // Recent activity (last 5)
        supabase
          .from('partner_commissions')
          .select('id, type, amount_cents, status, note, created_at')
          .eq('partner_id', partner.id)
          .order('created_at', { ascending: false })
          .limit(5),
      ])

      const totalEarnings = (commissionsTotalRes.data ?? []).reduce((sum, c) => sum + c.amount_cents, 0)
      const pendingEarnings = (pendingRes.data ?? []).reduce((sum, c) => sum + c.amount_cents, 0)
      const referrals = referralsRes.data ?? []
      const activeReferrals = referrals.filter(r => r.converted_at).length

      setStats({
        total_earnings_cents: totalEarnings,
        pending_earnings_cents: pendingEarnings,
        total_referrals: referralsRes.count ?? 0,
        active_referrals: activeReferrals,
        total_communities: communitiesRes.count ?? 0,
        commission_rate: partner.commission_rate,
        balance_cents: partner.balance_cache_cents,
      })

      // Aggregate daily earnings
      const dailyMap: Record<string, number> = {}
      for (const c of dailyRes.data ?? []) {
        const date = new Date(c.created_at).toLocaleDateString('en-CA')
        dailyMap[date] = (dailyMap[date] || 0) + c.amount_cents
      }
      // Fill in 30 days
      const days: DailyEarning[] = []
      for (let i = 29; i >= 0; i--) {
        const d = new Date()
        d.setDate(d.getDate() - i)
        const dateStr = d.toLocaleDateString('en-CA')
        days.push({ date: dateStr, amount_cents: dailyMap[dateStr] || 0 })
      }
      setDailyEarnings(days)

      setRecentActivity((recentRes.data ?? []) as RecentActivity[])
    } catch (err) {
      console.error('[usePartnerStats] error:', err)
    }

    setLoading(false)
  }, [effectiveUserId])

  useEffect(() => {
    loadStats()
  }, [loadStats])

  return {
    stats,
    dailyEarnings,
    recentActivity,
    loading,
    refetch: loadStats,
  }
}
