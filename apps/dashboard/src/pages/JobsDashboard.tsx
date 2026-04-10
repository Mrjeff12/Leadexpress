import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from '../lib/auth'
import { useI18n } from '../lib/i18n'
import { supabase } from '../lib/supabase'
import { PROFESSIONS } from '../lib/professions'
import { PROFESSION_ICONS } from '../lib/profession-icons'
import { formatDate } from '../lib/shared'
import { useToast } from '../components/hooks/use-toast'
import { Link, useNavigate } from 'react-router-dom'
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
  Phone,
  Navigation,
  Plus,
  Send,
  ShieldCheck,
  BadgeCheck,
  Fingerprint,
} from 'lucide-react'
import { ResponsiveContainer, AreaChart, Area } from 'recharts'
import { useIdentityVerification } from '../hooks/useIdentityVerification'
import JobDetailPanel from '../components/JobDetailPanel'
import InviteSubModal from '../components/InviteSubModal'
import ForwardLeadModal from '../components/ForwardLeadModal'
import BroadcastResponsesPanel from '../components/BroadcastResponsesPanel'
import { useSubscriptionAccess } from '../hooks/useSubscriptionAccess'
import FeatureTeaser from '../components/FeatureTeaser'
import { SubcontractorDemo, DEMO_DURATION_FRAMES, DEMO_FPS, DEMO_WIDTH, DEMO_HEIGHT } from '../remotion/SubcontractorDemo'

/* ───────────────── Types ───────────────── */

interface JobOrder {
  id: string
  lead_id: string | null
  subcontractor_id: string | null
  contractor_id: string | null
  assigned_user_id: string | null
  publisher_user_id: string | null
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
  // Computed role: did I take this job or give it?
  my_role: 'took' | 'gave'
}

type FilterTab = 'all' | 'pending' | 'active' | 'completed' | 'overdue'
type MainView = 'took' | 'gave'

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
  if (value === 'TBD') return 'Custom'
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
  const [showInvite, setShowInvite] = useState(false)
  const nav = useNavigate()

  const he = locale === 'he'

  const [jobs, setJobs] = useState<JobOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState<FilterTab>('all')
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)
  const [mainView, setMainView] = useState<MainView>('took')
  const [pipelineStage, setPipelineStage] = useState<'all' | 'pending' | 'active' | 'completed'>('all')
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([])
  const [broadcastsLoading, setBroadcastsLoading] = useState(false)
  const [selectedBroadcast, setSelectedBroadcast] = useState<Broadcast | null>(null)
  const [pubProfile, setPubProfile] = useState<{ tier: string; avg_rating: number; review_count: number; jobs_completed: number } | null>(null)

  // Lead picker for "New Job"
  const [showLeadPicker, setShowLeadPicker] = useState(false)
  const [myLeads, setMyLeads] = useState<{ id: string; profession: string; city: string | null; zip_code: string | null; parsed_summary: string | null; raw_message: string | null }[]>([])
  const [leadsLoading, setLeadsLoading] = useState(false)
  const [selectedLead, setSelectedLead] = useState<{ id: string; profession: string; city: string | null; zip_code: string | null; parsed_summary: string | null; raw_message: string | null } | null>(null)
  const { isVerified: identityVerified } = useIdentityVerification()
  const { canManageSubs, loading: subsLoading } = useSubscriptionAccess()

  // Fetch publisher profile
  useEffect(() => {
    if (!effectiveUserId) return
    supabase
      .from('publisher_profiles')
      .select('tier, avg_rating, review_count, jobs_completed')
      .eq('user_id', effectiveUserId)
      .maybeSingle()
      .then(({ data }) => { if (data) setPubProfile(data as any) })
  }, [effectiveUserId])

  /* ── Fetch ── */
  const fetchJobs = useCallback(async (showLoading = true) => {
    if (!effectiveUserId) return
    if (showLoading) setLoading(true)

    try {
      // Fetch job orders where user is publisher OR receiver
      const { data, error } = await supabase
        .from('job_orders')
        .select('*, subcontractors ( full_name, phone )')
        .or(`contractor_id.eq.${effectiveUserId},assigned_user_id.eq.${effectiveUserId},publisher_user_id.eq.${effectiveUserId}`)
        .order('created_at', { ascending: false })

      if (error) throw error

      // Fetch lead data separately for the linked leads
      const leadIds = [...new Set((data || []).map((r: any) => r.lead_id).filter(Boolean))]
      let leadMap: Record<string, any> = {}
      if (leadIds.length > 0) {
        // Use SECURITY DEFINER RPC to avoid RLS circular dependency
        const results = await Promise.all(
          leadIds.map(id => supabase.rpc('get_lead_for_job', { p_lead_id: id }))
        )
        results.forEach((r, i) => {
          if (r.data?.[0]) leadMap[leadIds[i]] = r.data[0]
        })
      }

      const mapped: JobOrder[] = (data || []).map((row: any) => {
        const lead = row.lead_id ? leadMap[row.lead_id] : null
        // Determine role: if I'm the contractor_id or publisher_user_id → I GAVE the job
        // Otherwise (I'm assigned_user_id) → I TOOK the job
        const iAmPublisher = row.contractor_id === effectiveUserId || row.publisher_user_id === effectiveUserId
        const my_role: 'took' | 'gave' = iAmPublisher ? 'gave' : 'took'
        return {
          id: row.id,
          lead_id: row.lead_id,
          subcontractor_id: row.subcontractor_id,
          contractor_id: row.contractor_id,
          assigned_user_id: row.assigned_user_id,
          publisher_user_id: row.publisher_user_id,
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
          sub_name: row.subcontractors?.full_name || '',
          sub_phone: row.subcontractors?.phone || '',
          lead_profession: lead?.profession || null,
          lead_city: lead?.city || null,
          lead_zip: lead?.zip_code || null,
          lead_summary: lead?.parsed_summary || null,
          my_role,
        }
      })

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
      console.error('[Broadcasts]', err)
      toast({ title: 'Error', description: 'Failed to load broadcasts', variant: 'destructive' })
    } finally {
      setBroadcastsLoading(false)
    }
  }, [effectiveUserId, toast])

  // Note: broadcasts view removed from mobile — moved to leads page
  // Fetch my leads for the "New Job" picker
  const openLeadPicker = useCallback(async () => {
    if (!effectiveUserId) return
    setShowLeadPicker(true)
    setLeadsLoading(true)
    try {
      // Get leads I published or claimed, that don't have active job_orders yet
      const { data } = await supabase
        .from('leads')
        .select('id, profession, city, zip_code, parsed_summary, raw_message')
        .or(`claimed_by.eq.${effectiveUserId},source.eq.bot`)
        .order('created_at', { ascending: false })
        .limit(50)
      setMyLeads(data || [])
    } catch { /* silent */ }
    setLeadsLoading(false)
  }, [effectiveUserId])

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
      }).catch((e) => console.error('[JobsDashboard] Failed to notify chosen contractor:', e))

      // Notify closed contractors
      const closedIds = rpcResult.closed_contractor_ids || []
      if (closedIds.length > 0) {
        supabase.functions.invoke('broadcast-job', {
          body: { action: 'notify_closed', contractor_ids: closedIds },
        }).catch((e) => console.error('[JobsDashboard] Failed to notify closed contractors:', e))
      }
    }

    setSelectedBroadcast(null)
    fetchBroadcasts()
    fetchJobs(false)
  }

  /* ── KPIs ── */
  const totalJobs = jobs.length
  const activeJobs = jobs.filter((j) => j.status === 'pending' || j.status === 'accepted').length
  const completedJobs = jobs.filter((j) => j.status === 'completed').length
  const outstandingAmount = jobs
    .filter((j) => j.payment_status !== 'paid')
    .reduce((sum, j) => sum + (j.job_amount || 0), 0)

  /* ── Sparkline data (7 days) ── */
  const sparkData = useMemo(() => {
    const days = Array.from({ length: 7 }).map((_, i) => {
      const d = new Date()
      d.setDate(d.getDate() - (6 - i))
      return d.toLocaleDateString('en-CA')
    })
    const getCounts = (list: JobOrder[]) => {
      const map = list.reduce((acc, j) => {
        const date = new Date(j.created_at).toLocaleDateString('en-CA')
        acc[date] = (acc[date] || 0) + 1
        return acc
      }, {} as Record<string, number>)
      return days.map(d => ({ val: map[d] || 0 }))
    }
    return {
      all: getCounts(jobs),
      active: getCounts(jobs.filter(j => j.status === 'pending' || j.status === 'accepted')),
      completed: getCounts(jobs.filter(j => j.status === 'completed')),
    }
  }, [jobs])

  /* ── Per-role jobs (for counters) ── */
  const tookJobs = useMemo(() => jobs.filter(j => j.my_role === 'took'), [jobs])
  const gaveJobs = useMemo(() => jobs.filter(j => j.my_role === 'gave'), [jobs])
  const roleJobs = mainView === 'took' ? tookJobs : gaveJobs

  /* ── Pipeline counts for current role ── */
  const pipelineCounts = useMemo(() => ({
    pending: roleJobs.filter(j => j.status === 'pending').length,
    active: roleJobs.filter(j => j.status === 'accepted').length,
    completed: roleJobs.filter(j => j.status === 'completed').length,
  }), [roleJobs])

  /* ── Filtering (role + pipeline stage + search + legacy tab) ── */
  const filteredJobs = roleJobs.filter((job) => {
    // Pipeline stage filter
    if (pipelineStage === 'pending' && job.status !== 'pending') return false
    if (pipelineStage === 'active' && job.status !== 'accepted') return false
    if (pipelineStage === 'completed' && job.status !== 'completed') return false

    // Legacy tab filter
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

  const mobileEarned = jobs.filter(j => j.status === 'completed').reduce((s, j) => s + (j.job_amount || 0), 0)
  const jobSteps = ['Claimed', 'Driving', 'Working', 'Done']

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

  return (
    <div className="animate-fade-in">

      {/* ─── MOBILE (prototype-style) ─── */}
      <div className="md:hidden bg-white min-h-screen pb-28">
        <div className="px-5 pt-5 pb-6">

          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-[22px] font-bold tracking-tight">{he ? 'עבודות' : 'Jobs'}</h1>
            <button onClick={openLeadPicker}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-black text-white text-[11px] font-bold active:scale-[0.97] transition-transform">
              <Plus className="w-3.5 h-3.5" />
              {he ? 'עבודה חדשה' : 'New Job'}
            </button>
          </div>

          {/* Toggle: Took / Gave */}
          <div className="flex bg-stone-100 rounded-xl p-1 mb-3">
            <button onClick={() => { setMainView('took'); setPipelineStage('all') }}
              className={`flex-1 py-2.5 rounded-lg text-[13px] font-bold uppercase tracking-wider transition-all ${
                mainView === 'took' ? 'bg-[#fe5b25] text-white shadow-sm' : 'text-stone-500'
              }`}>
              {he ? 'לקחתי' : 'Took'} <span className="opacity-70 ml-1">{tookJobs.length}</span>
            </button>
            <button onClick={() => { setMainView('gave'); setPipelineStage('all') }}
              className={`flex-1 py-2.5 rounded-lg text-[13px] font-bold uppercase tracking-wider transition-all ${
                mainView === 'gave' ? 'bg-[#fe5b25] text-white shadow-sm' : 'text-stone-500'
              }`}>
              {he ? 'נתתי' : 'Gave'} <span className="opacity-70 ml-1">{gaveJobs.length}</span>
            </button>
          </div>

          {/* Pipeline: Pending / Active / Done with counts */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            {([
              { key: 'pending' as const,   label: he ? 'ממתין' : 'Pending',   count: pipelineCounts.pending },
              { key: 'active' as const,    label: he ? 'פעיל' : 'Active',     count: pipelineCounts.active },
              { key: 'completed' as const, label: he ? 'הושלם' : 'Done',      count: pipelineCounts.completed },
            ]).map(s => {
              const active = pipelineStage === s.key
              return (
                <button key={s.key}
                  onClick={() => setPipelineStage(active ? 'all' : s.key)}
                  className={`rounded-xl p-3 text-left transition-all ${active ? 'bg-black text-white' : 'bg-stone-50 text-black hover:bg-stone-100'}`}>
                  <div className="text-[9px] font-bold uppercase tracking-[0.15em] opacity-60">{s.label}</div>
                  <div className="text-[20px] font-light tracking-tight leading-none mt-1">{s.count}</div>
                </button>
              )
            })}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-[#fe5b25]" />
            </div>
          ) : (
            <>
              {/* Stats row */}
              <div className="flex items-center justify-between mb-3 px-0.5">
                <span className="text-[11px] text-[#737373]">{completedJobs} {he ? 'הושלמו' : 'completed'}</span>
                <span className="text-[13px] font-bold text-green-600">{formatCurrency(mobileEarned)} {he ? 'הכנסות' : 'earned'}</span>
              </div>

              {filteredJobs.length === 0 ? (
                <div className="text-center py-12">
                  <Briefcase className="w-10 h-10 mx-auto mb-3 text-[#d4d4d4]" />
                  <p className="text-sm font-medium text-[#111] mb-1">{he ? 'אין עבודות עדיין' : 'No jobs yet'}</p>
                  <p className="text-xs text-[#737373]">{he ? 'העבר ליד ראשון כדי להתחיל' : 'Forward your first lead to get started'}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredJobs.map((job) => {
                    const prof = job.lead_profession ? profLookup[job.lead_profession] : null
                    const isActive = job.status === 'accepted'
                    const isPending = job.status === 'pending'
                    const initials = job.sub_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
                    const currentStep = 1
                    return (
                      <div key={job.id} onClick={() => nav(`/jobs/${job.id}`)}
                        className={`bg-white rounded-[20px] border border-black/[0.04] shadow-sm overflow-hidden active:scale-[0.97] transition-transform cursor-pointer ${isActive || isPending ? 'ring-1 ring-[#fe5b25]/10' : ''}`}>
                        <div className="px-3.5 py-3 flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-[#fff4ef] flex items-center justify-center flex-shrink-0">
                            {job.lead_profession && PROFESSION_ICONS[job.lead_profession]
                              ? <span style={{ color: '#fe5b25', width: 18, height: 18, display: 'inline-flex' }} className="[&>svg]:w-[18px] [&>svg]:h-[18px]">{PROFESSION_ICONS[job.lead_profession]}</span>
                              : <Briefcase className="w-[18px] h-[18px]" style={{ color: '#fe5b25' }} />
                            }
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="text-[13px] font-semibold truncate">
                                {prof ? (he ? prof.he : prof.en) : (job.lead_profession || (he ? 'עבודה' : 'Job'))}
                              </p>
                              <span className={`text-[9px] font-semibold ${isActive ? 'text-[#fe5b25]' : isPending ? 'text-amber-500' : job.status === 'completed' ? 'text-green-600' : 'text-[#737373]'}`}>
                                {isActive ? (he ? 'פעיל' : 'Active') : isPending ? (he ? 'ממתין' : 'Pending') : job.status === 'completed' ? (he ? 'הושלם' : 'Done') : job.status}
                              </span>
                            </div>
                            <p className="text-[10px] text-[#737373]">
                              {job.sub_name || (he ? 'לא שויך' : 'Unassigned')} · {job.lead_city || '—'} · {job.scheduled_date ? formatDate(job.scheduled_date) : formatDate(job.created_at)}
                            </p>
                          </div>
                          <span className="text-[13px] font-bold text-green-600 flex-shrink-0">
                            {job.job_amount ? formatCurrency(job.job_amount) : dealLabel(job.deal_type, job.deal_value)}
                          </span>
                        </div>

                        {isActive && (
                          <div className="px-3.5 pb-3 pt-0">
                            <div className="flex gap-0.5 mb-1.5">
                              {jobSteps.map((_, si) => (
                                <div key={si} className={`h-[2px] flex-1 rounded-full ${si <= currentStep ? 'bg-[#fe5b25]' : 'bg-[#f5f5f5]'}`} />
                              ))}
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-[9px] text-[#fe5b25] font-semibold">{jobSteps[currentStep]}</span>
                              <div className="flex gap-1.5">
                                <a href={`tel:${job.sub_phone}`} onClick={e => e.stopPropagation()}
                                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-green-50 active:scale-[0.97] transition-transform">
                                  <Phone className="w-[9px] h-[9px] text-green-600" />
                                  <span className="text-[9px] font-semibold text-green-600">{he ? 'שיחה' : 'Call'}</span>
                                </a>
                                {job.customer_address && (
                                  <a href={`https://maps.google.com/?q=${encodeURIComponent(job.customer_address)}`}
                                    target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 active:scale-[0.97] transition-transform">
                                    <Navigation className="w-[9px] h-[9px] text-blue-500" />
                                    <span className="text-[9px] font-semibold text-blue-500">{he ? 'נווט' : 'Go'}</span>
                                  </a>
                                )}
                              </div>
                            </div>
                          </div>
                        )}

                        {isPending && (
                          <div className="px-3.5 pb-3 pt-0 flex gap-1.5">
                            <button onClick={e => { e.stopPropagation(); nav(`/jobs/${job.id}`) }}
                              className="flex-1 py-2 rounded-lg bg-green-50 text-green-600 text-[11px] font-semibold active:scale-[0.97] transition-transform text-center">
                              {he ? 'צפה' : 'View'}
                            </button>
                            <button onClick={e => { e.stopPropagation(); setSelectedJobId(job.id) }}
                              className="flex-1 py-2 rounded-lg bg-[#fff4f0] text-[#fe5b25] text-[11px] font-semibold active:scale-[0.97] transition-transform text-center">
                              {he ? 'פרטים' : 'Details'}
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ─── DESKTOP ─── */}
      <div className="hidden md:block space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold" style={{ color: 'hsl(40 8% 10%)' }}>
          {he ? 'העבודות שלי' : 'My Jobs'}
        </h1>
        <p className="text-sm mt-1" style={{ color: 'hsl(40 4% 42%)' }}>
          {he ? 'עבודות ופרסומים שלי' : 'Jobs & posts you manage'}
        </p>
      </div>

      {/* ── Summary Cards with Sparklines ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { key: 'total', label: he ? 'סה"כ' : 'Total Jobs', value: totalJobs, icon: Briefcase, color: '#fe5b25', data: sparkData.all, format: String },
          { key: 'active', label: he ? 'פעילים' : 'Active', value: activeJobs, icon: Activity, color: '#f59e0b', data: sparkData.active, format: String },
          { key: 'completed', label: he ? 'הושלמו' : 'Completed', value: completedJobs, icon: CheckCircle2, color: '#10b981', data: sparkData.completed, format: String },
          { key: 'outstanding', label: he ? 'חוב פתוח' : 'Outstanding', value: outstandingAmount, icon: DollarSign, color: '#ef4444', data: [] as {val:number}[], format: formatCurrency },
        ].map((card) => (
          <div key={card.key} className="glass-panel group relative overflow-hidden p-5 min-h-[140px] flex flex-col justify-between">
            <div className="flex items-start justify-between relative z-10">
              <div className="w-9 h-9 rounded-[12px] flex items-center justify-center" style={{ background: `${card.color}12`, color: card.color }}>
                <card.icon className="h-[18px] w-[18px]" strokeWidth={2} />
              </div>
            </div>
            <div className="mt-3 relative z-10">
              <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-stone-400 mb-1">{card.label}</div>
              <div className="text-2xl font-light tracking-tighter text-black">{card.format(card.value)}</div>
            </div>
            {card.data.length > 0 && (
              <div className="absolute bottom-0 left-0 right-0 h-10 opacity-20 group-hover:opacity-40 transition-opacity duration-500">
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                  <AreaChart data={card.data}>
                    <defs>
                      <linearGradient id={`spark-${card.key}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={card.color} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={card.color} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Area type="monotone" dataKey="val" stroke={card.color} strokeWidth={2} fillOpacity={1} fill={`url(#spark-${card.label})`} isAnimationActive />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── Main View Toggle: Jobs / Broadcasts ── */}
      <div className="flex items-center gap-2">
        {[
          { id: 'jobs' as MainView, label: he ? 'העבודות שלי' : 'My Jobs', icon: Briefcase },
          { id: 'broadcasts' as MainView, label: he ? 'הפרסומים שלי' : 'My Posts', icon: Radio },
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
                {he ? 'אין פרסומים עדיין' : 'No posts yet'}
              </p>
              <p className="text-xs text-stone-400">
                {he ? 'פרסם עבודה מעמוד הלידים' : 'Publish a lead to get started'}
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
      <div className="glass-panel p-4 flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 absolute top-1/2 -translate-y-1/2 text-stone-400" style={{ left: he ? 'auto' : 16, right: he ? 16 : 'auto' }} strokeWidth={2} />
          <input
            type="text"
            placeholder={he ? 'חפש עבודה, קבלן, עיר...' : 'Search jobs, contractors, cities...'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full text-sm rounded-2xl border-none px-6 py-3 outline-none transition-all bg-black/[0.03] focus:bg-black/[0.05] focus:ring-2 focus:ring-black/5"
            style={{ paddingLeft: he ? 16 : 44, paddingRight: he ? 44 : 16, color: '#000' }}
          />
        </div>
        <div className="flex gap-2 bg-black/[0.03] p-1.5 rounded-2xl">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`text-[10px] font-bold uppercase tracking-widest rounded-xl px-4 py-2.5 transition-all ${
                activeTab === tab.id ? 'bg-white text-black shadow-sm' : 'text-stone-400 hover:text-stone-600'
              }`}
            >
              {he ? tab.labelHe : tab.label}
            </button>
          ))}
        </div>
        <div className="px-4 py-2 rounded-xl bg-emerald-50 border border-emerald-100">
          <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">
            {filteredJobs.length} {he ? 'תוצאות' : 'Jobs'}
          </span>
        </div>
      </div>

      {/* ── Job List ── */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-[#e04d1c]" />
        </div>
      ) : filteredJobs.length === 0 && jobs.length === 0 ? (
        /* Empty state — no jobs at all */
        <div className="glass-panel py-24 flex flex-col items-center gap-5">
          <div className="w-16 h-16 rounded-[20px] bg-black/[0.03] flex items-center justify-center">
            <Briefcase className="w-7 h-7 text-stone-300" strokeWidth={1.5} />
          </div>
          <div className="text-center">
            <h3 className="text-lg font-light text-black mb-1">{he ? 'אין עבודות עדיין' : 'No jobs yet'}</h3>
            <p className="text-sm text-stone-400 font-medium">{he ? 'העבר ליד ראשון כדי להתחיל' : 'Forward your first lead to get started'}</p>
          </div>
          <Link
            to="/leads"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#fe5b25] hover:bg-[#e04d1c] text-white text-sm font-bold rounded-2xl transition-all hover:scale-[1.02] active:scale-[0.98]"
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
        <>
        {/* Desktop table */}
        <div className="hidden md:block glass-panel overflow-hidden">
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
                <th className="text-left px-4 py-3 font-medium hidden md:table-cell">{he ? 'פעולות' : 'Actions'}</th>
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
                    onClick={() => {
                      if (window.innerWidth < 768) {
                        nav(`/jobs/${job.id}`)
                      } else {
                        setSelectedJobId(job.id)
                      }
                    }}
                    className="border-b border-stone-50 hover:bg-stone-50/50 transition-colors cursor-pointer"
                  >
                    {/* Job: SVG icon + profession + location */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {job.lead_profession && PROFESSION_ICONS[job.lead_profession]
                          ? <span style={{ color: '#fe5b25', width: 20, height: 20, display: 'inline-flex', flexShrink: 0 }} className="[&>svg]:w-5 [&>svg]:h-5">{PROFESSION_ICONS[job.lead_profession]}</span>
                          : <Briefcase className="w-5 h-5 shrink-0" style={{ color: '#fe5b25' }} />
                        }
                        <div>
                          <p className="font-semibold text-stone-800 text-[13px]">
                            {prof ? (he ? prof.he : prof.en) : (job.lead_profession || (he ? 'עבודה' : 'Job'))}
                          </p>
                          <p className="text-[11px] text-stone-400">{location} {job.customer_name ? `· ${job.customer_name}` : ''}</p>
                        </div>
                      </div>
                    </td>

                    {/* Subcontractor */}
                    <td className="px-4 py-3 hidden md:table-cell">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-stone-100 flex items-center justify-center text-[10px] font-bold text-stone-500">
                          {job.sub_name ? job.sub_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() : '—'}
                        </div>
                        <p className={`font-medium text-xs ${job.sub_name ? 'text-stone-700' : 'text-stone-400'}`}>
                          {job.sub_name || (he ? 'לא שויך' : 'Unassigned')}
                        </p>
                      </div>
                    </td>

                    {/* Deal */}
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        job.deal_type === 'percentage' ? 'bg-purple-50 text-purple-700 border border-purple-200'
                        : job.deal_type === 'fixed_price' ? 'bg-blue-50 text-blue-700 border border-blue-200'
                        : 'bg-stone-50 text-stone-500 border border-stone-200'
                      }`}>
                        {job.deal_type && job.deal_value ? dealLabel(job.deal_type, job.deal_value) : (he ? 'לא הוגדר' : 'Not set')}
                      </span>
                    </td>

                    {/* Amount */}
                    <td className="px-4 py-3 text-right hidden sm:table-cell">
                      <span className="text-[13px] font-bold text-stone-800">
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

                    {/* Quick Actions — active jobs */}
                    <td className="px-4 py-3 hidden md:table-cell">
                      {job.status === 'accepted' && (
                        <div className="flex items-center gap-1.5">
                          <a href={`tel:${job.sub_phone}`} onClick={e => e.stopPropagation()}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-green-50 hover:bg-green-100 text-green-600 text-[10px] font-semibold transition-colors">
                            <Phone className="w-3 h-3" /> {he ? 'שיחה' : 'Call'}
                          </a>
                          {job.customer_address && (
                            <a href={`https://maps.google.com/?q=${encodeURIComponent(job.customer_address)}`}
                              target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-500 text-[10px] font-semibold transition-colors">
                              <Navigation className="w-3 h-3" /> {he ? 'נווט' : 'Go'}
                            </a>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        </>
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
      </div>{/* end hidden md:block */}

      {/* InviteSubModal — triggered from elsewhere if needed */}
      <InviteSubModal
        open={showInvite}
        onClose={() => setShowInvite(false)}
        onSuccess={() => toast({ title: 'Invite sent!', description: 'The sub-contractor will receive a WhatsApp link.' })}
      />

      {/* Lead Picker Bottom Sheet */}
      {showLeadPicker && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 animate-fade-in" onClick={() => setShowLeadPicker(false)}>
          <div className="bg-white w-full max-w-md rounded-t-[24px] sm:rounded-[24px] max-h-[70vh] overflow-hidden flex flex-col"
            onClick={e => e.stopPropagation()} style={{ fontFamily: 'Outfit, sans-serif' }}>
            <div className="px-6 pt-5 pb-3 flex items-center justify-between">
              <h2 className="text-[18px] font-light tracking-tight text-black">{he ? 'בחר ליד' : 'Choose a Lead'}</h2>
              <button onClick={() => setShowLeadPicker(false)} className="w-8 h-8 rounded-xl bg-stone-50 flex items-center justify-center">
                <span className="text-stone-500 text-lg">×</span>
              </button>
            </div>
            <p className="px-6 text-[11px] text-stone-400 mb-3">{he ? 'בחר ליד שברצונך להפוך לעבודה' : 'Pick a lead to turn into a job'}</p>
            <div className="px-6 pb-6 overflow-y-auto flex-1 space-y-2">
              {leadsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-[#fe5b25]" />
                </div>
              ) : myLeads.length === 0 ? (
                <div className="text-center py-12">
                  <Briefcase className="w-8 h-8 text-stone-200 mx-auto mb-2" strokeWidth={1} />
                  <p className="text-[12px] text-stone-400">{he ? 'אין לידים זמינים' : 'No leads available'}</p>
                  <button onClick={() => { setShowLeadPicker(false); nav('/leads') }}
                    className="mt-3 text-[12px] font-bold text-[#fe5b25]">{he ? 'עבור ללידים' : 'Go to Leads'}</button>
                </div>
              ) : (
                myLeads.map(lead => {
                  const prof = profLookup[lead.profession]
                  const icon = PROFESSION_ICONS[lead.profession]
                  const loc = [lead.city, lead.zip_code].filter(Boolean).join(', ')
                  return (
                    <button key={lead.id}
                      onClick={() => { setShowLeadPicker(false); setSelectedLead(lead) }}
                      className="w-full flex items-center gap-3 p-3 rounded-[14px] bg-stone-50 hover:bg-stone-100 active:scale-[0.98] transition-all text-left">
                      {icon
                        ? <span style={{ color: '#fe5b25', width: 20, height: 20, display: 'inline-flex', flexShrink: 0 }} className="[&>svg]:w-5 [&>svg]:h-5">{icon}</span>
                        : <Briefcase className="w-5 h-5 text-[#fe5b25] shrink-0" />
                      }
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold text-black truncate">
                          {prof ? (he ? prof.he : prof.en) : lead.profession}
                        </p>
                        <p className="text-[10px] text-stone-400 truncate">
                          {loc || (lead.parsed_summary?.slice(0, 40) || '—')}
                        </p>
                      </div>
                      <ArrowRight size={14} className="text-stone-300 shrink-0" />
                    </button>
                  )
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Forward Lead Modal — opened after picking a lead */}
      <ForwardLeadModal
        lead={selectedLead}
        isOpen={!!selectedLead}
        onClose={() => { setSelectedLead(null); fetchJobs(false) }}
      />
    </div>
  )
}
