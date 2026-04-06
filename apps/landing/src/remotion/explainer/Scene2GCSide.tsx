// apps/landing/src/remotion/explainer/Scene2GCSide.tsx
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from 'remotion'
import { COLORS, FONT, sp, SCENE_2_START, SCENE_3_START } from './shared/theme'
import { PhoneMockup } from './shared/PhoneMockup'
import { LeadCardAd } from './shared/LeadCardAd'
import { SubCardAd } from './shared/SubCardAd'
import { WhatsAppMessageAd } from './shared/WhatsAppMessageAd'

const SUBS = [
  { initials: 'MJ', name: 'Mike Johnson', trade: 'Roofing', jobs: 12, rating: 5 },
  { initials: 'SC', name: 'Sarah Chen', trade: 'Roofing', jobs: 8, rating: 4 },
  { initials: 'CR', name: 'Carlos Rivera', trade: 'Roofing', jobs: 5, rating: 4 },
]

export function Scene2GCSide() {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const local = frame - SCENE_2_START

  // Scene visibility
  const sceneIn = interpolate(frame, [SCENE_2_START, SCENE_2_START + 30], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  const sceneOut = interpolate(frame, [SCENE_3_START - 30, SCENE_3_START], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  const vis = sceneIn * sceneOut

  // Phase timing (relative to scene start)
  const PHASE_LEAD = 0
  const PHASE_SUBS = 120
  const PHASE_SELECT = 240
  const PHASE_SEND = 330

  // Lead card
  const leadIn = sp(frame, fps, SCENE_2_START + PHASE_LEAD + 10, { damping: 10 })

  // Sub cards stagger
  const sub0 = sp(frame, fps, SCENE_2_START + PHASE_SUBS, { damping: 12 })
  const sub1 = sp(frame, fps, SCENE_2_START + PHASE_SUBS + 10, { damping: 12 })
  const sub2 = sp(frame, fps, SCENE_2_START + PHASE_SUBS + 20, { damping: 12 })
  const subScales = [sub0, sub1, sub2]

  // Selection highlight
  const selectProgress = interpolate(local, [PHASE_SELECT, PHASE_SELECT + 15], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  // WA send
  const sendProgress = interpolate(local, [PHASE_SEND, PHASE_SEND + 30], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  const waScale = sp(frame, fps, SCENE_2_START + PHASE_SEND, { damping: 10 })
  const waFlyX = interpolate(sendProgress, [0.7, 1], [0, 800], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  // Phase text
  let phaseTitle = 'A lead comes in'
  let phaseSub = "A job you can't take — but someone in your network can."
  if (local >= PHASE_SUBS - 10) {
    phaseTitle = 'Pick your sub'
    phaseSub = 'Choose from your trusted network.'
  }
  if (local >= PHASE_SELECT - 10) {
    phaseTitle = 'Pick your sub'
    phaseSub = 'Mike Johnson — perfect match.'
  }
  if (local >= PHASE_SEND - 10) {
    phaseTitle = 'Send with one tap'
    phaseSub = 'WhatsApp message with all the details.'
  }

  const titleIn = sp(frame, fps, SCENE_2_START + 5)

  const floatY = Math.sin(frame * 0.035) * 3

  return (
    <AbsoluteFill
      style={{
        background: COLORS.cream,
        fontFamily: FONT.family,
        opacity: vis,
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
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

      {/* Left — GC Phone (60%) */}
      <div
        style={{
          flex: 6,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
        }}
      >
        {/* Orange glow */}
        <div
          style={{
            position: 'absolute',
            top: '35%',
            left: '45%',
            width: 500,
            height: 500,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(254,91,37,0.06) 0%, transparent 70%)',
            transform: 'translate(-50%, -50%)',
            filter: 'blur(80px)',
            pointerEvents: 'none',
          }}
        />

        <PhoneMockup width={300} y={floatY}>
          <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {/* Lead card */}
            <div style={{ opacity: leadIn, transform: `translateY(${interpolate(leadIn, [0, 1], [20, 0])}px)` }}>
              <LeadCardAd
                profession="Roofing"
                icon="🏠"
                color="#dc2626"
                summary="Hurricane damage on tile roof, multiple leaks in master bedroom and garage."
                location="Homestead, FL 33033"
                urgency="Hot"
                time="8m ago"
                group="Miami Dade Roofers"
              />
            </div>

            {/* Sub selection list */}
            {local >= PHASE_SUBS - 5 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
                {SUBS.map((sub, i) => (
                  <SubCardAd
                    key={sub.initials}
                    {...sub}
                    selected={i === 0 && selectProgress > 0.5}
                    opacity={subScales[i]}
                    scale={subScales[i]}
                    y={interpolate(subScales[i], [0, 1], [12, 0])}
                  />
                ))}
              </div>
            )}

            {/* WA message composing */}
            {local >= PHASE_SEND - 5 && (
              <div
                style={{
                  transform: `translateX(${waFlyX}px)`,
                  marginTop: 6,
                }}
              >
                <WhatsAppMessageAd opacity={waScale} scale={waScale} width={260} />
              </div>
            )}
          </div>
        </PhoneMockup>
      </div>

      {/* Right — blurred hint (40%) */}
      <div
        style={{
          flex: 4,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          filter: 'blur(12px)',
          opacity: 0.2,
        }}
      >
        <PhoneMockup width={180}>
          <div
            style={{
              background: COLORS.waDark,
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#8696a0',
              fontSize: 10,
            }}
          >
            Waiting...
          </div>
        </PhoneMockup>
      </div>

      {/* Phase title overlay */}
      <div
        style={{
          position: 'absolute',
          top: 50,
          left: 0,
          right: 0,
          textAlign: 'center',
          opacity: titleIn,
        }}
      >
        <h2
          style={{
            fontSize: 40,
            margin: 0,
            color: COLORS.dark,
            ...FONT.heading,
          }}
        >
          {phaseTitle}
        </h2>
        <p style={{ fontSize: 16, color: COLORS.graySubtle, opacity: 0.6, marginTop: 8 }}>
          {phaseSub}
        </p>
      </div>
    </AbsoluteFill>
  )
}
