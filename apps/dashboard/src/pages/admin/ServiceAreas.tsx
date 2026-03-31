import { useState, useEffect, useMemo, useCallback } from 'react'
import { useI18n } from '../../lib/i18n'
import { supabase } from '../../lib/supabase'
import { Map, Plus, Trash2, Search, Upload, Info, ArrowUp, ArrowDown, Loader2, AlertCircle, X } from 'lucide-react'

interface ServiceArea {
  id: string
  zip_code: string
  city: string
  state: string
  contractor_count: number
  is_active: boolean
}

type SortKey = 'zip_code' | 'city' | 'contractor_count' | 'is_active'
type SortDir = 'asc' | 'desc'

export default function ServiceAreas() {
  const { locale } = useI18n()
  const he = locale === 'he'

  const [areas, setAreas] = useState<ServiceArea[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [zipInput, setZipInput] = useState('')
  const [cityInput, setCityInput] = useState('')
  const [stateInput, setStateInput] = useState('')
  const [bulkInput, setBulkInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('zip_code')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const fetchAreas = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error: err } = await supabase
      .from('service_areas')
      .select('*')
      .order('zip_code')
    if (err) {
      setError(err.message)
    } else {
      setAreas(data ?? [])
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchAreas() }, [fetchAreas])

  // KPI calculations
  const totalZips = areas.length
  const activeAreas = areas.filter((a) => a.is_active).length
  const totalContractors = areas.reduce((sum, a) => sum + a.contractor_count, 0)

  // Add single ZIP
  const handleAddZip = async () => {
    const zip = zipInput.trim()
    if (!zip || areas.some((a) => a.zip_code === zip)) return
    setError(null)
    const { data, error: err } = await supabase
      .from('service_areas')
      .insert({ zip_code: zip, city: cityInput.trim() || '', state: stateInput.trim() || '', is_active: false })
      .select()
      .single()
    if (err) { setError(err.message); return }
    setAreas((prev) => [...prev, data])
    setZipInput('')
    setCityInput('')
    setStateInput('')
  }

  // Bulk import
  const handleBulkImport = async () => {
    const zips = bulkInput
      .split(',')
      .map((z) => z.trim())
      .filter((z) => z && !areas.some((a) => a.zip_code === z))
    if (zips.length === 0) return
    setError(null)
    const rows = zips.map((zip) => ({ zip_code: zip, city: '', state: '', is_active: false }))
    const { data, error: err } = await supabase
      .from('service_areas')
      .insert(rows)
      .select()
    if (err) { setError(err.message); return }
    setAreas((prev) => [...prev, ...(data ?? [])])
    setBulkInput('')
  }

  // Remove area
  const handleRemove = async (id: string) => {
    setError(null)
    const { error: err } = await supabase
      .from('service_areas')
      .delete()
      .eq('id', id)
    if (err) { setError(err.message); return }
    setAreas((prev) => prev.filter((a) => a.id !== id))
  }

  // Sort handler
  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  // Filtered & sorted areas
  const filteredAreas = useMemo(() => {
    let result = areas
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        (a) => a.zip_code.toLowerCase().includes(q) || a.city.toLowerCase().includes(q) || a.state.toLowerCase().includes(q)
      )
    }
    result = [...result].sort((a, b) => {
      let cmp = 0
      if (sortKey === 'zip_code') cmp = a.zip_code.localeCompare(b.zip_code)
      else if (sortKey === 'city') cmp = a.city.localeCompare(b.city)
      else if (sortKey === 'contractor_count') cmp = a.contractor_count - b.contractor_count
      else if (sortKey === 'is_active') cmp = (a.is_active ? 1 : 0) - (b.is_active ? 1 : 0)
      return sortDir === 'asc' ? cmp : -cmp
    })
    return result
  }, [areas, searchQuery, sortKey, sortDir])

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortKey !== column) return null
    return sortDir === 'asc' ? (
      <ArrowUp className="inline h-3 w-3 ml-1" />
    ) : (
      <ArrowDown className="inline h-3 w-3 ml-1" />
    )
  }

  const thClass =
    'text-left px-5 py-3 font-semibold text-xs uppercase tracking-wider cursor-pointer select-none'

  return (
    <div className="animate-fade-in space-y-8" style={{ fontFamily: 'Outfit, sans-serif' }}>
      {/* Header */}
      <header>
        <h1 className="text-3xl font-bold tracking-tight" style={{ color: '#2d3a2e' }}>
          {he ? 'אזורי שירות' : 'Service Areas'}
        </h1>
        <p className="mt-1 text-sm" style={{ color: '#6b7c6e' }}>
          {he ? 'ניהול מיקודים וכיסוי' : 'Manage ZIP codes and coverage'}
        </p>
      </header>

      {/* Error Banner */}
      {error && (
        <div className="glass-panel p-4 flex items-center gap-3" style={{ backgroundColor: 'rgba(220,38,38,0.05)', borderColor: '#fca5a5' }}>
          <AlertCircle className="h-5 w-5 flex-shrink-0" style={{ color: '#dc2626' }} />
          <p className="text-sm" style={{ color: '#dc2626' }}>{error}</p>
          <button onClick={() => setError(null)} className="ml-auto btn-ghost p-1">
            <X className="h-4 w-4" style={{ color: '#dc2626' }} />
          </button>
        </div>
      )}

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 stagger-kpi">
        <div className="glass-panel p-5">
          <div className="flex items-center gap-3">
            <div
              className="flex items-center justify-center w-10 h-10 rounded-xl"
              style={{ backgroundColor: 'rgba(90,138,94,0.1)' }}
            >
              <Map className="h-5 w-5" style={{ color: '#5a8a5e' }} />
            </div>
            <div>
              <p className="text-2xl font-bold" style={{ color: '#2d3a2e' }}>
                {totalZips}
              </p>
              <p className="text-xs font-medium" style={{ color: '#9ca89e' }}>
                {he ? 'סה"כ מיקודים' : 'Total ZIP Codes'}
              </p>
            </div>
          </div>
        </div>
        <div className="glass-panel p-5">
          <div className="flex items-center gap-3">
            <div
              className="flex items-center justify-center w-10 h-10 rounded-xl"
              style={{ backgroundColor: 'rgba(90,138,94,0.1)' }}
            >
              <Map className="h-5 w-5" style={{ color: '#5a8a5e' }} />
            </div>
            <div>
              <p className="text-2xl font-bold" style={{ color: '#2d3a2e' }}>
                {activeAreas}
              </p>
              <p className="text-xs font-medium" style={{ color: '#9ca89e' }}>
                {he ? 'אזורים פעילים' : 'Active Areas'}
              </p>
            </div>
          </div>
        </div>
        <div className="glass-panel p-5">
          <div className="flex items-center gap-3">
            <div
              className="flex items-center justify-center w-10 h-10 rounded-xl"
              style={{ backgroundColor: 'rgba(90,138,94,0.1)' }}
            >
              <Map className="h-5 w-5" style={{ color: '#5a8a5e' }} />
            </div>
            <div>
              <p className="text-2xl font-bold" style={{ color: '#2d3a2e' }}>
                {totalContractors}
              </p>
              <p className="text-xs font-medium" style={{ color: '#9ca89e' }}>
                {he ? 'קבלנים משויכים' : 'Total Contractors Assigned'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Add ZIP Code Section */}
      <div className="glass-panel p-6 animate-fade-in">
        <h2 className="text-lg font-semibold mb-4" style={{ color: '#2d3a2e' }}>
          {he ? 'הוספת מיקוד' : 'Add ZIP Code'}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Single ZIP input */}
          <div className="space-y-3">
            <label
              className="block text-xs font-semibold uppercase tracking-wider mb-1.5"
              style={{ color: '#9ca89e' }}
            >
              {he ? 'מיקוד בודד' : 'Single ZIP Code'}
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={zipInput}
                onChange={(e) => setZipInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddZip()}
                placeholder={he ? 'לדוגמה: 33101' : 'e.g. 33101'}
                className="flex-1 rounded-xl border text-sm py-2 px-3"
                style={{
                  borderColor: '#e0e4e0',
                  color: '#2d3a2e',
                  fontFamily: 'Outfit, sans-serif',
                }}
              />
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={cityInput}
                onChange={(e) => setCityInput(e.target.value)}
                placeholder={he ? 'עיר (אופציונלי)' : 'City (optional)'}
                className="flex-1 rounded-xl border text-sm py-2 px-3"
                style={{ borderColor: '#e0e4e0', color: '#2d3a2e', fontFamily: 'Outfit, sans-serif' }}
              />
              <input
                type="text"
                value={stateInput}
                onChange={(e) => setStateInput(e.target.value)}
                placeholder={he ? 'מדינה' : 'State (e.g. FL)'}
                className="w-24 rounded-xl border text-sm py-2 px-3"
                style={{ borderColor: '#e0e4e0', color: '#2d3a2e', fontFamily: 'Outfit, sans-serif' }}
              />
            </div>
            <button onClick={handleAddZip} className="btn-primary flex items-center gap-2">
              <Plus className="h-4 w-4" />
              {he ? 'הוסף' : 'Add'}
            </button>
          </div>

          {/* Bulk import */}
          <div>
            <label
              className="block text-xs font-semibold uppercase tracking-wider mb-1.5"
              style={{ color: '#9ca89e' }}
            >
              {he ? 'ייבוא מרובה' : 'Bulk Import'}
            </label>
            <div className="flex gap-2">
              <textarea
                value={bulkInput}
                onChange={(e) => setBulkInput(e.target.value)}
                placeholder={he ? 'מיקודים מופרדים בפסיקים: 33101, 33102, 33130' : 'Comma-separated ZIPs: 33101, 33102, 33130'}
                className="flex-1 rounded-xl border text-sm py-2 px-3 resize-none"
                rows={1}
                style={{
                  borderColor: '#e0e4e0',
                  color: '#2d3a2e',
                  fontFamily: 'Outfit, sans-serif',
                }}
              />
              <button onClick={handleBulkImport} className="btn-primary flex items-center gap-2">
                <Upload className="h-4 w-4" />
                {he ? 'ייבוא' : 'Import'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Map Note */}
      <div
        className="glass-panel p-4 flex items-center gap-3"
        style={{ backgroundColor: 'rgba(90,138,94,0.05)' }}
      >
        <Info className="h-5 w-5 flex-shrink-0" style={{ color: '#9ca89e' }} />
        <p className="text-sm" style={{ color: '#9ca89e' }}>
          {he
            ? 'תצוגת מפה דורשת VITE_MAPBOX_TOKEN'
            : 'Map visualization requires VITE_MAPBOX_TOKEN'}
        </p>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="glass-panel p-12 flex flex-col items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin mb-3" style={{ color: '#5a8a5e' }} />
          <p className="text-sm" style={{ color: '#6b7c6e' }}>{he ? 'טוען אזורים...' : 'Loading areas...'}</p>
        </div>
      )}

      {/* ZIP Code Table */}
      {!loading && (
        <div className="glass-panel overflow-hidden">
          {/* Search */}
          <div className="p-4" style={{ borderBottom: '1px solid #e0e4e0' }}>
            <div className="relative max-w-sm">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4"
                style={{ color: '#9ca89e' }}
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={he ? 'חיפוש מיקוד, עיר או מדינה...' : 'Search ZIP, city, or state...'}
                className="w-full rounded-xl border text-sm py-2 pl-9 pr-3"
                style={{
                  borderColor: '#e0e4e0',
                  color: '#2d3a2e',
                  fontFamily: 'Outfit, sans-serif',
                }}
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm table-sticky">
              <thead>
                <tr style={{ borderBottom: '1px solid #e0e4e0' }}>
                  <th
                    className={thClass}
                    style={{ color: '#9ca89e' }}
                    onClick={() => handleSort('zip_code')}
                  >
                    {he ? 'מיקוד' : 'ZIP Code'}
                    <SortIcon column="zip_code" />
                  </th>
                  <th
                    className={thClass}
                    style={{ color: '#9ca89e' }}
                    onClick={() => handleSort('city')}
                  >
                    {he ? 'עיר' : 'City'}
                    <SortIcon column="city" />
                  </th>
                  <th className={thClass} style={{ color: '#9ca89e' }}>
                    {he ? 'מדינה' : 'State'}
                  </th>
                  <th
                    className={thClass}
                    style={{ color: '#9ca89e' }}
                    onClick={() => handleSort('contractor_count')}
                  >
                    {he ? 'קבלנים' : 'Contractors'}
                    <SortIcon column="contractor_count" />
                  </th>
                  <th
                    className={thClass}
                    style={{ color: '#9ca89e' }}
                    onClick={() => handleSort('is_active')}
                  >
                    {he ? 'סטטוס' : 'Status'}
                    <SortIcon column="is_active" />
                  </th>
                  <th className="px-5 py-3 w-20" />
                </tr>
              </thead>
              <tbody>
                {filteredAreas.map((area) => (
                  <tr
                    key={area.id}
                    className="transition-colors hover:bg-[#f5f7f5]"
                    style={{ borderBottom: '1px solid #eef0ee' }}
                  >
                    <td className="px-5 py-3.5 font-medium" style={{ color: '#2d3a2e' }}>
                      {area.zip_code}
                    </td>
                    <td className="px-5 py-3.5" style={{ color: '#6b7c6e' }}>
                      {area.city || '-'}
                    </td>
                    <td className="px-5 py-3.5" style={{ color: '#6b7c6e' }}>
                      {area.state || '-'}
                    </td>
                    <td className="px-5 py-3.5" style={{ color: '#6b7c6e' }}>
                      {area.contractor_count}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={area.is_active ? 'badge-green' : 'badge-orange'}>
                        {area.is_active
                          ? he
                            ? 'פעיל'
                            : 'Active'
                          : he
                            ? 'ריק'
                            : 'Empty'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <button
                        onClick={() => handleRemove(area.id)}
                        className="p-1.5 rounded-lg transition-colors hover:bg-[#fde8e8]"
                        aria-label={he ? 'הסרה' : 'Remove'}
                      >
                        <Trash2 className="h-4 w-4" style={{ color: '#dc2626' }} />
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredAreas.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center" style={{ color: '#9ca89e' }}>
                      <Map className="h-10 w-10 mx-auto mb-3" style={{ color: '#b0b8b1' }} />
                      <p className="text-sm">
                        {searchQuery.trim()
                          ? he
                            ? 'לא נמצאו תוצאות'
                            : 'No results found'
                          : he
                            ? 'אין מיקודים עדיין'
                            : 'No ZIP codes yet'}
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
