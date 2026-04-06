// apps/landing/src/remotion/explainer/Scene1Hook.tsx
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, Img } from 'remotion'
import { COLORS, FONT, sp, SCENE_1_START, SCENE_2_START, PHOTOS, GRADIENT } from './shared/theme'
import { PhoneMockup } from './shared/PhoneMockup'
import { LeadCardAd } from './shared/LeadCardAd'

const LEADS = [
  {
    profession: 'HVAC',
    icon: '\u2744\uFE0F',
    color: '#0284c7',
    summary: 'Central AC not cooling \u2014 2,400 sq ft house, unit from 2008.',
    location: 'Miami, FL 33130',
    urgency: 'Hot' as const,
    time: '2m ago',
    group: 'South FL Contractors',
  },
  {
    profession: 'Roofing',
    icon: '\uD83C\uDFE0',
    color: '#dc2626',
    summary: 'Hurricane damage on tile roof, multiple leaks in bedroom.',
    location: 'Homestead, FL 33033',
    urgency: 'Hot' as const,
    time: '8m ago',
    group: 'Miami Dade Roofers',
  },
  {
    profession: 'Electrical',
    icon: '\u26A1',
    color: '#f59e0b',
    summary: 'Panel upgrade 100A to 200A, adding EV charger circuit.',
    location: 'Boca Raton, FL 33431',
    urgency: 'Warm' as const,
    time: '15m ago',
    group: 'Palm Beach Electricians',
  },
]

export function Scene1Hook() {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const localFrame = frame - SCENE_1_START

  // Animations
  const leftIn = sp(frame, fps, 5, { damping: 14 })
  const rightIn = sp(frame, fps, 12, { damping: 14 })

  // Lead cards stagger
  const card0 = sp(frame, fps, 10)
  const card1 = sp(frame, fps, 18)
  const card2 = sp(frame, fps, 26)
  const cardScales = [card0, card1, card2]

  // Flying lead animation (frames 50-80)
  const flyProgress = interpolate(localFrame, [50, 80], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  const flyX = interpolate(flyProgress, [0, 1], [-200, 200])
  const flyScale = interpolate(flyProgress, [0, 0.5, 1], [1, 1.4, 0.8])
  const flyOpacity = interpolate(flyProgress, [0, 0.3, 0.7, 1], [0, 1, 1, 0])

  // Right side glow on lead arrival
  const rightGlow = interpolate(flyProgress, [0.6, 1], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  // Connecting line draw
  const lineProgress = interpolate(flyProgress, [0.1, 0.9], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  // "What if" text
  const textIn = sp(frame, fps, 75, { damping: 10 })
  const textScale = interpolate(textIn, [0, 1], [0.9, 1])

  // Pulse for overwhelm effect
  const pulse = Math.sin(localFrame * 0.15) * 0.05 + 1

  // Animated mesh position
  const meshShift = Math.sin(frame * 0.02) * 20

  return (
    <AbsoluteFill
      style={{
        background: COLORS.cream,
        fontFamily: FONT.family,
        display: 'flex',
        flexDirection: 'row',
      }}
    >
      {/* Left side gradient */}
      <AbsoluteFill
        style={{
          width: '50%',
          background: GRADIENT.warmBg,
        }}
      />
      {/* Right side gradient */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          width: '50%',
          background: GRADIENT.coolBg,
        }}
      />

      {/* Dot grid background */}
      <AbsoluteFill
        style={{
          opacity: 0.03,
          backgroundImage: `radial-gradient(circle at 1px 1px, ${COLORS.whatsapp} 1px, transparent 0)`,
          backgroundSize: '50px 50px',
          pointerEvents: 'none',
        }}
      />

      {/* Left animated mesh */}
      <div
        style={{
          position: 'absolute',
          top: `calc(30% + ${meshShift}px)`,
          left: '20%',
          width: 350,
          height: 350,
          borderRadius: '50%',
          background: `radial-gradient(circle, rgba(254,91,37,0.06) 0%, transparent 70%)`,
          filter: 'blur(60px)',
          pointerEvents: 'none',
        }}
      />
      {/* Right animated mesh */}
      <div
        style={{
          position: 'absolute',
          top: `calc(35% + ${-meshShift}px)`,
          right: '20%',
          width: 350,
          height: 350,
          borderRadius: '50%',
          background: `radial-gradient(circle, rgba(37,211,102,0.06) 0%, transparent 70%)`,
          filter: 'blur(60px)',
          pointerEvents: 'none',
        }}
      />

      {/* Left side \u2014 GC */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          opacity: leftIn,
          transform: `translateX(${interpolate(leftIn, [0, 1], [-60, 0])}px)`,
        }}
      >
        {/* GC Avatar + Name */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 20 }}>
          <Img
            src={PHOTOS.gc}
            style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              objectFit: 'cover',
              border: `3px solid ${COLORS.primary}`,
              boxShadow: '0 4px 20px rgba(254,91,37,0.2)',
            }}
          />
          <div style={{ fontSize: 18, fontWeight: 700, color: COLORS.dark, marginTop: 10 }}>David Miller</div>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: 'rgba(254,91,37,0.12)',
              color: COLORS.primary,
              borderRadius: 20,
              padding: '4px 14px',
              fontSize: 11,
              fontWeight: 600,
              marginTop: 6,
            }}
          >
            General Contractor
          </div>
        </div>

        {/* Phone with stacked leads */}
        <PhoneMockup width={280}>
          <div style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {LEADS.map((lead, i) => (
              <LeadCardAd
                key={i}
                {...lead}
                scale={cardScales[i]}
                opacity={cardScales[i]}
              />
            ))}
          </div>
        </PhoneMockup>
        {/* Red pulse overlay */}
        <div
          style={{
            position: 'absolute',
            top: '20%',
            left: '35%',
            width: 20,
            height: 20,
            borderRadius: '50%',
            background: COLORS.red,
            opacity: interpolate(pulse, [0.95, 1.05], [0.3, 0.8]),
            filter: 'blur(8px)',
            pointerEvents: 'none',
          }}
        />
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <div style={{ fontSize: 26, color: COLORS.dark, ...FONT.heading }}>
            Too many leads
          </div>
        </div>
      </div>

      {/* Center divider */}
      <div
        style={{
          width: 1,
          background: `${COLORS.dark}10`,
          alignSelf: 'stretch',
          margin: '80px 0',
          position: 'relative',
          zIndex: 5,
        }}
      />

      {/* Glowing connecting line */}
      {lineProgress > 0 && (
        <svg
          style={{
            position: 'absolute',
            top: '40%',
            left: '25%',
            width: '50%',
            height: 4,
            zIndex: 6,
            pointerEvents: 'none',
          }}
        >
          <defs>
            <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={COLORS.primary} stopOpacity={0.8} />
              <stop offset="100%" stopColor={COLORS.whatsapp} stopOpacity={0.8} />
            </linearGradient>
          </defs>
          <line
            x1="0"
            y1="2"
            x2={`${lineProgress * 100}%`}
            y2="2"
            stroke="url(#lineGrad)"
            strokeWidth={3}
            strokeLinecap="round"
            filter="url(#glow)"
          />
          <defs>
            <filter id="glow">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
        </svg>
      )}

      {/* Right side \u2014 Sub */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          opacity: rightIn,
          transform: `translateX(${interpolate(rightIn, [0, 1], [60, 0])}px)`,
        }}
      >
        {/* Green glow \u2014 intensifies when lead arrives */}
        <div
          style={{
            position: 'absolute',
            top: '30%',
            left: '50%',
            width: 400,
            height: 400,
            borderRadius: '50%',
            background: `radial-gradient(circle, rgba(37,211,102,${0.04 + rightGlow * 0.12}) 0%, transparent 70%)`,
            transform: 'translate(-50%, -50%)',
            filter: 'blur(60px)',
            pointerEvents: 'none',
          }}
        />

        {/* Sub Avatar + Name */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 20 }}>
          <Img
            src={PHOTOS.sub1}
            style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              objectFit: 'cover',
              border: `3px solid ${COLORS.whatsapp}`,
              boxShadow: '0 4px 20px rgba(37,211,102,0.2)',
            }}
          />
          <div style={{ fontSize: 18, fontWeight: 700, color: COLORS.dark, marginTop: 10 }}>Mike Johnson</div>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: `${COLORS.whatsapp}15`,
              color: COLORS.whatsapp,
              borderRadius: 20,
              padding: '4px 14px',
              fontSize: 11,
              fontWeight: 600,
              marginTop: 6,
            }}
          >
            Subcontractor
          </div>
        </div>

        {/* Phone with empty WA screen */}
        <PhoneMockup width={280}>
          <div style={{ background: COLORS.waDark, height: '100%' }}>
            <div
              style={{
                background: '#1f2c34',
                padding: '10px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  background: `${COLORS.whatsapp}20`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: COLORS.whatsapp,
                  fontSize: 14,
                }}
              >
                {'\uD83D\uDCAC'}
              </div>
              <div>
                <div style={{ color: '#e9edef', fontSize: 11, fontWeight: 600 }}>WhatsApp</div>
                <div style={{ color: '#8696a0', fontSize: 8 }}>No new messages</div>
              </div>
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: 200,
                color: '#8696a0',
                fontSize: 10,
                opacity: 0.5,
              }}
            >
              Waiting for jobs...
            </div>
          </div>
        </PhoneMockup>
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <div style={{ fontSize: 26, color: COLORS.dark, ...FONT.heading }}>
            Not enough work
          </div>
        </div>
      </div>

      {/* Flying lead card */}
      {flyOpacity > 0 && (
        <div
          style={{
            position: 'absolute',
            top: '40%',
            left: '50%',
            transform: `translate(calc(-50% + ${flyX}px), -50%) scale(${flyScale})`,
            opacity: flyOpacity,
            zIndex: 10,
          }}
        >
          <LeadCardAd
            profession="Roofing"
            icon={'\uD83C\uDFE0'}
            color="#dc2626"
            summary="Hurricane damage on tile roof"
            location="Homestead, FL"
            urgency="Hot"
            time="8m ago"
            group=""
          />
        </div>
      )}

      {/* "What if you could connect them?" */}
      <div
        style={{
          position: 'absolute',
          bottom: 60,
          left: 0,
          right: 0,
          textAlign: 'center',
          opacity: textIn,
          transform: `translateY(${interpolate(textIn, [0, 1], [20, 0])}px) scale(${textScale})`,
        }}
      >
        <div
          style={{
            fontSize: 44,
            color: COLORS.dark,
            ...FONT.heading,
          }}
        >
          What if you could connect them?
        </div>
      </div>
    </AbsoluteFill>
  )
}
