import { lazy, Suspense, useEffect, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import AdminSidebar from './admin/AdminSidebar'
import { supabase } from '../lib/supabase'

const AdminCanvas = lazy(() => import('./admin/AdminCanvas'))
const DepartmentLayout = lazy(() => import('./admin/DepartmentLayout'))
const BotMissionControl = lazy(() => import('../pages/admin/BotMissionControl'))
const AdminInbox = lazy(() => import('../pages/AdminInbox'))
const AutomationsFlow = lazy(() => import('../pages/admin/AutomationsFlow'))

/* ── OpenAI Balance Alert Banner ──────────────────────────── */
interface BalanceData {
  status: string
  key_valid: boolean
  remaining_usd: number | null
  usage_this_month_usd: number | null
  is_low: boolean
  is_depleted: boolean
  checked_at: string
}

function OpenAIBalanceBanner() {
  const [data, setData] = useState<BalanceData | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    supabase.from('app_settings').select('value').eq('key', 'openai_balance').maybeSingle()
      .then(({ data: row }) => {
        if (row?.value) {
          try { setData(JSON.parse(row.value)) } catch { /* ignore */ }
        }
      })
  }, [])

  if (dismissed || !data) return null
  if (data.status === 'ok' || data.status === 'unknown') return null

  const isError = data.status === 'depleted' || data.status === 'key_invalid'
  const isWarning = data.status === 'low' || data.status === 'billing_unavailable'

  if (!isError && !isWarning) return null

  return (
    <div className={`px-4 py-2.5 text-sm font-medium flex items-center justify-between ${
      isError ? 'bg-red-500 text-white' : 'bg-amber-400 text-amber-900'
    }`}>
      <span>
        {data.status === 'depleted' && `⛔ OpenAI balance depleted! Lead parsing is stopped.`}
        {data.status === 'key_invalid' && `⛔ OpenAI API key invalid! Lead parsing is stopped.`}
        {data.status === 'low' && `⚠️ OpenAI balance low: $${data.remaining_usd?.toFixed(2)} remaining`}
        {data.status === 'billing_unavailable' && `⚠️ Cannot check OpenAI balance — add OPENAI_ADMIN_KEY to Supabase secrets`}
        {data.usage_this_month_usd != null && ` · Usage this month: $${data.usage_this_month_usd.toFixed(2)}`}
      </span>
      <button onClick={() => setDismissed(true)} className="ml-4 opacity-70 hover:opacity-100 text-lg">✕</button>
    </div>
  )
}

export default function AdminLayout() {
  useEffect(() => {
    document.body.classList.remove('sidebar-collapsed')
  }, [])

  return (
    <>
      <AdminSidebar />
      <div className="admin-main-content h-screen overflow-hidden">
        <OpenAIBalanceBanner />
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
            <Route path="/bot/inbox" element={<AdminInbox />} />
            <Route path="/bot/automations" element={<AutomationsFlow />} />
            <Route path="/:deptId/*" element={<DepartmentLayout />} />
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Routes>
        </Suspense>
      </div>
    </>
  )
}
