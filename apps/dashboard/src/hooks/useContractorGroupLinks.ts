import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'

export interface GroupLink {
  id: string
  invite_link: string
  group_name: string | null
  status: 'pending' | 'joined' | 'failed' | 'left'
  created_at: string
}

export function useContractorGroupLinks() {
  const { effectiveUserId } = useAuth()
  const [links, setLinks] = useState<GroupLink[]>([])
  const [loading, setLoading] = useState(true)

  const fetchLinks = useCallback(async () => {
    if (!effectiveUserId) return
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('contractor_group_links')
        .select('id, invite_link, group_name, status, created_at')
        .eq('contractor_id', effectiveUserId)
        .order('created_at', { ascending: false })

      if (error) throw error
      setLinks(data ?? [])
    } catch (err) {
      console.error('Failed to fetch group links:', err)
    } finally {
      setLoading(false)
    }
  }, [effectiveUserId])

  useEffect(() => {
    fetchLinks()
  }, [fetchLinks])

  const addLink = useCallback(async (inviteLink: string) => {
    if (!effectiveUserId) return
    const { error } = await supabase
      .from('contractor_group_links')
      .insert({ contractor_id: effectiveUserId, invite_link: inviteLink })

    if (error) throw error

    // Award network points
    try {
      await supabase.rpc('award_network_points', {
        p_user_id: effectiveUserId,
        p_action: 'add_group',
        p_points: 10,
        p_metadata: { invite_link: inviteLink },
      })
    } catch (err) {
      // Non-critical — don't block the flow
      console.warn('Could not award network points:', err)
    }

    await fetchLinks()
  }, [effectiveUserId, fetchLinks])

  const removeLink = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('contractor_group_links')
      .delete()
      .eq('id', id)

    if (error) throw error
    await fetchLinks()
  }, [fetchLinks])

  return { links, loading, addLink, removeLink }
}
