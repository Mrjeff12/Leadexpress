import { useMemo } from 'react'
import { useAuth } from '../../lib/auth'
import { useI18n } from '../../lib/i18n'
import { useAdminKPIs } from '../../hooks/useAdminKPIs'
import { useNetworkData } from '../../hooks/useNetworkData'
import { useNavigate } from 'react-router-dom'
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
  Bot,
  Target,
  Coins,
  Settings,
  Brain,
  MessageCircle,
  Scan,
} from 'lucide-react'

/* ═══════════════════════════════════════════════════════════
   Full-System Neural Network — Concentric Ring Layout
   ═══════════════════════════════════════════════════════════

   Center (700, 400): Brain / War Room — the AI core

   Ring 1 (r≈180): Pipeline departments — the data flow
     Channels (9 o'clock) → Scanner (10:30) → Clients (3 o'clock)
     Finance (5 o'clock)

   Ring 2 (r≈320): Support & Analytics
     Bot (12 o'clock) → Intelligence (4:30) → Partners (7:30)
     Settings (6 o'clock)

   Professions: arc between brain and clients (2-4 o'clock zone)

   Data flow: Channels→Scanner→Brain→Professions→Clients→Finance
              Bot↔Brain, Partners→Clients, Intel←Brain
*/

const VW = 1400
const VH = 800
const CX = 700 // center X
const CY = 400 // center Y

/* ─── System hub nodes positioned on concentric rings ─── */
interface HubNode {
  id: string
  x: number
  y: number
  size: number
  color: string
  gradient: [string, string]
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>
  path: string
  ring: number
}

// Helper: place on ring at clock position (12=top, 3=right, 6=bottom, 9=left)
function ringPos(ring: number, clockHour: number): { x: number; y: number } {
  const R1 = 185, R2 = 330
  const r = ring === 1 ? R1 : R2
  const angle = ((clockHour - 3) / 12) * Math.PI * 2 // 3 o'clock = 0°
  return { x: CX + r * Math.cos(angle), y: CY + r * Math.sin(angle) }
}

const HUBS: HubNode[] = [
  // Ring 0: Center — Brain / War Room
  { id: 'brain', ...{ x: CX, y: CY }, size: 76, color: '#fe5b25',
    gradient: ['#ff8a5c', '#e04d1c'], icon: Brain, path: '/admin/warroom', ring: 0 },

  // Ring 1: Pipeline (inner ring, r≈185)
  { id: 'channels', ...ringPos(1, 9), size: 52, color: '#8b5cf6',
    gradient: ['#a78bfa', '#7c3aed'], icon: MessageCircle, path: '/admin/channels', ring: 1 },
  { id: 'scan', ...ringPos(1, 10.5), size: 40, color: '#06b6d4',
    gradient: ['#22d3ee', '#0891b2'], icon: Scan, path: '/admin/channels/scan', ring: 1 },
  { id: 'clients', ...ringPos(1, 3), size: 52, color: '#10b981',
    gradient: ['#34d399', '#059669'], icon: Users, path: '/admin/clients', ring: 1 },
  { id: 'finance', ...ringPos(1, 5), size: 44, color: '#f59e0b',
    gradient: ['#fbbf24', '#d97706'], icon: Coins, path: '/admin/finance', ring: 1 },

  // Ring 2: Support & Analytics (outer ring, r≈330)
  { id: 'bot', ...ringPos(2, 12), size: 44, color: '#8b5cf6',
    gradient: ['#a78bfa', '#7c3aed'], icon: Bot, path: '/admin/bot', ring: 2 },
  { id: 'intel', ...ringPos(2, 4.5), size: 44, color: '#3b82f6',
    gradient: ['#60a5fa', '#2563eb'], icon: BarChart3, path: '/admin/intel', ring: 2 },
  { id: 'partners', ...ringPos(2, 7.5), size: 44, color: '#ec4899',
    gradient: ['#f472b6', '#db2777'], icon: Handshake, path: '/admin/partners', ring: 2 },
  { id: 'settings', ...ringPos(2, 6), size: 36, color: '#6b7280',
    gradient: ['#9ca3af', '#4b5563'], icon: Settings, path: '/admin/settings', ring: 2 },
]

/* ─── Connections follow the real data pipeline ─── */
const CONNECTIONS: { from: string; to: string; width: number; animated?: boolean }[] = [
  // Primary pipeline: Channels → Scanner → Brain → Clients
  { from: 'channels', to: 'scan', width: 2.5, animated: true },
  { from: 'scan', to: 'brain', width: 3, animated: true },
  { from: 'brain', to: 'clients', width: 3, animated: true },
  // Money flow: Clients → Finance
  { from: 'clients', to: 'finance', width: 2, animated: true },
  // AI: Bot ↔ Brain
  { from: 'bot', to: 'brain', width: 2, animated: true },
  // Analytics: Brain → Intelligence
  { from: 'brain', to: 'intel', width: 2, animated: true },
  // Referrals: Partners → Clients
  { from: 'partners', to: 'clients', width: 1.5 },
  // Partner commissions: Finance → Partners
  { from: 'finance', to: 'partners', width: 1.2 },
  // Config: Settings → Brain
  { from: 'settings', to: 'brain', width: 1 },
  // Direct channel: Channels → Brain
  { from: 'channels', to: 'brain', width: 1.5 },
]

function getHub(id: string) {
  return HUBS.find(h => h.id === id)!
}

/* ═══════════════════════════════════════════════════════════ */

// Status color mapping for contractor subscription
const STATUS_COLORS: Record<string, string> = {
  active: '#22c55e',
  trialing: '#3b82f6',
  past_due: '#f59e0b',
  canceled: '#ef4444',
  incomplete: '#9ca3af',
}

function NetworkVisualization({ he, kpis }: {
  he: boolean
  kpis: Record<string, number | string>
}) {
  const { data: net } = useNetworkData()
  const navigate = useNavigate()

  const channelsHub = getHub('channels')

  /* ─── Ring 2: Professions (ellipse, rx=250, ry=190) ─── */
  const profNodes = useMemo(() => {
    const profs = net.professions.filter(p => p.contractorCount > 0)
    const fallback = profs.length > 0 ? profs : net.professions.slice(0, 8)
    const count = fallback.length
    const rx = 250, ry = 190
    return fallback.map((prof, i) => {
      const angle = (i / count) * Math.PI * 2 - Math.PI / 2 // start from top
      return {
        ...prof,
        x: CX + rx * Math.cos(angle),
        y: CY + ry * Math.sin(angle),
        angle,
      }
    })
  }, [net.professions])

  /* ─── Ring 3: Contractors (ellipse, rx=400, ry=300) ─── */
  const contractorNodes = useMemo(() => {
    const shown = net.contractors.slice(0, 24)
    // Assign each contractor near their first profession on the outer ring
    return shown.map((c) => {
      const profIdx = profNodes.findIndex(p => c.professions.includes(p.id))
      const prof = profIdx >= 0 ? profNodes[profIdx] : null
      // Place on outer ring at same angle as profession, with slight offset per contractor
      const baseAngle = prof?.angle ?? 0
      // Count siblings (same profession) to spread them
      const siblings = shown.filter(s => {
        const sIdx = profNodes.findIndex(p => s.professions.includes(p.id))
        return sIdx === profIdx
      })
      const sibIdx = siblings.indexOf(c)
      const spread = siblings.length > 1 ? (sibIdx - (siblings.length - 1) / 2) * 0.12 : 0
      const angle = baseAngle + spread
      const rx = 410, ry = 310
      return {
        ...c,
        x: CX + rx * Math.cos(angle),
        y: CY + ry * Math.sin(angle),
        profColor: prof?.color ?? '#6b7280',
        profX: prof?.x ?? CX,
        profY: prof?.y ?? CY,
      }
    })
  }, [net.contractors, profNodes])

  /* ─── Group bubbles ─── */
  const groupBubbles = useMemo(() => {
    const count = Math.min(Number(net.groupsCount) || 8, 12)
    return Array.from({ length: count }, (_, i) => {
      const angle = (i / count) * Math.PI * 2 - Math.PI / 2
      const r = 45 + (i % 2) * 12
      return {
        x: channelsHub.x + r * Math.cos(angle),
        y: channelsHub.y + r * Math.sin(angle),
        size: 3 + (i % 3) * 2,
      }
    })
  }, [net.groupsCount, channelsHub])

  const hotLeads = Number(kpis.hotLeads ?? 0)
  const mrr = Number(kpis.mrr ?? 0)
  const leadsToday = Number(kpis.leadsToday ?? 0)
  const activePartners = Number(kpis.activePartners ?? 0)
  const scansPending = Number(kpis.scansPending ?? 0)

  const hubLabels: Record<string, { value: string | number; label: string }> = {
    brain: { value: hotLeads, label: he ? 'לידים חמים' : 'HOT LEADS' },
    channels: { value: net.groupsCount, label: he ? 'קבוצות' : 'GROUPS' },
    clients: { value: net.contractors.length, label: he ? 'קבלנים' : 'CONTRACTORS' },
    finance: { value: `$${mrr}`, label: 'MRR' },
    intel: { value: leadsToday, label: he ? 'לידים היום' : 'TODAY' },
    partners: { value: activePartners, label: he ? 'שותפים' : 'PARTNERS' },
    bot: { value: 'AI', label: he ? 'בוט' : 'BOT' },
    scan: { value: scansPending || '', label: he ? 'סריקה' : 'SCAN' },
    settings: { value: '', label: he ? 'הגדרות' : 'SETTINGS' },
  }

  return (
    <div className="w-full h-full flex items-center justify-center overflow-hidden">
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
          <filter id="softGlow">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* ─── Ring guides ─── */}
        <ellipse cx={CX} cy={CY} rx="185" ry="145" fill="none" stroke="#e5e5e5" strokeWidth="0.5" opacity="0.25" strokeDasharray="4 6" />
        <ellipse cx={CX} cy={CY} rx="250" ry="190" fill="none" stroke="#e5e5e5" strokeWidth="0.5" opacity="0.2" strokeDasharray="3 5" />
        <ellipse cx={CX} cy={CY} rx="410" ry="310" fill="none" stroke="#e5e5e5" strokeWidth="0.4" opacity="0.15" strokeDasharray="2 6" />

        {/* ─── Brain pulse ─── */}
        <circle cx={CX} cy={CY} r="50" fill="none" stroke="#fe5b25" strokeWidth="1" opacity="0.08">
          <animate attributeName="r" values="50;160" dur="4s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.08;0" dur="4s" repeatCount="indefinite" />
        </circle>
        <circle cx={CX} cy={CY} r="80" fill="#fe5b25" opacity="0.025" filter="url(#softGlow)" />

        {/* ─── Hub connections ─── */}
        {CONNECTIONS.map((conn, i) => {
          const from = getHub(conn.from)
          const to = getHub(conn.to)
          const dx = to.x - from.x
          const dy = to.y - from.y
          const cx1 = from.x + dx * 0.35
          const cy1 = from.y + dy * 0.1
          const cx2 = from.x + dx * 0.65
          const cy2 = to.y - dy * 0.1
          const pathD = `M${from.x},${from.y} C${cx1},${cy1} ${cx2},${cy2} ${to.x},${to.y}`
          const pathId = `path-${i}`
          return (
            <g key={i}>
              <path d={pathD} fill="none" stroke={from.color} strokeWidth={conn.width + 3} opacity="0.04" strokeLinecap="round" />
              <path id={pathId} d={pathD} fill="none" stroke={from.color} strokeWidth={conn.width} opacity="0.2" strokeLinecap="round" />
              {conn.animated && (
                <circle r="3.5" fill={from.color} opacity="0.65" filter="url(#glow)">
                  <animateMotion dur={`${2.5 + i * 0.4}s`} repeatCount="indefinite">
                    <mpath href={`#${pathId}`} />
                  </animateMotion>
                </circle>
              )}
            </g>
          )
        })}

        {/* ─── Brain → Profession lines ─── */}
        {profNodes.map((p, i) => (
          <line key={`bp-${i}`} x1={CX} y1={CY} x2={p.x} y2={p.y}
            stroke={p.color || '#ccc'} strokeWidth="0.8" opacity="0.12" strokeDasharray="3 4" />
        ))}

        {/* ─── Profession → Contractor lines ─── */}
        {contractorNodes.map((c, i) => (
          <line key={`pc-${i}`} x1={c.profX} y1={c.profY} x2={c.x} y2={c.y}
            stroke={c.profColor} strokeWidth="0.6" opacity="0.15" />
        ))}

        {/* ─── Group bubbles ─── */}
        {groupBubbles.map((g, i) => (
          <g key={`gb-${i}`}>
            <circle cx={g.x} cy={g.y} r={g.size} fill="#8b5cf6" opacity="0.1">
              <animate attributeName="r" values={`${g.size};${g.size + 1.5};${g.size}`}
                dur={`${3 + i * 0.2}s`} repeatCount="indefinite" />
            </circle>
            <line x1={channelsHub.x} y1={channelsHub.y} x2={g.x} y2={g.y}
              stroke="#8b5cf6" strokeWidth="0.4" opacity="0.06" />
          </g>
        ))}
      </svg>

      {/* ═══ HTML Layer ═══ */}

      {/* ─── Hub nodes ─── */}
      {HUBS.map((hub) => {
        const Icon = hub.icon
        const data = hubLabels[hub.id]
        const pctX = (hub.x / VW) * 100
        const pctY = (hub.y / VH) * 100
        return (
          <div
            key={hub.id}
            className="absolute flex flex-col items-center cursor-pointer transition-all duration-300 hover:scale-110 hover:-translate-y-1"
            style={{ left: `${pctX}%`, top: `${pctY}%`, transform: 'translate(-50%, -50%)', pointerEvents: 'auto' }}
            onClick={() => navigate(hub.path)}
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
              <div className="text-[14px] font-black tabular-nums text-[#0b0707]/85 mt-1 leading-none">{data.value}</div>
            )}
            <div className="text-[8px] text-[#3b3b3b]/40 uppercase tracking-[0.1em] font-semibold mt-0.5">{data.label}</div>
          </div>
        )
      })}

      {/* ─── Ring 2: Profession nodes ─── */}
      {profNodes.map((prof, i) => {
        const pctX = (prof.x / VW) * 100
        const pctY = (prof.y / VH) * 100
        return (
          <div
            key={prof.id}
            className="absolute flex flex-col items-center cursor-pointer transition-all duration-300 hover:scale-110"
            style={{
              left: `${pctX}%`, top: `${pctY}%`,
              transform: 'translate(-50%, -50%)', pointerEvents: 'auto',
              opacity: 0, animation: `fadeScaleIn 0.4s ease-out ${200 + i * 60}ms forwards`,
            }}
            onClick={() => navigate('/admin/clients')}
          >
            <div className="relative">
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center text-[18px] shadow-sm"
                style={{ background: `${prof.color}12`, border: `1.5px solid ${prof.color}25` }}
              >
                {prof.emoji}
              </div>
              {prof.contractorCount > 0 && (
                <div
                  className="absolute -top-1.5 -right-1.5 w-4.5 h-4.5 min-w-[18px] rounded-full text-[8px] font-bold flex items-center justify-center text-white shadow-sm"
                  style={{ background: prof.color }}
                >
                  {prof.contractorCount}
                </div>
              )}
            </div>
            <div className="text-[7px] text-[#3b3b3b]/45 mt-1 font-medium text-center max-w-[50px] truncate">
              {he ? prof.name_he : prof.name_en}
            </div>
          </div>
        )
      })}

      {/* ─── Ring 3: Contractor avatars with status dots ─── */}
      {contractorNodes.map((c, i) => {
        const pctX = (c.x / VW) * 100
        const pctY = (c.y / VH) * 100
        const statusColor = STATUS_COLORS[c.subscription_status ?? ''] ?? '#9ca3af'
        return (
          <div
            key={c.user_id}
            className="absolute flex flex-col items-center cursor-pointer transition-all duration-300 hover:scale-120 hover:z-10"
            style={{
              left: `${pctX}%`, top: `${pctY}%`,
              transform: 'translate(-50%, -50%)', pointerEvents: 'auto',
              opacity: 0, animation: `fadeScaleIn 0.4s ease-out ${400 + i * 60}ms forwards`,
            }}
            onClick={() => navigate(`/admin/clients/contractors/${c.user_id}`)}
            title={`${c.full_name ?? 'Contractor'} — ${c.subscription_status ?? 'unknown'}`}
          >
            <div className="relative">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-bold shadow-md"
                style={{
                  background: c.avatar_url ? `url(${c.avatar_url}) center/cover` : '#fff',
                  color: c.profColor,
                  border: `2px solid ${c.profColor}40`,
                  boxShadow: `0 2px 8px ${c.profColor}15`,
                }}
              >
                {!c.avatar_url && (c.full_name?.charAt(0)?.toUpperCase() ?? '?')}
              </div>
              {/* Status dot */}
              <div
                className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#faf9f6]"
                style={{ background: statusColor, boxShadow: `0 0 4px ${statusColor}60` }}
              />
            </div>
            <div className="text-[7px] text-[#3b3b3b]/40 mt-0.5 font-medium text-center max-w-[45px] truncate">
              {c.full_name?.split(' ')[0] ?? ''}
            </div>
          </div>
        )
      })}

      <style>{`
        @keyframes fadeScaleIn {
          from { opacity: 0; transform: translate(-50%, -50%) scale(0.5); }
          to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }
      `}</style>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   Top-bar KPI pill
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
        <span className="text-[17px] font-black tabular-nums leading-tight" style={{ color: highlight ? color : '#0b0707' }}>
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
      <span className="text-[20px] font-black tabular-nums leading-tight" style={{ color: color ?? '#0b0707' }}>{value}</span>
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
  const navigate = useNavigate()
  const { data: kpis, loading } = useAdminKPIs()
  const he = locale === 'he'

  const { data: netData } = useNetworkData()
  const totalLeads = Number(kpis.hotLeads ?? 0) + Number(kpis.leadsOnMap ?? 0)
  const mrr = Number(kpis.mrr ?? 0)
  const activeContractors = netData.contractors.length || Number(kpis.activeContractors ?? 0)
  const waConnected = Number(kpis.waConnected ?? 0)
  const activeGroups = netData.groupsCount || Number(kpis.activeGroups ?? 0)
  const convRate = Number(kpis.conversionRate ?? 0)
  const activeSubs = Number(kpis.activeSubs ?? 0)
  const scansPending = Number(kpis.scansPending ?? 0)
  const leadsToday = Number(kpis.leadsToday ?? 0)
  const hotLeads = Number(kpis.hotLeads ?? 0)
  const activePartners = Number(kpis.activePartners ?? 0)
  const pendingPartners = Number(kpis.pendingPartners ?? 0)

  return (
    <div className="h-screen w-screen flex flex-col" style={{ background: '#faf9f6' }}>
      {/* ═══════════════ TOP BAR ═══════════════ */}
      <div
        className="shrink-0 flex items-center justify-between px-4 h-[60px] z-10 relative"
        style={{ background: '#ffffff', borderBottom: '1px solid #efeff1', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}
      >
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <img src="/icon.png" alt="Lead Express" className="w-7 h-7 rounded-lg" />
            <div className="flex flex-col leading-none">
              <span className="text-[#0b0707]/80 font-extrabold text-[12px] tracking-[0.05em]">LEAD EXPRESS</span>
              <span className="text-[7px] text-[#3b3b3b]/30 uppercase tracking-[0.25em]">neural network</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#fe5b25]/10 border border-[#fe5b25]/20 ml-1">
            <div className="w-1.5 h-1.5 rounded-full bg-[#fe5b25] animate-pulse shadow-[0_0_6px_rgba(254,91,37,0.8)]" />
            <span className="text-[9px] font-bold text-[#fe5b25] uppercase tracking-[0.12em]">{he ? 'פעיל' : 'Live'}</span>
          </div>
        </div>

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

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => navigate('/admin/bot')}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#8b5cf6]/10 border border-[#8b5cf6]/20 hover:bg-[#8b5cf6]/20 transition-colors cursor-pointer"
          >
            <Bot className="w-3.5 h-3.5 text-[#8b5cf6]" />
            <span className="text-[9px] font-bold text-[#8b5cf6] uppercase tracking-[0.08em]">{he ? 'בוט' : 'Bot'}</span>
          </button>
          {profile && (
            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-[#f5f2ed] border border-[#efeff1]">
              <div className="w-6 h-6 rounded-md bg-[#efeff1] flex items-center justify-center text-[10px] font-bold text-[#0b0707]/50">
                {profile.full_name?.charAt(0)?.toUpperCase() ?? '?'}
              </div>
              <span className="text-[#3b3b3b]/60 text-[11px] font-medium">{profile.full_name}</span>
            </div>
          )}
          <button onClick={signOut} className="p-2 rounded-lg hover:bg-[#f5f2ed] transition-colors text-[#3b3b3b]/30 hover:text-[#3b3b3b]/60">
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ═══════════════ FULL NEURAL NETWORK ═══════════════ */}
      <div className="flex-1 relative overflow-hidden">
        <NetworkVisualization he={he} kpis={kpis} />

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

      {/* ═══════════════ BOTTOM BAR ═══════════════ */}
      <div
        className="shrink-0 flex items-center justify-between px-5 h-12 z-10"
        style={{ background: '#ffffff', borderTop: '1px solid #efeff1', boxShadow: '0 -1px 3px rgba(0,0,0,0.05)' }}
      >
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div className="w-[6px] h-[6px] rounded-full bg-emerald-500 animate-pulse shadow-[0_0_4px_rgba(52,211,153,0.5)]" />
            <span className="text-[9px] text-[#3b3b3b]/40 uppercase tracking-[0.12em] font-medium">{he ? 'מערכת מחוברת' : 'System Online'}</span>
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

        <div className="flex items-center divide-x divide-[#efeff1]">
          <BottomStat label={he ? 'לידים' : 'LEADS'} value={totalLeads} color="#ff6b35" />
          <BottomStat label={he ? 'מנויים' : 'SUBS'} value={activeSubs} color="#22c55e" />
          <BottomStat label={he ? 'סריקות' : 'SCANS'} value={scansPending} color="#8b5cf6" />
          <BottomStat label={he ? 'קבוצות' : 'GROUPS'} value={activeGroups} color="#3b82f6" />
          <BottomStat label={he ? 'שותפים' : 'PARTNERS'} value={activePartners} color="#ec4899" />
        </div>

        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#fe5b25]/10 border border-[#fe5b25]/20">
          <Wifi className="w-3 h-3 text-[#fe5b25]/80" />
          <span className="text-[9px] font-bold text-[#fe5b25] uppercase tracking-[0.12em]">LIVE</span>
        </div>
      </div>
    </div>
  )
}
