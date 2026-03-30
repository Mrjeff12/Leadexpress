import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import {
  useContractorPerformance,
  type SortField,
  type SortDir,
  type DateRange,
} from '../../hooks/useContractorPerformance'
import {
  Loader2,
  Users,
  Zap,
  TrendingUp,
  Crown,
  Search,
  ChevronUp,
  ChevronDown,
  Download,
  ChevronsUpDown,
} from 'lucide-react'

const ORANGE = '#fe5b25'

/* ── KPI Card (matches GrowthDashboard pattern) ── */
function KpiCard({ label, value, icon: Icon, accent = false }: {
  label: string
  value: string
  icon: typeof Users
  accent?: boolean
}) {
  return (
    <div className="bg-white rounded-2xl border border-stone-100 shadow-sm p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-stone-400">{label}</span>
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center"
          style={{ background: accent ? `${ORANGE}10` : 'rgba(0,0,0,0.03)' }}
        >
          <Icon className="w-4 h-4" style={{ color: accent ? ORANGE : '#9ca3af' }} />
        </div>
      </div>
      <span
        className="text-[28px] font-extrabold tracking-tight leading-none"
        style={{ color: accent ? ORANGE : '#1a1a1a' }}
      >
        {value}
      </span>
    </div>
  )
}

/* ── Plan badge ── */
const PLAN_STYLES: Record<string, { color: string; bg: string }> = {
  free:      { color: '#6B7280', bg: '#F3F4F6' },
  starter:   { color: '#2563EB', bg: '#EFF6FF' },
  pro:       { color: '#7C3AED', bg: '#F5F3FF' },
  unlimited: { color: '#D97706', bg: '#FFFBEB' },
}

function PlanBadge({ plan }: { plan: string }) {
  const style = PLAN_STYLES[plan] ?? PLAN_STYLES.free
  return (
    <span
      className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-md uppercase tracking-wide"
      style={{ background: style.bg, color: style.color }}
    >
      {plan || 'Free'}
    </span>
  )
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-md uppercase tracking-wide"
      style={{
        background: active ? '#ECFDF5' : '#FEF2F2',
        color: active ? '#059669' : '#DC2626',
      }}
    >
      {active ? 'Active' : 'Suspended'}
    </span>
  )
}

/* ── Sort header ── */
function SortHeader({ label, field, currentField, currentDir, onSort }: {
  label: string
  field: SortField
  currentField: SortField
  currentDir: SortDir
  onSort: (f: SortField) => void
}) {
  const active = currentField === field
  return (
    <button
      onClick={() => onSort(field)}
      className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-stone-400 hover:text-stone-600 transition-colors"
    >
      {label}
      {active ? (
        currentDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
      ) : (
        <ChevronsUpDown className="w-3 h-3 opacity-30" />
      )}
    </button>
  )
}

/* ── Time ago helper ── */
function timeAgo(dateStr: string | null): string {
  if (!dateStr) return '\u2014'
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  return `${months}mo ago`
}

/* ── CSV export ── */
function exportCsv(rows: { user_id: string; name: string; plan: string; leads_received: number; leads_claimed: number; claim_rate: number; jobs_published: number; last_active: string | null; is_active: boolean }[]) {
  const header = 'Name,Plan,Leads Received,Leads Claimed,Claim Rate (%),Jobs Published,Last Active,Status'
  const lines = rows.map(r =>
    [
      `"${r.name}"`,
      r.plan,
      r.leads_received,
      r.leads_claimed,
      r.claim_rate,
      r.jobs_published,
      r.last_active ?? '',
      r.is_active ? 'Active' : 'Suspended',
    ].join(',')
  )
  const csv = [header, ...lines].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `contractor-performance-${new Date().toISOString().split('T')[0]}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

/* ════════════════════════════════════════════════════════════
   Main Component
   ════════════════════════════════════════════════════════════ */
export default function ContractorPerformance() {
  const navigate = useNavigate()

  // Filters state
  const [search, setSearch] = useState('')
  const [plan, setPlan] = useState('')
  const [profession, setProfession] = useState('')
  const [dateRange, setDateRange] = useState<DateRange>('month')
  const [sortField, setSortField] = useState<SortField>('leads_received')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  // Load professions for filter dropdown
  const [professions, setProfessions] = useState<{ id: string; name_en: string }[]>([])
  useEffect(() => {
    supabase
      .from('professions')
      .select('id, name_en')
      .eq('is_active', true)
      .order('sort_order')
      .then(({ data }) => { if (data) setProfessions(data) })
  }, [])

  const data = useContractorPerformance({
    search,
    plan,
    profession,
    dateRange,
    sortField,
    sortDir,
  })

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir('desc')
    }
  }

  if (data.loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-stone-300" />
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto" style={{ background: '#faf9f6' }}>
      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">

        {/* ═══════════════ KPI CARDS ═══════════════ */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label="Active Contractors" value={data.totalActive.toLocaleString()} icon={Users} accent />
          <KpiCard label="Avg Leads / Contractor" value={data.avgLeads.toLocaleString()} icon={Zap} />
          <KpiCard label="Avg Claim Rate" value={`${data.avgClaimRate}%`} icon={TrendingUp} />
          <KpiCard label="Top Performer" value={data.topContractor ?? '\u2014'} icon={Crown} accent />
        </div>

        {/* ═══════════════ FILTERS BAR ═══════════════ */}
        <div className="bg-white rounded-2xl border border-stone-100 shadow-sm p-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-300" />
              <input
                type="text"
                placeholder="Search by name..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-stone-200 text-[13px] focus:outline-none focus:border-[#fe5b25]/40 focus:ring-1 focus:ring-[#fe5b25]/20 transition-all"
              />
            </div>

            {/* Plan filter */}
            <select
              value={plan}
              onChange={e => setPlan(e.target.value)}
              className="px-3 py-2 rounded-xl border border-stone-200 text-[13px] text-stone-600 focus:outline-none focus:border-[#fe5b25]/40 bg-white"
            >
              <option value="">All Plans</option>
              <option value="free">Free</option>
              <option value="starter">Starter</option>
              <option value="pro">Pro</option>
              <option value="unlimited">Unlimited</option>
            </select>

            {/* Profession filter */}
            <select
              value={profession}
              onChange={e => setProfession(e.target.value)}
              className="px-3 py-2 rounded-xl border border-stone-200 text-[13px] text-stone-600 focus:outline-none focus:border-[#fe5b25]/40 bg-white"
            >
              <option value="">All Professions</option>
              {professions.map(p => (
                <option key={p.id} value={p.name_en.toLowerCase()}>{p.name_en}</option>
              ))}
            </select>

            {/* Date range */}
            <select
              value={dateRange}
              onChange={e => setDateRange(e.target.value as DateRange)}
              className="px-3 py-2 rounded-xl border border-stone-200 text-[13px] text-stone-600 focus:outline-none focus:border-[#fe5b25]/40 bg-white"
            >
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="quarter">This Quarter</option>
            </select>

            {/* CSV Export */}
            <button
              onClick={() => exportCsv(data.rows)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-stone-200 text-[13px] font-medium text-stone-600 hover:bg-stone-50 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </button>
          </div>
        </div>

        {/* ═══════════════ PERFORMANCE TABLE ═══════════════ */}
        <div className="bg-white rounded-2xl border border-stone-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-stone-100">
                  <th className="text-left px-5 py-3">
                    <SortHeader label="Contractor" field="name" currentField={sortField} currentDir={sortDir} onSort={handleSort} />
                  </th>
                  <th className="text-left px-4 py-3">
                    <SortHeader label="Plan" field="plan" currentField={sortField} currentDir={sortDir} onSort={handleSort} />
                  </th>
                  <th className="text-right px-4 py-3">
                    <SortHeader label="Leads Received" field="leads_received" currentField={sortField} currentDir={sortDir} onSort={handleSort} />
                  </th>
                  <th className="text-right px-4 py-3">
                    <SortHeader label="Leads Claimed" field="leads_claimed" currentField={sortField} currentDir={sortDir} onSort={handleSort} />
                  </th>
                  <th className="text-right px-4 py-3">
                    <SortHeader label="Claim Rate" field="claim_rate" currentField={sortField} currentDir={sortDir} onSort={handleSort} />
                  </th>
                  <th className="text-right px-4 py-3">
                    <SortHeader label="Jobs" field="jobs_published" currentField={sortField} currentDir={sortDir} onSort={handleSort} />
                  </th>
                  <th className="text-left px-4 py-3">
                    <SortHeader label="Last Active" field="last_active" currentField={sortField} currentDir={sortDir} onSort={handleSort} />
                  </th>
                  <th className="text-left px-4 py-3">
                    <SortHeader label="Status" field="status" currentField={sortField} currentDir={sortDir} onSort={handleSort} />
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.rows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-stone-300 text-sm">
                      No contractors found
                    </td>
                  </tr>
                ) : (
                  data.rows.map(row => (
                    <tr
                      key={row.user_id}
                      onClick={() => navigate(`/admin/clients/contractors/${row.user_id}`)}
                      className="border-b border-stone-50 hover:bg-stone-50/60 cursor-pointer transition-colors"
                    >
                      <td className="px-5 py-3">
                        <span className="text-[13px] font-semibold text-stone-800 hover:text-[#fe5b25] transition-colors">
                          {row.name}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <PlanBadge plan={row.plan} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-[13px] font-semibold text-stone-700 tabular-nums">
                          {row.leads_received}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-[13px] font-semibold text-stone-700 tabular-nums">
                          {row.leads_claimed}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className="text-[13px] font-bold tabular-nums"
                          style={{
                            color: row.claim_rate >= 50 ? '#059669'
                              : row.claim_rate >= 20 ? '#D97706'
                              : '#DC2626',
                          }}
                        >
                          {row.claim_rate}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-[13px] font-semibold text-stone-700 tabular-nums">
                          {row.jobs_published}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[12px] text-stone-400">
                          {timeAgo(row.last_active)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge active={row.is_active} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Row count */}
          <div className="px-5 py-3 border-t border-stone-100 flex items-center justify-between">
            <span className="text-[11px] text-stone-400">
              Showing {data.rows.length} contractor{data.rows.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

      </div>
    </div>
  )
}
