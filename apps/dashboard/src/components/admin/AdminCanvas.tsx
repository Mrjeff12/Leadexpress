import { useMemo, useCallback } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  type Node,
  type Edge,
  ReactFlowProvider,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useAuth } from '../../lib/auth'
import { useI18n } from '../../lib/i18n'
import { useAdminKPIs } from '../../hooks/useAdminKPIs'
import { departments } from '../../config/departmentConfig'
import DepartmentNode from './DepartmentNode'
import {
  LogOut,
  Zap,
  Users,
  DollarSign,
  Radio,
  TrendingUp,
  Wifi,
  Activity,
  Phone,
  BarChart3,
} from 'lucide-react'

const nodeTypes = { department: DepartmentNode }

/* ─── Layout: staggered for visual depth ─── */
const GRID_POSITIONS: [number, number][] = [
  [0, 0],       [420, -30],    [840, 10],
  [60, 340],    [420, 360],    [840, 330],
]

/* ─── Flow edges with department colors ─── */
const EDGES: Edge[] = [
  { id: 'e1', source: 'channels', target: 'warroom', type: 'smoothstep', animated: true,
    style: { stroke: '#8b5cf6', strokeWidth: 1.5 } },
  { id: 'e2', source: 'warroom', target: 'clients', type: 'smoothstep', animated: true,
    style: { stroke: '#ff6b35', strokeWidth: 1.5 } },
  { id: 'e3', source: 'clients', target: 'finance', type: 'smoothstep', animated: true,
    style: { stroke: '#10b981', strokeWidth: 1.5 } },
  { id: 'e4', source: 'finance', target: 'intel', type: 'smoothstep', animated: true,
    style: { stroke: '#f59e0b', strokeWidth: 1.5 } },
  { id: 'e5', source: 'warroom', target: 'intel', type: 'smoothstep', animated: true,
    style: { stroke: '#3b82f650', strokeWidth: 1 } },
]

/* ═══════════════════════════════════════════════════════════
   Top-bar KPI pill (Biotix-style)
   ═══════════════════════════════════════════════════════════ */
function KpiPill({ icon: Icon, label, value, color, highlight }: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string | number
  color: string
  highlight?: boolean
}) {
  return (
    <div
      className="flex items-center gap-2.5 px-3.5 py-2 rounded-lg transition-all duration-300 hover:scale-[1.02]"
      style={{
        background: highlight ? `${color}12` : 'rgba(255,255,255,0.02)',
        border: `1px solid ${highlight ? color + '30' : 'rgba(255,255,255,0.06)'}`,
      }}
    >
      <Icon className="w-3.5 h-3.5 shrink-0 opacity-60" style={{ color }} />
      <div className="flex flex-col min-w-0">
        <span className="text-[8px] text-white/30 uppercase tracking-[0.15em] leading-none font-medium">{label}</span>
        <span
          className="text-[17px] font-black tabular-nums leading-tight"
          style={{ color: highlight ? color : '#fff' }}
        >
          {value}
        </span>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   Bottom-bar stat cell
   ═══════════════════════════════════════════════════════════ */
function BottomStat({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="flex flex-col items-center px-5">
      <span className="text-[20px] font-black tabular-nums leading-tight" style={{ color: color ?? '#fff' }}>
        {value}
      </span>
      <span className="text-[8px] text-white/25 uppercase tracking-[0.15em] font-medium">{label}</span>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   Main Canvas
   ═══════════════════════════════════════════════════════════ */
export default function AdminCanvas() {
  const { profile, signOut } = useAuth()
  const { locale } = useI18n()
  const { data: kpis, loading } = useAdminKPIs()
  const he = locale === 'he'

  const nodes: Node[] = useMemo(
    () =>
      departments.map((dept, i) => ({
        id: dept.id,
        type: 'department',
        position: { x: GRID_POSITIONS[i][0], y: GRID_POSITIONS[i][1] },
        draggable: false,
        selectable: false,
        data: { department: dept, kpis, locale },
      })),
    [kpis, locale],
  )

  const onNodeClick = useCallback(() => {}, [])

  // Computed KPIs
  const totalLeads = Number(kpis.hotLeads ?? 0) + Number(kpis.leadsOnMap ?? 0)
  const mrr = Number(kpis.mrr ?? 0)
  const activeContractors = Number(kpis.activeContractors ?? 0)
  const waConnected = Number(kpis.waConnected ?? 0)
  const activeGroups = Number(kpis.activeGroups ?? 0)
  const convRate = Number(kpis.conversionRate ?? 0)
  const activeSubs = Number(kpis.activeSubs ?? 0)
  const scansPending = Number(kpis.scansPending ?? 0)
  const leadsToday = Number(kpis.leadsToday ?? 0)
  const hotLeads = Number(kpis.hotLeads ?? 0)

  return (
    <div
      className="h-screen w-screen flex flex-col"
      style={{
        background: 'linear-gradient(180deg, #08081a 0%, #0a0a22 50%, #06061a 100%)',
      }}
    >
      {/* ═══════════════ TOP BAR ═══════════════ */}
      <div
        className="shrink-0 flex items-center justify-between px-4 h-[60px] z-10 relative"
        style={{
          background: 'linear-gradient(180deg, rgba(12,12,30,0.95) 0%, rgba(8,8,24,0.9) 100%)',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
          backdropFilter: 'blur(20px)',
          boxShadow: '0 4px 30px rgba(0,0,0,0.5)',
        }}
      >
        {/* Left: Logo + LIVE OPS */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <img src="/icon.png" alt="Lead Express" className="w-7 h-7 rounded-lg" />
            <div className="flex flex-col leading-none">
              <span className="text-white/80 font-extrabold text-[12px] tracking-[0.05em]">LEAD EXPRESS</span>
              <span className="text-[7px] text-white/15 uppercase tracking-[0.25em]">control center</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 ml-1">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
            <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-[0.12em]">
              {he ? 'פעיל' : 'Live Ops'}
            </span>
          </div>
        </div>

        {/* Center: KPI strip */}
        <div className="flex items-center gap-1.5">
          <KpiPill icon={Zap} label={he ? 'לידים חמים' : 'HOT LEADS'} value={hotLeads} color="#ff6b35" highlight={hotLeads > 0} />
          <div className="w-px h-6 bg-white/5" />
          <KpiPill icon={Users} label={he ? 'קבלנים' : 'CONTRACTORS'} value={activeContractors} color="#10b981" />
          <div className="w-px h-6 bg-white/5" />
          <KpiPill icon={Radio} label={he ? 'קבוצות' : 'GROUPS'} value={activeGroups} color="#8b5cf6" />
          <div className="w-px h-6 bg-white/5" />
          <KpiPill icon={TrendingUp} label={he ? 'המרה' : 'RATE'} value={`${convRate}%`} color="#f59e0b" />
          <div className="w-px h-6 bg-white/5" />
          <KpiPill icon={DollarSign} label="MRR" value={`$${mrr.toLocaleString()}`} color="#22c55e" highlight={mrr > 0} />
        </div>

        {/* Right: User */}
        <div className="flex items-center gap-2 shrink-0">
          {profile && (
            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white/3 border border-white/5">
              <div className="w-6 h-6 rounded-md bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center text-[10px] font-bold text-white/50">
                {profile.full_name?.charAt(0)?.toUpperCase() ?? '?'}
              </div>
              <span className="text-white/35 text-[11px] font-medium">{profile.full_name}</span>
            </div>
          )}
          <button
            onClick={signOut}
            className="p-2 rounded-lg hover:bg-white/5 transition-colors text-white/20 hover:text-white/50"
            title={he ? 'התנתק' : 'Log Out'}
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ═══════════════ CANVAS ═══════════════ */}
      <div className="flex-1 relative overflow-hidden">
        {/* Ambient glow spots */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-[10%] left-[15%] w-[400px] h-[400px] rounded-full opacity-[0.03]"
            style={{ background: 'radial-gradient(circle, #ff6b35, transparent 70%)' }} />
          <div className="absolute bottom-[20%] right-[20%] w-[500px] h-[500px] rounded-full opacity-[0.02]"
            style={{ background: 'radial-gradient(circle, #8b5cf6, transparent 70%)' }} />
          <div className="absolute top-[50%] left-[50%] w-[600px] h-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-[0.015]"
            style={{ background: 'radial-gradient(circle, #3b82f6, transparent 70%)' }} />
        </div>

        <ReactFlowProvider>
          <ReactFlow
            nodes={nodes}
            edges={EDGES}
            nodeTypes={nodeTypes}
            onNodeClick={onNodeClick}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            minZoom={0.15}
            maxZoom={2.5}
            proOptions={{ hideAttribution: true }}
            className="!bg-transparent"
            zoomOnScroll
            panOnScroll={false}
            panOnDrag
          >
            <Background color="#ffffff04" gap={25} size={1} />
            <Controls
              showInteractive={false}
              position="bottom-left"
              className="!bg-[#0c0c22] !border-white/6 !rounded-xl !shadow-2xl
                [&>button]:!bg-transparent [&>button]:!border-white/6
                [&>button]:!text-white/20 [&>button:hover]:!bg-white/5
                [&>button:hover]:!text-white/50"
            />
          </ReactFlow>
        </ReactFlowProvider>

        {/* Loading */}
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#08081a]/90 z-20 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-3">
              <div className="relative w-10 h-10">
                <div className="absolute inset-0 border-2 border-orange-500/20 rounded-full" />
                <div className="absolute inset-0 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
              </div>
              <span className="text-white/25 text-[10px] uppercase tracking-[0.2em] font-medium">
                Loading systems...
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ═══════════════ BOTTOM BAR ═══════════════ */}
      <div
        className="shrink-0 flex items-center justify-between px-5 h-12 z-10"
        style={{
          background: 'linear-gradient(0deg, rgba(8,8,24,0.95) 0%, rgba(12,12,28,0.9) 100%)',
          borderTop: '1px solid rgba(255,255,255,0.04)',
          backdropFilter: 'blur(20px)',
          boxShadow: '0 -4px 30px rgba(0,0,0,0.4)',
        }}
      >
        {/* Left: System status */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div className="w-[6px] h-[6px] rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.7)]" />
            <span className="text-[9px] text-white/30 uppercase tracking-[0.12em] font-medium">
              {he ? 'מערכת מחוברת' : 'System Online'}
            </span>
          </div>
          <div className="w-px h-3 bg-white/8" />
          <div className="flex items-center gap-1">
            <Phone className="w-3 h-3 text-emerald-400/50" />
            <span className="text-[9px] text-white/25 tabular-nums">{waConnected} WA</span>
          </div>
          <div className="w-px h-3 bg-white/8" />
          <div className="flex items-center gap-1">
            <BarChart3 className="w-3 h-3 text-blue-400/50" />
            <span className="text-[9px] text-white/25 tabular-nums">{leadsToday} {he ? 'היום' : 'today'}</span>
          </div>
        </div>

        {/* Center: Key metrics */}
        <div className="flex items-center divide-x divide-white/6">
          <BottomStat label={he ? 'לידים' : 'LEADS'} value={totalLeads} color="#ff6b35" />
          <BottomStat label={he ? 'מנויים' : 'SUBS'} value={activeSubs} color="#22c55e" />
          <BottomStat label={he ? 'סריקות' : 'SCANS'} value={scansPending} color="#8b5cf6" />
          <BottomStat label={he ? 'קבוצות' : 'GROUPS'} value={activeGroups} color="#3b82f6" />
        </div>

        {/* Right: LIVE badge */}
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/8 border border-emerald-500/20">
          <Wifi className="w-3 h-3 text-emerald-400/80" />
          <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-[0.12em]">LIVE</span>
        </div>
      </div>
    </div>
  )
}
