import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Sequence,
} from 'remotion'

/* ─── Config ─── */
const STEP_FRAMES = 150 // 5 seconds per step at 30fps
const FADE_IN = 20
const FADE_OUT = 15
const TOTAL_STEPS = 5

/* ─── Shared animation helpers ─── */
function useFadeIn(delay = 0) {
  const frame = useCurrentFrame()
  return interpolate(frame, [delay, delay + FADE_IN], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
}

function useSlideUp(delay = 0) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const s = spring({ frame: Math.max(0, frame - delay), fps, config: { damping: 14, stiffness: 180 } })
  return interpolate(s, [0, 1], [40, 0])
}

function useFadeOut() {
  const frame = useCurrentFrame()
  return interpolate(frame, [STEP_FRAMES - FADE_OUT, STEP_FRAMES], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
}

function StepWrapper({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const opacity = useFadeIn(delay) * useFadeOut()
  const y = useSlideUp(delay)
  return (
    <div style={{ opacity, transform: `translateY(${y}px)` }}>
      {children}
    </div>
  )
}

/* ─── Pipeline Bar (persistent across all steps) ─── */
function Pipeline({ activeStep }: { activeStep: number }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const steps = [
    { icon: '📨', label: 'LEAD' },
    { icon: '👤', label: 'SUB' },
    { icon: '💬', label: 'SEND' },
    { icon: '🤝', label: 'DEAL' },
    { icon: '📊', label: 'TRACK' },
  ]

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 24 }}>
      {steps.map((s, i) => {
        const isActive = i === activeStep
        const isDone = i < activeStep
        const scale = isActive
          ? spring({ frame, fps, config: { damping: 12, stiffness: 200 }, from: 0.8, to: 1.15 })
          : 1

        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center' }}>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4,
                padding: '8px 14px',
                borderRadius: 14,
                background: isActive ? '#fe5b25' : isDone ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.05)',
                transform: `scale(${scale})`,
                boxShadow: isActive ? '0 8px 24px rgba(254,91,37,0.4)' : 'none',
                minWidth: 64,
              }}
            >
              <span style={{ fontSize: 20 }}>{s.icon}</span>
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 800,
                  letterSpacing: 1.2,
                  color: isActive ? '#fff' : isDone ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.25)',
                }}
              >
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                style={{
                  width: 20,
                  height: 2,
                  background: i < activeStep ? 'rgba(254,91,37,0.5)' : 'rgba(255,255,255,0.1)',
                  borderRadius: 1,
                }}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

/* ─── Step 1: A New Lead ─── */
function StepLead() {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const cardScale = spring({ frame: Math.max(0, frame - 10), fps, config: { damping: 12, stiffness: 160 } })
  const hotPulse = interpolate(Math.sin(frame * 0.15), [-1, 1], [0.9, 1.1])

  return (
    <StepWrapper delay={5}>
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <h2 style={{ color: '#fff', fontSize: 28, fontWeight: 800, margin: 0 }}>A New Lead Comes In</h2>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, marginTop: 6 }}>
          You get a lead you can't handle — but your network can.
        </p>
      </div>
      <div
        style={{
          transform: `scale(${cardScale})`,
          background: '#fff',
          borderRadius: 16,
          overflow: 'hidden',
          maxWidth: 480,
          margin: '0 auto',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        }}
      >
        <div style={{ display: 'flex' }}>
          {/* Left: time */}
          <div style={{ width: 110, padding: 16, background: 'rgba(0,0,0,0.02)', borderRight: '1px solid rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#FF3B30', transform: `scale(${hotPulse})`, display: 'inline-block' }}>🔥 Hot</span>
            <span style={{ fontSize: 10, color: '#999' }}>2 min ago</span>
            <span style={{ fontSize: 10, color: '#999', marginTop: 12 }}>GENESIS SAS</span>
          </div>
          {/* Center */}
          <div style={{ flex: 1, padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: '#ea580c15', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>🏠</div>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#ea580c' }}>Chimney</span>
            </div>
            <p style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a', margin: 0, lineHeight: 1.4 }}>
              Chimney repair requested for tomorrow in Cordova, TN.
            </p>
            <div style={{ display: 'flex', gap: 10, marginTop: 6, fontSize: 10, color: '#999' }}>
              <span>📍 Cordova</span>
              <span>38016</span>
            </div>
          </div>
          {/* Right: CTA */}
          <div style={{ width: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12 }}>
            <div style={{ background: '#25D366', color: '#fff', fontSize: 11, fontWeight: 700, padding: '8px 12px', borderRadius: 12, textAlign: 'center' }}>
              💬 Contact
            </div>
          </div>
        </div>
      </div>
    </StepWrapper>
  )
}

/* ─── Step 2: Pick a Sub ─── */
function StepSub() {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const card1 = spring({ frame: Math.max(0, frame - 8), fps, config: { damping: 14, stiffness: 160 } })
  const card2 = spring({ frame: Math.max(0, frame - 18), fps, config: { damping: 14, stiffness: 160 } })
  const checkmark = spring({ frame: Math.max(0, frame - 40), fps, config: { damping: 10, stiffness: 200 } })

  const subs = [
    { name: 'Mike Johnson', phone: '+1 (305) 555-0147', trade: '🔧 Plumbing', jobs: 3, initials: 'MJ', selected: true, anim: card1 },
    { name: 'Sarah Chen', phone: '+1 (786) 555-0234', trade: '⚡ Electrical', jobs: 2, initials: 'SC', selected: false, anim: card2 },
  ]

  return (
    <StepWrapper delay={5}>
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <h2 style={{ color: '#fff', fontSize: 28, fontWeight: 800, margin: 0 }}>Pick a Subcontractor</h2>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, marginTop: 6 }}>Choose from your trusted network.</p>
      </div>
      <div style={{ maxWidth: 400, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {subs.map((sub) => (
          <div
            key={sub.name}
            style={{
              transform: `scale(${sub.anim})`,
              background: '#fff',
              borderRadius: 14,
              padding: 16,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              border: sub.selected ? '2px solid #fe5b25' : '2px solid #e5e5e5',
              boxShadow: sub.selected ? '0 8px 30px rgba(254,91,37,0.2)' : '0 2px 8px rgba(0,0,0,0.05)',
            }}
          >
            <div style={{ width: 44, height: 44, borderRadius: 22, background: 'linear-gradient(135deg, #fee8df, #fff4ef)', border: '1px solid #fdd5c5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#e04d1c' }}>
              {sub.initials}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a' }}>{sub.name}</div>
              <div style={{ fontSize: 10, color: '#999' }}>{sub.phone}</div>
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <span style={{ fontSize: 10, padding: '2px 6px', background: '#f5f5f5', borderRadius: 4, color: '#666' }}>{sub.trade}</span>
                <span style={{ fontSize: 10, color: '#999' }}>{sub.jobs} active jobs</span>
              </div>
            </div>
            {sub.selected && (
              <div style={{ width: 28, height: 28, borderRadius: 14, background: '#fe5b25', display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `scale(${checkmark})` }}>
                <span style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>✓</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </StepWrapper>
  )
}

/* ─── Step 3: WhatsApp Message ─── */
function StepWhatsApp() {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const chatScale = spring({ frame: Math.max(0, frame - 5), fps, config: { damping: 12, stiffness: 140 } })
  const msgIn = spring({ frame: Math.max(0, frame - 15), fps, config: { damping: 14, stiffness: 160 } })
  const reply = spring({ frame: Math.max(0, frame - 70), fps, config: { damping: 14, stiffness: 160 } })
  const replyY = interpolate(reply, [0, 1], [30, 0])

  return (
    <StepWrapper delay={3}>
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <h2 style={{ color: '#fff', fontSize: 28, fontWeight: 800, margin: 0 }}>Send via WhatsApp</h2>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, marginTop: 6 }}>A ready-made message with all the details.</p>
      </div>
      <div style={{ maxWidth: 380, margin: '0 auto', borderRadius: 16, overflow: 'hidden', transform: `scale(${chatScale})`, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        {/* Header */}
        <div style={{ background: '#075E54', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 18, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12, fontWeight: 700 }}>MJ</div>
          <div>
            <div style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>Mike Johnson</div>
            <div style={{ color: '#a8d8b4', fontSize: 10 }}>online</div>
          </div>
        </div>
        {/* Messages */}
        <div style={{ background: '#e5ddd5', padding: 12, minHeight: 200, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Outgoing */}
          <div style={{ opacity: msgIn, transform: `scale(${msgIn})`, transformOrigin: 'right center', alignSelf: 'flex-end', maxWidth: '85%' }}>
            <div style={{ background: '#DCF8C6', borderRadius: '12px 4px 12px 12px', padding: '8px 10px', boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }}>
              <p style={{ fontSize: 11, color: '#303030', margin: 0, lineHeight: 1.6 }}>
                Hey Mike! 👋 Got a chimney repair job for you:
                <br /><br />
                📍 <b>Cordova, TN — 38016</b><br />
                🏠 1766 Black Bear Circle
                <br /><br />
                💰 Deal: <b>20% of job value</b>
                <br /><br />
                👉 View & accept: <span style={{ color: '#0366d6', textDecoration: 'underline' }}>portal.masterleadflow.com/j/abc123</span>
              </p>
              <div style={{ fontSize: 9, color: '#999', textAlign: 'right', marginTop: 4 }}>2:15 PM ✓✓</div>
            </div>
          </div>
          {/* Reply */}
          <div style={{ opacity: reply, transform: `translateY(${replyY}px)`, transformOrigin: 'left center', alignSelf: 'flex-start', maxWidth: '70%' }}>
            <div style={{ background: '#fff', borderRadius: '4px 12px 12px 12px', padding: '8px 10px', boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }}>
              <p style={{ fontSize: 11, color: '#303030', margin: 0 }}>I'm in! Accepting the deal now 🤝</p>
              <div style={{ fontSize: 9, color: '#999', textAlign: 'right', marginTop: 4 }}>2:16 PM</div>
            </div>
          </div>
        </div>
      </div>
    </StepWrapper>
  )
}

/* ─── Step 4: Deal Terms ─── */
function StepDeal() {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const modalScale = spring({ frame: Math.max(0, frame - 5), fps, config: { damping: 12, stiffness: 160 } })
  const checkAnim = spring({ frame: Math.max(0, frame - 30), fps, config: { damping: 10, stiffness: 200 } })

  return (
    <StepWrapper delay={5}>
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <h2 style={{ color: '#fff', fontSize: 28, fontWeight: 800, margin: 0 }}>Set the Deal Terms</h2>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, marginTop: 6 }}>Percentage, fixed price, or custom — you decide.</p>
      </div>
      <div style={{ maxWidth: 360, margin: '0 auto', background: '#fff', borderRadius: 16, padding: 20, transform: `scale(${modalScale})`, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a1a', marginBottom: 12 }}>Forward Lead to Sub</div>
        {/* Lead preview */}
        <div style={{ background: '#fafafa', borderRadius: 12, padding: 12, border: '1px solid #eee', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14 }}>🏠</span>
          <span style={{ fontSize: 12, fontWeight: 500, color: '#444' }}>Chimney Repair — Cordova, TN</span>
        </div>
        {/* Deal type buttons */}
        <div style={{ fontSize: 10, fontWeight: 600, color: '#999', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Deal Type</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
          {['Percentage', 'Fixed Price', 'Custom'].map((t, i) => (
            <div
              key={t}
              style={{
                padding: '8px 4px',
                fontSize: 11,
                fontWeight: 600,
                borderRadius: 12,
                border: i === 0 ? '1.5px solid #fdd5c5' : '1.5px solid #e5e5e5',
                background: i === 0 ? '#fff4ef' : '#fff',
                color: i === 0 ? '#c43d10' : '#666',
                textAlign: 'center',
                transform: i === 0 ? `scale(${checkAnim * 0.05 + 1})` : 'none',
              }}
            >
              {t}
            </div>
          ))}
        </div>
        {/* Value */}
        <div style={{ fontSize: 10, fontWeight: 600, color: '#999', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Your Cut</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <div style={{ flex: 1, height: 40, borderRadius: 12, border: '1.5px solid #e5e5e5', display: 'flex', alignItems: 'center', paddingLeft: 12, fontSize: 16, fontWeight: 700, color: '#1a1a1a' }}>20</div>
          <span style={{ fontSize: 16, fontWeight: 700, color: '#999' }}>%</span>
        </div>
        {/* CTA */}
        <div style={{ background: '#e04d1c', borderRadius: 12, padding: '10px 0', textAlign: 'center', color: '#fff', fontSize: 12, fontWeight: 700 }}>
          📤 Send via WhatsApp
        </div>
      </div>
    </StepWrapper>
  )
}

/* ─── Step 5: Jobs Dashboard ─── */
function StepTrack() {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const dashScale = spring({ frame: Math.max(0, frame - 5), fps, config: { damping: 12, stiffness: 140 } })

  const rows = [
    { job: '🏠 Chimney Repair', loc: 'Cordova, TN', sub: 'Mike J.', deal: '20%', status: 'Accepted', sc: '#dbeafe', stc: '#1d4ed8', pay: 'Pending', pc: '#f5f5f5', ptc: '#666' },
    { job: '🚪 Garage Door', loc: 'Osprey, FL', sub: 'Sarah C.', deal: '$500', status: 'Completed', sc: '#dcfce7', stc: '#15803d', pay: 'Paid', pc: '#dcfce7', ptc: '#15803d' },
    { job: '🔧 Plumbing Fix', loc: 'Miami, FL', sub: 'Carlos R.', deal: '15%', status: 'In Progress', sc: '#fef3c7', stc: '#b45309', pay: 'Partial', pc: '#fef3c7', ptc: '#b45309' },
  ]

  return (
    <StepWrapper delay={5}>
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <h2 style={{ color: '#fff', fontSize: 28, fontWeight: 800, margin: 0 }}>Track in Your Jobs Dashboard</h2>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, marginTop: 6 }}>Status, payments, and sub performance.</p>
      </div>
      <div style={{ maxWidth: 520, margin: '0 auto', transform: `scale(${dashScale})` }}>
        {/* KPI cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
          {[
            { icon: '📋', label: 'Total', value: '12', bg: '#fff4ef', border: '#fdd5c5' },
            { icon: '🔄', label: 'Active', value: '5', bg: '#dbeafe', border: '#bfdbfe' },
            { icon: '✅', label: 'Done', value: '6', bg: '#dcfce7', border: '#bbf7d0' },
            { icon: '💰', label: 'Revenue', value: '$4.2k', bg: '#fef3c7', border: '#fde68a' },
          ].map((s) => (
            <div key={s.label} style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: 12, padding: 10, boxShadow: '0 2px 6px rgba(0,0,0,0.04)' }}>
              <div style={{ fontSize: 10, color: '#666', marginBottom: 2 }}>{s.icon} {s.label}</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#1a1a1a' }}>{s.value}</div>
            </div>
          ))}
        </div>
        {/* Table */}
        <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #eee' }}>
                {['Job', 'Sub', 'Deal', 'Status', 'Payment'].map((h) => (
                  <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontSize: 9, color: '#999', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const rowAnim = spring({ frame: Math.max(0, frame - 20 - i * 8), fps, config: { damping: 14, stiffness: 160 } })
                return (
                  <tr key={r.job} style={{ borderBottom: '1px solid #f5f5f5', opacity: rowAnim, transform: `translateX(${interpolate(rowAnim, [0, 1], [20, 0])}px)` }}>
                    <td style={{ padding: '8px 10px' }}>
                      <div style={{ fontWeight: 600, color: '#1a1a1a' }}>{r.job}</div>
                      <div style={{ fontSize: 9, color: '#999' }}>{r.loc}</div>
                    </td>
                    <td style={{ padding: '8px 10px', color: '#444' }}>{r.sub}</td>
                    <td style={{ padding: '8px 10px', color: '#444', fontFamily: 'monospace' }}>{r.deal}</td>
                    <td style={{ padding: '8px 10px' }}>
                      <span style={{ padding: '2px 6px', borderRadius: 4, fontSize: 9, fontWeight: 700, background: r.sc, color: r.stc }}>{r.status}</span>
                    </td>
                    <td style={{ padding: '8px 10px' }}>
                      <span style={{ padding: '2px 6px', borderRadius: 4, fontSize: 9, fontWeight: 700, background: r.pc, color: r.ptc }}>{r.pay}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </StepWrapper>
  )
}

/* ─── Main Composition ─── */
export const SubcontractorDemo: React.FC = () => {
  const frame = useCurrentFrame()
  const activeStep = Math.min(Math.floor(frame / STEP_FRAMES), TOTAL_STEPS - 1)

  return (
    <AbsoluteFill style={{ background: 'linear-gradient(160deg, #1a1a2e 0%, #0f0f1a 50%, #1a0f0a 100%)', fontFamily: 'Outfit, system-ui, sans-serif', overflow: 'hidden' }}>
      {/* Subtle background glow */}
      <div style={{ position: 'absolute', top: '20%', left: '50%', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(254,91,37,0.08) 0%, transparent 70%)', transform: 'translateX(-50%)', pointerEvents: 'none' }} />

      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', height: '100%', padding: '30px 40px' }}>
        {/* Pipeline */}
        <Pipeline activeStep={activeStep} />

        {/* Steps */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Sequence from={0} durationInFrames={STEP_FRAMES}><StepLead /></Sequence>
          <Sequence from={STEP_FRAMES} durationInFrames={STEP_FRAMES}><StepSub /></Sequence>
          <Sequence from={STEP_FRAMES * 2} durationInFrames={STEP_FRAMES}><StepWhatsApp /></Sequence>
          <Sequence from={STEP_FRAMES * 3} durationInFrames={STEP_FRAMES}><StepDeal /></Sequence>
          <Sequence from={STEP_FRAMES * 4} durationInFrames={STEP_FRAMES}><StepTrack /></Sequence>
        </div>
      </div>
    </AbsoluteFill>
  )
}

export const DEMO_DURATION_FRAMES = STEP_FRAMES * TOTAL_STEPS // 750 frames = 25 seconds at 30fps
export const DEMO_FPS = 30
export const DEMO_WIDTH = 960
export const DEMO_HEIGHT = 600
