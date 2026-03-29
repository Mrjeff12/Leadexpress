import { useEffect, useRef, useState } from 'react'
import {
  ShieldAlert, ArrowRightLeft, ShieldCheck, BarChart3,
  AlertTriangle, Eye, FileQuestion, ChevronRight,
  UserCheck, Star, BadgeCheck, Clock,
  Send, CheckCircle, Handshake, CreditCard,
} from 'lucide-react'

/* ── shared hook ─── */
function useInView(threshold = 0.15) {
  const ref = useRef<HTMLElement | null>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect() } },
      { threshold },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [threshold])
  return { ref, visible }
}

/* ══════════════════════════════════════════════════
   SECTION 1 — Why Secure
   ══════════════════════════════════════════════════ */
export function SecureWhySection() {
  const { ref, visible } = useInView()

  const problems = [
    { icon: AlertTriangle, title: 'No Accountability', titleHe: 'אין אחריות', desc: 'Jobs passed in groups disappear — no tracking, no proof.', descHe: 'עבודות שמועברות בקבוצות נעלמות — בלי מעקב, בלי הוכחה.' },
    { icon: Eye, title: 'No Verification', titleHe: 'אין אימות', desc: "You don't know who you're hiring or sending work to.", descHe: 'אתה לא יודע למי אתה שולח עבודה או ממי אתה מקבל.' },
    { icon: FileQuestion, title: 'No Records', titleHe: 'אין תיעוד', desc: 'When something goes wrong, there\'s nothing to show.', descHe: 'כשמשהו משתבש, אין מה להראות.' },
  ]

  return (
    <section ref={ref as any} className="relative bg-cream section-padding overflow-hidden">
      <div className="max-w-6xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left — text */}
          <div
            style={{
              opacity: visible ? 1 : 0,
              transform: visible ? 'translateY(0)' : 'translateY(30px)',
              transition: 'all 0.7s ease-out',
            }}
          >
            <span className="text-[11px] font-semibold tracking-widest uppercase text-[#fe5b25]">
              The Problem
            </span>
            <h2
              className="text-3xl md:text-4xl lg:text-[42px] lg:leading-[1.12] font-bold text-dark mt-4"
              style={{ letterSpacing: '-0.04em' }}
            >
              Passing jobs on WhatsApp
              <br />
              <span className="text-[#fe5b25]">is risky business.</span>
            </h2>
            <p className="text-dark/50 text-base md:text-lg leading-relaxed max-w-md mt-5">
              Every day, contractors forward jobs through WhatsApp groups. No verification. No tracking.
              No way to know if the person on the other end is reliable.
            </p>
          </div>

          {/* Right — problem cards */}
          <div className="flex flex-col gap-4">
            {problems.map((p, i) => {
              const Icon = p.icon
              return (
                <div
                  key={p.title}
                  className="flex items-start gap-4 bg-white/70 rounded-2xl p-5 border border-stone-200/60"
                  style={{
                    opacity: visible ? 1 : 0,
                    transform: visible ? 'translateX(0)' : 'translateX(30px)',
                    transition: `all 0.5s ease-out ${200 + i * 150}ms`,
                  }}
                >
                  <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-5 h-5 text-red-500" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-dark">{p.title}</h3>
                    <p className="text-sm text-dark/45 mt-1">{p.desc}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}

/* ══════════════════════════════════════════════════
   SECTION 2 — Transfer Process
   ══════════════════════════════════════════════════ */
export function SecureProcessSection() {
  const { ref, visible } = useInView()

  const steps = [
    { icon: Send, title: 'Post the Job', desc: 'Describe the job and send it to your network — or let Rebeca find the right contractor.', color: '#fe5b25' },
    { icon: CheckCircle, title: 'Contractor Accepts', desc: 'A verified contractor accepts the job. Both sides see all details in the dashboard.', color: '#3b82f6' },
    { icon: Handshake, title: 'Job Gets Done', desc: 'The contractor completes the work. Status updates in real time for both parties.', color: '#10b981' },
    { icon: CreditCard, title: 'Get Paid', desc: 'Payment tracked automatically. Commission credited to your wallet.', color: '#8b5cf6' },
  ]

  return (
    <section ref={ref as any} className="relative bg-cream section-padding overflow-hidden">
      <div className="max-w-5xl mx-auto px-6">
        <div
          className="text-center mb-12"
          style={{
            opacity: visible ? 1 : 0,
            transform: visible ? 'translateY(0)' : 'translateY(20px)',
            transition: 'all 0.6s ease-out',
          }}
        >
          <span className="text-[11px] font-semibold tracking-widest uppercase text-[#fe5b25]">
            How It Works
          </span>
          <h2
            className="text-3xl md:text-4xl font-bold text-dark mt-4"
            style={{ letterSpacing: '-0.04em' }}
          >
            From offer to payment — <span className="text-[#fe5b25]">tracked end to end.</span>
          </h2>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((step, i) => {
            const Icon = step.icon
            return (
              <div
                key={step.title}
                className="relative flex flex-col items-center text-center bg-white/70 rounded-2xl p-6 border border-stone-200/60"
                style={{
                  opacity: visible ? 1 : 0,
                  transform: visible ? 'translateY(0)' : 'translateY(24px)',
                  transition: `all 0.5s ease-out ${200 + i * 120}ms`,
                }}
              >
                {/* Step number */}
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-white border-2 flex items-center justify-center text-[10px] font-bold" style={{ borderColor: step.color, color: step.color }}>
                  {i + 1}
                </div>
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 mt-2" style={{ background: `${step.color}12` }}>
                  <Icon className="w-6 h-6" style={{ color: step.color }} />
                </div>
                <h3 className="text-base font-bold text-dark mb-2">{step.title}</h3>
                <p className="text-sm text-dark/45 leading-relaxed">{step.desc}</p>
                {/* Connector arrow */}
                {i < steps.length - 1 && (
                  <div className="hidden lg:block absolute -right-3 top-1/2 -translate-y-1/2 z-10">
                    <ChevronRight className="w-5 h-5 text-stone-300" />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

/* ══════════════════════════════════════════════════
   SECTION 3 — Contractor Verification
   ══════════════════════════════════════════════════ */
export function SecureVerificationSection() {
  const { ref, visible } = useInView()

  const features = [
    { icon: UserCheck, title: 'Identity Verified', desc: 'Every contractor confirms their license and business info before joining.' },
    { icon: Star, title: 'Ratings & Reviews', desc: 'See what other contractors say. Real ratings from real jobs.' },
    { icon: BadgeCheck, title: 'Trust Tiers', desc: 'Bronze, Silver, Gold — earn your tier through completed jobs and positive reviews.' },
    { icon: Clock, title: 'Job History', desc: 'Full track record: completed jobs, response time, reliability score.' },
  ]

  return (
    <section ref={ref as any} className="relative bg-cream section-padding overflow-hidden">
      <div className="max-w-6xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left — mock profile card */}
          <div
            className="relative"
            style={{
              opacity: visible ? 1 : 0,
              transform: visible ? 'scale(1)' : 'scale(0.95)',
              transition: 'all 0.7s ease-out',
            }}
          >
            <div className="bg-white rounded-2xl p-6 border border-stone-200/60 shadow-xl shadow-black/5">
              {/* Profile header */}
              <div className="flex items-center gap-4 mb-5">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#3b82f6] to-[#2563eb] flex items-center justify-center text-white text-lg font-bold">
                  CR
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-dark">Carlos Rivera</h3>
                    <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center">
                      <ShieldCheck className="w-3 h-3 text-emerald-500" />
                    </div>
                  </div>
                  <p className="text-sm text-dark/45">HVAC Specialist · Miami-Dade</p>
                </div>
              </div>
              {/* Stats row */}
              <div className="grid grid-cols-4 gap-3 mb-5">
                {[
                  { label: 'Jobs', val: '47' },
                  { label: 'Rating', val: '4.9' },
                  { label: 'Response', val: '<2m' },
                  { label: 'Tier', val: '🥇' },
                ].map((s) => (
                  <div key={s.label} className="text-center bg-stone-50 rounded-xl py-3">
                    <div className="text-lg font-extrabold text-dark">{s.val}</div>
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-dark/35">{s.label}</div>
                  </div>
                ))}
              </div>
              {/* Trust badges */}
              <div className="flex flex-wrap gap-2">
                {['Licensed', 'Insured', 'Background Check', 'Gold Tier'].map((badge) => (
                  <span key={badge} className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-600 text-[11px] font-semibold">
                    {badge}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Right — feature list */}
          <div
            style={{
              opacity: visible ? 1 : 0,
              transform: visible ? 'translateY(0)' : 'translateY(30px)',
              transition: 'all 0.7s ease-out 200ms',
            }}
          >
            <span className="text-[11px] font-semibold tracking-widest uppercase text-[#fe5b25]">
              Trust & Verification
            </span>
            <h2
              className="text-3xl md:text-4xl lg:text-[42px] lg:leading-[1.12] font-bold text-dark mt-4"
              style={{ letterSpacing: '-0.04em' }}
            >
              Know who you're
              <br />
              <span className="text-[#fe5b25]">working with.</span>
            </h2>
            <div className="flex flex-col gap-4 mt-8">
              {features.map((f, i) => {
                const Icon = f.icon
                return (
                  <div key={f.title} className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-[#fe5b25]/8 flex items-center justify-center flex-shrink-0">
                      <Icon className="w-5 h-5 text-[#fe5b25]" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-dark">{f.title}</h3>
                      <p className="text-sm text-dark/45 mt-1">{f.desc}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ══════════════════════════════════════════════════
   SECTION 4 — Status Tracking
   ══════════════════════════════════════════════════ */
export function SecureTrackingSection() {
  const { ref, visible } = useInView()

  const statuses = [
    { label: 'Job Posted', time: '2:15 PM', color: '#fe5b25', done: true },
    { label: 'Contractor Accepted', time: '2:18 PM', color: '#3b82f6', done: true },
    { label: 'Work In Progress', time: '3:00 PM', color: '#f59e0b', done: true },
    { label: 'Job Completed', time: '5:45 PM', color: '#10b981', done: true },
    { label: 'Payment Sent', time: '5:46 PM', color: '#8b5cf6', done: false },
  ]

  return (
    <section ref={ref as any} className="relative bg-cream section-padding overflow-hidden">
      <div className="max-w-6xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left — text */}
          <div
            style={{
              opacity: visible ? 1 : 0,
              transform: visible ? 'translateY(0)' : 'translateY(30px)',
              transition: 'all 0.7s ease-out',
            }}
          >
            <span className="text-[11px] font-semibold tracking-widest uppercase text-[#fe5b25]">
              Real-Time Tracking
            </span>
            <h2
              className="text-3xl md:text-4xl lg:text-[42px] lg:leading-[1.12] font-bold text-dark mt-4"
              style={{ letterSpacing: '-0.04em' }}
            >
              Both sides see
              <br />
              <span className="text-[#fe5b25]">exactly what's happening.</span>
            </h2>
            <p className="text-dark/50 text-base md:text-lg leading-relaxed max-w-md mt-5">
              From the moment a job is posted to when payment is sent — every step is tracked.
              No more "did you get the job?" messages. No more guessing.
            </p>
          </div>

          {/* Right — timeline */}
          <div
            className="bg-white rounded-2xl p-6 border border-stone-200/60 shadow-xl shadow-black/5"
            style={{
              opacity: visible ? 1 : 0,
              transform: visible ? 'scale(1)' : 'scale(0.95)',
              transition: 'all 0.7s ease-out 200ms',
            }}
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 rounded-lg bg-[#fe5b25]/10 flex items-center justify-center">
                <BarChart3 className="w-4 h-4 text-[#fe5b25]" />
              </div>
              <div>
                <div className="text-sm font-bold text-dark">AC Install — Fort Lauderdale</div>
                <div className="text-xs text-dark/40">Job #1847 · $2,400</div>
              </div>
            </div>

            <div className="flex flex-col gap-0">
              {statuses.map((s, i) => (
                <div key={s.label} className="flex items-start gap-4"
                  style={{
                    opacity: visible ? 1 : 0,
                    transform: visible ? 'translateX(0)' : 'translateX(-20px)',
                    transition: `all 0.4s ease-out ${400 + i * 150}ms`,
                  }}
                >
                  {/* Timeline dot + line */}
                  <div className="flex flex-col items-center">
                    <div
                      className="w-3 h-3 rounded-full border-2 flex-shrink-0"
                      style={{
                        borderColor: s.color,
                        background: s.done ? s.color : 'white',
                      }}
                    />
                    {i < statuses.length - 1 && (
                      <div className="w-0.5 h-10 bg-stone-200 my-1" />
                    )}
                  </div>
                  {/* Content */}
                  <div className={`pb-4 ${i === statuses.length - 1 ? '' : ''}`}>
                    <div className="text-sm font-bold text-dark">{s.label}</div>
                    <div className="text-xs text-dark/40">{s.time}</div>
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
