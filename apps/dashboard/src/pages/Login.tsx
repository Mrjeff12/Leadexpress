import { useState } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { useI18n } from '../lib/i18n'
import { supabase } from '../lib/supabase'

type Mode = 'login' | 'signup' | 'forgot'

export default function Login() {
  const { signIn, signUp, user, loading: authLoading } = useAuth()
  const { t, locale, setLocale } = useI18n()
  const isRtl = locale === 'he'
  const [searchParams] = useSearchParams()

  const initialMode = searchParams.get('mode') === 'signup' ? 'signup' : 'login'
  const [mode, setMode] = useState<Mode>(initialMode)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [needsVerification, setNeedsVerification] = useState(false)
  const [verificationEmail, setVerificationEmail] = useState('')
  const [resending, setResending] = useState(false)

  if (!authLoading && user) return <Navigate to="/" replace />

  async function handleResendVerification() {
    setResending(true)
    setError(null)
    setSuccess(null)
    try {
      const { error: resendError } = await supabase.auth.resend({
        type: 'signup',
        email: verificationEmail,
      })
      if (resendError) {
        setError(resendError.message)
      } else {
        setSuccess(isRtl ? 'אימייל אימות נשלח שוב!' : 'Verification email resent!')
      }
    } catch {
      setError('Failed to resend verification email.')
    } finally {
      setResending(false)
    }
  }

  if (needsVerification) {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-4 sm:p-6 lg:p-10 relative overflow-hidden"
        dir={isRtl ? 'rtl' : 'ltr'}
      >
        <div className="fixed inset-0 bg-gradient-to-br from-slate-50 via-gray-50 to-orange-50/30" />
        <div className="relative z-10 w-full max-w-md">
          <div className="rounded-2xl border border-white/60 bg-white/70 backdrop-blur-2xl shadow-[0_8px_60px_-12px_rgba(0,0,0,0.12)] p-8 sm:p-10 text-center">
            {/* Email icon */}
            <div className="mx-auto w-16 h-16 rounded-2xl bg-orange-50 flex items-center justify-center mb-5">
              <svg className="w-8 h-8 text-[#fe5b25]" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
              </svg>
            </div>

            <h2 className="text-xl font-bold text-gray-900 mb-2">
              {isRtl ? 'בדוק את האימייל שלך' : 'Check your email'}
            </h2>
            <p className="text-sm text-gray-500 mb-1">
              {isRtl ? 'שלחנו קישור אימות אל:' : 'We sent a verification link to:'}
            </p>
            <p className="text-sm font-semibold text-gray-900 mb-6">{verificationEmail}</p>

            {success && (
              <div className="mb-4 rounded-xl bg-green-50 border border-green-100 px-4 py-3 text-sm text-green-700 flex items-center justify-center gap-2">
                <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                {success}
              </div>
            )}

            {error && (
              <div className="mb-4 rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600 flex items-center justify-center gap-2">
                <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                {error}
              </div>
            )}

            <div className="space-y-3">
              <button
                onClick={handleResendVerification}
                disabled={resending}
                className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-r from-[#fe5b25] to-[#ff7a4d] hover:from-[#e54e1a] hover:to-[#fe5b25] shadow-lg shadow-orange-200/40 hover:shadow-orange-300/50 active:scale-[0.98]"
              >
                {resending ? (
                  <span className="inline-flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  </span>
                ) : (isRtl ? 'שלח אימייל אימות שוב' : 'Resend verification email')}
              </button>

              <button
                onClick={() => {
                  setNeedsVerification(false)
                  setError(null)
                  setSuccess(null)
                  switchMode('login')
                }}
                className="w-full py-2.5 rounded-xl text-sm font-medium text-gray-600 border border-gray-200/80 bg-white hover:bg-gray-50 transition-all active:scale-[0.98]"
              >
                {isRtl ? 'חזרה להתחברות' : 'Back to login'}
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setLoading(true)
    try {
      if (mode === 'forgot') {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/login`,
        })
        if (resetError) {
          setError(resetError.message)
        } else {
          setSuccess(isRtl ? 'קישור לאיפוס סיסמה נשלח למייל שלך' : 'Password reset link sent to your email')
        }
      } else {
        const result =
          mode === 'login'
            ? await signIn(email, password)
            : await signUp(email, password, name)
        if (result.error) {
          setError(result.error)
        } else if ('needsVerification' in result && result.needsVerification) {
          setVerificationEmail(email)
          setNeedsVerification(true)
        }
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
    setSuccess(null)
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-0 sm:p-6 lg:p-10 relative overflow-hidden"
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

      {/* ─── Glass Card (full-screen on mobile, card on sm+) ─── */}
      <div className="relative z-10 w-full sm:max-w-6xl h-screen sm:h-auto">
        <div className="h-full sm:h-auto sm:rounded-3xl overflow-hidden sm:border sm:border-white/60 bg-white/70 sm:backdrop-blur-2xl sm:shadow-[0_8px_60px_-12px_rgba(0,0,0,0.12),0_0_0_1px_rgba(255,255,255,0.6)_inset]">
          <div className="flex flex-col lg:flex-row h-full sm:h-auto">

            {/* ─── Left: Form (second on mobile, first on desktop) ─── */}
            <div className="order-2 lg:order-1 w-full lg:w-[420px] xl:w-[440px] flex-shrink-0 flex flex-col justify-start sm:justify-center flex-1 sm:flex-initial px-6 sm:px-10 lg:px-12 pt-4 pb-6 sm:py-10 lg:py-14">
              {/* Logo */}
              <div className="flex items-center gap-2.5 mb-2 sm:mb-8">
                <img src="/icon.png" alt="Lead Express" className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl shadow-md shadow-orange-200/50" />
                <span className="text-base sm:text-lg font-semibold tracking-tight text-gray-900">Lead Express</span>
              </div>

              <h1 className="text-xl sm:text-3xl font-bold text-gray-900 tracking-tight leading-tight mb-1 sm:mb-2">
                {mode === 'forgot'
                  ? (isRtl ? 'איפוס סיסמה' : 'Reset Password')
                  : mode === 'login' ? t('auth.welcomeBack') : t('auth.createAccount')}
              </h1>
              <p className="text-gray-500 text-xs sm:text-sm mb-4 sm:mb-7 leading-relaxed">
                {mode === 'forgot'
                  ? (isRtl ? 'הזן את המייל שלך ונשלח לך קישור לאיפוס' : 'Enter your email and we\'ll send you a reset link')
                  : mode === 'login' ? t('auth.loginSubtitle') : t('auth.signupSubtitle')}
              </p>

              {/* Mode tabs */}
              {mode !== 'forgot' && (
                <div className="flex rounded-xl bg-gray-100/80 p-1 mb-3 sm:mb-5">
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
              )}

              {/* Social Login (above email form) */}
              {mode !== 'forgot' && (
                <div className="mb-4 sm:mb-5 space-y-2.5">
                  <button
                    type="button"
                    onClick={async () => {
                      setError(null)
                      const { error: oauthError } = await supabase.auth.signInWithOAuth({
                        provider: 'google',
                        options: { redirectTo: window.location.origin },
                      })
                      if (oauthError) setError(oauthError.message)
                    }}
                    className="w-full flex items-center justify-center gap-2.5 py-2.5 rounded-xl border border-gray-200/80 bg-white hover:bg-gray-50 text-gray-700 text-sm font-medium transition-all shadow-sm hover:shadow active:scale-[0.98]"
                  >
                    <svg width="18" height="18" viewBox="0 0 48 48">
                      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                      <path fill="#FBBC05" d="M10.53 28.59a14.5 14.5 0 0 1 0-9.18l-7.98-6.19a24.0 24.0 0 0 0 0 21.56l7.98-6.19z"/>
                      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                    </svg>
                    {isRtl ? 'המשך עם Google' : 'Continue with Google'}
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      setError(null)
                      const { error: oauthError } = await supabase.auth.signInWithOAuth({
                        provider: 'apple',
                        options: { redirectTo: window.location.origin },
                      })
                      if (oauthError) setError(oauthError.message)
                    }}
                    className="w-full flex items-center justify-center gap-2.5 py-2.5 rounded-xl border border-gray-900 bg-gray-900 hover:bg-black text-white text-sm font-medium transition-all shadow-sm hover:shadow active:scale-[0.98]"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                    </svg>
                    {isRtl ? 'המשך עם Apple' : 'Continue with Apple'}
                  </button>

                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-px bg-gray-200/80" />
                    <span className="text-xs text-gray-400 whitespace-nowrap">
                      {isRtl ? 'או המשך עם אימייל' : 'or continue with email'}
                    </span>
                    <div className="flex-1 h-px bg-gray-200/80" />
                  </div>
                </div>
              )}

              {/* Success */}
              {success && (
                <div className="mb-4 rounded-xl bg-green-50 border border-green-100 px-4 py-3 text-sm text-green-700 flex items-start gap-2">
                  <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  {success}
                </div>
              )}

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
              <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
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

                {mode !== 'forgot' && (
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-sm font-medium text-gray-600">{t('auth.password')}</label>
                      {mode === 'login' && (
                        <button
                          type="button"
                          onClick={() => switchMode('forgot')}
                          className="text-xs text-[#fe5b25] hover:text-[#e54e1a] font-medium"
                        >
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
                )}

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
                    </span>
                  ) : mode === 'forgot'
                    ? (isRtl ? 'שלח קישור לאיפוס' : 'Send Reset Link')
                    : mode === 'login' ? t('auth.login') : t('auth.signup')}
                </button>

                {/* Social login moved above the form */}
              </form>

              <p className="text-center text-sm text-gray-400 mt-6">
                {mode === 'forgot' ? (
                  <button
                    type="button"
                    onClick={() => switchMode('login')}
                    className="text-[#fe5b25] font-semibold hover:underline"
                  >
                    {isRtl ? 'חזרה להתחברות' : 'Back to login'}
                  </button>
                ) : (
                  <>
                    {mode === 'login' ? t('auth.no_account') : t('auth.has_account')}{' '}
                    <button
                      type="button"
                      onClick={() => switchMode(mode === 'login' ? 'signup' : 'login')}
                      className="text-[#fe5b25] font-semibold hover:underline"
                    >
                      {mode === 'login' ? t('auth.signup') : t('auth.login')}
                    </button>
                  </>
                )}
              </p>
            </div>

            {/* ─── Hero Image (first on mobile, right on desktop) ─── */}
            <div className="order-1 lg:order-2 flex items-center p-0 sm:p-3 lg:flex-1">
              <div className="relative w-full sm:rounded-2xl overflow-hidden sm:shadow-lg h-[140px] sm:aspect-[16/9] sm:h-auto lg:aspect-auto lg:h-full lg:min-h-[400px]">
                <picture>
                  <source srcSet="/login-hero.webp" type="image/webp" />
                  <img
                    src="/login-hero.jpg"
                    alt="Air duct cleaning contractor"
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </picture>
                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />

                {/* Small badge */}
                <div className="absolute bottom-2 left-2 sm:bottom-3 sm:left-3">
                  <div className="bg-black/30 backdrop-blur-sm rounded-lg border border-white/10 px-2.5 py-1.5 flex items-center gap-1.5">
                    <div className="flex items-center gap-0.5">
                      {[...Array(5)].map((_, i) => (
                        <svg key={i} className="w-2.5 h-2.5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      ))}
                    </div>
                    <span className="text-white/70 text-[10px] font-medium">Trusted by 500+ contractors</span>
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
