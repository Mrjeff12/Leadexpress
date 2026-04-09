/**
 * Custom monochrome profession icons — premium design language.
 * 32x32 SVG, 2px stroke, subtle 12% fill on closed shapes.
 * Rendered inside a 48px circle background for premium feel.
 */

function I({ children }: { children: React.ReactNode }) {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  )
}

const F = 'currentColor'   // fill color
const FO = 0.12            // fill opacity

export const PROFESSION_ICONS: Record<string, React.ReactNode> = {
  hvac: (
    <I>
      <rect x="4" y="3" width="16" height="10" rx="2" fill={F} fillOpacity={FO} />
      <path d="M4 8h16" />
      <path d="M9 13v3" /><path d="M12 13v5" /><path d="M15 13v3" />
      <path d="M8 21h8" />
      <circle cx="12" cy="5.5" r="0.5" fill={F} />
    </I>
  ),
  air_duct: (
    <I>
      <path d="M3 8h18v8H3z" fill={F} fillOpacity={FO} />
      <path d="M3 8h18v8H3z" />
      <path d="M7 8V5" /><path d="M12 8V4" /><path d="M17 8V5" />
      <path d="M7 16v3" /><path d="M17 16v3" />
      <path d="M3 12h18" />
    </I>
  ),
  chimney: (
    <I>
      <path d="M4 21h16" />
      <path d="M5 21V10l7-7 7 7v11" fill={F} fillOpacity={FO} />
      <path d="M10 21v-5h4v5" />
      <rect x="14" y="2" width="3" height="5" rx="0.5" fill={F} fillOpacity={FO} />
      <path d="M14 2h3v5h-3z" />
    </I>
  ),
  dryer_vent: (
    <I>
      <circle cx="12" cy="12" r="9" fill={F} fillOpacity={FO} />
      <circle cx="12" cy="12" r="3.5" />
      <path d="M12 3v2.5" /><path d="M12 18.5V21" />
      <path d="M3 12h2.5" /><path d="M18.5 12H21" />
      <path d="M5.6 5.6l1.8 1.8" /><path d="M16.6 16.6l1.8 1.8" />
    </I>
  ),
  garage_door: (
    <I>
      <path d="M3 21V8l9-5 9 5v13" fill={F} fillOpacity={FO} />
      <path d="M6 21V12h12v9" />
      <path d="M6 14.5h12" /><path d="M6 17h12" />
      <path d="M3 21h18" />
    </I>
  ),
  locksmith: (
    <I>
      <circle cx="9.5" cy="9.5" r="6" fill={F} fillOpacity={FO} />
      <circle cx="9.5" cy="9.5" r="2" />
      <path d="M14 14l7 7" />
      <path d="M18 15l2 2" /><path d="M16 17l2 2" />
    </I>
  ),
  roofing: (
    <I>
      <path d="M2 12l10-9 10 9" />
      <path d="M5 12v9h14v-9" fill={F} fillOpacity={FO} />
      <path d="M5 21h14" />
      <path d="M10 21v-4h4v4" />
    </I>
  ),
  plumbing: (
    <I>
      <path d="M7 3v5h4V3" fill={F} fillOpacity={FO} />
      <path d="M7 3v5h4V3" />
      <path d="M9 8v2a4 4 0 0 0 4 4h2" />
      <path d="M15 10v8" />
      <path d="M12 18h6" />
      <circle cx="15" cy="21" r="1.5" fill={F} fillOpacity={FO} />
      <circle cx="15" cy="21" r="1.5" />
    </I>
  ),
  electrical: (
    <I>
      <path d="M13 2L4 14h7l-2 8 9-12h-7l2-8z" fill={F} fillOpacity={FO} />
      <path d="M13 2L4 14h7l-2 8 9-12h-7l2-8z" />
    </I>
  ),
  painting: (
    <I>
      <rect x="4" y="2" width="16" height="6" rx="1.5" fill={F} fillOpacity={FO} />
      <path d="M4 2h16v6H4z" />
      <path d="M10 8v3" /><path d="M14 8v3" />
      <path d="M8 11h8v7a4 4 0 0 1-8 0v-7z" fill={F} fillOpacity={FO} />
      <path d="M8 11h8v7a4 4 0 0 1-8 0v-7z" />
    </I>
  ),
  cleaning: (
    <I>
      <path d="M12 2v5" />
      <path d="M8 7h8l1 14H7L8 7z" fill={F} fillOpacity={FO} />
      <path d="M8 7h8l1 14H7L8 7z" />
      <path d="M10 11v6" /><path d="M14 11v6" />
    </I>
  ),
  carpet_cleaning: (
    <I>
      <rect x="3" y="14" width="18" height="4" rx="1" fill={F} fillOpacity={FO} />
      <path d="M3 14h18v4H3z" />
      <path d="M12 14V5" />
      <path d="M8 9l4-4 4 4" />
      <path d="M3 21h18" />
    </I>
  ),
  renovation: (
    <I>
      <path d="M12 2L2 8h4v12h12V8h4L12 2z" fill={F} fillOpacity={FO} />
      <path d="M6 20h12V8L12 2 6 8v12z" />
      <path d="M9 20v-6h6v6" />
      <path d="M12 14v-3" />
    </I>
  ),
  fencing: (
    <I>
      <path d="M4 6v14" /><path d="M12 4v16" /><path d="M20 6v14" />
      <path d="M4 10h16" /><path d="M4 15h16" />
      <path d="M2 6l2-3 2 3" /><path d="M10 4l2-3 2 3" /><path d="M18 6l2-3 2 3" />
    </I>
  ),
  landscaping: (
    <I>
      <path d="M12 22v-9" />
      <path d="M7 13c-4 0-5-4-3-7 2-1 4 0 5 2a7 7 0 0 1 5-2c2 3 1 7-3 7" fill={F} fillOpacity={FO} />
      <path d="M7 13c-4 0-5-4-3-7 2-1 4 0 5 2a7 7 0 0 1 5-2c2 3 1 7-3 7" />
      <path d="M5 22h14" />
    </I>
  ),
  tiling: (
    <I>
      <rect x="3" y="3" width="8" height="8" rx="1" fill={F} fillOpacity={FO} />
      <rect x="13" y="3" width="8" height="8" rx="1" fill={F} fillOpacity={FO} />
      <rect x="3" y="13" width="8" height="8" rx="1" fill={F} fillOpacity={FO} />
      <rect x="13" y="13" width="8" height="8" rx="1" fill={F} fillOpacity={FO} />
      <rect x="3" y="3" width="8" height="8" rx="1" />
      <rect x="13" y="3" width="8" height="8" rx="1" />
      <rect x="3" y="13" width="8" height="8" rx="1" />
      <rect x="13" y="13" width="8" height="8" rx="1" />
    </I>
  ),
  kitchen: (
    <I>
      <path d="M3 6h18v15a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6z" fill={F} fillOpacity={FO} />
      <path d="M3 6h18v15a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6z" />
      <path d="M3 11h18" />
      <path d="M8 6V3" /><path d="M12 6V4" /><path d="M16 6V3" />
      <circle cx="8" cy="16" r="2" /><circle cx="16" cy="16" r="2" />
    </I>
  ),
  bathroom: (
    <I>
      <path d="M3 12h18v3a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5v-3z" fill={F} fillOpacity={FO} />
      <path d="M3 12h18v3a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5v-3z" />
      <path d="M6 12V5a2 2 0 0 1 2-2h1" />
      <circle cx="10" cy="5" r="1.5" fill={F} fillOpacity={FO} />
      <circle cx="10" cy="5" r="1.5" />
      <path d="M10 20v2" /><path d="M14 20v2" />
    </I>
  ),
  pool: (
    <I>
      <path d="M2 15c2-2 4-2 6 0s4 2 6 0 4-2 6 0" />
      <path d="M2 19c2-2 4-2 6 0s4 2 6 0 4-2 6 0" />
      <path d="M7 13V5" /><path d="M17 13V5" />
      <path d="M7 5h10" />
      <path d="M7 8h10" />
    </I>
  ),
  moving: (
    <I>
      <path d="M1 17h15V8H1z" fill={F} fillOpacity={FO} />
      <path d="M1 17h15V8H1z" />
      <path d="M16 17h6v-4l-3-4h-3v8z" fill={F} fillOpacity={FO} />
      <path d="M16 17h6v-4l-3-4h-3v8z" />
      <circle cx="6" cy="19.5" r="2" /><circle cx="18" cy="19.5" r="2" />
      <path d="M5 8V4h6v4" />
    </I>
  ),
  windows: (
    <I>
      <rect x="3" y="3" width="18" height="18" rx="2" fill={F} fillOpacity={FO} />
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M12 3v18" /><path d="M3 12h18" />
      <circle cx="7.5" cy="17" r="0.8" fill={F} /><circle cx="16.5" cy="17" r="0.8" fill={F} />
    </I>
  ),
  other: (
    <I>
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" fill={F} fillOpacity={FO} />
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </I>
  ),
}
