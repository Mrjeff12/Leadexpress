/**
 * Hierarchical service area selector: State → County → ZIPs
 * Used in onboarding instead of the raw map.
 * Loads counties from US Census API and ZIPs from OpenDataDE boundaries.
 */
import { useState, useEffect, useRef } from 'react'
import { Search, MapPin, X, ChevronLeft, Check, Loader2, Plus, Building2 } from 'lucide-react'
import { loadZipBoundaries } from '../../lib/zip-boundaries'

// ── Static data ───────────────────────────────────────────────────────────────

const US_STATES = [
  { code: 'AL', name: 'Alabama',       fips: '01' },
  { code: 'AK', name: 'Alaska',        fips: '02' },
  { code: 'AZ', name: 'Arizona',       fips: '04' },
  { code: 'AR', name: 'Arkansas',      fips: '05' },
  { code: 'CA', name: 'California',    fips: '06' },
  { code: 'CO', name: 'Colorado',      fips: '08' },
  { code: 'CT', name: 'Connecticut',   fips: '09' },
  { code: 'DE', name: 'Delaware',      fips: '10' },
  { code: 'FL', name: 'Florida',       fips: '12' },
  { code: 'GA', name: 'Georgia',       fips: '13' },
  { code: 'HI', name: 'Hawaii',        fips: '15' },
  { code: 'ID', name: 'Idaho',         fips: '16' },
  { code: 'IL', name: 'Illinois',      fips: '17' },
  { code: 'IN', name: 'Indiana',       fips: '18' },
  { code: 'IA', name: 'Iowa',          fips: '19' },
  { code: 'KS', name: 'Kansas',        fips: '20' },
  { code: 'KY', name: 'Kentucky',      fips: '21' },
  { code: 'LA', name: 'Louisiana',     fips: '22' },
  { code: 'ME', name: 'Maine',         fips: '23' },
  { code: 'MD', name: 'Maryland',      fips: '24' },
  { code: 'MA', name: 'Massachusetts', fips: '25' },
  { code: 'MI', name: 'Michigan',      fips: '26' },
  { code: 'MN', name: 'Minnesota',     fips: '27' },
  { code: 'MS', name: 'Mississippi',   fips: '28' },
  { code: 'MO', name: 'Missouri',      fips: '29' },
  { code: 'MT', name: 'Montana',       fips: '30' },
  { code: 'NE', name: 'Nebraska',      fips: '31' },
  { code: 'NV', name: 'Nevada',        fips: '32' },
  { code: 'NH', name: 'New Hampshire', fips: '33' },
  { code: 'NJ', name: 'New Jersey',    fips: '34' },
  { code: 'NM', name: 'New Mexico',    fips: '35' },
  { code: 'NY', name: 'New York',      fips: '36' },
  { code: 'NC', name: 'North Carolina',fips: '37' },
  { code: 'ND', name: 'North Dakota',  fips: '38' },
  { code: 'OH', name: 'Ohio',          fips: '39' },
  { code: 'OK', name: 'Oklahoma',      fips: '40' },
  { code: 'OR', name: 'Oregon',        fips: '41' },
  { code: 'PA', name: 'Pennsylvania',  fips: '42' },
  { code: 'RI', name: 'Rhode Island',  fips: '44' },
  { code: 'SC', name: 'South Carolina',fips: '45' },
  { code: 'SD', name: 'South Dakota',  fips: '46' },
  { code: 'TN', name: 'Tennessee',     fips: '47' },
  { code: 'TX', name: 'Texas',         fips: '48' },
  { code: 'UT', name: 'Utah',          fips: '49' },
  { code: 'VT', name: 'Vermont',       fips: '50' },
  { code: 'VA', name: 'Virginia',      fips: '51' },
  { code: 'WA', name: 'Washington',    fips: '53' },
  { code: 'WV', name: 'West Virginia', fips: '54' },
  { code: 'WI', name: 'Wisconsin',     fips: '55' },
  { code: 'WY', name: 'Wyoming',       fips: '56' },
]

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SelectedArea {
  state: string       // "FL"
  stateName: string   // "Florida"
  county: string      // "Broward County"
  zips: string[]
}

interface Props {
  selectedAreas: SelectedArea[]
  onAddArea: (area: SelectedArea) => void
  onRemoveArea: (state: string, county: string) => void
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Fetch all counties for a US state from Census Bureau API (free, no key) */
async function fetchCounties(fips: string): Promise<string[]> {
  const url = `https://api.census.gov/data/2020/dec/pl?get=NAME&for=county:*&in=state:${fips}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Census API error: ${res.status}`)
  const data: string[][] = await res.json()
  // Skip header row [0], strip ", {State Name}" suffix
  return data
    .slice(1)
    .map((row) => row[0].replace(/,\s[^,]+$/, ''))
    .sort()
}

/** Get county bounding box from Mapbox geocoding */
async function getCountyBbox(county: string, stateName: string): Promise<[number, number, number, number] | null> {
  const token = import.meta.env.VITE_MAPBOX_TOKEN
  if (!token) return null
  const query = encodeURIComponent(`${county}, ${stateName}, USA`)
  const res = await fetch(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${query}.json?types=district&country=US&limit=1&access_token=${token}`
  )
  if (!res.ok) return null
  const data = await res.json()
  const bbox = data.features?.[0]?.bbox
  return bbox ?? null
}

/** Approximate centroid of a GeoJSON polygon ring */
function ringCentroid(ring: number[][]): [number, number] {
  let lng = 0, lat = 0
  for (const p of ring) { lng += p[0]; lat += p[1] }
  return [lng / ring.length, lat / ring.length]
}

/** Get all ZIP codes whose centroid falls within a bounding box */
async function getZipsInBbox(
  stateCode: string,
  bbox: [number, number, number, number],
): Promise<string[]> {
  const [minLng, minLat, maxLng, maxLat] = bbox
  const fc = await loadZipBoundaries([stateCode])
  const zips: string[] = []
  for (const f of fc.features) {
    const zip = (f.properties as any)?.zip as string
    if (!zip) continue
    const geom = f.geometry as any
    let centroid: [number, number] | null = null
    if (geom.type === 'Polygon') {
      centroid = ringCentroid(geom.coordinates[0])
    } else if (geom.type === 'MultiPolygon') {
      centroid = ringCentroid(geom.coordinates[0][0])
    }
    if (!centroid) continue
    const [cLng, cLat] = centroid
    if (cLng >= minLng && cLng <= maxLng && cLat >= minLat && cLat <= maxLat) {
      zips.push(zip)
    }
  }
  return zips
}

// County list cache
const countyCache = new Map<string, string[]>()

// ── Component ─────────────────────────────────────────────────────────────────

type View = 'state' | 'county'

export default function ServiceAreaSelector({ selectedAreas, onAddArea, onRemoveArea }: Props) {
  const [view, setView] = useState<View>('state')
  const [selectedState, setSelectedState] = useState<typeof US_STATES[0] | null>(null)
  const [counties, setCounties] = useState<string[]>([])
  const [countiesLoading, setCountiesLoading] = useState(false)
  const [countiesError, setCountiesError] = useState('')
  const [stateSearch, setStateSearch] = useState('')
  const [countySearch, setCountySearch] = useState('')
  const [addingCounty, setAddingCounty] = useState<string | null>(null)
  const [addError, setAddError] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)

  // If user already has areas selected, start in the county view of the most recent state
  useEffect(() => {
    if (selectedAreas.length > 0 && !selectedState) {
      const lastArea = selectedAreas[selectedAreas.length - 1]
      const state = US_STATES.find((s) => s.code === lastArea.state)
      if (state) pickState(state)
    }
  }, [])

  async function pickState(state: typeof US_STATES[0]) {
    setSelectedState(state)
    setView('county')
    setCountySearch('')
    setAddError('')

    // Load counties (with cache)
    if (countyCache.has(state.fips)) {
      setCounties(countyCache.get(state.fips)!)
      return
    }
    setCountiesLoading(true)
    setCountiesError('')
    try {
      const list = await fetchCounties(state.fips)
      countyCache.set(state.fips, list)
      setCounties(list)
      setTimeout(() => searchRef.current?.focus(), 100)
    } catch {
      setCountiesError('Failed to load counties. Please try again.')
    } finally {
      setCountiesLoading(false)
    }
  }

  async function addCounty(county: string) {
    if (!selectedState || addingCounty) return
    // Check if already added
    const alreadyAdded = selectedAreas.some(
      (a) => a.state === selectedState.code && a.county === county
    )
    if (alreadyAdded) return

    setAddingCounty(county)
    setAddError('')
    try {
      const bbox = await getCountyBbox(county, selectedState.name)
      if (!bbox) throw new Error('Could not locate county')
      const zips = await getZipsInBbox(selectedState.code, bbox)
      if (zips.length === 0) {
        setAddError(`No ZIP codes found for ${county}. Try adding an adjacent county.`)
        return
      }
      onAddArea({ state: selectedState.code, stateName: selectedState.name, county, zips })
    } catch (err) {
      setAddError('Failed to load ZIP codes. Please check your connection and try again.')
    } finally {
      setAddingCounty(null)
    }
  }

  const filteredCounties = counties.filter((c) =>
    c.toLowerCase().includes(countySearch.toLowerCase())
  )

  // Group selected areas by state for display
  const areasByState = selectedAreas.reduce<Record<string, SelectedArea[]>>((acc, a) => {
    if (!acc[a.state]) acc[a.state] = []
    acc[a.state].push(a)
    return acc
  }, {})

  const totalZips = selectedAreas.reduce((sum, a) => sum + a.zips.length, 0)

  // ── State picker ──────────────────────────────────────────────────────────

  if (view === 'state') {
    return (
      <div className="space-y-4">
        <div className="text-center">
          <h1 className="text-base md:text-lg font-bold text-zinc-900">Your service areas</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Pick your state, then select counties where you work
          </p>
        </div>

        {/* Selected areas summary */}
        {selectedAreas.length > 0 && (
          <div className="bg-[#fff4ef] border border-[#fee8df] rounded-2xl p-4 space-y-2">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-semibold text-[#e04d1c] uppercase tracking-wide">
                Selected areas
              </p>
              <span className="text-xs text-zinc-500">{totalZips} ZIP codes total</span>
            </div>
            {Object.entries(areasByState).map(([stateCode, areas]) => (
              <div key={stateCode}>
                <p className="text-xs font-semibold text-zinc-600 mb-1.5">{areas[0].stateName}</p>
                <div className="flex flex-wrap gap-2">
                  {areas.map((area) => (
                    <div
                      key={area.county}
                      className="flex items-center gap-1.5 bg-white border border-[#fee8df] rounded-full px-3 py-1 text-sm font-medium text-zinc-700"
                    >
                      <span>{area.county.replace(' County', '')}</span>
                      <span className="text-[#fe5b25] text-xs">·{area.zips.length}</span>
                      <button
                        type="button"
                        onClick={() => onRemoveArea(area.state, area.county)}
                        className="ml-0.5 hover:text-red-500 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* State grid */}
        <div>
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-3">
            {selectedAreas.length > 0 ? 'Add more counties' : 'Select a state'}
          </p>
          {/* State search */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              type="text"
              value={stateSearch}
              onChange={(e) => setStateSearch(e.target.value)}
              placeholder="Search state..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border-2 border-zinc-200 bg-white text-sm text-zinc-800 placeholder:text-zinc-300 outline-none focus:border-[#fe5b25] transition-colors"
            />
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
            {US_STATES.filter((s) =>
              s.name.toLowerCase().includes(stateSearch.toLowerCase()) ||
              s.code.toLowerCase().includes(stateSearch.toLowerCase())
            ).map((state) => {
              const hasSelection = selectedAreas.some((a) => a.state === state.code)
              return (
                <button
                  key={state.code}
                  type="button"
                  onClick={() => pickState(state)}
                  className={`flex flex-col items-center gap-1 py-3 px-2 rounded-xl border-2 transition-all active:scale-[0.95] ${
                    hasSelection
                      ? 'border-[#fe5b25] bg-[#fff4ef]'
                      : 'border-zinc-200 bg-white hover:border-[#fe5b25]/40 hover:bg-zinc-50'
                  }`}
                >
                  <span className={`text-sm font-bold ${hasSelection ? 'text-[#e04d1c]' : 'text-zinc-800'}`}>
                    {state.code}
                  </span>
                  <span className={`text-[9px] font-medium text-center leading-tight ${hasSelection ? 'text-[#fe5b25]' : 'text-zinc-400'}`}>
                    {state.name.length > 8 ? state.code : state.name}
                  </span>
                  {hasSelection && (
                    <div className="w-4 h-4 rounded-full bg-[#fe5b25] flex items-center justify-center">
                      <Check className="w-2.5 h-2.5 text-white" />
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  // ── County picker ─────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => { setView('state'); setCountySearch('') }}
          className="w-9 h-9 rounded-xl bg-zinc-100 flex items-center justify-center hover:bg-zinc-200 transition-colors flex-shrink-0"
        >
          <ChevronLeft className="w-5 h-5 text-zinc-600" />
        </button>
        <div>
          <h1 className="text-base font-bold text-zinc-900">
            {selectedState?.name} Counties
          </h1>
          <p className="text-xs text-zinc-500">Tap a county to add all its ZIP codes</p>
        </div>
      </div>

      {/* Already selected for this state */}
      {selectedAreas.filter((a) => a.state === selectedState?.code).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedAreas
            .filter((a) => a.state === selectedState?.code)
            .map((area) => (
              <div
                key={area.county}
                className="flex items-center gap-1.5 bg-[#fff4ef] border border-[#fee8df] rounded-full px-3 py-1.5 text-sm font-medium text-[#e04d1c]"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{area.county.replace(' County', '')} Co.</span>
                <span className="text-xs opacity-70">·{area.zips.length}</span>
                <button
                  type="button"
                  onClick={() => onRemoveArea(area.state, area.county)}
                  className="ml-0.5 hover:text-red-500 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
        <input
          ref={searchRef}
          type="text"
          value={countySearch}
          onChange={(e) => setCountySearch(e.target.value)}
          placeholder="Search counties..."
          className="w-full pl-10 pr-4 py-3 rounded-xl border-2 border-zinc-200 bg-white text-sm text-zinc-800 placeholder:text-zinc-300 outline-none focus:border-[#fe5b25] transition-colors"
        />
      </div>

      {/* Error */}
      {addError && (
        <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-2.5 text-sm text-red-600">
          {addError}
        </div>
      )}

      {/* County list */}
      {countiesLoading ? (
        <div className="flex flex-col items-center gap-3 py-10 text-zinc-400">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span className="text-sm">Loading counties...</span>
        </div>
      ) : countiesError ? (
        <div className="text-center py-8">
          <p className="text-sm text-red-500 mb-3">{countiesError}</p>
          <button
            type="button"
            onClick={() => selectedState && pickState(selectedState)}
            className="px-4 py-2 rounded-xl bg-zinc-100 text-sm font-semibold text-zinc-700 hover:bg-zinc-200 transition-colors"
          >
            Retry
          </button>
        </div>
      ) : (
        <div className="space-y-1.5 max-h-[420px] overflow-y-auto pr-1">
          {filteredCounties.length === 0 ? (
            <p className="text-center text-sm text-zinc-400 py-8">No counties match your search</p>
          ) : (
            filteredCounties.map((county) => {
              const isAdded = selectedAreas.some(
                (a) => a.state === selectedState?.code && a.county === county
              )
              const isLoading = addingCounty === county

              return (
                <button
                  key={county}
                  type="button"
                  disabled={isAdded || !!addingCounty}
                  onClick={() => addCounty(county)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all text-left ${
                    isAdded
                      ? 'border-[#fe5b25]/30 bg-[#fff4ef] cursor-default'
                      : addingCounty && !isLoading
                      ? 'border-zinc-100 bg-zinc-50 opacity-50 cursor-not-allowed'
                      : 'border-zinc-200 bg-white hover:border-[#fe5b25]/50 hover:bg-zinc-50 active:scale-[0.98]'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${isAdded ? 'bg-[#fe5b25]' : 'bg-zinc-100'}`}>
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 text-zinc-500 animate-spin" />
                    ) : isAdded ? (
                      <Check className="w-4 h-4 text-white" />
                    ) : (
                      <Building2 className="w-4 h-4 text-zinc-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold ${isAdded ? 'text-[#e04d1c]' : 'text-zinc-800'}`}>
                      {county}
                    </p>
                    {isAdded && (
                      <p className="text-xs text-[#fe5b25]">
                        {selectedAreas.find((a) => a.state === selectedState?.code && a.county === county)?.zips.length} ZIP codes added
                      </p>
                    )}
                    {isLoading && (
                      <p className="text-xs text-zinc-400">Loading ZIP codes...</p>
                    )}
                  </div>
                  {!isAdded && !isLoading && (
                    <Plus className="w-4 h-4 text-zinc-400 flex-shrink-0" />
                  )}
                </button>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
