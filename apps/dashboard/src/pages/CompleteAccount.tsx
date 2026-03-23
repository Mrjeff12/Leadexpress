import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { CheckCircle, Mail, Lock, User, MapPin, Briefcase, Calendar, Loader2, ArrowRight } from 'lucide-react'

const PROF_LABELS: Record<string, string> = {
  hvac: '❄️ HVAC', renovation: '🔨 Renovation', fencing: '🧱 Fencing',
  cleaning: '✨ Cleaning', locksmith: '🔑 Locksmith', plumbing: '🚰 Plumbing',
  electrical: '⚡ Electrical', painting: '🎨 Painting', roofing: '🏠 Roofing',
  flooring: '🪵 Flooring', air_duct: '💨 Air Duct', other: '📋 Other',
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function CompleteAccount() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
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

    // Use Edge Function to update via admin API (bypasses fake email validation)
    const { data: fnData, error: fnError } = await supabase.functions.invoke('update-account', {
      body: { email, password },
    })

    if (fnError || fnData?.error) {
      setError(fnData?.error || fnError?.message || 'Failed to update account')
      setLoading(false)
      return
    }

    // Update profile table
    await supabase.from('profiles').update({ email }).eq('id', profile!.id)

    // Re-sign in with new credentials
    await supabase.auth.signInWithPassword({ email, password })

    setSuccess(true)
    setLoading(false)

    setTimeout(() => navigate('/'), 2000)
  }

  const firstName = profile?.full_name?.split(' ')[0] || 'there'
  const trialDaysLeft = sub?.current_period_end
    ? Math.max(0, Math.ceil((new Date(sub.current_period_end).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 7

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 relative overflow-hidden">
      {/* Light background matching Login page */}
      <div className="fixed inset-0 bg-gradient-to-br from-slate-50 via-gray-50 to-orange-50/30" />
      <div className="fixed inset-0 opacity-[0.015]" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.5'/%3E%3C/svg%3E")`,
        backgroundRepeat: 'repeat',
        backgroundSize: '256px',
      }} />

      <div className="relative z-10 w-full max-w-lg">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2.5 mb-6">
          <img src="/icon.png" alt="Lead Express" className="w-9 h-9 rounded-xl shadow-md shadow-orange-200/50" />
          <span className="text-lg font-semibold tracking-tight text-gray-900">Lead Express</span>
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
            Welcome, {firstName}! 🎉
          </h1>
          <p className="text-gray-500 text-sm">
            Your profile is set up. Add email & password so you can log in anytime.
          </p>
        </div>

        {/* Glass Card — Collected Info */}
        <div className="rounded-2xl border border-white/60 bg-white/70 backdrop-blur-2xl shadow-[0_8px_60px_-12px_rgba(0,0,0,0.08)] p-5 sm:p-6 mb-5">
          <h3 className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-4">Your Profile</h3>

          <div className="space-y-3">
            {/* Name */}
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

            {/* Trades */}
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

            {/* Areas — show counties if available, otherwise ZIP count */}
            {(counties.length > 0 || (contractor?.zip_codes && contractor.zip_codes.length > 0)) && (
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                  <MapPin className="w-4 h-4 text-blue-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-gray-400 text-xs">Service Areas</p>
                  <p className="text-gray-900 text-sm font-medium truncate">
                    {counties.length > 0
                      ? counties.join(', ')
                      : `${contractor!.zip_codes.length} ZIP codes`}
                  </p>
                </div>
                <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
              </div>
            )}

            {/* Working Days */}
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

            {/* Email — missing */}
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

            {/* Password — missing */}
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
        {success ? (
          <div className="rounded-2xl border border-green-200 bg-green-50 p-6 text-center">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
            <p className="text-gray-900 font-semibold text-lg">Account Complete!</p>
            <p className="text-gray-500 text-sm mt-1">Redirecting to your dashboard...</p>
          </div>
        ) : (
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
              style={{
                background: 'linear-gradient(135deg, #fe5b25, #e04d1f)',
              }}
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  Complete Setup
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => navigate('/')}
              className="w-full py-2.5 text-sm text-gray-400 hover:text-gray-600 transition-colors"
            >
              Skip for now — use WhatsApp login
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
