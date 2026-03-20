import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

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

export interface NetworkData {
  professions: NetworkProfession[]
  contractors: NetworkContractor[]
  groupsCount: number
  leadsToday: number
}

export function useNetworkData() {
  const [data, setData] = useState<NetworkData>({
    professions: [],
    contractors: [],
    groupsCount: 0,
    leadsToday: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetch() {
      try {
        const today = new Date().toISOString().slice(0, 10)

        const [professionsRes, contractorsRes, groupsRes, leadsRes] = await Promise.all([
          supabase.from('professions').select('id, name_en, name_he, emoji, color').eq('is_active', true).order('sort_order'),
          supabase.from('contractors').select('user_id, professions, profiles!inner(full_name, phone, subscription_status, avatar_url)').eq('is_active', true),
          supabase.from('groups').select('id', { count: 'exact', head: true }),
          supabase.from('leads').select('id', { count: 'exact', head: true }).gte('created_at', today),
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
          avatar_url: c.profiles?.avatar_url ?? null,
          subscription_status: c.profiles?.subscription_status ?? null,
        }))

        setData({
          professions: networkProfessions,
          contractors: networkContractors,
          groupsCount: groupsRes.count ?? 0,
          leadsToday: leadsRes.count ?? 0,
        })
      } catch (err) {
        console.error('[useNetworkData] Error:', err)
      } finally {
        setLoading(false)
      }
    }

    fetch()
    const interval = setInterval(fetch, 30_000)
    return () => clearInterval(interval)
  }, [])

  return { data, loading }
}
