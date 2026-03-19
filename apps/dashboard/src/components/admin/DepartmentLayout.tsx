import { lazy, Suspense, useMemo, useEffect } from 'react'
import { Routes, Route, Navigate, NavLink, useNavigate, useParams } from 'react-router-dom'
import { useI18n } from '../../lib/i18n'
import { getDepartment } from '../../config/departmentConfig'
import { ArrowRight, ArrowLeft, LayoutGrid } from 'lucide-react'

const AdminInbox = lazy(() => import('../../pages/AdminInbox'))
const AdminLeads = lazy(() => import('../../pages/AdminLeads'))
const AdminProspects = lazy(() => import('../../pages/AdminProspects'))
const ProspectDetail = lazy(() => import('../../pages/ProspectDetail'))
const AdminContractors = lazy(() => import('../../pages/AdminContractors'))
const ContractorDetail = lazy(() => import('../../pages/admin/ContractorDetail'))
const ServiceAreas = lazy(() => import('../../pages/admin/ServiceAreas'))
const LeadsMap = lazy(() => import('../../pages/admin/LeadsMap'))
const AdminWhatsApp = lazy(() => import('../../pages/AdminWhatsApp'))
const AdminGroups = lazy(() => import('../../pages/AdminGroups'))
const AdminGroupDetail = lazy(() => import('../../pages/AdminGroupDetail'))
const AdminGroupScanQueue = lazy(() => import('../../pages/AdminGroupScanQueue'))
const MessageTemplates = lazy(() => import('../../pages/admin/MessageTemplates'))
const Subscriptions = lazy(() => import('../../pages/admin/Subscriptions'))
const Revenue = lazy(() => import('../../pages/admin/Revenue'))
const Analytics = lazy(() => import('../../pages/admin/Analytics'))
const ActivityLog = lazy(() => import('../../pages/admin/ActivityLog'))
const Professions = lazy(() => import('../../pages/admin/Professions'))
const SystemSettings = lazy(() => import('../../pages/admin/SystemSettings'))

const TAB_COMPONENTS: Record<string, React.LazyExoticComponent<() => JSX.Element>> = {
  'warroom/inbox': AdminInbox,
  'warroom/leads': AdminLeads,
  'warroom/prospects': AdminProspects,
  'clients/contractors': AdminContractors,
  'clients/service-areas': ServiceAreas,
  'clients/map': LeadsMap,
  'channels/whatsapp': AdminWhatsApp,
  'channels/groups': AdminGroups,
  'channels/scan': AdminGroupScanQueue,
  'channels/templates': MessageTemplates,
  'finance/subscriptions': Subscriptions,
  'finance/revenue': Revenue,
  'intel/analytics': Analytics,
  'intel/activity': ActivityLog,
  'settings/professions': Professions,
  'settings/system': SystemSettings,
}

export default function DepartmentLayout() {
  const { deptId } = useParams<{ deptId: string }>()
  const navigate = useNavigate()
  const { locale } = useI18n()
  const he = locale === 'he'

  const dept = useMemo(() => getDepartment(deptId ?? ''), [deptId])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') navigate('/admin')
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [navigate])

  if (!dept) return <Navigate to="/admin" replace />

  const BackArrow = he ? ArrowRight : ArrowLeft
  const basePath = `/admin/${dept.basePath}`
  const Icon = dept.icon

  return (
    <div
      className="h-screen w-full flex flex-col overflow-hidden"
      style={{ background: 'linear-gradient(180deg, #08081a 0%, #0a0a22 100%)' }}
    >
      {/* ═══════════════ TOP NAV BAR ═══════════════ */}
      <div
        className="shrink-0 flex items-center gap-3 px-5 h-[52px]"
        style={{
          background: 'rgba(12,12,28,0.9)',
          borderBottom: `1px solid ${dept.color}15`,
          backdropFilter: 'blur(20px)',
          boxShadow: '0 4px 30px rgba(0,0,0,0.4)',
        }}
      >
        {/* Back to map */}
        <button
          onClick={() => navigate('/admin')}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all duration-200 hover:bg-white/5 group"
          style={{ color: dept.color }}
        >
          <LayoutGrid className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100 transition-opacity" />
          <BackArrow className="w-3 h-3 opacity-40" />
        </button>

        {/* Divider */}
        <div className="w-px h-6 bg-white/8" />

        {/* Department name */}
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{
              background: `${dept.color}15`,
              border: `1px solid ${dept.color}25`,
            }}
          >
            <Icon className="w-3.5 h-3.5" style={{ color: dept.color }} />
          </div>
          <span
            className="text-[12px] font-extrabold uppercase tracking-[0.08em]"
            style={{ color: dept.color }}
          >
            {he ? dept.nameHe : dept.nameEn}
          </span>
        </div>

        {/* Divider */}
        <div className="w-px h-6 bg-white/8" />

        {/* Tabs */}
        <nav className="flex items-center gap-0.5" dir={he ? 'rtl' : 'ltr'}>
          {dept.tabs.map((tab) => {
            const to = tab.path ? `${basePath}/${tab.path}` : basePath
            return (
              <NavLink
                key={tab.key}
                to={to}
                end={!tab.path}
                className={({ isActive }) =>
                  `relative px-3.5 py-1.5 rounded-lg text-[12px] font-semibold transition-all duration-200 ${
                    isActive
                      ? 'text-white'
                      : 'text-white/30 hover:text-white/60 hover:bg-white/3'
                  }`
                }
                style={({ isActive }) =>
                  isActive
                    ? {
                        background: `${dept.color}18`,
                        border: `1px solid ${dept.color}25`,
                        boxShadow: `0 0 12px ${dept.color}10`,
                      }
                    : { border: '1px solid transparent' }
                }
              >
                {he ? tab.labelHe : tab.labelEn}
              </NavLink>
            )
          })}
        </nav>
      </div>

      {/* ═══════════════ CONTENT ═══════════════ */}
      <main className="flex-1 overflow-hidden">
        <Suspense
          fallback={
            <div className="flex items-center justify-center h-full">
              <div className="flex flex-col items-center gap-3">
                <div className="relative w-8 h-8">
                  <div className="absolute inset-0 border-2 rounded-full" style={{ borderColor: `${dept.color}20` }} />
                  <div
                    className="absolute inset-0 border-2 border-t-transparent rounded-full animate-spin"
                    style={{ borderColor: dept.color, borderTopColor: 'transparent' }}
                  />
                </div>
                <span className="text-white/20 text-[10px] uppercase tracking-[0.15em]">
                  Loading...
                </span>
              </div>
            </div>
          }
        >
          <Routes>
            {dept.tabs.map((tab) => {
              const Comp = TAB_COMPONENTS[`${dept.id}/${tab.key}`]
              if (!Comp) return null
              return (
                <Route
                  key={tab.key}
                  path={tab.path || '/'}
                  element={
                    <div
                      className={
                        tab.fullBleed
                          ? 'h-full overflow-hidden'
                          : 'max-w-6xl mx-auto w-full px-6 py-8 h-full overflow-y-auto'
                      }
                    >
                      <Comp />
                    </div>
                  }
                />
              )
            })}

            {dept.id === 'warroom' && (
              <Route path="prospects/:id" element={<div className="max-w-6xl mx-auto w-full px-6 py-8 h-full overflow-y-auto"><ProspectDetail /></div>} />
            )}
            {dept.id === 'clients' && (
              <Route path="contractors/:id" element={<div className="max-w-6xl mx-auto w-full px-6 py-8 h-full overflow-y-auto"><ContractorDetail /></div>} />
            )}
            {dept.id === 'channels' && (
              <Route path="groups/:id" element={<div className="max-w-6xl mx-auto w-full px-6 py-8 h-full overflow-y-auto"><AdminGroupDetail /></div>} />
            )}

            <Route path="*" element={<Navigate to={basePath} replace />} />
          </Routes>
        </Suspense>
      </main>
    </div>
  )
}
