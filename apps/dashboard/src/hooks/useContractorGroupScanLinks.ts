import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'

export type GroupScanStatus = 'pending' | 'joined' | 'failed' | 'blocked_private' | 'archived'

export interface ContractorGroupScanLink {
  id: string
  invite_link_raw: string
  invite_link_normalized: string
  invite_code: string | null
  status: GroupScanStatus
  join_method: 'manual' | 'auto'
  group_name: string | null
  member_count: number | null
  created_at: string
  updated_at: string
}

export interface GroupScanLinksData {
  own: ContractorGroupScanLink[]
  admin: ContractorGroupScanLink[]
}

export function useContractorGroupScanLinks() {
  const { effectiveUserId } = useAuth()
  const [data, setData] = useState<GroupScanLinksData>({ own: [], admin: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchLinks = useCallback(async () => {
    if (!effectiveUserId) return
    try {
      setLoading(true)
      const { data: links, error: fetchError } = await supabase
        .from('contractor_group_scan_requests')
        .select('*')
        .eq('contractor_id', effectiveUserId)
        .order('created_at', { ascending: false })

      if (fetchError) throw fetchError
      setData({ own: (links ?? []) as ContractorGroupScanLink[], admin: [] })
      setError(null)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [effectiveUserId])

  useEffect(() => {
    fetchLinks()
    const interval = setInterval(fetchLinks, 30000)
    return () => clearInterval(interval)
  }, [fetchLinks])

  const addLink = async (inviteLink: string) => {
    if (!effectiveUserId) return { success: false, error: 'Not authenticated' }
    try {
      const code = inviteLink.match(/chat\.whatsapp\.com\/([A-Za-z0-9]+)/)?.[1] ?? null
      const { error: insertError } = await supabase
        .from('contractor_group_scan_requests')
        .insert({
          contractor_id: effectiveUserId,
          invite_link_raw: inviteLink,
          invite_link_normalized: code ? `https://chat.whatsapp.com/${code}` : inviteLink,
          invite_code: code,
          status: 'pending',
          join_method: 'manual',
        })

      if (insertError) throw insertError
      await fetchLinks()
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }

  return {
    data,
    loading,
    error,
    addLink,
    refresh: fetchLinks,
  }
}
