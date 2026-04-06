// apps/landing/src/remotion/explainer/Scene3SubSide.tsx
import { useMemo } from 'react'
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from 'remotion'
import { COLORS, FONT, sp, SCENE_3_START, SCENE_4_START } from './shared/theme'
import { PhoneMockup } from './shared/PhoneMockup'
import { WhatsAppMessageAd } from './shared/WhatsAppMessageAd'

export function Scene3SubSide() {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const local = frame - SCENE_3_START

  // Scene visibility
  const sceneIn = interpolate(frame, [SCENE_3_START, SCENE_3_START + 30], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  const sceneOut = interpolate(frame, [SCENE_4_START - 30, SCENE_4_START], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  const vis = sceneIn * sceneOut

  // Phase timing
  const PHASE_NOTIFY = 0
  const PHASE_OPEN = 80
  const PHASE_DETAIL = 160
  const PHASE_ACCEPT = 260

  // Notification
  const notifyIn = sp(frame, fps, SCENE_3_START + PHASE_NOTIFY + 15, { damping: 14 })

  // Message open
  const msgIn = sp(frame, fps, SCENE_3_START + PHASE_OPEN, { damping: 10 })

  // Detail card
  const detailIn = sp(frame, fps, SCENE_3_START + PHASE_DETAIL, { damping: 10 })

  // Accept
  const acceptProgress = interpolate(local, [PHASE_ACCEPT, PHASE_ACCEPT + 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  const acceptScale = sp(frame, fps, SCENE_3_START + PHASE_ACCEPT + 5, { damping: 8, stiffness: 200 })

  // Confetti
  const confetti = useMemo(
    () =>
      Array.from({ length: 24 }, () => ({
        x: Math.random() * 300 - 150,
        y: Math.random() * -200 - 50,
        size: Math.random() * 6 + 3,
        color: Math.random() > 0.5 ? COLORS.primary : COLORS.whatsapp,
        rotation: Math.random() * 360,
        speed: Math.random() * 2 + 1,
      })),
    []
  )
  const confettiVis = interpolate(local, [PHASE_ACCEPT + 10, PHASE_ACCEPT + 60], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  // Phase text
  let phaseTitle = 'Job lands on your phone'
  let phaseSub = 'A WhatsApp notification with all the details.'
  if (local >= PHASE_OPEN - 10) {
    phaseTitle = 'See the deal'
    phaseSub = 'Clear terms — profession, location, your cut.'
  }
  if (local >= PHASE_ACCEPT - 10) {
    phaseTitle = 'Accept instantly'
    phaseSub = "One tap — you're on the job."
  }

  const titleIn = sp(frame, fps, SCENE_3_START + 5)
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

      {/* Left — blurred GC hint (40%) */}
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
          <div style={{ background: '#fff', height: '100%', padding: 10, opacity: 0.5 }}>
            <div
              style={{
                width: '80%',
                height: 12,
                background: COLORS.cardBorder,
                borderRadius: 6,
                marginBottom: 8,
              }}
            />
            <div
              style={{
                width: '60%',
                height: 12,
                background: COLORS.cardBorder,
                borderRadius: 6,
              }}
            />
          </div>
        </PhoneMockup>
      </div>

      {/* Right — Sub Phone (60%) */}
      <div
        style={{
          flex: 6,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
        }}
      >
        {/* Green glow */}
        <div
          style={{
            position: 'absolute',
            top: '35%',
            left: '55%',
            width: 500,
            height: 500,
            borderRadius: '50%',
            background: `radial-gradient(circle, rgba(37,211,102,0.08) 0%, transparent 70%)`,
            transform: 'translate(-50%, -50%)',
            filter: 'blur(80px)',
            pointerEvents: 'none',
          }}
        />

        <PhoneMockup width={300} y={floatY}>
          <div style={{ background: COLORS.waDark, height: '100%', position: 'relative' }}>
            {/* WA Header */}
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
                  width: 30,
                  height: 30,
                  borderRadius: 15,
                  background: `${COLORS.whatsapp}20`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: COLORS.whatsapp,
                  fontSize: 14,
                  fontWeight: 700,
                }}
              >
                M
              </div>
              <div>
                <div style={{ color: '#e9edef', fontSize: 11, fontWeight: 600 }}>MasterLeadFlow</div>
                <div style={{ color: '#8696a0', fontSize: 8 }}>online</div>
              </div>
            </div>

            {/* Push notification bar */}
            {local >= PHASE_NOTIFY && local < PHASE_OPEN + 30 && (
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 8,
                  right: 8,
                  background: 'rgba(255,255,255,0.95)',
                  borderRadius: 12,
                  padding: '8px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                  opacity: notifyIn * (local < PHASE_OPEN ? 1 : interpolate(local, [PHASE_OPEN, PHASE_OPEN + 30], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })),
                  transform: `translateY(${interpolate(notifyIn, [0, 1], [-40, 4])}px)`,
                  zIndex: 10,
                }}
              >
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 7,
                    background: COLORS.whatsapp,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    fontSize: 14,
                  }}
                >
                  💬
                </div>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: COLORS.dark }}>MasterLeadFlow</div>
                  <div style={{ fontSize: 8, color: COLORS.graySubtle }}>🔔 New job in your area!</div>
                </div>
              </div>
            )}

            {/* WA message */}
            <div style={{ padding: 10 }}>
              {local >= PHASE_OPEN && (
                <div
                  style={{
                    opacity: msgIn,
                    transform: `translateY(${interpolate(msgIn, [0, 1], [15, 0])}px)`,
                  }}
                >
                  <WhatsAppMessageAd width={250} />
                </div>
              )}
            </div>

            {/* Job detail card overlay */}
            {local >= PHASE_DETAIL && (
              <div
                style={{
                  position: 'absolute',
                  bottom: 80,
                  left: 10,
                  right: 10,
                  background: '#fff',
                  borderRadius: 16,
                  padding: 16,
                  boxShadow: '0 -8px 40px rgba(0,0,0,0.2)',
                  opacity: detailIn,
                  transform: `translateY(${interpolate(detailIn, [0, 1], [40, 0])}px)`,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      background: '#dc262615',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 16,
                    }}
                  >
                    🏠
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.dark }}>Roofing — Hurricane Damage</div>
                    <div style={{ fontSize: 9, color: COLORS.graySubtle, opacity: 0.6 }}>📍 Homestead, FL 33033</div>
                  </div>
                </div>
                {/* Deal terms */}
                <div
                  style={{
                    display: 'flex',
                    gap: 12,
                    padding: '10px 0',
                    borderTop: `1px solid ${COLORS.cardBorder}`,
                    borderBottom: `1px solid ${COLORS.cardBorder}`,
                    marginBottom: 12,
                  }}
                >
                  <div style={{ textAlign: 'center', flex: 1 }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: COLORS.success }}>20%</div>
                    <div style={{ fontSize: 8, color: COLORS.graySubtle, opacity: 0.5 }}>Your cut</div>
                  </div>
                  <div style={{ width: 1, background: COLORS.cardBorder }} />
                  <div style={{ textAlign: 'center', flex: 1 }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: COLORS.primary }}>~$480</div>
                    <div style={{ fontSize: 8, color: COLORS.graySubtle, opacity: 0.5 }}>Estimated</div>
                  </div>
                </div>
                {/* Accept button */}
                <div
                  style={{
                    background:
                      acceptProgress > 0.5
                        ? COLORS.success
                        : COLORS.dark,
                    borderRadius: 50,
                    padding: '10px 0',
                    textAlign: 'center',
                    color: '#fff',
                    fontSize: 13,
                    fontWeight: 700,
                    transform: acceptProgress > 0.5 ? `scale(${acceptScale * 0.1 + 0.95})` : 'scale(1)',
                    transition: 'background 0.2s',
                  }}
                >
                  {acceptProgress > 0.5 ? '✅ Accepted!' : 'Accept Job →'}
                </div>
              </div>
            )}
          </div>
        </PhoneMockup>

        {/* Confetti */}
        {confettiVis > 0 &&
          confetti.map((c, i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                width: c.size,
                height: c.size,
                borderRadius: c.size > 5 ? 2 : '50%',
                background: c.color,
                opacity: Math.max(0, 1 - confettiVis) * 0.8,
                transform: `translate(${c.x * confettiVis}px, ${c.y * confettiVis * c.speed}px) rotate(${c.rotation + confettiVis * 360}deg)`,
                pointerEvents: 'none',
              }}
            />
          ))}
      </div>

      {/* Phase title */}
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
        <h2 style={{ fontSize: 40, margin: 0, color: COLORS.dark, ...FONT.heading }}>
          {phaseTitle}
        </h2>
        <p style={{ fontSize: 16, color: COLORS.graySubtle, opacity: 0.6, marginTop: 8 }}>
          {phaseSub}
        </p>
      </div>
    </AbsoluteFill>
  )
}
