/**
 * Static US ZIP3-prefix → state → coordinates lookup.
 * No API calls needed — instant, offline, reliable.
 *
 * ZIP3 = first 3 digits of a US ZIP code.
 * Accuracy: state-level (good enough for a leads overview map).
 */

/* ── State center coordinates ─────────────────────────────── */

const STATE_COORDS: Record<string, { lat: number; lng: number }> = {
  AL: { lat: 32.81, lng: -86.79 },
  AK: { lat: 61.37, lng: -152.40 },
  AZ: { lat: 33.73, lng: -111.43 },
  AR: { lat: 34.97, lng: -92.37 },
  CA: { lat: 36.12, lng: -119.68 },
  CO: { lat: 39.06, lng: -105.31 },
  CT: { lat: 41.60, lng: -72.76 },
  DE: { lat: 39.32, lng: -75.51 },
  DC: { lat: 38.90, lng: -77.03 },
  FL: { lat: 27.77, lng: -81.69 },
  GA: { lat: 33.04, lng: -83.64 },
  HI: { lat: 21.09, lng: -157.50 },
  ID: { lat: 44.24, lng: -114.48 },
  IL: { lat: 40.35, lng: -88.99 },
  IN: { lat: 39.85, lng: -86.26 },
  IA: { lat: 42.01, lng: -93.21 },
  KS: { lat: 38.53, lng: -96.73 },
  KY: { lat: 37.67, lng: -84.67 },
  LA: { lat: 31.17, lng: -91.87 },
  ME: { lat: 44.69, lng: -69.38 },
  MD: { lat: 39.06, lng: -76.80 },
  MA: { lat: 42.23, lng: -71.53 },
  MI: { lat: 43.33, lng: -84.54 },
  MN: { lat: 45.69, lng: -93.90 },
  MS: { lat: 32.74, lng: -89.68 },
  MO: { lat: 38.46, lng: -92.29 },
  MT: { lat: 46.92, lng: -110.45 },
  NE: { lat: 41.13, lng: -98.27 },
  NV: { lat: 38.31, lng: -117.06 },
  NH: { lat: 43.45, lng: -71.56 },
  NJ: { lat: 40.30, lng: -74.52 },
  NM: { lat: 34.84, lng: -106.25 },
  NY: { lat: 42.17, lng: -74.95 },
  NC: { lat: 35.63, lng: -79.81 },
  ND: { lat: 47.53, lng: -99.78 },
  OH: { lat: 40.39, lng: -82.76 },
  OK: { lat: 35.57, lng: -96.93 },
  OR: { lat: 44.57, lng: -122.07 },
  PA: { lat: 40.59, lng: -77.21 },
  RI: { lat: 41.68, lng: -71.51 },
  SC: { lat: 33.86, lng: -80.95 },
  SD: { lat: 44.30, lng: -99.44 },
  TN: { lat: 35.75, lng: -86.69 },
  TX: { lat: 31.05, lng: -97.56 },
  UT: { lat: 40.15, lng: -111.86 },
  VT: { lat: 44.05, lng: -72.71 },
  VA: { lat: 37.77, lng: -78.17 },
  WA: { lat: 47.40, lng: -121.49 },
  WV: { lat: 38.49, lng: -80.95 },
  WI: { lat: 44.27, lng: -89.62 },
  WY: { lat: 42.76, lng: -107.30 },
  PR: { lat: 18.22, lng: -66.59 },
}

/* ── ZIP3 prefix → state mapping ──────────────────────────── */

interface ZipRange {
  min: number
  max: number
  state: string
}

const ZIP3_RANGES: ZipRange[] = [
  { min: 5, max: 5, state: 'NY' },
  { min: 6, max: 9, state: 'PR' },
  { min: 10, max: 27, state: 'MA' },
  { min: 28, max: 29, state: 'RI' },
  { min: 30, max: 38, state: 'NH' },
  { min: 39, max: 49, state: 'ME' },
  { min: 50, max: 59, state: 'VT' },
  { min: 60, max: 69, state: 'CT' },
  { min: 70, max: 89, state: 'NJ' },
  { min: 100, max: 149, state: 'NY' },
  { min: 150, max: 196, state: 'PA' },
  { min: 197, max: 199, state: 'DE' },
  { min: 200, max: 205, state: 'DC' },
  { min: 206, max: 219, state: 'MD' },
  { min: 220, max: 246, state: 'VA' },
  { min: 247, max: 268, state: 'WV' },
  { min: 270, max: 289, state: 'NC' },
  { min: 290, max: 299, state: 'SC' },
  { min: 300, max: 319, state: 'GA' },
  { min: 320, max: 349, state: 'FL' },
  { min: 350, max: 369, state: 'AL' },
  { min: 370, max: 385, state: 'TN' },
  { min: 386, max: 397, state: 'MS' },
  { min: 398, max: 399, state: 'GA' },
  { min: 400, max: 427, state: 'KY' },
  { min: 430, max: 458, state: 'OH' },
  { min: 460, max: 479, state: 'IN' },
  { min: 480, max: 499, state: 'MI' },
  { min: 500, max: 528, state: 'IA' },
  { min: 530, max: 549, state: 'WI' },
  { min: 550, max: 567, state: 'MN' },
  { min: 570, max: 577, state: 'SD' },
  { min: 580, max: 588, state: 'ND' },
  { min: 590, max: 599, state: 'MT' },
  { min: 600, max: 629, state: 'IL' },
  { min: 630, max: 658, state: 'MO' },
  { min: 660, max: 679, state: 'KS' },
  { min: 680, max: 693, state: 'NE' },
  { min: 700, max: 714, state: 'LA' },
  { min: 716, max: 729, state: 'AR' },
  { min: 730, max: 749, state: 'OK' },
  { min: 750, max: 799, state: 'TX' },
  { min: 800, max: 816, state: 'CO' },
  { min: 820, max: 831, state: 'WY' },
  { min: 832, max: 838, state: 'ID' },
  { min: 840, max: 847, state: 'UT' },
  { min: 850, max: 865, state: 'AZ' },
  { min: 870, max: 884, state: 'NM' },
  { min: 885, max: 885, state: 'TX' },
  { min: 889, max: 898, state: 'NV' },
  { min: 900, max: 961, state: 'CA' },
  { min: 967, max: 968, state: 'HI' },
  { min: 970, max: 979, state: 'OR' },
  { min: 980, max: 994, state: 'WA' },
  { min: 995, max: 999, state: 'AK' },
]

/* ── Build fast O(1) lookup from ZIP3 ranges ──────────────── */

const zip3ToState = new Map<number, string>()
for (const { min, max, state } of ZIP3_RANGES) {
  for (let i = min; i <= max; i++) {
    zip3ToState.set(i, state)
  }
}

/* ── US state abbreviations for parsing city strings ──────── */

const US_STATES: Record<string, string> = {
  alabama: 'AL', alaska: 'AK', arizona: 'AZ', arkansas: 'AR', california: 'CA',
  colorado: 'CO', connecticut: 'CT', delaware: 'DE', florida: 'FL', georgia: 'GA',
  hawaii: 'HI', idaho: 'ID', illinois: 'IL', indiana: 'IN', iowa: 'IA',
  kansas: 'KS', kentucky: 'KY', louisiana: 'LA', maine: 'ME', maryland: 'MD',
  massachusetts: 'MA', michigan: 'MI', minnesota: 'MN', mississippi: 'MS',
  missouri: 'MO', montana: 'MT', nebraska: 'NE', nevada: 'NV',
  'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY',
  'north carolina': 'NC', 'north dakota': 'ND', ohio: 'OH', oklahoma: 'OK',
  oregon: 'OR', pennsylvania: 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
  'south dakota': 'SD', tennessee: 'TN', texas: 'TX', utah: 'UT',
  vermont: 'VT', virginia: 'VA', washington: 'WA', 'west virginia': 'WV',
  wisconsin: 'WI', wyoming: 'WY',
}

const STATE_ABBREVS = new Set(Object.values(US_STATES))

/* ── Public API ───────────────────────────────────────────── */

export function getStateFromZip(zip: string | null): string | null {
  if (!zip) return null
  const prefix = parseInt(zip.slice(0, 3), 10)
  if (isNaN(prefix)) return null
  return zip3ToState.get(prefix) ?? null
}

export function getStateFromCity(city: string | null): string | null {
  if (!city) return null

  // Try "City, ST" pattern (e.g. "Portland, OR")
  const commaMatch = city.match(/,\s*([A-Z]{2})\s*$/)
  if (commaMatch && STATE_ABBREVS.has(commaMatch[1])) {
    return commaMatch[1]
  }

  // Try state name as the full city value (e.g. "Florida", "West Virginia")
  const lower = city.toLowerCase().trim()
  if (US_STATES[lower]) return US_STATES[lower]

  return null
}

export function getCoordsForLead(
  zip: string | null,
  city: string | null,
): { lat: number; lng: number; state: string } | null {
  // Try ZIP first (more reliable)
  const stateFromZip = getStateFromZip(zip)
  if (stateFromZip && STATE_COORDS[stateFromZip]) {
    return { ...STATE_COORDS[stateFromZip], state: stateFromZip }
  }

  // Fall back to city parsing
  const stateFromCity = getStateFromCity(city)
  if (stateFromCity && STATE_COORDS[stateFromCity]) {
    return { ...STATE_COORDS[stateFromCity], state: stateFromCity }
  }

  return null
}

/** Add small random offset so markers in the same state don't stack */
export function jitterCoords(
  lat: number,
  lng: number,
  seed: string,
): { lat: number; lng: number } {
  // Simple hash-based deterministic jitter (±1.5 degrees)
  let h = 0
  for (let i = 0; i < seed.length; i++) {
    h = ((h << 5) - h + seed.charCodeAt(i)) | 0
  }
  const latOffset = ((h & 0xff) / 255 - 0.5) * 3
  const lngOffset = (((h >> 8) & 0xff) / 255 - 0.5) * 3
  return { lat: lat + latOffset, lng: lng + lngOffset }
}
