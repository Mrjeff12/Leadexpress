import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { DateRange } from './useDateFilter'

export interface AdminKPIs {
  [key: string]: number | string
}

const DEFAULT_PLAN_PRICE = 49

export function useAdminKPIs(dateRange?: DateRange) {
  const [data, setData] = useState<AdminKPIs>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const from = dateRange?.from
  const to = dateRange?.to

  useEffect(() => {
    async function fetchKPIs() {
      try {
        // Date range for filtered KPIs
        const rangeFrom = from ?? new Date().toISOString().slice(0, 10)
        const rangeTo = to ?? rangeFrom
        // rangeTo needs end-of-day for gte/lte queries
        const rangeToEnd = rangeTo + 'T23:59:59.999Z'

        const [
          totalLeadsRes,
          filteredHotLeadsRes,
          filteredSentLeadsRes,
          filteredTotalLeadsRes,
          activeLeadsRes,
          groupsRes,
          contractorsRes,
          professionsRes,
          scanQueueRes,
          waRes,
          serviceAreasRes,
          partnersActiveRes,
          partnersPendingRes,
          partnerCommissionsRes,
          plansRes,
        ] = await Promise.all([
          supabase.from('leads').select('id', { count: 'exact', head: true }),
          // Filtered: hot leads created in date range
          supabase.from('leads').select('id', { count: 'exact', head: true })
            .eq('urgency', 'hot').gte('created_at', rangeFrom).lte('created_at', rangeToEnd),
          // Filtered: sent leads in date range (for rate calc)
          supabase.from('leads').select('id', { count: 'exact', head: true })
            .eq('status', 'sent').gte('created_at', rangeFrom).lte('created_at', rangeToEnd),
          // Filtered: total leads in date range (for rate calc)
          supabase.from('leads').select('id', { count: 'exact', head: true })
            .gte('created_at', rangeFrom).lte('created_at', rangeToEnd),
          supabase.from('leads').select('id', { count: 'exact', head: true }).neq('status', 'archived'),
          supabase.from('groups').select('id', { count: 'exact', head: true }),
          supabase.from('subscriptions').select('id, plan_id, user_id, plans(slug, price_cents)').eq('status', 'active'),
          supabase.from('professions').select('id', { count: 'exact', head: true }),
          supabase.from('contractor_group_scan_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
          supabase.from('wa_accounts').select('id', { count: 'exact', head: true }).eq('status', 'connected'),
          supabase.from('professions').select('id', { count: 'exact', head: true }),
          supabase.from('community_partners').select('id', { count: 'exact', head: true }).eq('status', 'active'),
          supabase.from('community_partners').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
          supabase.from('partner_commissions').select('amount_cents').eq('status', 'pending').eq('type', 'earning'),
          supabase.from('plans').select('slug, price_cents'),
        ])

        // Check for critical errors
        if (totalLeadsRes.error) throw new Error(`Leads query failed: ${totalLeadsRes.error.message}`)
        if (contractorsRes.error) throw new Error(`Subscriptions query failed: ${contractorsRes.error.message}`)

        const totalLeads = totalLeadsRes.count ?? 0
        // Filtered KPIs
        const hotLeads = filteredHotLeadsRes.count ?? 0
        const filteredSent = filteredSentLeadsRes.count ?? 0
        const filteredTotal = filteredTotalLeadsRes.count ?? 0
        const activeGroups = groupsRes.count ?? 0
        // activeContractors = count of unique users with active subscriptions
        const activeSubs = contractorsRes.data ?? []
        const activeContractors = activeSubs.length
        const activeSubsCount = activeSubs.length
        // Rate is filtered: sent/total in the date range
        const convRate = filteredTotal > 0 ? Math.round((filteredSent / filteredTotal) * 1000) / 10 : 0

        // Build plan price lookup from DB (fall back to default if plans table fails)
        const planPrices: Record<string, number> = {}
        if (plansRes.data) {
          for (const p of plansRes.data) {
            planPrices[p.slug as string] = Math.round((p.price_cents as number) / 100)
          }
        }

        // Calculate MRR from actual plan prices via joined plans table
        const mrr = activeSubs.reduce((sum, s) => {
          const plan = (s as any).plans
          const price = plan ? Math.round((plan.price_cents as number) / 100) : DEFAULT_PLAN_PRICE
          return sum + price
        }, 0)

        const activePartners = partnersActiveRes.count ?? 0
        const pendingPartners = partnersPendingRes.count ?? 0
        const partnerCommissionsCents = (partnerCommissionsRes.data ?? []).reduce(
          (sum: number, c: any) => sum + (c.amount_cents ?? 0), 0
        )

        const arr = mrr * 12

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
          arr,
          leadsToday: filteredTotal,
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
  }, [from, to])

  return { data, loading, error }
}
