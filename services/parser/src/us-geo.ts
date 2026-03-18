/**
 * US ZIP3-prefix → state → coordinates lookup for the parser worker.
 * Used to populate latitude/longitude when inserting leads.
 */

const STATE_COORDS: Record<string, { lat: number; lng: number }> = {
  AL: { lat: 32.81, lng: -86.79 }, AK: { lat: 61.37, lng: -152.40 },
  AZ: { lat: 33.73, lng: -111.43 }, AR: { lat: 34.97, lng: -92.37 },
  CA: { lat: 36.12, lng: -119.68 }, CO: { lat: 39.06, lng: -105.31 },
  CT: { lat: 41.60, lng: -72.76 }, DE: { lat: 39.32, lng: -75.51 },
  DC: { lat: 38.90, lng: -77.03 }, FL: { lat: 27.77, lng: -81.69 },
  GA: { lat: 33.04, lng: -83.64 }, HI: { lat: 21.09, lng: -157.50 },
  ID: { lat: 44.24, lng: -114.48 }, IL: { lat: 40.35, lng: -88.99 },
  IN: { lat: 39.85, lng: -86.26 }, IA: { lat: 42.01, lng: -93.21 },
  KS: { lat: 38.53, lng: -96.73 }, KY: { lat: 37.67, lng: -84.67 },
  LA: { lat: 31.17, lng: -91.87 }, ME: { lat: 44.69, lng: -69.38 },
  MD: { lat: 39.06, lng: -76.80 }, MA: { lat: 42.23, lng: -71.53 },
  MI: { lat: 43.33, lng: -84.54 }, MN: { lat: 45.69, lng: -93.90 },
  MS: { lat: 32.74, lng: -89.68 }, MO: { lat: 38.46, lng: -92.29 },
  MT: { lat: 46.92, lng: -110.45 }, NE: { lat: 41.13, lng: -98.27 },
  NV: { lat: 38.31, lng: -117.06 }, NH: { lat: 43.45, lng: -71.56 },
  NJ: { lat: 40.30, lng: -74.52 }, NM: { lat: 34.84, lng: -106.25 },
  NY: { lat: 42.17, lng: -74.95 }, NC: { lat: 35.63, lng: -79.81 },
  ND: { lat: 47.53, lng: -99.78 }, OH: { lat: 40.39, lng: -82.76 },
  OK: { lat: 35.57, lng: -96.93 }, OR: { lat: 44.57, lng: -122.07 },
  PA: { lat: 40.59, lng: -77.21 }, RI: { lat: 41.68, lng: -71.51 },
  SC: { lat: 33.86, lng: -80.95 }, SD: { lat: 44.30, lng: -99.44 },
  TN: { lat: 35.75, lng: -86.69 }, TX: { lat: 31.05, lng: -97.56 },
  UT: { lat: 40.15, lng: -111.86 }, VT: { lat: 44.05, lng: -72.71 },
  VA: { lat: 37.77, lng: -78.17 }, WA: { lat: 47.40, lng: -121.49 },
  WV: { lat: 38.49, lng: -80.95 }, WI: { lat: 44.27, lng: -89.62 },
  WY: { lat: 42.76, lng: -107.30 }, PR: { lat: 18.22, lng: -66.59 },
};

/* ZIP3 prefix ranges → state */
const ZIP3_RANGES: [number, number, string][] = [
  [5, 5, 'NY'], [6, 9, 'PR'],
  [10, 27, 'MA'], [28, 29, 'RI'], [30, 38, 'NH'], [39, 49, 'ME'],
  [50, 59, 'VT'], [60, 69, 'CT'], [70, 89, 'NJ'],
  [100, 149, 'NY'], [150, 196, 'PA'], [197, 199, 'DE'],
  [200, 205, 'DC'], [206, 219, 'MD'], [220, 246, 'VA'],
  [247, 268, 'WV'], [270, 289, 'NC'], [290, 299, 'SC'],
  [300, 319, 'GA'], [320, 349, 'FL'], [350, 369, 'AL'],
  [370, 385, 'TN'], [386, 397, 'MS'], [398, 399, 'GA'],
  [400, 427, 'KY'], [430, 458, 'OH'], [460, 479, 'IN'],
  [480, 499, 'MI'], [500, 528, 'IA'], [530, 549, 'WI'],
  [550, 567, 'MN'], [570, 577, 'SD'], [580, 588, 'ND'],
  [590, 599, 'MT'], [600, 629, 'IL'], [630, 658, 'MO'],
  [660, 679, 'KS'], [680, 693, 'NE'],
  [700, 714, 'LA'], [716, 729, 'AR'], [730, 749, 'OK'],
  [750, 799, 'TX'], [800, 816, 'CO'], [820, 831, 'WY'],
  [832, 838, 'ID'], [840, 847, 'UT'], [850, 865, 'AZ'],
  [870, 884, 'NM'], [885, 885, 'TX'], [889, 898, 'NV'],
  [900, 961, 'CA'], [967, 968, 'HI'], [970, 979, 'OR'],
  [980, 994, 'WA'], [995, 999, 'AK'],
];

const zip3ToState = new Map<number, string>();
for (const [min, max, state] of ZIP3_RANGES) {
  for (let i = min; i <= max; i++) {
    zip3ToState.set(i, state);
  }
}

export function getStateFromZip(zip: string | null): string | null {
  if (!zip) return null;
  const prefix = parseInt(zip.slice(0, 3), 10);
  if (isNaN(prefix)) return null;
  return zip3ToState.get(prefix) ?? null;
}

export function getStateCenterCoords(state: string): { lat: number; lng: number } | null {
  return STATE_COORDS[state] ?? null;
}
