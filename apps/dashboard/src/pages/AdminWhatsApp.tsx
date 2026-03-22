import { useState, useEffect, useRef, useCallback } from 'react'
import { useI18n } from '../lib/i18n'
import { useAdminWhatsAppData } from '../hooks/useAdminWhatsAppData'
import {
  Smartphone,
  QrCode,
  CheckCircle2,
  WifiOff,
  Radio,
  MessageSquare,
  AlertTriangle,
  Loader2,
  Search,
  Eye,
  EyeOff,
  Zap,
  Filter,
  Brain,
  ArrowRight,
  UserX,
  Clock,
  Activity,
  TrendingUp,
  Shield,
  Plus,
  Users,
} from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────────
type ConnectionStatus = 'disconnected' | 'waiting_qr' | 'connecting' | 'connected' | 'blocked'

type PipelineStage =
  | 'received' | 'quick_filtered' | 'sender_filtered' | 'pattern_matched'
  | 'ai_parsing' | 'ai_parsed' | 'no_lead' | 'lead_created'
  | 'matched' | 'sent' | 'claimed' | 'expired'

interface _WAGroup {
  id: string
  name: string
  messageCount: number
  isActive: boolean
  lastMessageAt?: string
  totalMembers?: number
  knownSellers?: number
  knownBuyers?: number
  category?: string
}

interface WAMessage {
  id: string
  sender: string
  senderName: string
  text: string
  timestamp: number
  isLead?: boolean
  pipelineStage?: PipelineStage
  senderClassification?: 'unknown' | 'seller' | 'buyer' | 'bot' | 'admin'
}

interface PipelineEvent {
  id: string
  groupName?: string
  senderName?: string
  stage: PipelineStage
  detail?: Record<string, unknown>
  messagePreview?: string
  createdAt: string
}

interface _WAAccount {
  id: string
  label: string
  region: string
  phone: string | null
  status: ConnectionStatus
  groupCount: number
  leadsToday: number
  messagesTotal: number
  qr: string | null
  connectedSince: string | null
  displayName: string | null
  avatarUrl: string | null
}

// ── Region config ──────────────────────────────────────────────────────────────
const REGION_CONFIG: Record<string, { emoji: string; label: string; labelHe: string }> = {
  'us-fl': { emoji: '🌴', label: 'Florida', labelHe: 'פלורידה' },
  'us-ny': { emoji: '🗽', label: 'New York', labelHe: 'ניו יורק' },
  'us-tx': { emoji: '🤠', label: 'Texas', labelHe: 'טקסס' },
  'us-ca': { emoji: '☀️', label: 'California', labelHe: 'קליפורניה' },
  'il':    { emoji: '🇮🇱', label: 'Israel', labelHe: 'ישראל' },
  'twilio': { emoji: '💬', label: 'Twilio API', labelHe: 'Twilio רשמי' },
  'green': { emoji: '🟢', label: 'Green API', labelHe: 'Green API אישי' },
}

// ── Stage helpers ──────────────────────────────────────────────────────────────
const STAGE_CONFIG: Record<PipelineStage, { label: string; labelHe: string; color: string; icon: typeof Zap }> = {
  received:        { label: 'Received',       labelHe: 'התקבלה',      color: 'hsl(40 4% 55%)',   icon: MessageSquare },
  quick_filtered:  { label: 'Quick Filter ✗', labelHe: 'פילטר מהיר ✗', color: 'hsl(0 50% 55%)',  icon: Filter },
  sender_filtered: { label: 'Sender Filter ✗',labelHe: 'פילטר שולח ✗', color: 'hsl(25 70% 50%)', icon: UserX },
  pattern_matched: { label: 'Pattern Match ✓',labelHe: 'תבנית ✓',     color: 'hsl(199 70% 45%)', icon: Search },
  ai_parsing:      { label: 'AI Parsing...',  labelHe: 'ניתוח AI...',  color: 'hsl(262 60% 55%)', icon: Brain },
  ai_parsed:       { label: 'AI Parsed ✓',   labelHe: 'נותח ✓',       color: 'hsl(262 60% 45%)', icon: Brain },
  no_lead:         { label: 'Not a Lead',     labelHe: 'לא ליד',       color: 'hsl(0 40% 55%)',   icon: EyeOff },
  lead_created:    { label: 'Lead Created',   labelHe: 'ליד נוצר',     color: 'hsl(14 90% 52%)', icon: Zap },
  matched:         { label: 'Matched',        labelHe: 'שויך',         color: 'hsl(14 99% 57%)', icon: TrendingUp },
  sent:            { label: 'Sent',           labelHe: 'נשלח',         color: 'hsl(199 70% 40%)', icon: ArrowRight },
  claimed:         { label: 'Claimed!',       labelHe: 'נתפס!',        color: 'hsl(14 99% 45%)', icon: CheckCircle2 },
  expired:         { label: 'Expired',        labelHe: 'פג תוקף',      color: 'hsl(0 30% 55%)',   icon: Clock },
}

const SENDER_BADGE: Record<string, { label: string; labelHe: string; color: string; bg: string }> = {
  seller:  { label: 'Seller',  labelHe: 'מוכר',   color: 'hsl(25 80% 40%)',  bg: 'hsl(25 95% 93%)' },
  buyer:   { label: 'Buyer',   labelHe: 'קונה',    color: 'hsl(14 99% 57%)', bg: 'hsl(14 99% 93%)' },
  bot:     { label: 'Bot',     labelHe: 'בוט',     color: 'hsl(262 60% 45%)', bg: 'hsl(262 80% 93%)' },
  admin:   { label: 'Admin',   labelHe: 'אדמין',   color: 'hsl(199 70% 35%)', bg: 'hsl(199 89% 93%)' },
  unknown: { label: 'Unknown', labelHe: 'לא ידוע', color: 'hsl(40 4% 55%)',   bg: 'hsl(35 25% 93%)' },
}

const CATEGORY_EMOJI: Record<string, string> = {
  hvac: '❄️', renovation: '🔨', fencing: '🏗️', cleaning: '🧹',
}

function timeAgo(ts: string | number, he: boolean): string {
  const diff = Date.now() - (typeof ts === 'number' ? ts : new Date(ts).getTime())
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return he ? 'עכשיו' : 'now'
  if (mins < 60) return he ? `לפני ${mins} דק׳` : `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return he ? `לפני ${hrs} שע׳` : `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return he ? `לפני ${days} ימים` : `${days}d ago`
}

// ── Demo QR ────────────────────────────────────────────────────────────────────
function DemoQR({ size = 180 }: { size?: number }) {
  const cells = 25
  const cellSize = size / cells
  const rects: React.ReactElement[] = []
  let seed = 42
  function rand() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646 }
  for (let y = 0; y < cells; y++) {
    for (let x = 0; x < cells; x++) {
      const isFinderTL = x < 7 && y < 7
      const isFinderTR = x >= cells - 7 && y < 7
      const isFinderBL = x < 7 && y >= cells - 7
      if (isFinderTL || isFinderTR || isFinderBL) {
        const ox = isFinderTL ? 0 : isFinderTR ? cells - 7 : 0
        const oy = isFinderTL ? 0 : isFinderTR ? 0 : cells - 7
        const lx = x - ox, ly = y - oy
        if (lx === 0 || lx === 6 || ly === 0 || ly === 6 || (lx >= 2 && lx <= 4 && ly >= 2 && ly <= 4)) {
          rects.push(<rect key={`${x}-${y}`} x={x * cellSize} y={y * cellSize} width={cellSize} height={cellSize} fill="hsl(14 99% 57%)" />)
        }
      } else if (rand() > 0.55) {
        rects.push(<rect key={`${x}-${y}`} x={x * cellSize} y={y * cellSize} width={cellSize} height={cellSize} fill="hsl(14 99% 57%)" rx={1} />)
      }
    }
  }
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ borderRadius: 8 }}>
      <rect width={size} height={size} fill="white" rx={8} />
      {rects}
    </svg>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// ██  MAIN COMPONENT  ████████████████████████████████████████████████████████
// ═══════════════════════════════════════════════════════════════════════════════
export default function AdminWhatsApp() {
  const { locale } = useI18n()
  const he = locale === 'he'
  const WA_API = import.meta.env.VITE_WA_LISTENER_URL || ''

  // ── UI-only state ──────────────────────────────────────────────────────────
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null)
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)
  const [groupSearch, setGroupSearch] = useState('')
  const [showOnlyLeads, setShowOnlyLeads] = useState(false)
  const [toggledOffGroups, setToggledOffGroups] = useState<Set<string>>(new Set())

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const whatsappData = useAdminWhatsAppData({
    listenerUrl: WA_API,
    enabled: true,
    selectedGroupId,
  })

  // ── Derive everything from hook (no local copies = no flicker) ────────────
  const connState = whatsappData.connState
  const status = connState.status
  const accounts = whatsappData.accounts
  const pipeline = whatsappData.pipeline as PipelineEvent[]
  const messages = whatsappData.messages as WAMessage[]
  const groups = whatsappData.groups.map(g => ({
    ...g,
    isActive: !toggledOffGroups.has(g.id) && g.isActive,
  }))

  // Auto-select first account
  useEffect(() => {
    if (!selectedAccountId && accounts.length > 0) {
      setSelectedAccountId(accounts[0].id)
    }
  }, [selectedAccountId, accounts.length])

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  // ── Real connection flow (production) ─────────────────────────────────────
  async function startRealConnect() {
    try {
      const res = await fetch(`${WA_API}/api/connect`, { method: 'POST' })
      if (!res.ok) throw new Error(`Connection request failed: ${res.status}`)
      // The status polling (useAdminWhatsAppData) will pick up the QR and status changes
    } catch (err) {
      console.error('[AdminWhatsApp] connect error:', err)
      alert(he ? 'שגיאה בחיבור WhatsApp. ודא שהשירות פעיל.' : 'Failed to connect WhatsApp. Make sure the WA listener service is running.')
    }
  }

  // (demo flow removed — real data only)

  function handleDisconnect() {
    setSelectedGroupId(null)
  }

  const toggleGroupMonitoring = useCallback((groupId: string) => {
    setToggledOffGroups(prev => {
      const next = new Set(prev)
      if (next.has(groupId)) next.delete(groupId)
      else next.add(groupId)
      return next
    })
  }, [])

  const selectedGroup = groups.find(g => g.id === selectedGroupId)
  const filteredGroups = groups.filter(g =>
    !groupSearch || g.name.toLowerCase().includes(groupSearch.toLowerCase())
  )
  const filteredMessages = showOnlyLeads ? messages.filter(m => m.isLead) : messages

  // ═════════════════════════════════════════════════════════════════════════════
  // NOT CONNECTED — Show QR / connection UI (Only if no accounts are connected at all)
  // ═════════════════════════════════════════════════════════════════════════════
  if (status !== 'connected' && accounts.length === 0) {
    return (
      <div className="animate-fade-in space-y-6">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'hsl(40 8% 10%)' }}>
            {he ? 'חיבור WhatsApp' : 'WhatsApp Connection'}
          </h1>
          <p className="text-sm mt-1" style={{ color: 'hsl(40 4% 42%)' }}>
            {he ? 'סרוק QR כדי לחבר את WhatsApp להאזנה לקבוצות' : 'Scan QR to connect WhatsApp for group monitoring'}
          </p>
        </div>

        <div className="glass-panel p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row gap-8 items-center justify-center">
            {status === 'disconnected' && (
              <div className="flex flex-col items-center gap-5">
                <div className="w-[180px] h-[180px] rounded-xl flex flex-col items-center justify-center gap-3" style={{ background: 'hsl(35 25% 95%)' }}>
                  <QrCode className="w-12 h-12" style={{ color: 'hsl(40 4% 55%)' }} />
                  <p className="text-xs" style={{ color: 'hsl(40 4% 42%)' }}>{he ? 'לא מחובר' : 'Not connected'}</p>
                </div>
                <button onClick={startRealConnect} className="btn-primary px-6 py-2.5 rounded-lg text-sm font-semibold flex items-center gap-2">
                  <Smartphone className="w-4 h-4" />
                  {he ? 'חבר WhatsApp' : 'Connect WhatsApp'}
                </button>
              </div>
            )}
            {status === 'waiting_qr' && (
              <div className="flex flex-col items-center gap-4">
                <div className="relative">
                  {connState.qr ? (
                    <img src={`data:image/png;base64,${connState.qr}`} alt="QR" width={180} height={180} className="rounded-xl" />
                  ) : (
                    <DemoQR size={180} />
                  )}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center font-bold text-white text-xs" style={{ background: 'hsl(14 99% 57%)' }}>LE</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm" style={{ color: 'hsl(14 99% 57%)' }}>
                  <div className="animate-pulse w-2 h-2 rounded-full bg-[#2D6A4F]" />
                  {he ? 'ממתין לסריקה...' : 'Waiting for scan...'}
                </div>
              </div>
            )}
            {status === 'connecting' && (
              <div className="flex flex-col items-center gap-4">
                <div className="w-[180px] h-[180px] rounded-xl flex flex-col items-center justify-center gap-3" style={{ background: 'hsl(152 46% 90% / 0.5)' }}>
                  <Loader2 className="w-10 h-10 animate-spin" style={{ color: 'hsl(14 99% 57%)' }} />
                  <p className="text-sm font-medium" style={{ color: 'hsl(14 99% 57%)' }}>{he ? 'מתחבר...' : 'Connecting...'}</p>
                </div>
              </div>
            )}

            {/* Instructions */}
            <div className="flex-1 max-w-md space-y-4">
              <h2 className="text-base font-semibold" style={{ color: 'hsl(40 8% 10%)' }}>
                {he ? 'איך זה עובד' : 'How it works'}
              </h2>
              {[
                { step: 1, t: he ? 'לחץ "חבר WhatsApp"' : 'Click "Connect WhatsApp"', d: he ? 'ייוצר QR code ייחודי' : 'A unique QR code will be generated' },
                { step: 2, t: he ? 'סרוק מהטלפון' : 'Scan from your phone', d: 'WhatsApp → ⋮ → Linked Devices → Link a Device' },
                { step: 3, t: he ? 'בחר קבוצות' : 'Select groups', d: he ? 'לאחר החיבור, בחר קבוצות לניטור' : 'After connecting, toggle groups to monitor' },
              ].map(item => (
                <div key={item.step} className="flex gap-3 items-start">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs font-bold" style={{ background: 'hsl(35 25% 92%)', color: 'hsl(40 4% 42%)' }}>
                    {item.step}
                  </div>
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'hsl(40 8% 10%)' }}>{item.t}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'hsl(40 4% 42%)' }}>{item.d}</p>
                  </div>
                </div>
              ))}
              <div className="flex items-start gap-2.5 rounded-lg px-4 py-3 text-xs" style={{ background: 'hsl(40 80% 94%)', color: 'hsl(35 60% 30%)', border: '1px solid hsl(40 60% 85%)' }}>
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{he ? 'המערכת מאזינה בלבד ולא שולחת הודעות.' : 'The system is read-only and never sends messages.'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Service status */}
        <div className="glass-panel p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4" style={{ color: 'hsl(40 4% 42%)' }} />
              <span className="text-xs font-medium" style={{ color: 'hsl(40 4% 42%)' }}>{he ? 'שירות WA Listener' : 'WA Listener Service'}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full" style={{ background: status === 'disconnected' ? 'hsl(0 60% 50%)' : 'hsl(40 80% 50%)' }} />
              <span className="text-xs" style={{ color: 'hsl(40 4% 42%)' }}>{status === 'disconnected' ? (he ? 'לא פועל' : 'Offline') : (he ? 'מתחבר...' : 'Connecting...')}</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // CONNECTED — 3-Panel WhatsApp Monitor
  // ═════════════════════════════════════════════════════════════════════════════
  const selectedAccount = accounts.find(a => a.id === selectedAccountId)
  const totalLeadsToday = accounts.reduce((sum, a) => sum + a.leadsToday, 0)
  const totalMessages = accounts.reduce((sum, a) => sum + a.messagesTotal, 0)
  const connectedCount = accounts.filter(a => a.status === 'connected').length
  const pipelineReceived = pipeline.filter(e => e.stage === 'received').length
  const pipelineFiltered = pipeline.filter(e => e.stage === 'quick_filtered' || e.stage === 'sender_filtered').length
  const aiSavingsPct = pipelineReceived > 0 ? Math.round((pipelineFiltered / pipelineReceived) * 100) : 0

  return (
    <div className="animate-fade-in flex flex-col overflow-y-auto" style={{ maxHeight: 'calc(100vh - 7rem)' }}>
      {/* ── KPI Bar ──────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-3 mb-3">
        {[
          { label: he ? 'הודעות היום' : 'Messages Today', value: totalMessages, icon: MessageSquare, color: 'hsl(40 4% 42%)' },
          { label: he ? 'לידים היום' : 'Leads Today', value: totalLeadsToday, icon: Zap, color: 'hsl(14 99% 57%)' },
          { label: he ? 'חיסכון AI' : 'AI Savings', value: `${aiSavingsPct}%`, icon: Brain, color: 'hsl(262 60% 45%)' },
          { label: he ? 'חשבונות פעילים' : 'Active Accounts', value: `${connectedCount}/${accounts.length}`, icon: Smartphone, color: 'hsl(199 70% 40%)' },
        ].map(kpi => (
          <div key={kpi.label} className="glass-panel px-4 py-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${kpi.color}15` }}>
              <kpi.icon className="w-4.5 h-4.5" style={{ color: kpi.color }} />
            </div>
            <div>
              <div className="text-lg font-semibold" style={{ color: 'hsl(40 8% 10%)' }}>{kpi.value}</div>
              <div className="text-[10px]" style={{ color: 'hsl(40 4% 55%)' }}>{kpi.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Account Tabs ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 mb-3 overflow-x-auto no-scrollbar">
        {accounts.map(acc => {
          const region = REGION_CONFIG[acc.region] ?? { emoji: '🌍', label: acc.region, labelHe: acc.region }
          const isSelected = acc.id === selectedAccountId
          return (
            <button
              key={acc.id}
              onClick={() => setSelectedAccountId(acc.id)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium shrink-0 transition-all"
              style={{
                background: isSelected ? 'hsl(14 99% 57%)' : 'white',
                color: isSelected ? 'white' : 'hsl(40 8% 10%)',
                border: isSelected ? 'none' : '1px solid rgba(0,0,0,0.06)',
                boxShadow: isSelected ? '0 2px 8px hsl(155 44% 30% / 0.3)' : 'none',
              }}
            >
              {acc.avatarUrl ? (
                <img src={acc.avatarUrl} alt="" className="w-5 h-5 rounded-full object-cover" />
              ) : (
                <span>{region.emoji}</span>
              )}
              <span>{acc.displayName ?? (he ? region.labelHe : region.label)}</span>
              <div className="w-1.5 h-1.5 rounded-full" style={{
                background: acc.status === 'connected' ? (isSelected ? 'hsl(140 60% 80%)' : '#25D366')
                  : acc.status === 'blocked' ? 'hsl(0 60% 50%)'
                  : 'hsl(40 80% 50%)',
              }} />
            </button>
          )
        })}
        <button
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium shrink-0 transition-all"
          style={{ border: '1px dashed hsl(35 15% 80%)', color: 'hsl(40 4% 55%)' }}
        >
          <Plus className="w-3 h-3" />
          {he ? 'חשבון חדש' : 'Add Account'}
        </button>
        <div className="flex-1" />
        <a href="/admin/group-scan" className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium shrink-0 transition-all bg-emerald-50 text-emerald-600 hover:bg-emerald-100">
          <Users className="w-3.5 h-3.5" />
          {he ? 'בקשות סריקת קבוצות' : 'Group Scan Requests'}
        </a>
      </div>

      {/* ── Connected Account Header ─────────────────────────────────────────── */}
      {selectedAccount && (
        <div className="glass-panel px-5 py-4 mb-3 flex items-center gap-4">
          {/* Avatar */}
          <div className="relative shrink-0">
            {selectedAccount.avatarUrl ? (
              <img
                src={selectedAccount.avatarUrl}
                alt={selectedAccount.displayName ?? selectedAccount.label}
                className="w-14 h-14 rounded-full object-cover ring-2 ring-white"
                style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.1)' }}
              />
            ) : (
              <div className="w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold text-white" style={{ background: 'linear-gradient(135deg, #25D366, #128C7E)' }}>
                {(selectedAccount.displayName ?? selectedAccount.label)?.[0]?.toUpperCase() ?? 'W'}
              </div>
            )}
            {/* Online indicator */}
            <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-white flex items-center justify-center"
              style={{ background: selectedAccount.status === 'connected' ? '#25D366' : selectedAccount.status === 'blocked' ? '#ef4444' : '#f59e0b' }}>
            </div>
          </div>

          {/* Name & details */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold truncate" style={{ color: 'hsl(40 8% 10%)' }}>
                {selectedAccount.displayName ?? selectedAccount.label}
              </h2>
              <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold shrink-0"
                style={{
                  background: selectedAccount.status === 'connected' ? '#dcfce7' : '#fef3c7',
                  color: selectedAccount.status === 'connected' ? '#16a34a' : '#d97706',
                }}>
                <div className="w-1.5 h-1.5 rounded-full animate-pulse"
                  style={{ background: selectedAccount.status === 'connected' ? '#16a34a' : '#d97706' }} />
                {selectedAccount.status === 'connected' ? (he ? 'מחובר' : 'Connected') : selectedAccount.status}
              </div>
            </div>
            <div className="flex items-center gap-3 mt-1 text-xs" style={{ color: 'hsl(40 4% 55%)' }}>
              <span className="flex items-center gap-1">
                <Smartphone className="w-3 h-3" />
                {selectedAccount.phone ?? '—'}
              </span>
              <span>•</span>
              <span>{REGION_CONFIG[selectedAccount.region]?.emoji} {he ? REGION_CONFIG[selectedAccount.region]?.labelHe : REGION_CONFIG[selectedAccount.region]?.label}</span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Activity className="w-3 h-3" />
                {selectedAccount.groupCount} {he ? 'קבוצות' : 'groups'}
              </span>
              {selectedAccount.connectedSince && (
                <>
                  <span>•</span>
                  <span>{he ? 'מחובר' : 'Connected'} {timeAgo(selectedAccount.connectedSince, he)}</span>
                </>
              )}
              {whatsappData.isFetchingAny && (
                <span className="flex items-center gap-1" style={{ color: 'hsl(14 99% 57%)' }}>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  {he ? 'מתעדכן' : 'Syncing'}
                </span>
              )}
            </div>
          </div>

          {/* Disconnect button */}
          <button onClick={handleDisconnect} className="shrink-0 px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all hover:bg-red-50"
            style={{ color: 'hsl(0 60% 50%)', border: '1px solid hsl(0 50% 88%)' }}>
            <WifiOff className="w-3.5 h-3.5" />
            {he ? 'נתק' : 'Disconnect'}
          </button>
        </div>
      )}

      {/* 3-Panel Layout */}
      <div className="flex-1 grid gap-3 min-h-0" style={{ gridTemplateColumns: '280px 1fr 320px' }}>

        {/* ═══ PANEL 1: Groups Sidebar ═══ */}
        <div className="glass-panel flex flex-col min-h-0 overflow-hidden">
          {/* Search */}
          <div className="p-3 border-b" style={{ borderColor: 'rgba(0,0,0,0.04)' }}>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute top-1/2 -translate-y-1/2" style={{ left: he ? 'auto' : 8, right: he ? 8 : 'auto', color: 'hsl(40 4% 55%)' }} />
              <input
                type="text"
                value={groupSearch}
                onChange={e => setGroupSearch(e.target.value)}
                placeholder={he ? 'חפש קבוצה...' : 'Search groups...'}
                className="w-full text-xs py-2 rounded-lg bg-white/60"
                style={{ paddingLeft: he ? 10 : 28, paddingRight: he ? 28 : 10, border: '1px solid hsl(35 15% 88%)', color: 'hsl(40 8% 10%)' }}
              />
            </div>
            <div className="flex items-center justify-between mt-2">
              <span className="text-[10px] font-medium" style={{ color: 'hsl(40 4% 55%)' }}>
                {groups.filter(g => g.isActive).length}/{groups.length} {he ? 'מנוטרות' : 'monitored'}
              </span>
            </div>
          </div>

          {/* Group List */}
          <div className="flex-1 overflow-y-auto no-scrollbar">
            {filteredGroups.map(group => (
              <div
                key={group.id}
                onClick={() => setSelectedGroupId(group.id)}
                className="flex items-center gap-2.5 px-3 py-2.5 cursor-pointer transition-colors"
                style={{
                  background: selectedGroupId === group.id ? 'hsl(152 46% 90% / 0.4)' : 'transparent',
                  borderBottom: '1px solid rgba(0,0,0,0.03)',
                }}
                onMouseEnter={e => { if (selectedGroupId !== group.id) e.currentTarget.style.background = 'rgba(0,0,0,0.02)' }}
                onMouseLeave={e => { if (selectedGroupId !== group.id) e.currentTarget.style.background = 'transparent' }}
              >
                {/* Toggle */}
                <button
                  onClick={e => { e.stopPropagation(); toggleGroupMonitoring(group.id) }}
                  className="w-8 h-[18px] rounded-full relative shrink-0 transition-colors"
                  style={{ background: group.isActive ? 'hsl(14 85% 50%)' : 'hsl(35 15% 82%)' }}
                >
                  <div className="absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white shadow-sm transition-all" style={{ left: group.isActive ? 'calc(100% - 16px)' : '2px' }} />
                </button>

                {/* Group Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs">{CATEGORY_EMOJI[group.category ?? ''] ?? '💬'}</span>
                    <p className="text-xs font-medium truncate" style={{ color: 'hsl(40 8% 10%)' }}>{group.name}</p>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px]" style={{ color: 'hsl(40 4% 55%)' }}>
                      {group.messageCount} {he ? 'הודעות' : 'msgs'}
                    </span>
                    {group.lastMessageAt && (
                      <span className="text-[10px]" style={{ color: 'hsl(40 4% 65%)' }}>
                        {timeAgo(group.lastMessageAt, he)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Member intelligence mini-badge */}
                {(group.knownSellers ?? 0) > 0 && (
                  <div className="flex flex-col items-end gap-0.5 shrink-0">
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: 'hsl(25 95% 93%)', color: 'hsl(25 80% 40%)' }}>
                      {group.knownSellers}S
                    </span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: 'hsl(14 99% 93%)', color: 'hsl(14 99% 57%)' }}>
                      {group.knownBuyers}B
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Filter Stats */}
          <div className="p-3 border-t" style={{ borderColor: 'rgba(0,0,0,0.04)' }}>
            <div className="flex items-center gap-2">
              <Shield className="w-3.5 h-3.5" style={{ color: 'hsl(14 99% 57%)' }} />
              <span className="text-[10px] font-medium" style={{ color: 'hsl(14 99% 57%)' }}>
                {he ? 'Smart Filter פעיל' : 'Smart Filter Active'}
              </span>
            </div>
          </div>
        </div>

        {/* ═══ PANEL 2: Messages ═══ */}
        <div className="glass-panel flex flex-col min-h-0 overflow-hidden">
          {/* Chat Header */}
          <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: 'rgba(0,0,0,0.04)' }}>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm" style={{ background: 'hsl(152 46% 85% / 0.5)' }}>
                {CATEGORY_EMOJI[selectedGroup?.category ?? ''] ?? '💬'}
              </div>
              <div>
                <p className="text-sm font-medium" style={{ color: 'hsl(40 8% 10%)' }}>{selectedGroup?.name ?? (he ? 'בחר קבוצה' : 'Select a group')}</p>
                {selectedGroup && (
                  <p className="text-[10px]" style={{ color: 'hsl(40 4% 55%)' }}>
                    {selectedGroup.totalMembers ?? '?'} {he ? 'חברים' : 'members'} · {selectedGroup.knownSellers ?? 0} {he ? 'מוכרים' : 'sellers'} · {selectedGroup.knownBuyers ?? 0} {he ? 'קונים' : 'buyers'}
                  </p>
                )}
              </div>
            </div>
            {selectedGroup && (
              <button
                onClick={() => setShowOnlyLeads(prev => !prev)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-medium transition-colors"
                style={{
                  background: showOnlyLeads ? 'hsl(14 99% 57%)' : 'hsl(35 25% 93%)',
                  color: showOnlyLeads ? 'white' : 'hsl(40 4% 42%)',
                }}
              >
                {showOnlyLeads ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                {he ? 'לידים בלבד' : 'Leads only'}
              </button>
            )}
          </div>

          {/* Messages Feed */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2 no-scrollbar" style={{ background: 'hsl(35 25% 97% / 0.3)' }}>
            {!selectedGroup && (
              <div className="flex flex-col items-center justify-center h-full gap-3" style={{ color: 'hsl(40 4% 55%)' }}>
                <MessageSquare className="w-10 h-10 opacity-30" />
                <p className="text-sm">{he ? 'בחר קבוצה מהרשימה' : 'Select a group from the list'}</p>
              </div>
            )}

            {selectedGroup && filteredMessages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full gap-2" style={{ color: 'hsl(40 4% 55%)' }}>
                <p className="text-xs">{showOnlyLeads ? (he ? 'אין לידים עדיין' : 'No leads yet') : (he ? 'אין הודעות' : 'No messages')}</p>
              </div>
            )}

            {filteredMessages.map(msg => {
              const stageConf = msg.pipelineStage ? STAGE_CONFIG[msg.pipelineStage] : null
              const senderBadge = msg.senderClassification ? SENDER_BADGE[msg.senderClassification] : null
              const StageIcon = stageConf?.icon ?? MessageSquare

              return (
                <div
                  key={msg.id}
                  className="rounded-xl px-3 py-2.5 transition-all"
                  style={{
                    background: msg.isLead
                      ? 'linear-gradient(135deg, hsl(152 46% 95%), hsl(152 46% 90% / 0.5))'
                      : 'white',
                    border: msg.isLead ? '1px solid hsl(152 46% 80%)' : '1px solid rgba(0,0,0,0.04)',
                    opacity: msg.pipelineStage === 'quick_filtered' || msg.pipelineStage === 'sender_filtered' ? 0.55 : 1,
                  }}
                >
                  {/* Sender row */}
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[11px] font-semibold" style={{ color: 'hsl(40 8% 10%)' }}>{msg.senderName}</span>
                    {senderBadge && senderBadge.label !== 'Unknown' && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: senderBadge.bg, color: senderBadge.color }}>
                        {he ? senderBadge.labelHe : senderBadge.label}
                      </span>
                    )}
                    <span className="text-[10px] ms-auto" style={{ color: 'hsl(40 4% 65%)' }}>{timeAgo(msg.timestamp, he)}</span>
                  </div>

                  {/* Message text */}
                  <p className="text-xs leading-relaxed" style={{ color: 'hsl(40 8% 18%)' }}>{msg.text}</p>

                  {/* Pipeline stage tag */}
                  {stageConf && (
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <StageIcon className="w-3 h-3" style={{ color: stageConf.color }} />
                      <span className="text-[10px] font-medium" style={{ color: stageConf.color }}>
                        {he ? stageConf.labelHe : stageConf.label}
                      </span>
                      {msg.isLead && (
                        <Zap className="w-3 h-3 ms-auto" style={{ color: 'hsl(14 99% 57%)' }} />
                      )}
                    </div>
                  )}
                </div>
              )
            })}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* ═══ PANEL 3: Live Pipeline Feed ═══ */}
        <div className="glass-panel flex flex-col min-h-0 overflow-hidden">
          <div className="px-4 py-3 border-b flex items-center gap-2" style={{ borderColor: 'rgba(0,0,0,0.04)' }}>
            <Activity className="w-4 h-4" style={{ color: 'hsl(14 99% 57%)' }} />
            <h2 className="text-sm font-semibold" style={{ color: 'hsl(40 8% 10%)' }}>
              {he ? 'פייפליין חי' : 'Live Pipeline'}
            </h2>
            <div className="ms-auto flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full" style={{
                background: whatsappData.source === 'api' ? 'hsl(14 85% 50%)' : 'hsl(40 80% 50%)',
                animation: whatsappData.source === 'api' ? 'pulse 2s infinite' : 'none',
              }} />
              <span className="text-[10px]" style={{ color: 'hsl(40 4% 55%)' }}>
                {whatsappData.source === 'api' ? (he ? 'זמן אמת' : 'Real-time') : (he ? 'מ-DB' : 'From DB')}
              </span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1.5 no-scrollbar">
            {pipeline.map(event => {
              const conf = STAGE_CONFIG[event.stage]
              const Icon = conf.icon
              const isFiltered = event.stage === 'quick_filtered' || event.stage === 'sender_filtered' || event.stage === 'no_lead'
              const isSuccess = event.stage === 'lead_created' || event.stage === 'matched' || event.stage === 'sent' || event.stage === 'claimed'

              return (
                <div
                  key={event.id}
                  className="rounded-lg px-3 py-2 transition-all"
                  style={{
                    background: isSuccess
                      ? 'hsl(152 46% 95% / 0.6)'
                      : isFiltered
                      ? 'hsl(0 0% 97%)'
                      : 'white',
                    border: isSuccess
                      ? '1px solid hsl(152 46% 82%)'
                      : '1px solid rgba(0,0,0,0.03)',
                    opacity: isFiltered ? 0.6 : 1,
                  }}
                >
                  <div className="flex items-center gap-2">
                    <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: conf.color }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-semibold" style={{ color: conf.color }}>
                          {he ? conf.labelHe : conf.label}
                        </span>
                        {event.senderName && (
                          <span className="text-[10px] truncate" style={{ color: 'hsl(40 4% 55%)' }}>
                            · {event.senderName}
                          </span>
                        )}
                      </div>
                      {event.messagePreview && (
                        <p className="text-[10px] truncate mt-0.5" style={{ color: 'hsl(40 4% 42%)' }}>
                          {event.messagePreview}
                        </p>
                      )}
                      {event.detail && Object.keys(event.detail).length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {Object.entries(event.detail).map(([k, v]) => (
                            <span key={k} className="text-[9px] px-1.5 py-0.5 rounded-md" style={{ background: 'hsl(35 25% 92%)', color: 'hsl(40 4% 42%)' }}>
                              {k}: {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <span className="text-[9px] shrink-0" style={{ color: 'hsl(40 4% 65%)' }}>
                      {timeAgo(event.createdAt, he)}
                    </span>
                  </div>
                </div>
              )
            })}

            {pipeline.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full gap-3" style={{ color: 'hsl(40 4% 55%)' }}>
                {whatsappData.source === 'supabase' ? (
                  <>
                    <WifiOff className="w-8 h-8 opacity-20" />
                    <p className="text-xs font-medium">{he ? 'שירות WA Listener לא פעיל' : 'WA Listener Service Offline'}</p>
                    <p className="text-[10px] text-center max-w-[200px]" style={{ color: 'hsl(40 4% 65%)' }}>
                      {he ? 'הנתונים מגיעים מה-DB. הפעל את ה-wa-listener לצפייה בזמן אמת.' : 'Data from DB. Start wa-listener for real-time view.'}
                    </p>
                  </>
                ) : (
                  <>
                    <Activity className="w-8 h-8 opacity-20" />
                    <p className="text-xs">{he ? 'ממתין להודעות...' : 'Waiting for messages...'}</p>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Pipeline Stats Summary */}
          <div className="p-3 border-t space-y-2" style={{ borderColor: 'rgba(0,0,0,0.04)' }}>
            <div className="text-[10px] font-medium" style={{ color: 'hsl(40 8% 10%)' }}>
              {he ? 'Smart Filter — סיכום' : 'Smart Filter — Summary'}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: he ? 'נקלטו' : 'Received', value: pipeline.filter(e => e.stage === 'received').length, color: 'hsl(40 4% 55%)' },
                { label: he ? 'סוננו' : 'Filtered', value: pipeline.filter(e => e.stage === 'quick_filtered' || e.stage === 'sender_filtered' || e.stage === 'no_lead').length, color: 'hsl(0 50% 55%)' },
                { label: he ? 'לידים' : 'Leads', value: pipeline.filter(e => e.stage === 'lead_created' || e.stage === 'matched' || e.stage === 'sent' || e.stage === 'claimed').length, color: 'hsl(14 99% 57%)' },
              ].map(stat => (
                <div key={stat.label} className="text-center">
                  <div className="text-base font-semibold" style={{ color: stat.color }}>{stat.value}</div>
                  <div className="text-[9px]" style={{ color: 'hsl(40 4% 55%)' }}>{stat.label}</div>
                </div>
              ))}
            </div>
            {/* AI savings estimate */}
            {(() => {
              const total = pipeline.filter(e => e.stage === 'received').length
              const filtered = pipeline.filter(e => e.stage === 'quick_filtered' || e.stage === 'sender_filtered').length
              if (filtered === 0 || total === 0) return null
              const pct = Math.round((filtered / total) * 100)
              return (
                <div className="flex items-center gap-2 mt-1 px-2 py-1.5 rounded-lg" style={{ background: 'hsl(152 46% 93%)', border: '1px solid hsl(14 99% 90%)' }}>
                  <Brain className="w-3.5 h-3.5" style={{ color: 'hsl(14 99% 57%)' }} />
                  <span className="text-[10px] font-medium" style={{ color: 'hsl(14 99% 45%)' }}>
                    {he ? `חיסכון AI: ${pct}% סוננו לפני AI` : `AI savings: ${pct}% filtered before AI`}
                  </span>
                </div>
              )
            })()}
          </div>
        </div>
      </div>
    </div>
  )
}
