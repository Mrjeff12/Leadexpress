import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { supabase } from '../lib/supabase'

type ConnectionStatus = 'disconnected' | 'waiting_qr' | 'connecting' | 'connected' | 'blocked'

export interface WAGroup {
  id: string
  name: string
  messageCount: number
  isActive: boolean
  lastMessageAt?: string
  totalMembers?: number
  knownSellers?: number
  knownBuyers?: number
  category?: string
}

export interface WAMessage {
  id: string
  sender: string
  senderName: string
  text: string
  timestamp: number
  isLead?: boolean
  pipelineStage?: string
  senderClassification?: 'unknown' | 'seller' | 'buyer' | 'bot' | 'admin'
}

export interface PipelineEvent {
  id: string
  groupName?: string
  senderName?: string
  stage: string
  detail?: Record<string, unknown>
  messagePreview?: string
  createdAt: string
}

export interface WAAccount {
  id: string
  label: string
  region: string
  phone: string | null
  status: ConnectionStatus
  groupCount: number
  leadsToday: number
  messagesTotal: number
  qr: string | null
  connectedSince: string | null
  displayName: string | null
  avatarUrl: string | null
}

export interface WAState {
  status: ConnectionStatus
  qr: string | null
  phone: string | null
  connectedSince: string | null
}

const DISCONNECTED: WAState = { status: 'disconnected', qr: null, phone: null, connectedSince: null }

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Request failed: ${res.status}`)
  return res.json() as Promise<T>
}

// ── Supabase: single combined query for accounts + groups ───────────────────

interface SupabaseSnapshot {
  state: WAState
  accounts: WAAccount[]
  groups: WAGroup[]
}

async function fetchSnapshotFromSupabase(): Promise<SupabaseSnapshot> {
  // 1. Accounts
  const { data: rawAccounts } = await supabase
    .from('wa_accounts')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: true })

  if (!rawAccounts || rawAccounts.length === 0) {
    return { state: DISCONNECTED, accounts: [], groups: [] }
  }

  // 2. Groups (single query)
  const { data: rawGroups } = await supabase
    .from('groups')
    .select('id, name, wa_group_id, status, message_count, last_message_at, wa_account_id, category')
    .not('wa_account_id', 'is', null)
    .order('message_count', { ascending: false })

  // 3. Leads today count (single query)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const { count: leadsToday } = await supabase
    .from('leads')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', today.toISOString())

  // Build account objects with group counts
  const groupsByAccount = new Map<string, number>()
  for (const g of rawGroups ?? []) {
    groupsByAccount.set(g.wa_account_id, (groupsByAccount.get(g.wa_account_id) ?? 0) + 1)
  }

  const accounts: WAAccount[] = rawAccounts.map((acc: any) => ({
    id: acc.id,
    label: acc.label,
    region: acc.region,
    phone: acc.phone_number,
    status: acc.status as ConnectionStatus,
    groupCount: groupsByAccount.get(acc.id) ?? 0,
    leadsToday: leadsToday ?? 0,
    messagesTotal: 0,
    qr: acc.qr_code ?? null,
    connectedSince: acc.connected_since,
    displayName: acc.display_name ?? null,
    avatarUrl: acc.avatar_url ?? null,
  }))

  const groups: WAGroup[] = (rawGroups ?? []).map((g: any) => ({
    id: g.id,
    name: g.name,
    messageCount: g.message_count ?? 0,
    isActive: g.status === 'active',
    lastMessageAt: g.last_message_at,
    category: g.category,
  }))

  const primary = rawAccounts[0]
  const state: WAState = {
    status: primary.status as ConnectionStatus,
    qr: primary.qr_code ?? null,
    phone: primary.phone_number ?? null,
    connectedSince: primary.connected_since ?? null,
  }

  return { state, accounts, groups }
}

// ═════════════════════════════════════════════════════════════════════════════

export function useAdminWhatsAppData(params: {
  listenerUrl: string
  enabled: boolean
  selectedGroupId: string | null
}) {
  const { listenerUrl, enabled, selectedGroupId } = params
  const hasListenerUrl = Boolean(listenerUrl)

  // ── Primary: wa-listener API (when available) ─────────────────────────────
  const statusQueryApi = useQuery({
    queryKey: ['wa', 'status', listenerUrl],
    enabled: enabled && hasListenerUrl,
    queryFn: () => fetchJson<WAState>(`${listenerUrl}/api/status`),
    refetchInterval: 5_000,
    staleTime: 4_000,
    retry: false,
  })

  const connected = statusQueryApi.data?.status === 'connected'

  const accountsQueryApi = useQuery({
    queryKey: ['wa', 'accounts', listenerUrl],
    enabled: enabled && hasListenerUrl,
    queryFn: () => fetchJson<WAAccount[]>(`${listenerUrl}/api/accounts`),
    refetchInterval: 60_000,
    staleTime: 55_000,
  })

  const groupsQueryApi = useQuery({
    queryKey: ['wa', 'groups', listenerUrl],
    enabled: enabled && hasListenerUrl && connected,
    queryFn: () => fetchJson<WAGroup[]>(`${listenerUrl}/api/groups`),
    refetchInterval: 30_000,
    staleTime: 25_000,
  })

  const pipelineQueryApi = useQuery({
    queryKey: ['wa', 'pipeline', listenerUrl],
    enabled: enabled && hasListenerUrl && connected,
    queryFn: () => fetchJson<PipelineEvent[]>(`${listenerUrl}/api/pipeline?limit=50`),
    refetchInterval: 15_000,
    staleTime: 10_000,
  })

  const messagesQueryApi = useQuery({
    queryKey: ['wa', 'messages', listenerUrl, selectedGroupId],
    enabled: enabled && hasListenerUrl && connected && Boolean(selectedGroupId),
    queryFn: () => fetchJson<WAMessage[]>(`${listenerUrl}/api/messages/${selectedGroupId}?limit=50`),
    refetchInterval: 10_000,
    staleTime: 8_000,
  })

  // ── Fallback: Supabase snapshot (single query, infrequent) ────────────────
  const apiUnavailable = !hasListenerUrl || statusQueryApi.isError

  const snapshotQuery = useQuery({
    queryKey: ['wa', 'supabase-snapshot'],
    enabled: enabled && apiUnavailable,
    queryFn: fetchSnapshotFromSupabase,
    refetchInterval: 60_000,  // once per minute — data barely changes
    staleTime: 55_000,        // consider fresh for 55s
  })

  // ── Stable merged result ──────────────────────────────────────────────────
  const source = apiUnavailable ? 'supabase' as const : 'api' as const

  const connState = useMemo(() => {
    if (source === 'supabase') return snapshotQuery.data?.state ?? DISCONNECTED
    return statusQueryApi.data ?? DISCONNECTED
  }, [source, snapshotQuery.data?.state, statusQueryApi.data])

  const accounts = useMemo(() => {
    if (source === 'supabase') return snapshotQuery.data?.accounts ?? []
    return accountsQueryApi.data ?? []
  }, [source, snapshotQuery.data?.accounts, accountsQueryApi.data])

  const groups = useMemo(() => {
    if (source === 'supabase') return snapshotQuery.data?.groups ?? []
    return groupsQueryApi.data ?? []
  }, [source, snapshotQuery.data?.groups, groupsQueryApi.data])

  return {
    connState,
    groups,
    accounts,
    pipeline: pipelineQueryApi.data ?? [],
    messages: messagesQueryApi.data ?? [],
    isFetchingAny: snapshotQuery.isFetching || statusQueryApi.isFetching,
    source,
  }
}
