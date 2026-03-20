import { useState, useEffect, useRef } from 'react'
import {
  Wrench, Paintbrush, Zap, Thermometer, Home, Hammer,
  TreePine, Droplets, Shield, HardHat, Shovel, Pipette,
  ArrowRight, MessageCircle,
} from 'lucide-react'
import { useLang } from '../i18n/LanguageContext'
import { genericAvatar } from '../utils/avatars'

/* ─── Platform icons ─── */
const WhatsAppIcon = ({ className = '' }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
)

const FacebookIcon = ({ className = '' }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
  </svg>
)

const TelegramIcon = ({ className = '' }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
  </svg>
)

/* ─── Data: WhatsApp groups with trade-specific icons ─── */
const GROUPS = [
  { name: 'NJ Contractors', members: 2340, color: '#25D366', Icon: Home },
  { name: 'FL Plumbers Hub', members: 870, color: '#3b82f6', Icon: Droplets },
  { name: 'TX Trade Workers', members: 1200, color: '#f59e0b', Icon: HardHat },
  { name: 'CA Handyman Net', members: 650, color: '#ef4444', Icon: Wrench },
  { name: 'NY Electricians', members: 1580, color: '#8b5cf6', Icon: Zap },
  { name: 'PA HVAC Pros', members: 940, color: '#06b6d4', Icon: Thermometer },
  { name: 'GA Roofers', members: 720, color: '#ec4899', Icon: Shield },
  { name: 'OH Painters', members: 1100, color: '#10b981', Icon: Paintbrush },
  { name: 'IL Contractors', members: 890, color: '#f97316', Icon: Hammer },
  { name: 'AZ Landscaping', members: 560, color: '#6366f1', Icon: TreePine },
  { name: 'WA Builders', members: 1340, color: '#14b8a6', Icon: Shovel },
  { name: 'CO Renovators', members: 780, color: '#e11d48', Icon: Pipette },
]

/* ─── Data: People (outer ring) — contractors receiving filtered leads ─── */
const PEOPLE = [
  { id: 11 }, { id: 33 }, { id: 60 }, { id: 15 },
  { id: 51 }, { id: 22 }, { id: 47 }, { id: 54 },
  { id: 36 }, { id: 12 }, { id: 25 }, { id: 42 },
  { id: 18 }, { id: 31 }, { id: 44 }, { id: 52 },
  { id: 28 }, { id: 39 }, { id: 16 }, { id: 48 },
]

function useCountUp(target: number, duration: number, active: boolean) {
  const [value, setValue] = useState(0)
  useEffect(() => {
    if (!active) return
    const start = performance.now()
    let raf: number
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - p, 3)
      setValue(Math.round(target * eased))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, duration, active])
  return value
}

export default function NetworkSection() {
  const { t } = useLang()
  const [connected, setConnected] = useState(false)
  const groupCount = useCountUp(2000, 2000, connected)

  useEffect(() => {
    const t = setTimeout(() => setConnected(true), 600)
    return () => clearTimeout(t)
  }, [])

  const cx = 300
  const cy = 300
  const groupRadius = 155
  const peopleRadius = 260
  const viewSize = 600

  return (
    <section className="relative pt-28 pb-12 md:pt-36 md:pb-20 overflow-hidden bg-cream">
      {/* Subtle ambient glow */}
      <div className="absolute top-1/3 right-0 w-[600px] h-[600px] bg-[#25D366]/5 rounded-full blur-[200px]" />

      <div className="max-w-7xl mx-auto px-6 relative w-full">
        <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-center">

          {/* Text side */}
          <div className="text-center md:text-start">
            <div className="inline-flex items-center gap-2 bg-[#25D366]/10 text-[#25D366] rounded-full px-4 py-1.5 text-xs font-semibold mb-6">
              <WhatsAppIcon className="w-3.5 h-3.5" />
              The Intelligence Network
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-medium leading-[1.15] tracking-[-0.04em] mb-6 text-dark">
              You're in 3 groups.{' '}
              <span className="highlight-box">We're in 2,000+.</span>
            </h1>

            <p className="text-base md:text-lg text-gray-subtle/70 max-w-lg mb-8 leading-relaxed">
              Most contractors are stuck in a few noisy groups — half the chatter isn't even about work.
              We scan 2,000+ groups with AI and route only the jobs that match your trade, your area, straight to you.
            </p>

            <div className="flex flex-col sm:flex-row items-center md:items-start gap-4 mb-8">
              <a href="#pricing" className="group inline-flex items-center justify-center gap-2 rounded-full bg-[#fe5b25] text-white px-8 py-4 text-base font-semibold transition-all duration-300 hover:bg-[#e04d1c] hover:scale-105 hover:shadow-lg hover:shadow-[#fe5b25]/25 active:scale-95">
                <WhatsAppIcon className="w-5 h-5" />
                {t.hero.cta1}
                <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
              </a>
              <a href="#features" className="inline-flex items-center justify-center gap-2 rounded-full border border-dark/20 text-dark/70 px-8 py-4 text-base font-semibold transition-all duration-300 hover:border-dark/40 hover:text-dark hover:scale-105 active:scale-95">
                <MessageCircle size={16} />
                {t.hero.cta2}
              </a>
            </div>

            {/* Stats row */}
            <div className={`flex items-center gap-8 justify-center md:justify-start transition-all duration-700 ${
              connected ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`} style={{ transitionDelay: '1800ms' }}>
              {[
                { val: '2,000+', label: 'Groups Scanned' },
                { val: '12,480+', label: 'Contractors' },
                { val: '~47/day', label: 'Leads Routed' },
              ].map((s, i) => (
                <div key={i} className="text-center md:text-left">
                  <p className="text-lg font-black text-dark">{s.val}</p>
                  <p className="text-[10px] text-gray-subtle/50 uppercase tracking-wider">{s.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Network visualization — right side */}
          <div className="flex justify-center">
            <div className="relative w-full max-w-[520px] aspect-square">

              {/* SVG connections */}
              <svg className="absolute inset-0 w-full h-full" viewBox={`0 0 ${viewSize} ${viewSize}`}>
                {/* Lines from groups to center */}
                {GROUPS.map((g, i) => {
                  const angle = (i / GROUPS.length) * Math.PI * 2 - Math.PI / 2
                  const x = cx + groupRadius * Math.cos(angle)
                  const y = cy + groupRadius * Math.sin(angle)
                  return (
                    <line key={`g-${i}`}
                      x1={cx} y1={cy} x2={x} y2={y}
                      className={`transition-all duration-1000 ${connected ? 'opacity-100' : 'opacity-0'}`}
                      style={{ transitionDelay: `${600 + i * 80}ms` }}
                      stroke={g.color} strokeWidth="1.2" strokeOpacity="0.25"
                    />
                  )
                })}
                {/* Lines from people to nearest group */}
                {PEOPLE.map((p, i) => {
                  const pAngle = (i / PEOPLE.length) * Math.PI * 2 - Math.PI / 2
                  const px = cx + peopleRadius * Math.cos(pAngle)
                  const py = cy + peopleRadius * Math.sin(pAngle)
                  const gIdx = Math.floor((i / PEOPLE.length) * GROUPS.length)
                  const gAngle = (gIdx / GROUPS.length) * Math.PI * 2 - Math.PI / 2
                  const gx = cx + groupRadius * Math.cos(gAngle)
                  const gy = cy + groupRadius * Math.sin(gAngle)
                  return (
                    <line key={`p-${i}`}
                      x1={gx} y1={gy} x2={px} y2={py}
                      className={`transition-all duration-700 ${connected ? 'opacity-100' : 'opacity-0'}`}
                      style={{ transitionDelay: `${1200 + i * 50}ms` }}
                      stroke="#fe5b25" strokeWidth="0.8" strokeOpacity="0.18"
                    />
                  )
                })}
                {/* Pulse rings */}
                {connected && (
                  <>
                    <circle cx={cx} cy={cy} r="50" fill="none" stroke="#25D366" strokeWidth="0.5" opacity="0.15">
                      <animate attributeName="r" values="50;110;50" dur="4s" repeatCount="indefinite" />
                      <animate attributeName="opacity" values="0.15;0;0.15" dur="4s" repeatCount="indefinite" />
                    </circle>
                    <circle cx={cx} cy={cy} r="80" fill="none" stroke="#fe5b25" strokeWidth="0.3" opacity="0.1">
                      <animate attributeName="r" values="80;140;80" dur="5s" repeatCount="indefinite" />
                      <animate attributeName="opacity" values="0.1;0;0.1" dur="5s" repeatCount="indefinite" />
                    </circle>
                  </>
                )}
              </svg>

              {/* Center hub */}
              <div
                className={`absolute z-20 transition-all duration-1000 ${connected ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}`}
                style={{ left: '50%', top: '50%', transform: `translate(-50%, -50%) ${connected ? 'scale(1)' : 'scale(0.5)'}` }}
              >
                <div className={`w-24 h-24 md:w-28 md:h-28 rounded-3xl flex flex-col items-center justify-center transition-all duration-1000 ${
                  connected
                    ? 'bg-gradient-to-br from-[#fe5b25] to-[#e04d1c] shadow-[0_8px_40px_rgba(254,91,37,0.3)]'
                    : 'bg-gray-100 border border-gray-200'
                }`}
                style={connected ? { animation: 'net-hub-breathe 3s ease-in-out infinite' } : {}}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <WhatsAppIcon className="w-4 h-4 md:w-5 md:h-5 text-white" />
                    <FacebookIcon className="w-3.5 h-3.5 md:w-4 md:h-4 text-white/70" />
                    <TelegramIcon className="w-3.5 h-3.5 md:w-4 md:h-4 text-white/70" />
                  </div>
                  <p className="text-xl md:text-2xl font-black text-white leading-none">{groupCount.toLocaleString()}+</p>
                  <p className="text-[7px] font-bold text-white/80 uppercase tracking-wider mt-0.5">Groups</p>
                </div>
              </div>

              {/* Group nodes (inner ring) — trade icons */}
              {GROUPS.map((g, i) => {
                const angle = (i / GROUPS.length) * Math.PI * 2 - Math.PI / 2
                const xPct = ((cx + groupRadius * Math.cos(angle)) / viewSize) * 100
                const yPct = ((cy + groupRadius * Math.sin(angle)) / viewSize) * 100
                const { Icon } = g

                return (
                  <div key={i}
                    className={`absolute z-10 transition-all duration-700 ${
                      connected ? 'opacity-100 scale-100' : 'opacity-0 scale-50'
                    }`}
                    style={{
                      left: `${xPct}%`,
                      top: `${yPct}%`,
                      transform: 'translate(-50%, -50%)',
                      transitionDelay: `${700 + i * 90}ms`,
                      animation: connected ? `net-float-${(i % 3) + 1} ${5 + (i % 4)}s ease-in-out infinite` : 'none',
                      animationDelay: `${i * 0.4}s`,
                    }}>
                    <div className="group relative">
                      <div
                        className="w-10 h-10 md:w-12 md:h-12 rounded-2xl flex items-center justify-center transition-all duration-300 group-hover:scale-110 bg-white shadow-md"
                        style={{
                          border: `2px solid ${g.color}30`,
                          boxShadow: `0 2px 12px ${g.color}15, 0 1px 3px rgba(0,0,0,0.08)`,
                        }}
                      >
                        <Icon className="w-4 h-4 md:w-5 md:h-5" style={{ color: g.color }} />
                      </div>
                      {/* Tooltip */}
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 rounded-lg bg-dark border border-dark/80 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-30 shadow-xl">
                        <p className="text-[9px] font-bold text-white">{g.name}</p>
                        <p className="text-[8px] text-white/50">{g.members.toLocaleString()} members</p>
                      </div>
                    </div>
                  </div>
                )
              })}

              {/* People nodes (outer ring) */}
              {PEOPLE.map((p, i) => {
                const angle = (i / PEOPLE.length) * Math.PI * 2 - Math.PI / 2
                const xPct = ((cx + peopleRadius * Math.cos(angle)) / viewSize) * 100
                const yPct = ((cy + peopleRadius * Math.sin(angle)) / viewSize) * 100

                return (
                  <div key={i}
                    className={`absolute z-10 transition-all duration-700 ${
                      connected ? 'opacity-100 scale-100' : 'opacity-0 scale-50'
                    }`}
                    style={{
                      left: `${xPct}%`,
                      top: `${yPct}%`,
                      transform: 'translate(-50%, -50%)',
                      transitionDelay: `${1300 + i * 60}ms`,
                      animation: connected ? `net-float-${(i % 3) + 1} ${6 + (i % 5)}s ease-in-out infinite` : 'none',
                      animationDelay: `${i * 0.3}s`,
                    }}>
                    <img
                      src={genericAvatar(p.id)}
                      alt=""
                      className="w-7 h-7 md:w-9 md:h-9 rounded-full object-cover transition-all duration-300 hover:scale-125 shadow-sm"
                      style={{
                        border: '2.5px solid #fe5b25',
                        boxShadow: '0 2px 8px rgba(254,91,37,0.15), 0 1px 3px rgba(0,0,0,0.08)',
                      }}
                    />
                  </div>
                )
              })}

              {/* Pipeline legend — visual flow story */}
              <div className={`absolute -bottom-16 left-1/2 -translate-x-1/2 transition-all duration-700 ${
                connected ? 'opacity-100' : 'opacity-0'
              }`} style={{ transitionDelay: '2500ms' }}>
                <div
                  className="flex items-center gap-0 rounded-2xl px-2 py-2"
                  style={{
                    background: 'rgba(255,255,255,0.85)',
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
                    boxShadow: '0 4px 24px rgba(0,0,0,0.06), 0 1px 4px rgba(0,0,0,0.04)',
                    border: '1px solid rgba(0,0,0,0.05)',
                  }}
                >
                  {/* Step 1: Groups */}
                  <div className="flex items-center gap-2.5 px-3 py-1.5">
                    <div className="w-8 h-8 rounded-xl bg-[#25D366]/10 flex items-center justify-center">
                      <WhatsAppIcon className="w-4 h-4 text-[#25D366]" />
                    </div>
                    <div>
                      <p className="text-[11px] font-bold text-dark leading-none">2,000+ Groups</p>
                      <p className="text-[9px] text-dark/35 leading-none mt-1">scanned 24/7</p>
                    </div>
                  </div>

                  {/* Arrow 1 */}
                  <div className="relative w-10 flex items-center justify-center mx-1">
                    <svg width="40" height="12" viewBox="0 0 40 12" fill="none">
                      <path d="M0 6h32" stroke="#e5e5e5" strokeWidth="1.5" strokeLinecap="round" />
                      <path d="M30 2l4 4-4 4" stroke="#d4d4d4" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                    </svg>
                    <div
                      className="absolute w-2 h-2 rounded-full"
                      style={{
                        background: 'linear-gradient(135deg, #fe5b25, #e04d1c)',
                        boxShadow: '0 0 6px rgba(254,91,37,0.4)',
                        animation: 'flowDot 2.5s ease-in-out infinite',
                      }}
                    />
                  </div>

                  {/* Step 2: AI Filter */}
                  <div className="flex items-center gap-2.5 px-3 py-1.5">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#fe5b25] to-[#e04d1c] flex items-center justify-center shadow-sm" style={{ boxShadow: '0 2px 8px rgba(254,91,37,0.2)' }}>
                      <Zap className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <p className="text-[11px] font-bold text-dark leading-none">AI Filters</p>
                      <p className="text-[9px] text-dark/35 leading-none mt-1">noise removed</p>
                    </div>
                  </div>

                  {/* Arrow 2 */}
                  <div className="relative w-10 flex items-center justify-center mx-1">
                    <svg width="40" height="12" viewBox="0 0 40 12" fill="none">
                      <path d="M0 6h32" stroke="#e5e5e5" strokeWidth="1.5" strokeLinecap="round" />
                      <path d="M30 2l4 4-4 4" stroke="#d4d4d4" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                    </svg>
                    <div
                      className="absolute w-2 h-2 rounded-full"
                      style={{
                        background: 'linear-gradient(135deg, #fe5b25, #e04d1c)',
                        boxShadow: '0 0 6px rgba(254,91,37,0.4)',
                        animation: 'flowDot 2.5s ease-in-out infinite 1.2s',
                      }}
                    />
                  </div>

                  {/* Step 3: Your Feed */}
                  <div className="flex items-center gap-2.5 px-3 py-1.5">
                    <div className="w-8 h-8 rounded-xl border-2 border-[#fe5b25] overflow-hidden" style={{ boxShadow: '0 2px 8px rgba(254,91,37,0.15)' }}>
                      <img src={genericAvatar(11)} alt="" className="w-full h-full object-cover" />
                    </div>
                    <div>
                      <p className="text-[11px] font-bold text-dark leading-none">Your Feed</p>
                      <p className="text-[9px] text-dark/35 leading-none mt-1">matched jobs only</p>
                    </div>
                  </div>
                </div>

                <style>{`
                  @keyframes flowDot {
                    0% { left: 0; opacity: 0; }
                    20% { opacity: 1; }
                    80% { opacity: 1; }
                    100% { left: calc(100% - 6px); opacity: 0; }
                  }
                  @keyframes net-hub-breathe {
                    0%, 100% { box-shadow: 0 8px 40px rgba(254,91,37,0.3); }
                    50% { box-shadow: 0 8px 50px rgba(254,91,37,0.45); }
                  }
                  @keyframes net-float-1 {
                    0%, 100% { transform: translate(-50%, -50%) translate(0px, 0px); }
                    25% { transform: translate(-50%, -50%) translate(4px, -6px); }
                    50% { transform: translate(-50%, -50%) translate(-3px, -3px); }
                    75% { transform: translate(-50%, -50%) translate(5px, 4px); }
                  }
                  @keyframes net-float-2 {
                    0%, 100% { transform: translate(-50%, -50%) translate(0px, 0px); }
                    25% { transform: translate(-50%, -50%) translate(-5px, 3px); }
                    50% { transform: translate(-50%, -50%) translate(4px, 5px); }
                    75% { transform: translate(-50%, -50%) translate(-3px, -5px); }
                  }
                  @keyframes net-float-3 {
                    0%, 100% { transform: translate(-50%, -50%) translate(0px, 0px); }
                    25% { transform: translate(-50%, -50%) translate(3px, 5px); }
                    50% { transform: translate(-50%, -50%) translate(-5px, -2px); }
                    75% { transform: translate(-50%, -50%) translate(2px, -6px); }
                  }
                `}</style>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
