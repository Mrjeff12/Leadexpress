import { lazy, Suspense, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'

const AdminCanvas = lazy(() => import('./admin/AdminCanvas'))
const DepartmentLayout = lazy(() => import('./admin/DepartmentLayout'))
const BotMissionControl = lazy(() => import('../pages/admin/BotMissionControl'))

export default function AdminLayout() {
  // Remove sidebar body classes on mount (cleanup from old layout)
  useEffect(() => {
    document.body.classList.remove('sidebar-collapsed')
  }, [])

  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-screen bg-[#0f0f1a]">
          <div className="animate-spin w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full" />
        </div>
      }
    >
      <Routes>
        <Route path="/" element={<AdminCanvas />} />
        <Route path="/bot" element={<BotMissionControl />} />
        <Route path="/:deptId/*" element={<DepartmentLayout />} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    </Suspense>
  )
}
