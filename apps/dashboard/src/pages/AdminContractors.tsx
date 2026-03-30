import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useI18n } from '../lib/i18n'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { formatDate } from '../lib/shared'
import { exportToCsv, csvDate, type CsvColumn } from '../lib/csv-export'
import BulkActionBar, { type BulkAction } from '../components/admin/BulkActionBar'
import {
  Users,
  CheckCircle2,
  XCircle,
  Search,
  QrCode,
  X,
  Copy,
  Check,
  ExternalLink,
  Download,
  UserPlus,
  Eye,
  ChevronRight,
  UsersRound,
  Crown,
  Zap,
  TrendingUp,
  Loader2,
  Ban,
  Bell,
  RefreshCw,
  AlertTriangle,
  ShieldAlert,
} from 'lucide-react'

/* ── Design tokens ──────────────────────────────────────────────── */
const C = {
  primary: '#fe5b25',
  dark: '#1C1C1E',
  cream: '#FAFAF8',
  border: 'rgba(0,0,0,0.06)',
  muted: '#8E8E93',
  accent: '#5856D6',
  success: '#34C759',
  warning: '#FF9500',
  danger: '#FF3B30',
}

const BOT_NAME = 'MasterLeadFlowBot'

interface Contractor {
  user_id: string
  professions: string[]
  zip_codes: string[]
  is_active: boolean
  created_at: string
  profiles: {
    full_name: string | null
    telegram_chat_id: number | null
    phone: string | null
    status?: string
    subscriptions: {
      status: string
      plans: { name: string; slug: string; price_cents: number }
    }[]
  }
}

const USER_STATUS_CONFIG: Record<string, { color: string; bg: string; label: string; icon: typeof Ban }> = {
  active: { color: '#059669', bg: '#ECFDF5', label: 'Active', icon: CheckCircle2 },
  suspended: { color: '#D97706', bg: '#FFFBEB', label: 'Suspended', icon: AlertTriangle },
  banned: { color: '#DC2626', bg: '#FEF2F2', label: 'Banned', icon: Ban },
}

const PROF_EMOJI: Record<string, string> = {
  hvac: '❄️', renovation: '🔨', fencing: '🧱', cleaning: '✨',
  locksmith: '🔑', plumbing: '🚰', electrical: '⚡', roofing: '🏠',
  painting: '🎨', landscaping: '🌿', other: '📋',
}

const PLAN_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; icon: typeof Crown }> = {
  starter: { label: 'Starter', color: '#6B7280', bg: '#F3F4F6', border: '#E5E7EB', icon: Zap },
  pro: { label: 'Pro', color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE', icon: Crown },
  unlimited: { label: 'Unlimited', color: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE', icon: Crown },
}

const STATUS_COLORS: Record<string, { color: string; bg: string }> = {
  active: { color: '#059669', bg: '#ECFDF5' },
  trialing: { color: '#2563EB', bg: '#EFF6FF' },
  past_due: { color: '#D97706', bg: '#FFFBEB' },
  canceled: { color: '#DC2626', bg: '#FEF2F2' },
  paused: { color: '#D97706', bg: '#FFFBEB' },
}

function qrUrl(data: string, size = 300): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(data)}&bgcolor=FAFAF8&color=2D6A4F&margin=10`
}

export default function AdminContractors() {
  const { locale } = useI18n()
  const { impersonate, profile } = useAuth()
  const navigate = useNavigate()
  const he = locale === 'he'

  const [contractors, setContractors] = useState<Contractor[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [planFilter, setPlanFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [subCounts, setSubCounts] = useState<Record<string, number>>({})
  const [leadCounts, setLeadCounts] = useState<Record<string, number>>({})

  const [fetchError, setFetchError] = useState<string | null>(null)
  const [qrModal, setQrModal] = useState<{ contractor: Contractor; token: string; url: string } | null>(null)
  const [copied, setCopied] = useState(false)
  const [availablePlans, setAvailablePlans] = useState<{ id: string; slug: string; name: string; price_cents: number }[]>([])
  const [showInvite, setShowInvite] = useState(false)
  const [invitePhone, setInvitePhone] = useState('')
  const [inviteSending, setInviteSending] = useState(false)

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showBulkPlanModal, setShowBulkPlanModal] = useState(false)
  const [showBulkSuspendModal, setShowBulkSuspendModal] = useState(false)
  const [showBulkNotifyModal, setShowBulkNotifyModal] = useState(false)
  const [bulkSuspendReason, setBulkSuspendReason] = useState('')
  const [bulkNotifyMessage, setBulkNotifyMessage] = useState('')
  const [bulkProcessing, setBulkProcessing] = useState(false)

  useEffect(() => {
    supabase.from('plans').select('id, slug, name, price_cents').eq('is_active', true).order('price_cents')
      .then(({ data }) => { if (data) setAvailablePlans(data) })
  }, [])

  async function quickChangePlan(userId: string, planId: string, e: React.MouseEvent) {
    e.stopPropagation()
    await supabase.from('subscriptions').update({ plan_id: planId }).eq('user_id', userId).in('status', ['active', 'trialing'])
    await supabase.from('audit_logs').insert({
      admin_user_id: profile?.id,
      target_user_id: userId,
      action: 'plan_change',
      details: { new_plan_id: planId, source: 'bulk_list' },
    })
    fetchContractors()
  }

  const fetchContractors = useCallback(async () => {
    setFetchError(null)
    const { data, error } = await supabase
      .from('contractors')
      .select(`
        user_id, professions, zip_codes, is_active, created_at,
        profiles!inner(full_name, telegram_chat_id, phone, status, subscriptions(status, plans(name, slug, price_cents)))
      `)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[AdminContractors] fetch error:', error.message)
      setFetchError(he ? 'טעינת קבלנים נכשלה. נסה שוב.' : 'Failed to load contractors. Please try again.')
      setLoading(false)
      return
    }
    if (data) {
      const typed = data as unknown as Contractor[]
      setContractors(typed)

      const userIds = typed.map((c) => c.user_id)
      if (userIds.length > 0) {
        // Fetch subcontractor counts
        const { data: subs } = await supabase
          .from('subcontractors')
          .select('contractor_id')
          .in('contractor_id', userIds)
        if (subs) {
          const counts: Record<string, number> = {}
          subs.forEach((s: any) => { counts[s.contractor_id] = (counts[s.contractor_id] || 0) + 1 })
          setSubCounts(counts)
        }

        // Fetch lead contact event counts
        const { data: events } = await supabase
          .from('lead_contact_events')
          .select('user_id')
          .in('user_id', userIds)
        if (events) {
          const counts: Record<string, number> = {}
          events.forEach((e: any) => { counts[e.user_id] = (counts[e.user_id] || 0) + 1 })
          setLeadCounts(counts)
        }
      }
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchContractors() }, [fetchContractors])

  // Helpers
  const getSub = (c: Contractor) => c.profiles?.subscriptions?.[0]
  const getPlanSlug = (c: Contractor) => getSub(c)?.plans?.slug ?? 'none'
  const getSubStatus = (c: Contractor) => getSub(c)?.status ?? 'none'
  const getMonthlyFee = (c: Contractor) => { const cents = getSub(c)?.plans?.price_cents; return cents ? cents / 100 : 0 }

  const filtered = contractors.filter((c) => {
    if (search) {
      const q = search.toLowerCase()
      const name = c.profiles?.full_name?.toLowerCase() ?? ''
      const phone = c.profiles?.phone?.toLowerCase() ?? ''
      if (!name.includes(q) && !phone.includes(q)) return false
    }
    if (planFilter !== 'all' && getPlanSlug(c) !== planFilter) return false
    if (statusFilter === 'active' && !c.is_active) return false
    if (statusFilter === 'inactive' && c.is_active) return false
    if (statusFilter === 'suspended' && (c.profiles?.status ?? 'active') !== 'suspended') return false
    if (statusFilter === 'banned' && (c.profiles?.status ?? 'active') !== 'banned') return false
    return true
  })

  const activeCount = contractors.filter((c) => c.is_active).length
  const withSubsCount = contractors.filter((c) => (subCounts[c.user_id] ?? 0) > 0).length
  const totalRevenue = contractors.reduce((sum, c) => sum + getMonthlyFee(c), 0)

  // ── Selection helpers ──
  function toggleSelect(userId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(userId)) next.delete(userId)
      else next.add(userId)
      return next
    })
  }

  function toggleSelectAll() {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filtered.map((c) => c.user_id)))
    }
  }

  const selectedContractors = filtered.filter((c) => selectedIds.has(c.user_id))

  // ── CSV Export ──
  const csvColumns: CsvColumn<Contractor>[] = [
    { header: 'Name', accessor: (c) => c.profiles?.full_name ?? '' },
    { header: 'Phone', accessor: (c) => c.profiles?.phone ?? '' },
    { header: 'Plan', accessor: (c) => getSub(c)?.plans?.name ?? 'None' },
    { header: 'Subscription Status', accessor: (c) => getSubStatus(c) },
    { header: 'Active', accessor: (c) => c.is_active ? 'Yes' : 'No' },
    { header: 'Professions', accessor: (c) => c.professions.join(', ') },
    { header: 'ZIP Codes', accessor: (c) => c.zip_codes.join(', ') },
    { header: 'Subcontractors', accessor: (c) => subCounts[c.user_id] ?? 0 },
    { header: 'Leads', accessor: (c) => leadCounts[c.user_id] ?? 0 },
    { header: 'Monthly Revenue ($)', accessor: (c) => getMonthlyFee(c) },
    { header: 'Telegram Connected', accessor: (c) => c.profiles?.telegram_chat_id ? 'Yes' : 'No' },
    { header: 'Joined', accessor: (c) => csvDate(c.created_at) },
  ]

  function exportAllCsv() {
    exportToCsv(filtered, csvColumns, `contractors-${new Date().toISOString().slice(0, 10)}`)
  }

  function exportSelectedCsv() {
    exportToCsv(selectedContractors, csvColumns, `contractors-selected-${new Date().toISOString().slice(0, 10)}`)
  }

  // ── Bulk Actions ──
  async function bulkChangePlan(planId: string) {
    setBulkProcessing(true)
    try {
      for (const uid of selectedIds) {
        await supabase.from('subscriptions').update({ plan_id: planId }).eq('user_id', uid).in('status', ['active', 'trialing'])
        await supabase.from('audit_logs').insert({
          admin_user_id: profile?.id,
          target_user_id: uid,
          action: 'plan_change',
          details: { new_plan_id: planId, source: 'bulk_action' },
        })
      }
      setShowBulkPlanModal(false)
      setSelectedIds(new Set())
      fetchContractors()
    } finally {
      setBulkProcessing(false)
    }
  }

  async function bulkSuspend() {
    setBulkProcessing(true)
    try {
      for (const uid of selectedIds) {
        await supabase.from('contractors').update({ is_active: false }).eq('user_id', uid)
        await supabase.from('audit_logs').insert({
          admin_user_id: profile?.id,
          target_user_id: uid,
          action: 'suspend',
          details: { reason: bulkSuspendReason, source: 'bulk_action' },
        })
      }
      setShowBulkSuspendModal(false)
      setBulkSuspendReason('')
      setSelectedIds(new Set())
      fetchContractors()
    } finally {
      setBulkProcessing(false)
    }
  }

  async function bulkNotify() {
    setBulkProcessing(true)
    try {
      await supabase.functions.invoke('bulk-notify', {
        body: { user_ids: Array.from(selectedIds), message: bulkNotifyMessage },
      })
      setShowBulkNotifyModal(false)
      setBulkNotifyMessage('')
      setSelectedIds(new Set())
    } catch (err) {
      console.error('[AdminContractors] bulk notify error:', err)
    } finally {
      setBulkProcessing(false)
    }
  }

  const bulkActions: BulkAction[] = [
    { key: 'plan', label: he ? 'שנה חבילה' : 'Change Plan', icon: RefreshCw, onClick: () => setShowBulkPlanModal(true) },
    { key: 'suspend', label: he ? 'השהה' : 'Suspend', icon: Ban, variant: 'danger', onClick: () => setShowBulkSuspendModal(true) },
    { key: 'notify', label: he ? 'שלח הודעה' : 'Send Notification', icon: Bell, onClick: () => setShowBulkNotifyModal(true) },
  ]

  async function generateQr(contractor: Contractor) {
    const token = crypto.randomUUID().replace(/-/g, '').slice(0, 16)
    const url = `https://t.me/${BOT_NAME}?start=${token}`
    setQrModal({ contractor, token, url })
    setCopied(false)
  }

  async function copyLink() {
    if (!qrModal) return
    await navigator.clipboard.writeText(qrModal.url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function downloadQr() {
    if (!qrModal) return
    const name = qrModal.contractor.profiles?.full_name ?? 'contractor'
    const imgUrl = qrUrl(qrModal.url, 600)
    const res = await fetch(imgUrl)
    const blob = await res.blob()
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `masterleadflow-qr-${name.toLowerCase().replace(/\s+/g, '-')}.png`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div className="animate-fade-in space-y-6">
      {/* ═══ Header ═══ */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: C.dark, letterSpacing: '-0.02em' }}>
            {he ? 'קבלנים' : 'Contractors'}
          </h1>
          <p className="text-sm mt-1" style={{ color: C.muted }}>
            {he ? 'ניהול קבלנים, חבילות ותת-קבלנים' : 'Manage contractors, plans & subcontractors'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportAllCsv}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all hover:scale-[1.02] active:scale-[0.98] shadow-sm border"
            style={{ background: 'white', color: C.dark, borderColor: '#E5E7EB' }}
          >
            <Download className="w-4 h-4" />
            {he ? 'יצוא CSV' : 'Export CSV'}
          </button>
          <button
            onClick={() => setShowInvite(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all hover:scale-[1.02] active:scale-[0.98] shadow-sm"
            style={{ background: C.primary, color: 'white' }}
          >
            <UserPlus className="w-4 h-4" />
            {he ? 'הוסף קבלן' : 'Add Contractor'}
          </button>
        </div>
      </div>

      {/* ═══ KPI Cards ═══ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: he ? 'סה״כ' : 'Total', value: contractors.length, icon: Users, color: C.dark, gradient: 'linear-gradient(135deg, #F8F9FA 0%, #E9ECEF 100%)' },
          { label: he ? 'פעילים' : 'Active', value: activeCount, icon: CheckCircle2, color: C.success, gradient: 'linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 100%)' },
          { label: he ? 'עם תת-קבלנים' : 'With Subs', value: withSubsCount, icon: UsersRound, color: C.accent, gradient: 'linear-gradient(135deg, #F5F3FF 0%, #EDE9FE 100%)' },
          { label: he ? 'הכנסה חודשית' : 'MRR', value: `$${totalRevenue.toLocaleString()}`, icon: TrendingUp, color: C.primary, gradient: 'linear-gradient(135deg, #FFF7ED 0%, #FFEDD5 100%)' },
        ].map((kpi, i) => (
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

      {/* ═══ Search + Filters ═══ */}
      <div className="flex flex-wrap items-center gap-3">
        <div
          className="flex items-center gap-2.5 flex-1 min-w-[220px] px-4 py-2.5 rounded-xl transition-all"
          style={{ background: 'white', border: `1.5px solid ${C.border}`, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
        >
          <Search className="w-4 h-4" style={{ color: C.muted }} />
          <input
            type="text"
            placeholder={he ? 'חפש קבלן...' : 'Search contractors...'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent border-0 text-sm outline-none"
            style={{ color: C.dark }}
          />
        </div>

        <select
          value={planFilter}
          onChange={(e) => setPlanFilter(e.target.value)}
          className="text-xs font-medium rounded-xl px-3 py-2.5 border outline-none cursor-pointer transition-all hover:border-gray-300"
          style={{ borderColor: '#E5E7EB', color: C.dark, background: 'white' }}
        >
          <option value="all">{he ? 'כל החבילות' : 'All Plans'}</option>
          <option value="starter">Starter</option>
          <option value="pro">Pro</option>
          <option value="unlimited">Unlimited</option>
          <option value="none">{he ? 'ללא חבילה' : 'No Plan'}</option>
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="text-xs font-medium rounded-xl px-3 py-2.5 border outline-none cursor-pointer transition-all hover:border-gray-300"
          style={{ borderColor: '#E5E7EB', color: C.dark, background: 'white' }}
        >
          <option value="all">{he ? 'כל הסטטוסים' : 'All Status'}</option>
          <option value="active">{he ? 'פעיל' : 'Active'}</option>
          <option value="inactive">{he ? 'לא פעיל' : 'Inactive'}</option>
          <option value="suspended">{he ? 'מושעה' : 'Suspended'}</option>
          <option value="banned">{he ? 'חסום' : 'Banned'}</option>
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
                <th className="px-3 py-3.5 w-10">
                  <input
                    type="checkbox"
                    checked={filtered.length > 0 && selectedIds.size === filtered.length}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded border-gray-300 text-[#fe5b25] focus:ring-[#fe5b25] cursor-pointer"
                  />
                </th>
                {[
                  he ? 'קבלן' : 'Contractor',
                  he ? 'חבילה' : 'Plan',
                  he ? 'מקצועות' : 'Professions',
                  he ? 'תת-קבלנים' : 'Subs',
                  he ? 'לידים' : 'Leads',
                  'Telegram',
                  he ? 'הכנסה' : 'Revenue',
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
              {fetchError ? (
                <tr>
                  <td colSpan={10} className="px-5 py-16 text-center">
                    <XCircle className="w-8 h-8 mx-auto mb-3" style={{ color: C.danger }} />
                    <p className="text-sm font-medium mb-3" style={{ color: C.danger }}>{fetchError}</p>
                    <button
                      onClick={() => { setLoading(true); fetchContractors() }}
                      className="px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:shadow-sm"
                      style={{ background: C.primary, color: 'white' }}
                    >
                      {he ? 'נסה שוב' : 'Try Again'}
                    </button>
                  </td>
                </tr>
              ) : loading ? (
                <tr>
                  <td colSpan={10} className="px-5 py-16 text-center">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" style={{ color: C.muted }} />
                    <p className="text-sm" style={{ color: C.muted }}>Loading...</p>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-5 py-16 text-center">
                    <Users className="w-8 h-8 mx-auto mb-3" style={{ color: '#D1D5DB' }} />
                    <p className="text-sm font-medium" style={{ color: C.muted }}>
                      {he ? 'אין קבלנים' : 'No contractors found'}
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map((c, idx) => {
                  const planSlug = getPlanSlug(c)
                  const planConf = PLAN_CONFIG[planSlug]
                  const subStatus = getSubStatus(c)
                  const statusConf = STATUS_COLORS[subStatus]
                  const monthlyFee = getMonthlyFee(c)
                  const subCount = subCounts[c.user_id] ?? 0
                  const leadCount = leadCounts[c.user_id] ?? 0
                  const initials = (c.profiles?.full_name ?? '?')
                    .split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)

                  return (
                    <tr
                      key={c.user_id}
                      className="group transition-colors cursor-pointer"
                      style={{
                        borderBottom: idx < filtered.length - 1 ? `1px solid ${C.border}` : undefined,
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#FAFBFC')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      onClick={() => navigate(`/admin/clients/contractors/${c.user_id}`)}
                    >
                      {/* Checkbox */}
                      <td className="px-3 py-4" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(c.user_id)}
                          onChange={() => toggleSelect(c.user_id)}
                          className="w-4 h-4 rounded border-gray-300 text-[#fe5b25] focus:ring-[#fe5b25] cursor-pointer"
                        />
                      </td>
                      {/* Contractor */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                            style={{
                              background: c.is_active
                                ? `hsl(${(c.user_id.charCodeAt(0) * 47) % 360}, 45%, 92%)`
                                : '#F3F4F6',
                              color: c.is_active
                                ? `hsl(${(c.user_id.charCodeAt(0) * 47) % 360}, 45%, 40%)`
                                : '#9CA3AF',
                            }}
                          >
                            {initials}
                          </div>
                          <div>
                            <div className="font-semibold text-[13px]" style={{ color: C.dark }}>
                              {c.profiles?.full_name ?? '—'}
                            </div>
                            {c.profiles?.phone && (
                              <div className="text-[11px] mt-0.5" style={{ color: C.muted }}>
                                {c.profiles.phone}
                              </div>
                            )}
                          </div>
                          {(() => {
                            const uStatus = c.profiles?.status ?? 'active'
                            const uConf = USER_STATUS_CONFIG[uStatus]
                            if (uStatus !== 'active' && uConf) {
                              return (
                                <span
                                  className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded"
                                  style={{ background: uConf.bg, color: uConf.color }}
                                >
                                  <uConf.icon className="w-2.5 h-2.5" />
                                  {uConf.label}
                                </span>
                              )
                            }
                            if (!c.is_active) {
                              return (
                                <span
                                  className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                                  style={{ background: '#FEF2F2', color: '#DC2626' }}
                                >
                                  {he ? 'מושבת' : 'OFF'}
                                </span>
                              )
                            }
                            return null
                          })()}
                        </div>
                      </td>

                      {/* Plan — clickable dropdown */}
                      <td className="px-5 py-4" onClick={e => e.stopPropagation()}>
                        <select
                          value={c.profiles?.subscriptions?.[0]?.plans?.slug || ''}
                          onChange={(e) => {
                            const plan = availablePlans.find(p => p.slug === e.target.value)
                            if (plan) quickChangePlan(c.user_id, plan.id, e as any)
                          }}
                          className="text-[11px] font-semibold rounded-lg px-2 py-1.5 border cursor-pointer appearance-none bg-no-repeat bg-right pr-6 transition-colors hover:border-indigo-300"
                          style={{
                            background: planConf?.bg ?? '#F3F4F6',
                            color: planConf?.color ?? '#9CA3AF',
                            borderColor: planConf?.border ?? '#E5E7EB',
                            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239CA3AF' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
                            backgroundPosition: 'right 6px center',
                          }}
                        >
                          {!planConf && <option value="">None</option>}
                          {availablePlans.map(p => (
                            <option key={p.slug} value={p.slug}>{p.name} — ${p.price_cents / 100}/mo</option>
                          ))}
                        </select>
                        {statusConf && (
                          <span
                            className="block text-[10px] font-medium px-1.5 py-0.5 rounded w-fit mt-1"
                            style={{ background: statusConf.bg, color: statusConf.color }}
                          >
                            {subStatus}
                          </span>
                        )}
                      </td>

                      {/* Professions */}
                      <td className="px-5 py-4">
                        <div className="flex gap-0.5">
                          {c.professions.slice(0, 4).map((p) => (
                            <span key={p} title={p} className="text-base leading-none">{PROF_EMOJI[p] ?? '📋'}</span>
                          ))}
                          {c.professions.length > 4 && (
                            <span className="text-[10px] font-medium ml-0.5" style={{ color: C.muted }}>+{c.professions.length - 4}</span>
                          )}
                          {c.professions.length === 0 && <span className="text-[11px]" style={{ color: '#D1D5DB' }}>—</span>}
                        </div>
                      </td>

                      {/* Subcontractors */}
                      <td className="px-5 py-4">
                        {subCount > 0 ? (
                          <span
                            className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-lg"
                            style={{ background: '#F5F3FF', color: '#7C3AED' }}
                          >
                            <UsersRound className="w-3 h-3" />
                            {subCount}
                          </span>
                        ) : (
                          <span className="text-[11px]" style={{ color: '#D1D5DB' }}>—</span>
                        )}
                      </td>

                      {/* Leads */}
                      <td className="px-5 py-4">
                        {leadCount > 0 ? (
                          <span className="text-[12px] font-semibold" style={{ color: C.primary }}>
                            {leadCount}
                          </span>
                        ) : (
                          <span className="text-[11px]" style={{ color: '#D1D5DB' }}>0</span>
                        )}
                      </td>

                      {/* Telegram */}
                      <td className="px-5 py-4">
                        {c.profiles?.telegram_chat_id ? (
                          <span
                            className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-lg"
                            style={{ background: '#ECFDF5', color: '#059669' }}
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            {he ? 'מחובר' : 'On'}
                          </span>
                        ) : (
                          <span
                            className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-lg"
                            style={{ background: '#FEF2F2', color: '#DC2626' }}
                          >
                            <XCircle className="w-3 h-3" />
                            {he ? 'לא' : 'Off'}
                          </span>
                        )}
                      </td>

                      {/* Revenue */}
                      <td className="px-5 py-4">
                        {monthlyFee > 0 ? (
                          <span className="text-[12px] font-bold" style={{ color: '#059669' }}>
                            ${monthlyFee}
                            <span className="font-normal text-[10px]" style={{ color: C.muted }}>/mo</span>
                          </span>
                        ) : (
                          <span className="text-[11px]" style={{ color: '#D1D5DB' }}>—</span>
                        )}
                      </td>

                      {/* Joined */}
                      <td className="px-5 py-4">
                        <span className="text-[11px]" style={{ color: C.muted }}>
                          {c.created_at ? formatDate(c.created_at) : '—'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={async () => { await impersonate(c.user_id); navigate('/') }}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all hover:shadow-sm active:scale-95"
                            style={{ background: C.dark, color: 'white' }}
                          >
                            <Eye className="w-3 h-3" />
                            {he ? 'צפה' : 'View'}
                          </button>
                          {!c.profiles?.telegram_chat_id && (
                            <button
                              onClick={() => generateQr(c)}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all hover:shadow-sm active:scale-95"
                              style={{ background: C.primary, color: 'white' }}
                            >
                              <QrCode className="w-3 h-3" />
                              QR
                            </button>
                          )}
                          <button
                            onClick={() => navigate(`/admin/clients/contractors/${c.user_id}`)}
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

      {/* ═══ Invite Modal ═══ */}
      {showInvite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowInvite(false)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-md" />
          <div
            className="relative rounded-2xl p-7 w-full max-w-sm animate-fade-in"
            style={{ background: 'white', boxShadow: '0 25px 50px rgba(0,0,0,0.15)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <button onClick={() => setShowInvite(false)} className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-gray-100 transition" aria-label="Close" style={{ color: C.muted }}>
              <X className="w-4 h-4" />
            </button>
            <h2 className="text-lg font-bold mb-1" style={{ color: C.dark }}>
              {he ? 'הזמן קבלן' : 'Invite Contractor'}
            </h2>
            <p className="text-sm mb-5" style={{ color: C.muted }}>
              {he ? 'שלח קישור הרשמה בWhatsApp' : 'Send a signup link via WhatsApp'}
            </p>
            <label className="block text-sm font-medium mb-1.5" style={{ color: C.dark }}>
              {he ? 'מספר טלפון' : 'Phone number'}
            </label>
            <input
              type="tel"
              value={invitePhone}
              onChange={(e) => setInvitePhone(e.target.value)}
              placeholder="+1 (305) 555-0123"
              autoFocus
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-[#fe5b25]/30"
            />
            <button
              disabled={invitePhone.replace(/\D/g, '').length < 10 || inviteSending}
              onClick={async () => {
                setInviteSending(true)
                try {
                  const { data: linkData, error } = await supabase.functions.invoke('magic-login', {
                    body: { action: 'generate', phone: invitePhone.replace(/\D/g, ''), redirect_path: '/onboarding' },
                  })
                  if (error) throw error
                  const link = linkData?.link ?? ''
                  const msg = he
                    ? `היי! הוזמנת להצטרף ל-MasterLeadFlow. לחץ כאן להרשמה:\n${link}`
                    : `Hey! You've been invited to join MasterLeadFlow. Click here to sign up:\n${link}`
                  window.open(`https://wa.me/${invitePhone.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`, '_blank')
                  setShowInvite(false)
                  setInvitePhone('')
                } catch (err) {
                  console.error('[AdminContractors] Invite error:', err)
                }
                setInviteSending(false)
              }}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40"
              style={{ background: '#25D366' }}
            >
              {inviteSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
              {he ? 'שלח הזמנה בWhatsApp' : 'Send Invite via WhatsApp'}
            </button>
          </div>
        </div>
      )}

      {/* ═══ QR Modal ═══ */}
      {qrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setQrModal(null)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-md" />
          <div
            className="relative rounded-2xl p-7 w-full max-w-sm animate-fade-in"
            style={{ background: 'white', boxShadow: '0 25px 50px rgba(0,0,0,0.15)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <button onClick={() => setQrModal(null)} className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-gray-100 transition" style={{ color: C.muted }}>
              <X className="w-4 h-4" />
            </button>

            <div className="text-center mb-5">
              <h2 className="text-lg font-bold" style={{ color: C.dark }}>Telegram QR</h2>
              <p className="text-sm mt-1" style={{ color: C.muted }}>
                {qrModal.contractor.profiles?.full_name ?? 'Contractor'}
              </p>
            </div>

            <div className="flex justify-center mb-5">
              <div className="rounded-2xl p-3 shadow-lg" style={{ background: C.cream, border: '2px solid rgba(0,0,0,0.05)' }}>
                <img src={qrUrl(qrModal.url)} alt="Telegram QR" width={260} height={260} className="rounded-xl" />
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-xl p-3 mb-4" style={{ background: '#F3F4F6' }}>
              <code className="flex-1 truncate text-xs font-mono" style={{ color: C.primary }}>{qrModal.url}</code>
              <button onClick={copyLink} className="shrink-0 p-1.5 rounded-lg hover:bg-white transition" style={{ color: C.primary }}>
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={downloadQr}
                className="flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition-all hover:shadow-sm active:scale-[0.98]"
                style={{ background: '#F3F4F6', color: C.dark }}
              >
                <Download className="w-4 h-4" />
                {he ? 'הורד' : 'Download'}
              </button>
              <a
                href={qrModal.url} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition-all hover:shadow-sm active:scale-[0.98]"
                style={{ background: C.primary, color: 'white' }}
              >
                <ExternalLink className="w-4 h-4" />
                {he ? 'פתח' : 'Open'}
              </a>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Bulk Plan Change Modal ═══ */}
      {showBulkPlanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowBulkPlanModal(false)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-md" />
          <div
            className="relative rounded-2xl p-7 w-full max-w-sm animate-fade-in"
            style={{ background: 'white', boxShadow: '0 25px 50px rgba(0,0,0,0.15)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <button onClick={() => setShowBulkPlanModal(false)} className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-gray-100 transition" style={{ color: C.muted }}>
              <X className="w-4 h-4" />
            </button>
            <h2 className="text-lg font-bold mb-1" style={{ color: C.dark }}>
              {he ? 'שינוי חבילה' : 'Change Plan'}
            </h2>
            <p className="text-sm mb-5" style={{ color: C.muted }}>
              {he ? `שנה חבילה ל-${selectedIds.size} קבלנים` : `Change plan for ${selectedIds.size} contractor${selectedIds.size !== 1 ? 's' : ''}`}
            </p>
            <div className="space-y-2">
              {availablePlans.map((plan) => (
                <button
                  key={plan.id}
                  disabled={bulkProcessing}
                  onClick={() => bulkChangePlan(plan.id)}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-xl border text-sm font-medium transition-all hover:border-indigo-300 hover:bg-indigo-50 disabled:opacity-40"
                  style={{ borderColor: '#E5E7EB', color: C.dark }}
                >
                  <span>{plan.name}</span>
                  <span className="text-xs" style={{ color: C.muted }}>${plan.price_cents / 100}/mo</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ═══ Bulk Suspend Modal ═══ */}
      {showBulkSuspendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowBulkSuspendModal(false)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-md" />
          <div
            className="relative rounded-2xl p-7 w-full max-w-sm animate-fade-in"
            style={{ background: 'white', boxShadow: '0 25px 50px rgba(0,0,0,0.15)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <button onClick={() => setShowBulkSuspendModal(false)} className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-gray-100 transition" style={{ color: C.muted }}>
              <X className="w-4 h-4" />
            </button>
            <h2 className="text-lg font-bold mb-1" style={{ color: C.danger }}>
              {he ? 'השעיית קבלנים' : 'Suspend Contractors'}
            </h2>
            <p className="text-sm mb-4" style={{ color: C.muted }}>
              {he ? `השהה ${selectedIds.size} קבלנים` : `Suspend ${selectedIds.size} contractor${selectedIds.size !== 1 ? 's' : ''}`}
            </p>
            <label className="block text-sm font-medium mb-1.5" style={{ color: C.dark }}>
              {he ? 'סיבה (אופציונלי)' : 'Reason (optional)'}
            </label>
            <textarea
              value={bulkSuspendReason}
              onChange={(e) => setBulkSuspendReason(e.target.value)}
              placeholder={he ? 'ציין סיבת השעיה...' : 'Enter reason for suspension...'}
              rows={3}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-red-500/30 resize-none"
            />
            <button
              disabled={bulkProcessing}
              onClick={bulkSuspend}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40"
              style={{ background: C.danger }}
            >
              {bulkProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ban className="w-4 h-4" />}
              {he ? 'השהה נבחרים' : 'Suspend Selected'}
            </button>
          </div>
        </div>
      )}

      {/* ═══ Bulk Notify Modal ═══ */}
      {showBulkNotifyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowBulkNotifyModal(false)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-md" />
          <div
            className="relative rounded-2xl p-7 w-full max-w-sm animate-fade-in"
            style={{ background: 'white', boxShadow: '0 25px 50px rgba(0,0,0,0.15)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <button onClick={() => setShowBulkNotifyModal(false)} className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-gray-100 transition" style={{ color: C.muted }}>
              <X className="w-4 h-4" />
            </button>
            <h2 className="text-lg font-bold mb-1" style={{ color: C.dark }}>
              {he ? 'שליחת הודעה' : 'Send Notification'}
            </h2>
            <p className="text-sm mb-4" style={{ color: C.muted }}>
              {he ? `שלח ל-${selectedIds.size} קבלנים` : `Send to ${selectedIds.size} contractor${selectedIds.size !== 1 ? 's' : ''}`}
            </p>
            <label className="block text-sm font-medium mb-1.5" style={{ color: C.dark }}>
              {he ? 'הודעה' : 'Message'}
            </label>
            <textarea
              value={bulkNotifyMessage}
              onChange={(e) => setBulkNotifyMessage(e.target.value)}
              placeholder={he ? 'כתוב הודעה...' : 'Write your message...'}
              rows={4}
              autoFocus
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-[#fe5b25]/30 resize-none"
            />
            <button
              disabled={!bulkNotifyMessage.trim() || bulkProcessing}
              onClick={bulkNotify}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40"
              style={{ background: C.primary }}
            >
              {bulkProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />}
              {he ? 'שלח הודעה' : 'Send Notification'}
            </button>
          </div>
        </div>
      )}

      {/* ═══ Bulk Action Bar ═══ */}
      <BulkActionBar
        selectedCount={selectedIds.size}
        onClearSelection={() => setSelectedIds(new Set())}
        onExport={exportSelectedCsv}
        exportLabel={he ? 'יצוא נבחרים' : 'Export Selected'}
        actions={bulkActions}
      />
    </div>
  )
}
