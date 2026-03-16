# Contractor Service Settings — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the placeholder `/settings` route with a rich Service Settings page where contractors manage professions, ZIP codes, and working schedule alongside a Google Map.

**Architecture:** Two-column responsive layout. Left panel contains professions grid and ZIP tag input. Right area contains a Google Map (top) with ZIP polygons + lead pins, and a 7-day working schedule grid (bottom). Data persists to the `contractors` table via Supabase. The page reads/writes `professions`, `zip_codes`, `working_days`, and a new `working_hours` jsonb column.

**Tech Stack:** React 19, Tailwind CSS, `@vis.gl/react-google-maps`, Supabase JS client, Lucide icons.

---

## Task 1: Add `working_hours` Column to Database

**Files:**
- Supabase migration (via MCP)

**Step 1: Run migration to add the column**

```sql
ALTER TABLE public.contractors
ADD COLUMN working_hours jsonb NOT NULL DEFAULT '{
  "sun": {"enabled": false, "start": "09:00", "end": "18:00"},
  "mon": {"enabled": true,  "start": "09:00", "end": "18:00"},
  "tue": {"enabled": true,  "start": "09:00", "end": "18:00"},
  "wed": {"enabled": true,  "start": "09:00", "end": "18:00"},
  "thu": {"enabled": true,  "start": "09:00", "end": "18:00"},
  "fri": {"enabled": true,  "start": "09:00", "end": "18:00"},
  "sat": {"enabled": false, "start": "09:00", "end": "18:00"}
}'::jsonb;
```

**Step 2: Verify column exists**

```sql
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'contractors' AND column_name = 'working_hours';
```

Expected: one row with `jsonb` type.

**Step 3: Commit**
```bash
# Migration applied via Supabase MCP — no local file to commit
```

---

## Task 2: Install Google Maps Dependency

**Files:**
- Modify: `apps/dashboard/package.json`

**Step 1: Install the package**

```bash
cd apps/dashboard && pnpm add @vis.gl/react-google-maps
```

**Step 2: Verify installation**

```bash
pnpm ls @vis.gl/react-google-maps
```

Expected: package listed with version.

**Step 3: Commit**
```bash
git add apps/dashboard/package.json apps/dashboard/pnpm-lock.yaml
git commit -m "chore: add @vis.gl/react-google-maps for settings page"
```

---

## Task 3: Create Profession Constants Shared Module

**Files:**
- Create: `apps/dashboard/src/lib/professions.ts`

This centralizes profession metadata used by both the Settings page and future components. Must match the 20 professions from the parser.

**Step 1: Create the file**

```typescript
// apps/dashboard/src/lib/professions.ts

export type ProfessionId =
  | 'hvac' | 'air_duct' | 'chimney' | 'dryer_vent'
  | 'garage_door' | 'locksmith' | 'roofing'
  | 'plumbing' | 'electrical' | 'painting'
  | 'cleaning' | 'carpet_cleaning'
  | 'renovation' | 'fencing' | 'landscaping'
  | 'tiling' | 'kitchen' | 'bathroom' | 'pool'
  | 'moving'

export interface ProfessionMeta {
  id: ProfessionId
  emoji: string
  en: string
  he: string
}

export const PROFESSIONS: ProfessionMeta[] = [
  { id: 'hvac',            emoji: '❄️',  en: 'HVAC',             he: 'מזגנים' },
  { id: 'air_duct',        emoji: '💨',  en: 'Air Duct',         he: 'תעלות אוויר' },
  { id: 'chimney',         emoji: '🏠',  en: 'Chimney',          he: 'ארובות' },
  { id: 'dryer_vent',      emoji: '🌀',  en: 'Dryer Vent',       he: 'פתח מייבש' },
  { id: 'garage_door',     emoji: '🚪',  en: 'Garage Door',      he: 'דלת מוסך' },
  { id: 'locksmith',       emoji: '🔑',  en: 'Locksmith',        he: 'מנעולן' },
  { id: 'roofing',         emoji: '🏗️',  en: 'Roofing',          he: 'גגות' },
  { id: 'plumbing',        emoji: '🔧',  en: 'Plumbing',         he: 'אינסטלציה' },
  { id: 'electrical',      emoji: '⚡',  en: 'Electrical',       he: 'חשמל' },
  { id: 'painting',        emoji: '🎨',  en: 'Painting',         he: 'צביעה' },
  { id: 'cleaning',        emoji: '🧹',  en: 'Cleaning',         he: 'ניקיון' },
  { id: 'carpet_cleaning', emoji: '🧼',  en: 'Carpet Cleaning',  he: 'ניקוי שטיחים' },
  { id: 'renovation',      emoji: '🔨',  en: 'Renovation',       he: 'שיפוצים' },
  { id: 'fencing',         emoji: '🏗️',  en: 'Fencing',          he: 'גדרות' },
  { id: 'landscaping',     emoji: '🌿',  en: 'Landscaping',      he: 'גינון' },
  { id: 'tiling',          emoji: '🔲',  en: 'Tiling',           he: 'ריצוף' },
  { id: 'kitchen',         emoji: '🍳',  en: 'Kitchen',          he: 'מטבחים' },
  { id: 'bathroom',        emoji: '🚿',  en: 'Bathroom',         he: 'חדרי אמבטיה' },
  { id: 'pool',            emoji: '🏊',  en: 'Pool',             he: 'בריכות' },
  { id: 'moving',          emoji: '📦',  en: 'Moving',           he: 'הובלות' },
]
```

**Step 2: Commit**
```bash
git add apps/dashboard/src/lib/professions.ts
git commit -m "feat: add shared profession constants (20 professions)"
```

---

## Task 4: Create Working Hours Type + Defaults

**Files:**
- Create: `apps/dashboard/src/lib/working-hours.ts`

**Step 1: Create the file**

```typescript
// apps/dashboard/src/lib/working-hours.ts

export type DayKey = 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat'

export interface DaySchedule {
  enabled: boolean
  start: string // "HH:mm"
  end: string   // "HH:mm"
}

export type WorkingHours = Record<DayKey, DaySchedule>

export const DAY_KEYS: DayKey[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

export const DAY_LABELS: Record<DayKey, { en: string; he: string }> = {
  sun: { en: 'Sunday',    he: 'ראשון' },
  mon: { en: 'Monday',    he: 'שני' },
  tue: { en: 'Tuesday',   he: 'שלישי' },
  wed: { en: 'Wednesday', he: 'רביעי' },
  thu: { en: 'Thursday',  he: 'חמישי' },
  fri: { en: 'Friday',    he: 'שישי' },
  sat: { en: 'Saturday',  he: 'שבת' },
}

export const DEFAULT_WORKING_HOURS: WorkingHours = {
  sun: { enabled: false, start: '09:00', end: '18:00' },
  mon: { enabled: true,  start: '09:00', end: '18:00' },
  tue: { enabled: true,  start: '09:00', end: '18:00' },
  wed: { enabled: true,  start: '09:00', end: '18:00' },
  thu: { enabled: true,  start: '09:00', end: '18:00' },
  fri: { enabled: true,  start: '09:00', end: '18:00' },
  sat: { enabled: false, start: '09:00', end: '18:00' },
}
```

**Step 2: Commit**
```bash
git add apps/dashboard/src/lib/working-hours.ts
git commit -m "feat: add working hours types and defaults"
```

---

## Task 5: Create `useContractorSettings` Hook

**Files:**
- Create: `apps/dashboard/src/hooks/useContractorSettings.ts`

This hook loads/saves contractor data from Supabase, managing local state for professions, zip_codes, working_hours. Separates data logic from UI.

**Step 1: Create the hook**

```typescript
// apps/dashboard/src/hooks/useContractorSettings.ts
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import type { ProfessionId } from '../lib/professions'
import { DEFAULT_WORKING_HOURS, type WorkingHours } from '../lib/working-hours'

interface ContractorSettings {
  professions: ProfessionId[]
  zipCodes: string[]
  workingHours: WorkingHours
}

interface UseContractorSettingsReturn extends ContractorSettings {
  loading: boolean
  saving: boolean
  saved: boolean
  setProfessions: React.Dispatch<React.SetStateAction<ProfessionId[]>>
  setZipCodes: React.Dispatch<React.SetStateAction<string[]>>
  setWorkingHours: React.Dispatch<React.SetStateAction<WorkingHours>>
  toggleProfession: (id: ProfessionId) => void
  addZipCode: (zip: string) => boolean
  removeZipCode: (zip: string) => void
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

  // Load from Supabase
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

    // Derive working_days (int[]) from workingHours for backward compat
    const dayIndexMap = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 }
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
    setProfessions, setZipCodes, setWorkingHours,
    toggleProfession, addZipCode, removeZipCode, save,
  }
}
```

**Step 2: Commit**
```bash
git add apps/dashboard/src/hooks/useContractorSettings.ts
git commit -m "feat: add useContractorSettings hook for settings persistence"
```

---

## Task 6: Create ProfessionGrid Component

**Files:**
- Create: `apps/dashboard/src/components/settings/ProfessionGrid.tsx`

**Step 1: Create the component**

```typescript
// apps/dashboard/src/components/settings/ProfessionGrid.tsx
import { useI18n } from '../../lib/i18n'
import { PROFESSIONS, type ProfessionId } from '../../lib/professions'

interface Props {
  selected: ProfessionId[]
  onToggle: (id: ProfessionId) => void
}

export default function ProfessionGrid({ selected, onToggle }: Props) {
  const { locale } = useI18n()

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-zinc-700">
        {locale === 'he' ? 'מקצועות' : 'Professions'}
      </h3>
      <div className="grid grid-cols-2 gap-2">
        {PROFESSIONS.map((prof) => {
          const active = selected.includes(prof.id)
          return (
            <button
              key={prof.id}
              type="button"
              onClick={() => onToggle(prof.id)}
              className={[
                'flex items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm transition-all duration-150',
                active
                  ? 'bg-emerald-50 ring-2 ring-emerald-300 text-emerald-800 font-medium shadow-sm'
                  : 'bg-white/60 border border-zinc-200 text-zinc-600 hover:bg-white hover:shadow-sm',
              ].join(' ')}
            >
              <span className="text-base">{prof.emoji}</span>
              <span className="flex-1 truncate">{locale === 'he' ? prof.he : prof.en}</span>
              {active && (
                <svg className="w-4 h-4 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
```

**Step 2: Commit**
```bash
git add apps/dashboard/src/components/settings/ProfessionGrid.tsx
git commit -m "feat: add ProfessionGrid component (20 professions, EN/HE)"
```

---

## Task 7: Create ZipManager Component

**Files:**
- Create: `apps/dashboard/src/components/settings/ZipManager.tsx`

**Step 1: Create the component**

```typescript
// apps/dashboard/src/components/settings/ZipManager.tsx
import { useState } from 'react'
import { Plus, X, MapPin } from 'lucide-react'
import { useI18n } from '../../lib/i18n'

interface Props {
  zipCodes: string[]
  onAdd: (zip: string) => boolean
  onRemove: (zip: string) => void
}

export default function ZipManager({ zipCodes, onAdd, onRemove }: Props) {
  const { locale } = useI18n()
  const [input, setInput] = useState('')

  function handleAdd() {
    if (onAdd(input)) setInput('')
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') { e.preventDefault(); handleAdd() }
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-zinc-700">
        {locale === 'he' ? 'אזורי שירות (מיקוד)' : 'Service Areas (ZIP)'}
      </h3>

      {/* Input */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={locale === 'he' ? 'הזן מיקוד...' : 'Enter ZIP code...'}
          maxLength={10}
          className="flex-1 rounded-xl border border-zinc-200 bg-white/80 py-2 px-3 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition-all"
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={!input.trim()}
          className="btn-primary rounded-xl px-3 py-2 text-sm font-medium disabled:opacity-40"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {/* Tags */}
      {zipCodes.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {zipCodes.map((zip) => (
            <span
              key={zip}
              className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-xs font-medium text-emerald-700"
            >
              <MapPin className="h-3 w-3" />
              {zip}
              <button
                type="button"
                onClick={() => onRemove(zip)}
                className="rounded-full p-0.5 hover:bg-emerald-200 transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className="text-xs text-zinc-400 italic">
          {locale === 'he' ? 'לא נוספו אזורים עדיין' : 'No ZIP codes added yet.'}
        </p>
      )}
    </div>
  )
}
```

**Step 2: Commit**
```bash
git add apps/dashboard/src/components/settings/ZipManager.tsx
git commit -m "feat: add ZipManager tag-input component"
```

---

## Task 8: Create WorkingSchedule Component

**Files:**
- Create: `apps/dashboard/src/components/settings/WorkingSchedule.tsx`

**Step 1: Create the component**

```typescript
// apps/dashboard/src/components/settings/WorkingSchedule.tsx
import { useI18n } from '../../lib/i18n'
import { DAY_KEYS, DAY_LABELS, type DayKey, type WorkingHours } from '../../lib/working-hours'

interface Props {
  hours: WorkingHours
  onChange: (hours: WorkingHours) => void
}

export default function WorkingSchedule({ hours, onChange }: Props) {
  const { locale } = useI18n()

  function toggleDay(day: DayKey) {
    onChange({ ...hours, [day]: { ...hours[day], enabled: !hours[day].enabled } })
  }

  function setTime(day: DayKey, field: 'start' | 'end', value: string) {
    onChange({ ...hours, [day]: { ...hours[day], [field]: value } })
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-zinc-700">
        {locale === 'he' ? 'ימי ושעות עבודה' : 'Working Days & Hours'}
      </h3>

      <div className="space-y-1.5">
        {DAY_KEYS.map((day) => {
          const schedule = hours[day]
          const label = locale === 'he' ? DAY_LABELS[day].he : DAY_LABELS[day].en

          return (
            <div
              key={day}
              className={[
                'flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all',
                schedule.enabled
                  ? 'bg-white border border-zinc-200'
                  : 'bg-zinc-50 border border-zinc-100 opacity-60',
              ].join(' ')}
            >
              {/* Toggle */}
              <button
                type="button"
                onClick={() => toggleDay(day)}
                className={[
                  'relative w-10 h-5 rounded-full transition-colors shrink-0',
                  schedule.enabled ? 'bg-emerald-500' : 'bg-zinc-300',
                ].join(' ')}
              >
                <span
                  className={[
                    'absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform',
                    schedule.enabled ? 'translate-x-5' : 'translate-x-0.5',
                  ].join(' ')}
                />
              </button>

              {/* Day name */}
              <span className="text-sm font-medium text-zinc-700 w-20">{label}</span>

              {/* Time pickers */}
              {schedule.enabled ? (
                <div className="flex items-center gap-2 ml-auto">
                  <input
                    type="time"
                    value={schedule.start}
                    onChange={(e) => setTime(day, 'start', e.target.value)}
                    className="rounded-lg border border-zinc-200 px-2 py-1 text-xs text-zinc-700 outline-none focus:border-emerald-400"
                  />
                  <span className="text-xs text-zinc-400">–</span>
                  <input
                    type="time"
                    value={schedule.end}
                    onChange={(e) => setTime(day, 'end', e.target.value)}
                    className="rounded-lg border border-zinc-200 px-2 py-1 text-xs text-zinc-700 outline-none focus:border-emerald-400"
                  />
                </div>
              ) : (
                <span className="ml-auto text-xs text-zinc-400 italic">
                  {locale === 'he' ? 'יום חופש' : 'Day off'}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

**Step 2: Commit**
```bash
git add apps/dashboard/src/components/settings/WorkingSchedule.tsx
git commit -m "feat: add WorkingSchedule 7-day grid with time pickers"
```

---

## Task 9: Create CoverageMap Component (Google Maps)

**Files:**
- Create: `apps/dashboard/src/components/settings/CoverageMap.tsx`

This component renders a Google Map with ZIP code polygons. For MVP, it shows colored circles/markers at ZIP centroids. Full polygon support (ZCTA GeoJSON) can be added as a follow-up.

**Step 1: Create the component**

```typescript
// apps/dashboard/src/components/settings/CoverageMap.tsx
import { APIProvider, Map, AdvancedMarker } from '@vis.gl/react-google-maps'
import { useI18n } from '../../lib/i18n'

const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY ?? ''

// Approximate centroids for common FL ZIP codes (extend as needed)
// In production, use a geocoding API or precomputed lookup
const ZIP_CENTROIDS: Record<string, { lat: number; lng: number }> = {}

interface Props {
  zipCodes: string[]
}

export default function CoverageMap({ zipCodes }: Props) {
  const { locale } = useI18n()

  if (!GOOGLE_MAPS_KEY) {
    return (
      <div className="flex items-center justify-center h-full rounded-xl bg-zinc-50 border border-zinc-200">
        <p className="text-sm text-zinc-400">
          {locale === 'he'
            ? 'הוסף VITE_GOOGLE_MAPS_KEY ב-.env כדי להציג מפה'
            : 'Add VITE_GOOGLE_MAPS_KEY to .env to display map'}
        </p>
      </div>
    )
  }

  // Default center: South Florida
  const defaultCenter = { lat: 26.1224, lng: -80.1373 }

  return (
    <APIProvider apiKey={GOOGLE_MAPS_KEY}>
      <Map
        defaultCenter={defaultCenter}
        defaultZoom={9}
        gestureHandling="greedy"
        disableDefaultUI={false}
        mapId="settings-coverage-map"
        className="w-full h-full rounded-xl"
      >
        {zipCodes.map((zip) => {
          const pos = ZIP_CENTROIDS[zip]
          if (!pos) return null
          return (
            <AdvancedMarker key={zip} position={pos}>
              <div className="bg-emerald-500 text-white text-[10px] font-bold px-2 py-1 rounded-full shadow">
                {zip}
              </div>
            </AdvancedMarker>
          )
        })}
      </Map>
    </APIProvider>
  )
}
```

**Step 2: Commit**
```bash
git add apps/dashboard/src/components/settings/CoverageMap.tsx
git commit -m "feat: add CoverageMap component with Google Maps placeholder"
```

---

## Task 10: Create ServiceSettings Page

**Files:**
- Create: `apps/dashboard/src/pages/ServiceSettings.tsx`
- Modify: `apps/dashboard/src/App.tsx` (line 70 — replace placeholder)

**Step 1: Create the page**

```typescript
// apps/dashboard/src/pages/ServiceSettings.tsx
import { Save, CheckCircle, Settings } from 'lucide-react'
import { useI18n } from '../lib/i18n'
import { useContractorSettings } from '../hooks/useContractorSettings'
import ProfessionGrid from '../components/settings/ProfessionGrid'
import ZipManager from '../components/settings/ZipManager'
import WorkingSchedule from '../components/settings/WorkingSchedule'
import CoverageMap from '../components/settings/CoverageMap'

export default function ServiceSettings() {
  const { locale } = useI18n()
  const {
    professions, zipCodes, workingHours,
    loading, saving, saved,
    toggleProfession, addZipCode, removeZipCode,
    setWorkingHours, save,
  } = useContractorSettings()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin h-8 w-8 rounded-full border-2 border-emerald-500 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="animate-fade-in pb-12">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-emerald-100 text-emerald-700">
            <Settings className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-zinc-900">
              {locale === 'he' ? 'הגדרות שירות' : 'Service Settings'}
            </h1>
            <p className="text-sm text-zinc-500">
              {locale === 'he'
                ? 'נהל מקצועות, אזורים ולוח זמנים'
                : 'Manage professions, coverage areas & schedule'}
            </p>
          </div>
        </div>

        {/* Save button */}
        <div className="flex items-center gap-3">
          {saved && (
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600 animate-fade-in">
              <CheckCircle className="h-4 w-4" />
              {locale === 'he' ? 'נשמר!' : 'Saved!'}
            </span>
          )}
          <button
            onClick={save}
            disabled={saving}
            className="btn-primary inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium disabled:opacity-60"
          >
            {saving ? (
              <div className="animate-spin h-4 w-4 rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {locale === 'he' ? 'שמור' : 'Save'}
          </button>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left Panel */}
        <div className="w-full lg:w-[350px] shrink-0 space-y-6">
          <div className="glass-panel p-5">
            <ProfessionGrid selected={professions} onToggle={toggleProfession} />
          </div>
          <div className="glass-panel p-5">
            <ZipManager zipCodes={zipCodes} onAdd={addZipCode} onRemove={removeZipCode} />
          </div>
        </div>

        {/* Right Area */}
        <div className="flex-1 space-y-6">
          {/* Map */}
          <div className="glass-panel p-0 overflow-hidden h-[350px] lg:h-[400px]">
            <CoverageMap zipCodes={zipCodes} />
          </div>
          {/* Schedule */}
          <div className="glass-panel p-5">
            <WorkingSchedule hours={workingHours} onChange={setWorkingHours} />
          </div>
        </div>
      </div>
    </div>
  )
}
```

**Step 2: Update App.tsx — replace placeholder route**

In `apps/dashboard/src/App.tsx`:
- Add import: `import ServiceSettings from './pages/ServiceSettings'`
- Replace line 70: `<Route path="/settings" element={<div ...>` with `<Route path="/settings" element={<ServiceSettings />} />`

**Step 3: Verify the dev server compiles without errors**

```bash
cd apps/dashboard && pnpm dev
```

Open browser to `http://localhost:5173/settings` — verify page renders with both columns.

**Step 4: Commit**
```bash
git add apps/dashboard/src/pages/ServiceSettings.tsx apps/dashboard/src/App.tsx
git commit -m "feat: add ServiceSettings page with two-column layout"
```

---

## Task 11: Add i18n Keys for Settings Page

**Files:**
- Modify: `apps/dashboard/src/lib/i18n.ts`

**Step 1: Add translation keys**

Add to `en` translations:
```typescript
'settings.title': 'Service Settings',
'settings.subtitle': 'Manage professions, coverage areas & schedule',
'settings.save': 'Save',
'settings.saved': 'Saved!',
'settings.professions': 'Professions',
'settings.zip_codes': 'Service Areas (ZIP)',
'settings.schedule': 'Working Days & Hours',
'settings.day_off': 'Day off',
'settings.no_zips': 'No ZIP codes added yet.',
'settings.map_key_missing': 'Add VITE_GOOGLE_MAPS_KEY to .env to display map',
```

Add to `he` translations:
```typescript
'settings.title': 'הגדרות שירות',
'settings.subtitle': 'נהל מקצועות, אזורים ולוח זמנים',
'settings.save': 'שמור',
'settings.saved': 'נשמר!',
'settings.professions': 'מקצועות',
'settings.zip_codes': 'אזורי שירות (מיקוד)',
'settings.schedule': 'ימי ושעות עבודה',
'settings.day_off': 'יום חופש',
'settings.no_zips': 'לא נוספו אזורים עדיין',
'settings.map_key_missing': 'הוסף VITE_GOOGLE_MAPS_KEY ב-.env כדי להציג מפה',
```

**Step 2: Update components to use `t()` instead of inline strings**

Refactor ProfessionGrid, ZipManager, WorkingSchedule, CoverageMap, and ServiceSettings to use `t('settings.xxx')` keys.

**Step 3: Commit**
```bash
git add apps/dashboard/src/lib/i18n.ts apps/dashboard/src/components/settings/ apps/dashboard/src/pages/ServiceSettings.tsx
git commit -m "feat: add i18n translations for settings page (EN/HE)"
```

---

## Task 12: Update Profile Page — Remove Redundant Sections

**Files:**
- Modify: `apps/dashboard/src/pages/Profile.tsx`

**Step 1: Remove professions grid and ZIP codes sections from Profile**

Keep only: Personal Information (name, phone, email) and Telegram Connection.

Remove: PROFESSIONS constant, ProfessionId type, `professions`/`zipCodes` state, toggleProfession/addZipCode/removeZipCode handlers, professions section JSX, ZIP codes section JSX.

Update save handler to only save personal info fields (full_name, phone, telegram_token).

**Step 2: Verify Profile page still works**

Open `http://localhost:5173/profile` — should show only personal info and Telegram.

**Step 3: Commit**
```bash
git add apps/dashboard/src/pages/Profile.tsx
git commit -m "refactor: slim Profile page — move professions+ZIPs to Settings"
```

---

## Task 13: Visual Polish & Mobile Responsiveness

**Files:**
- Modify: `apps/dashboard/src/pages/ServiceSettings.tsx`

**Step 1: Test mobile layout**

Resize browser to 375px width. Verify:
- Columns stack vertically
- Map appears first, then professions, ZIPs, schedule
- All touch targets ≥ 44px

**Step 2: Fix any spacing/overflow issues**

Adjust Tailwind classes as needed (padding, gap, font sizes on mobile).

**Step 3: Commit**
```bash
git add apps/dashboard/src/pages/ServiceSettings.tsx apps/dashboard/src/components/settings/
git commit -m "style: polish settings page mobile responsiveness"
```

---

## Task 14: End-to-End Verification

**Step 1: Start dashboard dev server**
```bash
cd apps/dashboard && pnpm dev
```

**Step 2: Navigate to `/settings` — verify full page renders**
- Professions grid shows 20 items, toggles work
- ZIP input adds/removes tags
- Map shows placeholder (or real map if key present)
- Schedule grid toggles days, time pickers work
- Save button persists to Supabase

**Step 3: Verify data round-trip**
- Toggle 3 professions, add 2 ZIPs, disable Saturday
- Click Save
- Refresh page — all selections persist

**Step 4: Check `/profile` — only personal info remains**

**Step 5: Final commit if any fixes needed**
```bash
git add -A
git commit -m "feat: contractor service settings page complete"
```

---

## Execution Summary

| Task | Description | Est. |
|------|------------|------|
| 1 | Add `working_hours` DB column | 2 min |
| 2 | Install Google Maps dependency | 2 min |
| 3 | Create professions constants | 3 min |
| 4 | Create working hours types | 2 min |
| 5 | Create `useContractorSettings` hook | 5 min |
| 6 | Create ProfessionGrid component | 5 min |
| 7 | Create ZipManager component | 5 min |
| 8 | Create WorkingSchedule component | 5 min |
| 9 | Create CoverageMap component | 5 min |
| 10 | Create ServiceSettings page + route | 5 min |
| 11 | Add i18n translations | 3 min |
| 12 | Slim down Profile page | 5 min |
| 13 | Mobile responsiveness polish | 5 min |
| 14 | End-to-end verification | 5 min |
