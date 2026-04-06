import { COLORS, SHADOW } from './theme'

export function PhoneMockup({
  children,
  width = 280,
  scale = 1,
  opacity = 1,
  x = 0,
  y = 0,
}: {
  children: React.ReactNode
  width?: number
  scale?: number
  opacity?: number
  x?: number
  y?: number
}) {
  const height = width * (17 / 9)
  return (
    <div
      style={{
        width,
        height,
        background: COLORS.dark,
        borderRadius: width * 0.09,
        padding: width * 0.022,
        boxShadow: SHADOW.phone,
        transform: `scale(${scale}) translate(${x}px, ${y}px)`,
        opacity,
        flexShrink: 0,
      }}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          borderRadius: width * 0.075,
          overflow: 'hidden',
          background: COLORS.cream,
          position: 'relative',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: `${width * 0.025}px ${width * 0.05}px`,
            fontSize: width * 0.035,
            color: COLORS.graySubtle,
            fontWeight: 600,
          }}
        >
          <span>11:20</span>
          <div style={{ display: 'flex', gap: 3, fontSize: width * 0.028 }}>
            <span>📶</span>
            <span>🔋</span>
          </div>
        </div>
        <div style={{ flex: 1, overflow: 'hidden', height: '100%' }}>
          {children}
        </div>
      </div>
    </div>
  )
}
