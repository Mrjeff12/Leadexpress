import { useState } from 'react'
import { Mail, Lock, Loader2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { useI18n } from '../../lib/i18n'

interface Props {
  onComplete: () => void
}

export default function CredentialsStep({ onComplete }: Props) {
  const { locale } = useI18n()
  const he = locale === 'he'
  const { user } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  const canSubmit = emailOk && password.length >= 6 && !saving

  async function handleGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/onboarding` },
    })
  }

  async function handleApple() {
    await supabase.auth.signInWithOAuth({
      provider: 'apple',
      options: { redirectTo: `${window.location.origin}/onboarding` },
    })
  }

  async function handleEmailSubmit() {
    if (!canSubmit || !user) return
    setSaving(true)
    setError('')
    try {
      const { data, error: fnErr } = await supabase.functions.invoke(
        'update-account',
        { body: { email, password } },
      )
      if (fnErr || data?.error) {
        setError(data?.error || fnErr?.message || 'Failed to update account')
        setSaving(false)
        return
      }
      await supabase.from('profiles').update({ email }).eq('id', user.id)
      await supabase.auth.signInWithPassword({ email, password }).catch(() => {})
      await supabase
        .from('contractors')
        .update({ onboarding_step: 'credentials_set' })
        .eq('user_id', user.id)
      setSaving(false)
      onComplete()
    } catch {
      setError('Something went wrong. Please try again.')
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="text-center">
        <h1 className="text-base md:text-lg font-bold text-zinc-900">
          {he ? 'הגדר כניסה לחשבון' : 'Create your login'}
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          {he
            ? 'הגדר אימייל וסיסמא לכניסה לחשבון שלך'
            : 'Set your email and password to access your account'}
        </p>
      </div>

      {/* Social buttons */}
      <div className="max-w-sm mx-auto grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={handleGoogle}
          className="flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-zinc-200 bg-white text-sm font-semibold text-zinc-700 hover:bg-zinc-50 transition-colors"
        >
          <span className="text-base">🔵</span>
          Google
        </button>
        <button
          type="button"
          onClick={handleApple}
          className="flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-zinc-200 bg-white text-sm font-semibold text-zinc-700 hover:bg-zinc-50 transition-colors"
        >
          <span className="text-base">🍎</span>
          Apple
        </button>
      </div>

      <div className="max-w-sm mx-auto flex items-center gap-3">
        <div className="h-px flex-1 bg-zinc-200" />
        <span className="text-xs text-zinc-400 uppercase">
          {he ? 'או' : 'or'}
        </span>
        <div className="h-px flex-1 bg-zinc-200" />
      </div>

      {/* Email + password form */}
      <div className="max-w-sm mx-auto space-y-4">
        <div>
          <label className="block text-sm font-semibold text-zinc-700 mb-1.5">
            {he ? 'אימייל' : 'Email'}
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                setError('')
              }}
              placeholder="you@example.com"
              className="w-full pl-10 pr-4 py-3 rounded-xl border-2 border-zinc-200 bg-white text-sm text-zinc-800 placeholder:text-zinc-300 outline-none focus:border-[#fe5b25] transition-colors"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-zinc-700 mb-1.5">
            {he ? 'סיסמא' : 'Password'}
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                setError('')
              }}
              placeholder={he ? 'לפחות 6 תווים' : 'At least 6 characters'}
              className="w-full pl-10 pr-4 py-3 rounded-xl border-2 border-zinc-200 bg-white text-sm text-zinc-800 placeholder:text-zinc-300 outline-none focus:border-[#fe5b25] transition-colors"
            />
          </div>
        </div>

        {error && (
          <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600 text-center">
            {error}
          </div>
        )}

        <button
          type="button"
          disabled={!canSubmit}
          onClick={handleEmailSubmit}
          className="w-full py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-40 transition-all shadow-md shadow-[#fe5b25]/20"
          style={{ background: 'linear-gradient(135deg, #fe5b25, #e04d1c)' }}
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin mx-auto" />
          ) : (
            he ? 'המשך' : 'Continue'
          )}
        </button>
      </div>
    </div>
  )
}
