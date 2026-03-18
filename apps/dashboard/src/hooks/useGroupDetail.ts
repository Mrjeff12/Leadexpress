import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { queryClient } from '../lib/queryClient'

/* ── Types ─────────────────────────────────────────────── */

export interface GroupInfo {
  id: string
  name: string
  wa_group_id: string
  status: string
  category: string | null
  total_members: number
  known_sellers: number
  known_buyers: number
  created_at: string
}

export interface FunnelStep {
  stage: string
  count: number
  pct: number
}

export interface ActivityDay {
  date: string
  messages: number
  leads: number
}

export interface MemberRow {
  id: string
  wa_sender_id: string
  display_name: string | null
  classification: string
  total_messages: number
  lead_messages: number
  service_messages: number
  last_seen_at: string | null
  manual_override: boolean
}

export interface TrendMonth {
  month: string        // "2026-01"
  profession: string
  count: number
}

export interface MarketIntel {
  professions: { name: string; count: number; pct: number }[]
  regions: { name: string; count: number; pct: number }[]
  urgency: { level: string; count: number; pct: number }[]
  repeatRequesters: {
    sender_id: string
    display_name: string | null
    request_count: number
    professions: string[]
    last_request: string
  }[]
}

/* ── Fetchers ──────────────────────────────────────────── */

async function fetchGroupInfo(groupId: string): Promise<GroupInfo> {
  const { data, error } = await supabase
    .from('groups')
    .select('*')
    .eq('id', groupId)
    .single()
  if (error) throw error
  return data as GroupInfo
}

async function fetchFunnel(groupId: string): Promise<FunnelStep[]> {
  const { data, error } = await supabase
    .from('pipeline_events')
    .select('stage')
    .eq('group_id', groupId)
  if (error) throw error

  const stages = ['received', 'quick_filtered', 'sender_filtered', 'no_lead', 'lead_created']
  const counts: Record<string, number> = {}
  for (const s of stages) counts[s] = 0
  for (const row of data ?? []) {
    if (stages.includes(row.stage)) counts[row.stage]++
  }

  const received = counts['received'] || 1 // avoid division by zero
  return stages.map((stage) => ({
    stage,
    count: counts[stage],
    pct: Math.round((counts[stage] / received) * 100),
  }))
}

async function fetchActivity(groupId: string): Promise<ActivityDay[]> {
  const since = new Date()
  since.setDate(since.getDate() - 30)
  const sinceISO = since.toISOString()

  const { data, error } = await supabase
    .from('pipeline_events')
    .select('stage, created_at')
    .eq('group_id', groupId)
    .in('stage', ['received', 'lead_created'])
    .gte('created_at', sinceISO)
  if (error) throw error

  const buckets: Record<string, { messages: number; leads: number }> = {}
  for (const row of data ?? []) {
    const date = row.created_at?.slice(0, 10)
    if (!date) continue
    if (!buckets[date]) buckets[date] = { messages: 0, leads: 0 }
    if (row.stage === 'received') buckets[date].messages++
    if (row.stage === 'lead_created') buckets[date].leads++
  }

  return Object.entries(buckets)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, messages: v.messages, leads: v.leads }))
}

async function fetchMembers(groupId: string): Promise<MemberRow[]> {
  const { data, error } = await supabase
    .from('group_members')
    .select('*')
    .eq('group_id', groupId)
    .order('total_messages', { ascending: false })
  if (error) throw error
  return (data ?? []) as MemberRow[]
}

async function fetchMarketIntel(groupId: string): Promise<MarketIntel> {
  const { data, error } = await supabase
    .from('leads')
    .select('profession, state, urgency, sender_id, created_at')
    .eq('group_id', groupId)
  if (error) throw error

  const rows = data ?? []
  const total = rows.length || 1

  // Professions
  const profMap: Record<string, number> = {}
  for (const r of rows) {
    const key = r.profession || 'Unknown'
    profMap[key] = (profMap[key] || 0) + 1
  }
  const professions = Object.entries(profMap)
    .map(([name, count]) => ({ name, count, pct: Math.round((count / total) * 100) }))
    .sort((a, b) => b.count - a.count)

  // Regions
  const regMap: Record<string, number> = {}
  for (const r of rows) {
    const key = r.state || 'Unknown'
    regMap[key] = (regMap[key] || 0) + 1
  }
  const regions = Object.entries(regMap)
    .map(([name, count]) => ({ name, count, pct: Math.round((count / total) * 100) }))
    .sort((a, b) => b.count - a.count)

  // Urgency
  const urgMap: Record<string, number> = {}
  for (const r of rows) {
    const key = r.urgency || 'unknown'
    urgMap[key] = (urgMap[key] || 0) + 1
  }
  const urgency = Object.entries(urgMap)
    .map(([level, count]) => ({ level, count, pct: Math.round((count / total) * 100) }))
    .sort((a, b) => b.count - a.count)

  // Repeat requesters (sender with >= 2 leads)
  const senderBuckets: Record<string, { display_name: string | null; professions: Set<string>; count: number; last: string }> = {}
  for (const r of rows) {
    const sid = r.sender_id
    if (!sid) continue
    if (!senderBuckets[sid]) {
      senderBuckets[sid] = { display_name: null, professions: new Set(), count: 0, last: r.created_at }
    }
    senderBuckets[sid].count++
    if (r.profession) senderBuckets[sid].professions.add(r.profession)
    if (r.created_at > senderBuckets[sid].last) senderBuckets[sid].last = r.created_at
  }
  const repeatRequesters = Object.entries(senderBuckets)
    .filter(([, v]) => v.count >= 2)
    .map(([sender_id, v]) => ({
      sender_id,
      display_name: v.display_name,
      request_count: v.count,
      professions: Array.from(v.professions),
      last_request: v.last,
    }))
    .sort((a, b) => b.request_count - a.request_count)

  return { professions, regions, urgency, repeatRequesters }
}

async function fetchTrends(groupId: string): Promise<TrendMonth[]> {
  const twelveMonthsAgo = new Date()
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12)

  const { data } = await supabase
    .from('leads')
    .select('profession, created_at')
    .eq('group_id', groupId)
    .gte('created_at', twelveMonthsAgo.toISOString())

  if (!data || data.length === 0) return []

  const map: Record<string, Record<string, number>> = {}
  data.forEach((l: any) => {
    const month = l.created_at.slice(0, 7)
    const prof = l.profession || 'other'
    if (!map[month]) map[month] = {}
    map[month][prof] = (map[month][prof] || 0) + 1
  })

  const result: TrendMonth[] = []
  Object.entries(map).forEach(([month, profs]) => {
    Object.entries(profs).forEach(([profession, count]) => {
      result.push({ month, profession, count })
    })
  })

  return result.sort((a, b) => a.month.localeCompare(b.month))
}

/* ── Hook ──────────────────────────────────────────────── */

export function useGroupDetail(groupId: string | undefined) {
  const baseKey = ['admin', 'group-detail', groupId]

  const infoQuery = useQuery({
    queryKey: [...baseKey, 'info'],
    queryFn: () => fetchGroupInfo(groupId!),
    enabled: !!groupId,
  })

  const funnelQuery = useQuery({
    queryKey: [...baseKey, 'funnel'],
    queryFn: () => fetchFunnel(groupId!),
    enabled: !!groupId,
  })

  const activityQuery = useQuery({
    queryKey: [...baseKey, 'activity'],
    queryFn: () => fetchActivity(groupId!),
    enabled: !!groupId,
  })

  const membersQuery = useQuery({
    queryKey: [...baseKey, 'members'],
    queryFn: () => fetchMembers(groupId!),
    enabled: !!groupId,
  })

  const marketQuery = useQuery({
    queryKey: [...baseKey, 'market'],
    queryFn: () => fetchMarketIntel(groupId!),
    enabled: !!groupId,
    staleTime: 60_000,
  })

  const trendsQuery = useQuery({
    queryKey: [...baseKey, 'trends'],
    queryFn: () => fetchTrends(groupId!),
    enabled: !!groupId,
    staleTime: 120_000,
  })

  // Realtime for pipeline events + members
  useEffect(() => {
    if (!groupId) return
    const channel = supabase
      .channel(`group-detail-${groupId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'pipeline_events', filter: `group_id=eq.${groupId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: [...baseKey, 'funnel'] })
          queryClient.invalidateQueries({ queryKey: [...baseKey, 'activity'] })
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'group_members', filter: `group_id=eq.${groupId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: [...baseKey, 'members'] })
        },
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [groupId])

  return {
    info: infoQuery.data,
    funnel: funnelQuery.data,
    activity: activityQuery.data,
    members: membersQuery.data,
    market: marketQuery.data,
    trends: trendsQuery.data,
    isLoading: infoQuery.isLoading,
    isError: infoQuery.isError,
  }
}
