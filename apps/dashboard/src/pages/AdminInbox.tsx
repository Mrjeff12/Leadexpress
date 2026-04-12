import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useI18n } from '../lib/i18n'
import { useToast } from '../components/hooks/use-toast'
import { supabase } from '../lib/supabase'
import {
  useProspectDetailData,
  type Prospect,
  type Message,
  type ProspectEvent,
  type ProspectListItem,
  type LinkedContractor,
} from '../hooks/useProspectDetailData'
import {
  ArrowRight, Phone, MessageCircle, Send, Loader2,
  ChevronDown, Check, CheckCheck, CircleDot, Sparkles, DollarSign,
  XCircle, PhoneCall, Edit3, Calendar, X, Plus,
  AlertTriangle, Zap, Copy, Clock, MapPin, Briefcase,
  Search, Inbox, Users, Timer, Crown, LogIn, LogOut as LogOutIcon,
  CheckSquare, Square, Download, UserPlus, ArrowUpDown,
  Settings, Trash2, GripVertical, ChevronUp, Pencil,
  HelpCircle, CalendarClock
} from 'lucide-react'

/* ── Design tokens ─────────────────────────────────────────────────── */
const C = {
  primary: '#fe5b25',
  dark: '#1C1C1E',
  cream: '#FBFBFD',
  border: 'rgba(0,0,0,0.04)',
  gray: '#3A3A3C',
  muted: '#8E8E93',
  wa: '#34C759',
  waDark: '#248A3D',
  bg: '#FBFBFD',
  glass: 'rgba(255, 255, 255, 0.85)',
  glassBorder: 'rgba(0,0,0,0.04)',
  card: '#FFFFFF',
  panelShadow: '0 10px 40px -10px rgba(0,0,0,0.05)',
  panelRadius: '24px',
  cardRadius: '16px',
  hoverShadow: '0 8px 24px rgba(0,0,0,0.06)',
  blur: 'blur(32px) saturate(180%)',
}

/* ── WhatsApp Channel Config ─────────────────────────────────────────── */
const WA_CHANNELS = {
  green_api: {
    phone: import.meta.env.VITE_GREEN_API_PHONE || '+972 50-219-3322',
    pic: import.meta.env.VITE_GREEN_API_PIC || '/logo.jpg',
  },
  twilio: {
    phone: import.meta.env.VITE_TWILIO_WA_PHONE || '+1 (305) 851-6498',
    pic: import.meta.env.VITE_TWILIO_WA_PIC || '/icon.png',
  },
} as const

/* ── Stages ─────────────────────────────────────────────────────────── */
const STAGES = [
  { key: 'prospect',        label: 'Prospect',        he: 'פרוספקט',       icon: CircleDot,     color: '#5856D6', bg: '#F2F2F7' },
  { key: 'reached_out',     label: 'Reached Out',     he: 'יצרנו קשר',     icon: Phone,         color: '#fe5b25', bg: '#F2F2F7' },
  { key: 'in_conversation', label: 'In Conversation', he: 'בשיחה',         icon: MessageCircle, color: '#AF52DE', bg: '#F2F2F7' },
  { key: 'onboarding',      label: 'Onboarding',      he: 'הרשמה',         icon: Zap,           color: '#007AFF', bg: '#F2F2F7' },
  { key: 'demo_trial',      label: 'Demo / Trial',    he: 'ניסיון',        icon: Sparkles,      color: '#FF9500', bg: '#F2F2F7' },
  { key: 'trial_expired',   label: 'Trial Expired',   he: 'ניסיון נגמר',   icon: Clock,         color: '#8E8E93', bg: '#F2F2F7' },
  { key: 'paying',          label: 'Paying',          he: 'משלם',          icon: DollarSign,    color: '#34C759', bg: '#F2F2F7' },
  { key: 'churned',         label: 'Churned',         he: 'נטש',           icon: XCircle,       color: '#FF3B30', bg: '#F2F2F7' },
] as const
const getStage = (k: string) => STAGES.find(s => s.key === k) ?? STAGES[0]

const SUB_STATUSES: Record<string, { key: string; label: string; he: string; color: string }[]> = {
  prospect: [
    { key: 'hot', label: 'Hot', he: 'חם', color: '#FF3B30' },
    { key: 'warm', label: 'Warm', he: 'רלוונטי', color: '#FF9500' },
    { key: 'cold', label: 'Cold', he: 'קר', color: '#007AFF' },
    { key: 'stale', label: 'Stale', he: 'לא פעיל', color: '#8E8E93' },
    { key: 'invalid', label: 'Invalid', he: 'לא תקין', color: '#C7C7CC' },
    { key: 'do_not_contact', label: 'DNC', he: 'לא לפנות', color: '#FF3B30' },
  ],
  reached_out: [
    { key: 'not_sent', label: 'Not Sent', he: 'לא נשלח', color: '#C7C7CC' },
    { key: 'unread', label: 'Unread', he: 'לא נקרא', color: '#FF9500' },
    { key: 'read_no_reply', label: 'Read', he: 'קרא לא ענה', color: '#FF9500' },
    { key: 'followup_1', label: 'Follow-up 1', he: 'תזכורת 1', color: '#007AFF' },
    { key: 'followup_2', label: 'Follow-up 2', he: 'תזכורת 2', color: '#007AFF' },
    { key: 'no_response', label: 'No Response', he: 'לא מגיב', color: '#8E8E93' },
    { key: 'not_interested', label: 'Not Interested', he: 'לא מעוניין', color: '#FF3B30' },
  ],
  in_conversation: [
    { key: 'active', label: 'Active', he: 'פעיל', color: '#34C759' },
    { key: 'asking_price', label: 'Asking Price', he: 'שואל מחיר', color: '#FF9500' },
    { key: 'hesitating', label: 'Hesitating', he: 'מהסס', color: '#FF9500' },
    { key: 'waiting_on_us', label: 'Waiting on Us!', he: 'מחכה לנו!', color: '#FF3B30' },
    { key: 'waiting_on_them', label: 'Waiting', he: 'מחכה לו', color: '#8E8E93' },
    { key: 'gone_quiet', label: 'Gone Quiet', he: 'נעלם', color: '#8E8E93' },
    { key: 'scheduled', label: 'Scheduled', he: 'תיאם שיחה', color: '#5856D6' },
    { key: 'sent_link', label: 'Sent Link', he: 'קיבל לינק', color: '#007AFF' },
  ],
  onboarding: [
    { key: 'first_name', label: 'Name', he: 'שם', color: '#34C759' },
    { key: 'profession', label: 'Trades', he: 'מקצוע', color: '#34C759' },
    { key: 'city_state', label: 'State', he: 'מדינה', color: '#007AFF' },
    { key: 'city', label: 'Cities', he: 'ערים', color: '#007AFF' },
    { key: 'working_days', label: 'Schedule', he: 'לוז', color: '#5856D6' },
    { key: 'confirm', label: 'Confirm', he: 'אישור', color: '#FF9500' },
    { key: 'groups', label: 'Groups', he: 'קבוצות', color: '#FF9500' },
  ],
  demo_trial: [
    { key: 'just_started', label: 'Just Started', he: 'התחיל עכשיו', color: '#007AFF' },
    { key: 'receiving_leads', label: 'Getting Leads', he: 'מקבל לידים', color: '#34C759' },
    { key: 'engaged', label: 'Engaged', he: 'פעיל ומעורב', color: '#34C759' },
    { key: 'no_leads', label: 'No Leads!', he: 'אין לידים!', color: '#FF3B30' },
    { key: 'inactive', label: 'Inactive', he: 'לא פעיל', color: '#FF9500' },
    { key: 'expiring', label: 'Expiring', he: 'נגמר בקרוב', color: '#FF9500' },
    { key: 'wants_to_pay', label: 'Wants to Pay', he: 'רוצה לשלם', color: '#34C759' },
  ],
  trial_expired: [
    { key: 'was_active', label: 'Was Active', he: 'היה פעיל', color: '#FF9500' },
    { key: 'barely_used', label: 'Barely Used', he: 'בקושי השתמש', color: '#8E8E93' },
    { key: 'never_used', label: 'Never Used', he: 'לא נכנס', color: '#C7C7CC' },
    { key: 'payment_failed', label: 'Payment Failed', he: 'תשלום נכשל', color: '#FF3B30' },
    { key: 'got_offer', label: 'Got Offer', he: 'קיבל הצעה', color: '#5856D6' },
    { key: 'declined', label: 'Declined', he: 'סירב', color: '#FF3B30' },
  ],
  paying: [
    { key: 'healthy', label: 'Healthy', he: 'מרוצה', color: '#34C759' },
    { key: 'power_user', label: 'Power User', he: 'משתמש כבד', color: '#34C759' },
    { key: 'low_usage', label: 'Low Usage', he: 'לא משתמש', color: '#FF9500' },
    { key: 'low_leads', label: 'Low Leads', he: 'מעט לידים', color: '#FF3B30' },
    { key: 'support_issue', label: 'Support', he: 'בעיה פתוחה', color: '#FF3B30' },
    { key: 'payment_failing', label: 'Payment Issue', he: 'תשלום נכשל', color: '#FF3B30' },
    { key: 'upgrade_candidate', label: 'Upgrade', he: 'לשדרוג', color: '#5856D6' },
  ],
  churned: [
    { key: 'recent', label: 'Recent', he: 'עזב לאחרונה', color: '#FF9500' },
    { key: 'old', label: 'Old', he: 'עזב מזמן', color: '#8E8E93' },
    { key: 'payment_failed', label: 'Payment Failed', he: 'נפל בתשלום', color: '#FF3B30' },
    { key: 'no_value', label: 'No Value', he: 'לא קיבל ערך', color: '#FF9500' },
    { key: 'seasonal', label: 'Seasonal', he: 'עונתי', color: '#007AFF' },
    { key: 'competitor', label: 'Competitor', he: 'מתחרה', color: '#FF3B30' },
    { key: 'closed', label: 'Closed', he: 'סגר עסק', color: '#8E8E93' },
  ],
}

type QuickReplyTemplate = {
  id: string
  title: string
  body: string
  category: string
  is_active: boolean
  sort_order: number
}

const QUICK_REPLIES_FALLBACK: { key: string; label: string; body: string }[] = [
  { key: 'intro', label: 'Intro', body: "Hi {name}! I'm from MasterLeadFlow. We help {profession} contractors get more jobs. Interested?" },
  { key: 'followup', label: 'Follow-up', body: 'Hey {name}! Following up on my last message.' },
  { key: 'demo', label: 'Demo', body: 'Want to try our platform for free?' },
  { key: 'price', label: 'Pricing', body: 'Plans start at $79/mo. Want details?' },
]

/* ── Helpers ────────────────────────────────────────────────────────── */
const hue = (s: string) => { let h = 0; for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h); return ((h % 360) + 360) % 360 }

/** Play a subtle notification beep using AudioContext */
function playNotificationBeep() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = 880
    osc.type = 'sine'
    gain.gain.setValueAtTime(0.15, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.3)
    setTimeout(() => ctx.close(), 500)
  } catch { /* silent — AudioContext not available */ }
}

/** Last message info for sidebar previews */
interface LastMessageInfo {
  content: string
  direction: 'incoming' | 'outgoing'
  sent_at: string
}
const fmtTime = (d: string) => new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
const fmtDate = (d: string) => new Date(d).toLocaleDateString([], { month: 'short', day: 'numeric' })
const timeAgo = (d: string) => { const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000); if (s < 60) return 'just now'; const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`; const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`; const dy = Math.floor(h / 24); if (dy < 7) return `${dy}d ago`; return fmtDate(d) }
const fmtFull = (d: string) => new Date(d).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
const fuSt = (d: string | null): 'overdue' | 'today' | 'upcoming' | null => { if (!d) return null; const x = (new Date(d).getTime() - Date.now()) / 86400000; return x < 0 ? 'overdue' : x < 1 ? 'today' : 'upcoming' }
const relD = (d: string, he: boolean) => { const x = Math.ceil((new Date(d).getTime() - Date.now()) / 86400000); if (x < -1) return he ? `לפני ${Math.abs(x)} ימים` : `${Math.abs(x)}d ago`; if (x === -1) return he ? 'אתמול' : 'Yesterday'; if (x === 0) return he ? 'היום' : 'Today'; if (x === 1) return he ? 'מחר' : 'Tomorrow'; return he ? `בעוד ${x} ימים` : `In ${x}d` }

function evLabel(t: string, he: boolean) {
  const m: Record<string, [string, string]> = { stage_change: ['Stage changed', 'שלב שונה'], note_added: ['Note added', 'הערה נוספה'], message_sent: ['Message sent', 'הודעה נשלחה'], message_received: ['Message received', 'הודעה נתקבלה'], call_logged: ['Call logged', 'שיחה'], imported: ['Imported', 'יובא'], followup_set: ['Follow-up set', 'תזכורת'], name_changed: ['Name changed', 'שם עודכן'], payment: ['Payment', 'תשלום'] }
  return m[t] ? (he ? m[t][1] : m[t][0]) : t
}

/** Merge messages + events into unified timeline */
type TimelineItem = { type: 'msg'; data: Message; ts: number } | { type: 'event'; data: ProspectEvent; ts: number }
function buildTimeline(msgs: Message[], evts: ProspectEvent[]): TimelineItem[] {
  const items: TimelineItem[] = [
    ...msgs.map(m => ({ type: 'msg' as const, data: m, ts: new Date(m.sent_at).getTime() })),
    ...evts.map(e => ({ type: 'event' as const, data: e, ts: new Date(e.created_at).getTime() })),
  ]
  items.sort((a, b) => a.ts - b.ts)
  return items
}

/* ── Onboarding helpers ────────────────────────────────────────────── */
function formatOnboardingStep(step: string): string {
  const steps: Record<string, string> = {
    'first_name': '1/7 Name',
    'profession': '2/7 Trades',
    'city_state': '3/7 State',
    'city': '4/7 Cities',
    'working_days': '5/7 Schedule',
    'confirm': '6/7 Confirm',
    'groups': '7/7 Groups',
  }
  return steps[step] || step
}

const ONBOARDING_STEPS = [
  { key: 'first_name', label: 'Name' },
  { key: 'profession', label: 'Trades' },
  { key: 'city_state', label: 'State' },
  { key: 'city', label: 'Cities' },
  { key: 'working_days', label: 'Schedule' },
  { key: 'confirm', label: 'Confirm' },
  { key: 'groups', label: 'Groups' },
]

function OnboardingProgress({ step, startedAt, lastActivity }: { step?: string; startedAt?: string; lastActivity?: string }) {
  const currentIdx = ONBOARDING_STEPS.findIndex(s => s.key === step)
  const stuckMinutes = lastActivity ? Math.floor((Date.now() - new Date(lastActivity).getTime()) / 60000) : 0
  const isStuck = stuckMinutes > 30

  return (
    <div className="space-y-2">
      {/* Step indicators */}
      <div className="flex items-center gap-1">
        {ONBOARDING_STEPS.map((s, i) => {
          const isDone = i < currentIdx
          const isCurrent = i === currentIdx
          return (
            <div key={s.key} className="flex-1 flex flex-col items-center gap-0.5">
              <div className={`w-full h-1.5 rounded-full ${
                isDone ? 'bg-[#34C759]' :
                isCurrent ? (isStuck ? 'bg-[#FF9500] animate-pulse' : 'bg-[#007AFF]') :
                'bg-[#E5E5EA]'
              }`} />
              <span className={`text-[8px] ${isCurrent ? 'font-bold text-[#1C1C1E]' : 'text-[#8E8E93]'}`}>
                {s.label}
              </span>
            </div>
          )
        })}
      </div>

      {/* Current step label */}
      {step && (
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-[#1C1C1E]">
            {ONBOARDING_STEPS[currentIdx]?.label || step}
          </span>
          {isStuck && (
            <span className="text-[9px] font-bold text-[#FF3B30] bg-[#FF3B30]/10 px-1.5 py-0.5 rounded-md">
              Stuck {stuckMinutes}m
            </span>
          )}
        </div>
      )}

      {/* Timeline */}
      <div className="flex items-center gap-3 text-[10px] text-[#8E8E93]">
        {startedAt && <span>Started {new Date(startedAt).toLocaleDateString()}</span>}
        {lastActivity && <span>Last activity {new Date(lastActivity).toLocaleTimeString()}</span>}
      </div>

      {/* ═══ BULK ACTION BAR ═══ */}
      {selectMode && selectedIds.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-between gap-4 px-6 py-3.5 animate-in slide-in-from-bottom duration-300" style={{ background: 'rgba(28, 28, 30, 0.97)', backdropFilter: 'blur(20px)', borderTop: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 -4px 30px rgba(0,0,0,0.2)' }}>
          {/* Left: count + clear */}
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-white">
              {selectedIds.size} {he ? 'נבחרו' : `item${selectedIds.size !== 1 ? 's' : ''} selected`}
            </span>
            <button onClick={() => { setSelectedIds(new Set()); setSelectMode(false) }} className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-white/60 hover:text-white hover:bg-white/10 transition-all">
              <X className="w-3.5 h-3.5" /> {he ? 'נקה' : 'Clear'}
            </button>
          </div>
          {/* Right: actions */}
          <div className="flex items-center gap-2">
            {/* Move to Stage */}
            <div className="relative">
              <button onClick={() => { setBulkStageMenuOpen(!bulkStageMenuOpen); setBulkAssignMenuOpen(false) }} className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all hover:scale-[1.02] active:scale-[0.98]" style={{ background: 'rgba(255,255,255,0.12)', color: 'white' }}>
                <ArrowRight className="w-3.5 h-3.5" /> {he ? 'העבר לשלב' : 'Move to Stage'}
              </button>
              {bulkStageMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setBulkStageMenuOpen(false)} />
                  <div className="absolute bottom-full mb-2 left-0 z-50 w-48 rounded-xl border border-white/10 shadow-xl bg-[#2C2C2E] py-1 max-h-[300px] overflow-y-auto">
                    {STAGES.map(s => (
                      <button key={s.key} onClick={() => bulkChangeStage(s.key)} className="flex items-center gap-2 w-full px-3 py-2 text-[12px] font-medium text-white/80 hover:bg-white/10 transition-colors">
                        <div className="w-2 h-2 rounded-full" style={{ background: s.color }} />
                        {he ? s.he : s.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
            {/* Assign */}
            <div className="relative">
              <button onClick={() => { setBulkAssignMenuOpen(!bulkAssignMenuOpen); setBulkStageMenuOpen(false) }} className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all hover:scale-[1.02] active:scale-[0.98]" style={{ background: 'rgba(255,255,255,0.12)', color: 'white' }}>
                <UserPlus className="w-3.5 h-3.5" /> {he ? 'הקצה' : 'Assign'}
              </button>
              {bulkAssignMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setBulkAssignMenuOpen(false)} />
                  <div className="absolute bottom-full mb-2 left-0 z-50 w-48 rounded-xl border border-white/10 shadow-xl bg-[#2C2C2E] py-1">
                    {waAccounts.length === 0 ? (
                      <div className="px-3 py-2 text-[12px] text-white/50">{he ? 'אין חשבונות' : 'No accounts'}</div>
                    ) : waAccounts.map(a => (
                      <button key={a.id} onClick={() => bulkAssign(a.id)} className="flex items-center gap-2 w-full px-3 py-2 text-[12px] font-medium text-white/80 hover:bg-white/10 transition-colors">
                        <MessageCircle className="w-3 h-3 text-[#34C759]" /> {a.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
            {/* Export */}
            <button onClick={bulkExportCsv} className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all hover:scale-[1.02] active:scale-[0.98]" style={{ background: 'rgba(255,255,255,0.12)', color: 'white' }}>
              <Download className="w-3.5 h-3.5" /> {he ? 'ייצוא CSV' : 'Export CSV'}
            </button>
          </div>
        </div>
      )}

      {/* ═══ TEMPLATE MANAGER MODAL ═══ */}
      {showTemplateManager && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowTemplateManager(false)}>
          <div className="bg-white rounded-3xl shadow-2xl w-[560px] max-h-[80vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-black/[0.06]">
              <h3 className="text-[16px] font-bold text-[#1C1C1E]">{he ? '\u05e0\u05d9\u05d4\u05d5\u05dc \u05ea\u05d1\u05e0\u05d9\u05d5\u05ea' : 'Manage Templates'}</h3>
              <button onClick={() => setShowTemplateManager(false)} className="p-2 rounded-xl hover:bg-black/[0.05] transition-colors"><X className="w-5 h-5 text-[#8E8E93]" /></button>
            </div>

            {/* Template list */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
              {qrTemplates.length === 0 && !qrTemplatesLoading && (
                <p className="text-[13px] text-[#8E8E93] text-center py-8">{he ? '\u05d0\u05d9\u05df \u05ea\u05d1\u05e0\u05d9\u05d5\u05ea' : 'No templates yet'}</p>
              )}
              {qrTemplatesLoading && (
                <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-[#8E8E93]" /></div>
              )}
              {qrTemplates.map((tpl, idx) => (
                <div key={tpl.id} className="flex items-center gap-3 p-3 rounded-xl border border-black/[0.06] hover:border-black/[0.1] transition-all bg-[#FAFAFA]">
                  {/* Reorder buttons */}
                  <div className="flex flex-col gap-0.5 shrink-0">
                    <button onClick={() => moveTemplate(tpl.id, 'up')} disabled={idx === 0} className="p-0.5 rounded hover:bg-black/[0.06] disabled:opacity-20 transition-all">
                      <ChevronUp className="w-3 h-3 text-[#8E8E93]" />
                    </button>
                    <button onClick={() => moveTemplate(tpl.id, 'down')} disabled={idx === qrTemplates.length - 1} className="p-0.5 rounded hover:bg-black/[0.06] disabled:opacity-20 transition-all">
                      <ChevronDown className="w-3 h-3 text-[#8E8E93]" />
                    </button>
                  </div>
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-[#1C1C1E] truncate">{tpl.title}</p>
                    <p className="text-[11px] text-[#8E8E93] truncate">{tpl.body}</p>
                    {tpl.category !== 'general' && (
                      <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-black/[0.04] text-[#8E8E93] mt-1 inline-block">{tpl.category}</span>
                    )}
                  </div>
                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => { setEditingTemplate(tpl); setTemplateDraft({ title: tpl.title, body: tpl.body, category: tpl.category }) }} className="p-1.5 rounded-lg hover:bg-black/[0.06] transition-all">
                      <Pencil className="w-3.5 h-3.5 text-[#8E8E93]" />
                    </button>
                    <button onClick={() => deleteTemplate(tpl.id)} className="p-1.5 rounded-lg hover:bg-[#FF3B30]/10 transition-all">
                      <Trash2 className="w-3.5 h-3.5 text-[#FF3B30]" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Add/Edit form */}
            <div className="shrink-0 px-6 py-4 border-t border-black/[0.06] bg-[#FAFAFA] space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#8E8E93]">
                {editingTemplate ? (he ? '\u05e2\u05e8\u05d9\u05db\u05ea \u05ea\u05d1\u05e0\u05d9\u05ea' : 'Edit Template') : (he ? '\u05ea\u05d1\u05e0\u05d9\u05ea \u05d7\u05d3\u05e9\u05d4' : 'New Template')}
              </p>
              <input
                value={templateDraft.title}
                onChange={e => setTemplateDraft(prev => ({ ...prev, title: e.target.value }))}
                placeholder={he ? '\u05db\u05d5\u05ea\u05e8\u05ea' : 'Title'}
                className="w-full h-9 px-3 rounded-xl border border-black/[0.08] text-[13px] outline-none bg-white focus:ring-2 focus:ring-[#fe5b25]/10 transition-all"
              />
              <textarea
                value={templateDraft.body}
                onChange={e => setTemplateDraft(prev => ({ ...prev, body: e.target.value }))}
                placeholder={he ? '\u05ea\u05d5\u05db\u05df \u05d4\u05d4\u05d5\u05d3\u05e2\u05d4... \u05d4\u05e9\u05ea\u05de\u05e9 \u05d1-{name} \u05d5-{profession}' : 'Message body... Use {name} and {profession} as variables'}
                className="w-full h-20 px-3 py-2 rounded-xl border border-black/[0.08] text-[13px] outline-none bg-white focus:ring-2 focus:ring-[#fe5b25]/10 transition-all resize-none"
              />
              <div className="flex items-center gap-2">
                <select
                  value={templateDraft.category}
                  onChange={e => setTemplateDraft(prev => ({ ...prev, category: e.target.value }))}
                  className="h-9 px-3 rounded-xl border border-black/[0.08] text-[12px] outline-none bg-white"
                >
                  <option value="general">General</option>
                  <option value="outreach">Outreach</option>
                  <option value="followup">Follow-up</option>
                  <option value="closing">Closing</option>
                </select>
                <div className="flex-1" />
                {editingTemplate && (
                  <button onClick={() => { setEditingTemplate(null); setTemplateDraft({ title: '', body: '', category: 'general' }) }} className="px-4 h-9 rounded-xl text-[12px] font-semibold border border-black/[0.08] hover:bg-black/[0.03] transition-all">
                    {he ? '\u05d1\u05d9\u05d8\u05d5\u05dc' : 'Cancel'}
                  </button>
                )}
                <button onClick={saveTemplate} disabled={!templateDraft.title.trim() || !templateDraft.body.trim()} className="px-4 h-9 rounded-xl text-[12px] font-semibold text-white transition-all disabled:opacity-40" style={{ background: C.primary }}>
                  {editingTemplate ? (he ? '\u05e2\u05d3\u05db\u05df' : 'Update') : (he ? '\u05d4\u05d5\u05e1\u05e3' : 'Add')}
                </button>
              </div>
              <p className="text-[10px] text-[#8E8E93]">{he ? '\u05de\u05e9\u05ea\u05e0\u05d9\u05dd: {name} = \u05e9\u05dd \u05d4\u05dc\u05e7\u05d5\u05d7, {profession} = \u05de\u05e7\u05e6\u05d5\u05e2' : 'Variables: {name} = prospect name, {profession} = their trade'}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════ */
export default function AdminInbox() {
  const { locale } = useI18n()
  const he = locale === 'he'
  const { toast } = useToast()
  const [searchParams] = useSearchParams()

  /* ── State ──────────────────────────────────────────────────────── */
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined)
  const [newMessage, setNewMessage] = useState('')
  const [selectedChannel, setSelectedChannel] = useState<'green_api' | 'twilio'>('twilio')
  const [sending, setSending] = useState(false)
  const [editingNotes, setEditingNotes] = useState(false)
  const [noteDraft, setNoteDraft] = useState('')
  const [stageMenuOpen, setStageMenuOpen] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const [showFU, setShowFU] = useState(false)
  const [fuDraft, setFuDraft] = useState('')
  const [showQR, setShowQR] = useState(false)
  const [copied, setCopied] = useState(false)

  // Prospect list
  const [listSearch, setListSearch] = useState('')
  const [filterStage, setFilterStage] = useState<string>(searchParams.get('stage') || 'all')
  const [filterSubStatus, setFilterSubStatus] = useState<string | null>(searchParams.get('sub') || null)
  const [filterCountry, setFilterCountry] = useState<string>('all')
  const [displayLimit, setDisplayLimit] = useState(50)
  const [sortBy, setSortBy] = useState<'last_activity' | 'followup_date' | 'created_date' | 'name_az' | 'needs_reply'>('last_activity')
  const [sortMenuOpen, setSortMenuOpen] = useState(false)
  const [filterProfession, setFilterProfession] = useState<string>('all')
  const [professionMenuOpen, setProfessionMenuOpen] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState<number>(0)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Bulk selection mode
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkStageMenuOpen, setBulkStageMenuOpen] = useState(false)
  const [bulkAssignMenuOpen, setBulkAssignMenuOpen] = useState(false)
  const [waAccounts, setWaAccounts] = useState<{ id: string; label: string }[]>([])

  // Quick reply templates from DB
  const [qrTemplates, setQrTemplates] = useState<QuickReplyTemplate[]>([])
  const [qrTemplatesLoading, setQrTemplatesLoading] = useState(false)
  const [showTemplateManager, setShowTemplateManager] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<QuickReplyTemplate | null>(null)
  const [templateDraft, setTemplateDraft] = useState({ title: '', body: '', category: 'general' })

  // Last messages per prospect (for sidebar preview + needs-reply)
  const [lastMessages, setLastMessages] = useState<Record<string, LastMessageInfo>>({})
  const [needsReply, setNeedsReply] = useState<Set<string>>(new Set())
  const [flashProspects, setFlashProspects] = useState<Set<string>>(new Set())
  const selectedIdRef = useRef<string | undefined>(selectedId)
  useEffect(() => { selectedIdRef.current = selectedId }, [selectedId])

  // Fetch last messages for all prospects in the list
  const fetchLastMessages = useCallback(async (prospectIds: string[]) => {
    if (prospectIds.length === 0) return
    // Fetch last incoming and last outgoing per prospect in batches
    const batchSize = 200
    const allMsgs: Record<string, { lastIn?: { content: string; sent_at: string }; lastOut?: { content: string; sent_at: string }; last?: LastMessageInfo }> = {}

    for (let i = 0; i < prospectIds.length; i += batchSize) {
      const batch = prospectIds.slice(i, i + batchSize)

      // Get the most recent message per prospect (incoming + outgoing)
      const { data: msgs } = await supabase
        .from('prospect_messages')
        .select('prospect_id, direction, content, sent_at')
        .in('prospect_id', batch)
        .order('sent_at', { ascending: false })
        .limit(batch.length * 4) // Get a few per prospect

      if (msgs) {
        for (const m of msgs) {
          if (!allMsgs[m.prospect_id]) allMsgs[m.prospect_id] = {}
          const entry = allMsgs[m.prospect_id]
          if (m.direction === 'incoming' && !entry.lastIn) {
            entry.lastIn = { content: m.content, sent_at: m.sent_at }
          }
          if (m.direction === 'outgoing' && !entry.lastOut) {
            entry.lastOut = { content: m.content, sent_at: m.sent_at }
          }
          if (!entry.last) {
            entry.last = { content: m.content, direction: m.direction as 'incoming' | 'outgoing', sent_at: m.sent_at }
          }
        }
      }
    }

    const newLastMessages: Record<string, LastMessageInfo> = {}
    const newNeedsReply = new Set<string>()

    for (const [pid, info] of Object.entries(allMsgs)) {
      if (info.last) newLastMessages[pid] = info.last
      // Needs reply: last incoming is newer than last outgoing
      if (info.lastIn) {
        if (!info.lastOut || new Date(info.lastIn.sent_at) > new Date(info.lastOut.sent_at)) {
          newNeedsReply.add(pid)
        }
      }
    }

    setLastMessages(newLastMessages)
    setNeedsReply(newNeedsReply)
  }, [])

  // Marketing message counter
  const [msgStats, setMsgStats] = useState<{ today: number; week: number; tier: string; limit: number }>({ today: 0, week: 0, tier: 'Unverified', limit: 250 })
  const fetchMsgStats = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc('get_marketing_message_stats')
      if (!error && data) {
        const d = data as { sent_today: number; sent_week: number }
        let tier = 'Unverified', limit = 250
        if (d.sent_week > 100000) { tier = 'Tier 3'; limit = 100000 }
        else if (d.sent_week > 10000) { tier = 'Tier 2'; limit = 10000 }
        else if (d.sent_week > 1000) { tier = 'Tier 1'; limit = 1000 }
        setMsgStats({ today: d.sent_today, week: d.sent_week, tier, limit })
      }
    } catch { /* silent */ }
  }, [])

  // Group admin tracking — phones of group admins for gold badge
  const [adminPhones, setAdminPhones] = useState<Set<string>>(new Set())
  const fetchAdmins = useCallback(async () => {
    try {
      const { data } = await supabase.rpc('get_group_admins')
      if (data) {
        const phones = new Set<string>()
        for (const a of data as { wa_sender_id: string }[]) {
          const phone = a.wa_sender_id.replace('@c.us', '')
          phones.add(phone)
          phones.add('+' + phone)
        }
        setAdminPhones(phones)
      }
    } catch { /* silent */ }
  }, [])
  useEffect(() => { fetchAdmins() }, [fetchAdmins])
  useEffect(() => { fetchMsgStats() }, [fetchMsgStats])

  // Fetch WA accounts for bulk assign
  useEffect(() => {
    supabase.from('wa_accounts').select('id, label').then(({ data }) => {
      if (data) setWaAccounts(data.map((a: any) => ({ id: a.id, label: a.label || a.id })))
    })
  }, [])

  // Fetch quick reply templates from DB
  const fetchTemplates = useCallback(async () => {
    setQrTemplatesLoading(true)
    try {
      const { data, error } = await supabase
        .from('quick_reply_templates')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
      if (!error && data) setQrTemplates(data as QuickReplyTemplate[])
    } catch { /* silent */ }
    finally { setQrTemplatesLoading(false) }
  }, [])
  useEffect(() => { fetchTemplates() }, [fetchTemplates])

  const isGroupAdmin = (phone: string) => {
    const clean = phone.replace(/[\s\-()whatsapp:+]/g, '')
    return adminPhones.has(clean) || adminPhones.has('+' + clean)
  }

  // Instance health state
  const [instanceHealth, setInstanceHealth] = useState<any[]>([])
  useEffect(() => {
    supabase.rpc('get_instance_status').then(({ data }) => {
      if (data) setInstanceHealth(data)
    })
    const interval = setInterval(() => {
      supabase.rpc('get_instance_status').then(({ data }) => {
        if (data) setInstanceHealth(data)
      })
    }, 30_000)
    return () => clearInterval(interval)
  }, [])

  const {
    prospect,
    contractor,
    submittedGroups,
    messages,
    events,
    prospectList,
    isListLoading: listLoading,
    isDetailLoading: loading,
    refetchDetail,
  } = useProspectDetailData(selectedId)

  // Fetch last messages when prospect list loads
  const lastFetchedIdsRef = useRef<string>('')
  useEffect(() => {
    if (prospectList.length === 0) return
    const ids = prospectList.map(p => p.id)
    const key = ids.slice(0, 20).join(',')
    if (key === lastFetchedIdsRef.current) return
    lastFetchedIdsRef.current = key
    fetchLastMessages(ids)
  }, [prospectList, fetchLastMessages])

  // Ref to hold prospectList for use inside realtime callback
  const prospectListRef = useRef(prospectList)
  useEffect(() => { prospectListRef.current = prospectList }, [prospectList])

  // Global realtime subscription for ALL new incoming messages (notifications)
  useEffect(() => {
    const channel = supabase
      .channel('inbox-global-messages')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'prospect_messages' },
        (payload: any) => {
          const msg = payload.new
          if (!msg) return

          const pid = msg.prospect_id as string

          // Update last message for sidebar preview
          setLastMessages(prev => ({
            ...prev,
            [pid]: { content: msg.content, direction: msg.direction, sent_at: msg.sent_at },
          }))

          if (msg.direction === 'outgoing') {
            // Outgoing message clears needs-reply
            setNeedsReply(prev => { const n = new Set(prev); n.delete(pid); return n })
            return
          }

          // Incoming message — mark as needs reply
          setNeedsReply(prev => new Set(prev).add(pid))

          // If this is for a different prospect than currently selected, notify
          if (pid !== selectedIdRef.current) {
            // Flash the prospect in sidebar
            setFlashProspects(prev => new Set(prev).add(pid))
            setTimeout(() => setFlashProspects(prev => { const n = new Set(prev); n.delete(pid); return n }), 3000)

            // Play notification beep
            playNotificationBeep()

            // Browser notification
            if (Notification.permission === 'granted') {
              const name = prospectListRef.current.find(p => p.id === pid)?.display_name || 'New message'
              const preview = (msg.content || '').substring(0, 80)
              new Notification(name, { body: preview, icon: '/icon.png', tag: `msg-${pid}` })
            } else if (Notification.permission === 'default') {
              Notification.requestPermission()
            }
          }
        },
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, []) // stable — uses refs for mutable data

  // Count of prospects needing reply (for badge on filter buttons)
  const needsReplyCount = useMemo(() => needsReply.size, [needsReply])

  // Group membership info for selected prospect
  type GroupMembership = {
    group_name: string; classification: string; joined_group_at: string | null
    left_group_at: string | null; total_messages: number
    profile_pic_url: string | null; profile_name: string | null; about: string | null
  }
  const [memberships, setMemberships] = useState<GroupMembership[]>([])
  useEffect(() => {
    if (!prospect?.wa_id) { setMemberships([]); return }
    supabase
      .from('group_members')
      .select('classification, joined_group_at, left_group_at, total_messages, group_id, profile_pic_url, profile_name, about')
      .eq('wa_sender_id', prospect.wa_id)
      .then(async ({ data }) => {
        if (!data || data.length === 0) { setMemberships([]); return }
        const groupIds = data.map((m: any) => m.group_id)
        const { data: groups } = await supabase.from('groups').select('id, name').in('id', groupIds)
        const nameMap = new Map((groups || []).map((g: any) => [g.id, g.name]))
        setMemberships(data.map((m: any) => ({
          group_name: nameMap.get(m.group_id) || 'Unknown',
          classification: m.classification,
          joined_group_at: m.joined_group_at,
          left_group_at: m.left_group_at,
          total_messages: m.total_messages,
          profile_pic_url: m.profile_pic_url,
          profile_name: m.profile_name,
          about: m.about,
        })))
      })
  }, [prospect?.wa_id])

  const chatEnd = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { setTimeout(() => chatEnd.current?.scrollIntoView({ behavior: 'smooth' }), 100) }, [messages, selectedId])

  /* ── Merged timeline ────────────────────────────────────────────── */
  const timeline = useMemo(() => buildTimeline(messages, events), [messages, events])

  /* ── Follow-up queue counts ──────────────────────────────────────── */
  const todayStr = new Date().toISOString().split('T')[0]
  const dueTodayCount = useMemo(() => {
    const today = new Date(todayStr)
    today.setHours(23, 59, 59, 999)
    return prospectList.filter(p => p.next_followup_at && new Date(p.next_followup_at) <= today).length
  }, [prospectList, todayStr])
  const overdueCount = useMemo(() => {
    const startOfToday = new Date(todayStr)
    startOfToday.setHours(0, 0, 0, 0)
    return prospectList.filter(p => p.next_followup_at && new Date(p.next_followup_at) < startOfToday).length
  }, [prospectList, todayStr])

  /* ── Unique professions for filter ─────────────────────────────── */
  const uniqueProfessions = useMemo(() => {
    const set = new Set<string>()
    for (const p of prospectList) {
      for (const t of p.profession_tags) set.add(t)
    }
    return Array.from(set).sort()
  }, [prospectList])

  /* ── Filtered list ──────────────────────────────────────────────── */
  const filteredList = useMemo(() => {
    let list = prospectList

    // Follow-up queue filters
    if (filterStage === 'due_today') {
      const today = new Date(todayStr)
      today.setHours(23, 59, 59, 999)
      list = list.filter(p => p.next_followup_at && new Date(p.next_followup_at) <= today)
    } else if (filterStage === 'overdue') {
      const startOfToday = new Date(todayStr)
      startOfToday.setHours(0, 0, 0, 0)
      list = list.filter(p => p.next_followup_at && new Date(p.next_followup_at) < startOfToday)
      list = [...list].sort((a, b) => new Date(a.next_followup_at!).getTime() - new Date(b.next_followup_at!).getTime())
    } else if (filterStage === 'group_admin') {
      list = list.filter(p => isGroupAdmin(p.phone))
    } else if (filterStage !== 'all') {
      list = list.filter(p => p.stage === filterStage)
    }
    // Sub-status filter
    if (filterSubStatus) {
      list = list.filter(p => p.sub_status === filterSubStatus)
    }
    // Country filter
    if (filterCountry === 'US') {
      list = list.filter(p => p.phone.startsWith('+1') && p.phone.length === 12)
    } else if (filterCountry === 'IL') {
      list = list.filter(p => p.phone.startsWith('+972'))
    } else if (filterCountry === 'OTHER') {
      list = list.filter(p => !(p.phone.startsWith('+1') && p.phone.length === 12) && !p.phone.startsWith('+972'))
    }
    // Profession filter
    if (filterProfession !== 'all') {
      list = list.filter(p => p.profession_tags.includes(filterProfession))
    }
    if (listSearch.trim()) {
      const q = listSearch.toLowerCase()
      list = list.filter(p => (p.display_name ?? '').toLowerCase().includes(q) || p.phone.includes(q) || p.profession_tags.some(t => t.toLowerCase().includes(q)))
    }
    // Sort (skip for overdue which is pre-sorted)
    if (filterStage !== 'overdue') {
      list = [...list].sort((a, b) => {
        switch (sortBy) {
          case 'followup_date': {
            if (!a.next_followup_at && !b.next_followup_at) return 0
            if (!a.next_followup_at) return 1
            if (!b.next_followup_at) return -1
            return new Date(a.next_followup_at).getTime() - new Date(b.next_followup_at).getTime()
          }
          case 'created_date':
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          case 'name_az': {
            const na = (a.display_name ?? a.phone).toLowerCase()
            const nb = (b.display_name ?? b.phone).toLowerCase()
            return na.localeCompare(nb)
          }
          case 'needs_reply': {
            const aNr = needsReply.has(a.id) ? 0 : 1
            const bNr = needsReply.has(b.id) ? 0 : 1
            if (aNr !== bNr) return aNr - bNr
            return (new Date(b.last_contact_at ?? b.created_at).getTime()) - (new Date(a.last_contact_at ?? a.created_at).getTime())
          }
          case 'last_activity':
          default:
            return (new Date(b.last_contact_at ?? b.created_at).getTime()) - (new Date(a.last_contact_at ?? a.created_at).getTime())
        }
      })
    }
    return list
  }, [prospectList, listSearch, filterStage, filterSubStatus, filterCountry, filterProfession, sortBy, adminPhones, needsReply, todayStr])

  // Reset display limit and sub-status filter when filter changes
  useEffect(() => { setDisplayLimit(50); setFilterSubStatus(null) }, [filterStage, listSearch])

  // Select first prospect if none selected and list loads
  useEffect(() => {
    if (!selectedId && filteredList.length > 0 && !listLoading) {
      setSelectedId(filteredList[0].id)
    }
  }, [filteredList, listLoading, selectedId])

  // Sync selectedIndex when selectedId changes externally
  useEffect(() => {
    if (!selectedId) return
    const idx = filteredList.findIndex(p => p.id === selectedId)
    if (idx >= 0) setSelectedIndex(idx)
  }, [selectedId, filteredList])

  /* ── Keyboard navigation ───────────────────────────────────────── */
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName
      const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
      const mod = e.metaKey || e.ctrlKey

      if (mod && e.key === 'f') {
        e.preventDefault()
        searchInputRef.current?.focus()
        return
      }
      if (mod && e.key === 'n') {
        e.preventDefault()
        if (prospect) {
          setEditingNotes(true)
          setNoteDraft(prospect.notes)
        }
        return
      }
      if (e.key === 'Escape') {
        if (isInput) {
          ;(e.target as HTMLElement).blur()
        } else {
          setSelectedId(undefined)
        }
        return
      }
      if (e.key === 'Enter' && !isInput) {
        e.preventDefault()
        inputRef.current?.focus()
        return
      }
      if (!isInput && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        e.preventDefault()
        setSelectedIndex(prev => {
          const max = filteredList.length - 1
          if (max < 0) return 0
          let next = e.key === 'ArrowDown' ? prev + 1 : prev - 1
          if (next < 0) next = max
          if (next > max) next = 0
          const target = filteredList[next]
          if (target) setSelectedId(target.id)
          return next
        })
        return
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [filteredList, prospect])

  /* ── Bulk Actions ────────────────────────────────────────────────── */
  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }
  function toggleSelectAll() {
    const visible = filteredList.slice(0, displayLimit)
    if (selectedIds.size === visible.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(visible.map(p => p.id)))
    }
  }
  async function bulkChangeStage(targetStage: string) {
    if (selectedIds.size === 0) return
    setBulkStageMenuOpen(false)
    let ok = 0
    for (const pid of selectedIds) {
      const p = prospectList.find(x => x.id === pid)
      if (!p || p.stage === targetStage) continue
      const { error } = await supabase.from('prospects').update({ stage: targetStage, sub_status: null, sub_status_changed_at: null }).eq('id', pid)
      if (!error) {
        await supabase.from('prospect_events').insert({ prospect_id: pid, event_type: 'stage_change', old_value: p.stage, new_value: targetStage })
        ok++
      }
    }
    toast({ title: `Moved ${ok} prospect${ok !== 1 ? 's' : ''} to ${getStage(targetStage).label}` })
    setSelectedIds(new Set())
    setSelectMode(false)
  }
  async function bulkAssign(waAccountId: string) {
    if (selectedIds.size === 0) return
    setBulkAssignMenuOpen(false)
    let ok = 0
    for (const pid of selectedIds) {
      const { error } = await supabase.from('prospects').update({ assigned_wa_account_id: waAccountId }).eq('id', pid)
      if (!error) ok++
    }
    const acct = waAccounts.find(a => a.id === waAccountId)
    toast({ title: `Assigned ${ok} prospect${ok !== 1 ? 's' : ''} to ${acct?.label || waAccountId}` })
    setSelectedIds(new Set())
    setSelectMode(false)
  }
  function bulkExportCsv() {
    const selected = prospectList.filter(p => selectedIds.has(p.id))
    if (selected.length === 0) return
    const headers = ['Name', 'Phone', 'Stage', 'Sub Status', 'Professions', 'Groups', 'Last Contact']
    const rows = selected.map(p => [
      p.display_name || '', p.phone, p.stage, p.sub_status || '',
      p.profession_tags.join('; '), (p.group_names || []).join('; '),
      p.last_contact_at || '',
    ])
    const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `prospects-export-${new Date().toISOString().split('T')[0]}.csv`
    a.click(); URL.revokeObjectURL(url)
    toast({ title: `Exported ${selected.length} prospect${selected.length !== 1 ? 's' : ''}` })
  }

  /* ── Template Management ────────────────────────────────────────── */
  async function saveTemplate() {
    if (!templateDraft.title.trim() || !templateDraft.body.trim()) return
    if (editingTemplate) {
      const { error } = await supabase.from('quick_reply_templates')
        .update({ title: templateDraft.title, body: templateDraft.body, category: templateDraft.category, updated_at: new Date().toISOString() })
        .eq('id', editingTemplate.id)
      if (error) { toast({ title: 'Save failed', variant: 'destructive' }); return }
    } else {
      const maxOrder = qrTemplates.reduce((m, t) => Math.max(m, t.sort_order), -1)
      const { error } = await supabase.from('quick_reply_templates')
        .insert({ title: templateDraft.title, body: templateDraft.body, category: templateDraft.category, sort_order: maxOrder + 1 })
      if (error) { toast({ title: 'Save failed', variant: 'destructive' }); return }
    }
    setEditingTemplate(null)
    setTemplateDraft({ title: '', body: '', category: 'general' })
    await fetchTemplates()
  }
  async function deleteTemplate(id: string) {
    const { error } = await supabase.from('quick_reply_templates').delete().eq('id', id)
    if (error) { toast({ title: 'Delete failed', variant: 'destructive' }); return }
    await fetchTemplates()
  }
  async function moveTemplate(id: string, direction: 'up' | 'down') {
    const idx = qrTemplates.findIndex(t => t.id === id)
    if (idx < 0) return
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= qrTemplates.length) return
    const a = qrTemplates[idx], b = qrTemplates[swapIdx]
    await supabase.from('quick_reply_templates').update({ sort_order: b.sort_order }).eq('id', a.id)
    await supabase.from('quick_reply_templates').update({ sort_order: a.sort_order }).eq('id', b.id)
    await fetchTemplates()
  }
  function resolveTemplateVars(body: string): string {
    let text = body
    if (prospect) {
      text = text.replace(/\{name\}/g, prospect.display_name || prospect.phone)
      text = text.replace(/\{profession\}/g, prospect.profession_tags?.[0] || 'trade')
    }
    return text
  }

  /* ── Actions ────────────────────────────────────────────────────── */
  async function handleSend(text?: string) {
    const t = text ?? newMessage; if (!t.trim() || !prospect || sending) return; setSending(true)
    try { const url = import.meta.env.VITE_WA_LISTENER_URL || 'http://localhost:3001'; const r = await fetch(`${url}/api/prospects/send`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prospect_id: prospect.id, wa_id: prospect.wa_id, text: t.trim(), wa_account_id: prospect.assigned_wa_account_id, channel: selectedChannel }) }); if (r.ok) { setNewMessage(''); setShowQR(false); if (inputRef.current) { inputRef.current.style.height = 'auto'; inputRef.current.focus(); } if (prospect.stage === 'prospect') await changeStage('reached_out') } else { toast({ title: 'Send failed', description: 'Message could not be sent. Please try again.', variant: 'destructive' }) } } catch { toast({ title: 'Send failed', description: 'Network error. Please check your connection.', variant: 'destructive' }) } finally { setSending(false) }
  }
  async function changeStage(ns: string) { if (!prospect || prospect.stage === ns) return; const old = prospect.stage; setStageMenuOpen(false); const { error } = await supabase.from('prospects').update({ stage: ns, sub_status: null, sub_status_changed_at: null }).eq('id', prospect.id); if (error) { toast({ title: 'Update failed', description: 'Could not change stage.', variant: 'destructive' }); return } await supabase.from('prospect_events').insert({ prospect_id: prospect.id, event_type: 'stage_change', old_value: old, new_value: ns }); await refetchDetail() }
  async function changeSubStatus(newSub: string) {
    if (!prospect || prospect.sub_status === newSub) return
    const old = prospect.sub_status
    const { error } = await supabase.from('prospects').update({
      sub_status: newSub,
      sub_status_changed_at: new Date().toISOString(),
    }).eq('id', prospect.id)
    if (error) { toast({ title: 'Update failed', variant: 'destructive' }); return }
    await supabase.from('prospect_events').insert({
      prospect_id: prospect.id,
      event_type: 'sub_status_change',
      old_value: old || null,
      new_value: newSub,
    })
    await refetchDetail()
  }
  async function saveNotes() { if (!prospect) return; const { error } = await supabase.from('prospects').update({ notes: noteDraft }).eq('id', prospect.id); if (error) { toast({ title: 'Save failed', description: 'Could not save notes.', variant: 'destructive' }); return } await supabase.from('prospect_events').insert({ prospect_id: prospect.id, event_type: 'note_added', new_value: noteDraft.substring(0, 100) }); setEditingNotes(false); await refetchDetail() }
  async function saveName() { if (!prospect) return; const n = nameDraft.trim() || null; const { error } = await supabase.from('prospects').update({ display_name: n }).eq('id', prospect.id); if (error) { toast({ title: 'Save failed', description: 'Could not update name.', variant: 'destructive' }); return } setEditingName(false); await refetchDetail() }
  async function saveFU() { if (!prospect) return; const v = fuDraft || null; const { error } = await supabase.from('prospects').update({ next_followup_at: v }).eq('id', prospect.id); if (error) { toast({ title: 'Save failed', description: 'Could not set follow-up.', variant: 'destructive' }); return } setShowFU(false); await refetchDetail() }
  async function clearFU() { if (!prospect) return; const { error } = await supabase.from('prospects').update({ next_followup_at: null }).eq('id', prospect.id); if (error) { toast({ title: 'Save failed', description: 'Could not clear follow-up.', variant: 'destructive' }); return } setShowFU(false); await refetchDetail() }
  function copyPhone() { if (!prospect) return; navigator.clipboard.writeText(prospect.phone); setCopied(true); setTimeout(() => setCopied(false), 2000) }

  const stg = prospect ? getStage(prospect.stage) : STAGES[0]
  const fs = prospect ? fuSt(prospect.next_followup_at) : null

  // 24h messaging window — find last incoming message to compute countdown
  const lastIncoming = useMemo(() => {
    if (!messages.length) return null
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].direction === 'incoming') return messages[i].sent_at
    }
    return null
  }, [messages])

  const [windowRemaining, setWindowRemaining] = useState<{ h: number; m: number; s: number; expired: boolean } | null>(null)
  useEffect(() => {
    if (!lastIncoming) { setWindowRemaining(null); return }
    function calc() {
      const end = new Date(lastIncoming!).getTime() + 24 * 60 * 60 * 1000
      const diff = end - Date.now()
      if (diff <= 0) return { h: 0, m: 0, s: 0, expired: true }
      const h = Math.floor(diff / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      return { h, m, s, expired: false }
    }
    setWindowRemaining(calc())
    const iv = setInterval(() => setWindowRemaining(calc()), 1000)
    return () => clearInterval(iv)
  }, [lastIncoming])
  const pName = (p: Prospect | ProspectListItem) => p.display_name || p.phone

  const Avatar = ({ src, name, waId, size = 36, square = false }: { src?: string | null; name: string; waId: string; size?: number; square?: boolean }) => {
    const h = hue(waId)
    const radius = square ? '25%' : '50%'
    if (src) return <img src={src} alt="" className="object-cover shrink-0 shadow-sm border border-black/[0.05]" style={{ width: size, height: size, borderRadius: radius }} />
    return (
      <div className="flex items-center justify-center font-bold text-white shrink-0 shadow-sm" style={{ width: size, height: size, fontSize: size * 0.35, borderRadius: radius, background: `linear-gradient(135deg, hsl(${h} 50% 50%), hsl(${h + 30} 45% 45%))` }}>
        {name[0]?.toUpperCase() ?? '?'}
      </div>
    )
  }

  /* ── Render ─────────────────────────────────────────────────────── */
  const adminCount = useMemo(() => prospectList.filter(p => isGroupAdmin(p.phone)).length, [prospectList, adminPhones])

  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const s of STAGES) counts[s.key] = 0
    for (const p of prospectList) {
      if (counts[p.stage] !== undefined) counts[p.stage]++
    }
    return counts
  }, [prospectList])

  // Sub-status counts for active stage filter
  const subStatusCounts = useMemo(() => {
    const subs = SUB_STATUSES[filterStage]
    if (!subs) return {} as Record<string, number>
    const counts: Record<string, number> = {}
    for (const s of subs) counts[s.key] = 0
    for (const p of prospectList) {
      if (p.stage === filterStage && p.sub_status && counts[p.sub_status] !== undefined) {
        counts[p.sub_status]++
      }
    }
    return counts
  }, [prospectList, filterStage])

  return (
    <div
      className="animate-fade-in flex flex-col h-full w-full overflow-hidden"
      style={{
        fontFamily: "'Plus Jakarta Sans', 'Outfit', -apple-system, system-ui, sans-serif",
        background: C.bg,
        backgroundImage: 'radial-gradient(at 0% 0%, rgba(254,91,37,0.03) 0, transparent 50%), radial-gradient(at 100% 100%, rgba(255,138,92,0.03) 0, transparent 50%)',
      }}
    >
      {/* ═══ INSTANCE HEALTH BANNER ═══ */}
      {instanceHealth.length > 0 && (
        <div className="flex items-center gap-4 px-4 py-2 mx-3 mt-3 rounded-xl mb-0" style={{ background: 'rgba(28,28,30,0.05)' }}>
          {instanceHealth.map((inst: any) => (
            <div key={inst.account_id} className="flex items-center gap-2 text-[11px]">
              <div className={`w-2 h-2 rounded-full ${
                inst.status === 'connected' ? 'bg-[#34C759]' :
                inst.status === 'yellow_card' ? 'bg-amber-500' :
                'bg-[#FF3B30]'
              }`} />
              <span className="font-medium text-[#1C1C1E]">{inst.label || 'Instance'}</span>
              <span className="text-[#8E8E93] uppercase">{inst.role}</span>
              {inst.groups_count > 0 && (
                <span className="text-[#8E8E93]">{inst.groups_count} groups</span>
              )}
              {inst.last_sync_at && (
                <span className="text-[#8E8E93]">synced {new Date(inst.last_sync_at).toLocaleTimeString()}</span>
              )}
              {inst.pending_groups_count > 0 && (
                <span className="text-amber-600 font-semibold">{inst.pending_groups_count} pending groups</span>
              )}
              {inst.active_alerts_count > 0 && (
                <span className="text-[#FF3B30] font-semibold">{inst.active_alerts_count} alerts</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ═══ PIPELINE FUNNEL HEADER ═══ */}
      <div className="shrink-0 z-20 relative mx-3 mt-3 rounded-3xl overflow-hidden" style={{ background: C.glass, backdropFilter: C.blur, border: `1px solid ${C.glassBorder}`, boxShadow: C.panelShadow }}>
        {/* Top row: Title + Search */}
        <div className="px-5 pt-3 pb-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold tracking-tight text-[#1C1C1E]">{he ? 'תיבת הודעות' : 'CRM Inbox'}</h1>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#8E8E93]">{he ? 'פייפליין' : 'Pipeline'}</p>
            </div>
            {/* Marketing message counter */}
            <div className="flex items-center gap-2 ml-3 px-2.5 py-1 rounded-xl" style={{ background: msgStats.today >= msgStats.limit * 0.8 ? 'rgba(239,68,68,0.08)' : 'rgba(0,0,0,0.03)', border: `1px solid ${msgStats.today >= msgStats.limit * 0.8 ? 'rgba(239,68,68,0.2)' : 'rgba(0,0,0,0.06)'}` }}>
              <Send className="w-3 h-3 text-[#8E8E93]" strokeWidth={2.5} />
              <span className="text-[11px] font-mono font-semibold" style={{ color: C.primary }}>{msgStats.today}</span>
              <span className="text-[10px] text-[#8E8E93]">/ {msgStats.limit} {he ? 'היום' : 'today'}</span>
              <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-md" style={{ background: msgStats.tier === 'Unverified' ? 'rgba(245,158,11,0.1)' : 'rgba(34,197,94,0.1)', color: msgStats.tier === 'Unverified' ? '#f59e0b' : '#22c55e' }}>{msgStats.tier}</span>
              {msgStats.today >= msgStats.limit * 0.8 && <AlertTriangle className="w-3 h-3 text-red-500 animate-pulse" />}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Country filter */}
            <div className="flex items-center gap-1 bg-black/[0.03] rounded-xl p-0.5">
              {[
                { key: 'all', label: 'All', flag: '🌍' },
                { key: 'US', label: 'US', flag: '🇺🇸' },
                { key: 'IL', label: 'IL', flag: '🇮🇱' },
              ].map(c => (
                <button
                  key={c.key}
                  onClick={() => setFilterCountry(filterCountry === c.key ? 'all' : c.key)}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold transition-all"
                  style={{
                    background: filterCountry === c.key ? 'white' : 'transparent',
                    color: filterCountry === c.key ? C.primary : '#8E8E93',
                    boxShadow: filterCountry === c.key ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  }}
                >
                  <span>{c.flag}</span>
                  <span>{c.label}</span>
                </button>
              ))}
            </div>
            <div className="relative group">
              <Search className="w-3.5 h-3.5 absolute top-1/2 -translate-y-1/2 text-[#8E8E93] transition-colors group-focus-within:text-[#fe5b25]" style={{ left: he ? 'auto' : 10, right: he ? 10 : 'auto' }} strokeWidth={2.5} />
              <input
                ref={searchInputRef}
                value={listSearch} onChange={e => setListSearch(e.target.value)}
                placeholder={he ? 'חיפוש...' : 'Search...'}
                className="w-[180px] h-9 rounded-2xl border border-black/[0.06] text-[12px] outline-none transition-all bg-white/60 focus:bg-white focus:ring-2 focus:ring-[#fe5b25]/10 focus:border-[#fe5b25]/30"
                style={{ paddingLeft: he ? 10 : 30, paddingRight: he ? 30 : 10, color: C.dark }}
              />
            </div>
          </div>
        </div>

        {/* Pipeline stages row — all 8 stages fit on screen */}
        <div className="px-3 pb-3 flex items-center">
          {STAGES.map((s, idx) => {
            const count = stageCounts[s.key] || 0
            const isActive = filterStage === s.key
            const isDimmed = filterStage !== 'all' && !isActive && filterStage !== 'group_admin' && filterStage !== 'due_today' && filterStage !== 'overdue'
            return (
              <div key={s.key} className="flex items-center flex-1 min-w-0">
                {idx > 0 && (
                  <div className="w-3 h-[1.5px] rounded-full shrink-0" style={{ background: isDimmed ? 'rgba(0,0,0,0.04)' : 'rgba(0,0,0,0.1)' }} />
                )}
                <button
                  onClick={() => setFilterStage(filterStage === s.key ? 'all' : s.key)}
                  className="flex flex-col items-center flex-1 min-w-0 py-1.5 px-1 rounded-xl transition-all cursor-pointer"
                  style={{
                    background: isActive ? '#FFFFFF' : 'transparent',
                    boxShadow: isActive ? '0 4px 16px rgba(0,0,0,0.06)' : 'none',
                    opacity: isDimmed ? 0.35 : 1,
                  }}
                >
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mb-1"
                    style={{ background: isActive ? s.color + '15' : 'rgba(0,0,0,0.03)', color: s.color }}
                  >
                    <s.icon className="w-3.5 h-3.5" strokeWidth={2.2} />
                  </div>
                  <span className="text-[15px] font-semibold leading-none" style={{ color: isActive ? s.color : '#1C1C1E' }}>
                    {count.toLocaleString()}
                  </span>
                  <span className="text-[8px] font-semibold uppercase tracking-wide text-[#8E8E93] mt-0.5 truncate max-w-full text-center leading-tight">
                    {he ? s.he : s.label}
                  </span>
                </button>
              </div>
            )
          })}

          {/* Group Admin filter */}
          <div className="flex items-center shrink-0">
            <div className="w-3 h-[1.5px] rounded-full shrink-0 mx-1" style={{ background: filterStage === 'group_admin' ? 'rgba(0,0,0,0.1)' : 'rgba(0,0,0,0.04)' }} />
            <button
              onClick={() => setFilterStage(filterStage === 'group_admin' ? 'all' : 'group_admin')}
              className="flex flex-col items-center py-1.5 px-3 rounded-xl transition-all cursor-pointer"
              style={{
                background: filterStage === 'group_admin' ? '#FFFFFF' : 'transparent',
                boxShadow: filterStage === 'group_admin' ? '0 4px 16px rgba(245,158,11,0.15)' : 'none',
                opacity: filterStage !== 'all' && filterStage !== 'group_admin' && filterStage !== 'due_today' && filterStage !== 'overdue' ? 0.35 : 1,
              }}
            >
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mb-1"
                style={{ background: filterStage === 'group_admin' ? '#f59e0b15' : 'rgba(0,0,0,0.03)', color: '#f59e0b' }}
              >
                <Crown className="w-3.5 h-3.5" strokeWidth={2.2} />
              </div>
              <span className="text-[15px] font-semibold leading-none" style={{ color: filterStage === 'group_admin' ? '#f59e0b' : '#1C1C1E' }}>
                {adminCount}
              </span>
              <span className="text-[8px] font-semibold uppercase tracking-wide text-[#8E8E93] mt-0.5 whitespace-nowrap leading-tight">
                {he ? 'מנהלים' : 'Admins'}
              </span>
            </button>
          </div>

          {/* Follow-up queue filters */}
          <div className="flex items-center shrink-0">
            <div className="w-3 h-[1.5px] rounded-full shrink-0 mx-1" style={{ background: 'rgba(0,0,0,0.04)' }} />
            <button
              onClick={() => setFilterStage(filterStage === 'due_today' ? 'all' : 'due_today')}
              className="flex flex-col items-center py-1.5 px-2.5 rounded-xl transition-all cursor-pointer"
              style={{
                background: filterStage === 'due_today' ? '#FFFFFF' : 'transparent',
                boxShadow: filterStage === 'due_today' ? '0 4px 16px rgba(255,149,0,0.15)' : 'none',
                opacity: filterStage !== 'all' && filterStage !== 'due_today' && filterStage !== 'overdue' && filterStage !== 'group_admin' ? 0.35 : 1,
              }}
            >
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mb-1"
                style={{ background: filterStage === 'due_today' ? '#FF950015' : 'rgba(0,0,0,0.03)', color: '#FF9500' }}
              >
                <CalendarClock className="w-3.5 h-3.5" strokeWidth={2.2} />
              </div>
              <span className="text-[15px] font-semibold leading-none" style={{ color: filterStage === 'due_today' ? '#FF9500' : '#1C1C1E' }}>
                {dueTodayCount}
              </span>
              <span className="text-[8px] font-semibold uppercase tracking-wide text-[#8E8E93] mt-0.5 whitespace-nowrap leading-tight">
                {he ? 'היום' : 'Due Today'}
              </span>
            </button>
            <button
              onClick={() => setFilterStage(filterStage === 'overdue' ? 'all' : 'overdue')}
              className="flex flex-col items-center py-1.5 px-2.5 rounded-xl transition-all cursor-pointer"
              style={{
                background: filterStage === 'overdue' ? '#FFFFFF' : 'transparent',
                boxShadow: filterStage === 'overdue' ? '0 4px 16px rgba(255,59,48,0.15)' : 'none',
                opacity: filterStage !== 'all' && filterStage !== 'due_today' && filterStage !== 'overdue' && filterStage !== 'group_admin' ? 0.35 : 1,
              }}
            >
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mb-1"
                style={{ background: filterStage === 'overdue' ? '#FF3B3015' : 'rgba(0,0,0,0.03)', color: '#FF3B30' }}
              >
                <AlertTriangle className="w-3.5 h-3.5" strokeWidth={2.2} />
              </div>
              <span className="text-[15px] font-semibold leading-none" style={{ color: filterStage === 'overdue' ? '#FF3B30' : '#1C1C1E' }}>
                {overdueCount}
              </span>
              <span className="text-[8px] font-semibold uppercase tracking-wide text-[#8E8E93] mt-0.5 whitespace-nowrap leading-tight">
                {he ? 'באיחור' : 'Overdue'}
              </span>
            </button>
          </div>
        </div>

        {/* ── Sub-status row (expands below pipeline when a stage is active) ── */}
        {filterStage !== 'all' && filterStage !== 'group_admin' && filterStage !== 'due_today' && filterStage !== 'overdue' && SUB_STATUSES[filterStage] && (
          <div className="px-4 pb-2.5 pt-0 flex items-center justify-center gap-0.5 overflow-x-auto scrollbar-hide border-t border-black/[0.03]">
            {SUB_STATUSES[filterStage]?.map((s, idx) => {
              const count = subStatusCounts[s.key] || 0
              const isActive = filterSubStatus === s.key
              const hasCount = count > 0
              return (
                <div key={s.key} className="flex items-center">
                  {idx > 0 && <div className="w-2 h-[1px] shrink-0" style={{ background: 'rgba(0,0,0,0.06)' }} />}
                  <button
                    onClick={() => setFilterSubStatus(filterSubStatus === s.key ? null : s.key)}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg transition-all whitespace-nowrap"
                    style={{
                      background: isActive ? s.color + '15' : 'transparent',
                      boxShadow: isActive ? `0 2px 8px ${s.color}20` : 'none',
                    }}
                  >
                    <span className="text-[11px] font-bold" style={{ color: isActive ? s.color : hasCount ? s.color : '#D1D1D6' }}>
                      {count}
                    </span>
                    <span className={`text-[10px] ${isActive ? 'font-semibold text-[#1C1C1E]' : 'text-[#8E8E93]'}`}>
                      {he ? s.he : s.label}
                    </span>
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ═══ MAIN GRID ═══ */}
      <div className="flex-1 grid grid-cols-[320px_1fr_320px] gap-3 p-3 relative z-10 overflow-hidden">
        
        {/* ═══ LEFT: Prospect List (Apple Glass Style) ═══════════════════════════════════════ */}
        <div className="flex flex-col relative z-10 h-full overflow-hidden rounded-3xl" style={{ background: C.glass, backdropFilter: C.blur, border: `1px solid ${C.glassBorder}`, boxShadow: C.panelShadow }}>
          {/* Header with All / Admins tabs */}
          <div className="shrink-0 border-b border-black/[0.04]">
            <div className="flex">
              <button
                onClick={() => { if (filterStage === 'group_admin') setFilterStage('all') }}
                className="flex-1 flex items-center justify-center gap-1.5 py-3 transition-all relative"
                style={{ color: filterStage !== 'group_admin' ? '#1C1C1E' : '#8E8E93' }}
              >
                <Users className="w-3.5 h-3.5" strokeWidth={2.2} />
                <span className="text-[11px] font-black uppercase tracking-[0.12em]">
                  {filterStage === 'all' ? (he ? 'כל הלקוחות' : 'All Clients') : filterStage === 'group_admin' ? (he ? 'כל הלקוחות' : 'All') : filterStage === 'due_today' ? (he ? 'היום' : 'Due Today') : filterStage === 'overdue' ? (he ? 'באיחור' : 'Overdue') : (he ? getStage(filterStage).he : getStage(filterStage).label)}
                </span>
                <span className="text-[10px] font-bold text-[#8E8E93] bg-black/[0.04] px-1.5 py-0.5 rounded-md">
                  {filterStage === 'group_admin' ? prospectList.length : filteredList.length}
                </span>
                {needsReplyCount > 0 && (
                  <span className="text-[9px] font-bold text-white bg-[#007AFF] px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                    {needsReplyCount}
                  </span>
                )}
                {filterStage !== 'group_admin' && (
                  <div className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full bg-[#fe5b25]" />
                )}
              </button>
              <button
                onClick={() => setFilterStage(filterStage === 'group_admin' ? 'all' : 'group_admin')}
                className="flex-1 flex items-center justify-center gap-1.5 py-3 transition-all relative"
                style={{ color: filterStage === 'group_admin' ? '#f59e0b' : '#8E8E93' }}
              >
                <Crown className="w-3.5 h-3.5" strokeWidth={2.2} />
                <span className="text-[11px] font-black uppercase tracking-[0.12em]">
                  {he ? 'מנהלים' : 'Admins'}
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md" style={{ background: filterStage === 'group_admin' ? '#f59e0b15' : 'rgba(0,0,0,0.04)', color: filterStage === 'group_admin' ? '#f59e0b' : '#8E8E93' }}>
                  {adminCount}
                </span>
                {filterStage === 'group_admin' && (
                  <div className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full bg-amber-400" />
                )}
              </button>
            </div>
          </div>

          {/* Select mode bar */}
          <div className="shrink-0 flex items-center justify-between px-3 py-1.5 border-b border-black/[0.04]">
            <button
              onClick={() => { setSelectMode(!selectMode); if (selectMode) setSelectedIds(new Set()) }}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all"
              style={{
                background: selectMode ? C.primary + '15' : 'transparent',
                color: selectMode ? C.primary : '#8E8E93',
              }}
            >
              <CheckSquare className="w-3 h-3" strokeWidth={2.5} />
              {he ? 'בחירה' : 'Select'}
            </button>
            {selectMode && (
              <div className="flex items-center gap-2">
                <button onClick={toggleSelectAll} className="text-[10px] font-semibold text-[#007AFF] hover:underline">
                  {selectedIds.size === filteredList.slice(0, displayLimit).length ? (he ? 'נקה הכל' : 'Deselect All') : (he ? 'בחר הכל' : 'Select All')}
                </button>
                {selectedIds.size > 0 && (
                  <span className="text-[10px] font-bold text-[#8E8E93] bg-black/[0.04] px-1.5 py-0.5 rounded-md">
                    {selectedIds.size}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Sort + Profession Filter + Keyboard Shortcuts */}
          <div className="shrink-0 px-3 pt-2 pb-1 flex items-center gap-2 border-b border-black/[0.04]">
            {/* Sort dropdown */}
            <div className="relative">
              <button
                onClick={() => setSortMenuOpen(!sortMenuOpen)}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold transition-all hover:bg-black/[0.04]"
                style={{ color: sortBy !== 'last_activity' ? C.primary : '#8E8E93' }}
              >
                <ArrowUpDown className="w-3 h-3" strokeWidth={2.5} />
                <span>{
                  sortBy === 'last_activity' ? (he ? 'פעילות' : 'Activity') :
                  sortBy === 'followup_date' ? (he ? 'מעקב' : 'Follow-up') :
                  sortBy === 'created_date' ? (he ? 'נוצר' : 'Created') :
                  sortBy === 'name_az' ? (he ? 'שם' : 'Name') :
                  he ? 'צריך מענה' : 'Needs Reply'
                }</span>
                <ChevronDown className={`w-2.5 h-2.5 transition-transform ${sortMenuOpen ? 'rotate-180' : ''}`} />
              </button>
              {sortMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setSortMenuOpen(false)} />
                  <div className="absolute top-full mt-1 z-50 w-[160px] rounded-lg border border-black/[0.08] shadow-lg bg-white py-1" style={{ left: 0 }}>
                    {([
                      { key: 'last_activity', label: he ? 'פעילות אחרונה' : 'Last Activity' },
                      { key: 'followup_date', label: he ? 'תאריך מעקב' : 'Follow-up Date' },
                      { key: 'created_date', label: he ? 'תאריך יצירה' : 'Created Date' },
                      { key: 'name_az', label: he ? 'שם א-ת' : 'Name A-Z' },
                      { key: 'needs_reply', label: he ? 'צריך מענה' : 'Needs Reply First' },
                    ] as const).map(opt => (
                      <button
                        key={opt.key}
                        onClick={() => { setSortBy(opt.key); setSortMenuOpen(false) }}
                        className="flex items-center gap-2 w-full px-3 py-1.5 text-[11px] font-medium hover:bg-[#f5f5f5] transition-colors"
                        style={{ color: sortBy === opt.key ? C.primary : C.gray }}
                      >
                        {opt.label}
                        {sortBy === opt.key && <Check className="w-3 h-3 ml-auto" style={{ color: C.primary }} />}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Profession filter */}
            <div className="relative">
              <button
                onClick={() => setProfessionMenuOpen(!professionMenuOpen)}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold transition-all hover:bg-black/[0.04]"
                style={{ color: filterProfession !== 'all' ? C.primary : '#8E8E93' }}
              >
                <Briefcase className="w-3 h-3" strokeWidth={2.5} />
                <span className="max-w-[60px] truncate">{filterProfession === 'all' ? (he ? 'מקצוע' : 'Trade') : filterProfession}</span>
                <ChevronDown className={`w-2.5 h-2.5 transition-transform ${professionMenuOpen ? 'rotate-180' : ''}`} />
              </button>
              {professionMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setProfessionMenuOpen(false)} />
                  <div className="absolute top-full mt-1 z-50 w-[180px] max-h-[280px] overflow-y-auto rounded-lg border border-black/[0.08] shadow-lg bg-white py-1 scrollbar-hide" style={{ left: 0 }}>
                    <button
                      onClick={() => { setFilterProfession('all'); setProfessionMenuOpen(false) }}
                      className="flex items-center gap-2 w-full px-3 py-1.5 text-[11px] font-medium hover:bg-[#f5f5f5] transition-colors"
                      style={{ color: filterProfession === 'all' ? C.primary : C.gray }}
                    >
                      {he ? 'כל המקצועות' : 'All Professions'}
                      {filterProfession === 'all' && <Check className="w-3 h-3 ml-auto" style={{ color: C.primary }} />}
                    </button>
                    {uniqueProfessions.map(prof => (
                      <button
                        key={prof}
                        onClick={() => { setFilterProfession(prof); setProfessionMenuOpen(false) }}
                        className="flex items-center gap-2 w-full px-3 py-1.5 text-[11px] font-medium hover:bg-[#f5f5f5] transition-colors truncate"
                        style={{ color: filterProfession === prof ? C.primary : C.gray }}
                      >
                        <span className="truncate">{prof}</span>
                        {filterProfession === prof && <Check className="w-3 h-3 ml-auto shrink-0" style={{ color: C.primary }} />}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="flex-1" />

            {/* Keyboard shortcuts hint */}
            <div className="relative">
              <button
                onMouseEnter={() => setShowShortcuts(true)}
                onMouseLeave={() => setShowShortcuts(false)}
                className="w-5 h-5 rounded flex items-center justify-center text-[#C7C7CC] hover:text-[#8E8E93] transition-colors"
              >
                <HelpCircle className="w-3.5 h-3.5" strokeWidth={2} />
              </button>
              {showShortcuts && (
                <div className="absolute top-full right-0 mt-1 z-50 w-[200px] rounded-lg border border-black/[0.08] shadow-lg bg-white p-3 space-y-1.5">
                  <div className="text-[10px] font-bold text-[#1C1C1E] uppercase tracking-wider mb-2">{he ? 'קיצורי מקלדת' : 'Keyboard Shortcuts'}</div>
                  {[
                    { keys: '↑ ↓', desc: he ? 'ניווט ברשימה' : 'Navigate list' },
                    { keys: 'Enter', desc: he ? 'התמקד בעורך' : 'Focus composer' },
                    { keys: 'Esc', desc: he ? 'ביטול / טשטוש' : 'Deselect / blur' },
                    { keys: '⌘/Ctrl+N', desc: he ? 'הוסף הערה' : 'Add note' },
                    { keys: '⌘/Ctrl+F', desc: he ? 'חיפוש' : 'Search' },
                  ].map(s => (
                    <div key={s.keys} className="flex items-center justify-between">
                      <span className="text-[10px] font-mono font-semibold text-[#8E8E93] bg-black/[0.04] px-1.5 py-0.5 rounded">{s.keys}</span>
                      <span className="text-[10px] text-[#8E8E93]">{s.desc}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-hide">
            {listLoading ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-[#8E8E93]" /></div>
            ) : filteredList.length === 0 ? (
              <div className="text-center py-12 text-[13px] font-medium text-[#8E8E93]">{he ? 'לא נמצאו תוצאות' : 'No results'}</div>
            ) : (<>
              {filteredList.slice(0, displayLimit).map((p, idx) => {
              const isActive = p.id === selectedId
              const s = getStage(p.stage)
              const hasUnread = needsReply.has(p.id)
              const isFlashing = flashProspects.has(p.id)
              const lastMsg = lastMessages[p.id]
              const previewText = lastMsg
                ? (lastMsg.content || '').substring(0, 50) + ((lastMsg.content || '').length > 50 ? '...' : '')
                : (he ? getStage(p.stage).he : getStage(p.stage).label)
              return (
                <button
                  key={`${p.id}-${idx}`}
                  onClick={() => selectMode ? toggleSelect(p.id) : setSelectedId(p.id)}
                  className={`w-full flex items-center gap-3 p-3 text-left transition-all rounded-2xl relative overflow-hidden group ${selectedIds.has(p.id) ? 'bg-[#007AFF]/[0.06] ring-1 ring-[#007AFF]/20' : isActive ? 'bg-white shadow-md ring-2 ring-[#fe5b25]/15' : isFlashing ? 'bg-[#007AFF]/[0.06] shadow-sm ring-1 ring-[#007AFF]/20' : 'hover:bg-white/60 hover:shadow-sm hover:-translate-y-[1px] active:scale-[0.98]'}`}
                  style={{ direction: he ? 'rtl' : 'ltr', animation: isFlashing ? 'pulse 1.5s ease-in-out infinite' : undefined }}
                >
                  {isActive && !selectMode && <div className="absolute top-0 bottom-0 w-1.5 bg-[#fe5b25] shadow-[0_0_10px_rgba(0,74,255,0.3)]" style={{ [he ? 'right' : 'left']: 0 }} />}
                  {selectMode && (
                    <div className="shrink-0">
                      {selectedIds.has(p.id) ? (
                        <CheckSquare className="w-5 h-5 text-[#007AFF]" strokeWidth={2.5} />
                      ) : (
                        <Square className="w-5 h-5 text-[#C7C7CC]" strokeWidth={2} />
                      )}
                    </div>
                  )}
                  <div className="relative">
                    <Avatar src={p.profile_pic_url} name={pName(p)} waId={p.phone} size={48} />
                    {isGroupAdmin(p.phone) && (
                      <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center bg-amber-400 shadow-sm border-2 border-white">
                        <Crown className="w-3 h-3 text-white" strokeWidth={2.5} />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <div className="flex items-center justify-between mb-0.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className={`text-[16px] truncate ${hasUnread ? 'font-bold text-[#1C1C1E]' : 'font-semibold text-[#1C1C1E]'}`}>{pName(p)}</span>
                        {isGroupAdmin(p.phone) && (
                          <span className="text-[8px] px-1.5 py-0.5 rounded-md font-black uppercase tracking-wider bg-amber-100 text-amber-600 shrink-0">Admin</span>
                        )}
                        {hasUnread && (
                          <span className="w-2.5 h-2.5 rounded-full bg-[#007AFF] shrink-0 shadow-[0_0_6px_rgba(0,122,255,0.4)]" />
                        )}
                      </div>
                      <span className={`text-[10px] font-bold shrink-0 ml-2 tracking-tight ${isActive ? 'text-[#fe5b25]' : 'text-[#8E8E93]'}`}>
                        {lastMsg ? timeAgo(lastMsg.sent_at) : (p.last_contact_at ? timeAgo(p.last_contact_at) : '')}
                      </span>
                    </div>
                    {/* Message preview */}
                    <p className={`text-[12px] truncate mb-0.5 ${hasUnread ? 'font-semibold text-[#1C1C1E]' : 'font-normal text-[#8E8E93]'}`}>
                      {lastMsg?.direction === 'outgoing' && <span className="text-[#8E8E93]">{he ? 'אתה: ' : 'You: '}</span>}
                      {previewText}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <div className="flex items-center gap-1.5 bg-black/[0.03] px-2 py-0.5 rounded-lg">
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: s.color }} />
                        <span className="text-[11px] font-bold uppercase tracking-tight text-[#8E8E93]">{he ? s.he : s.label}</span>
                      </div>
                      {p.sub_status && SUB_STATUSES[p.stage] && (() => {
                        const subDef = SUB_STATUSES[p.stage]?.find(s => s.key === p.sub_status)
                        if (!subDef) return null
                        return (
                          <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-md"
                            style={{ color: subDef.color, background: subDef.color + '15' }}>
                            {he ? subDef.he : subDef.label}
                          </span>
                        )
                      })()}

                      {p.group_names && p.group_names.length > 0 && (
                        <div className="flex items-center gap-1 min-w-0 bg-[#fe5b25]/[0.05] px-2 py-0.5 rounded-lg" title={p.group_names.join(', ')}>
                          <Users className="w-3 h-3 text-[#fe5b25] shrink-0 opacity-70" />
                          <span className="text-[11px] font-bold text-[#fe5b25] truncate opacity-80">
                            {p.group_names[0]}
                          </span>
                          {p.group_names.length > 1 && (
                            <span className="text-[10px] font-black text-[#fe5b25] shrink-0 opacity-50">+{p.group_names.length - 1}</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              )
              })}
              {filteredList.length > displayLimit && (
                <button
                  onClick={() => setDisplayLimit(prev => prev + 50)}
                  className="w-full py-4 text-center text-[13px] font-bold text-[#fe5b25] hover:bg-[#fe5b25]/5 rounded-2xl transition-colors"
                >
                  {he
                    ? `הצג עוד ${Math.min(50, filteredList.length - displayLimit)} מתוך ${filteredList.length - displayLimit} נותרים`
                    : `Show ${Math.min(50, filteredList.length - displayLimit)} more of ${filteredList.length - displayLimit} remaining`}
                </button>
              )}
            </>)}
          </div>
        </div>

        {/* ═══ CENTER: Merged Chat + Timeline ════════════════════════════ */}
        <div className="flex flex-col relative z-0 h-full overflow-hidden rounded-3xl" style={{ background: C.card, boxShadow: '0 4px 24px rgba(0,0,0,0.04)', border: `1px solid ${C.glassBorder}` }}>
          {/* Header */}
          {prospect ? (
            <div className="shrink-0 flex items-center gap-4 px-6 h-[72px] z-10 rounded-t-3xl" style={{ background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(24px)', borderBottom: `1px solid ${C.glassBorder}` }}>
              <div className="relative">
                <Avatar src={prospect.profile_pic_url} name={pName(prospect)} waId={prospect.wa_id || prospect.phone} size={48} />
                {isGroupAdmin(prospect.phone) && (
                  <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-amber-400 border-2 border-white shadow-sm flex items-center justify-center">
                    <Crown className="w-3 h-3 text-white" strokeWidth={2.5} />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                {editingName ? (
                  <div className="flex items-center gap-2">
                    <input value={nameDraft} onChange={e => setNameDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') setEditingName(false) }} className="text-lg font-bold border-b-2 outline-none bg-transparent" style={{ color: C.dark, borderColor: C.primary, width: 240 }} autoFocus />
                    <button onClick={saveName} className="p-2 rounded-xl bg-[#34C759]/10 hover:bg-[#34C759]/20 transition-colors"><Check className="w-4 h-4 text-[#34C759]" strokeWidth={3} /></button>
                    <button onClick={() => setEditingName(false)} className="p-2 rounded-xl bg-[#FF3B30]/10 hover:bg-[#FF3B30]/20 transition-colors"><X className="w-4 h-4 text-[#FF3B30]" strokeWidth={3} /></button>
                  </div>
                ) : (
                  <h2 className="text-[19px] font-bold tracking-tight cursor-pointer transition-opacity hover:opacity-60" style={{ color: C.dark }} onClick={() => { setEditingName(true); setNameDraft(prospect.display_name ?? '') }}>
                    {pName(prospect)}
                  </h2>
                )}
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[12px] font-bold text-[#8E8E93] tracking-tight">{prospect.phone}</span>
                  <span className="text-[10px] font-semibold text-[#8E8E93] tracking-wide bg-black/[0.03] px-1.5 py-0.5 rounded-md">
                    {prospect.updated_at ? (he ? `נראה ${timeAgo(prospect.updated_at)}` : `Last seen ${timeAgo(prospect.updated_at)}`) : (he ? 'לא ידוע' : 'Unknown')}
                  </span>
                  {isGroupAdmin(prospect.phone) && (
                    <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest bg-amber-100 px-1.5 py-0.5 rounded-md flex items-center gap-1">
                      <Crown className="w-3 h-3" strokeWidth={2.5} />
                      {he ? 'מנהל קבוצה' : 'Group Admin'}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <a href={`tel:${prospect.phone}`} className="w-11 h-11 rounded-2xl flex items-center justify-center bg-black/[0.03] hover:bg-black/[0.06] transition-all active:scale-90" style={{ color: C.dark }}><Phone className="w-5 h-5" strokeWidth={2} /></a>
                <button onClick={copyPhone} className="w-11 h-11 rounded-2xl flex items-center justify-center bg-black/[0.03] hover:bg-black/[0.06] transition-all active:scale-90" style={{ color: copied ? '#34C759' : C.dark }}>{copied ? <Check className="w-5 h-5" strokeWidth={3} /> : <Copy className="w-5 h-5" strokeWidth={2} />}</button>
              </div>
            </div>
          ) : (
            <div className="shrink-0 flex items-center px-6 h-[72px] rounded-t-3xl" style={{ background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(24px)', borderBottom: `1px solid ${C.glassBorder}` }}>
              <span className="text-[15px] font-bold text-[#8E8E93] uppercase tracking-widest">{he ? 'בחר לקוח מהרשימה' : 'Select a client'}</span>
            </div>
          )}

          {/* Chat + Timeline merged — fills all remaining space */}
          <div className="flex-1 overflow-y-auto px-8 py-8 space-y-6 scrollbar-hide" style={{ background: C.cream, backgroundImage: 'radial-gradient(at 50% 0%, rgba(254,91,37,0.02) 0, transparent 50%)' }}>
            {loading ? (
              <div className="flex items-center justify-center h-full"><Loader2 className="w-8 h-8 animate-spin text-[#8E8E93]" /></div>
            ) : !prospect ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="w-24 h-24 rounded-[40px] bg-white shadow-[0_15px_40px_rgba(0,0,0,0.04)] flex items-center justify-center mb-8">
                  <Inbox className="w-10 h-10 text-[#D1D1D6]" strokeWidth={1.5} />
                </div>
                <p className="text-xl font-bold text-[#1C1C1E]">{he ? 'אין שיחה נבחרת' : 'No conversation selected'}</p>
                <p className="text-[15px] font-medium text-[#8E8E93] mt-2">{he ? 'בחר פרוספקט כדי להתחיל בניהול' : 'Select a prospect to start managing'}</p>
              </div>
            ) : timeline.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="w-24 h-24 rounded-[40px] bg-white shadow-[0_15px_40px_rgba(0,0,0,0.04)] flex items-center justify-center mb-8">
                  <MessageCircle className="w-10 h-10 text-[#fe5b25]" strokeWidth={1.5} />
                </div>
                <p className="text-xl font-bold text-[#1C1C1E]">{he ? 'אין פעילות עדיין' : 'No activity yet'}</p>
                <p className="text-[15px] font-medium text-[#8E8E93] mt-2 max-w-[280px]">{he ? 'שלח הודעה ראשונה כדי להתחיל שיחה עם הלקוח' : 'Send a message to start a conversation'}</p>
              </div>
            ) : (
              <>
                {timeline.map((item, i) => {
                  const prevItem = i > 0 ? timeline[i - 1] : null
                  const showDateSep = !prevItem || fmtDate(new Date(item.ts).toISOString()) !== fmtDate(new Date(prevItem.ts).toISOString())

                  if (item.type === 'event') {
                    const ev = item.data
                    if (['message_sent', 'message_received'].includes(ev.event_type)) return null

                    return (
                      <div key={`ev-${ev.id}`}>
                        {showDateSep && <div className="flex justify-center my-8"><span className="text-[11px] font-semibold px-4 py-1.5 rounded-full bg-black/[0.04] text-[#8E8E93]">{fmtDate(new Date(item.ts).toISOString())}</span></div>}
                        <div className="flex justify-center my-4">
                          <div className="flex items-center gap-3 px-5 py-2.5 rounded-2xl text-[12px] font-bold shadow-sm border border-black/[0.02] bg-white">
                            {ev.event_type === 'stage_change' ? (
                              <>
                                <span className="opacity-50">{he ? getStage(ev.old_value ?? '').he : getStage(ev.old_value ?? '').label}</span>
                                <ArrowRight className="w-3.5 h-3.5 opacity-30" />
                                <span style={{ color: getStage(ev.new_value ?? '').color }}>{he ? getStage(ev.new_value ?? '').he : getStage(ev.new_value ?? '').label}</span>
                              </>
                            ) : (
                              <span className="text-[#1C1C1E]">
                                {evLabel(ev.event_type, he)}
                                {ev.new_value && ev.event_type !== 'stage_change' && <span className="font-medium text-[#8E8E93]"> — {ev.new_value.substring(0, 40)}</span>}
                              </span>
                            )}
                            <span className="text-[10px] font-black opacity-30 ml-1">{fmtTime(ev.created_at)}</span>
                          </div>
                        </div>
                      </div>
                    )
                  }

                  const msg = item.data
                  const out = msg.direction === 'outgoing'
                  const isTwilio = msg.channel === 'twilio'
                  return (
                    <div key={`msg-${msg.id}`}>
                      {showDateSep && <div className="flex justify-center my-8"><span className="text-[11px] font-semibold px-4 py-1.5 rounded-full bg-black/[0.04] text-[#8E8E93]">{fmtDate(msg.sent_at)}</span></div>}
                      <div className={`flex ${out ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[70%] rounded-[20px] px-5 py-3 shadow-sm relative group ${out ? 'bg-[#1C1C1E] text-white' : 'bg-white text-[#1C1C1E] border border-black/[0.02]'}`} style={{ borderBottomRightRadius: out ? 6 : 20, borderBottomLeftRadius: out ? 20 : 6 }}>
                          <p className="text-[14px] leading-[1.55] whitespace-pre-wrap font-medium text-start" style={{ direction: /[\u0590-\u05FF\u0600-\u06FF]/.test(msg.content) ? 'rtl' : 'ltr' }}>{msg.content}</p>
                          <div className={`flex items-center gap-2 mt-2 ${out ? 'justify-end opacity-80' : 'justify-start opacity-40'}`}>
                            <span className="text-[10px] font-bold uppercase tracking-tighter">{fmtTime(msg.sent_at)}</span>
                            {out && (msg.read_at ? <CheckCheck className="w-3.5 h-3.5 text-[#007AFF]" /> : msg.delivered_at ? <CheckCheck className="w-3.5 h-3.5 text-white/60" /> : <Check className="w-3.5 h-3.5 text-white/60" />)}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
                <div ref={chatEnd} />
              </>
            )}
          </div>

          {/* Quick replies */}
          {showQR && prospect && (
            <div className="shrink-0 px-8 py-6 absolute bottom-[88px] left-0 right-0 z-20 rounded-3xl mx-3 mb-1" style={{ background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(24px)', border: `1px solid ${C.glassBorder}`, boxShadow: C.panelShadow }}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-black uppercase tracking-[0.2em] text-[#8E8E93]">{he ? 'תבניות מהירות' : 'Quick Templates'}</span>
                  <button onClick={() => { setShowQR(false); setShowTemplateManager(true) }} className="p-1 rounded-lg hover:bg-black/[0.06] transition-colors" title={he ? 'נהל תבניות' : 'Manage Templates'}>
                    <Settings className="w-3.5 h-3.5 text-[#8E8E93]" />
                  </button>
                </div>
                <button onClick={() => setShowQR(false)} className="p-2 rounded-xl bg-black/[0.03] hover:bg-black/[0.06] transition-colors"><X className="w-4 h-4 text-[#1C1C1E]" /></button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {(qrTemplates.length > 0 ? qrTemplates : QUICK_REPLIES_FALLBACK.map((qr, i) => ({ id: qr.key, title: qr.label, body: qr.body, category: 'general', is_active: true, sort_order: i }))).map(tpl => (
                  <button key={tpl.id} onClick={() => { setNewMessage(resolveTemplateVars(tpl.body)); setShowQR(false); inputRef.current?.focus() }} className="text-start px-5 py-4 rounded-[24px] bg-white border border-black/[0.02] shadow-sm hover:shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all">
                    <span className="font-bold block mb-1 text-[#1C1C1E] text-[15px]">{tpl.title}</span>
                    <span className="line-clamp-1 text-[13px] text-[#8E8E93] font-medium">{tpl.body}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input Area */}
          <div className="shrink-0 z-30 flex flex-col rounded-b-3xl" style={{ background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(24px)', borderTop: `1px solid ${C.glassBorder}` }}>
            {/* Channel indicator — Rebeca (Twilio) is the only active channel */}
            {prospect && (
              <div className="flex items-center gap-3 px-8 pt-4 pb-1">
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-[12px] font-bold bg-[#fe5b25]/10 text-[#fe5b25] ring-1 ring-[#fe5b25]/30">
                  <img src={WA_CHANNELS.twilio.pic} alt="" className="w-6 h-6 rounded-full object-cover border border-black/[0.08]" />
                  <div className="flex flex-col items-start">
                    <span className="text-[11px] leading-tight">{he ? 'רבקה' : 'Rebeca'}</span>
                    <span className="text-[9px] font-normal opacity-70 leading-tight">{WA_CHANNELS.twilio.phone}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Composer */}
            <div className="px-8 py-4 flex items-end gap-4">
              <button onClick={() => setShowQR(!showQR)} disabled={!prospect} className="w-12 h-12 rounded-2xl flex items-center justify-center bg-black/[0.03] hover:bg-black/[0.06] transition-colors shrink-0 disabled:opacity-50" style={{ color: showQR ? '#fe5b25' : '#8E8E93' }}><Zap className="w-5 h-5" strokeWidth={2.5} /></button>
              <textarea 
                ref={inputRef} 
                value={newMessage} 
                onChange={e => {
                  setNewMessage(e.target.value);
                  e.target.style.height = 'auto';
                  e.target.style.height = Math.min(e.target.scrollHeight, 150) + 'px';
                }} 
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); if (inputRef.current) { inputRef.current.style.height = 'auto'; } } }} 
                placeholder={he ? 'הקלד הודעה...' : 'Write your message...'} 
                className="flex-1 min-h-[48px] max-h-[150px] rounded-[24px] border-none px-6 py-3.5 text-[16px] font-medium outline-none transition-all bg-black/[0.03] focus:bg-white focus:ring-4 focus:ring-[#fe5b25]/5 disabled:opacity-50 resize-none shadow-inner" 
                style={{ direction: he ? 'rtl' : 'ltr' }} 
                disabled={sending || !prospect} 
                rows={1}
              />
              <button onClick={() => handleSend()} disabled={!newMessage.trim() || sending || !prospect} className="w-12 h-12 rounded-2xl flex items-center justify-center text-white transition-all shadow-lg hover:shadow-[#fe5b25]/30 hover:scale-105 active:scale-95 disabled:opacity-20 disabled:hover:scale-100 shrink-0" style={{ background: newMessage.trim() ? '#1C1C1E' : '#D1D1D6' }}>
                {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" style={{ marginLeft: he ? 0 : 2, marginRight: he ? 2 : 0 }} />}
              </button>
            </div>
          </div>
        </div>

        {/* ═══ RIGHT: Contact Card ══════════════════════════════════════════ */}
        <div className="flex flex-col relative z-10 h-full overflow-hidden rounded-3xl" style={{ background: C.glass, backdropFilter: C.blur, border: `1px solid ${C.glassBorder}`, boxShadow: C.panelShadow }}>
          {loading || !prospect ? (
            <div className="flex items-center justify-center flex-1"><Loader2 className="w-5 h-5 animate-spin text-[#8E8E93]" /></div>
          ) : (
            <div className="flex flex-col h-full overflow-y-auto scrollbar-hide">

              {/* ── Profile Header ── */}
              <div className="shrink-0 px-4 pt-4 pb-3">
                {/* Name + Phone + Actions — single row */}
                <div className="flex items-center gap-3 mb-3">
                  <Avatar src={prospect.profile_pic_url} name={pName(prospect)} waId={prospect.wa_id || prospect.phone} size={56} square />
                  <div className="flex-1 min-w-0">
                    {editingName ? (
                      <div className="flex items-center gap-1.5">
                        <input value={nameDraft} onChange={e => setNameDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') setEditingName(false) }} className="w-full text-[14px] font-semibold border-b-2 outline-none bg-transparent" style={{ color: C.dark, borderColor: C.primary }} autoFocus />
                        <button onClick={saveName} className="p-1 rounded bg-[#34C759]/10"><Check className="w-3 h-3 text-[#34C759]" /></button>
                      </div>
                    ) : (
                      <p className="text-[14px] font-semibold truncate cursor-pointer hover:opacity-60 transition-opacity" style={{ color: C.dark }} onClick={() => { setEditingName(true); setNameDraft(prospect.display_name ?? '') }}>
                        {prospect.display_name || prospect.phone}
                      </p>
                    )}
                    {prospect.display_name && <p className="text-[11px] text-[#8E8E93]">{prospect.phone}</p>}
                  </div>
                  {/* Inline action icons */}
                  <div className="flex items-center gap-1 shrink-0">
                    <a href={`tel:${prospect.phone}`} className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-[#f0f0f0] transition-all"><PhoneCall className="w-3.5 h-3.5 text-[#8E8E93]" /></a>
                    <a href={`https://wa.me/${prospect.phone.replace(/[^0-9]/g, '')}`} target="_blank" rel="noreferrer" className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-[#34C759]/10 transition-all"><MessageCircle className="w-3.5 h-3.5 text-[#34C759]" /></a>
                    <button onClick={copyPhone} className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-[#f0f0f0] transition-all">{copied ? <Check className="w-3.5 h-3.5 text-[#34C759]" /> : <Copy className="w-3.5 h-3.5 text-[#8E8E93]" />}</button>
                  </div>
                </div>

                {/* Stage selector — compact inline */}
                <div className="relative">
                  <button onClick={() => setStageMenuOpen(!stageMenuOpen)} className="flex items-center justify-between w-full h-8 px-3 rounded-lg text-[12px] font-medium border border-black/[0.08] bg-white hover:border-black/[0.15] transition-all" style={{ color: stg.color }}>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ background: stg.color }} />
                      {he ? stg.he : stg.label}
                    </div>
                    <ChevronDown className={`w-3 h-3 transition-transform ${stageMenuOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {stageMenuOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setStageMenuOpen(false)} />
                      <div className="absolute top-full mt-1 z-50 w-full rounded-lg border border-black/[0.08] shadow-lg bg-white py-1">
                        {STAGES.map(s => (
                          <button key={s.key} onClick={() => changeStage(s.key)} className="flex items-center gap-2 w-full px-3 py-1.5 text-[12px] font-medium hover:bg-[#f5f5f5] transition-colors" style={{ color: prospect.stage === s.key ? s.color : C.gray }}>
                            <div className="w-2 h-2 rounded-full" style={{ background: s.color }} />
                            {he ? s.he : s.label}
                            {prospect.stage === s.key && <Check className="w-3 h-3 ml-auto" style={{ color: s.color }} />}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                {/* Trial status */}
                {prospect.stage === 'demo_trial' && prospect.trial_ends_at && (
                  <div className="mt-2 flex items-center justify-between px-3 py-1.5 rounded-lg bg-[#FF9500]/8 text-[11px] font-medium text-[#FF9500]">
                    <span>{he ? 'ניסיון נגמר' : 'Trial ends'}</span>
                    <span className="font-semibold">{relD(prospect.trial_ends_at, he)}</span>
                  </div>
                )}
                {prospect.stage === 'trial_expired' && (
                  <div className="mt-2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#8E8E93]/8 text-[11px] font-medium text-[#8E8E93]">
                    <Clock className="w-3 h-3" /> {he ? 'ניסיון הסתיים' : 'Trial ended'}
                  </div>
                )}
              </div>

              {/* ── Divider ── */}
              <div className="h-px bg-black/[0.06]" />

              {/* ── Unified Scrollable Content ── */}
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4 scrollbar-hide">

                {/* ── Registered Contractor Info (if onboarding completed) ── */}
                {contractor && (
                  <div className="rounded-lg border border-[#34C759]/20 bg-[#34C759]/[0.04] p-3 space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-[#34C759] flex items-center justify-center">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                      <span className="text-[11px] font-semibold text-[#34C759] uppercase tracking-wider">{he ? 'רשום במערכת' : 'Registered'}</span>
                      {contractor.subscription_plan && (
                        <span className="ml-auto text-[10px] font-medium px-1.5 py-0.5 rounded bg-[#FF9500]/10 text-[#FF9500]">
                          {contractor.subscription_plan}
                        </span>
                      )}
                    </div>

                    {/* Name — only show if it's a real name, not just a phone number */}
                    {contractor.full_name && !/^\+?\d+$/.test(contractor.full_name) && (
                      <div className="text-[13px] font-semibold text-[#1C1C1E]">{contractor.full_name}</div>
                    )}

                    {/* Professions from contractor table */}
                    {contractor.professions.length > 0 && (
                      <div>
                        <div className="text-[10px] text-[#8E8E93] mb-1">{he ? 'מקצועות' : 'Trades'}</div>
                        <div className="flex flex-wrap gap-1">
                          {contractor.professions.map(p => (
                            <span key={p} className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-white text-[#1C1C1E] border border-black/[0.06]">
                              <Briefcase className="w-2.5 h-2.5 text-[#fe5b25]" />{p}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Service Areas — State + Counties */}
                    {(contractor.counties.length > 0 || contractor.zip_codes.length > 0) && (() => {
                      // Derive state from zip code prefix
                      const zipToState: Record<string, string> = { '33': 'Florida', '34': 'Florida', '32': 'Florida', '10': 'New York', '11': 'New York', '12': 'New York', '75': 'Texas', '76': 'Texas', '77': 'Texas', '90': 'California', '91': 'California', '92': 'California', '93': 'California', '94': 'California', '95': 'California' }
                      const firstZip = contractor.zip_codes[0] ?? ''
                      const state = zipToState[firstZip.substring(0, 2)] ?? 'US'
                      const counties = contractor.counties.length > 0 ? contractor.counties : []
                      return (
                        <div>
                          <div className="text-[10px] text-[#8E8E93] mb-1">{he ? 'אזור שירות' : 'Service Area'}</div>
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <MapPin className="w-3 h-3 text-[#007AFF]" />
                            <span className="text-[12px] font-semibold text-[#1C1C1E]">{state}</span>
                          </div>
                          {counties.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {counties.map(c => (
                                <span key={c} className="px-2 py-0.5 rounded text-[10px] font-medium bg-[#007AFF]/8 text-[#007AFF]">{c}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })()}

                    {/* Working Days */}
                    {contractor.working_days.length > 0 && (
                      <div>
                        <div className="text-[10px] text-[#8E8E93] mb-1">{he ? 'ימי עבודה' : 'Working Days'}</div>
                        <div className="flex gap-1">
                          {['Su','Mo','Tu','We','Th','Fr','Sa'].map((d, i) => (
                            <span key={d} className={`w-6 h-6 rounded flex items-center justify-center text-[9px] font-semibold ${contractor.working_days.includes(i) ? 'bg-[#1C1C1E] text-white' : 'bg-black/[0.04] text-[#c7c7cc]'}`}>
                              {d}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Status indicators */}
                    <div className="flex items-center gap-3 text-[10px] pt-1 border-t border-[#34C759]/10">
                      <span className={`flex items-center gap-1 ${contractor.is_active ? 'text-[#34C759]' : 'text-[#FF3B30]'}`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${contractor.is_active ? 'bg-[#34C759]' : 'bg-[#FF3B30]'}`} />
                        {contractor.is_active ? (he ? 'פעיל' : 'Active') : (he ? 'לא פעיל' : 'Inactive')}
                      </span>
                      <span className={`flex items-center gap-1 ${contractor.wa_notify ? 'text-[#34C759]' : 'text-[#8E8E93]'}`}>
                        <MessageCircle className="w-2.5 h-2.5" />
                        {contractor.wa_notify ? (he ? 'התראות פעילות' : 'Notifications on') : (he ? 'התראות כבויות' : 'Notifications off')}
                      </span>
                    </div>
                  </div>
                )}

                {/* Professions (from prospect tags — shown when no contractor profile) */}
                {!contractor && prospect.profession_tags.length > 0 && (
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-[#8E8E93] mb-1.5">{he ? 'מקצוע' : 'Profession'}</div>
                    <div className="flex flex-wrap gap-1.5">
                      {prospect.profession_tags.map(t => (
                        <span key={t} className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-[#fe5b25]/8 text-[#fe5b25]">{t}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Source Groups */}
                {(prospect.group_names ?? []).length > 0 && (
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-[#8E8E93] mb-1.5">{he ? 'קבוצות מקור' : 'Source Groups'}</div>
                    <div className="space-y-1">
                      {(prospect.group_names ?? []).map(g => (
                        <div key={g} className="flex items-center gap-2 text-[12px] text-[#1C1C1E]">
                          <Users className="w-3 h-3 text-[#8E8E93] shrink-0" />
                          <span className="truncate">{g}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Group Membership Activity */}
                {memberships.length > 0 && (
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-[#8E8E93] mb-1.5">{he ? 'פעילות בקבוצות' : 'Group Activity'}</div>

                    {/* WhatsApp Profile (from enrichment — show once from first membership that has data) */}
                    {(() => {
                      const enriched = memberships.find(m => m.profile_name || m.about || m.profile_pic_url)
                      if (!enriched) return null
                      return (
                        <div className="flex items-center gap-3 mb-3 p-2.5 rounded-xl bg-white border border-black/[0.04]">
                          {enriched.profile_pic_url ? (
                            <img src={enriched.profile_pic_url} alt="" className="w-10 h-10 rounded-full object-cover shrink-0 shadow-sm" />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                              <Crown className="w-5 h-5 text-amber-500" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            {enriched.profile_name && (
                              <p className="text-[13px] font-semibold text-[#1C1C1E] truncate">{enriched.profile_name}</p>
                            )}
                            {enriched.about && (
                              <p className="text-[11px] text-[#8E8E93] truncate italic">"{enriched.about}"</p>
                            )}
                          </div>
                        </div>
                      )
                    })()}

                    <div className="space-y-2">
                      {memberships.map((m, i) => {
                        const isLeft = !!m.left_group_at
                        const isAdmin = m.classification === 'admin'
                        return (
                          <div key={i} className="rounded-lg p-2.5" style={{ background: isLeft ? '#FF3B3008' : isAdmin ? '#f59e0b08' : '#34C75908', border: `1px solid ${isLeft ? '#FF3B3015' : isAdmin ? '#f59e0b15' : '#34C75915'}` }}>
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-1.5 min-w-0">
                                {isAdmin && <Crown className="w-3 h-3 text-amber-500 shrink-0" strokeWidth={2.5} />}
                                <span className="text-[12px] font-semibold text-[#1C1C1E] truncate">{m.group_name}</span>
                              </div>
                              {isLeft ? (
                                <span className="text-[9px] font-bold text-[#FF3B30] bg-[#FF3B30]/10 px-1.5 py-0.5 rounded-md uppercase">{he ? 'עזב' : 'Left'}</span>
                              ) : isAdmin ? (
                                <span className="text-[9px] font-bold text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded-md uppercase">{he ? 'מנהל' : 'Admin'}</span>
                              ) : (
                                <span className="text-[9px] font-bold text-[#34C759] bg-[#34C759]/10 px-1.5 py-0.5 rounded-md uppercase">{he ? 'פעיל' : 'Active'}</span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-[10px] text-[#8E8E93]">
                              {m.joined_group_at && (
                                <div className="flex items-center gap-1">
                                  <LogIn className="w-3 h-3" />
                                  <span>{he ? 'הצטרף' : 'Joined'} {fmtFull(m.joined_group_at)}</span>
                                </div>
                              )}
                              {m.left_group_at && (
                                <div className="flex items-center gap-1 text-[#FF3B30]">
                                  <LogOutIcon className="w-3 h-3" />
                                  <span>{he ? 'עזב' : 'Left'} {fmtFull(m.left_group_at)}</span>
                                </div>
                              )}
                              <span>{m.total_messages} {he ? 'הודעות' : 'msgs'}</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Submitted Groups (via WhatsApp) */}
                {submittedGroups.length > 0 && (
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-[#8E8E93] mb-1.5">{he ? 'קבוצות שנשלחו' : 'Submitted Groups'}</div>
                    <div className="space-y-1.5">
                      {submittedGroups.map(g => (
                        <div key={g.id} className="flex items-center gap-2 text-[12px]">
                          <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${g.status === 'pending' ? 'bg-[#FF9500]' : g.status === 'joined' ? 'bg-[#34C759]' : 'bg-[#8E8E93]'}`} />
                          <span className="truncate text-[#1C1C1E] flex-1">{g.group_name || g.invite_code}</span>
                          <span className={`text-[10px] font-medium ${g.status === 'pending' ? 'text-[#FF9500]' : g.status === 'joined' ? 'text-[#34C759]' : 'text-[#8E8E93]'}`}>
                            {g.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Sub-Status / Onboarding Progress */}
                {prospect && SUB_STATUSES[prospect.stage] && (
                  <div className="mb-4">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-[#8E8E93] mb-2">
                      {prospect.stage === 'onboarding' ? (he ? 'התקדמות הרשמה' : 'Onboarding Progress') : (he ? 'סטטוס' : 'Status')}
                    </div>
                    {prospect.stage === 'onboarding' ? (
                      <OnboardingProgress step={prospect.onboarding_step} startedAt={prospect.onboarding_started_at} lastActivity={prospect.onboarding_last_activity_at} />
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {SUB_STATUSES[prospect.stage]?.map(s => {
                          const isActive = prospect.sub_status === s.key
                          return (
                            <button key={s.key} onClick={() => changeSubStatus(s.key)}
                              className="px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all"
                              style={{
                                background: isActive ? s.color + '20' : 'rgba(0,0,0,0.03)',
                                color: isActive ? s.color : '#8E8E93',
                                border: isActive ? `1.5px solid ${s.color}40` : '1.5px solid transparent',
                                boxShadow: isActive ? `0 2px 8px ${s.color}20` : 'none',
                              }}>
                              {he ? s.he : s.label}
                            </button>
                          )
                        })}
                      </div>
                    )}
                    {prospect.sub_status_changed_at && prospect.stage !== 'onboarding' && (
                      <p className="text-[10px] text-[#8E8E93] mt-1.5">
                        Changed {new Date(prospect.sub_status_changed_at).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                )}

                {/* Key Dates */}
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-[#8E8E93] mb-1.5">{he ? 'תאריכים' : 'Dates'}</div>
                  <div className="text-[12px] space-y-1">
                    <div className="flex justify-between"><span className="text-[#8E8E93]">{he ? 'נוצר' : 'Created'}</span><span className="font-medium text-[#1C1C1E]">{fmtFull(prospect.created_at)}</span></div>
                    <div className="flex justify-between"><span className="text-[#8E8E93]">{he ? 'קשר אחרון' : 'Last contact'}</span><span className="font-medium text-[#1C1C1E]">{prospect.last_contact_at ? fmtFull(prospect.last_contact_at) : '—'}</span></div>
                    {prospect.trial_ends_at && <div className="flex justify-between"><span className="text-[#8E8E93]">{he ? 'סיום ניסיון' : 'Trial end'}</span><span className="font-medium text-[#FF9500]">{fmtFull(prospect.trial_ends_at)}</span></div>}
                  </div>
                </div>

                {/* 24h Messaging Window */}
                {windowRemaining && (
                  <div className={`rounded-lg p-3 ${windowRemaining.expired ? 'bg-[#FF3B30]/[0.06] border border-[#FF3B30]/20' : windowRemaining.h < 4 ? 'bg-[#FF9500]/[0.06] border border-[#FF9500]/20' : 'bg-[#34C759]/[0.06] border border-[#34C759]/20'}`}>
                    <div className="flex items-center gap-1.5 mb-2">
                      <Timer className="w-3.5 h-3.5" style={{ color: windowRemaining.expired ? '#FF3B30' : windowRemaining.h < 4 ? '#FF9500' : '#34C759' }} />
                      <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: windowRemaining.expired ? '#FF3B30' : windowRemaining.h < 4 ? '#FF9500' : '#34C759' }}>
                        {he ? 'חלון 24 שעות' : '24h Window'}
                      </span>
                    </div>
                    {windowRemaining.expired ? (
                      <div className="flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-[#FF3B30]" />
                        <span className="text-[12px] font-semibold text-[#FF3B30]">{he ? 'החלון נסגר — שלח תבנית בלבד' : 'Window closed — template only'}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        {[
                          { v: String(windowRemaining.h).padStart(2, '0'), l: he ? 'שע' : 'h' },
                          { v: String(windowRemaining.m).padStart(2, '0'), l: he ? 'דק' : 'm' },
                          { v: String(windowRemaining.s).padStart(2, '0'), l: he ? 'שנ' : 's' },
                        ].map((u, i) => (
                          <div key={i} className="flex items-baseline gap-0.5">
                            {i > 0 && <span className="text-[14px] font-bold mx-0.5" style={{ color: windowRemaining.h < 4 ? '#FF9500' : '#34C759' }}>:</span>}
                            <span className="text-[18px] font-bold tabular-nums" style={{ color: windowRemaining.h < 4 ? '#FF9500' : '#34C759' }}>{u.v}</span>
                            <span className="text-[9px] font-medium" style={{ color: windowRemaining.h < 4 ? '#FF9500' : '#34C759', opacity: 0.7 }}>{u.l}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Divider */}
                <div className="h-px bg-black/[0.04]" />

                {/* Follow-up */}
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-[#8E8E93] mb-1.5">{he ? 'מעקב' : 'Follow-up'}</div>
                  {showFU ? (
                    <div className="space-y-2 bg-[#fafafa] p-3 rounded-lg border border-black/[0.06]">
                      <input type="date" value={fuDraft} onChange={e => setFuDraft(e.target.value)} className="w-full h-8 text-[12px] rounded-md border border-black/[0.08] px-2.5 outline-none bg-white focus:ring-2 focus:ring-[#fe5b25]/10 transition-all" />
                      <div className="flex gap-1">
                        {[1, 3, 7, 14].map(d => <button key={d} onClick={() => setFuDraft(new Date(Date.now() + d * 86400000).toISOString().split('T')[0])} className="flex-1 h-6 rounded text-[10px] font-medium bg-white border border-black/[0.06] hover:bg-[#f0f0f0] transition-colors text-[#1C1C1E]">{d}d</button>)}
                      </div>
                      <div className="flex gap-1.5">
                        <button onClick={saveFU} className="flex-1 h-7 rounded-md text-[11px] font-semibold text-white bg-[#1C1C1E]">{he ? 'שמור' : 'Save'}</button>
                        {prospect.next_followup_at && <button onClick={clearFU} className="h-7 px-2 rounded-md text-[11px] font-medium text-[#FF3B30] bg-[#FF3B30]/8">{he ? 'נקה' : 'Clear'}</button>}
                        <button onClick={() => setShowFU(false)} className="h-7 w-7 flex items-center justify-center rounded-md bg-white border border-black/[0.06]"><X className="w-3 h-3" /></button>
                      </div>
                    </div>
                  ) : prospect.next_followup_at ? (
                    <button onClick={() => { setShowFU(true); setFuDraft(prospect.next_followup_at!.split('T')[0]) }} className="flex items-center justify-between w-full px-3 py-2 rounded-lg text-[12px] hover:bg-[#f5f5f5] transition-all border border-black/[0.04]">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-3.5 h-3.5" style={{ color: fs === 'overdue' ? '#FF3B30' : fs === 'today' ? '#FF9500' : '#34C759' }} />
                        <span className="font-medium" style={{ color: fs === 'overdue' ? '#FF3B30' : fs === 'today' ? '#FF9500' : '#34C759' }}>{relD(prospect.next_followup_at, he)}</span>
                      </div>
                      <span className="text-[10px] text-[#8E8E93]">{fmtFull(prospect.next_followup_at)}</span>
                    </button>
                  ) : (
                    <button onClick={() => { setShowFU(true); setFuDraft(new Date(Date.now() + 86400000).toISOString().split('T')[0]) }} className="w-full flex items-center justify-center gap-1.5 h-8 rounded-lg border border-dashed border-black/[0.1] text-[11px] font-medium text-[#8E8E93] hover:text-[#1C1C1E] hover:bg-[#f5f5f5] transition-all">
                      <Plus className="w-3 h-3" /> {he ? 'הגדר תזכורת' : 'Set follow-up'}
                    </button>
                  )}
                </div>

                {/* Notes */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-[#8E8E93]">{he ? 'הערות' : 'Notes'}</span>
                    {!editingNotes && <button onClick={() => { setEditingNotes(true); setNoteDraft(prospect.notes) }} className="text-[10px] font-medium text-[#fe5b25] hover:underline">{he ? 'ערוך' : 'Edit'}</button>}
                  </div>
                  {editingNotes ? (
                    <div className="rounded-lg border border-black/[0.06] overflow-hidden">
                      <textarea value={noteDraft} onChange={e => setNoteDraft(e.target.value)} className="w-full p-2.5 text-[12px] outline-none resize-none bg-[#fafafa] leading-relaxed min-h-[80px]" style={{ color: C.dark }} autoFocus placeholder={he ? 'הערות...' : 'Notes...'} />
                      <div className="flex gap-1.5 p-2 border-t border-black/[0.04] bg-white">
                        <button onClick={saveNotes} className="flex-1 h-7 rounded-md text-[11px] font-semibold text-white bg-[#1C1C1E]">{he ? 'שמור' : 'Save'}</button>
                        <button onClick={() => setEditingNotes(false)} className="px-3 h-7 rounded-md text-[11px] font-medium border border-black/[0.06]">{he ? 'ביטול' : 'Cancel'}</button>
                      </div>
                    </div>
                  ) : (
                    <div className="p-2.5 rounded-lg bg-[#fafafa] border border-black/[0.04] cursor-pointer hover:border-black/[0.1] transition-all min-h-[50px]" onClick={() => { setEditingNotes(true); setNoteDraft(prospect.notes) }}>
                      <p className="text-[12px] whitespace-pre-wrap leading-relaxed" style={{ color: prospect.notes ? C.dark : '#c7c7cc' }}>
                        {prospect.notes || (he ? 'לחץ להוספת הערות...' : 'Click to add notes...')}
                      </p>
                    </div>
                  )}
                </div>

                {/* WA ID */}
                <div className="text-[10px] text-[#c7c7cc] font-mono pt-2 border-t border-black/[0.04]">
                  ID: {prospect.wa_id || prospect.phone}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
