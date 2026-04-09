/**
 * Custom monochrome profession icons — consistent design language.
 * All icons are 24x24 SVG, single color (currentColor), 1.5px stroke.
 */

const icon = (d: string) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
)

// Multi-path icons need a custom component
function SvgIcon({ children }: { children: React.ReactNode }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  )
}

export const PROFESSION_ICONS: Record<string, React.ReactNode> = {
  hvac: (
    <SvgIcon>
      <path d="M12 2a5 5 0 0 0-5 5v3a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V7a5 5 0 0 0-5-5z" />
      <path d="M7 13v2a5 5 0 0 0 10 0v-2" />
      <path d="M12 11v6" />
      <path d="M9 14l3 3 3-3" />
    </SvgIcon>
  ),
  air_duct: (
    <SvgIcon>
      <path d="M3 12h4l2-3h6l2 3h4" />
      <path d="M7 12v5a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-5" />
      <path d="M9 5h6v4H9z" />
      <path d="M12 9v3" />
    </SvgIcon>
  ),
  chimney: (
    <SvgIcon>
      <path d="M5 21h14" />
      <path d="M6 21V10l6-6 6 6v11" />
      <path d="M9 21v-5a3 3 0 0 1 6 0v5" />
      <path d="M14 3v3" />
      <path d="M16 2v2" />
    </SvgIcon>
  ),
  dryer_vent: (
    <SvgIcon>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="4" />
      <path d="M12 8v-3" />
      <path d="M12 19v-3" />
      <path d="M8 12H5" />
      <path d="M19 12h-3" />
    </SvgIcon>
  ),
  garage_door: (
    <SvgIcon>
      <path d="M3 21h18" />
      <path d="M4 21V8l8-5 8 5v13" />
      <path d="M7 21V12h10v9" />
      <path d="M7 14h10" />
      <path d="M7 16h10" />
      <path d="M7 18h10" />
    </SvgIcon>
  ),
  locksmith: (
    <SvgIcon>
      <circle cx="10" cy="10" r="6" />
      <circle cx="10" cy="10" r="2" />
      <path d="M14.5 13.5L21 20" />
      <path d="M17.5 17l2 2" />
    </SvgIcon>
  ),
  roofing: (
    <SvgIcon>
      <path d="M3 21h18" />
      <path d="M5 21V12l7-8 7 8v9" />
      <path d="M2 12l10-9 10 9" />
    </SvgIcon>
  ),
  plumbing: (
    <SvgIcon>
      <path d="M6 12V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1" />
      <path d="M12 6h4a2 2 0 0 1 2 2v4" />
      <path d="M18 12v5a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2v-1" />
      <path d="M12 18H8a2 2 0 0 1-2-2v-4" />
    </SvgIcon>
  ),
  electrical: (
    <SvgIcon>
      <path d="M13 2L4 14h7l-2 8 9-12h-7l2-8z" fill="currentColor" fillOpacity="0.15" />
      <path d="M13 2L4 14h7l-2 8 9-12h-7l2-8z" />
    </SvgIcon>
  ),
  painting: (
    <SvgIcon>
      <path d="M5 3h14a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
      <path d="M11 8v4" />
      <path d="M13 8v4" />
      <path d="M9 12h6v6a3 3 0 0 1-6 0v-6z" />
    </SvgIcon>
  ),
  cleaning: (
    <SvgIcon>
      <path d="M12 2v6" />
      <path d="M8 8h8l1 13H7L8 8z" />
      <path d="M10 12v5" />
      <path d="M14 12v5" />
    </SvgIcon>
  ),
  carpet_cleaning: (
    <SvgIcon>
      <path d="M4 19h16" />
      <path d="M4 15h16" />
      <path d="M8 19v-8a4 4 0 0 1 8 0v8" />
      <path d="M12 7V3" />
      <path d="M10 5l2-2 2 2" />
    </SvgIcon>
  ),
  renovation: (
    <SvgIcon>
      <path d="M15 3l6 6-9 9-6-6 9-9z" />
      <path d="M6 12L3 21l9-3" />
      <path d="M12 6l6 6" />
    </SvgIcon>
  ),
  fencing: (
    <SvgIcon>
      <path d="M4 6v12" />
      <path d="M12 4v14" />
      <path d="M20 6v12" />
      <path d="M4 10h16" />
      <path d="M4 15h16" />
      <path d="M4 6l2-2 2 2" />
      <path d="M10 4l2-2 2 2" />
      <path d="M18 6l2-2" />
    </SvgIcon>
  ),
  landscaping: (
    <SvgIcon>
      <path d="M12 22V12" />
      <path d="M8 18c-3 0-5-2-5-5a5 5 0 0 1 9-3" />
      <path d="M16 18c3 0 5-2 5-5a5 5 0 0 0-9-3" />
      <path d="M12 12c0-3 2-6 5-7" />
      <path d="M12 12c0-3-2-6-5-7" />
    </SvgIcon>
  ),
  tiling: (
    <SvgIcon>
      <rect x="3" y="3" width="8" height="8" rx="1" />
      <rect x="13" y="3" width="8" height="8" rx="1" />
      <rect x="3" y="13" width="8" height="8" rx="1" />
      <rect x="13" y="13" width="8" height="8" rx="1" />
    </SvgIcon>
  ),
  kitchen: (
    <SvgIcon>
      <path d="M3 6h18" />
      <path d="M3 6v14a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V6" />
      <path d="M8 6V3" />
      <path d="M12 6V4" />
      <path d="M16 6V3" />
      <circle cx="8" cy="14" r="2" />
      <circle cx="16" cy="14" r="2" />
    </SvgIcon>
  ),
  bathroom: (
    <SvgIcon>
      <path d="M4 12h16a1 1 0 0 1 1 1v2a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4v-2a1 1 0 0 1 1-1z" />
      <path d="M6 12V5a2 2 0 0 1 2-2h1" />
      <circle cx="9" cy="5" r="1" />
    </SvgIcon>
  ),
  pool: (
    <SvgIcon>
      <path d="M2 16c1.5-1.5 3-2 4.5 0s3 1.5 4.5 0 3-2 4.5 0 3 1.5 4.5 0" />
      <path d="M2 20c1.5-1.5 3-2 4.5 0s3 1.5 4.5 0 3-2 4.5 0 3 1.5 4.5 0" />
      <path d="M8 14V6" />
      <path d="M16 14V6" />
      <path d="M8 6h8" />
    </SvgIcon>
  ),
  moving: (
    <SvgIcon>
      <path d="M5 17h14v-5l-3-3H5v8z" />
      <circle cx="8" cy="19" r="2" />
      <circle cx="16" cy="19" r="2" />
      <path d="M5 9V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v4" />
    </SvgIcon>
  ),
  windows: (
    <SvgIcon>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M12 3v18" />
      <path d="M3 12h18" />
      <circle cx="7" cy="16" r="0.5" fill="currentColor" />
      <circle cx="17" cy="16" r="0.5" fill="currentColor" />
    </SvgIcon>
  ),
  other: (
    <SvgIcon>
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </SvgIcon>
  ),
}
