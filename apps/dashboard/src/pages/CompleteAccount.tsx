import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { usePushNotifications } from '../hooks/usePushNotifications'
import { CheckCircle, Mail, Lock, User, MapPin, Briefcase, Calendar, Loader2, ArrowRight, Bell, BellRing, Smartphone } from 'lucide-react'

const PROF_LABELS: Record<string, string> = {
  hvac: '❄️ HVAC', renovation: '🔨 Renovation', fencing: '🧱 Fencing',
  cleaning: '✨ Cleaning', locksmith: '🔑 Locksmith', plumbing: '🚰 Plumbing',
  electrical: '⚡ Electrical', painting: '🎨 Painting', roofing: '🏠 Roofing',
  flooring: '🪵 Flooring', air_duct: '💨 Air Duct', chimney: '🧹 Chimney',
  garage: '🚪 Garage Doors', windows: '🪟 Windows & Doors',
  landscaping: '🌳 Landscaping', other: '📋 Other',
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

type Step = 'install' | 'form' | 'notifications' | 'done'

function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches
    || ('standalone' in navigator && (navigator as any).standalone === true)
}

function isMobile(): boolean {
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
}

export default function CompleteAccount() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const { status: pushStatus, enable: enablePush, isLoading: pushLoading } = usePushNotifications()
  // On mobile, if not running as PWA, show install step first
  const [step, setStep] = useState<Step>(() => {
    if (isMobile() && !isStandalone()) return 'install'
    return 'form'
  })
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [contractor, setContractor] = useState<{
    professions: string[]
    zip_codes: string[]
    working_days: number[]
  } | null>(null)
  const [counties, setCounties] = useState<string[]>([])
  const [sub, setSub] = useState<{ status: string; plan_name: string; current_period_end?: string } | null>(null)

  useEffect(() => {
    if (!profile?.id) return
    loadData()
  }, [profile?.id])

  async function loadData() {
    const [contRes, subRes, profileRes] = await Promise.all([
      supabase.from('contractors').select('professions, zip_codes, working_days').eq('user_id', profile!.id).maybeSingle(),
      supabase.from('subscriptions').select('status, current_period_end, plans!inner(name)').eq('user_id', profile!.id).in('status', ['active', 'trialing']).maybeSingle(),
      supabase.from('profiles').select('counties').eq('id', profile!.id).maybeSingle(),
    ])
    if (contRes.data) setContractor(contRes.data)
    if (profileRes.data?.counties) setCounties(profileRes.data.counties)
    if (subRes.data) {
      const planData = subRes.data.plans as unknown
      const planName = planData ? (Array.isArray(planData) ? (planData[0] as { name: string })?.name : (planData as { name: string })?.name) : 'Free Trial'
      setSub({ status: subRes.data.status, plan_name: planName, current_period_end: subRes.data.current_period_end })
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email || !password) {
      setError('Please fill in both email and password')
      return
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    setLoading(true)
    setError('')

    try {
      const { data: fnData, error: fnError } = await supabase.functions.invoke('update-account', {
        body: { email, password },
      })

      if (fnError || fnData?.error) {
        setError(fnData?.error || fnError?.message || 'Failed to update account')
        setLoading(false)
        return
      }

      // Update the profile email (don't await — non-critical)
      supabase.from('profiles').update({ email }).eq('id', profile!.id).then(() => {})

      // Sign in with new credentials
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
      if (signInError) {
        console.warn('SignIn after update failed (non-critical):', signInError.message)
        // Non-critical: user is already authenticated, proceed anyway
      }

      setLoading(false)

      // Move to notifications step instead of redirecting immediately
      if (pushStatus === 'default') {
        setStep('notifications')
      } else {
        setStep('done')
        setTimeout(() => navigate('/'), 1500)
      }
    } catch (err) {
      console.error('handleSubmit error:', err)
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  async function handleEnableNotifications() {
    await enablePush()
    setStep('done')
    setTimeout(() => navigate('/'), 1500)
  }

  function handleSkipNotifications() {
    setStep('done')
    setTimeout(() => navigate('/'), 1500)
  }

  const firstName = profile?.full_name?.split(' ')[0] || 'there'
  const trialDaysLeft = sub?.current_period_end
    ? Math.max(0, Math.ceil((new Date(sub.current_period_end).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 7

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 relative overflow-hidden">
      {/* Light background */}
      <div className="fixed inset-0 bg-gradient-to-br from-slate-50 via-gray-50 to-orange-50/30" />
      <div className="fixed inset-0 opacity-[0.015]" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.5'/%3E%3C/svg%3E")`,
        backgroundRepeat: 'repeat',
        backgroundSize: '256px',
      }} />

      <div className="relative z-10 w-full max-w-lg">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2.5 mb-6">
          <img src="/icon.png" alt="MasterLeadFlow" className="w-9 h-9 rounded-xl shadow-md shadow-orange-200/50" />
          <span className="text-lg font-semibold tracking-tight text-gray-900">MasterLeadFlow</span>
        </div>

        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 mb-4 shadow-sm">
            <span className="text-2xl">🎁</span>
            <span className="text-green-700 text-base font-bold">
              {sub?.status === 'trialing' ? `Free Trial — ${trialDaysLeft} days left!` : 'Account Active'}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight mb-2">
            {step === 'install' && `Welcome, ${firstName}! 📱`}
            {step === 'form' && `Welcome, ${firstName}! 🎉`}
            {step === 'notifications' && `Almost there! 🔔`}
            {step === 'done' && `You're all set! 🚀`}
          </h1>
          <p className="text-gray-500 text-sm">
            {step === 'install' && 'Install the app to get instant push notifications for new leads.'}
            {step === 'form' && 'Your profile is set up. Add email & password so you can log in anytime.'}
            {step === 'notifications' && 'Enable notifications to get leads instantly — don\'t miss any job!'}
            {step === 'done' && 'Redirecting to your dashboard...'}
          </p>
        </div>

        {/* Step indicator */}
        {step !== 'done' && (
          <div className="flex items-center justify-center gap-2 mb-6">
            {isMobile() && (
              <>
                <StepPill label="Install" active={step === 'install'} done={step !== 'install'} num={1} />
                <div className="w-4 h-px bg-gray-200" />
              </>
            )}
            <StepPill label="Account" active={step === 'form'} done={step === 'notifications' || step === 'done'} num={isMobile() ? 2 : 1} />
            <div className="w-4 h-px bg-gray-200" />
            <StepPill label="Notifications" active={step === 'notifications'} done={step === 'done'} num={isMobile() ? 3 : 2} />
          </div>
        )}

        {/* ─── Install Step (mobile only) ─── */}
        {step === 'install' && (
          <div className="rounded-2xl border border-white/60 bg-white/70 backdrop-blur-2xl shadow-[0_8px_60px_-12px_rgba(0,0,0,0.08)] p-6 sm:p-8 text-center">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-orange-100 to-amber-50 flex items-center justify-center mx-auto mb-5 shadow-lg shadow-orange-100/50">
              <Smartphone className="w-10 h-10 text-[#fe5b25]" />
            </div>

            <h2 className="text-xl font-bold text-gray-900 mb-2">
              Install for Notifications
            </h2>
            <p className="text-gray-500 text-sm mb-6 max-w-xs mx-auto">
              Add MasterLeadFlow to your home screen so you can receive push notifications for new leads.
            </p>

            <button
              onClick={() => navigate('/install')}
              className="w-full py-3.5 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 transition-all hover:brightness-110 active:scale-[0.98] shadow-lg shadow-orange-200/50 mb-3"
              style={{ background: 'linear-gradient(135deg, #fe5b25, #e04d1f)' }}
            >
              <Smartphone className="w-4 h-4" />
              Install App
            </button>

            <button
              onClick={() => setStep('form')}
              className="w-full py-2.5 text-sm text-gray-400 hover:text-gray-600 transition-colors"
            >
              Skip — I'll install later
            </button>
          </div>
        )}

        {/* ─── Email/Password Form ─── */}
        {step === 'form' && (
          <>
            {/* Glass Card — Collected Info */}
            <div className="rounded-2xl border border-white/60 bg-white/70 backdrop-blur-2xl shadow-[0_8px_60px_-12px_rgba(0,0,0,0.08)] p-5 sm:p-6 mb-5">
              <h3 className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-4">Your Profile</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center">
                    <User className="w-4 h-4 text-[#fe5b25]" />
                  </div>
                  <div>
                    <p className="text-gray-400 text-xs">Name</p>
                    <p className="text-gray-900 text-sm font-medium">{profile?.full_name || '—'}</p>
                  </div>
                  <CheckCircle className="w-4 h-4 text-green-500 ml-auto" />
                </div>

                {contractor?.professions && contractor.professions.length > 0 && (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center">
                      <Briefcase className="w-4 h-4 text-[#fe5b25]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-gray-400 text-xs">Trades</p>
                      <p className="text-gray-900 text-sm font-medium truncate">
                        {contractor.professions.map(p => PROF_LABELS[p] || p).join(', ')}
                      </p>
                    </div>
                    <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                  </div>
                )}

                {(counties.length > 0 || (contractor?.zip_codes && contractor.zip_codes.length > 0)) && (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                      <MapPin className="w-4 h-4 text-blue-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-gray-400 text-xs">Service Areas</p>
                      <p className="text-gray-900 text-sm font-medium truncate">
                        {counties.length > 0 ? counties.join(', ') : `${contractor!.zip_codes.length} ZIP codes`}
                      </p>
                    </div>
                    <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                  </div>
                )}

                {contractor?.working_days && contractor.working_days.length > 0 && (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-cyan-50 flex items-center justify-center">
                      <Calendar className="w-4 h-4 text-cyan-600" />
                    </div>
                    <div>
                      <p className="text-gray-400 text-xs">Working Days</p>
                      <p className="text-gray-900 text-sm font-medium">
                        {contractor.working_days.map(d => DAY_NAMES[d]).join(', ')}
                      </p>
                    </div>
                    <CheckCircle className="w-4 h-4 text-green-500 ml-auto" />
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
                    <Mail className="w-4 h-4 text-amber-500" />
                  </div>
                  <div>
                    <p className="text-gray-400 text-xs">Email</p>
                    <p className="text-amber-600 text-sm font-medium">Not set yet</p>
                  </div>
                  <div className="ml-auto px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-600 text-xs font-medium">
                    Required
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
                    <Lock className="w-4 h-4 text-amber-500" />
                  </div>
                  <div>
                    <p className="text-gray-400 text-xs">Password</p>
                    <p className="text-amber-600 text-sm font-medium">Not set yet</p>
                  </div>
                  <div className="ml-auto px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-600 text-xs font-medium">
                    Required
                  </div>
                </div>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="rounded-2xl border border-white/60 bg-white/70 backdrop-blur-2xl shadow-[0_4px_30px_-8px_rgba(0,0,0,0.06)] p-5 sm:p-6 space-y-4">
              <div>
                <label className="text-gray-600 text-xs font-medium block mb-1.5">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-white border border-gray-200/80 text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:border-[#fe5b25]/50 focus:ring-2 focus:ring-[#fe5b25]/10 transition-all shadow-sm"
                  />
                </div>
              </div>

              <div>
                <label className="text-gray-600 text-xs font-medium block mb-1.5">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-white border border-gray-200/80 text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:border-[#fe5b25]/50 focus:ring-2 focus:ring-[#fe5b25]/10 transition-all shadow-sm"
                  />
                </div>
              </div>

              {error && (
                <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600 text-center">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50 shadow-md shadow-orange-200/50"
                style={{ background: 'linear-gradient(135deg, #fe5b25, #e04d1f)' }}
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><span>Continue</span><ArrowRight className="w-4 h-4" /></>}
              </button>

              <button
                type="button"
                onClick={() => navigate('/')}
                className="w-full py-2.5 text-sm text-gray-400 hover:text-gray-600 transition-colors"
              >
                Skip for now — use WhatsApp login
              </button>
            </form>
          </>
        )}

        {/* ─── Step 2: Enable Notifications ─── */}
        {step === 'notifications' && (
          <div className="rounded-2xl border border-white/60 bg-white/70 backdrop-blur-2xl shadow-[0_8px_60px_-12px_rgba(0,0,0,0.08)] p-6 sm:p-8 text-center">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-orange-100 to-amber-50 flex items-center justify-center mx-auto mb-5 shadow-lg shadow-orange-100/50">
              <BellRing className="w-10 h-10 text-[#fe5b25]" />
            </div>

            <h2 className="text-xl font-bold text-gray-900 mb-2">
              Don't miss any lead!
            </h2>
            <p className="text-gray-500 text-sm mb-6 max-w-xs mx-auto">
              Get instant notifications when a matching job is found — even when this tab is closed.
            </p>

            <div className="space-y-3 mb-6 text-left">
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-green-50/80 border border-green-100">
                <span className="text-lg">⚡</span>
                <span className="text-gray-700 text-sm font-medium">Instant alerts — be first to grab the lead</span>
              </div>
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-blue-50/80 border border-blue-100">
                <span className="text-lg">📱</span>
                <span className="text-gray-700 text-sm font-medium">Works on phone + desktop</span>
              </div>
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-purple-50/80 border border-purple-100">
                <span className="text-lg">🔕</span>
                <span className="text-gray-700 text-sm font-medium">Only relevant jobs — no spam, ever</span>
              </div>
            </div>

            <button
              onClick={handleEnableNotifications}
              disabled={pushLoading}
              className="w-full py-3.5 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50 shadow-lg shadow-orange-200/50 mb-3"
              style={{ background: 'linear-gradient(135deg, #fe5b25, #e04d1f)' }}
            >
              {pushLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Bell className="w-4 h-4" />
                  Enable Notifications
                </>
              )}
            </button>

            <button
              onClick={handleSkipNotifications}
              className="w-full py-2.5 text-sm text-gray-400 hover:text-gray-600 transition-colors"
            >
              Maybe later
            </button>
          </div>
        )}

        {/* ─── Done ─── */}
        {step === 'done' && (
          <div className="rounded-2xl border border-green-200 bg-green-50 p-6 text-center">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
            <p className="text-gray-900 font-semibold text-lg">You're all set!</p>
            <p className="text-gray-500 text-sm mt-1">Redirecting to your dashboard...</p>
          </div>
        )}
      </div>
    </div>
  )
}

function StepPill({ label, active, done, num }: { label: string; active: boolean; done: boolean; num: number }) {
  const cls = active
    ? 'bg-[#fe5b25] text-white shadow-md shadow-orange-200'
    : done
      ? 'bg-green-100 text-green-700'
      : 'bg-gray-100 text-gray-400'

  return (
    <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all ${cls}`}>
      {done && !active ? (
        <CheckCircle className="w-3 h-3" />
      ) : (
        <span className="w-4 h-4 rounded-full bg-white/30 flex items-center justify-center text-[10px]">{num}</span>
      )}
      {label}
    </div>
  )
}
