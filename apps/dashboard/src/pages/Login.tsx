import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { useI18n } from '../lib/i18n'

type Mode = 'login' | 'signup'

export default function Login() {
  const { signIn, signUp, user, loading: authLoading } = useAuth()
  const { t, locale, setLocale } = useI18n()
  const isRtl = locale === 'he'

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
      if (result.error) setError(result.error)
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
      className="min-h-screen flex items-center justify-center p-4 sm:p-6 lg:p-10 relative overflow-hidden"
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      {/* Background */}
      <div className="fixed inset-0 bg-gradient-to-br from-slate-50 via-gray-50 to-orange-50/30" />
      <div className="fixed inset-0 opacity-[0.015]" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.5'/%3E%3C/svg%3E")`,
        backgroundRepeat: 'repeat',
        backgroundSize: '256px',
      }} />

      {/* Language toggle */}
      <div className="fixed top-5 right-5 flex gap-1 z-50">
        <button
          onClick={() => setLocale('en')}
          className={`px-3 py-1.5 text-xs rounded-full transition-all ${
            locale === 'en'
              ? 'bg-gray-900 text-white font-medium'
              : 'text-gray-400 hover:text-gray-600'
          }`}
        >
          EN
        </button>
        <button
          onClick={() => setLocale('he')}
          className={`px-3 py-1.5 text-xs rounded-full transition-all ${
            locale === 'he'
              ? 'bg-gray-900 text-white font-medium'
              : 'text-gray-400 hover:text-gray-600'
          }`}
        >
          HE
        </button>
      </div>

      {/* ─── Glass Card ─── */}
      <div className="relative z-10 w-full max-w-6xl">
        <div className="rounded-3xl overflow-hidden border border-white/60 bg-white/70 backdrop-blur-2xl shadow-[0_8px_60px_-12px_rgba(0,0,0,0.12),0_0_0_1px_rgba(255,255,255,0.6)_inset]">
          <div className="flex flex-col lg:flex-row">

            {/* ─── Left: Form ─── */}
            <div className="w-full lg:w-[420px] xl:w-[440px] flex-shrink-0 flex flex-col justify-center px-8 sm:px-10 lg:px-12 py-10 lg:py-14">
              {/* Logo */}
              <div className="flex items-center gap-2.5 mb-8">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#fe5b25] to-[#ff8a5c] flex items-center justify-center shadow-md shadow-orange-200/50">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2L2 7l10 5 10-5-10-5z" />
                    <path d="M2 17l10 5 10-5" />
                    <path d="M2 12l10 5 10-5" />
                  </svg>
                </div>
                <span className="text-lg font-semibold tracking-tight text-gray-900">Lead Express</span>
              </div>

              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight leading-tight mb-2">
                {mode === 'login' ? t('auth.welcomeBack') : t('auth.createAccount')}
              </h1>
              <p className="text-gray-500 text-sm mb-7 leading-relaxed">
                {mode === 'login' ? t('auth.loginSubtitle') : t('auth.signupSubtitle')}
              </p>

              {/* Mode tabs */}
              <div className="flex rounded-xl bg-gray-100/80 p-1 mb-6">
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                    mode === 'login'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  {t('auth.login')}
                </button>
                <button
                  type="button"
                  onClick={() => switchMode('signup')}
                  className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                    mode === 'signup'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  {t('auth.signup')}
                </button>
              </div>

              {/* Error */}
              {error && (
                <div className="mb-4 rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600 flex items-start gap-2">
                  <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  {error}
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                {mode === 'signup' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1.5">{t('auth.name')}</label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      autoComplete="name"
                      className="w-full rounded-xl border border-gray-200/80 bg-white/80 px-4 py-2.5 text-gray-900 placeholder-gray-400 transition-all focus:border-[#fe5b25]/40 focus:outline-none focus:ring-3 focus:ring-[#fe5b25]/10"
                      placeholder={isRtl ? 'ישראל ישראלי' : 'John Doe'}
                      disabled={loading}
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1.5">{t('auth.email')}</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    className="w-full rounded-xl border border-gray-200/80 bg-white/80 px-4 py-2.5 text-gray-900 placeholder-gray-400 transition-all focus:border-[#fe5b25]/40 focus:outline-none focus:ring-3 focus:ring-[#fe5b25]/10"
                    placeholder="you@company.com"
                    disabled={loading}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-sm font-medium text-gray-600">{t('auth.password')}</label>
                    {mode === 'login' && (
                      <button type="button" className="text-xs text-[#fe5b25] hover:text-[#e54e1a] font-medium">
                        {t('auth.forgotPassword')}
                      </button>
                    )}
                  </div>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    className="w-full rounded-xl border border-gray-200/80 bg-white/80 px-4 py-2.5 text-gray-900 placeholder-gray-400 transition-all focus:border-[#fe5b25]/40 focus:outline-none focus:ring-3 focus:ring-[#fe5b25]/10"
                    placeholder="••••••••"
                    disabled={loading}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-r from-[#fe5b25] to-[#ff7a4d] hover:from-[#e54e1a] hover:to-[#fe5b25] shadow-lg shadow-orange-200/40 hover:shadow-orange-300/50 active:scale-[0.98]"
                >
                  {loading ? (
                    <span className="inline-flex items-center gap-2">
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      {mode === 'login' ? t('auth.login') : t('auth.signup')}
                    </span>
                  ) : mode === 'login' ? t('auth.login') : t('auth.signup')}
                </button>
              </form>

              <p className="text-center text-sm text-gray-400 mt-6">
                {mode === 'login' ? t('auth.no_account') : t('auth.has_account')}{' '}
                <button
                  type="button"
                  onClick={() => switchMode(mode === 'login' ? 'signup' : 'login')}
                  className="text-[#fe5b25] font-semibold hover:underline"
                >
                  {mode === 'login' ? t('auth.signup') : t('auth.login')}
                </button>
              </p>
            </div>

            {/* ─── Right: Image (16:9 natural) ─── */}
            <div className="hidden lg:flex flex-1 items-center p-3">
              <div className="relative w-full rounded-2xl overflow-hidden shadow-lg" style={{ aspectRatio: '16/9' }}>
                <img
                  src="/login-hero.jpg"
                  alt="Air duct cleaning contractor"
                  className="w-full h-full object-cover"
                />
                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />

                {/* Testimonial card */}
                <div className="absolute bottom-4 left-4 right-4">
                  <div className="bg-black/20 backdrop-blur-md rounded-xl border border-white/10 px-5 py-4">
                    <div className="flex items-center gap-2.5 mb-2">
                      <div className="flex -space-x-1.5">
                        <img src="https://randomuser.me/api/portraits/men/32.jpg" alt="Jake" className="w-7 h-7 rounded-full object-cover ring-2 ring-white/30" />
                        <img src="https://randomuser.me/api/portraits/men/45.jpg" alt="Mike" className="w-7 h-7 rounded-full object-cover ring-2 ring-white/30" />
                        <img src="https://randomuser.me/api/portraits/men/67.jpg" alt="Rob" className="w-7 h-7 rounded-full object-cover ring-2 ring-white/30" />
                      </div>
                      <div className="flex items-center gap-0.5">
                        {[...Array(5)].map((_, i) => (
                          <svg key={i} className="w-3.5 h-3.5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                        ))}
                      </div>
                    </div>
                    <p className="text-white/95 font-medium text-sm leading-snug">
                      "Lead Express helped me triple my bookings in just 2 months."
                    </p>
                    <p className="text-white/50 text-xs mt-1.5">
                      Jake R. — HVAC Contractor, Miami FL
                    </p>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}
