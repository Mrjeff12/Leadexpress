import { useEffect, useRef, useState } from 'react'

/* ── mock data ─────────────────────────────────── */
const contractors = [
  {
    name: 'Carlos Rivera',
    avatar: 'CR',
    color: '#3b82f6',
    profession: 'HVAC',
    rating: 4.9,
    jobs: 34,
    zips: 12,
    status: 'Active' as const,
  },
  {
    name: 'Mike Johnson',
    avatar: 'MJ',
    color: '#10b981',
    profession: 'Plumbing',
    rating: 4.8,
    jobs: 28,
    zips: 8,
    status: 'Active' as const,
  },
  {
    name: 'David Chen',
    avatar: 'DC',
    color: '#f59e0b',
    profession: 'Electrical',
    rating: 4.7,
    jobs: 22,
    zips: 15,
    status: 'Active' as const,
  },
]

const jobs = [
  {
    profession: '❄️ HVAC',
    location: 'Miami 33130',
    contractor: 'Carlos R.',
    amount: '$2,400',
    status: 'Completed' as const,
    payment: 'Paid' as const,
  },
  {
    profession: '🔧 Plumbing',
    location: 'Boca Raton 33431',
    contractor: 'Mike J.',
    amount: '$1,850',
    status: 'Accepted' as const,
    payment: 'Pending' as const,
  },
  {
    profession: '⚡ Electrical',
    location: 'Coral Springs 33065',
    contractor: 'David C.',
    amount: '$3,200',
    status: 'Pending' as const,
    payment: 'Unpaid' as const,
  },
  {
    profession: '🏠 Roofing',
    location: 'Homestead 33033',
    contractor: 'Carlos R.',
    amount: '$5,600',
    status: 'Completed' as const,
    payment: 'Paid' as const,
  },
]

const statusStyles: Record<string, { bg: string; text: string }> = {
  Completed: { bg: 'rgba(16,185,129,0.12)', text: '#10b981' },
  Accepted: { bg: 'rgba(59,130,246,0.12)', text: '#3b82f6' },
  Pending: { bg: 'rgba(245,158,11,0.12)', text: '#f59e0b' },
  Rejected: { bg: 'rgba(239,68,68,0.12)', text: '#ef4444' },
}

const paymentStyles: Record<string, { bg: string; text: string }> = {
  Paid: { bg: 'rgba(16,185,129,0.12)', text: '#10b981' },
  Pending: { bg: 'rgba(245,158,11,0.12)', text: '#f59e0b' },
  Unpaid: { bg: 'rgba(0,0,0,0.04)', text: 'rgba(0,0,0,0.35)' },
}

const PANEL_W = 720

/* ── main component ────────────────────────────── */
export default function SubcontractorShowcase() {
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

  return (
    <section ref={sectionRef} className="relative bg-cream section-padding overflow-hidden">
      <style>{`
        @keyframes sc-fade-up {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes sc-scale-in {
          from { opacity: 0; transform: scale(0.92); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes sc-slide-right {
          from { opacity: 0; transform: translateX(-20px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes sc-row-in {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .sc-browser-frame {
          opacity: 0;
          animation: sc-scale-in 0.8s ease-out forwards;
          border-radius: 16px;
          overflow: hidden;
          background: white;
          box-shadow:
            0 0 0 1px rgba(0,0,0,0.06),
            0 24px 80px rgba(0,0,0,0.08),
            0 8px 32px rgba(0,0,0,0.04);
        }
        .sc-browser-bar {
          display: flex; align-items: center;
          padding: 10px 14px;
          background: #f5f5f5;
          border-bottom: 1px solid rgba(0,0,0,0.06);
        }
        .sc-panel {
          background: white;
          padding: 28px;
        }
        @media (min-width: 1024px) {
          .sc-browser-bar { display: none !important; }
          .sc-browser-frame { background: transparent; box-shadow: none; overflow: visible; }
          .sc-panel {
            border: 1px solid rgba(0,0,0,0.06);
            border-radius: 24px;
            background: white;
            box-shadow: 0 24px 80px rgba(0,0,0,0.08), 0 8px 32px rgba(0,0,0,0.04);
          }
        }
        .sc-contractor {
          opacity: 0;
          animation: sc-slide-right 0.5s ease-out forwards;
        }
        .sc-row {
          opacity: 0;
          animation: sc-row-in 0.4s ease-out forwards;
        }
      `}</style>

      <div className="max-w-7xl mx-auto px-6">
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
              Network Management
            </span>
            <h2
              className="text-3xl md:text-4xl lg:text-[42px] lg:leading-[1.12] font-bold text-dark"
              style={{ letterSpacing: '-0.04em' }}
            >
              Your team,
              <br />
              fully managed.
            </h2>
            <p className="text-dark/50 text-base md:text-lg leading-relaxed max-w-md">
              Build your subcontractor network, track every job from assignment to
              payment, and see who performs best — all from one place. Forward leads
              with a tap, track completion, collect payments.
            </p>

            {/* feature bullets */}
            <div className="flex flex-col gap-3 mt-2">
              {[
                ['Contractor Profiles', 'Ratings, specializations, and coverage zones per sub'],
                ['Job Tracking', 'From lead assignment to completion and payment'],
                ['Revenue Dashboard', 'See earnings, outstanding payments, and top performers'],
              ].map(([title, desc], i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-lg bg-[#fe5b25]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <div className="w-2 h-2 rounded-full bg-[#fe5b25]" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-dark">{title}</div>
                    <div className="text-xs text-dark/40">{desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* right: panel */}
          <div className="lg:col-span-8 min-w-0 overflow-hidden">
            {visible && (
              <div ref={frameRef} className="sc-browser-frame" style={{ maxWidth: '100%' }}>
                <div className="sc-browser-bar lg:hidden">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
                    <div className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
                    <div className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
                  </div>
                  <div className="flex-1 mx-4">
                    <div className="bg-black/5 rounded-md px-3 py-1 text-[10px] text-black/40 text-center truncate">
                      app.leadexpress.com/subcontractors
                    </div>
                  </div>
                </div>
              <div ref={innerRef} className="sc-panel">
                {/* contractor cards row */}
                <div className="grid grid-cols-3 gap-3 mb-5">
                  {contractors.map((c, i) => (
                    <div
                      key={c.name}
                      className="sc-contractor rounded-xl p-4"
                      style={{
                        animationDelay: `${200 + i * 150}ms`,
                        background: 'rgba(0,0,0,0.02)',
                        border: '1px solid rgba(0,0,0,0.06)',
                      }}
                    >
                      {/* avatar + name */}
                      <div className="flex items-center gap-3 mb-3">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold text-white"
                          style={{ background: c.color }}
                        >
                          {c.avatar}
                        </div>
                        <div>
                          <div className="text-sm font-bold text-dark">{c.name}</div>
                          <div className="text-[11px]" style={{ color: c.color }}>
                            {c.profession}
                          </div>
                        </div>
                      </div>

                      {/* stats */}
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { label: 'Rating', val: c.rating.toString() },
                          { label: 'Jobs', val: c.jobs.toString() },
                          { label: 'ZIPs', val: c.zips.toString() },
                        ].map((s) => (
                          <div key={s.label} className="text-center">
                            <div className="text-base font-extrabold text-dark">{s.val}</div>
                            <div className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(0,0,0,0.35)' }}>
                              {s.label}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* status badge */}
                      <div className="mt-3 flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#10b981]" />
                        <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#10b981' }}>
                          {c.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* jobs table */}
                <div
                  className="rounded-xl overflow-hidden"
                  style={{
                    background: 'rgba(0,0,0,0.02)',
                    border: '1px solid rgba(0,0,0,0.06)',
                    opacity: 0,
                    animation: visible ? 'sc-fade-up 0.6s 0.8s ease-out forwards' : 'none',
                  }}
                >
                  {/* table header */}
                  <div
                    className="grid grid-cols-6 gap-4 px-5 py-3 text-[10px] font-semibold uppercase tracking-wider"
                    style={{ color: 'rgba(0,0,0,0.35)', borderBottom: '1px solid rgba(0,0,0,0.06)' }}
                  >
                    <span>Job</span>
                    <span className="block">Location</span>
                    <span className="block">Contractor</span>
                    <span className="text-right">Amount</span>
                    <span className="text-center">Status</span>
                    <span className="block text-center">Payment</span>
                  </div>

                  {/* table rows */}
                  {jobs.map((job, i) => {
                    const s = statusStyles[job.status]
                    const p = paymentStyles[job.payment]
                    return (
                      <div
                        key={i}
                        className="sc-row grid grid-cols-6 gap-4 px-5 py-3 items-center"
                        style={{
                          animationDelay: `${1000 + i * 120}ms`,
                          borderBottom: i < jobs.length - 1 ? '1px solid rgba(0,0,0,0.04)' : 'none',
                        }}
                      >
                        <span className="text-[13px] text-dark/80 font-medium">{job.profession}</span>
                        <span className="block text-[12px]" style={{ color: 'rgba(0,0,0,0.45)' }}>{job.location}</span>
                        <span className="block text-[12px] text-dark/60">{job.contractor}</span>
                        <span
                          className="text-[13px] font-bold text-right"
                          style={{ color: 'rgba(0,0,0,0.8)', fontVariantNumeric: 'tabular-nums' }}
                        >
                          {job.amount}
                        </span>
                        <div className="flex justify-center">
                          <span
                            className="px-2.5 py-1 rounded-md text-[10px] font-bold"
                            style={{ background: s.bg, color: s.text }}
                          >
                            {job.status}
                          </span>
                        </div>
                        <div className="flex justify-center">
                          <span
                            className="px-2.5 py-1 rounded-md text-[10px] font-bold"
                            style={{ background: p.bg, color: p.text }}
                          >
                            {job.payment}
                          </span>
                        </div>
                      </div>
                    )
                  })}
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
