import { useRef, useEffect, useCallback } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { MapPin } from 'lucide-react'
import { useI18n } from '../../lib/i18n'

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN ?? ''

// Cache geocoded ZIP → [lng, lat] so we don't re-fetch on every render
const zipCache: Record<string, [number, number]> = {}

async function geocodeZip(zip: string): Promise<[number, number] | null> {
  if (zipCache[zip]) return zipCache[zip]
  try {
    const res = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${zip}.json?country=us&types=postcode&limit=1&access_token=${MAPBOX_TOKEN}`
    )
    const data = await res.json()
    const coords = data.features?.[0]?.center as [number, number] | undefined
    if (coords) {
      zipCache[zip] = coords
      return coords
    }
  } catch { /* ignore geocoding failures */ }
  return null
}

function createZipMarkerElement(zip: string): HTMLDivElement {
  const el = document.createElement('div')
  const span = document.createElement('span')
  span.textContent = zip
  el.appendChild(span)
  el.style.cssText = `
    background: #10b981;
    color: white;
    font-size: 10px;
    font-weight: 700;
    padding: 2px 8px;
    border-radius: 999px;
    box-shadow: 0 2px 8px rgba(16,185,129,0.3);
    white-space: nowrap;
    pointer-events: none;
  `
  return el
}

interface Props {
  zipCodes: string[]
}

export default function CoverageMap({ zipCodes }: Props) {
  const { locale } = useI18n()
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const markersRef = useRef<mapboxgl.Marker[]>([])

  // Initialize map centered on South Florida (default service area)
  useEffect(() => {
    if (!MAPBOX_TOKEN || !containerRef.current || mapRef.current) return

    mapboxgl.accessToken = MAPBOX_TOKEN

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: [-80.14, 26.12], // South Florida default
      zoom: 9,
      attributionControl: false,
      interactive: true,
    })

    map.addControl(new mapboxgl.NavigationControl(), 'top-right')

    map.on('load', () => {
      // Map ready — markers are added via updateZips
    })

    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  // Geocode ZIP codes and update map
  const updateZips = useCallback(async () => {
    const map = mapRef.current
    if (!map || zipCodes.length === 0) return

    // Wait for map style to load
    if (!map.isStyleLoaded()) {
      map.once('load', () => updateZips())
      return
    }

    // Clear old markers
    markersRef.current.forEach((m) => m.remove())
    markersRef.current = []

    // Geocode all ZIPs in parallel
    const results = await Promise.all(
      zipCodes.map(async (zip) => {
        const coords = await geocodeZip(zip)
        return coords ? { zip, coords } : null
      })
    )

    const valid = results.filter(Boolean) as { zip: string; coords: [number, number] }[]
    if (valid.length === 0) return

    // Add ZIP label markers
    valid.forEach(({ zip, coords }) => {
      const marker = new mapboxgl.Marker({ element: createZipMarkerElement(zip) })
        .setLngLat(coords)
        .addTo(map)
      markersRef.current.push(marker)
    })

    // Fit map to show all ZIP codes
    if (valid.length === 1) {
      map.flyTo({ center: valid[0].coords, zoom: 12, duration: 1200 })
    } else {
      const bounds = new mapboxgl.LngLatBounds()
      valid.forEach(({ coords }) => bounds.extend(coords))
      map.fitBounds(bounds, { padding: 80, duration: 1200 })
    }
  }, [zipCodes])

  useEffect(() => {
    updateZips()
  }, [updateZips])

  if (!MAPBOX_TOKEN) {
    return (
      <div className="flex items-center justify-center h-full w-full rounded-xl"
        style={{
          background: 'linear-gradient(135deg, hsl(152 46% 92%) 0%, hsl(155 30% 96%) 30%, hsl(200 20% 95%) 60%, hsl(220 15% 94%) 100%)',
        }}
      >
        <div className="text-center">
          <div className="w-12 h-12 rounded-2xl bg-white/60 backdrop-blur flex items-center justify-center mx-auto mb-3 shadow-sm">
            <MapPin className="w-6 h-6 text-emerald-500/60" />
          </div>
          <p className="text-sm text-stone-400 font-medium">
            {locale === 'he'
              ? 'הוסף VITE_MAPBOX_TOKEN להצגת מפה'
              : 'Add VITE_MAPBOX_TOKEN to display map'}
          </p>
        </div>
      </div>
    )
  }

  return <div ref={containerRef} className="w-full h-full rounded-xl" />
}
