import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../lib/auth'
import { useI18n } from '../lib/i18n'
import { supabase } from '../lib/supabase'
import { PROFESSIONS } from '../lib/professions'
import { useToast } from './hooks/use-toast'
import {
  X,
  Plus,
  Send,
  Eye,
  CheckCircle,
  XCircle,
  Trophy,
  DollarSign,
  MessageSquare,
  Bell,
  Loader2,
  Save,
  Phone,
  User,
  MapPin,
  Calendar,
  CreditCard,
} from 'lucide-react'

/* ───────────────── Types ───────────────── */

interface JobDetailPanelProps {
  jobId: string
  onClose: () => void
  onUpdate: () => void
}

interface JobOrder {
  id: string
  lead_id: string | null
  subcontractor_id: string | null
  deal_type: string
  deal_value: string
  status: string
  payment_status: string | null
  payment_amount: number | null
  payment_date: string | null
  payment_due_at: string | null
  job_amount: number | null
  customer_name: string | null
  customer_address: string | null
  scheduled_date: string | null
  notes: string | null
  created_at: string
  completed_at: string | null
  // Joined
  sub_name: string
  sub_phone: string
  lead_profession: string | null
  lead_city: string | null
  lead_zip: string | null
  lead_summary: string | null
}

interface JobEvent {
  id: string
  event_type: string
  description: string | null
  created_at: string
}

/* ───────────────── Helpers ───────────────── */

const profLookup = Object.fromEntries(PROFESSIONS.map((p) => [p.id, p]))

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatCurrency(amount: number | null | undefined): string {
  if (amount == null) return '$0'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(amount)
}

const EVENT_ICONS: Record<string, typeof Plus> = {
  created: Plus,
  sent: Send,
  viewed: Eye,
  accepted: CheckCircle,
  rejected: XCircle,
  completed: Trophy,
  payment: DollarSign,
  note: MessageSquare,
  reminder: Bell,
}

/* ───────────────── Status Badge ───────────────── */

function StatusBadge({ status, he }: { status: string; he: boolean }) {
  const config: Record<string, { label: string; labelHe: string; cls: string }> = {
    pending:   { label: 'Pending',   labelHe: 'ממתין',   cls: 'bg-amber-50 text-amber-700 border-amber-200' },
    accepted:  { label: 'Accepted',  labelHe: 'התקבל',   cls: 'bg-blue-50 text-blue-700 border-blue-200' },
    completed: { label: 'Completed', labelHe: 'הושלם',   cls: 'bg-green-50 text-green-700 border-green-200' },
    rejected:  { label: 'Rejected',  labelHe: 'נדחה',    cls: 'bg-red-50 text-red-700 border-red-200' },
    cancelled: { label: 'Cancelled', labelHe: 'בוטל',    cls: 'bg-stone-100 text-stone-500 border-stone-200' },
  }
  const c = config[status] || config.pending
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold border ${c.cls}`}>
      {he ? c.labelHe : c.label}
    </span>
  )
}

/* ───────────────── Component ───────────────── */

export default function JobDetailPanel({ jobId, onClose, onUpdate }: JobDetailPanelProps) {
  const { effectiveUserId } = useAuth()
  const { locale } = useI18n()
  const { toast } = useToast()
  const panelRef = useRef<HTMLDivElement>(null)

  const he = locale === 'he'

  const [job, setJob] = useState<JobOrder | null>(null)
  const [events, setEvents] = useState<JobEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Editable customer fields
  const [customerName, setCustomerName] = useState('')
  const [customerAddress, setCustomerAddress] = useState('')
  const [scheduledDate, setScheduledDate] = useState('')
  const [jobAmount, setJobAmount] = useState('')

  // Payment flow
  const [showPaymentForm, setShowPaymentForm] = useState(false)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [recordingPayment, setRecordingPayment] = useState(false)

  // Add note flow
  const [showNoteForm, setShowNoteForm] = useState(false)
  const [noteText, setNoteText] = useState('')
  const [addingNote, setAddingNote] = useState(false)

  // Completing
  const [completing, setCompleting] = useState(false)

  /* ── Fetch ── */
  useEffect(() => {
    if (!jobId) return
    let cancelled = false

    async function load() {
      setLoading(true)
      try {
        const [jobRes, eventsRes] = await Promise.all([
          supabase
            .from('job_orders')
            .select('*, subcontractors ( full_name, phone ), leads ( profession, city, zip_code, parsed_summary )')
            .eq('id', jobId)
            .single(),
          supabase
            .from('job_events')
            .select('id, event_type, description, created_at')
            .eq('job_order_id', jobId)
            .order('created_at', { ascending: false }),
        ])

        if (cancelled) return

        if (jobRes.error) throw jobRes.error

        const row = jobRes.data
        const mapped: JobOrder = {
          id: row.id,
          lead_id: row.lead_id,
          subcontractor_id: row.subcontractor_id,
          deal_type: row.deal_type,
          deal_value: row.deal_value,
          status: row.status,
          payment_status: row.payment_status,
          payment_amount: row.payment_amount,
          payment_date: row.payment_date,
          payment_due_at: row.payment_due_at,
          job_amount: row.job_amount,
          customer_name: row.customer_name,
          customer_address: row.customer_address,
          scheduled_date: row.scheduled_date,
          notes: row.notes,
          created_at: row.created_at,
          completed_at: row.completed_at,
          sub_name: row.subcontractors?.full_name || 'Unknown',
          sub_phone: row.subcontractors?.phone || '',
          lead_profession: row.leads?.profession || null,
          lead_city: row.leads?.city || null,
          lead_zip: row.leads?.zip_code || null,
          lead_summary: row.leads?.parsed_summary || null,
        }

        setJob(mapped)
        setCustomerName(mapped.customer_name || '')
        setCustomerAddress(mapped.customer_address || '')
        setScheduledDate(mapped.scheduled_date ? mapped.scheduled_date.slice(0, 10) : '')
        setJobAmount(mapped.job_amount != null ? String(mapped.job_amount) : '')

        if (!eventsRes.error && eventsRes.data) {
          setEvents(eventsRes.data)
        }
      } catch (err: unknown) {
        toast({ title: 'Error', description: 'Failed to load job details', variant: 'destructive' })
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [jobId, toast])

  /* ── Save Customer Info ── */
  async function handleSaveCustomerInfo() {
    if (!job) return
    setSaving(true)
    try {
      const updates: Record<string, any> = {
        customer_name: customerName || null,
        customer_address: customerAddress || null,
        scheduled_date: scheduledDate || null,
        job_amount: jobAmount ? parseFloat(jobAmount) : null,
        updated_at: new Date().toISOString(),
      }
      const { error } = await supabase
        .from('job_orders')
        .update(updates)
        .eq('id', job.id)

      if (error) throw error

      setJob({ ...job, ...updates })
      toast({ title: he ? 'נשמר' : 'Saved', description: he ? 'פרטי הלקוח עודכנו' : 'Customer info updated' })
      onUpdate()
    } catch (err: unknown) {
      toast({ title: 'Error', description: (err as Error).message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  /* ── Mark Completed ── */
  async function handleMarkCompleted() {
    if (!job || !effectiveUserId) return
    setCompleting(true)
    try {
      const now = new Date().toISOString()
      const { error: updateErr } = await supabase
        .from('job_orders')
        .update({ status: 'completed', completed_at: now, updated_at: now })
        .eq('id', job.id)

      if (updateErr) throw updateErr

      await supabase.from('job_events').insert({
        job_order_id: job.id,
        event_type: 'completed',
        description: he ? 'העבודה סומנה כהושלמה' : 'Job marked as completed',
        created_by: effectiveUserId,
      })

      setJob({ ...job, status: 'completed', completed_at: now })
      setEvents((prev) => [
        { id: crypto.randomUUID(), event_type: 'completed', description: he ? 'העבודה סומנה כהושלמה' : 'Job marked as completed', created_at: now },
        ...prev,
      ])
      toast({ title: he ? 'הושלם' : 'Completed', description: he ? 'העבודה סומנה כהושלמה' : 'Job marked as completed' })
      onUpdate()
    } catch (err: unknown) {
      toast({ title: 'Error', description: (err as Error).message, variant: 'destructive' })
    } finally {
      setCompleting(false)
    }
  }

  /* ── Record Payment ── */
  async function handleRecordPayment() {
    if (!job || !effectiveUserId || !paymentAmount) return
    setRecordingPayment(true)
    try {
      const amount = parseFloat(paymentAmount)
      if (isNaN(amount) || amount <= 0) throw new Error('Invalid amount')

      const now = new Date().toISOString()
      const existingPaid = job.payment_amount || 0
      const totalPaid = existingPaid + amount
      const newStatus = job.job_amount && totalPaid >= job.job_amount ? 'paid' : 'partial'

      const { error: updateErr } = await supabase
        .from('job_orders')
        .update({
          payment_status: newStatus,
          payment_amount: totalPaid,
          payment_date: now,
          updated_at: now,
        })
        .eq('id', job.id)

      if (updateErr) throw updateErr

      const desc = `Received ${formatCurrency(amount)}`
      await supabase.from('job_events').insert({
        job_order_id: job.id,
        event_type: 'payment',
        description: desc,
        created_by: effectiveUserId,
      })

      setJob({ ...job, payment_status: newStatus, payment_amount: totalPaid, payment_date: now })
      setEvents((prev) => [
        { id: crypto.randomUUID(), event_type: 'payment', description: desc, created_at: now },
        ...prev,
      ])
      setShowPaymentForm(false)
      setPaymentAmount('')
      toast({ title: he ? 'תשלום נרשם' : 'Payment Recorded', description: desc })
      onUpdate()
    } catch (err: unknown) {
      toast({ title: 'Error', description: (err as Error).message, variant: 'destructive' })
    } finally {
      setRecordingPayment(false)
    }
  }

  /* ── Add Note ── */
  async function handleAddNote() {
    if (!job || !effectiveUserId || !noteText.trim()) return
    setAddingNote(true)
    try {
      const now = new Date().toISOString()
      await supabase.from('job_events').insert({
        job_order_id: job.id,
        event_type: 'note',
        description: noteText.trim(),
        created_by: effectiveUserId,
      })

      setEvents((prev) => [
        { id: crypto.randomUUID(), event_type: 'note', description: noteText.trim(), created_at: now },
        ...prev,
      ])
      setShowNoteForm(false)
      setNoteText('')
      toast({ title: he ? 'הערה נוספה' : 'Note Added' })
    } catch (err: unknown) {
      toast({ title: 'Error', description: (err as Error).message, variant: 'destructive' })
    } finally {
      setAddingNote(false)
    }
  }

  /* ── Send Reminder (wa.me) ── */
  function handleSendReminder() {
    if (!job) return
    let phone = job.sub_phone.replace(/\D/g, '')
    if (phone.startsWith('0')) {
      phone = '972' + phone.slice(1)
    } else if (phone.length === 10) {
      phone = '1' + phone
    }
    const msg = he
      ? `היי ${job.sub_name}, תזכורת לגבי העבודה ב${[job.lead_city, job.lead_zip].filter(Boolean).join(', ') || 'האזור שלך'}. אנא עדכן אותי על הסטטוס.`
      : `Hey ${job.sub_name}, just a reminder about the job in ${[job.lead_city, job.lead_zip].filter(Boolean).join(', ') || 'your area'}. Please update me on the status.`
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank')

    // Log reminder event silently
    if (effectiveUserId) {
      supabase.from('job_events').insert({
        job_order_id: job.id,
        event_type: 'reminder',
        description: he ? 'תזכורת נשלחה בWhatsApp' : 'Reminder sent via WhatsApp',
        created_by: effectiveUserId,
      }).then(() => {
        const now = new Date().toISOString()
        setEvents((prev) => [
          { id: crypto.randomUUID(), event_type: 'reminder', description: he ? 'תזכורת נשלחה בWhatsApp' : 'Reminder sent via WhatsApp', created_at: now },
          ...prev,
        ])
      })
    }
  }

  /* ── Render ── */
  const prof = job?.lead_profession ? profLookup[job.lead_profession] : null
  const location = job ? [job.lead_city, job.lead_zip].filter(Boolean).join(', ') : ''
  const dealLabel = job
    ? job.deal_type === 'percentage'
      ? `${job.deal_value}% ${he ? 'מהעבודה' : 'of job'}`
      : job.deal_type === 'fixed_price'
        ? `$${job.deal_value} ${he ? 'קבוע' : 'fixed'}`
        : job.deal_value
    : ''

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40 animate-fade-in"
        onClick={onClose}
      />

      {/* Slide-over Panel */}
      <div
        ref={panelRef}
        className="fixed top-0 right-0 h-full w-[420px] max-w-full bg-white shadow-2xl z-50 flex flex-col overflow-hidden"
        style={{ animation: 'slideInRight 0.25s ease-out' }}
      >
        {loading || !job ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-[#e04d1c]" />
          </div>
        ) : (
          <>
            {/* ── Header ── */}
            <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between bg-stone-50/50 shrink-0">
              <div className="flex items-center gap-3">
                <span className="text-xl">{prof?.emoji ?? '📋'}</span>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-bold text-stone-800">
                      {prof ? (he ? prof.he : prof.en) : (he ? 'עבודה' : 'Job')}
                    </h2>
                    <StatusBadge status={job.status} he={he} />
                  </div>
                  {location && (
                    <p className="text-[11px] text-stone-400 flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3 h-3" />
                      {location}
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-xl hover:bg-stone-100 text-stone-400 hover:text-stone-600 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* ── Scrollable Body ── */}
            <div className="flex-1 overflow-y-auto">
              {/* Customer Info (editable) */}
              <div className="px-6 py-5 border-b border-stone-100">
                <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider mb-3">
                  {he ? 'פרטי לקוח' : 'Customer Info'}
                </p>
                <div className="space-y-3">
                  <div>
                    <label className="text-[11px] font-medium text-stone-500 mb-1 block">
                      {he ? 'שם הלקוח' : 'Customer Name'}
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-400" />
                      <input
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder={he ? 'הזן שם...' : 'Enter name...'}
                        className="w-full h-9 pl-9 pr-3 rounded-lg border border-stone-200 bg-white text-sm focus:border-[#fe5b25] focus:ring-1 focus:ring-[#fe5b25] outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-stone-500 mb-1 block">
                      {he ? 'כתובת' : 'Address'}
                    </label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-400" />
                      <input
                        value={customerAddress}
                        onChange={(e) => setCustomerAddress(e.target.value)}
                        placeholder={he ? 'הזן כתובת...' : 'Enter address...'}
                        className="w-full h-9 pl-9 pr-3 rounded-lg border border-stone-200 bg-white text-sm focus:border-[#fe5b25] focus:ring-1 focus:ring-[#fe5b25] outline-none"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-medium text-stone-500 mb-1 block">
                        {he ? 'תאריך מתוכנן' : 'Scheduled Date'}
                      </label>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-400" />
                        <input
                          type="date"
                          value={scheduledDate}
                          onChange={(e) => setScheduledDate(e.target.value)}
                          className="w-full h-9 pl-9 pr-2 rounded-lg border border-stone-200 bg-white text-sm focus:border-[#fe5b25] focus:ring-1 focus:ring-[#fe5b25] outline-none"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-[11px] font-medium text-stone-500 mb-1 block">
                        {he ? 'סכום העבודה' : 'Job Amount'}
                      </label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-400" />
                        <input
                          type="number"
                          value={jobAmount}
                          onChange={(e) => setJobAmount(e.target.value)}
                          placeholder="0"
                          className="w-full h-9 pl-9 pr-3 rounded-lg border border-stone-200 bg-white text-sm focus:border-[#fe5b25] focus:ring-1 focus:ring-[#fe5b25] outline-none"
                        />
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={handleSaveCustomerInfo}
                    disabled={saving}
                    className="flex items-center gap-1.5 px-4 py-2 bg-[#fe5b25] hover:bg-[#e04d1c] text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-50 w-full justify-center"
                  >
                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    {he ? 'שמור' : 'Save'}
                  </button>
                </div>
              </div>

              {/* Deal Terms (read-only) */}
              <div className="px-6 py-5 border-b border-stone-100">
                <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider mb-3">
                  {he ? 'תנאי עסקה' : 'Deal Terms'}
                </p>
                <div className="flex items-center gap-3 p-3 rounded-xl bg-stone-50 border border-stone-100">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#fee8df] to-[#fff4ef] flex items-center justify-center border border-[#fdd5c5] shrink-0">
                    <User className="w-4 h-4 text-[#e04d1c]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-stone-800">{job.sub_name}</p>
                    <div className="flex items-center gap-1 text-[11px] text-stone-400 mt-0.5">
                      <Phone className="w-3 h-3" />
                      {job.sub_phone}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-[#e04d1c]">{dealLabel}</p>
                  </div>
                </div>
                {job.lead_summary && (
                  <p className="mt-3 text-xs text-stone-500 leading-relaxed line-clamp-3">
                    {job.lead_summary}
                  </p>
                )}
              </div>

              {/* Actions */}
              <div className="px-6 py-4 border-b border-stone-100">
                <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider mb-3">
                  {he ? 'פעולות' : 'Actions'}
                </p>
                <div className="flex flex-wrap gap-2">
                  {job.status === 'accepted' && (
                    <button
                      onClick={handleMarkCompleted}
                      disabled={completing}
                      className="flex items-center gap-1.5 px-3 py-2 bg-[#fe5b25] hover:bg-[#e04d1c] text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-50"
                    >
                      {completing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trophy className="w-3.5 h-3.5" />}
                      {he ? 'סמן כהושלם' : 'Mark Completed'}
                    </button>
                  )}

                  {job.status === 'completed' && job.payment_status !== 'paid' && (
                    <button
                      onClick={() => setShowPaymentForm(true)}
                      className="flex items-center gap-1.5 px-3 py-2 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded-lg transition-colors"
                    >
                      <CreditCard className="w-3.5 h-3.5" />
                      {he ? 'רשום תשלום' : 'Record Payment'}
                    </button>
                  )}

                  {job.status === 'rejected' && (
                    <button
                      onClick={() => toast({ title: he ? 'העבר מחדש' : 'Re-assign', description: he ? 'חזור לעמוד הלידים כדי להעביר מחדש' : 'Go to Leads page to re-assign this lead' })}
                      className="flex items-center gap-1.5 px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-lg transition-colors"
                    >
                      <Send className="w-3.5 h-3.5" />
                      {he ? 'העבר מחדש' : 'Re-assign'}
                    </button>
                  )}

                  <button
                    onClick={() => setShowNoteForm(true)}
                    className="flex items-center gap-1.5 px-3 py-2 bg-white border border-stone-200 text-stone-600 hover:bg-stone-50 text-xs font-bold rounded-lg transition-colors"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    {he ? 'הוסף הערה' : 'Add Note'}
                  </button>

                  <button
                    onClick={handleSendReminder}
                    className="flex items-center gap-1.5 px-3 py-2 bg-white border border-stone-200 text-stone-600 hover:bg-stone-50 text-xs font-bold rounded-lg transition-colors"
                  >
                    <Bell className="w-3.5 h-3.5" />
                    {he ? 'שלח תזכורת' : 'Send Reminder'}
                  </button>
                </div>

                {/* Inline Payment Form */}
                {showPaymentForm && (
                  <div className="mt-3 p-3 rounded-xl border border-green-200 bg-green-50/50 space-y-2 animate-fade-in">
                    <label className="text-[11px] font-bold text-green-700">
                      {he ? 'סכום שהתקבל ($)' : 'Amount Received ($)'}
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        value={paymentAmount}
                        onChange={(e) => setPaymentAmount(e.target.value)}
                        placeholder="0.00"
                        className="flex-1 h-9 px-3 rounded-lg border border-green-200 bg-white text-sm focus:border-green-500 focus:ring-1 focus:ring-green-500 outline-none"
                        autoFocus
                      />
                      <button
                        onClick={handleRecordPayment}
                        disabled={recordingPayment || !paymentAmount}
                        className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded-lg disabled:opacity-50 transition-colors"
                      >
                        {recordingPayment ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : (he ? 'אשר' : 'Confirm')}
                      </button>
                      <button
                        onClick={() => { setShowPaymentForm(false); setPaymentAmount('') }}
                        className="px-2 py-2 text-stone-400 hover:text-stone-600 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Inline Note Form */}
                {showNoteForm && (
                  <div className="mt-3 p-3 rounded-xl border border-stone-200 bg-stone-50/50 space-y-2 animate-fade-in">
                    <label className="text-[11px] font-bold text-stone-600">
                      {he ? 'הערה' : 'Note'}
                    </label>
                    <div className="flex gap-2">
                      <textarea
                        value={noteText}
                        onChange={(e) => setNoteText(e.target.value)}
                        placeholder={he ? 'כתוב הערה...' : 'Write a note...'}
                        className="flex-1 min-h-[60px] px-3 py-2 rounded-lg border border-stone-200 bg-white text-sm focus:border-[#fe5b25] focus:ring-1 focus:ring-[#fe5b25] outline-none resize-none"
                        autoFocus
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => { setShowNoteForm(false); setNoteText('') }}
                        className="px-3 py-1.5 text-xs text-stone-500 hover:text-stone-700 transition-colors"
                      >
                        {he ? 'ביטול' : 'Cancel'}
                      </button>
                      <button
                        onClick={handleAddNote}
                        disabled={addingNote || !noteText.trim()}
                        className="px-4 py-1.5 bg-[#fe5b25] hover:bg-[#e04d1c] text-white text-xs font-bold rounded-lg disabled:opacity-50 transition-colors"
                      >
                        {addingNote ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : (he ? 'הוסף' : 'Add')}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Timeline */}
              <div className="px-6 py-5">
                <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider mb-4">
                  {he ? 'היסטוריה' : 'Timeline'}
                </p>
                {events.length === 0 ? (
                  <p className="text-xs text-stone-400 text-center py-4">
                    {he ? 'אין אירועים עדיין' : 'No events yet'}
                  </p>
                ) : (
                  <div className="space-y-0">
                    {events.map((event, idx) => {
                      const Icon = EVENT_ICONS[event.event_type] || MessageSquare
                      const isLast = idx === events.length - 1
                      return (
                        <div key={event.id} className="flex gap-3 relative">
                          {/* Connector line */}
                          {!isLast && (
                            <div className="absolute left-[13px] top-8 bottom-0 w-px bg-stone-200" />
                          )}
                          {/* Icon */}
                          <div className="w-7 h-7 rounded-full bg-stone-100 border border-stone-200 flex items-center justify-center shrink-0 z-10">
                            <Icon className="w-3.5 h-3.5 text-stone-500" />
                          </div>
                          {/* Content */}
                          <div className="pb-4 flex-1 min-w-0">
                            <p className="text-xs text-stone-700 font-medium leading-relaxed">
                              {event.description || event.event_type}
                            </p>
                            <p className="text-[10px] text-stone-400 mt-0.5">
                              {timeAgo(event.created_at)}
                            </p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Slide-in keyframes */}
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </>
  )
}
