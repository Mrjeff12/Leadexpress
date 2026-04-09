/**
 * Solid/filled profession icons — premium Angi-style design.
 * Default 32x32, viewBox 0 0 24 24, solid fill (currentColor).
 */

function I({ children }: { children: React.ReactNode }) {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      {children}
    </svg>
  )
}

/** Format profession key to label: air_duct → "Air Duct" */
export function formatProfession(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

export const PROFESSION_ICONS: Record<string, React.ReactNode> = {
  hvac: (
    <I>
      <path d="M3 5a2 2 0 012-2h14a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2V5zm3 1.5a.75.75 0 000 1.5h12a.75.75 0 000-1.5H6zm0 3a.75.75 0 000 1.5h12a.75.75 0 000-1.5H6z" />
      <path d="M8 15a1 1 0 011-1h6a1 1 0 011 1v5a2 2 0 01-2 2h-4a2 2 0 01-2-2v-5zm3 1v2h2v-2h-2z" />
      <path d="M11 13v1h2v-1h-2z" />
    </I>
  ),
  air_duct: (
    <I>
      <path d="M2 8a2 2 0 012-2h16a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V8zm3 1.5a.75.75 0 000 1.5h14a.75.75 0 000-1.5H5zm0 4a.75.75 0 000 1.5h14a.75.75 0 000-1.5H5z" />
      <path d="M7 4a1 1 0 012 0v2H7V4zm4-1a1 1 0 012 0v3h-2V3zm4 1a1 1 0 012 0v2h-2V4zM7 18v2a1 1 0 002 0v-2H7zm8 0v2a1 1 0 002 0v-2h-2z" />
    </I>
  ),
  chimney: (
    <I>
      <path d="M12 2.3L3 10v11a1 1 0 001 1h16a1 1 0 001-1V10L12 2.3zM10 22v-5a2 2 0 114 0v5h-4z" />
      <path d="M15 1h3a1 1 0 011 1v5h-5V2a1 1 0 011-1z" />
    </I>
  ),
  dryer_vent: (
    <I>
      <path d="M12 2a10 10 0 100 20 10 10 0 000-20zm0 3a7 7 0 110 14 7 7 0 010-14z" />
      <circle cx="12" cy="12" r="3.5" />
      <path d="M12 2v3m0 14v3M2 12h3m14 0h3" />
    </I>
  ),
  garage_door: (
    <I>
      <path d="M3 21V9l9-6 9 6v12H3zM6 21V12h12v9H6z" />
      <path fillRule="evenodd" d="M6 12h12v2H6v-2zm0 3h12v2H6v-2zm0 3h12v2H6v-2z" />
    </I>
  ),
  locksmith: (
    <I>
      <path d="M9 2a7 7 0 104.5 12.36l5.57 5.57a1.5 1.5 0 002.12-2.12L15.62 12.24A7 7 0 009 2zm0 3a4 4 0 100 8 4 4 0 000-8z" />
      <circle cx="9" cy="9" r="1.5" />
      <path d="M17 15l1.5 1.5M15 17l1.5 1.5" />
    </I>
  ),
  roofing: (
    <I>
      <path d="M12 1.5L1 11h3v10h16V11h3L12 1.5zM10 21v-5h4v5h-4z" />
    </I>
  ),
  plumbing: (
    <I>
      <path d="M7 2a1.5 1.5 0 00-1.5 1.5V8A1.5 1.5 0 007 9.5h3A1.5 1.5 0 0011.5 8V3.5A1.5 1.5 0 0010 2H7z" />
      <path d="M8 9.5v2a3 3 0 003 3h2v4a2.5 2.5 0 005 0v-4h-2a3 3 0 01-3-3V9.5H8z" />
      <path d="M14 18.5a1.5 1.5 0 103 0 1.5 1.5 0 00-3 0z" />
    </I>
  ),
  electrical: (
    <I>
      <path d="M13.5 1.5L4 13h6.5l-2 9.5L19 11h-6.5l2-9.5z" />
    </I>
  ),
  painting: (
    <I>
      <path d="M3 3a1 1 0 011-1h16a1 1 0 011 1v5a1 1 0 01-1 1H4a1 1 0 01-1-1V3z" />
      <path d="M10 9v2h4V9h-4z" />
      <path d="M8 11h8v7a4 4 0 01-8 0v-7zm3 2v4h2v-4h-2z" />
    </I>
  ),
  cleaning: (
    <I>
      <path d="M11 2a1 1 0 012 0v5h-2V2z" />
      <path d="M7 7h10a1 1 0 011 1l1 13a1 1 0 01-1 1H6a1 1 0 01-1-1l1-13a1 1 0 011-1z" />
      <path d="M10 11v6a.75.75 0 001.5 0v-6H10zm2.5 0v6a.75.75 0 001.5 0v-6h-1.5z" fill="#0a0a0a" />
    </I>
  ),
  carpet_cleaning: (
    <I>
      <path d="M3 15h18a1 1 0 011 1v2a1 1 0 01-1 1H3a1 1 0 01-1-1v-2a1 1 0 011-1z" />
      <path d="M8 15V8a4 4 0 018 0v7H8z" />
      <path d="M11 2a1 1 0 012 0v3h-2V2z" />
      <path d="M9 4.5l3-2.5 3 2.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M2 21h20v1H2v-1z" />
    </I>
  ),
  renovation: (
    <I>
      <path d="M14.5 2L22 9.5 12 19.5l-7.5-7.5L14.5 2zM4.5 12L2 21l9-3-6.5-6z" />
    </I>
  ),
  fencing: (
    <I>
      <path d="M3 5l2-3 2 3v16H3V5zm7-1l2-3 2 3v16h-4V4zm7 1l2-3 2 3v16h-4V5z" />
      <path d="M2 9h20v2.5H2V9zm0 5.5h20V17H2v-2.5z" />
    </I>
  ),
  landscaping: (
    <I>
      <path d="M12 22v-8" fill="none" stroke="currentColor" strokeWidth="2.5" />
      <path d="M6.5 14C3 14 1.5 10.5 3.5 7c1.5-1 3.5-.5 5 1a8 8 0 017-2c2.5 3.5 1 7-2.5 7-1 0-1.8-.3-2.5-.8-.7.5-1.5.8-2.5.8H6.5z" />
      <path d="M4 22h16v-1H4v1z" />
    </I>
  ),
  tiling: (
    <I>
      <path d="M3 3h7.5v7.5H3V3zm.75.75v6h6v-6h-6z" />
      <path d="M13.5 3H21v7.5h-7.5V3zm.75.75v6h6v-6h-6z" />
      <path d="M3 13.5h7.5V21H3v-7.5zm.75.75v6h6v-6h-6z" />
      <path d="M13.5 13.5H21V21h-7.5v-7.5zm.75.75v6h6v-6h-6z" />
    </I>
  ),
  kitchen: (
    <I>
      <path d="M2 6a1 1 0 011-1h18a1 1 0 011 1v15a1 1 0 01-1 1H3a1 1 0 01-1-1V6z" />
      <path d="M8 5V2.5a.5.5 0 011 0V5h2V3a.5.5 0 011 0v2h2V2.5a.5.5 0 011 0V5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M2 10h20v1H2v-1z" fill="#0a0a0a" />
      <circle cx="8" cy="16" r="2.5" fill="#0a0a0a" />
      <circle cx="16" cy="16" r="2.5" fill="#0a0a0a" />
    </I>
  ),
  bathroom: (
    <I>
      <path d="M3 12h18a1 1 0 011 1v3a5 5 0 01-5 5H7a5 5 0 01-5-5v-3a1 1 0 011-1z" />
      <path d="M6 12V5.5A2.5 2.5 0 018.5 3H10" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="11" cy="5" r="2" />
      <path d="M10 21v1.5h1.5V21H10zm3 0v1.5h1.5V21H13z" />
    </I>
  ),
  pool: (
    <I>
      <path d="M2 15.5c1.5-2 3.5-2 5 0s3.5 2 5 0 3.5-2 5 0 3.5 2 5 0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M2 19.5c1.5-2 3.5-2 5 0s3.5 2 5 0 3.5-2 5 0 3.5 2 5 0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M7 4h2v10H7V4zm8 0h2v10h-2V4z" />
      <path d="M7 4h10v2.5H7V4z" />
      <path d="M7 8h10v1.5H7V8z" />
    </I>
  ),
  moving: (
    <I>
      <path d="M1 16h15V7H1v9z" />
      <path d="M16 16h6.5v-4.5L19 7h-3v9z" />
      <circle cx="6" cy="19" r="2.5" fill="#0a0a0a" /><circle cx="6" cy="19" r="1" />
      <circle cx="18" cy="19" r="2.5" fill="#0a0a0a" /><circle cx="18" cy="19" r="1" />
      <path d="M5 7V4a1 1 0 011-1h5a1 1 0 011 1v3H5z" fill="#0a0a0a" />
    </I>
  ),
  windows: (
    <I>
      <path d="M3 3a2 2 0 012-2h14a2 2 0 012 2v18a2 2 0 01-2 2H5a2 2 0 01-2-2V3z" />
      <path d="M3 12h18M12 1v22" fill="none" stroke="#0a0a0a" strokeWidth="2" />
      <circle cx="8" cy="17.5" r="1" fill="#0a0a0a" />
      <circle cx="16" cy="17.5" r="1" fill="#0a0a0a" />
    </I>
  ),
  other: (
    <I>
      <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" />
    </I>
  ),
}
