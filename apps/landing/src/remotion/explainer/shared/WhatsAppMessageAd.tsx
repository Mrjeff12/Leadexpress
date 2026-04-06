import { COLORS, FONT, SHADOW } from './theme'

export function WhatsAppMessageAd({
  opacity = 1, scale = 1, y = 0, width = 230,
}: { opacity?: number; scale?: number; y?: number; width?: number }) {
  return (
    <div style={{ opacity, transform: `scale(${scale}) translateY(${y}px)`, width, borderRadius: 14, overflow: 'hidden', boxShadow: SHADOW.card, fontFamily: FONT.family }}>
      <div style={{ background: '#1f2c34', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px' }}>
        <div style={{ width: 26, height: 26, borderRadius: 13, background: `${COLORS.whatsapp}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: COLORS.whatsapp, fontWeight: 700 }}>M</div>
        <div>
          <div style={{ color: '#e9edef', fontSize: 10, fontWeight: 600 }}>MasterLeadFlow</div>
          <div style={{ color: '#8696a0', fontSize: 8 }}>online</div>
        </div>
      </div>
      <div style={{ background: COLORS.waDark, padding: 8, display: 'flex', flexDirection: 'column' as const, gap: 5 }}>
        <div style={{ alignSelf: 'flex-end', maxWidth: '85%' }}>
          <div style={{ background: '#005c4b', borderRadius: '10px 3px 10px 10px', padding: '7px 9px' }}>
            <p style={{ fontSize: 9, color: '#e9edef', margin: 0, lineHeight: 1.6 }}>
              🔔 New job for you!<br />🏠 <b>Roofing — Hurricane damage</b><br />📍 Homestead, FL 33033<br />💰 Deal: <b>20% of job value</b><br />
              <span style={{ color: '#53bdeb', fontSize: 8 }}>👉 portal.masterleadflow.com/j/abc</span>
            </p>
            <div style={{ fontSize: 7, color: '#ffffff80', textAlign: 'right' as const, marginTop: 2 }}>2:15 PM <span style={{ color: '#53bdeb', fontWeight: 700 }}>✓✓</span></div>
          </div>
        </div>
        <div style={{ alignSelf: 'flex-start', maxWidth: '60%' }}>
          <div style={{ background: COLORS.waBubble, borderRadius: '3px 10px 10px 10px', padding: '6px 9px' }}>
            <p style={{ fontSize: 9, color: '#e9edef', margin: 0 }}>I'm in! Accepting now 🤝</p>
            <div style={{ fontSize: 7, color: '#ffffff50', textAlign: 'right' as const, marginTop: 2 }}>2:16 PM</div>
          </div>
        </div>
      </div>
    </div>
  )
}
