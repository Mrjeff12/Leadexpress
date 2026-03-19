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
} from 'lucide-react'

const nodeTypes = { department: DepartmentNode }

/** Spread out more for premium feel — hexagonal-ish layout */
const GRID_POSITIONS: [number, number][] = [
  [50, 0],      [440, -20],    [830, 0],
  [50, 320],    [440, 340],    [830, 320],
]

/** Flow lines connecting related departments */
const EDGES: Edge[] = [
  {
    id: 'e-ch-wr',
    source: 'channels',
    target: 'warroom',
    type: 'smoothstep',
    style: { stroke: '#8b5cf6', strokeWidth: 1.5, strokeDasharray: '8 4' },
    animated: true,
  },
  {
    id: 'e-wr-cl',
    source: 'warroom',
    target: 'clients',
    type: 'smoothstep',
    style: { stroke: '#ff6b35', strokeWidth: 1.5, strokeDasharray: '8 4' },
    animated: true,
  },
  {
    id: 'e-cl-fi',
    source: 'clients',
    target: 'finance',
    type: 'smoothstep',
    style: { stroke: '#10b981', strokeWidth: 1.5, strokeDasharray: '8 4' },
    animated: true,
  },
  {
    id: 'e-fi-in',
    source: 'finance',
    target: 'intel',
    type: 'smoothstep',
    style: { stroke: '#f59e0b', strokeWidth: 1.5, strokeDasharray: '8 4' },
    animated: true,
  },
]

/* ─── KPI Pill for top bar ─── */
function KpiPill({ icon: Icon, label, value, color }: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string | number
  color: string
}) {
  return (
    <div
      className="flex items-center gap-3 px-4 py-2 rounded-lg"
      style={{
        background: `${color}08`,
        border: `1px solid ${color}20`,
      }}
    >
      <Icon className="w-4 h-4 shrink-0" style={{ color }} />
      <div className="flex flex-col">
        <span className="text-[9px] text-white/35 uppercase tracking-[0.12em] leading-none">{label}</span>
        <span className="text-[18px] font-black tabular-nums leading-tight text-white">{value}</span>
      </div>
    </div>
  )
}

/* ─── Bottom stat cell ─── */
function BottomStat({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="flex flex-col items-center px-4">
      <span className="text-[22px] font-black tabular-nums" style={{ color: color ?? '#fff' }}>
        {value}
      </span>
      <span className="text-[9px] text-white/30 uppercase tracking-[0.15em]">{label}</span>
    </div>
  )
}

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

  const totalLeads = Number(kpis.hotLeads ?? 0) + Number(kpis.leadsToday ?? 0)
  const mrr = kpis.mrr ?? 0
  const activeContractors = kpis.activeContractors ?? 0
  const waConnected = kpis.waConnected ?? 0
  const activeGroups = kpis.activeGroups ?? 0
  const convRate = kpis.conversionRate ?? 0
  const activeSubs = kpis.activeSubs ?? 0
  const scansPending = kpis.scansPending ?? 0

  return (
    <div className="h-screen w-screen flex flex-col" style={{ background: '#08081a' }}>

      {/* ═══════════════ TOP BAR ═══════════════ */}
      <div
        className="shrink-0 flex items-center justify-between px-5 h-16 z-10 relative"
        style={{
          background: 'linear-gradient(180deg, #0f0f24 0%, #0a0a1a 100%)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          boxShadow: '0 4px 30px rgba(0,0,0,0.4)',
        }}
      >
        {/* Left: Logo + Performance badge */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <img src="/icon.png" alt="Lead Express" className="w-8 h-8 rounded-lg" />
            <div className="flex flex-col">
              <span className="text-white/90 font-bold text-[13px] tracking-tight">LEAD EXPRESS</span>
              <span className="text-[8px] text-white/20 uppercase tracking-[0.2em]">control center</span>
            </div>
          </div>
          <div className="w-px h-8 bg-white/10 mx-1" />
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20">
            <Activity className="w-3 h-3 text-emerald-400" />
            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
              {he ? 'פעיל' : 'Live Ops'}
            </span>
          </div>
        </div>

        {/* Center: KPI Pills */}
        <div className="flex items-center gap-2">
          <KpiPill icon={Zap} label={he ? 'לידים' : 'LEADS'} value={totalLeads} color="#ff6b35" />
          <KpiPill icon={Users} label={he ? 'קבלנים' : 'CONTRACTORS'} value={activeContractors} color="#10b981" />
          <KpiPill icon={Radio} label={he ? 'קבוצות' : 'GROUPS'} value={activeGroups} color="#8b5cf6" />
          <KpiPill icon={TrendingUp} label={he ? 'המרה' : 'RATE'} value={`${convRate}%`} color="#f59e0b" />
          <KpiPill icon={DollarSign} label="MRR" value={`$${Number(mrr).toLocaleString()}`} color="#22c55e" />
        </div>

        {/* Right: User + Logout */}
        <div className="flex items-center gap-3">
          {profile && (
            <span className="text-white/40 text-[12px]">{profile.full_name}</span>
          )}
          <button
            onClick={signOut}
            className="p-2 rounded-lg hover:bg-white/5 transition-colors text-white/25 hover:text-white/50"
            title={he ? 'התנתק' : 'Log Out'}
          >
            <LogOut className="w-4 h-4" />
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
            fitViewOptions={{ padding: 0.25 }}
            minZoom={0.2}
            maxZoom={2.5}
            proOptions={{ hideAttribution: true }}
            className="!bg-transparent"
            zoomOnScroll
            panOnScroll={false}
            panOnDrag
          >
            <Background color="#ffffff05" gap={30} size={1} />
            <Controls
              showInteractive={false}
              position="bottom-left"
              className="!bg-[#12122a] !border-white/8 !rounded-xl !shadow-2xl
                [&>button]:!bg-transparent [&>button]:!border-white/8
                [&>button]:!text-white/30 [&>button:hover]:!bg-white/5
                [&>button:hover]:!text-white/60"
            />
          </ReactFlow>
        </ReactFlowProvider>

        {/* Loading overlay */}
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#08081a]/80 z-20">
            <div className="flex flex-col items-center gap-3">
              <div className="animate-spin w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full" />
              <span className="text-white/30 text-[11px] uppercase tracking-wider">Loading data...</span>
            </div>
          </div>
        )}
      </div>

      {/* ═══════════════ BOTTOM BAR ═══════════════ */}
      <div
        className="shrink-0 flex items-center justify-between px-6 h-14 z-10"
        style={{
          background: 'linear-gradient(0deg, #0a0a1a 0%, #0f0f24 100%)',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          boxShadow: '0 -4px 30px rgba(0,0,0,0.3)',
        }}
      >
        {/* Left: System status */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
            <span className="text-[10px] text-white/40 uppercase tracking-wider">
              {he ? 'מערכת מחוברת' : 'System Online'}
            </span>
          </div>
          <div className="w-px h-4 bg-white/10" />
          <div className="flex items-center gap-1.5">
            <Wifi className="w-3 h-3 text-emerald-400/60" />
            <span className="text-[10px] text-white/30">
              {waConnected} WA
            </span>
          </div>
        </div>

        {/* Center: Summary stats */}
        <div className="flex items-center gap-0 divide-x divide-white/8">
          <BottomStat label={he ? 'לידים' : 'TOTAL LEADS'} value={totalLeads} color="#ff6b35" />
          <BottomStat label={he ? 'מנויים' : 'ACTIVE SUBS'} value={activeSubs} color="#22c55e" />
          <BottomStat label={he ? 'סריקות' : 'SCANS'} value={scansPending} color="#8b5cf6" />
          <BottomStat label={he ? 'קבוצות' : 'GROUPS'} value={activeGroups} color="#3b82f6" />
        </div>

        {/* Right: Live badge */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/25">
            <Wifi className="w-3 h-3 text-emerald-400" />
            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">LIVE</span>
          </div>
        </div>
      </div>
    </div>
  )
}
