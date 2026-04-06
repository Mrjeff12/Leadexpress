import { Img } from 'remotion'
import { COLORS, FONT, SHADOW } from './theme'

interface SubCardProps {
  initials: string
  name: string
  trade: string
  jobs: number
  rating: number
  selected?: boolean
  scale?: number
  opacity?: number
  y?: number
  photo?: string
}

export function SubCardAd({
  initials, name, trade, jobs, rating,
  selected = false, scale = 1, opacity = 1, y = 0, photo,
}: SubCardProps) {
  return (
    <div style={{
      transform: `scale(${scale}) translateY(${y}px)`, opacity,
      background: '#fff', borderRadius: 14,
      border: selected ? `2px solid ${COLORS.primary}` : `1px solid ${COLORS.cardBorder}`,
      boxShadow: selected ? '0 4px 20px rgba(254,91,37,0.15)' : SHADOW.card,
      padding: 12, width: 210, fontFamily: FONT.family,
      display: 'flex', alignItems: 'center', gap: 10,
    }}>
      {photo ? (
        <Img src={photo} style={{
          width: 32, height: 32, borderRadius: 16, objectFit: 'cover',
          border: selected ? `2px solid ${COLORS.primary}` : '2px solid transparent',
          boxShadow: selected ? `0 0 12px rgba(254,91,37,0.4)` : 'none',
        }} />
      ) : (
        <div style={{
          width: 32, height: 32, borderRadius: 16,
          background: selected ? `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.primaryDark})` : 'linear-gradient(135deg, #fee8df, #fff4ef)',
          border: selected ? 'none' : '1.5px solid #fdd5c5',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 700, color: selected ? '#fff' : COLORS.primaryDark,
        }}>
          {selected ? '\u2713' : initials}
        </div>
      )}
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: COLORS.dark }}>{name}</div>
        <div style={{ fontSize: 8, color: COLORS.graySubtle, opacity: 0.6 }}>
          {'\uD83D\uDD27'} {trade} {'\u00B7'} {jobs} jobs {'\u00B7'} {'\u2B50'.repeat(Math.min(rating, 5))}
        </div>
      </div>
    </div>
  )
}
