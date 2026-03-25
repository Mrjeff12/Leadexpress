import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'

/* ── Types ─────────────────────────────────────────────── */

export interface Broadcast {
  id: string
  publisher_id: string
  lead_id: string
  deal_type: 'percentage' | 'fixed' | 'subwork'
  deal_value: number
  description: string | null
  status: 'open' | 'assigned' | 'closed'
  chosen_contractor_id: string | null
  created_at: string
  updated_at: string
  // Joined from leads
  lead: {
    profession: string | null
    city: string | null
    zip_code: string | null
    parsed_summary: string | null
  } | null
}

export interface BroadcastResponse {
  id: string
  broadcast_id: string
  contractor_id: string
  message: string | null
  status: string
  created_at: string
  contractor_name: string | null
  contractor_phone: string | null
  avg_rating: number | null
  tier: string | null
}

export interface CreateBroadcastInput {
  lead_id: string
  deal_type: 'percentage' | 'fixed' | 'subwork'
  deal_value: number
  description?: string
}

/* ── useBroadcasts ─────────────────────────────────────── */

export function useBroadcasts() {
  const { effectiveUserId } = useAuth()
  const qc = useQueryClient()

  const query = useQuery({
    queryKey: ['broadcasts', effectiveUserId],
    enabled: !!effectiveUserId,
    queryFn: async (): Promise<Broadcast[]> => {
      if (!effectiveUserId) return []

      const { data, error } = await supabase
        .from('job_broadcasts')
        .select(`
          *,
          lead:leads!job_broadcasts_lead_id_fkey (
            profession,
            city,
            zip_code,
            parsed_summary
          )
        `)
        .eq('publisher_id', effectiveUserId)
        .order('created_at', { ascending: false })

      if (error) throw error
      return (data ?? []) as Broadcast[]
    },
  })

  const createBroadcastMutation = useMutation({
    mutationFn: async (input: CreateBroadcastInput) => {
      if (!effectiveUserId) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('job_broadcasts')
        .insert({
          publisher_id: effectiveUserId,
          lead_id: input.lead_id,
          deal_type: input.deal_type,
          deal_value: input.deal_value,
          description: input.description ?? null,
          status: 'open',
        })
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['broadcasts', effectiveUserId] })
    },
  })

  const getResponses = async (broadcastId: string): Promise<BroadcastResponse[]> => {
    const { data, error } = await supabase
      .rpc('get_broadcast_responses', { p_broadcast_id: broadcastId })

    if (error) throw error
    return (data ?? []) as BroadcastResponse[]
  }

  const chooseContractorMutation = useMutation({
    mutationFn: async ({ broadcastId, contractorId }: { broadcastId: string; contractorId: string }) => {
      const { data, error } = await supabase
        .rpc('choose_contractor_for_broadcast', {
          p_broadcast_id: broadcastId,
          p_contractor_id: contractorId,
        })

      if (error) throw error
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['broadcasts', effectiveUserId] })
    },
  })

  const closeBroadcastMutation = useMutation({
    mutationFn: async (broadcastId: string) => {
      const { error } = await supabase
        .from('job_broadcasts')
        .update({ status: 'closed' })
        .eq('id', broadcastId)

      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['broadcasts', effectiveUserId] })
    },
  })

  return {
    broadcasts: query.data ?? [],
    loading: query.isLoading,
    createBroadcast: createBroadcastMutation.mutateAsync,
    getResponses,
    chooseContractor: (broadcastId: string, contractorId: string) =>
      chooseContractorMutation.mutateAsync({ broadcastId, contractorId }),
    closeBroadcast: closeBroadcastMutation.mutateAsync,
    refetch: query.refetch,
  }
}

/* ── useContractorInvites ──────────────────────────────── */

interface SendInviteInput {
  phone: string
  name: string
  broadcast_id?: string
}

/**
 * Normalize a phone number to E.164 format.
 * - Israeli local (0XX...) -> +972XX...
 * - US 10-digit          -> +1XXXXXXXXXX
 * - Already has +        -> keep as-is
 */
function normalizePhone(raw: string): string {
  const digits = raw.replace(/[\s\-().]/g, '')

  // Already E.164
  if (digits.startsWith('+')) return digits

  // Israeli local: 05X, 07X, 02, 03, 04, 08, 09 etc.
  if (digits.startsWith('0') && digits.length >= 9 && digits.length <= 10) {
    return '+972' + digits.slice(1)
  }

  // US 10-digit
  if (digits.length === 10 && !digits.startsWith('0')) {
    return '+1' + digits
  }

  // Fallback: return with + prefix if missing
  return digits.startsWith('+') ? digits : '+' + digits
}

export function useContractorInvites() {
  const { effectiveUserId } = useAuth()

  const sendInviteMutation = useMutation({
    mutationFn: async (input: SendInviteInput) => {
      if (!effectiveUserId) throw new Error('Not authenticated')

      const phone = normalizePhone(input.phone)

      const { data, error } = await supabase
        .from('contractor_invites')
        .insert({
          invited_by: effectiveUserId,
          phone,
          name: input.name,
          broadcast_id: input.broadcast_id ?? null,
        })
        .select()
        .single()

      if (error) throw error
      return data
    },
  })

  return {
    sendInvite: sendInviteMutation.mutateAsync,
  }
}
