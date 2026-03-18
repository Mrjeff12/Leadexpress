import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export interface ProspectRecord {
  id: string
  wa_id: string
  phone: string
  display_name: string | null
  profile_pic_url: string | null
  profession_tags: string[]
  group_ids: string[]
  stage: string
  notes: string
  last_contact_at: string | null
  next_followup_at: string | null
  created_at: string
  updated_at: string
  group_names?: string[]
}

const PROSPECTS_QUERY_KEY = ['admin', 'prospects'] as const

async function fetchProspects(): Promise<ProspectRecord[]> {
  let all: ProspectRecord[] = []
  let from = 0
  const pageSize = 1000

  while (true) {
    const { data, error } = await supabase
      .from('prospect_with_groups')
      .select('*')
      .is('archived_at', null)
      .order('updated_at', { ascending: false })
      .range(from, from + pageSize - 1)

    if (error) throw error
    if (!data || data.length === 0) break

    all = all.concat(data as ProspectRecord[])
    if (data.length < pageSize) break
    from += pageSize
  }

  return all
}

export function useAdminProspectsData() {
  const queryClient = useQueryClient()

  const prospectsQuery = useQuery({
    queryKey: PROSPECTS_QUERY_KEY,
    queryFn: fetchProspects,
    refetchInterval: 20_000,
  })

  useEffect(() => {
    const channel = supabase
      .channel('prospects-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'prospects' }, () => {
        queryClient.invalidateQueries({ queryKey: PROSPECTS_QUERY_KEY })
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [queryClient])

  const changeStageMutation = useMutation({
    mutationFn: async ({ prospectId, newStage }: { prospectId: string; newStage: string }) => {
      const prospects = (queryClient.getQueryData(PROSPECTS_QUERY_KEY) as ProspectRecord[] | undefined) ?? []
      const prospect = prospects.find((p) => p.id === prospectId)
      if (!prospect || prospect.stage === newStage) return

      const oldStage = prospect.stage
      const nowIso = new Date().toISOString()

      queryClient.setQueryData(PROSPECTS_QUERY_KEY, prospects.map((p) => (
        p.id === prospectId ? { ...p, stage: newStage, updated_at: nowIso } : p
      )))

      const updateResult = await supabase
        .from('prospects')
        .update({ stage: newStage })
        .eq('id', prospectId)

      if (updateResult.error) throw updateResult.error

      const eventResult = await supabase.from('prospect_events').insert({
        prospect_id: prospectId,
        event_type: 'stage_change',
        old_value: oldStage,
        new_value: newStage,
      })

      if (eventResult.error) throw eventResult.error
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: PROSPECTS_QUERY_KEY })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROSPECTS_QUERY_KEY })
    },
  })

  const importFromGroupsMutation = useMutation({
    mutationFn: async () => {
      const { data: groups, error } = await supabase
        .from('groups')
        .select('id, wa_group_id, name')
        .eq('status', 'active')

      if (error) throw error
      if (!groups?.length) return 0

      const listenerUrl = import.meta.env.VITE_WA_LISTENER_URL || 'http://localhost:3001'
      let totalImported = 0

      for (const group of groups) {
        try {
          const res = await fetch(`${listenerUrl}/api/prospects/import`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              group_id: group.id,
              wa_group_id: group.wa_group_id,
            }),
          })

          if (!res.ok) continue

          const result = await res.json()
          totalImported += result.imported ?? 0
        } catch {
          // Best-effort import across groups.
        }
      }

      return totalImported
    },
    onSuccess: (importedCount) => {
      if ((importedCount ?? 0) > 0) {
        queryClient.invalidateQueries({ queryKey: PROSPECTS_QUERY_KEY })
      }
    },
  })

  return {
    prospects: prospectsQuery.data ?? [],
    isLoading: prospectsQuery.isLoading,
    isFetching: prospectsQuery.isFetching,
    changeStage: (prospectId: string, newStage: string) =>
      changeStageMutation.mutateAsync({ prospectId, newStage }),
    importFromGroups: () => importFromGroupsMutation.mutateAsync(),
    isImporting: importFromGroupsMutation.isPending,
  }
}
