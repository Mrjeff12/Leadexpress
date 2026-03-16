import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useState, useCallback, type ReactNode } from 'react'
import { AuthProvider, useAuth } from './lib/auth'
import { I18nContext, createTranslator, isRtl, type Locale } from './lib/i18n'
import Sidebar from './components/Sidebar'
import Login from './pages/Login'
import ContractorDashboard from './pages/ContractorDashboard'
import LeadsFeed from './pages/LeadsFeed'
import Profile from './pages/Profile'
import Subscription from './pages/Subscription'
import TelegramConnect from './pages/TelegramConnect'
import AdminDashboard from './pages/AdminDashboard'
import AdminContractors from './pages/AdminContractors'
import AdminGroups from './pages/AdminGroups'
import AdminWhatsApp from './pages/AdminWhatsApp'
import AdminLeads from './pages/AdminLeads'
import AdminProspects from './pages/AdminProspects'
import ProspectDetail from './pages/ProspectDetail'
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



function LoadingScreen() {
  return (
    <div className="fixed inset-0 flex items-center justify-center">
      <div className="le-bg" />
      <div className="le-grain" />
      <div className="flex flex-col items-center gap-3 animate-fade-in">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white text-sm"
          style={{ background: 'hsl(155 44% 30%)' }}>
          LE
        </div>
        <div className="text-sm" style={{ color: 'hsl(40 4% 42%)' }}>Loading...</div>
      </div>
    </div>
  )
}

/* ─── App Shell (authenticated pages) ─── */
function AppShell() {
  return (
    <div className="min-h-screen">
      <div className="le-bg" />
      <div className="le-grain" />
      <Sidebar />
      <main className="relative transition-all duration-300"
        style={{ paddingInlineStart: 240 }}>
        <div className="max-w-6xl mx-auto px-6 py-8">
          <Routes>
            <Route path="/" element={<ContractorDashboard />} />
            <Route path="/leads" element={<LeadsFeed />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/subscription" element={<Subscription />} />
            <Route path="/telegram" element={<TelegramConnect />} />
            <Route path="/settings" element={<div className="animate-fade-in"><h1 className="text-xl font-semibold">Settings</h1><p className="mt-2 text-sm" style={{ color: 'hsl(40 4% 42%)' }}>Coming soon.</p></div>} />

            {/* Admin routes */}
            <Route path="/admin" element={<RequireAdmin><AdminDashboard /></RequireAdmin>} />
            <Route path="/admin/contractors" element={<RequireAdmin><AdminContractors /></RequireAdmin>} />
            <Route path="/admin/groups" element={<RequireAdmin><AdminGroups /></RequireAdmin>} />
            <Route path="/admin/whatsapp" element={<RequireAdmin><AdminWhatsApp /></RequireAdmin>} />
            <Route path="/admin/leads" element={<RequireAdmin><AdminLeads /></RequireAdmin>} />
            <Route path="/admin/prospects" element={<RequireAdmin><AdminProspects /></RequireAdmin>} />
            <Route path="/admin/prospects/:id" element={<RequireAdmin><ProspectDetail /></RequireAdmin>} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </main>
    </div>
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
            {/* Language toggle — always visible */}
            <button
              onClick={() => handleSetLocale(locale === 'en' ? 'he' : 'en')}
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

            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/*" element={<RequireAuth><AppShell /></RequireAuth>} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </div>
    </I18nContext.Provider>
  )
}

export default App
