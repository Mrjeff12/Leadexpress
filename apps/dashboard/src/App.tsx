import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useState, useEffect, useCallback, type ReactNode } from 'react'
import { AuthProvider, useAuth } from './lib/auth'
import { I18nContext, createTranslator, isRtl, type Locale } from './lib/i18n'
import { Toaster } from './components/shadcn/ui/toaster'
import { GlobalNotificationListener } from './components/GlobalNotificationListener'
import Sidebar from './components/Sidebar'
import ImpersonationBanner from './components/ImpersonationBanner'
import AdminLayout from './components/AdminLayout'
import Login from './pages/Login'
import ContractorDashboard from './pages/ContractorDashboard'
import ContractorGroupScan from './pages/ContractorGroupScan'
import LeadsFeed from './pages/LeadsFeed'
import Subcontractors from './pages/Subcontractors'
import Profile from './pages/Profile'
import Subscription from './pages/Subscription'
import TelegramConnect from './pages/TelegramConnect'
import JobPortal from './pages/JobPortal'
import OnboardingWizard from './pages/OnboardingWizard'
import RequireSubscription from './components/Paywall'
import SubscriptionBanner from './components/SubscriptionBanner'
import { supabase } from './lib/supabase'
import { Globe } from 'lucide-react'

/* ─── Auth guard ─── */
function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <LoadingScreen />
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

function RequireAdmin({ children }: { children: ReactNode }) {
  const { isAdmin, loading } = useAuth()
  if (loading) return <LoadingScreen />
  if (!isAdmin) return <Navigate to="/" replace />
  return <>{children}</>
}



/* ─── Setup guard — redirects to /onboarding if contractor has no professions/zips ─── */
function RequireSetup({ children }: { children: ReactNode }) {
  const { effectiveUserId, isAdmin } = useAuth()
  const location = useLocation()
  const [ready, setReady] = useState<boolean | null>(null)

  useEffect(() => {
    if (!effectiveUserId || isAdmin) {
      setReady(true)
      return
    }

    supabase
      .from('contractors')
      .select('professions, zip_codes')
      .eq('user_id', effectiveUserId)
      .maybeSingle()
      .then(({ data }) => {
        const hasProfs = data?.professions && (data.professions as string[]).length > 0
        const hasZips = data?.zip_codes && (data.zip_codes as string[]).length > 0
        setReady(!!(hasProfs && hasZips))
      })
  }, [effectiveUserId, isAdmin])

  if (ready === null) return <LoadingScreen />
  if (!ready && location.pathname !== '/onboarding') return <Navigate to="/onboarding" replace />
  return <>{children}</>
}

function LoadingScreen() {
  return (
    <div className="fixed inset-0 flex items-center justify-center">
      <div className="le-bg" />
      <div className="le-grain" />
      <div className="flex flex-col items-center gap-3 animate-fade-in">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white text-sm"
          style={{ background: 'hsl(14 99% 57%)' }}>
          LE
        </div>
        <div className="text-sm" style={{ color: 'hsl(40 4% 42%)' }}>Loading...</div>
      </div>
    </div>
  )
}

/* ─── App Shell (authenticated pages — contractor only) ─── */
function AppShell() {
  const { isAdmin, impersonatedUserId } = useAuth()
  const location = useLocation()
  const isFullBleed = location.pathname === '/'

  if (isAdmin && !impersonatedUserId) return <Navigate to="/admin" replace />

  // Onboarding wizard is full-screen, no sidebar
  if (location.pathname === '/onboarding') {
    return (
      <RequireSubscription>
        <OnboardingWizard />
      </RequireSubscription>
    )
  }

  return (
    <div className="min-h-screen">
      <div className="le-bg" />
      <div className="le-grain" />
      <SubscriptionBanner />
      <ImpersonationBanner />
      <Sidebar />
      <main className="relative contractor-main-content">
        {isFullBleed ? (
          <div className="h-screen">
            <Routes>
              <Route path="/" element={<RequireSubscription><RequireSetup><ContractorDashboard /></RequireSetup></RequireSubscription>} />
            </Routes>
          </div>
        ) : (
          <div className="max-w-6xl mx-auto px-6 py-8">
            <Routes>
              <Route path="/" element={<RequireSubscription><RequireSetup><ContractorDashboard /></RequireSetup></RequireSubscription>} />
              <Route path="/leads" element={<RequireSubscription><RequireSetup><LeadsFeed /></RequireSetup></RequireSubscription>} />
              <Route path="/group-scan" element={<RequireSubscription><RequireSetup><ContractorGroupScan /></RequireSetup></RequireSubscription>} />
              <Route path="/subcontractors" element={<RequireSubscription><RequireSetup><Subcontractors /></RequireSetup></RequireSubscription>} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/subscription" element={<Subscription />} />
              <Route path="/telegram" element={<RequireSubscription><TelegramConnect /></RequireSubscription>} />
              <Route path="/onboarding" element={<RequireSubscription><OnboardingWizard /></RequireSubscription>} />
              <Route path="/settings" element={<Navigate to="/" replace />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        )}
      </main>
    </div>
  )
}

/* ─── Global language toggle (hidden on login page which has its own) ─── */
function GlobalLangToggle({ locale, rtl, onToggle }: { locale: string; rtl: boolean; onToggle: () => void }) {
  const location = useLocation()
  if (location.pathname === '/login') return null
  return (
    <button
      onClick={onToggle}
      className="fixed top-4 z-50 flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium bg-white/80 backdrop-blur shadow-sm hover:bg-white transition-all"
      style={{
        borderColor: 'hsl(35 15% 88%)',
        color: 'hsl(40 4% 42%)',
        right: rtl ? 'auto' : '16px',
        left: rtl ? '16px' : 'auto',
      }}
    >
      <Globe className="w-3.5 h-3.5" />
      {locale === 'en' ? 'עב' : 'EN'}
    </button>
  )
}

/* ─── Root with i18n + Auth ─── */
function App() {
  const [locale, setLocale] = useState<Locale>(() => {
    const saved = localStorage.getItem('le-locale') as Locale | null
    return saved === 'he' ? 'he' : 'en'
  })

  const handleSetLocale = useCallback((l: Locale) => {
    setLocale(l)
    localStorage.setItem('le-locale', l)
  }, [])

  const t = createTranslator(locale)
  const rtl = isRtl(locale)

  return (
    <I18nContext.Provider value={{ locale, setLocale: handleSetLocale, t }}>
      <div dir={rtl ? 'rtl' : 'ltr'}>
        <AuthProvider>
          <BrowserRouter>
            <GlobalLangToggle locale={locale} rtl={rtl} onToggle={() => handleSetLocale(locale === 'en' ? 'he' : 'en')} />

            <Routes>
              <Route path="/portal/job/:token" element={<JobPortal />} />
              <Route path="/login" element={<Login />} />
              <Route path="/admin/*" element={
                <RequireAuth><RequireAdmin><AdminLayout /></RequireAdmin></RequireAuth>
              } />
              <Route path="/*" element={<RequireAuth><AppShell /></RequireAuth>} />
            </Routes>
            <Toaster />
            <GlobalNotificationListener />
          </BrowserRouter>
        </AuthProvider>
      </div>
    </I18nContext.Provider>
  )
}

export default App
