import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { queryClient } from '../lib/queryClient'
import { computeGroupScore, type GroupScoreResult } from '../lib/group-score'

const SCOREBOARD_KEY = ['admin', 'group-scoreboard'] as const

export interface GroupRow {
  id: string
  name: string
  wa_group_id: string
  status: string
  category: string | null
  total_members: number
  known_sellers: number
  known_buyers: number
  message_count: number
  last_message_at: string | null
  created_at: string
  messagesReceived: number
  leadsCreated: number
  messages7d: number
  leadYield: number
  lastLeadAt: string | null
  score: GroupScoreResult
}

async function fetchScoreboardData(): Promise<GroupRow[]> {
  // 1. Fetch all groups
  const { data: groups, error: gErr } = await supabase
    .from('groups')
    .select('*')
    .order('created_at', { ascending: false })

  if (gErr || !groups) throw gErr || new Error('No groups')

  const groupIds = groups.map((g: any) => g.id)
  if (groupIds.length === 0) return []

  // 2. Pipeline events: count received + lead_created per group
  const { data: pipeStats } = await supabase
    .from('pipeline_events')
    .select('group_id, stage')
    .in('group_id', groupIds)
    .in('stage', ['received', 'lead_created'])

  // 3. Pipeline events last 7 days
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const { data: recent } = await supabase
    .from('pipeline_events')
    .select('group_id')
    .in('group_id', groupIds)
    .eq('stage', 'received')
    .gte('created_at', sevenDaysAgo)

  // 4. Latest lead per group
  const { data: latestLeads } = await supabase
    .from('leads')
    .select('group_id, created_at')
    .in('group_id', groupIds)
    .order('created_at', { ascending: false })

  // Aggregate
  const received: Record<string, number> = {}
  const leads: Record<string, number> = {}
  const msgs7d: Record<string, number> = {}
  const lastLead: Record<string, string> = {}

  pipeStats?.forEach((e: any) => {
    if (e.stage === 'received') received[e.group_id] = (received[e.group_id] || 0) + 1
    if (e.stage === 'lead_created') leads[e.group_id] = (leads[e.group_id] || 0) + 1
  })

  recent?.forEach((e: any) => {
    msgs7d[e.group_id] = (msgs7d[e.group_id] || 0) + 1
  })

  latestLeads?.forEach((l: any) => {
    if (!lastLead[l.group_id]) lastLead[l.group_id] = l.created_at
  })

  return groups.map((g: any) => {
    const messagesReceived = received[g.id] || 0
    const leadsCreated = leads[g.id] || 0
    const messages7d_count = msgs7d[g.id] || 0
    const leadYield = messagesReceived > 0 ? leadsCreated / messagesReceived : 0
    const lastLeadAt = lastLead[g.id] || null
    const hoursSinceLastLead = lastLeadAt
      ? (Date.now() - new Date(lastLeadAt).getTime()) / (1000 * 60 * 60)
      : 999

    const score = computeGroupScore({
      leadYield,
      sellerRatio: g.total_members > 0 ? (g.known_sellers || 0) / g.total_members : 0,
      messages7d: messages7d_count,
      hoursSinceLastLead,
    })

    return {
      id: g.id,
      name: g.name,
      wa_group_id: g.wa_group_id,
      status: g.status,
      category: g.category,
      total_members: g.total_members || 0,
      known_sellers: g.known_sellers || 0,
      known_buyers: g.known_buyers || 0,
      message_count: g.message_count || 0,
      last_message_at: g.last_message_at,
      created_at: g.created_at,
      messagesReceived,
      leadsCreated,
      messages7d: messages7d_count,
      leadYield,
      lastLeadAt,
      score,
    }
  })
}

export function useGroupScoreboard() {
  const query = useQuery({
    queryKey: SCOREBOARD_KEY,
    queryFn: fetchScoreboardData,
    refetchInterval: 30_000,
  })

  useEffect(() => {
    const channel = supabase
      .channel('group-scoreboard-rt')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pipeline_events' }, () => {
        queryClient.invalidateQueries({ queryKey: SCOREBOARD_KEY })
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  return query
}
