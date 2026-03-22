import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export interface GrowthMetrics {
  payingUsers: number
  freeUsers: number
  mrr: number // in cents
  conversionRate: number // percentage
  payingTarget: number // 500
  activeTrials: number
  totalGroupsInPool: number
  groupsAddedThisWeek: number
  feedbackThisWeek: number
  levelDistribution: { member: number; insider: number; partner: number; vip: number }
  recentActivity: { type: string; description: string; created_at: string }[]
  loading: boolean
}

const DEFAULTS: GrowthMetrics = {
  payingUsers: 0,
  freeUsers: 0,
  mrr: 0,
  conversionRate: 0,
  payingTarget: 500,
  activeTrials: 0,
  totalGroupsInPool: 0,
  groupsAddedThisWeek: 0,
  feedbackThisWeek: 0,
  levelDistribution: { member: 0, insider: 0, partner: 0, vip: 0 },
  recentActivity: [],
  loading: true,
}

export function useGrowthMetrics(): GrowthMetrics {
  const [metrics, setMetrics] = useState<GrowthMetrics>(DEFAULTS)

  useEffect(() => {
    async function fetch() {
      try {
        const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

        const [
          payingRes,
          trialsRes,
          contractorsRes,
          groupsRes,
          groupsWeekRes,
          feedbackRes,
          levelRes,
          recentSignupsRes,
          recentGroupsRes,
        ] = await Promise.all([
          // Paying users: active subscriptions
          supabase
            .from('subscriptions')
            .select('id', { count: 'exact', head: true })
            .in('status', ['active']),

          // Active trials
          supabase
            .from('subscriptions')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'trialing'),

          // All contractors (for free user calc)
          supabase
            .from('profiles')
            .select('id', { count: 'exact', head: true })
            .eq('role', 'contractor'),

          // Total groups in pool
          supabase
            .from('contractor_group_links')
            .select('id', { count: 'exact', head: true }),

          // Groups added this week
          supabase
            .from('contractor_group_links')
            .select('id', { count: 'exact', head: true })
            .gte('created_at', oneWeekAgo),

          // Feedback this week
          supabase
            .from('lead_feedback')
            .select('id', { count: 'exact', head: true })
            .gte('created_at', oneWeekAgo),

          // Level distribution
          supabase
            .from('profiles')
            .select('network_level')
            .eq('role', 'contractor'),

          // Recent signups (last 10)
          supabase
            .from('profiles')
            .select('full_name, created_at')
            .eq('role', 'contractor')
            .order('created_at', { ascending: false })
            .limit(5),

          // Recent group additions
          supabase
            .from('contractor_group_links')
            .select('created_at')
            .order('created_at', { ascending: false })
            .limit(5),
        ])

        const payingUsers = payingRes.count ?? 0
        const activeTrials = trialsRes.count ?? 0
        const totalContractors = contractorsRes.count ?? 0
        const freeUsers = Math.max(0, totalContractors - payingUsers)
        const mrr = payingUsers * 7900
        const conversionRate = totalContractors > 0 ? (payingUsers / totalContractors) * 100 : 0
        const totalGroupsInPool = groupsRes.count ?? 0
        const groupsAddedThisWeek = groupsWeekRes.count ?? 0
        const feedbackThisWeek = feedbackRes.count ?? 0

        // Compute level distribution
        const dist = { member: 0, insider: 0, partner: 0, vip: 0 }
        if (levelRes.data) {
          for (const row of levelRes.data) {
            const lvl = (row.network_level || 'member') as keyof typeof dist
            if (lvl in dist) dist[lvl]++
            else dist.member++
          }
        }

        // Build recent activity feed
        const recentActivity: GrowthMetrics['recentActivity'] = []
        if (recentSignupsRes.data) {
          for (const r of recentSignupsRes.data) {
            recentActivity.push({
              type: 'signup',
              description: `${r.full_name || 'New contractor'} signed up`,
              created_at: r.created_at,
            })
          }
        }
        if (recentGroupsRes.data) {
          for (const r of recentGroupsRes.data) {
            recentActivity.push({
              type: 'group_added',
              description: 'New group linked',
              created_at: r.created_at,
            })
          }
        }
        recentActivity.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

        setMetrics({
          payingUsers,
          freeUsers,
          mrr,
          conversionRate,
          payingTarget: 500,
          activeTrials,
          totalGroupsInPool,
          groupsAddedThisWeek,
          feedbackThisWeek,
          levelDistribution: dist,
          recentActivity: recentActivity.slice(0, 10),
          loading: false,
        })
      } catch (err) {
        console.error('Failed to load growth metrics:', err)
        setMetrics((prev) => ({ ...prev, loading: false }))
      }
    }
    fetch()
  }, [])

  return metrics
}
