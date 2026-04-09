import { BrowserRouter, Routes, Route, Navigate, NavLink, useLocation } from 'react-router-dom'
import { lazy, Suspense, useState, useEffect, useCallback, type ReactNode } from 'react'
import { Home, Zap, MessageCircle, Briefcase, User } from 'lucide-react'
import { AuthProvider, useAuth } from './lib/auth'
import { I18nContext, createTranslator, type Locale } from './lib/i18n'
import { Toaster } from './components/shadcn/ui/toaster'
import { GlobalNotificationListener } from './components/GlobalNotificationListener'
import { AdminClaimListener } from './components/AdminClaimListener'
import ErrorBoundary from './components/ErrorBoundary'
import Sidebar from './components/Sidebar'
import ImpersonationBanner from './components/ImpersonationBanner'
import Login from './pages/Login'
import AutoLogin from './pages/AutoLogin'
const CompleteAccount = lazyRetry(() => import('./pages/CompleteAccount'))
import RequireSubscription from './components/Paywall'
import SubscriptionBanner from './components/SubscriptionBanner'
import CompleteAccountBanner from './components/CompleteAccountBanner'
import { supabase } from './lib/supabase'
import { ContractorContext, useContractorData, useContractor } from './lib/useContractor'
import PushBanner from './components/PushBanner'
import WhatsAppReconnectBanner from './components/WhatsAppReconnectBanner'
import RebecaConnectPopup from './components/RebecaConnectPopup'
import { PWAInstallBanner } from './components/PWAInstallBanner'
import { OnboardingOverlayContext } from './components/OnboardingOverlayContext'
import PushPermissionPopup from './components/PushPermissionPopup'

/* ─── Lazy with auto-reload on stale chunks ─── */
function lazyRetry(loader: () => Promise<any>) {
  return lazy(() =>
    loader().catch(() => {
      // Chunk probably disappeared after a new deploy — reload once
      const key = 'chunk-reload'
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, '1')
        window.location.reload()
      }
      return loader() // will throw if still broken after reload
    })
  )
}

const AdminLayout = lazyRetry(() => import('./components/AdminLayout'))
const ContractorDashboard = lazyRetry(() => import('./pages/ContractorDashboard'))
const ContractorGroupScan = lazyRetry(() => import('./pages/ContractorGroupScan'))
const LeadsFeed = lazyRetry(() => import('./pages/LeadsFeed'))
const Subcontractors = lazyRetry(() => import('./pages/Subcontractors'))
const Profile = lazyRetry(() => import('./pages/Profile'))
const Subscription = lazyRetry(() => import('./pages/Subscription'))
const JobPortal = lazyRetry(() => import('./pages/JobPortal'))
const ClaimLead = lazyRetry(() => import('./pages/ClaimLead'))
const ClaimFollowup = lazyRetry(() => import('./pages/ClaimFollowup'))
const JobsDashboard = lazyRetry(() => import('./pages/JobsDashboard'))
const OnboardingWizard = lazyRetry(() => import('./pages/OnboardingWizard'))
const NotFound = lazyRetry(() => import('./pages/NotFound'))
const PublishChat = lazyRetry(() => import('./pages/PublishChat'))
const MyPublishedLeads = lazyRetry(() => import('./pages/MyPublishedLeads'))
const IdentityVerification = lazyRetry(() => import('./pages/IdentityVerification'))
const PublishedJobDetail = lazyRetry(() => import('./pages/PublishedJobDetail'))
const MessagesInbox = lazyRetry(() => import('./pages/MessagesInbox'))
const RebecaChat = lazyRetry(() => import('./pages/RebecaChat'))
const DirectChat = lazyRetry(() => import('./pages/DirectChat'))
const PartnerOnboarding = lazyRetry(() => import('./pages/partner/PartnerOnboarding'))
const PartnerGroupChat = lazyRetry(() => import('./pages/partner/PartnerGroupChat'))
const GroupLeads = lazyRetry(() => import('./pages/GroupLeads'))
const PartnerLayout = lazyRetry(() => import('./pages/partner/PartnerLayout'))
const NotificationsPage = lazyRetry(() => import('./pages/NotificationsPage'))
const PublicProfileView = lazyRetry(() => import('./pages/PublicProfileView'))
const ProfileEdit = lazyRetry(() => import('./pages/ProfileEdit'))
const LeadDetail = lazyRetry(() => import('./pages/LeadDetail'))
const JobDetail = lazyRetry(() => import('./pages/JobDetail'))
const MyReviews = lazyRetry(() => import('./pages/MyReviews'))
const ReviewSubmit = lazyRetry(() => import('./pages/ReviewSubmit'))
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
  const { contractor, loading: cLoading } = useContractor()
  const [ready, setReady] = useState<boolean | null>(null)

  useEffect(() => {
    if (!effectiveUserId || isAdmin) { setReady(true); return }
    if (cLoading) return

    const data = contractor
    if (!data) { setReady(false); return }

    const hasProfs = data.professions && data.professions.length > 0
    const hasZips = data.zip_codes && data.zip_codes.length > 0
    if (hasProfs && hasZips) { setReady(true); return }

    // Also check if user has counties set (web signup stores counties, not zips)
    if (hasProfs && !hasZips) {
      supabase
        .from('profiles')
        .select('counties')
        .eq('id', effectiveUserId)
        .maybeSingle()
        .then(({ data: profile }) => {
          const hasCounties = profile?.counties && (profile.counties as string[]).length > 0
          setReady(!!hasCounties)
        })
      return
    }
    setReady(false)
  }, [effectiveUserId, isAdmin, contractor, cLoading])

  if (ready === null) return <LoadingScreen />
  if (!ready) {
    window.location.href = 'https://masterleadflow.com/signup'
    return <LoadingScreen />
  }
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

/* ─── Mobile Tab Bar — floating dark pill (matches prototype) ─── */
function MobileTabBar() {
  const location = useLocation()
  const tabs = [
    { to: '/',            Icon: Home,         label: 'Home',   match: (p: string) => p === '/' },
    { to: '/leads',       Icon: Zap,          label: 'Leads',  match: (p: string) => p === '/leads' || p.startsWith('/leads/') },
    { to: '/chat/rebeca', Icon: MessageCircle, label: 'Rebeca', match: (p: string) => p.startsWith('/chat') || p.startsWith('/messages') },
    { to: '/jobs',        Icon: Briefcase,    label: 'Jobs',   match: (p: string) => p === '/jobs' || p.startsWith('/jobs/') },
    { to: '/profile',     Icon: User,         label: 'Profile',match: (p: string) => p.startsWith('/profile') || p === '/subscription' },
  ]
  return (
    <nav className="md:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1.5 bg-[#111] rounded-[28px] px-1.5 py-[5px] shadow-[0_8px_32px_rgba(0,0,0,0.20)]">
      {tabs.map(({ to, Icon, label, match }) => {
        const active = match(location.pathname)
        return (
          <NavLink
            key={to}
            to={to}
            className={`w-[46px] h-[46px] rounded-full flex flex-col items-center justify-center gap-0.5 transition-all duration-[250ms] [transition-timing-function:cubic-bezier(0.34,1.56,0.64,1)] active:scale-[0.88] ${active ? 'bg-white' : 'bg-transparent'}`}
          >
            <Icon size={18} strokeWidth={active ? 2.2 : 1.5} className={active ? 'text-[#111]' : 'text-white/50'} />
            <span className={`text-[9px] font-medium ${active ? 'text-[#111]' : 'text-white/35'}`}>{label}</span>
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
  const [onboardingActive, setOnboardingActive] = useState(false)
  const contractorCtx = useContractorData()

  if (isAdmin && !impersonatedUserId) return <Navigate to="/admin" replace />

  // Redirect old onboarding path to web signup
  if (location.pathname === '/onboarding') {
    window.location.href = 'https://masterleadflow.com/signup'
    return <div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-[3px] border-gray-200 border-t-[#fe5b25] rounded-full animate-spin" /></div>
  }

  // Partner onboarding is full-screen, no sidebar
  if (location.pathname === '/partner/join') {
    return <PartnerOnboarding />
  }

  return (
    <ContractorContext.Provider value={contractorCtx}>
      <OnboardingOverlayContext.Provider value={{ active: onboardingActive, setActive: setOnboardingActive }}>
        <div className="min-h-screen">
      <div className="le-bg" />
      <div className="le-grain" />
      {!onboardingActive && <WhatsAppReconnectBanner />}
      {!onboardingActive && <PWAInstallBanner />}
      {!onboardingActive && <PushBanner />}
      {!onboardingActive && <CompleteAccountBanner />}
      {!onboardingActive && <SubscriptionBanner />}
      <ImpersonationBanner />
      {!onboardingActive && <Sidebar />}
      {!onboardingActive && <MobileTabBar />}
      {!onboardingActive && <PushPermissionPopup />}
      {!onboardingActive && <RebecaConnectPopup />}
      <GlobalNotificationListener />
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
              <Route path="/jobs/:id" element={<JobDetail />} />
              <Route path="/published-job/:id" element={<PublishedJobDetail />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/profile/edit" element={<ProfileEdit />} />
              <Route path="/profile/public" element={<PublicProfileView />} />
              <Route path="/subscription" element={<Subscription />} />

              <Route path="/onboarding" element={<RequireSubscription><OnboardingWizard /></RequireSubscription>} />
              <Route path="/verify-identity" element={<IdentityVerification />} />
              <Route path="/messages" element={<MessagesInbox />} />
              <Route path="/chat/rebeca" element={<RebecaChat />} />
              <Route path="/chat/:id" element={<DirectChat />} />
              <Route path="/publish" element={<PublishChat />} />
              <Route path="/my-published" element={<MyPublishedLeads />} />
              <Route path="/notifications" element={<NotificationsPage />} />
              <Route path="/leads/:id" element={<LeadDetail />} />
              <Route path="/reviews" element={<MyReviews />} />
              <Route path="/review-submit/:jobOrderId" element={<ReviewSubmit />} />
              <Route path="/profile-preview" element={<PublicProfileView />} />
              <Route path="/partner/join" element={<PartnerOnboarding />} />
              <Route path="/partner/*" element={<RequirePartner><PartnerLayout /></RequirePartner>} />
              <Route path="/settings" element={<Navigate to="/" replace />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </div>
        )}
      </main>
        </div>
      </OnboardingOverlayContext.Provider>
    </ContractorContext.Provider>
  )
}


/* ─── Root with i18n + Auth ─── */
function App() {
  const locale: Locale = 'en'
  // Hebrew/RTL disabled — English only
  const handleSetLocale = useCallback((_l: Locale) => {}, [])

  const t = createTranslator(locale)

  return (
    <ErrorBoundary>
      <I18nContext.Provider value={{ locale, setLocale: handleSetLocale, t }}>
        <div dir="ltr">
          <AuthProvider>
            <BrowserRouter>
              {/* Language toggle removed — English only */}

              <Suspense fallback={<LoadingScreen />}>
                <Routes>
                  <Route path="/portal/job/:token" element={<JobPortal />} />
                  <Route path="/claim/:leadId" element={<ClaimLead />} />
                  <Route path="/claim-followup" element={<ClaimFollowup />} />
                  <Route path="/partner/chat-demo" element={<PartnerGroupChat />} />
                  <Route path="/group-leads" element={<GroupLeads />} />
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
              <AdminClaimListener />
            </BrowserRouter>
          </AuthProvider>
        </div>
      </I18nContext.Provider>
    </ErrorBoundary>
  )
}

export default App
