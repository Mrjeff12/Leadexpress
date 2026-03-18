import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import type { ProfessionId } from '../lib/professions'
import { DEFAULT_WORKING_HOURS, type WorkingHours } from '../lib/working-hours'

interface PlanLimits {
  maxProfessions: number
  maxZipCodes: number
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
  setWorkingHours: React.Dispatch<React.SetStateAction<WorkingHours>>
  save: () => Promise<void>
}

const DEFAULT_LIMITS: PlanLimits = { maxProfessions: 1, maxZipCodes: 3 }

export function useContractorSettings(): UseContractorSettingsReturn {
  const { effectiveUserId } = useAuth()
  const [professions, setProfessions] = useState<ProfessionId[]>([])
  const [zipCodes, setZipCodes] = useState<string[]>([])
  const [workingHours, setWorkingHours] = useState<WorkingHours>(DEFAULT_WORKING_HOURS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [planLimits, setPlanLimits] = useState<PlanLimits>(DEFAULT_LIMITS)

  useEffect(() => {
    if (!effectiveUserId) return
    setLoading(true)

    // Fetch contractor settings + plan limits in parallel
    Promise.all([
      supabase
        .from('contractors')
        .select('professions, zip_codes, working_days, working_hours')
        .eq('user_id', effectiveUserId)
        .maybeSingle(),
      supabase
        .from('subscriptions')
        .select('plans ( max_professions, max_zip_codes )')
        .eq('user_id', effectiveUserId)
        .maybeSingle(),
    ]).then(([contRes, subRes]) => {
      if (contRes.data) {
        setProfessions((contRes.data.professions as ProfessionId[]) ?? [])
        setZipCodes((contRes.data.zip_codes as string[]) ?? [])
        if (contRes.data.working_hours) {
          setWorkingHours(contRes.data.working_hours as WorkingHours)
        }
      }
      if (subRes.data) {
        const plan = subRes.data.plans as any
        if (plan) {
          setPlanLimits({
            maxProfessions: plan.max_professions ?? -1,
            maxZipCodes: plan.max_zip_codes ?? -1,
          })
        }
      }
      setLoading(false)
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
    if (!cleaned || zipCodes.includes(cleaned)) return false
    // Enforce plan limit
    if (planLimits.maxZipCodes > 0 && zipCodes.length >= planLimits.maxZipCodes) return false
    setZipCodes((prev) => [...prev, cleaned])
    setSaved(false)
    return true
  }, [zipCodes, planLimits.maxZipCodes])

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

  const save = useCallback(async () => {
    if (!effectiveUserId) return
    setSaving(true)
    setSaved(false)

    const dayIndexMap = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 } as const
    const workingDays = Object.entries(workingHours)
      .filter(([, v]) => v.enabled)
      .map(([k]) => dayIndexMap[k as keyof typeof dayIndexMap])

    const { error } = await supabase
      .from('contractors')
      .upsert({
        user_id: effectiveUserId,
        professions,
        zip_codes: zipCodes,
        working_days: workingDays,
        working_hours: workingHours,
        updated_at: new Date().toISOString(),
      })

    if (!error) {
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    }

    setSaving(false)
  }, [effectiveUserId, professions, zipCodes, workingHours])

  return {
    professions, zipCodes, workingHours,
    loading, saving, saved, planLimits,
    toggleProfession, addZipCode, addZipCodes, removeZipCode,
    setWorkingHours, save,
  }
}
