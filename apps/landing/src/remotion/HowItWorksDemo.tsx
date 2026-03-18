import { useMemo } from 'react'
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from 'remotion'

const FPS = 30
const P1_SETUP = 0
const P2_SCAN = 140
const P3_DELIVER = 280
const P_END = 420

function sp(frame: number, fps: number, delay: number, cfg?: { damping?: number; stiffness?: number }) {
  return spring({ frame, fps, delay, config: { damping: cfg?.damping ?? 12, stiffness: cfg?.stiffness ?? 140 } })
}

/* ─── Step indicator ─── */
function StepIndicator({ step, frame, fps }: { step: number; frame: number; fps: number }) {
  const enter = sp(frame, fps, 5, { damping: 15 })
  const steps = [
    { num: '1', label: 'Set Up', active: step >= 0 },
    { num: '2', label: 'AI Scans', active: step >= 1 },
    { num: '3', label: 'Get Leads', active: step >= 2 },
  ]

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0, padding: '16px 0', opacity: enter }}>
      {steps.map((s, i) => {
        const isActive = i === step
        const isDone = i < step
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 18,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, fontWeight: 800,
                background: isActive ? 'linear-gradient(135deg, #fe5b25, #e04d1c)' : isDone ? '#fe5b25' : 'rgba(254,91,37,0.1)',
                color: isActive || isDone ? '#fff' : '#fe5b25',
                boxShadow: isActive ? '0 4px 16px rgba(254,91,37,0.3)' : 'none',
                transform: isActive ? 'scale(1.1)' : 'scale(1)',
              }}>
                {isDone ? '✓' : s.num}
              </div>
              <span style={{
                fontSize: 13, fontWeight: 700,
                color: isActive ? '#1a1a1a' : isDone ? '#fe5b25' : '#999',
              }}>{s.label}</span>
            </div>
            {i < 2 && (
              <div style={{ width: 50, height: 2, margin: '0 12px', background: isDone ? '#fe5b25' : '#eee', borderRadius: 1 }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

/* ═══ Step 1: Setup ═══ */
function SetupScene({ frame, fps }: { frame: number; fps: number }) {
  const phoneEnter = sp(frame, fps, 15, { damping: 10, stiffness: 120 })
  const chip1 = sp(frame, fps, 40)
  const chip2 = sp(frame, fps, 52)
  const chip3 = sp(frame, fps, 64)
  const zip1 = sp(frame, fps, 80)
  const zip2 = sp(frame, fps, 90)
  const checkAnim = sp(frame, fps, 105, { damping: 8, stiffness: 200 })

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 40 }}>
      {/* Phone mockup */}
      <div style={{
        opacity: phoneEnter,
        transform: `scale(${interpolate(phoneEnter, [0, 1], [0.8, 1])}) translateY(${interpolate(phoneEnter, [0, 1], [30, 0])}px)`,
        width: 220, background: '#fff', borderRadius: 24, padding: 16,
        boxShadow: '0 20px 60px rgba(0,0,0,0.12)', border: '1px solid #eee',
      }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a1a', marginBottom: 12 }}>Your Profile</div>

        <div style={{ fontSize: 10, fontWeight: 600, color: '#999', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Your Trade</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
          {[
            { label: '🔧 Plumbing', anim: chip1 },
            { label: '⚡ Electrical', anim: chip2 },
            { label: '❄️ HVAC', anim: chip3 },
          ].map((c) => (
            <div key={c.label} style={{
              opacity: c.anim,
              transform: `scale(${interpolate(c.anim, [0, 1], [0.7, 1])})`,
              padding: '5px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600,
              background: '#fff4ef', color: '#e04d1c', border: '1px solid #fdd5c5',
            }}>{c.label}</div>
          ))}
        </div>

        <div style={{ fontSize: 10, fontWeight: 600, color: '#999', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Service Areas</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {[
            { label: '📍 Miami, FL', anim: zip1 },
            { label: '📍 33101', anim: zip2 },
          ].map((z) => (
            <div key={z.label} style={{
              opacity: z.anim,
              transform: `translateX(${interpolate(z.anim, [0, 1], [15, 0])}px)`,
              padding: '5px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600,
              background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0',
            }}>{z.label}</div>
          ))}
        </div>

        {/* Done button */}
        <div style={{
          opacity: checkAnim,
          transform: `scale(${interpolate(checkAnim, [0, 0.5, 1], [0.5, 1.15, 1])})`,
          marginTop: 16, padding: '8px 0', borderRadius: 10, textAlign: 'center',
          background: 'linear-gradient(135deg, #fe5b25, #e04d1c)', color: '#fff',
          fontSize: 12, fontWeight: 700,
          boxShadow: '0 4px 12px rgba(254,91,37,0.3)',
        }}>
          ✅ Done — 2 minutes!
        </div>
      </div>
    </div>
  )
}

/* ═══ Step 2: AI Scanning ═══ */
function ScanScene({ frame, fps }: { frame: number; fps: number }) {
  const localFrame = frame - P2_SCAN
  const cardEnter = sp(frame, fps, P2_SCAN + 10, { damping: 10 })
  const scanPulse = Math.sin(localFrame * 0.12) * 0.5 + 0.5
  const groupCount = sp(frame, fps, P2_SCAN + 30)
  const msgCount = sp(frame, fps, P2_SCAN + 45)
  const matchAnim = sp(frame, fps, P2_SCAN + 70, { damping: 8 })

  return (
    <div style={{
      opacity: cardEnter,
      transform: `scale(${interpolate(cardEnter, [0, 1], [0.85, 1])}) translateY(${interpolate(cardEnter, [0, 1], [20, 0])}px)`,
      width: 320, background: '#fff', borderRadius: 20, overflow: 'hidden',
      boxShadow: '0 20px 60px rgba(0,0,0,0.12)', border: '1px solid #eee',
    }}>
      {/* Scanning header */}
      <div style={{
        background: 'linear-gradient(135deg, #0d1117, #1a0f0a)', padding: '14px 16px',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: 10,
          background: `rgba(254,91,37,${0.15 + scanPulse * 0.15})`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 0 ${12 + scanPulse * 8}px rgba(254,91,37,${0.2 + scanPulse * 0.2})`,
        }}>
          <svg width={16} height={16} viewBox="0 0 24 24" fill="#fe5b25" style={{ transform: `rotate(${localFrame * 3}deg)` }}>
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
          </svg>
        </div>
        <div>
          <div style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>AI Scanning 24/7</div>
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10 }}>Reading every message...</div>
        </div>
      </div>

      {/* Stats */}
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: groupCount }}>
          <span style={{ fontSize: 11, color: '#888' }}>Groups monitored</span>
          <span style={{ fontSize: 16, fontWeight: 800, color: '#1a1a1a' }}>{Math.round(47 * groupCount)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: msgCount }}>
          <span style={{ fontSize: 11, color: '#888' }}>Messages scanned today</span>
          <span style={{ fontSize: 16, fontWeight: 800, color: '#1a1a1a' }}>{Math.round(324 * msgCount)}</span>
        </div>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          opacity: matchAnim,
          transform: `scale(${interpolate(matchAnim, [0, 0.5, 1], [0.8, 1.05, 1])})`,
          padding: '8px 12px', borderRadius: 10, background: '#dcfce7', border: '1px solid #bbf7d0',
        }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: '#15803d' }}>Leads matched to you</span>
          <span style={{ fontSize: 18, fontWeight: 800, color: '#15803d' }}>{Math.round(5 * matchAnim)}</span>
        </div>
      </div>
    </div>
  )
}

/* ═══ Step 3: Lead Delivery ═══ */
function DeliverScene({ frame, fps }: { frame: number; fps: number }) {
  const phoneEnter = sp(frame, fps, P3_DELIVER + 10, { damping: 10 })
  const notif = sp(frame, fps, P3_DELIVER + 30, { damping: 8 })
  const msg1 = sp(frame, fps, P3_DELIVER + 50)
  const msg2 = sp(frame, fps, P3_DELIVER + 70)
  const btn = sp(frame, fps, P3_DELIVER + 90, { damping: 8 })

  return (
    <div style={{
      opacity: phoneEnter,
      transform: `scale(${interpolate(phoneEnter, [0, 1], [0.85, 1])}) translateY(${interpolate(phoneEnter, [0, 1], [20, 0])}px)`,
      width: 260, background: '#fff', borderRadius: 28, overflow: 'hidden',
      boxShadow: '0 20px 60px rgba(0,0,0,0.15)', border: '2px solid #eee',
    }}>
      {/* Status bar */}
      <div style={{ background: '#fff', padding: '6px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 10, fontWeight: 600, color: '#000' }}>9:41</span>
        <span style={{ fontSize: 10, color: '#000' }}>●●●</span>
      </div>

      {/* WhatsApp header */}
      <div style={{ background: '#075E54', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 28, height: 28, borderRadius: 14, background: '#25D366', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>L</span>
        </div>
        <div>
          <div style={{ color: '#fff', fontSize: 12, fontWeight: 600 }}>Lead Express</div>
          <div style={{ color: '#a8d8b4', fontSize: 9 }}>online</div>
        </div>
      </div>

      {/* Messages */}
      <div style={{ background: '#ECE5DD', padding: 10, minHeight: 180, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* Notification */}
        <div style={{
          opacity: notif,
          transform: `translateY(${interpolate(notif, [0, 1], [15, 0])}px) scale(${interpolate(notif, [0, 0.5, 1], [0.8, 1.05, 1])})`,
          alignSelf: 'flex-start', maxWidth: '85%',
        }}>
          <div style={{ background: '#DCF8C6', borderRadius: '4px 12px 12px 12px', padding: '8px 10px' }}>
            <p style={{ fontSize: 10, color: '#303030', margin: 0, lineHeight: 1.5 }}>
              🔔 <b>New lead in your area!</b>
            </p>
          </div>
        </div>

        {/* Lead details */}
        <div style={{
          opacity: msg1,
          transform: `translateY(${interpolate(msg1, [0, 1], [15, 0])}px)`,
          alignSelf: 'flex-start', maxWidth: '85%',
        }}>
          <div style={{ background: '#DCF8C6', borderRadius: '4px 12px 12px 12px', padding: '8px 10px' }}>
            <p style={{ fontSize: 10, color: '#303030', margin: 0, lineHeight: 1.6 }}>
              📍 Dallas, TX 75201<br />
              🔧 HVAC installation<br />
              💰 Est: $400-800
            </p>
          </div>
        </div>

        {/* User reply */}
        <div style={{
          opacity: msg2,
          transform: `translateX(${interpolate(msg2, [0, 1], [15, 0])}px)`,
          alignSelf: 'flex-end', maxWidth: '70%',
        }}>
          <div style={{ background: '#fff', borderRadius: '12px 4px 12px 12px', padding: '8px 10px' }}>
            <p style={{ fontSize: 10, color: '#303030', margin: 0 }}>I'm interested! Send details</p>
          </div>
        </div>

        {/* Connected */}
        <div style={{
          opacity: btn,
          transform: `scale(${interpolate(btn, [0, 0.5, 1], [0.7, 1.1, 1])})`,
          alignSelf: 'flex-start', maxWidth: '85%',
        }}>
          <div style={{ background: '#DCF8C6', borderRadius: '4px 12px 12px 12px', padding: '8px 10px' }}>
            <p style={{ fontSize: 10, color: '#303030', margin: 0, lineHeight: 1.5 }}>
              ✅ Connecting you now! 🔧<br />
              Client: Maria Lopez 🟢<br />
              Expecting your call
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ═══ MAIN ═══ */
export const HowItWorksDemo: React.FC = () => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const currentStep = frame < P2_SCAN ? 0 : frame < P3_DELIVER ? 1 : 2
  const floatY = Math.sin(frame * 0.03) * 2

  // Transitions
  const s1Out = interpolate(frame, [P2_SCAN - 15, P2_SCAN], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const s2In = sp(frame, fps, P2_SCAN)
  const s2Out = interpolate(frame, [P3_DELIVER - 15, P3_DELIVER], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const s3In = sp(frame, fps, P3_DELIVER)

  return (
    <AbsoluteFill style={{ background: '#fafaf8', fontFamily: 'Outfit, system-ui, sans-serif' }}>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '0 40px' }}>
        <StepIndicator step={currentStep} frame={frame} fps={fps} />

        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', transform: `translateY(${floatY}px)` }}>
          {/* Step 1 */}
          {frame < P2_SCAN + 15 && (
            <div style={{ position: frame >= P2_SCAN - 15 ? 'absolute' : 'relative', opacity: s1Out }}>
              <SetupScene frame={frame} fps={fps} />
            </div>
          )}

          {/* Step 2 */}
          {frame >= P2_SCAN - 15 && frame < P3_DELIVER + 15 && (
            <div style={{ position: 'absolute', opacity: s2In * s2Out }}>
              <ScanScene frame={frame} fps={fps} />
            </div>
          )}

          {/* Step 3 */}
          {frame >= P3_DELIVER - 15 && (
            <div style={{ position: 'absolute', opacity: s3In }}>
              <DeliverScene frame={frame} fps={fps} />
            </div>
          )}
        </div>
      </div>
    </AbsoluteFill>
  )
}

export const HOW_IT_WORKS_DURATION = P_END
export const HOW_IT_WORKS_FPS = FPS
export const HOW_IT_WORKS_WIDTH = 500
export const HOW_IT_WORKS_HEIGHT = 450
