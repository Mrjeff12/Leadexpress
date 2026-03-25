import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../lib/auth'
import { useI18n } from '../lib/i18n'
import { supabase } from '../lib/supabase'
import { PROFESSIONS } from '../lib/professions'
import { formatDate } from '../lib/shared'
import { useToast } from '../components/hooks/use-toast'
import { Link } from 'react-router-dom'
import {
  Briefcase,
  Activity,
  CheckCircle2,
  DollarSign,
  Search,
  ArrowRight,
  Loader2,
  AlertCircle,
  Radio,
  Users,
  Clock,
  ExternalLink,
} from 'lucide-react'
import JobDetailPanel from '../components/JobDetailPanel'
import BroadcastResponsesPanel from '../components/BroadcastResponsesPanel'
import { useSubscriptionAccess } from '../hooks/useSubscriptionAccess'
import FeatureTeaser from '../components/FeatureTeaser'
import { SubcontractorDemo, DEMO_DURATION_FRAMES, DEMO_FPS, DEMO_WIDTH, DEMO_HEIGHT } from '../remotion/SubcontractorDemo'

/* ───────────────── Types ───────────────── */

interface JobOrder {
  id: string
  lead_id: string | null
  subcontractor_id: string | null
  deal_type: string
  deal_value: string
  status: string
  payment_status: string | null
  payment_amount: number | null
  payment_due_at: string | null
  job_amount: number | null
  customer_name: string | null
  customer_address: string | null
  scheduled_date: string | null
  notes: string | null
  created_at: string
  updated_at: string | null
  completed_at: string | null
  // Joined
  sub_name: string
  sub_phone: string
  lead_profession: string | null
  lead_city: string | null
  lead_zip: string | null
  lead_summary: string | null
}

type FilterTab = 'all' | 'pending' | 'active' | 'completed' | 'overdue'
type MainView = 'jobs' | 'broadcasts'

interface Broadcast {
  id: string
  lead_id: string
  deal_type: string
  deal_value: string
  description: string | null
  status: string
  sent_count: number
  expires_at: string
  created_at: string
  leads?: { profession: string; city: string | null; zip_code: string | null; parsed_summary: string | null }
  response_count?: number
}

/* ───────────────── Helpers ───────────────── */

const profLookup = Object.fromEntries(PROFESSIONS.map((p) => [p.id, p]))

function formatCurrency(amount: number | null | undefined): string {
  if (amount == null) return '$0'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount)
}

function isOverdue(job: JobOrder): boolean {
  if (!job.payment_due_at) return false
  if (job.payment_status === 'paid') return false
  return new Date(job.payment_due_at) < new Date()
}

function dealLabel(type: string, value: string): string {
  if (type === 'percentage') return `${value}%`
  if (type === 'fixed_price') return `$${value}`
  return value
}

/* ───────────────── Status & Payment Badges ───────────────── */

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
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${c.cls}`}>
      {he ? c.labelHe : c.label}
    </span>
  )
}

function PaymentBadge({ status, overdue, he }: { status: string | null; overdue: boolean; he: boolean }) {
  if (overdue) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-600 border border-red-200 animate-pulse">
        {he ? 'באיחור' : 'Overdue'}
      </span>
    )
  }
  const config: Record<string, { label: string; labelHe: string; cls: string }> = {
    paid:    { label: 'Paid',    labelHe: 'שולם',      cls: 'bg-green-50 text-green-700 border-green-200' },
    partial: { label: 'Partial', labelHe: 'חלקי',      cls: 'bg-amber-50 text-amber-700 border-amber-200' },
    unpaid:  { label: 'Unpaid',  labelHe: 'לא שולם',   cls: 'bg-stone-100 text-stone-500 border-stone-200' },
  }
  const c = config[status || 'unpaid'] || config.unpaid
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${c.cls}`}>
      {he ? c.labelHe : c.label}
    </span>
  )
}

/* ───────────────── Component ───────────────── */

export default function JobsDashboard() {
  const { effectiveUserId } = useAuth()
  const { locale } = useI18n()
  const { toast } = useToast()

  const he = locale === 'he'

  const [jobs, setJobs] = useState<JobOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState<FilterTab>('all')
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)
  const [mainView, setMainView] = useState<MainView>('jobs')
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([])
  const [broadcastsLoading, setBroadcastsLoading] = useState(false)
  const [selectedBroadcast, setSelectedBroadcast] = useState<Broadcast | null>(null)

  /* ── Fetch ── */
  const fetchJobs = useCallback(async (showLoading = true) => {
    if (!effectiveUserId) return
    if (showLoading) setLoading(true)

    try {
      const { data, error } = await supabase
        .from('job_orders')
        .select('*, subcontractors ( full_name, phone ), leads ( profession, city, zip_code, parsed_summary )')
        .eq('contractor_id', effectiveUserId)
        .order('created_at', { ascending: false })

      if (error) throw error

      const mapped: JobOrder[] = (data || []).map((row: any) => ({
        id: row.id,
        lead_id: row.lead_id,
        subcontractor_id: row.subcontractor_id,
        deal_type: row.deal_type,
        deal_value: row.deal_value,
        status: row.status,
        payment_status: row.payment_status,
        payment_amount: row.payment_amount,
        payment_due_at: row.payment_due_at,
        job_amount: row.job_amount,
        customer_name: row.customer_name,
        customer_address: row.customer_address,
        scheduled_date: row.scheduled_date,
        notes: row.notes,
        created_at: row.created_at,
        updated_at: row.updated_at,
        completed_at: row.completed_at,
        sub_name: row.subcontractors?.full_name || 'Unknown',
        sub_phone: row.subcontractors?.phone || '',
        lead_profession: row.leads?.profession || null,
        lead_city: row.leads?.city || null,
        lead_zip: row.leads?.zip_code || null,
        lead_summary: row.leads?.parsed_summary || null,
      }))

      setJobs(mapped)
    } catch (err: unknown) {
      toast({ title: 'Error', description: 'Failed to load jobs', variant: 'destructive' })
    } finally {
      if (showLoading) setLoading(false)
    }
  }, [effectiveUserId, toast])

  useEffect(() => {
    fetchJobs()
  }, [fetchJobs])

  const refetch = () => fetchJobs(false)

  /* ── Fetch Broadcasts ── */
  const fetchBroadcasts = useCallback(async () => {
    if (!effectiveUserId) return
    setBroadcastsLoading(true)
    try {
      const { data, error } = await supabase
        .from('job_broadcasts')
        .select('*, leads(profession, city, zip_code, parsed_summary)')
        .eq('publisher_id', effectiveUserId)
        .order('created_at', { ascending: false })

      if (error) throw error

      // Get response counts
      const broadcastsWithCounts = await Promise.all(
        (data || []).map(async (b: any) => {
          const { count } = await supabase
            .from('job_broadcast_responses')
            .select('*', { count: 'exact', head: true })
            .eq('broadcast_id', b.id)
            .eq('status', 'interested')
          return { ...b, response_count: count || 0 }
        })
      )

      setBroadcasts(broadcastsWithCounts)
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to load broadcasts', variant: 'destructive' })
    } finally {
      setBroadcastsLoading(false)
    }
  }, [effectiveUserId, toast])

  useEffect(() => {
    if (mainView === 'broadcasts') fetchBroadcasts()
  }, [mainView, fetchBroadcasts])

  const handleChooseContractor = async (broadcastId: string, contractorId: string) => {
    const { data: result, error } = await supabase.rpc('choose_contractor_for_broadcast', {
      p_broadcast_id: broadcastId,
      p_contractor_id: contractorId,
    })
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
      return
    }
    toast({ title: he ? 'נבחר!' : 'Contractor chosen!', description: he ? 'הזמנת עבודה נוצרה' : 'Job order created' })

    // Send WhatsApp notifications (fire-and-forget)
    const rpcResult = result as { closed_contractor_ids?: string[]; chosen_contractor_id?: string; broadcast_id?: string } | null
    if (rpcResult) {
      // Notify chosen contractor
      supabase.functions.invoke('broadcast-job', {
        body: { action: 'notify_chosen', contractor_id: contractorId, broadcast_id: broadcastId },
      }).catch(console.warn)

      // Notify closed contractors
      const closedIds = rpcResult.closed_contractor_ids || []
      if (closedIds.length > 0) {
        supabase.functions.invoke('broadcast-job', {
          body: { action: 'notify_closed', contractor_ids: closedIds },
        }).catch(console.warn)
      }
    }

    setSelectedBroadcast(null)
    fetchBroadcasts()
    fetchJobs(false)
  }

  const { canManageSubs, loading: subsLoading } = useSubscriptionAccess()

  if (subsLoading) return null
  if (!canManageSubs) {
    return (
      <FeatureTeaser
        videoComponent={SubcontractorDemo}
        durationInFrames={DEMO_DURATION_FRAMES}
        fps={DEMO_FPS}
        compositionWidth={DEMO_WIDTH}
        compositionHeight={DEMO_HEIGHT}
        featureName="Jobs CRM Dashboard"
        price={399}
        planName="Unlimited"
      >
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: 'Active Jobs', value: '8', color: 'bg-blue-50 text-blue-600' },
              { label: 'Completed', value: '24', color: 'bg-green-50 text-green-600' },
              { label: 'Revenue', value: '$12,400', color: 'bg-orange-50 text-orange-600' },
              { label: 'Overdue', value: '2', color: 'bg-red-50 text-red-600' },
            ].map((s) => (
              <div key={s.label} className={`rounded-2xl p-4 ${s.color}`}>
                <div className="text-2xl font-bold">{s.value}</div>
                <div className="text-xs opacity-60">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </FeatureTeaser>
    )
  }

  /* ── KPIs ── */
  const totalJobs = jobs.length
  const activeJobs = jobs.filter((j) => j.status === 'pending' || j.status === 'accepted').length
  const completedJobs = jobs.filter((j) => j.status === 'completed').length
  const outstandingAmount = jobs
    .filter((j) => j.payment_status !== 'paid')
    .reduce((sum, j) => sum + (j.job_amount || 0), 0)

  /* ── Filtering ── */
  const filteredJobs = jobs.filter((job) => {
    // Tab filter
    if (activeTab === 'pending' && job.status !== 'pending') return false
    if (activeTab === 'active' && job.status !== 'accepted') return false
    if (activeTab === 'completed' && job.status !== 'completed') return false
    if (activeTab === 'overdue' && !isOverdue(job)) return false

    // Search
    if (search) {
      const q = search.toLowerCase()
      const matchesName = job.sub_name.toLowerCase().includes(q)
      const matchesCity = (job.lead_city || '').toLowerCase().includes(q)
      const matchesCustomer = (job.customer_name || '').toLowerCase().includes(q)
      const matchesProf = (job.lead_profession || '').toLowerCase().includes(q)
      if (!matchesName && !matchesCity && !matchesCustomer && !matchesProf) return false
    }

    return true
  })

  /* ── Tab definitions ── */
  const tabs: { id: FilterTab; label: string; labelHe: string }[] = [
    { id: 'all',       label: 'All',       labelHe: 'הכל' },
    { id: 'pending',   label: 'Pending',   labelHe: 'ממתינים' },
    { id: 'active',    label: 'Active',    labelHe: 'פעילים' },
    { id: 'completed', label: 'Completed', labelHe: 'הושלמו' },
    { id: 'overdue',   label: 'Overdue',   labelHe: 'באיחור' },
  ]

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold" style={{ color: 'hsl(40 8% 10%)' }}>
          {he ? 'ניהול עבודות' : 'Jobs Dashboard'}
        </h1>
        <p className="text-sm mt-1" style={{ color: 'hsl(40 4% 42%)' }}>
          {he ? 'מעקב אחר עבודות שהועברו לקבלני משנה' : 'Track forwarded jobs to subcontractors'}
        </p>
      </div>

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: he ? 'סה"כ עבודות' : 'Total Jobs',
            value: totalJobs,
            icon: Briefcase,
            format: (v: number) => String(v),
          },
          {
            label: he ? 'פעילים' : 'Active',
            value: activeJobs,
            icon: Activity,
            format: (v: number) => String(v),
          },
          {
            label: he ? 'הושלמו' : 'Completed',
            value: completedJobs,
            icon: CheckCircle2,
            format: (v: number) => String(v),
          },
          {
            label: he ? 'חוב פתוח' : 'Outstanding',
            value: outstandingAmount,
            icon: DollarSign,
            format: (v: number) => formatCurrency(v),
          },
        ].map((card) => (
          <div key={card.label} className="glass-panel p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'hsl(40 4% 42%)' }}>
                {card.label}
              </span>
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#fff4ef] to-[#fee8df] flex items-center justify-center border border-[#fdd5c5]">
                <card.icon className="w-4 h-4 text-[#e04d1c]" />
              </div>
            </div>
            <p className="text-2xl font-extrabold tracking-tight" style={{ color: 'hsl(40 8% 10%)' }}>
              {card.format(card.value)}
            </p>
          </div>
        ))}
      </div>

      {/* ── Main View Toggle: Jobs / Broadcasts ── */}
      <div className="flex items-center gap-2">
        {[
          { id: 'jobs' as MainView, label: he ? 'עבודות' : 'Jobs', icon: Briefcase },
          { id: 'broadcasts' as MainView, label: he ? 'פרסומים' : 'Broadcasts', icon: Radio },
        ].map((v) => (
          <button
            key={v.id}
            onClick={() => setMainView(v.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
              mainView === v.id
                ? 'bg-[#fff4ef] text-[#c43d10] border border-[#fdd5c5]'
                : 'bg-white text-stone-500 hover:bg-stone-50 border border-stone-200'
            }`}
          >
            <v.icon className="w-4 h-4" />
            {v.label}
          </button>
        ))}
      </div>

      {mainView === 'broadcasts' ? (
        /* ── Broadcasts View ── */
        <div className="space-y-4">
          {broadcastsLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 animate-spin text-[#e04d1c]" />
            </div>
          ) : broadcasts.length === 0 ? (
            <div className="glass-panel p-12 text-center">
              <Radio className="w-10 h-10 mx-auto mb-3 text-stone-300" />
              <p className="text-sm font-medium text-stone-700 mb-1">
                {he ? 'אין פרסומים עדיין' : 'No broadcasts yet'}
              </p>
              <p className="text-xs text-stone-400">
                {he ? 'פרסם עבודה מעמוד הלידים' : 'Broadcast a job from the Leads page'}
              </p>
            </div>
          ) : (
            <div className="grid gap-3">
              {broadcasts.map((b) => {
                const lead = b.leads as any
                const prof = lead?.profession ? profLookup[lead.profession] : null
                const location = [lead?.city, lead?.zip_code].filter(Boolean).join(', ') || '—'
                const isExpired = b.status === 'open' && new Date(b.expires_at) < new Date()
                const timeLeft = b.status === 'open' && !isExpired
                  ? Math.max(0, Math.round((new Date(b.expires_at).getTime() - Date.now()) / 3600000))
                  : 0

                const statusConfig: Record<string, { label: string; labelHe: string; cls: string }> = {
                  open:     { label: 'Open',     labelHe: 'פתוח',  cls: 'bg-green-50 text-green-700 border-green-200' },
                  assigned: { label: 'Assigned', labelHe: 'הועבר', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
                  closed:   { label: 'Closed',   labelHe: 'נסגר',  cls: 'bg-stone-100 text-stone-500 border-stone-200' },
                  expired:  { label: 'Expired',  labelHe: 'פג תוקף', cls: 'bg-red-50 text-red-600 border-red-200' },
                }
                const st = statusConfig[isExpired ? 'expired' : b.status] || statusConfig.open

                return (
                  <div
                    key={b.id}
                    onClick={() => setSelectedBroadcast(b)}
                    className="glass-panel p-4 hover:bg-stone-50/50 transition-colors cursor-pointer"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{prof?.emoji ?? '📋'}</span>
                        <div>
                          <p className="font-bold text-stone-800 text-sm">
                            {prof ? (he ? prof.he : prof.en) : (lead?.profession || (he ? 'עבודה' : 'Job'))}
                          </p>
                          <p className="text-xs text-stone-400">{location}</p>
                          {b.description && (
                            <p className="text-xs text-stone-500 mt-1 line-clamp-1">{b.description}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${st.cls}`}>
                          {he ? st.labelHe : st.label}
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center gap-4 text-xs text-stone-400">
                      <span className="flex items-center gap-1">
                        <Radio className="w-3 h-3" />
                        {he ? `נשלח ל-${b.sent_count}` : `Sent to ${b.sent_count}`}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        <span className={b.response_count ? 'text-[#e04d1c] font-bold' : ''}>
                          {b.response_count || 0} {he ? 'מעוניינים' : 'interested'}
                        </span>
                      </span>
                      <span className="flex items-center gap-1 font-mono">
                        {dealLabel(b.deal_type, b.deal_value)}
                      </span>
                      {timeLeft > 0 && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {timeLeft}h {he ? 'נשאר' : 'left'}
                        </span>
                      )}
                      <span className="ml-auto text-stone-300">
                        {formatDate(b.created_at)}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Broadcast Responses Panel */}
          {selectedBroadcast && (
            <BroadcastResponsesPanel
              broadcast={{
                ...selectedBroadcast,
                lead: selectedBroadcast.leads as any,
              }}
              isOpen={!!selectedBroadcast}
              onClose={() => setSelectedBroadcast(null)}
              onChoose={handleChooseContractor}
            />
          )}
        </div>
      ) : (
      <>
      {/* ── Filter Tabs + Search ── */}
      <div className="glass-panel p-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 flex-wrap">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === tab.id
                  ? 'bg-[#fff4ef] text-[#c43d10] border border-[#fdd5c5]'
                  : 'text-stone-500 hover:bg-stone-50 border border-transparent'
              }`}
            >
              {he ? tab.labelHe : tab.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 flex-1 min-w-[180px] ml-auto">
          <Search className="w-4 h-4 shrink-0" style={{ color: 'hsl(40 4% 42%)' }} />
          <input
            type="text"
            placeholder={he ? 'חיפוש...' : 'Search...'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent border-0 text-sm outline-none"
            style={{ color: 'hsl(40 8% 10%)' }}
          />
        </div>
      </div>

      {/* ── Job List ── */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-[#e04d1c]" />
        </div>
      ) : filteredJobs.length === 0 && jobs.length === 0 ? (
        /* Empty state — no jobs at all */
        <div className="glass-panel p-12 text-center">
          <Briefcase className="w-10 h-10 mx-auto mb-3" style={{ color: 'hsl(40 4% 42%)' }} />
          <p className="text-sm font-medium mb-1" style={{ color: 'hsl(40 8% 10%)' }}>
            {he ? 'אין עבודות עדיין' : 'No jobs yet'}
          </p>
          <p className="text-xs mb-4" style={{ color: 'hsl(40 4% 42%)' }}>
            {he ? 'העבר ליד ראשון כדי להתחיל' : 'Forward your first lead to get started'}
          </p>
          <Link
            to="/leads"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#fe5b25] hover:bg-[#e04d1c] text-white text-sm font-medium rounded-xl transition-colors"
          >
            {he ? 'לידים' : 'Go to Leads'}
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      ) : filteredJobs.length === 0 ? (
        /* No results for current filter */
        <div className="glass-panel p-12 text-center">
          <AlertCircle className="w-8 h-8 mx-auto mb-3" style={{ color: 'hsl(40 4% 42%)' }} />
          <p className="text-sm" style={{ color: 'hsl(40 4% 42%)' }}>
            {he ? 'לא נמצאו עבודות לפילטר הנוכחי' : 'No jobs match the current filter'}
          </p>
        </div>
      ) : (
        <div className="glass-panel overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-100 text-xs text-stone-400 uppercase tracking-wider">
                <th className="text-left px-4 py-3 font-medium">{he ? 'עבודה' : 'Job'}</th>
                <th className="text-left px-4 py-3 font-medium hidden md:table-cell">{he ? 'קבלן משנה' : 'Subcontractor'}</th>
                <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">{he ? 'עסקה' : 'Deal'}</th>
                <th className="text-right px-4 py-3 font-medium hidden sm:table-cell">{he ? 'סכום' : 'Amount'}</th>
                <th className="text-left px-4 py-3 font-medium">{he ? 'סטטוס' : 'Status'}</th>
                <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">{he ? 'תשלום' : 'Payment'}</th>
                <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">{he ? 'תאריך' : 'Date'}</th>
              </tr>
            </thead>
            <tbody>
              {filteredJobs.map((job) => {
                const prof = job.lead_profession ? profLookup[job.lead_profession] : null
                const location = [job.lead_city, job.lead_zip].filter(Boolean).join(', ') || '—'
                const overdueFlag = isOverdue(job)

                return (
                  <tr
                    key={job.id}
                    onClick={() => setSelectedJobId(job.id)}
                    className="border-b border-stone-50 hover:bg-stone-50/50 transition-colors cursor-pointer"
                  >
                    {/* Job: profession emoji + location */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-base">{prof?.emoji ?? '📋'}</span>
                        <div>
                          <p className="font-medium text-stone-800 text-xs">
                            {prof ? (he ? prof.he : prof.en) : (job.lead_profession || (he ? 'עבודה' : 'Job'))}
                          </p>
                          <p className="text-[10px] text-stone-400">{location}</p>
                        </div>
                      </div>
                    </td>

                    {/* Subcontractor */}
                    <td className="px-4 py-3 hidden md:table-cell">
                      <p className="font-medium text-stone-700 text-xs">{job.sub_name}</p>
                    </td>

                    {/* Deal */}
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className="text-xs font-mono text-stone-600">{dealLabel(job.deal_type, job.deal_value)}</span>
                    </td>

                    {/* Amount */}
                    <td className="px-4 py-3 text-right hidden sm:table-cell">
                      <span className="text-xs font-bold text-stone-700">
                        {job.job_amount ? formatCurrency(job.job_amount) : '—'}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      <StatusBadge status={job.status} he={he} />
                    </td>

                    {/* Payment */}
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <PaymentBadge status={job.payment_status} overdue={overdueFlag} he={he} />
                    </td>

                    {/* Date */}
                    <td className="px-4 py-3 text-xs text-stone-400 hidden lg:table-cell">
                      {formatDate(job.created_at)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Detail Panel ── */}
      {selectedJobId && (
        <JobDetailPanel
          jobId={selectedJobId}
          onClose={() => setSelectedJobId(null)}
          onUpdate={refetch}
        />
      )}
      </>
      )}
    </div>
  )
}
