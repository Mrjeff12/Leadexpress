import { useState, useMemo } from 'react'
import { useI18n } from '../../lib/i18n'
import { Map, Plus, Trash2, Search, Upload, Info, ArrowUp, ArrowDown } from 'lucide-react'

interface ServiceArea {
  zip: string
  area: string
  contractors: number
  active: boolean
}

const initialAreas: ServiceArea[] = [
  { zip: '62000', area: 'Tel Aviv', contractors: 5, active: true },
  { zip: '32000', area: 'Haifa', contractors: 3, active: true },
  { zip: '84000', area: 'Beer Sheva', contractors: 2, active: true },
  { zip: '46000', area: 'Herzliya', contractors: 2, active: true },
  { zip: '48000', area: 'Netanya', contractors: 1, active: true },
  { zip: '76000', area: 'Rehovot', contractors: 0, active: false },
  { zip: '71000', area: 'Ashdod', contractors: 0, active: false },
  { zip: '44000', area: 'Kfar Saba', contractors: 0, active: false },
]

type SortKey = 'zip' | 'area' | 'contractors' | 'active'
type SortDir = 'asc' | 'desc'

export default function ServiceAreas() {
  const { locale } = useI18n()
  const he = locale === 'he'

  const [areas, setAreas] = useState<ServiceArea[]>(initialAreas)
  const [zipInput, setZipInput] = useState('')
  const [bulkInput, setBulkInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('zip')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  // KPI calculations
  const totalZips = areas.length
  const activeAreas = areas.filter((a) => a.active).length
  const totalContractors = areas.reduce((sum, a) => sum + a.contractors, 0)

  // Add single ZIP
  const handleAddZip = () => {
    const zip = zipInput.trim()
    if (!zip || areas.some((a) => a.zip === zip)) return
    setAreas((prev) => [...prev, { zip, area: `Area ${zip}`, contractors: 0, active: false }])
    setZipInput('')
  }

  // Bulk import
  const handleBulkImport = () => {
    const zips = bulkInput
      .split(',')
      .map((z) => z.trim())
      .filter((z) => z && !areas.some((a) => a.zip === z))
    if (zips.length === 0) return
    const newAreas = zips.map((zip) => ({
      zip,
      area: `Area ${zip}`,
      contractors: 0,
      active: false,
    }))
    setAreas((prev) => [...prev, ...newAreas])
    setBulkInput('')
  }

  // Remove area
  const handleRemove = (zip: string) => {
    setAreas((prev) => prev.filter((a) => a.zip !== zip))
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
        (a) => a.zip.toLowerCase().includes(q) || a.area.toLowerCase().includes(q)
      )
    }
    result = [...result].sort((a, b) => {
      let cmp = 0
      if (sortKey === 'zip') cmp = a.zip.localeCompare(b.zip)
      else if (sortKey === 'area') cmp = a.area.localeCompare(b.area)
      else if (sortKey === 'contractors') cmp = a.contractors - b.contractors
      else if (sortKey === 'active') cmp = (a.active ? 1 : 0) - (b.active ? 1 : 0)
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
          <div>
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
                placeholder={he ? 'לדוגמה: 69000' : 'e.g. 69000'}
                className="flex-1 rounded-xl border text-sm py-2 px-3"
                style={{
                  borderColor: '#e0e4e0',
                  color: '#2d3a2e',
                  fontFamily: 'Outfit, sans-serif',
                }}
              />
              <button onClick={handleAddZip} className="btn-primary flex items-center gap-2">
                <Plus className="h-4 w-4" />
                {he ? 'הוסף' : 'Add'}
              </button>
            </div>
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
                placeholder={he ? 'מיקודים מופרדים בפסיקים: 10000, 20000, 30000' : 'Comma-separated ZIPs: 10000, 20000, 30000'}
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

      {/* ZIP Code Table */}
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
              placeholder={he ? 'חיפוש מיקוד או אזור...' : 'Search ZIP or area...'}
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
                  onClick={() => handleSort('zip')}
                >
                  {he ? 'מיקוד' : 'ZIP Code'}
                  <SortIcon column="zip" />
                </th>
                <th
                  className={thClass}
                  style={{ color: '#9ca89e' }}
                  onClick={() => handleSort('area')}
                >
                  {he ? 'שם אזור' : 'Area Name'}
                  <SortIcon column="area" />
                </th>
                <th
                  className={thClass}
                  style={{ color: '#9ca89e' }}
                  onClick={() => handleSort('contractors')}
                >
                  {he ? 'קבלנים משויכים' : 'Contractors Assigned'}
                  <SortIcon column="contractors" />
                </th>
                <th
                  className={thClass}
                  style={{ color: '#9ca89e' }}
                  onClick={() => handleSort('active')}
                >
                  {he ? 'סטטוס' : 'Status'}
                  <SortIcon column="active" />
                </th>
                <th className="px-5 py-3 w-20" />
              </tr>
            </thead>
            <tbody>
              {filteredAreas.map((area) => (
                <tr
                  key={area.zip}
                  className="transition-colors hover:bg-[#f5f7f5]"
                  style={{ borderBottom: '1px solid #eef0ee' }}
                >
                  <td className="px-5 py-3.5 font-medium" style={{ color: '#2d3a2e' }}>
                    {area.zip}
                  </td>
                  <td className="px-5 py-3.5" style={{ color: '#6b7c6e' }}>
                    {area.area}
                  </td>
                  <td className="px-5 py-3.5" style={{ color: '#6b7c6e' }}>
                    {area.contractors}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={area.active ? 'badge-green' : 'badge-orange'}>
                      {area.active
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
                      onClick={() => handleRemove(area.zip)}
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
                  <td colSpan={5} className="px-5 py-12 text-center" style={{ color: '#9ca89e' }}>
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
    </div>
  )
}
