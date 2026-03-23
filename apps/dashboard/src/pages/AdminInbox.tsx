import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
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
  Search, Inbox, Users, Timer, Crown, LogIn, LogOut as LogOutIcon
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

const QUICK_REPLIES = [
  { key: 'intro', label: 'Intro', he_label: 'היכרות', en: 'Hi! I\'m from Lead Express. We help contractors get more jobs. Interested?', he: 'שלום! אני מ-Lead Express. מעוניין בשיחה קצרה?' },
  { key: 'followup', label: 'Follow-up', he_label: 'מעקב', en: 'Hey! Following up on my last message.', he: 'היי! עוקב אחרי ההודעה האחרונה.' },
  { key: 'demo', label: 'Demo', he_label: 'הדגמה', en: 'Want to try our platform for free?', he: 'רוצה לנסות בחינם?' },
  { key: 'price', label: 'Pricing', he_label: 'מחירון', en: 'Plans start at $29/mo. Want details?', he: 'מתחילים ב-$29 לחודש. מעוניין?' },
]

/* ── Helpers ────────────────────────────────────────────────────────── */
const hue = (s: string) => { let h = 0; for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h); return ((h % 360) + 360) % 360 }
const fmtTime = (d: string) => new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
const fmtDate = (d: string) => new Date(d).toLocaleDateString([], { month: 'short', day: 'numeric' })
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
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════ */
export default function AdminInbox() {
  const { locale } = useI18n()
  const he = locale === 'he'
  const { toast } = useToast()

  /* ── State ──────────────────────────────────────────────────────── */
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined)
  const [newMessage, setNewMessage] = useState('')
  const [selectedChannel, setSelectedChannel] = useState<'green_api' | 'twilio'>('green_api')
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
  const [filterStage, setFilterStage] = useState<string>('all')
  const [filterSubStatus, setFilterSubStatus] = useState<string | null>(null)
  const [displayLimit, setDisplayLimit] = useState(50)

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

  /* ── Filtered list ──────────────────────────────────────────────── */
  const filteredList = useMemo(() => {
    let list = prospectList
    if (filterStage === 'group_admin') {
      list = list.filter(p => isGroupAdmin(p.phone))
    } else if (filterStage !== 'all') {
      list = list.filter(p => p.stage === filterStage)
    }
    // Sub-status filter
    if (filterSubStatus) {
      list = list.filter(p => p.sub_status === filterSubStatus)
    }
    if (!listSearch.trim()) return list
    const q = listSearch.toLowerCase()
    return list.filter(p => (p.display_name ?? '').toLowerCase().includes(q) || p.phone.includes(q) || p.profession_tags.some(t => t.toLowerCase().includes(q)))
  }, [prospectList, listSearch, filterStage, filterSubStatus, adminPhones])

  // Reset display limit and sub-status filter when filter changes
  useEffect(() => { setDisplayLimit(50); setFilterSubStatus(null) }, [filterStage, listSearch])

  // Select first prospect if none selected and list loads
  useEffect(() => {
    if (!selectedId && filteredList.length > 0 && !listLoading) {
      setSelectedId(filteredList[0].id)
    }
  }, [filteredList, listLoading, selectedId])

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
      className="animate-fade-in flex flex-col h-full w-full absolute inset-0 overflow-hidden"
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
            <h1 className="text-lg font-semibold tracking-tight text-[#1C1C1E]">{he ? 'חדר מלחמה' : 'War Room'}</h1>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#8E8E93]">{he ? 'פייפליין' : 'Pipeline'}</p>
            </div>
          </div>
          <div className="relative group">
            <Search className="w-3.5 h-3.5 absolute top-1/2 -translate-y-1/2 text-[#8E8E93] transition-colors group-focus-within:text-[#fe5b25]" style={{ left: he ? 'auto' : 10, right: he ? 10 : 'auto' }} strokeWidth={2.5} />
            <input
              value={listSearch} onChange={e => setListSearch(e.target.value)}
              placeholder={he ? 'חיפוש...' : 'Search...'}
              className="w-[180px] h-9 rounded-2xl border border-black/[0.06] text-[12px] outline-none transition-all bg-white/60 focus:bg-white focus:ring-2 focus:ring-[#fe5b25]/10 focus:border-[#fe5b25]/30"
              style={{ paddingLeft: he ? 10 : 30, paddingRight: he ? 30 : 10, color: C.dark }}
            />
          </div>
        </div>

        {/* Pipeline stages row — all 8 stages fit on screen */}
        <div className="px-3 pb-3 flex items-center">
          {STAGES.map((s, idx) => {
            const count = stageCounts[s.key] || 0
            const isActive = filterStage === s.key
            const isDimmed = filterStage !== 'all' && !isActive && filterStage !== 'group_admin'
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
                opacity: filterStage !== 'all' && filterStage !== 'group_admin' ? 0.35 : 1,
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
        </div>

        {/* ── Sub-status row (expands below pipeline when a stage is active) ── */}
        {filterStage !== 'all' && filterStage !== 'group_admin' && SUB_STATUSES[filterStage] && (
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
                  {filterStage === 'all' ? (he ? 'כל הלקוחות' : 'All Clients') : filterStage !== 'group_admin' ? (he ? getStage(filterStage).he : getStage(filterStage).label) : (he ? 'כל הלקוחות' : 'All')}
                </span>
                <span className="text-[10px] font-bold text-[#8E8E93] bg-black/[0.04] px-1.5 py-0.5 rounded-md">
                  {filterStage === 'group_admin' ? prospectList.length : filteredList.length}
                </span>
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
              return (
                <button
                  key={`${p.id}-${idx}`}
                  onClick={() => setSelectedId(p.id)}
                  className={`w-full flex items-center gap-3 p-3 text-left transition-all rounded-2xl relative overflow-hidden group ${isActive ? 'bg-white shadow-md ring-2 ring-[#fe5b25]/15' : 'hover:bg-white/60 hover:shadow-sm hover:-translate-y-[1px] active:scale-[0.98]'}`}
                  style={{ direction: he ? 'rtl' : 'ltr' }}
                >
                  {isActive && <div className="absolute top-0 bottom-0 w-1.5 bg-[#fe5b25] shadow-[0_0_10px_rgba(0,74,255,0.3)]" style={{ [he ? 'right' : 'left']: 0 }} />}
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
                        <span className="text-[16px] font-semibold truncate text-[#1C1C1E]">{pName(p)}</span>
                        {isGroupAdmin(p.phone) && (
                          <span className="text-[8px] px-1.5 py-0.5 rounded-md font-black uppercase tracking-wider bg-amber-100 text-amber-600 shrink-0">Admin</span>
                        )}
                      </div>
                      <span className={`text-[10px] font-bold shrink-0 ml-2 uppercase tracking-tight ${isActive ? 'text-[#fe5b25]' : 'text-[#8E8E93]'}`}>
                        {p.last_contact_at ? fmtDate(p.last_contact_at) : ''}
                      </span>
                    </div>
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
                {isGroupAdmin(prospect.phone) ? (
                  <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-amber-400 border-2 border-white shadow-sm flex items-center justify-center">
                    <Crown className="w-3 h-3 text-white" strokeWidth={2.5} />
                  </div>
                ) : (
                  <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-[#34C759] border-2 border-white shadow-sm" />
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
                  <span className="text-[10px] font-black text-[#34C759] uppercase tracking-widest bg-[#34C759]/10 px-1.5 py-0.5 rounded-md">{he ? 'מחובר' : 'Online'}</span>
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
                <span className="text-[11px] font-black uppercase tracking-[0.2em] text-[#8E8E93]">{he ? 'תבניות מהירות' : 'Quick Templates'}</span>
                <button onClick={() => setShowQR(false)} className="p-2 rounded-xl bg-black/[0.03] hover:bg-black/[0.06] transition-colors"><X className="w-4 h-4 text-[#1C1C1E]" /></button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {QUICK_REPLIES.map(qr => (
                  <button key={qr.key} onClick={() => { setNewMessage(he ? qr.he : qr.en); setShowQR(false); inputRef.current?.focus() }} className="text-start px-5 py-4 rounded-[24px] bg-white border border-black/[0.02] shadow-sm hover:shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all">
                    <span className="font-bold block mb-1 text-[#1C1C1E] text-[15px]">{he ? qr.he_label : qr.label}</span>
                    <span className="line-clamp-1 text-[13px] text-[#8E8E93] font-medium">{he ? qr.he : qr.en}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input Area */}
          <div className="shrink-0 z-30 flex flex-col rounded-b-3xl" style={{ background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(24px)', borderTop: `1px solid ${C.glassBorder}` }}>
            {/* Channel Selector */}
            {prospect && (
              <div className="flex items-center gap-3 px-8 pt-4 pb-1">
                {/* Personal WA (Green API) */}
                <button
                  onClick={() => setSelectedChannel('green_api')}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[12px] font-bold transition-all ${selectedChannel === 'green_api' ? 'bg-[#34C759]/10 text-[#248A3D] ring-1 ring-[#34C759]/30' : 'bg-black/[0.03] text-[#8E8E93] hover:bg-black/[0.06]'}`}
                >
                  <img src={WA_CHANNELS.green_api.pic} alt="" className="w-6 h-6 rounded-full object-cover border border-black/[0.08]" />
                  <div className="flex flex-col items-start">
                    <span className="text-[11px] leading-tight">{he ? 'וואטסאפ אישי' : 'Personal WA'}</span>
                    <span className="text-[9px] font-normal opacity-70 leading-tight">{WA_CHANNELS.green_api.phone}</span>
                  </div>
                </button>
                {/* Official WA (Twilio) */}
                <button
                  onClick={() => setSelectedChannel('twilio')}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[12px] font-bold transition-all ${selectedChannel === 'twilio' ? 'bg-[#fe5b25]/10 text-[#fe5b25] ring-1 ring-[#fe5b25]/30' : 'bg-black/[0.03] text-[#8E8E93] hover:bg-black/[0.06]'}`}
                >
                  <img src={WA_CHANNELS.twilio.pic} alt="" className="w-6 h-6 rounded-full object-cover border border-black/[0.08]" />
                  <div className="flex flex-col items-start">
                    <span className="text-[11px] leading-tight">{he ? 'וואטסאפ רשמי' : 'Official WA'}</span>
                    <span className="text-[9px] font-normal opacity-70 leading-tight">{WA_CHANNELS.twilio.phone}</span>
                  </div>
                </button>
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
