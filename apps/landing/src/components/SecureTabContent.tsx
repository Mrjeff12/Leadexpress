import {
  ShieldCheck, ArrowRightLeft, BarChart3,
  Dice5, Ghost, HeartHandshake, Lightbulb, Star, CheckCircle,
  MessageSquare, TrendingUp, Zap,
  ScanFace, IdCard, BadgeCheck,
  UserPlus, UserCheck, Award, Crown, ShieldCheck as ShieldVerify,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

/* ─── Intersection Observer ─── */
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

/* ════════════════════════════════════════════════════════════
   HOW WE PROTECT YOU — 4 focused sections:
   1. Problem (passing jobs is risky)
   2. Solution (Verify / Transfer / Track)
   3. Verification + Trust System (merged)
   4. Tier Progression
   ════════════════════════════════════════════════════════════ */
export default function SecureTabContent() {
  const problemRef = useInView(0.15)
  const solutionRef = useInView(0.15)
  const trustRef = useInView(0.15)
  const tiersRef = useInView(0.15)

  return (
    <>
      {/* Step 1 */}
      <div data-step="8" data-step-label="The Risk Today" data-step-color="#ef4444">
      <div className="flex items-center justify-center gap-4 md:gap-6 py-10 md:py-14 px-6">
        <div className="h-px flex-1 max-w-[120px] bg-stone-200/80" />
        <div className="flex items-center gap-3 md:gap-4">
          <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl flex items-center justify-center text-white text-xl md:text-2xl font-black shadow-lg bg-red-500" style={{ boxShadow: '0 4px 20px rgba(239,68,68,0.4)' }}>8</div>
          <span className="text-base md:text-lg font-bold text-zinc-800 tracking-tight">The Risk Today</span>
        </div>
        <div className="h-px flex-1 max-w-[120px] bg-stone-200/80" />
      </div>

      {/* ══════════════ SECTION 1 — THE PROBLEM ══════════════ */}
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

      </div>{/* close step 1 wrapper */}

      {/* Step 2 */}
      <div data-step="9" data-step-label="Verify → Transfer → Track" data-step-color="#fe5b25">
      <div className="flex items-center justify-center gap-4 md:gap-6 py-10 md:py-14 px-6">
        <div className="h-px flex-1 max-w-[120px] bg-stone-200/80" />
        <div className="flex items-center gap-3 md:gap-4">
          <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl flex items-center justify-center text-white text-xl md:text-2xl font-black shadow-lg" style={{ background: '#fe5b25', boxShadow: '0 4px 20px rgba(254,91,37,0.4)' }}>9</div>
          <span className="text-base md:text-lg font-bold text-zinc-800 tracking-tight">Verify → Transfer → Track</span>
        </div>
        <div className="h-px flex-1 max-w-[120px] bg-stone-200/80" />
      </div>

      {/* ══════════════ SECTION 2 — THE SOLUTION ══════════════ */}
      <section ref={solutionRef.ref as React.RefObject<HTMLElement>} className="py-24 md:py-32 px-6 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#fe5b25]/[0.02] to-transparent pointer-events-none" />
        <div className="max-w-6xl mx-auto relative">
          <div className={`text-center mb-16 transition-all duration-700 ${solutionRef.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
            <div className="inline-flex items-center gap-2 bg-[#fe5b25]/8 border border-[#fe5b25]/15 text-[#fe5b25] rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-wider mb-5">
              <Zap className="w-3.5 h-3.5" />
              The Solution
            </div>
            <h2 className="text-3xl md:text-4xl font-medium tracking-[-0.03em] text-zinc-900 mb-4">
              No More Guessing. <span className="text-stone-400">Know Who You{"'"}re Working With.</span>
            </h2>
            <p className="text-base text-stone-500 max-w-xl mx-auto leading-relaxed">
              We verify, track, and rate — so you don{"'"}t have to hope for the best.
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

      </div>{/* close step 2 wrapper */}

      {/* Step 3 */}
      <div data-step="10" data-step-label="Both Sides Protected" data-step-color="#3b82f6">
      <div className="flex items-center justify-center gap-4 md:gap-6 py-10 md:py-14 px-6">
        <div className="h-px flex-1 max-w-[120px] bg-stone-200/80" />
        <div className="flex items-center gap-3 md:gap-4">
          <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl flex items-center justify-center text-white text-xl md:text-2xl font-black shadow-lg bg-blue-500" style={{ boxShadow: '0 4px 20px rgba(59,130,246,0.4)' }}>10</div>
          <span className="text-base md:text-lg font-bold text-zinc-800 tracking-tight">Both Sides Protected</span>
        </div>
        <div className="h-px flex-1 max-w-[120px] bg-stone-200/80" />
      </div>

      {/* ══════════════ SECTION 3 — VERIFICATION + TRUST (merged) ══════════════ */}
      <section ref={trustRef.ref as React.RefObject<HTMLElement>} className="py-24 md:py-32 px-6 relative overflow-hidden" style={{ background: 'linear-gradient(180deg, #fafaf9 0%, #f5f5f0 100%)' }}>
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-blue-500/5 rounded-full blur-[120px] pointer-events-none" />
        <div className="max-w-6xl mx-auto relative">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center mb-24">
            {/* Left — Verification steps */}
            <div className={`transition-all duration-700 ${trustRef.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
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
              <div className={`space-y-0 ${trustRef.visible ? 'stagger-children' : ''}`}>
                {[
                  { step: '01', icon: IdCard, color: '#3b82f6', title: 'Upload ID', desc: 'Photo of your government ID — encrypted & private.' },
                  { step: '02', icon: ScanFace, color: '#0ea5e9', title: 'Quick Selfie', desc: 'AI matches your face to your ID — takes 5 seconds.' },
                  { step: '03', icon: BadgeCheck, color: '#16a34a', title: 'Verified!', desc: 'Verified badge visible to both sides. Instant trust.', final: true },
                ].map((s, i) => (
                  <div key={s.step} className="animate-fade-in flex gap-5" style={{ animationDelay: `${i * 150}ms` }}>
                    <div className="flex flex-col items-center">
                      <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm border" style={{ background: `${s.color}10`, borderColor: `${s.color}20` }}>
                        <s.icon className="w-6 h-6" style={{ color: s.color }} strokeWidth={1.8} />
                      </div>
                      {!s.final && <div className="w-px h-full min-h-[32px] my-1.5" style={{ background: `linear-gradient(to bottom, ${s.color}30, transparent)` }} />}
                    </div>
                    <div className="pb-7 pt-0.5">
                      <span className="text-[10px] font-bold uppercase tracking-widest mb-1 block" style={{ color: `${s.color}80` }}>Step {s.step}</span>
                      <h3 className="text-base font-semibold text-zinc-800 mb-1">{s.title}</h3>
                      <p className="text-sm text-stone-500 leading-relaxed">{s.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-8 flex items-center gap-3 bg-white rounded-xl px-5 py-3.5 border border-stone-100 shadow-sm">
                <div className="w-8 h-8 rounded-lg bg-[#fe5b25]/10 flex items-center justify-center shrink-0">
                  <TrendingUp className="w-4 h-4 text-[#fe5b25]" />
                </div>
                <p className="text-sm text-stone-600">
                  Verification is <span className="font-semibold text-zinc-800">optional</span> — but verified contractors get <span className="font-bold text-[#fe5b25]">3× more job offers</span>.
                </p>
              </div>
            </div>

            {/* Right — Verification card visual */}
            <div className={`transition-all duration-700 delay-200 ${trustRef.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
              <div className="relative max-w-sm mx-auto lg:max-w-none">
                <div className="absolute -inset-4 bg-gradient-to-br from-blue-500/15 via-blue-400/10 to-transparent rounded-3xl blur-xl" />
                <div className="relative bg-zinc-900 rounded-2xl border border-white/10 overflow-hidden shadow-2xl">
                  <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-blue-400" />
                      <span className="text-sm font-semibold text-white">Identity Verification</span>
                    </div>
                    <span className="text-[10px] bg-blue-500/15 text-blue-400 rounded-full px-2 py-0.5 font-semibold">VERIFIED</span>
                  </div>
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
                <div className="absolute -top-3 -right-3 bg-blue-500 text-white rounded-full w-12 h-12 flex items-center justify-center shadow-lg shadow-blue-500/30">
                  <ShieldCheck className="w-6 h-6" />
                </div>
              </div>
            </div>
          </div>

          {/* Two-Way Trust — review cards */}
          <div className={`text-center mb-12 transition-all duration-700 ${trustRef.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
            <h3 className="text-2xl md:text-3xl font-medium tracking-[-0.03em] text-zinc-900 mb-3">
              Both Sides Get Rated. <span className="text-stone-400">Both Sides Are Protected.</span>
            </h3>
            <p className="text-base text-stone-500 max-w-lg mx-auto leading-relaxed">
              After every job, both sides rate each other. Good work builds reputation.
            </p>
          </div>

          <div className={`grid grid-cols-1 md:grid-cols-2 gap-6 ${trustRef.visible ? 'stagger-children' : ''}`}>
            {/* YOU reviewing your sub */}
            <div className="rounded-3xl bg-white overflow-hidden shadow-xl border border-stone-100">
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
              <div className="px-6 py-4 bg-emerald-50 flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                <span className="text-sm font-semibold text-emerald-800">Would hire again</span>
                <div className="ml-auto flex items-center gap-1">
                  {[1,2,3,4,5].map(s => <Star key={s} className={`w-3.5 h-3.5 ${s <= 4 ? 'text-amber-400 fill-amber-400' : 'text-stone-300'}`} />)}
                </div>
              </div>
            </div>

            {/* SUB reviewing you */}
            <div className="rounded-3xl bg-white overflow-hidden shadow-xl border border-stone-100">
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
        </div>
      </section>

      </div>{/* close step 3 wrapper */}

      {/* Step 4 */}
      <div data-step="11" data-step-label="Build Your Reputation" data-step-color="#16a34a">
      <div className="flex items-center justify-center gap-4 md:gap-6 py-10 md:py-14 px-6">
        <div className="h-px flex-1 max-w-[120px] bg-stone-200/80" />
        <div className="flex items-center gap-3 md:gap-4">
          <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl flex items-center justify-center text-white text-xl md:text-2xl font-black shadow-lg" style={{ background: '#16a34a', boxShadow: '0 4px 20px rgba(22,163,74,0.4)' }}>11</div>
          <span className="text-base md:text-lg font-bold text-zinc-800 tracking-tight">Build Your Reputation</span>
        </div>
        <div className="h-px flex-1 max-w-[120px] bg-stone-200/80" />
      </div>

      {/* ══════════════ SECTION 4 — TIER PROGRESSION ══════════════ */}
      <section ref={tiersRef.ref as React.RefObject<HTMLElement>} className="py-24 md:py-32 px-6 relative overflow-hidden bg-[#faf9f6]">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(ellipse, rgba(254,91,37,.04) 0%, transparent 70%)' }} />

        <div className="max-w-5xl mx-auto relative">
          <div className={`transition-all duration-700 ${tiersRef.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
            <div className="grid grid-cols-1 md:grid-cols-[1fr_1.2fr] gap-10 items-center mb-10">
              <div className="relative mx-auto md:mx-0 max-w-sm">
                <div className="absolute -inset-2 bg-gradient-to-br from-amber-400/20 via-[#fe5b25]/10 to-purple-500/10 rounded-3xl blur-sm" />
                <img src="/reviews-technician-v3.jpg" alt="Contractor surrounded by 5-star reviews" className="relative w-full rounded-2xl shadow-2xl border border-stone-200" />
                <div className="absolute -bottom-3 -right-3 bg-amber-400 text-zinc-900 rounded-full px-3 py-1.5 flex items-center gap-1.5 shadow-lg">
                  <Star className="w-3.5 h-3.5 fill-zinc-900" />
                  <span className="text-xs font-extrabold">Top Rated</span>
                </div>
              </div>
              <div>
                <h3 className="text-2xl md:text-3xl font-bold text-zinc-900 mb-2 tracking-tight">Do Good Work. Get More Jobs.</h3>
                <p className="text-sm text-stone-500 mb-8 max-w-md leading-relaxed">Your reputation follows you. Complete more jobs with good ratings to unlock higher tiers.</p>
                <div className="relative">
                  {/* Progress line */}
                  <div className="absolute top-8 left-[10%] right-[10%] h-[3px] rounded-full overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-stone-300 via-emerald-300 via-30% via-blue-300 via-55% via-purple-300 via-75% to-amber-300 opacity-40" />
                  </div>
                  {/* Active progress fill */}
                  <div className="absolute top-[30px] left-[10%] h-[5px] rounded-full bg-gradient-to-r from-stone-400 to-stone-500" style={{ width: '6%', filter: 'blur(3px)', opacity: 0.5 }} />

                  <div className="flex justify-between relative">
                    {([
                      { label: 'Registered', icon: '/icons/registered.svg', color: '#78716c', colorEnd: '#a8a29e', desc: 'Signed up', jobs: '0 jobs', active: true },
                      { label: 'Verified', icon: '/icons/verified.svg', color: '#16a34a', colorEnd: '#4ade80', desc: 'ID + face check', jobs: '0 jobs' },
                      { label: 'Proven', icon: '/icons/proven.svg', color: '#3b82f6', colorEnd: '#93c5fd', desc: 'Track record', jobs: '5+ jobs' },
                      { label: 'Trusted', icon: '/icons/trusted.svg', color: '#8b5cf6', colorEnd: '#c4b5fd', desc: '4.5+ rating', jobs: '15+ jobs' },
                      { label: 'Elite', icon: '/icons/elite.svg', color: '#f59e0b', colorEnd: '#fcd34d', desc: 'Top performer', jobs: '30+ jobs' },
                    ]).map((tier) => (
                      <div key={tier.label} className="flex flex-col items-center text-center group" style={{ flex: 1 }}>
                        <div
                          className="relative w-16 h-16 md:w-[72px] md:h-[72px] rounded-2xl flex items-center justify-center mb-3 transition-all duration-300 group-hover:scale-110 group-hover:-translate-y-1"
                          style={{
                            background: tier.active
                              ? `linear-gradient(145deg, ${tier.color}18, ${tier.color}08)`
                              : `linear-gradient(145deg, ${tier.color}0a, ${tier.color}05)`,
                            border: `2px solid ${tier.active ? tier.color + '40' : tier.color + '15'}`,
                            boxShadow: tier.active
                              ? `0 8px 24px ${tier.color}20, 0 2px 4px ${tier.color}10`
                              : `0 2px 8px ${tier.color}05`,
                          }}
                        >
                          <img
                            src={tier.icon}
                            alt={tier.label}
                            className="w-10 h-10 md:w-11 md:h-11"
                            style={{ filter: tier.active ? 'none' : 'grayscale(0.4) opacity(0.5)' }}
                          />
                          {tier.active && (
                            <div className="absolute -bottom-1.5 -right-1.5 w-6 h-6 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 border-[2.5px] border-[#faf9f6] flex items-center justify-center shadow-md">
                              <CheckCircle className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
                            </div>
                          )}
                        </div>
                        <span className="text-[11px] font-extrabold mb-0.5 tracking-tight" style={{ color: tier.color }}>{tier.label}</span>
                        <span className="text-[10px] text-stone-500 leading-tight">{tier.desc}</span>
                        <span className="text-[10px] text-stone-400 mt-0.5">{tier.jobs}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <p className="text-sm text-stone-500 text-center max-w-md mx-auto leading-relaxed">
              Higher tier = more trust = <span className="font-semibold text-[#fe5b25]">more jobs coming your way.</span>
            </p>
          </div>
        </div>
      </section>
      </div>{/* close step 4 wrapper */}
    </>
  )
}
