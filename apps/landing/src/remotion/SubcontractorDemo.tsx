import { useMemo } from 'react'
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from 'remotion'

/* ─── Timing (frames at 30fps) ─── */
const FPS = 30
const P1_LEAD_IN = 0
const P2_SUB_PICK = 100
const P3_WHATSAPP = 210
const P4_DEAL = 350
const P5_DASHBOARD = 470
const P_END = 620

/* ─── Helpers ─── */
function sp(frame: number, fps: number, delay: number, cfg?: { damping?: number; stiffness?: number }) {
  return spring({ frame, fps, delay, config: { damping: cfg?.damping ?? 12, stiffness: cfg?.stiffness ?? 140 } })
}

function NoiseGrain() {
  const frame = useCurrentFrame()
  return (
    <AbsoluteFill style={{
      backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' seed='${frame}' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
      opacity: 0.04, mixBlendMode: 'overlay', pointerEvents: 'none',
    }} />
  )
}

function Particles() {
  const frame = useCurrentFrame()
  const pts = useMemo(() => Array.from({ length: 20 }, () => ({
    x: Math.random() * 960, y: Math.random() * 600 + 50,
    size: Math.random() * 2.5 + 1, speed: Math.random() * 0.6 + 0.3,
    delay: Math.random() * 40, hue: Math.random() * 30 + 15,
  })), [])
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      {pts.map((p, i) => {
        const prog = Math.max(0, frame - p.delay) * p.speed
        return <div key={i} style={{ position: 'absolute', left: p.x + Math.sin(prog * 0.03) * 15, top: p.y - prog * 0.6, width: p.size, height: p.size, borderRadius: '50%', background: `hsla(${p.hue},90%,65%,${Math.max(0, 1 - prog / 300) * 0.3})` }} />
      })}
    </AbsoluteFill>
  )
}

/* ─── Pipeline ─── */
function Pipeline({ progress }: { progress: number }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const barIn = sp(frame, fps, 3, { damping: 15, stiffness: 120 })
  const activeStep = Math.min(Math.floor(progress), 4)
  const stepProgress = progress - activeStep
  const icons = [
    'M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z',
    'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z',
    'M20.01 15.38c-1.23 0-2.42-.2-3.53-.56a.977.977 0 00-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02-.37-1.11-.56-2.3-.56-3.53 0-.54-.45-.99-.99-.99H4.19C3.65 3 3 3.24 3 3.99 3 13.28 10.73 21 20.01 21c.71 0 .99-.63.99-1.18v-3.45c0-.54-.45-.99-.99-.99z',
    'M16.5 3c-1.74 0-3.41.81-4.5 2.09C10.91 3.81 9.24 3 7.5 3 4.42 3 2 5.42 2 8.5c0 3.78 3.4 6.86 8.55 11.54L12 21.35l1.45-1.32C18.6 15.36 22 12.28 22 8.5 22 5.42 19.58 3 16.5 3z',
    'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z',
  ]
  const labels = ['Lead', 'Sub', 'Send', 'Deal', 'Track']

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0, padding: '18px 40px 14px', opacity: barIn, transform: `translateY(${interpolate(barIn, [0, 1], [-12, 0])}px)` }}>
      {icons.map((icon, i) => {
        const isActive = i === activeStep
        const isDone = i < activeStep
        const pulse = isActive ? Math.sin(frame * 0.1) * 0.12 + 0.88 : 0
        const ring = isActive ? frame * 0.8 : 0
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, position: 'relative', transform: isActive ? 'scale(1.08)' : 'scale(1)' }}>
              {isActive && <div style={{ position: 'absolute', top: -4, left: '50%', marginLeft: -32, width: 64, height: 64, borderRadius: 18, border: '2px solid transparent', borderTopColor: 'rgba(254,91,37,0.6)', borderRightColor: 'rgba(254,91,37,0.25)', transform: `rotate(${ring}deg)`, pointerEvents: 'none' }} />}
              <div style={{ width: 56, height: 56, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', background: isActive ? 'linear-gradient(135deg,#fe5b25,#e04d1c)' : isDone ? 'rgba(254,91,37,0.15)' : 'rgba(255,255,255,0.04)', boxShadow: isActive ? `0 5px 20px rgba(254,91,37,${0.3 + pulse * 0.15})` : isDone ? '0 2px 8px rgba(254,91,37,0.08)' : 'inset 0 0 0 1px rgba(255,255,255,0.05)' }}>
                <svg width={24} height={24} viewBox="0 0 24 24"><path d={icon} fill={isActive ? '#fff' : isDone ? '#fe5b25' : 'rgba(255,255,255,0.18)'} /></svg>
              </div>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.6, color: isActive ? '#fff' : isDone ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.15)' }}>{labels[i]}</span>
            </div>
            {i < 4 && (
              <div style={{ width: 44, height: 2, margin: '0 3px', marginBottom: 22, position: 'relative' }}>
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.05)', borderRadius: 1 }} />
                <div style={{ position: 'absolute', top: 0, left: 0, height: '100%', borderRadius: 1, background: 'linear-gradient(90deg,#fe5b25,#ff8a5c)', width: isDone ? '100%' : isActive ? `${stepProgress * 100}%` : '0%' }} />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

/* ─── UI Components ─── */
function LeadCard({ scale = 1, x = 0, y = 0, opacity = 1, rotate = 0 }: { scale?: number; x?: number; y?: number; opacity?: number; rotate?: number }) {
  return (
    <div style={{ transform: `perspective(800px) scale(${scale}) translate(${x}px,${y}px) rotateX(${rotate}deg)`, opacity, background: '#fff', borderRadius: 22, overflow: 'hidden', width: 520, boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }}>
      <div style={{ display: 'flex' }}>
        <div style={{ width: 85, padding: '14px 10px', background: 'rgba(0,0,0,0.02)', borderRight: '1px solid rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: '#FF3B30' }}>🔥 Hot</span>
          <span style={{ fontSize: 9, color: '#aaa' }}>2 min ago</span>
          <div style={{ marginTop: 8, padding: '2px 5px', background: '#f5f5f5', borderRadius: 5, fontSize: 8, color: '#888', fontWeight: 600 }}>GENESIS SAS</div>
        </div>
        <div style={{ flex: 1, padding: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <div style={{ width: 24, height: 24, borderRadius: 7, background: '#ea580c10', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>🏠</div>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#ea580c' }}>Chimney</span>
            <span style={{ fontSize: 8, fontWeight: 700, color: '#FF3B30', background: '#FF3B3010', padding: '1px 4px', borderRadius: 4 }}>URGENT</span>
          </div>
          <p style={{ fontSize: 11, fontWeight: 600, color: '#1a1a1a', margin: 0, lineHeight: 1.5 }}>Chimney repair requested for tomorrow in Cordova, TN.</p>
          <div style={{ display: 'flex', gap: 8, marginTop: 5, fontSize: 9, color: '#999' }}><span>📍 Cordova</span><span>38016</span></div>
        </div>
      </div>
    </div>
  )
}

function SubCard({ scale = 1, x = 0, y = 0, opacity = 1 }: { scale?: number; x?: number; y?: number; opacity?: number }) {
  return (
    <div style={{ transform: `scale(${scale}) translate(${x}px,${y}px)`, opacity, background: '#fff', borderRadius: 16, padding: 16, width: 300, border: '2px solid #fe5b25', boxShadow: '0 12px 40px rgba(254,91,37,0.15)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 36, height: 36, borderRadius: 18, background: 'linear-gradient(135deg,#fee8df,#fff4ef)', border: '1.5px solid #fdd5c5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#e04d1c' }}>MJ</div>
        <div><div style={{ fontSize: 12, fontWeight: 600, color: '#1a1a1a' }}>Mike Johnson</div><div style={{ fontSize: 9, color: '#999' }}>🔧 Plumbing · 3 jobs</div></div>
        <div style={{ marginLeft: 'auto', width: 22, height: 22, borderRadius: 11, background: '#fe5b25', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ color: '#fff', fontSize: 12, fontWeight: 700 }}>✓</span></div>
      </div>
    </div>
  )
}

function Arrow({ opacity = 1, scale = 1 }: { opacity?: number; scale?: number }) {
  return (
    <div style={{ opacity, transform: `scale(${scale})`, padding: '0 6px' }}>
      <svg width={36} height={16} viewBox="0 0 36 16"><line x1={0} y1={8} x2={26} y2={8} stroke="#fe5b25" strokeWidth={2} strokeDasharray="4 3" /><polygon points="26,3 36,8 26,13" fill="#fe5b25" /></svg>
    </div>
  )
}

function WhatsAppBubble({ opacity = 1, scale = 1, y = 0 }: { opacity?: number; scale?: number; y?: number }) {
  return (
    <div style={{ opacity, transform: `scale(${scale}) translateY(${y}px)`, width: 470, borderRadius: 18, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }}>
      <div style={{ background: 'linear-gradient(135deg,#075E54,#128C7E)', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 30, height: 30, borderRadius: 15, background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 10, fontWeight: 700 }}>MJ</div>
        <div><div style={{ color: '#fff', fontSize: 12, fontWeight: 600 }}>Mike Johnson</div><div style={{ color: '#a8d8b4', fontSize: 9 }}>online</div></div>
      </div>
      <div style={{ background: '#e5ddd5', padding: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ alignSelf: 'flex-end', maxWidth: '82%' }}>
          <div style={{ background: '#DCF8C6', borderRadius: '12px 4px 12px 12px', padding: '8px 10px' }}>
            <p style={{ fontSize: 10, color: '#303030', margin: 0, lineHeight: 1.6 }}>Hey Mike! 👋 Chimney repair job:<br />📍 <b>Cordova, TN — 38016</b><br />💰 Deal: <b>20% of job value</b><br />👉 <span style={{ color: '#0366d6', fontSize: 9 }}>portal.masterleadflow.com/j/abc</span></p>
            <div style={{ fontSize: 8, color: '#999', textAlign: 'right', marginTop: 2 }}>2:15 PM <span style={{ color: '#53bdeb', fontWeight: 700 }}>✓✓</span></div>
          </div>
        </div>
        <div style={{ alignSelf: 'flex-start', maxWidth: '55%' }}>
          <div style={{ background: '#fff', borderRadius: '4px 12px 12px 12px', padding: '7px 10px' }}>
            <p style={{ fontSize: 10, color: '#303030', margin: 0 }}>I'm in! Accepting now 🤝</p>
            <div style={{ fontSize: 8, color: '#aaa', textAlign: 'right', marginTop: 2 }}>2:16 PM</div>
          </div>
        </div>
      </div>
    </div>
  )
}

function DealBadge({ opacity = 1, scale = 1, y = 0 }: { opacity?: number; scale?: number; y?: number }) {
  return (
    <div style={{ opacity, transform: `scale(${scale}) translateY(${y}px)`, background: '#fff', borderRadius: 18, padding: 24, width: 400, boxShadow: '0 20px 60px rgba(0,0,0,0.3)', textAlign: 'center' }}>
      <div style={{ fontSize: 40, marginBottom: 6 }}>🤝</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: '#1a1a1a', marginBottom: 6 }}>Deal Accepted!</div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 10 }}>
        <div><div style={{ fontSize: 24, fontWeight: 800, color: '#15803d' }}>20%</div><div style={{ fontSize: 11, color: '#999' }}>Your cut</div></div>
        <div style={{ width: 1, background: '#eee' }} />
        <div><div style={{ fontSize: 24, fontWeight: 800, color: '#e04d1c' }}>$240</div><div style={{ fontSize: 11, color: '#999' }}>Estimated</div></div>
      </div>
      <div style={{ marginTop: 12, padding: '6px 14px', background: '#dcfce7', borderRadius: 8, display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: '#15803d' }}>✅ Forwarded to Mike Johnson</div>
    </div>
  )
}

function DashboardView({ opacity = 1, scale = 1, y = 0 }: { opacity?: number; scale?: number; y?: number }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  return (
    <div style={{ opacity, transform: `scale(${scale}) translateY(${y}px)`, width: 650 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 7, marginBottom: 10 }}>
        {[{ l: 'Total', v: '12', bg: 'linear-gradient(135deg,#fff4ef,#fee8df)', b: '#fdd5c5' }, { l: 'Active', v: '5', bg: '#eef2ff', b: '#c7d2fe' }, { l: 'Done', v: '6', bg: '#ecfdf5', b: '#a7f3d0' }, { l: 'Revenue', v: '$4.2k', bg: '#fffbeb', b: '#fde68a' }].map((s, i) => {
          const kIn = sp(frame, fps, 6 + i * 6)
          return <div key={s.l} style={{ opacity: kIn, transform: `translateY(${interpolate(kIn, [0, 1], [16, 0])}px)`, background: s.bg, border: `1px solid ${s.b}`, borderRadius: 11, padding: 9 }}><div style={{ fontSize: 8, color: '#888' }}>{s.l}</div><div style={{ fontSize: 16, fontWeight: 800, color: '#1a1a1a' }}>{s.v}</div></div>
        })}
      </div>
      <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 6px 24px rgba(0,0,0,0.06)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
          <thead><tr style={{ borderBottom: '1px solid #f0f0f0' }}>{['Job', 'Sub', 'Deal', 'Status', 'Earned'].map(h => <th key={h} style={{ padding: '7px 9px', textAlign: 'left', fontSize: 8, color: '#aaa', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600 }}>{h}</th>)}</tr></thead>
          <tbody>
            {[
              { j: '🏠 Chimney', l: 'Cordova, TN', s: 'Mike J.', d: '20%', st: 'Accepted', sc: '#dbeafe', stc: '#1d4ed8', e: '$240', hi: true },
              { j: '🚪 Garage Door', l: 'Osprey, FL', s: 'Sarah C.', d: '$500', st: 'Done', sc: '#dcfce7', stc: '#15803d', e: '$500', hi: false },
              { j: '🔧 Plumbing', l: 'Miami, FL', s: 'Carlos R.', d: '15%', st: 'Active', sc: '#fef3c7', stc: '#b45309', e: '$120', hi: false },
            ].map((r, i) => {
              const rIn = sp(frame, fps, 18 + i * 7)
              return <tr key={r.j} style={{ borderBottom: '1px solid #f8f8f8', opacity: rIn, transform: `translateX(${interpolate(rIn, [0, 1], [16, 0])}px)`, background: r.hi ? 'rgba(254,91,37,0.03)' : 'transparent' }}>
                <td style={{ padding: '7px 9px' }}><div style={{ fontWeight: 600, color: '#1a1a1a' }}>{r.j}</div><div style={{ fontSize: 8, color: '#aaa' }}>{r.l}</div></td>
                <td style={{ padding: '7px 9px', color: '#555' }}>{r.s}</td>
                <td style={{ padding: '7px 9px', fontFamily: 'monospace', color: '#555' }}>{r.d}</td>
                <td style={{ padding: '7px 9px' }}><span style={{ padding: '2px 5px', borderRadius: 4, fontSize: 8, fontWeight: 700, background: r.sc, color: r.stc }}>{r.st}</span></td>
                <td style={{ padding: '7px 9px', fontWeight: 700, color: '#15803d' }}>{r.e}</td>
              </tr>
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ═══════════════ MAIN COMPOSITION ═══════════════ */
export const SubcontractorDemo: React.FC = () => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const pipelineProgress = interpolate(frame, [P1_LEAD_IN, P5_DASHBOARD + 60], [0, 4.99], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' })
  const glowX = 50 + Math.sin(frame * 0.02) * 8
  const glowY = 35 + Math.cos(frame * 0.015) * 5
  const floatY = Math.sin(frame * 0.035) * 3

  // Phase transitions
  const leadEnter = sp(frame, fps, P1_LEAD_IN + 10, { damping: 10, stiffness: 120 })
  const toP2 = interpolate(frame, [P2_SUB_PICK - 20, P2_SUB_PICK + 20], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const subEnter = sp(frame, fps, P2_SUB_PICK, { damping: 10 })
  const arrowEnter = sp(frame, fps, P2_SUB_PICK + 8)
  const toP3 = interpolate(frame, [P3_WHATSAPP - 20, P3_WHATSAPP + 15], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const waEnter = sp(frame, fps, P3_WHATSAPP, { damping: 10 })
  const p2Out = interpolate(toP3, [0, 0.5], [1, 0], { extrapolateRight: 'clamp' })
  const toP4 = interpolate(frame, [P4_DEAL - 20, P4_DEAL + 15], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const dealEnter = sp(frame, fps, P4_DEAL, { damping: 10 })
  const p3Out = interpolate(toP4, [0, 0.5], [1, 0], { extrapolateRight: 'clamp' })
  const toP5 = interpolate(frame, [P5_DASHBOARD - 20, P5_DASHBOARD + 15], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const dashEnter = sp(frame, fps, P5_DASHBOARD, { damping: 10 })
  const p4Out = interpolate(toP5, [0, 0.5], [1, 0], { extrapolateRight: 'clamp' })

  // Title
  let title = 'A New Lead Comes In'
  let sub = "You get a lead you can't handle — but your network can."
  if (frame >= P2_SUB_PICK - 15) { title = 'Pick a Subcontractor'; sub = 'Choose from your trusted network.' }
  if (frame >= P3_WHATSAPP - 15) { title = 'Send via WhatsApp'; sub = 'A ready-made message with all the details.' }
  if (frame >= P4_DEAL - 15) { title = 'Deal Accepted!'; sub = 'Your terms, your split — confirmed instantly.' }
  if (frame >= P5_DASHBOARD - 15) { title = 'Track in Your Dashboard'; sub = 'Every job, every payment — one view.' }

  return (
    <AbsoluteFill style={{ background: 'linear-gradient(160deg,#12122a 0%,#0a0a18 35%,#180d08 100%)', fontFamily: 'Outfit,system-ui,-apple-system,sans-serif', perspective: 1200 }}>
      <Particles />
      <NoiseGrain />
      <div style={{ position: 'absolute', top: `${glowY}%`, left: `${glowX}%`, width: 450, height: 450, borderRadius: '50%', background: 'radial-gradient(circle,rgba(254,91,37,0.1) 0%,transparent 70%)', transform: 'translate(-50%,-50%)', pointerEvents: 'none', filter: 'blur(40px)' }} />

      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
        <Pipeline progress={pipelineProgress} />

        {/* Title */}
        <div style={{ textAlign: 'center', marginBottom: 12, padding: '0 60px' }}>
          <h2 style={{ background: 'linear-gradient(135deg,#fff 0%,#d0d0d0 50%,#fff 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', fontSize: 34, fontWeight: 800, margin: 0, letterSpacing: -1 }}>{title}</h2>
          <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, marginTop: 6 }}>{sub}</p>
        </div>

        {/* Stage */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
          {/* P1+P2: Lead + Sub */}
          {frame < P3_WHATSAPP + 15 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: p2Out > 0 ? 1 : 0 }}>
              <LeadCard
                scale={interpolate(leadEnter, [0, 1], [0.7, 1]) * interpolate(toP2, [0, 1], [1, 0.8])}
                x={interpolate(toP2, [0, 1], [0, -120])}
                y={interpolate(leadEnter, [0, 1], [60, floatY])}
                opacity={leadEnter * (frame >= P3_WHATSAPP - 20 ? p2Out : 1)}
                rotate={interpolate(leadEnter, [0, 1], [12, 0])}
              />
              {toP2 > 0.1 && <>
                <Arrow opacity={arrowEnter * p2Out} scale={arrowEnter} />
                <SubCard opacity={subEnter * p2Out} scale={subEnter} x={interpolate(subEnter, [0, 1], [30, 0])} y={floatY} />
              </>}
            </div>
          )}

          {/* P3: WhatsApp */}
          {frame >= P3_WHATSAPP - 20 && frame < P4_DEAL + 15 && (
            <div style={{ position: 'absolute' }}>
              <WhatsAppBubble opacity={waEnter * p3Out} scale={interpolate(waEnter, [0, 1], [0.8, 1])} y={interpolate(waEnter, [0, 1], [30, floatY])} />
            </div>
          )}

          {/* P4: Deal */}
          {frame >= P4_DEAL - 20 && frame < P5_DASHBOARD + 15 && (
            <div style={{ position: 'absolute' }}>
              <DealBadge opacity={dealEnter * p4Out} scale={interpolate(dealEnter, [0, 1], [0.8, 1])} y={interpolate(dealEnter, [0, 1], [30, floatY])} />
            </div>
          )}

          {/* P5: Dashboard */}
          {frame >= P5_DASHBOARD - 20 && (
            <div style={{ position: 'absolute' }}>
              <DashboardView opacity={dashEnter} scale={interpolate(dashEnter, [0, 1], [0.85, 1])} y={interpolate(dashEnter, [0, 1], [40, floatY])} />
            </div>
          )}
        </div>
      </div>
    </AbsoluteFill>
  )
}

export const DEMO_DURATION_FRAMES = P_END
export const DEMO_FPS = FPS
export const DEMO_WIDTH = 1280
export const DEMO_HEIGHT = 720
