import { useEffect, useRef, useState } from 'react'

/* ── mock data ─────────────────────────────────── */
const filters = ['All', 'HVAC', 'Plumbing', 'Electrical', 'Roofing', 'Painting']

const leads = [
  // HVAC
  {
    profession: 'HVAC',
    icon: '❄️',
    color: '#0284c7',
    summary: 'Central AC not cooling — 2,400 sq ft house, unit is from 2008. Need full replacement quote ASAP.',
    location: 'Miami, FL 33130',
    urgency: 'Hot' as const,
    time: '2m ago',
    group: 'South FL Contractors',
    contacts: 3,
  },
  {
    profession: 'HVAC',
    icon: '❄️',
    color: '#0284c7',
    summary: 'Ductless mini-split install — 3 zones, 2nd floor addition. Looking for licensed HVAC with Mitsubishi experience.',
    location: 'Fort Lauderdale, FL 33301',
    urgency: 'Warm' as const,
    time: '18m ago',
    group: 'Broward HVAC Pros',
    contacts: 2,
  },
  {
    profession: 'HVAC',
    icon: '❄️',
    color: '#0284c7',
    summary: 'Commercial rooftop unit not blowing cold. Restaurant kitchen — need emergency service today.',
    location: 'Doral, FL 33178',
    urgency: 'Hot' as const,
    time: '5m ago',
    group: 'Miami Dade Contractors',
    contacts: 4,
  },
  // Roofing
  {
    profession: 'Roofing',
    icon: '🏠',
    color: '#dc2626',
    summary: 'Hurricane damage on tile roof, multiple leaks in master bedroom and garage. Insurance claim filed.',
    location: 'Homestead, FL 33033',
    urgency: 'Hot' as const,
    time: '8m ago',
    group: 'Miami Dade Roofers',
    contacts: 5,
  },
  {
    profession: 'Roofing',
    icon: '🏠',
    color: '#dc2626',
    summary: 'Full shingle tear-off and replacement — 2,800 sq ft ranch. Insurance approved, ready to start.',
    location: 'Pembroke Pines, FL 33024',
    urgency: 'Warm' as const,
    time: '25m ago',
    group: 'South FL Roofers',
    contacts: 3,
  },
  {
    profession: 'Roofing',
    icon: '🏠',
    color: '#dc2626',
    summary: 'Flat roof coating for commercial warehouse — 5,000 sq ft. Need quote by Friday.',
    location: 'Hialeah, FL 33012',
    urgency: 'Warm' as const,
    time: '42m ago',
    group: 'FL Commercial Contractors',
    contacts: 1,
  },
  // Electrical
  {
    profession: 'Electrical',
    icon: '⚡',
    color: '#f59e0b',
    summary: 'New construction — wiring for 4-bed home, 200A panel, smart home pre-wire, EV charger ready.',
    location: 'Coral Springs, FL 33065',
    urgency: 'Warm' as const,
    time: '15m ago',
    group: 'Broward Electricians',
    contacts: 2,
  },
  {
    profession: 'Electrical',
    icon: '⚡',
    color: '#f59e0b',
    summary: 'Panel upgrade from 100A to 200A — older home, need to pass inspection for insurance.',
    location: 'Hollywood, FL 33020',
    urgency: 'Hot' as const,
    time: '6m ago',
    group: 'South FL Electricians',
    contacts: 4,
  },
  {
    profession: 'Electrical',
    icon: '⚡',
    color: '#f59e0b',
    summary: 'Whole-home generator install — 22kW Generac. Already have the unit, need licensed installer.',
    location: 'Weston, FL 33327',
    urgency: 'Warm' as const,
    time: '31m ago',
    group: 'Broward Contractors',
    contacts: 2,
  },
  // Plumbing
  {
    profession: 'Plumbing',
    icon: '🔧',
    color: '#7c3aed',
    summary: 'Slab leak detected, water bill doubled last month. Need camera inspection and repair estimate.',
    location: 'Boca Raton, FL 33431',
    urgency: 'Warm' as const,
    time: '22m ago',
    group: 'Palm Beach Plumbers',
    contacts: 1,
  },
  {
    profession: 'Plumbing',
    icon: '🔧',
    color: '#7c3aed',
    summary: 'Whole-house repipe — galvanized to PEX. 3 bath, 2,200 sq ft. Need licensed plumber ASAP.',
    location: 'Davie, FL 33314',
    urgency: 'Hot' as const,
    time: '9m ago',
    group: 'Broward Plumbers',
    contacts: 3,
  },
  {
    profession: 'Plumbing',
    icon: '🔧',
    color: '#7c3aed',
    summary: 'Water heater replacement — 50 gal tank to tankless. Garage install, gas line already there.',
    location: 'Plantation, FL 33317',
    urgency: 'Warm' as const,
    time: '35m ago',
    group: 'South FL Plumbers',
    contacts: 2,
  },
  // Painting
  {
    profession: 'Painting',
    icon: '🎨',
    color: '#8b5cf6',
    summary: 'Interior repaint — 4 bed, 3 bath, 2,600 sq ft. Walls + ceilings + trim. Sherwin-Williams preferred.',
    location: 'Aventura, FL 33180',
    urgency: 'Warm' as const,
    time: '12m ago',
    group: 'Miami Painters',
    contacts: 2,
  },
  {
    profession: 'Painting',
    icon: '🎨',
    color: '#8b5cf6',
    summary: 'Exterior stucco paint — 3,400 sq ft two-story. Pressure wash + prime + 2 coats. Need it done this week.',
    location: 'Kendall, FL 33156',
    urgency: 'Hot' as const,
    time: '4m ago',
    group: 'South FL Painters',
    contacts: 5,
  },
  {
    profession: 'Painting',
    icon: '🎨',
    color: '#8b5cf6',
    summary: 'Cabinet refinishing — full kitchen, 42 doors + drawers. Spray finish, white to navy blue.',
    location: 'Coral Gables, FL 33134',
    urgency: 'Warm' as const,
    time: '28m ago',
    group: 'Miami Dade Contractors',
    contacts: 1,
  },
]

const urgencyStyles = {
  Hot: { bg: 'rgba(255,59,48,0.12)', text: '#FF3B30' },
  Warm: { bg: 'rgba(255,149,0,0.12)', text: '#FF9500' },
  Cold: { bg: 'rgba(90,200,250,0.12)', text: '#5AC8FA' },
}

/* sparkline data points (fake lead volume over 14 days) */
const sparkData = [3, 5, 4, 8, 12, 9, 14, 11, 16, 13, 18, 15, 22, 19]

function buildSparkPath(data: number[], w: number, h: number) {
  const max = Math.max(...data)
  const step = w / (data.length - 1)
  return data
    .map((d, i) => {
      const x = i * step
      const y = h - (d / max) * (h - 8) - 4
      return `${i === 0 ? 'M' : 'L'}${x},${y}`
    })
    .join(' ')
}

/* ── main component ────────────────────────────── */
const PANEL_W = 720

export default function LeadsFeedShowcase() {
  const sectionRef = useRef<HTMLElement>(null)
  const frameRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const [activeFilter, setActiveFilter] = useState(0)

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
      { threshold: 0.15 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  useEffect(() => {
    const frame = frameRef.current
    const inner = innerRef.current
    if (!frame || !inner) return
    const update = () => {
      if (window.innerWidth >= 1024) {
        inner.style.width = ''; inner.style.transform = ''; frame.style.height = ''
        return
      }
      const cw = frame.parentElement?.clientWidth || frame.clientWidth
      const s = cw / PANEL_W
      inner.style.width = `${PANEL_W}px`
      inner.style.transformOrigin = 'top left'
      inner.style.transform = `scale(${s})`
      frame.style.height = `${inner.scrollHeight * s}px`
    }
    update()
    window.addEventListener('resize', update)
    const t = setTimeout(update, 900)
    return () => { window.removeEventListener('resize', update); clearTimeout(t) }
  }, [visible])

  /* auto-cycle filter for visual flair */
  useEffect(() => {
    if (!visible) return
    const id = setInterval(() => {
      setActiveFilter((p) => (p + 1) % filters.length)
    }, 2400)
    return () => clearInterval(id)
  }, [visible])

  const sparkPath = buildSparkPath(sparkData, 220, 48)

  return (
    <section ref={sectionRef} className="relative bg-white section-padding overflow-hidden">
      <style>{`
        @keyframes lf-fade-up {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes lf-card-in {
          from { opacity: 0; transform: translateY(16px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes lf-draw {
          from { stroke-dashoffset: 600; }
          to   { stroke-dashoffset: 0; }
        }
        @keyframes lf-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(255,59,48,0.3); }
          50%      { box-shadow: 0 0 0 6px rgba(255,59,48,0); }
        }
        .lf-browser-frame {
          opacity: 0;
          animation: lf-fade-up 0.8s ease-out forwards;
          border-radius: 16px;
          overflow: hidden;
          background: #1a1a1a;
          box-shadow:
            0 0 0 1px rgba(255,255,255,0.06),
            0 24px 80px rgba(0,0,0,0.45),
            0 8px 32px rgba(0,0,0,0.25);
        }
        .lf-browser-bar {
          display: flex; align-items: center;
          padding: 10px 14px;
          background: #1a1a1a;
          border-bottom: 1px solid rgba(255,255,255,0.06);
        }
        .lf-panel {
          background: #111;
          padding: 28px;
        }
        @media (min-width: 1024px) {
          .lf-browser-bar { display: none !important; }
          .lf-browser-frame { background: transparent; box-shadow: none; overflow: visible; }
          .lf-panel {
            border: 1px solid rgba(255,255,255,0.06);
            border-radius: 24px;
            box-shadow: 0 0 0 1px rgba(255,255,255,0.03), 0 24px 80px rgba(0,0,0,0.45), 0 8px 32px rgba(0,0,0,0.25);
          }
        }
        .lf-card {
          opacity: 0;
        }
        .lf-filter-active {
          background: #fe5b25 !important;
          color: #fff !important;
          box-shadow: 0 4px 12px rgba(254,91,37,0.3);
        }
        .lf-spark-line {
          stroke-dasharray: 600;
          animation: lf-draw 2s ease-out forwards;
        }
        .lf-live-dot {
          animation: lf-pulse 2s ease-in-out infinite;
        }
      `}</style>

      <div className="max-w-7xl mx-auto px-6">
        <div className="grid lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          {/* left: dark panel */}
          <div className="lg:col-span-8 lg:order-1 order-2 min-w-0 overflow-hidden">
            {visible && (
              <div ref={frameRef} className="lf-browser-frame" style={{ maxWidth: '100%' }}>
                <div className="lf-browser-bar lg:hidden">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
                    <div className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
                    <div className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
                  </div>
                  <div className="flex-1 mx-4">
                    <div className="bg-white/5 rounded-md px-3 py-1 text-[10px] text-white/30 text-center truncate">
                      app.leadexpress.com/leads
                    </div>
                  </div>
                </div>
              <div ref={innerRef} className="lf-panel">
                {/* top bar: filter chips + live badge */}
                <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    {filters.map((f, i) => (
                      <button
                        key={f}
                        className={`px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all duration-300 ${
                          i === activeFilter ? 'lf-filter-active' : ''
                        }`}
                        style={
                          i !== activeFilter
                            ? { background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.35)' }
                            : undefined
                        }
                        onClick={() => setActiveFilter(i)}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-[#10b981] lf-live-dot" />
                    <span
                      className="text-[10px] font-bold uppercase tracking-wider"
                      style={{ color: '#10b981' }}
                    >
                      Scanning 847 groups
                    </span>
                  </div>
                </div>

                {/* lead cards */}
                <div className="flex flex-col gap-3">
                  {leads
                    .filter((l) => activeFilter === 0 || l.profession.toLowerCase() === filters[activeFilter].toLowerCase())
                    .slice(0, 4)
                    .map((lead, i) => {
                    const u = urgencyStyles[lead.urgency]
                    return (
                      <div
                        key={`${lead.profession}-${lead.location}`}
                        className="lf-card"
                        style={{
                          animation: `lf-card-in 0.35s ${100 + i * 80}ms ease-out both`,
                          background: 'rgba(255,255,255,0.03)',
                          border: '1px solid rgba(255,255,255,0.06)',
                          borderRadius: '16px',
                          padding: '16px 20px',
                        }}
                      >
                        <div className="flex items-start gap-4">
                          {/* profession badge */}
                          <div
                            className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 text-lg"
                            style={{ background: `${lead.color}15` }}
                          >
                            {lead.icon}
                          </div>

                          <div className="flex-1 min-w-0">
                            {/* header row */}
                            <div className="flex items-center justify-between mb-1.5">
                              <div className="flex items-center gap-2.5">
                                <span className="text-sm font-bold" style={{ color: lead.color }}>
                                  {lead.profession}
                                </span>
                                <span
                                  className="px-2 py-0.5 rounded-md text-[10px] font-bold"
                                  style={{ background: u.bg, color: u.text }}
                                >
                                  {lead.urgency}
                                </span>
                              </div>
                              <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.2)' }}>
                                {lead.time}
                              </span>
                            </div>

                            {/* summary */}
                            <p
                              className="text-[13px] leading-relaxed mb-2"
                              style={{
                                color: 'rgba(255,255,255,0.55)',
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden',
                              }}
                            >
                              {lead.summary}
                            </p>

                            {/* meta row */}
                            <div className="flex items-center gap-4 text-[11px]" style={{ color: 'rgba(255,255,255,0.25)' }}>
                              <div className="flex items-center gap-1">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                {lead.location}
                              </div>
                              <div className="flex items-center gap-1">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                {lead.contacts} contacts
                              </div>
                              <div className="flex items-center gap-1">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                </svg>
                                {lead.group}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* sparkline chart bar */}
                <div
                  className="mt-5 rounded-xl flex items-center justify-between px-5 py-4"
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    opacity: 0,
                    animation: visible ? 'lf-fade-up 0.6s 1.4s ease-out forwards' : 'none',
                  }}
                >
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.3)' }}>
                      Leads this week
                    </div>
                    <div className="text-xl font-extrabold text-white mt-0.5" style={{ fontVariantNumeric: 'tabular-nums' }}>
                      142
                      <span className="text-xs font-bold ml-2" style={{ color: '#10b981' }}>
                        +23%
                      </span>
                    </div>
                  </div>
                  <svg width="220" height="48" className="overflow-visible">
                    {/* gradient fill under line */}
                    <defs>
                      <linearGradient id="lf-spark-grad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#fe5b25" stopOpacity="0.2" />
                        <stop offset="100%" stopColor="#fe5b25" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <path
                      d={`${sparkPath} L220,48 L0,48 Z`}
                      fill="url(#lf-spark-grad)"
                      style={{ opacity: visible ? 1 : 0, transition: 'opacity 1s 1.6s' }}
                    />
                    <path
                      d={sparkPath}
                      fill="none"
                      stroke="#fe5b25"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="lf-spark-line"
                      style={{ animationDelay: '1.5s' }}
                    />
                    {/* end dot */}
                    <circle
                      cx="220"
                      cy={48 - (sparkData[sparkData.length - 1] / Math.max(...sparkData)) * 40 - 4}
                      r="4"
                      fill="#fe5b25"
                      style={{ opacity: visible ? 1 : 0, transition: 'opacity 0.3s 2.5s' }}
                    />
                  </svg>
                </div>
              </div>
              </div>
            )}
          </div>

          {/* right: text */}
          <div
            className="lg:col-span-4 lg:order-2 order-1 flex flex-col gap-6"
            style={{
              opacity: visible ? 1 : 0,
              transform: visible ? 'translateY(0)' : 'translateY(30px)',
              transition: 'all 0.7s ease-out',
            }}
          >
            <span className="text-[11px] font-semibold tracking-widest uppercase text-[#fe5b25]">
              AI Lead Extraction
            </span>
            <h2
              className="text-3xl md:text-4xl lg:text-[42px] lg:leading-[1.12] font-bold text-dark"
              style={{ letterSpacing: '-0.04em' }}
            >
              Every lead,
              <br />
              auto-captured.
            </h2>
            <p className="text-gray-subtle/70 text-base md:text-lg leading-relaxed max-w-md">
              Our AI scans 800+ WhatsApp groups around the clock, extracting leads
              with profession, location, and urgency — delivered to your feed
              before competitors even see the message.
            </p>

            {/* feature bullets */}
            <div className="flex flex-col gap-3 mt-2">
              {[
                ['24/7 Scanning', '847 active groups monitored in real-time'],
                ['Smart Filtering', 'Filter by profession, urgency, or location instantly'],
                ['AI Extraction', 'Profession, ZIP, and urgency parsed automatically'],
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
        </div>
      </div>
    </section>
  )
}
