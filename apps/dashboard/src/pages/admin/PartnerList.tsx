import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useI18n } from '../../lib/i18n'
import { supabase } from '../../lib/supabase'
import {
  Handshake,
  Users,
  Clock,
  DollarSign,
  Search,
  CheckCircle2,
  XCircle,
  ChevronRight,
  Loader2,
  AlertCircle,
  Eye,
  UserCheck,
  UserX,
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

interface Partner {
  id: string
  user_id: string
  slug: string
  display_name: string
  avatar_url: string | null
  status: string
  commission_rate: number
  balance_cache_cents: number
  created_at: string
}

interface PartnerWithCounts extends Partner {
  group_count: number
  referral_count: number
}

const STATUS_CONFIG: Record<string, { color: string; bg: string; label: string; labelHe: string }> = {
  active: { color: C.success, bg: '#ECFDF5', label: 'Active', labelHe: 'פעיל' },
  pending: { color: C.warning, bg: '#FFFBEB', label: 'Pending', labelHe: 'ממתין' },
  suspended: { color: C.danger, bg: '#FEF2F2', label: 'Suspended', labelHe: 'מושעה' },
  rejected: { color: '#6B7280', bg: '#F3F4F6', label: 'Rejected', labelHe: 'נדחה' },
}

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
}

function fmtCurrency(cents: number): string {
  return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function PartnerList() {
  const { locale } = useI18n()
  const navigate = useNavigate()
  const he = locale === 'he'

  const [partners, setPartners] = useState<PartnerWithCounts[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<string>('newest')

  const fetchPartners = useCallback(async () => {
    setError(null)
    setLoading(true)
    try {
      const [partnersRes, groupsRes, referralsRes] = await Promise.all([
        supabase.from('community_partners').select('id, user_id, slug, display_name, avatar_url, status, commission_rate, balance_cache_cents, created_at').order('created_at', { ascending: false }),
        supabase.from('partner_linked_groups').select('partner_id'),
        supabase.from('partner_referrals').select('partner_id'),
      ])

      if (partnersRes.error) throw partnersRes.error

      const pList = partnersRes.data ?? []
      const groups = groupsRes.data ?? []
      const referrals = referralsRes.data ?? []

      const groupCounts = new Map<string, number>()
      groups.forEach(g => { groupCounts.set(g.partner_id, (groupCounts.get(g.partner_id) ?? 0) + 1) })
      const refCounts = new Map<string, number>()
      referrals.forEach(r => { refCounts.set(r.partner_id, (refCounts.get(r.partner_id) ?? 0) + 1) })

      const withCounts: PartnerWithCounts[] = pList.map(p => ({
        ...p,
        group_count: groupCounts.get(p.id) ?? 0,
        referral_count: refCounts.get(p.id) ?? 0,
      }))

      setPartners(withCounts)
    } catch (err: any) {
      console.error('[PartnerList] fetch error:', err)
      setError(he ? 'טעינת שותפים נכשלה. נסה שוב.' : 'Failed to load partners. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [he])

  useEffect(() => { fetchPartners() }, [fetchPartners])

  async function handleApprove(id: string) {
    if (!window.confirm(he ? 'לאשר שותף זה?' : 'Approve this partner?')) return
    const { error } = await supabase.from('community_partners').update({ status: 'active', verified_at: new Date().toISOString() }).eq('id', id)
    if (error) {
      alert(he ? 'אישור נכשל' : 'Approval failed')
    } else {
      fetchPartners()
    }
  }

  async function handleReject(id: string) {
    if (!window.confirm(he ? 'לדחות שותף זה?' : 'Reject this partner?')) return
    const { error } = await supabase.from('community_partners').update({ status: 'rejected' }).eq('id', id)
    if (error) {
      alert(he ? 'דחייה נכשלה' : 'Rejection failed')
    } else {
      fetchPartners()
    }
  }

  // Filter + Sort
  const filtered = partners
    .filter(p => {
      if (search) {
        const q = search.toLowerCase()
        if (!p.display_name.toLowerCase().includes(q) && !p.slug.toLowerCase().includes(q)) return false
      }
      if (statusFilter !== 'all' && p.status !== statusFilter) return false
      return true
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'newest': return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        case 'oldest': return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        case 'referrals': return b.referral_count - a.referral_count
        case 'balance': return b.balance_cache_cents - a.balance_cache_cents
        default: return 0
      }
    })

  // Summary KPIs
  const totalCount = partners.length
  const activeCount = partners.filter(p => p.status === 'active').length
  const pendingCount = partners.filter(p => p.status === 'pending').length
  const totalBalance = partners.reduce((sum, p) => sum + p.balance_cache_cents, 0)

  const summaryKpis = [
    { label: he ? 'סה"כ' : 'Total', value: totalCount, icon: Handshake, color: C.dark },
    { label: he ? 'פעילים' : 'Active', value: activeCount, icon: CheckCircle2, color: C.success },
    { label: he ? 'ממתינים' : 'Pending', value: pendingCount, icon: Clock, color: C.warning },
    { label: he ? 'יתרות' : 'Balances', value: fmtCurrency(totalBalance), icon: DollarSign, color: C.primary },
  ]

  return (
    <div className="animate-fade-in space-y-6">
      {/* ═══ Header ═══ */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: C.dark, letterSpacing: '-0.02em' }}>
          {he ? 'שותפים' : 'Partners'}
        </h1>
        <p className="text-sm mt-1" style={{ color: C.muted }}>
          {he ? 'ניהול שותפים קהילתיים ובקשות' : 'Manage community partners & applications'}
        </p>
      </div>

      {/* ═══ Summary Strip ═══ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryKpis.map((kpi, i) => (
          <div
            key={i}
            className="flex items-center gap-3 px-4 py-3 rounded-xl"
            style={{ background: 'white', border: `1px solid ${C.border}` }}
          >
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `${kpi.color}12` }}>
              <kpi.icon className="w-4 h-4" style={{ color: kpi.color }} />
            </div>
            <div>
              <p className="text-lg font-bold" style={{ color: C.dark }}>{kpi.value}</p>
              <p className="text-[10px] font-medium uppercase tracking-wider" style={{ color: C.muted }}>{kpi.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ═══ Search + Filters ═══ */}
      <div className="flex flex-wrap items-center gap-3">
        <div
          className="flex items-center gap-2.5 flex-1 min-w-[220px] px-4 py-2.5 rounded-xl transition-all"
          style={{ background: 'white', border: `1.5px solid ${C.border}`, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
        >
          <Search className="w-4 h-4" style={{ color: C.muted }} />
          <input
            type="text"
            placeholder={he ? 'חפש שותף...' : 'Search partners...'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent border-0 text-sm outline-none"
            style={{ color: C.dark }}
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="text-xs font-medium rounded-xl px-3 py-2.5 border outline-none cursor-pointer transition-all hover:border-gray-300"
          style={{ borderColor: '#E5E7EB', color: C.dark, background: 'white' }}
        >
          <option value="all">{he ? 'כל הסטטוסים' : 'All Status'}</option>
          <option value="active">{he ? 'פעיל' : 'Active'}</option>
          <option value="pending">{he ? 'ממתין' : 'Pending'}</option>
          <option value="suspended">{he ? 'מושעה' : 'Suspended'}</option>
          <option value="rejected">{he ? 'נדחה' : 'Rejected'}</option>
        </select>

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="text-xs font-medium rounded-xl px-3 py-2.5 border outline-none cursor-pointer transition-all hover:border-gray-300"
          style={{ borderColor: '#E5E7EB', color: C.dark, background: 'white' }}
        >
          <option value="newest">{he ? 'חדש ביותר' : 'Newest'}</option>
          <option value="oldest">{he ? 'ישן ביותר' : 'Oldest'}</option>
          <option value="referrals">{he ? 'הפניות' : 'Most Referrals'}</option>
          <option value="balance">{he ? 'יתרה' : 'Highest Balance'}</option>
        </select>
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
                  he ? 'סטטוס' : 'Status',
                  he ? 'קבוצות' : 'Groups',
                  he ? 'הפניות' : 'Referrals',
                  he ? 'אחוז עמלה' : 'Rate',
                  he ? 'יתרה' : 'Balance',
                  he ? 'הצטרף' : 'Joined',
                  '',
                ].map((col, i) => (
                  <th
                    key={i}
                    className="text-start px-5 py-3.5 font-semibold text-[11px] uppercase tracking-widest"
                    style={{ color: C.muted }}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {error ? (
                <tr>
                  <td colSpan={8} className="px-5 py-16 text-center">
                    <AlertCircle className="w-8 h-8 mx-auto mb-3" style={{ color: C.danger }} />
                    <p className="text-sm font-medium mb-3" style={{ color: C.danger }}>{error}</p>
                    <button
                      onClick={() => { setLoading(true); fetchPartners() }}
                      className="px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:shadow-sm"
                      style={{ background: C.primary, color: 'white' }}
                    >
                      {he ? 'נסה שוב' : 'Try Again'}
                    </button>
                  </td>
                </tr>
              ) : loading ? (
                <tr>
                  <td colSpan={8} className="px-5 py-16 text-center">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" style={{ color: C.muted }} />
                    <p className="text-sm" style={{ color: C.muted }}>{he ? 'טוען...' : 'Loading...'}</p>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-16 text-center">
                    <Handshake className="w-8 h-8 mx-auto mb-3" style={{ color: '#D1D5DB' }} />
                    <p className="text-sm font-medium" style={{ color: C.muted }}>
                      {he ? 'אין שותפים' : 'No partners found'}
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map((p, idx) => {
                  const statusConf = STATUS_CONFIG[p.status] ?? { color: C.muted, bg: '#F3F4F6', label: p.status, labelHe: p.status }
                  const initials = p.display_name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)

                  return (
                    <tr
                      key={p.id}
                      className="group transition-colors cursor-pointer"
                      style={{ borderBottom: idx < filtered.length - 1 ? `1px solid ${C.border}` : undefined }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#FAFBFC')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      onClick={() => navigate(`/admin/partners/list/${p.id}`)}
                    >
                      {/* Partner */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          {p.avatar_url ? (
                            <img src={p.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover" />
                          ) : (
                            <div
                              className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                              style={{ background: `${C.primary}15`, color: C.primary }}
                            >
                              {initials}
                            </div>
                          )}
                          <div>
                            <div className="font-semibold text-[13px]" style={{ color: C.dark }}>{p.display_name}</div>
                            <div className="text-[11px] mt-0.5" style={{ color: C.muted }}>@{p.slug}</div>
                          </div>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-5 py-4">
                        <span
                          className="inline-flex items-center text-[11px] font-semibold px-2 py-1 rounded-lg"
                          style={{ background: statusConf.bg, color: statusConf.color }}
                        >
                          {he ? statusConf.labelHe : statusConf.label}
                        </span>
                      </td>

                      {/* Groups */}
                      <td className="px-5 py-4">
                        <span className="text-[12px] font-semibold" style={{ color: p.group_count > 0 ? C.dark : '#D1D5DB' }}>
                          {p.group_count || '\u2014'}
                        </span>
                      </td>

                      {/* Referrals */}
                      <td className="px-5 py-4">
                        <span className="text-[12px] font-semibold" style={{ color: p.referral_count > 0 ? C.primary : '#D1D5DB' }}>
                          {p.referral_count || '0'}
                        </span>
                      </td>

                      {/* Commission Rate */}
                      <td className="px-5 py-4">
                        <span className="text-[12px] font-medium" style={{ color: C.dark }}>
                          {(p.commission_rate * 100).toFixed(0)}%
                        </span>
                      </td>

                      {/* Balance */}
                      <td className="px-5 py-4">
                        <span className="text-[12px] font-bold" style={{ color: p.balance_cache_cents > 0 ? C.success : '#D1D5DB' }}>
                          {p.balance_cache_cents > 0 ? fmtCurrency(p.balance_cache_cents) : '\u2014'}
                        </span>
                      </td>

                      {/* Joined */}
                      <td className="px-5 py-4">
                        <span className="text-[11px]" style={{ color: C.muted }}>
                          {fmtDate(p.created_at)}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                          {p.status === 'pending' && (
                            <>
                              <button
                                onClick={() => handleApprove(p.id)}
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all hover:shadow-sm active:scale-95"
                                style={{ background: C.success, color: 'white' }}
                              >
                                <UserCheck className="w-3 h-3" />
                                {he ? 'אשר' : 'Approve'}
                              </button>
                              <button
                                onClick={() => handleReject(p.id)}
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all hover:shadow-sm active:scale-95"
                                style={{ background: C.danger, color: 'white' }}
                              >
                                <UserX className="w-3 h-3" />
                                {he ? 'דחה' : 'Reject'}
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => navigate(`/admin/partners/list/${p.id}`)}
                            className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:bg-gray-100 active:scale-95"
                            style={{ color: C.muted }}
                          >
                            <ChevronRight className="w-4 h-4" />
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
    </div>
  )
}
