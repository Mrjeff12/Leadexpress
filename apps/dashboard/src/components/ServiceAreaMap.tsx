import { useRef, useEffect, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { getStatesFromZips, loadZipBoundaries } from '../lib/zip-boundaries'

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN ?? ''

interface ServiceAreaMapProps {
  zipCodes: string[]
  /** Height of the map container. Default: '320px' */
  height?: string
  /** Whether the map is interactive (scroll zoom, drag). Default: false */
  interactive?: boolean
  /** Extra CSS classes for the outer wrapper */
  className?: string
}

/**
 * Read-only service area map for public profiles.
 * Shows the contractor's ZIP code boundaries highlighted on a clean Mapbox map.
 */
export default function ServiceAreaMap({
  zipCodes,
  height = '320px',
  interactive = false,
  className = '',
}: ServiceAreaMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!containerRef.current || !MAPBOX_TOKEN || zipCodes.length === 0) return

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: [-80.14, 26.12], // Default: South Florida
      zoom: 8,
      accessToken: MAPBOX_TOKEN,
      interactive,
      attributionControl: false,
      logoPosition: 'bottom-right',
    })

    mapRef.current = map

    // Disable scroll zoom even in interactive mode (prevents accidental scrolls)
    map.scrollZoom.disable()

    map.on('load', async () => {
      // Load boundaries for relevant states
      const states = getStatesFromZips(zipCodes)
      const geojson = await loadZipBoundaries(Array.from(states))

      if (!map.getSource('zips')) {
        map.addSource('zips', { type: 'geojson', data: geojson })

        // All ZIP boundaries (very subtle)
        map.addLayer({
          id: 'zip-fill-bg',
          type: 'fill',
          source: 'zips',
          paint: {
            'fill-color': '#94a3b8',
            'fill-opacity': 0.03,
          },
        })

        // Selected ZIP fills
        map.addLayer({
          id: 'zip-fill-selected',
          type: 'fill',
          source: 'zips',
          filter: ['in', ['get', 'zip'], ['literal', zipCodes]],
          paint: {
            'fill-color': '#fe5b25',
            'fill-opacity': 0.25,
          },
        })

        // Selected ZIP outlines
        map.addLayer({
          id: 'zip-stroke-selected',
          type: 'line',
          source: 'zips',
          filter: ['in', ['get', 'zip'], ['literal', zipCodes]],
          paint: {
            'line-color': '#fe5b25',
            'line-width': 2,
            'line-opacity': 0.7,
          },
        })

        // ZIP labels for selected areas
        map.addLayer({
          id: 'zip-labels-selected',
          type: 'symbol',
          source: 'zips',
          filter: ['in', ['get', 'zip'], ['literal', zipCodes]],
          layout: {
            'text-field': ['get', 'zip'],
            'text-size': 11,
            'text-font': ['DIN Pro Medium', 'Arial Unicode MS Regular'],
            'text-allow-overlap': false,
          },
          paint: {
            'text-color': '#fe5b25',
            'text-halo-color': '#ffffff',
            'text-halo-width': 1.5,
          },
          minzoom: 9,
        })
      }

      // Fit map to selected ZIP boundaries
      fitToSelectedZips(map, geojson, zipCodes)
      setLoaded(true)
    })

    return () => {
      map.remove()
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zipCodes.join(',')])

  if (!MAPBOX_TOKEN || zipCodes.length === 0) return null

  return (
    <div className={`relative overflow-hidden rounded-2xl ${className}`} style={{ height }}>
      <div ref={containerRef} className="w-full h-full" />

      {/* Loading overlay */}
      {!loaded && (
        <div className="absolute inset-0 bg-gray-100 animate-pulse flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-[#fe5b25] border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* ZIP count badge */}
      {loaded && (
        <div className="absolute top-3 left-3 px-3 py-1.5 rounded-xl bg-white/90 backdrop-blur-sm shadow-lg border border-gray-100">
          <span className="text-xs font-semibold text-gray-700">
            {zipCodes.length} ZIP{zipCodes.length !== 1 ? 's' : ''} covered
          </span>
        </div>
      )}
    </div>
  )
}

/* ── Helpers ── */

function fitToSelectedZips(
  map: mapboxgl.Map,
  geojson: GeoJSON.FeatureCollection,
  zipCodes: string[],
) {
  const selectedFeatures = geojson.features.filter((f) =>
    zipCodes.includes((f.properties as any)?.zip ?? ''),
  )

  if (selectedFeatures.length === 0) return

  const bounds = new mapboxgl.LngLatBounds()
  for (const feature of selectedFeatures) {
    forEachCoord(feature.geometry, (coord) => {
      bounds.extend(coord as [number, number])
    })
  }

  map.fitBounds(bounds, { padding: 40, maxZoom: 12, duration: 0 })
}

function forEachCoord(
  geometry: GeoJSON.Geometry,
  fn: (coord: number[]) => void,
) {
  if (geometry.type === 'Polygon') {
    for (const ring of geometry.coordinates) {
      for (const coord of ring) fn(coord)
    }
  } else if (geometry.type === 'MultiPolygon') {
    for (const polygon of geometry.coordinates) {
      for (const ring of polygon) {
        for (const coord of ring) fn(coord)
      }
    }
  }
}
