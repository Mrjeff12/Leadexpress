import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { useI18n } from '../lib/i18n'

type Mode = 'login' | 'signup'

export default function Login() {
  const { signIn, signUp, user, loading: authLoading } = useAuth()
  const { t, locale, setLocale } = useI18n()
  const isRtl = locale === 'he'

  // If already authenticated, redirect to dashboard
  if (!authLoading && user) return <Navigate to="/" replace />

  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const result =
        mode === 'login'
          ? await signIn(email, password)
          : await signUp(email, password, name)

      if (result.error) {
        setError(result.error)
      }
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  function switchMode(next: Mode) {
    setMode(next)
    setError(null)
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 relative"
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      <div className="le-bg" />
      <div className="le-grain" />
      {/* Language toggle */}
      <div className="fixed top-5 right-5 z-50 flex gap-1">
        <button
          onClick={() => setLocale('en')}
          className={`btn-ghost px-3 py-1.5 text-sm rounded-lg transition-all ${
            locale === 'en'
              ? 'bg-white/20 text-[#2D6A4F] font-semibold'
              : 'text-stone-500'
          }`}
        >
          EN
        </button>
        <button
          onClick={() => setLocale('he')}
          className={`btn-ghost px-3 py-1.5 text-sm rounded-lg transition-all ${
            locale === 'he'
              ? 'bg-white/20 text-[#2D6A4F] font-semibold'
              : 'text-stone-500'
          }`}
        >
          HE
        </button>
      </div>

      <div className="w-full max-w-md">
        <div className="glass-panel rounded-2xl p-8 sm:p-10">
          {/* Logo + Brand */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-14 h-14 rounded-xl bg-[#2D6A4F] flex items-center justify-center mb-4 shadow-lg">
              <span className="text-white font-bold text-xl tracking-tight">
                LE
              </span>
            </div>
            <h1 className="text-2xl font-semibold text-stone-800 tracking-tight">
              Lead Express
            </h1>
            <p className="text-stone-500 text-sm mt-1.5">{t('auth.tagline')}</p>
          </div>

          {/* Mode tabs */}
          <div className="flex rounded-xl bg-stone-100/60 p-1 mb-6">
            <button
              type="button"
              onClick={() => switchMode('login')}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                mode === 'login'
                  ? 'bg-white text-stone-800 shadow-sm'
                  : 'text-stone-400 hover:text-stone-600'
              }`}
            >
              {t('auth.login')}
            </button>
            <button
              type="button"
              onClick={() => switchMode('signup')}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                mode === 'signup'
                  ? 'bg-white text-stone-800 shadow-sm'
                  : 'text-stone-400 hover:text-stone-600'
              }`}
            >
              {t('auth.signup')}
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 rounded-lg bg-red-50 border border-red-200/60 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div>
                <label className="block text-sm font-medium text-stone-600 mb-1.5">
                  {t('auth.name')}
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  className="w-full rounded-lg border border-stone-200/80 bg-white/50 px-4 py-2.5 text-stone-800 placeholder-stone-400 transition-colors focus:border-[#2D6A4F]/40 focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/10"
                  placeholder={isRtl ? 'ישראל ישראלי' : 'John Doe'}
                  disabled={loading}
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-stone-600 mb-1.5">
                {t('auth.email')}
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                className="w-full rounded-lg border border-stone-200/80 bg-white/50 px-4 py-2.5 text-stone-800 placeholder-stone-400 transition-colors focus:border-[#2D6A4F]/40 focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/10"
                placeholder="you@company.com"
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-600 mb-1.5">
                {t('auth.password')}
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                className="w-full rounded-lg border border-stone-200/80 bg-white/50 px-4 py-2.5 text-stone-800 placeholder-stone-400 transition-colors focus:border-[#2D6A4F]/40 focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/10"
                placeholder="••••••••"
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-2.5 rounded-lg text-sm font-semibold mt-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <svg
                    className="animate-spin h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="3"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  {mode === 'login' ? t('auth.login') : t('auth.signup')}
                </span>
              ) : mode === 'login' ? (
                t('auth.login')
              ) : (
                t('auth.signup')
              )}
            </button>
          </form>

          {/* Footer toggle */}
          <p className="text-center text-sm text-stone-400 mt-6">
            {mode === 'login' ? t('auth.no_account') : t('auth.has_account')}{' '}
            <button
              type="button"
              onClick={() => switchMode(mode === 'login' ? 'signup' : 'login')}
              className="text-[#2D6A4F] font-medium hover:underline"
            >
              {mode === 'login' ? t('auth.signup') : t('auth.login')}
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
