import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import type { ProfessionId } from '../lib/professions'
import { DEFAULT_WORKING_HOURS, type WorkingHours } from '../lib/working-hours'

interface UseContractorSettingsReturn {
  professions: ProfessionId[]
  zipCodes: string[]
  workingHours: WorkingHours
  loading: boolean
  saving: boolean
  saved: boolean
  toggleProfession: (id: ProfessionId) => void
  addZipCode: (zip: string) => boolean
  removeZipCode: (zip: string) => void
  setWorkingHours: React.Dispatch<React.SetStateAction<WorkingHours>>
  save: () => Promise<void>
}

export function useContractorSettings(): UseContractorSettingsReturn {
  const { user } = useAuth()
  const [professions, setProfessions] = useState<ProfessionId[]>([])
  const [zipCodes, setZipCodes] = useState<string[]>([])
  const [workingHours, setWorkingHours] = useState<WorkingHours>(DEFAULT_WORKING_HOURS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!user) return
    setLoading(true)

    supabase
      .from('contractors')
      .select('professions, zip_codes, working_days, working_hours')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setProfessions((data.professions as ProfessionId[]) ?? [])
          setZipCodes((data.zip_codes as string[]) ?? [])
          if (data.working_hours) {
            setWorkingHours(data.working_hours as WorkingHours)
          }
        }
        setLoading(false)
      })
  }, [user])

  const toggleProfession = useCallback((id: ProfessionId) => {
    setProfessions((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    )
    setSaved(false)
  }, [])

  const addZipCode = useCallback((zip: string): boolean => {
    const cleaned = zip.trim().replace(/\D/g, '')
    if (!cleaned || zipCodes.includes(cleaned)) return false
    setZipCodes((prev) => [...prev, cleaned])
    setSaved(false)
    return true
  }, [zipCodes])

  const removeZipCode = useCallback((zip: string) => {
    setZipCodes((prev) => prev.filter((z) => z !== zip))
    setSaved(false)
  }, [])

  const save = useCallback(async () => {
    if (!user) return
    setSaving(true)
    setSaved(false)

    const dayIndexMap = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 } as const
    const workingDays = Object.entries(workingHours)
      .filter(([, v]) => v.enabled)
      .map(([k]) => dayIndexMap[k as keyof typeof dayIndexMap])

    const { error } = await supabase
      .from('contractors')
      .upsert({
        user_id: user.id,
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
  }, [user, professions, zipCodes, workingHours])

  return {
    professions, zipCodes, workingHours,
    loading, saving, saved,
    toggleProfession, addZipCode, removeZipCode,
    setWorkingHours, save,
  }
}
