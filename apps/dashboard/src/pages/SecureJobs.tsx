import { Helmet } from 'react-helmet-async'
import { useNavigate } from 'react-router-dom'
import {
  ShieldCheck, ArrowRightLeft, BarChart3, ArrowRight,
  Dice5, Ghost, HeartHandshake, Lightbulb, Star, CheckCircle,
  LayoutDashboard, MessageSquare, TrendingUp, ChevronRight, Zap,
  Lock, ScanFace, IdCard, BadgeCheck, Shield, UserCheck, Menu, X,
} from 'lucide-react'
import { useEffect, useRef, useState, lazy, Suspense } from 'react'
import { Player } from '@remotion/player'
import {
  SubcontractorDemo,
  DEMO_DURATION_FRAMES,
  DEMO_FPS,
  DEMO_WIDTH,
  DEMO_HEIGHT,
} from '../remotion/SubcontractorDemo'
// ProblemDemo removed — replaced with pure CSS cards

/* ─── Intersection Observer (same pattern as PartnersPage) ─── */
function useInView(threshold = 0.2) {
  const ref = useRef<HTMLElement | null>(null)
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

/* ─── Site Navbar (matches landing site) ─── */
const LANDING_URL = import.meta.env.PROD ? 'https://masterleadflow.com' : 'http://localhost:5174'

function SiteNavbar() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const navigate = useNavigate()

  return (
    <nav className="fixed top-0 inset-x-0 z-50 bg-white/80 backdrop-blur-xl border-b border-zinc-200/50">
      <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-4">
        {/* Logo */}
        <a href={LANDING_URL} className="flex items-center gap-2.5">
          <div className="w-9 h-9 bg-gradient-to-br from-[#fe5b25] to-[#e04d1c] rounded-lg flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <span className="text-xl font-semibold tracking-[-0.03em] text-zinc-900">MasterLeadFlow</span>
        </a>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-8">
          <a href={LANDING_URL + '#features'} className="text-sm text-stone-500 hover:text-[#fe5b25] transition-colors">Features</a>
          <a href={LANDING_URL + '#pricing'} className="text-sm text-stone-500 hover:text-[#fe5b25] transition-colors">Pricing</a>
          <a href={LANDING_URL + '#faq'} className="text-sm text-stone-500 hover:text-[#fe5b25] transition-colors">FAQ</a>
          <a href={LANDING_URL + '#contact'} className="text-sm text-stone-500 hover:text-[#fe5b25] transition-colors">Contact</a>
          <a href="/secure-jobs" className="text-sm font-semibold text-[#fe5b25]">Secure Jobs</a>
        </div>

        <div className="hidden md:flex items-center gap-3">
          <button onClick={() => navigate('/login')} className="text-sm font-medium text-stone-500 hover:text-zinc-900 transition-colors px-4 py-2">
            Log in
          </button>
          <button
            onClick={() => navigate('/login')}
            className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[#fe5b25] to-[#e04d1c] text-white px-5 py-2.5 text-xs font-semibold transition-all hover:scale-105 hover:shadow-md hover:shadow-[#fe5b25]/20"
          >
            Get Started
          </button>
        </div>

        {/* Mobile hamburger */}
        <button className="md:hidden p-2" onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden bg-white border-t border-zinc-100 px-6 py-6 space-y-4">
          <a href={LANDING_URL + '#features'} className="block text-sm py-2 text-stone-600">Features</a>
          <a href={LANDING_URL + '#pricing'} className="block text-sm py-2 text-stone-600">Pricing</a>
          <a href={LANDING_URL + '#faq'} className="block text-sm py-2 text-stone-600">FAQ</a>
          <a href={LANDING_URL + '#contact'} className="block text-sm py-2 text-stone-600">Contact</a>
          <a href="/secure-jobs" className="block text-sm py-2 font-semibold text-[#fe5b25]">Secure Jobs</a>
          <button onClick={() => navigate('/login')} className="block text-sm py-2 font-medium text-stone-500">Log in</button>
          <button
            onClick={() => navigate('/login')}
            className="w-full rounded-full bg-gradient-to-r from-[#fe5b25] to-[#e04d1c] text-white py-3 text-sm font-semibold"
          >
            Get Started
          </button>
        </div>
      )}
    </nav>
  )
}

/* ════════════════════════════════════════════════════════════
   SECURE JOBS — LANDING PAGE
   Uses the shared design system: glass-panel, kpi-card,
   stagger-children, animate-fade-in, CSS variables
   ════════════════════════════════════════════════════════════ */
export default function SecureJobs() {
  const navigate = useNavigate()

  const problemRef = useInView(0.15)
  const solutionRef = useInView(0.15)
  const verifyRef = useInView(0.15)
  const trustRef = useInView(0.15)
  const tiersRef = useInView(0.15)
  const dashRef = useInView(0.1)
  const dashFeatRef = useInView(0.15)
  const ctaRef = useInView(0.15)

  return (
    <div className="min-h-screen">
      <Helmet>
        <title>Pass Jobs. Not Risk. | MasterLeadFlow</title>
        <meta name="description" content="Hire verified subs. Get rated. Build your reputation. Track every job — the trust platform for contractors." />
      </Helmet>

      {/* Site navbar — connects to main landing site */}
      <SiteNavbar />

      {/* Shared background + grain (same as all dashboard pages) */}
      <div className="le-bg" />
      <div className="le-grain" />

      {/* ══════════════ SECTION 1 — HERO BANNER ══════════════ */}
      <section className="relative pt-28 pb-20 md:pt-36 md:pb-28 overflow-x-clip">
        {/* Background blobs for depth */}
        <div className="absolute top-20 right-0 w-[600px] h-[600px] bg-[#fe5b25]/6 rounded-full blur-[150px]" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-blue-500/4 rounded-full blur-[120px]" />

        <div className="max-w-7xl mx-auto px-6 relative">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.4fr] gap-10 lg:gap-16 items-center min-h-[520px]">

            {/* Left — Text content */}
            <div className="relative z-10">
              <div className="animate-fade-in inline-flex items-center gap-2 bg-[#fe5b25]/10 border border-[#fe5b25]/20 text-[#fe5b25] rounded-full px-4 py-1.5 text-xs font-semibold mb-8 tracking-wide uppercase">
                <Lock className="w-3.5 h-3.5" />
                Secure Job Transfer
              </div>

              <h1
                className="animate-fade-in text-[2.75rem] md:text-5xl lg:text-[3.5rem] font-bold leading-[1.1] tracking-[-0.035em] mb-5 text-zinc-900"
                style={{ animationDelay: '100ms' }}
              >
                Pass Jobs.
                <br />
                <span className="relative inline-block mt-1">
                  <span className="relative z-10 text-[#fe5b25]">Not Risk.</span>
                  <span className="absolute inset-x-0 bottom-1 h-3.5 bg-[#fe5b25]/12 rounded-sm -z-0" />
                </span>
              </h1>

              <p
                className="animate-fade-in text-[1.05rem] md:text-lg text-stone-500 max-w-md mb-9 leading-relaxed"
                style={{ animationDelay: '200ms' }}
              >
                Hire verified subs. Get rated. Build your reputation.
                Track every job from handshake to completion.
              </p>

              {/* Step pills — horizontal flow */}
              <div
                className="animate-fade-in flex flex-wrap items-center gap-2 mb-9"
                style={{ animationDelay: '300ms' }}
              >
                {[
                  { icon: ShieldCheck, label: 'Verify', color: '#16a34a' },
                  { icon: ArrowRightLeft, label: 'Transfer', color: '#fe5b25' },
                  { icon: BarChart3, label: 'Track', color: '#3b82f6' },
                ].map((s, i) => (
                  <div key={s.label} className="flex items-center gap-2">
                    {i > 0 && <ChevronRight className="w-3.5 h-3.5 text-stone-300" />}
                    <div className="bg-white/80 backdrop-blur-sm rounded-full px-4 py-2 flex items-center gap-2 shadow-sm border border-stone-100">
                      <s.icon className="w-4 h-4" style={{ color: s.color }} />
                      <span className="text-sm font-semibold text-zinc-700">{s.label}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="animate-fade-in flex flex-col sm:flex-row items-start gap-4" style={{ animationDelay: '400ms' }}>
                <button
                  onClick={() => navigate('/login')}
                  className="group inline-flex items-center justify-center gap-2.5 rounded-full bg-gradient-to-r from-[#fe5b25] to-[#e04d1c] text-white px-8 py-4 text-base font-semibold transition-all duration-300 hover:scale-[1.03] hover:shadow-xl hover:shadow-[#fe5b25]/20 active:scale-[0.98] cursor-pointer"
                >
                  <Zap size={16} />
                  Join Free
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </button>
                <div className="flex flex-col justify-center">
                  <p className="text-xs text-stone-400 sm:mt-0">No credit card required</p>
                  <p className="text-xs text-stone-400">2-minute setup</p>
                </div>
              </div>
            </div>

            {/* Right — Hero image with floating UI cards */}
            <div className="animate-fade-in relative lg:pl-4 py-6" style={{ animationDelay: '300ms' }}>
              {/* Main image container — padding for floating cards */}
              <div className="relative mx-4">
                {/* Decorative orange accent behind image */}
                <div className="absolute -inset-3 bg-gradient-to-br from-[#fe5b25]/10 via-transparent to-blue-500/5 rounded-3xl" />

                <img
                  src="/locksmith-transfer.jpg"
                  alt="Contractor transfers a job through MasterLeadFlow dashboard"
                  className="relative w-full rounded-2xl shadow-2xl shadow-black/12"
                />

                {/* Floating card: Verified badge — top-left */}
                <div className="absolute -top-4 -left-4 bg-white rounded-xl px-4 py-2.5 shadow-lg shadow-black/8 border border-stone-100 flex items-center gap-2.5 animate-fade-in" style={{ animationDelay: '600ms' }}>
                  <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center">
                    <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-zinc-800 leading-tight">Verified Sub</p>
                    <p className="text-[10px] text-emerald-500 font-semibold">Identity Confirmed</p>
                  </div>
                </div>

                {/* Floating card: Job status — bottom-right */}
                <div className="absolute -bottom-4 -right-4 bg-white rounded-xl px-4 py-2.5 shadow-lg shadow-black/8 border border-stone-100 flex items-center gap-2.5 animate-fade-in" style={{ animationDelay: '750ms' }}>
                  <div className="w-8 h-8 rounded-full bg-[#fe5b25]/10 flex items-center justify-center">
                    <ArrowRightLeft className="w-4 h-4 text-[#fe5b25]" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-zinc-800 leading-tight">Job Transferred</p>
                    <p className="text-[10px] text-stone-400 font-medium">Tracked & Protected</p>
                  </div>
                </div>

                {/* Floating card: Rating — top-right */}
                <div className="absolute -top-3 right-8 bg-white rounded-lg px-3 py-1.5 shadow-lg shadow-black/8 border border-stone-100 flex items-center gap-1.5 animate-fade-in" style={{ animationDelay: '900ms' }}>
                  <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                  <span className="text-xs font-bold text-zinc-800">4.9</span>
                  <span className="text-[10px] text-stone-400">(127)</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ══════════════ REMOTION DEMO — How It Works ══════════════ */}
      <section className="py-16 md:py-24 px-6 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-zinc-900/[0.02] to-transparent pointer-events-none" />
        <div className="max-w-6xl mx-auto relative">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 bg-[#fe5b25]/8 border border-[#fe5b25]/15 text-[#fe5b25] rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-wider mb-5">
              <Zap className="w-3.5 h-3.5" />
              See It in Action
            </div>
            <h2 className="text-2xl md:text-3xl font-medium tracking-[-0.03em] text-zinc-900 mb-3">
              From Lead to Dashboard in 60 Seconds
            </h2>
            <p className="text-sm text-stone-500 max-w-md mx-auto">
              Watch how a job moves through the platform — verified, transferred, and tracked.
            </p>
          </div>

          {/* Remotion Player — embedded demo (wider composition to prevent clipping) */}
          <div className="glass-panel !rounded-3xl overflow-hidden border-none shadow-xl">
            <Player
              component={SubcontractorDemo}
              durationInFrames={DEMO_DURATION_FRAMES}
              fps={DEMO_FPS}
              compositionWidth={960}
              compositionHeight={600}
              style={{ width: '100%', borderRadius: 24 }}
              autoPlay
              loop
              controls={false}
            />
          </div>

          <p className="text-center text-xs text-stone-400 mt-4">
            Live demo · Auto-plays · Shows the full job transfer flow
          </p>
        </div>
      </section>

      {/* ══════════════ SECTION 2 — THE PROBLEM ══════════════ */}
      <section ref={problemRef.ref as React.RefObject<HTMLElement>} className="py-20 md:py-28 px-6">
        <div className="max-w-5xl mx-auto">
          <div className={`text-center mb-14 transition-all duration-700 ${problemRef.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
            <div className="inline-flex items-center gap-2 bg-red-500/8 border border-red-500/15 text-red-500 rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-wider mb-5">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
              The Problem
            </div>
            <h2 className="text-3xl md:text-4xl font-medium tracking-[-0.03em] text-zinc-900 leading-tight mb-4">
              Passing Jobs Today?{' '}
              <span className="text-stone-400">It{"'"}s All Based on Luck.</span>
            </h2>
            <p className="text-base text-stone-500 max-w-lg mx-auto leading-relaxed">
              Every day, contractors send money and trust to people they{"'"}ve never met. Here{"'"}s what goes wrong.
            </p>
          </div>

          {/* Problem cards — large, visual, with mini-scenarios */}
          <div className={`grid grid-cols-1 md:grid-cols-3 gap-5 mb-14 ${problemRef.visible ? 'stagger-children' : ''}`}>

            {/* Card 1 — No Information */}
            <div className="glass-panel p-0 border-none group overflow-hidden">
              <div className="bg-gradient-to-br from-red-50 to-orange-50/50 p-5 pb-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
                    <Dice5 className="w-5 h-5 text-red-500" />
                  </div>
                  <h3 className="font-semibold text-base text-zinc-900">No Information</h3>
                </div>
                <p className="text-stone-500 text-sm leading-relaxed">
                  You give a job to someone you don{"'"}t know. No reviews. No history. Just a phone number from a WhatsApp group.
                </p>
              </div>
              {/* Mini WhatsApp preview */}
              <div className="px-5 py-4 border-t border-stone-100">
                <div className="flex items-start gap-2.5 mb-2">
                  <img src="https://i.pravatar.cc/32?img=33" alt="" className="w-6 h-6 rounded-full mt-0.5" />
                  <div className="bg-white rounded-lg rounded-tl-none px-3 py-1.5 shadow-sm border border-stone-100 text-xs text-stone-600">
                    +1 (718) 555-0192 — tell him Dave sent you
                  </div>
                </div>
                <div className="flex items-start gap-2.5 justify-end">
                  <div className="bg-emerald-50 rounded-lg rounded-tr-none px-3 py-1.5 shadow-sm border border-emerald-100 text-xs text-stone-600">
                    Is he any good? Anyone worked with him?
                  </div>
                </div>
                <div className="mt-2.5 text-center">
                  <span className="text-[10px] font-semibold text-red-400 bg-red-50 px-2.5 py-1 rounded-full">
                    No reviews · No rating · No verification
                  </span>
                </div>
              </div>
            </div>

            {/* Card 2 — No Control */}
            <div className="glass-panel p-0 border-none group overflow-hidden">
              <div className="bg-gradient-to-br from-purple-50 to-violet-50/50 p-5 pb-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
                    <Ghost className="w-5 h-5 text-purple-500" />
                  </div>
                  <h3 className="font-semibold text-base text-zinc-900">No Control</h3>
                </div>
                <p className="text-stone-500 text-sm leading-relaxed">
                  They stop answering. They do bad work. They take the money and disappear. You have no way to protect yourself.
                </p>
              </div>
              {/* Transaction card */}
              <div className="px-5 py-4 border-t border-stone-100">
                <div className="flex items-center gap-3 mb-3">
                  <img src="https://i.pravatar.cc/32?img=51" alt="" className="w-7 h-7 rounded-full" />
                  <div className="flex-1">
                    <div className="text-xs font-semibold text-zinc-800">Tony Ramos</div>
                    <div className="text-[10px] text-stone-400">★ No rating · 0 jobs</div>
                  </div>
                  <span className="text-[10px] font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded-full">OFFLINE</span>
                </div>
                <div className="text-center py-2">
                  <div className="text-xl font-bold text-red-500">$3,500</div>
                  <div className="text-[10px] text-stone-400 mt-0.5">Deposit sent · No work done</div>
                </div>
              </div>
            </div>

            {/* Card 3 — Both Sides Lose */}
            <div className="glass-panel p-0 border-none group overflow-hidden">
              <div className="bg-gradient-to-br from-amber-50 to-yellow-50/50 p-5 pb-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                    <HeartHandshake className="w-5 h-5 text-amber-500" />
                  </div>
                  <h3 className="font-semibold text-base text-zinc-900">Both Sides Lose</h3>
                </div>
                <p className="text-stone-500 text-sm leading-relaxed">
                  Your sub also takes a risk. They do the work, but sometimes don{"'"}t get paid. Without trust — everyone loses.
                </p>
              </div>
              {/* Two sides */}
              <div className="px-5 py-4 border-t border-stone-100">
                <div className="grid grid-cols-2 gap-3">
                  <div className="text-center">
                    <img src="https://i.pravatar.cc/32?img=12" alt="" className="w-6 h-6 rounded-full mx-auto mb-1" />
                    <div className="text-[10px] font-semibold text-zinc-700">You</div>
                    <div className="text-[9px] text-red-500 font-medium mt-0.5">Lost $3,500</div>
                  </div>
                  <div className="text-center">
                    <img src="https://i.pravatar.cc/32?img=15" alt="" className="w-6 h-6 rounded-full mx-auto mb-1" />
                    <div className="text-[10px] font-semibold text-zinc-700">Sub</div>
                    <div className="text-[9px] text-red-500 font-medium mt-0.5">Worked for free</div>
                  </div>
                </div>
                <div className="mt-2.5 text-center">
                  <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full">
                    No contract · No proof · No protection
                  </span>
                </div>
              </div>
            </div>
          </div>

          <p className={`text-center text-lg font-medium text-stone-500 max-w-2xl mx-auto transition-all duration-700 delay-300 ${problemRef.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
            This happens every day. Billions in jobs move with zero protection.{' '}
            <span className="font-bold text-[#fe5b25]">Until now.</span>
          </p>
        </div>
      </section>

      {/* ══════════════ SECTION 3 — THE SOLUTION ══════════════ */}
      <section ref={solutionRef.ref as React.RefObject<HTMLElement>} className="py-24 md:py-32 px-6 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#fe5b25]/[0.02] to-transparent pointer-events-none" />

        <div className="max-w-6xl mx-auto relative">
          <div className={`text-center mb-16 transition-all duration-700 ${solutionRef.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
            <div className="inline-flex items-center gap-2 bg-[#fe5b25]/8 border border-[#fe5b25]/15 text-[#fe5b25] rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-wider mb-5">
              <Zap className="w-3.5 h-3.5" />
              The Solution
            </div>
            <h2 className="text-3xl md:text-4xl font-medium tracking-[-0.03em] text-zinc-900 mb-4">
              We Built the Missing Layer of Trust
            </h2>
            <p className="text-base text-stone-500 max-w-xl mx-auto leading-relaxed">
              Think of us as the safety net between you and your sub. We verify, track, and rate — so you don{"'"}t have to hope for the best.
            </p>
          </div>

          <div className={`grid grid-cols-1 md:grid-cols-3 gap-5 mb-14 ${solutionRef.visible ? 'stagger-children' : ''}`}>
            {[
              { num: '01', icon: ShieldCheck, color: '#16a34a', bg: 'bg-emerald-50', label: 'Verify', desc: 'Every sub on our platform is verified. Real identity. Real work history. Real ratings from real people.', img: '/verify-profile.jpg' },
              { num: '02', icon: ArrowRightLeft, color: '#fe5b25', bg: 'bg-orange-50', label: 'Transfer', desc: 'Send a job to your sub with one click. They get all the details. You get a dashboard to follow everything.', img: '/transfer-job.jpg' },
              { num: '03', icon: BarChart3, color: '#3b82f6', bg: 'bg-blue-50', label: 'Track', desc: "See the job status in real time. When it's done — both sides rate each other. Good work builds reputation.", img: '/track-status.jpg' },
            ].map(s => (
              <div key={s.num} className="glass-panel p-0 border-none group relative overflow-hidden">
                {s.img && (
                  <img src={s.img} alt={s.label} className="w-full h-44 object-cover" />
                )}
                <div className="p-7 relative">
                  <span className="absolute top-3 right-5 text-[4.5rem] font-black leading-none text-stone-100 select-none pointer-events-none">{s.num}</span>
                  <div className="relative">
                    <div className={`w-12 h-12 rounded-xl ${s.bg} flex items-center justify-center mb-5 transition-transform duration-300 group-hover:scale-110`}>
                      <s.icon className="w-6 h-6" style={{ color: s.color }} />
                    </div>
                    <h3 className="font-semibold text-xl text-zinc-900 mb-2">{s.label}</h3>
                    <p className="text-stone-500 leading-relaxed text-sm">{s.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className={`max-w-2xl mx-auto glass-panel !rounded-2xl p-6 border-l-4 !border-l-[#fe5b25] border-none transition-all duration-700 delay-300 ${solutionRef.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
            <div className="flex gap-4 items-start">
              <div className="w-9 h-9 rounded-lg bg-[#fe5b25]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Lightbulb className="w-4 h-4 text-[#fe5b25]" />
              </div>
              <p className="text-stone-600 leading-relaxed text-sm">
                <span className="font-semibold text-zinc-800">Your sub doesn{"'"}t have an account yet?</span>{' '}
                No problem. Send them a link to join — it takes 2 minutes. Then transfer the job directly.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════ SECTION 3.5 — IDENTITY VERIFICATION ══════════════ */}
      <section ref={verifyRef.ref as React.RefObject<HTMLElement>} className="py-24 md:py-32 px-6 relative overflow-hidden" style={{ background: 'linear-gradient(180deg, #fafaf9 0%, #f5f5f0 100%)' }}>
        {/* Background accents */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-blue-500/5 rounded-full blur-[120px] pointer-events-none" />

        <div className="max-w-6xl mx-auto relative">
          {/* Two-column layout: left = content, right = visual */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">

            {/* Left — Text + Steps */}
            <div className={`transition-all duration-700 ${verifyRef.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
              <div className="inline-flex items-center gap-2 bg-blue-500/8 border border-blue-500/15 text-blue-600 rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-wider mb-6">
                <ShieldCheck className="w-3.5 h-3.5" />
                Identity Verified
              </div>

              <h2 className="text-3xl md:text-4xl font-bold tracking-[-0.03em] text-zinc-900 mb-4 leading-tight">
                Know Who You{"'"}re{' '}
                <span className="text-blue-600">Working With</span>
              </h2>

              <p className="text-base text-stone-500 max-w-md mb-10 leading-relaxed">
                Verify your identity to build instant trust. Both sides see who they{"'"}re dealing with.
              </p>

              {/* Steps — vertical timeline */}
              <div className={`space-y-0 ${verifyRef.visible ? 'stagger-children' : ''}`}>
                {[
                  {
                    step: '01',
                    icon: IdCard,
                    color: '#3b82f6',
                    title: 'Upload ID',
                    desc: 'Photo of your government ID — encrypted & private.',
                  },
                  {
                    step: '02',
                    icon: ScanFace,
                    color: '#0ea5e9',
                    title: 'Quick Selfie',
                    desc: 'AI matches your face to your ID — takes 5 seconds.',
                  },
                  {
                    step: '03',
                    icon: BadgeCheck,
                    color: '#16a34a',
                    title: 'Verified!',
                    desc: 'Verified badge visible to both sides. Instant trust.',
                    final: true,
                  },
                ].map((s, i) => (
                  <div key={s.step} className="animate-fade-in flex gap-5" style={{ animationDelay: `${i * 150}ms` }}>
                    {/* Timeline line + icon */}
                    <div className="flex flex-col items-center">
                      <div
                        className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm border"
                        style={{ background: `${s.color}10`, borderColor: `${s.color}20` }}
                      >
                        <s.icon className="w-6 h-6" style={{ color: s.color }} strokeWidth={1.8} />
                      </div>
                      {!s.final && (
                        <div className="w-px h-full min-h-[32px] my-1.5" style={{ background: `linear-gradient(to bottom, ${s.color}30, transparent)` }} />
                      )}
                    </div>

                    {/* Content */}
                    <div className="pb-7 pt-0.5">
                      <span className="text-[10px] font-bold uppercase tracking-widest mb-1 block" style={{ color: `${s.color}80` }}>Step {s.step}</span>
                      <h3 className="text-base font-semibold text-zinc-800 mb-1">{s.title}</h3>
                      <p className="text-sm text-stone-500 leading-relaxed">{s.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Bottom note */}
              <div className="mt-8 flex items-center gap-3 bg-white rounded-xl px-5 py-3.5 border border-stone-100 shadow-sm">
                <div className="w-8 h-8 rounded-lg bg-[#fe5b25]/10 flex items-center justify-center shrink-0">
                  <TrendingUp className="w-4 h-4 text-[#fe5b25]" />
                </div>
                <p className="text-sm text-stone-600">
                  Verification is <span className="font-semibold text-zinc-800">optional</span> — but verified contractors get <span className="font-bold text-[#fe5b25]">3× more job offers</span>.
                </p>
              </div>
            </div>

            {/* Right — Visual mock: verification card */}
            <div className={`transition-all duration-700 delay-200 ${verifyRef.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
              <div className="relative max-w-sm mx-auto lg:max-w-none">
                {/* Glow behind card */}
                <div className="absolute -inset-4 bg-gradient-to-br from-blue-500/15 via-blue-400/10 to-transparent rounded-3xl blur-xl" />

                {/* Main verification card */}
                <div className="relative bg-zinc-900 rounded-2xl border border-white/10 overflow-hidden shadow-2xl">
                  {/* Card header */}
                  <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-blue-400" />
                      <span className="text-sm font-semibold text-white">Identity Verification</span>
                    </div>
                    <span className="text-[10px] bg-blue-500/15 text-blue-400 rounded-full px-2 py-0.5 font-semibold">VERIFIED</span>
                  </div>

                  {/* Profile section */}
                  <div className="px-6 py-5">
                    <div className="flex items-center gap-4 mb-5">
                      <div className="relative">
                        <img src="https://i.pravatar.cc/80?img=68" alt="Mike Johnson" className="w-14 h-14 rounded-2xl object-cover ring-2 ring-blue-500/30" />
                        <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center ring-2 ring-zinc-900">
                          <CheckCircle className="w-3 h-3 text-white" />
                        </div>
                      </div>
                      <div>
                        <div className="text-white font-semibold text-lg">Mike Johnson</div>
                        <div className="text-white/40 text-sm">Plumbing · Memphis, TN</div>
                        <div className="flex items-center gap-1.5 mt-1">
                          <BadgeCheck className="w-3.5 h-3.5 text-blue-400" />
                          <span className="text-xs font-semibold text-blue-400">Identity Confirmed</span>
                        </div>
                      </div>
                    </div>

                    {/* Verification checks */}
                    <div className="space-y-1">
                      {[
                        { label: 'Government ID', icon: IdCard, color: '#3b82f6' },
                        { label: 'Face Match', icon: ScanFace, color: '#0ea5e9' },
                        { label: 'Phone Number', icon: MessageSquare, color: '#8b5cf6' },
                        { label: 'Business License', icon: BadgeCheck, color: '#16a34a' },
                      ].map(check => (
                        <div key={check.label} className="flex items-center justify-between py-2.5 border-b border-white/5 last:border-0">
                          <div className="flex items-center gap-3">
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${check.color}15` }}>
                              <check.icon className="w-3.5 h-3.5" style={{ color: check.color }} />
                            </div>
                            <span className="text-sm text-white/70">{check.label}</span>
                          </div>
                          <div className="flex items-center gap-1.5 bg-blue-500/10 rounded-full px-2.5 py-1">
                            <CheckCircle className="w-3.5 h-3.5 text-blue-400" />
                            <span className="text-[11px] font-semibold text-blue-400">Passed</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Card footer */}
                  <div className="px-6 py-4 bg-blue-500/5 border-t border-white/5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                        <span className="text-sm font-bold text-white">4.9</span>
                        <span className="text-xs text-white/40">· 127 jobs</span>
                      </div>
                      <span className="text-xs text-white/30">Verified since Jan 2026</span>
                    </div>
                  </div>
                </div>

                {/* Floating badge */}
                <div className="absolute -top-3 -right-3 bg-blue-500 text-white rounded-full w-12 h-12 flex items-center justify-center shadow-lg shadow-blue-500/30">
                  <ShieldCheck className="w-6 h-6" />
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ══════════════ SECTION 4 — TRUST SYSTEM ══════════════ */}
      <section ref={trustRef.ref as React.RefObject<HTMLElement>} className="py-24 md:py-32 px-6 relative overflow-hidden" style={{ background: '#18181b' }}>
        {/* Subtle grid texture */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,.5) 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(ellipse, rgba(254,91,37,.04) 0%, transparent 70%)' }} />

        <div className="max-w-5xl mx-auto relative">
          <div className={`text-center mb-16 transition-all duration-700 ${trustRef.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
            <div className="inline-flex items-center gap-2 bg-[#fe5b25]/10 border border-[#fe5b25]/20 text-[#fe5b25] rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-wider mb-6">
              <ShieldCheck className="w-3.5 h-3.5" />
              Two-Way Trust
            </div>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-medium tracking-[-0.03em] text-white mb-5 leading-tight">
              Both Sides Get Rated.<br />
              <span className="text-white/40">Both Sides Are Protected.</span>
            </h2>
            <p className="text-base text-white/50 max-w-lg mx-auto leading-relaxed">
              After every job, both sides rate each other. The best people rise to the top. Bad actors get flagged.
            </p>
          </div>

          {/* Two simulated review cards side by side */}
          <div className={`grid grid-cols-1 md:grid-cols-2 gap-6 mb-20 ${trustRef.visible ? 'stagger-children' : ''}`}>

            {/* YOU reviewing your sub */}
            <div className="rounded-3xl bg-white overflow-hidden shadow-2xl shadow-black/20">
              {/* Card header with avatar */}
              <div className="px-6 pt-6 pb-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#fe5b25]">You rated your sub</span>
                  <span className="text-[10px] text-stone-400">2 days ago</span>
                </div>
                <div className="flex items-center gap-3 mt-3">
                  <img src="https://i.pravatar.cc/48?img=15" alt="" className="w-11 h-11 rounded-full ring-2 ring-[#fe5b25]/20" />
                  <div>
                    <div className="font-semibold text-zinc-900 text-sm">Mike Johnson</div>
                    <div className="text-[11px] text-stone-400">Plumbing · Kitchen Renovation</div>
                  </div>
                </div>
              </div>

              {/* Rating bars */}
              <div className="px-6 pb-2">
                {[
                  { label: 'Work Quality', score: 4.5, pct: 90 },
                  { label: 'Communication', score: 5.0, pct: 100 },
                  { label: 'On Time', score: 3.5, pct: 70 },
                ].map(r => (
                  <div key={r.label} className="flex items-center gap-3 py-2.5 border-b border-stone-50 last:border-0">
                    <span className="text-xs text-stone-500 w-28 shrink-0">{r.label}</span>
                    <div className="flex-1 h-2 rounded-full bg-stone-100 overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-[#fe5b25] to-[#ff7a4d]" style={{ width: `${r.pct}%` }} />
                    </div>
                    <span className="text-xs font-bold text-zinc-800 w-8 text-right">{r.score}</span>
                  </div>
                ))}
              </div>

              {/* Bottom verdict */}
              <div className="px-6 py-4 bg-emerald-50 flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                <span className="text-sm font-semibold text-emerald-800">Would hire again</span>
                <div className="ml-auto flex items-center gap-1">
                  {[1,2,3,4,5].map(s => <Star key={s} className={`w-3.5 h-3.5 ${s <= 4 ? 'text-amber-400 fill-amber-400' : 'text-stone-300'}`} />)}
                </div>
              </div>
            </div>

            {/* SUB reviewing you */}
            <div className="rounded-3xl bg-white overflow-hidden shadow-2xl shadow-black/20">
              <div className="px-6 pt-6 pb-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-500">Your sub rated you</span>
                  <span className="text-[10px] text-stone-400">2 days ago</span>
                </div>
                <div className="flex items-center gap-3 mt-3">
                  <img src="https://i.pravatar.cc/48?img=12" alt="" className="w-11 h-11 rounded-full ring-2 ring-blue-500/20" />
                  <div>
                    <div className="font-semibold text-zinc-900 text-sm">You</div>
                    <div className="text-[11px] text-stone-400">Hired for Kitchen Renovation</div>
                  </div>
                </div>
              </div>

              <div className="px-6 pb-2">
                {[
                  { label: 'Paid on Time', score: 5.0, pct: 100 },
                  { label: 'Communication', score: 4.5, pct: 90 },
                  { label: 'Job as Described', score: 4.0, pct: 80 },
                ].map(r => (
                  <div key={r.label} className="flex items-center gap-3 py-2.5 border-b border-stone-50 last:border-0">
                    <span className="text-xs text-stone-500 w-28 shrink-0">{r.label}</span>
                    <div className="flex-1 h-2 rounded-full bg-stone-100 overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-blue-400" style={{ width: `${r.pct}%` }} />
                    </div>
                    <span className="text-xs font-bold text-zinc-800 w-8 text-right">{r.score}</span>
                  </div>
                ))}
              </div>

              <div className="px-6 py-4 bg-emerald-50 flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                <span className="text-sm font-semibold text-emerald-800">Would work together again</span>
                <div className="ml-auto flex items-center gap-1">
                  {[1,2,3,4,5].map(s => <Star key={s} className={`w-3.5 h-3.5 ${s <= 5 ? 'text-amber-400 fill-amber-400' : 'text-stone-300'}`} />)}
                </div>
              </div>
            </div>
          </div>

          {/* Tier progression — image + text side by side */}
          <div ref={tiersRef.ref as React.RefObject<HTMLDivElement>} className={`transition-all duration-700 ${tiersRef.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>

            {/* Hero banner: image left, text + tiers right */}
            <div className="grid grid-cols-1 md:grid-cols-[1fr_1.2fr] gap-10 items-center mb-10">
              {/* Left — Image with decorative frame */}
              <div className="relative mx-auto md:mx-0 max-w-sm">
                <div className="absolute -inset-2 bg-gradient-to-br from-amber-400/20 via-[#fe5b25]/10 to-purple-500/10 rounded-3xl blur-sm" />
                <img
                  src="/reviews-technician-v3.jpg"
                  alt="Contractor surrounded by 5-star reviews"
                  className="relative w-full rounded-2xl shadow-2xl border border-white/10"
                />
                {/* Floating star badge */}
                <div className="absolute -bottom-3 -right-3 bg-amber-400 text-zinc-900 rounded-full px-3 py-1.5 flex items-center gap-1.5 shadow-lg">
                  <Star className="w-3.5 h-3.5 fill-zinc-900" />
                  <span className="text-xs font-extrabold">Top Rated</span>
                </div>
              </div>

              {/* Right — Text + tier cards */}
              <div>
                <h3 className="text-2xl md:text-3xl font-bold text-white mb-2 tracking-tight">Build Your Reputation</h3>
                <p className="text-sm text-white/40 mb-8 max-w-md leading-relaxed">Complete more jobs with good ratings to unlock higher tiers.</p>

                {/* Tier progression — horizontal journey */}
                <div className="relative">
                  {/* Connecting line */}
                  <div className="absolute top-6 left-6 right-6 h-[2px] bg-gradient-to-r from-emerald-500/40 via-blue-500/40 via-purple-500/40 to-amber-500/40 rounded-full" />
                  <div className="absolute top-[22px] left-6 h-[6px] rounded-full bg-gradient-to-r from-emerald-500 via-blue-500 via-60% via-purple-500 to-amber-400" style={{ width: '25%', filter: 'blur(3px)', opacity: 0.5 }} />

                  <div className="flex justify-between relative">
                    {[
                      { label: 'New', color: '#16a34a', colorEnd: '#22c55e', jobs: '0 jobs', desc: 'Just joined', active: true },
                      { label: 'Verified', color: '#3b82f6', colorEnd: '#60a5fa', jobs: '5+ jobs', desc: 'Identity confirmed' },
                      { label: 'Trusted', color: '#8b5cf6', colorEnd: '#a78bfa', jobs: '15+ jobs', desc: 'Proven track record' },
                      { label: 'Elite', color: '#f59e0b', colorEnd: '#fbbf24', jobs: '30+ jobs', desc: 'Top performer', glow: true },
                    ].map((tier, i) => (
                      <div key={tier.label} className="flex flex-col items-center text-center group" style={{ flex: 1 }}>
                        {/* Node */}
                        <div
                          className="relative w-12 h-12 rounded-full flex items-center justify-center mb-3 transition-transform group-hover:scale-110"
                          style={{
                            background: tier.active
                              ? `linear-gradient(135deg, ${tier.color}, ${tier.colorEnd})`
                              : `${tier.color}15`,
                            border: `2px solid ${tier.active ? tier.color : tier.color + '40'}`,
                            boxShadow: tier.glow
                              ? `0 0 20px ${tier.color}40, 0 0 40px ${tier.color}20`
                              : tier.active
                                ? `0 0 15px ${tier.color}30`
                                : 'none',
                          }}
                        >
                          {tier.glow && <Star className="w-5 h-5 text-zinc-900 fill-zinc-900" />}
                          {!tier.glow && (
                            <div className="flex gap-[3px]">
                              {Array.from({ length: i + 1 }).map((_, j) => (
                                <div
                                  key={j}
                                  className="w-[5px] h-[5px] rounded-full"
                                  style={{ background: tier.active ? '#fff' : tier.color }}
                                />
                              ))}
                            </div>
                          )}
                          {tier.active && (
                            <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-zinc-900 flex items-center justify-center">
                              <CheckCircle className="w-2.5 h-2.5 text-white" />
                            </div>
                          )}
                        </div>
                        <span className="text-xs font-bold mb-0.5" style={{ color: tier.color }}>{tier.label}</span>
                        <span className="text-[10px] text-white/50 leading-tight">{tier.desc}</span>
                        <span className="text-[10px] text-white/25 mt-0.5">{tier.jobs}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <p className="text-sm text-white/40 text-center max-w-md mx-auto leading-relaxed">
              Higher tier = more trust = <span className="font-semibold text-[#fe5b25]">more jobs coming your way.</span>
            </p>
          </div>
        </div>
      </section>

      {/* ══════════════ SECTION 5 — DASHBOARD ══════════════ */}
      <section ref={dashRef.ref as React.RefObject<HTMLElement>} className="py-24 md:py-32 px-6 relative overflow-hidden" style={{ background: 'linear-gradient(180deg, #18181b 0%, #18181b 90%, #27272a 100%)' }}>
        <div className="absolute inset-0 opacity-[0.04] pointer-events-none" style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,.6) 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-[#fe5b25]/8 rounded-full blur-[100px] pointer-events-none" />

        <div className="max-w-5xl mx-auto relative">
          <div className={`text-center mb-14 transition-all duration-700 ${dashRef.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
            <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-wider mb-5">
              <LayoutDashboard className="w-3.5 h-3.5" />
              Dashboard
            </div>
            <h2 className="text-3xl md:text-4xl font-medium tracking-[-0.03em] text-white mb-4">
              Your Jobs. One Dashboard. <span className="text-stone-500">Full Control.</span>
            </h2>
            <p className="text-base text-white/60 max-w-xl mx-auto leading-relaxed">
              No more chasing updates on WhatsApp. See everything in one place.
            </p>
          </div>

          {/* Dashboard mockup — WHITE/LIGHT theme on dark background */}
          <div
            className={`max-w-3xl mx-auto mb-16 transition-all duration-1000 ${dashRef.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}
            style={{ transitionDelay: '200ms' }}
          >
            <div
              className="rounded-3xl overflow-hidden"
              style={{
                background: '#ffffff',
                boxShadow: '0 0 0 1px rgba(0,0,0,.05), 0 8px 40px rgba(0,0,0,.15), 0 20px 80px rgba(0,0,0,.1)',
                transform: 'perspective(1200px) rotateX(2deg) rotateY(-1deg)',
              }}
            >
              {/* Browser chrome — light */}
              <div className="px-5 py-3 flex items-center justify-between border-b border-stone-100" style={{ background: '#fafafa' }}>
                <div className="flex items-center gap-3">
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                  </div>
                  <div className="ml-3 px-3 py-1 rounded-lg bg-stone-100 border border-stone-200">
                    <span className="text-[10px] text-stone-500 font-mono">app.masterleadflow.com/jobs</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[9px] text-emerald-600 font-medium">Live</span>
                </div>
              </div>

              <div className="p-5">
                {/* KPI stats — light theme */}
                <div className="grid grid-cols-3 gap-3 mb-4">
                  {[
                    { label: 'Active Jobs', val: '7', color: '#16a34a' },
                    { label: 'Completed', val: '23', color: '#3b82f6' },
                    { label: 'Rating', val: '4.8', color: '#f59e0b' },
                  ].map(s => (
                    <div key={s.label} className="rounded-xl p-3 bg-stone-50 border border-stone-100">
                      <span className="text-[9px] text-stone-400 uppercase tracking-wider font-medium block mb-0.5">{s.label}</span>
                      <span className="text-xl font-bold text-zinc-900">{s.val}</span>
                    </div>
                  ))}
                </div>

                {/* Job cards — light theme */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {[
                    { name: 'Kitchen Renovation', sub: 'Carlos M.', avatar: 33, status: 'Active', color: '#16a34a', pct: 72, stars: 4 },
                    { name: 'Bathroom Remodel', sub: 'Ahmad R.', avatar: 60, status: 'Completed', color: '#3b82f6', pct: 100, stars: 5 },
                    { name: 'Roof Repair', sub: 'David L.', avatar: 51, status: 'Pending', color: '#f59e0b', pct: 15, stars: 3 },
                    { name: 'Deck Installation', sub: 'Mike T.', avatar: 15, status: 'Active', color: '#16a34a', pct: 45, stars: 4 },
                  ].map(job => (
                    <div key={job.name} className="rounded-xl p-3.5 bg-white border border-stone-100 hover:shadow-sm transition-shadow">
                      <div className="flex items-center justify-between mb-2.5">
                        <h4 className="text-zinc-900 text-xs font-semibold">{job.name}</h4>
                        <span className="px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-wider" style={{ background: `${job.color}12`, color: job.color, border: `1px solid ${job.color}25` }}>
                          {job.status}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-stone-100 overflow-hidden mb-2.5">
                        <div className="h-full rounded-full transition-all duration-1000" style={{ width: dashRef.visible ? `${job.pct}%` : '0%', background: `linear-gradient(90deg, ${job.color}, ${job.color}cc)`, transitionDelay: '600ms' }} />
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-0.5">
                          {[1,2,3,4,5].map(sv => <Star key={sv} className={`w-2.5 h-2.5 ${sv <= job.stars ? 'text-amber-400 fill-amber-400' : 'text-stone-200'}`} />)}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <img src={`https://i.pravatar.cc/20?img=${job.avatar}`} alt="" className="w-4 h-4 rounded-full" />
                          <span className="text-[9px] text-stone-500">{job.sub}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div ref={dashFeatRef.ref as React.RefObject<HTMLDivElement>} className={`grid grid-cols-1 md:grid-cols-3 gap-8 max-w-3xl mx-auto mb-10 ${dashFeatRef.visible ? 'stagger-children' : ''}`}>
            {[
              { icon: LayoutDashboard, color: '#16a34a', title: 'Job Status', desc: 'See which jobs are active, completed, or waiting — in real time.' },
              { icon: MessageSquare, color: '#3b82f6', title: 'Communication Log', desc: 'All messages and updates in one place. No more scrolling through chats.' },
              { icon: TrendingUp, color: '#fe5b25', title: 'Performance', desc: 'Track your ratings, completed jobs, and reputation score as you grow.' },
            ].map(f => (
              <div key={f.title} className="text-center">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-3" style={{ background: `${f.color}15`, border: `1px solid ${f.color}25` }}>
                  <f.icon className="w-5 h-5" style={{ color: f.color }} />
                </div>
                <h3 className="font-semibold text-white text-sm mb-1">{f.title}</h3>
                <p className="text-xs text-white/70 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>

          <p className={`text-white/60 italic text-center text-sm transition-all duration-700 delay-300 ${dashFeatRef.visible ? 'opacity-100' : 'opacity-0'}`}>
            This is not just a tool. It{"'"}s your professional profile — and it follows you everywhere.
          </p>
        </div>
      </section>

      {/* ══════════════ SECTION 6 — CTA + FOOTER ══════════════ */}
      <section ref={ctaRef.ref as React.RefObject<HTMLElement>} className="py-24 md:py-32 px-6 relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-[#fe5b25]/[0.04] rounded-full blur-[100px] pointer-events-none" />

        <div className="max-w-3xl mx-auto text-center relative">
          <div className={`transition-all duration-700 ${ctaRef.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-medium tracking-[-0.03em] text-zinc-900 mb-5 leading-tight">
              Ready to Pass Jobs<br />the Smart Way?
            </h2>
            <p className="text-base text-stone-500 mb-10 leading-relaxed max-w-lg mx-auto">
              Join for free. Set up your profile in 2 minutes. Start building your reputation today.
            </p>
          </div>

          <div className={`transition-all duration-700 delay-200 ${ctaRef.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
            <button
              onClick={() => navigate('/login')}
              className="group inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#fe5b25] to-[#e04d1c] text-white px-10 py-4 text-base font-semibold transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-[#fe5b25]/25 active:scale-95 cursor-pointer mb-8"
            >
              Join Free Now
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </button>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-5 sm:gap-8">
              {['No credit card needed', 'Free to join', 'Takes 2 minutes'].map(text => (
                <div key={text} className="flex items-center gap-2">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="text-xs text-stone-500">{text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="max-w-5xl mx-auto mt-24 pt-8 border-t border-stone-200/60">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <a href={LANDING_URL} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-[9px] bg-gradient-to-br from-[#fe5b25] to-[#e04d1c]">LE</div>
                <span className="text-stone-400 text-sm font-medium">MasterLeadFlow</span>
              </a>
            </div>
            <div className="flex items-center gap-6">
              <a href={LANDING_URL + '#features'} className="text-stone-400 text-xs hover:text-[#fe5b25] transition-colors">Features</a>
              <a href={LANDING_URL + '#pricing'} className="text-stone-400 text-xs hover:text-[#fe5b25] transition-colors">Pricing</a>
              <a href={LANDING_URL + '#faq'} className="text-stone-400 text-xs hover:text-[#fe5b25] transition-colors">FAQ</a>
            </div>
            <p className="text-stone-400 text-xs">Built for contractors who value trust.</p>
          </div>
        </div>
      </section>
    </div>
  )
}
