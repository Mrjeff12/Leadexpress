import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'

export interface PartnerCommission {
  id: string
  partner_id: string
  referral_id: string | null
  type: 'earning' | 'withdrawal' | 'credit' | 'refund_clawback'
  amount_cents: number
  status: string
  stripe_invoice_id: string | null
  stripe_payout_id: string | null
  note: string | null
  approved_at: string | null
  paid_at: string | null
  created_at: string
}

const PAGE_SIZE = 20

export function usePartnerCommissions(typeFilter?: string) {
  const { effectiveUserId } = useAuth()
  const [commissions, setCommissions] = useState<PartnerCommission[]>([])
  const [loading, setLoading] = useState(true)
  const [hasMore, setHasMore] = useState(false)
  const [page, setPage] = useState(0)

  const loadCommissions = useCallback(async (pageNum: number, append: boolean) => {
    if (!effectiveUserId) { setLoading(false); return }

    // Get partner id
    const { data: partner } = await supabase
      .from('community_partners')
      .select('id')
      .eq('user_id', effectiveUserId)
      .maybeSingle()

    if (!partner) { setLoading(false); return }

    let query = supabase
      .from('partner_commissions')
      .select('*')
      .eq('partner_id', partner.id)
      .order('created_at', { ascending: false })
      .range(pageNum * PAGE_SIZE, (pageNum + 1) * PAGE_SIZE - 1)

    if (typeFilter) {
      query = query.eq('type', typeFilter)
    }

    const { data, error } = await query

    if (error) {
      console.error('[usePartnerCommissions] error:', error)
      setLoading(false)
      return
    }

    const items = (data ?? []) as PartnerCommission[]

    if (append) {
      setCommissions(prev => [...prev, ...items])
    } else {
      setCommissions(items)
    }

    setHasMore(items.length === PAGE_SIZE)
    setLoading(false)
  }, [effectiveUserId, typeFilter])

  useEffect(() => {
    setPage(0)
    setCommissions([])
    setLoading(true)
    loadCommissions(0, false)
  }, [loadCommissions])

  const loadMore = useCallback(() => {
    const nextPage = page + 1
    setPage(nextPage)
    loadCommissions(nextPage, true)
  }, [page, loadCommissions])

  const refetch = useCallback(() => {
    setPage(0)
    setCommissions([])
    setLoading(true)
    loadCommissions(0, false)
  }, [loadCommissions])

  return {
    commissions,
    loading,
    hasMore,
    loadMore,
    refetch,
  }
}
