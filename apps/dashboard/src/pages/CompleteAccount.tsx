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
  const [sub, setSub] = useState<{ status: string; plan_name: string; trial_end?: string } | null>(null)

  useEffect(() => {
    if (!profile?.id) return
    loadData()
  }, [profile?.id])

  async function loadData() {
    const [contRes, subRes] = await Promise.all([
      supabase.from('contractors').select('professions, zip_codes, working_days').eq('user_id', profile!.id).maybeSingle(),
      supabase.from('subscriptions').select('status, trial_end, plans!inner(name)').eq('user_id', profile!.id).in('status', ['active', 'trialing']).maybeSingle(),
    ])
    if (contRes.data) setContractor(contRes.data)
    if (subRes.data) {
      const planData = subRes.data.plans as unknown
      const planName = planData ? (Array.isArray(planData) ? (planData[0] as { name: string })?.name : (planData as { name: string })?.name) : 'Free Trial'
      setSub({ status: subRes.data.status, plan_name: planName, trial_end: subRes.data.trial_end })
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email || !password) {
      setError('Please fill in both email and password')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    setLoading(true)
    setError('')

    const { error: updateErr } = await supabase.auth.updateUser({
      email,
      password,
    })

    if (updateErr) {
      setError(updateErr.message)
      setLoading(false)
      return
    }

    // Update profile with email
    await supabase.from('profiles').update({ email }).eq('id', profile!.id)

    setSuccess(true)
    setLoading(false)

    setTimeout(() => navigate('/'), 2000)
  }

  const firstName = profile?.full_name?.split(' ')[0] || 'there'
  const trialDaysLeft = sub?.trial_end
    ? Math.max(0, Math.ceil((new Date(sub.trial_end).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 7

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        background: 'linear-gradient(135deg, #0a0a1a 0%, #12122a 50%, #0a0a1a 100%)',
        fontFamily: "'Plus Jakarta Sans', sans-serif",
      }}
    >
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-green-500/10 border border-green-500/20 mb-4">
            <CheckCircle className="w-4 h-4 text-green-400" />
            <span className="text-green-400 text-sm font-medium">
              {sub?.status === 'trialing' ? `Free Trial — ${trialDaysLeft} days left` : 'Account Active'}
            </span>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">
            Welcome, {firstName}! 🎉
          </h1>
          <p className="text-slate-400 text-sm">
            Your profile is set up. Add email & password so you can log in anytime.
          </p>
        </div>

        {/* Collected Info Card */}
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-5 mb-6">
          <h3 className="text-white/60 text-xs font-semibold uppercase tracking-wider mb-4">Your Profile</h3>

          <div className="space-y-3">
            {/* Name */}
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <User className="w-4 h-4 text-purple-400" />
              </div>
              <div>
                <p className="text-white/40 text-xs">Name</p>
                <p className="text-white text-sm font-medium">{profile?.full_name || '—'}</p>
              </div>
              <CheckCircle className="w-4 h-4 text-green-500 ml-auto" />
            </div>

            {/* Trades */}
            {contractor?.professions && contractor.professions.length > 0 && (
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center">
                  <Briefcase className="w-4 h-4 text-orange-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white/40 text-xs">Trades</p>
                  <p className="text-white text-sm font-medium truncate">
                    {contractor.professions.map(p => PROF_LABELS[p] || p).join(', ')}
                  </p>
                </div>
                <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
              </div>
            )}

            {/* Areas */}
            {contractor?.zip_codes && contractor.zip_codes.length > 0 && (
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <MapPin className="w-4 h-4 text-blue-400" />
                </div>
                <div>
                  <p className="text-white/40 text-xs">Service Areas</p>
                  <p className="text-white text-sm font-medium">{contractor.zip_codes.length} ZIP codes</p>
                </div>
                <CheckCircle className="w-4 h-4 text-green-500 ml-auto" />
              </div>
            )}

            {/* Working Days */}
            {contractor?.working_days && contractor.working_days.length > 0 && (
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                  <Calendar className="w-4 h-4 text-cyan-400" />
                </div>
                <div>
                  <p className="text-white/40 text-xs">Working Days</p>
                  <p className="text-white text-sm font-medium">
                    {contractor.working_days.map(d => DAY_NAMES[d]).join(', ')}
                  </p>
                </div>
                <CheckCircle className="w-4 h-4 text-green-500 ml-auto" />
              </div>
            )}

            {/* Email — missing */}
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-yellow-500/10 flex items-center justify-center">
                <Mail className="w-4 h-4 text-yellow-400" />
              </div>
              <div>
                <p className="text-white/40 text-xs">Email</p>
                <p className="text-yellow-400 text-sm font-medium">Not set yet</p>
              </div>
              <div className="ml-auto px-2 py-0.5 rounded bg-yellow-500/10 text-yellow-400 text-xs font-medium">
                Required
              </div>
            </div>

            {/* Password — missing */}
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-yellow-500/10 flex items-center justify-center">
                <Lock className="w-4 h-4 text-yellow-400" />
              </div>
              <div>
                <p className="text-white/40 text-xs">Password</p>
                <p className="text-yellow-400 text-sm font-medium">Not set yet</p>
              </div>
              <div className="ml-auto px-2 py-0.5 rounded bg-yellow-500/10 text-yellow-400 text-xs font-medium">
                Required
              </div>
            </div>
          </div>
        </div>

        {/* Form */}
        {success ? (
          <div className="rounded-2xl border border-green-500/20 bg-green-500/5 p-6 text-center">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
            <p className="text-white font-semibold text-lg">Account Complete!</p>
            <p className="text-slate-400 text-sm mt-1">Redirecting to your dashboard...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-white/60 text-xs font-medium block mb-1.5">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="text-white/60 text-xs font-medium block mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20 transition-all"
                />
              </div>
            </div>

            {error && (
              <p className="text-red-400 text-sm text-center">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 transition-all hover:brightness-110 disabled:opacity-50"
              style={{
                background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)',
                boxShadow: '0 0 20px rgba(139, 92, 246, 0.3)',
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
              className="w-full py-2.5 text-sm text-slate-500 hover:text-slate-300 transition-colors"
            >
              Skip for now — use WhatsApp login
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
