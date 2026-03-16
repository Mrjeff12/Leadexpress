import { APIProvider, Map, AdvancedMarker } from '@vis.gl/react-google-maps'
import { useI18n } from '../../lib/i18n'

const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY ?? ''

// Approximate centroids for common US ZIP codes — extend or use geocoding API in production
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
