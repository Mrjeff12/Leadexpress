import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export interface AdminKPIs {
  [key: string]: number | string
}

export function useAdminKPIs() {
  const [data, setData] = useState<AdminKPIs>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchKPIs() {
      const [
        leadsRes,
        groupsRes,
        contractorsRes,
        subsRes,
        professionsRes,
        scanQueueRes,
        waRes,
        serviceAreasRes,
      ] = await Promise.all([
        supabase.from('leads').select('urgency, status, created_at'),
        supabase.from('groups').select('id, status'),
        supabase.from('profiles').select('id, subscription_status').eq('role', 'contractor'),
        supabase.from('subscriptions').select('id, status'),
        supabase.from('professions').select('id'),
        supabase.from('group_scan_requests').select('id, status').eq('status', 'pending'),
        supabase.from('whatsapp_connections').select('id, status').eq('status', 'connected'),
        supabase.from('service_areas').select('id'),
      ])

      const leads = leadsRes.data ?? []
      const groups = groupsRes.data ?? []
      const contractors = contractorsRes.data ?? []
      const subs = subsRes.data ?? []

      const today = new Date().toISOString().slice(0, 10)
      const leadsToday = leads.filter(l => l.created_at?.startsWith(today)).length
      const hotLeads = leads.filter(l => l.urgency === 'hot').length
      const activeGroups = groups.filter(g => g.status === 'active').length
      const activeSubs = subs.filter(s => s.status === 'active').length
      const activeContractors = contractors.filter(c => c.subscription_status === 'active').length
      const totalLeads = leads.length
      const sent = leads.filter(l => l.status === 'sent').length
      const convRate = totalLeads > 0 ? Math.round((sent / totalLeads) * 1000) / 10 : 0

      setData({
        hotLeads,
        prospectsWaiting: 0,
        unreadMessages: 0,
        activeContractors,
        serviceAreas: serviceAreasRes.data?.length ?? 0,
        leadsOnMap: leads.filter(l => l.status !== 'archived').length,
        waConnected: waRes.data?.length ?? 0,
        activeGroups,
        scansPending: scanQueueRes.data?.length ?? 0,
        activeSubs,
        mrr: activeSubs * 49,
        leadsToday,
        conversionRate: convRate,
        professionsCount: professionsRes.data?.length ?? 0,
        systemConfig: 'Active',
      })
      setLoading(false)
    }

    fetchKPIs()
    const interval = setInterval(fetchKPIs, 30_000)
    return () => clearInterval(interval)
  }, [])

  return { data, loading }
}
