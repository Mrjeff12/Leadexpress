import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useI18n } from '../../lib/i18n'
import { supabase } from '../../lib/supabase'
import { fmtDate } from '../../lib/shared'
import {
  Search,
  ChevronRight,
  Loader2,
  AlertCircle,
  UserCheck,
  UserX,
  Clock,
  Users,
  Handshake,
  DollarSign,
  LinkIcon,
  Shield,
  Ban,
  CheckCircle2,
  X,
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
  bio: string | null
  avatar_url: string | null
  location: string | null
  commission_rate: number
  status: string
  verified_at: string | null
  balance_cache_cents: number
  created_at: string
  stats: { referrals?: number; earned_cents?: number } | null
}

const STATUS_CONFIG: Record<string, { color: string; bg: string; label: string; labelHe: string; icon: typeof Clock }> = {
  pending:   { color: C.warning, bg: '#FFFBEB', label: 'Pending',   labelHe: 'ממתין',   icon: Clock },
  active:    { color: C.success, bg: '#ECFDF5', label: 'Active',    labelHe: 'פעיל',    icon: CheckCircle2 },
  suspended: { color: C.danger,  bg: '#FEF2F2', label: 'Suspended', labelHe: 'מושהה',   icon: Ban },
  rejected:  { color: C.muted,   bg: '#F3F4F6', label: 'Rejected',  labelHe: 'נדחה',    icon: UserX },
}

type StatusFilter = 'all' | 'pending' | 'active' | 'suspended' | 'rejected'

function fmtCurrency(cents: number): string {
  return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

export default function PartnerList() {
  const navigate = useNavigate()
  const { locale } = useI18n()
  const he = locale === 'he'

  const [partners, setPartners] = useState<Partner[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const fetchPartners = useCallback(async () => {
    setError(null)
    setLoading(true)
    try {
      const { data, error: err } = await supabase
        .from('community_partners')
        .select('id, user_id, slug, display_name, bio, avatar_url, location, commission_rate, status, verified_at, balance_cache_cents, created_at, stats')
        .order('created_at', { ascending: false })

      if (err) throw err
      setPartners(data ?? [])
    } catch (err: any) {
      console.error('[PartnerList] fetch error:', err)
      setError(he ? 'טעינת שותפים נכשלה' : 'Failed to load partners')
    } finally {
      setLoading(false)
    }
  }, [he])

  useEffect(() => { fetchPartners() }, [fetchPartners])

  async function handleApprove(partnerId: string) {
    setActionLoading(partnerId)
    try {
      const { error } = await supabase.rpc('approve_partner', { partner_id: partnerId })
      if (error) throw error
      await fetchPartners()
    } catch (err: any) {
      alert(he ? 'אישור שותף נכשל' : 'Failed to approve partner')
    } finally {
      setActionLoading(null)
    }
  }

  async function handleStatusChange(partnerId: string, newStatus: string) {
    setActionLoading(partnerId)
    try {
      const { error } = await supabase
        .from('community_partners')
        .update({ status: newStatus })
        .eq('id', partnerId)
      if (error) throw error
      await fetchPartners()
    } catch (err: any) {
      alert(he ? 'עדכון סטטוס נכשל' : 'Failed to update status')
    } finally {
      setActionLoading(null)
    }
  }

  // Filter & search
  const filtered = partners.filter(p => {
    if (statusFilter !== 'all' && p.status !== statusFilter) return false
    if (search) {
      const q = search.toLowerCase()
      return (
        p.display_name.toLowerCase().includes(q) ||
        p.slug.toLowerCase().includes(q) ||
        (p.location ?? '').toLowerCase().includes(q)
      )
    }
    return true
  })

  // Stats
  const counts = {
    all: partners.length,
    pending: partners.filter(p => p.status === 'pending').length,
    active: partners.filter(p => p.status === 'active').length,
    suspended: partners.filter(p => p.status === 'suspended').length,
    rejected: partners.filter(p => p.status === 'rejected').length,
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
            onClick={fetchPartners}
            className="px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:shadow-sm"
            style={{ background: C.primary, color: 'white' }}
          >
            {he ? 'נסה שוב' : 'Try Again'}
          </button>
        </div>
      </div>
    )
  }

  const statusFilters: { key: StatusFilter; label: string }[] = [
    { key: 'all', label: he ? `הכל (${counts.all})` : `All (${counts.all})` },
    { key: 'pending', label: he ? `ממתינים (${counts.pending})` : `Pending (${counts.pending})` },
    { key: 'active', label: he ? `פעילים (${counts.active})` : `Active (${counts.active})` },
    { key: 'suspended', label: he ? `מושהים (${counts.suspended})` : `Suspended (${counts.suspended})` },
  ]

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: C.dark, letterSpacing: '-0.02em' }}>
            {he ? 'רשימת שותפים' : 'Partners'}
          </h1>
          <p className="text-sm mt-1" style={{ color: C.muted }}>
            {he ? 'ניהול שותפים קהילתיים' : 'Manage community partners'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: `${C.primary}10` }}
          >
            <Handshake className="w-5 h-5" style={{ color: C.primary }} />
          </div>
          <div>
            <div className="text-xl font-bold" style={{ color: C.dark }}>{counts.active}</div>
            <div className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: C.muted }}>
              {he ? 'פעילים' : 'Active'}
            </div>
          </div>
        </div>
      </div>

      {/* Pending alert */}
      {counts.pending > 0 && (
        <div
          className="flex items-center gap-3 px-4 py-3 rounded-xl"
          style={{ background: '#FFFBEB', border: '1px solid #FEF3C7' }}
        >
          <Clock className="w-5 h-5 shrink-0" style={{ color: C.warning }} />
          <span className="text-sm font-medium" style={{ color: C.warning }}>
            {he
              ? `${counts.pending} שותפים ממתינים לאישור`
              : `${counts.pending} partner${counts.pending > 1 ? 's' : ''} awaiting approval`}
          </span>
          <button
            onClick={() => setStatusFilter('pending')}
            className="ml-auto text-xs font-semibold px-3 py-1.5 rounded-lg transition-all hover:scale-[1.02]"
            style={{ background: C.warning, color: 'white' }}
          >
            {he ? 'סקור' : 'Review'}
          </button>
        </div>
      )}

      {/* Filters & search */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        {/* Status pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {statusFilters.map(f => (
            <button
              key={f.key}
              onClick={() => setStatusFilter(f.key)}
              className="px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all"
              style={
                statusFilter === f.key
                  ? { background: C.primary, color: 'white' }
                  : { background: '#F3F4F6', color: C.muted }
              }
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative sm:ml-auto w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: C.muted }} />
          <input
            type="text"
            placeholder={he ? 'חיפוש שותף...' : 'Search partners...'}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-xl text-sm border outline-none transition-all focus:ring-2"
            style={{
              borderColor: '#E5E7EB',
              background: 'white',
              // @ts-ignore
              '--tw-ring-color': `${C.primary}40`,
            }}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2"
            >
              <X className="w-3.5 h-3.5" style={{ color: C.muted }} />
            </button>
          )}
        </div>
      </div>

      {/* List */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: 'white', border: `1px solid ${C.border}`, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
      >
        {filtered.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <Users className="w-10 h-10 mx-auto mb-3" style={{ color: '#D1D5DB' }} />
            <p className="text-sm font-medium" style={{ color: C.muted }}>
              {search
                ? (he ? 'לא נמצאו שותפים' : 'No partners found')
                : (he ? 'אין שותפים עדיין' : 'No partners yet')}
            </p>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: C.border }}>
            {filtered.map(p => {
              const initials = p.display_name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
              const sc = STATUS_CONFIG[p.status] ?? STATUS_CONFIG.pending
              const StatusIcon = sc.icon
              const isLoading = actionLoading === p.id

              return (
                <div
                  key={p.id}
                  className="flex items-center gap-4 px-5 py-4 cursor-pointer transition-colors hover:bg-[#FAFBFC] group"
                  onClick={() => navigate(`/admin/partners/detail/${p.id}`)}
                >
                  {/* Avatar */}
                  {p.avatar_url ? (
                    <img src={p.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover shrink-0" />
                  ) : (
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-[13px] font-bold shrink-0"
                      style={{ background: `${C.primary}15`, color: C.primary }}
                    >
                      {initials}
                    </div>
                  )}

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[14px] font-semibold truncate" style={{ color: C.dark }}>
                        {p.display_name}
                      </span>
                      <span
                        className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
                        style={{ background: sc.bg, color: sc.color }}
                      >
                        <StatusIcon className="w-3 h-3" />
                        {he ? sc.labelHe : sc.label}
                      </span>
                      {p.verified_at && (
                        <Shield className="w-3.5 h-3.5 shrink-0" style={{ color: C.accent }} title="Verified" />
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-[11px]" style={{ color: C.muted }}>@{p.slug}</span>
                      {p.location && (
                        <span className="text-[11px]" style={{ color: C.muted }}>{p.location}</span>
                      )}
                      <span className="text-[11px]" style={{ color: C.muted }}>
                        {he ? 'הצטרף' : 'Joined'} {fmtDate(p.created_at)}
                      </span>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="hidden sm:flex items-center gap-5 shrink-0">
                    <div className="text-center">
                      <div className="text-[13px] font-bold" style={{ color: C.dark }}>
                        {p.stats?.referrals ?? 0}
                      </div>
                      <div className="text-[9px] uppercase tracking-wider font-semibold" style={{ color: C.muted }}>
                        {he ? 'הפניות' : 'Referrals'}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-[13px] font-bold" style={{ color: C.success }}>
                        {fmtCurrency(p.stats?.earned_cents ?? 0)}
                      </div>
                      <div className="text-[9px] uppercase tracking-wider font-semibold" style={{ color: C.muted }}>
                        {he ? 'הרוויח' : 'Earned'}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-[13px] font-bold" style={{ color: C.accent }}>
                        {p.commission_rate}%
                      </div>
                      <div className="text-[9px] uppercase tracking-wider font-semibold" style={{ color: C.muted }}>
                        {he ? 'עמלה' : 'Rate'}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-[13px] font-bold" style={{ color: C.dark }}>
                        {fmtCurrency(p.balance_cache_cents)}
                      </div>
                      <div className="text-[9px] uppercase tracking-wider font-semibold" style={{ color: C.muted }}>
                        {he ? 'יתרה' : 'Balance'}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0" onClick={e => e.stopPropagation()}>
                    {p.status === 'pending' && (
                      <>
                        <button
                          onClick={() => handleApprove(p.id)}
                          disabled={isLoading}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all hover:scale-[1.02] active:scale-[0.98]"
                          style={{ background: C.success, color: 'white' }}
                        >
                          {isLoading ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <UserCheck className="w-3 h-3" />
                          )}
                          {he ? 'אשר' : 'Approve'}
                        </button>
                        <button
                          onClick={() => handleStatusChange(p.id, 'rejected')}
                          disabled={isLoading}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all hover:scale-[1.02] active:scale-[0.98]"
                          style={{ background: '#FEF2F2', color: C.danger }}
                        >
                          <UserX className="w-3 h-3" />
                          {he ? 'דחה' : 'Reject'}
                        </button>
                      </>
                    )}
                    {p.status === 'active' && (
                      <button
                        onClick={() => handleStatusChange(p.id, 'suspended')}
                        disabled={isLoading}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all opacity-0 group-hover:opacity-100"
                        style={{ background: '#FEF2F2', color: C.danger }}
                      >
                        <Ban className="w-3 h-3" />
                        {he ? 'השהה' : 'Suspend'}
                      </button>
                    )}
                    {p.status === 'suspended' && (
                      <button
                        onClick={() => handleStatusChange(p.id, 'active')}
                        disabled={isLoading}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all opacity-0 group-hover:opacity-100"
                        style={{ background: '#ECFDF5', color: C.success }}
                      >
                        <UserCheck className="w-3 h-3" />
                        {he ? 'הפעל' : 'Reactivate'}
                      </button>
                    )}
                  </div>

                  {/* Chevron */}
                  <ChevronRight
                    className="w-4 h-4 shrink-0 transition-transform group-hover:translate-x-0.5"
                    style={{ color: '#D1D5DB' }}
                  />
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Footer count */}
      <div className="text-center">
        <p className="text-[11px]" style={{ color: C.muted }}>
          {he
            ? `מציג ${filtered.length} מתוך ${partners.length} שותפים`
            : `Showing ${filtered.length} of ${partners.length} partners`}
        </p>
      </div>
    </div>
  )
}
