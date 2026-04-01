import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { queryClient } from '../lib/queryClient'

/* ── Types ─────────────────────────────────────────────── */

export type ProspectStage = 'not_reached' | 'interested' | 'trial' | 'subscribed'

export interface ChatMember {
  wa_sender_id: string
  display_name: string | null
  classification: 'buyer' | 'seller' | 'bot' | 'admin' | 'unknown'
  total_messages: number
  last_seen_at: string | null
  prospectStage: ProspectStage
  lastMessagePreview: string | null
}

export interface ChatMessage {
  id: string
  sender: string
  senderName: string
  text: string
  timestamp: number
  isLead?: boolean
  pipelineStage?: string
  senderClassification?: 'unknown' | 'seller' | 'buyer' | 'bot' | 'admin'
}

export interface GroupChatInfo {
  id: string
  name: string
  total_members: number
  known_sellers: number
  known_buyers: number
  category: string | null
  status: string
  last_message_at: string | null
  created_at: string
}

export interface GroupChatStats {
  subscribed: number
  trial: number
  interested: number
  notReached: number
}

/* ── Stage mapping ──────────────────────────────────────── */

function mapProspectStage(dbStage: string | null): ProspectStage {
  switch (dbStage) {
    case 'paying': return 'subscribed'
    case 'demo_trial': return 'trial'
    case 'reached_out':
    case 'in_conversation': return 'interested'
    default: return 'not_reached'
  }
}

/* ══════════════════════════════════════════════════════════
   DEMO DATA — realistic WhatsApp group for NJ Contractors
   ══════════════════════════════════════════════════════════ */

const DEMO_GROUP: GroupChatInfo = {
  id: 'demo-nj-contractors',
  name: 'NJ Contractors',
  total_members: 583,
  known_sellers: 42,
  known_buyers: 310,
  category: 'renovation',
  status: 'active',
  last_message_at: new Date().toISOString(),
  created_at: '2023-09-15T00:00:00Z',
}

const now = Date.now()
const min = 60_000

const DEMO_MEMBERS: ChatMember[] = [
  { wa_sender_id: '1@c.us', display_name: 'Mike Johnson', classification: 'buyer', total_messages: 47, last_seen_at: new Date(now - 5 * min).toISOString(), prospectStage: 'interested', lastMessagePreview: 'Sounds interesting, how do I sign up?' },
  { wa_sender_id: '2@c.us', display_name: 'Carlos Rivera', classification: 'buyer', total_messages: 38, last_seen_at: new Date(now - 15 * min).toISOString(), prospectStage: 'trial', lastMessagePreview: 'Thanks bro, I signed up! 🔥' },
  { wa_sender_id: '3@c.us', display_name: 'James Wilson', classification: 'buyer', total_messages: 62, last_seen_at: new Date(now - 30 * min).toISOString(), prospectStage: 'subscribed', lastMessagePreview: 'Getting leads every day now ...' },
  { wa_sender_id: '4@c.us', display_name: 'David Chen', classification: 'buyer', total_messages: 29, last_seen_at: new Date(now - 60 * min * 24).toISOString(), prospectStage: 'interested', lastMessagePreview: 'What areas does it cover?' },
  { wa_sender_id: '5@c.us', display_name: 'Robert Taylor', classification: 'unknown', total_messages: 5, last_seen_at: new Date(now - 60 * min * 24).toISOString(), prospectStage: 'not_reached', lastMessagePreview: "I'll check it out this wee..." },
  { wa_sender_id: '6@c.us', display_name: 'Alex Martinez', classification: 'buyer', total_messages: 55, last_seen_at: new Date(now - 60 * min * 48).toISOString(), prospectStage: 'subscribed', lastMessagePreview: 'Using it for a week alread...' },
  { wa_sender_id: '7@c.us', display_name: 'Tony Soprano', classification: 'buyer', total_messages: 22, last_seen_at: new Date(now - 60 * min * 72).toISOString(), prospectStage: 'trial', lastMessagePreview: '👍 🔥' },
  { wa_sender_id: '8@c.us', display_name: 'Steve Rogers', classification: 'buyer', total_messages: 18, last_seen_at: new Date(now - 60 * min * 96).toISOString(), prospectStage: 'not_reached', lastMessagePreview: null },
  { wa_sender_id: '9@c.us', display_name: 'Danny Williams', classification: 'buyer', total_messages: 33, last_seen_at: new Date(now - 60 * min * 2).toISOString(), prospectStage: 'subscribed', lastMessagePreview: 'Just landed a $12k job from a lead' },
  { wa_sender_id: '10@c.us', display_name: 'Frank Castle', classification: 'unknown', total_messages: 2, last_seen_at: new Date(now - 60 * min * 120).toISOString(), prospectStage: 'not_reached', lastMessagePreview: null },
  { wa_sender_id: '11@c.us', display_name: 'Eddie Murphy', classification: 'buyer', total_messages: 15, last_seen_at: new Date(now - 60 * min * 48).toISOString(), prospectStage: 'interested', lastMessagePreview: 'How much does it cost?' },
  { wa_sender_id: '12@c.us', display_name: 'Sam Wilson', classification: 'buyer', total_messages: 41, last_seen_at: new Date(now - 60 * min * 4).toISOString(), prospectStage: 'trial', lastMessagePreview: 'Got my first lead today!' },
]

const DEMO_MESSAGES: ChatMessage[] = [
  { id: 'm1', sender: '2@c.us', senderName: 'Carlos', text: 'Anyone know a good tile guy in Newark?', timestamp: now - 40 * min, senderClassification: 'buyer' },
  { id: 'm2', sender: '3@c.us', senderName: 'James', text: 'Yeah try Danny, he did my bathroom last month 👌', timestamp: now - 38 * min, senderClassification: 'buyer' },
  { id: 'm3', sender: '1@c.us', senderName: 'Mike', text: 'I need help with a plumbing job in Jersey City, 2-story house', timestamp: now - 29 * min, isLead: true, senderClassification: 'buyer' },
  { id: 'm4', sender: '4@c.us', senderName: 'David', text: 'How big is the job? I might be able to take it', timestamp: now - 25 * min, senderClassification: 'buyer' },
  { id: 'm5', sender: '1@c.us', senderName: 'Mike', text: 'Full bathroom remodel, copper to PEX repipe', timestamp: now - 22 * min, senderClassification: 'buyer' },
  { id: 'm6', sender: '6@c.us', senderName: 'Alex', text: 'I just signed up for MasterLeadFlow, getting notifications for jobs like this automatically now', timestamp: now - 18 * min, senderClassification: 'buyer' },
  { id: 'm7', sender: '9@c.us', senderName: 'Danny', text: 'Same here, landed a $12k kitchen remodel from a lead last week 💰', timestamp: now - 15 * min, senderClassification: 'buyer' },
  { id: 'm8', sender: '1@c.us', senderName: 'Mike', text: 'Sounds interesting, how do I sign up?', timestamp: now - 10 * min, senderClassification: 'buyer' },
  { id: 'm9', sender: '12@c.us', senderName: 'Sam', text: 'Check the pinned message, there\'s a link. Free trial too', timestamp: now - 8 * min, senderClassification: 'buyer' },
  { id: 'm10', sender: '2@c.us', senderName: 'Carlos', text: 'Thanks bro, I signed up! Getting leads already 🔥', timestamp: now - 5 * min, senderClassification: 'buyer' },
  { id: 'm11', sender: '7@c.us', senderName: 'Tony', text: 'Anyone doing fencing work in Hoboken area? Got a client looking for 200ft of vinyl', timestamp: now - 3 * min, isLead: true, senderClassification: 'buyer' },
  { id: 'm12', sender: '4@c.us', senderName: 'David', text: 'I can do vinyl fencing. DM me the details', timestamp: now - 1 * min, senderClassification: 'buyer' },
]

const DEMO_STATS: GroupChatStats = {
  subscribed: 127,
  trial: 84,
  interested: 211,
  notReached: 161,
}

/* ── Fetch group info ──────────────────────────────────── */

async function fetchGroupInfo(groupId: string): Promise<GroupChatInfo | null> {
  const { data, error } = await supabase
    .from('groups')
    .select('id, name, total_members, known_sellers, known_buyers, category, status, last_message_at, created_at')
    .eq('id', groupId)
    .single()
  if (error || !data) return null
  return data as GroupChatInfo
}

/* ── Fetch members with prospect enrichment ────────────── */

async function fetchMembers(groupId: string): Promise<ChatMember[]> {
  const { data: members } = await supabase
    .from('group_members')
    .select('wa_sender_id, display_name, classification, total_messages, last_seen_at')
    .eq('group_id', groupId)
    .order('total_messages', { ascending: false })

  if (!members || members.length === 0) return []

  const senderIds = members.map(m => m.wa_sender_id).filter(Boolean)
  let prospectMap = new Map<string, string>()

  if (senderIds.length > 0) {
    const { data: prospects } = await supabase
      .from('prospects')
      .select('wa_id, stage')
      .in('wa_id', senderIds)

    if (prospects) {
      prospectMap = new Map(prospects.map(p => [p.wa_id, p.stage]))
    }
  }

  return members.map((m: any) => ({
    wa_sender_id: m.wa_sender_id,
    display_name: m.display_name,
    classification: m.classification || 'unknown',
    total_messages: m.total_messages || 0,
    last_seen_at: m.last_seen_at,
    prospectStage: mapProspectStage(prospectMap.get(m.wa_sender_id) ?? null),
    lastMessagePreview: null,
  }))
}

/* ── Fetch messages from wa-listener API ───────────────── */

async function fetchMessages(groupId: string, waGroupId: string | null): Promise<ChatMessage[]> {
  const listenerUrl = import.meta.env.VITE_WA_LISTENER_URL
  if (!listenerUrl || !waGroupId) return []

  try {
    const res = await fetch(`${listenerUrl}/api/messages/${waGroupId}?limit=50`)
    if (!res.ok) return []
    return await res.json()
  } catch {
    return []
  }
}

/* ── Get the wa_group_id for API calls ─────────────────── */

async function fetchWaGroupId(groupId: string): Promise<string | null> {
  const { data } = await supabase
    .from('groups')
    .select('wa_group_id')
    .eq('id', groupId)
    .single()
  return data?.wa_group_id ?? null
}

/* ── Combined hook ──────────────────────────────────────── */

export function usePartnerGroupChat(groupId: string | undefined, demo = false) {
  // ── Demo mode: return static data immediately ──────────
  const demoResult = useMemo(() => ({
    group: DEMO_GROUP,
    members: DEMO_MEMBERS,
    messages: DEMO_MESSAGES,
    stats: DEMO_STATS,
    isLoading: false,
    isLoadingMessages: false,
  }), [])

  // Group info
  const groupQuery = useQuery({
    queryKey: ['partner', 'group-chat-info', groupId],
    queryFn: () => fetchGroupInfo(groupId!),
    enabled: !!groupId && !demo,
    refetchInterval: 30_000,
  })

  // WA Group ID (for message API)
  const waGroupIdQuery = useQuery({
    queryKey: ['partner', 'wa-group-id', groupId],
    queryFn: () => fetchWaGroupId(groupId!),
    enabled: !!groupId && !demo,
    staleTime: 60_000 * 5,
  })

  // Members with prospect enrichment
  const membersQuery = useQuery({
    queryKey: ['partner', 'group-chat-members', groupId],
    queryFn: () => fetchMembers(groupId!),
    enabled: !!groupId && !demo,
    refetchInterval: 30_000,
  })

  // Messages from wa-listener
  const messagesQuery = useQuery({
    queryKey: ['partner', 'group-chat-messages', groupId, waGroupIdQuery.data],
    queryFn: () => fetchMessages(groupId!, waGroupIdQuery.data!),
    enabled: !!groupId && !demo && !!waGroupIdQuery.data,
    refetchInterval: 10_000,
    staleTime: 8_000,
  })

  // Real-time invalidation on new pipeline events
  useEffect(() => {
    if (!groupId || demo) return
    const channel = supabase
      .channel(`partner-chat-${groupId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'pipeline_events',
        filter: `group_id=eq.${groupId}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['partner', 'group-chat-messages', groupId] })
        queryClient.invalidateQueries({ queryKey: ['partner', 'group-chat-members', groupId] })
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [groupId, demo])

  // Compute stats
  const stats = useMemo<GroupChatStats>(() => {
    if (demo) return DEMO_STATS
    const members = membersQuery.data ?? []
    return {
      subscribed: members.filter(m => m.prospectStage === 'subscribed').length,
      trial: members.filter(m => m.prospectStage === 'trial').length,
      interested: members.filter(m => m.prospectStage === 'interested').length,
      notReached: members.filter(m => m.prospectStage === 'not_reached').length,
    }
  }, [demo, membersQuery.data])

  // Enrich members with last message preview from messages
  const enrichedMembers = useMemo(() => {
    if (demo) return DEMO_MEMBERS
    const members = membersQuery.data ?? []
    const messages = messagesQuery.data ?? []

    const lastMsgMap = new Map<string, string>()
    for (const msg of messages) {
      if (msg.sender && msg.text && !lastMsgMap.has(msg.sender)) {
        lastMsgMap.set(msg.sender, msg.text.slice(0, 60))
      }
    }

    return members.map(m => ({
      ...m,
      lastMessagePreview: lastMsgMap.get(m.wa_sender_id) ?? m.lastMessagePreview,
    }))
  }, [demo, membersQuery.data, messagesQuery.data])

  if (demo) return demoResult

  return {
    group: groupQuery.data ?? null,
    members: enrichedMembers,
    messages: messagesQuery.data ?? [],
    stats,
    isLoading: groupQuery.isLoading || membersQuery.isLoading,
    isLoadingMessages: messagesQuery.isLoading,
  }
}
