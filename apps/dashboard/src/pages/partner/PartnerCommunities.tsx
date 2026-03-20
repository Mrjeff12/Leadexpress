import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../lib/auth'
import { useI18n } from '../../lib/i18n'
import { supabase } from '../../lib/supabase'
import { usePartnerGroups } from '../../hooks/usePartnerGroups'
import { getScoreColorClass } from '../../lib/group-score'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../../components/shadcn/ui/dialog'
import {
  MessageSquare,
  Users,
  Zap,
  Loader2,
  CheckCircle2,
  Link2,
  QrCode,
  ShieldAlert,
  ArrowRight,
  TrendingUp,
  Bot,
  Smartphone,
  BarChart3,
  RefreshCw,
  Activity,
} from 'lucide-react'

type ConnectTab = 'link' | 'qr'

export default function PartnerCommunities() {
  const { effectiveUserId } = useAuth()
  const { locale } = useI18n()
  const he = locale === 'he'
  const navigate = useNavigate()

  // Partner ID lookup
  const [partnerId, setPartnerId] = useState<string | null>(null)
  useEffect(() => {
    if (!effectiveUserId) return
    supabase
      .from('community_partners')
      .select('id')
      .eq('user_id', effectiveUserId)
      .maybeSingle()
      .then(({ data }) => setPartnerId(data?.id ?? null))
  }, [effectiveUserId])

  // Real analytics data
  const { data: groups = [], isLoading: loading, refetch: loadGroups } = usePartnerGroups(partnerId ?? undefined)

  const [showConnectModal, setShowConnectModal] = useState(false)
  const [connectTab, setConnectTab] = useState<ConnectTab>('qr')
  const [groupLink, setGroupLink] = useState('')
  const [linking, setLinking] = useState(false)
  const [linkSuccess, setLinkSuccess] = useState(false)

  // QR state
  const [qrLoading, setQrLoading] = useState(false)
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [qrStatus, setQrStatus] = useState<'idle' | 'loading' | 'ready' | 'connected'>('idle')

  const WA_LISTENER_URL = import.meta.env.VITE_WA_LISTENER_URL || 'http://localhost:3001'

  const [linkError, setLinkError] = useState<string | null>(null)

  async function handleLinkGroup() {
    if (!groupLink.trim()) return
    setLinking(true)
    setLinkError(null)
    try {
      const { data, error } = await supabase.functions.invoke('partner-link-group', {
        body: { invite_link: groupLink.trim() },
      })

      if (error) throw error
      if (data?.error) throw new Error(data.error)

      setLinkSuccess(true)
      setTimeout(() => {
        setShowConnectModal(false)
        setGroupLink('')
        setLinkSuccess(false)
        setLinkError(null)
        loadGroups()
      }, 2000)
    } catch (err: any) {
      console.error('Link group failed:', err)
      setLinkError(err?.message || 'Failed to link group')
    } finally {
      setLinking(false)
    }
  }

  async function handleQrScan() {
    setQrLoading(true)
    setQrStatus('loading')
    try {
      const res = await fetch(`${WA_LISTENER_URL}/api/status`)
      const data = await res.json()
      if (data.qr) {
        setQrCode(data.qr)
        setQrStatus('ready')
      } else if (data.state === 'connected' || data.state === 'authorized') {
        setQrStatus('connected')
      } else {
        // Request a new QR
        setQrCode(null)
        setQrStatus('ready')
      }
    } catch {
      // Fallback: show placeholder
      setQrCode(null)
      setQrStatus('ready')
    } finally {
      setQrLoading(false)
    }
  }

  function openConnectModal(tab: ConnectTab) {
    setConnectTab(tab)
    setShowConnectModal(true)
    setLinkSuccess(false)
    setLinkError(null)
    setGroupLink('')
    if (tab === 'qr') handleQrScan()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin h-8 w-8 rounded-full border-2 border-[#fe5b25] border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="animate-fade-in space-y-8 pb-16 pt-2">
      {/* Header */}
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900">
            {he ? 'הקבוצות שלי' : 'My Groups'}
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            {he ? 'חבר את קבוצות ה-WhatsApp שלך ונהל אותן מכאן' : 'Connect your WhatsApp groups and manage them from here'}
          </p>
        </div>
        <button
          onClick={() => openConnectModal('qr')}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white shadow-md shadow-[#fe5b25]/20 transition-all hover:shadow-lg hover:scale-[1.02] active:scale-95"
          style={{ background: 'linear-gradient(135deg, #fe5b25, #e04d1c)' }}
        >
          <QrCode className="w-4 h-4" />
          {he ? 'חבר קבוצה' : 'Connect Group'}
        </button>
      </header>

      {/* Primary: QR Code — full control */}
      <button
        onClick={() => openConnectModal('qr')}
        className="group w-full text-start p-7 rounded-2xl bg-gradient-to-br from-white to-[#fff8f5] border-2 border-[#fe5b25]/20 hover:border-[#fe5b25]/40 hover:shadow-xl hover:shadow-[#fe5b25]/8 transition-all relative overflow-hidden"
      >
        <div className="absolute top-4 end-4">
          <span className="px-2.5 py-1 rounded-full bg-[#fe5b25] text-[9px] font-bold text-white uppercase tracking-wider">
            {he ? 'מומלץ' : 'Recommended'}
          </span>
        </div>
        <div className="flex items-start gap-5">
          <div className="w-14 h-14 rounded-2xl bg-[#fe5b25]/10 flex items-center justify-center shrink-0">
            <QrCode className="w-7 h-7 text-[#fe5b25]" />
          </div>
          <div className="flex-1 pe-20">
            <h3 className="text-base font-bold text-zinc-900 mb-1.5 flex items-center gap-2">
              {he ? 'סרוק QR Code — שליטה מלאה' : 'Scan QR Code — Full Control'}
              <ArrowRight className="w-4 h-4 text-zinc-300 group-hover:text-[#fe5b25] group-hover:translate-x-0.5 transition-all" />
            </h3>
            <p className="text-sm text-zinc-500 leading-relaxed mb-4">
              {he
                ? 'סרוק ברקוד עם הטלפון שלך וקבל שליטה מלאה — שלח הודעות פרטיות, הילחם בספאמרים, קבל אנליטיקה חכמה על מי פעיל, מי מפרסם עבודות, מי קבלן ומי רדום. הכל מהממשק שלנו.'
                : 'Scan a QR code and get full control — send private messages, fight spammers, get smart analytics on who\'s active, who posts jobs, who\'s a contractor, and who\'s dormant. All from our dashboard.'}
            </p>
            <div className="flex flex-wrap items-center gap-3">
              {[
                { icon: MessageSquare, label: he ? 'הודעות פרטיות' : 'Private Messages', color: 'text-[#fe5b25]' },
                { icon: ShieldAlert, label: he ? 'מלחמה בספאם' : 'Anti-Spam', color: 'text-[#fe5b25]' },
                { icon: BarChart3, label: he ? 'אנליטיקה חכמה' : 'Smart Analytics', color: 'text-[#fe5b25]' },
                { icon: Activity, label: he ? 'מעקב פעילות' : 'Activity Tracking', color: 'text-[#fe5b25]' },
                { icon: Zap, label: he ? 'זיהוי לידים' : 'Lead Detection', color: 'text-[#fe5b25]' },
              ].map(({ icon: Icon, label, color }, i) => (
                <span key={i} className={`flex items-center gap-1.5 text-[11px] font-semibold ${color} bg-[#fe5b25]/5 px-2.5 py-1 rounded-full`}>
                  <Icon className="w-3 h-3" /> {label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </button>

      {/* Secondary: Invite Link — limited */}
      <button
        onClick={() => openConnectModal('link')}
        className="group w-full text-start p-5 rounded-2xl bg-white border border-zinc-200 hover:border-zinc-300 hover:shadow-md transition-all"
      >
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-zinc-100 flex items-center justify-center shrink-0">
            <Link2 className="w-5 h-5 text-zinc-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-zinc-700 flex items-center gap-2">
              {he ? 'או: חבר דרך לינק הזמנה בלבד' : 'Or: Connect via Invite Link Only'}
              <ArrowRight className="w-3.5 h-3.5 text-zinc-300 group-hover:text-zinc-500 group-hover:translate-x-0.5 transition-all" />
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              {he
                ? 'הבוט מצטרף לקבוצה ומזהה לידים אוטומטית. שים לב: בחיבור הזה לא תוכל לשלוח הודעות פרטיות או לנהל אנשי קשר מהממשק.'
                : 'The bot joins your group and detects leads automatically. Note: with this method you cannot send private messages or manage contacts from the dashboard.'}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="flex items-center gap-1 text-[10px] font-semibold text-zinc-400">
              <Bot className="w-3 h-3" /> {he ? 'בוט בלבד' : 'Bot Only'}
            </span>
          </div>
        </div>
      </button>

      {/* Connected Groups */}
      {groups.length > 0 ? (
        <>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-zinc-900">
              {he ? 'קבוצות מחוברות' : 'Connected Groups'}
              <span className="ml-2 text-sm font-normal text-zinc-400">({groups.length})</span>
            </h2>
            <button
              onClick={() => loadGroups()}
              className="flex items-center gap-1.5 text-xs font-medium text-zinc-400 hover:text-zinc-600 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" /> {he ? 'רענן' : 'Refresh'}
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {groups.map(group => {
              const actConf = {
                high: { label: he ? 'גבוהה' : 'High', color: 'text-emerald-600', bg: 'bg-emerald-50' },
                medium: { label: he ? 'בינונית' : 'Medium', color: 'text-amber-600', bg: 'bg-amber-50' },
                low: { label: he ? 'נמוכה' : 'Low', color: 'text-orange-500', bg: 'bg-orange-50' },
                dormant: { label: he ? 'רדומה' : 'Dormant', color: 'text-red-500', bg: 'bg-red-50' },
              }[group.activityLevel]

              return (
                <button
                  key={group.id}
                  onClick={() => navigate(`/partner/groups/${group.id}`)}
                  className="text-start p-6 rounded-2xl bg-white border border-zinc-200 hover:border-[#fe5b25]/30 hover:shadow-lg hover:shadow-[#fe5b25]/5 transition-all group"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className={`w-10 h-10 rounded-xl text-sm font-bold flex items-center justify-center ${getScoreColorClass(group.score.color)}`}>
                        {group.score.score}
                      </span>
                      <div>
                        <h3 className="text-sm font-bold text-zinc-800 truncate max-w-[180px]">
                          {group.name || (he ? 'קבוצה ללא שם' : 'Unnamed Group')}
                        </h3>
                        <p className="text-[10px] text-zinc-400">
                          {group.total_members} {he ? 'חברים' : 'members'}
                        </p>
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${actConf.bg} ${actConf.color}`}>
                      {actConf.label}
                    </span>
                  </div>

                  {/* Spam alert */}
                  {group.spamRatio > 50 && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-red-50 mb-3">
                      <ShieldAlert className="w-3 h-3 text-red-500" />
                      <span className="text-[10px] font-semibold text-red-500">
                        {group.spamRatio}% {he ? 'ספאמרים' : 'spammers'}
                      </span>
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { icon: MessageSquare, value: group.messages7d, label: he ? 'הודעות/שבוע' : 'Msgs/Week' },
                      { icon: Zap, value: group.leadsDetected, label: he ? 'לידים' : 'Leads' },
                      { icon: Users, value: group.memberBreakdown.buyers, label: he ? 'קונים' : 'Buyers' },
                    ].map((stat, i) => (
                      <div key={i} className="text-center p-2 rounded-lg bg-zinc-50">
                        <stat.icon className="w-3.5 h-3.5 text-zinc-400 mx-auto mb-1" />
                        <p className="text-sm font-bold text-zinc-800">{stat.value}</p>
                        <p className="text-[9px] text-zinc-400 uppercase tracking-wider">{stat.label}</p>
                      </div>
                    ))}
                  </div>

                  <p className="text-[10px] text-zinc-300 mt-3 text-end group-hover:text-[#fe5b25] transition-colors">
                    {he ? 'לחץ לאנליטיקה מלאה →' : 'Click for full analytics →'}
                  </p>
                </button>
              )
            })}
          </div>
        </>
      ) : (
        /* Empty state */
        <div className="rounded-2xl bg-white border border-dashed border-zinc-300 py-20 flex flex-col items-center gap-5">
          <div className="w-16 h-16 rounded-2xl bg-zinc-50 flex items-center justify-center">
            <MessageSquare className="w-7 h-7 text-zinc-300" />
          </div>
          <div className="text-center max-w-md">
            <h3 className="text-lg font-semibold text-zinc-800 mb-2">
              {he ? 'עוד לא חיברת קבוצות' : 'No groups connected yet'}
            </h3>
            <p className="text-sm text-zinc-400 leading-relaxed">
              {he
                ? 'חבר את הקבוצות שלך דרך לינק הזמנה או סריקת QR כדי להתחיל לנהל אותן ולהרוויח מהפניות'
                : 'Connect your groups via invite link or QR scan to start managing them and earning from referrals'}
            </p>
          </div>
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={() => openConnectModal('qr')}
              className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white shadow-md hover:shadow-lg transition-all"
              style={{ background: 'linear-gradient(135deg, #fe5b25, #e04d1c)' }}
            >
              <QrCode className="w-4 h-4" />
              {he ? 'סרוק QR — שליטה מלאה' : 'Scan QR — Full Control'}
            </button>
            <button
              onClick={() => openConnectModal('link')}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium text-zinc-400 hover:text-zinc-600 transition-colors"
            >
              <Link2 className="w-3.5 h-3.5" />
              {he ? 'או חבר דרך לינק בלבד' : 'or connect via invite link only'}
            </button>
          </div>
        </div>
      )}

      {/* How it Works section */}
      <div className="rounded-2xl bg-gradient-to-br from-zinc-900 to-zinc-800 p-8 text-white">
        <h3 className="text-lg font-bold mb-6">
          {he ? 'איך זה עובד?' : 'How does it work?'}
        </h3>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            {
              step: '1',
              icon: <Link2 className="w-5 h-5" />,
              title: he ? 'חבר קבוצה' : 'Connect a Group',
              desc: he
                ? 'הדבק לינק הזמנה או סרוק QR. הבוט שלנו מצטרף ומתחיל לנתח.'
                : 'Paste an invite link or scan QR. Our bot joins and starts analyzing.',
            },
            {
              step: '2',
              icon: <Bot className="w-5 h-5" />,
              title: he ? 'AI עובד בשבילך' : 'AI Works for You',
              desc: he
                ? 'מזהה לידים, מסנן ספאמרים, מנתח מי פעיל ומי רדום, מי מפרסם עבודות ומי קבלן ביצוע.'
                : 'Detects leads, filters spammers, analyzes who\'s active vs dormant, who posts jobs vs who\'s a contractor.',
            },
            {
              step: '3',
              icon: <TrendingUp className="w-5 h-5" />,
              title: he ? 'שליטה + הכנסה' : 'Control + Revenue',
              desc: he
                ? 'שלח הודעות פרטיות, ראה אנליטיקה חכמה, והרוויח עמלה על כל מנוי חדש.'
                : 'Send private messages, view smart analytics, and earn commission on every new subscriber.',
            },
          ].map((item, i) => (
            <div key={i} className="flex gap-4">
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                {item.icon}
              </div>
              <div>
                <p className="text-[10px] font-bold text-[#fe5b25] uppercase tracking-wider mb-1">
                  {he ? `שלב ${item.step}` : `Step ${item.step}`}
                </p>
                <h4 className="text-sm font-semibold mb-1">{item.title}</h4>
                <p className="text-xs text-white/50 leading-relaxed">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Connect Modal */}
      <Dialog open={showConnectModal} onOpenChange={setShowConnectModal}>
        <DialogContent className="sm:max-w-lg bg-white rounded-2xl p-0 overflow-hidden">
          {/* Tab header — QR first (primary) */}
          <div className="flex border-b border-zinc-100">
            <button
              onClick={() => { setConnectTab('qr'); handleQrScan() }}
              className={`flex-1 flex items-center justify-center gap-2 py-4 text-sm font-semibold transition-all ${
                connectTab === 'qr'
                  ? 'text-[#fe5b25] border-b-2 border-[#fe5b25]'
                  : 'text-zinc-400 hover:text-zinc-600'
              }`}
            >
              <QrCode className="w-4 h-4" />
              {he ? 'סריקת QR' : 'QR Scan'}
            </button>
            <button
              onClick={() => setConnectTab('link')}
              className={`flex-1 flex items-center justify-center gap-2 py-4 text-sm font-semibold transition-all ${
                connectTab === 'link'
                  ? 'text-zinc-600 border-b-2 border-zinc-400'
                  : 'text-zinc-400 hover:text-zinc-600'
              }`}
            >
              <Link2 className="w-4 h-4" />
              {he ? 'לינק בלבד' : 'Link Only'}
            </button>
          </div>

          <div className="p-6">
            {connectTab === 'qr' ? (
              /* ─── QR Code Tab (Primary) ─── */
              <div className="space-y-5">
                <div className="text-center">
                  <div className="w-14 h-14 rounded-2xl bg-[#fe5b25]/10 flex items-center justify-center mx-auto mb-3">
                    <Smartphone className="w-7 h-7 text-[#fe5b25]" />
                  </div>
                  <DialogHeader>
                    <DialogTitle className="text-lg font-bold text-zinc-900">
                      {he ? 'חבר את WhatsApp שלך' : 'Connect Your WhatsApp'}
                    </DialogTitle>
                    <DialogDescription className="text-sm text-zinc-500 mt-1">
                      {he
                        ? 'סרוק את הברקוד עם הטלפון שלך כדי לנהל את כל הקבוצות ואנשי הקשר שלך מהפלטפורמה שלנו.'
                        : 'Scan the QR code with your phone to manage all your groups and contacts from our platform.'}
                    </DialogDescription>
                  </DialogHeader>
                </div>

                {/* QR display */}
                <div className="flex flex-col items-center gap-4">
                  <div className="w-[220px] h-[220px] rounded-2xl bg-white border-2 border-zinc-100 flex items-center justify-center p-4">
                    {qrLoading ? (
                      <Loader2 className="w-8 h-8 text-zinc-300 animate-spin" />
                    ) : qrStatus === 'connected' ? (
                      <div className="flex flex-col items-center gap-2">
                        <CheckCircle2 className="w-12 h-12 text-green-500" />
                        <span className="text-sm font-semibold text-green-600">{he ? 'מחובר!' : 'Connected!'}</span>
                      </div>
                    ) : qrCode ? (
                      <img src={`data:image/png;base64,${qrCode}`} alt="QR Code" className="w-full h-full object-contain" />
                    ) : (
                      <div className="flex flex-col items-center gap-3">
                        <QrCode className="w-16 h-16 text-zinc-200" />
                        <button
                          onClick={handleQrScan}
                          className="text-xs font-medium text-[#fe5b25] hover:underline flex items-center gap-1"
                        >
                          <RefreshCw className="w-3 h-3" /> {he ? 'טען QR' : 'Load QR Code'}
                        </button>
                      </div>
                    )}
                  </div>

                  {qrStatus !== 'connected' && (
                    <p className="text-[11px] text-zinc-400 text-center max-w-[280px]">
                      {he
                        ? 'פתח WhatsApp בטלפון → הגדרות → מכשירים מקושרים → קשר מכשיר → סרוק את הברקוד'
                        : 'Open WhatsApp on your phone → Settings → Linked Devices → Link a Device → Scan the QR code'}
                    </p>
                  )}
                </div>

                {/* Benefits */}
                <div className="bg-zinc-50 rounded-xl p-4 space-y-3">
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                    {he ? 'מה תקבל:' : 'What you get:'}
                  </p>
                  {[
                    { icon: <MessageSquare className="w-3.5 h-3.5" />, text: he ? 'שלח הודעות פרטיות וקבוצתיות מהדשבורד' : 'Send private & group messages from the dashboard' },
                    { icon: <ShieldAlert className="w-3.5 h-3.5" />, text: he ? 'זהה והסר ספאמרים ומפרי חוקים מהקבוצה' : 'Detect and remove spammers & rule violators from your group' },
                    { icon: <BarChart3 className="w-3.5 h-3.5" />, text: he ? 'אנליטיקה חכמה — על מה מדברים, מי הכי פעיל, מי רדום' : 'Smart analytics — conversation topics, most active members, dormant users' },
                    { icon: <Activity className="w-3.5 h-3.5" />, text: he ? 'זהה מי מפרסם עבודות ומי קבלן ביצוע' : 'Identify who posts jobs vs. who\'s an execution contractor' },
                    { icon: <Zap className="w-3.5 h-3.5" />, text: he ? 'זיהוי לידים אוטומטי + המלצות AI' : 'Automatic lead detection + AI recommendations' },
                  ].map((step, i) => (
                    <div key={i} className="flex items-center gap-2.5">
                      <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center text-[#fe5b25] shrink-0 shadow-sm">
                        {step.icon}
                      </div>
                      <span className="text-xs text-zinc-600">{step.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              /* ─── Invite Link Tab (Secondary / Limited) ─── */
              <div className="space-y-5">
                <div className="text-center">
                  <div className="w-14 h-14 rounded-2xl bg-zinc-100 flex items-center justify-center mx-auto mb-3">
                    <Bot className="w-7 h-7 text-zinc-400" />
                  </div>
                  <DialogHeader>
                    <DialogTitle className="text-lg font-bold text-zinc-900">
                      {he ? 'חבר קבוצה דרך לינק בלבד' : 'Connect Group via Link Only'}
                    </DialogTitle>
                    <DialogDescription className="text-sm text-zinc-500 mt-1">
                      {he
                        ? 'הבוט יצטרף לקבוצה ויזהה לידים אוטומטית. שים לב: בחיבור הזה לא תוכל לשלוח הודעות פרטיות או לנהל אנשי קשר מהממשק.'
                        : 'The bot will join and detect leads automatically. Note: with this method you cannot send private messages or manage contacts from the dashboard.'}
                    </DialogDescription>
                  </DialogHeader>
                </div>

                {/* Upgrade nudge */}
                <div className="bg-[#fff8f5] border border-[#fe5b25]/15 rounded-xl p-3 flex items-center gap-3">
                  <QrCode className="w-5 h-5 text-[#fe5b25] shrink-0" />
                  <p className="text-[11px] text-zinc-600">
                    {he
                      ? 'רוצה שליטה מלאה? סרוק QR Code כדי לשלוח הודעות פרטיות, לנהל קבוצות ולראות אנליטיקה.'
                      : 'Want full control? Scan QR Code to send private messages, manage groups, and view analytics.'}
                    <button
                      onClick={() => { setConnectTab('qr'); handleQrScan() }}
                      className="font-semibold text-[#fe5b25] hover:underline ms-1"
                    >
                      {he ? 'סרוק QR' : 'Scan QR'}
                    </button>
                  </p>
                </div>

                {linkSuccess ? (
                  <div className="flex flex-col items-center gap-3 py-6">
                    <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center">
                      <CheckCircle2 className="w-7 h-7 text-green-500" />
                    </div>
                    <p className="text-sm font-semibold text-green-600">
                      {he ? 'הבקשה נשלחה! הבוט יצטרף בקרוב.' : 'Request sent! The bot will join shortly.'}
                    </p>
                    <p className="text-xs text-zinc-400">
                      {he ? 'אשר את הבוט כמנהל בקבוצה' : 'Approve the bot as admin in your group'}
                    </p>
                  </div>
                ) : (
                  <>
                    <input
                      value={groupLink}
                      onChange={e => { setGroupLink(e.target.value); setLinkError(null) }}
                      placeholder="https://chat.whatsapp.com/..."
                      className={`w-full px-4 py-3.5 rounded-xl border text-sm outline-none focus:ring-2 transition-all ${
                        linkError
                          ? 'border-red-300 focus:border-red-400 focus:ring-red-200/50'
                          : 'border-zinc-200 focus:border-zinc-400 focus:ring-zinc-200/50'
                      }`}
                      autoFocus
                    />
                    {linkError && (
                      <p className="text-xs text-red-500 mt-1">{linkError}</p>
                    )}

                    {/* Steps */}
                    <div className="bg-zinc-50 rounded-xl p-4 space-y-3">
                      <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                        {he ? 'מה יקרה:' : 'What happens next:'}
                      </p>
                      {[
                        { icon: <Bot className="w-3.5 h-3.5" />, text: he ? 'הבוט שלנו מצטרף לקבוצה דרך הלינק' : 'Our bot joins the group via the invite link' },
                        { icon: <Zap className="w-3.5 h-3.5" />, text: he ? 'הבוט מתחיל לנתח הודעות ולזהות לידים אוטומטית' : 'The bot starts analyzing messages and detecting leads automatically' },
                        { icon: <TrendingUp className="w-3.5 h-3.5" />, text: he ? 'אתה מרוויח עמלה על כל מנוי חדש' : 'You earn commission on every new subscriber' },
                      ].map((step, i) => (
                        <div key={i} className="flex items-center gap-2.5">
                          <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center text-zinc-400 shrink-0 shadow-sm">
                            {step.icon}
                          </div>
                          <span className="text-xs text-zinc-600">{step.text}</span>
                        </div>
                      ))}
                    </div>

                    <button
                      onClick={handleLinkGroup}
                      disabled={!groupLink.trim() || linking}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition-all hover:shadow-lg bg-zinc-700 hover:bg-zinc-800"
                    >
                      {linking ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                      {he ? 'חבר קבוצה (לינק בלבד)' : 'Connect Group (Link Only)'}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
