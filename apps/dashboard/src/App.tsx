import { BrowserRouter, Routes, Route, Navigate, NavLink, useLocation } from 'react-router-dom'
import { lazy, Suspense, useState, useEffect, useCallback, type ReactNode } from 'react'
import { AuthProvider, useAuth } from './lib/auth'
import { I18nContext, createTranslator, isRtl, type Locale } from './lib/i18n'
import { Toaster } from './components/shadcn/ui/toaster'
import { GlobalNotificationListener } from './components/GlobalNotificationListener'
import ErrorBoundary from './components/ErrorBoundary'
import Sidebar from './components/Sidebar'
import ImpersonationBanner from './components/ImpersonationBanner'
import Login from './pages/Login'
import AutoLogin from './pages/AutoLogin'
const CompleteAccount = lazy(() => import('./pages/CompleteAccount'))
import RequireSubscription from './components/Paywall'
import SubscriptionBanner from './components/SubscriptionBanner'
import CompleteAccountBanner from './components/CompleteAccountBanner'
import { supabase } from './lib/supabase'
import { Globe } from 'lucide-react'

/* ─── Lazy-loaded pages ─── */
const AdminLayout = lazy(() => import('./components/AdminLayout'))
const ContractorDashboard = lazy(() => import('./pages/ContractorDashboard'))
const ContractorGroupScan = lazy(() => import('./pages/ContractorGroupScan'))
const LeadsFeed = lazy(() => import('./pages/LeadsFeed'))
const Subcontractors = lazy(() => import('./pages/Subcontractors'))
const Profile = lazy(() => import('./pages/Profile'))
const Subscription = lazy(() => import('./pages/Subscription'))
const TelegramConnect = lazy(() => import('./pages/TelegramConnect'))
const JobPortal = lazy(() => import('./pages/JobPortal'))
const JobsDashboard = lazy(() => import('./pages/JobsDashboard'))
const OnboardingWizard = lazy(() => import('./pages/OnboardingWizard'))
const NotFound = lazy(() => import('./pages/NotFound'))
const PublishChat = lazy(() => import('./pages/PublishChat'))
const MyPublishedLeads = lazy(() => import('./pages/MyPublishedLeads'))
const PartnerOnboarding = lazy(() => import('./pages/partner/PartnerOnboarding'))
const PartnerLayout = lazy(() => import('./pages/partner/PartnerLayout'))
import RequirePartner from './components/RequirePartner'

/* ─── Auth guard ─── */
function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  // Capture hash tokens ONCE on mount — Supabase clears the hash before session is ready,
  // so a live DOM read would miss them and redirect to /login prematurely
  const [hadHashTokens] = useState(() => window.location.hash.includes('access_token='))
  if (loading || (hadHashTokens && !user)) return <LoadingScreen />
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

/* ─── Mobile Tab Bar ─── */
function MobileTabBar() {
  const location = useLocation()
  const tabs = [
    { to: '/', icon: '🏠', label: 'Home', match: (p: string) => p === '/' },
    { to: '/leads', icon: '⚡', label: 'Leads', match: (p: string) => p === '/leads' },
    { to: '/group-scan', icon: '👥', label: 'Groups', match: (p: string) => p === '/group-scan' },
    { to: '/profile', icon: '⚙️', label: 'Profile', match: (p: string) => p === '/profile' || p === '/subscription' },
  ]
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-lg border-t border-stone-200 flex items-center justify-around px-2 pb-[env(safe-area-inset-bottom,8px)] pt-1.5">
      {tabs.map(tab => {
        const active = tab.match(location.pathname)
        return (
          <NavLink key={tab.to} to={tab.to} className="flex flex-col items-center gap-0.5 py-1 px-3 rounded-xl transition-colors">
            <span className={`text-lg ${active ? '' : 'grayscale opacity-40'}`}>{tab.icon}</span>
            <span className={`text-[9px] font-semibold ${active ? 'text-[#fe5b25]' : 'text-stone-400'}`}>{tab.label}</span>
          </NavLink>
        )
      })}
    </nav>
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

  // Partner onboarding is full-screen, no sidebar
  if (location.pathname === '/partner/join') {
    return <PartnerOnboarding />
  }

  return (
    <div className="min-h-screen">
      <div className="le-bg" />
      <div className="le-grain" />
      <CompleteAccountBanner />
      <SubscriptionBanner />
      <ImpersonationBanner />
      <Sidebar />
      {/* Mobile Tab Bar */}
      <MobileTabBar />
      <main className="relative contractor-main-content">
        {isFullBleed ? (
          <div className="h-screen">
            <Routes>
              <Route path="/" element={<RequireSubscription><RequireSetup><ContractorDashboard /></RequireSetup></RequireSubscription>} />
            </Routes>
          </div>
        ) : (
          <div className="max-w-6xl mx-auto px-3 pt-14 pb-20 md:pt-8 md:pb-8 sm:px-6">
            <Routes>
              <Route path="/" element={<RequireSubscription><RequireSetup><ContractorDashboard /></RequireSetup></RequireSubscription>} />
              <Route path="/leads" element={<RequireSubscription><RequireSetup><LeadsFeed /></RequireSetup></RequireSubscription>} />
              <Route path="/group-scan" element={<RequireSubscription><RequireSetup><ContractorGroupScan /></RequireSetup></RequireSubscription>} />
              <Route path="/subcontractors" element={<Subcontractors />} />
              <Route path="/jobs" element={<JobsDashboard />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/subscription" element={<Subscription />} />
              <Route path="/telegram" element={<RequireSubscription><TelegramConnect /></RequireSubscription>} />
              <Route path="/onboarding" element={<RequireSubscription><OnboardingWizard /></RequireSubscription>} />
              <Route path="/publish" element={<PublishChat />} />
              <Route path="/my-published" element={<MyPublishedLeads />} />
              <Route path="/partner/join" element={<PartnerOnboarding />} />
              <Route path="/partner/*" element={<RequirePartner><PartnerLayout /></RequirePartner>} />
              <Route path="/settings" element={<Navigate to="/" replace />} />
              <Route path="*" element={<NotFound />} />
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
    <ErrorBoundary>
      <I18nContext.Provider value={{ locale, setLocale: handleSetLocale, t }}>
        <div dir={rtl ? 'rtl' : 'ltr'}>
          <AuthProvider>
            <BrowserRouter>
              {/* Language toggle removed — English only */}

              <Suspense fallback={<LoadingScreen />}>
                <Routes>
                  <Route path="/portal/job/:token" element={<JobPortal />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/auto-login" element={<AutoLogin />} />
                  <Route path="/complete-account" element={<RequireAuth><CompleteAccount /></RequireAuth>} />
                  <Route path="/admin/*" element={
                    <RequireAuth><RequireAdmin><AdminLayout /></RequireAdmin></RequireAuth>
                  } />
                  <Route path="/*" element={<RequireAuth><AppShell /></RequireAuth>} />
                </Routes>
              </Suspense>
              <Toaster />
              <GlobalNotificationListener />
            </BrowserRouter>
          </AuthProvider>
        </div>
      </I18nContext.Provider>
    </ErrorBoundary>
  )
}

export default App
