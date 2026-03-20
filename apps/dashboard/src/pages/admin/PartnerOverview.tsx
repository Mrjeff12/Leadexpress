import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useI18n } from '../../lib/i18n'
import { supabase } from '../../lib/supabase'
import {
  Handshake,
  Users,
  Clock,
  DollarSign,
  TrendingUp,
  Wallet,
  CheckCircle2,
  ArrowRight,
  Loader2,
  AlertCircle,
  Trophy,
  Activity,
  RefreshCw,
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

interface OverviewKPIs {
  totalPartners: number
  activePartners: number
  pendingPartners: number
  totalReferrals: number
  pendingCommissionsCents: number
  paidOutCents: number
}

interface LeaderboardRow {
  id: string
  display_name: string
  slug: string
  avatar_url: string | null
  status: string
  referral_count: number
  commission_total_cents: number
}

interface RecentCommission {
  id: string
  partner_name: string
  type: string
  amount_cents: number
  status: string
  created_at: string
}

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function fmtCurrency(cents: number): string {
  return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function PartnerOverview() {
  const { locale } = useI18n()
  const navigate = useNavigate()
  const he = locale === 'he'

  const [kpis, setKpis] = useState<OverviewKPIs | null>(null)
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([])
  const [recentCommissions, setRecentCommissions] = useState<RecentCommission[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function fetchData() {
    setError(null)
    setLoading(true)
    try {
      const [partnersRes, referralsRes, commissionsRes] = await Promise.all([
        supabase.from('community_partners').select('id, status, display_name, slug, avatar_url'),
        supabase.from('partner_referrals').select('id, partner_id, converted_at'),
        supabase.from('partner_commissions').select('id, partner_id, type, amount_cents, status, created_at').order('created_at', { ascending: false }),
      ])

      if (partnersRes.error) throw partnersRes.error
      if (referralsRes.error) throw referralsRes.error
      if (commissionsRes.error) throw commissionsRes.error

      const partners = partnersRes.data ?? []
      const referrals = referralsRes.data ?? []
      const commissions = commissionsRes.data ?? []

      // KPIs
      const totalPartners = partners.length
      const activePartners = partners.filter(p => p.status === 'active').length
      const pendingPartners = partners.filter(p => p.status === 'pending').length
      const totalReferrals = referrals.length
      const pendingCommissionsCents = commissions
        .filter(c => c.status === 'pending' && c.type === 'earning')
        .reduce((sum, c) => sum + c.amount_cents, 0)
      const paidOutCents = commissions
        .filter(c => c.status === 'paid')
        .reduce((sum, c) => sum + Math.abs(c.amount_cents), 0)

      setKpis({ totalPartners, activePartners, pendingPartners, totalReferrals, pendingCommissionsCents, paidOutCents })

      // Leaderboard: aggregate referrals + commissions per partner
      const partnerRefCounts = new Map<string, number>()
      referrals.forEach(r => {
        partnerRefCounts.set(r.partner_id, (partnerRefCounts.get(r.partner_id) ?? 0) + 1)
      })
      const partnerCommTotals = new Map<string, number>()
      commissions.filter(c => c.type === 'earning' && (c.status === 'approved' || c.status === 'paid')).forEach(c => {
        partnerCommTotals.set(c.partner_id, (partnerCommTotals.get(c.partner_id) ?? 0) + c.amount_cents)
      })

      const lb: LeaderboardRow[] = partners
        .filter(p => p.status === 'active')
        .map(p => ({
          id: p.id,
          display_name: p.display_name,
          slug: p.slug,
          avatar_url: p.avatar_url,
          status: p.status,
          referral_count: partnerRefCounts.get(p.id) ?? 0,
          commission_total_cents: partnerCommTotals.get(p.id) ?? 0,
        }))
        .sort((a, b) => b.referral_count - a.referral_count)
        .slice(0, 10)

      setLeaderboard(lb)

      // Recent commissions with partner name
      const partnerMap = new Map(partners.map(p => [p.id, p.display_name]))
      const recent: RecentCommission[] = commissions.slice(0, 10).map(c => ({
        id: c.id,
        partner_name: partnerMap.get(c.partner_id) ?? 'Unknown',
        type: c.type,
        amount_cents: c.amount_cents,
        status: c.status,
        created_at: c.created_at,
      }))
      setRecentCommissions(recent)
    } catch (err: any) {
      console.error('[PartnerOverview] fetch error:', err)
      setError(he ? 'טעינת נתונים נכשלה. נסה שוב.' : 'Failed to load data. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  async function handleApproveMature() {
    const { error } = await supabase.rpc('approve_mature_commissions')
    if (error) {
      alert(he ? 'אישור עמלות נכשל' : 'Failed to approve commissions')
    } else {
      alert(he ? 'עמלות בוגרות אושרו' : 'Mature commissions approved')
      fetchData()
    }
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

  const kpiCards = [
    { label: he ? 'סה"כ שותפים' : 'Total Partners', value: kpis!.totalPartners, icon: Handshake, color: C.dark, gradient: 'linear-gradient(135deg, #F8F9FA 0%, #E9ECEF 100%)' },
    { label: he ? 'פעילים' : 'Active', value: kpis!.activePartners, icon: CheckCircle2, color: C.success, gradient: 'linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 100%)' },
    { label: he ? 'ממתינים' : 'Pending', value: kpis!.pendingPartners, icon: Clock, color: C.warning, gradient: 'linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%)' },
    { label: he ? 'הפניות' : 'Referrals', value: kpis!.totalReferrals, icon: Users, color: C.accent, gradient: 'linear-gradient(135deg, #F5F3FF 0%, #EDE9FE 100%)' },
    { label: he ? 'עמלות ממתינות' : 'Pending Comm.', value: fmtCurrency(kpis!.pendingCommissionsCents), icon: DollarSign, color: C.primary, gradient: 'linear-gradient(135deg, #FDF2F8 0%, #FCE7F3 100%)' },
    { label: he ? 'שולם' : 'Paid Out', value: fmtCurrency(kpis!.paidOutCents), icon: Wallet, color: '#059669', gradient: 'linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 100%)' },
  ]

  const TYPE_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
    earning: { color: C.success, bg: '#ECFDF5', label: he ? 'הכנסה' : 'Earning' },
    withdrawal: { color: C.danger, bg: '#FEF2F2', label: he ? 'משיכה' : 'Withdrawal' },
    credit: { color: '#2563EB', bg: '#EFF6FF', label: he ? 'זיכוי' : 'Credit' },
    refund_clawback: { color: C.warning, bg: '#FFFBEB', label: he ? 'החזר' : 'Clawback' },
  }

  const STATUS_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
    pending: { color: C.warning, bg: '#FFFBEB', label: he ? 'ממתין' : 'Pending' },
    approved: { color: '#2563EB', bg: '#EFF6FF', label: he ? 'מאושר' : 'Approved' },
    paid: { color: C.success, bg: '#ECFDF5', label: he ? 'שולם' : 'Paid' },
    rejected: { color: C.danger, bg: '#FEF2F2', label: he ? 'נדחה' : 'Rejected' },
    reversed: { color: C.muted, bg: '#F3F4F6', label: he ? 'בוטל' : 'Reversed' },
  }

  return (
    <div className="animate-fade-in space-y-6">
      {/* ═══ Header ═══ */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: C.dark, letterSpacing: '-0.02em' }}>
          {he ? 'תוכנית שותפים' : 'Partner Program'}
        </h1>
        <p className="text-sm mt-1" style={{ color: C.muted }}>
          {he ? 'סקירת שותפים קהילתיים, הפניות ועמלות' : 'Overview of community partners, referrals & commissions'}
        </p>
      </div>

      {/* ═══ KPI Cards ═══ */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
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

      {/* ═══ Quick Actions ═══ */}
      <div className="flex flex-wrap gap-3">
        {kpis!.pendingPartners > 0 && (
          <button
            onClick={() => navigate('/admin/partners/list')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all hover:scale-[1.02] active:scale-[0.98] shadow-sm"
            style={{ background: C.warning, color: 'white' }}
          >
            <Clock className="w-4 h-4" />
            {he ? `סקור ${kpis!.pendingPartners} בקשות` : `Review ${kpis!.pendingPartners} Application${kpis!.pendingPartners > 1 ? 's' : ''}`}
          </button>
        )}
        <button
          onClick={() => navigate('/admin/partners/withdrawals')}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all hover:scale-[1.02] active:scale-[0.98] shadow-sm"
          style={{ background: C.primary, color: 'white' }}
        >
          <Wallet className="w-4 h-4" />
          {he ? 'עבד משיכות' : 'Process Withdrawals'}
        </button>
        <button
          onClick={handleApproveMature}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all hover:scale-[1.02] active:scale-[0.98] shadow-sm border"
          style={{ background: 'white', color: C.dark, borderColor: '#E5E7EB' }}
        >
          <CheckCircle2 className="w-4 h-4" style={{ color: C.success }} />
          {he ? 'אשר עמלות בוגרות' : 'Approve Mature Commissions'}
        </button>
      </div>

      {/* ═══ Two-Column: Leaderboard + Activity ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Leaderboard */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: 'white', border: `1px solid ${C.border}`, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
        >
          <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: `1px solid ${C.border}` }}>
            <h2 className="text-[15px] font-bold flex items-center gap-2.5" style={{ color: C.dark }}>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${C.primary}12` }}>
                <Trophy className="w-3.5 h-3.5" style={{ color: C.primary }} />
              </div>
              {he ? 'לוח מובילים' : 'Leaderboard'}
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.border}`, background: '#FAFBFC' }}>
                  {[he ? '#' : '#', he ? 'שותף' : 'Partner', he ? 'הפניות' : 'Referrals', he ? 'עמלות' : 'Commissions'].map((col, i) => (
                    <th key={i} className="text-start px-5 py-3 font-semibold text-[11px] uppercase tracking-widest" style={{ color: C.muted }}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {leaderboard.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-5 py-12 text-center">
                      <Trophy className="w-8 h-8 mx-auto mb-3" style={{ color: '#D1D5DB' }} />
                      <p className="text-sm font-medium" style={{ color: C.muted }}>
                        {he ? 'אין שותפים פעילים עדיין' : 'No active partners yet'}
                      </p>
                    </td>
                  </tr>
                ) : (
                  leaderboard.map((p, idx) => {
                    const initials = p.display_name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
                    return (
                      <tr
                        key={p.id}
                        className="cursor-pointer transition-colors"
                        style={{ borderBottom: idx < leaderboard.length - 1 ? `1px solid ${C.border}` : undefined }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = '#FAFBFC')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                        onClick={() => navigate(`/admin/partners/list/${p.id}`)}
                      >
                        <td className="px-5 py-3.5">
                          <span className="text-[12px] font-bold" style={{ color: idx < 3 ? C.primary : C.muted }}>{idx + 1}</span>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2.5">
                            {p.avatar_url ? (
                              <img src={p.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover" />
                            ) : (
                              <div
                                className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold"
                                style={{ background: `${C.primary}15`, color: C.primary }}
                              >
                                {initials}
                              </div>
                            )}
                            <div>
                              <div className="font-semibold text-[13px]" style={{ color: C.dark }}>{p.display_name}</div>
                              <div className="text-[11px]" style={{ color: C.muted }}>@{p.slug}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="text-[12px] font-semibold" style={{ color: C.dark }}>{p.referral_count}</span>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="text-[12px] font-bold" style={{ color: C.success }}>
                            {fmtCurrency(p.commission_total_cents)}
                          </span>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Activity */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: 'white', border: `1px solid ${C.border}`, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
        >
          <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: `1px solid ${C.border}` }}>
            <h2 className="text-[15px] font-bold flex items-center gap-2.5" style={{ color: C.dark }}>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${C.accent}12` }}>
                <Activity className="w-3.5 h-3.5" style={{ color: C.accent }} />
              </div>
              {he ? 'פעילות אחרונה' : 'Recent Activity'}
            </h2>
            <button
              onClick={() => navigate('/admin/partners/commissions')}
              className="text-[11px] font-semibold flex items-center gap-1 transition-colors hover:opacity-70"
              style={{ color: C.primary }}
            >
              {he ? 'הכל' : 'View All'}
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <div className="divide-y" style={{ borderColor: C.border }}>
            {recentCommissions.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <Activity className="w-8 h-8 mx-auto mb-3" style={{ color: '#D1D5DB' }} />
                <p className="text-sm font-medium" style={{ color: C.muted }}>
                  {he ? 'אין פעילות עדיין' : 'No activity yet'}
                </p>
              </div>
            ) : (
              recentCommissions.map((c) => {
                const typeConf = TYPE_CONFIG[c.type] ?? { color: C.muted, bg: '#F3F4F6', label: c.type }
                const statusConf = STATUS_CONFIG[c.status] ?? { color: C.muted, bg: '#F3F4F6', label: c.status }
                return (
                  <div key={c.id} className="px-5 py-3.5 flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: typeConf.bg }}>
                        <DollarSign className="w-3.5 h-3.5" style={{ color: typeConf.color }} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[13px] font-semibold truncate" style={{ color: C.dark }}>{c.partner_name}</div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span
                            className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                            style={{ background: typeConf.bg, color: typeConf.color }}
                          >
                            {typeConf.label}
                          </span>
                          <span
                            className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                            style={{ background: statusConf.bg, color: statusConf.color }}
                          >
                            {statusConf.label}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <div className="text-[13px] font-bold" style={{ color: c.amount_cents >= 0 ? C.success : C.danger }}>
                        {c.amount_cents >= 0 ? '+' : ''}{fmtCurrency(c.amount_cents)}
                      </div>
                      <div className="text-[10px]" style={{ color: C.muted }}>{fmtDate(c.created_at)}</div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
