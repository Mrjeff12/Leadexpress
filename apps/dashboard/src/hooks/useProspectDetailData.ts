import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export interface Prospect {
  id: string
  wa_id: string
  phone: string
  display_name: string | null
  profile_pic_url: string | null
  profession_tags: string[]
  group_ids: string[]
  stage: string
  assigned_wa_account_id: string | null
  notes: string
  last_contact_at: string | null
  next_followup_at: string | null
  created_at: string
  updated_at: string
  group_names?: string[]
}

export interface Message {
  id: string
  prospect_id: string
  wa_account_id: string | null
  direction: 'outgoing' | 'incoming'
  message_type: string
  content: string
  wa_message_id: string | null
  sent_at: string
  delivered_at: string | null
  read_at: string | null
  channel?: 'green_api' | 'twilio' | 'system'
}

export interface ProspectEvent {
  id: string
  event_type: string
  old_value: string | null
  new_value: string | null
  detail: Record<string, unknown>
  created_at: string
}

export interface ProspectListItem {
  id: string
  phone: string
  display_name: string | null
  stage: string
  profession_tags: string[]
  updated_at: string
  last_contact_at: string | null
  profile_pic_url: string | null
  group_names?: string[]
}

const prospectListKey = ['admin', 'prospects', 'list'] as const
const detailKey = (id: string) => ['admin', 'prospects', 'detail', id] as const
const messagesKey = (id: string) => ['admin', 'prospects', 'messages', id] as const
const eventsKey = (id: string) => ['admin', 'prospects', 'events', id] as const

async function fetchProspectList(): Promise<ProspectListItem[]> {
  const pages: ProspectListItem[] = []
  let from = 0
  const size = 500

  while (true) {
    const { data, error } = await supabase
      .from('prospect_with_groups')
      .select('id,phone,display_name,stage,profession_tags,updated_at,last_contact_at,profile_pic_url,group_names')
      .is('archived_at', null)
      .order('updated_at', { ascending: false })
      .range(from, from + size - 1)

    if (error) throw error
    if (!data || data.length === 0) break

    pages.push(...(data as ProspectListItem[]))

    if (data.length < size) break
    from += size
  }

  return Array.from(new Map(pages.map((p) => [p.id, p])).values())
}

export function useProspectDetailData(id: string | undefined) {
  const queryClient = useQueryClient()

  const listQuery = useQuery({
    queryKey: prospectListKey,
    queryFn: fetchProspectList,
    refetchInterval: 30_000,
  })

  const prospectQuery = useQuery({
    queryKey: detailKey(id ?? ''),
    enabled: Boolean(id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('prospect_with_groups')
        .select('*')
        .eq('id', id)
        .single()
      if (error) throw error
      return data as Prospect
    },
  })

  const messagesQuery = useQuery({
    queryKey: messagesKey(id ?? ''),
    enabled: Boolean(id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('prospect_messages')
        .select('*')
        .eq('prospect_id', id)
        .order('sent_at', { ascending: true })
      if (error) throw error
      return (data ?? []) as Message[]
    },
    refetchInterval: 10_000,
  })

  const eventsQuery = useQuery({
    queryKey: eventsKey(id ?? ''),
    enabled: Boolean(id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('prospect_events')
        .select('*')
        .eq('prospect_id', id)
        .order('created_at', { ascending: true })
        .limit(100)
      if (error) throw error
      return (data ?? []) as ProspectEvent[]
    },
    refetchInterval: 15_000,
  })

  useEffect(() => {
    if (!id) return

    const messageChannel = supabase
      .channel(`pm-${id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'prospect_messages', filter: `prospect_id=eq.${id}` },
        () => {
          queryClient.invalidateQueries({ queryKey: messagesKey(id) })
        },
      )
      .subscribe()

    const prospectChannel = supabase
      .channel(`p-${id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'prospects', filter: `id=eq.${id}` },
        () => {
          queryClient.invalidateQueries({ queryKey: detailKey(id) })
          queryClient.invalidateQueries({ queryKey: prospectListKey })
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(messageChannel)
      supabase.removeChannel(prospectChannel)
    }
  }, [id, queryClient])

  return {
    prospectList: listQuery.data ?? [],
    prospect: prospectQuery.data ?? null,
    messages: messagesQuery.data ?? [],
    events: eventsQuery.data ?? [],
    isListLoading: listQuery.isLoading,
    isDetailLoading: prospectQuery.isLoading || messagesQuery.isLoading || eventsQuery.isLoading,
    refetchDetail: () => Promise.all([prospectQuery.refetch(), messagesQuery.refetch(), eventsQuery.refetch()]),
  }
}
