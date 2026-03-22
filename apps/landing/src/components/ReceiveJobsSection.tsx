import { useEffect, useRef, useState } from 'react'
import { Filter, MapPin, DollarSign, CheckCircle, Sparkles, Wrench, Snowflake, Zap } from 'lucide-react'

/* ── Data ─────────────────────────────────────── */

interface GroupBubble {
  name: string
  preview: string
  unread: number
  rotate: number
  offsetX: number
  offsetY: number
}

const groupBubblesDesktop: GroupBubble[] = [
  { name: 'Contractors FL 🔧', preview: 'Anyone free tomorrow?', unread: 47, rotate: -3, offsetX: 0, offsetY: 0 },
  { name: 'Plumbers Miami 🪠', preview: 'Need a plumber ASAP', unread: 23, rotate: 2, offsetX: 8, offsetY: -6 },
  { name: 'HVAC Jobs USA ❄️', preview: 'Who does AC repair?', unread: 89, rotate: -1.5, offsetX: -4, offsetY: 4 },
  { name: 'Home Services 🏠', preview: 'Price check on drywall?', unread: 12, rotate: 3, offsetX: 6, offsetY: -2 },
  { name: 'Roofers South FL 🏗️', preview: 'Hurricane dmg — need quote', unread: 56, rotate: -2.5, offsetX: -8, offsetY: 6 },
  { name: 'Electricians 305 ⚡', preview: 'Panel upgrade anyone?', unread: 34, rotate: 1.5, offsetX: 4, offsetY: -4 },
  { name: 'Handyman Network 🛠️', preview: 'Small job in Coral Gables', unread: 71, rotate: -1, offsetX: -6, offsetY: 2 },
  { name: 'Painters FL 🎨', preview: 'Interior 3BR — Boca', unread: 18, rotate: 2.5, offsetX: 2, offsetY: -8 },
]

const groupBubblesMobile = groupBubblesDesktop.slice(0, 5)

interface MatchedLead {
  icon: typeof Wrench
  iconColor: string
  trade: string
  location: string
  price: string
}

const matchedLeads: MatchedLead[] = [
  { icon: Snowflake, iconColor: '#0284c7', trade: 'AC Repair', location: 'Miami, FL 33130', price: '$400–700' },
  { icon: Wrench, iconColor: '#7c3aed', trade: 'Plumbing', location: 'Boca Raton, FL 33431', price: '$250–500' },
  { icon: Zap, iconColor: '#f59e0b', trade: 'Electrical', location: 'Fort Lauderdale, FL 33301', price: '$300–600' },
]

/* ── Particle flow animation (Canvas) ─────────── */

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  passes: boolean
  size: number
  opacity: number
}

function useParticleCanvas(canvasRef: React.RefObject<HTMLCanvasElement | null>, isVisible: boolean) {
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !isVisible) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animId: number
    const particles: Particle[] = []
    const DPR = window.devicePixelRatio || 1

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      canvas.width = rect.width * DPR
      canvas.height = rect.height * DPR
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0)
    }
    resize()
    window.addEventListener('resize', resize)

    const spawn = () => {
      const rect = canvas.getBoundingClientRect()
      const passes = Math.random() < 0.15
      particles.push({
        x: -4,
        y: 10 + Math.random() * (rect.height - 20),
        vx: 0.6 + Math.random() * 0.8,
        vy: (Math.random() - 0.5) * 0.4,
        life: 0,
        maxLife: rect.width / (0.6 + Math.random() * 0.8),
        passes,
        size: passes ? 3 : 2,
        opacity: 0.7 + Math.random() * 0.3,
      })
    }

    const draw = () => {
      const rect = canvas.getBoundingClientRect()
      ctx.clearRect(0, 0, rect.width, rect.height)

      // spawn new particles
      if (Math.random() < 0.3) spawn()

      const midX = rect.width * 0.5

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]
        p.x += p.vx
        p.y += p.vy
        p.life++

        const progress = p.x / rect.width
        let alpha = p.opacity

        if (!p.passes && p.x > midX - 20) {
          // fade out non-passing particles near the filter
          alpha *= Math.max(0, 1 - (p.x - (midX - 20)) / 40)
        }

        if (p.passes && p.x > midX) {
          // passing particles turn green/orange
          ctx.fillStyle = `rgba(37, 211, 102, ${alpha})`
        } else {
          ctx.fillStyle = `rgba(180, 180, 180, ${alpha * 0.5})`
        }

        if (alpha <= 0.01 || p.x > rect.width + 10) {
          particles.splice(i, 1)
          continue
        }

        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fill()
      }

      animId = requestAnimationFrame(draw)
    }
    draw()

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', resize)
    }
  }, [canvasRef, isVisible])
}

/* ── Sub-components ───────────────────────────── */

function NoiseBubble({ bubble, index, visible }: { bubble: GroupBubble; index: number; visible: boolean }) {
  return (
    <div
      className="rjs-noise-bubble"
      style={{
        transform: `rotate(${bubble.rotate}deg) translate(${bubble.offsetX}px, ${bubble.offsetY}px)`,
        animationDelay: `${index * 120}ms`,
        opacity: visible ? 1 : 0,
      }}
    >
      {/* WA-style group header */}
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] font-semibold text-gray-600 truncate max-w-[140px]">
          {bubble.name}
        </span>
        <span className="rjs-unread-badge">{bubble.unread}</span>
      </div>
      <p className="text-[10px] text-gray-400 leading-tight truncate">{bubble.preview}</p>
    </div>
  )
}

function MatchCard({ lead, index, visible }: { lead: MatchedLead; index: number; visible: boolean }) {
  const Icon = lead.icon
  return (
    <div
      className="rjs-match-card"
      style={{
        animationDelay: `${800 + index * 200}ms`,
        opacity: visible ? undefined : 0,
      }}
    >
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: `${lead.iconColor}15` }}
        >
          <Icon className="w-5 h-5" style={{ color: lead.iconColor }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-gray-900">{lead.trade}</span>
            <span className="rjs-match-badge">MATCH!</span>
          </div>
          <div className="flex items-center gap-3 mt-1">
            <span className="flex items-center gap-1 text-[11px] text-gray-500">
              <MapPin className="w-3 h-3" />
              {lead.location}
            </span>
            <span className="flex items-center gap-1 text-[11px] text-gray-500">
              <DollarSign className="w-3 h-3" />
              {lead.price}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Main Component ───────────────────────────── */

export default function ReceiveJobsSection() {
  const sectionRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = sectionRef.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          obs.disconnect()
        }
      },
      { threshold: 0.15 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  useParticleCanvas(canvasRef, visible)

  return (
    <>
      <style>{`
        /* ── Noise bubbles ── */
        .rjs-noise-bubble {
          background: #f3f2ef;
          border: 1px solid #e5e4e0;
          border-radius: 12px;
          padding: 10px 14px;
          width: 190px;
          transition: opacity 0.5s ease-out, transform 0.5s ease-out;
          animation: rjs-float 4s ease-in-out infinite;
          flex-shrink: 0;
        }
        .rjs-noise-bubble:nth-child(even) {
          animation-duration: 5s;
          animation-direction: reverse;
        }
        .rjs-unread-badge {
          background: #25D366;
          color: white;
          font-size: 9px;
          font-weight: 700;
          padding: 1px 6px;
          border-radius: 10px;
          min-width: 20px;
          text-align: center;
          flex-shrink: 0;
        }

        /* ── Match cards ── */
        .rjs-match-card {
          background: white;
          border: 1px solid #eee;
          border-radius: 14px;
          padding: 14px 16px;
          box-shadow: 0 2px 12px rgba(0,0,0,0.06);
          animation: rjs-card-in 0.6s ease-out forwards;
          opacity: 0;
        }
        .rjs-match-badge {
          background: rgba(37, 211, 102, 0.12);
          color: #16a34a;
          font-size: 10px;
          font-weight: 800;
          padding: 2px 8px;
          border-radius: 6px;
          letter-spacing: 0.03em;
        }

        /* ── Filter element ── */
        .rjs-filter-core {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 8px;
          z-index: 10;
        }
        .rjs-filter-icon-wrap {
          width: 56px;
          height: 56px;
          border-radius: 16px;
          background: linear-gradient(135deg, #fe5b25 0%, #ff8a5c 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 0 30px rgba(254, 91, 37, 0.35), 0 4px 16px rgba(254, 91, 37, 0.2);
          animation: rjs-glow-pulse 2.5s ease-in-out infinite;
        }
        .rjs-filter-label {
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: #fe5b25;
          text-align: center;
        }

        /* ── Filter vertical line (desktop) ── */
        .rjs-filter-line {
          position: absolute;
          width: 2px;
          background: linear-gradient(180deg, transparent 0%, #fe5b25 20%, #fe5b25 80%, transparent 100%);
          opacity: 0.3;
        }
        .rjs-filter-line-top {
          top: 0;
          bottom: 50%;
          left: 50%;
          transform: translateX(-50%) translateY(-24px);
        }
        .rjs-filter-line-bottom {
          top: 50%;
          bottom: 0;
          left: 50%;
          transform: translateX(-50%) translateY(24px);
        }

        /* ── Filter horizontal line (mobile) ── */
        .rjs-filter-line-h {
          height: 2px;
          background: linear-gradient(90deg, transparent 0%, #fe5b25 20%, #fe5b25 80%, transparent 100%);
          opacity: 0.3;
        }

        /* ── Stat pills ── */
        .rjs-stat-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: white;
          border: 1px solid #eee;
          border-radius: 100px;
          padding: 8px 16px;
          font-size: 13px;
          font-weight: 600;
          color: #3b3b3b;
          box-shadow: 0 1px 4px rgba(0,0,0,0.04);
        }
        .rjs-stat-pill .rjs-stat-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        /* ── Keyframes ── */
        @keyframes rjs-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
        @keyframes rjs-card-in {
          from { opacity: 0; transform: translateY(20px) scale(0.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes rjs-glow-pulse {
          0%, 100% { box-shadow: 0 0 30px rgba(254,91,37,0.35), 0 4px 16px rgba(254,91,37,0.2); }
          50% { box-shadow: 0 0 50px rgba(254,91,37,0.5), 0 4px 24px rgba(254,91,37,0.35); }
        }
        @keyframes rjs-fade-up {
          from { opacity: 0; transform: translateY(24px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes rjs-fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .rjs-stagger-in {
          opacity: 0;
          animation: rjs-fade-up 0.6s ease-out forwards;
        }
      `}</style>

      <section ref={sectionRef} className="bg-cream py-20 md:py-28 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">

          {/* ── Section badge + heading (above the visual) ── */}
          <div
            className="text-center mb-12 lg:mb-16"
            style={{
              opacity: visible ? 1 : 0,
              transform: visible ? 'translateY(0)' : 'translateY(24px)',
              transition: 'all 0.7s ease-out',
            }}
          >
            <div className="inline-flex items-center gap-2 bg-[#fe5b25]/10 border border-[#fe5b25]/20 text-[#fe5b25] text-xs font-semibold px-3 py-1.5 rounded-full mb-5">
              <CheckCircle className="w-3.5 h-3.5" />
              HOW IT WORKS
            </div>
            <h2
              className="text-3xl md:text-4xl lg:text-[46px] lg:leading-[1.1] font-bold text-dark mb-4"
              style={{ letterSpacing: '-0.04em' }}
            >
              2,000+ groups. Only <span className="highlight-box">your jobs</span>.
            </h2>
            <p className="text-gray-subtle/70 text-base md:text-lg leading-relaxed max-w-2xl mx-auto">
              Our AI checks thousands of WhatsApp groups 24/7 and sends you only the jobs that fit your service, area, and schedule.
            </p>
          </div>

          {/* ══════════════════════════════════════════════ */}
          {/*  DESKTOP VISUAL — horizontal 3-column flow    */}
          {/* ══════════════════════════════════════════════ */}
          <div className="hidden lg:grid lg:grid-cols-12 gap-0 items-center relative mb-14">

            {/* LEFT — Phone mockup (5 cols) */}
            <div className="col-span-5 relative flex flex-col items-end pr-6">
              <div className="text-center w-full mb-3" style={{ maxWidth: 340, marginLeft: 'auto' }}>
                <span className="text-[13px] font-bold text-[#25D366] tracking-wide">2,000+ groups</span>
              </div>
              <div className="relative" style={{ maxWidth: 340, marginLeft: 'auto' }}>
                {/* Phone — cropped at half */}
                <div style={{ maxHeight: 320, overflow: 'hidden', maskImage: 'linear-gradient(to bottom, black 78%, transparent 100%)', WebkitMaskImage: 'linear-gradient(to bottom, black 78%, transparent 100%)' }}>
                  <div
                    className="w-[260px] rounded-[44px] p-[3px] shadow-[0_0_0_1px_rgba(0,0,0,0.08),0_20px_60px_rgba(0,0,0,0.2),0_8px_24px_rgba(0,0,0,0.12)]"
                    style={{ background: 'linear-gradient(145deg, #2a2a2e 0%, #1a1a1e 50%, #2a2a2e 100%)' }}
                  >
                    <div className="rounded-[42px] p-[2px] bg-black">
                      <div className="rounded-[40px] overflow-hidden bg-white flex flex-col" style={{ aspectRatio: '393/852' }}>
                        {/* Status bar + Dynamic Island */}
                        <div className="relative bg-white pt-2 pb-0 flex-shrink-0">
                          <div className="flex justify-between items-center px-6 mb-1">
                            <span className="text-[10px] font-semibold text-black tracking-tight">9:41</span>
                            <div className="flex items-center gap-1">
                              <svg width="14" height="10" viewBox="0 0 17 12" fill="black"><rect x="0" y="8" width="3" height="4" rx="0.5" fillOpacity="0.3" /><rect x="4.5" y="5.5" width="3" height="6.5" rx="0.5" /><rect x="9" y="3" width="3" height="9" rx="0.5" /><rect x="13.5" y="0" width="3" height="12" rx="0.5" /></svg>
                              <svg width="13" height="10" viewBox="0 0 16 12" fill="black"><path d="M8 9.6a1.2 1.2 0 110 2.4 1.2 1.2 0 010-2.4zM4.5 7.5a5 5 0 017 0" fill="none" stroke="black" strokeWidth="1.3" strokeLinecap="round" /><path d="M2 4.8a8.5 8.5 0 0112 0" fill="none" stroke="black" strokeWidth="1.3" strokeLinecap="round" /></svg>
                              <svg width="22" height="10" viewBox="0 0 27 12"><rect x="0.5" y="0.5" width="23" height="11" rx="2.5" stroke="black" strokeOpacity="0.35" fill="none" /><rect x="24.5" y="3.5" width="2" height="5" rx="1" fill="black" fillOpacity="0.3" /><rect x="2" y="2" width="20" height="8" rx="1.5" fill="black" /></svg>
                            </div>
                          </div>
                          <div className="flex justify-center"><div className="w-[100px] h-[28px] bg-black rounded-full" /></div>
                        </div>
                        {/* WhatsApp header */}
                        <div className="bg-[#075E54] px-2.5 pt-1.5 pb-2 flex-shrink-0">
                          <div className="flex items-center gap-1.5">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M15 18l-6-6 6-6" /></svg>
                            <div className="w-[28px] h-[28px] rounded-full bg-[#DFE5E7] flex items-center justify-center overflow-hidden flex-shrink-0">
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="#a0aeb4"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-[11px] font-medium text-white truncate leading-tight">Contractors — Jobs FL 🔧</div>
                              <div className="text-[8px] text-white/70 leading-tight">Dan, Mike, Joe, Alex, Ron, Sam...</div>
                            </div>
                            <div className="flex items-center gap-2">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M15.9 14.3H15l-.3-.3c1-1.1 1.6-2.7 1.6-4.3 0-3.7-3-6.7-6.7-6.7S3 6 3 9.7s3 6.7 6.7 6.7c1.6 0 3.2-.6 4.3-1.6l.3.3v.8l5.1 5.1 1.5-1.5-5-5.2zm-6.2 0c-2.6 0-4.6-2.1-4.6-4.6s2.1-4.6 4.6-4.6 4.6 2.1 4.6 4.6-2 4.6-4.6 4.6z"/></svg>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>
                            </div>
                          </div>
                        </div>
                        {/* Messages */}
                        <div className="px-2 py-1.5 space-y-[2px] flex-1 min-h-0 overflow-hidden relative" style={{ backgroundColor: '#ECE5DD' }}>
                          <div className="flex justify-center mb-0.5"><span className="bg-[#BDDAB5] text-[#3B6E32] text-[7px] font-medium px-2 py-0.5 rounded-md shadow-sm">47 UNREAD MESSAGES</span></div>
                          {[
                            { name: 'Dan', text: 'Anyone free for a job in Miami?', color: '#1f7aec' },
                            { name: 'Mike', text: 'Me!!', color: '#e65100' },
                            { name: 'Joe', text: 'I\'m free too', color: '#00897b' },
                            { name: 'Alex', text: 'I can do tomorrow', color: '#6a1b9a' },
                            { name: 'Ron', text: 'What\'s the budget?', color: '#c62828' },
                            { name: 'Sam', text: 'Already taken?', color: '#2e7d32' },
                          ].map((msg, i) => (
                            <div key={i} className="flex justify-start">
                              <div className="bg-white rounded-md shadow-[0_1px_0.5px_rgba(0,0,0,0.13)] px-2 py-0.5 max-w-[82%]" style={{ borderTopLeftRadius: '2px' }}>
                                <div className="text-[8px] font-medium leading-tight" style={{ color: msg.color }}>~ {msg.name}</div>
                                <div className="flex items-end gap-1">
                                  <span className="text-[9px] text-[#303030] leading-snug">{msg.text}</span>
                                  <span className="text-[6px] text-[#8c8c8c] whitespace-nowrap flex-shrink-0">08:12</span>
                                </div>
                              </div>
                            </div>
                          ))}
                          <div className="absolute bottom-0 inset-x-0 h-10 bg-gradient-to-t from-[#ECE5DD] to-transparent" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Lead Found card — overlapping the phone */}
                <div className="absolute -right-4 top-[15%] z-20">
                  <div
                    className="w-[220px] bg-gradient-to-br from-[#0d1117] to-[#1a0f0a] rounded-2xl border border-[#fe5b25]/20 overflow-hidden"
                    style={{ boxShadow: '0 20px 60px rgba(254,91,37,0.35), 0 0 0 1px rgba(254,91,37,0.1), 0 0 40px rgba(254,91,37,0.15)' }}
                  >
                    <div className="h-[3px]" style={{ background: 'linear-gradient(90deg, transparent, #fe5b25, #ff8a5c, #fe5b25, transparent)', backgroundSize: '200% 100%', animation: 'shimmer 2s linear infinite' }} />
                    <div className="px-3 pt-2.5 pb-2 flex items-center gap-2 border-b border-[#fe5b25]/10">
                      <div className="w-7 h-7 rounded-lg bg-[#fe5b25] flex items-center justify-center">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" /></svg>
                      </div>
                      <div>
                        <div className="text-[11px] font-bold text-[#fe5b25]">New Lead!</div>
                        <div className="text-[8px] text-[#8696a0]">Lead Express</div>
                      </div>
                    </div>
                    <div className="px-3 py-2.5 space-y-2">
                      {[
                        { icon: '📍', label: 'Miami, FL 33101', color: '#e9edef' },
                        { icon: '🔧', label: 'Plumbing — Pipe leak', color: '#e9edef' },
                        { icon: '💰', label: '$300–500', color: '#fe5b25' },
                      ].map((item, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <span className="text-[10px]">{item.icon}</span>
                          <span className="text-[10px] font-medium" style={{ color: item.color }}>{item.label}</span>
                        </div>
                      ))}
                    </div>
                    <div className="px-3 pb-3">
                      <div className="bg-gradient-to-r from-[#fe5b25] to-[#e04d1c] text-white text-center text-[9px] font-bold py-2 rounded-lg" style={{ boxShadow: '0 4px 12px rgba(254,91,37,0.3)' }}>
                        ✅ I'm interested
                      </div>
                    </div>
                  </div>
                </div>
                <style>{`@keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }`}</style>
              </div>
            </div>

            {/* CENTER — The Filter (2 cols) */}
            <div className="col-span-2 relative flex items-center justify-center" style={{ minHeight: 340 }}>
              {/* Particle canvas behind the filter */}
              <canvas
                ref={canvasRef}
                className="absolute inset-0 w-full h-full pointer-events-none"
                style={{ opacity: visible ? 1 : 0, transition: 'opacity 0.5s 0.3s' }}
              />

              {/* Vertical lines */}
              <div className="rjs-filter-line rjs-filter-line-top" style={{ height: '30%' }} />
              <div className="rjs-filter-line rjs-filter-line-bottom" style={{ height: '30%' }} />

              {/* Filter core */}
              <div className="rjs-filter-core">
                <div className="rjs-filter-icon-wrap">
                  <Filter className="w-6 h-6 text-white" />
                </div>
                <div className="rjs-filter-label">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    AI Filter
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT — Your Feed (5 cols) */}
            <div className="col-span-5 pl-6">
              <div className="flex flex-col gap-3" style={{ maxWidth: 360 }}>
                {matchedLeads.map((lead, i) => (
                  <MatchCard key={i} lead={lead} index={i} visible={visible} />
                ))}
              </div>
            </div>
          </div>

          {/* ══════════════════════════════════════════════ */}
          {/*  MOBILE VISUAL — vertical stacked flow        */}
          {/* ══════════════════════════════════════════════ */}
          <div className="lg:hidden flex flex-col items-center gap-6 mb-12">

            {/* Phone + Lead card */}
            <div className="flex flex-col items-center">
              <span className="text-[12px] font-bold text-[#25D366] tracking-wide mb-2">2,000+ groups</span>
              <div className="relative">
                <div style={{ maxHeight: 280, overflow: 'hidden', maskImage: 'linear-gradient(to bottom, black 78%, transparent 100%)', WebkitMaskImage: 'linear-gradient(to bottom, black 78%, transparent 100%)' }}>
                  <div className="w-[220px] rounded-[36px] p-[3px] shadow-[0_0_0_1px_rgba(0,0,0,0.08),0_15px_40px_rgba(0,0,0,0.2)]" style={{ background: 'linear-gradient(145deg, #2a2a2e 0%, #1a1a1e 50%, #2a2a2e 100%)' }}>
                    <div className="rounded-[34px] p-[2px] bg-black">
                      <div className="rounded-[32px] overflow-hidden bg-white flex flex-col" style={{ aspectRatio: '393/852' }}>
                        <div className="bg-white pt-1.5 flex-shrink-0">
                          <div className="flex justify-between items-center px-4 mb-1">
                            <span className="text-[9px] font-semibold text-black">9:41</span>
                            <svg width="18" height="8" viewBox="0 0 27 12"><rect x="0.5" y="0.5" width="23" height="11" rx="2.5" stroke="black" strokeOpacity="0.35" fill="none" /><rect x="2" y="2" width="20" height="8" rx="1.5" fill="black" /></svg>
                          </div>
                          <div className="flex justify-center"><div className="w-[80px] h-[22px] bg-black rounded-full" /></div>
                        </div>
                        <div className="bg-[#075E54] px-2 pt-1 pb-1.5 flex-shrink-0">
                          <div className="flex items-center gap-1">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M15 18l-6-6 6-6" /></svg>
                            <div className="w-[22px] h-[22px] rounded-full bg-[#DFE5E7] flex items-center justify-center"><svg width="14" height="14" viewBox="0 0 24 24" fill="#a0aeb4"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg></div>
                            <div className="flex-1 min-w-0">
                              <div className="text-[9px] font-medium text-white truncate">Contractors — Jobs FL 🔧</div>
                              <div className="text-[7px] text-white/60">Dan, Mike, Joe...</div>
                            </div>
                          </div>
                        </div>
                        <div className="px-1.5 py-1 space-y-[2px] flex-1 min-h-0 overflow-hidden relative" style={{ backgroundColor: '#ECE5DD' }}>
                          <div className="flex justify-center mb-0.5"><span className="bg-[#BDDAB5] text-[#3B6E32] text-[6px] font-medium px-1.5 py-0.5 rounded-md">47 UNREAD</span></div>
                          {[
                            { name: 'Dan', text: 'Anyone free for Miami?', color: '#1f7aec' },
                            { name: 'Mike', text: 'Me!!', color: '#e65100' },
                            { name: 'Joe', text: 'I\'m free too', color: '#00897b' },
                            { name: 'Alex', text: 'I can do tomorrow', color: '#6a1b9a' },
                            { name: 'Ron', text: 'What\'s the budget?', color: '#c62828' },
                          ].map((msg, i) => (
                            <div key={i} className="flex justify-start">
                              <div className="bg-white rounded-md shadow-[0_1px_0.5px_rgba(0,0,0,0.13)] px-1.5 py-0.5 max-w-[85%]" style={{ borderTopLeftRadius: '2px' }}>
                                <div className="text-[7px] font-medium" style={{ color: msg.color }}>~ {msg.name}</div>
                                <span className="text-[8px] text-[#303030]">{msg.text}</span>
                              </div>
                            </div>
                          ))}
                          <div className="absolute bottom-0 inset-x-0 h-8 bg-gradient-to-t from-[#ECE5DD] to-transparent" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                {/* Lead Found card */}
                <div className="absolute -right-8 top-[12%] z-20">
                  <div className="w-[180px] bg-gradient-to-br from-[#0d1117] to-[#1a0f0a] rounded-xl border border-[#fe5b25]/20 overflow-hidden" style={{ boxShadow: '0 16px 40px rgba(254,91,37,0.3)' }}>
                    <div className="h-[2px]" style={{ background: 'linear-gradient(90deg, transparent, #fe5b25, #ff8a5c, #fe5b25, transparent)' }} />
                    <div className="px-2.5 pt-2 pb-1.5 flex items-center gap-1.5 border-b border-[#fe5b25]/10">
                      <div className="w-6 h-6 rounded-md bg-[#fe5b25] flex items-center justify-center">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" /></svg>
                      </div>
                      <div>
                        <div className="text-[10px] font-bold text-[#fe5b25]">New Lead!</div>
                        <div className="text-[7px] text-[#8696a0]">Lead Express</div>
                      </div>
                    </div>
                    <div className="px-2.5 py-2 space-y-1.5">
                      <div className="flex items-center gap-1.5"><span className="text-[9px]">📍</span><span className="text-[9px] text-[#e9edef]">Miami, FL 33101</span></div>
                      <div className="flex items-center gap-1.5"><span className="text-[9px]">🔧</span><span className="text-[9px] text-[#e9edef]">Plumbing — Pipe leak</span></div>
                      <div className="flex items-center gap-1.5"><span className="text-[9px]">💰</span><span className="text-[9px] font-medium text-[#fe5b25]">$300–500</span></div>
                    </div>
                    <div className="px-2.5 pb-2.5">
                      <div className="bg-gradient-to-r from-[#fe5b25] to-[#e04d1c] text-white text-center text-[8px] font-bold py-1.5 rounded-lg">✅ I'm interested</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Filter element (horizontal) */}
            <div className="flex items-center gap-4 w-full max-w-xs">
              <div className="flex-1 rjs-filter-line-h" />
              <div className="rjs-filter-core flex-row gap-3" style={{ flexDirection: 'row' }}>
                <div className="rjs-filter-icon-wrap" style={{ width: 44, height: 44, borderRadius: 12 }}>
                  <Filter className="w-5 h-5 text-white" />
                </div>
                <div className="rjs-filter-label">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3" />
                    AI Filter
                  </div>
                </div>
              </div>
              <div className="flex-1 rjs-filter-line-h" />
            </div>

            {/* Clean match cards */}
            <div className="flex flex-col gap-3 w-full max-w-sm">
              {matchedLeads.map((lead, i) => (
                <MatchCard key={i} lead={lead} index={i} visible={visible} />
              ))}
            </div>
          </div>

          {/* ── Stat pills ── */}
          <div
            className="flex flex-wrap justify-center gap-3"
            style={{
              opacity: visible ? 1 : 0,
              transform: visible ? 'translateY(0)' : 'translateY(16px)',
              transition: 'all 0.7s 0.6s ease-out',
            }}
          >
            <div className="rjs-stat-pill">
              <span className="rjs-stat-dot" style={{ background: '#25D366' }} />
              2,000+ Groups Checked
            </div>
            <div className="rjs-stat-pill">
              <span className="rjs-stat-dot" style={{ background: '#fe5b25' }} />
              AI Filtering 24/7
            </div>
            <div className="rjs-stat-pill">
              <span className="rjs-stat-dot" style={{ background: '#0284c7' }} />
              ~47 Leads/Day
            </div>
          </div>

        </div>
      </section>
    </>
  )
}
