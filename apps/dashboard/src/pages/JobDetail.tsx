import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, MapPin, DollarSign, MessageCircle,
  CheckCircle2, Phone, Loader2, Navigation,
  Star, MessageSquare, Calendar,
  Briefcase, ArrowRight, Timer,
  Circle, AlertCircle, CreditCard,
  Plus, Clock, X,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useI18n } from '../lib/i18n'
import { PROFESSIONS } from '../lib/professions'
import { PROFESSION_ICONS, formatProfession } from '../lib/profession-icons'
import { timeAgo } from '../lib/shared'

/* ── Types ── */
interface JobOrder {
  id: string
  lead_id: string | null
  subcontractor_id: string | null
  contractor_id: string | null
  deal_type: string
  deal_value: string
  status: string
  payment_status: string | null
  payment_amount: number | null
  payment_due_at: string | null
  job_amount: number | null
  customer_name: string | null
  customer_address: string | null
  customer_phone: string | null
  scheduled_date: string | null
  notes: string | null
  created_at: string
  updated_at: string | null
  completed_at: string | null
  sub_name: string
  sub_phone: string
  sub_professions: string[]
  lead_profession: string | null
  lead_city: string | null
  lead_zip: string | null
  lead_summary: string | null
  publisher_user_id: string | null
  publisher_name: string | null
  publisher_avatar: string | null
  contractor_name: string | null
}

interface JobEvent {
  id: string
  event_type: string
  description: string | null
  created_at: string
}

type MyRole = 'publisher' | 'receiver' | 'unknown'

const profMap = Object.fromEntries(PROFESSIONS.map(p => [p.id, p]))
const fmtDate = (s: string | null) => s ? new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'
const fmtMoney = (n: number | null | undefined) => n != null ? `$${n.toLocaleString()}` : '—'
const openNav = (a: string) => window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(a)}`, '_blank')

const STEPS = [
  { key: 'created', icon: Circle, en: 'Created', he: 'נוצר' },
  { key: 'pending', icon: AlertCircle, en: 'Pending', he: 'ממתין' },
  { key: 'active', icon: CheckCircle2, en: 'Active', he: 'פעיל' },
  { key: 'done', icon: Star, en: 'Done', he: 'הושלם' },
]
const stepOf = (s: string) => s === 'completed' ? 3 : s === 'accepted' ? 2 : s === 'pending' ? 1 : 0

const EVENT_ICONS: Record<string, typeof Plus> = {
  created: Plus, sent: ArrowRight, accepted: CheckCircle2,
  rejected: X, completed: Star, payment: DollarSign,
  note: MessageSquare, reminder: Clock,
}

export default function JobDetail() {
  const { id } = useParams<{ id: string }>()
  const nav = useNavigate()
  const { effectiveUserId } = useAuth()
  const { locale } = useI18n()
  const he = locale === 'he'
  const [job, setJob] = useState<JobOrder | null>(null)
  const [events, setEvents] = useState<JobEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [showPayment, setShowPayment] = useState(false)
  const [payAmount, setPayAmount] = useState('')
  const [paying, setPaying] = useState(false)
  const [accepting, setAccepting] = useState(false)
  const [rejecting, setRejecting] = useState(false)

  useEffect(() => {
    if (!id) return
    ;(async () => {
      const [{ data }, evRes] = await Promise.all([
        supabase.from('job_orders').select('*, subcontractors(full_name, phone, profession_tags)').eq('id', id).maybeSingle(),
        supabase.from('job_events').select('id, event_type, description, created_at').eq('job_order_id', id).order('created_at', { ascending: false }),
      ])
      if (data) {
        const r = data as any
        const [leadR, ctrR, pubR, pubAvR] = await Promise.all([
          r.lead_id ? supabase.rpc('get_lead_for_job', { p_lead_id: r.lead_id }).then(res => ({ data: res.data?.[0] || null })) : Promise.resolve({ data: null }),
          r.contractor_id ? supabase.from('profiles').select('full_name').eq('id', r.contractor_id).maybeSingle() : Promise.resolve({ data: null }),
          r.publisher_user_id ? supabase.from('profiles').select('full_name').eq('id', r.publisher_user_id).maybeSingle() : Promise.resolve({ data: null }),
          r.publisher_user_id ? supabase.from('contractor_profiles').select('avatar_url').eq('user_id', r.publisher_user_id).maybeSingle() : Promise.resolve({ data: null }),
        ])
        const sub = r.subcontractors
        setJob({
          ...data, sub_name: sub?.full_name || '', sub_phone: sub?.phone || '', sub_professions: sub?.profession_tags || [],
          publisher_user_id: r.publisher_user_id || null, publisher_name: pubR.data?.full_name || null,
          publisher_avatar: pubAvR.data?.avatar_url || null, contractor_name: ctrR.data?.full_name || null,
          lead_profession: leadR.data?.profession || null, lead_city: leadR.data?.city || null,
          lead_zip: leadR.data?.zip_code || null, lead_summary: leadR.data?.parsed_summary || null,
        })
      }
      if (evRes.data) setEvents(evRes.data)
      setLoading(false)
    })()
  }, [id])

  // Determine role
  const myRole: MyRole = !job || !effectiveUserId ? 'unknown'
    : job.publisher_user_id === effectiveUserId || job.contractor_id === effectiveUserId ? 'publisher'
    : 'receiver'

  async function markDone() {
    if (!job || updating || !effectiveUserId) return
    setUpdating(true)
    const now = new Date().toISOString()
    await supabase.from('job_orders').update({ status: 'completed', completed_at: now }).eq('id', job.id)
    await supabase.from('job_events').insert({ job_order_id: job.id, event_type: 'completed', description: he ? 'העבודה הושלמה' : 'Job completed', created_by: effectiveUserId })
    setJob(prev => prev ? { ...prev, status: 'completed', completed_at: now } : prev)
    setEvents(prev => [{ id: crypto.randomUUID(), event_type: 'completed', description: he ? 'העבודה הושלמה' : 'Job completed', created_at: now }, ...prev])
    setUpdating(false)
    fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/review-notify`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ job_order_id: job.id }),
    }).catch(() => {})
  }

  async function acceptJob() {
    if (!job || accepting || !effectiveUserId) return
    setAccepting(true)
    const { error } = await supabase.rpc('accept_job_order', { p_job_order_id: job.id })
    if (!error) {
      const now = new Date().toISOString()
      setJob(prev => prev ? { ...prev, status: 'accepted', updated_at: now } : prev)
      setEvents(prev => [{ id: crypto.randomUUID(), event_type: 'accepted', description: he ? 'העבודה אושרה' : 'Job accepted', created_at: now }, ...prev])
    }
    setAccepting(false)
  }

  async function rejectJob() {
    if (!job || rejecting || !effectiveUserId) return
    setRejecting(true)
    const { error } = await supabase.rpc('reject_job_order', { p_job_order_id: job.id })
    if (!error) nav('/jobs')
    setRejecting(false)
  }

  async function recordPayment() {
    if (!job || !effectiveUserId || !payAmount) return
    setPaying(true)
    const amount = parseFloat(payAmount)
    if (isNaN(amount) || amount <= 0) { setPaying(false); return }
    const total = (job.payment_amount || 0) + amount
    const status = job.job_amount && total >= job.job_amount ? 'paid' : 'partial'
    const now = new Date().toISOString()
    await supabase.from('job_orders').update({ payment_status: status, payment_amount: total, updated_at: now }).eq('id', job.id)
    const desc = `${he ? 'תשלום' : 'Payment'}: ${fmtMoney(amount)}`
    await supabase.from('job_events').insert({ job_order_id: job.id, event_type: 'payment', description: desc, created_by: effectiveUserId })
    setJob(prev => prev ? { ...prev, payment_status: status, payment_amount: total } : prev)
    setEvents(prev => [{ id: crypto.randomUUID(), event_type: 'payment', description: desc, created_at: now }, ...prev])
    setShowPayment(false); setPayAmount(''); setPaying(false)
  }

  if (loading) return <div className="flex items-center justify-center min-h-[100dvh] bg-white"><Loader2 className="w-8 h-8 animate-spin text-[#fe5b25]" /></div>
  if (!job) return (
    <div className="flex flex-col items-center justify-center min-h-[100dvh] bg-white gap-3">
      <Briefcase className="w-10 h-10 text-stone-200" strokeWidth={1} />
      <button onClick={() => nav('/jobs')} className="text-[#fe5b25] font-bold text-sm">{he ? 'חזור' : 'Back'}</button>
    </div>
  )

  const prof = job.lead_profession ? profMap[job.lead_profession] : null
  const profLabel = prof ? (he ? prof.he : prof.en) : (job.lead_profession ? formatProfession(job.lead_profession) : 'Job')
  const profIcon = job.lead_profession ? PROFESSION_ICONS[job.lead_profession] : null
  const done = job.status === 'completed'
  const active = job.status === 'accepted'
  const pending = job.status === 'pending'
  const amt = job.job_amount || job.payment_amount || null
  const loc = [job.lead_city, job.lead_zip].filter(Boolean).join(', ')
  const addr = job.customer_address || loc
  const step = stepOf(job.status)
  const pubName = job.publisher_name || job.contractor_name || ''
  const pubInit = pubName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?'
  const subInit = job.sub_name ? job.sub_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : '—'
  const dealPct = job.deal_type === 'percentage' ? parseInt(job.deal_value) || 0 : 0
  const profit = amt && dealPct ? Math.round(amt * dealPct / 100) : null
  const isPublisher = myRole === 'publisher'
  const counterpartyName = isPublisher ? job.sub_name : pubName
  const counterpartyPhone = isPublisher ? job.sub_phone : '' // publisher phone not stored on job
  const counterpartyInit = isPublisher ? subInit : pubInit
  const counterpartyLabel = isPublisher ? (he ? 'קבלן משנה' : 'Subcontractor') : (he ? 'מעביר' : 'Publisher')
  const paymentPaid = job.payment_amount || 0
  const paymentDue = (amt || 0) - paymentPaid
  const paymentPct = amt ? Math.round((paymentPaid / amt) * 100) : 0

  return (
    <div className="min-h-[100dvh] max-w-[520px] mx-auto bg-white" style={{ fontFamily: 'Outfit, sans-serif' }}>

      {/* ═══ HEADER ═══ */}
      <div className="px-5 pt-4 pb-6">
        <div className="flex items-center justify-between mb-8">
          <button onClick={() => nav(-1)} className="w-10 h-10 rounded-2xl bg-stone-50 flex items-center justify-center active:scale-95 transition-all">
            <ArrowLeft size={18} className="text-black" />
          </button>
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-bold text-stone-400 uppercase tracking-[0.2em]">{timeAgo(job.created_at, he)}</span>
            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-stone-100 text-stone-500 uppercase tracking-wider">
              {isPublisher ? (he ? 'מעביר' : 'Publisher') : (he ? 'מבצע' : 'Worker')}
            </span>
          </div>
        </div>

        <div className="flex items-start gap-4 mb-2">
          <div className="w-14 h-14 rounded-[18px] bg-stone-50 flex items-center justify-center shrink-0">
            {profIcon
              ? <span style={{ color: '#fe5b25', width: 28, height: 28, display: 'inline-flex' }} className="[&>svg]:w-7 [&>svg]:h-7">{profIcon}</span>
              : <Briefcase className="w-7 h-7 text-[#fe5b25]" strokeWidth={1.5} />
            }
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-[26px] font-light tracking-[-0.03em] text-black leading-none">{profLabel}</h1>
            {loc && <p className="text-[12px] text-stone-400 mt-1.5">{loc}</p>}
          </div>
          {amt != null && (
            <div className="text-right shrink-0">
              <p className="text-[28px] font-light tracking-[-0.03em] text-black leading-none">{fmtMoney(amt)}</p>
              {isPublisher && profit != null && (
                <p className="text-[11px] font-bold text-[#fe5b25] mt-1">{he ? 'רווח' : 'Profit'} {fmtMoney(profit)}</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ═══ PIPELINE ═══ */}
      <div className="px-5 mb-6">
        <div className="flex items-center">
          {STEPS.map((s, i) => {
            const reached = i <= step
            const current = i === step
            const I = s.icon
            return (
              <div key={s.key} className="flex items-center flex-1">
                <div className="flex flex-col items-center gap-1.5">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${current ? 'ring-4 ring-black/5 scale-110' : ''}`}
                    style={{ background: reached ? '#111' : '#f5f5f5', color: reached ? '#fff' : '#d4d4d4' }}>
                    <I size={13} strokeWidth={2.5} />
                  </div>
                  <span className={`text-[7px] font-bold uppercase tracking-[0.15em] ${reached ? 'text-black' : 'text-stone-300'}`}>
                    {he ? s.he : s.en}
                  </span>
                </div>
                {i < STEPS.length - 1 && <div className="flex-1 h-[2px] mx-1.5 rounded-full" style={{ background: i < step ? '#111' : '#f0f0f0' }} />}
              </div>
            )
          })}
        </div>
      </div>

      {/* ═══ HANDOFF ═══ */}
      {pubName && job.sub_name && (
        <div className="px-5 mb-6">
          <div className="rounded-[24px] p-6 bg-stone-50">
            <div className="flex items-center">
              {/* Sender */}
              <div className="flex-1 flex flex-col items-center gap-2 min-w-0">
                {job.publisher_avatar
                  ? <img src={job.publisher_avatar} alt="" className="w-14 h-14 rounded-2xl object-cover" />
                  : <div className="w-14 h-14 rounded-2xl bg-black flex items-center justify-center text-white text-[16px] font-bold">{pubInit}</div>
                }
                <p className="text-[12px] font-bold text-black truncate max-w-full">{pubName}</p>
                <p className="text-[8px] font-bold text-stone-400 uppercase tracking-[0.2em] -mt-1">{he ? 'מעביר' : 'Sender'}</p>
              </div>

              {/* Deal */}
              <div className="flex flex-col items-center gap-1 px-4 shrink-0">
                {dealPct > 0 ? (
                  <>
                    <span className="text-[44px] font-light tracking-[-0.04em] text-[#fe5b25] leading-none">{dealPct}%</span>
                    <span className="text-[8px] font-bold text-stone-400 uppercase tracking-[0.2em]">{he ? 'עמלה' : 'Commission'}</span>
                  </>
                ) : job.deal_type === 'fixed_price' ? (
                  <>
                    <span className="text-[30px] font-light tracking-[-0.03em] text-[#fe5b25] leading-none">${job.deal_value}</span>
                    <span className="text-[8px] font-bold text-stone-400 uppercase tracking-[0.2em]">{he ? 'קבוע' : 'Fixed'}</span>
                  </>
                ) : (
                  <span className="text-[14px] font-bold text-stone-400">{he ? 'מותאם' : 'Custom'}</span>
                )}
                <div className="flex items-center gap-1 mt-1">
                  <div className="w-6 h-[2px] bg-black rounded-full" />
                  <ArrowRight size={14} className="text-black" />
                </div>
              </div>

              {/* Receiver */}
              <div className="flex-1 flex flex-col items-center gap-2 min-w-0">
                <div className="w-14 h-14 rounded-2xl bg-[#fe5b25] flex items-center justify-center text-white text-[16px] font-bold">{subInit}</div>
                <p className="text-[12px] font-bold text-black truncate max-w-full">{job.sub_name}</p>
                <p className="text-[8px] font-bold text-stone-400 uppercase tracking-[0.2em] -mt-1">{he ? 'מקבל' : 'Receiver'}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ CONTENT ═══ */}
      <div className="px-5 space-y-4 pb-10">

        {/* Description */}
        {job.lead_summary && (
          <Card><p className="text-[14px] text-stone-500 leading-relaxed">{job.lead_summary}</p></Card>
        )}

        {/* Info Grid */}
        <Card noPad>
          <div className="grid grid-cols-2">
            <GridCell icon={DollarSign} label={he ? 'סכום' : 'Amount'} value={amt ? fmtMoney(amt) : '—'} />
            <GridCell icon={Timer} label={he ? 'זמן' : 'Time'} value={timeAgo(job.created_at, he)} border />
          </div>
          <div className="grid grid-cols-2 border-t border-stone-100">
            <GridCell icon={Calendar} label={he ? 'נוצר' : 'Created'} value={fmtDate(job.created_at)} />
            <GridCell icon={Calendar} label={he ? 'מתוכנן' : 'Scheduled'} value={job.scheduled_date ? fmtDate(job.scheduled_date) : '—'} border />
          </div>
        </Card>

        {/* Payment Status — publisher only */}
        {isPublisher && amt != null && (
          <Card noPad>
            <div className="px-5 py-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <CreditCard size={14} className="text-black" />
                  <span className="text-[10px] font-bold text-black uppercase tracking-[0.15em]">{he ? 'תשלום' : 'Payment'}</span>
                </div>
                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                  job.payment_status === 'paid' ? 'bg-stone-900 text-white'
                  : job.payment_status === 'partial' ? 'bg-stone-200 text-stone-700'
                  : 'bg-stone-100 text-stone-500'
                }`}>
                  {job.payment_status === 'paid' ? (he ? 'שולם' : 'Paid') : job.payment_status === 'partial' ? (he ? 'חלקי' : 'Partial') : (he ? 'לא שולם' : 'Unpaid')}
                </span>
              </div>
              {/* Progress bar */}
              <div className="h-2 rounded-full bg-stone-100 overflow-hidden mb-2">
                <div className="h-full rounded-full bg-black transition-all" style={{ width: `${Math.min(paymentPct, 100)}%` }} />
              </div>
              <div className="flex justify-between text-[10px] text-stone-400">
                <span>{he ? 'שולם' : 'Paid'}: {fmtMoney(paymentPaid)}</span>
                <span>{he ? 'נותר' : 'Due'}: {fmtMoney(Math.max(paymentDue, 0))}</span>
              </div>
            </div>
            {job.payment_status !== 'paid' && (
              <div className="border-t border-stone-100">
                {showPayment ? (
                  <div className="px-5 py-3 flex items-center gap-2">
                    <span className="text-[13px] text-stone-400">$</span>
                    <input type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)} placeholder="0"
                      className="flex-1 text-[14px] font-semibold text-black outline-none bg-transparent" autoFocus />
                    <button onClick={recordPayment} disabled={paying || !payAmount}
                      className="px-4 py-2 rounded-xl bg-black text-white text-[11px] font-bold disabled:opacity-40 active:scale-95 transition-all">
                      {paying ? <Loader2 size={12} className="animate-spin" /> : (he ? 'אשר' : 'Confirm')}
                    </button>
                    <button onClick={() => { setShowPayment(false); setPayAmount('') }} className="p-1 text-stone-400">
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <button onClick={() => setShowPayment(true)}
                    className="w-full flex items-center justify-center gap-2 py-3.5 active:bg-stone-50 transition-colors">
                    <DollarSign size={14} className="text-[#fe5b25]" />
                    <span className="text-[11px] font-bold text-[#fe5b25]">{he ? 'רשום תשלום' : 'Record Payment'}</span>
                  </button>
                )}
              </div>
            )}
          </Card>
        )}

        {/* Customer */}
        {job.customer_name && (
          <Card noPad>
            <div className="flex items-center gap-3 px-5 py-4">
              <div className="w-11 h-11 rounded-2xl bg-stone-100 flex items-center justify-center text-[12px] font-bold text-black shrink-0">
                {job.customer_name.slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-semibold text-black">{job.customer_name}</p>
                {job.customer_phone && <p className="text-[11px] text-stone-400 font-mono">{job.customer_phone}</p>}
                {loc && <p className="text-[11px] text-stone-400">{loc}</p>}
              </div>
              <span className="text-[8px] font-bold text-stone-400 uppercase tracking-[0.2em]">{he ? 'לקוח' : 'Customer'}</span>
            </div>
            {addr && (
              <button onClick={() => openNav(addr)}
                className="w-full flex items-center gap-3 px-5 py-3 border-t border-stone-100 active:bg-stone-50 transition-colors">
                <Navigation size={14} className="text-[#fe5b25]" />
                <span className="flex-1 text-left text-[12px] text-stone-500 truncate">{addr}</span>
                <ArrowRight size={12} className="text-stone-300" />
              </button>
            )}
            {job.customer_phone && (
              <div className="flex border-t border-stone-100">
                <ActionBtn href={`tel:${job.customer_phone}`} icon={Phone} label={he ? 'חייג' : 'Call'} border />
                <ActionBtn href={`https://wa.me/${job.customer_phone.replace(/\D/g, '')}`} icon={MessageCircle} label="WhatsApp" />
              </div>
            )}
          </Card>
        )}

        {/* Counterparty (the other side of the deal) */}
        {counterpartyName && (
          <Card noPad>
            <div className="flex items-center gap-3 px-5 py-4">
              {!isPublisher && job.publisher_avatar ? (
                <img src={job.publisher_avatar} alt="" className="w-11 h-11 rounded-2xl object-cover shrink-0" />
              ) : (
                <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-white text-[12px] font-bold shrink-0 ${isPublisher ? 'bg-[#fe5b25]' : 'bg-black'}`}>
                  {counterpartyInit}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-semibold text-black">{counterpartyName}</p>
                {isPublisher && job.sub_professions?.length > 0 && (
                  <p className="text-[11px] text-stone-400">
                    {job.sub_professions.slice(0, 2).map(p => profMap[p] ? (he ? profMap[p].he : profMap[p].en) : formatProfession(p)).join(', ')}
                  </p>
                )}
              </div>
              <span className="text-[8px] font-bold text-stone-400 uppercase tracking-[0.2em]">{counterpartyLabel}</span>
            </div>
            <div className="flex border-t border-stone-100">
              {counterpartyPhone && (
                <>
                  <ActionBtn href={`tel:${counterpartyPhone}`} icon={Phone} label={he ? 'חייג' : 'Call'} border />
                  <ActionBtn href={`https://wa.me/${counterpartyPhone.replace(/\D/g, '')}`} icon={MessageCircle} label="WhatsApp" border />
                </>
              )}
              <ActionBtn onClick={() => nav('/messages')} icon={MessageSquare} label={he ? 'צ׳אט' : 'Chat'} accent />
            </div>
          </Card>
        )}

        {/* Timeline */}
        {events.length > 0 && (
          <div>
            <p className="text-[10px] font-bold text-stone-400 uppercase tracking-[0.2em] mb-3 px-1">{he ? 'היסטוריה' : 'Timeline'}</p>
            <Card noPad>
              <div className="px-5 py-3">
                {events.map((ev, i) => {
                  const Icon = EVENT_ICONS[ev.event_type] || MessageSquare
                  const isLast = i === events.length - 1
                  return (
                    <div key={ev.id} className="flex gap-3 relative">
                      {!isLast && <div className="absolute left-[11px] top-7 bottom-0 w-[1.5px] bg-stone-100" />}
                      <div className="w-6 h-6 rounded-full bg-stone-100 flex items-center justify-center shrink-0 z-10">
                        <Icon size={11} className="text-stone-500" strokeWidth={2} />
                      </div>
                      <div className="pb-4 flex-1 min-w-0">
                        <p className="text-[12px] text-stone-600">{ev.description || ev.event_type}</p>
                        <p className="text-[9px] text-stone-400 mt-0.5">{timeAgo(ev.created_at, he)}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </Card>
          </div>
        )}

        {/* CTAs */}
        {pending && !isPublisher && (
          <div className="flex gap-3">
            <button onClick={acceptJob} disabled={accepting || rejecting}
              className="flex-1 py-4 rounded-2xl text-[14px] font-bold flex items-center justify-center gap-2 active:scale-[0.97] transition-all text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60">
              {accepting ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
              {he ? 'אשר עבודה' : 'Accept Job'}
            </button>
            <button onClick={rejectJob} disabled={accepting || rejecting}
              className="flex-1 py-4 rounded-2xl text-[14px] font-bold flex items-center justify-center gap-2 active:scale-[0.97] transition-all text-stone-600 bg-stone-100 hover:bg-stone-200 disabled:opacity-60">
              {rejecting ? <Loader2 size={16} className="animate-spin" /> : <X size={16} />}
              {he ? 'דחה' : 'Decline'}
            </button>
          </div>
        )}

        {active && !isPublisher && (
          <button onClick={markDone} disabled={updating}
            className="w-full py-4 rounded-2xl text-[14px] font-bold flex items-center justify-center gap-2 active:scale-[0.97] transition-all text-white bg-black disabled:opacity-60">
            {updating ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
            {he ? 'סמן כהושלם' : 'Mark as Done'}
          </button>
        )}

        {done && (
          <button onClick={() => nav(`/review-submit/${job.id}`)}
            className="w-full rounded-2xl p-4 flex items-center gap-3 active:scale-[0.98] transition-transform bg-stone-50">
            <Star size={20} className="text-[#fe5b25]" />
            <div className="flex-1 text-left">
              <p className="text-[14px] font-bold text-black">
                {isPublisher
                  ? (he ? `דרג את ${job.sub_name}` : `Rate ${job.sub_name}`)
                  : (he ? `דרג את ${pubName}` : `Rate ${pubName}`)
                }
              </p>
              <p className="text-[10px] text-stone-400">{he ? 'עזור לקבלנים אחרים' : 'Help others decide'}</p>
            </div>
            <ArrowRight size={14} className="text-stone-300" />
          </button>
        )}

        {job.notes && (
          <Card>
            <p className="text-[9px] font-bold text-stone-400 uppercase tracking-[0.2em] mb-2">{he ? 'הערות' : 'Notes'}</p>
            <p className="text-[12px] text-stone-500">{job.notes}</p>
          </Card>
        )}
      </div>
    </div>
  )
}

/* ═══ Sub-components ═══ */

function Card({ children, noPad }: { children: React.ReactNode; noPad?: boolean }) {
  return <div className={`rounded-[20px] bg-stone-50 overflow-hidden ${noPad ? '' : 'p-5'}`}>{children}</div>
}

function GridCell({ icon: Icon, label, value, border }: { icon: typeof Timer; label: string; value: string; border?: boolean }) {
  return (
    <div className={`px-5 py-4 ${border ? 'border-l border-stone-100' : ''}`}>
      <div className="flex items-center gap-1.5 mb-1">
        <Icon size={11} className="text-stone-400" strokeWidth={2} />
        <span className="text-[8px] font-bold text-stone-400 uppercase tracking-[0.2em]">{label}</span>
      </div>
      <p className="text-[15px] font-semibold text-black tracking-tight">{value}</p>
    </div>
  )
}

function ActionBtn({ href, onClick, icon: Icon, label, border, accent }: {
  href?: string; onClick?: () => void; icon: typeof Phone; label: string; border?: boolean; accent?: boolean
}) {
  const color = accent ? '#fe5b25' : '#111'
  const cls = `flex-1 flex items-center justify-center gap-2 py-3.5 active:bg-stone-100 transition-colors ${border ? 'border-r border-stone-100' : ''}`
  const inner = <><Icon size={14} style={{ color }} /><span className="text-[11px] font-bold" style={{ color }}>{label}</span></>
  if (href) return <a href={href} target={href.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer" className={cls}>{inner}</a>
  return <button onClick={onClick} className={cls}>{inner}</button>
}
