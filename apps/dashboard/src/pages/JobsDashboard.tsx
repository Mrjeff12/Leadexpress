import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../lib/auth'
import { useI18n } from '../lib/i18n'
import { supabase } from '../lib/supabase'
import { PROFESSIONS } from '../lib/professions'
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
} from 'lucide-react'
import JobDetailPanel from '../components/JobDetailPanel'
import { useSubscriptionAccess } from '../hooks/useSubscriptionAccess'
import FeatureTeaser from '../components/FeatureTeaser'

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

/* ───────────────── Helpers ───────────────── */

const profLookup = Object.fromEntries(PROFESSIONS.map((p) => [p.id, p]))

function formatCurrency(amount: number | null | undefined): string {
  if (amount == null) return '$0'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount)
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
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

  const { canManageSubs } = useSubscriptionAccess()

  if (!canManageSubs) {
    const teaserSteps = [
      {
        title: 'Your Jobs Dashboard',
        subtitle: 'Track every forwarded job — status, payments, and sub performance at a glance.',
        duration: 5000,
        visual: (
          <div className="max-w-lg mx-auto space-y-3">
            {/* KPI cards — mirrors our real JobsDashboard */}
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: 'Total Jobs', value: '12', icon: '📋', bg: 'bg-gradient-to-br from-[#fff4ef] to-[#fee8df]', border: 'border-[#fdd5c5]' },
                { label: 'Active', value: '5', icon: '🔄', bg: 'bg-blue-50', border: 'border-blue-100' },
                { label: 'Completed', value: '6', icon: '✅', bg: 'bg-green-50', border: 'border-green-100' },
                { label: 'Revenue', value: '$4.2k', icon: '💰', bg: 'bg-amber-50', border: 'border-amber-100' },
              ].map((s) => (
                <div key={s.label} className={`${s.bg} rounded-xl p-3 border ${s.border} shadow-sm`}>
                  <div className="text-[10px] text-stone-400 mb-1">{s.icon} {s.label}</div>
                  <div className="text-lg font-extrabold text-stone-800">{s.value}</div>
                </div>
              ))}
            </div>

            {/* Filter tabs */}
            <div className="bg-white rounded-xl p-2 border border-stone-100 flex gap-1">
              {['All', 'Pending', 'Active', 'Completed', 'Overdue'].map((t, i) => (
                <div key={t} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold ${
                  i === 0 ? 'bg-[#fff4ef] text-[#c43d10] border border-[#fdd5c5]' : 'text-stone-400'
                }`}>{t}</div>
              ))}
            </div>

            {/* Job table */}
            <div className="bg-white rounded-xl border border-stone-100 shadow-sm overflow-hidden">
              <table className="w-full text-[11px]">
                <thead><tr className="border-b border-stone-100 text-stone-400 text-[10px] uppercase tracking-wider">
                  <th className="px-3 py-2 text-left">Job</th>
                  <th className="px-3 py-2 text-left">Sub</th>
                  <th className="px-3 py-2 text-left">Deal</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Payment</th>
                </tr></thead>
                <tbody>
                  {[
                    { job: '🏠 Chimney Repair', loc: 'Cordova, TN', sub: 'Mike J.', deal: '20%', status: 'Accepted', sc: 'bg-blue-50 text-blue-700', pay: 'Pending', pc: 'bg-stone-100 text-stone-500' },
                    { job: '🚪 Garage Door', loc: 'Osprey, FL', sub: 'Sarah C.', deal: '$500', status: 'Completed', sc: 'bg-green-50 text-green-700', pay: 'Paid', pc: 'bg-green-50 text-green-700' },
                    { job: '🔧 Plumbing Fix', loc: 'Miami, FL', sub: 'Carlos R.', deal: '15%', status: 'In Progress', sc: 'bg-amber-50 text-amber-700', pay: 'Partial', pc: 'bg-amber-50 text-amber-700' },
                  ].map((r) => (
                    <tr key={r.job} className="border-b border-stone-50">
                      <td className="px-3 py-2"><div className="font-medium text-stone-800">{r.job}</div><div className="text-[9px] text-stone-400">{r.loc}</div></td>
                      <td className="px-3 py-2 text-stone-600">{r.sub}</td>
                      <td className="px-3 py-2 font-mono text-stone-600">{r.deal}</td>
                      <td className="px-3 py-2"><span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${r.sc}`}>{r.status}</span></td>
                      <td className="px-3 py-2"><span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${r.pc}`}>{r.pay}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ),
      },
      {
        title: 'Job Detail Panel',
        subtitle: 'Click any job to see full details — timeline, financials, and sub info.',
        duration: 4500,
        visual: (
          <div className="max-w-sm mx-auto bg-white rounded-2xl shadow-xl border border-stone-100 overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-[#fff4ef] to-[#fee8df] px-5 py-4 border-b border-[#fdd5c5]">
              <div className="flex items-center gap-2 mb-1">
                <span>🏠</span>
                <span className="text-sm font-bold text-stone-800">Chimney Repair</span>
                <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 text-[9px] font-bold">Accepted</span>
              </div>
              <div className="text-[10px] text-stone-500">Cordova, TN — 38016</div>
            </div>
            {/* Details */}
            <div className="p-4 space-y-3">
              <div className="flex justify-between text-xs">
                <span className="text-stone-400">Subcontractor</span>
                <span className="font-semibold text-stone-700">Mike Johnson</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-stone-400">Deal</span>
                <span className="font-semibold text-stone-700">20% of job value</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-stone-400">Job Amount</span>
                <span className="font-bold text-green-600">$1,200</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-stone-400">Your Earnings</span>
                <span className="font-bold text-[#e04d1c]">$240</span>
              </div>
              <div className="border-t border-stone-100 pt-3">
                <div className="text-[10px] font-semibold text-stone-500 uppercase tracking-wider mb-2">Timeline</div>
                <div className="space-y-2">
                  {[
                    { label: 'Created', time: 'Mar 15, 2:15 PM', icon: '📤' },
                    { label: 'Viewed by sub', time: 'Mar 15, 2:20 PM', icon: '👁' },
                    { label: 'Accepted', time: 'Mar 15, 2:22 PM', icon: '✅' },
                  ].map((e) => (
                    <div key={e.label} className="flex items-center gap-2 text-[10px]">
                      <span>{e.icon}</span>
                      <span className="font-medium text-stone-700">{e.label}</span>
                      <span className="text-stone-400 ml-auto">{e.time}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ),
      },
      {
        title: 'Financial Overview',
        subtitle: 'Track revenue, payments, and overdue invoices across all your jobs.',
        duration: 4500,
        visual: (
          <div className="max-w-md mx-auto space-y-3">
            {/* Revenue summary */}
            <div className="bg-white rounded-xl p-4 border border-stone-100 shadow-sm">
              <div className="text-[10px] text-stone-400 uppercase tracking-wider mb-3">Revenue Summary</div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <div className="text-xl font-extrabold text-stone-800">$12.4k</div>
                  <div className="text-[10px] text-stone-400">Total Revenue</div>
                </div>
                <div>
                  <div className="text-xl font-extrabold text-green-600">$8.2k</div>
                  <div className="text-[10px] text-stone-400">Collected</div>
                </div>
                <div>
                  <div className="text-xl font-extrabold text-red-500">$1.8k</div>
                  <div className="text-[10px] text-stone-400">Overdue</div>
                </div>
              </div>
            </div>
            {/* Payment table */}
            <div className="bg-white rounded-xl border border-stone-100 shadow-sm overflow-hidden">
              <table className="w-full text-[11px]">
                <thead><tr className="border-b border-stone-100 text-stone-400 text-[10px] uppercase tracking-wider">
                  <th className="px-3 py-2 text-left">Job</th>
                  <th className="px-3 py-2 text-left">Amount</th>
                  <th className="px-3 py-2 text-left">Your Cut</th>
                  <th className="px-3 py-2 text-left">Status</th>
                </tr></thead>
                <tbody>
                  {[
                    { job: '🏠 Chimney', amount: '$1,200', cut: '$240', status: 'Paid', sc: 'bg-green-50 text-green-700' },
                    { job: '🚪 Garage Door', amount: '$2,500', cut: '$500', status: 'Paid', sc: 'bg-green-50 text-green-700' },
                    { job: '🔧 Plumbing', amount: '$800', cut: '$120', status: 'Overdue', sc: 'bg-red-50 text-red-600' },
                  ].map((r) => (
                    <tr key={r.job} className="border-b border-stone-50">
                      <td className="px-3 py-2 font-medium text-stone-700">{r.job}</td>
                      <td className="px-3 py-2 text-stone-600">{r.amount}</td>
                      <td className="px-3 py-2 font-bold text-[#e04d1c]">{r.cut}</td>
                      <td className="px-3 py-2"><span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${r.sc}`}>{r.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ),
      },
      {
        title: 'Sub Portal Access',
        subtitle: 'Your subs get a one-click portal to view, accept, and update jobs.',
        duration: 4500,
        visual: (
          <div className="max-w-sm mx-auto bg-white rounded-2xl shadow-xl border border-stone-100 overflow-hidden">
            {/* Portal mockup */}
            <div className="bg-gradient-to-r from-[#fe5b25] to-[#e04d1c] px-5 py-4">
              <div className="text-white/60 text-[10px] font-bold uppercase tracking-wider">Subcontractor Portal</div>
              <div className="text-white text-lg font-bold mt-1">New Job Offer</div>
            </div>
            <div className="p-4 space-y-3">
              <div className="bg-stone-50 rounded-xl p-3 border border-stone-100">
                <div className="text-xs font-medium text-stone-800 mb-1">🏠 Chimney Repair</div>
                <div className="text-[10px] text-stone-500">📍 Cordova, TN — 1766 Black Bear Circle</div>
                <div className="text-[10px] text-stone-500 mt-1">💰 Deal: 20% of job value</div>
              </div>
              <div className="flex gap-2">
                <button className="flex-1 py-2.5 rounded-xl bg-green-500 text-white text-xs font-bold shadow-sm">✅ Accept Job</button>
                <button className="flex-1 py-2.5 rounded-xl bg-stone-100 text-stone-500 text-xs font-bold">Decline</button>
              </div>
              <div className="text-center text-[9px] text-stone-400">
                Sent via MasterLeadFlow • No account needed
              </div>
            </div>
          </div>
        ),
      },
    ]

    return (
      <FeatureTeaser
        steps={teaserSteps}
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
          <div className="bg-white rounded-2xl shadow-sm border border-stone-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-stone-100 text-stone-400 text-xs">
                <th className="px-4 py-3 text-left">Job</th>
                <th className="px-4 py-3 text-left">Sub</th>
                <th className="px-4 py-3 text-left">Deal</th>
                <th className="px-4 py-3 text-left">Status</th>
              </tr></thead>
              <tbody>
                {[
                  { job: 'Chimney Repair', sub: 'Mike Johnson', deal: '$500 fixed', status: 'Active' },
                  { job: 'Garage Door', sub: 'Sarah Chen', deal: '20%', status: 'Pending' },
                  { job: 'Lock Change', sub: 'Carlos Rivera', deal: '$200 fixed', status: 'Completed' },
                  { job: 'HVAC Install', sub: 'Tom Williams', deal: '15%', status: 'Active' },
                ].map((r) => (
                  <tr key={r.job} className="border-b border-stone-50">
                    <td className="px-4 py-3 font-medium text-stone-800">{r.job}</td>
                    <td className="px-4 py-3 text-stone-500">{r.sub}</td>
                    <td className="px-4 py-3 text-stone-500">{r.deal}</td>
                    <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs ${
                      r.status === 'Completed' ? 'bg-green-50 text-green-600' : r.status === 'Pending' ? 'bg-yellow-50 text-yellow-600' : 'bg-blue-50 text-blue-600'
                    }`}>{r.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
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
    </div>
  )
}
