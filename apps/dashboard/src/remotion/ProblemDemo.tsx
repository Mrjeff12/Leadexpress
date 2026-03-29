import { useMemo } from 'react'
import {
  AbsoluteFill,
  Img,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from 'remotion'

/* ─── Timing (frames at 30fps) ─── */
const FPS = 30
const P1_CHAOS = 0
const P2_GHOST = 160
const P3_BOTH_LOSE = 310
const P_END = 460

/* ─── Helpers ─── */
function sp(frame: number, fps: number, delay: number, cfg?: { damping?: number; stiffness?: number }) {
  return spring({ frame, fps, delay, config: { damping: cfg?.damping ?? 12, stiffness: cfg?.stiffness ?? 140 } })
}

/* ─── Avatar helper ─── */
function Avatar({ id, size = 32, style }: { id: number; size?: number; style?: React.CSSProperties }) {
  return (
    <Img
      src={`https://i.pravatar.cc/${size * 2}?img=${id}`}
      style={{ width: size, height: size, borderRadius: size / 2, objectFit: 'cover', ...style }}
    />
  )
}

/* ─── Noise grain ─── */
function NoiseGrain() {
  const frame = useCurrentFrame()
  return (
    <AbsoluteFill style={{
      backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' seed='${frame}' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
      opacity: 0.03, mixBlendMode: 'overlay', pointerEvents: 'none',
    }} />
  )
}

/* ─── SVG Icons (Lucide-style, for use inside Remotion) ─── */
const iconProps = { width: '100%', height: '100%', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }

function IconDice({ color = 'currentColor', size = 20 }: { color?: string; size?: number }) {
  return <svg {...iconProps} style={{ width: size, height: size, color }}><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><path d="M16 8h.01"/><path d="M12 12h.01"/><path d="M8 16h.01"/></svg>
}
function IconEyeOff({ color = 'currentColor', size = 20 }: { color?: string; size?: number }) {
  return <svg {...iconProps} style={{ width: size, height: size, color }}><path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49"/><path d="M14.084 14.158a3 3 0 0 1-4.242-4.242"/><path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143"/><path d="m2 2 20 20"/></svg>
}
function IconShieldOff({ color = 'currentColor', size = 20 }: { color?: string; size?: number }) {
  return <svg {...iconProps} style={{ width: size, height: size, color }}><path d="m2 2 20 20"/><path d="M5 5a1 1 0 0 0-1 .5V11a10 10 0 0 0 7.45 9.67l.55.17.55-.17A10 10 0 0 0 19.73 14"/><path d="M9.3 3.38A1 1 0 0 1 11 2.5l1-.29 1 .3a14.54 14.54 0 0 1 7 5.5V11"/></svg>
}
function IconHeartCrack({ color = 'currentColor', size = 20 }: { color?: string; size?: number }) {
  return <svg {...iconProps} style={{ width: size, height: size, color }}><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/><path d="m12 13-1-1 2-2-3-3 2-2"/></svg>
}
function IconAlertTriangle({ color = 'currentColor', size = 20 }: { color?: string; size?: number }) {
  return <svg {...iconProps} style={{ width: size, height: size, color }}><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
}
function IconCheck({ color = 'currentColor', size = 14 }: { color?: string; size?: number }) {
  return <svg {...iconProps} style={{ width: size, height: size, color }}><path d="M20 6 9 17l-5-5"/></svg>
}
function IconX({ color = 'currentColor', size = 14 }: { color?: string; size?: number }) {
  return <svg {...iconProps} style={{ width: size, height: size, color }}><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
}
function IconClock({ color = 'currentColor', size = 14 }: { color?: string; size?: number }) {
  return <svg {...iconProps} style={{ width: size, height: size, color }}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
}
function IconDollarSign({ color = 'currentColor', size = 14 }: { color?: string; size?: number }) {
  return <svg {...iconProps} style={{ width: size, height: size, color }}><line x1="12" x2="12" y1="2" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
}
function IconUserX({ color = 'currentColor', size = 20 }: { color?: string; size?: number }) {
  return <svg {...iconProps} style={{ width: size, height: size, color }}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="17" x2="22" y1="8" y2="13"/><line x1="22" x2="17" y1="8" y2="13"/></svg>
}

/* ─── People data (reused across phases) ─── */
const PEOPLE = {
  you: { name: 'You', id: 12 },
  dave: { name: 'Dave Wilson', id: 33 },
  unknown: { name: 'Tony Ramos', id: 51 },
  sub: { name: 'Mike Johnson', id: 15 },
  groupAdmin: { name: 'Ray Cooper', id: 60 },
}

/* ═══════════════════════════════════════
   PHASE 1: WhatsApp Group Chaos
   ═══════════════════════════════════════ */
function WhatsAppChaos({ frame, fps }: { frame: number; fps: number }) {
  const messages = useMemo(() => [
    { text: 'Anyone available for a roof job in Brooklyn? Need someone ASAP 🏠', avatarId: PEOPLE.you.id, sender: PEOPLE.you.name, time: '2:14 PM', delay: 8, side: 'right' as const },
    { text: 'I know a guy, sending his number', avatarId: PEOPLE.dave.id, sender: PEOPLE.dave.name, time: '2:15 PM', delay: 24, side: 'left' as const },
    { text: '+1 (718) 555-0192 — tell him Dave sent you 👍', avatarId: PEOPLE.dave.id, sender: PEOPLE.dave.name, time: '2:15 PM', delay: 40, side: 'left' as const },
    { text: 'Is he licensed? Any reviews?', avatarId: PEOPLE.you.id, sender: PEOPLE.you.name, time: '2:16 PM', delay: 58, side: 'right' as const },
    { text: '🤷‍♂️ No idea, saw him in another group', avatarId: PEOPLE.dave.id, sender: PEOPLE.dave.name, time: '2:17 PM', delay: 76, side: 'left' as const },
  ], [])

  const fadeOut = interpolate(frame, [P2_GHOST - 30, P2_GHOST], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })

  // Warning banner appears after messages
  const warningIn = sp(frame, fps, 95, { damping: 14 })

  return (
    <div style={{ opacity: fadeOut, display: 'flex', gap: 32, alignItems: 'center', justifyContent: 'center', width: '100%', padding: '0 40px' }}>
      {/* Phone mockup */}
      <div style={{
        width: 360, background: '#fff', borderRadius: 28, overflow: 'hidden',
        boxShadow: '0 20px 60px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.05)',
        transform: `scale(${sp(frame, fps, 0)})`,
      }}>
        {/* WhatsApp header */}
        <div style={{
          background: 'linear-gradient(135deg, #075E54, #128C7E)', padding: '12px 14px',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          {/* Group avatar stack */}
          <div style={{ position: 'relative', width: 40, height: 36 }}>
            <Avatar id={33} size={26} style={{ position: 'absolute', top: 0, left: 0, border: '2px solid #075E54' }} />
            <Avatar id={51} size={26} style={{ position: 'absolute', top: 5, left: 14, border: '2px solid #075E54' }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>Contractors NYC 🏗️</div>
            <div style={{ color: '#a8d8b4', fontSize: 9 }}>Dave, Tony, Ray, Mike +43 others</div>
          </div>
        </div>

        {/* Chat area */}
        <div style={{
          background: '#ECE5DD', padding: '8px 10px', minHeight: 280,
          display: 'flex', flexDirection: 'column', gap: 4,
          backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'400\' height=\'400\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cdefs%3E%3Cpattern id=\'p\' patternUnits=\'userSpaceOnUse\' width=\'60\' height=\'60\'%3E%3Ccircle cx=\'5\' cy=\'5\' r=\'1\' fill=\'rgba(0,0,0,0.03)\'/%3E%3C/pattern%3E%3C/defs%3E%3Crect fill=\'url(%23p)\' width=\'100%25\' height=\'100%25\'/%3E%3C/svg%3E")',
        }}>
          {messages.map((msg, i) => {
            const msgIn = sp(frame, fps, msg.delay, { damping: 14, stiffness: 160 })
            return (
              <div key={i} style={{
                opacity: msgIn,
                transform: `translateY(${interpolate(msgIn, [0, 1], [10, 0])}px) scale(${interpolate(msgIn, [0, 1], [0.95, 1])})`,
                alignSelf: msg.side === 'right' ? 'flex-end' : 'flex-start',
                maxWidth: '82%', display: 'flex', gap: 5,
                flexDirection: msg.side === 'right' ? 'row-reverse' : 'row',
                alignItems: 'flex-end',
              }}>
                {msg.side === 'left' && <Avatar id={msg.avatarId} size={22} style={{ flexShrink: 0, marginBottom: 2 }} />}
                <div style={{
                  background: msg.side === 'right' ? '#DCF8C6' : '#fff',
                  borderRadius: msg.side === 'right' ? '14px 4px 14px 14px' : '4px 14px 14px 14px',
                  padding: '5px 8px', boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
                }}>
                  {msg.side === 'left' && (
                    <div style={{ fontSize: 9, fontWeight: 700, color: '#1a8d6e', marginBottom: 1 }}>{msg.sender}</div>
                  )}
                  <p style={{ fontSize: 10.5, color: '#1a1a1a', margin: 0, lineHeight: 1.45 }}>{msg.text}</p>
                  <div style={{ fontSize: 7, color: '#999', textAlign: 'right', marginTop: 1 }}>
                    {msg.time} {msg.side === 'right' && <span style={{ color: '#53bdeb', fontWeight: 700 }}>✓✓</span>}
                  </div>
                </div>
              </div>
            )
          })}

          {/* Warning banner */}
          <div style={{
            opacity: warningIn, transform: `scale(${interpolate(warningIn, [0, 1], [0.9, 1])})`,
            alignSelf: 'center', marginTop: 6,
            background: '#FEF2F2', borderRadius: 10, border: '1px solid #FECACA',
            padding: '6px 14px', display: 'flex', alignItems: 'center', gap: 6,
            boxShadow: '0 2px 8px rgba(220,38,38,0.1)',
          }}>
            <IconAlertTriangle color="#dc2626" size={13} />
            <span style={{ fontSize: 9, fontWeight: 700, color: '#dc2626' }}>No reviews · No rating · No verification</span>
          </div>
        </div>
      </div>

      {/* Side annotation */}
      <div style={{
        opacity: sp(frame, fps, 55) * fadeOut,
        transform: `translateX(${interpolate(sp(frame, fps, 55), [0, 1], [20, 0])}px)`,
        maxWidth: 200,
      }}>
        <div style={{
          width: 48, height: 48, borderRadius: 14, background: '#fee2e2',
          display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12,
        }}>
          <IconDice color="#ef4444" size={22} />
        </div>
        <div style={{ fontSize: 20, fontWeight: 800, color: '#fff', marginBottom: 6, lineHeight: 1.2 }}>
          No Information
        </div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', lineHeight: 1.6 }}>
          You hire from a phone number in a group chat. No way to check their work.
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════
   PHASE 2: Contractor Ghosts
   ═══════════════════════════════════════ */
function GhostScene({ frame, fps }: { frame: number; fps: number }) {
  const localFrame = frame - P2_GHOST
  const enterAnim = sp(frame, fps, P2_GHOST, { damping: 10 })
  const fadeOut = interpolate(frame, [P3_BOTH_LOSE - 30, P3_BOTH_LOSE], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })

  // Staged animations
  const moneyFly = interpolate(localFrame, [45, 85], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const ghostFade = interpolate(localFrame, [65, 105], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const ghostDrift = interpolate(localFrame, [65, 105], [0, -30], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const warningIn = sp(frame, fps, P2_GHOST + 105, { damping: 12 })
  const shake = localFrame > 90 ? Math.sin(localFrame * 0.8) * 1.5 : 0

  return (
    <div style={{ opacity: enterAnim * fadeOut, display: 'flex', gap: 32, alignItems: 'center', justifyContent: 'center' }}>
      {/* Transaction card */}
      <div style={{
        width: 380, background: '#fff', borderRadius: 24, overflow: 'hidden',
        boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
        transform: `scale(${interpolate(enterAnim, [0, 1], [0.85, 1])}) translateX(${shake}px)`,
      }}>
        {/* Card header with profile */}
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid #f0f0f0',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{ position: 'relative' }}>
            <div style={{ opacity: ghostFade, transform: `translateY(${ghostDrift}px)` }}>
              <Avatar id={PEOPLE.unknown.id} size={44} />
            </div>
            {ghostFade < 0.5 && (
              <div style={{
                position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                opacity: 1 - ghostFade,
              }}>
                <IconUserX color="#dc2626" size={26} />
              </div>
            )}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#1a1a1a' }}>{PEOPLE.unknown.name}</span>
              {ghostFade < 0.5 && (
                <span style={{
                  opacity: 1 - ghostFade, fontSize: 8, fontWeight: 700,
                  color: '#dc2626', background: '#fee2e2', padding: '2px 6px', borderRadius: 4,
                }}>OFFLINE</span>
              )}
            </div>
            <div style={{ fontSize: 10, color: '#999', display: 'flex', alignItems: 'center', gap: 4 }}>
              <span>★ No rating</span>
              <span>·</span>
              <span>0 verified jobs</span>
            </div>
          </div>
        </div>

        {/* Payment section */}
        <div style={{ padding: '20px', textAlign: 'center' }}>
          <div style={{ fontSize: 10, color: '#999', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600 }}>
            Deposit Sent
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <span style={{ fontSize: 36, fontWeight: 800, color: '#dc2626' }}>$3,500</span>
            <span style={{
              transform: `translateX(${moneyFly * 80}px) translateY(${moneyFly * -40}px) rotate(${moneyFly * 45}deg)`,
              opacity: 1 - moneyFly, display: 'flex',
            }}><IconDollarSign color="#dc2626" size={28} /></span>
          </div>

          {/* Status messages */}
          <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[
              { text: 'Deposit transferred via Zelle', IconEl: IconCheck, iconColor: '#16a34a', delay: 10 },
              { text: 'Waiting for work to start...', IconEl: IconClock, iconColor: '#f59e0b', delay: 30 },
              { text: 'No response for 3 days', IconEl: IconX, iconColor: '#dc2626', delay: 70, red: true },
            ].map((s, i) => {
              const itemIn = sp(frame, fps, P2_GHOST + s.delay, { damping: 14 })
              return (
                <div key={i} style={{
                  opacity: itemIn,
                  transform: `translateY(${interpolate(itemIn, [0, 1], [6, 0])}px)`,
                  display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center',
                }}>
                  <s.IconEl color={s.iconColor} size={12} />
                  <span style={{ fontSize: 10, color: s.red ? '#dc2626' : '#666', fontWeight: s.red ? 700 : 400 }}>{s.text}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Bottom warning */}
        <div style={{
          opacity: warningIn, transform: `scale(${interpolate(warningIn, [0, 1], [0.95, 1])})`,
          background: '#FEF2F2', borderTop: '1px solid #FECACA', padding: '10px 16px',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        }}>
          <IconUserX color="#dc2626" size={16} />
          <span style={{ fontSize: 10, fontWeight: 700, color: '#dc2626' }}>Contractor disappeared. Money gone.</span>
        </div>
      </div>

      {/* Side annotation */}
      <div style={{
        opacity: sp(frame, fps, P2_GHOST + 45) * fadeOut,
        transform: `translateX(${interpolate(sp(frame, fps, P2_GHOST + 45), [0, 1], [20, 0])}px)`,
        maxWidth: 200,
      }}>
        <div style={{
          width: 48, height: 48, borderRadius: 14, background: '#f3e8ff',
          display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12,
        }}>
          <IconEyeOff color="#8b5cf6" size={22} />
        </div>
        <div style={{ fontSize: 20, fontWeight: 800, color: '#fff', marginBottom: 6, lineHeight: 1.2 }}>
          No Control
        </div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', lineHeight: 1.6 }}>
          They take the deposit and disappear. No protection. No recourse.
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════
   PHASE 3: Both Sides Lose
   ═══════════════════════════════════════ */
function BothLose({ frame, fps }: { frame: number; fps: number }) {
  const enterAnim = sp(frame, fps, P3_BOTH_LOSE, { damping: 10 })
  const leftIn = sp(frame, fps, P3_BOTH_LOSE + 12)
  const rightIn = sp(frame, fps, P3_BOTH_LOSE + 28)
  const lineIn = sp(frame, fps, P3_BOTH_LOSE + 45)
  const bottomIn = sp(frame, fps, P3_BOTH_LOSE + 65)
  const pulse = Math.sin(frame * 0.08) * 0.5 + 0.5

  const cardStyle = (side: 'left' | 'right', animVal: number): React.CSSProperties => ({
    width: 280, background: '#fff', borderRadius: 20, overflow: 'hidden',
    boxShadow: '0 16px 48px rgba(0,0,0,0.3)',
    opacity: animVal,
    transform: `translateX(${interpolate(animVal, [0, 1], [side === 'left' ? -24 : 24, 0])}px)`,
  })

  return (
    <div style={{ opacity: enterAnim, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}>
      <div style={{ display: 'flex', gap: 16, alignItems: 'stretch' }}>
        {/* Hiring side */}
        <div style={cardStyle('left', leftIn)}>
          <div style={{
            padding: '14px 18px', borderBottom: '1px solid #f5f5f5',
            background: 'linear-gradient(135deg, #FFF7ED, #FFEDD5)',
          }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: '#fe5b25', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 8 }}>
              You (Hiring)
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Avatar id={PEOPLE.you.id} size={36} />
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#1a1a1a' }}>Paid $3,500</div>
                <div style={{ fontSize: 9, color: '#dc2626', fontWeight: 600 }}>Job not completed</div>
              </div>
            </div>
          </div>
          <div style={{ padding: '12px 18px' }}>
            {['Lost deposit', 'Job delayed 2 weeks', 'No accountability'].map((t, i) => (
              <div key={t} style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0',
                opacity: sp(frame, fps, P3_BOTH_LOSE + 25 + i * 8),
              }}>
                <IconX color="#dc2626" size={11} />
                <span style={{ fontSize: 10, color: '#666' }}>{t}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Center divider */}
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          opacity: lineIn, gap: 4,
        }}>
          <div style={{ width: 1.5, height: 40, background: 'rgba(255,255,255,0.08)', borderRadius: 1 }} />
          <div style={{
            width: 40, height: 40, borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: `rgba(239,68,68,${0.1 + pulse * 0.1})`, border: '1px solid rgba(239,68,68,0.2)',
          }}>
            <IconHeartCrack color="#ef4444" size={20} />
          </div>
          <div style={{ width: 1.5, height: 40, background: 'rgba(255,255,255,0.08)', borderRadius: 1 }} />
        </div>

        {/* Sub side */}
        <div style={cardStyle('right', rightIn)}>
          <div style={{
            padding: '14px 18px', borderBottom: '1px solid #f5f5f5',
            background: 'linear-gradient(135deg, #EFF6FF, #DBEAFE)',
          }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: '#3b82f6', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 8 }}>
              The Sub
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Avatar id={PEOPLE.sub.id} size={36} />
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#1a1a1a' }}>Did the work</div>
                <div style={{ fontSize: 9, color: '#dc2626', fontWeight: 600 }}>Never got paid</div>
              </div>
            </div>
          </div>
          <div style={{ padding: '12px 18px' }}>
            {['Worked for free', 'No signed contract', 'No proof of agreement'].map((t, i) => (
              <div key={t} style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0',
                opacity: sp(frame, fps, P3_BOTH_LOSE + 38 + i * 8),
              }}>
                <IconX color="#dc2626" size={11} />
                <span style={{ fontSize: 10, color: '#666' }}>{t}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom CTA */}
      <div style={{
        opacity: bottomIn, transform: `scale(${interpolate(bottomIn, [0, 1], [0.9, 1])})`,
        background: 'linear-gradient(135deg, rgba(254,91,37,0.12), rgba(254,91,37,0.06))',
        border: '1px solid rgba(254,91,37,0.2)', borderRadius: 14,
        padding: '10px 24px', textAlign: 'center',
      }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: '#fff', letterSpacing: -0.3 }}>
          Without trust — <span style={{ color: '#fe5b25' }}>everyone loses.</span>
        </div>
      </div>
    </div>
  )
}

/* ═══════════════ PHASE INDICATOR ═══════════════ */
function PhaseIndicator({ frame, fps }: { frame: number; fps: number }) {
  const phases = [
    { label: 'No Info', start: P1_CHAOS, color: '#ef4444', Icon: IconDice },
    { label: 'No Control', start: P2_GHOST, color: '#8b5cf6', Icon: IconEyeOff },
    { label: 'Both Lose', start: P3_BOTH_LOSE, color: '#f59e0b', Icon: IconHeartCrack },
  ]
  const barIn = sp(frame, fps, 5)
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0,
      padding: '16px 40px 8px', opacity: barIn,
    }}>
      {phases.map((p, i) => {
        const isActive = frame >= p.start && (i === phases.length - 1 || frame < phases[i + 1].start)
        const isDone = i < phases.length - 1 && frame >= phases[i + 1].start
        const activeScale = isActive ? 1 + Math.sin(frame * 0.1) * 0.04 : 1
        return (
          <div key={p.label} style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: isActive ? p.color : isDone ? `${p.color}25` : 'rgba(255,255,255,0.04)',
                boxShadow: isActive ? `0 4px 20px ${p.color}50` : 'none',
                transform: `scale(${activeScale})`, transition: 'all 0.3s',
              }}>
                <p.Icon color={isActive ? '#fff' : isDone ? p.color : 'rgba(255,255,255,0.15)'} size={18} />
              </div>
              <span style={{
                fontSize: 8, fontWeight: 700, letterSpacing: 0.6,
                color: isActive ? '#fff' : isDone ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.12)',
              }}>{p.label}</span>
            </div>
            {i < 2 && (
              <div style={{ width: 56, height: 2, margin: '0 8px', marginBottom: 20, position: 'relative' }}>
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.06)', borderRadius: 1 }} />
                <div style={{
                  position: 'absolute', top: 0, left: 0, height: '100%', borderRadius: 1,
                  background: isDone ? `${phases[i + 1].color}` : isActive
                    ? `linear-gradient(90deg, ${p.color}, ${p.color}40)`
                    : 'transparent',
                  width: isDone ? '100%' : isActive
                    ? `${interpolate(frame, [p.start, phases[i + 1].start], [0, 100], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })}%`
                    : '0%',
                }} />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

/* ═══════════════ MAIN COMPOSITION ═══════════════ */
export const ProblemDemo: React.FC = () => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const floatY = Math.sin(frame * 0.028) * 3

  let title = 'No Information'
  let subtitle = 'You hire from a phone number in a group chat.'
  if (frame >= P2_GHOST - 10) { title = 'No Control'; subtitle = 'They take the money. Then disappear.' }
  if (frame >= P3_BOTH_LOSE - 10) { title = 'Both Sides Lose'; subtitle = 'Without trust, nobody wins.' }

  const titleIn = sp(frame, fps, 3)
  const glowX = 50 + Math.sin(frame * 0.018) * 10

  return (
    <AbsoluteFill style={{
      background: 'linear-gradient(160deg, #1a0a0a 0%, #0a0a18 40%, #12080a 100%)',
      fontFamily: 'Outfit, system-ui, -apple-system, sans-serif',
    }}>
      <NoiseGrain />
      <div style={{
        position: 'absolute', top: '30%', left: `${glowX}%`, width: 400, height: 400,
        borderRadius: '50%', background: 'radial-gradient(circle, rgba(239,68,68,0.06) 0%, transparent 70%)',
        transform: 'translate(-50%,-50%)', filter: 'blur(50px)', pointerEvents: 'none',
      }} />

      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
        <PhaseIndicator frame={frame} fps={fps} />

        {/* Title */}
        <div style={{
          textAlign: 'center', marginBottom: 10, padding: '0 40px',
          opacity: titleIn, transform: `translateY(${interpolate(titleIn, [0, 1], [-6, 0])}px)`,
        }}>
          <h2 style={{
            background: 'linear-gradient(135deg, #fff 0%, #ccc 100%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            fontSize: 28, fontWeight: 800, margin: 0, letterSpacing: -0.5,
          }}>{title}</h2>
          <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, marginTop: 3 }}>{subtitle}</p>
        </div>

        {/* Stage */}
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative', transform: `translateY(${floatY}px)`,
        }}>
          {frame < P2_GHOST + 20 && <WhatsAppChaos frame={frame} fps={fps} />}
          {frame >= P2_GHOST - 20 && frame < P3_BOTH_LOSE + 20 && <GhostScene frame={frame} fps={fps} />}
          {frame >= P3_BOTH_LOSE - 20 && <BothLose frame={frame} fps={fps} />}
        </div>
      </div>
    </AbsoluteFill>
  )
}

export const PROBLEM_DURATION_FRAMES = P_END
export const PROBLEM_FPS = FPS
export const PROBLEM_WIDTH = 900
export const PROBLEM_HEIGHT = 560
