import { useState, useEffect, useCallback } from 'react'
import { useI18n } from '../../lib/i18n'
import { supabase } from '../../lib/supabase'
import {
  Wallet,
  Clock,
  DollarSign,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
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

interface WithdrawalRow {
  id: string
  partner_id: string
  partner_name: string
  amount_cents: number
  status: string
  note: string | null
  created_at: string
  paid_at: string | null
  stripe_connect_id: string | null
  stripe_onboarded: boolean
}

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtCurrency(cents: number): string {
  return `$${(Math.abs(cents) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function WithdrawalQueue() {
  const { locale } = useI18n()
  const he = locale === 'he'

  const [withdrawals, setWithdrawals] = useState<WithdrawalRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showProcessed, setShowProcessed] = useState(false)

  const fetchData = useCallback(async () => {
    setError(null)
    setLoading(true)
    try {
      const { data, error: fetchErr } = await supabase
        .from('partner_commissions')
        .select('id, partner_id, amount_cents, status, note, created_at, paid_at, community_partners(display_name, stripe_connect_id, stripe_onboarded)')
        .eq('type', 'withdrawal')
        .order('created_at', { ascending: false })

      if (fetchErr) throw fetchErr

      const rows: WithdrawalRow[] = (data ?? []).map((r: any) => ({
        id: r.id,
        partner_id: r.partner_id,
        partner_name: r.community_partners?.display_name ?? 'Unknown',
        amount_cents: r.amount_cents,
        status: r.status,
        note: r.note,
        created_at: r.created_at,
        paid_at: r.paid_at,
        stripe_connect_id: r.community_partners?.stripe_connect_id ?? null,
        stripe_onboarded: r.community_partners?.stripe_onboarded ?? false,
      }))

      setWithdrawals(rows)
    } catch (err: any) {
      console.error('[WithdrawalQueue] fetch error:', err)
      setError(he ? 'טעינת נתונים נכשלה' : 'Failed to load withdrawals')
    } finally {
      setLoading(false)
    }
  }, [he])

  useEffect(() => { fetchData() }, [fetchData])

  const [processingId, setProcessingId] = useState<string | null>(null)

  async function handlePayOut(id: string) {
    if (!window.confirm(he ? 'לבצע העברת Stripe לשותף?' : 'Execute Stripe payout to partner?')) return
    setProcessingId(id)
    try {
      const { data, error } = await supabase.functions.invoke('process-partner-payout', {
        body: { commission_id: id },
      })
      if (error) {
        alert(he ? 'העברה נכשלה' : `Payout failed: ${error.message}`)
        return
      }
      if (data?.error) {
        alert(he ? 'העברה נכשלה' : `Payout failed: ${data.error}`)
        return
      }
      fetchData()
    } catch (err: any) {
      alert(he ? 'שגיאה בלתי צפויה' : `Unexpected error: ${err.message}`)
    } finally {
      setProcessingId(null)
    }
  }

  async function handleReject(id: string) {
    if (!window.confirm(he ? 'לדחות משיכה זו?' : 'Reject this withdrawal?')) return
    const { error } = await supabase.from('partner_commissions').update({ status: 'rejected' }).eq('id', id)
    if (error) {
      alert(he ? 'דחייה נכשלה' : 'Rejection failed')
    } else {
      fetchData()
    }
  }

  const pending = withdrawals.filter(w => w.status === 'pending' || w.status === 'approved')
  const processed = withdrawals.filter(w => w.status === 'paid' || w.status === 'rejected' || w.status === 'reversed')

  const pendingCount = pending.length
  const pendingAmount = pending.reduce((sum, w) => sum + Math.abs(w.amount_cents), 0)

  const now = new Date()
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const processedThisMonth = processed.filter(w => w.status === 'paid' && w.paid_at && w.paid_at >= thisMonthStart).reduce((sum, w) => sum + Math.abs(w.amount_cents), 0)

  const kpis = [
    { label: he ? 'ממתינות' : 'Pending', value: pendingCount, icon: Clock, color: C.warning, gradient: 'linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%)' },
    { label: he ? 'סכום ממתין' : 'Pending Amount', value: fmtCurrency(pendingAmount), icon: DollarSign, color: C.primary, gradient: 'linear-gradient(135deg, #FDF2F8 0%, #FCE7F3 100%)' },
    { label: he ? 'עובד החודש' : 'Processed (Month)', value: fmtCurrency(processedThisMonth), icon: CheckCircle2, color: C.success, gradient: 'linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 100%)' },
  ]

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
      <div>
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: C.dark, letterSpacing: '-0.02em' }}>
          {he ? 'תור משיכות' : 'Withdrawal Queue'}
        </h1>
        <p className="text-sm mt-1" style={{ color: C.muted }}>
          {he ? 'ניהול בקשות משיכה של שותפים' : 'Manage partner withdrawal requests'}
        </p>
      </div>

      {/* ═══ KPI Cards ═══ */}
      <div className="grid grid-cols-3 gap-4">
        {kpis.map((kpi, i) => (
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

      {/* ═══ Pending Queue ═══ */}
      <div
        className="overflow-hidden rounded-2xl"
        style={{ background: 'white', border: `1px solid ${C.border}`, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
      >
        <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: `1px solid ${C.border}` }}>
          <h2 className="text-[15px] font-bold flex items-center gap-2.5" style={{ color: C.dark }}>
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${C.warning}12` }}>
              <Clock className="w-3.5 h-3.5" style={{ color: C.warning }} />
            </div>
            {he ? 'ממתינות לעיבוד' : 'Pending Withdrawals'}
            {pendingCount > 0 && (
              <span
                className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                style={{ background: `${C.warning}12`, color: C.warning }}
              >
                {pendingCount}
              </span>
            )}
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.border}`, background: '#FAFBFC' }}>
                {[
                  he ? 'שותף' : 'Partner',
                  he ? 'תאריך' : 'Date',
                  he ? 'סכום' : 'Amount',
                  he ? 'חשבון תשלום' : 'Payout Account',
                  he ? 'הערה' : 'Note',
                  he ? 'פעולות' : 'Actions',
                ].map((col, i) => (
                  <th key={i} className="text-start px-5 py-3.5 font-semibold text-[11px] uppercase tracking-widest" style={{ color: C.muted }}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pending.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-16 text-center">
                    <Wallet className="w-8 h-8 mx-auto mb-3" style={{ color: '#D1D5DB' }} />
                    <p className="text-sm font-medium" style={{ color: C.muted }}>
                      {he ? 'אין משיכות ממתינות' : 'No pending withdrawals'}
                    </p>
                  </td>
                </tr>
              ) : (
                pending.map((w, idx) => {
                  const hasStripe = !!w.stripe_connect_id && w.stripe_onboarded
                  const isProcessing = processingId === w.id
                  return (
                    <tr
                      key={w.id}
                      style={{ borderBottom: idx < pending.length - 1 ? `1px solid ${C.border}` : undefined }}
                      className="transition-colors"
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#FAFBFC')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td className="px-5 py-4 font-semibold text-[13px]" style={{ color: C.dark }}>{w.partner_name}</td>
                      <td className="px-5 py-4 text-[11px]" style={{ color: C.muted }}>{fmtDate(w.created_at)}</td>
                      <td className="px-5 py-4">
                        <span className="text-[13px] font-bold" style={{ color: C.danger }}>{fmtCurrency(w.amount_cents)}</span>
                      </td>
                      <td className="px-5 py-4">
                        {hasStripe ? (
                          <span
                            className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-lg"
                            style={{ background: '#ECFDF5', color: C.success }}
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            Stripe Connected
                          </span>
                        ) : (
                          <span
                            className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-lg"
                            style={{ background: '#FEF2F2', color: C.danger }}
                          >
                            <AlertCircle className="w-3 h-3" />
                            {he ? 'אין חשבון' : 'No payout account'}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-[12px] max-w-[200px] truncate" style={{ color: C.muted }}>{w.note || '\u2014'}</td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handlePayOut(w.id)}
                            disabled={!hasStripe || isProcessing}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all hover:shadow-sm active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:shadow-none disabled:active:scale-100"
                            style={{ background: C.success, color: 'white' }}
                            title={!hasStripe ? (he ? 'לשותף אין חשבון Stripe' : 'Partner has no Stripe Connect account') : ''}
                          >
                            {isProcessing ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <DollarSign className="w-3 h-3" />
                            )}
                            {isProcessing
                              ? (he ? 'מעבד...' : 'Processing...')
                              : (he ? 'שלם' : 'Pay Out')}
                          </button>
                          <button
                            onClick={() => handleReject(w.id)}
                            disabled={isProcessing}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all hover:shadow-sm active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                            style={{ background: C.danger, color: 'white' }}
                          >
                            <XCircle className="w-3 h-3" />
                            {he ? 'דחה' : 'Reject'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ═══ Processed History (Collapsible) ═══ */}
      <div
        className="overflow-hidden rounded-2xl"
        style={{ background: 'white', border: `1px solid ${C.border}`, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
      >
        <button
          onClick={() => setShowProcessed(!showProcessed)}
          className="w-full px-6 py-4 flex items-center justify-between transition-colors hover:bg-gray-50"
        >
          <h2 className="text-[15px] font-bold flex items-center gap-2.5" style={{ color: C.dark }}>
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${C.success}12` }}>
              <CheckCircle2 className="w-3.5 h-3.5" style={{ color: C.success }} />
            </div>
            {he ? 'היסטוריה' : 'Processed History'}
            <span
              className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
              style={{ background: '#F3F4F6', color: C.muted }}
            >
              {processed.length}
            </span>
          </h2>
          {showProcessed ? <ChevronUp className="w-4 h-4" style={{ color: C.muted }} /> : <ChevronDown className="w-4 h-4" style={{ color: C.muted }} />}
        </button>

        {showProcessed && (
          <div className="overflow-x-auto" style={{ borderTop: `1px solid ${C.border}` }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.border}`, background: '#FAFBFC' }}>
                  {[
                    he ? 'שותף' : 'Partner',
                    he ? 'סכום' : 'Amount',
                    he ? 'סטטוס' : 'Status',
                    he ? 'נוצר' : 'Created',
                    he ? 'שולם' : 'Paid',
                  ].map((col, i) => (
                    <th key={i} className="text-start px-5 py-3 font-semibold text-[11px] uppercase tracking-widest" style={{ color: C.muted }}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {processed.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-12 text-center">
                      <Calendar className="w-8 h-8 mx-auto mb-3" style={{ color: '#D1D5DB' }} />
                      <p className="text-sm font-medium" style={{ color: C.muted }}>
                        {he ? 'אין היסטוריה' : 'No processed withdrawals'}
                      </p>
                    </td>
                  </tr>
                ) : (
                  processed.map((w, idx) => {
                    const isPaid = w.status === 'paid'
                    return (
                      <tr
                        key={w.id}
                        style={{ borderBottom: idx < processed.length - 1 ? `1px solid ${C.border}` : undefined }}
                      >
                        <td className="px-5 py-3.5 font-medium" style={{ color: C.dark }}>{w.partner_name}</td>
                        <td className="px-5 py-3.5 font-bold text-[13px]" style={{ color: C.dark }}>{fmtCurrency(w.amount_cents)}</td>
                        <td className="px-5 py-3.5">
                          <span
                            className="inline-flex items-center text-[11px] font-semibold px-2 py-1 rounded-lg"
                            style={{
                              background: isPaid ? '#ECFDF5' : '#FEF2F2',
                              color: isPaid ? C.success : C.danger,
                            }}
                          >
                            {isPaid ? (he ? 'שולם' : 'Paid') : (he ? 'נדחה' : 'Rejected')}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-[11px]" style={{ color: C.muted }}>{fmtDate(w.created_at)}</td>
                        <td className="px-5 py-3.5 text-[11px]" style={{ color: C.muted }}>{w.paid_at ? fmtDate(w.paid_at) : '\u2014'}</td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
