import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { queryClient } from '../lib/queryClient'
import { computeGroupScore, type GroupScoreResult } from '../lib/group-score'

/* ── Types ─────────────────────────────────────────────── */

export interface PartnerGroupRow {
  id: string
  name: string
  status: string
  category: string | null
  total_members: number
  known_sellers: number
  known_buyers: number
  messages7d: number
  messagesPrev7d: number
  last_message_at: string | null
  linked_at: string
  verified: boolean
  score: GroupScoreResult
  // Partner-safe metrics (no exact lead yield exposed)
  leadsDetected: number
  activityLevel: 'high' | 'medium' | 'low' | 'dormant'
  spamRatio: number // seller % — partner should know this to clean their group
  memberBreakdown: { buyers: number; sellers: number; admins: number; unknown: number }
}

export interface PartnerGroupDetail {
  info: PartnerGroupRow
  activity: { date: string; messages: number }[]
  members: PartnerMemberRow[]
  topProfessions: { name: string; count: number }[]
  topRegions: { name: string; count: number }[]
  alerts: PartnerGroupAlert[]
}

export interface PartnerMemberRow {
  wa_sender_id: string
  display_name: string | null
  classification: 'buyer' | 'seller' | 'bot' | 'admin' | 'unknown'
  total_messages: number
  last_seen_at: string | null
  joined_group_at: string | null
  activityLevel: 'active' | 'moderate' | 'dormant'
}

export interface PartnerGroupAlert {
  type: 'spam' | 'dormant' | 'declining'
  message: string
}

/* ── Scoreboard (list view) ──────────────────────────────── */

async function fetchPartnerGroups(partnerId: string): Promise<PartnerGroupRow[]> {
  // Get partner's linked groups
  const { data: links, error: linkErr } = await supabase
    .from('partner_linked_groups')
    .select('group_id, verified, linked_at')
    .eq('partner_id', partnerId)

  if (linkErr || !links || links.length === 0) return []

  const groupIds = links.map(l => l.group_id)
  const linkMap = Object.fromEntries(links.map(l => [l.group_id, l]))

  // Fetch groups
  const { data: groups, error: gErr } = await supabase
    .from('groups')
    .select('*')
    .in('id', groupIds)

  if (gErr || !groups) return []

  // Pipeline stats
  const { data: pipeStats } = await supabase
    .from('pipeline_events')
    .select('group_id, stage')
    .in('group_id', groupIds)
    .in('stage', ['received', 'lead_created'])

  // 7-day activity
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const { data: recent } = await supabase
    .from('pipeline_events')
    .select('group_id')
    .in('group_id', groupIds)
    .eq('stage', 'received')
    .gte('created_at', sevenDaysAgo)

  // Previous week
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
  const { data: prevWeek } = await supabase
    .from('pipeline_events')
    .select('group_id')
    .in('group_id', groupIds)
    .eq('stage', 'received')
    .gte('created_at', fourteenDaysAgo)
    .lt('created_at', sevenDaysAgo)

  // Latest lead per group
  const { data: latestLeads } = await supabase
    .from('leads')
    .select('group_id, created_at')
    .in('group_id', groupIds)
    .order('created_at', { ascending: false })

  // Aggregate
  const received: Record<string, number> = {}
  const leadsCreated: Record<string, number> = {}
  const msgs7d: Record<string, number> = {}
  const msgsPrev7d: Record<string, number> = {}
  const lastLead: Record<string, string> = {}

  pipeStats?.forEach((e: any) => {
    if (e.stage === 'received') received[e.group_id] = (received[e.group_id] || 0) + 1
    if (e.stage === 'lead_created') leadsCreated[e.group_id] = (leadsCreated[e.group_id] || 0) + 1
  })

  recent?.forEach((e: any) => {
    msgs7d[e.group_id] = (msgs7d[e.group_id] || 0) + 1
  })

  prevWeek?.forEach((e: any) => {
    msgsPrev7d[e.group_id] = (msgsPrev7d[e.group_id] || 0) + 1
  })

  latestLeads?.forEach((l: any) => {
    if (!lastLead[l.group_id]) lastLead[l.group_id] = l.created_at
  })

  return groups.map((g: any) => {
    const messagesReceived = received[g.id] || 0
    const leads = leadsCreated[g.id] || 0
    const m7d = msgs7d[g.id] || 0
    const mPrev7d = msgsPrev7d[g.id] || 0
    const leadYield = messagesReceived > 0 ? leads / messagesReceived : 0
    const lastLeadAt = lastLead[g.id] || null
    const hoursSinceLastLead = lastLeadAt
      ? (Date.now() - new Date(lastLeadAt).getTime()) / (1000 * 60 * 60)
      : 999

    const sellerRatio = g.total_members > 0 ? (g.known_sellers || 0) / g.total_members : 0

    const score = computeGroupScore({
      leadYield,
      sellerRatio,
      messages7d: m7d,
      hoursSinceLastLead,
    })

    const activityLevel: PartnerGroupRow['activityLevel'] =
      m7d >= 30 ? 'high' : m7d >= 10 ? 'medium' : m7d >= 1 ? 'low' : 'dormant'

    const link = linkMap[g.id]

    return {
      id: g.id,
      name: g.name,
      status: g.status,
      category: g.category,
      total_members: g.total_members || 0,
      known_sellers: g.known_sellers || 0,
      known_buyers: g.known_buyers || 0,
      messages7d: m7d,
      messagesPrev7d: mPrev7d,
      last_message_at: g.last_message_at,
      linked_at: link?.linked_at || g.created_at,
      verified: link?.verified ?? false,
      score,
      leadsDetected: leads,
      activityLevel,
      spamRatio: Math.round(sellerRatio * 100),
      memberBreakdown: {
        buyers: g.known_buyers || 0,
        sellers: g.known_sellers || 0,
        admins: g.known_admins || 0,
        unknown: Math.max(0, (g.total_members || 0) - (g.known_buyers || 0) - (g.known_sellers || 0) - (g.known_admins || 0)),
      },
    }
  })
}

export function usePartnerGroups(partnerId: string | undefined) {
  const queryKey = ['partner', 'groups', partnerId]

  const query = useQuery({
    queryKey,
    queryFn: () => fetchPartnerGroups(partnerId!),
    enabled: !!partnerId,
    refetchInterval: 30_000,
  })

  useEffect(() => {
    if (!partnerId) return
    const channel = supabase
      .channel(`partner-groups-${partnerId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pipeline_events' }, () => {
        queryClient.invalidateQueries({ queryKey })
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [partnerId])

  return query
}

/* ── Detail (single group view) ──────────────────────────── */

async function fetchPartnerGroupDetail(groupId: string): Promise<PartnerGroupDetail | null> {
  // Group info
  const { data: group, error } = await supabase
    .from('groups')
    .select('*')
    .eq('id', groupId)
    .single()
  if (error || !group) return null

  // 30-day activity (messages only — no lead counts exposed per day)
  const since = new Date()
  since.setDate(since.getDate() - 30)
  const { data: pipeData } = await supabase
    .from('pipeline_events')
    .select('stage, created_at')
    .eq('group_id', groupId)
    .eq('stage', 'received')
    .gte('created_at', since.toISOString())

  const buckets: Record<string, number> = {}
  pipeData?.forEach((r: any) => {
    const date = r.created_at?.slice(0, 10)
    if (date) buckets[date] = (buckets[date] || 0) + 1
  })
  const activity = Object.entries(buckets)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, messages]) => ({ date, messages }))

  // Members (partner-safe: no lead_messages or service_messages exposed)
  const { data: memberData } = await supabase
    .from('group_members')
    .select('wa_sender_id, display_name, classification, total_messages, last_seen_at, joined_group_at')
    .eq('group_id', groupId)
    .order('total_messages', { ascending: false })

  const members: PartnerMemberRow[] = (memberData ?? []).map((m: any) => ({
    wa_sender_id: m.wa_sender_id,
    display_name: m.display_name,
    classification: m.classification || 'unknown',
    total_messages: m.total_messages || 0,
    last_seen_at: m.last_seen_at,
    joined_group_at: m.joined_group_at,
    activityLevel: m.total_messages >= 20 ? 'active' : m.total_messages >= 5 ? 'moderate' : 'dormant',
  }))

  // Top professions (from leads — safe to show categories, not exact yield)
  const { data: leadData } = await supabase
    .from('leads')
    .select('profession, state, created_at')
    .eq('group_id', groupId)

  const profMap: Record<string, number> = {}
  const regMap: Record<string, number> = {}
  leadData?.forEach((l: any) => {
    if (l.profession) profMap[l.profession] = (profMap[l.profession] || 0) + 1
    if (l.state) regMap[l.state] = (regMap[l.state] || 0) + 1
  })
  const topProfessions = Object.entries(profMap)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)
  const topRegions = Object.entries(regMap)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)

  // Compute score + alerts
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const { data: recent7d } = await supabase
    .from('pipeline_events')
    .select('group_id')
    .eq('group_id', groupId)
    .eq('stage', 'received')
    .gte('created_at', sevenDaysAgo)

  const { data: allPipe } = await supabase
    .from('pipeline_events')
    .select('stage')
    .eq('group_id', groupId)
    .in('stage', ['received', 'lead_created'])

  const messagesReceived = allPipe?.filter((e: any) => e.stage === 'received').length || 0
  const leadsCreated = allPipe?.filter((e: any) => e.stage === 'lead_created').length || 0
  const m7d = recent7d?.length || 0
  const leadYield = messagesReceived > 0 ? leadsCreated / messagesReceived : 0
  const sellerRatio = group.total_members > 0 ? (group.known_sellers || 0) / group.total_members : 0

  const lastLeadRow = leadData?.sort((a: any, b: any) => b.created_at?.localeCompare(a.created_at))?.[0]
  const hoursSinceLastLead = lastLeadRow?.created_at
    ? (Date.now() - new Date(lastLeadRow.created_at).getTime()) / (1000 * 60 * 60)
    : 999

  const score = computeGroupScore({ leadYield, sellerRatio, messages7d: m7d, hoursSinceLastLead })

  const activityLevel: PartnerGroupRow['activityLevel'] =
    m7d >= 30 ? 'high' : m7d >= 10 ? 'medium' : m7d >= 1 ? 'low' : 'dormant'

  // Alerts
  const alerts: PartnerGroupAlert[] = []
  if (sellerRatio > 0.6) {
    alerts.push({ type: 'spam', message: `${Math.round(sellerRatio * 100)}% of members are sellers/spammers` })
  }
  if (group.last_message_at && Date.now() - new Date(group.last_message_at).getTime() > 3 * 24 * 60 * 60 * 1000) {
    const days = Math.floor((Date.now() - new Date(group.last_message_at).getTime()) / (24 * 60 * 60 * 1000))
    alerts.push({ type: 'dormant', message: `No activity for ${days} days` })
  }

  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
  const { data: prevWeekData } = await supabase
    .from('pipeline_events')
    .select('group_id')
    .eq('group_id', groupId)
    .eq('stage', 'received')
    .gte('created_at', fourteenDaysAgo)
    .lt('created_at', sevenDaysAgo)
  const mPrev7d = prevWeekData?.length || 0

  if (mPrev7d > 10 && m7d < mPrev7d * 0.5) {
    const drop = Math.round((1 - m7d / mPrev7d) * 100)
    alerts.push({ type: 'declining', message: `Activity dropped ${drop}% this week` })
  }

  const info: PartnerGroupRow = {
    id: group.id,
    name: group.name,
    status: group.status,
    category: group.category,
    total_members: group.total_members || 0,
    known_sellers: group.known_sellers || 0,
    known_buyers: group.known_buyers || 0,
    messages7d: m7d,
    messagesPrev7d: mPrev7d,
    last_message_at: group.last_message_at,
    linked_at: group.created_at,
    verified: true,
    score,
    leadsDetected: leadsCreated,
    activityLevel,
    spamRatio: Math.round(sellerRatio * 100),
    memberBreakdown: {
      buyers: group.known_buyers || 0,
      sellers: group.known_sellers || 0,
      admins: group.known_admins || 0,
      unknown: Math.max(0, (group.total_members || 0) - (group.known_buyers || 0) - (group.known_sellers || 0) - (group.known_admins || 0)),
    },
  }

  return { info, activity, members, topProfessions, topRegions, alerts }
}

export function usePartnerGroupDetail(groupId: string | undefined) {
  return useQuery({
    queryKey: ['partner', 'group-detail', groupId],
    queryFn: () => fetchPartnerGroupDetail(groupId!),
    enabled: !!groupId,
    refetchInterval: 30_000,
  })
}
