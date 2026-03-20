import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useI18n } from '../../lib/i18n'
import { useAuth } from '../../lib/auth'
import { supabase } from '../../lib/supabase'
import {
  ArrowLeft,
  Zap,
  DollarSign,
  Calendar,
  Phone,
  Send,
  MapPin,
  Eye,
  UserX,
  UserCheck,
  UsersRound,
  Package,
  Clock,
  Loader2,
  Crown,
  TrendingUp,
  Briefcase,
  CheckCircle2,
  XCircle,
  CreditCard,
  MessageSquare,
  StickyNote,
  ExternalLink,
  Hash,
  Mail,
  CircleDot,
  Users,
  Receipt,
  BarChart3,
  CalendarDays,
  Timer,
} from 'lucide-react'

/* ── Design tokens ──────────────────────────────────────────────── */
const C = {
  primary: '#fe5b25',
  dark: '#1C1C1E',
  muted: '#8E8E93',
  accent: '#5856D6',
  success: '#059669',
  warning: '#D97706',
  danger: '#DC2626',
  border: 'rgba(0,0,0,0.06)',
}

/* ── Types ──────────────────────────────────────────────────────── */
interface ContractorData {
  user_id: string
  professions: string[]
  zip_codes: string[]
  is_active: boolean
  created_at: string
  profiles: {
    id: string
    full_name: string | null
    phone: string | null
    telegram_chat_id: number | null
  }
  subscription: {
    id: string
    status: string
    current_period_end: string | null
    stripe_customer_id: string | null
    created_at: string
    plan: { name: string; slug: string; price_cents: number }
  } | null
}

interface SubcontractorRow {
  id: string
  full_name: string
  phone: string | null
  profession_tags: string[]
  created_at: string
  job_count: number
  last_job_status: string | null
}

interface LeadRow {
  id: string
  lead_id: string
  profession: string
  city: string | null
  urgency: string
  status: string
  created_at: string
  group_name: string | null
}

interface GroupInfo {
  group_id: string
  group_name: string
  lead_count: number
}

/* ── Constants ─────────────────────────────────────────────────── */
const PROF_EMOJI: Record<string, string> = {
  hvac: '❄️', renovation: '🔨', fencing: '🧱', cleaning: '✨',
  locksmith: '🔑', plumbing: '🚰', electrical: '⚡', roofing: '🏠',
  painting: '🎨', landscaping: '🌿', other: '📋',
}

const PLAN_CONFIG: Record<string, { color: string; bg: string; border: string; gradient: string }> = {
  starter: { color: '#6B7280', bg: '#F3F4F6', border: '#E5E7EB', gradient: 'linear-gradient(135deg, #F8F9FA, #E9ECEF)' },
  pro: { color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE', gradient: 'linear-gradient(135deg, #EFF6FF, #DBEAFE)' },
  unlimited: { color: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE', gradient: 'linear-gradient(135deg, #F5F3FF, #EDE9FE)' },
}

const JOB_STATUS_CONFIG: Record<string, { color: string; bg: string }> = {
  completed: { color: '#059669', bg: '#ECFDF5' },
  accepted: { color: '#2563EB', bg: '#EFF6FF' },
  pending: { color: '#D97706', bg: '#FFFBEB' },
  rejected: { color: '#DC2626', bg: '#FEF2F2' },
  cancelled: { color: '#6B7280', bg: '#F3F4F6' },
}

const URGENCY_CONFIG: Record<string, { color: string; bg: string }> = {
  hot: { color: '#DC2626', bg: '#FEF2F2' },
  warm: { color: '#D97706', bg: '#FFFBEB' },
  cold: { color: '#2563EB', bg: '#EFF6FF' },
}

const LEAD_STATUS_CONFIG: Record<string, { color: string; bg: string }> = {
  new: { color: '#2563EB', bg: '#EFF6FF' },
  sent: { color: '#059669', bg: '#ECFDF5' },
  claimed: { color: '#7C3AED', bg: '#F5F3FF' },
  expired: { color: '#DC2626', bg: '#FEF2F2' },
  parsed: { color: '#D97706', bg: '#FFFBEB' },
}

const SUB_STATUS_MAP: Record<string, { color: string; bg: string; label: string }> = {
  active: { color: C.success, bg: '#ECFDF5', label: 'Active' },
  trialing: { color: '#2563EB', bg: '#EFF6FF', label: 'Trial' },
  past_due: { color: C.warning, bg: '#FFFBEB', label: 'Past Due' },
  canceled: { color: C.danger, bg: '#FEF2F2', label: 'Canceled' },
  paused: { color: C.warning, bg: '#FFFBEB', label: 'Paused' },
  incomplete: { color: C.muted, bg: '#F3F4F6', label: 'Incomplete' },
}

function fmtDate(d: string | null): string {
  if (!d) return '\u2014'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtShort(d: string | null): string {
  if (!d) return '\u2014'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function daysBetween(a: string, b: Date): number {
  return Math.max(0, Math.floor((b.getTime() - new Date(a).getTime()) / (1000 * 60 * 60 * 24)))
}

function monthsBetween(a: string, b: Date): number {
  const start = new Date(a)
  return Math.max(0, (b.getFullYear() - start.getFullYear()) * 12 + b.getMonth() - start.getMonth())
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

/* ── Badge component ───────────────────────────────────────────── */
function StatusBadge({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <span
      className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-md uppercase tracking-wide"
      style={{ background: bg, color }}
    >
      {label}
    </span>
  )
}

/* ── Pipeline Stage Types ──────────────────────────────────────── */
interface PipelineStage {
  key: string
  label: string
  labelHe: string
  date: string | null
  reached: boolean
  isCurrent: boolean
}

function LifecyclePipeline({ stages, he }: { stages: PipelineStage[]; he: boolean }) {
  return (
    <div className="px-6 py-5">
      <div className="flex items-center justify-between relative">
        {/* Connecting line behind nodes */}
        <div
          className="absolute top-5 left-0 right-0 h-0.5"
          style={{ background: C.border }}
        />
        {stages.map((stage, i) => {
          const completedColor = C.primary
          const futureColor = '#D1D5DB'
          const nodeColor = stage.reached
            ? stage.isCurrent ? completedColor : completedColor
            : futureColor

          return (
            <div key={stage.key} className="relative flex flex-col items-center z-10" style={{ flex: 1 }}>
              {/* Filled line segment to the left */}
              {i > 0 && stage.reached && (
                <div
                  className="absolute top-5 right-1/2 h-0.5"
                  style={{
                    background: `linear-gradient(90deg, ${completedColor}, ${completedColor})`,
                    width: '100%',
                  }}
                />
              )}

              {/* Node */}
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all"
                style={{
                  borderColor: nodeColor,
                  background: stage.reached ? nodeColor : 'white',
                  boxShadow: stage.isCurrent ? `0 0 0 4px ${completedColor}25` : undefined,
                  animation: stage.isCurrent ? 'pulse 2s ease-in-out infinite' : undefined,
                }}
              >
                {stage.reached ? (
                  <CheckCircle2 className="w-4 h-4 text-white" />
                ) : (
                  <CircleDot className="w-4 h-4" style={{ color: futureColor }} />
                )}
              </div>

              {/* Label */}
              <p
                className="text-[10px] font-semibold mt-2 text-center leading-tight"
                style={{ color: stage.reached ? C.dark : C.muted }}
              >
                {he ? stage.labelHe : stage.label}
              </p>

              {/* Date */}
              {stage.date && (
                <p className="text-[9px] mt-0.5" style={{ color: C.muted }}>
                  {fmtShort(stage.date)}
                </p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ── Info Row (for sidebar) ────────────────────────────────────── */
function InfoRow({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2" style={{ borderBottom: `1px solid ${C.border}` }}>
      <span className="text-[11px] font-medium" style={{ color: C.muted }}>{label}</span>
      <span className={`text-[12px] font-semibold ${mono ? 'font-mono' : ''}`} style={{ color: C.dark }}>{value}</span>
    </div>
  )
}

/* ── Main Component ────────────────────────────────────────────── */
export default function ContractorDetail() {
  const { id } = useParams<{ id: string }>()
  const { locale } = useI18n()
  const { impersonate } = useAuth()
  const navigate = useNavigate()
  const he = locale === 'he'

  const [contractor, setContractor] = useState<ContractorData | null>(null)
  const [subcontractors, setSubcontractors] = useState<SubcontractorRow[]>([])
  const [leads, setLeads] = useState<LeadRow[]>([])
  const [groups, setGroups] = useState<GroupInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState(false)
  const [adminNotes, setAdminNotes] = useState('')

  useEffect(() => {
    if (!id) return
    loadContractor()
    loadSubcontractors()
    loadLeads()
  }, [id])

  async function loadContractor() {
    setLoading(true)
    const { data, error } = await supabase
      .from('contractors')
      .select(`
        user_id, professions, zip_codes, is_active, created_at,
        profiles!inner(id, full_name, phone, telegram_chat_id)
      `)
      .eq('user_id', id)
      .single()

    if (error || !data) {
      console.error('[ContractorDetail] fetch error:', error?.message)
      setLoading(false)
      return
    }

    const { data: subData } = await supabase
      .from('subscriptions')
      .select('id, status, current_period_end, stripe_customer_id, created_at, plans(name, slug, price_cents)')
      .eq('user_id', id!)
      .order('created_at', { ascending: false })
      .limit(1)

    const raw = data as any
    const sub = subData?.[0] as any
    setContractor({
      user_id: raw.user_id,
      professions: raw.professions ?? [],
      zip_codes: raw.zip_codes ?? [],
      is_active: raw.is_active,
      created_at: raw.created_at,
      profiles: raw.profiles,
      subscription: sub ? {
        id: sub.id,
        status: sub.status,
        current_period_end: sub.current_period_end,
        stripe_customer_id: sub.stripe_customer_id,
        created_at: sub.created_at,
        plan: sub.plans,
      } : null,
    })
    setLoading(false)
  }

  async function loadSubcontractors() {
    if (!id) return
    const { data: subs } = await supabase
      .from('subcontractors')
      .select('id, full_name, phone, profession_tags, created_at')
      .eq('contractor_id', id)
      .order('created_at', { ascending: false })

    if (!subs) return

    const subIds = subs.map((s: any) => s.id)
    let jobCounts: Record<string, { count: number; lastStatus: string | null }> = {}

    if (subIds.length > 0) {
      const { data: jobs } = await supabase
        .from('job_orders')
        .select('subcontractor_id, status, created_at')
        .in('subcontractor_id', subIds)
        .order('created_at', { ascending: false })

      if (jobs) {
        const seen = new Set<string>()
        jobs.forEach((j: any) => {
          if (!jobCounts[j.subcontractor_id]) jobCounts[j.subcontractor_id] = { count: 0, lastStatus: null }
          jobCounts[j.subcontractor_id].count++
          if (!seen.has(j.subcontractor_id)) {
            jobCounts[j.subcontractor_id].lastStatus = j.status
            seen.add(j.subcontractor_id)
          }
        })
      }
    }

    setSubcontractors(subs.map((s: any) => ({
      ...s,
      job_count: jobCounts[s.id]?.count ?? 0,
      last_job_status: jobCounts[s.id]?.lastStatus ?? null,
    })))
  }

  async function loadLeads() {
    if (!id) return
    const { data: events } = await supabase
      .from('lead_contact_events')
      .select('id, lead_id, created_at, leads(id, profession, city, urgency, status, group_id, groups(name))')
      .eq('user_id', id)
      .order('created_at', { ascending: false })
      .limit(20)

    if (events) {
      const mapped = events.map((e: any) => ({
        id: e.id,
        lead_id: e.lead_id,
        profession: e.leads?.profession ?? '',
        city: e.leads?.city ?? null,
        urgency: e.leads?.urgency ?? '',
        status: e.leads?.status ?? '',
        created_at: e.created_at,
        group_name: e.leads?.groups?.name ?? null,
      }))
      setLeads(mapped)

      // Extract unique groups
      const groupMap = new Map<string, { name: string; count: number }>()
      mapped.forEach((l) => {
        if (l.group_name) {
          const existing = groupMap.get(l.group_name)
          if (existing) existing.count++
          else groupMap.set(l.group_name, { name: l.group_name, count: 1 })
        }
      })
      setGroups(
        Array.from(groupMap.entries()).map(([key, val]) => ({
          group_id: key,
          group_name: val.name,
          lead_count: val.count,
        }))
      )
    }
  }

  async function toggleActive() {
    if (!contractor || !id) return
    setToggling(true)
    const newStatus = !contractor.is_active
    const { error } = await supabase.from('contractors').update({ is_active: newStatus }).eq('user_id', id)
    if (!error) setContractor({ ...contractor, is_active: newStatus })
    setToggling(false)
  }

  /* ── Loading / Not Found ─────────────────────────────────────── */
  if (loading) {
    return (
      <div className="animate-fade-in flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: C.muted }} />
      </div>
    )
  }

  if (!contractor) {
    return (
      <div className="animate-fade-in text-center py-24">
        <p className="text-sm" style={{ color: C.muted }}>{he ? 'קבלן לא נמצא' : 'Contractor not found'}</p>
        <Link to="/admin/contractors" className="text-sm mt-3 inline-block font-medium" style={{ color: C.primary }}>
          {he ? 'חזרה' : 'Back'}
        </Link>
      </div>
    )
  }

  /* ── Derived data ────────────────────────────────────────────── */
  const plan = contractor.subscription?.plan
  const planSlug = plan?.slug ?? 'none'
  const planConf = PLAN_CONFIG[planSlug]
  const monthlyFee = plan ? plan.price_cents / 100 : 0
  const initials = (contractor.profiles?.full_name ?? '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
  const now = new Date()

  // Revenue metrics
  const subCreated = contractor.subscription?.created_at
  const monthsActive = subCreated ? Math.max(1, monthsBetween(subCreated, now)) : 0
  const daysAsCustomer = daysBetween(contractor.created_at, now)
  const ltv = monthlyFee * monthsActive
  const subStatus = contractor.subscription?.status ?? 'none'

  // Lifecycle pipeline stages
  const pipelineStages: PipelineStage[] = (() => {
    const sub = contractor.subscription
    const stages: PipelineStage[] = []

    // 1. Signed Up
    stages.push({
      key: 'signed_up',
      label: 'Signed Up',
      labelHe: 'נרשם',
      date: contractor.created_at,
      reached: true,
      isCurrent: false,
    })

    // 2. Trial Started
    const hadTrial = sub && (sub.status === 'trialing' || sub.status === 'active' || sub.status === 'canceled')
    stages.push({
      key: 'trial_started',
      label: 'Trial',
      labelHe: 'ניסיון',
      date: hadTrial ? sub.created_at : null,
      reached: !!hadTrial,
      isCurrent: sub?.status === 'trialing',
    })

    // 3. First Payment
    const isPaying = sub && (sub.status === 'active' || sub.status === 'past_due' || sub.status === 'canceled')
    const firstPaymentDate = isPaying && sub.created_at
      ? new Date(new Date(sub.created_at).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()
      : null
    stages.push({
      key: 'first_payment',
      label: 'First Payment',
      labelHe: 'תשלום ראשון',
      date: firstPaymentDate,
      reached: !!isPaying,
      isCurrent: isPaying && monthsActive <= 1 && sub?.status === 'active',
    })

    // 4. Renewed
    const hasRenewed = isPaying && monthsActive > 1
    stages.push({
      key: 'renewed',
      label: 'Renewed',
      labelHe: 'חידוש',
      date: hasRenewed && sub?.current_period_end ? sub.current_period_end : null,
      reached: !!hasRenewed,
      isCurrent: hasRenewed && sub?.status === 'active',
    })

    // 5. Churned
    const churned = sub?.status === 'canceled'
    stages.push({
      key: 'churned',
      label: 'Churned',
      labelHe: 'ביטול',
      date: churned ? sub.current_period_end : null,
      reached: !!churned,
      isCurrent: !!churned,
    })

    // Mark current: find last reached non-churned if not churned
    if (!churned) {
      let lastReached = -1
      stages.forEach((s, i) => { if (s.reached && s.key !== 'churned') lastReached = i })
      stages.forEach((s, i) => { s.isCurrent = i === lastReached })
    }

    return stages
  })()

  return (
    <div className="animate-fade-in space-y-6">
      {/* ═══ Back link ═══ */}
      <Link
        to="/admin/contractors"
        className="inline-flex items-center gap-1.5 text-sm font-medium transition-colors hover:opacity-70"
        style={{ color: C.muted }}
      >
        <ArrowLeft className="h-4 w-4" />
        {he ? 'קבלנים' : 'Contractors'}
      </Link>

      {/* ═══ Hero Header ═══ */}
      <SectionCard>
        <div className="px-6 py-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              {/* Avatar */}
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center text-lg font-bold shrink-0"
                style={{
                  background: `hsl(${(contractor.user_id.charCodeAt(0) * 47) % 360}, 45%, 92%)`,
                  color: `hsl(${(contractor.user_id.charCodeAt(0) * 47) % 360}, 45%, 35%)`,
                }}
              >
                {initials}
              </div>

              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h1 className="text-xl font-bold tracking-tight" style={{ color: C.dark, letterSpacing: '-0.02em' }}>
                    {contractor.profiles?.full_name ?? 'Unknown'}
                  </h1>

                  {planConf && (
                    <span
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold"
                      style={{ background: planConf.bg, color: planConf.color, border: `1px solid ${planConf.border}` }}
                    >
                      <Crown className="w-3 h-3" />
                      {plan?.name}
                    </span>
                  )}

                  {contractor.subscription && (
                    <StatusBadge
                      label={contractor.subscription.status}
                      color={SUB_STATUS_MAP[contractor.subscription.status]?.color ?? C.muted}
                      bg={SUB_STATUS_MAP[contractor.subscription.status]?.bg ?? '#F3F4F6'}
                    />
                  )}

                  {!contractor.is_active && (
                    <StatusBadge label={he ? 'מושבת' : 'Inactive'} color={C.danger} bg="#FEF2F2" />
                  )}
                </div>

                <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                  {contractor.profiles?.phone && (
                    <span className="text-[12px] flex items-center gap-1" style={{ color: C.muted }}>
                      <Phone className="w-3 h-3" /> {contractor.profiles.phone}
                    </span>
                  )}
                  <span className="text-[12px] flex items-center gap-1" style={{ color: C.muted }}>
                    <Calendar className="w-3 h-3" /> {he ? 'הצטרף' : 'Joined'} {fmtDate(contractor.created_at)}
                  </span>
                  <span className="text-[12px] flex items-center gap-1" style={{ color: C.muted }}>
                    <Timer className="w-3 h-3" /> {daysAsCustomer} {he ? 'ימים' : 'days'}
                  </span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={async () => { await impersonate(contractor.user_id); navigate('/') }}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[12px] font-semibold transition-all hover:shadow-md active:scale-95"
                style={{ background: C.dark, color: 'white' }}
              >
                <Eye className="w-3.5 h-3.5" /> View As
              </button>
              <button
                onClick={toggleActive}
                disabled={toggling}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[12px] font-semibold transition-all hover:shadow-md active:scale-95"
                style={{
                  background: contractor.is_active ? '#FEF2F2' : '#ECFDF5',
                  color: contractor.is_active ? C.danger : C.success,
                  opacity: toggling ? 0.6 : 1,
                }}
              >
                {contractor.is_active
                  ? <><UserX className="w-3.5 h-3.5" /> {he ? 'השבת' : 'Deactivate'}</>
                  : <><UserCheck className="w-3.5 h-3.5" /> {he ? 'הפעל' : 'Activate'}</>
                }
              </button>
            </div>
          </div>
        </div>
      </SectionCard>

      {/* ═══ Customer Lifecycle Pipeline ═══ */}
      <SectionCard>
        <SectionHeader icon={TrendingUp} iconColor={C.primary} title={he ? 'מסלול לקוח' : 'Customer Lifecycle'} />
        <LifecyclePipeline stages={pipelineStages} he={he} />
      </SectionCard>

      {/* ═══ 2-Column Layout: Main + Sidebar ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Left Column (2/3) ── */}
        <div className="lg:col-span-2 space-y-6">

          {/* Revenue & Billing Card */}
          <SectionCard>
            <SectionHeader icon={BarChart3} iconColor={C.success} title={he ? 'הכנסות וחיוב' : 'Revenue & Billing'} />
            <div className="p-6">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {/* MRR */}
                <div className="rounded-xl p-4" style={{ background: 'linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 100%)', border: `1px solid ${C.border}` }}>
                  <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: C.muted }}>MRR</p>
                  <p className="text-2xl font-bold mt-1" style={{ color: C.dark }}>
                    {monthlyFee > 0 ? `$${monthlyFee}` : '\u2014'}
                  </p>
                </div>

                {/* LTV */}
                <div className="rounded-xl p-4" style={{ background: 'linear-gradient(135deg, #F5F3FF 0%, #EDE9FE 100%)', border: `1px solid ${C.border}` }}>
                  <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: C.muted }}>LTV</p>
                  <p className="text-2xl font-bold mt-1" style={{ color: C.dark }}>
                    {ltv > 0 ? `$${ltv.toLocaleString()}` : '\u2014'}
                  </p>
                </div>

                {/* Months Active */}
                <div className="rounded-xl p-4" style={{ background: 'linear-gradient(135deg, #FFF7ED 0%, #FFEDD5 100%)', border: `1px solid ${C.border}` }}>
                  <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: C.muted }}>
                    {he ? 'חודשים פעיל' : 'Months Active'}
                  </p>
                  <p className="text-2xl font-bold mt-1" style={{ color: C.dark }}>
                    {monthsActive > 0 ? monthsActive : '\u2014'}
                  </p>
                </div>
              </div>

              {/* Billing details */}
              <div className="mt-5 space-y-0">
                <InfoRow
                  label={he ? 'ימים כלקוח' : 'Days as Customer'}
                  value={daysAsCustomer}
                />
                <InfoRow
                  label={he ? 'חיוב הבא' : 'Next Billing'}
                  value={
                    contractor.subscription?.current_period_end
                      ? fmtDate(contractor.subscription.current_period_end)
                      : '\u2014'
                  }
                />
                <InfoRow
                  label={he ? 'מחזור חיוב' : 'Billing Interval'}
                  value={monthlyFee > 0 ? (he ? 'חודשי' : 'Monthly') : '\u2014'}
                />
              </div>
            </div>
          </SectionCard>

          {/* Subscription Card */}
          <SectionCard>
            <SectionHeader icon={CreditCard} iconColor={C.accent} title={he ? 'מנוי' : 'Subscription'} />
            <div className="p-6">
              {contractor.subscription ? (
                <div className="space-y-4">
                  {/* Plan visual */}
                  <div
                    className="rounded-xl p-4"
                    style={{ background: planConf?.gradient ?? '#F3F4F6', border: `1px solid ${planConf?.border ?? '#E5E7EB'}` }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Crown className="w-4 h-4" style={{ color: planConf?.color ?? C.muted }} />
                        <span className="text-[15px] font-bold" style={{ color: planConf?.color ?? C.dark }}>{plan?.name}</span>
                      </div>
                      <span className="text-xl font-bold" style={{ color: C.dark }}>
                        ${monthlyFee}<span className="text-[11px] font-normal" style={{ color: C.muted }}>/mo</span>
                      </span>
                    </div>
                  </div>

                  <div className="space-y-0">
                    <InfoRow
                      label={he ? 'סטטוס' : 'Status'}
                      value={
                        <StatusBadge
                          label={SUB_STATUS_MAP[subStatus]?.label ?? subStatus}
                          color={SUB_STATUS_MAP[subStatus]?.color ?? C.muted}
                          bg={SUB_STATUS_MAP[subStatus]?.bg ?? '#F3F4F6'}
                        />
                      }
                    />
                    <InfoRow
                      label={he ? 'מאז' : 'Since'}
                      value={fmtDate(contractor.subscription.created_at)}
                    />
                    <InfoRow
                      label={he ? 'חידוש' : 'Renews'}
                      value={fmtDate(contractor.subscription.current_period_end)}
                    />
                    {contractor.subscription.stripe_customer_id && (
                      <InfoRow
                        label="Stripe ID"
                        value={
                          <a
                            href={`https://dashboard.stripe.com/customers/${contractor.subscription.stripe_customer_id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 hover:opacity-70 transition-opacity"
                            style={{ color: C.accent }}
                          >
                            <code className="text-[10px] font-mono">
                              {contractor.subscription.stripe_customer_id.slice(0, 18)}...
                            </code>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        }
                      />
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Package className="w-10 h-10 mx-auto mb-3" style={{ color: '#E5E7EB' }} />
                  <p className="text-sm font-medium" style={{ color: C.muted }}>{he ? 'ללא מנוי' : 'No subscription'}</p>
                </div>
              )}
            </div>
          </SectionCard>

          {/* Groups Membership */}
          <SectionCard>
            <SectionHeader icon={MessageSquare} iconColor="#059669" title={he ? 'קבוצות ווטסאפ' : 'WhatsApp Groups'} count={groups.length} />
            {groups.length === 0 ? (
              <div className="px-6 py-10 text-center">
                <MessageSquare className="w-10 h-10 mx-auto mb-3" style={{ color: '#E5E7EB' }} />
                <p className="text-sm font-medium" style={{ color: C.muted }}>
                  {he ? 'אין קבוצות מקושרות' : 'No groups linked via leads'}
                </p>
              </div>
            ) : (
              <div className="p-6">
                <div className="flex flex-wrap gap-2">
                  {groups.map((g) => (
                    <div
                      key={g.group_id}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-[12px] font-semibold"
                      style={{ background: '#ECFDF5', color: '#065F46', border: '1px solid #A7F3D0' }}
                    >
                      <Users className="w-3.5 h-3.5" />
                      {g.group_name}
                      <span
                        className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                        style={{ background: '#065F4620', color: '#065F46' }}
                      >
                        {g.lead_count}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </SectionCard>

          {/* Subcontractors Table */}
          <SectionCard>
            <SectionHeader icon={UsersRound} iconColor={C.accent} title={he ? 'תת-קבלנים' : 'Subcontractors'} count={subcontractors.length} />
            {subcontractors.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <UsersRound className="w-10 h-10 mx-auto mb-3" style={{ color: '#E5E7EB' }} />
                <p className="text-sm font-medium" style={{ color: C.muted }}>{he ? 'אין תת-קבלנים' : 'No subcontractors yet'}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: '#FAFBFC', borderBottom: `1px solid ${C.border}` }}>
                      {[he ? 'שם' : 'Name', he ? 'טלפון' : 'Phone', he ? 'מקצועות' : 'Skills', he ? 'עבודות' : 'Jobs', he ? 'סטטוס' : 'Last Status', he ? 'נוסף' : 'Added'].map((col, i) => (
                        <th key={i} className="text-start px-5 py-3 font-semibold text-[10px] uppercase tracking-widest" style={{ color: C.muted }}>{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {subcontractors.map((sub, idx) => (
                      <tr key={sub.id} style={{ borderBottom: idx < subcontractors.length - 1 ? `1px solid ${C.border}` : undefined }}>
                        <td className="px-5 py-3.5">
                          <span className="font-semibold text-[13px]" style={{ color: C.dark }}>{sub.full_name}</span>
                        </td>
                        <td className="px-5 py-3.5 text-[12px] font-mono" style={{ color: C.muted }}>{sub.phone ?? '\u2014'}</td>
                        <td className="px-5 py-3.5">
                          <div className="flex gap-0.5">
                            {sub.profession_tags?.map((p) => (
                              <span key={p} title={p} className="text-sm leading-none">{PROF_EMOJI[p] ?? '📋'}</span>
                            ))}
                            {(!sub.profession_tags || sub.profession_tags.length === 0) && <span className="text-[11px]" style={{ color: '#D1D5DB' }}>{'\u2014'}</span>}
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="text-[12px] font-bold" style={{ color: sub.job_count > 0 ? C.dark : '#D1D5DB' }}>{sub.job_count}</span>
                        </td>
                        <td className="px-5 py-3.5">
                          {sub.last_job_status ? (
                            <StatusBadge
                              label={sub.last_job_status}
                              color={JOB_STATUS_CONFIG[sub.last_job_status]?.color ?? C.muted}
                              bg={JOB_STATUS_CONFIG[sub.last_job_status]?.bg ?? '#F3F4F6'}
                            />
                          ) : (
                            <span className="text-[11px]" style={{ color: '#D1D5DB' }}>{'\u2014'}</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-[11px]" style={{ color: C.muted }}>{fmtShort(sub.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>

          {/* Recent Leads Table */}
          <SectionCard>
            <SectionHeader icon={Zap} iconColor={C.primary} title={he ? 'לידים אחרונים' : 'Recent Leads'} count={leads.length} />
            {leads.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <Zap className="w-10 h-10 mx-auto mb-3" style={{ color: '#E5E7EB' }} />
                <p className="text-sm font-medium" style={{ color: C.muted }}>{he ? 'אין לידים' : 'No leads yet'}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: '#FAFBFC', borderBottom: `1px solid ${C.border}` }}>
                      {[he ? 'מקצוע' : 'Profession', he ? 'עיר' : 'City', he ? 'קבוצה' : 'Group', he ? 'דחיפות' : 'Urgency', he ? 'סטטוס' : 'Status', he ? 'תאריך' : 'Date'].map((col, i) => (
                        <th key={i} className="text-start px-5 py-3 font-semibold text-[10px] uppercase tracking-widest" style={{ color: C.muted }}>{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {leads.map((lead, idx) => (
                      <tr key={lead.id} style={{ borderBottom: idx < leads.length - 1 ? `1px solid ${C.border}` : undefined }}>
                        <td className="px-5 py-3.5">
                          <span className="text-sm mr-1">{PROF_EMOJI[lead.profession] ?? '📋'}</span>
                          <span className="text-[12px] font-medium" style={{ color: C.dark }}>{lead.profession}</span>
                        </td>
                        <td className="px-5 py-3.5 text-[12px]" style={{ color: C.muted }}>{lead.city ?? '\u2014'}</td>
                        <td className="px-5 py-3.5">
                          {lead.group_name ? (
                            <span
                              className="text-[10px] font-semibold px-2 py-0.5 rounded-md"
                              style={{ background: '#ECFDF5', color: '#065F46' }}
                            >
                              {lead.group_name}
                            </span>
                          ) : (
                            <span className="text-[11px]" style={{ color: '#D1D5DB' }}>{'\u2014'}</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5">
                          {URGENCY_CONFIG[lead.urgency] ? (
                            <StatusBadge label={lead.urgency} color={URGENCY_CONFIG[lead.urgency].color} bg={URGENCY_CONFIG[lead.urgency].bg} />
                          ) : <span className="text-[11px]" style={{ color: '#D1D5DB' }}>{'\u2014'}</span>}
                        </td>
                        <td className="px-5 py-3.5">
                          {LEAD_STATUS_CONFIG[lead.status] ? (
                            <StatusBadge label={lead.status} color={LEAD_STATUS_CONFIG[lead.status].color} bg={LEAD_STATUS_CONFIG[lead.status].bg} />
                          ) : <span className="text-[11px]" style={{ color: '#D1D5DB' }}>{'\u2014'}</span>}
                        </td>
                        <td className="px-5 py-3.5 text-[11px]" style={{ color: C.muted }}>{fmtShort(lead.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
        </div>

        {/* ── Right Sidebar (1/3) ── */}
        <div className="space-y-6">

          {/* Profile Info */}
          <SectionCard>
            <div className="p-6 space-y-5">
              <h3 className="text-[13px] font-bold uppercase tracking-wider" style={{ color: C.muted }}>
                {he ? 'פרטי קשר' : 'Contact Info'}
              </h3>

              {contractor.profiles?.phone && (
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#FFF7ED' }}>
                    <Phone className="w-4 h-4" style={{ color: C.primary }} />
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: C.muted }}>{he ? 'טלפון' : 'Phone'}</p>
                    <p className="text-[13px] font-semibold" style={{ color: C.dark }}>{contractor.profiles.phone}</p>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#EFF6FF' }}>
                  <Mail className="w-4 h-4" style={{ color: '#2563EB' }} />
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: C.muted }}>Email</p>
                  <p className="text-[12px] font-mono" style={{ color: C.dark }}>{contractor.profiles?.id ? contractor.profiles.id.slice(0, 12) + '...' : '\u2014'}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#FFF7ED' }}>
                  <CalendarDays className="w-4 h-4" style={{ color: C.primary }} />
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: C.muted }}>{he ? 'הצטרף' : 'Joined'}</p>
                  <p className="text-[13px] font-semibold" style={{ color: C.dark }}>{fmtDate(contractor.created_at)}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: contractor.profiles?.telegram_chat_id ? '#ECFDF5' : '#FEF2F2' }}>
                  <Send className="w-4 h-4" style={{ color: contractor.profiles?.telegram_chat_id ? C.success : C.danger }} />
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: C.muted }}>Telegram</p>
                  {contractor.profiles?.telegram_chat_id ? (
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3 h-3" style={{ color: C.success }} />
                      <span className="text-[12px] font-semibold" style={{ color: C.success }}>{he ? 'מחובר' : 'Connected'}</span>
                      <span className="text-[10px] font-mono" style={{ color: C.muted }}>#{contractor.profiles.telegram_chat_id}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <XCircle className="w-3 h-3" style={{ color: C.danger }} />
                      <span className="text-[12px] font-semibold" style={{ color: C.danger }}>{he ? 'לא מחובר' : 'Not connected'}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </SectionCard>

          {/* Trades / Professions */}
          <SectionCard>
            <div className="p-6 space-y-4">
              <h3 className="text-[13px] font-bold uppercase tracking-wider flex items-center gap-2" style={{ color: C.muted }}>
                <Briefcase className="w-3.5 h-3.5" />
                {he ? 'מקצועות' : 'Trades'}
                <span
                  className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                  style={{ background: `${C.accent}12`, color: C.accent }}
                >
                  {contractor.professions.length}
                </span>
              </h3>

              {contractor.professions.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {contractor.professions.map((p) => (
                    <span
                      key={p}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-semibold capitalize"
                      style={{ background: `${C.accent}08`, color: C.accent, border: `1px solid ${C.accent}20` }}
                    >
                      <span>{PROF_EMOJI[p] ?? '📋'}</span>
                      {p}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-[12px] text-center py-3" style={{ color: C.muted }}>
                  {he ? 'לא הוגדרו' : 'None defined'}
                </p>
              )}
            </div>
          </SectionCard>

          {/* Service Areas */}
          <SectionCard>
            <div className="p-6 space-y-4">
              <h3 className="text-[13px] font-bold uppercase tracking-wider flex items-center gap-2" style={{ color: C.muted }}>
                <MapPin className="w-3.5 h-3.5" />
                {he ? 'אזורי שירות' : 'Service Areas'}
                <span
                  className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                  style={{ background: '#FFF1F2', color: '#E11D48' }}
                >
                  {contractor.zip_codes.length}
                </span>
              </h3>

              {contractor.zip_codes.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {contractor.zip_codes.map((zip) => (
                    <span
                      key={zip}
                      className="inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-semibold"
                      style={{ background: '#FFF7ED', color: C.primary, border: '1px solid #FFEDD5' }}
                    >
                      {zip}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-[12px] text-center py-3" style={{ color: C.muted }}>
                  {he ? 'לא הוגדרו' : 'None defined'}
                </p>
              )}
            </div>
          </SectionCard>

          {/* Admin Notes */}
          <SectionCard>
            <div className="p-6 space-y-3">
              <h3 className="text-[13px] font-bold uppercase tracking-wider flex items-center gap-2" style={{ color: C.muted }}>
                <StickyNote className="w-3.5 h-3.5" />
                {he ? 'הערות מנהל' : 'Admin Notes'}
              </h3>
              <textarea
                className="w-full rounded-xl px-4 py-3 text-[13px] resize-none focus:outline-none focus:ring-2 transition-shadow"
                style={{
                  background: '#FAFBFC',
                  border: `1px solid ${C.border}`,
                  color: C.dark,
                  minHeight: '100px',
                  focusRingColor: C.primary,
                }}
                placeholder={he ? 'הוסף הערות על הלקוח...' : 'Add notes about this customer...'}
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
              />
              <p className="text-[10px]" style={{ color: C.muted }}>
                {he ? 'הערות נשמרות באופן מקומי בלבד' : 'Notes are saved locally only'}
              </p>
            </div>
          </SectionCard>

        </div>
      </div>

      {/* Pulse animation keyframes */}
      <style>{`
        @keyframes pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(254, 91, 37, 0.3); }
          50% { box-shadow: 0 0 0 8px rgba(254, 91, 37, 0); }
        }
      `}</style>
    </div>
  )
}
