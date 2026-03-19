import { lazy, Suspense, useMemo, useEffect } from 'react'
import { Routes, Route, Navigate, NavLink, useNavigate, useParams } from 'react-router-dom'
import { useI18n } from '../../lib/i18n'
import { getDepartment } from '../../config/departmentConfig'
import { ArrowRight, ArrowLeft } from 'lucide-react'

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

  // Escape key returns to canvas
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

  return (
    <div className="h-screen w-full flex flex-col overflow-hidden" style={{ background: '#0f0f1a' }}>
      <div
        className="flex items-center gap-4 px-6 h-14 shrink-0"
        style={{ borderBottom: `1px solid ${dept.color}20` }}
      >
        <button
          onClick={() => navigate('/admin')}
          className="flex items-center gap-1.5 text-[14px] transition-colors hover:opacity-80"
          style={{ color: dept.color }}
        >
          <BackArrow className="w-4 h-4" />
          <span>{he ? 'חזרה למפה' : 'Back to Map'}</span>
        </button>

        <div className="w-px h-5 bg-white/10" />

        <nav className="flex items-center gap-1" dir={he ? 'rtl' : 'ltr'}>
          {dept.tabs.map((tab) => {
            const to = tab.path ? `${basePath}/${tab.path}` : basePath
            return (
              <NavLink
                key={tab.key}
                to={to}
                end={!tab.path}
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all ${
                    isActive
                      ? 'text-white'
                      : 'text-white/40 hover:text-white/70'
                  }`
                }
                style={({ isActive }) =>
                  isActive ? { background: `${dept.color}25` } : {}
                }
              >
                {he ? tab.labelHe : tab.labelEn}
              </NavLink>
            )
          })}
        </nav>
      </div>

      <main className="flex-1 overflow-hidden">
        <Suspense
          fallback={
            <div className="flex items-center justify-center h-full">
              <div
                className="animate-spin w-8 h-8 border-2 border-t-transparent rounded-full"
                style={{ borderColor: dept.color, borderTopColor: 'transparent' }}
              />
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
