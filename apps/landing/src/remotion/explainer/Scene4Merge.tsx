// apps/landing/src/remotion/explainer/Scene4Merge.tsx
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from 'remotion'
import { COLORS, FONT, sp, SCENE_4_START, SCENE_5_START } from './shared/theme'
import { KpiCardAd } from './shared/KpiCardAd'

const KPIS = [
  { label: 'Active Jobs', value: 24, color: COLORS.blue },
  { label: 'Completed', value: 142, color: COLORS.success },
  { label: 'Revenue', value: 48, prefix: '$', suffix: 'K', color: COLORS.primary },
  { label: 'Success Rate', value: 87, suffix: '%', color: COLORS.purple },
]

const TABLE_ROWS = [
  { job: '🏠 Roofing', loc: 'Homestead, FL', sub: 'Mike J.', deal: '20%', status: 'Accepted', statusBg: '#dbeafe', statusColor: '#1d4ed8', earned: '$480' },
  { job: '🔧 Plumbing', loc: 'Miami, FL', sub: 'Carlos R.', deal: '15%', status: 'Done', statusBg: '#dcfce7', statusColor: '#15803d', earned: '$320' },
  { job: '⚡ Electrical', loc: 'Boca Raton, FL', sub: 'Sarah C.', deal: '$500', status: 'Active', statusBg: '#fef3c7', statusColor: '#b45309', earned: '$500' },
]

export function Scene4Merge() {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const local = frame - SCENE_4_START

  // Scene visibility
  const sceneIn = interpolate(frame, [SCENE_4_START, SCENE_4_START + 30], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  const sceneOut = interpolate(frame, [SCENE_5_START - 30, SCENE_5_START], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  const vis = sceneIn * sceneOut

  // Dashboard enter
  const dashIn = sp(frame, fps, SCENE_4_START + 30, { damping: 12 })

  // Table rows stagger
  const row0 = sp(frame, fps, SCENE_4_START + 120)
  const row1 = sp(frame, fps, SCENE_4_START + 135)
  const row2 = sp(frame, fps, SCENE_4_START + 150)
  const rowAnims = [row0, row1, row2]

  // Avatars
  const avatarIn = sp(frame, fps, SCENE_4_START + 180, { damping: 10 })

  // "Everyone wins" text
  const textIn = sp(frame, fps, SCENE_4_START + 220, { damping: 10 })

  // Arrow pulse
  const arrowPulse = Math.sin(frame * 0.08) * 0.15 + 0.85

  return (
    <AbsoluteFill
      style={{
        background: COLORS.cream,
        fontFamily: FONT.family,
        opacity: vis,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* Dot grid */}
      <AbsoluteFill
        style={{
          opacity: 0.03,
          backgroundImage: `radial-gradient(circle at 1px 1px, ${COLORS.whatsapp} 1px, transparent 0)`,
          backgroundSize: '50px 50px',
          pointerEvents: 'none',
        }}
      />

      {/* "Everyone wins" title */}
      <div
        style={{
          opacity: textIn,
          transform: `translateY(${interpolate(textIn, [0, 1], [15, 0])}px)`,
          marginBottom: 40,
          textAlign: 'center',
        }}
      >
        <h2 style={{ fontSize: 48, margin: 0, color: COLORS.dark, ...FONT.heading }}>
          Everyone wins.
        </h2>
      </div>

      {/* Dashboard container */}
      <div
        style={{
          opacity: dashIn,
          transform: `scale(${interpolate(dashIn, [0, 1], [0.9, 1])}) translateY(${interpolate(dashIn, [0, 1], [30, 0])}px)`,
          width: 900,
        }}
      >
        {/* KPI row */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 20, justifyContent: 'center' }}>
          {KPIS.map((kpi, i) => (
            <KpiCardAd
              key={kpi.label}
              label={kpi.label}
              value={kpi.value}
              prefix={kpi.prefix}
              suffix={kpi.suffix}
              color={kpi.color}
              delay={SCENE_4_START + 50 + i * 12}
            />
          ))}
        </div>

        {/* Table */}
        <div
          style={{
            background: '#fff',
            borderRadius: 16,
            overflow: 'hidden',
            border: `1px solid ${COLORS.cardBorder}`,
            boxShadow: '0 4px 24px rgba(0,0,0,0.04)',
          }}
        >
          {/* Header */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '2fr 1.5fr 1fr 1fr 1fr',
              padding: '12px 20px',
              borderBottom: `1px solid ${COLORS.cardBorder}`,
              fontSize: 10,
              color: COLORS.graySubtle,
              opacity: 0.5,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}
          >
            <span>Job</span>
            <span>Subcontractor</span>
            <span>Deal</span>
            <span>Status</span>
            <span>Earned</span>
          </div>
          {/* Rows */}
          {TABLE_ROWS.map((r, i) => (
            <div
              key={r.job}
              style={{
                display: 'grid',
                gridTemplateColumns: '2fr 1.5fr 1fr 1fr 1fr',
                padding: '14px 20px',
                borderBottom: i < 2 ? `1px solid ${COLORS.cardBorder}` : 'none',
                alignItems: 'center',
                opacity: rowAnims[i],
                transform: `translateX(${interpolate(rowAnims[i], [0, 1], [20, 0])}px)`,
                background: i === 0 ? 'rgba(254,91,37,0.02)' : 'transparent',
              }}
            >
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.dark }}>{r.job}</div>
                <div style={{ fontSize: 9, color: COLORS.graySubtle, opacity: 0.5 }}>{r.loc}</div>
              </div>
              <span style={{ fontSize: 12, color: COLORS.graySubtle }}>{r.sub}</span>
              <span style={{ fontSize: 12, fontFamily: 'monospace', color: COLORS.graySubtle }}>{r.deal}</span>
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  background: r.statusBg,
                  color: r.statusColor,
                  padding: '3px 8px',
                  borderRadius: 6,
                  display: 'inline-block',
                  width: 'fit-content',
                }}
              >
                {r.status}
              </span>
              <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.success }}>{r.earned}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Avatars on sides */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: 80,
          transform: `translateY(-50%) scale(${avatarIn})`,
          opacity: avatarIn,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 28,
            background: '#fff',
            border: `3px solid ${COLORS.primary}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 20,
            fontWeight: 800,
            color: COLORS.primary,
            boxShadow: `0 4px 20px rgba(254,91,37,0.2)`,
          }}
        >
          GC
        </div>
        <span style={{ fontSize: 10, fontWeight: 600, color: COLORS.graySubtle }}>General Contractor</span>
      </div>

      {/* Arrow left */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: 160,
          transform: 'translateY(-50%)',
          opacity: avatarIn * arrowPulse,
        }}
      >
        <svg width={60} height={24} viewBox="0 0 60 24">
          <line x1={0} y1={12} x2={48} y2={12} stroke={COLORS.success} strokeWidth={2} strokeDasharray="6 4" />
          <polygon points="48,6 60,12 48,18" fill={COLORS.success} />
        </svg>
      </div>

      {/* Arrow right */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          right: 160,
          transform: 'translateY(-50%) scaleX(-1)',
          opacity: avatarIn * arrowPulse,
        }}
      >
        <svg width={60} height={24} viewBox="0 0 60 24">
          <line x1={0} y1={12} x2={48} y2={12} stroke={COLORS.success} strokeWidth={2} strokeDasharray="6 4" />
          <polygon points="48,6 60,12 48,18" fill={COLORS.success} />
        </svg>
      </div>

      {/* Sub avatar */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          right: 80,
          transform: `translateY(-50%) scale(${avatarIn})`,
          opacity: avatarIn,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 28,
            background: '#fff',
            border: `3px solid ${COLORS.whatsapp}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 20,
            fontWeight: 800,
            color: COLORS.whatsapp,
            boxShadow: `0 4px 20px rgba(37,211,102,0.2)`,
          }}
        >
          SC
        </div>
        <span style={{ fontSize: 10, fontWeight: 600, color: COLORS.graySubtle }}>Subcontractor</span>
      </div>
    </AbsoluteFill>
  )
}
