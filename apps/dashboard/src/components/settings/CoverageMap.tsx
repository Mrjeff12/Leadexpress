import { useRef, useEffect, useCallback, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { MapPin, Search, Loader2, X, MousePointerClick, Building2, Map } from 'lucide-react'
import { useI18n } from '../../lib/i18n'
import {
  getStatesFromZips,
  getStateFromCoords,
  loadZipBoundaries,
} from '../../lib/zip-boundaries'

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN ?? ''

interface SearchResult {
  id: string
  place_name: string
  center: [number, number]
  text: string
  bbox?: [number, number, number, number]
  place_type?: string[]
}

interface Props {
  zipCodes: string[]
  onAddZip?: (zip: string) => void
  onRemoveZip?: (zip: string) => void
  onBatchAddZips?: (zips: string[]) => void
}

export default function CoverageMap({ zipCodes, onAddZip, onRemoveZip, onBatchAddZips }: Props) {
  const { locale } = useI18n()
  const he = locale === 'he'
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const zipCodesRef = useRef(zipCodes)
  zipCodesRef.current = zipCodes
  const loadedStatesRef = useRef(new Set<string>())
  const [loadingBoundaries, setLoadingBoundaries] = useState(false)

  // Stable callback refs to avoid stale closures in map event handlers
  const onAddZipRef = useRef(onAddZip)
  onAddZipRef.current = onAddZip
  const onRemoveZipRef = useRef(onRemoveZip)
  onRemoveZipRef.current = onRemoveZip
  const onBatchAddZipsRef = useRef(onBatchAddZips)
  onBatchAddZipsRef.current = onBatchAddZips

  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const searchRef = useRef<HTMLDivElement>(null)

  // Batch add state — shown after selecting a city/county from search
  const [batchAddInfo, setBatchAddInfo] = useState<{ name: string; zips: string[] } | null>(null)
  const pendingBatchRef = useRef<{ name: string } | null>(null)

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowResults(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Autocomplete search
  useEffect(() => {
    clearTimeout(searchTimeoutRef.current)
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setSearchResults([])
      setShowResults(false)
      return
    }
    setSearching(true)
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(searchQuery)}.json?country=us&types=postcode,place,locality,neighborhood,district&limit=6&autocomplete=true&access_token=${MAPBOX_TOKEN}`
        )
        const data = await res.json()
        setSearchResults(data.features ?? [])
        setShowResults(true)
      } catch { /* ignore */ }
      setSearching(false)
    }, 300)
    return () => clearTimeout(searchTimeoutRef.current)
  }, [searchQuery])

  const handleSelectResult = (result: SearchResult) => {
    const map = mapRef.current
    if (!map) return

    const isZip = /^\d{5}$/.test(result.text)
    setBatchAddInfo(null)

    if (isZip) {
      map.flyTo({ center: result.center, zoom: 12, duration: 1200 })
      if (onAddZipRef.current && !zipCodesRef.current.includes(result.text)) {
        onAddZipRef.current(result.text)
      }
    } else {
      // City / County / Locality → fly to area + offer batch add
      pendingBatchRef.current = { name: result.text }
      if (result.bbox) {
        map.fitBounds(
          [[result.bbox[0], result.bbox[1]], [result.bbox[2], result.bbox[3]]],
          { padding: 60, duration: 1400 },
        )
      } else {
        map.flyTo({ center: result.center, zoom: 11, duration: 1200 })
      }
    }

    setSearchQuery(result.place_name)
    setShowResults(false)
  }

  // After map settles and boundaries load, resolve any pending batch add
  const resolvePendingBatch = useCallback(() => {
    const map = mapRef.current
    if (!map || !pendingBatchRef.current) return
    const name = pendingBatchRef.current.name
    pendingBatchRef.current = null

    // Small delay to let tiles render
    setTimeout(() => {
      if (!map.getLayer('zip-fill-all')) return
      const features = map.queryRenderedFeatures({ layers: ['zip-fill-all'] })
      const seen = new Set<string>()
      const newZips: string[] = []
      for (const f of features) {
        const zip = f.properties?.zip as string | undefined
        if (!zip || seen.has(zip) || zipCodesRef.current.includes(zip)) continue
        seen.add(zip)
        newZips.push(zip)
      }
      if (newZips.length > 0) {
        setBatchAddInfo({ name, zips: newZips })
      }
    }, 400)
  }, [])

  // Helper: update the paint expression for selected vs unselected
  const updateSelectedPaint = useCallback((map: mapboxgl.Map) => {
    const selected = zipCodesRef.current
    if (!map.getLayer('zip-fill-all')) return

    const colorExpr: mapboxgl.Expression = selected.length > 0
      ? ['case', ['in', ['get', 'zip'], ['literal', selected]], 'rgba(16,185,129,0.35)', 'rgba(0,0,0,0.02)']
      : ['literal', 'rgba(0,0,0,0.02)']

    const strokeExpr: mapboxgl.Expression = selected.length > 0
      ? ['case', ['in', ['get', 'zip'], ['literal', selected]], 'rgba(16,185,129,0.8)', 'rgba(0,0,0,0.08)']
      : ['literal', 'rgba(0,0,0,0.08)']

    const widthExpr: mapboxgl.Expression = selected.length > 0
      ? ['case', ['in', ['get', 'zip'], ['literal', selected]], 2.5, 0.5]
      : ['literal', 0.5]

    map.setPaintProperty('zip-fill-all', 'fill-color', colorExpr)
    map.setPaintProperty('zip-stroke-all', 'line-color', strokeExpr)
    map.setPaintProperty('zip-stroke-all', 'line-width', widthExpr)

    // Show labels only for selected
    if (map.getLayer('zip-labels-selected')) {
      const labelFilter: mapboxgl.Expression = selected.length > 0
        ? ['in', ['get', 'zip'], ['literal', selected]]
        : ['literal', false]
      map.setFilter('zip-labels-selected', labelFilter)
    }
  }, [])

  // Load boundaries for states visible in the viewport
  const loadVisibleBoundaries = useCallback(async () => {
    const map = mapRef.current
    if (!map || !map.isStyleLoaded()) return

    const center = map.getCenter()
    const bounds = map.getBounds()
    if (!bounds) return

    // Determine which states are visible
    const statesInView = new Set<string>()
    const corners = [
      [bounds.getWest(), bounds.getNorth()],
      [bounds.getEast(), bounds.getNorth()],
      [bounds.getWest(), bounds.getSouth()],
      [bounds.getEast(), bounds.getSouth()],
      [center.lng, center.lat],
    ]
    for (const [lng, lat] of corners) {
      const st = getStateFromCoords(lng, lat)
      if (st) statesInView.add(st)
    }

    // Also add states from selected ZIPs
    const selectedStates = getStatesFromZips(zipCodesRef.current)
    selectedStates.forEach((s) => statesInView.add(s))

    // Filter to states we haven't loaded yet
    const newStates = [...statesInView].filter((s) => !loadedStatesRef.current.has(s))
    if (newStates.length === 0) return

    setLoadingBoundaries(true)
    const newData = await loadZipBoundaries(newStates)
    newStates.forEach((s) => loadedStatesRef.current.add(s))

    // Merge with existing source data
    const source = map.getSource('zip-all') as mapboxgl.GeoJSONSource | undefined
    if (source) {
      // Get existing data by rebuilding from cache
      const allLoadedStates = [...loadedStatesRef.current]
      const allData = await loadZipBoundaries(allLoadedStates)
      source.setData(allData)
    } else {
      // First load — create source and layers
      map.addSource('zip-all', { type: 'geojson', data: newData })

      map.addLayer({
        id: 'zip-fill-all',
        type: 'fill',
        source: 'zip-all',
        paint: { 'fill-color': 'rgba(0,0,0,0.02)', 'fill-opacity': 1 },
      })

      map.addLayer({
        id: 'zip-stroke-all',
        type: 'line',
        source: 'zip-all',
        paint: { 'line-color': 'rgba(0,0,0,0.08)', 'line-width': 0.5 },
      })

      map.addLayer({
        id: 'zip-labels-all',
        type: 'symbol',
        source: 'zip-all',
        minzoom: 10,
        layout: {
          'text-field': ['get', 'zip'],
          'text-size': 11,
          'text-font': ['DIN Pro Medium', 'Arial Unicode MS Regular'],
          'text-allow-overlap': false,
        },
        paint: {
          'text-color': 'rgba(0,0,0,0.25)',
          'text-halo-color': '#ffffff',
          'text-halo-width': 1.5,
        },
      })

      map.addLayer({
        id: 'zip-labels-selected',
        type: 'symbol',
        source: 'zip-all',
        filter: ['literal', false],
        layout: {
          'text-field': ['get', 'zip'],
          'text-size': 13,
          'text-font': ['DIN Pro Bold', 'Arial Unicode MS Bold'],
          'text-allow-overlap': true,
        },
        paint: {
          'text-color': '#059669',
          'text-halo-color': '#ffffff',
          'text-halo-width': 2,
        },
      })

      // Click handler — uses refs to always call latest callbacks
      map.on('click', 'zip-fill-all', (e) => {
        if (!e.features?.length) return
        const zip = e.features[0].properties?.zip
        if (!zip) return

        if (zipCodesRef.current.includes(zip)) {
          onRemoveZipRef.current?.(zip)
        } else {
          onAddZipRef.current?.(zip)
        }
      })

      // Hover cursor
      map.on('mouseenter', 'zip-fill-all', () => {
        map.getCanvas().style.cursor = 'pointer'
      })
      map.on('mouseleave', 'zip-fill-all', () => {
        map.getCanvas().style.cursor = ''
      })

      // Hover tooltip
      const popup = new mapboxgl.Popup({
        closeButton: false,
        closeOnClick: false,
        offset: 12,
        className: 'zip-hover-popup',
      })

      map.on('mousemove', 'zip-fill-all', (e) => {
        if (!e.features?.length) return
        const zip = e.features[0].properties?.zip
        if (!zip) return
        const isSelected = zipCodesRef.current.includes(zip)
        const label = isSelected
          ? (he ? `${zip} — לחץ להסרה` : `${zip} — click to remove`)
          : (he ? `${zip} — לחץ להוספה` : `${zip} — click to add`)
        popup.setLngLat(e.lngLat).setHTML(`<span style="font-weight:700;font-size:12px">${label}</span>`).addTo(map)
      })

      map.on('mouseleave', 'zip-fill-all', () => {
        popup.remove()
      })
    }

    updateSelectedPaint(map)
    setLoadingBoundaries(false)

    // If a city/county search is pending, resolve batch add now that boundaries are loaded
    resolvePendingBatch()
  }, [updateSelectedPaint, he, resolvePendingBatch])

  // Initialize map
  useEffect(() => {
    if (!MAPBOX_TOKEN || !containerRef.current || mapRef.current) return
    mapboxgl.accessToken = MAPBOX_TOKEN

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: [-80.14, 26.12],
      zoom: 10,
      attributionControl: false,
      interactive: true,
    })

    map.addControl(new mapboxgl.NavigationControl(), 'top-right')
    mapRef.current = map

    map.on('load', () => {
      loadVisibleBoundaries()
    })

    map.on('moveend', () => {
      loadVisibleBoundaries()
      resolvePendingBatch()
    })

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // When selected zipCodes change, update the paint
  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.isStyleLoaded()) return
    updateSelectedPaint(map)

    // Also load boundaries for newly selected states
    const newStates = [...getStatesFromZips(zipCodes)].filter(
      (s) => !loadedStatesRef.current.has(s)
    )
    if (newStates.length > 0) loadVisibleBoundaries()
  }, [zipCodes, updateSelectedPaint, loadVisibleBoundaries])

  if (!MAPBOX_TOKEN) {
    return (
      <div
        className="flex items-center justify-center h-full w-full"
        style={{
          background:
            'linear-gradient(135deg, hsl(152 46% 92%) 0%, hsl(155 30% 96%) 30%, hsl(200 20% 95%) 60%, hsl(220 15% 94%) 100%)',
        }}
      >
        <div className="text-center">
          <div className="w-12 h-12 rounded-2xl bg-white/60 backdrop-blur flex items-center justify-center mx-auto mb-3 shadow-sm">
            <MapPin className="w-6 h-6 text-[#fe5b25]/60" />
          </div>
          <p className="text-sm text-stone-400 font-medium">
            {he ? 'הוסף VITE_MAPBOX_TOKEN להצגת מפה' : 'Add VITE_MAPBOX_TOKEN to display map'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />

      {/* CTA overlay when no zones selected */}
      {onAddZip && zipCodes.length === 0 && (
        <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
          <div
            className="pointer-events-auto flex flex-col items-center gap-4 px-8 py-6 animate-fade-in"
            style={{
              background: 'linear-gradient(135deg, rgba(255,255,255,0.82), rgba(245,248,255,0.75))',
              backdropFilter: 'blur(40px) saturate(180%)',
              WebkitBackdropFilter: 'blur(40px) saturate(180%)',
              borderRadius: 28,
              border: '1.5px solid rgba(255,255,255,0.6)',
              boxShadow: '0 0 0 0.5px rgba(0,0,0,0.03), 0 12px 48px -8px rgba(0,0,0,0.12), inset 0 0.5px 0 rgba(255,255,255,0.8)',
            }}
          >
            <div className="w-14 h-14 rounded-2xl bg-[#fe5b25]/10 flex items-center justify-center">
              <MousePointerClick className="w-7 h-7 text-[#e04d1c]" />
            </div>
            <div className="text-center">
              <h3 className="text-base font-bold text-stone-800 mb-1">
                {he ? 'סמן את אזורי השירות שלך' : 'Select your service areas'}
              </h3>
              <p className="text-[12px] text-stone-400 font-medium max-w-[260px] leading-relaxed">
                {he
                  ? 'חפש עיר או county להוספה מהירה, או לחץ על אזורי ZIP בודדים במפה'
                  : 'Search a city or county to add quickly, or click individual ZIP areas on the map'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Batch add popup — shown after selecting a city/county */}
      {batchAddInfo && (
        <div
          className="absolute z-20 animate-fade-in"
          style={{ bottom: 80, left: '50%', transform: 'translateX(-50%)' }}
        >
          <div
            className="flex items-center gap-3 px-5 py-3.5"
            style={{
              background: 'linear-gradient(135deg, rgba(255,255,255,0.92), rgba(245,248,255,0.88))',
              backdropFilter: 'blur(40px) saturate(180%)',
              WebkitBackdropFilter: 'blur(40px) saturate(180%)',
              borderRadius: 22,
              border: '1.5px solid rgba(255,255,255,0.7)',
              boxShadow: '0 0 0 0.5px rgba(0,0,0,0.03), 0 8px 40px -6px rgba(0,0,0,0.16), inset 0 0.5px 0 rgba(255,255,255,0.9)',
              whiteSpace: 'nowrap',
            }}
          >
            <div className="w-9 h-9 rounded-xl bg-violet-500/10 flex items-center justify-center shrink-0">
              <Building2 className="w-4.5 h-4.5 text-violet-600" />
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-bold text-stone-800 truncate">
                {he
                  ? `הוסף ${batchAddInfo.zips.length} אזורי ZIP ב-${batchAddInfo.name}`
                  : `Add ${batchAddInfo.zips.length} ZIP zones in ${batchAddInfo.name}`}
              </p>
              <p className="text-[10px] text-stone-400">
                {he ? 'או לחץ על אזורים בנפרד' : 'or click zones individually'}
              </p>
            </div>
            <button
              onClick={() => {
                onBatchAddZipsRef.current?.(batchAddInfo.zips)
                setBatchAddInfo(null)
              }}
              className="px-4 py-2 rounded-xl bg-[#fe5b25] text-white text-[12px] font-bold hover:bg-[#e04d1c] transition-colors shrink-0 shadow-sm"
            >
              {he ? 'הוסף הכל' : 'Add all'}
            </button>
            <button
              onClick={() => setBatchAddInfo(null)}
              className="p-1.5 rounded-full hover:bg-black/5 transition-colors shrink-0"
            >
              <X className="w-3.5 h-3.5 text-stone-400" />
            </button>
          </div>
        </div>
      )}

      {/* Loading indicator */}
      {loadingBoundaries && (
        <div className="absolute bottom-4 left-4 z-20 flex items-center gap-2 px-3 py-2 rounded-xl bg-white/80 backdrop-blur-lg border border-white/60 shadow-sm">
          <Loader2 className="w-3.5 h-3.5 text-[#fe5b25] animate-spin" />
          <span className="text-[10px] font-bold text-stone-500">
            {he ? 'טוען אזורים...' : 'Loading zones...'}
          </span>
        </div>
      )}

      {/* Search Bar */}
      {onAddZip && (
        <div
          ref={searchRef}
          className="absolute z-20"
          style={{ top: 24, right: 60, width: 380 }}
        >
          <div
            className="relative"
            style={{
              background: 'linear-gradient(135deg, rgba(255,255,255,0.72), rgba(245,248,255,0.65))',
              backdropFilter: 'blur(40px) saturate(180%) brightness(1.05)',
              WebkitBackdropFilter: 'blur(40px) saturate(180%) brightness(1.05)',
              borderRadius: 20,
              border: '1.5px solid rgba(255,255,255,0.6)',
              boxShadow: '0 0 0 0.5px rgba(0,0,0,0.03), 0 4px 24px -4px rgba(0,0,0,0.10), inset 0 0.5px 0 rgba(255,255,255,0.8)',
            }}
          >
            <Search
              className="absolute top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none"
              style={{ left: 16 }}
            />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => searchResults.length > 0 && setShowResults(true)}
              placeholder={he ? 'חפש עיר, county, ZIP...' : 'Search city, county, or ZIP...'}
              className="w-full bg-transparent rounded-[20px] pl-11 pr-10 py-3.5 text-sm font-semibold text-stone-800 placeholder:text-stone-400/70 outline-none focus:ring-2 focus:ring-[#fe5b25]/20 transition-all"
            />
            {searching && (
              <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#fe5b25] animate-spin" />
            )}
            {!searching && searchQuery && (
              <button
                onClick={() => { setSearchQuery(''); setSearchResults([]); setShowResults(false) }}
                className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-black/5 text-stone-400 flex items-center justify-center hover:bg-black/10 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {showResults && searchResults.length > 0 && (
            <div
              className="mt-2 overflow-hidden"
              style={{
                background: 'linear-gradient(135deg, rgba(255,255,255,0.85), rgba(245,248,255,0.78))',
                backdropFilter: 'blur(40px) saturate(180%)',
                WebkitBackdropFilter: 'blur(40px) saturate(180%)',
                borderRadius: 20,
                border: '1.5px solid rgba(255,255,255,0.6)',
                boxShadow: '0 0 0 0.5px rgba(0,0,0,0.03), 0 8px 32px -4px rgba(0,0,0,0.14), inset 0 0.5px 0 rgba(255,255,255,0.8)',
              }}
            >
              {searchResults.map((r) => {
                const isZip = /^\d{5}$/.test(r.text)
                const alreadyAdded = isZip && zipCodes.includes(r.text)
                const isCity = r.place_type?.includes('place') || r.place_type?.includes('locality')
                const isCounty = r.place_type?.includes('district')
                const isArea = isCity || isCounty

                return (
                  <button
                    key={r.id}
                    onClick={() => handleSelectResult(r)}
                    disabled={alreadyAdded}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-all border-b border-black/[0.03] last:border-b-0 ${
                      alreadyAdded ? 'opacity-40 cursor-default' : 'hover:bg-white/60'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                      isZip ? 'bg-[#fe5b25]/10 text-[#e04d1c]'
                        : isCounty ? 'bg-blue-500/10 text-blue-600'
                        : isCity ? 'bg-violet-500/10 text-violet-600'
                        : 'bg-black/5 text-stone-400'
                    }`}>
                      {isZip ? <MapPin className="w-4 h-4" /> : isCounty ? <Map className="w-4 h-4" /> : <Building2 className="w-4 h-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-bold text-stone-800 truncate">{r.text}</p>
                      <p className="text-[10px] text-stone-400 truncate">
                        {isArea
                          ? (he ? `לחץ להוספת כל ה-ZIP באזור` : `Click to add all ZIPs in area`)
                          : r.place_name}
                      </p>
                    </div>
                    {isZip && !alreadyAdded && (
                      <span className="text-[10px] font-bold text-white bg-[#fe5b25] px-2.5 py-1 rounded-full shrink-0">
                        + Add
                      </span>
                    )}
                    {isArea && (
                      <span className="text-[10px] font-bold text-white bg-violet-500 px-2.5 py-1 rounded-full shrink-0">
                        {he ? 'בחר אזור' : 'Area'}
                      </span>
                    )}
                    {alreadyAdded && (
                      <span className="text-[10px] font-bold text-stone-400 shrink-0">
                        {he ? 'נוסף' : 'Added'}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
