import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { DateRange } from './useDateFilter'

export interface NetworkProfession {
  id: string
  name_en: string
  name_he: string
  emoji: string
  color: string
  contractorCount: number
}

export interface NetworkContractor {
  user_id: string
  full_name: string | null
  phone: string | null
  professions: string[]
  avatar_url?: string | null
  subscription_status: string | null
}

export interface WaAccount {
  id: string
  label: string
  display_name: string | null
  avatar_url: string | null
  status: string
  phone_number: string | null
  role: string | null
  leadsCount: number
}

export interface GroupDetail {
  id: string
  name: string
  category: string | null
  wa_account_id: string | null
  leadsCount: number
  total_members: number
  instance_status: string | null  // 'active' | 'not_in_instance'
}

export interface PendingGroup {
  id: string
  group_name: string | null
  status: string
  created_at: string
  invite_code: string | null
}

export interface NetworkData {
  professions: NetworkProfession[]
  contractors: NetworkContractor[]
  groupsCount: number
  leadsToday: number
  waAccounts: WaAccount[]
  groups: GroupDetail[]
  pendingGroups: PendingGroup[]
}

export function useNetworkData(dateRange?: DateRange) {
  const [data, setData] = useState<NetworkData>({
    professions: [],
    contractors: [],
    groupsCount: 0,
    leadsToday: 0,
    waAccounts: [],
    groups: [],
    pendingGroups: [],
  })
  const [loading, setLoading] = useState(true)

  const from = dateRange?.from
  const to = dateRange?.to

  useEffect(() => {
    async function fetchData() {
      try {
        const rangeFrom = from ?? new Date().toISOString().slice(0, 10)
        const rangeTo = to ?? rangeFrom
        const rangeToEnd = rangeTo + 'T23:59:59.999Z'

        const [
          professionsRes,
          contractorsRes,
          groupsRes,
          leadsRes,
          waAccountsRes,
          groupsDetailRes,
          pendingRes,
          leadsWithGroupRes,
        ] = await Promise.all([
          supabase.from('professions').select('id, name_en, name_he, emoji, color').eq('is_active', true).order('sort_order'),
          supabase.from('contractors').select('user_id, professions, profiles!inner(full_name, phone)').eq('is_active', true),
          supabase.from('groups').select('id', { count: 'exact', head: true }),
          supabase.from('leads').select('id', { count: 'exact', head: true })
            .gte('created_at', rangeFrom).lte('created_at', rangeToEnd),
          // WA accounts with their details
          supabase.from('wa_accounts').select('id, label, display_name, avatar_url, status, phone_number, role').eq('is_active', true).order('priority'),
          // All groups with their wa_account_id, members, status
          supabase.from('groups').select('id, name, category, wa_account_id, total_members, instance_status'),
          // Pending group join requests
          supabase.from('contractor_group_scan_requests').select('id, group_name, status, created_at, invite_code').eq('status', 'pending').order('created_at', { ascending: false }),
          // Leads in date range with group_id for per-group/per-wa counting
          supabase.from('leads').select('id, group_id')
            .gte('created_at', rangeFrom).lte('created_at', rangeToEnd),
        ])

        const professions = (professionsRes.data ?? []) as any[]
        const rawContractors = (contractorsRes.data ?? []) as any[]

        // Count contractors per profession
        const profCountMap: Record<string, number> = {}
        rawContractors.forEach((c: any) => {
          (c.professions ?? []).forEach((p: string) => {
            profCountMap[p] = (profCountMap[p] ?? 0) + 1
          })
        })

        const networkProfessions: NetworkProfession[] = professions.map((p) => ({
          id: p.id,
          name_en: p.name_en,
          name_he: p.name_he,
          emoji: p.emoji,
          color: p.color,
          contractorCount: profCountMap[p.id] ?? 0,
        }))

        const networkContractors: NetworkContractor[] = rawContractors.map((c: any) => ({
          user_id: c.user_id,
          full_name: c.profiles?.full_name ?? null,
          phone: c.profiles?.phone ?? null,
          professions: c.professions ?? [],
          avatar_url: null,
          subscription_status: null,
        }))

        // Count leads per group in the date range
        const leadsPerGroup: Record<string, number> = {}
        for (const lead of (leadsWithGroupRes.data ?? [])) {
          const gid = (lead as any).group_id
          if (gid) leadsPerGroup[gid] = (leadsPerGroup[gid] ?? 0) + 1
        }

        // Build groups detail with lead counts
        const allGroups = (groupsDetailRes.data ?? []) as any[]
        const groupDetails: GroupDetail[] = allGroups.map((g) => ({
          id: g.id,
          name: g.name,
          category: g.category,
          wa_account_id: g.wa_account_id,
          leadsCount: leadsPerGroup[g.id] ?? 0,
          total_members: g.total_members ?? 0,
          instance_status: g.instance_status,
        }))

        // Count leads per WA account (via groups)
        const leadsPerWa: Record<string, number> = {}
        for (const g of groupDetails) {
          if (g.wa_account_id && g.leadsCount > 0) {
            leadsPerWa[g.wa_account_id] = (leadsPerWa[g.wa_account_id] ?? 0) + g.leadsCount
          }
        }

        const waAccounts: WaAccount[] = (waAccountsRes.data ?? []).map((wa: any) => ({
          id: wa.id,
          label: wa.label,
          display_name: wa.display_name,
          avatar_url: wa.avatar_url,
          status: wa.status,
          phone_number: wa.phone_number,
          role: wa.role,
          leadsCount: leadsPerWa[wa.id] ?? 0,
        }))

        const pendingGroups: PendingGroup[] = (pendingRes.data ?? []).map((p: any) => ({
          id: p.id,
          group_name: p.group_name,
          status: p.status,
          created_at: p.created_at,
          invite_code: p.invite_code,
        }))

        setData({
          professions: networkProfessions,
          contractors: networkContractors,
          groupsCount: groupsRes.count ?? 0,
          leadsToday: leadsRes.count ?? 0,
          waAccounts,
          groups: groupDetails,
          pendingGroups,
        })
      } catch (err) {
        console.error('[useNetworkData] Error:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
    const interval = setInterval(fetchData, 30_000)
    return () => clearInterval(interval)
  }, [from, to])

  return { data, loading }
}
