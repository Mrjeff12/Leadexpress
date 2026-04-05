import { useState, useCallback, useMemo } from 'react'

export type DatePreset = 'today' | 'yesterday' | '7days' | 'custom'

export interface DateRange {
  from: string  // ISO date string (YYYY-MM-DD)
  to: string    // ISO date string (YYYY-MM-DD)
  preset: DatePreset
}

function toISO(d: Date) {
  return d.toISOString().slice(0, 10)
}

function getPresetRange(preset: DatePreset): { from: string; to: string } {
  const now = new Date()
  const today = toISO(now)

  switch (preset) {
    case 'today':
      return { from: today, to: today }
    case 'yesterday': {
      const y = new Date(now)
      y.setDate(y.getDate() - 1)
      return { from: toISO(y), to: toISO(y) }
    }
    case '7days': {
      const d = new Date(now)
      d.setDate(d.getDate() - 6)
      return { from: toISO(d), to: today }
    }
    case 'custom':
      return { from: today, to: today }
  }
}

export function useDateFilter(initial: DatePreset = 'today') {
  const [preset, setPreset] = useState<DatePreset>(initial)
  const [customFrom, setCustomFrom] = useState<string>('')
  const [customTo, setCustomTo] = useState<string>('')

  const range: DateRange = useMemo(() => {
    if (preset === 'custom' && customFrom && customTo) {
      return { from: customFrom, to: customTo, preset }
    }
    const r = getPresetRange(preset)
    return { ...r, preset }
  }, [preset, customFrom, customTo])

  const setPresetFilter = useCallback((p: DatePreset) => {
    setPreset(p)
  }, [])

  const setCustomRange = useCallback((from: string, to: string) => {
    setCustomFrom(from)
    setCustomTo(to)
    setPreset('custom')
  }, [])

  return { range, preset, setPresetFilter, setCustomRange }
}
