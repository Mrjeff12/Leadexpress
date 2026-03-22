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
  Coins,
  Settings,
  Brain,
  MessageCircle,
  Scan,
} from 'lucide-react'

/* ═══════════════════════════════════════════════════════════
   Solar System Dashboard
   ═══════════════════════════════════════════════════════════
   Each department = its own "solar system" with clear space.

   Left zone:    Channels ☀️ (groups orbit)  →  Scanner
   Center zone:  Brain ☀️ (the AI core, pulse animation)
   Right zone:   Clients ☀️ (professions ring → contractors orbit each)
   Bottom zone:  Finance, Partners, Intel, Settings
   Top:          Bot

   Pipeline: Channels → Brain → Clients → Finance
   Support:  Bot ↔ Brain, Partners → Clients, Brain → Intel
*/

const VW = 1400
const VH = 800

/* ─── Hub definitions with absolute positions ─── */
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
  // ☀️ Brain — center-left, the AI engine
  { id: 'brain', x: 420, y: 390, size: 76, color: '#fe5b25',
    gradient: ['#ff8a5c', '#e04d1c'], icon: Brain, path: '/admin/channels/leads' },

  // ☀️ Channels — far left, groups orbit around it
  { id: 'channels', x: 140, y: 390, size: 52, color: '#8b5cf6',
    gradient: ['#a78bfa', '#7c3aed'], icon: MessageCircle, path: '/admin/channels' },

  // Scanner — between Channels and Brain
  { id: 'scan', x: 285, y: 265, size: 40, color: '#06b6d4',
    gradient: ['#22d3ee', '#0891b2'], icon: Scan, path: '/admin/channels/scan' },

  // Bot — above Brain
  { id: 'bot', x: 420, y: 130, size: 44, color: '#8b5cf6',
    gradient: ['#a78bfa', '#7c3aed'], icon: Bot, path: '/admin/bot' },

  // ☀️ Clients — right side, center of profession solar system
  { id: 'clients', x: 950, y: 380, size: 56, color: '#10b981',
    gradient: ['#34d399', '#059669'], icon: Users, path: '/admin/clients' },

  // Finance — bottom center (navigates to subscriptions under Clients)
  { id: 'finance', x: 560, y: 660, size: 44, color: '#f59e0b',
    gradient: ['#fbbf24', '#d97706'], icon: Coins, path: '/admin/finance' },

  // Partners — bottom left
  { id: 'partners', x: 210, y: 660, size: 44, color: '#ec4899',
    gradient: ['#f472b6', '#db2777'], icon: Handshake, path: '/admin/partners' },

  // Today's leads — bottom right (navigates to leads under Clients)
  { id: 'intel', x: 760, y: 660, size: 44, color: '#3b82f6',
    gradient: ['#60a5fa', '#2563eb'], icon: BarChart3, path: '/admin/channels/leads' },

  // Settings — far bottom right
  { id: 'settings', x: 1200, y: 660, size: 36, color: '#6b7280',
    gradient: ['#9ca3af', '#4b5563'], icon: Settings, path: '/admin/settings' },
]

function getHub(id: string) { return HUBS.find(h => h.id === id)! }

/* ─── Pipeline connections between solar systems ─── */
const CONNECTIONS: { from: string; to: string; width: number; animated?: boolean }[] = [
  // Primary pipeline: Channels → Brain → Clients → Finance
  { from: 'channels', to: 'brain', width: 3, animated: true },
  { from: 'scan', to: 'brain', width: 2, animated: true },
  { from: 'brain', to: 'clients', width: 3.5, animated: true },
  { from: 'clients', to: 'finance', width: 2, animated: true },
  // AI: Bot ↔ Brain
  { from: 'bot', to: 'brain', width: 2, animated: true },
  // Analytics: Brain → Intel
  { from: 'brain', to: 'intel', width: 1.5, animated: true },
  // Referrals: Partners → Clients
  { from: 'partners', to: 'clients', width: 1.5 },
  // Config: Settings → Brain
  { from: 'settings', to: 'brain', width: 1 },
]

/* ─── Subscription status colors ─── */
const _STATUS_COLORS: Record<string, string> = {
  active: '#22c55e',
  trialing: '#3b82f6',
  past_due: '#f59e0b',
  canceled: '#ef4444',
  incomplete: '#9ca3af',
}
void _STATUS_COLORS

/* ─── Solar system radii ─── */
const PROF_RING_R = 155      // professions orbit Clients at this radius
/* contractor orbit removed — count on profession node is cleaner */
const GROUP_ORBIT_R = 55      // groups orbit Channels

/* ═══════════════════════════════════════════════════════════
   Network Visualization (SVG + HTML overlay)
   ═══════════════════════════════════════════════════════════ */
function NetworkVisualization({ he, kpis }: {
  he: boolean
  kpis: Record<string, number | string>
}) {
  const { data: net } = useNetworkData()
  const navigate = useNavigate()
  const clientsHub = getHub('clients')
  const channelsHub = getHub('channels')
  const brainHub = getHub('brain')

  /* ─── Professions ring around Clients hub ─── */
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
        angle,
      }
    })
  }, [net.professions, clientsHub])

  /* Contractors data used for count display only — no individual nodes */

  /* ─── Group bubbles orbiting Channels ─── */
  const groupBubbles = useMemo(() => {
    const count = Math.min(Number(net.groupsCount) || 8, 16)
    return Array.from({ length: count }, (_, i) => {
      const angle = (i / count) * Math.PI * 2 - Math.PI / 2
      const r = GROUP_ORBIT_R + (i % 3) * 8
      return {
        x: channelsHub.x + r * Math.cos(angle),
        y: channelsHub.y + r * Math.sin(angle),
        size: 4 + (i % 3) * 2,
      }
    })
  }, [net.groupsCount, channelsHub])

  /* ─── Hub label data ─── */
  const hotLeads = Number(kpis.hotLeads ?? 0)
  const mrr = Number(kpis.mrr ?? 0)
  const leadsToday = Number(kpis.leadsToday ?? 0)
  const activePartners = Number(kpis.activePartners ?? 0)

  const hubLabels: Record<string, { value: string | number; label: string }> = {
    brain: { value: hotLeads, label: he ? 'לידים חמים' : 'HOT LEADS' },
    channels: { value: net.groupsCount, label: he ? 'קבוצות' : 'GROUPS' },
    clients: { value: net.contractors.length, label: he ? 'קבלנים' : 'CONTRACTORS' },
    finance: { value: `$${mrr}`, label: 'MRR' },
    intel: { value: leadsToday, label: he ? 'היום' : 'TODAY' },
    partners: { value: activePartners, label: he ? 'שותפים' : 'PARTNERS' },
    bot: { value: 'AI', label: he ? 'בוט' : 'BOT' },
    scan: { value: '', label: he ? 'סריקה' : 'SCAN' },
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

        {/* ─── Clients Solar System: professions orbit ring ─── */}
        <circle cx={clientsHub.x} cy={clientsHub.y} r={PROF_RING_R}
          fill="none" stroke="#10b981" strokeWidth="0.6" opacity="0.1" strokeDasharray="4 8" />

        {/* (contractor orbit rings removed) */}

        {/* ─── Channels Solar System: group orbit ring ─── */}
        <circle cx={channelsHub.x} cy={channelsHub.y} r={GROUP_ORBIT_R}
          fill="none" stroke="#8b5cf6" strokeWidth="0.5" opacity="0.1" strokeDasharray="3 5" />

        {/* ─── Brain pulse animation ─── */}
        <circle cx={brainHub.x} cy={brainHub.y} r="50" fill="none" stroke="#fe5b25" strokeWidth="1" opacity="0.08">
          <animate attributeName="r" values="50;120" dur="4s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.08;0" dur="4s" repeatCount="indefinite" />
        </circle>

        {/* ─── Hub-to-hub connections ─── */}
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

        {/* ─── Clients hub → Profession spokes ─── */}
        {profNodes.map((p, i) => (
          <line key={`spoke-${i}`}
            x1={clientsHub.x} y1={clientsHub.y} x2={p.x} y2={p.y}
            stroke={p.color || '#10b981'} strokeWidth="1" opacity="0.1" />
        ))}

        {/* (contractor lines removed — count on profession is enough) */}

        {/* ─── Group bubbles orbiting Channels ─── */}
        {groupBubbles.map((g, i) => (
          <g key={`gb-${i}`}>
            <circle cx={g.x} cy={g.y} r={g.size} fill="#8b5cf6" opacity="0.12">
              <animate attributeName="r" values={`${g.size};${g.size + 1.5};${g.size}`}
                dur={`${3 + i * 0.2}s`} repeatCount="indefinite" />
            </circle>
            <line x1={channelsHub.x} y1={channelsHub.y} x2={g.x} y2={g.y}
              stroke="#8b5cf6" strokeWidth="0.3" opacity="0.06" />
          </g>
        ))}
      </svg>

      {/* ═══ HTML Layer ═══ */}

      {/* ─── Hub nodes ─── */}
      {HUBS.map((hub) => {
        const Icon = hub.icon
        const data = hubLabels[hub.id]
        return (
          <div
            key={hub.id}
            className="absolute flex flex-col items-center cursor-pointer transition-all duration-300 hover:scale-110 hover:-translate-y-1"
            style={{
              left: `${(hub.x / VW) * 100}%`,
              top: `${(hub.y / VH) * 100}%`,
              transform: 'translate(-50%, -50%)',
              pointerEvents: 'auto',
            }}
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
              <div className="text-[14px] font-black tabular-nums text-[#0b0707]/85 mt-1 leading-none">
                {data.value}
              </div>
            )}
            <div className="text-[8px] text-[#3b3b3b]/40 uppercase tracking-[0.1em] font-semibold mt-0.5">
              {data.label}
            </div>
          </div>
        )
      })}

      {/* ─── Profession nodes orbiting Clients ─── */}
      {profNodes.map((prof, i) => {
        const hasContractors = prof.contractorCount > 0
        return (
          <div
            key={prof.id}
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

      {/* Contractor avatars removed — profession count badges tell the story */}

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
    <div className="h-screen w-full flex flex-col" style={{ background: '#faf9f6' }}>
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

      {/* ═══════════════ SOLAR SYSTEM NETWORK ═══════════════ */}
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
