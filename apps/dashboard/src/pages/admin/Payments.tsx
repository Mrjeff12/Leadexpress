import { Fragment, useState, useMemo } from 'react'
import { useI18n } from '../../lib/i18n'
import { useAdminPayments, useAdminBillingKPIs, issueRefund, type PaymentRow } from '../../hooks/useAdminBilling'
import { DollarSign, Search, Loader2, ChevronDown, ChevronUp, ExternalLink, RotateCcw } from 'lucide-react'

type StatusFilter = 'all' | 'succeeded' | 'refunded' | 'failed'

const statusBadgeClass: Record<string, string> = {
  succeeded: 'badge badge-green',
  refunded: 'badge badge-orange',
  failed: 'badge badge-red',
}

function formatAmount(amount: number, currency: string): string {
  const dollars = amount / 100
  return `$${dollars.toFixed(2)} ${currency.toUpperCase()}`
}

function formatDate(unix: number): string {
  return new Date(unix * 1000).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function formatPaymentMethod(p: PaymentRow): string {
  if (p.payment_method_brand && p.payment_method_last4) {
    const brand = p.payment_method_brand.charAt(0).toUpperCase() + p.payment_method_brand.slice(1)
    return `${brand} \u2022\u2022\u2022\u2022 ${p.payment_method_last4}`
  }
  if (p.payment_method_type) {
    return p.payment_method_type.charAt(0).toUpperCase() + p.payment_method_type.slice(1)
  }
  return '\u2014'
}

function displayStatus(p: PaymentRow): string {
  if (p.refunded) return 'refunded'
  return p.status
}

export default function Payments() {
  const { locale } = useI18n()
  const he = locale === 'he'

  const { payments, loading } = useAdminPayments()
  const { kpis, loading: kpisLoading } = useAdminBillingKPIs()

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [search, setSearch] = useState('')
  const [expandedRow, setExpandedRow] = useState<string | null>(null)
  const [refunding, setRefunding] = useState<string | null>(null)

  const counts = useMemo(() => {
    let succeeded = 0
    let refunded = 0
    let failed = 0
    for (const p of payments) {
      if (p.refunded) refunded++
      else if (p.status === 'succeeded') succeeded++
      else if (p.status === 'failed') failed++
    }
    return { all: payments.length, succeeded, refunded, failed }
  }, [payments])

  const filtered = useMemo(() => {
    return payments.filter((p) => {
      // Status filter
      if (statusFilter === 'refunded' && !p.refunded) return false
      if (statusFilter === 'succeeded' && (p.status !== 'succeeded' || p.refunded)) return false
      if (statusFilter === 'failed' && p.status !== 'failed') return false

      // Search filter
      if (search) {
        const q = search.toLowerCase()
        const matchEmail = p.customer_email?.toLowerCase().includes(q)
        const matchName = p.customer_name?.toLowerCase().includes(q)
        if (!matchEmail && !matchName) return false
      }

      return true
    })
  }, [payments, statusFilter, search])

  const handleRefund = async (chargeId: string) => {
    if (!confirm(he ? '\u05d1\u05d8\u05d5\u05d7 \u05e9\u05e8\u05d5\u05e6\u05d4 \u05dc\u05d1\u05e6\u05e2 \u05d4\u05d7\u05d6\u05e8?' : 'Are you sure you want to refund this payment?')) return
    setRefunding(chargeId)
    try {
      await issueRefund(chargeId)
      window.location.reload()
    } catch (err) {
      alert(`Refund failed: ${(err as Error).message}`)
    } finally {
      setRefunding(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: '#f59e0b' }} />
      </div>
    )
  }

  const filterChips: { key: StatusFilter; label: string; count: number }[] = [
    { key: 'all', label: he ? '\u05d4\u05db\u05dc' : 'All', count: counts.all },
    { key: 'succeeded', label: he ? '\u05d4\u05e6\u05dc\u05d9\u05d7' : 'Succeeded', count: counts.succeeded },
    { key: 'refunded', label: he ? '\u05d4\u05d5\u05d7\u05d6\u05e8' : 'Refunded', count: counts.refunded },
    { key: 'failed', label: he ? '\u05e0\u05db\u05e9\u05dc' : 'Failed', count: counts.failed },
  ]

  return (
    <div className="animate-fade-in space-y-8" style={{ fontFamily: 'Outfit, sans-serif' }}>
      {/* Header */}
      <header>
        <h1 className="text-3xl font-bold tracking-tight" style={{ color: '#2d3a2e' }}>
          {he ? '\u05ea\u05e9\u05dc\u05d5\u05de\u05d9\u05dd' : 'Payments'}
        </h1>
        <p className="mt-1 text-sm" style={{ color: '#6b7c6e' }}>
          {he ? '\u05e0\u05ea\u05d5\u05e0\u05d9\u05dd \u05d1\u05d6\u05de\u05df \u05d0\u05de\u05ea \u05de-Stripe' : 'Real-time data from Stripe'}
        </p>
      </header>

      {/* KPI Card */}
      <div className="glass-panel p-5 max-w-xs">
        <div className="flex items-center gap-3">
          <div
            className="flex items-center justify-center w-10 h-10 rounded-xl"
            style={{ backgroundColor: 'rgba(245,158,11,0.1)' }}
          >
            <DollarSign className="h-5 w-5" style={{ color: '#f59e0b' }} />
          </div>
          <div>
            <p className="text-2xl font-bold" style={{ color: '#2d3a2e' }}>
              {kpisLoading ? '\u2014' : `$${((kpis?.total_collected ?? 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            </p>
            <p className="text-xs font-medium" style={{ color: '#9ca89e' }}>
              {he ? '\u05e1\u05d4"\u05db \u05d4\u05d7\u05d5\u05d3\u05e9' : 'Collected this month'}
            </p>
          </div>
        </div>
      </div>

      {/* Status filter chips */}
      <div className="flex flex-wrap items-center gap-2">
        {filterChips.map((chip) => (
          <button
            key={chip.key}
            onClick={() => setStatusFilter(chip.key)}
            className="rounded-full px-4 py-1.5 text-sm font-medium transition-all"
            style={{
              backgroundColor: statusFilter === chip.key ? '#fff' : 'transparent',
              color: statusFilter === chip.key ? '#2d3a2e' : '#6b7c6e',
              boxShadow: statusFilter === chip.key ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              border: statusFilter === chip.key ? '1px solid #e0e4e0' : '1px solid transparent',
            }}
          >
            {chip.label} ({chip.count})
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-xs">
        <Search
          className="absolute top-1/2 -translate-y-1/2 h-4 w-4"
          style={{ color: '#9ca89e', left: he ? 'auto' : '0.75rem', right: he ? '0.75rem' : 'auto' }}
        />
        <input
          type="text"
          placeholder={he ? '\u05d7\u05d9\u05e4\u05d5\u05e9 \u05dc\u05e4\u05d9 \u05d0\u05d9\u05de\u05d9\u05d9\u05dc \u05d0\u05d5 \u05e9\u05dd...' : 'Search by email or name...'}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-xl border text-sm py-2"
          style={{
            borderColor: '#e0e4e0',
            paddingLeft: he ? '0.75rem' : '2.25rem',
            paddingRight: he ? '2.25rem' : '0.75rem',
            color: '#2d3a2e',
            fontFamily: 'Outfit, sans-serif',
          }}
        />
      </div>

      {/* Payments Table */}
      <div className="glass-panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm table-sticky">
            <thead>
              <tr style={{ borderBottom: '1px solid #e0e4e0' }}>
                <th className="text-left px-5 py-3 font-semibold text-xs uppercase tracking-wider" style={{ color: '#9ca89e' }}>
                  {he ? '\u05e1\u05db\u05d5\u05dd' : 'Amount'}
                </th>
                <th className="text-left px-5 py-3 font-semibold text-xs uppercase tracking-wider" style={{ color: '#9ca89e' }}>
                  {he ? '\u05e1\u05d8\u05d8\u05d5\u05e1' : 'Status'}
                </th>
                <th className="text-left px-5 py-3 font-semibold text-xs uppercase tracking-wider" style={{ color: '#9ca89e' }}>
                  {he ? '\u05d0\u05de\u05e6\u05e2\u05d9 \u05ea\u05e9\u05dc\u05d5\u05dd' : 'Payment Method'}
                </th>
                <th className="text-left px-5 py-3 font-semibold text-xs uppercase tracking-wider" style={{ color: '#9ca89e' }}>
                  {he ? '\u05ea\u05d9\u05d0\u05d5\u05e8' : 'Description'}
                </th>
                <th className="text-left px-5 py-3 font-semibold text-xs uppercase tracking-wider" style={{ color: '#9ca89e' }}>
                  {he ? '\u05dc\u05e7\u05d5\u05d7' : 'Customer'}
                </th>
                <th className="text-left px-5 py-3 font-semibold text-xs uppercase tracking-wider" style={{ color: '#9ca89e' }}>
                  {he ? '\u05ea\u05d0\u05e8\u05d9\u05da' : 'Date'}
                </th>
                <th className="px-5 py-3 w-10" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const isExpanded = expandedRow === p.id
                const status = displayStatus(p)
                return (
                  <Fragment key={p.id}>
                    <tr
                      className="cursor-pointer transition-colors hover:bg-[#f5f7f5]"
                      style={{ borderBottom: '1px solid #eef0ee' }}
                      onClick={() => setExpandedRow(isExpanded ? null : p.id)}
                    >
                      <td className="px-5 py-3.5 font-medium" style={{ color: '#2d3a2e' }}>
                        {formatAmount(p.amount, p.currency)}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={statusBadgeClass[status] || 'badge'}>
                          {status.charAt(0).toUpperCase() + status.slice(1)}
                        </span>
                      </td>
                      <td className="px-5 py-3.5" style={{ color: '#6b7c6e' }}>
                        {formatPaymentMethod(p)}
                      </td>
                      <td className="px-5 py-3.5" style={{ color: '#6b7c6e' }}>
                        {p.description || '\u2014'}
                      </td>
                      <td className="px-5 py-3.5" style={{ color: '#6b7c6e' }}>
                        {p.customer_email || p.customer_name || '\u2014'}
                      </td>
                      <td className="px-5 py-3.5" style={{ color: '#6b7c6e' }}>
                        {formatDate(p.created)}
                      </td>
                      <td className="px-5 py-3.5">
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4" style={{ color: '#9ca89e' }} />
                        ) : (
                          <ChevronDown className="h-4 w-4" style={{ color: '#9ca89e' }} />
                        )}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr>
                        <td colSpan={7} className="px-5 py-4" style={{ backgroundColor: '#fafbfa' }}>
                          <div className="ml-2 space-y-2">
                            <p className="text-xs" style={{ color: '#6b7c6e' }}>
                              <strong>Charge ID:</strong>{' '}
                              <code
                                className="px-1.5 py-0.5 rounded text-xs"
                                style={{ backgroundColor: '#eef0ee', color: '#2d3a2e' }}
                              >
                                {p.id}
                              </code>
                            </p>

                            {p.receipt_url && (
                              <p className="text-xs" style={{ color: '#6b7c6e' }}>
                                <strong>{he ? '\u05e7\u05d1\u05dc\u05d4:' : 'Receipt:'}</strong>{' '}
                                <a
                                  href={p.receipt_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 underline"
                                  style={{ color: '#f59e0b' }}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {he ? '\u05e6\u05e4\u05d4 \u05d1\u05e7\u05d1\u05dc\u05d4' : 'View receipt'}
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              </p>
                            )}

                            {p.status === 'failed' && p.failure_message && (
                              <p className="text-xs" style={{ color: '#ef4444' }}>
                                <strong>{he ? '\u05e1\u05d9\u05d1\u05ea \u05db\u05e9\u05dc\u05d5\u05df:' : 'Failure reason:'}</strong>{' '}
                                {p.failure_message}
                              </p>
                            )}

                            {p.refunded && (
                              <p className="text-xs" style={{ color: '#6b7c6e' }}>
                                <strong>{he ? '\u05e1\u05db\u05d5\u05dd \u05d4\u05d7\u05d6\u05e8:' : 'Refunded amount:'}</strong>{' '}
                                {formatAmount(p.amount_refunded, p.currency)}
                              </p>
                            )}

                            {p.status === 'succeeded' && !p.refunded && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleRefund(p.id)
                                }}
                                disabled={refunding === p.id}
                                className="mt-2 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
                                style={{
                                  backgroundColor: '#fef2f2',
                                  color: '#ef4444',
                                  opacity: refunding === p.id ? 0.6 : 1,
                                }}
                              >
                                <RotateCcw className="h-3.5 w-3.5" />
                                {refunding === p.id
                                  ? (he ? '\u05de\u05e2\u05d1\u05d3...' : 'Processing...')
                                  : (he ? '\u05d1\u05e6\u05e2 \u05d4\u05d7\u05d6\u05e8' : 'Issue Refund')}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center" style={{ color: '#9ca89e' }}>
                    {he ? '\u05dc\u05d0 \u05e0\u05de\u05e6\u05d0\u05d5 \u05ea\u05e9\u05dc\u05d5\u05de\u05d9\u05dd' : 'No payments found'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
