import { COLORS, FONT } from './theme'

export function LogoAd({ scale = 1, opacity = 1, showText = true }: { scale?: number; opacity?: number; showText?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, transform: `scale(${scale})`, opacity }}>
      <div style={{ width: 44, height: 44, background: COLORS.primary, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2L2 7l10 5 10-5-10-5z" />
          <path d="M2 17l10 5 10-5" />
          <path d="M2 12l10 5 10-5" />
        </svg>
      </div>
      {showText && <span style={{ fontSize: 22, fontWeight: 700, color: COLORS.dark, fontFamily: FONT.family, letterSpacing: '-0.02em' }}>MasterLeadFlow</span>}
    </div>
  )
}
