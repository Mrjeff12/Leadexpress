import { useState, useEffect, useRef } from 'react'
import {
  Phone, Upload, CheckCircle2, MapPin, DollarSign,
  Snowflake, X, Clock, Users, CircleDollarSign,
  Briefcase, Share2,
} from 'lucide-react'
import { initialsAvatar } from '../utils/avatars'

/* ─── Animation phases ─── */
type Phase =
  | 'phone-ring'    // client is calling you
  | 'job-appears'   // the job card materialises
  | 'cant-take'     // you realise you can't do it
  | 'publish'       // you publish to the network
  | 'ripple'        // network broadcasts
  | 'picked-up'     // right contractor picks it up
  | 'pause'         // brief rest before replay

const PHASE_TIMING: Record<Phase, number> = {
  'phone-ring': 1400,
  'job-appears': 1400,
  'cant-take': 1600,
  'publish': 1200,
  'ripple': 1000,
  'picked-up': 2200,
  'pause': 1000,
}

const PHASES: Phase[] = [
  'phone-ring', 'job-appears', 'cant-take',
  'publish', 'ripple', 'picked-up', 'pause',
]

/* ─── Helpers ─── */
function useInView(threshold = 0.15) {
  const ref = useRef<HTMLElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setVisible(true) },
      { threshold },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [threshold])
  return { ref, visible }
}

/* ─── Main ─── */
export default function PublishJobsSection() {
  const { ref, visible } = useInView(0.1)
  const [phase, setPhase] = useState<Phase>('phone-ring')

  useEffect(() => {
    if (!visible) return
    let idx = 0
    let timer: ReturnType<typeof setTimeout>
    const next = () => {
      setPhase(PHASES[idx])
      timer = setTimeout(() => {
        idx = (idx + 1) % PHASES.length
        next()
      }, PHASE_TIMING[PHASES[idx]])
    }
    next()
    return () => clearTimeout(timer)
  }, [visible])

  const pi = PHASES.indexOf(phase)

  return (
    <section
      ref={ref as any}
      className="section-padding bg-cream-dark overflow-hidden relative"
    >
      {/* Ambient glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-[#fe5b25]/[0.03] rounded-full blur-[180px]" />

      <div className="max-w-6xl mx-auto px-6 relative">

        {/* ─── Header ─── */}
        <div className={`text-center mb-14 transition-all duration-1000 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <div className="inline-flex items-center gap-2 bg-[#fe5b25]/10 text-[#fe5b25] rounded-full px-4 py-1.5 text-[11px] font-semibold tracking-widest uppercase mb-5">
            <Upload className="w-3.5 h-3.5" />
            Your Private Jobs
          </div>
          <h2 className="text-3xl md:text-5xl font-medium text-dark mb-4 tracking-[-0.04em]">
            Can't take the job?{' '}
            <span className="highlight-box">Someone in the network can.</span>
          </h2>
          <p className="text-gray-subtle/60 text-base md:text-lg max-w-2xl mx-auto leading-relaxed">
            Got a call from a client but it's not your trade, too far, or you're fully booked?
            Publish it on the network — the right contractor picks it up instantly.
          </p>
        </div>

        {/* ─── Desktop visual: horizontal 3-column flow ─── */}
        <div className={`relative transition-all duration-1000 delay-300 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}>

          <div className="hidden md:flex items-center justify-center gap-0 py-8">

            {/* ── LEFT: Your Private Job ── */}
            <div className="flex flex-col items-center w-[250px] relative">
              {/* Label */}
              <div className="flex items-center gap-1.5 mb-4">
                <Phone className="w-3 h-3 text-gray-400" />
                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Your Private Job</span>
              </div>

              {/* Phone ringing visual */}
              <div className="relative mb-4">
                <div
                  className="w-16 h-16 rounded-2xl bg-white shadow-lg border border-gray-100 flex items-center justify-center transition-all duration-500"
                  style={{
                    transform: pi >= 0 && pi <= 1 ? 'scale(1)' : 'scale(0.9)',
                    boxShadow: pi === 0
                      ? '0 0 0 4px rgba(254,91,37,0.15), 0 4px 20px rgba(0,0,0,0.08)'
                      : '0 4px 20px rgba(0,0,0,0.08)',
                  }}
                >
                  <Phone
                    className="w-7 h-7 text-[#fe5b25] transition-all duration-300"
                    style={{
                      animation: pi === 0 ? 'phoneRing 0.5s ease-in-out infinite alternate' : 'none',
                    }}
                  />
                </div>
                {/* Ringing waves */}
                {pi === 0 && (
                  <>
                    <div className="absolute inset-0 rounded-2xl border-2 border-[#fe5b25]/20" style={{ animation: 'ringPulse 1s ease-out infinite' }} />
                    <div className="absolute inset-0 rounded-2xl border-2 border-[#fe5b25]/10" style={{ animation: 'ringPulse 1s ease-out infinite 0.3s' }} />
                  </>
                )}
                {/* Speech bubble */}
                {pi >= 0 && pi <= 2 && (
                  <div
                    className="absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap bg-white rounded-lg shadow-md border border-gray-100 px-3 py-1.5"
                    style={{ animation: 'fadeSlideIn 0.4s ease-out' }}
                  >
                    <p className="text-[9px] text-gray-500 italic">Client called, but it's not my trade...</p>
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 rotate-45 w-2 h-2 bg-white border-r border-b border-gray-100" />
                  </div>
                )}
              </div>

              {/* Job card */}
              <div
                className="transition-all duration-700"
                style={{
                  opacity: pi >= 1 ? 1 : 0,
                  transform: pi >= 1
                    ? pi >= 3
                      ? 'translateX(60px) scale(0.85)'
                      : 'translateY(0) scale(1)'
                    : 'translateY(20px) scale(0.9)',
                }}
              >
                <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-3.5 w-[220px]">
                  {/* Status badge */}
                  {pi >= 2 && pi < 3 && (
                    <div className="flex items-center gap-1 mb-2" style={{ animation: 'fadeSlideIn 0.4s ease-out' }}>
                      <X className="w-3.5 h-3.5 text-amber-500" />
                      <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wide">Can't take it</span>
                    </div>
                  )}
                  {pi >= 3 && pi < 5 && (
                    <div className="flex items-center gap-1 mb-2" style={{ animation: 'fadeSlideIn 0.4s ease-out' }}>
                      <Upload className="w-3.5 h-3.5 text-[#fe5b25]" />
                      <span className="text-[10px] font-bold text-[#fe5b25] uppercase tracking-wide">Publishing...</span>
                    </div>
                  )}

                  <div className="flex items-start gap-2.5">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-[#06b6d4]/10 border border-[#06b6d4]/20">
                      <Snowflake className="w-4 h-4 text-[#06b6d4]" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[12px] font-bold text-dark leading-tight">AC Installation</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <MapPin className="w-2.5 h-2.5 text-gray-400" />
                        <span className="text-[10px] text-gray-400">Fort Lauderdale, FL</span>
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        <DollarSign className="w-2.5 h-2.5 text-[#fe5b25]" />
                        <span className="text-[10px] font-semibold text-[#fe5b25]">$800–1,200</span>
                      </div>
                    </div>
                  </div>

                  {/* Reason tag */}
                  {pi >= 2 && pi <= 3 && (
                    <div
                      className="mt-2.5 bg-amber-50 rounded-lg px-2.5 py-1.5 border border-amber-100"
                      style={{ animation: 'fadeSlideIn 0.5s ease-out' }}
                    >
                      <p className="text-[9px] text-amber-600 font-medium">
                        You're a plumber — this needs an HVAC tech
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ── Arrow left -> center ── */}
            <div className="flex flex-col items-center mx-4 md:mx-8">
              <div className="relative w-20 h-[2px] bg-gradient-to-r from-[#fe5b25]/30 to-[#fe5b25]">
                <div
                  className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-[#fe5b25]"
                  style={{
                    animation: pi >= 3 ? 'flowRight 0.8s ease-out forwards' : 'none',
                    opacity: pi >= 3 ? 1 : 0.2,
                  }}
                />
              </div>
              <span className="text-[8px] text-gray-subtle/30 mt-1.5 uppercase tracking-wider">publish</span>
            </div>

            {/* ── CENTER: Network Hub ── */}
            <div className="flex flex-col items-center mx-2 relative z-10">
              <div className="relative">
                {/* Ripple rings */}
                {pi >= 4 && (
                  <>
                    <div className="absolute inset-0 rounded-full" style={{ animation: 'hubRipple 1.5s ease-out infinite' }} />
                    <div className="absolute inset-0 rounded-full" style={{ animation: 'hubRipple 1.5s ease-out infinite 0.5s' }} />
                    <div className="absolute inset-0 rounded-full" style={{ animation: 'hubRipple 1.5s ease-out infinite 1s' }} />
                  </>
                )}
                {/* Hub circle */}
                <div
                  className="w-24 h-24 rounded-full flex flex-col items-center justify-center relative z-10 transition-all duration-700"
                  style={{
                    background: pi >= 3
                      ? 'linear-gradient(135deg, #fe5b25, #e04d1c)'
                      : 'linear-gradient(135deg, #fe5b25aa, #e04d1c88)',
                    boxShadow: pi >= 3
                      ? '0 0 40px rgba(254,91,37,0.35), 0 0 80px rgba(254,91,37,0.15)'
                      : '0 4px 20px rgba(254,91,37,0.15)',
                  }}
                >
                  <Share2 className="w-6 h-6 text-white mb-0.5" />
                  <p className="text-[8px] font-bold text-white/90 uppercase tracking-wider leading-none">LeadExpress</p>
                  <p className="text-[7px] font-semibold text-white/70 uppercase tracking-wider leading-none mt-0.5">Network</p>
                </div>
              </div>

              {/* "Live" badge */}
              <div className="mt-3 flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-[#25D366] animate-pulse" />
                <span className="text-[9px] font-semibold text-[#25D366]">12,480 contractors online</span>
              </div>
            </div>

            {/* ── Arrow center -> right ── */}
            <div className="flex flex-col items-center mx-4 md:mx-8">
              <div className="relative w-20 h-[2px] bg-gradient-to-r from-[#25D366] to-[#25D366]/30">
                <div
                  className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-[#25D366]"
                  style={{
                    animation: pi >= 5 ? 'flowRight 0.8s ease-out forwards' : 'none',
                    opacity: pi >= 5 ? 1 : 0.2,
                  }}
                />
              </div>
              <span className="text-[8px] text-gray-subtle/30 mt-1.5 uppercase tracking-wider">matched</span>
            </div>

            {/* ── RIGHT: Picked Up ── */}
            <div className="flex flex-col items-center w-[250px] relative">
              {/* Label */}
              <div className="flex items-center gap-1.5 mb-4">
                <CheckCircle2 className="w-3 h-3 text-[#25D366]" />
                <span className="text-[10px] font-semibold text-[#25D366] uppercase tracking-wider">Picked Up</span>
              </div>

              {/* Contractor profile card */}
              <div
                className="transition-all duration-700"
                style={{
                  opacity: pi >= 5 ? 1 : 0.35,
                  transform: pi >= 5 ? 'scale(1)' : 'scale(0.92)',
                }}
              >
                <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-4 w-[230px]">
                  <div className="flex items-center gap-3 mb-3">
                    <div
                      className="w-12 h-12 rounded-full overflow-hidden flex-shrink-0 transition-all duration-500"
                      style={{
                        border: pi >= 5 ? '3px solid #25D366' : '3px solid #e5e7eb',
                        boxShadow: pi >= 5 ? '0 0 16px rgba(37,211,102,0.3)' : 'none',
                      }}
                    >
                      <img src={initialsAvatar('David R.', 33)} alt="" className="w-full h-full object-cover" />
                    </div>
                    <div>
                      <p className="text-[13px] font-bold text-dark">David R.</p>
                      <p className="text-[10px] text-gray-400">HVAC Tech</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <MapPin className="w-2.5 h-2.5 text-gray-300" />
                        <span className="text-[9px] text-gray-400">Fort Lauderdale, FL</span>
                      </div>
                    </div>
                  </div>

                  {/* Success badge */}
                  {pi >= 5 && (
                    <div
                      className="flex items-center gap-1.5 bg-[#25D366]/10 rounded-lg px-3 py-1.5 mb-2"
                      style={{ animation: 'fadeSlideIn 0.5s ease-out' }}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#25D366]" />
                      <span className="text-[10px] font-bold text-[#25D366]">Picked Up!</span>
                    </div>
                  )}

                  {/* Response notification */}
                  {pi >= 5 && (
                    <div
                      className="flex items-center gap-1.5 text-gray-400"
                      style={{ animation: 'fadeSlideIn 0.6s ease-out 0.3s both' }}
                    >
                      <Clock className="w-3 h-3" />
                      <span className="text-[9px]">3 contractors responded in 2 min</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ─── Mobile: vertical flow ─── */}
          <div className="md:hidden flex flex-col items-center gap-5 py-4">

            {/* Phone ringing */}
            <div className="flex flex-col items-center gap-2">
              <div className="flex items-center gap-1.5 mb-1">
                <Phone className="w-3 h-3 text-gray-400" />
                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Your Private Job</span>
              </div>

              <div className="relative">
                <div
                  className="w-14 h-14 rounded-xl bg-white shadow-lg border border-gray-100 flex items-center justify-center"
                  style={{
                    boxShadow: pi === 0
                      ? '0 0 0 3px rgba(254,91,37,0.15), 0 4px 16px rgba(0,0,0,0.08)'
                      : '0 4px 16px rgba(0,0,0,0.08)',
                  }}
                >
                  <Phone
                    className="w-6 h-6 text-[#fe5b25]"
                    style={{ animation: pi === 0 ? 'phoneRing 0.5s ease-in-out infinite alternate' : 'none' }}
                  />
                </div>
                {pi === 0 && (
                  <div className="absolute inset-0 rounded-xl border-2 border-[#fe5b25]/20" style={{ animation: 'ringPulse 1s ease-out infinite' }} />
                )}
              </div>

              {pi >= 0 && pi <= 2 && (
                <p className="text-[9px] text-gray-400 italic" style={{ animation: 'fadeSlideIn 0.4s ease-out' }}>
                  Client called, but it's not my trade...
                </p>
              )}
            </div>

            {/* Job card */}
            <div className={`transition-all duration-700 ${pi >= 1 ? 'opacity-100' : 'opacity-0 translate-y-4'}`}>
              <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-3.5 w-[200px]">
                {pi >= 2 && pi < 3 && (
                  <div className="flex items-center gap-1 mb-2" style={{ animation: 'fadeSlideIn 0.4s ease-out' }}>
                    <X className="w-3.5 h-3.5 text-amber-500" />
                    <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wide">Can't take it</span>
                  </div>
                )}
                {pi >= 3 && pi < 5 && (
                  <div className="flex items-center gap-1 mb-2" style={{ animation: 'fadeSlideIn 0.4s ease-out' }}>
                    <Upload className="w-3.5 h-3.5 text-[#fe5b25]" />
                    <span className="text-[10px] font-bold text-[#fe5b25] uppercase tracking-wide">Publishing...</span>
                  </div>
                )}
                {pi >= 5 && (
                  <div className="flex items-center gap-1 mb-2" style={{ animation: 'fadeSlideIn 0.4s ease-out' }}>
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#25D366]" />
                    <span className="text-[10px] font-bold text-[#25D366] uppercase tracking-wide">Picked up!</span>
                  </div>
                )}
                <div className="flex items-start gap-2.5">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-[#06b6d4]/10 border border-[#06b6d4]/20">
                    <Snowflake className="w-4 h-4 text-[#06b6d4]" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[12px] font-bold text-dark leading-tight">AC Installation</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <MapPin className="w-2.5 h-2.5 text-gray-400" />
                      <span className="text-[10px] text-gray-400">Fort Lauderdale</span>
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <DollarSign className="w-2.5 h-2.5 text-[#fe5b25]" />
                      <span className="text-[10px] font-semibold text-[#fe5b25]">$800–1,200</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Down arrow */}
            <div className="w-[2px] h-8 bg-gradient-to-b from-[#fe5b25] to-[#fe5b25]/20 relative">
              <div
                className="absolute left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-[#fe5b25]"
                style={{
                  animation: pi >= 3 ? 'flowDown 0.8s ease-out forwards' : 'none',
                  opacity: pi >= 3 ? 1 : 0.3,
                }}
              />
            </div>

            {/* Network hub */}
            <div className="relative">
              {pi >= 4 && (
                <>
                  <div className="absolute inset-0 rounded-full" style={{ animation: 'hubRipple 1.5s ease-out infinite' }} />
                  <div className="absolute inset-0 rounded-full" style={{ animation: 'hubRipple 1.5s ease-out infinite 0.5s' }} />
                </>
              )}
              <div
                className="w-20 h-20 rounded-full flex flex-col items-center justify-center relative z-10 transition-all duration-500"
                style={{
                  background: pi >= 3
                    ? 'linear-gradient(135deg, #fe5b25, #e04d1c)'
                    : 'linear-gradient(135deg, #fe5b25aa, #e04d1c88)',
                  boxShadow: pi >= 3
                    ? '0 0 30px rgba(254,91,37,0.3)'
                    : '0 4px 16px rgba(254,91,37,0.12)',
                }}
              >
                <Share2 className="w-5 h-5 text-white mb-0.5" />
                <p className="text-[7px] font-bold text-white/90 uppercase tracking-wider leading-none">Network</p>
              </div>
            </div>

            {/* Down arrow */}
            <div className="w-[2px] h-8 bg-gradient-to-b from-[#25D366] to-[#25D366]/20 relative">
              <div
                className="absolute left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-[#25D366]"
                style={{
                  animation: pi >= 5 ? 'flowDown 0.8s ease-out forwards' : 'none',
                  opacity: pi >= 5 ? 1 : 0.3,
                }}
              />
            </div>

            {/* Contractor card */}
            {pi >= 5 && (
              <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-3 w-[200px]" style={{ animation: 'fadeSlideIn 0.5s ease-out' }}>
                <div className="flex items-center gap-2 mb-2">
                  <img
                    src={initialsAvatar('David R.', 33)}
                    alt=""
                    className="w-10 h-10 rounded-full border-2 border-[#25D366] shadow-sm"
                  />
                  <div>
                    <p className="text-[11px] font-bold text-dark">David R.</p>
                    <p className="text-[9px] text-gray-400">HVAC Tech · Fort Lauderdale</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 bg-[#25D366]/10 rounded-lg px-2.5 py-1.5">
                  <CheckCircle2 className="w-3 h-3 text-[#25D366]" />
                  <span className="text-[9px] font-bold text-[#25D366]">Picked Up!</span>
                </div>
                <div className="flex items-center gap-1 mt-1.5 text-gray-400">
                  <Clock className="w-2.5 h-2.5" />
                  <span className="text-[8px]">3 responded in 2 min</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ─── Value cards ─── */}
        <div className={`grid md:grid-cols-2 gap-6 mt-14 transition-all duration-1000 delay-500 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-[#fe5b25]/10 flex items-center justify-center">
                <Briefcase className="w-5 h-5 text-[#fe5b25]" />
              </div>
              <div>
                <h3 className="text-base font-bold text-dark">No Job Wasted</h3>
                <p className="text-[11px] text-gray-subtle/50">Your own private jobs, not ours</p>
              </div>
            </div>
            <p className="text-sm text-gray-subtle/60 leading-relaxed">
              Every job you can't take finds the right contractor on the network.
              Wrong trade, too far, fully booked — doesn't matter. Someone's ready.
            </p>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-[#25D366]/10 flex items-center justify-center">
                <CircleDollarSign className="w-5 h-5 text-[#25D366]" />
              </div>
              <div>
                <h3 className="text-base font-bold text-dark">Earn Commission</h3>
                <p className="text-[11px] text-gray-subtle/50">Passive income from referrals</p>
              </div>
            </div>
            <p className="text-sm text-gray-subtle/60 leading-relaxed">
              Get paid when the job gets done through your referral.
              You helped a client, helped a contractor, and earned money — everyone wins.
            </p>
          </div>
        </div>

        {/* Bottom tagline */}
        <div className={`text-center mt-10 transition-all duration-1000 delay-700 ${visible ? 'opacity-100' : 'opacity-0'}`}>
          <p className="text-sm text-gray-subtle/40 italic">
            "Your phone rings with a job you can't do — that's not a dead end, that's an opportunity."
          </p>
        </div>
      </div>

      <style>{`
        @keyframes phoneRing {
          0% { transform: rotate(0deg); }
          25% { transform: rotate(15deg); }
          50% { transform: rotate(0deg); }
          75% { transform: rotate(-15deg); }
          100% { transform: rotate(0deg); }
        }
        @keyframes ringPulse {
          0% { transform: scale(1); opacity: 0.4; }
          100% { transform: scale(1.6); opacity: 0; }
        }
        @keyframes hubRipple {
          0% {
            box-shadow: 0 0 0 0 rgba(254, 91, 37, 0.3);
            transform: scale(1);
          }
          100% {
            box-shadow: 0 0 0 50px rgba(254, 91, 37, 0);
            transform: scale(1);
          }
        }
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
