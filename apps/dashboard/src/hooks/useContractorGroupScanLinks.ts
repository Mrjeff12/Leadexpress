import { useState, useEffect } from 'react'
import { useAuth } from '../lib/auth'

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

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

export function useContractorGroupScanLinks() {
  const { effectiveUserId, session } = useAuth()
  const [data, setData] = useState<GroupScanLinksData>({ own: [], admin: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchLinks = async () => {
    if (!effectiveUserId || !session?.access_token) return
    try {
      setLoading(true)
      const res = await fetch(`${API_URL}/api/group-scan/contractor-links?contractor_id=${effectiveUserId}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })
      if (!res.ok) throw new Error('Failed to fetch links')
      const json = await res.json()
      setData(json)
      setError(null)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLinks()
    
    // Poll every 30 seconds to get status updates
    const interval = setInterval(fetchLinks, 30000)
    return () => clearInterval(interval)
  }, [effectiveUserId])

  const addLink = async (inviteLink: string) => {
    if (!effectiveUserId || !session?.access_token) return { success: false, error: 'Not authenticated' }
    try {
      const res = await fetch(`${API_URL}/api/group-scan/contractor-links`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          invite_link: inviteLink,
          contractor_id: effectiveUserId,
        }),
      })

      if (!res.ok) {
        const errData = await res.json()
        return { success: false, error: errData.error || 'Failed to add link' }
      }

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
