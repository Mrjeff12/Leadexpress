import { useState, useEffect } from 'react'
import { useAuth } from '../lib/auth'
import type { GroupScanStatus } from './useContractorGroupScanLinks'

export interface AdminGroupScanEntry {
  id: string
  contractor_id: string | null
  invite_link_raw: string
  invite_link_normalized: string
  invite_code: string | null
  source: 'contractor' | 'admin'
  status: GroupScanStatus
  join_method: 'manual' | 'auto'
  group_name: string | null
  member_count: number | null
  last_error: string | null
  created_at: string
  updated_at: string
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

export function useAdminGroupScanData() {
  const { session } = useAuth()
  const [data, setData] = useState<AdminGroupScanEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchBoard = async () => {
    if (!session?.access_token) return
    try {
      setLoading(true)
      const res = await fetch(`${API_URL}/api/group-scan/admin-board`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })
      if (!res.ok) throw new Error('Failed to fetch admin board')
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
    fetchBoard()
    const interval = setInterval(fetchBoard, 30000)
    return () => clearInterval(interval)
  }, [session])

  const addAdminLink = async (inviteLink: string, groupName?: string, memberCount?: number) => {
    if (!session?.user?.id || !session.access_token) return { success: false, error: 'Not authenticated' }
    try {
      const res = await fetch(`${API_URL}/api/group-scan/admin-links`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          invite_link: inviteLink,
          admin_id: session.user.id,
          group_name: groupName,
          member_count: memberCount,
        }),
      })

      if (!res.ok) {
        const errData = await res.json()
        return { success: false, error: errData.error || 'Failed to add link' }
      }

      await fetchBoard()
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }

  const updateStatus = async (id: string, source: 'contractor' | 'admin', status: GroupScanStatus, lastError?: string) => {
    if (!session?.user?.id || !session.access_token) return { success: false, error: 'Not authenticated' }
    try {
      const res = await fetch(`${API_URL}/api/group-scan/${id}/status`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          status,
          source,
          updated_by: session.user.id,
          last_error: lastError,
        }),
      })

      if (!res.ok) {
        const errData = await res.json()
        return { success: false, error: errData.error || 'Failed to update status' }
      }

      await fetchBoard()
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }

  return {
    data,
    loading,
    error,
    addAdminLink,
    updateStatus,
    refresh: fetchBoard,
  }
}
