import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'

export type DateRange = 'week' | 'month' | 'quarter'
export type SortField = 'name' | 'plan' | 'leads_received' | 'leads_claimed' | 'claim_rate' | 'jobs_published' | 'last_active' | 'status'
export type SortDir = 'asc' | 'desc'

export interface ContractorRow {
  user_id: string
  name: string
  plan: string
  leads_received: number
  leads_claimed: number
  claim_rate: number
  jobs_published: number
  last_active: string | null
  is_active: boolean
  professions: string[]
}

export interface ContractorPerformanceData {
  rows: ContractorRow[]
  totalActive: number
  avgLeads: number
  avgClaimRate: number
  topContractor: string | null
  loading: boolean
}

interface Filters {
  search: string
  plan: string
  profession: string
  dateRange: DateRange
  sortField: SortField
  sortDir: SortDir
}

function getDateCutoff(range: DateRange): string {
  const now = new Date()
  switch (range) {
    case 'week':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
    case 'month':
      return new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    case 'quarter': {
      const qMonth = Math.floor(now.getMonth() / 3) * 3
      return new Date(now.getFullYear(), qMonth, 1).toISOString()
    }
  }
}

export function useContractorPerformance(filters: Filters): ContractorPerformanceData {
  const [allRows, setAllRows] = useState<ContractorRow[]>([])
  const [loading, setLoading] = useState(true)

  const cutoff = getDateCutoff(filters.dateRange)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      try {
        // 1. Fetch all contractors with profiles
        const { data: contractors } = await supabase
          .from('contractors')
          .select('user_id, professions, zip_codes, is_active, profiles!inner(id, full_name, phone, last_sign_in_at)')

        if (!contractors || cancelled) {
          setLoading(false)
          return
        }

        const userIds = contractors.map((c: any) => c.user_id)

        // 2. Fetch subscriptions for all contractors
        const { data: subs } = await supabase
          .from('subscriptions')
          .select('user_id, status, plans(slug)')
          .in('user_id', userIds)
          .in('status', ['active', 'trialing'])

        // Build plan map (latest active sub per user)
        const planMap: Record<string, string> = {}
        if (subs) {
          for (const s of subs as any[]) {
            planMap[s.user_id] = s.plans?.slug ?? 'free'
          }
        }

        // 3. Fetch lead_contact_events in date range (leads received)
        const { data: events } = await supabase
          .from('lead_contact_events')
          .select('user_id, lead_id, leads(status)')
          .in('user_id', userIds)
          .gte('created_at', cutoff)

        // Build lead counts per user
        const receivedMap: Record<string, number> = {}
        const claimedMap: Record<string, number> = {}
        if (events) {
          for (const e of events as any[]) {
            receivedMap[e.user_id] = (receivedMap[e.user_id] ?? 0) + 1
            if (e.leads?.status === 'claimed') {
              claimedMap[e.user_id] = (claimedMap[e.user_id] ?? 0) + 1
            }
          }
        }

        // 4. Fetch lead_feedback counts as proxy for claimed (if status isn't reliable)
        const { data: feedbacks } = await supabase
          .from('lead_feedback')
          .select('user_id')
          .in('user_id', userIds)
          .gte('created_at', cutoff)

        if (feedbacks) {
          for (const f of feedbacks as any[]) {
            // Count feedback as engagement, add to claimed if not already counted
            if (!claimedMap[f.user_id]) {
              claimedMap[f.user_id] = (claimedMap[f.user_id] ?? 0) + 1
            }
          }
        }

        // 5. Fetch job_orders counts in date range
        // job_orders are tied to subcontractors which belong to contractors
        // For simplicity, count job_orders where the contractor is the owner
        const { data: jobs } = await supabase
          .from('subcontractors')
          .select('contractor_id, job_orders(id, created_at)')
          .in('contractor_id', userIds)

        const jobMap: Record<string, number> = {}
        if (jobs) {
          for (const sub of jobs as any[]) {
            const jobCount = (sub.job_orders ?? []).filter(
              (j: any) => j.created_at >= cutoff
            ).length
            jobMap[sub.contractor_id] = (jobMap[sub.contractor_id] ?? 0) + jobCount
          }
        }

        // Build rows
        const rows: ContractorRow[] = contractors.map((c: any) => {
          const profile = c.profiles
          const received = receivedMap[c.user_id] ?? 0
          const claimed = claimedMap[c.user_id] ?? 0
          return {
            user_id: c.user_id,
            name: profile?.full_name ?? 'Unknown',
            plan: planMap[c.user_id] ?? 'free',
            leads_received: received,
            leads_claimed: claimed,
            claim_rate: received > 0 ? Math.round((claimed / received) * 100) : 0,
            jobs_published: jobMap[c.user_id] ?? 0,
            last_active: profile?.last_sign_in_at ?? c.created_at ?? null,
            is_active: c.is_active,
            professions: c.professions ?? [],
          }
        })

        if (!cancelled) {
          setAllRows(rows)
          setLoading(false)
        }
      } catch (err) {
        console.error('Failed to load contractor performance:', err)
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [cutoff])

  // Apply filters, search, sort client-side
  const result = useMemo(() => {
    let filtered = allRows

    // Search
    if (filters.search) {
      const q = filters.search.toLowerCase()
      filtered = filtered.filter(r => r.name.toLowerCase().includes(q))
    }

    // Plan filter
    if (filters.plan) {
      filtered = filtered.filter(r => r.plan === filters.plan)
    }

    // Profession filter
    if (filters.profession) {
      filtered = filtered.filter(r => r.professions.includes(filters.profession))
    }

    // Sort
    const dir = filters.sortDir === 'asc' ? 1 : -1
    filtered = [...filtered].sort((a, b) => {
      switch (filters.sortField) {
        case 'name': return a.name.localeCompare(b.name) * dir
        case 'plan': return a.plan.localeCompare(b.plan) * dir
        case 'leads_received': return (a.leads_received - b.leads_received) * dir
        case 'leads_claimed': return (a.leads_claimed - b.leads_claimed) * dir
        case 'claim_rate': return (a.claim_rate - b.claim_rate) * dir
        case 'jobs_published': return (a.jobs_published - b.jobs_published) * dir
        case 'last_active': {
          const ta = a.last_active ? new Date(a.last_active).getTime() : 0
          const tb = b.last_active ? new Date(b.last_active).getTime() : 0
          return (ta - tb) * dir
        }
        case 'status': return (Number(a.is_active) - Number(b.is_active)) * dir
        default: return 0
      }
    })

    // KPIs
    const activeRows = allRows.filter(r => r.is_active)
    const totalActive = activeRows.length
    const avgLeads = totalActive > 0
      ? Math.round(activeRows.reduce((s, r) => s + r.leads_received, 0) / totalActive)
      : 0
    const avgClaimRate = totalActive > 0
      ? Math.round(activeRows.reduce((s, r) => s + r.claim_rate, 0) / totalActive)
      : 0

    // Top contractor = most leads claimed this period
    let topContractor: string | null = null
    if (allRows.length > 0) {
      const top = [...allRows].sort((a, b) => b.leads_claimed - a.leads_claimed)[0]
      if (top && top.leads_claimed > 0) topContractor = top.name
    }

    return {
      rows: filtered,
      totalActive,
      avgLeads,
      avgClaimRate,
      topContractor,
      loading,
    }
  }, [allRows, filters.search, filters.plan, filters.profession, filters.sortField, filters.sortDir, loading])

  return result
}
