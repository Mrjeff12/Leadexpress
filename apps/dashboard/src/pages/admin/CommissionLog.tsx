import { useState, useEffect, useCallback } from 'react'
import { useI18n } from '../../lib/i18n'
import { supabase } from '../../lib/supabase'
import {
  DollarSign,
  Clock,
  CheckCircle2,
  Wallet,
  Search,
  Download,
  Loader2,
  AlertCircle,
  Calendar,
} from 'lucide-react'

/* ── Design tokens ──────────────────────────────────────────────── */
const C = {
  primary: '#ec4899',
  dark: '#1C1C1E',
  muted: '#8E8E93',
  accent: '#5856D6',
  success: '#059669',
  warning: '#D97706',
  danger: '#DC2626',
  border: 'rgba(0,0,0,0.06)',
}

interface CommissionRow {
  id: string
  partner_id: string
  partner_name: string
  partner_slug: string
  type: string
  amount_cents: number
  status: string
  stripe_invoice_id: string | null
  note: string | null
  approved_at: string | null
  paid_at: string | null
  created_at: string
}

const TYPE_CONFIG: Record<string, { color: string; bg: string; label: string; labelHe: string }> = {
  earning: { color: C.success, bg: '#ECFDF5', label: 'Earning', labelHe: 'הכנסה' },
  withdrawal: { color: C.danger, bg: '#FEF2F2', label: 'Withdrawal', labelHe: 'משיכה' },
  credit: { color: '#2563EB', bg: '#EFF6FF', label: 'Credit', labelHe: 'זיכוי' },
  refund_clawback: { color: C.warning, bg: '#FFFBEB', label: 'Clawback', labelHe: 'החזר' },
}

const STATUS_CONFIG: Record<string, { color: string; bg: string; label: string; labelHe: string }> = {
  pending: { color: C.warning, bg: '#FFFBEB', label: 'Pending', labelHe: 'ממתין' },
  approved: { color: '#2563EB', bg: '#EFF6FF', label: 'Approved', labelHe: 'מאושר' },
  paid: { color: C.success, bg: '#ECFDF5', label: 'Paid', labelHe: 'שולם' },
  rejected: { color: C.danger, bg: '#FEF2F2', label: 'Rejected', labelHe: 'נדחה' },
  reversed: { color: C.muted, bg: '#F3F4F6', label: 'Reversed', labelHe: 'בוטל' },
}

function fmtDate(d: string | null): string {
  if (!d) return '\u2014'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtCurrency(cents: number): string {
  const sign = cents >= 0 ? '+' : ''
  return `${sign}$${(Math.abs(cents) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function CommissionLog() {
  const { locale } = useI18n()
  const he = locale === 'he'

  const [commissions, setCommissions] = useState<CommissionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const fetchData = useCallback(async () => {
    setError(null)
    setLoading(true)
    try {
      const { data, error: fetchErr } = await supabase
        .from('partner_commissions')
        .select('id, partner_id, type, amount_cents, status, stripe_invoice_id, note, approved_at, paid_at, created_at, community_partners(display_name, slug)')
        .order('created_at', { ascending: false })

      if (fetchErr) throw fetchErr

      const rows: CommissionRow[] = (data ?? []).map((r: any) => ({
        id: r.id,
        partner_id: r.partner_id,
        partner_name: r.community_partners?.display_name ?? 'Unknown',
        partner_slug: r.community_partners?.slug ?? '',
        type: r.type,
        amount_cents: r.amount_cents,
        status: r.status,
        stripe_invoice_id: r.stripe_invoice_id,
        note: r.note,
        approved_at: r.approved_at,
        paid_at: r.paid_at,
        created_at: r.created_at,
      }))

      setCommissions(rows)
    } catch (err: any) {
      console.error('[CommissionLog] fetch error:', err)
      setError(he ? 'טעינת נתונים נכשלה' : 'Failed to load commissions')
    } finally {
      setLoading(false)
    }
  }, [he])

  useEffect(() => { fetchData() }, [fetchData])

  // Filter
  const filtered = commissions.filter(c => {
    if (search) {
      const q = search.toLowerCase()
      if (!c.partner_name.toLowerCase().includes(q) && !c.partner_slug.toLowerCase().includes(q)) return false
    }
    if (typeFilter !== 'all' && c.type !== typeFilter) return false
    if (statusFilter !== 'all' && c.status !== statusFilter) return false
    if (dateFrom && c.created_at < dateFrom) return false
    if (dateTo && c.created_at > dateTo + 'T23:59:59') return false
    return true
  })

  // KPIs
  const totalEarnings = commissions.filter(c => c.type === 'earning').reduce((s, c) => s + c.amount_cents, 0)
  const pendingAmount = commissions.filter(c => c.status === 'pending').reduce((s, c) => s + Math.abs(c.amount_cents), 0)
  const paidAmount = commissions.filter(c => c.status === 'paid' && c.type === 'earning').reduce((s, c) => s + c.amount_cents, 0)
  const totalWithdrawals = commissions.filter(c => c.type === 'withdrawal').reduce((s, c) => s + Math.abs(c.amount_cents), 0)

  const kpiCards = [
    { label: he ? 'סה"כ הכנסות' : 'Total Earnings', value: `$${(totalEarnings / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}`, icon: DollarSign, color: C.success, gradient: 'linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 100%)' },
    { label: he ? 'ממתין' : 'Pending', value: `$${(pendingAmount / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}`, icon: Clock, color: C.warning, gradient: 'linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%)' },
    { label: he ? 'שולם' : 'Paid Out', value: `$${(paidAmount / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}`, icon: CheckCircle2, color: '#059669', gradient: 'linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 100%)' },
    { label: he ? 'משיכות' : 'Withdrawals', value: `$${(totalWithdrawals / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}`, icon: Wallet, color: C.primary, gradient: 'linear-gradient(135deg, #FDF2F8 0%, #FCE7F3 100%)' },
  ]

  function exportCSV() {
    const headers = ['ID', 'Partner', 'Slug', 'Type', 'Amount ($)', 'Status', 'Stripe Invoice', 'Note', 'Approved At', 'Paid At', 'Created At']
    const rows = filtered.map(c => [
      c.id,
      c.partner_name,
      c.partner_slug,
      c.type,
      (c.amount_cents / 100).toFixed(2),
      c.status,
      c.stripe_invoice_id ?? '',
      c.note ?? '',
      c.approved_at ?? '',
      c.paid_at ?? '',
      c.created_at,
    ])
    const csv = [headers, ...rows].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `commissions-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-6 h-6 animate-spin" style={{ color: C.primary }} />
          <p className="text-sm" style={{ color: C.muted }}>{he ? 'טוען...' : 'Loading...'}</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <AlertCircle className="w-8 h-8" style={{ color: C.danger }} />
          <p className="text-sm font-medium" style={{ color: C.danger }}>{error}</p>
          <button
            onClick={fetchData}
            className="px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:shadow-sm"
            style={{ background: C.primary, color: 'white' }}
          >
            {he ? 'נסה שוב' : 'Try Again'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="animate-fade-in space-y-6">
      {/* ═══ Header ═══ */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: C.dark, letterSpacing: '-0.02em' }}>
            {he ? 'יומן עמלות' : 'Commission Log'}
          </h1>
          <p className="text-sm mt-1" style={{ color: C.muted }}>
            {he ? 'כל העמלות, ההכנסות והמשיכות' : 'All commissions, earnings & withdrawals'}
          </p>
        </div>
        <button
          onClick={exportCSV}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all hover:scale-[1.02] active:scale-[0.98] shadow-sm border"
          style={{ background: 'white', color: C.dark, borderColor: '#E5E7EB' }}
        >
          <Download className="w-4 h-4" />
          {he ? 'יצוא CSV' : 'Export CSV'}
        </button>
      </div>

      {/* ═══ KPI Cards ═══ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((kpi, i) => (
          <div
            key={i}
            className="relative overflow-hidden rounded-2xl p-5 transition-all hover:shadow-md"
            style={{ background: kpi.gradient, border: `1px solid ${C.border}` }}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-2xl font-bold tracking-tight" style={{ color: C.dark }}>{kpi.value}</p>
                <p className="text-xs font-medium mt-1 uppercase tracking-wider" style={{ color: C.muted }}>{kpi.label}</p>
              </div>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${kpi.color}15` }}>
                <kpi.icon className="w-5 h-5" style={{ color: kpi.color }} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ═══ Filters ═══ */}
      <div className="flex flex-wrap items-center gap-3">
        <div
          className="flex items-center gap-2.5 flex-1 min-w-[200px] px-4 py-2.5 rounded-xl transition-all"
          style={{ background: 'white', border: `1.5px solid ${C.border}`, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
        >
          <Search className="w-4 h-4" style={{ color: C.muted }} />
          <input
            type="text"
            placeholder={he ? 'חפש שותף...' : 'Search partner...'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent border-0 text-sm outline-none"
            style={{ color: C.dark }}
          />
        </div>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="text-xs font-medium rounded-xl px-3 py-2.5 border outline-none cursor-pointer transition-all hover:border-gray-300"
          style={{ borderColor: '#E5E7EB', color: C.dark, background: 'white' }}
        >
          <option value="all">{he ? 'כל הסוגים' : 'All Types'}</option>
          <option value="earning">{he ? 'הכנסה' : 'Earning'}</option>
          <option value="withdrawal">{he ? 'משיכה' : 'Withdrawal'}</option>
          <option value="credit">{he ? 'זיכוי' : 'Credit'}</option>
          <option value="refund_clawback">{he ? 'החזר' : 'Clawback'}</option>
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="text-xs font-medium rounded-xl px-3 py-2.5 border outline-none cursor-pointer transition-all hover:border-gray-300"
          style={{ borderColor: '#E5E7EB', color: C.dark, background: 'white' }}
        >
          <option value="all">{he ? 'כל הסטטוסים' : 'All Status'}</option>
          <option value="pending">{he ? 'ממתין' : 'Pending'}</option>
          <option value="approved">{he ? 'מאושר' : 'Approved'}</option>
          <option value="paid">{he ? 'שולם' : 'Paid'}</option>
          <option value="rejected">{he ? 'נדחה' : 'Rejected'}</option>
          <option value="reversed">{he ? 'בוטל' : 'Reversed'}</option>
        </select>

        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 shrink-0" style={{ color: C.muted }} />
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="text-xs font-medium rounded-xl px-3 py-2.5 border outline-none cursor-pointer"
            style={{ borderColor: '#E5E7EB', color: C.dark, background: 'white' }}
          />
          <span className="text-xs" style={{ color: C.muted }}>{he ? 'עד' : 'to'}</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="text-xs font-medium rounded-xl px-3 py-2.5 border outline-none cursor-pointer"
            style={{ borderColor: '#E5E7EB', color: C.dark, background: 'white' }}
          />
        </div>
      </div>

      {/* ═══ Table ═══ */}
      <div
        className="overflow-hidden rounded-2xl"
        style={{ background: 'white', border: `1px solid ${C.border}`, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.border}`, background: '#FAFBFC' }}>
                {[
                  he ? 'שותף' : 'Partner',
                  he ? 'סוג' : 'Type',
                  he ? 'סכום' : 'Amount',
                  he ? 'סטטוס' : 'Status',
                  he ? 'חשבונית' : 'Invoice',
                  he ? 'הערה' : 'Note',
                  he ? 'אושר' : 'Approved',
                  he ? 'שולם' : 'Paid',
                  he ? 'נוצר' : 'Created',
                ].map((col, i) => (
                  <th
                    key={i}
                    className="text-start px-4 py-3.5 font-semibold text-[11px] uppercase tracking-widest"
                    style={{ color: C.muted }}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-5 py-16 text-center">
                    <DollarSign className="w-8 h-8 mx-auto mb-3" style={{ color: '#D1D5DB' }} />
                    <p className="text-sm font-medium" style={{ color: C.muted }}>
                      {he ? 'אין עמלות' : 'No commissions found'}
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map((c, idx) => {
                  const typeConf = TYPE_CONFIG[c.type] ?? { color: C.muted, bg: '#F3F4F6', label: c.type, labelHe: c.type }
                  const sConf = STATUS_CONFIG[c.status] ?? { color: C.muted, bg: '#F3F4F6', label: c.status, labelHe: c.status }

                  return (
                    <tr
                      key={c.id}
                      className="transition-colors"
                      style={{ borderBottom: idx < filtered.length - 1 ? `1px solid ${C.border}` : undefined }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#FAFBFC')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td className="px-4 py-3.5">
                        <div>
                          <div className="font-semibold text-[13px]" style={{ color: C.dark }}>{c.partner_name}</div>
                          <div className="text-[10px]" style={{ color: C.muted }}>@{c.partner_slug}</div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className="inline-flex items-center text-[10px] font-semibold px-2 py-1 rounded-lg"
                          style={{ background: typeConf.bg, color: typeConf.color }}
                        >
                          {he ? typeConf.labelHe : typeConf.label}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="text-[13px] font-bold" style={{ color: c.amount_cents >= 0 ? C.success : C.danger }}>
                          {fmtCurrency(c.amount_cents)}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className="inline-flex items-center text-[10px] font-semibold px-2 py-1 rounded-lg"
                          style={{ background: sConf.bg, color: sConf.color }}
                        >
                          {he ? sConf.labelHe : sConf.label}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-[11px] font-mono" style={{ color: C.muted }}>
                        {c.stripe_invoice_id ? c.stripe_invoice_id.slice(0, 12) + '...' : '\u2014'}
                      </td>
                      <td className="px-4 py-3.5 text-[11px] max-w-[150px] truncate" style={{ color: C.muted }}>
                        {c.note || '\u2014'}
                      </td>
                      <td className="px-4 py-3.5 text-[11px]" style={{ color: C.muted }}>{fmtDate(c.approved_at)}</td>
                      <td className="px-4 py-3.5 text-[11px]" style={{ color: C.muted }}>{fmtDate(c.paid_at)}</td>
                      <td className="px-4 py-3.5 text-[11px]" style={{ color: C.muted }}>{fmtDate(c.created_at)}</td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
        {filtered.length > 0 && (
          <div className="px-5 py-3 flex items-center justify-between" style={{ borderTop: `1px solid ${C.border}`, background: '#FAFBFC' }}>
            <span className="text-[11px] font-medium" style={{ color: C.muted }}>
              {he ? `${filtered.length} רשומות` : `${filtered.length} record${filtered.length !== 1 ? 's' : ''}`}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
