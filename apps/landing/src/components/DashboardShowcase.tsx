import { useEffect, useRef, useState } from 'react'

/* ── mock data ─────────────────────────────────── */
const kpis = [
  { label: 'Active Jobs', value: 24, prefix: '', suffix: '', color: '#3b82f6' },
  { label: 'Completed', value: 142, prefix: '', suffix: '', color: '#10b981' },
  { label: 'Revenue', value: 48, prefix: '$', suffix: 'K', color: '#fe5b25' },
  { label: 'Win Rate', value: 87, prefix: '', suffix: '%', color: '#8b5cf6' },
]

const leads = [
  {
    profession: 'HVAC',
    icon: '❄️',
    color: '#0284c7',
    summary: 'Need central AC replacement for 2,400 sq ft home, unit is 18 years old...',
    location: 'Miami, FL 33130',
    urgency: 'Hot' as const,
    time: '4m ago',
  },
  {
    profession: 'Plumbing',
    icon: '🔧',
    color: '#7c3aed',
    summary: 'Kitchen remodel needs full re-pipe, copper to PEX, 2 bathrooms...',
    location: 'Fort Lauderdale, FL 33301',
    urgency: 'Warm' as const,
    time: '12m ago',
  },
  {
    profession: 'Electrical',
    icon: '⚡',
    color: '#f59e0b',
    summary: 'Panel upgrade 100A to 200A, adding EV charger circuit in garage...',
    location: 'Boca Raton, FL 33431',
    urgency: 'Hot' as const,
    time: '18m ago',
  },
]

const urgencyStyles = {
  Hot: { bg: 'rgba(255,59,48,0.12)', text: '#FF3B30', dot: '#FF3B30' },
  Warm: { bg: 'rgba(255,149,0,0.12)', text: '#FF9500', dot: '#FF9500' },
  Cold: { bg: 'rgba(90,200,250,0.12)', text: '#5AC8FA', dot: '#5AC8FA' },
}

const zipZones = [
  { x: 48, y: 52, w: 22, h: 18 },
  { x: 38, y: 38, w: 18, h: 20 },
  { x: 56, y: 35, w: 20, h: 22 },
  { x: 30, y: 55, w: 16, h: 16 },
  { x: 62, y: 55, w: 18, h: 14 },
  { x: 44, y: 25, w: 14, h: 16 },
  { x: 70, y: 42, w: 12, h: 18 },
]

/* ── count-up hook ─────────────────────────────── */
function useCountUp(target: number, duration: number, active: boolean) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    if (!active) return
    let start = 0
    const step = Math.ceil(target / (duration / 16))
    const id = setInterval(() => {
      start += step
      if (start >= target) {
        setVal(target)
        clearInterval(id)
      } else {
        setVal(start)
      }
    }, 16)
    return () => clearInterval(id)
  }, [active, target, duration])
  return val
}

/* ── KPI Card ──────────────────────────────────── */
function KpiCard({
  label,
  value,
  prefix,
  suffix,
  color,
  active,
  delay,
}: {
  label: string
  value: number
  prefix: string
  suffix: string
  color: string
  active: boolean
  delay: number
}) {
  const count = useCountUp(value, 1200, active)
  return (
    <div
      className="ds-kpi-card"
      style={{ animationDelay: `${delay}ms`, '--accent': color } as React.CSSProperties}
    >
      <div className="ds-kpi-icon" style={{ background: `${color}15` }}>
        <div className="ds-kpi-dot" style={{ background: color }} />
      </div>
      <div className="ds-kpi-value" style={{ fontVariantNumeric: 'tabular-nums' }}>
        {prefix}
        {count.toLocaleString()}
        {suffix}
      </div>
      <div className="ds-kpi-label">{label}</div>
    </div>
  )
}

const PANEL_DESKTOP_W = 720

/* ── main component ────────────────────────────── */
export default function DashboardShowcase() {
  const sectionRef = useRef<HTMLElement>(null)
  const frameRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = sectionRef.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setVisible(true)
          obs.disconnect()
        }
      },
      { threshold: 0.2 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  /* scale the panel on mobile so it looks like a desktop screenshot */
  useEffect(() => {
    const frame = frameRef.current
    const inner = innerRef.current
    if (!frame || !inner) return

    const update = () => {
      const isDesktop = window.innerWidth >= 1024
      if (isDesktop) {
        inner.style.width = ''
        inner.style.transform = ''
        inner.style.transformOrigin = ''
        frame.style.height = ''
        return
      }
      // Use parent width (the grid column), not frame width
      const containerW = frame.parentElement?.clientWidth || frame.clientWidth
      const scale = containerW / PANEL_DESKTOP_W
      inner.style.width = `${PANEL_DESKTOP_W}px`
      inner.style.transformOrigin = 'top left'
      inner.style.transform = `scale(${scale})`
      // set frame height to match scaled content
      frame.style.height = `${inner.scrollHeight * scale}px`
    }

    update()
    window.addEventListener('resize', update)
    // re-calc after animations settle
    const t = setTimeout(update, 900)
    return () => {
      window.removeEventListener('resize', update)
      clearTimeout(t)
    }
  }, [visible])

  return (
    <section ref={sectionRef} className="relative bg-cream section-padding overflow-hidden">
      {/* injected keyframes */}
      <style>{`
        @keyframes ds-fade-up {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes ds-scale-in {
          from { opacity: 0; transform: scale(0.92); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes ds-pulse-zone {
          0%, 100% { opacity: 0.35; }
          50%      { opacity: 0.55; }
        }
        @keyframes ds-lead-slide {
          from { opacity: 0; transform: translateX(20px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        .ds-kpi-card {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 16px;
          padding: 20px;
          opacity: 0;
          animation: ds-fade-up 0.6s ease-out forwards;
        }
        .ds-kpi-icon {
          width: 32px; height: 32px;
          border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
          margin-bottom: 14px;
        }
        .ds-kpi-dot {
          width: 10px; height: 10px;
          border-radius: 50%;
        }
        .ds-kpi-value {
          font-size: 28px;
          font-weight: 800;
          color: #fff;
          letter-spacing: -0.04em;
          line-height: 1;
        }
        .ds-kpi-label {
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: rgba(255,255,255,0.4);
          margin-top: 6px;
        }
        .ds-browser-frame {
          opacity: 0;
          animation: ds-scale-in 0.8s ease-out forwards;
          border-radius: 16px;
          overflow: hidden;
          background: #1a1a1a;
          box-shadow:
            0 0 0 1px rgba(255,255,255,0.06),
            0 24px 80px rgba(0,0,0,0.5),
            0 8px 32px rgba(0,0,0,0.3);
        }
        .ds-browser-bar {
          display: flex;
          align-items: center;
          padding: 10px 14px;
          background: #1a1a1a;
          border-bottom: 1px solid rgba(255,255,255,0.06);
        }
        .ds-panel-inner {
          background: #111;
          padding: 32px;
        }
        @media (min-width: 1024px) {
          .ds-browser-bar { display: none !important; }
          .ds-browser-frame {
            background: transparent;
            box-shadow: none;
            overflow: visible;
          }
          .ds-panel-inner {
            border: 1px solid rgba(255,255,255,0.06);
            border-radius: 24px;
            box-shadow:
              0 0 0 1px rgba(255,255,255,0.03),
              0 24px 80px rgba(0,0,0,0.5),
              0 8px 32px rgba(0,0,0,0.3);
          }
        }
        .ds-lead-card {
          opacity: 0;
          animation: ds-lead-slide 0.5s ease-out forwards;
        }
        .ds-map-zone {
          animation: ds-pulse-zone 3s ease-in-out infinite;
        }
      `}</style>

      <div className="max-w-7xl mx-auto px-6">
        {/* ── text + panel grid ── */}
        <div className="grid lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          {/* left: text */}
          <div
            className="lg:col-span-4 flex flex-col gap-6"
            style={{
              opacity: visible ? 1 : 0,
              transform: visible ? 'translateY(0)' : 'translateY(30px)',
              transition: 'all 0.7s ease-out',
            }}
          >
            <span className="text-[11px] font-semibold tracking-widest uppercase text-[#fe5b25]">
              Command Center
            </span>
            <h2
              className="text-3xl md:text-4xl lg:text-[42px] lg:leading-[1.12] font-bold text-dark"
              style={{ letterSpacing: '-0.04em' }}
            >
              Your business,
              <br />
              one dashboard.
            </h2>
            <p className="text-gray-subtle/70 text-base md:text-lg leading-relaxed max-w-md">
              Track every lead, job, and dollar in real-time. KPI cards update live,
              the coverage map shows where you operate, and the feed keeps incoming
              leads flowing — all without switching tabs.
            </p>

            {/* feature bullets */}
            <div className="flex flex-col gap-3 mt-2">
              {[
                ['Live KPIs', 'Revenue, active jobs, and win rate at a glance'],
                ['Coverage Map', 'See your active ZIP codes highlighted in real-time'],
                ['Lead Feed', 'New leads appear instantly with profession & urgency'],
              ].map(([title, desc], i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-lg bg-[#fe5b25]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <div className="w-2 h-2 rounded-full bg-[#fe5b25]" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-dark">{title}</div>
                    <div className="text-xs text-gray-subtle/60">{desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* right: dark floating panel */}
          <div className="lg:col-span-8 min-w-0 overflow-hidden">
            {visible && (
              <div ref={frameRef} className="ds-browser-frame lg:!transform-none" style={{ overflow: 'hidden', maxWidth: '100%' }}>
                {/* browser chrome bar — mobile only */}
                <div className="ds-browser-bar lg:hidden">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
                    <div className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
                    <div className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
                  </div>
                  <div className="flex-1 mx-4">
                    <div className="bg-white/5 rounded-md px-3 py-1 text-[10px] text-white/30 text-center truncate">
                      app.leadexpress.com/dashboard
                    </div>
                  </div>
                </div>
                <div ref={innerRef} className="ds-panel-inner">
                {/* KPI row */}
                <div className="grid grid-cols-4 gap-3 mb-6">
                  {kpis.map((k, i) => (
                    <KpiCard key={k.label} {...k} active={visible} delay={200 + i * 120} />
                  ))}
                </div>

                {/* map + leads row */}
                <div className="grid grid-cols-2 gap-4">
                  {/* mini coverage map */}
                  <div
                    className="relative rounded-2xl overflow-hidden"
                    style={{
                      background: '#1a1a1a',
                      border: '1px solid rgba(255,255,255,0.06)',
                      aspectRatio: '4/3',
                      opacity: 0,
                      animation: visible ? 'ds-fade-up 0.6s 0.7s ease-out forwards' : 'none',
                    }}
                  >
                    {/* map grid lines */}
                    <svg className="absolute inset-0 w-full h-full" style={{ opacity: 0.08 }}>
                      {Array.from({ length: 12 }).map((_, i) => (
                        <line
                          key={`h${i}`}
                          x1="0"
                          y1={`${(i + 1) * 8}%`}
                          x2="100%"
                          y2={`${(i + 1) * 8}%`}
                          stroke="#fff"
                          strokeWidth="0.5"
                        />
                      ))}
                      {Array.from({ length: 12 }).map((_, i) => (
                        <line
                          key={`v${i}`}
                          x1={`${(i + 1) * 8}%`}
                          y1="0"
                          x2={`${(i + 1) * 8}%`}
                          y2="100%"
                          stroke="#fff"
                          strokeWidth="0.5"
                        />
                      ))}
                    </svg>

                    {/* zip zones */}
                    <svg className="absolute inset-0 w-full h-full">
                      {zipZones.map((z, i) => (
                        <rect
                          key={i}
                          x={`${z.x}%`}
                          y={`${z.y}%`}
                          width={`${z.w}%`}
                          height={`${z.h}%`}
                          rx="4"
                          fill="#10b981"
                          className="ds-map-zone"
                          style={{ animationDelay: `${i * 0.4}s` }}
                        />
                      ))}
                    </svg>

                    {/* map label */}
                    <div className="absolute bottom-3 left-3 flex items-center gap-2">
                      <div
                        className="px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider"
                        style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981' }}
                      >
                        7 Active Zones
                      </div>
                    </div>

                    {/* header */}
                    <div
                      className="absolute top-3 left-3 text-[11px] font-semibold uppercase tracking-wider"
                      style={{ color: 'rgba(255,255,255,0.3)' }}
                    >
                      Coverage Map
                    </div>
                  </div>

                  {/* lead cards */}
                  <div className="flex flex-col gap-2.5">
                    <div
                      className="text-[11px] font-semibold uppercase tracking-wider mb-1"
                      style={{
                        color: 'rgba(255,255,255,0.3)',
                        opacity: 0,
                        animation: visible ? 'ds-fade-up 0.5s 0.8s ease-out forwards' : 'none',
                      }}
                    >
                      Recent Leads
                    </div>
                    {leads.map((lead, i) => {
                      const u = urgencyStyles[lead.urgency]
                      return (
                        <div
                          key={i}
                          className="ds-lead-card"
                          style={{
                            animationDelay: `${900 + i * 150}ms`,
                            background: 'rgba(255,255,255,0.03)',
                            border: '1px solid rgba(255,255,255,0.06)',
                            borderRadius: '14px',
                            padding: '14px 16px',
                          }}
                        >
                          <div className="flex items-start gap-3">
                            {/* profession icon */}
                            <div
                              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-base"
                              style={{ background: `${lead.color}18` }}
                            >
                              {lead.icon}
                            </div>

                            <div className="flex-1 min-w-0">
                              {/* top row */}
                              <div className="flex items-center justify-between mb-1">
                                <span
                                  className="text-xs font-bold"
                                  style={{ color: lead.color }}
                                >
                                  {lead.profession}
                                </span>
                                <div className="flex items-center gap-1.5">
                                  <span
                                    className="px-2 py-0.5 rounded-md text-[10px] font-bold"
                                    style={{ background: u.bg, color: u.text }}
                                  >
                                    {lead.urgency}
                                  </span>
                                  <span
                                    className="text-[10px]"
                                    style={{ color: 'rgba(255,255,255,0.25)' }}
                                  >
                                    {lead.time}
                                  </span>
                                </div>
                              </div>

                              {/* summary */}
                              <p
                                className="text-[13px] leading-snug"
                                style={{
                                  color: 'rgba(255,255,255,0.6)',
                                  display: '-webkit-box',
                                  WebkitLineClamp: 2,
                                  WebkitBoxOrient: 'vertical',
                                  overflow: 'hidden',
                                }}
                              >
                                {lead.summary}
                              </p>

                              {/* location */}
                              <div
                                className="text-[11px] mt-1 flex items-center gap-1"
                                style={{ color: 'rgba(255,255,255,0.3)' }}
                              >
                                <svg
                                  className="w-3 h-3"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                                  />
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                                  />
                                </svg>
                                {lead.location}
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
