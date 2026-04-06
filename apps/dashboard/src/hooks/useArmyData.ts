import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

/* ─── Types ─── */

export interface ArmyAccount {
  id: string
  green_api_id: string
  green_api_token: string
  green_api_url: string
  phone_number: string | null
  status: string
  qr_code: string | null
  is_army: boolean
  army_role: 'publisher' | 'responder' | 'contractor' | null
  army_alias: string | null
  connected_since: string | null
}

export interface ArmyAssignment {
  id: string
  wa_account_id: string
  group_wa_id: string
  group_name: string | null
  role_in_group: 'publisher' | 'responder' | 'contractor'
  is_active: boolean
}

export interface ArmyTemplate {
  id: string
  category: 'job_post' | 'response' | 'contractor_promo'
  name: string
  body: string
  placeholders: string[]
  is_active: boolean
  created_at: string
}

export interface ArmyScheduleEntry {
  id: string
  group_wa_id: string
  wa_account_id: string
  template_id: string | null
  message_type: string
  scheduled_at: string
  sent_at: string | null
  status: 'pending' | 'sent' | 'failed'
  rendered_message: string | null
  error: string | null
  created_at: string
}

export interface ArmyConfig {
  enabled: boolean
  activity_window_start: string
  activity_window_end: string
  response_delay_min: number
  response_delay_max: number
}

/* ─── useArmyAccounts ─── */

export function useArmyAccounts() {
  const [accounts, setAccounts] = useState<ArmyAccount[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('wa_accounts')
      .select('*')
      .eq('is_army', true)
      .order('created_at', { ascending: true })
    setAccounts((data as ArmyAccount[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { fetch() }, [fetch])

  return { accounts, loading, refetch: fetch }
}

/* ─── useArmyAssignments ─── */

export function useArmyAssignments() {
  const [assignments, setAssignments] = useState<ArmyAssignment[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('army_assignments')
      .select('*')
      .order('group_name', { ascending: true })
    setAssignments((data as ArmyAssignment[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { fetch() }, [fetch])

  return { assignments, loading, refetch: fetch }
}

/* ─── useArmyTemplates ─── */

export function useArmyTemplates(category?: string) {
  const [templates, setTemplates] = useState<ArmyTemplate[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    setLoading(true)
    let q = supabase.from('army_templates').select('*').order('created_at', { ascending: false })
    if (category) q = q.eq('category', category)
    const { data } = await q
    setTemplates((data as ArmyTemplate[]) ?? [])
    setLoading(false)
  }, [category])

  useEffect(() => { fetch() }, [fetch])

  return { templates, loading, refetch: fetch }
}

/* ─── useArmyActivity ─── */

export function useArmyActivity(limit = 50) {
  const [entries, setEntries] = useState<ArmyScheduleEntry[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('army_schedule')
      .select('*')
      .order('scheduled_at', { ascending: false })
      .limit(limit)
    setEntries((data as ArmyScheduleEntry[]) ?? [])
    setLoading(false)
  }, [limit])

  useEffect(() => { fetch() }, [fetch])

  return { entries, loading, refetch: fetch }
}

/* ─── useArmyConfig ─── */

export function useArmyConfig() {
  const [config, setConfig] = useState<ArmyConfig>({
    enabled: true,
    activity_window_start: '07:00',
    activity_window_end: '21:00',
    response_delay_min: 5,
    response_delay_max: 30,
  })
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('army_config').select('key, value')
    if (data) {
      const map = Object.fromEntries(data.map(r => [r.key, r.value]))
      setConfig({
        enabled: map.enabled !== 'false',
        activity_window_start: map.activity_window_start ?? '07:00',
        activity_window_end: map.activity_window_end ?? '21:00',
        response_delay_min: parseInt(map.response_delay_min ?? '5', 10),
        response_delay_max: parseInt(map.response_delay_max ?? '30', 10),
      })
    }
    setLoading(false)
  }, [])

  const update = useCallback(async (key: string, value: string) => {
    await supabase.from('army_config').upsert({ key, value }, { onConflict: 'key' })
    await fetch()
  }, [fetch])

  useEffect(() => { fetch() }, [fetch])

  return { config, loading, update, refetch: fetch }
}

/* ─── DM Types ─── */

export interface ArmyDM {
  id: string
  wa_account_id: string
  sender_phone: string
  sender_name: string | null
  direction: 'incoming' | 'outgoing'
  content: string
  wa_message_id: string | null
  sent_at: string
  read: boolean
}

export interface DMConversation {
  sender_phone: string
  sender_name: string | null
  last_message: string
  last_message_at: string
  unread_count: number
}

/* ─── useArmyDMConversations ─── */

export function useArmyDMConversations(accountId: string | null) {
  const [conversations, setConversations] = useState<DMConversation[]>([])
  const [loading, setLoading] = useState(false)

  const fetch = useCallback(async () => {
    if (!accountId) { setConversations([]); return }
    setLoading(true)
    const { data } = await supabase
      .from('army_dms')
      .select('*')
      .eq('wa_account_id', accountId)
      .order('sent_at', { ascending: false })

    if (data) {
      const byPhone = new Map<string, { msgs: ArmyDM[] }>()
      for (const m of data as ArmyDM[]) {
        if (!byPhone.has(m.sender_phone)) byPhone.set(m.sender_phone, { msgs: [] })
        byPhone.get(m.sender_phone)!.msgs.push(m)
      }
      const convos: DMConversation[] = [...byPhone.entries()].map(([phone, { msgs }]) => ({
        sender_phone: phone,
        sender_name: msgs.find(m => m.sender_name)?.sender_name ?? null,
        last_message: msgs[0].content,
        last_message_at: msgs[0].sent_at,
        unread_count: msgs.filter(m => !m.read && m.direction === 'incoming').length,
      }))
      convos.sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime())
      setConversations(convos)
    }
    setLoading(false)
  }, [accountId])

  useEffect(() => { fetch() }, [fetch])

  return { conversations, loading, refetch: fetch }
}

/* ─── useArmyDMChat ─── */

export function useArmyDMChat(accountId: string | null, senderPhone: string | null) {
  const [messages, setMessages] = useState<ArmyDM[]>([])
  const [loading, setLoading] = useState(false)

  const fetch = useCallback(async () => {
    if (!accountId || !senderPhone) { setMessages([]); return }
    setLoading(true)
    const { data } = await supabase
      .from('army_dms')
      .select('*')
      .eq('wa_account_id', accountId)
      .eq('sender_phone', senderPhone)
      .order('sent_at', { ascending: true })
    setMessages((data as ArmyDM[]) ?? [])
    // Mark as read
    await supabase
      .from('army_dms')
      .update({ read: true })
      .eq('wa_account_id', accountId)
      .eq('sender_phone', senderPhone)
      .eq('read', false)
    setLoading(false)
  }, [accountId, senderPhone])

  useEffect(() => { fetch() }, [fetch])

  return { messages, loading, refetch: fetch }
}

/* ─── useArmyUnreadCounts ─── */

export function useArmyUnreadCounts() {
  const [counts, setCounts] = useState<Record<string, number>>({})

  const fetch = useCallback(async () => {
    const { data } = await supabase
      .from('army_dms')
      .select('wa_account_id')
      .eq('read', false)
      .eq('direction', 'incoming')
    if (data) {
      const map: Record<string, number> = {}
      for (const r of data) {
        map[r.wa_account_id] = (map[r.wa_account_id] || 0) + 1
      }
      setCounts(map)
    }
  }, [])

  useEffect(() => { fetch() }, [fetch])

  return { counts, refetch: fetch }
}
