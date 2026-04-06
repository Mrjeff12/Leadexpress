import { COLORS, FONT, SHADOW } from './theme'

const urgencyStyles = {
  Hot: { bg: 'rgba(255,59,48,0.12)', text: '#FF3B30' },
  Warm: { bg: 'rgba(255,149,0,0.12)', text: '#FF9500' },
}

interface LeadCardProps {
  profession: string
  icon: string
  color: string
  summary: string
  location: string
  urgency: 'Hot' | 'Warm'
  time: string
  group: string
  scale?: number
  opacity?: number
  x?: number
  y?: number
}

export function LeadCardAd({
  profession, icon, color, summary, location, urgency, time, group,
  scale = 1, opacity = 1, x = 0, y = 0,
}: LeadCardProps) {
  const u = urgencyStyles[urgency]
  return (
    <div style={{
      transform: `scale(${scale}) translate(${x}px, ${y}px)`,
      opacity, background: '#fff', borderRadius: 16,
      border: `1px solid ${COLORS.cardBorder}`, boxShadow: SHADOW.card,
      padding: 14, width: 230, fontFamily: FONT.family,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <div style={{ width: 24, height: 24, borderRadius: 7, background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>{icon}</div>
        <span style={{ fontSize: 11, fontWeight: 700, color }}>{profession}</span>
        <span style={{ fontSize: 8, fontWeight: 700, color: u.text, background: u.bg, padding: '1px 5px', borderRadius: 4, marginLeft: 'auto' }}>
          {urgency === 'Hot' ? '🔥 Hot' : '☀️ Warm'}
        </span>
      </div>
      <p style={{ fontSize: 10, fontWeight: 500, color: COLORS.dark, margin: 0, lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{summary}</p>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, fontSize: 8, color: COLORS.graySubtle, opacity: 0.6 }}>
        <span>📍 {location}</span><span>{time}</span>
      </div>
      <div style={{ marginTop: 4, fontSize: 7, color: COLORS.graySubtle, opacity: 0.4, fontWeight: 600 }}>{group}</div>
    </div>
  )
}
