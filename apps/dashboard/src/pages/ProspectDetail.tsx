import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useI18n } from '../lib/i18n'
import { supabase } from '../lib/supabase'
import {
  ArrowLeft, ArrowRight, Phone, MessageCircle, Send, Clock, Loader2,
  ChevronDown, Check, CheckCheck, CircleDot, Sparkles, DollarSign,
  XCircle, StickyNote, PhoneCall, Edit3, Calendar, Users, X, Plus,
  AlertTriangle, Zap, Copy, ExternalLink, Flame, Snowflake, TrendingUp,
  Search, ChevronRight, Inbox,
} from 'lucide-react'

/* ── Design tokens ─────────────────────────────────────────────────── */
const C = {
  primary: '#fe5b25', dark: '#0b0707', cream: '#faf9f6',
  border: '#efeff1', gray: '#3b3b3b', muted: '#9ca3af',
  wa: '#25D366', waDark: '#075E54', bg: '#f8f9fb',
}

/* ── Types ──────────────────────────────────────────────────────────── */
interface Prospect { id: string; wa_id: string; phone: string; display_name: string | null; profile_pic_url: string | null; profession_tags: string[]; group_ids: string[]; stage: string; assigned_wa_account_id: string | null; notes: string; last_contact_at: string | null; next_followup_at: string | null; created_at: string; updated_at: string; group_names?: string[] }
interface Message { id: string; prospect_id: string; wa_account_id: string | null; direction: 'outgoing' | 'incoming'; message_type: string; content: string; wa_message_id: string | null; sent_at: string; delivered_at: string | null; read_at: string | null }
interface ProspectEvent { id: string; event_type: string; old_value: string | null; new_value: string | null; detail: Record<string, unknown>; created_at: string }
interface ProspectListItem { id: string; phone: string; display_name: string | null; stage: string; profession_tags: string[]; updated_at: string; last_contact_at: string | null; profile_pic_url: string | null }

/* ── Stages ─────────────────────────────────────────────────────────── */
const STAGES = [
  { key: 'prospect',        label: 'Prospect',        he: 'פרוספקט',     icon: CircleDot,     color: '#6366f1', bg: '#eef2ff' },
  { key: 'reached_out',     label: 'Reached Out',     he: 'יצרנו קשר',   icon: Phone,         color: '#0ea5e9', bg: '#f0f9ff' },
  { key: 'in_conversation', label: 'In Conversation', he: 'בשיחה',       icon: MessageCircle, color: '#8b5cf6', bg: '#f5f3ff' },
  { key: 'demo_trial',      label: 'Demo / Trial',    he: 'הדגמה',       icon: Sparkles,      color: '#f59e0b', bg: '#fffbeb' },
  { key: 'paying',          label: 'Paying',          he: 'משלם',        icon: DollarSign,    color: '#10b981', bg: '#ecfdf5' },
  { key: 'churned',         label: 'Churned',         he: 'נטש',         icon: XCircle,       color: '#ef4444', bg: '#fef2f2' },
] as const
const getStage = (k: string) => STAGES.find(s => s.key === k) ?? STAGES[0]

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
const daysSince = (d: string) => Math.floor((Date.now() - new Date(d).getTime()) / 86400000)
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

/* ══════════════════════════════════════════════════════════════════════ */
export default function ProspectDetail() {
  const { id } = useParams<{ id: string }>()
  const nav = useNavigate()
  const { locale } = useI18n()
  const he = locale === 'he'

  /* ── State ──────────────────────────────────────────────────────── */
  const [prospect, setProspect] = useState<Prospect | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [events, setEvents] = useState<ProspectEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [newMessage, setNewMessage] = useState('')
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
  const [prospectList, setProspectList] = useState<ProspectListItem[]>([])
  const [listSearch, setListSearch] = useState('')
  const [listLoading, setListLoading] = useState(true)

  const chatEnd = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  /* ── Fetch prospect list ────────────────────────────────────────── */
  useEffect(() => {
    async function fetchList() {
      const pages: ProspectListItem[] = []
      let from = 0
      const size = 500
      while (true) {
        const { data } = await supabase.from('prospects').select('id,phone,display_name,stage,profession_tags,updated_at,last_contact_at,profile_pic_url').is('archived_at', null).order('updated_at', { ascending: false }).range(from, from + size - 1)
        if (!data || data.length === 0) break
        pages.push(...(data as ProspectListItem[]))
        if (data.length < size) break
        from += size
      }
      const unique = Array.from(new Map(pages.map(p => [p.id, p])).values())
      setProspectList(unique)
      setListLoading(false)
    }
    fetchList()
  }, [])

  /* ── Fetch prospect detail ──────────────────────────────────────── */
  const fetchAll = useCallback(async () => {
    if (!id) return
    const [pR, mR, eR] = await Promise.all([
      supabase.from('prospect_with_groups').select('*').eq('id', id).single(),
      supabase.from('prospect_messages').select('*').eq('prospect_id', id).order('sent_at', { ascending: true }),
      supabase.from('prospect_events').select('*').eq('prospect_id', id).order('created_at', { ascending: true }).limit(100),
    ])
    if (pR.data) setProspect(pR.data as Prospect)
    if (mR.data) setMessages(mR.data as Message[])
    if (eR.data) setEvents(eR.data as ProspectEvent[])
    setLoading(false)
  }, [id])

  useEffect(() => {
    setLoading(true)
    fetchAll()
    const mc = supabase.channel(`pm-${id}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'prospect_messages', filter: `prospect_id=eq.${id}` }, p => setMessages(prev => [...prev, p.new as Message])).subscribe()
    const pc = supabase.channel(`p-${id}`).on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'prospects', filter: `id=eq.${id}` }, () => fetchAll()).subscribe()
    return () => { supabase.removeChannel(mc); supabase.removeChannel(pc) }
  }, [id, fetchAll])

  useEffect(() => { setTimeout(() => chatEnd.current?.scrollIntoView({ behavior: 'smooth' }), 100) }, [messages, id])

  /* ── Merged timeline ────────────────────────────────────────────── */
  const timeline = useMemo(() => buildTimeline(messages, events), [messages, events])

  /* ── Filtered list ──────────────────────────────────────────────── */
  const filteredList = useMemo(() => {
    if (!listSearch.trim()) return prospectList
    const q = listSearch.toLowerCase()
    return prospectList.filter(p => (p.display_name ?? '').toLowerCase().includes(q) || p.phone.includes(q) || p.profession_tags.some(t => t.toLowerCase().includes(q)))
  }, [prospectList, listSearch])

  /* ── Actions ────────────────────────────────────────────────────── */
  async function handleSend(text?: string) {
    const t = text ?? newMessage; if (!t.trim() || !prospect || sending) return; setSending(true)
    try { const url = import.meta.env.VITE_WA_LISTENER_URL || 'http://localhost:3001'; const r = await fetch(`${url}/api/prospects/send`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prospect_id: prospect.id, wa_id: prospect.wa_id, text: t.trim(), wa_account_id: prospect.assigned_wa_account_id }) }); if (r.ok) { setNewMessage(''); setShowQR(false); inputRef.current?.focus(); if (prospect.stage === 'prospect') await changeStage('reached_out') } } finally { setSending(false) }
  }
  async function changeStage(ns: string) { if (!prospect || prospect.stage === ns) return; const old = prospect.stage; setProspect(p => p ? { ...p, stage: ns } : p); setStageMenuOpen(false); await supabase.from('prospects').update({ stage: ns }).eq('id', prospect.id); await supabase.from('prospect_events').insert({ prospect_id: prospect.id, event_type: 'stage_change', old_value: old, new_value: ns }); fetchAll() }
  async function saveNotes() { if (!prospect) return; await supabase.from('prospects').update({ notes: noteDraft }).eq('id', prospect.id); await supabase.from('prospect_events').insert({ prospect_id: prospect.id, event_type: 'note_added', new_value: noteDraft.substring(0, 100) }); setProspect(p => p ? { ...p, notes: noteDraft } : p); setEditingNotes(false) }
  async function saveName() { if (!prospect) return; const n = nameDraft.trim() || null; await supabase.from('prospects').update({ display_name: n }).eq('id', prospect.id); setProspect(p => p ? { ...p, display_name: n } : p); setEditingName(false) }
  async function saveFU() { if (!prospect) return; const v = fuDraft || null; await supabase.from('prospects').update({ next_followup_at: v }).eq('id', prospect.id); setProspect(p => p ? { ...p, next_followup_at: v } : p); setShowFU(false) }
  async function clearFU() { if (!prospect) return; await supabase.from('prospects').update({ next_followup_at: null }).eq('id', prospect.id); setProspect(p => p ? { ...p, next_followup_at: null } : p); setShowFU(false) }
  function copyPhone() { if (!prospect) return; navigator.clipboard.writeText(prospect.phone); setCopied(true); setTimeout(() => setCopied(false), 2000) }

  const nxtStg = () => { if (!prospect) return null; const i = STAGES.findIndex(s => s.key === prospect.stage); return i >= 0 && i < STAGES.length - 1 ? STAGES[i + 1] : null }
  const ns = prospect ? nxtStg() : null
  const stg = prospect ? getStage(prospect.stage) : STAGES[0]
  const stgIdx = prospect ? STAGES.findIndex(s => s.key === prospect.stage) : 0
  const fs = prospect ? fuSt(prospect.next_followup_at) : null
  const pName = (p: Prospect | ProspectListItem) => p.display_name || p.phone

  const Avatar = ({ src, name, waId, size = 36 }: { src?: string | null; name: string; waId: string; size?: number }) => {
    const h = hue(waId)
    if (src) return <img src={src} alt="" className="rounded-full object-cover shrink-0" style={{ width: size, height: size }} />
    return (
      <div className="rounded-full flex items-center justify-center font-bold text-white shrink-0" style={{ width: size, height: size, fontSize: size * 0.35, background: `linear-gradient(135deg, hsl(${h} 55% 50%), hsl(${h + 35} 50% 58%))` }}>
        {name[0]?.toUpperCase() ?? '?'}
      </div>
    )
  }

  /* ── Render ─────────────────────────────────────────────────────── */
  return (
    <div
      className="animate-fade-in"
      style={{
        margin: '-32px -24px',
        height: '100vh',
        display: 'grid',
        gridTemplateColumns: '280px minmax(0,1fr) 320px',
        fontFamily: 'Inter, sans-serif',
        letterSpacing: '-0.02em',
        background: C.bg,
      }}
    >

      {/* ═══ LEFT: Prospect List ═══════════════════════════════════════ */}
      <div className="flex flex-col" style={{ borderRight: `1px solid ${C.border}`, background: 'white', height: '100vh' }}>
        {/* Header */}
        <div className="shrink-0 p-4 border-b" style={{ borderColor: C.border }}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold" style={{ color: C.dark }}>{he ? 'פרוספקטים' : 'Prospects'}</h2>
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ background: `${C.primary}10`, color: C.primary }}>{prospectList.length}</span>
          </div>
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute top-1/2 -translate-y-1/2" style={{ color: C.muted, left: 10 }} />
            <input
              value={listSearch} onChange={e => setListSearch(e.target.value)}
              placeholder={he ? 'חיפוש...' : 'Search...'}
              className="w-full h-8 rounded-lg border pl-8 pr-3 text-xs outline-none transition-all focus:border-gray-300"
              style={{ borderColor: C.border, background: C.bg, color: C.dark }}
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {listLoading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 animate-spin" style={{ color: C.muted }} /></div>
          ) : filteredList.length === 0 ? (
            <div className="text-center py-12 text-xs" style={{ color: C.muted }}>{he ? 'לא נמצאו תוצאות' : 'No results'}</div>
          ) : filteredList.map((p, idx) => {
            const isActive = p.id === id
            const s = getStage(p.stage)
            return (
              <button
                key={`${p.id}-${idx}`}
                onClick={() => nav(`/admin/prospects/${p.id}`)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left transition-all hover:bg-gray-50"
                style={{
                  background: isActive ? `${C.primary}08` : 'transparent',
                  borderBottom: `1px solid ${C.border}`,
                  borderLeft: isActive ? `3px solid ${C.primary}` : '3px solid transparent',
                }}
              >
                <Avatar src={p.profile_pic_url} name={pName(p)} waId={p.phone} size={38} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] font-medium truncate" style={{ color: isActive ? C.dark : C.gray }}>{pName(p)}</span>
                    <span className="text-[10px] shrink-0 ml-2" style={{ color: C.muted }}>{p.last_contact_at ? fmtDate(p.last_contact_at) : ''}</span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: s.color }} />
                    <span className="text-[10px] truncate" style={{ color: C.muted }}>{he ? s.he : s.label}</span>
                    {p.profession_tags[0] && <span className="text-[9px] px-1.5 py-0.5 rounded-full truncate" style={{ background: `${C.primary}10`, color: C.primary }}>{p.profession_tags[0]}</span>}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* ═══ CENTER: Merged Chat + Timeline ════════════════════════════ */}
      <div className="flex flex-col" style={{ height: '100vh', borderRight: `1px solid ${C.border}` }}>
        {/* Header */}
        {prospect && (
          <div className="shrink-0 flex items-center gap-3 px-5 h-[60px] border-b" style={{ borderColor: C.border, background: 'white' }}>
            <Avatar src={prospect.profile_pic_url} name={pName(prospect)} waId={prospect.wa_id || prospect.phone} size={38} />
            <div className="flex-1 min-w-0">
              {editingName ? (
                <div className="flex items-center gap-1">
                  <input value={nameDraft} onChange={e => setNameDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') setEditingName(false) }} className="text-sm font-semibold border-b-2 outline-none bg-transparent" style={{ color: C.dark, borderColor: C.primary, width: 180 }} autoFocus />
                  <button onClick={saveName} className="p-1 rounded-full hover:bg-green-50"><Check className="w-3.5 h-3.5 text-green-600" /></button>
                  <button onClick={() => setEditingName(false)} className="p-1 rounded-full hover:bg-red-50"><X className="w-3.5 h-3.5 text-red-400" /></button>
                </div>
              ) : (
                <h2 className="text-sm font-semibold truncate cursor-pointer transition-colors" style={{ color: C.dark }} onClick={() => { setEditingName(true); setNameDraft(prospect.display_name ?? '') }} onMouseEnter={e => (e.currentTarget.style.color = C.primary)} onMouseLeave={e => (e.currentTarget.style.color = C.dark)}>
                  {pName(prospect)}
                </h2>
              )}
              <div className="flex items-center gap-2 text-[11px]" style={{ color: C.muted }}>
                <span>{prospect.phone}</span>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: C.wa }} />
                <span style={{ color: C.wa }}>{he ? 'מחובר' : 'Online'}</span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <a href={`tel:${prospect.phone}`} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-100 transition-all" style={{ color: C.muted }}><Phone className="w-4 h-4" /></a>
              <button onClick={copyPhone} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-100 transition-all" style={{ color: copied ? C.wa : C.muted }}>{copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}</button>
            </div>
          </div>
        )}

        {/* Chat + Timeline merged — fills all remaining space */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 min-h-0" style={{ background: '#fafbfc' }}>
          {loading ? (
            <div className="flex items-center justify-center h-full"><Loader2 className="w-6 h-6 animate-spin" style={{ color: C.muted }} /></div>
          ) : timeline.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-20 h-20 rounded-2xl flex items-center justify-center mb-4" style={{ background: `${C.primary}08` }}>
                <Inbox className="w-9 h-9" style={{ color: C.primary, opacity: 0.6 }} />
              </div>
              <p className="text-base font-semibold" style={{ color: C.dark }}>{he ? 'אין פעילות עדיין' : 'No activity yet'}</p>
              <p className="text-sm mt-1.5 max-w-[240px]" style={{ color: C.muted }}>{he ? 'שלח הודעה ראשונה כדי להתחיל שיחה עם הליד' : 'Send a message to start a conversation with this lead'}</p>
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
                      {showDateSep && <div className="flex justify-center my-3"><span className="text-[10px] font-medium px-3 py-1 rounded-full" style={{ background: C.border, color: C.muted }}>{fmtDate(new Date(item.ts).toISOString())}</span></div>}
                      <div className="flex justify-center my-2">
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px]" style={{ background: ev.event_type === 'stage_change' ? getStage(ev.new_value ?? '').bg : C.cream, border: `1px solid ${C.border}` }}>
                          {ev.event_type === 'stage_change' ? (
                            <>
                              <span className="font-medium" style={{ color: getStage(ev.old_value ?? '').color }}>{he ? getStage(ev.old_value ?? '').he : getStage(ev.old_value ?? '').label}</span>
                              <ArrowRight className="w-3 h-3" style={{ color: C.muted }} />
                              <span className="font-bold" style={{ color: getStage(ev.new_value ?? '').color }}>{he ? getStage(ev.new_value ?? '').he : getStage(ev.new_value ?? '').label}</span>
                            </>
                          ) : (
                            <span className="font-medium" style={{ color: C.gray }}>
                              {evLabel(ev.event_type, he)}
                              {ev.new_value && ev.event_type !== 'stage_change' && <span style={{ color: C.muted }}> — {ev.new_value.substring(0, 40)}</span>}
                            </span>
                          )}
                          <span style={{ color: C.muted }}>{fmtTime(ev.created_at)}</span>
                        </div>
                      </div>
                    </div>
                  )
                }

                const msg = item.data
                const out = msg.direction === 'outgoing'
                return (
                  <div key={`msg-${msg.id}`}>
                    {showDateSep && <div className="flex justify-center my-3"><span className="text-[10px] font-medium px-3 py-1 rounded-full" style={{ background: C.border, color: C.muted }}>{fmtDate(msg.sent_at)}</span></div>}
                    <div className={`flex ${out ? 'justify-end' : 'justify-start'}`}>
                      <div className="max-w-[65%] rounded-2xl px-4 py-2.5 shadow-sm" style={{ background: out ? '#DCF8C6' : 'white', borderBottomRightRadius: out ? 4 : 20, borderBottomLeftRadius: out ? 20 : 4, border: out ? 'none' : `1px solid ${C.border}` }}>
                        <p className="text-[13px] leading-relaxed whitespace-pre-wrap" style={{ color: C.dark, direction: /[\u0590-\u05FF\u0600-\u06FF]/.test(msg.content) ? 'rtl' : 'ltr' }}>{msg.content}</p>
                        <div className="flex items-center justify-end gap-1 mt-1">
                          <span className="text-[10px]" style={{ color: '#8696a0' }}>{fmtTime(msg.sent_at)}</span>
                          {out && (msg.read_at ? <CheckCheck className="w-3.5 h-3.5" style={{ color: '#53BDEB' }} /> : msg.delivered_at ? <CheckCheck className="w-3.5 h-3.5" style={{ color: '#8696a0' }} /> : <Check className="w-3.5 h-3.5" style={{ color: '#8696a0' }} />)}
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
        {showQR && (
          <div className="shrink-0 border-t px-4 py-2.5" style={{ borderColor: C.border, background: C.cream }}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: C.muted }}>{he ? 'תבניות' : 'Templates'}</span>
              <button onClick={() => setShowQR(false)} className="p-0.5 rounded-full hover:bg-white"><X className="w-3 h-3" style={{ color: C.muted }} /></button>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {QUICK_REPLIES.map(qr => (
                <button key={qr.key} onClick={() => { setNewMessage(he ? qr.he : qr.en); setShowQR(false); inputRef.current?.focus() }} className="text-start px-3 py-2 rounded-xl text-[11px] hover:bg-white border transition-all hover:shadow-sm" style={{ borderColor: C.border }}>
                  <span className="font-bold block" style={{ color: C.primary }}>{he ? qr.he_label : qr.label}</span>
                  <span className="line-clamp-1" style={{ color: C.muted }}>{he ? qr.he : qr.en}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <div className="shrink-0 border-t px-4 py-3 flex items-center gap-2.5" style={{ borderColor: C.border, background: 'white' }}>
          <button onClick={() => setShowQR(!showQR)} className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors shrink-0" style={{ color: showQR ? C.primary : C.muted }}><Zap className="w-4.5 h-4.5" /></button>
          <input ref={inputRef} type="text" value={newMessage} onChange={e => setNewMessage(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }} placeholder={he ? 'הקלד הודעה...' : 'Write your message...'} className="flex-1 h-10 rounded-full border px-4 text-sm outline-none transition-all focus:border-gray-300" style={{ borderColor: C.border, background: C.bg, direction: he ? 'rtl' : 'ltr' }} disabled={sending} />
          <button onClick={() => handleSend()} disabled={!newMessage.trim() || sending} className="w-10 h-10 rounded-full flex items-center justify-center text-white transition-all hover:shadow-lg hover:scale-105 active:scale-95 disabled:opacity-30 shrink-0" style={{ background: newMessage.trim() ? C.wa : '#d1d5db' }}>
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* ═══ RIGHT: Lead Card ══════════════════════════════════════════ */}
      <div className="flex flex-col" style={{ background: 'white', height: '100vh' }}>
        {loading || !prospect ? (
          <div className="flex items-center justify-center flex-1"><Loader2 className="w-5 h-5 animate-spin" style={{ color: C.muted }} /></div>
        ) : (
          <div className="flex-1 overflow-y-auto min-h-0">
            {/* Profile header */}
            <div className="p-5 text-center border-b" style={{ borderColor: C.border, background: C.cream }}>
              <Avatar src={prospect.profile_pic_url} name={pName(prospect)} waId={prospect.wa_id || prospect.phone} size={72} />
              <h3 className="text-base font-semibold mt-3" style={{ color: C.dark }}>{pName(prospect)}</h3>
              <p className="text-xs mt-0.5" style={{ color: C.muted }}>{prospect.phone}</p>

              {/* Stage selector */}
              <div className="relative inline-block mt-3">
                <button onClick={() => setStageMenuOpen(!stageMenuOpen)} className="flex items-center gap-1.5 h-7 px-3 rounded-full text-[11px] font-bold border transition-all hover:shadow-sm mx-auto" style={{ borderColor: stg.color + '30', background: stg.bg, color: stg.color }}>
                  <stg.icon className="w-3 h-3" /> {he ? stg.he : stg.label} <ChevronDown className="w-3 h-3" />
                </button>
                {stageMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setStageMenuOpen(false)} />
                    <div className="absolute top-full mt-1 z-50 rounded-xl border shadow-xl overflow-hidden" style={{ background: 'white', borderColor: C.border, width: 170, left: '50%', transform: 'translateX(-50%)' }}>
                      {STAGES.map(s => (
                        <button key={s.key} onClick={() => changeStage(s.key)} className="flex items-center gap-2 w-full px-3 py-2 text-xs font-medium hover:bg-gray-50 transition-colors" style={{ color: prospect.stage === s.key ? s.color : C.gray }}>
                          <div className="w-2 h-2 rounded-full" style={{ background: s.color }} />
                          {he ? s.he : s.label}
                          {prospect.stage === s.key && <Check className="w-3 h-3" style={{ marginInlineStart: 'auto', color: s.color }} />}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Advance CTA */}
              {ns && (
                <button onClick={() => changeStage(ns.key)} className="flex items-center gap-1 h-8 px-4 rounded-full text-[11px] font-bold text-white mx-auto mt-2 transition-all hover:shadow-md hover:scale-105 active:scale-95" style={{ background: C.dark }}>
                  <ArrowRight className="w-3 h-3" /> {he ? ns.he : ns.label}
                </button>
              )}

              {/* Stage progress */}
              <div className="flex gap-1 mt-3 px-2">
                {STAGES.map((s, i) => (
                  <div key={s.key} className="flex-1 h-1 rounded-full" style={{ background: i <= stgIdx ? s.color : C.border }} />
                ))}
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-px border-b" style={{ borderColor: C.border, background: C.border }}>
              {[
                { label: he ? 'הודעות' : 'Messages', val: messages.length, icon: MessageCircle },
                { label: he ? 'ימים' : 'Days', val: daysSince(prospect.created_at), icon: Clock },
                { label: he ? 'אירועים' : 'Events', val: events.length, icon: Zap },
              ].map(s => (
                <div key={s.label} className="flex flex-col items-center py-3" style={{ background: 'white' }}>
                  <span className="text-lg font-bold" style={{ color: C.dark }}>{s.val}</span>
                  <span className="text-[10px] font-medium" style={{ color: C.muted }}>{s.label}</span>
                </div>
              ))}
            </div>

            {/* Quick actions row */}
            <div className="flex items-center justify-center gap-3 py-3 border-b" style={{ borderColor: C.border }}>
              <a href={`tel:${prospect.phone}`} className="flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl hover:bg-gray-50 transition-all">
                <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: `${C.wa}12` }}><PhoneCall className="w-4 h-4" style={{ color: C.wa }} /></div>
                <span className="text-[10px] font-medium" style={{ color: C.gray }}>{he ? 'התקשר' : 'Call'}</span>
              </a>
              <a href={`https://wa.me/${prospect.phone.replace(/[^0-9]/g, '')}`} target="_blank" rel="noreferrer" className="flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl hover:bg-gray-50 transition-all">
                <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: `${C.wa}12` }}><ExternalLink className="w-4 h-4" style={{ color: C.wa }} /></div>
                <span className="text-[10px] font-medium" style={{ color: C.gray }}>WhatsApp</span>
              </a>
              <button onClick={copyPhone} className="flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl hover:bg-gray-50 transition-all">
                <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: `${C.primary}10` }}>{copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" style={{ color: C.primary }} />}</div>
                <span className="text-[10px] font-medium" style={{ color: C.gray }}>{copied ? (he ? 'הועתק!' : 'Copied!') : (he ? 'העתק' : 'Copy')}</span>
              </button>
            </div>

            {/* Follow-up */}
            <div className="px-4 py-3 border-b" style={{ borderColor: C.border }}>
              <div className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: C.muted }}>{he ? 'תזכורת' : 'Follow-up'}</div>
              {showFU ? (
                <div className="space-y-2">
                  <input type="date" value={fuDraft} onChange={e => setFuDraft(e.target.value)} className="w-full h-8 text-xs rounded-lg border px-2 outline-none" style={{ borderColor: C.border }} />
                  <div className="flex gap-1">
                    {[1, 3, 7, 14].map(d => <button key={d} onClick={() => setFuDraft(new Date(Date.now() + d * 86400000).toISOString().split('T')[0])} className="flex-1 h-6 rounded-full text-[10px] font-medium border hover:bg-gray-50" style={{ borderColor: C.border, color: C.gray }}>{d}d</button>)}
                  </div>
                  <div className="flex gap-1.5">
                    <button onClick={saveFU} className="flex-1 h-7 rounded-full text-xs font-bold text-white" style={{ background: C.dark }}>{he ? 'שמור' : 'Set'}</button>
                    {prospect.next_followup_at && <button onClick={clearFU} className="h-7 px-3 rounded-full text-xs text-red-500 border border-red-200 hover:bg-red-50">{he ? 'נקה' : 'Clear'}</button>}
                    <button onClick={() => setShowFU(false)} className="h-7 px-3 rounded-full text-xs border hover:bg-gray-50" style={{ borderColor: C.border, color: C.muted }}>X</button>
                  </div>
                </div>
              ) : prospect.next_followup_at ? (
                <button onClick={() => { setShowFU(true); setFuDraft(prospect.next_followup_at!.split('T')[0]) }} className="flex items-center gap-2 w-full px-3 py-2 rounded-xl text-xs font-semibold transition-all hover:shadow-sm" style={{ background: fs === 'overdue' ? '#fef2f2' : fs === 'today' ? '#fffbeb' : '#ecfdf5', color: fs === 'overdue' ? '#dc2626' : fs === 'today' ? '#d97706' : '#059669', border: `1px solid ${fs === 'overdue' ? '#fecaca' : fs === 'today' ? '#fde68a' : '#a7f3d0'}` }}>
                  {fs === 'overdue' ? <AlertTriangle className="w-3.5 h-3.5" /> : <Calendar className="w-3.5 h-3.5" />}
                  {relD(prospect.next_followup_at, he)} — {fmtFull(prospect.next_followup_at)}
                </button>
              ) : (
                <button onClick={() => { setShowFU(true); setFuDraft(new Date(Date.now() + 86400000).toISOString().split('T')[0]) }} className="w-full flex items-center justify-center gap-1.5 h-8 rounded-xl border border-dashed text-xs font-medium hover:bg-gray-50 transition-all" style={{ borderColor: C.border, color: C.muted }}>
                  <Plus className="w-3 h-3" /> {he ? 'הגדר תזכורת' : 'Set follow-up'}
                </button>
              )}
            </div>

            {/* Details */}
            <div className="px-4 py-3 border-b" style={{ borderColor: C.border }}>
              <div className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: C.muted }}>{he ? 'פרטים' : 'Details'}</div>
              <div className="space-y-2 text-xs">
                {prospect.profession_tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {prospect.profession_tags.map(t => <span key={t} className="px-2 py-0.5 rounded-full font-medium" style={{ background: `${C.primary}10`, color: C.primary }}>{t}</span>)}
                  </div>
                )}
                {(prospect.group_names ?? []).map(g => <div key={g} className="px-2.5 py-1.5 rounded-xl" style={{ background: C.cream, color: C.gray }}>{g}</div>)}
                <div className="flex justify-between" style={{ color: C.muted }}><span>{he ? 'נוצר' : 'Created'}</span><span style={{ color: C.gray }}>{fmtFull(prospect.created_at)}</span></div>
                {prospect.last_contact_at && <div className="flex justify-between" style={{ color: C.muted }}><span>{he ? 'קשר אחרון' : 'Last Contact'}</span><span style={{ color: C.gray }}>{fmtFull(prospect.last_contact_at)}</span></div>}
              </div>
            </div>

            {/* Notes */}
            <div className="px-4 py-3">
              <div className="flex items-center justify-between mb-2">
                <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: C.muted }}>{he ? 'הערות' : 'Notes'}</div>
                <button onClick={() => { setEditingNotes(!editingNotes); setNoteDraft(prospect.notes) }} className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-gray-100"><Edit3 className="w-3 h-3" style={{ color: C.muted }} /></button>
              </div>
              {editingNotes ? (
                <div className="space-y-2">
                  <textarea value={noteDraft} onChange={e => setNoteDraft(e.target.value)} className="w-full h-24 text-xs rounded-xl border p-3 outline-none resize-none" style={{ borderColor: C.border, color: C.dark }} autoFocus />
                  <div className="flex gap-1.5">
                    <button onClick={saveNotes} className="flex-1 h-7 rounded-full text-xs font-bold text-white" style={{ background: C.dark }}>{he ? 'שמור' : 'Save'}</button>
                    <button onClick={() => setEditingNotes(false)} className="flex-1 h-7 rounded-full text-xs border hover:bg-gray-50" style={{ borderColor: C.border, color: C.muted }}>{he ? 'ביטול' : 'Cancel'}</button>
                  </div>
                </div>
              ) : (
                <p className="text-xs whitespace-pre-wrap leading-relaxed" style={{ color: prospect.notes ? C.gray : '#d1d5db' }}>
                  {prospect.notes || (he ? 'אין הערות עדיין...' : 'No notes yet...')}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
