import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import type { ProfessionId } from '../lib/professions'
import { DEFAULT_WORKING_HOURS, type WorkingHours } from '../lib/working-hours'
import { useUserSubscription } from './useUserSubscription'

interface PlanLimits {
  maxProfessions: number
  maxZipCodes: number
  maxCounties: number
}

interface UseContractorSettingsReturn {
  professions: ProfessionId[]
  zipCodes: string[]
  workingHours: WorkingHours
  loading: boolean
  saving: boolean
  saved: boolean
  planLimits: PlanLimits
  toggleProfession: (id: ProfessionId) => void
  addZipCode: (zip: string) => boolean
  addZipCodes: (zips: string[]) => void
  removeZipCode: (zip: string) => void
  removeZipCodes: (zips: string[]) => void
  setWorkingHours: React.Dispatch<React.SetStateAction<WorkingHours>>
  save: () => Promise<void>
}

const DEFAULT_LIMITS: PlanLimits = { maxProfessions: 3, maxZipCodes: -1, maxCounties: 1 }

export function useContractorSettings(): UseContractorSettingsReturn {
  const { effectiveUserId } = useAuth()
  const {
    maxProfessions: subMaxProfessions,
    maxZipCodes: subMaxZipCodes,
    maxCounties: subMaxCounties,
    loading: subLoading,
  } = useUserSubscription()

  const [professions, setProfessions] = useState<ProfessionId[]>([])
  const [zipCodes, setZipCodes] = useState<string[]>([])
  const [workingHours, setWorkingHours] = useState<WorkingHours>(DEFAULT_WORKING_HOURS)
  const [contractorLoading, setContractorLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Derive plan limits from the unified subscription hook
  const planLimits: PlanLimits = subLoading
    ? DEFAULT_LIMITS
    : {
        maxProfessions: subMaxProfessions,
        maxZipCodes: subMaxZipCodes,
        maxCounties: subMaxCounties,
      }

  useEffect(() => {
    if (!effectiveUserId) return
    setContractorLoading(true)

    supabase
      .from('contractors')
      .select('professions, zip_codes, working_days, working_hours')
      .eq('user_id', effectiveUserId)
      .maybeSingle()
      .then((contRes) => {
        if (contRes.data) {
          setProfessions((contRes.data.professions as ProfessionId[]) ?? [])
          setZipCodes((contRes.data.zip_codes as string[]) ?? [])
          if (contRes.data.working_hours) {
            setWorkingHours(contRes.data.working_hours as WorkingHours)
          }
        }
        setContractorLoading(false)
      })
  }, [effectiveUserId])

  const toggleProfession = useCallback((id: ProfessionId) => {
    setProfessions((prev) => {
      if (prev.includes(id)) return prev.filter((p) => p !== id)
      // Enforce plan limit
      if (planLimits.maxProfessions > 0 && prev.length >= planLimits.maxProfessions) return prev
      return [...prev, id]
    })
    setSaved(false)
  }, [planLimits.maxProfessions])

  const addZipCode = useCallback((zip: string): boolean => {
    const cleaned = zip.trim().replace(/\D/g, '')
    if (!cleaned) return false
    let added = false
    setZipCodes((prev) => {
      if (prev.includes(cleaned)) return prev
      if (planLimits.maxZipCodes > 0 && prev.length >= planLimits.maxZipCodes) return prev
      added = true
      return [...prev, cleaned]
    })
    if (added) setSaved(false)
    return added
  }, [planLimits.maxZipCodes])

  const addZipCodes = useCallback((zips: string[]): void => {
    setZipCodes((prev) => {
      const newZips = zips
        .map((z) => z.trim().replace(/\D/g, ''))
        .filter((z) => z && !prev.includes(z))
      if (newZips.length === 0) return prev
      // Enforce plan limit
      if (planLimits.maxZipCodes > 0) {
        const remaining = planLimits.maxZipCodes - prev.length
        if (remaining <= 0) return prev
        return [...prev, ...newZips.slice(0, remaining)]
      }
      return [...prev, ...newZips]
    })
    setSaved(false)
  }, [planLimits.maxZipCodes])

  const removeZipCode = useCallback((zip: string) => {
    setZipCodes((prev) => prev.filter((z) => z !== zip))
    setSaved(false)
  }, [])

  const removeZipCodes = useCallback((zips: string[]) => {
    const set = new Set(zips)
    setZipCodes((prev) => prev.filter((z) => !set.has(z)))
    setSaved(false)
  }, [])

  const save = useCallback(async () => {
    if (!effectiveUserId) return
    setSaving(true)
    setSaved(false)

    // Server-side enforcement: truncate arrays to plan limits before saving
    // This prevents API-level bypass of client-side limits
    const safeProfessions = planLimits.maxProfessions > 0
      ? professions.slice(0, planLimits.maxProfessions)
      : professions
    const safeZipCodes = planLimits.maxZipCodes > 0
      ? zipCodes.slice(0, planLimits.maxZipCodes)
      : zipCodes

    const dayIndexMap = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 } as const
    const workingDays = Object.entries(workingHours)
      .filter(([, v]) => v.enabled)
      .map(([k]) => dayIndexMap[k as keyof typeof dayIndexMap])

    const { error } = await supabase
      .from('contractors')
      .upsert({
        user_id: effectiveUserId,
        professions: safeProfessions,
        zip_codes: safeZipCodes,
        working_days: workingDays,
        working_hours: workingHours,
        updated_at: new Date().toISOString(),
      })

    if (!error) {
      // Sync local state with what was actually saved
      if (safeProfessions.length !== professions.length) {
        setProfessions(safeProfessions)
      }
      if (safeZipCodes.length !== zipCodes.length) {
        setZipCodes(safeZipCodes)
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    }

    setSaving(false)
  }, [effectiveUserId, professions, zipCodes, workingHours, planLimits])

  const loading = contractorLoading || subLoading

  return {
    professions, zipCodes, workingHours,
    loading, saving, saved, planLimits,
    toggleProfession, addZipCode, addZipCodes, removeZipCode, removeZipCodes,
    setWorkingHours, save,
  }
}
