import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useI18n } from '../../lib/i18n'
import { useAuth } from '../../lib/auth'
import { supabase } from '../../lib/supabase'
import {
  ArrowLeft,
  DollarSign,
  Users,
  Eye,
  UserX,
  UserCheck,
  Loader2,
  AlertCircle,
  Percent,
  Save,
  Plus,
  X,
  Wallet,
  LinkIcon,
  TrendingUp,
  Ban,
  RotateCcw,
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

interface PartnerData {
  id: string
  user_id: string
  slug: string
  display_name: string
  bio: string | null
  avatar_url: string | null
  location: string | null
  service_areas: string[]
  specialties: string[]
  commission_rate: number
  status: string
  verified_at: string | null
  balance_cache_cents: number
  created_at: string
}

interface LinkedGroup {
  id: string
  group_id: string
  verified: boolean
  linked_at: string
  group_name: string | null
}

interface Referral {
  id: string
  referred_user_id: string
  referral_source: string
  converted_at: string | null
  created_at: string
  referred_name: string | null
}

interface Commission {
  id: string
  type: string
  amount_cents: number
  status: string
  note: string | null
  created_at: string
}

const STATUS_CONFIG: Record<string, { color: string; bg: string; label: string; labelHe: string }> = {
  active: { color: C.success, bg: '#ECFDF5', label: 'Active', labelHe: 'פעיל' },
  pending: { color: C.warning, bg: '#FFFBEB', label: 'Pending', labelHe: 'ממתין' },
  suspended: { color: C.danger, bg: '#FEF2F2', label: 'Suspended', labelHe: 'מושעה' },
  rejected: { color: '#6B7280', bg: '#F3F4F6', label: 'Rejected', labelHe: 'נדחה' },
}

const TYPE_CONFIG: Record<string, { color: string; bg: string; label: string; labelHe: string }> = {
  earning: { color: C.success, bg: '#ECFDF5', label: 'Earning', labelHe: 'הכנסה' },
  withdrawal: { color: C.danger, bg: '#FEF2F2', label: 'Withdrawal', labelHe: 'משיכה' },
  credit: { color: '#2563EB', bg: '#EFF6FF', label: 'Credit', labelHe: 'זיכוי' },
  refund_clawback: { color: C.warning, bg: '#FFFBEB', label: 'Clawback', labelHe: 'החזר' },
}

const COMM_STATUS_CONFIG: Record<string, { color: string; bg: string; label: string; labelHe: string }> = {
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
  return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/* ── Section Card wrapper ──────────────────────────────────────── */
function SectionCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl overflow-hidden ${className}`}
      style={{ background: 'white', border: `1px solid ${C.border}`, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
    >
      {children}
    </div>
  )
}

function SectionHeader({ icon: Icon, iconColor, title, count, action }: { icon: any; iconColor: string; title: string; count?: number; action?: React.ReactNode }) {
  return (
    <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: `1px solid ${C.border}` }}>
      <h2 className="text-[15px] font-bold flex items-center gap-2.5" style={{ color: C.dark }}>
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${iconColor}12` }}>
          <Icon className="w-3.5 h-3.5" style={{ color: iconColor }} />
        </div>
        {title}
        {count !== undefined && (
          <span
            className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
            style={{ background: `${iconColor}12`, color: iconColor }}
          >
            {count}
          </span>
        )}
      </h2>
      {action}
    </div>
  )
}

function StatusBadge({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <span
      className="inline-flex items-center text-[11px] font-semibold px-2 py-1 rounded-lg"
      style={{ background: bg, color }}
    >
      {label}
    </span>
  )
}

export default function PartnerDetail() {
  const { id } = useParams<{ id: string }>()
  const { locale } = useI18n()
  const { impersonate } = useAuth()
  const navigate = useNavigate()
  const he = locale === 'he'

  const [partner, setPartner] = useState<PartnerData | null>(null)
  const [groups, setGroups] = useState<LinkedGroup[]>([])
  const [referrals, setReferrals] = useState<Referral[]>([])
  const [commissions, setCommissions] = useState<Commission[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Commission rate editor
  const [editingRate, setEditingRate] = useState(false)
  const [rateValue, setRateValue] = useState('')
  const [savingRate, setSavingRate] = useState(false)

  // Manual commission modal
  const [showManualModal, setShowManualModal] = useState(false)
  const [manualType, setManualType] = useState<string>('earning')
  const [manualAmount, setManualAmount] = useState('')
  const [manualNote, setManualNote] = useState('')
  const [manualSaving, setManualSaving] = useState(false)

  async function fetchData() {
    setError(null)
    setLoading(true)
    try {
      const [partnerRes, groupsRes, referralsRes, commissionsRes] = await Promise.all([
        supabase.from('community_partners').select('*').eq('id', id).maybeSingle(),
        supabase.from('partner_linked_groups').select('id, group_id, verified, linked_at, groups(name)').eq('partner_id', id),
        supabase.from('partner_referrals').select('id, referred_user_id, referral_source, converted_at, created_at, profiles!partner_referrals_referred_user_id_fkey(full_name)').eq('partner_id', id).order('created_at', { ascending: false }),
        supabase.from('partner_commissions').select('id, type, amount_cents, status, note, created_at').eq('partner_id', id).order('created_at', { ascending: false }),
      ])

      if (partnerRes.error) throw partnerRes.error
      if (!partnerRes.data) throw new Error('Partner not found')

      setPartner(partnerRes.data as PartnerData)
      setRateValue(String((partnerRes.data.commission_rate * 100).toFixed(0)))

      const gList = (groupsRes.data ?? []).map((g: any) => ({
        id: g.id,
        group_id: g.group_id,
        verified: g.verified,
        linked_at: g.linked_at,
        group_name: g.groups?.name ?? null,
      }))
      setGroups(gList)

      const rList = (referralsRes.data ?? []).map((r: any) => ({
        id: r.id,
        referred_user_id: r.referred_user_id,
        referral_source: r.referral_source,
        converted_at: r.converted_at,
        created_at: r.created_at,
        referred_name: r.profiles?.full_name ?? null,
      }))
      setReferrals(rList)

      setCommissions((commissionsRes.data ?? []) as Commission[])
    } catch (err: any) {
      console.error('[PartnerDetail] fetch error:', err)
      setError(he ? 'טעינת נתונים נכשלה' : 'Failed to load partner data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [id])

  async function handleStatusChange(newStatus: string) {
    const confirmMsg: Record<string, string> = {
      active: he ? 'לאשר שותף זה?' : 'Approve this partner?',
      rejected: he ? 'לדחות שותף זה?' : 'Reject this partner?',
      suspended: he ? 'להשעות שותף זה?' : 'Suspend this partner?',
    }
    if (!window.confirm(confirmMsg[newStatus] ?? `Change status to ${newStatus}?`)) return

    const updates: any = { status: newStatus }
    if (newStatus === 'active') updates.verified_at = new Date().toISOString()

    const { error } = await supabase.from('community_partners').update(updates).eq('id', id)
    if (error) {
      alert(he ? 'שינוי סטטוס נכשל' : 'Status change failed')
    } else {
      fetchData()
    }
  }

  async function saveRate() {
    const num = parseFloat(rateValue)
    if (isNaN(num) || num < 0 || num > 100) {
      alert(he ? 'אחוז לא תקין' : 'Invalid rate')
      return
    }
    setSavingRate(true)
    const { error } = await supabase.from('community_partners').update({ commission_rate: num / 100 }).eq('id', id)
    setSavingRate(false)
    if (error) {
      alert(he ? 'שמירה נכשלה' : 'Save failed')
    } else {
      setEditingRate(false)
      fetchData()
    }
  }

  async function saveManualCommission() {
    const amountDollars = parseFloat(manualAmount)
    if (isNaN(amountDollars) || amountDollars === 0) {
      alert(he ? 'סכום לא תקין' : 'Invalid amount')
      return
    }
    setManualSaving(true)
    const amountCents = Math.round(amountDollars * 100)
    const { error } = await supabase.from('partner_commissions').insert({
      partner_id: id,
      type: manualType,
      amount_cents: manualType === 'withdrawal' || manualType === 'refund_clawback' ? -Math.abs(amountCents) : Math.abs(amountCents),
      status: 'approved',
      note: manualNote || null,
    })
    setManualSaving(false)
    if (error) {
      alert(he ? 'שמירה נכשלה' : 'Save failed')
    } else {
      setShowManualModal(false)
      setManualAmount('')
      setManualNote('')
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

  if (error || !partner) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <AlertCircle className="w-8 h-8" style={{ color: C.danger }} />
          <p className="text-sm font-medium" style={{ color: C.danger }}>{error || 'Partner not found'}</p>
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

  const statusConf = STATUS_CONFIG[partner.status] ?? { color: C.muted, bg: '#F3F4F6', label: partner.status, labelHe: partner.status }
  const initials = partner.display_name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
  const convertedRefs = referrals.filter(r => r.converted_at).length
  const totalEarned = commissions.filter(c => c.type === 'earning' && (c.status === 'approved' || c.status === 'paid')).reduce((s, c) => s + c.amount_cents, 0)

  const statCards = [
    { label: he ? 'הפניות' : 'Referrals', value: referrals.length, icon: Users, color: C.accent },
    { label: he ? 'המרות' : 'Converted', value: convertedRefs, icon: TrendingUp, color: C.success },
    { label: he ? 'סה"כ הכנסות' : 'Total Earned', value: fmtCurrency(totalEarned), icon: DollarSign, color: C.primary },
    { label: he ? 'יתרה' : 'Balance', value: fmtCurrency(partner.balance_cache_cents), icon: Wallet, color: '#059669' },
  ]

  return (
    <div className="animate-fade-in space-y-6">
      {/* ═══ Back Link ═══ */}
      <Link
        to="/admin/partners/list"
        className="inline-flex items-center gap-1.5 text-sm font-medium transition-colors hover:opacity-70"
        style={{ color: C.primary }}
      >
        <ArrowLeft className="w-4 h-4" />
        {he ? 'חזרה לשותפים' : 'Back to Partners'}
      </Link>

      {/* ═══ Header ═══ */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          {partner.avatar_url ? (
            <img src={partner.avatar_url} alt="" className="w-14 h-14 rounded-2xl object-cover" />
          ) : (
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center text-lg font-bold"
              style={{ background: `${C.primary}15`, color: C.primary }}
            >
              {initials}
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-3" style={{ color: C.dark }}>
              {partner.display_name}
              <StatusBadge label={he ? statusConf.labelHe : statusConf.label} color={statusConf.color} bg={statusConf.bg} />
            </h1>
            <p className="text-sm mt-0.5" style={{ color: C.muted }}>
              @{partner.slug} {partner.location ? `\u00B7 ${partner.location}` : ''}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {partner.status === 'pending' && (
            <>
              <button
                onClick={() => handleStatusChange('active')}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-all hover:shadow-sm active:scale-[0.98]"
                style={{ background: C.success, color: 'white' }}
              >
                <UserCheck className="w-4 h-4" />
                {he ? 'אשר' : 'Approve'}
              </button>
              <button
                onClick={() => handleStatusChange('rejected')}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-all hover:shadow-sm active:scale-[0.98]"
                style={{ background: C.danger, color: 'white' }}
              >
                <UserX className="w-4 h-4" />
                {he ? 'דחה' : 'Reject'}
              </button>
            </>
          )}
          {partner.status === 'active' && (
            <button
              onClick={() => handleStatusChange('suspended')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-all hover:shadow-sm active:scale-[0.98] border"
              style={{ background: 'white', color: C.danger, borderColor: '#FCA5A5' }}
            >
              <Ban className="w-4 h-4" />
              {he ? 'השעה' : 'Suspend'}
            </button>
          )}
          {partner.status === 'suspended' && (
            <button
              onClick={() => handleStatusChange('active')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-all hover:shadow-sm active:scale-[0.98]"
              style={{ background: C.success, color: 'white' }}
            >
              <RotateCcw className="w-4 h-4" />
              {he ? 'הפעל מחדש' : 'Reactivate'}
            </button>
          )}
          <button
            onClick={async () => { await impersonate(partner.user_id); navigate('/') }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-all hover:shadow-sm active:scale-[0.98]"
            style={{ background: C.dark, color: 'white' }}
          >
            <Eye className="w-4 h-4" />
            {he ? 'התחזות' : 'Impersonate'}
          </button>
        </div>
      </div>

      {/* ═══ Stats Strip ═══ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((s, i) => (
          <div
            key={i}
            className="flex items-center gap-3 px-4 py-3 rounded-xl"
            style={{ background: 'white', border: `1px solid ${C.border}` }}
          >
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `${s.color}12` }}>
              <s.icon className="w-4 h-4" style={{ color: s.color }} />
            </div>
            <div>
              <p className="text-lg font-bold" style={{ color: C.dark }}>{s.value}</p>
              <p className="text-[10px] font-medium uppercase tracking-wider" style={{ color: C.muted }}>{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ═══ Commission Rate Editor ═══ */}
      <SectionCard>
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${C.primary}12` }}>
              <Percent className="w-3.5 h-3.5" style={{ color: C.primary }} />
            </div>
            <span className="text-[15px] font-bold" style={{ color: C.dark }}>
              {he ? 'אחוז עמלה' : 'Commission Rate'}
            </span>
          </div>
          {editingRate ? (
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                max="100"
                step="1"
                value={rateValue}
                onChange={(e) => setRateValue(e.target.value)}
                className="w-20 rounded-lg border text-sm text-center py-1.5"
                style={{ borderColor: '#E5E7EB', color: C.dark }}
              />
              <span className="text-sm" style={{ color: C.muted }}>%</span>
              <button
                onClick={saveRate}
                disabled={savingRate}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all hover:shadow-sm"
                style={{ background: C.success, color: 'white' }}
              >
                {savingRate ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                {he ? 'שמור' : 'Save'}
              </button>
              <button
                onClick={() => { setEditingRate(false); setRateValue(String((partner.commission_rate * 100).toFixed(0))) }}
                className="px-3 py-1.5 rounded-lg text-[12px] font-semibold border transition-all hover:bg-gray-50"
                style={{ color: C.muted, borderColor: '#E5E7EB' }}
              >
                {he ? 'ביטול' : 'Cancel'}
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <span className="text-xl font-bold" style={{ color: C.primary }}>
                {(partner.commission_rate * 100).toFixed(0)}%
              </span>
              <button
                onClick={() => setEditingRate(true)}
                className="text-[11px] font-semibold transition-colors hover:opacity-70"
                style={{ color: C.primary }}
              >
                {he ? 'ערוך' : 'Edit'}
              </button>
            </div>
          )}
        </div>
      </SectionCard>

      {/* ═══ Linked Groups ═══ */}
      <SectionCard>
        <SectionHeader icon={LinkIcon} iconColor={C.accent} title={he ? 'קבוצות מקושרות' : 'Linked Groups'} count={groups.length} />
        {groups.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <LinkIcon className="w-8 h-8 mx-auto mb-3" style={{ color: '#D1D5DB' }} />
            <p className="text-sm font-medium" style={{ color: C.muted }}>{he ? 'אין קבוצות מקושרות' : 'No linked groups'}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.border}`, background: '#FAFBFC' }}>
                  {[he ? 'קבוצה' : 'Group', he ? 'מאומת' : 'Verified', he ? 'קושר ב' : 'Linked'].map((col, i) => (
                    <th key={i} className="text-start px-5 py-3 font-semibold text-[11px] uppercase tracking-widest" style={{ color: C.muted }}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {groups.map((g, idx) => (
                  <tr key={g.id} style={{ borderBottom: idx < groups.length - 1 ? `1px solid ${C.border}` : undefined }}>
                    <td className="px-5 py-3.5 font-medium" style={{ color: C.dark }}>{g.group_name ?? g.group_id}</td>
                    <td className="px-5 py-3.5">
                      {g.verified ? (
                        <StatusBadge label={he ? 'מאומת' : 'Verified'} color={C.success} bg="#ECFDF5" />
                      ) : (
                        <StatusBadge label={he ? 'לא מאומת' : 'Unverified'} color={C.warning} bg="#FFFBEB" />
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-[11px]" style={{ color: C.muted }}>{fmtDate(g.linked_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {/* ═══ Referrals ═══ */}
      <SectionCard>
        <SectionHeader icon={Users} iconColor={C.primary} title={he ? 'הפניות' : 'Referrals'} count={referrals.length} />
        {referrals.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <Users className="w-8 h-8 mx-auto mb-3" style={{ color: '#D1D5DB' }} />
            <p className="text-sm font-medium" style={{ color: C.muted }}>{he ? 'אין הפניות' : 'No referrals yet'}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.border}`, background: '#FAFBFC' }}>
                  {[he ? 'משתמש' : 'User', he ? 'מקור' : 'Source', he ? 'הומר' : 'Converted', he ? 'תאריך' : 'Date'].map((col, i) => (
                    <th key={i} className="text-start px-5 py-3 font-semibold text-[11px] uppercase tracking-widest" style={{ color: C.muted }}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {referrals.map((r, idx) => (
                  <tr key={r.id} style={{ borderBottom: idx < referrals.length - 1 ? `1px solid ${C.border}` : undefined }}>
                    <td className="px-5 py-3.5 font-medium" style={{ color: C.dark }}>{r.referred_name ?? r.referred_user_id.slice(0, 8)}</td>
                    <td className="px-5 py-3.5">
                      <StatusBadge label={r.referral_source} color={C.accent} bg="#F5F3FF" />
                    </td>
                    <td className="px-5 py-3.5">
                      {r.converted_at ? (
                        <StatusBadge label={he ? 'כן' : 'Yes'} color={C.success} bg="#ECFDF5" />
                      ) : (
                        <StatusBadge label={he ? 'לא' : 'No'} color={C.muted} bg="#F3F4F6" />
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-[11px]" style={{ color: C.muted }}>{fmtDate(r.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {/* ═══ Commissions ═══ */}
      <SectionCard>
        <SectionHeader
          icon={DollarSign}
          iconColor={C.success}
          title={he ? 'עמלות' : 'Commissions'}
          count={commissions.length}
          action={
            <button
              onClick={() => setShowManualModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all hover:shadow-sm"
              style={{ background: C.primary, color: 'white' }}
            >
              <Plus className="w-3.5 h-3.5" />
              {he ? 'הוסף ידנית' : 'Manual Entry'}
            </button>
          }
        />
        {commissions.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <DollarSign className="w-8 h-8 mx-auto mb-3" style={{ color: '#D1D5DB' }} />
            <p className="text-sm font-medium" style={{ color: C.muted }}>{he ? 'אין עמלות' : 'No commissions yet'}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.border}`, background: '#FAFBFC' }}>
                  {[he ? 'סוג' : 'Type', he ? 'סכום' : 'Amount', he ? 'סטטוס' : 'Status', he ? 'הערה' : 'Note', he ? 'תאריך' : 'Date'].map((col, i) => (
                    <th key={i} className="text-start px-5 py-3 font-semibold text-[11px] uppercase tracking-widest" style={{ color: C.muted }}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {commissions.map((c, idx) => {
                  const typeConf = TYPE_CONFIG[c.type] ?? { color: C.muted, bg: '#F3F4F6', label: c.type, labelHe: c.type }
                  const sConf = COMM_STATUS_CONFIG[c.status] ?? { color: C.muted, bg: '#F3F4F6', label: c.status, labelHe: c.status }
                  return (
                    <tr key={c.id} style={{ borderBottom: idx < commissions.length - 1 ? `1px solid ${C.border}` : undefined }}>
                      <td className="px-5 py-3.5">
                        <StatusBadge label={he ? typeConf.labelHe : typeConf.label} color={typeConf.color} bg={typeConf.bg} />
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-[13px] font-bold" style={{ color: c.amount_cents >= 0 ? C.success : C.danger }}>
                          {c.amount_cents >= 0 ? '+' : ''}{fmtCurrency(c.amount_cents)}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <StatusBadge label={he ? sConf.labelHe : sConf.label} color={sConf.color} bg={sConf.bg} />
                      </td>
                      <td className="px-5 py-3.5 text-[12px] max-w-[200px] truncate" style={{ color: C.muted }}>
                        {c.note || '\u2014'}
                      </td>
                      <td className="px-5 py-3.5 text-[11px]" style={{ color: C.muted }}>{fmtDate(c.created_at)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {/* ═══ Manual Commission Modal ═══ */}
      {showManualModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowManualModal(false)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-md" />
          <div
            className="relative rounded-2xl p-7 w-full max-w-md animate-fade-in"
            style={{ background: 'white', boxShadow: '0 25px 50px rgba(0,0,0,0.15)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <button onClick={() => setShowManualModal(false)} className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-gray-100 transition" style={{ color: C.muted }}>
              <X className="w-4 h-4" />
            </button>

            <div className="mb-5">
              <h2 className="text-lg font-bold" style={{ color: C.dark }}>
                {he ? 'הוספת עמלה ידנית' : 'Manual Commission Entry'}
              </h2>
              <p className="text-sm mt-1" style={{ color: C.muted }}>
                {he ? 'עבור' : 'For'} {partner.display_name}
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: C.muted }}>
                  {he ? 'סוג' : 'Type'}
                </label>
                <select
                  value={manualType}
                  onChange={(e) => setManualType(e.target.value)}
                  className="w-full rounded-xl border text-sm py-2.5 px-3"
                  style={{ borderColor: '#E5E7EB', color: C.dark }}
                >
                  <option value="earning">{he ? 'הכנסה' : 'Earning'}</option>
                  <option value="credit">{he ? 'זיכוי' : 'Credit'}</option>
                  <option value="withdrawal">{he ? 'משיכה' : 'Withdrawal'}</option>
                  <option value="refund_clawback">{he ? 'החזר' : 'Clawback'}</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: C.muted }}>
                  {he ? 'סכום ($)' : 'Amount ($)'}
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={manualAmount}
                  onChange={(e) => setManualAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full rounded-xl border text-sm py-2.5 px-3"
                  style={{ borderColor: '#E5E7EB', color: C.dark }}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: C.muted }}>
                  {he ? 'הערה' : 'Note'} ({he ? 'אופציונלי' : 'optional'})
                </label>
                <input
                  type="text"
                  value={manualNote}
                  onChange={(e) => setManualNote(e.target.value)}
                  placeholder={he ? 'הערת מנהל...' : 'Admin note...'}
                  className="w-full rounded-xl border text-sm py-2.5 px-3"
                  style={{ borderColor: '#E5E7EB', color: C.dark }}
                />
              </div>

              <button
                onClick={saveManualCommission}
                disabled={manualSaving}
                className="w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-all hover:shadow-sm active:scale-[0.98]"
                style={{ background: C.primary, color: 'white' }}
              >
                {manualSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                {he ? 'הוסף עמלה' : 'Add Commission'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
