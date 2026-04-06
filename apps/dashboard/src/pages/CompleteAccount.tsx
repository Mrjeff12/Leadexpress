import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import OnboardingProgress from '../components/OnboardingProgress'
import { CheckCircle, Mail, Lock, User, MapPin, Briefcase, Calendar, Loader2, ArrowRight } from 'lucide-react'

const PROF_LABELS: Record<string, string> = {
  hvac: '❄️ HVAC', renovation: '🔨 Renovation', fencing: '🧱 Fencing',
  cleaning: '✨ Cleaning', locksmith: '🔑 Locksmith', plumbing: '🚰 Plumbing',
  electrical: '⚡ Electrical', painting: '🎨 Painting', roofing: '🏠 Roofing',
  flooring: '🪵 Flooring', air_duct: '💨 Air Duct', chimney: '🧹 Chimney',
  garage: '🚪 Garage Doors', windows: '🪟 Windows & Doors',
  landscaping: '🌳 Landscaping', other: '📋 Other',
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

type Step = 'form' | 'done'

export default function CompleteAccount() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>('form')
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
    // Guard: if user already set credentials or linked OAuth, redirect to dashboard
    supabase.auth.getUser().then(({ data: authData }) => {
      const hasOAuth = authData?.user?.app_metadata?.provider && authData.user.app_metadata.provider !== 'email'
      if (hasOAuth) {
        // OAuth user — mark as complete and redirect
        supabase.from('contractors').update({ onboarding_step: 'credentials_set' }).eq('user_id', profile.id).then(() => {})
        navigate('/', { replace: true })
        return
      }
    })
    supabase.from('contractors').select('onboarding_step').eq('user_id', profile.id).maybeSingle()
      .then(({ data }) => {
        if (data?.onboarding_step && data.onboarding_step !== 'registered') {
          navigate('/', { replace: true })
          return
        }
      })
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

      // Update onboarding step (await to ensure DB is consistent before redirect)
      await supabase.from('contractors').update({ onboarding_step: 'credentials_set' }).eq('user_id', profile!.id)

      setLoading(false)
      setStep('done')
      setTimeout(() => navigate('/', { replace: true }), 1500)
    } catch (err) {
      console.error('handleSubmit error:', err)
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

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

      <div className="relative z-10 w-full max-w-lg px-4 md:px-0">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2.5 mb-6">
          <img src="/icon.png" alt="MasterLeadFlow" className="w-9 h-9 rounded-xl shadow-md shadow-orange-200/50" />
          <span className="text-lg font-semibold tracking-tight text-gray-900">MasterLeadFlow</span>
        </div>

        {/* Header */}
        <div className="text-center mb-6">
          {step === 'form' ? (
            <>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-red-50 border border-red-200 mb-4 shadow-sm">
                <span className="text-lg">⚠️</span>
                <span className="text-red-600 text-sm font-bold">Action Required</span>
              </div>
              <h1 className="text-xl md:text-2xl font-bold text-gray-900 tracking-tight mb-2">
                Complete your account to get leads
              </h1>
              <p className="text-gray-500 text-sm leading-relaxed">
                You <strong className="text-gray-700">must set your email and password</strong> to receive leads and access your account next time.
              </p>
            </>
          ) : (
            <>
              <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 mb-4 shadow-sm">
                <span className="text-2xl">🎉</span>
                <span className="text-green-700 text-base font-bold">You're all set!</span>
              </div>
              <h1 className="text-xl font-bold text-gray-900 tracking-tight mb-2">Account Complete 🚀</h1>
              <p className="text-gray-500 text-sm">Redirecting to your dashboard...</p>
            </>
          )}
        </div>

        {/* Step indicator */}
        {step !== 'done' && <OnboardingProgress current={1} />}

        {/* ─── Email/Password Form ─── */}
        {step === 'form' && (
          <>
            {/* Glass Card — Collected Info */}
            <div className="rounded-2xl border border-white/60 bg-white/70 backdrop-blur-2xl shadow-[0_8px_60px_-12px_rgba(0,0,0,0.08)] p-4 md:p-5 sm:p-6 mb-5">
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
            <form onSubmit={handleSubmit} className="rounded-2xl border border-white/60 bg-white/70 backdrop-blur-2xl shadow-[0_4px_30px_-8px_rgba(0,0,0,0.06)] p-4 md:p-5 sm:p-6 space-y-4">
              {/* Social Login */}
              <div className="space-y-2.5">
                <button
                  type="button"
                  onClick={async () => {
                    setError('')
                    const { error: oauthError } = await supabase.auth.signInWithOAuth({
                      provider: 'google',
                      options: { redirectTo: window.location.origin },
                    })
                    if (oauthError) setError(oauthError.message)
                    else {
                      // Mark onboarding step (will complete on redirect back)
                      supabase.from('contractors').update({ onboarding_step: 'credentials_set' }).eq('user_id', profile!.id).then(() => {})
                    }
                  }}
                  className="w-full flex items-center justify-center gap-2.5 py-2.5 rounded-xl border border-gray-200/80 bg-white hover:bg-gray-50 text-gray-700 text-sm font-medium transition-all shadow-sm hover:shadow active:scale-[0.98]"
                >
                  <svg width="18" height="18" viewBox="0 0 48 48">
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                    <path fill="#FBBC05" d="M10.53 28.59a14.5 14.5 0 0 1 0-9.18l-7.98-6.19a24.0 24.0 0 0 0 0 21.56l7.98-6.19z"/>
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                  </svg>
                  Continue with Google
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    setError('')
                    const { error: oauthError } = await supabase.auth.signInWithOAuth({
                      provider: 'apple',
                      options: { redirectTo: window.location.origin },
                    })
                    if (oauthError) setError(oauthError.message)
                    else {
                      supabase.from('contractors').update({ onboarding_step: 'credentials_set' }).eq('user_id', profile!.id).then(() => {})
                    }
                  }}
                  className="w-full flex items-center justify-center gap-2.5 py-2.5 rounded-xl border border-gray-900 bg-gray-900 hover:bg-black text-white text-sm font-medium transition-all shadow-sm hover:shadow active:scale-[0.98]"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                  </svg>
                  Continue with Apple
                </button>

                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-gray-200/80" />
                  <span className="text-xs text-gray-400 whitespace-nowrap">or continue with email</span>
                  <div className="flex-1 h-px bg-gray-200/80" />
                </div>
              </div>

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
                className="w-full py-3.5 rounded-2xl text-[15px] font-bold text-white flex items-center justify-center gap-2 active:scale-[0.97] transition-transform disabled:opacity-50 shadow-lg shadow-orange-300/40"
                style={{ background: 'linear-gradient(135deg, #fe5b25, #e04d1f)' }}
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><span>Complete My Account</span><ArrowRight className="w-4 h-4" /></>}
              </button>

              <p className="text-center text-[11px] text-gray-400 pt-1">
                🔒 Required to receive leads and log back in
              </p>
            </form>
          </>
        )}

        {/* ─── Done ─── */}
        {step === 'done' && (
          <div className="rounded-2xl border border-green-200 bg-green-50 p-6 text-center">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
            <p className="text-gray-900 font-semibold text-lg">You're all set!</p>
            <p className="text-gray-500 text-sm mt-1">Redirecting to install...</p>
          </div>
        )}
      </div>
    </div>
  )
}
