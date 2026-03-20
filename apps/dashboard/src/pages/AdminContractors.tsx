import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useI18n } from '../lib/i18n'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
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

const BOT_NAME = 'LeadExpressBot'

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
    subscriptions: {
      status: string
      plans: { name: string; slug: string; price_cents: number }
    }[]
  }
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

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
}

export default function AdminContractors() {
  const { locale } = useI18n()
  const { impersonate } = useAuth()
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

  const fetchContractors = useCallback(async () => {
    setFetchError(null)
    const { data, error } = await supabase
      .from('contractors')
      .select(`
        user_id, professions, zip_codes, is_active, created_at,
        profiles!inner(full_name, telegram_chat_id, phone, subscriptions(status, plans(name, slug, price_cents)))
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
    return true
  })

  const activeCount = contractors.filter((c) => c.is_active).length
  const withSubsCount = contractors.filter((c) => (subCounts[c.user_id] ?? 0) > 0).length
  const totalRevenue = contractors.reduce((sum, c) => sum + getMonthlyFee(c), 0)

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
    a.download = `leadexpress-qr-${name.toLowerCase().replace(/\s+/g, '-')}.png`
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
        <button
          onClick={() => {
            // TODO: Replace with a proper invite modal when the invite flow is built
            const email = window.prompt(he ? 'הזן אימייל של הקבלן:' : 'Enter contractor email to invite:')
            if (email?.trim()) {
              window.alert(he ? `הזמנה ל-${email} תישלח בקרוב (בפיתוח)` : `Invite to ${email} coming soon (in development)`)
            }
          }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all hover:scale-[1.02] active:scale-[0.98] shadow-sm"
          style={{ background: C.primary, color: 'white' }}
        >
          <UserPlus className="w-4 h-4" />
          {he ? 'הוסף קבלן' : 'Add Contractor'}
        </button>
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
                  <td colSpan={9} className="px-5 py-16 text-center">
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
                  <td colSpan={9} className="px-5 py-16 text-center">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" style={{ color: C.muted }} />
                    <p className="text-sm" style={{ color: C.muted }}>Loading...</p>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-5 py-16 text-center">
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
                      onClick={() => navigate(`/admin/contractors/${c.user_id}`)}
                    >
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
                          {!c.is_active && (
                            <span
                              className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                              style={{ background: '#FEF2F2', color: '#DC2626' }}
                            >
                              {he ? 'מושבת' : 'OFF'}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Plan */}
                      <td className="px-5 py-4">
                        {planConf ? (
                          <div className="flex flex-col gap-1">
                            <span
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold w-fit"
                              style={{ background: planConf.bg, color: planConf.color, border: `1px solid ${planConf.border}` }}
                            >
                              <planConf.icon className="w-3 h-3" />
                              {planConf.label}
                            </span>
                            {statusConf && (
                              <span
                                className="text-[10px] font-medium px-1.5 py-0.5 rounded w-fit"
                                style={{ background: statusConf.bg, color: statusConf.color }}
                              >
                                {subStatus}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[11px] font-medium px-2 py-1 rounded-lg" style={{ background: '#F3F4F6', color: '#9CA3AF' }}>
                            {he ? 'ללא' : 'None'}
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
                            onClick={() => navigate(`/admin/contractors/${c.user_id}`)}
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
    </div>
  )
}
