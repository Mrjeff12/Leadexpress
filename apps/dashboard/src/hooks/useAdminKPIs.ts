import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export interface AdminKPIs {
  [key: string]: number | string
}

// TODO: Replace with actual plan prices from a plans table or config when available
const PLAN_PRICES: Record<string, number> = {
  starter: 29,
  pro: 49,
  unlimited: 99,
}
const DEFAULT_PLAN_PRICE = 49

export function useAdminKPIs() {
  const [data, setData] = useState<AdminKPIs>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchKPIs() {
      try {
        const today = new Date().toISOString().slice(0, 10)

        const [
          totalLeadsRes,
          leadsTodayRes,
          hotLeadsRes,
          sentLeadsRes,
          activeLeadsRes,
          groupsRes,
          contractorsRes,
          subsRes,
          professionsRes,
          scanQueueRes,
          waRes,
          serviceAreasRes,
          partnersActiveRes,
          partnersPendingRes,
          partnerCommissionsRes,
        ] = await Promise.all([
          supabase.from('leads').select('id', { count: 'exact', head: true }),
          supabase.from('leads').select('id', { count: 'exact', head: true }).gte('created_at', today),
          supabase.from('leads').select('id', { count: 'exact', head: true }).eq('urgency', 'hot'),
          supabase.from('leads').select('id', { count: 'exact', head: true }).eq('status', 'sent'),
          supabase.from('leads').select('id', { count: 'exact', head: true }).neq('status', 'archived'),
          supabase.from('groups').select('id', { count: 'exact', head: true }),
          supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'contractor').eq('subscription_status', 'active'),
          supabase.from('subscriptions').select('id, plan_id').eq('status', 'active'),
          supabase.from('professions').select('id', { count: 'exact', head: true }),
          supabase.from('group_scan_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
          supabase.from('whatsapp_connections').select('id', { count: 'exact', head: true }).eq('status', 'connected'),
          supabase.from('service_areas').select('id', { count: 'exact', head: true }),
          supabase.from('community_partners').select('id', { count: 'exact', head: true }).eq('status', 'active'),
          supabase.from('community_partners').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
          supabase.from('partner_commissions').select('amount_cents').eq('status', 'pending').eq('type', 'earning'),
        ])

        // Check for critical errors
        if (totalLeadsRes.error) throw new Error(`Leads query failed: ${totalLeadsRes.error.message}`)
        if (subsRes.error) throw new Error(`Subscriptions query failed: ${subsRes.error.message}`)

        const totalLeads = totalLeadsRes.count ?? 0
        const leadsToday = leadsTodayRes.count ?? 0
        const hotLeads = hotLeadsRes.count ?? 0
        const sent = sentLeadsRes.count ?? 0
        const activeGroups = groupsRes.count ?? 0
        const activeContractors = contractorsRes.count ?? 0
        const activeSubs = subsRes.data ?? []
        const activeSubsCount = activeSubs.length
        const convRate = totalLeads > 0 ? Math.round((sent / totalLeads) * 1000) / 10 : 0

        // Calculate MRR from actual plan prices
        const mrr = activeSubs.reduce((sum, s) => {
          const price = PLAN_PRICES[s.plan_id as string] ?? DEFAULT_PLAN_PRICE
          return sum + price
        }, 0)

        const activePartners = partnersActiveRes.count ?? 0
        const pendingPartners = partnersPendingRes.count ?? 0
        const partnerCommissionsCents = (partnerCommissionsRes.data ?? []).reduce(
          (sum: number, c: any) => sum + (c.amount_cents ?? 0), 0
        )

        setError(null)
        setData({
          hotLeads,
          prospectsWaiting: 0,
          unreadMessages: 0,
          activeContractors,
          serviceAreas: serviceAreasRes.count ?? 0,
          leadsOnMap: activeLeadsRes.count ?? 0,
          waConnected: waRes.count ?? 0,
          activeGroups,
          scansPending: scanQueueRes.count ?? 0,
          activeSubs: activeSubsCount,
          mrr,
          leadsToday,
          conversionRate: convRate,
          professionsCount: professionsRes.count ?? 0,
          systemConfig: 'Active',
          activePartners,
          pendingPartners,
          partnerCommissions: Math.round(partnerCommissionsCents / 100),
        })
      } catch (err) {
        console.error('[useAdminKPIs] Error fetching KPIs:', err)
        setError(err instanceof Error ? err.message : 'Failed to fetch KPIs')
      } finally {
        setLoading(false)
      }
    }

    fetchKPIs()
    const interval = setInterval(fetchKPIs, 30_000)
    return () => clearInterval(interval)
  }, [])

  return { data, loading, error }
}
