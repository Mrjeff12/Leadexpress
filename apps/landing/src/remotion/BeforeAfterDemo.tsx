import { useMemo } from 'react'
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from 'remotion'

const FPS = 30

/* ─── Helpers ─── */
function sp(frame: number, fps: number, delay: number, cfg?: { damping?: number; stiffness?: number }) {
  return spring({ frame, fps, delay, config: { damping: cfg?.damping ?? 12, stiffness: cfg?.stiffness ?? 140 } })
}

/* ─── Timing ─── */
const BEFORE_START = 0
const SPLIT_START = 80       // divider starts sliding
const AFTER_START = 120      // after items appear
const STATS_START = 240      // final stats
const END = 400

/* ─── Counter animation ─── */
function AnimatedNumber({ value, frame, fps, delay, prefix = '', suffix = '' }: { value: number; frame: number; fps: number; delay: number; prefix?: string; suffix?: string }) {
  const enter = sp(frame, fps, delay, { damping: 15, stiffness: 100 })
  const count = Math.round(value * enter)
  return <span>{prefix}{count.toLocaleString()}{suffix}</span>
}

/* ─── Pain item (before) ─── */
function PainItem({ icon, text, frame, fps, delay }: { icon: string; text: string; frame: number; fps: number; delay: number }) {
  const enter = sp(frame, fps, delay, { damping: 10 })
  return (
    <div style={{
      opacity: enter,
      transform: `translateX(${interpolate(enter, [0, 1], [-30, 0])}px)`,
      display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
      background: 'rgba(255,59,48,0.06)', borderRadius: 12, border: '1px solid rgba(255,59,48,0.1)',
    }}>
      <span style={{ fontSize: 20 }}>{icon}</span>
      <span style={{ fontSize: 13, fontWeight: 500, color: '#666', lineHeight: 1.4 }}>{text}</span>
    </div>
  )
}

/* ─── Gain item (after) ─── */
function GainItem({ icon, text, frame, fps, delay }: { icon: string; text: string; frame: number; fps: number; delay: number }) {
  const enter = sp(frame, fps, delay, { damping: 10 })
  return (
    <div style={{
      opacity: enter,
      transform: `translateX(${interpolate(enter, [0, 1], [30, 0])}px)`,
      display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
      background: 'rgba(21,128,61,0.06)', borderRadius: 12, border: '1px solid rgba(21,128,61,0.1)',
    }}>
      <span style={{ fontSize: 20 }}>{icon}</span>
      <span style={{ fontSize: 13, fontWeight: 500, color: '#333', lineHeight: 1.4 }}>{text}</span>
    </div>
  )
}

/* ═══════════════ MAIN ═══════════════ */
export const BeforeAfterDemo: React.FC = () => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  // Phase animations
  const titleEnter = sp(frame, fps, 5, { damping: 14 })
  const dividerEnter = sp(frame, fps, SPLIT_START, { damping: 14, stiffness: 100 })
  const dividerX = interpolate(dividerEnter, [0, 1], [480, 480]) // center

  // Before label
  const beforeLabel = sp(frame, fps, 15)
  // After label
  const afterLabel = sp(frame, fps, AFTER_START - 10)

  // Stats at bottom
  const statsEnter = sp(frame, fps, STATS_START, { damping: 12 })
  const statsBg = interpolate(statsEnter, [0, 1], [0, 1])

  // Floating
  const floatY = Math.sin(frame * 0.03) * 2

  return (
    <AbsoluteFill style={{
      background: '#fafaf8',
      fontFamily: 'Outfit, system-ui, -apple-system, sans-serif',
    }}>
      {/* Main container */}
      <div style={{ display: 'flex', height: '100%', position: 'relative' }}>

        {/* ─── LEFT: Without Lead Express ─── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '30px 40px 30px 50px' }}>
          {/* Label */}
          <div style={{
            opacity: beforeLabel,
            transform: `translateY(${interpolate(beforeLabel, [0, 1], [10, 0])}px)`,
            marginBottom: 20,
          }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 8, background: 'rgba(255,59,48,0.08)', border: '1px solid rgba(255,59,48,0.15)' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#FF3B30', letterSpacing: 0.5 }}>WITHOUT</span>
            </div>
          </div>

          {/* Pain points */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <PainItem icon="😩" text="Scrolling 100+ groups daily" frame={frame} fps={fps} delay={25} />
            <PainItem icon="❌" text="Missing leads while on a job" frame={frame} fps={fps} delay={35} />
            <PainItem icon="⏰" text="4+ hours wasted every day" frame={frame} fps={fps} delay={45} />
            <PainItem icon="💸" text="$2,300/mo left on the table" frame={frame} fps={fps} delay={55} />
          </div>

          {/* Frustrated emoji */}
          <div style={{
            opacity: sp(frame, fps, 70),
            textAlign: 'center', marginTop: 20, fontSize: 36,
            transform: `translateY(${floatY}px)`,
          }}>
            😤
          </div>
        </div>

        {/* ─── CENTER DIVIDER ─── */}
        <div style={{
          position: 'absolute',
          left: dividerX,
          top: '8%',
          bottom: '8%',
          width: 3,
          opacity: dividerEnter,
          transform: `scaleY(${dividerEnter})`,
          transformOrigin: 'top',
        }}>
          {/* Gradient line */}
          <div style={{
            width: '100%', height: '100%',
            background: 'linear-gradient(180deg, transparent, #fe5b25, #fe5b25, transparent)',
            borderRadius: 2,
          }} />
          {/* VS badge */}
          <div style={{
            position: 'absolute', top: '50%', left: '50%',
            transform: `translate(-50%, -50%) scale(${interpolate(dividerEnter, [0, 1], [0, 1])})`,
            width: 40, height: 40, borderRadius: 20,
            background: 'linear-gradient(135deg, #fe5b25, #e04d1c)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 16px rgba(254,91,37,0.3)',
          }}>
            <span style={{ color: '#fff', fontSize: 11, fontWeight: 800 }}>VS</span>
          </div>
        </div>

        {/* ─── RIGHT: With Lead Express ─── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '30px 50px 30px 40px' }}>
          {/* Label */}
          <div style={{
            opacity: afterLabel,
            transform: `translateY(${interpolate(afterLabel, [0, 1], [10, 0])}px)`,
            marginBottom: 20,
          }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 8, background: 'rgba(21,128,61,0.08)', border: '1px solid rgba(21,128,61,0.15)' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#15803d', letterSpacing: 0.5 }}>WITH LEAD EXPRESS</span>
            </div>
          </div>

          {/* Gain points */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <GainItem icon="✨" text="Leads delivered automatically" frame={frame} fps={fps} delay={AFTER_START} />
            <GainItem icon="✅" text="Every matching lead — never miss one" frame={frame} fps={fps} delay={AFTER_START + 12} />
            <GainItem icon="⏱️" text="0 minutes scrolling groups" frame={frame} fps={fps} delay={AFTER_START + 24} />
            <GainItem icon="💰" text="$4,200/mo in new revenue" frame={frame} fps={fps} delay={AFTER_START + 36} />
          </div>

          {/* Happy emoji */}
          <div style={{
            opacity: sp(frame, fps, AFTER_START + 50),
            textAlign: 'center', marginTop: 20, fontSize: 36,
            transform: `translateY(${floatY}px)`,
          }}>
            🤑
          </div>
        </div>
      </div>

      {/* ─── Bottom stats bar ─── */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        opacity: statsEnter,
        transform: `translateY(${interpolate(statsEnter, [0, 1], [30, 0])}px)`,
      }}>
        <div style={{
          background: 'linear-gradient(135deg, #0d1117, #1a0f0a)',
          padding: '16px 40px',
          display: 'flex', justifyContent: 'center', gap: 60,
        }}>
          {[
            { value: 23, suffix: ' leads/day', label: 'Average delivery', delay: STATS_START + 10 },
            { value: 30, suffix: 's', label: 'Delivery speed', prefix: '<', delay: STATS_START + 18 },
            { value: 4200, suffix: '/mo', label: 'Extra revenue', prefix: '$', delay: STATS_START + 26 },
          ].map((stat, i) => (
            <div key={i} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#fe5b25' }}>
                <AnimatedNumber value={stat.value} frame={frame} fps={fps} delay={stat.delay} prefix={stat.prefix} suffix={stat.suffix} />
              </div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 2, fontWeight: 500 }}>{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  )
}

export const BEFORE_AFTER_DURATION = END
export const BEFORE_AFTER_FPS = FPS
export const BEFORE_AFTER_WIDTH = 960
export const BEFORE_AFTER_HEIGHT = 540
