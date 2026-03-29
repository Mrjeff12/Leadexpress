import { supabase } from './supabase'

/* ── Result type ─────────────────────────────────────────── */

export interface GroupPipelineStats {
  received: number
  leadsCreated: number
  messages7d: number
  messagesPrev7d: number
  lastLeadAt: string | null
  leadYield: number
  hoursSinceLastLead: number
}

/* ── Core aggregation ───────────────────────────────────── */

/**
 * Fetches and aggregates pipeline_events + latest-lead data for a
 * set of group IDs.  Returns a map keyed by group ID.
 *
 * Both useGroupScoreboard and usePartnerGroups call this instead of
 * duplicating the same Supabase queries + counting loops.
 */
export async function aggregateGroupPipelineStats(
  groupIds: string[],
): Promise<Record<string, GroupPipelineStats>> {
  if (groupIds.length === 0) return {}

  // 1. Pipeline events: count received + lead_created per group
  const { data: pipeStats } = await supabase
    .from('pipeline_events')
    .select('group_id, stage')
    .in('group_id', groupIds)
    .in('stage', ['received', 'lead_created'])

  // 2. Pipeline events last 7 days (received only)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const { data: recent } = await supabase
    .from('pipeline_events')
    .select('group_id')
    .in('group_id', groupIds)
    .eq('stage', 'received')
    .gte('created_at', sevenDaysAgo)

  // 3. Previous week (7-14 days ago)
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
  const { data: prevWeek } = await supabase
    .from('pipeline_events')
    .select('group_id')
    .in('group_id', groupIds)
    .eq('stage', 'received')
    .gte('created_at', fourteenDaysAgo)
    .lt('created_at', sevenDaysAgo)

  // 4. Latest lead per group
  const { data: latestLeads } = await supabase
    .from('leads')
    .select('group_id, created_at')
    .in('group_id', groupIds)
    .order('created_at', { ascending: false })

  // ── Aggregate into per-group maps ────────────────────────

  const received: Record<string, number> = {}
  const leads: Record<string, number> = {}
  const msgs7d: Record<string, number> = {}
  const msgsPrev7d: Record<string, number> = {}
  const lastLead: Record<string, string> = {}

  pipeStats?.forEach((e: any) => {
    if (e.stage === 'received') received[e.group_id] = (received[e.group_id] || 0) + 1
    if (e.stage === 'lead_created') leads[e.group_id] = (leads[e.group_id] || 0) + 1
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

  // ── Build result map ─────────────────────────────────────

  const result: Record<string, GroupPipelineStats> = {}

  for (const gid of groupIds) {
    const messagesReceived = received[gid] || 0
    const leadsCreated = leads[gid] || 0
    const lastLeadAt = lastLead[gid] || null
    const leadYield = messagesReceived > 0 ? leadsCreated / messagesReceived : 0
    const hoursSinceLastLead = lastLeadAt
      ? (Date.now() - new Date(lastLeadAt).getTime()) / (1000 * 60 * 60)
      : 999

    result[gid] = {
      received: messagesReceived,
      leadsCreated,
      messages7d: msgs7d[gid] || 0,
      messagesPrev7d: msgsPrev7d[gid] || 0,
      lastLeadAt,
      leadYield,
      hoursSinceLastLead,
    }
  }

  return result
}
