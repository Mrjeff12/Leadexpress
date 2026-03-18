import { useMemo } from 'react'
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Easing,
} from 'remotion'
import { TransitionSeries, springTiming } from '@remotion/transitions'
import { fade } from '@remotion/transitions/fade'

/* ─────────────────── Config ─────────────────── */
const SCENE_DURATION = 170     // ~5.6s per scene at 30fps
const TRANSITION_DURATION = 25 // ~0.8s transition overlap

/* ─────────────────── Helpers ─────────────────── */
function useStagger(index: number, baseDelay = 8) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const s = spring({ frame, fps, delay: index * baseDelay + 10, config: { damping: 12, stiffness: 180 } })
  return { opacity: s, y: interpolate(s, [0, 1], [30, 0]), scale: interpolate(s, [0, 1], [0.95, 1]) }
}

function useEnter(delay = 5) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const s = spring({ frame, fps, delay, config: { damping: 14, stiffness: 160 } })
  return s
}

/* ─────────────────── Noise overlay (cinematic grain) ─────────────────── */
function NoiseGrain() {
  const frame = useCurrentFrame()
  return (
    <AbsoluteFill
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' seed='${frame}' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        opacity: 0.04,
        mixBlendMode: 'overlay',
        pointerEvents: 'none',
      }}
    />
  )
}

/* ─────────────────── Floating particles ─────────────────── */
function Particles({ count = 30 }: { count?: number }) {
  const frame = useCurrentFrame()
  const particles = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        x: Math.random() * 960,
        y: Math.random() * 600 + 100,
        size: Math.random() * 3 + 1,
        speed: Math.random() * 0.8 + 0.3,
        delay: Math.random() * 60,
        hue: Math.random() * 40 + 15, // warm orange range
      })),
    [count],
  )
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      {particles.map((p, i) => {
        const progress = Math.max(0, frame - p.delay) * p.speed
        const alpha = Math.max(0, 1 - progress / 250)
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: p.x + Math.sin(progress * 0.03) * 20,
              top: p.y - progress * 0.8,
              width: p.size,
              height: p.size,
              borderRadius: '50%',
              background: `hsla(${p.hue}, 90%, 65%, ${alpha * 0.4})`,
            }}
          />
        )
      })}
    </AbsoluteFill>
  )
}

/* ─────────────────── SVG Step Icons (premium, no emoji) ─────────────────── */
function StepIcon({ type, color = '#fff', size = 20 }: { type: string; color?: string; size?: number }) {
  const paths: Record<string, string> = {
    lead: 'M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z', // mail
    sub: 'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z', // person
    send: 'M20.01 15.38c-1.23 0-2.42-.2-3.53-.56a.977.977 0 00-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02-.37-1.11-.56-2.3-.56-3.53 0-.54-.45-.99-.99-.99H4.19C3.65 3 3 3.24 3 3.99 3 13.28 10.73 21 20.01 21c.71 0 .99-.63.99-1.18v-3.45c0-.54-.45-.99-.99-.99z', // phone
    deal: 'M16.5 3c-1.74 0-3.41.81-4.5 2.09C10.91 3.81 9.24 3 7.5 3 4.42 3 2 5.42 2 8.5c0 3.78 3.4 6.86 8.55 11.54L12 21.35l1.45-1.32C18.6 15.36 22 12.28 22 8.5 22 5.42 19.58 3 16.5 3z', // heart/deal
    track: 'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z', // chart
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d={paths[type] || paths.lead} fill={color} />
    </svg>
  )
}

/* ─────────────────── Pipeline bar (shared across scenes) ─────────────────── */
function Pipeline({ activeStep }: { activeStep: number }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const steps = [
    { type: 'lead', label: 'Lead' },
    { type: 'sub', label: 'Sub' },
    { type: 'send', label: 'Send' },
    { type: 'deal', label: 'Deal' },
    { type: 'track', label: 'Track' },
  ]

  const barEnter = spring({ frame, fps, delay: 3, config: { damping: 15, stiffness: 120 } })

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 0,
        padding: '20px 40px 24px',
        opacity: barEnter,
        transform: `translateY(${interpolate(barEnter, [0, 1], [-15, 0])}px)`,
      }}
    >
      {steps.map((s, i) => {
        const isActive = i === activeStep
        const isDone = i < activeStep
        const activeScale = isActive
          ? spring({ frame, fps, delay: 8, config: { damping: 10, stiffness: 200 }, from: 0.9, to: 1.08 })
          : 1
        const glowPulse = isActive ? Math.sin(frame * 0.1) * 0.15 + 0.85 : 0
        const ringRotate = isActive ? frame * 0.8 : 0

        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center' }}>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 6,
                transform: `scale(${activeScale})`,
                position: 'relative',
              }}
            >
              {/* Animated ring for active step */}
              {isActive && (
                <div style={{
                  position: 'absolute',
                  top: -5,
                  left: '50%',
                  marginLeft: -30,
                  width: 60,
                  height: 60,
                  borderRadius: 18,
                  border: '2px solid transparent',
                  borderTopColor: 'rgba(254,91,37,0.6)',
                  borderRightColor: 'rgba(254,91,37,0.3)',
                  transform: `rotate(${ringRotate}deg)`,
                  pointerEvents: 'none',
                }} />
              )}
              {/* Icon circle */}
              <div
                style={{
                  width: 50,
                  height: 50,
                  borderRadius: 16,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: isActive
                    ? 'linear-gradient(135deg, #fe5b25, #e04d1c)'
                    : isDone
                    ? 'rgba(254,91,37,0.15)'
                    : 'rgba(255,255,255,0.05)',
                  boxShadow: isActive
                    ? `0 6px 24px rgba(254,91,37,${0.35 + glowPulse * 0.2}), inset 0 1px 0 rgba(255,255,255,0.2)`
                    : isDone
                    ? '0 2px 10px rgba(254,91,37,0.12)'
                    : 'inset 0 0 0 1px rgba(255,255,255,0.06)',
                }}
              >
                <StepIcon
                  type={s.type}
                  color={isActive ? '#fff' : isDone ? '#fe5b25' : 'rgba(255,255,255,0.2)'}
                  size={22}
                />
              </div>
              {/* Label */}
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: 0.8,
                  color: isActive ? '#fff' : isDone ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.18)',
                }}
              >
                {s.label}
              </span>
            </div>
            {/* Connector */}
            {i < steps.length - 1 && (
              <div style={{ width: 48, height: 2, margin: '0 4px', marginBottom: 24, position: 'relative' }}>
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.06)', borderRadius: 1 }} />
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    height: '100%',
                    width: isDone ? '100%' : isActive ? '40%' : '0%',
                    background: 'linear-gradient(90deg, #fe5b25, #ff8a5c)',
                    borderRadius: 1,
                  }}
                />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

/* ─────────────────── Scene Title (premium typography) ─────────────────── */
function SceneTitle({ title, subtitle }: { title: string; subtitle: string }) {
  const enter = useEnter(5)
  const subtitleEnter = useEnter(12)

  return (
    <div style={{ textAlign: 'center', padding: '0 60px', marginBottom: 20 }}>
      <h2
        style={{
          background: 'linear-gradient(135deg, #ffffff 0%, #d0d0d0 50%, #ffffff 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          fontSize: 32,
          fontWeight: 800,
          margin: 0,
          letterSpacing: -1,
          lineHeight: 1.15,
          opacity: enter,
          transform: `translateY(${interpolate(enter, [0, 1], [12, 0])}px)`,
        }}
      >
        {title}
      </h2>
      <p
        style={{
          color: 'rgba(255,255,255,0.4)',
          fontSize: 14,
          fontWeight: 400,
          marginTop: 10,
          lineHeight: 1.5,
          letterSpacing: 0.3,
          opacity: subtitleEnter,
          transform: `translateY(${interpolate(subtitleEnter, [0, 1], [8, 0])}px)`,
        }}
      >
        {subtitle}
      </p>
    </div>
  )
}

/* ─────────────────── Scene wrapper with background ─────────────────── */
function SceneBase({ step, children }: { step: number; children: React.ReactNode }) {
  return (
    <AbsoluteFill
      style={{
        background: 'linear-gradient(160deg, #1a1a2e 0%, #0f0f1a 40%, #1a0f0a 100%)',
        fontFamily: 'Outfit, system-ui, -apple-system, sans-serif',
      }}
    >
      <Particles />
      <NoiseGrain />
      {/* Ambient glow */}
      <div
        style={{
          position: 'absolute',
          top: '15%',
          left: '50%',
          width: 400,
          height: 400,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(254,91,37,0.06) 0%, transparent 70%)',
          transform: 'translateX(-50%)',
          pointerEvents: 'none',
        }}
      />
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
        <Pipeline activeStep={step} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          {children}
        </div>
      </div>
    </AbsoluteFill>
  )
}

/* ═══════════════════ SCENE 1: Lead Card ═══════════════════ */
function SceneLead() {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const cardEnter = spring({ frame, fps, delay: 15, config: { damping: 12, stiffness: 140 } })
  const hotPulse = interpolate(Math.sin(frame * 0.15), [-1, 1], [0.92, 1.08])
  const ctaGlow = interpolate(Math.sin(frame * 0.1), [-1, 1], [0.6, 1])

  return (
    <SceneBase step={0}>
      <SceneTitle title="A New Lead Comes In" subtitle="You get a lead you can't handle — but your network can." />
      <div
        style={{
          transform: `scale(${cardEnter}) translateY(${interpolate(cardEnter, [0, 1], [40, 0])}px)`,
          opacity: cardEnter,
          background: '#fff',
          borderRadius: 20,
          overflow: 'hidden',
          width: 520,
          boxShadow: '0 25px 80px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.05)',
        }}
      >
        <div style={{ display: 'flex' }}>
          {/* Time column */}
          <div style={{ width: 120, padding: '18px 14px', background: 'rgba(0,0,0,0.02)', borderRight: '1px solid rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: '#FF3B30', transform: `scale(${hotPulse})`, display: 'inline-block', transformOrigin: 'left' }}>🔥 Hot</span>
            <span style={{ fontSize: 10, color: '#aaa' }}>2 min ago</span>
            <div style={{ marginTop: 12, padding: '4px 8px', background: '#f5f5f5', borderRadius: 6, fontSize: 9, color: '#888', fontWeight: 600 }}>
              📻 GENESIS SAS
            </div>
          </div>
          {/* Content */}
          <div style={{ flex: 1, padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(234,88,12,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🏠</div>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#ea580c' }}>Chimney</span>
              <span style={{ fontSize: 9, fontWeight: 700, color: '#FF3B30', background: '#FF3B3010', padding: '2px 6px', borderRadius: 6 }}>URGENT</span>
            </div>
            <p style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a', margin: 0, lineHeight: 1.5 }}>
              Chimney repair requested for tomorrow in Cordova, TN.
            </p>
            <div style={{ display: 'flex', gap: 12, marginTop: 8, fontSize: 11, color: '#999' }}>
              <span>📍 Cordova, TN</span>
              <span>🏷️ 38016</span>
            </div>
          </div>
          {/* CTA */}
          <div style={{ width: 110, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 14 }}>
            <div
              style={{
                background: '#25D366',
                color: '#fff',
                fontSize: 12,
                fontWeight: 700,
                padding: '10px 14px',
                borderRadius: 14,
                textAlign: 'center',
                boxShadow: `0 4px 16px rgba(37,211,102,${ctaGlow * 0.4})`,
              }}
            >
              💬 Contact
            </div>
          </div>
        </div>
      </div>
    </SceneBase>
  )
}

/* ═══════════════════ SCENE 2: Pick a Sub ═══════════════════ */
function SceneSub() {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const card1 = useStagger(0, 12)
  const card2 = useStagger(1, 12)
  const check = spring({ frame, fps, delay: 45, config: { damping: 8, stiffness: 220 } })
  const checkScale = interpolate(check, [0, 0.5, 1], [0, 1.3, 1])

  const subs = [
    { name: 'Mike Johnson', phone: '+1 (305) 555-0147', trade: '🔧 Plumbing', jobs: 3, initials: 'MJ', selected: true, anim: card1 },
    { name: 'Sarah Chen', phone: '+1 (786) 555-0234', trade: '⚡ Electrical', jobs: 2, initials: 'SC', selected: false, anim: card2 },
  ]

  return (
    <SceneBase step={1}>
      <SceneTitle title="Pick a Subcontractor" subtitle="Choose from your trusted network — see their profile and track record." />
      <div style={{ width: 420, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {subs.map((sub) => (
          <div
            key={sub.name}
            style={{
              opacity: sub.anim.opacity,
              transform: `translateY(${sub.anim.y}px) scale(${sub.anim.scale})`,
              background: '#fff',
              borderRadius: 16,
              padding: 18,
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              border: sub.selected ? '2px solid #fe5b25' : '2px solid #eee',
              boxShadow: sub.selected
                ? '0 12px 40px rgba(254,91,37,0.15), 0 0 0 1px rgba(254,91,37,0.1)'
                : '0 4px 12px rgba(0,0,0,0.04)',
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                background: 'linear-gradient(135deg, #fee8df, #fff4ef)',
                border: '1.5px solid #fdd5c5',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 14,
                fontWeight: 700,
                color: '#e04d1c',
              }}
            >
              {sub.initials}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#1a1a1a' }}>{sub.name}</div>
              <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>{sub.phone}</div>
              <div style={{ display: 'flex', gap: 8, marginTop: 6, alignItems: 'center' }}>
                <span style={{ fontSize: 10, padding: '3px 8px', background: '#f5f5f5', borderRadius: 6, color: '#555', fontWeight: 500 }}>{sub.trade}</span>
                <span style={{ fontSize: 10, color: '#aaa' }}>{sub.jobs} active jobs</span>
              </div>
            </div>
            {sub.selected && (
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 15,
                  background: 'linear-gradient(135deg, #fe5b25, #e04d1c)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transform: `scale(${checkScale})`,
                  boxShadow: '0 4px 12px rgba(254,91,37,0.3)',
                }}
              >
                <span style={{ color: '#fff', fontSize: 16, fontWeight: 700 }}>✓</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </SceneBase>
  )
}

/* ═══════════════════ SCENE 3: WhatsApp ═══════════════════ */
function SceneWhatsApp() {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const chatEnter = spring({ frame, fps, delay: 8, config: { damping: 14, stiffness: 140 } })
  const msgEnter = spring({ frame, fps, delay: 20, config: { damping: 15, stiffness: 160 } })
  const replyEnter = spring({ frame, fps, delay: 80, config: { damping: 14, stiffness: 160 } })
  const tickAnim = spring({ frame, fps, delay: 35, config: { damping: 10, stiffness: 200 } })

  return (
    <SceneBase step={2}>
      <SceneTitle title="Send via WhatsApp" subtitle="A ready-made message goes out with all the lead details and deal terms." />
      <div
        style={{
          width: 400,
          borderRadius: 20,
          overflow: 'hidden',
          transform: `scale(${chatEnter}) translateY(${interpolate(chatEnter, [0, 1], [30, 0])}px)`,
          opacity: chatEnter,
          boxShadow: '0 30px 80px rgba(0,0,0,0.5)',
        }}
      >
        {/* Header */}
        <div style={{ background: 'linear-gradient(135deg, #075E54, #128C7E)', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 20, background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 13, fontWeight: 700, border: '1.5px solid rgba(255,255,255,0.2)' }}>MJ</div>
          <div>
            <div style={{ color: '#fff', fontSize: 15, fontWeight: 600 }}>Mike Johnson</div>
            <div style={{ color: '#a8d8b4', fontSize: 11 }}>online</div>
          </div>
        </div>
        {/* Chat */}
        <div style={{ background: '#e5ddd5', padding: 14, minHeight: 230, display: 'flex', flexDirection: 'column', gap: 10, backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'100\' height=\'100\' viewBox=\'0 0 100 100\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M0 0h100v100H0z\' fill=\'none\'/%3E%3Cpath d=\'M20 20h1v1h-1zM60 40h1v1h-1zM40 70h1v1h-1zM80 80h1v1h-1z\' fill=\'rgba(0,0,0,0.03)\'/%3E%3C/svg%3E")' }}>
          {/* Outgoing message */}
          <div
            style={{
              alignSelf: 'flex-end',
              maxWidth: '82%',
              opacity: msgEnter,
              transform: `scale(${interpolate(msgEnter, [0, 1], [0.8, 1])}) translateX(${interpolate(msgEnter, [0, 1], [20, 0])}px)`,
              transformOrigin: 'right center',
            }}
          >
            <div style={{ background: '#DCF8C6', borderRadius: '14px 4px 14px 14px', padding: '10px 12px', boxShadow: '0 2px 4px rgba(0,0,0,0.06)' }}>
              <p style={{ fontSize: 12, color: '#303030', margin: 0, lineHeight: 1.7 }}>
                Hey Mike! 👋 Got a chimney repair job:
                <br /><br />
                📍 <b>Cordova, TN — 38016</b><br />
                🏠 1766 Black Bear Circle
                <br /><br />
                💰 Deal: <b>20% of job value</b>
                <br /><br />
                👉 <span style={{ color: '#0366d6', textDecoration: 'underline' }}>portal.masterleadflow.com/j/abc</span>
              </p>
              <div style={{ fontSize: 10, color: '#999', textAlign: 'right', marginTop: 5, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 3 }}>
                2:15 PM
                <span style={{ color: tickAnim > 0.5 ? '#53bdeb' : '#999', fontWeight: 700 }}>✓✓</span>
              </div>
            </div>
          </div>
          {/* Reply */}
          <div
            style={{
              alignSelf: 'flex-start',
              maxWidth: '65%',
              opacity: replyEnter,
              transform: `translateY(${interpolate(replyEnter, [0, 1], [20, 0])}px) scale(${interpolate(replyEnter, [0, 1], [0.85, 1])})`,
              transformOrigin: 'left bottom',
            }}
          >
            <div style={{ background: '#fff', borderRadius: '4px 14px 14px 14px', padding: '10px 12px', boxShadow: '0 2px 4px rgba(0,0,0,0.06)' }}>
              <p style={{ fontSize: 12, color: '#303030', margin: 0 }}>I'm in! Accepting now 🤝</p>
              <div style={{ fontSize: 10, color: '#aaa', textAlign: 'right', marginTop: 4 }}>2:16 PM</div>
            </div>
          </div>
        </div>
      </div>
    </SceneBase>
  )
}

/* ═══════════════════ SCENE 4: Deal Terms ═══════════════════ */
function SceneDeal() {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const modalEnter = spring({ frame, fps, delay: 10, config: { damping: 12, stiffness: 150 } })
  const s0 = useStagger(0, 10)
  const s1 = useStagger(1, 10)
  const s2 = useStagger(2, 10)
  const s3 = useStagger(3, 10)
  const selectedPulse = interpolate(Math.sin(frame * 0.1), [-1, 1], [0.98, 1.03])
  const ctaGlow = interpolate(Math.sin(frame * 0.08), [-1, 1], [0.5, 1])

  return (
    <SceneBase step={3}>
      <SceneTitle title="Set the Deal Terms" subtitle="Percentage, fixed price, or custom — you control the split." />
      <div
        style={{
          width: 380,
          background: '#fff',
          borderRadius: 20,
          padding: 24,
          transform: `scale(${modalEnter}) translateY(${interpolate(modalEnter, [0, 1], [30, 0])}px)`,
          opacity: modalEnter,
          boxShadow: '0 30px 80px rgba(0,0,0,0.4)',
        }}
      >
        {/* Header */}
        <div style={{ opacity: s0.opacity, transform: `translateY(${s0.y}px)`, fontSize: 16, fontWeight: 700, color: '#1a1a1a', marginBottom: 14 }}>Forward Lead to Sub</div>
        {/* Lead preview */}
        <div style={{ opacity: s0.opacity, transform: `translateY(${s0.y}px)`, background: 'linear-gradient(135deg, #fafafa, #f5f5f5)', borderRadius: 14, padding: 14, border: '1px solid #eee', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(234,88,12,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>🏠</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#333' }}>Chimney Repair</div>
            <div style={{ fontSize: 10, color: '#999' }}>Cordova, TN — 38016</div>
          </div>
        </div>
        {/* Deal type */}
        <div style={{ opacity: s1.opacity, transform: `translateY(${s1.y}px)` }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8 }}>Deal Type</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 18 }}>
            {['Percentage', 'Fixed Price', 'Custom'].map((t, i) => (
              <div
                key={t}
                style={{
                  padding: '10px 4px',
                  fontSize: 11,
                  fontWeight: 600,
                  borderRadius: 12,
                  border: i === 0 ? '2px solid #fe5b25' : '1.5px solid #e5e5e5',
                  background: i === 0 ? 'linear-gradient(135deg, #fff4ef, #fee8df)' : '#fff',
                  color: i === 0 ? '#c43d10' : '#888',
                  textAlign: 'center',
                  transform: i === 0 ? `scale(${selectedPulse})` : 'none',
                  boxShadow: i === 0 ? '0 4px 12px rgba(254,91,37,0.1)' : 'none',
                }}
              >
                {t}
              </div>
            ))}
          </div>
        </div>
        {/* Value */}
        <div style={{ opacity: s2.opacity, transform: `translateY(${s2.y}px)` }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8 }}>Your Cut</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <div style={{ flex: 1, height: 44, borderRadius: 14, border: '1.5px solid #e5e5e5', display: 'flex', alignItems: 'center', paddingLeft: 14, fontSize: 20, fontWeight: 800, color: '#1a1a1a' }}>20</div>
            <span style={{ fontSize: 20, fontWeight: 800, color: '#ccc' }}>%</span>
          </div>
        </div>
        {/* CTA */}
        <div style={{ opacity: s3.opacity, transform: `translateY(${s3.y}px)` }}>
          <div
            style={{
              background: 'linear-gradient(135deg, #e04d1c, #c43d10)',
              borderRadius: 14,
              padding: '12px 0',
              textAlign: 'center',
              color: '#fff',
              fontSize: 13,
              fontWeight: 700,
              boxShadow: `0 8px 24px rgba(224,77,28,${ctaGlow * 0.3})`,
            }}
          >
            📤 Send via WhatsApp
          </div>
        </div>
      </div>
    </SceneBase>
  )
}

/* ═══════════════════ SCENE 5: Jobs Dashboard ═══════════════════ */
function SceneTrack() {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const dashEnter = spring({ frame, fps, delay: 8, config: { damping: 14, stiffness: 130 } })

  const kpis = [
    { icon: '📋', label: 'Total', value: '12', bg: 'linear-gradient(135deg, #fff4ef, #fee8df)', border: '#fdd5c5' },
    { icon: '🔄', label: 'Active', value: '5', bg: '#eef2ff', border: '#c7d2fe' },
    { icon: '✅', label: 'Done', value: '6', bg: '#ecfdf5', border: '#a7f3d0' },
    { icon: '💰', label: 'Revenue', value: '$4.2k', bg: '#fffbeb', border: '#fde68a' },
  ]

  const rows = [
    { job: '🏠 Chimney Repair', loc: 'Cordova, TN', sub: 'Mike J.', deal: '20%', status: 'Accepted', sc: '#dbeafe', stc: '#1d4ed8', pay: 'Pending', pc: '#f3f4f6', ptc: '#6b7280' },
    { job: '🚪 Garage Door', loc: 'Osprey, FL', sub: 'Sarah C.', deal: '$500', status: 'Completed', sc: '#dcfce7', stc: '#15803d', pay: 'Paid', pc: '#dcfce7', ptc: '#15803d' },
    { job: '🔧 Plumbing Fix', loc: 'Miami, FL', sub: 'Carlos R.', deal: '15%', status: 'In Progress', sc: '#fef3c7', stc: '#b45309', pay: 'Partial', pc: '#fef3c7', ptc: '#b45309' },
  ]

  return (
    <SceneBase step={4}>
      <SceneTitle title="Track in Your Jobs Dashboard" subtitle="Status, payments, and sub performance — all in one view." />
      <div style={{ width: 560, transform: `scale(${dashEnter})`, opacity: dashEnter }}>
        {/* KPI cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10, marginBottom: 14 }}>
          {kpis.map((s, i) => {
            const kpiAnim = useStagger(i, 8)
            return (
              <div
                key={s.label}
                style={{
                  opacity: kpiAnim.opacity,
                  transform: `translateY(${kpiAnim.y}px)`,
                  background: s.bg,
                  border: `1px solid ${s.border}`,
                  borderRadius: 14,
                  padding: 12,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                }}
              >
                <div style={{ fontSize: 10, color: '#888', marginBottom: 4 }}>{s.icon} {s.label}</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#1a1a1a' }}>{s.value}</div>
              </div>
            )
          })}
        </div>
        {/* Table */}
        <div style={{ background: '#fff', borderRadius: 16, overflow: 'hidden', boxShadow: '0 8px 30px rgba(0,0,0,0.06)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
                {['Job', 'Sub', 'Deal', 'Status', 'Payment'].map((h) => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 9, color: '#aaa', textTransform: 'uppercase', letterSpacing: 1.2, fontWeight: 700 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const rowAnim = spring({ frame, fps, delay: 25 + i * 10, config: { damping: 14, stiffness: 160 } })
                return (
                  <tr
                    key={r.job}
                    style={{
                      borderBottom: '1px solid #f8f8f8',
                      opacity: rowAnim,
                      transform: `translateX(${interpolate(rowAnim, [0, 1], [30, 0])}px)`,
                    }}
                  >
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ fontWeight: 600, color: '#1a1a1a', fontSize: 12 }}>{r.job}</div>
                      <div style={{ fontSize: 10, color: '#aaa', marginTop: 1 }}>{r.loc}</div>
                    </td>
                    <td style={{ padding: '10px 12px', color: '#555' }}>{r.sub}</td>
                    <td style={{ padding: '10px 12px', color: '#555', fontFamily: 'monospace' }}>{r.deal}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ padding: '3px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700, background: r.sc, color: r.stc }}>{r.status}</span>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ padding: '3px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700, background: r.pc, color: r.ptc }}>{r.pay}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </SceneBase>
  )
}

/* ═══════════════════ MAIN COMPOSITION ═══════════════════ */
export const SubcontractorDemo: React.FC = () => {
  return (
    <TransitionSeries>
      <TransitionSeries.Sequence durationInFrames={SCENE_DURATION}>
        <SceneLead />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={fade()}
        timing={springTiming({ config: { damping: 200 }, durationInFrames: TRANSITION_DURATION })}
      />
      <TransitionSeries.Sequence durationInFrames={SCENE_DURATION}>
        <SceneSub />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={fade()}
        timing={springTiming({ config: { damping: 200 }, durationInFrames: TRANSITION_DURATION })}
      />
      <TransitionSeries.Sequence durationInFrames={SCENE_DURATION}>
        <SceneWhatsApp />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={fade()}
        timing={springTiming({ config: { damping: 200 }, durationInFrames: TRANSITION_DURATION })}
      />
      <TransitionSeries.Sequence durationInFrames={SCENE_DURATION}>
        <SceneDeal />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={fade()}
        timing={springTiming({ config: { damping: 200 }, durationInFrames: TRANSITION_DURATION })}
      />
      <TransitionSeries.Sequence durationInFrames={SCENE_DURATION}>
        <SceneTrack />
      </TransitionSeries.Sequence>
    </TransitionSeries>
  )
}

// Total: 5 scenes * 170 frames - 4 transitions * 25 frames = 750 frames = 25s at 30fps
export const DEMO_DURATION_FRAMES = SCENE_DURATION * 5 - TRANSITION_DURATION * 4
export const DEMO_FPS = 30
export const DEMO_WIDTH = 960
export const DEMO_HEIGHT = 600
