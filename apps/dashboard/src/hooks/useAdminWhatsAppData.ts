import { useQuery } from '@tanstack/react-query'

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
}

export interface WAState {
  status: ConnectionStatus
  qr: string | null
  phone: string | null
  connectedSince: string | null
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Request failed: ${res.status}`)
  }
  return res.json() as Promise<T>
}

export function useAdminWhatsAppData(params: {
  listenerUrl: string
  enabled: boolean
  selectedGroupId: string | null
}) {
  const { listenerUrl, enabled, selectedGroupId } = params

  const statusQuery = useQuery({
    queryKey: ['admin', 'whatsapp', 'status', listenerUrl],
    enabled,
    queryFn: () => fetchJson<WAState>(`${listenerUrl}/api/status`),
    refetchInterval: 3_000,
    retry: false,
  })

  const connected = statusQuery.data?.status === 'connected'

  const accountsQuery = useQuery({
    queryKey: ['admin', 'whatsapp', 'accounts', listenerUrl],
    enabled: enabled, // Always fetch accounts to show Twilio status even if Green API is disconnected
    queryFn: () => fetchJson<WAAccount[]>(`${listenerUrl}/api/accounts`),
    refetchInterval: 30_000,
  })

  const groupsQuery = useQuery({
    queryKey: ['admin', 'whatsapp', 'groups', listenerUrl],
    enabled: enabled && connected,
    queryFn: () => fetchJson<WAGroup[]>(`${listenerUrl}/api/groups`),
    refetchInterval: 15_000,
  })

  const pipelineQuery = useQuery({
    queryKey: ['admin', 'whatsapp', 'pipeline', listenerUrl],
    enabled: enabled && connected,
    queryFn: () => fetchJson<PipelineEvent[]>(`${listenerUrl}/api/pipeline?limit=50`),
    refetchInterval: 15_000,
  })

  const messagesQuery = useQuery({
    queryKey: ['admin', 'whatsapp', 'messages', listenerUrl, selectedGroupId],
    enabled: enabled && connected && Boolean(selectedGroupId),
    queryFn: () => fetchJson<WAMessage[]>(`${listenerUrl}/api/messages/${selectedGroupId}?limit=50`),
    refetchInterval: 10_000,
  })

  return {
    connState: statusQuery.data ?? {
      status: 'disconnected' as ConnectionStatus,
      qr: null,
      phone: null,
      connectedSince: null,
    },
    groups: groupsQuery.data ?? [],
    accounts: accountsQuery.data ?? [],
    pipeline: pipelineQuery.data ?? [],
    messages: messagesQuery.data ?? [],
    isFetchingAny:
      statusQuery.isFetching ||
      accountsQuery.isFetching ||
      groupsQuery.isFetching ||
      pipelineQuery.isFetching ||
      messagesQuery.isFetching,
  }
}
