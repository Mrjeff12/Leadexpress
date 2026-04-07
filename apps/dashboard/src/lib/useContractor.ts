import { useEffect, useState, createContext, useContext } from 'react'
import { supabase } from './supabase'
import { useAuth } from './auth'

export interface ContractorRow {
  user_id: string
  professions: string[] | null
  zip_codes: string[] | null
  wa_notify: boolean | null
  wa_window_until: string | null
}

interface ContractorCtx {
  contractor: ContractorRow | null
  loading: boolean
  refetch: () => void
}

export const ContractorContext = createContext<ContractorCtx>({
  contractor: null,
  loading: true,
  refetch: () => {},
})

export function useContractorData(): ContractorCtx {
  const { effectiveUserId } = useAuth()
  const [contractor, setContractor] = useState<ContractorRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!effectiveUserId) { setLoading(false); return }
    setLoading(true)
    supabase
      .from('contractors')
      .select('user_id, professions, zip_codes, wa_notify, wa_window_until')
      .eq('user_id', effectiveUserId)
      .maybeSingle()
      .then(({ data }) => {
        setContractor(data as ContractorRow | null)
        setLoading(false)
      })
  }, [effectiveUserId, tick])

  return { contractor, loading, refetch: () => setTick(t => t + 1) }
}

export function useContractor() {
  return useContext(ContractorContext)
}
