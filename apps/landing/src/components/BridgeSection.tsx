import { useState, useEffect, useRef } from 'react'
import {
  ArrowRight, ArrowLeftRight, Zap, MapPin, Wrench,
  Snowflake, Forward, CheckCircle2, X, DollarSign,
  Upload, Phone,
} from 'lucide-react'
import { initialsAvatar } from '../utils/avatars'

/* ─── Lead card data ─── */
interface Lead {
  trade: string
  icon: typeof Wrench
  location: string
  price: string
  color: string
}

const INCOMING_LEADS: Lead[] = [
  { trade: 'Plumbing', icon: Wrench, location: 'Miami, FL', price: '$300–500', color: '#3b82f6' },
  { trade: 'HVAC Repair', icon: Snowflake, location: 'Boca Raton, FL', price: '$800–1,200', color: '#06b6d4' },
]

const PUBLISH_LEAD: Lead = {
  trade: 'Electrical', icon: Zap, location: 'Tampa, FL', price: '$450–700', color: '#8b5cf6',
}

/* ─── Avatars ─── */
const YOU_IMG = initialsAvatar('You', 51)
const MATCH_IMG = initialsAvatar('Mike R.', 33)

/* ─── Animation phases ─── */
type Phase =
  | 'incoming-1'    // first matched lead flies in
  | 'incoming-2'    // second matched lead flies in
  | 'private-job'   // you got a private job you can't do
  | 'cant-take'     // "Can't take it" tag appears
  | 'publish'       // you publish it to the network
  | 'picked-up'    // right contractor picks it up
  | 'pause'         // brief pause before restart

const PHASE_TIMING: Record<Phase, number> = {
  'incoming-1': 1200,
  'incoming-2': 1200,
  'private-job': 1400,
  'cant-take': 1200,
  'publish': 1000,
  'picked-up': 2000,
  'pause': 800,
}

function useInView(threshold = 0.15) {
  const ref = useRef<HTMLElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setVisible(true) },
      { threshold }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [threshold])
  return { ref, visible }
}

/* ─── Lead Card Component ─── */
function LeadCard({
  lead, status, className = '', style = {},
}: {
  lead: Lead
  status?: 'match' | 'cant-take' | 'published' | 'picked-up'
  className?: string
  style?: React.CSSProperties
}) {
  const { icon: Icon } = lead
  return (
    <div
      className={`bg-white rounded-2xl shadow-lg border border-gray-100 p-3.5 w-[200px] md:w-[220px] ${className}`}
      style={style}
    >
      {/* Status badge */}
      {status === 'match' && (
        <div className="flex items-center gap-1 mb-2">
          <CheckCircle2 className="w-3.5 h-3.5 text-[#25D366]" />
          <span className="text-[10px] font-bold text-[#25D366] uppercase tracking-wide">Match!</span>
        </div>
      )}
      {status === 'cant-take' && (
        <div className="flex items-center gap-1 mb-2" style={{ animation: 'fadeSlideIn 0.4s ease-out' }}>
          <X className="w-3.5 h-3.5 text-amber-500" />
          <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wide">Can't take it</span>
        </div>
      )}
      {status === 'published' && (
        <div className="flex items-center gap-1 mb-2" style={{ animation: 'fadeSlideIn 0.4s ease-out' }}>
          <Upload className="w-3.5 h-3.5 text-[#fe5b25]" />
          <span className="text-[10px] font-bold text-[#fe5b25] uppercase tracking-wide">Published to network</span>
        </div>
      )}
      {status === 'picked-up' && (
        <div className="flex items-center gap-1 mb-2" style={{ animation: 'fadeSlideIn 0.4s ease-out' }}>
          <CheckCircle2 className="w-3.5 h-3.5 text-[#25D366]" />
          <span className="text-[10px] font-bold text-[#25D366] uppercase tracking-wide">Picked up!</span>
        </div>
      )}

      {/* Lead details */}
      <div className="flex items-start gap-2.5">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: lead.color + '12', border: `1.5px solid ${lead.color}25` }}
        >
          <Icon className="w-4 h-4" style={{ color: lead.color }} />
        </div>
        <div className="min-w-0">
          <p className="text-[12px] font-bold text-dark leading-tight">{lead.trade}</p>
          <div className="flex items-center gap-1 mt-0.5">
            <MapPin className="w-2.5 h-2.5 text-gray-400" />
            <span className="text-[10px] text-gray-400">{lead.location}</span>
          </div>
          <div className="flex items-center gap-1 mt-0.5">
            <DollarSign className="w-2.5 h-2.5 text-[#fe5b25]" />
            <span className="text-[10px] font-semibold text-[#fe5b25]">{lead.price}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── Main Section ─── */
export default function BridgeSection() {
  const { ref, visible } = useInView(0.1)
  const [phase, setPhase] = useState<Phase>('incoming-1')

  // Animation loop
  useEffect(() => {
    if (!visible) return

    const phases: Phase[] = [
      'incoming-1', 'incoming-2', 'private-job',
      'cant-take', 'publish', 'picked-up', 'pause',
    ]

    let idx = 0
    let timer: ReturnType<typeof setTimeout>

    const next = () => {
      setPhase(phases[idx])
      timer = setTimeout(() => {
        idx = (idx + 1) % phases.length
        next()
      }, PHASE_TIMING[phases[idx]])
    }

    next()
    return () => clearTimeout(timer)
  }, [visible])

  const phaseIdx = [
    'incoming-1', 'incoming-2', 'private-job',
    'cant-take', 'publish', 'picked-up', 'pause',
  ].indexOf(phase)

  return (
    <section
      ref={ref as any}
      className="section-padding bg-cream-dark overflow-hidden relative"
    >
      {/* Subtle ambient */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#fe5b25]/[0.03] rounded-full blur-[150px]" />

      <div className="max-w-6xl mx-auto px-6 relative">
        {/* Header */}
        <div className={`text-center mb-14 transition-all duration-1000 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <div className="inline-flex items-center gap-2 bg-[#fe5b25]/10 text-[#fe5b25] rounded-full px-4 py-1.5 text-[11px] font-semibold tracking-widest uppercase mb-5">
            <ArrowLeftRight className="w-3.5 h-3.5" />
            Two-Way Network
          </div>
          <h2 className="text-3xl md:text-5xl font-medium text-dark mb-4 tracking-[-0.04em]">
            Every lead finds{' '}
            <span className="highlight-box">its contractor.</span>
          </h2>
          <p className="text-gray-subtle/60 text-base md:text-lg max-w-2xl mx-auto">
            Get matched jobs delivered to you. Got a private job you can't take?
            Publish it on the network — the right contractor picks it up instantly.
          </p>
        </div>

        {/* The Bridge Visual */}
        <div className={`relative transition-all duration-1000 delay-300 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}>

          {/* Desktop: horizontal flow */}
          <div className="hidden md:flex items-center justify-center gap-0 py-8">

            {/* LEFT: Incoming leads */}
            <div className="flex flex-col items-end gap-3 w-[240px] relative">
              {/* Lead 1 */}
              <div
                className="transition-all duration-700"
                style={{
                  opacity: phaseIdx >= 0 ? 1 : 0,
                  transform: phaseIdx >= 0 ? 'translateX(0)' : 'translateX(-40px)',
                }}
              >
                <LeadCard lead={INCOMING_LEADS[0]} status="match" />
              </div>
              {/* Lead 2 */}
              <div
                className="transition-all duration-700"
                style={{
                  opacity: phaseIdx >= 1 ? 1 : 0,
                  transform: phaseIdx >= 1 ? 'translateX(0)' : 'translateX(-40px)',
                }}
              >
                <LeadCard lead={INCOMING_LEADS[1]} status="match" />
              </div>

              {/* Label */}
              <div className="absolute -top-10 right-0 flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-[#25D366] animate-pulse" />
                <span className="text-[10px] font-semibold text-[#25D366] uppercase tracking-wider">Incoming</span>
              </div>
            </div>

            {/* Arrow left → center */}
            <div className="flex flex-col items-center mx-4 md:mx-6">
              <div className="relative w-16 h-[2px] bg-gradient-to-r from-[#25D366]/40 to-[#25D366]">
                <div
                  className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-[#25D366]"
                  style={{ animation: 'flowRight 1.5s ease-in-out infinite' }}
                />
              </div>
              <span className="text-[8px] text-gray-subtle/30 mt-1.5 uppercase tracking-wider">matched</span>
            </div>

            {/* CENTER: You */}
            <div className="flex flex-col items-center mx-2 relative z-10">
              <div className="relative">
                <div
                  className="w-20 h-20 rounded-full overflow-hidden shadow-[0_4px_24px_rgba(254,91,37,0.25)]"
                  style={{ border: '3px solid #fe5b25' }}
                >
                  <img src={YOU_IMG} alt="You" className="w-full h-full object-cover" />
                </div>
                {/* Pulse ring */}
                <div className="absolute inset-0 rounded-full border-2 border-[#fe5b25]/30 animate-ping" style={{ animationDuration: '2s' }} />
              </div>
              <div className="mt-2 bg-dark text-white text-[10px] font-bold px-3 py-1 rounded-full shadow-md">
                YOU
              </div>

              {/* Private job card — you got a call, can't take the job, publish it */}
              <div
                className="absolute -top-2 left-1/2 transition-all duration-700"
                style={{
                  opacity: phaseIdx >= 2 && phaseIdx <= 5 ? 1 : 0,
                  transform:
                    phaseIdx >= 4
                      ? 'translateX(80px) translateY(-20px) scale(0.9)'
                      : phaseIdx >= 2
                        ? 'translateX(-50%) translateY(-100%) scale(1)'
                        : 'translateX(-50%) translateY(-80%) scale(0.8)',
                  zIndex: 30,
                }}
              >
                {/* "From a client call" mini label */}
                {phaseIdx >= 2 && phaseIdx <= 3 && (
                  <div className="flex items-center gap-1 mb-1.5 justify-center" style={{ animation: 'fadeSlideIn 0.4s ease-out' }}>
                    <Phone className="w-2.5 h-2.5 text-gray-400" />
                    <span className="text-[9px] text-gray-400 italic">Your client called...</span>
                  </div>
                )}
                <LeadCard
                  lead={PUBLISH_LEAD}
                  status={
                    phaseIdx === 5 ? 'picked-up'
                      : phaseIdx === 4 ? 'published'
                        : phaseIdx >= 3 ? 'cant-take'
                          : undefined
                  }
                />
              </div>
            </div>

            {/* Arrow center → right */}
            <div className="flex flex-col items-center mx-4 md:mx-6">
              <div className="relative w-16 h-[2px] bg-gradient-to-r from-[#fe5b25] to-[#fe5b25]/40">
                <div
                  className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-[#fe5b25]"
                  style={{
                    animation: phaseIdx >= 4 ? 'flowRight 0.8s ease-out forwards' : 'none',
                    opacity: phaseIdx >= 4 ? 1 : 0.3,
                  }}
                />
              </div>
              <span className="text-[8px] text-gray-subtle/30 mt-1.5 uppercase tracking-wider">published</span>
            </div>

            {/* RIGHT: Matched contractor */}
            <div className="flex flex-col items-start w-[240px] relative">
              <div className={`transition-all duration-700 ${phaseIdx >= 5 ? 'opacity-100 scale-100' : 'opacity-40 scale-95'}`}>
                <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-4 w-[220px]">
                  <div className="flex items-center gap-3 mb-3">
                    <div
                      className="w-12 h-12 rounded-full overflow-hidden shadow-md flex-shrink-0 transition-all duration-500"
                      style={{
                        border: phaseIdx >= 5 ? '3px solid #25D366' : '3px solid #e5e7eb',
                        boxShadow: phaseIdx >= 5 ? '0 0 16px rgba(37,211,102,0.3)' : 'none',
                      }}
                    >
                      <img src={MATCH_IMG} alt="" className="w-full h-full object-cover" />
                    </div>
                    <div>
                      <p className="text-[12px] font-bold text-dark">Mike R.</p>
                      <p className="text-[10px] text-gray-400">Electrician · Tampa</p>
                    </div>
                  </div>
                  {phaseIdx >= 5 && (
                    <div
                      className="flex items-center gap-1.5 bg-[#25D366]/10 rounded-lg px-3 py-1.5"
                      style={{ animation: 'fadeSlideIn 0.5s ease-out' }}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#25D366]" />
                      <span className="text-[10px] font-bold text-[#25D366]">Perfect match — accepted!</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Label */}
              <div className="absolute -top-10 left-0 flex items-center gap-1.5">
                <CheckCircle2 className="w-3 h-3 text-[#25D366]" />
                <span className="text-[10px] font-semibold text-[#25D366] uppercase tracking-wider">Picked Up</span>
              </div>
            </div>
          </div>

          {/* Mobile: vertical flow */}
          <div className="md:hidden flex flex-col items-center gap-6 py-4">
            {/* Incoming leads */}
            <div className="flex flex-col items-center gap-3">
              <div className="flex items-center gap-1.5 mb-1">
                <div className="w-2 h-2 rounded-full bg-[#25D366] animate-pulse" />
                <span className="text-[10px] font-semibold text-[#25D366] uppercase tracking-wider">Incoming Leads</span>
              </div>
              <div className={`transition-all duration-700 ${phaseIdx >= 0 ? 'opacity-100' : 'opacity-0 -translate-y-4'}`}>
                <LeadCard lead={INCOMING_LEADS[0]} status="match" />
              </div>
              <div className={`transition-all duration-700 ${phaseIdx >= 1 ? 'opacity-100' : 'opacity-0 -translate-y-4'}`}>
                <LeadCard lead={INCOMING_LEADS[1]} status="match" />
              </div>
            </div>

            {/* Down arrow */}
            <div className="w-[2px] h-8 bg-gradient-to-b from-[#25D366] to-[#25D366]/20 relative">
              <div className="absolute left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-[#25D366]" style={{ animation: 'flowDown 1.5s ease-in-out infinite' }} />
            </div>

            {/* You */}
            <div className="relative z-10 flex flex-col items-center">
              <div className="w-16 h-16 rounded-full overflow-hidden shadow-[0_4px_20px_rgba(254,91,37,0.25)]" style={{ border: '3px solid #fe5b25' }}>
                <img src={YOU_IMG} alt="You" className="w-full h-full object-cover" />
              </div>
              <div className="mt-1.5 bg-dark text-white text-[9px] font-bold px-2.5 py-0.5 rounded-full">YOU</div>
            </div>

            {/* Down arrow — publish */}
            <div className="w-[2px] h-8 bg-gradient-to-b from-[#fe5b25] to-[#fe5b25]/20 relative">
              <div className="absolute left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-[#fe5b25]" style={{ animation: phaseIdx >= 4 ? 'flowDown 0.8s ease-out forwards' : 'none', opacity: phaseIdx >= 4 ? 1 : 0.3 }} />
            </div>

            {/* Private job → Published → Picked up */}
            <div className="flex flex-col items-center gap-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Upload className="w-3 h-3 text-[#fe5b25]" />
                <span className="text-[10px] font-semibold text-[#fe5b25] uppercase tracking-wider">Your Private Job</span>
              </div>
              {phaseIdx >= 2 && phaseIdx <= 3 && (
                <div className="flex items-center gap-1 mb-1" style={{ animation: 'fadeSlideIn 0.4s ease-out' }}>
                  <Phone className="w-2.5 h-2.5 text-gray-400" />
                  <span className="text-[9px] text-gray-400 italic">Your client called...</span>
                </div>
              )}
              <div className={`transition-all duration-700 ${phaseIdx >= 2 ? 'opacity-100' : 'opacity-0 translate-y-4'}`}>
                <LeadCard
                  lead={PUBLISH_LEAD}
                  status={phaseIdx >= 5 ? 'picked-up' : phaseIdx === 4 ? 'published' : phaseIdx >= 3 ? 'cant-take' : undefined}
                />
              </div>
              {phaseIdx >= 5 && (
                <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-3 w-[200px]" style={{ animation: 'fadeSlideIn 0.5s ease-out' }}>
                  <div className="flex items-center gap-2">
                    <img src={MATCH_IMG} alt="" className="w-10 h-10 rounded-full border-2 border-[#25D366] shadow-sm" />
                    <div>
                      <p className="text-[11px] font-bold text-dark">Mike R.</p>
                      <p className="text-[9px] text-[#25D366] font-semibold">Electrician · Tampa</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Two value props below */}
        <div className={`grid md:grid-cols-2 gap-6 mt-14 transition-all duration-1000 delay-500 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          {/* Receive */}
          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-[#25D366]/10 flex items-center justify-center">
                <Zap className="w-5 h-5 text-[#25D366]" />
              </div>
              <div>
                <h3 className="text-base font-bold text-dark">Receive Matched Jobs</h3>
                <p className="text-[11px] text-gray-subtle/50">From 2,000+ WhatsApp groups</p>
              </div>
            </div>
            <p className="text-sm text-gray-subtle/60 leading-relaxed">
              Our AI scans thousands of groups and routes only the jobs that match your trade, your area, and your availability. No noise, no scrolling.
            </p>
          </div>

          {/* Publish */}
          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-[#fe5b25]/10 flex items-center justify-center">
                <Upload className="w-5 h-5 text-[#fe5b25]" />
              </div>
              <div>
                <h3 className="text-base font-bold text-dark">Publish Jobs You Can't Take</h3>
                <p className="text-[11px] text-gray-subtle/50">Your own private jobs, not ours</p>
              </div>
            </div>
            <p className="text-sm text-gray-subtle/60 leading-relaxed">
              Got a call from a client but can't do the job? Wrong trade, too far, fully booked?
              Publish it on the network and the right contractor picks it up. No job goes to waste.
            </p>
          </div>
        </div>

        {/* Bottom tagline */}
        <div className={`text-center mt-10 transition-all duration-1000 delay-700 ${visible ? 'opacity-100' : 'opacity-0'}`}>
          <p className="text-sm text-gray-subtle/40 italic">
            "Every contractor is both a lead receiver and a lead source."
          </p>
        </div>
      </div>

      <style>{`
        @keyframes flowRight {
          0% { left: 0; }
          100% { left: calc(100% - 8px); }
        }
        @keyframes flowDown {
          0% { top: 0; }
          100% { top: calc(100% - 8px); }
        }
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </section>
  )
}
