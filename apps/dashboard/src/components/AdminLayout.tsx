import { lazy, Suspense, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import AdminSidebar from './admin/AdminSidebar'

const AdminCanvas = lazy(() => import('./admin/AdminCanvas'))
const DepartmentLayout = lazy(() => import('./admin/DepartmentLayout'))
const BotMissionControl = lazy(() => import('../pages/admin/BotMissionControl'))
const ChatWarRoom = lazy(() => import('../pages/admin/ChatWarRoom'))
const AdminInbox = lazy(() => import('../pages/AdminInbox'))
const AutomationsFlow = lazy(() => import('../pages/admin/AutomationsFlow'))

export default function AdminLayout() {
  useEffect(() => {
    document.body.classList.remove('sidebar-collapsed')
  }, [])

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <AdminSidebar />
      <div className="flex-1 overflow-hidden">
        <Suspense
          fallback={
            <div className="flex items-center justify-center h-screen bg-[#faf9f6]">
              <div className="animate-spin w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full" />
            </div>
          }
        >
          <Routes>
            <Route path="/" element={<AdminCanvas />} />
            <Route path="/bot" element={<BotMissionControl />} />
            <Route path="/bot/warroom" element={<ChatWarRoom />} />
            <Route path="/bot/inbox" element={<AdminInbox />} />
            <Route path="/bot/automations" element={<AutomationsFlow />} />
            <Route path="/:deptId/*" element={<DepartmentLayout />} />
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Routes>
        </Suspense>
      </div>
    </div>
  )
}
