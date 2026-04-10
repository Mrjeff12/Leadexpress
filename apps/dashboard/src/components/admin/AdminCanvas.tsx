import { useMemo, useState, useCallback, useRef } from 'react'
import { useAuth } from '../../lib/auth'
import { useI18n } from '../../lib/i18n'
import { useAdminKPIs } from '../../hooks/useAdminKPIs'
import { useNetworkData } from '../../hooks/useNetworkData'
import { useDateFilter, type DatePreset } from '../../hooks/useDateFilter'
import { useBotStatus } from '../../hooks/useBotStatus'
import { useCanvasTransform } from '../../hooks/useCanvasTransform'
import { useNavigate } from 'react-router-dom'
import {
  LogOut,
  Zap,
  Users,
  DollarSign,
  Radio,
  TrendingUp,
  Wifi,
  BarChart3,
  Handshake,
  Coins,
  Settings,
  Brain,
  Briefcase,
  MessageCircle,
  X,
  Clock,
  Calendar,
  Maximize2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'

/* ═══════════════════════════════════════════════════════════
   Solar System Dashboard — Redesigned
   ═══════════════════════════════════════════════════════════
   Main pipeline: Groups → AI (merged Brain+Bot) → Contractors
   WA accounts ring around Groups
   Pending badge on Groups
   Date filter in top bar affecting filtered KPIs
   Bottom bar = operational status only
*/

const VW = 1400
const VH = 800

/* ─── Hub definitions ─── */
interface HubDef {
  id: string
  x: number
  y: number
  size: number
  color: string
  gradient: [string, string]
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>
  path: string
}

const HUBS: HubDef[] = [
  // AI (merged Brain + Bot) — center, the largest node
  { id: 'brain', x: 450, y: 380, size: 84, color: '#fe5b25',
    gradient: ['#ff8a5c', '#e04d1c'], icon: Brain, path: '/admin/bot' },

  // Groups — left side
  { id: 'channels', x: 160, y: 380, size: 60, color: '#8b5cf6',
    gradient: ['#a78bfa', '#7c3aed'], icon: MessageCircle, path: '/admin/channels' },

  // Contractors — right side
  { id: 'clients', x: 800, y: 380, size: 60, color: '#10b981',
    gradient: ['#34d399', '#059669'], icon: Users, path: '/admin/clients' },

  // Jobs — between Contractors and Finance
  { id: 'jobs', x: 1050, y: 460, size: 52, color: '#6366f1',
    gradient: ['#818cf8', '#4f46e5'], icon: Briefcase, path: '/admin/jobs' },

  // Finance — bottom center
  { id: 'finance', x: 450, y: 660, size: 44, color: '#f59e0b',
    gradient: ['#fbbf24', '#d97706'], icon: Coins, path: '/admin/finance' },

  // Partners — bottom left
  { id: 'partners', x: 230, y: 660, size: 44, color: '#ec4899',
    gradient: ['#f472b6', '#db2777'], icon: Handshake, path: '/admin/partners' },

  // Intel — bottom right
  { id: 'intel', x: 640, y: 660, size: 44, color: '#3b82f6',
    gradient: ['#60a5fa', '#2563eb'], icon: BarChart3, path: '/admin/channels/leads' },

  // Settings — far bottom right
  { id: 'settings', x: 1200, y: 680, size: 36, color: '#6b7280',
    gradient: ['#9ca3af', '#4b5563'], icon: Settings, path: '/admin/settings' },
]

function getHub(id: string) { return HUBS.find(h => h.id === id)! }

/* ─── Pipeline connections ─── */
const CONNECTIONS: { from: string; to: string; width: number; animated?: boolean }[] = [
  { from: 'channels', to: 'brain', width: 3, animated: true },
  { from: 'brain', to: 'clients', width: 3.5, animated: true },
  { from: 'clients', to: 'jobs', width: 2.5, animated: true },
  { from: 'jobs', to: 'finance', width: 2, animated: true },
  { from: 'brain', to: 'intel', width: 1.5, animated: true },
  { from: 'brain', to: 'finance', width: 1.5, animated: true },
  { from: 'partners', to: 'clients', width: 1.5 },
  { from: 'settings', to: 'brain', width: 1 },
]

const PROF_RING_R = 155

/* ═══════════════════════════════════════════════════════════
   Date Filter Bar
   ═══════════════════════════════════════════════════════════ */
function DateFilterBar({ preset, onSelect, he }: {
  preset: DatePreset
  onSelect: (p: DatePreset) => void
  he: boolean
}) {
  const presets: { key: DatePreset; label: string }[] = [
    { key: 'today', label: he ? 'היום' : 'Today' },
    { key: 'yesterday', label: he ? 'אתמול' : 'Yesterday' },
    { key: '7days', label: he ? '7 ימים' : '7 Days' },
    { key: 'custom', label: he ? 'מותאם' : 'Custom' },
  ]

  return (
    <div className="flex items-center gap-1">
      {presets.map(p => (
        <button
          key={p.key}
          onClick={() => onSelect(p.key)}
          className="px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all duration-200 cursor-pointer"
          style={{
            background: preset === p.key ? '#fe5b25' : '#f5f2ed',
            color: preset === p.key ? '#fff' : '#78716c',
            boxShadow: preset === p.key ? '0 2px 8px rgba(254,91,37,0.3)' : 'none',
          }}
        >
          {p.key === 'custom' && <Calendar className="w-3 h-3 inline mr-1" />}
          {p.label}
        </button>
      ))}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   Pending Groups Popup
   ═══════════════════════════════════════════════════════════ */
function PendingPopup({ groups, onClose, he }: {
  groups: { id: string; group_name: string | null; created_at: string }[]
  onClose: () => void
  he: boolean
}) {
  function timeAgo(iso: string) {
    const diff = Date.now() - new Date(iso).getTime()
    const hours = Math.floor(diff / 3600000)
    if (hours < 1) return he ? 'עכשיו' : 'just now'
    if (hours < 24) return `${hours}h ago`
    return `${Math.floor(hours / 24)}d ago`
  }

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
      <div
        className="relative bg-white rounded-2xl shadow-2xl p-5 w-[340px] max-h-[400px] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[15px] font-bold text-[#1c1917]">
            <Clock className="w-4 h-4 inline mr-1.5 text-[#06b6d4]" />
            {he ? 'קבוצות ממתינות' : 'Pending Groups'}
          </h3>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-gray-100 transition-colors cursor-pointer">
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>
        {groups.length === 0 ? (
          <p className="text-[13px] text-gray-400 text-center py-6">
            {he ? 'אין קבוצות ממתינות' : 'No pending groups'}
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {groups.map(g => (
              <div key={g.id} className="flex items-center gap-3 p-3 bg-[#f9fafb] rounded-xl">
                <div className="w-9 h-9 rounded-lg bg-[#e0f2fe] flex items-center justify-center text-[14px] shrink-0">
                  💬
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-semibold text-[#1c1917] truncate">
                    {g.group_name ?? 'Unknown Group'}
                  </div>
                  <div className="text-[10px] text-[#a8a29e]">
                    {he ? 'נשלח ' : 'Requested '}{timeAgo(g.created_at)}
                  </div>
                </div>
                <div className="bg-[#fef3c7] text-[#92400e] text-[9px] font-semibold px-2 py-0.5 rounded-md shrink-0">
                  {he ? 'ממתין' : 'waiting'}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   Groups Expand Overlay
   ═══════════════════════════════════════════════════════════ */
function GroupsPanel({ groups, onClose, he }: {
  groups: { id: string; name: string; leadsCount: number; total_members: number; instance_status: string | null }[]
  onClose: () => void
  he: boolean
}) {
  const sorted = [...groups].sort((a, b) => b.leadsCount - a.leadsCount)

  function statusColor(status: string | null): string {
    if (status === 'active') return '#22c55e'
    if (status === 'pending') return '#f59e0b'
    return '#ef4444'
  }

  function statusLabel(status: string | null): string {
    if (status === 'active') return he ? 'מחובר' : 'connected'
    if (status === 'pending') return he ? 'ממתין' : 'pending'
    return he ? 'מנותק' : 'offline'
  }

  return (
    <div
      className="absolute top-0 left-0 h-full z-40 flex"
      style={{ animation: 'slideIn 0.25s ease-out' }}
    >
      {/* Panel */}
      <div className="w-[320px] h-full bg-white shadow-2xl border-r border-[#efeff1] flex flex-col">
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-[#efeff1]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#8b5cf6] flex items-center justify-center">
              <MessageCircle className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="text-[13px] font-bold text-[#1c1917]">
                {he ? 'קבוצות' : 'Groups'}
              </div>
              <div className="text-[10px] text-[#a8a29e]">
                {groups.length} {he ? 'קבוצות' : 'groups'}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[#f5f2ed] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4 text-[#888]" />
          </button>
        </div>

        {/* Groups list */}
        <div className="flex-1 overflow-y-auto px-2 py-2">
          {sorted.map((g) => {
            const color = statusColor(g.instance_status)
            return (
              <div
                key={g.id}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[#f9f8f6] transition-colors mb-0.5"
              >
                {/* Status indicator + icon */}
                <div className="relative shrink-0">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-[16px]"
                    style={{
                      background: g.instance_status === 'active' ? '#f0fdf4' :
                                  g.instance_status === 'pending' ? '#fefce8' : '#fef2f2',
                      border: `1.5px solid ${color}30`,
                    }}
                  >
                    💬
                  </div>
                  <div
                    className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white"
                    style={{ background: color }}
                  />
                </div>

                {/* Group info */}
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-semibold text-[#1c1917] truncate">
                    {g.name}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[9px] font-medium" style={{ color }}>
                      {statusLabel(g.instance_status)}
                    </span>
                    <span className="text-[9px] text-[#ccc]">·</span>
                    <span className="text-[9px] text-[#a8a29e] flex items-center gap-0.5">
                      <Users className="w-2.5 h-2.5" />
                      {g.total_members.toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Lead count */}
                <div className="shrink-0 text-center">
                  <div
                    className="text-[16px] font-black tabular-nums leading-none"
                    style={{ color: g.leadsCount > 0 ? '#fe5b25' : '#d4d4d4' }}
                  >
                    {g.leadsCount}
                  </div>
                  <div className="text-[7px] text-[#a8a29e] uppercase tracking-wider">
                    leads
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Summary footer */}
        <div className="shrink-0 px-4 py-2.5 border-t border-[#efeff1] bg-[#faf9f6]">
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-[#a8a29e]">
              <span className="text-[#22c55e] font-semibold">{groups.filter(g => g.instance_status === 'active').length}</span> {he ? 'מחוברות' : 'connected'}
              <span className="text-[#ccc] mx-1">·</span>
              <span className="text-[#ef4444] font-semibold">{groups.filter(g => g.instance_status !== 'active').length}</span> {he ? 'מנותקות' : 'offline'}
            </span>
            <span className="text-[#fe5b25] font-bold">
              {groups.reduce((s, g) => s + g.leadsCount, 0)} {he ? 'לידים' : 'total leads'}
            </span>
          </div>
        </div>
      </div>

      {/* Click-away overlay */}
      <div className="flex-1 h-full" onClick={onClose} />

      <style>{`
        @keyframes slideIn {
          from { transform: translateX(-100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   Network Visualization (SVG + HTML overlay)
   ═══════════════════════════════════════════════════════════ */
function NetworkVisualization({ he, kpis, dateRange, botStatus, groupsExpanded, setGroupsExpanded, showPending, setShowPending }: {
  he: boolean
  kpis: Record<string, number | string>
  dateRange: { from: string; to: string; preset: string }
  botStatus: { active: boolean; messagesSent: number; errors: number }
  groupsExpanded: boolean
  setGroupsExpanded: (v: boolean) => void
  showPending: boolean
  setShowPending: (v: boolean) => void
}) {
  const { data: net } = useNetworkData(dateRange)
  const navigate = useNavigate()
  const clientsHub = getHub('clients')
  const channelsHub = getHub('channels')
  const brainHub = getHub('brain')

  /* ─── Professions ring around Clients ─── */
  const profNodes = useMemo(() => {
    const withContractors = net.professions.filter(p => p.contractorCount > 0)
    const without = net.professions.filter(p => p.contractorCount === 0)
    const all = [...withContractors, ...without].slice(0, 12)
    if (all.length === 0) return []

    return all.map((prof, i) => {
      const angle = (i / all.length) * Math.PI * 2 - Math.PI / 2
      return {
        ...prof,
        x: clientsHub.x + PROF_RING_R * Math.cos(angle),
        y: clientsHub.y + PROF_RING_R * Math.sin(angle),
      }
    })
  }, [net.professions, clientsHub])

  /* ─── WA accounts ring around Groups ─── */
  const waRingR = 85
  const waNodes = useMemo(() => {
    if (net.waAccounts.length === 0) return []
    return net.waAccounts.map((wa, i) => {
      const count = net.waAccounts.length
      const angle = (i / Math.max(count, 3)) * Math.PI * 2 - Math.PI / 2
      return {
        ...wa,
        x: channelsHub.x + waRingR * Math.cos(angle),
        y: channelsHub.y + waRingR * Math.sin(angle),
      }
    })
  }, [net.waAccounts, channelsHub])

  const hotLeads = Number(kpis.hotLeads ?? 0)
  const mrr = Number(kpis.mrr ?? 0)
  const leadsToday = Number(kpis.leadsToday ?? 0)
  const activePartners = Number(kpis.activePartners ?? 0)
  const jobsTotal = Number(kpis.jobsTotal ?? 0)
  const jobsPending = Number(kpis.jobsPending ?? 0)
  const jobsAccepted = Number(kpis.jobsAccepted ?? 0)
  const jobsCompleted = Number(kpis.jobsCompleted ?? 0)

  const hubLabels: Record<string, { value: string | number; label: string; filtered?: boolean }> = {
    brain: { value: hotLeads, label: he ? 'AI · לידים חמים' : 'AI · HOT LEADS', filtered: true },
    channels: { value: net.groupsCount, label: he ? 'קבוצות' : 'GROUPS' },
    clients: { value: net.contractors.length, label: he ? 'קבלנים' : 'CONTRACTORS' },
    jobs: { value: jobsTotal, label: he ? 'ג\'ובים' : 'JOBS' },
    finance: { value: `$${mrr}`, label: 'MRR' },
    intel: { value: leadsToday, label: he ? 'היום' : 'TODAY', filtered: true },
    partners: { value: activePartners, label: he ? 'שותפים' : 'PARTNERS' },
    settings: { value: '', label: he ? 'הגדרות' : 'SETTINGS' },
  }

  return (
    <div className="w-full h-full flex items-center justify-center overflow-hidden">
      {/* ═══ SVG Layer ═══ */}
      <svg
        viewBox={`0 0 ${VW} ${VH}`}
        className="w-full h-full"
        style={{ maxWidth: '100%', maxHeight: '100%' }}
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* Clients profession orbit ring */}
        <circle cx={clientsHub.x} cy={clientsHub.y} r={PROF_RING_R}
          fill="none" stroke="#10b981" strokeWidth="0.6" opacity="0.1" strokeDasharray="4 8" />

        {/* WA accounts orbit ring around Groups */}
        <circle cx={channelsHub.x} cy={channelsHub.y} r={waRingR}
          fill="none" stroke="#25D366" strokeWidth="0.5" opacity="0.1" strokeDasharray="3 5" />

        {/* Brain pulse */}
        <circle cx={brainHub.x} cy={brainHub.y} r="55" fill="none" stroke="#fe5b25" strokeWidth="1" opacity="0.08">
          <animate attributeName="r" values="55;130" dur="4s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.08;0" dur="4s" repeatCount="indefinite" />
        </circle>

        {/* Jobs orbit ring */}
        {(() => {
          const jobsHub = getHub('jobs')
          return (
            <circle cx={jobsHub.x} cy={jobsHub.y} r={95}
              fill="none" stroke="#6366f1" strokeWidth="0.6" opacity="0.1" strokeDasharray="4 8" />
          )
        })()}

        {/* Jobs status spokes */}
        {(() => {
          const jobsHub = getHub('jobs')
          const ringR = 95
          return [0, 1, 2].map(i => {
            const angle = ((i - 1) / 3) * Math.PI * 1.2 - Math.PI / 2
            const sx = jobsHub.x + ringR * Math.cos(angle)
            const sy = jobsHub.y + ringR * Math.sin(angle)
            return (
              <line key={`job-spoke-${i}`}
                x1={jobsHub.x} y1={jobsHub.y} x2={sx} y2={sy}
                stroke="#6366f1" strokeWidth="0.8" opacity="0.1" />
            )
          })
        })()}

        {/* Hub connections + particles */}
        {CONNECTIONS.map((conn, i) => {
          const from = getHub(conn.from)
          const to = getHub(conn.to)
          const dx = to.x - from.x
          const dy = to.y - from.y
          const pathD = `M${from.x},${from.y} C${from.x + dx * 0.4},${from.y + dy * 0.1} ${to.x - dx * 0.4},${to.y - dy * 0.1} ${to.x},${to.y}`
          const pathId = `conn-${i}`
          return (
            <g key={i}>
              <path d={pathD} fill="none" stroke={from.color} strokeWidth={conn.width + 4} opacity="0.03" strokeLinecap="round" />
              <path id={pathId} d={pathD} fill="none" stroke={from.color} strokeWidth={conn.width} opacity="0.18" strokeLinecap="round" />
              {conn.animated && (
                <circle r="3.5" fill={from.color} opacity="0.6" filter="url(#glow)">
                  <animateMotion dur={`${2.5 + i * 0.4}s`} repeatCount="indefinite">
                    <mpath href={`#${pathId}`} />
                  </animateMotion>
                </circle>
              )}
            </g>
          )
        })}

        {/* Profession spokes */}
        {profNodes.map((p, i) => (
          <line key={`spoke-${i}`}
            x1={clientsHub.x} y1={clientsHub.y} x2={p.x} y2={p.y}
            stroke={p.color || '#10b981'} strokeWidth="1" opacity="0.1" />
        ))}

        {/* WA account spokes */}
        {waNodes.map((wa, i) => (
          <line key={`wa-spoke-${i}`}
            x1={channelsHub.x} y1={channelsHub.y} x2={wa.x} y2={wa.y}
            stroke="#25D366" strokeWidth="0.5" opacity="0.15" />
        ))}
      </svg>

      {/* ═══ HTML Layer ═══ */}

      {/* ─── WA Account nodes ─── */}
      {waNodes.map((wa) => {
        const isConnected = wa.status === 'connected'
        return (
          <div
            key={wa.id}
            data-interactive
            className="absolute flex flex-col items-center"
            style={{
              left: `${(wa.x / VW) * 100}%`,
              top: `${(wa.y / VH) * 100}%`,
              transform: 'translate(-50%, -50%)',
              pointerEvents: 'auto',
            }}
            title={wa.display_name ?? wa.label}
          >
            <div
              className="relative flex items-center justify-center rounded-full border-[3px] border-white shadow-md overflow-hidden"
              style={{
                width: 40, height: 40,
                background: isConnected
                  ? 'linear-gradient(135deg, #25D366, #128C7E)'
                  : 'linear-gradient(135deg, #9ca3af, #6b7280)',
                opacity: isConnected ? 1 : 0.5,
              }}
            >
              {wa.avatar_url ? (
                <img src={wa.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-white text-[13px] font-bold">
                  {(wa.display_name ?? wa.label)?.[0]?.toUpperCase() ?? 'W'}
                </span>
              )}
            </div>
            <div className="flex items-center gap-0.5 mt-0.5">
              <div className="w-[5px] h-[5px] rounded-full" style={{ background: isConnected ? '#22c55e' : '#ef4444' }} />
              <span className="text-[7px] text-[#555]">{isConnected ? 'connected' : 'offline'}</span>
            </div>
            <div
              className="text-[9px] font-bold px-1.5 py-0.5 rounded-md mt-0.5"
              style={{
                background: wa.leadsCount > 0 ? '#fe5b25' : '#e5e5e5',
                color: wa.leadsCount > 0 ? '#fff' : '#999',
              }}
            >
              {wa.leadsCount}
            </div>
          </div>
        )
      })}

      {/* ─── Pending Badge on Groups ─── */}
      {net.pendingGroups.length > 0 && (
        <div
          data-interactive
          className="absolute z-20 cursor-pointer"
          style={{
            left: `${((channelsHub.x + 55) / VW) * 100}%`,
            top: `${((channelsHub.y - 50) / VH) * 100}%`,
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'auto',
          }}
          onClick={() => setShowPending(true)}
        >
          <div className="bg-gradient-to-r from-[#06b6d4] to-[#0891b2] text-white text-[10px] font-semibold px-2.5 py-1 rounded-full shadow-md whitespace-nowrap flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {net.pendingGroups.length} {he ? 'ממתינות' : 'pending'}
          </div>
        </div>
      )}

      {/* ─── Hub nodes ─── */}
      {HUBS.map((hub) => {
        const Icon = hub.icon
        const data = hubLabels[hub.id]
        const isGroupsHub = hub.id === 'channels'

        return (
          <div
            key={hub.id}
            data-interactive
            className="absolute flex flex-col items-center cursor-pointer transition-all duration-300 hover:scale-110 hover:-translate-y-1"
            style={{
              left: `${(hub.x / VW) * 100}%`,
              top: `${(hub.y / VH) * 100}%`,
              transform: 'translate(-50%, -50%)',
              pointerEvents: 'auto',
              zIndex: hub.id === 'brain' ? 15 : 10,
            }}
            onClick={() => {
              if (isGroupsHub) {
                setGroupsExpanded(!groupsExpanded)
              } else {
                navigate(hub.path)
              }
            }}
          >
            <div
              className="relative flex items-center justify-center"
              style={{
                width: hub.size, height: hub.size,
                borderRadius: hub.size * 0.28,
                background: `linear-gradient(145deg, ${hub.gradient[0]}, ${hub.gradient[1]})`,
                boxShadow: `0 6px 24px ${hub.color}35, 0 2px 8px ${hub.color}25`,
              }}
            >
              <div className="absolute inset-0 pointer-events-none" style={{
                borderRadius: hub.size * 0.28,
                background: 'linear-gradient(180deg, rgba(255,255,255,0.25) 0%, transparent 50%)',
              }} />
              <Icon className="text-white relative z-10" style={{
                width: hub.size * 0.45, height: hub.size * 0.45,
                filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.15))',
              }} />
            </div>
            {data.value !== '' && (
              <div className="text-[14px] font-black tabular-nums text-[#0b0707]/85 mt-1 leading-none flex items-center gap-1">
                {data.value}
                {data.filtered && (
                  <span className="text-[7px] font-semibold text-[#fe5b25] bg-[#fe5b25]/10 px-1 py-0.5 rounded">
                    {dateRange.preset === 'today' ? (he ? 'היום' : 'today') :
                     dateRange.preset === 'yesterday' ? (he ? 'אתמול' : 'yest') :
                     dateRange.preset === '7days' ? '7d' : 'custom'}
                  </span>
                )}
              </div>
            )}
            <div className="text-[8px] text-[#3b3b3b]/40 uppercase tracking-[0.1em] font-semibold mt-0.5">
              {data.label}
            </div>
            {isGroupsHub && !groupsExpanded && (
              <div className="text-[7px] text-[#8b5cf6]/50 mt-0.5">{he ? 'לחץ להרחבה' : 'click to expand'}</div>
            )}
          </div>
        )
      })}

      {/* ─── Bot Sub-Indicator under AI node ─── */}
      <div
        className="absolute z-15 pointer-events-none"
        style={{
          left: `${(brainHub.x / VW) * 100}%`,
          top: `${((brainHub.y + 68) / VH) * 100}%`,
          transform: 'translate(-50%, 0)',
        }}
      >
        <div className="bg-white border border-[#efeff1] rounded-lg px-2.5 py-1 flex items-center gap-1.5 shadow-sm">
          <div
            className="w-[6px] h-[6px] rounded-full"
            style={{
              background: botStatus.active ? '#22c55e' : '#ef4444',
              boxShadow: botStatus.active ? '0 0 6px rgba(34,197,94,0.6)' : '0 0 6px rgba(239,68,68,0.6)',
              animation: botStatus.active ? 'pulse 2s infinite' : 'none',
            }}
          />
          <span className="text-[9px] text-[#555] font-medium">
            {botStatus.active ? (he ? 'בוט פעיל' : 'Bot Active') : (he ? 'בוט לא פעיל' : 'Bot Idle')}
          </span>
          <span className="text-[#d4d4d4]">|</span>
          <span className="text-[9px] text-[#fe5b25] font-bold tabular-nums">
            {botStatus.messagesSent} {he ? 'הודעות' : 'msgs'}
          </span>
          {botStatus.errors > 0 && (
            <>
              <span className="text-[#d4d4d4]">|</span>
              <span className="text-[9px] text-[#ef4444] font-bold">{botStatus.errors} err</span>
            </>
          )}
        </div>
      </div>

      {/* ─── Jobs status badges orbiting Jobs hub ─── */}
      {(() => {
        const jobsHub = getHub('jobs')
        const statuses = [
          { key: 'pending', count: jobsPending, color: '#f59e0b', label: he ? 'ממתין' : 'Pending', emoji: '⏳' },
          { key: 'accepted', count: jobsAccepted, color: '#22c55e', label: he ? 'פעיל' : 'Active', emoji: '✅' },
          { key: 'completed', count: jobsCompleted, color: '#3b82f6', label: he ? 'הושלם' : 'Done', emoji: '🏁' },
        ]
        const ringR = 95
        return statuses.map((s, i) => {
          const angle = ((i - 1) / 3) * Math.PI * 1.2 - Math.PI / 2
          const sx = jobsHub.x + ringR * Math.cos(angle)
          const sy = jobsHub.y + ringR * Math.sin(angle)
          return (
            <div
              key={s.key}
              className="absolute flex flex-col items-center"
              style={{
                left: `${(sx / VW) * 100}%`,
                top: `${(sy / VH) * 100}%`,
                transform: 'translate(-50%, -50%)',
                pointerEvents: 'none',
                opacity: 0,
                animation: `fadeScaleIn 0.4s ease-out ${400 + i * 80}ms forwards`,
              }}
            >
              <div
                className="flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-xl"
                style={{
                  background: s.count > 0 ? `${s.color}08` : '#f5f2ed',
                  border: `1.5px solid ${s.count > 0 ? s.color + '30' : '#e5e5e5'}`,
                  boxShadow: s.count > 0 ? `0 2px 8px ${s.color}12` : 'none',
                }}
              >
                <span className="text-[14px] leading-none">{s.emoji}</span>
                <span
                  className="text-[12px] font-black tabular-nums leading-none"
                  style={{ color: s.count > 0 ? s.color : '#bbb' }}
                >
                  {s.count}
                </span>
                <span
                  className="text-[6px] uppercase tracking-[0.08em] font-semibold leading-none"
                  style={{ color: s.count > 0 ? s.color + 'aa' : '#ccc' }}
                >
                  {s.label}
                </span>
              </div>
            </div>
          )
        })
      })()}

      {/* ─── Profession nodes orbiting Clients ─── */}
      {profNodes.map((prof, i) => {
        const hasContractors = prof.contractorCount > 0
        return (
          <div
            key={prof.id}
            data-interactive
            className="absolute flex flex-col items-center cursor-pointer transition-all duration-300 hover:scale-110"
            style={{
              left: `${(prof.x / VW) * 100}%`,
              top: `${(prof.y / VH) * 100}%`,
              transform: 'translate(-50%, -50%)',
              pointerEvents: 'auto',
              opacity: 0,
              animation: `fadeScaleIn 0.4s ease-out ${200 + i * 60}ms forwards`,
            }}
            onClick={() => navigate('/admin/clients')}
          >
            <div
              className="relative flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl"
              style={{
                background: hasContractors ? `${prof.color}08` : '#f5f2ed',
                border: `1.5px solid ${hasContractors ? prof.color + '30' : '#e5e5e5'}`,
                boxShadow: hasContractors ? `0 2px 8px ${prof.color}12` : 'none',
              }}
            >
              <span className="text-[18px] leading-none">{prof.emoji}</span>
              <span className="text-[7px] text-[#3b3b3b]/50 font-medium text-center max-w-[52px] truncate leading-tight">
                {he ? prof.name_he : prof.name_en}
              </span>
              <span
                className="text-[10px] font-black tabular-nums leading-none"
                style={{ color: hasContractors ? prof.color : '#bbb' }}
              >
                {prof.contractorCount}
              </span>
              <span className="text-[5px] uppercase tracking-[0.1em] font-semibold leading-none"
                style={{ color: hasContractors ? prof.color + 'aa' : '#ccc' }}
              >
                {he ? 'קבלנים' : 'waiting'}
              </span>
            </div>
          </div>
        )
      })}

      <style>{`
        @keyframes fadeScaleIn {
          from { opacity: 0; transform: translate(-50%, -50%) scale(0.5); }
          to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }
        @keyframes expandBubble {
          from { opacity: 0; transform: translate(-50%, -50%) scale(0); }
          to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   Top-bar KPI pill
   ═══════════════════════════════════════════════════════════ */
function KpiPill({ icon: Icon, label, value, color, highlight, filtered }: {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>
  label: string
  value: string | number
  color: string
  highlight?: boolean
  filtered?: boolean
}) {
  return (
    <div
      className="flex items-center gap-2.5 px-3.5 py-2 rounded-lg transition-all duration-300 hover:scale-[1.02]"
      style={{
        background: highlight ? `${color}08` : '#f5f2ed',
        border: `1px solid ${highlight ? color + '20' : '#efeff1'}`,
        borderBottom: filtered ? `2px solid ${color}` : undefined,
      }}
    >
      <Icon className="w-3.5 h-3.5 shrink-0 opacity-60" style={{ color }} />
      <div className="flex flex-col min-w-0">
        <span className="text-[8px] text-[#3b3b3b]/50 uppercase tracking-[0.15em] leading-none font-medium">{label}</span>
        <span className="text-[17px] font-black tabular-nums leading-tight" style={{ color: highlight ? color : '#0b0707' }}>
          {value}
        </span>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   Main Canvas
   ═══════════════════════════════════════════════════════════ */
export default function AdminCanvas() {
  const { profile, signOut } = useAuth()
  const { locale } = useI18n()
  const navigate = useNavigate()
  const he = locale === 'he'

  // Infinite canvas — pan & zoom
  const canvasContainerRef = useRef<HTMLDivElement>(null)
  const canvasTransform = useCanvasTransform(canvasContainerRef)

  // Groups expand & pending popup — lifted state (renders outside transform)
  const [groupsExpanded, setGroupsExpanded] = useState(false)
  const [showPending, setShowPending] = useState(false)

  // Date filter — global state
  const { range, preset, setPresetFilter } = useDateFilter('today')

  // Data hooks — pass date range to filtered queries
  const { data: kpis, loading } = useAdminKPIs(range)
  const { data: netData } = useNetworkData(range)
  const botStatus = useBotStatus(range)

  const hotLeads = Number(kpis.hotLeads ?? 0)
  const mrr = Number(kpis.mrr ?? 0)
  const arr = Number(kpis.arr ?? 0)
  const activeContractors = netData.contractors.length || Number(kpis.activeContractors ?? 0)
  const waConnected = Number(kpis.waConnected ?? 0)
  const activeGroups = netData.groupsCount || Number(kpis.activeGroups ?? 0)
  const convRate = Number(kpis.conversionRate ?? 0)
  const activePartners = Number(kpis.activePartners ?? 0)
  const pendingPartners = Number(kpis.pendingPartners ?? 0)
  const topBarJobsTotal = Number(kpis.jobsTotal ?? 0)

  return (
    <div className="h-screen w-full flex flex-col" style={{ background: '#faf9f6' }}>
      {/* ═══════════════ TOP BAR ═══════════════ */}
      <div
        className="shrink-0 flex items-center justify-between px-4 h-[60px] z-10 relative"
        style={{ background: '#ffffff', borderBottom: '2px solid #fe5b25', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}
      >
        {/* Logo + Live */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <img src="/icon.png" alt="MasterLeadFlow" className="w-7 h-7 rounded-lg" />
            <span className="text-[#0b0707]/80 font-extrabold text-[12px] tracking-[0.05em]">MASTERLEADFLOW</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#fe5b25]/10 border border-[#fe5b25]/20">
            <div className="w-1.5 h-1.5 rounded-full bg-[#fe5b25] animate-pulse shadow-[0_0_6px_rgba(254,91,37,0.8)]" />
            <span className="text-[9px] font-bold text-[#fe5b25] uppercase tracking-[0.12em]">{he ? 'פעיל' : 'Live'}</span>
          </div>
        </div>

        {/* Date Filter */}
        <DateFilterBar preset={preset} onSelect={setPresetFilter} he={he} />

        {/* KPIs */}
        <div className="flex items-center gap-1.5">
          <KpiPill icon={Zap} label={he ? 'לידים חמים' : 'HOT LEADS'} value={hotLeads} color="#ff6b35" highlight={hotLeads > 0} filtered />
          <div className="w-px h-6 bg-[#efeff1]" />
          <KpiPill icon={Users} label={he ? 'קבלנים' : 'CONTRACTORS'} value={activeContractors} color="#10b981" />
          <div className="w-px h-6 bg-[#efeff1]" />
          <KpiPill icon={Radio} label={he ? 'קבוצות' : 'GROUPS'} value={activeGroups} color="#8b5cf6" />
          <div className="w-px h-6 bg-[#efeff1]" />
          <KpiPill icon={Briefcase} label={he ? "ג'ובים" : 'JOBS'} value={topBarJobsTotal} color="#6366f1" highlight={topBarJobsTotal > 0} />
          <div className="w-px h-6 bg-[#efeff1]" />
          <KpiPill icon={TrendingUp} label={he ? 'המרה' : 'RATE'} value={`${convRate}%`} color="#f59e0b" filtered />
          <div className="w-px h-6 bg-[#efeff1]" />
          <KpiPill icon={DollarSign} label="MRR" value={`$${mrr.toLocaleString()}`} color="#22c55e" highlight={mrr > 0} />
          <div className="w-px h-6 bg-[#efeff1]" />
          <KpiPill icon={DollarSign} label="ARR" value={`$${arr.toLocaleString()}`} color="#22c55e" />
          <div className="w-px h-6 bg-[#efeff1]" />
          <KpiPill icon={Handshake} label={he ? 'שותפים' : 'PARTNERS'} value={activePartners} color="#ec4899" highlight={pendingPartners > 0} />
        </div>

        {/* User */}
        <div className="flex items-center gap-2 shrink-0">
          {profile && (
            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-[#f5f2ed] border border-[#efeff1]">
              <div className="w-6 h-6 rounded-md bg-[#efeff1] flex items-center justify-center text-[10px] font-bold text-[#0b0707]/50">
                {profile.full_name?.charAt(0)?.toUpperCase() ?? '?'}
              </div>
              <span className="text-[#3b3b3b]/60 text-[11px] font-medium">{profile.full_name}</span>
            </div>
          )}
          <button onClick={signOut} className="p-2 rounded-lg hover:bg-[#f5f2ed] transition-colors text-[#3b3b3b]/30 hover:text-[#3b3b3b]/60 cursor-pointer">
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ═══════════════ INFINITE CANVAS ═══════════════ */}
      <div
        ref={canvasContainerRef}
        className="flex-1 relative overflow-hidden select-none"
        style={{ cursor: 'grab' }}
        onMouseDown={canvasTransform.handleMouseDown}
        onMouseMove={canvasTransform.handleMouseMove}
        onMouseUp={canvasTransform.handleMouseUp}
        onMouseLeave={canvasTransform.handleMouseUp}
      >
        {/* Transformed layer — everything inside pans & zooms */}
        <div
          style={{
            transform: canvasTransform.cssTransform,
            transformOrigin: '0 0',
            width: '100%',
            height: '100%',
            willChange: 'transform',
          }}
        >
          <NetworkVisualization
            he={he} kpis={kpis} dateRange={range} botStatus={botStatus}
            groupsExpanded={groupsExpanded} setGroupsExpanded={setGroupsExpanded}
            showPending={showPending} setShowPending={setShowPending}
          />

          {/* Groups expanded removed — now using side panel */}
        </div>

        {/* Zoom controls — fixed position, not affected by transform */}
        <div className="absolute bottom-4 right-4 z-30 flex items-center gap-1 bg-white/90 backdrop-blur-sm rounded-lg shadow-lg border border-[#efeff1] p-1">
          <button
            onClick={() => canvasTransform.zoomIn()}
            className="p-1.5 rounded-md hover:bg-[#f5f2ed] transition-colors cursor-pointer text-[#555]"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <div className="text-[10px] font-mono text-[#888] w-10 text-center tabular-nums">
            {Math.round(canvasTransform.transform.scale * 100)}%
          </div>
          <button
            onClick={() => canvasTransform.zoomOut()}
            className="p-1.5 rounded-md hover:bg-[#f5f2ed] transition-colors cursor-pointer text-[#555]"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <div className="w-px h-5 bg-[#efeff1]" />
          <button
            onClick={canvasTransform.resetTransform}
            className="p-1.5 rounded-md hover:bg-[#f5f2ed] transition-colors cursor-pointer text-[#555]"
            title="Reset View"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>

        {/* Groups side panel — outside transform */}
        {groupsExpanded && (
          <GroupsPanel
            groups={netData.groups}
            onClose={() => setGroupsExpanded(false)}
            he={he}
          />
        )}

        {/* Pending Groups popup — outside transform */}
        {showPending && (
          <PendingPopup
            groups={netData.pendingGroups}
            onClose={() => setShowPending(false)}
            he={he}
          />
        )}

        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#faf9f6]/90 z-20 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-3">
              <div className="relative w-10 h-10">
                <div className="absolute inset-0 border-2 border-[#fe5b25]/20 rounded-full" />
                <div className="absolute inset-0 border-2 border-[#fe5b25] border-t-transparent rounded-full animate-spin" />
              </div>
              <span className="text-[#3b3b3b]/40 text-[10px] uppercase tracking-[0.2em] font-medium">{he ? 'טוען...' : 'Loading...'}</span>
            </div>
          </div>
        )}
      </div>

      {/* ═══════════════ BOTTOM STATUS BAR ═══════════════ */}
      <div
        className="shrink-0 flex items-center justify-between px-5 h-10 z-10"
        style={{ background: '#1c1917', borderTop: '1px solid #2a2a2a' }}
      >
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div className="w-[6px] h-[6px] rounded-full bg-emerald-500 animate-pulse shadow-[0_0_4px_rgba(52,211,153,0.5)]" />
            <span className="text-[9px] text-[#a8a29e] uppercase tracking-[0.12em] font-medium">{he ? 'מערכת מחוברת' : 'System Online'}</span>
          </div>
          <div className="w-px h-3 bg-[#44403c]" />
          <div className="flex items-center gap-1">
            <Wifi className="w-3 h-3 text-emerald-500/60" />
            <span className="text-[9px] text-[#a8a29e] tabular-nums">{waConnected} WA Connected</span>
            {netData.waAccounts.filter(w => w.status !== 'connected').length > 0 && (
              <span className="text-[9px] text-[#ef4444]/80 tabular-nums ml-1">
                · {netData.waAccounts.filter(w => w.status !== 'connected').length} Offline
              </span>
            )}
          </div>
          <div className="w-px h-3 bg-[#44403c]" />
          <div className="flex items-center gap-1">
            <BarChart3 className="w-3 h-3 text-blue-500/40" />
            <span className="text-[9px] text-[#a8a29e] tabular-nums">
              {he ? 'סריקה אחרונה:' : 'Last Scan:'} 3m ago
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-[#ef4444] animate-pulse" />
          <span className="text-[10px] font-bold text-white uppercase tracking-[0.1em]">LIVE</span>
        </div>
      </div>
    </div>
  )
}
