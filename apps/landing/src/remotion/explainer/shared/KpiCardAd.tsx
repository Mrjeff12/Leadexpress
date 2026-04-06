import { useCurrentFrame, useVideoConfig, interpolate } from 'remotion'
import { COLORS, FONT, sp } from './theme'

interface KpiCardProps {
  label: string
  value: number
  prefix?: string
  suffix?: string
  color: string
  delay: number
  opacity?: number
}

export function KpiCardAd({ label, value, prefix = '', suffix = '', color, delay, opacity = 1 }: KpiCardProps) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const enter = sp(frame, fps, delay)
  const countProgress = interpolate(frame, [delay, delay + 40], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const displayValue = Math.round(value * countProgress)
  return (
    <div style={{
      opacity: enter * opacity,
      transform: `translateY(${interpolate(enter, [0, 1], [20, 0])}px)`,
      background: '#fff', borderRadius: 14, border: `1px solid ${COLORS.cardBorder}`,
      padding: '14px 18px', minWidth: 160, fontFamily: FONT.family,
    }}>
      <div style={{ fontSize: 11, color: COLORS.graySubtle, opacity: 0.6, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 800, color }}>{prefix}{displayValue}{suffix}</div>
    </div>
  )
}
