import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { queryClient } from '../lib/queryClient'
import { computeGroupScore, type GroupScoreResult } from '../lib/group-score'
import { aggregateGroupPipelineStats } from '../lib/groupStatsAggregation'

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
  messagesPrev7d: number
  repeatRequesters: number
  leadYield: number
  lastLeadAt: string | null
  score: GroupScoreResult
  scannerName: string | null
  scannerStatus: string | null
}

async function fetchScoreboardData(): Promise<GroupRow[]> {
  // 1. Fetch all groups with scanner connection status
  const { data: groups, error: gErr } = await supabase
    .from('groups')
    .select('*, wa_accounts(label, status)')
    .order('created_at', { ascending: false })

  if (gErr || !groups) throw gErr || new Error('No groups')

  const groupIds = groups.map((g: any) => g.id)
  if (groupIds.length === 0) return []

  // 2. Aggregated pipeline stats (shared utility)
  const pipelineStats = await aggregateGroupPipelineStats(groupIds)

  // 3. Member classification counts per group
  const { data: memberStats } = await supabase
    .from('group_members')
    .select('group_id, classification')
    .in('group_id', groupIds)
    .in('classification', ['publisher', 'occasional_publisher', 'contractor', 'admin'])

  // 4. Repeat requesters
  const { data: repeats } = await supabase
    .from('leads')
    .select('group_id, sender_id')
    .in('group_id', groupIds)

  const repeatCounts: Record<string, number> = {}
  if (repeats) {
    const senderGroups: Record<string, Record<string, number>> = {}
    repeats.forEach((r: any) => {
      if (!r.sender_id) return
      const key = r.group_id
      if (!senderGroups[key]) senderGroups[key] = {}
      senderGroups[key][r.sender_id] = (senderGroups[key][r.sender_id] || 0) + 1
    })
    Object.entries(senderGroups).forEach(([gid, senders]) => {
      repeatCounts[gid] = Object.values(senders).filter(c => c >= 2).length
    })
  }

  const publisherCounts: Record<string, number> = {}
  const occasionalCounts: Record<string, number> = {}
  const contractorCounts: Record<string, number> = {}
  const adminCounts: Record<string, number> = {}
  memberStats?.forEach((m: any) => {
    if (m.classification === 'publisher') publisherCounts[m.group_id] = (publisherCounts[m.group_id] || 0) + 1
    if (m.classification === 'occasional_publisher') occasionalCounts[m.group_id] = (occasionalCounts[m.group_id] || 0) + 1
    if (m.classification === 'contractor') contractorCounts[m.group_id] = (contractorCounts[m.group_id] || 0) + 1
    if (m.classification === 'admin') adminCounts[m.group_id] = (adminCounts[m.group_id] || 0) + 1
  })

  return groups.map((g: any) => {
    const stats = pipelineStats[g.id]
    const livePublishers = publisherCounts[g.id] || 0
    const liveOccasional = occasionalCounts[g.id] || 0
    const liveContractors = contractorCounts[g.id] || 0
    const liveAdmins = adminCounts[g.id] || 0

    const score = computeGroupScore({
      leadYield: stats?.leadYield ?? 0,
      sellerRatio: g.total_members > 0 ? (livePublishers + liveOccasional) / g.total_members : 0,
      messages7d: stats?.messages7d ?? 0,
      hoursSinceLastLead: stats?.hoursSinceLastLead ?? 999,
    })

    return {
      id: g.id,
      name: g.name,
      wa_group_id: g.wa_group_id,
      status: g.status,
      category: g.category,
      total_members: g.total_members || 0,
      known_sellers: livePublishers,
      known_occasional: liveOccasional,
      known_contractors: liveContractors,
      known_admins: liveAdmins,
      message_count: g.message_count || 0,
      last_message_at: g.last_message_at,
      created_at: g.created_at,
      messagesReceived: stats?.received ?? 0,
      leadsCreated: stats?.leadsCreated ?? 0,
      messages7d: stats?.messages7d ?? 0,
      messagesPrev7d: stats?.messagesPrev7d ?? 0,
      repeatRequesters: repeatCounts[g.id] || 0,
      leadYield: stats?.leadYield ?? 0,
      lastLeadAt: stats?.lastLeadAt ?? null,
      score,
      scannerName: g.wa_accounts?.label ?? null,
      scannerStatus: g.wa_accounts?.status ?? null,
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
