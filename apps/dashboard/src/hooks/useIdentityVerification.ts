import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'

export type VerificationStatus =
  | 'none'
  | 'pending'
  | 'processing'
  | 'verified'
  | 'requires_input'
  | 'canceled'
  | 'failed'

export interface VerificationData {
  id: string
  status: VerificationStatus
  first_name: string | null
  last_name: string | null
  dob: string | null
  document_type: string | null
  issuing_country: string | null
  error_code: string | null
  error_reason: string | null
  verified_at: string | null
  created_at: string
}

export function useIdentityVerification() {
  const { effectiveUserId } = useAuth()

  const [verification, setVerification] = useState<VerificationData | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)

  const loadVerification = useCallback(async () => {
    if (!effectiveUserId) {
      setLoading(false)
      return
    }

    const { data } = await supabase
      .from('identity_verifications')
      .select('*')
      .eq('user_id', effectiveUserId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    setVerification(data as VerificationData | null)
    setLoading(false)
  }, [effectiveUserId])

  useEffect(() => {
    loadVerification()
  }, [loadVerification])

  const startVerification = useCallback(async () => {
    setActionLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('create-verification-session')
      if (error) throw error
      if (data?.url) {
        window.location.href = data.url
      }
      return data
    } finally {
      setActionLoading(false)
    }
  }, [])

  const status: VerificationStatus = verification?.status ?? 'none'
  const isVerified = status === 'verified'
  const isPending = status === 'pending' || status === 'processing'
  const needsRetry = status === 'requires_input' || status === 'failed' || status === 'canceled'

  return {
    verification,
    loading,
    actionLoading,
    status,
    isVerified,
    isPending,
    needsRetry,
    startVerification,
    refetch: loadVerification,
  }
}
