/**
 * Dynamic ZIP code boundary loader.
 * Fetches per-state ZCTA GeoJSON from OpenDataDE on demand and caches in memory.
 * Only loads states that are relevant (from user ZIPs or map viewport).
 */
import { getStateFromZip } from './us-geo'

// State abbreviation → OpenDataDE filename
const STATE_FILES: Record<string, string> = {
  AL: 'al_alabama', AK: 'ak_alaska', AZ: 'az_arizona', AR: 'ar_arkansas',
  CA: 'ca_california', CO: 'co_colorado', CT: 'ct_connecticut', DE: 'de_delaware',
  DC: 'dc_district_of_columbia', FL: 'fl_florida', GA: 'ga_georgia', HI: 'hi_hawaii',
  ID: 'id_idaho', IL: 'il_illinois', IN: 'in_indiana', IA: 'ia_iowa',
  KS: 'ks_kansas', KY: 'ky_kentucky', LA: 'la_louisiana', ME: 'me_maine',
  MD: 'md_maryland', MA: 'ma_massachusetts', MI: 'mi_michigan', MN: 'mn_minnesota',
  MS: 'ms_mississippi', MO: 'mo_missouri', MT: 'mt_montana', NE: 'ne_nebraska',
  NV: 'nv_nevada', NH: 'nh_new_hampshire', NJ: 'nj_new_jersey', NM: 'nm_new_mexico',
  NY: 'ny_new_york', NC: 'nc_north_carolina', ND: 'nd_north_dakota', OH: 'oh_ohio',
  OK: 'ok_oklahoma', OR: 'or_oregon', PA: 'pa_pennsylvania', RI: 'ri_rhode_island',
  SC: 'sc_south_carolina', SD: 'sd_south_dakota', TN: 'tn_tennessee', TX: 'tx_texas',
  UT: 'ut_utah', VT: 'vt_vermont', VA: 'va_virginia', WA: 'wa_washington',
  WV: 'wv_west_virginia', WI: 'wi_wisconsin', WY: 'wy_wyoming',
}

const BASE_URL = 'https://raw.githubusercontent.com/OpenDataDE/State-zip-code-GeoJSON/master'

// Cache: state → GeoJSON features
const stateCache = new Map<string, GeoJSON.Feature[]>()
const loadingStates = new Set<string>()

function normalizeZipProperty(properties: Record<string, any>): string {
  return (
    properties.ZCTA5CE20 ??
    properties.ZCTA5CE10 ??
    properties.ZIP_CODE ??
    properties.ZIPCODE ??
    properties.zip ??
    properties.GEOID20 ??
    properties.GEOID10 ??
    ''
  ).toString()
}

async function fetchStateFeatures(state: string): Promise<GeoJSON.Feature[]> {
  if (stateCache.has(state)) return stateCache.get(state)!
  if (!STATE_FILES[state]) return []

  // Prevent duplicate fetches
  if (loadingStates.has(state)) {
    // Wait for the other fetch to complete
    while (loadingStates.has(state)) {
      await new Promise((r) => setTimeout(r, 100))
    }
    return stateCache.get(state) ?? []
  }

  loadingStates.add(state)
  try {
    const filename = STATE_FILES[state]
    const url = `${BASE_URL}/${filename}_zip_codes_geo.min.json`
    const res = await fetch(url)
    if (!res.ok) {
      console.warn(`Failed to load ZIP boundaries for ${state}: ${res.status}`)
      stateCache.set(state, [])
      return []
    }

    const data: GeoJSON.FeatureCollection = await res.json()
    const features = data.features.map((f) => ({
      ...f,
      properties: { zip: normalizeZipProperty(f.properties ?? {}) },
    }))

    stateCache.set(state, features)
    return features
  } catch (err) {
    console.warn(`Error loading ZIP boundaries for ${state}:`, err)
    stateCache.set(state, [])
    return []
  } finally {
    loadingStates.delete(state)
  }
}

/** Get all states relevant to the given ZIP codes */
export function getStatesFromZips(zips: string[]): Set<string> {
  const states = new Set<string>()
  for (const zip of zips) {
    const state = getStateFromZip(zip)
    if (state) states.add(state)
  }
  return states
}

/** Get state from a lng/lat coordinate (approximate, using state centers) */
export function getStateFromCoords(lng: number, lat: number): string | null {
  // Simple bounding box check for US states — approximate but fast
  // For South Florida default, this will return FL
  if (lat >= 24.5 && lat <= 31 && lng >= -87.6 && lng <= -80) return 'FL'
  if (lat >= 25 && lat <= 49 && lng >= -125 && lng <= -66) {
    // Rough US mainland — use state center proximity
    const STATE_COORDS: Record<string, { lat: number; lng: number }> = {
      AL: { lat: 32.81, lng: -86.79 }, AZ: { lat: 33.73, lng: -111.43 },
      AR: { lat: 34.97, lng: -92.37 }, CA: { lat: 36.12, lng: -119.68 },
      CO: { lat: 39.06, lng: -105.31 }, CT: { lat: 41.60, lng: -72.76 },
      DE: { lat: 39.32, lng: -75.51 }, FL: { lat: 27.77, lng: -81.69 },
      GA: { lat: 33.04, lng: -83.64 }, ID: { lat: 44.24, lng: -114.48 },
      IL: { lat: 40.35, lng: -88.99 }, IN: { lat: 39.85, lng: -86.26 },
      IA: { lat: 42.01, lng: -93.21 }, KS: { lat: 38.53, lng: -96.73 },
      KY: { lat: 37.67, lng: -84.67 }, LA: { lat: 31.17, lng: -91.87 },
      ME: { lat: 44.69, lng: -69.38 }, MD: { lat: 39.06, lng: -76.80 },
      MA: { lat: 42.23, lng: -71.53 }, MI: { lat: 43.33, lng: -84.54 },
      MN: { lat: 45.69, lng: -93.90 }, MS: { lat: 32.74, lng: -89.68 },
      MO: { lat: 38.46, lng: -92.29 }, MT: { lat: 46.92, lng: -110.45 },
      NE: { lat: 41.13, lng: -98.27 }, NV: { lat: 38.31, lng: -117.06 },
      NH: { lat: 43.45, lng: -71.56 }, NJ: { lat: 40.30, lng: -74.52 },
      NM: { lat: 34.84, lng: -106.25 }, NY: { lat: 42.17, lng: -74.95 },
      NC: { lat: 35.63, lng: -79.81 }, ND: { lat: 47.53, lng: -99.78 },
      OH: { lat: 40.39, lng: -82.76 }, OK: { lat: 35.57, lng: -96.93 },
      OR: { lat: 44.57, lng: -122.07 }, PA: { lat: 40.59, lng: -77.21 },
      SC: { lat: 33.86, lng: -80.95 }, SD: { lat: 44.30, lng: -99.44 },
      TN: { lat: 35.75, lng: -86.69 }, TX: { lat: 31.05, lng: -97.56 },
      UT: { lat: 40.15, lng: -111.86 }, VT: { lat: 44.05, lng: -72.71 },
      VA: { lat: 37.77, lng: -78.17 }, WA: { lat: 47.40, lng: -121.49 },
      WV: { lat: 38.49, lng: -80.95 }, WI: { lat: 44.27, lng: -89.62 },
      WY: { lat: 42.76, lng: -107.30 },
    }
    let closest = 'FL'
    let minDist = Infinity
    for (const [st, c] of Object.entries(STATE_COORDS)) {
      const d = (c.lat - lat) ** 2 + (c.lng - lng) ** 2
      if (d < minDist) { minDist = d; closest = st }
    }
    return closest
  }
  return null
}

/**
 * Load ZIP boundary features for the given states.
 * Returns a merged GeoJSON FeatureCollection.
 */
export async function loadZipBoundaries(
  states: string[],
): Promise<GeoJSON.FeatureCollection> {
  const allFeatures = await Promise.all(states.map(fetchStateFeatures))
  return {
    type: 'FeatureCollection',
    features: allFeatures.flat(),
  }
}

/** Check if a state's boundaries are already cached */
export function isStateCached(state: string): boolean {
  return stateCache.has(state)
}
