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
  Phone,
  BarChart3,
  Handshake,
} from 'lucide-react'

const nodeTypes = { department: DepartmentNode }

/* ─── Layout: staggered for visual depth ─── */
const GRID_POSITIONS: [number, number][] = [
  [0, 0],       [420, -30],    [840, 10],
  [60, 340],    [420, 360],    [840, 330],
  [1260, 170],
]

/* ─── Flow edges with department colors ─── */
const EDGES: Edge[] = [
  { id: 'e1', source: 'channels', target: 'warroom', type: 'smoothstep',
    style: { stroke: '#e5e5e5', strokeWidth: 1.5, strokeDasharray: '6 4' } },
  { id: 'e2', source: 'warroom', target: 'clients', type: 'smoothstep',
    style: { stroke: '#e5e5e5', strokeWidth: 1.5, strokeDasharray: '6 4' } },
  { id: 'e3', source: 'clients', target: 'finance', type: 'smoothstep',
    style: { stroke: '#e5e5e5', strokeWidth: 1.5, strokeDasharray: '6 4' } },
  { id: 'e4', source: 'finance', target: 'intel', type: 'smoothstep',
    style: { stroke: '#e5e5e5', strokeWidth: 1.5, strokeDasharray: '6 4' } },
  { id: 'e5', source: 'warroom', target: 'intel', type: 'smoothstep',
    style: { stroke: '#e5e5e5', strokeWidth: 1, strokeDasharray: '6 4' } },
  { id: 'e6', source: 'finance', target: 'partners', type: 'smoothstep',
    style: { stroke: '#e5e5e5', strokeWidth: 1.5, strokeDasharray: '6 4' } },
]

/* ═══════════════════════════════════════════════════════════
   Top-bar KPI pill (Biotix-style)
   ═══════════════════════════════════════════════════════════ */
function KpiPill({ icon: Icon, label, value, color, highlight }: {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>
  label: string
  value: string | number
  color: string
  highlight?: boolean
}) {
  return (
    <div
      className="flex items-center gap-2.5 px-3.5 py-2 rounded-lg transition-all duration-300 hover:scale-[1.02]"
      style={{
        background: highlight ? `${color}08` : '#f5f2ed',
        border: `1px solid ${highlight ? color + '20' : '#efeff1'}`,
      }}
    >
      <Icon className="w-3.5 h-3.5 shrink-0 opacity-60" style={{ color }} />
      <div className="flex flex-col min-w-0">
        <span className="text-[8px] text-[#3b3b3b]/50 uppercase tracking-[0.15em] leading-none font-medium">{label}</span>
        <span
          className="text-[17px] font-black tabular-nums leading-tight"
          style={{ color: highlight ? color : '#0b0707' }}
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
      <span className="text-[20px] font-black tabular-nums leading-tight" style={{ color: color ?? '#0b0707' }}>
        {value}
      </span>
      <span className="text-[8px] text-[#3b3b3b]/40 uppercase tracking-[0.15em] font-medium">{label}</span>
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
  const activePartners = Number(kpis.activePartners ?? 0)
  const pendingPartners = Number(kpis.pendingPartners ?? 0)

  return (
    <div
      className="h-screen w-screen flex flex-col"
      style={{
        background: '#faf9f6',
      }}
    >
      {/* ═══════════════ TOP BAR ═══════════════ */}
      <div
        className="shrink-0 flex items-center justify-between px-4 h-[60px] z-10 relative"
        style={{
          background: '#ffffff',
          borderBottom: '1px solid #efeff1',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        }}
      >
        {/* Left: Logo + LIVE OPS */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <img src="/icon.png" alt="Lead Express" className="w-7 h-7 rounded-lg" />
            <div className="flex flex-col leading-none">
              <span className="text-[#0b0707]/80 font-extrabold text-[12px] tracking-[0.05em]">LEAD EXPRESS</span>
              <span className="text-[7px] text-[#3b3b3b]/30 uppercase tracking-[0.25em]">control center</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#fe5b25]/10 border border-[#fe5b25]/20 ml-1">
            <div className="w-1.5 h-1.5 rounded-full bg-[#fe5b25] animate-pulse shadow-[0_0_6px_rgba(254,91,37,0.8)]" />
            <span className="text-[9px] font-bold text-[#fe5b25] uppercase tracking-[0.12em]">
              {he ? 'פעיל' : 'Live Ops'}
            </span>
          </div>
        </div>

        {/* Center: KPI strip */}
        <div className="flex items-center gap-1.5">
          <KpiPill icon={Zap} label={he ? 'לידים חמים' : 'HOT LEADS'} value={hotLeads} color="#ff6b35" highlight={hotLeads > 0} />
          <div className="w-px h-6 bg-[#efeff1]" />
          <KpiPill icon={Users} label={he ? 'קבלנים' : 'CONTRACTORS'} value={activeContractors} color="#10b981" />
          <div className="w-px h-6 bg-[#efeff1]" />
          <KpiPill icon={Radio} label={he ? 'קבוצות' : 'GROUPS'} value={activeGroups} color="#8b5cf6" />
          <div className="w-px h-6 bg-[#efeff1]" />
          <KpiPill icon={TrendingUp} label={he ? 'המרה' : 'RATE'} value={`${convRate}%`} color="#f59e0b" />
          <div className="w-px h-6 bg-[#efeff1]" />
          <KpiPill icon={DollarSign} label="MRR" value={`$${mrr.toLocaleString()}`} color="#22c55e" highlight={mrr > 0} />
          <div className="w-px h-6 bg-[#efeff1]" />
          <KpiPill icon={Handshake} label={he ? 'שותפים' : 'PARTNERS'} value={activePartners} color="#ec4899" highlight={pendingPartners > 0} />
        </div>

        {/* Right: User */}
        <div className="flex items-center gap-2 shrink-0">
          {profile && (
            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-[#f5f2ed] border border-[#efeff1]">
              <div className="w-6 h-6 rounded-md bg-[#efeff1] flex items-center justify-center text-[10px] font-bold text-[#0b0707]/50">
                {profile.full_name?.charAt(0)?.toUpperCase() ?? '?'}
              </div>
              <span className="text-[#3b3b3b]/60 text-[11px] font-medium">{profile.full_name}</span>
            </div>
          )}
          <button
            onClick={signOut}
            className="p-2 rounded-lg hover:bg-[#f5f2ed] transition-colors text-[#3b3b3b]/30 hover:text-[#3b3b3b]/60"
            title={he ? 'התנתק' : 'Log Out'}
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ═══════════════ CANVAS ═══════════════ */}
      <div className="flex-1 relative overflow-hidden">
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
            <Background color="#e5e5e5" gap={30} size={1} />
            <Controls
              showInteractive={false}
              position="bottom-left"
              className="!bg-white !border-[#efeff1] !rounded-xl !shadow-md
                [&>button]:!bg-transparent [&>button]:!border-[#efeff1]
                [&>button]:!text-[#3b3b3b]/30 [&>button:hover]:!bg-[#f5f2ed]
                [&>button:hover]:!text-[#3b3b3b]/60"
            />
          </ReactFlow>
        </ReactFlowProvider>

        {/* Loading */}
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#faf9f6]/90 z-20 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-3">
              <div className="relative w-10 h-10">
                <div className="absolute inset-0 border-2 border-[#fe5b25]/20 rounded-full" />
                <div className="absolute inset-0 border-2 border-[#fe5b25] border-t-transparent rounded-full animate-spin" />
              </div>
              <span className="text-[#3b3b3b]/40 text-[10px] uppercase tracking-[0.2em] font-medium">
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
          background: '#ffffff',
          borderTop: '1px solid #efeff1',
          boxShadow: '0 -1px 3px rgba(0,0,0,0.05)',
        }}
      >
        {/* Left: System status */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div className="w-[6px] h-[6px] rounded-full bg-emerald-500 animate-pulse shadow-[0_0_4px_rgba(52,211,153,0.5)]" />
            <span className="text-[9px] text-[#3b3b3b]/40 uppercase tracking-[0.12em] font-medium">
              {he ? 'מערכת מחוברת' : 'System Online'}
            </span>
          </div>
          <div className="w-px h-3 bg-[#efeff1]" />
          <div className="flex items-center gap-1">
            <Phone className="w-3 h-3 text-emerald-500/40" />
            <span className="text-[9px] text-[#3b3b3b]/35 tabular-nums">{waConnected} WA</span>
          </div>
          <div className="w-px h-3 bg-[#efeff1]" />
          <div className="flex items-center gap-1">
            <BarChart3 className="w-3 h-3 text-blue-500/40" />
            <span className="text-[9px] text-[#3b3b3b]/35 tabular-nums">{leadsToday} {he ? 'היום' : 'today'}</span>
          </div>
        </div>

        {/* Center: Key metrics */}
        <div className="flex items-center divide-x divide-[#efeff1]">
          <BottomStat label={he ? 'לידים' : 'LEADS'} value={totalLeads} color="#ff6b35" />
          <BottomStat label={he ? 'מנויים' : 'SUBS'} value={activeSubs} color="#22c55e" />
          <BottomStat label={he ? 'סריקות' : 'SCANS'} value={scansPending} color="#8b5cf6" />
          <BottomStat label={he ? 'קבוצות' : 'GROUPS'} value={activeGroups} color="#3b82f6" />
          <BottomStat label={he ? 'שותפים' : 'PARTNERS'} value={activePartners} color="#ec4899" />
        </div>

        {/* Right: LIVE badge */}
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#fe5b25]/10 border border-[#fe5b25]/20">
          <Wifi className="w-3 h-3 text-[#fe5b25]/80" />
          <span className="text-[9px] font-bold text-[#fe5b25] uppercase tracking-[0.12em]">LIVE</span>
        </div>
      </div>
    </div>
  )
}
