import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useI18n } from '../../lib/i18n'
import { useAuth } from '../../lib/auth'
import { supabase } from '../../lib/supabase'
import { fmtDate } from '../../lib/shared'
import {
  ArrowLeft,
  Zap,
  Calendar,
  Phone,
  Send,
  MapPin,
  Eye,
  UserX,
  UserCheck,
  UsersRound,
  Package,
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
  Mail,
  CircleDot,
  Users,
  BarChart3,
  CalendarDays,
  Timer,
  ArrowUpCircle,
  Sparkles,
  ShieldCheck,
  Ban,
  ShieldAlert,
  AlertTriangle,
  Bell,
  BellOff,
  Smartphone,
  MessageCircle,
  Wifi,
} from 'lucide-react'
import { useToast } from '../../components/hooks/use-toast'

/* ── Design tokens (matches ContractorDashboard visual language) ── */
/* Card: bg-white rounded-[20px] border border-black/[0.04] shadow-sm */
/* Hint: #a3a3a3 | Sub: #737373 | Ink: #111 | Accent: #fe5b25 */
/* Light accent bg: #fff4f0 | Subtle bg: #fafafa */
const C = {
  primary: '#fe5b25',
  primaryDark: '#e04d1c',
  primaryLight: '#fff4f0',
  // Text scale
  ink: '#111',
  sub: '#737373',
  hint: '#a3a3a3',
  // Surfaces
  card: '#ffffff',
  subtle: '#fafafa',
  line: 'rgba(0,0,0,0.04)',
  // Semantic
  success: '#059669',
  warning: '#D97706',
  danger: '#DC2626',
  accent: '#5856D6',
  // Legacy aliases
  dark: '#111',
  darkSub: '#737373',
  muted: '#a3a3a3',
  border: 'rgba(0,0,0,0.04)',
}

/* ── Types ──────────────────────────────────────────────────────── */
interface ContractorData {
  user_id: string
  professions: string[]
  zip_codes: string[]
  is_active: boolean
  created_at: string
  wa_notify: boolean
  profiles: {
    id: string
    full_name: string | null
    phone: string | null
    whatsapp_phone: string | null
    status?: string
    suspension_reason?: string | null
    suspended_at?: string | null
    banned_at?: string | null
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

interface PushSubscription {
  id: string
  user_agent: string | null
  created_at: string
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

interface LinkedGroup {
  id: string
  invite_link: string
  group_name: string | null
  status: string
  created_at: string
  source: 'link' | 'scan'
}

/* ── Constants ─────────────────────────────────────────────────── */
const PROF_EMOJI: Record<string, string> = {
  hvac: '❄️', renovation: '🔨', fencing: '🧱', cleaning: '✨',
  locksmith: '🔑', plumbing: '🚰', electrical: '⚡', roofing: '🏠',
  painting: '🎨', landscaping: '🌿', other: '📋',
}

const PLAN_CONFIG: Record<string, { color: string; bg: string; border: string; gradient: string }> = {
  starter: { color: '#6B7280', bg: '#F9FAFB', border: '#E5E7EB', gradient: '#F9FAFB' },
  pro: { color: '#2563EB', bg: '#F0F6FF', border: '#BFDBFE', gradient: '#F0F6FF' },
  unlimited: { color: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE', gradient: '#F5F3FF' },
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

const USER_STATUS_CONFIG: Record<string, { color: string; bg: string; label: string; labelHe: string }> = {
  active: { color: '#059669', bg: '#ECFDF5', label: 'Active', labelHe: 'פעיל' },
  suspended: { color: '#D97706', bg: '#FFFBEB', label: 'Suspended', labelHe: 'מושעה' },
  banned: { color: '#DC2626', bg: '#FEF2F2', label: 'Banned', labelHe: 'חסום' },
}

const SUB_STATUS_MAP: Record<string, { color: string; bg: string; label: string }> = {
  active: { color: C.success, bg: '#ECFDF5', label: 'Active' },
  trialing: { color: '#2563EB', bg: '#EFF6FF', label: 'Trial' },
  past_due: { color: C.warning, bg: '#FFFBEB', label: 'Past Due' },
  canceled: { color: C.danger, bg: '#FEF2F2', label: 'Canceled' },
  paused: { color: C.warning, bg: '#FFFBEB', label: 'Paused' },
  incomplete: { color: C.muted, bg: '#F3F4F6', label: 'Incomplete' },
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

/* ── Card — matches ContractorDashboard: bg-white rounded-[20px] border-black/[0.04] shadow-sm ── */
function GlassCard({ children, className = '', delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  return (
    <div
      className={`bg-white rounded-[20px] border border-black/[0.04] shadow-sm overflow-hidden animate-fade-in ${className}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      {children}
    </div>
  )
}

function SectionHeader({ icon: Icon, iconColor, title, count, action }: { icon: any; iconColor: string; title: string; count?: number; action?: React.ReactNode }) {
  return (
    <div className="px-5 py-3.5 flex items-center justify-between border-b border-black/[0.04]">
      <h2 className="text-[15px] font-bold tracking-tight flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: '#fff4f0' }}>
          <Icon className="w-3.5 h-3.5" style={{ color: C.primary }} />
        </div>
        {title}
        {count !== undefined && (
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#fafafa] text-[#737373]">
            {count}
          </span>
        )}
      </h2>
      {action}
    </div>
  )
}

/* Keep old name as alias for backward compat in modals */
const SectionCard = GlassCard

/* ── Badge ────────────────────────────────────────────────────── */
function StatusBadge({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <span className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: bg, color }}>
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
      <div className="flex items-start relative">
        {/* Background track */}
        <div className="absolute top-4 left-0 right-0 h-[2px]" style={{ background: C.line }} />
        {/* Filled track */}
        <div
          className="absolute top-4 left-0 h-[2px] transition-all duration-500"
          style={{
            background: C.primary,
            width: `${(stages.filter(s => s.reached).length - 1) / (stages.length - 1) * 100}%`,
          }}
        />
        {stages.map((stage) => (
          <div key={stage.key} className="relative flex flex-col items-center z-10" style={{ flex: 1 }}>
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{
                background: stage.isCurrent ? C.primary : stage.reached ? C.primaryLight : C.card,
                border: stage.reached ? 'none' : `2px solid ${C.line}`,
                boxShadow: stage.isCurrent ? `0 0 0 3px ${C.primary}20` : 'none',
              }}
            >
              {stage.reached ? (
                <CheckCircle2 className="w-4 h-4" style={{ color: stage.isCurrent ? 'white' : C.primary }} />
              ) : (
                <CircleDot className="w-4 h-4" style={{ color: '#D1D5DB' }} />
              )}
            </div>
            <p className="text-[11px] font-medium mt-2 text-center" style={{ color: stage.reached ? C.ink : C.hint }}>
              {he ? stage.labelHe : stage.label}
            </p>
            {stage.date && (
              <p className="text-[11px] mt-0.5" style={{ color: C.hint }}>{fmtShort(stage.date)}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── Info Row ─────────────────────────────────────────────────── */
function InfoRow({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-black/[0.04]">
      <span className="text-[12px] text-[#a3a3a3]">{label}</span>
      <span className={`text-[13px] font-semibold ${mono ? 'font-mono text-[11px]' : ''}`}>{value}</span>
    </div>
  )
}

/* ── Main Component ────────────────────────────────────────────── */
export default function ContractorDetail() {
  const { id } = useParams<{ id: string }>()
  const { locale } = useI18n()
  const { impersonate, profile } = useAuth()
  const navigate = useNavigate()
  const he = locale === 'he'

  const [contractor, setContractor] = useState<ContractorData | null>(null)
  const [subcontractors, setSubcontractors] = useState<SubcontractorRow[]>([])
  const [leads, setLeads] = useState<LeadRow[]>([])
  const [groups, setGroups] = useState<GroupInfo[]>([])
  const [linkedGroups, setLinkedGroups] = useState<LinkedGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState(false)
  const [adminNotes, setAdminNotes] = useState('')
  const [showPlanModal, setShowPlanModal] = useState(false)
  const [availablePlans, setAvailablePlans] = useState<{ id: string; slug: string; name: string; price_cents: number; max_counties: number }[]>([])
  const [changingPlan, setChangingPlan] = useState(false)
  const [cpProfile, setCpProfile] = useState<{ background_check: string; tier: string; profile_completeness: number } | null>(null)
  const [pushSubs, setPushSubs] = useState<PushSubscription[]>([])
  const [savingVerification, setSavingVerification] = useState(false)
  const [showAllZips, setShowAllZips] = useState(false)
  const [statusAction, setStatusAction] = useState<'suspend' | 'ban' | 'activate' | null>(null)
  const [statusReason, setStatusReason] = useState('')
  const [savingStatus, setSavingStatus] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    if (!id) return
    loadContractor()
    loadSubcontractors()
    loadLeads()
    loadLinkedGroups()
    loadContractorProfile()
    loadPushSubscriptions()
  }, [id])

  async function loadContractor() {
    setLoading(true)
    const { data, error } = await supabase
      .from('contractors')
      .select(`
        user_id, professions, zip_codes, is_active, created_at, wa_notify,
        profiles!inner(id, full_name, phone, whatsapp_phone, status, suspension_reason, suspended_at, banned_at)
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
      .select('id, plan_id, status, current_period_end, stripe_customer_id, stripe_subscription_id, created_at, plans(name, slug, price_cents)')
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
      wa_notify: raw.wa_notify ?? false,
      profiles: raw.profiles,
      subscription: sub ? {
        id: sub.id,
        plan_id: sub.plan_id,
        status: sub.status,
        current_period_end: sub.current_period_end,
        stripe_customer_id: sub.stripe_customer_id,
        stripe_subscription_id: sub.stripe_subscription_id,
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

  async function loadLinkedGroups() {
    if (!id) return
    const [linksRes, scansRes] = await Promise.all([
      supabase
        .from('contractor_group_links')
        .select('id, invite_link, group_name, status, created_at')
        .eq('contractor_id', id)
        .order('created_at', { ascending: false }),
      supabase
        .from('contractor_group_scan_requests')
        .select('id, invite_link_raw, group_name, status, created_at')
        .eq('contractor_id', id)
        .order('created_at', { ascending: false }),
    ])

    const linked: LinkedGroup[] = [
      ...(linksRes.data ?? []).map((l: any) => ({
        id: l.id,
        invite_link: l.invite_link,
        group_name: l.group_name,
        status: l.status,
        created_at: l.created_at,
        source: 'link' as const,
      })),
      ...(scansRes.data ?? []).map((s: any) => ({
        id: s.id,
        invite_link: s.invite_link_raw,
        group_name: s.group_name,
        status: s.status,
        created_at: s.created_at,
        source: 'scan' as const,
      })),
    ]
    setLinkedGroups(linked)
  }

  async function openPlanModal() {
    const { data } = await supabase
      .from('plans')
      .select('id, slug, name, price_cents, max_counties')
      .eq('is_active', true)
      .order('price_cents')
    if (data) setAvailablePlans(data)
    setShowPlanModal(true)
  }

  async function handleChangePlan(planId: string) {
    if (!id || !contractor?.subscription) return
    setChangingPlan(true)

    // Update subscription plan in DB
    const { error } = await supabase
      .from('subscriptions')
      .update({ plan_id: planId })
      .eq('user_id', id)
      .in('status', ['active', 'trialing'])

    if (error) {
      console.error('Plan change failed:', error)
      setChangingPlan(false)
      return
    }

    const newPlan = availablePlans.find(p => p.id === planId)
    const oldPlan = contractor.subscription.plan

    // If contractor has Stripe subscription, update in Stripe too
    if (contractor.subscription.stripe_subscription_id && newPlan) {
      await supabase.functions.invoke('update-subscription', {
        body: { user_id: id, new_price_id: newPlan.slug === 'pro' ? 'price_1TE0hKCrhYJDA3GP55QDwJKA' : 'price_1TE0hNCrhYJDA3GPJQC7qCGR' },
      })
    }

    // Audit log
    await supabase.from('audit_logs').insert({
      admin_user_id: profile?.id,
      target_user_id: id,
      action: 'plan_change',
      details: { old_plan: oldPlan?.name, new_plan: newPlan?.name, old_plan_id: contractor.subscription.plan_id, new_plan_id: planId },
    })

    setChangingPlan(false)
    setShowPlanModal(false)
    loadContractor()
  }

  async function handleCreateTrial(planSlug: string) {
    if (!id) return
    setChangingPlan(true)
    const plan = availablePlans.find(p => p.slug === planSlug) || availablePlans[0]
    if (!plan) { setChangingPlan(false); return }

    await supabase.from('subscriptions').insert({
      user_id: id,
      plan_id: plan.id,
      status: 'trialing',
      current_period_end: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    })

    // Audit log
    await supabase.from('audit_logs').insert({
      admin_user_id: profile?.id,
      target_user_id: id,
      action: 'trial_created',
      details: { plan: plan.name, plan_id: plan.id, trial_days: 7 },
    })

    setChangingPlan(false)
    setShowPlanModal(false)
    loadContractor()
  }

  async function toggleActive() {
    if (!contractor || !id) return
    setToggling(true)
    const newStatus = !contractor.is_active
    const { error } = await supabase.from('contractors').update({ is_active: newStatus }).eq('user_id', id)
    if (!error) {
      setContractor({ ...contractor, is_active: newStatus })
      await supabase.from('audit_logs').insert({
        admin_user_id: profile?.id,
        target_user_id: id,
        action: newStatus ? 'contractor_activated' : 'contractor_deactivated',
        details: {},
      })
    }
    setToggling(false)
  }

  async function handleStatusChange() {
    if (!contractor || !id || !statusAction) return
    if ((statusAction === 'suspend' || statusAction === 'ban') && !statusReason.trim()) return
    setSavingStatus(true)

    const now = new Date().toISOString()
    const updates: Record<string, any> = { status: statusAction === 'activate' ? 'active' : statusAction === 'suspend' ? 'suspended' : 'banned' }

    if (statusAction === 'suspend') {
      updates.suspension_reason = statusReason.trim()
      updates.suspended_at = now
    } else if (statusAction === 'ban') {
      updates.suspension_reason = statusReason.trim()
      updates.banned_at = now
    } else {
      updates.suspension_reason = null
      updates.suspended_at = null
      updates.banned_at = null
    }

    const { error } = await supabase.from('profiles').update(updates).eq('id', id)

    if (error) {
      toast({ title: 'Failed to update status', description: error.message, variant: 'destructive' })
      setSavingStatus(false)
      return
    }

    // Also deactivate contractor record when suspending/banning
    if (statusAction !== 'activate') {
      await supabase.from('contractors').update({ is_active: false }).eq('user_id', id)
    }

    await supabase.from('audit_logs').insert({
      admin_user_id: profile?.id,
      target_user_id: id,
      action: statusAction === 'activate' ? 'user_activated' : statusAction === 'suspend' ? 'user_suspended' : 'user_banned',
      details: { reason: statusReason.trim() || null, previous_status: contractor.profiles?.status ?? 'active' },
    })

    toast({
      title: statusAction === 'activate' ? 'User activated' : statusAction === 'suspend' ? 'User suspended' : 'User banned',
      description: statusAction === 'activate'
        ? 'Account has been re-enabled.'
        : `Account has been ${statusAction === 'suspend' ? 'suspended' : 'banned'}. User will be signed out on next visit.`,
    })

    setSavingStatus(false)
    setStatusAction(null)
    setStatusReason('')
    loadContractor()
  }

  async function loadContractorProfile() {
    if (!id) return
    const { data } = await supabase
      .from('contractor_profiles')
      .select('background_check, tier, profile_completeness')
      .eq('user_id', id)
      .single()
    if (data) setCpProfile(data)
  }

  async function loadPushSubscriptions() {
    if (!id) return
    const { data } = await supabase
      .from('push_subscriptions')
      .select('id, user_agent, created_at')
      .eq('user_id', id)
    if (data) setPushSubs(data)
  }

  async function handleToggleBgCheck() {
    if (!id || !cpProfile) return
    setSavingVerification(true)
    const newVal = cpProfile.background_check === 'passed' ? 'none' : 'passed'
    const { error } = await supabase
      .from('contractor_profiles')
      .update({ background_check: newVal })
      .eq('user_id', id)
    if (!error) {
      setCpProfile({ ...cpProfile, background_check: newVal })
      toast({ title: newVal === 'passed' ? 'Background check verified' : 'Background check revoked' })
    } else {
      toast({ title: 'Update failed', description: error.message, variant: 'destructive' })
    }
    setSavingVerification(false)
  }

  async function handleChangeTier(newTier: string) {
    if (!id || !cpProfile || cpProfile.tier === newTier) return
    setSavingVerification(true)
    const oldTier = cpProfile.tier
    const { error } = await supabase
      .from('contractor_profiles')
      .update({ tier: newTier })
      .eq('user_id', id)
    if (!error) {
      setCpProfile({ ...cpProfile, tier: newTier })
      // Record tier history
      await supabase.from('tier_history').insert({
        user_id: id,
        old_tier: oldTier,
        new_tier: newTier,
        reason: 'Admin manual override',
      })
      toast({ title: 'Tier updated', description: `${oldTier} → ${newTier}` })
    } else {
      toast({ title: 'Update failed', description: error.message, variant: 'destructive' })
    }
    setSavingVerification(false)
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
        <Link to="/admin/clients" className="text-sm mt-3 inline-block font-medium" style={{ color: C.primary }}>
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
      isCurrent: !!(isPaying && monthsActive <= 1 && sub?.status === 'active'),
    })

    // 4. Renewed
    const hasRenewed = isPaying && monthsActive > 1
    stages.push({
      key: 'renewed',
      label: 'Renewed',
      labelHe: 'חידוש',
      date: hasRenewed && sub?.current_period_end ? sub.current_period_end : null,
      reached: !!hasRenewed,
      isCurrent: !!(hasRenewed && sub?.status === 'active'),
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
    <div className="animate-fade-in space-y-5">
      {/* ═══ Back link ═══ */}
      <Link
        to="/admin/clients"
        className="inline-flex items-center gap-2 text-[13px] font-semibold transition-all hover:gap-3 group"
        style={{ color: C.muted }}
      >
        <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
        {he ? 'קבלנים' : 'Contractors'}
      </Link>

      {/* ═══ Hero Header ═══ */}
      <div className="bg-white rounded-[20px] border border-black/[0.04] shadow-sm overflow-hidden animate-fade-in">
        <div className="px-6 py-5">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="flex items-center gap-4">
              {/* Avatar */}
              <div className="relative">
                <div className="w-14 h-14 rounded-2xl bg-[#fe5b25] flex items-center justify-center text-xl font-bold text-white shrink-0">
                  {initials}
                </div>
                <div
                  className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full ring-[2.5px] ring-white"
                  style={{ background: contractor.is_active ? C.success : C.danger }}
                />
              </div>

              <div className="space-y-1.5">
                {/* Name + badges */}
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-[20px] font-bold tracking-tight">{contractor.profiles?.full_name ?? 'Unknown'}</h1>

                  {planConf && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#fff4f0] text-[#fe5b25]">
                      <Crown className="w-3 h-3" /> {plan?.name}
                    </span>
                  )}

                  {contractor.subscription && (
                    <StatusBadge
                      label={SUB_STATUS_MAP[contractor.subscription.status]?.label ?? contractor.subscription.status}
                      color={SUB_STATUS_MAP[contractor.subscription.status]?.color ?? C.muted}
                      bg={SUB_STATUS_MAP[contractor.subscription.status]?.bg ?? '#f5f5f5'}
                    />
                  )}

                  {!contractor.is_active && (
                    <StatusBadge label={he ? 'מושבת' : 'Inactive'} color={C.danger} bg="#FEF2F2" />
                  )}
                </div>

                {/* Meta row */}
                <div className="flex items-center gap-3 flex-wrap">
                  {contractor.profiles?.phone && (
                    <span className="text-[13px] flex items-center gap-1.5 text-[#737373]">
                      <Phone className="w-3.5 h-3.5 text-[#a3a3a3]" /> {contractor.profiles.phone}
                    </span>
                  )}
                  <span className="text-[13px] flex items-center gap-1.5 text-[#737373]">
                    <Calendar className="w-3.5 h-3.5 text-[#a3a3a3]" /> {fmtDate(contractor.created_at)}
                  </span>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#fafafa] text-[#737373]">
                    {daysAsCustomer} {he ? 'ימים' : 'days'}
                  </span>
                </div>

                {/* Channel pills */}
                <div className="flex items-center gap-1.5">
                  {[
                    { key: 'wa', label: 'WhatsApp', active: contractor.wa_notify && !!contractor.profiles?.whatsapp_phone, color: '#25D366', icon: MessageCircle },
                    { key: 'push', label: 'Push', active: pushSubs.length > 0, color: C.accent, icon: Bell },
                  ].map((ch) => (
                    <span
                      key={ch.key}
                      title={`${ch.label}: ${ch.active ? 'Active' : 'Off'}`}
                      className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-full"
                      style={{
                        background: ch.active ? `${ch.color}10` : '#fafafa',
                        color: ch.active ? ch.color : '#d4d4d4',
                      }}
                    >
                      <ch.icon className="w-3 h-3" />
                      {ch.label}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col items-end gap-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={async () => { await impersonate(contractor.user_id); navigate('/') }}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-semibold text-white bg-[#111] active:scale-[0.97] transition-transform"
                >
                  <Eye className="w-4 h-4" /> {he ? 'צפה' : 'View As'}
                </button>
                <button
                  onClick={toggleActive}
                  disabled={toggling}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-semibold active:scale-[0.97] transition-transform"
                  style={{
                    background: contractor.is_active ? '#FEF2F2' : '#ECFDF5',
                    color: contractor.is_active ? C.danger : C.success,
                    opacity: toggling ? 0.6 : 1,
                  }}
                >
                  {contractor.is_active
                    ? <><UserX className="w-4 h-4" /> {he ? 'השבת' : 'Deactivate'}</>
                    : <><UserCheck className="w-4 h-4" /> {he ? 'הפעל' : 'Activate'}</>
                  }
                </button>
              </div>
              {/* Moderation */}
              {(() => {
                const userStatus = contractor.profiles?.status ?? 'active'
                return (
                  <div className="flex items-center gap-1.5">
                    {(userStatus === 'suspended' || userStatus === 'banned') && (
                      <span className="text-[11px] text-[#a3a3a3]">{contractor.profiles?.suspension_reason}</span>
                    )}
                    {userStatus !== 'suspended' && userStatus !== 'banned' && (
                      <button
                        onClick={() => { setStatusAction('suspend'); setStatusReason('') }}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-medium active:scale-[0.97] transition-transform"
                        style={{ background: '#FFFBEB', color: C.warning }}
                      >
                        <AlertTriangle className="w-3 h-3" /> {he ? 'השעה' : 'Suspend'}
                      </button>
                    )}
                    {userStatus !== 'banned' && (
                      <button
                        onClick={() => { setStatusAction('ban'); setStatusReason('') }}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-medium active:scale-[0.97] transition-transform"
                        style={{ background: '#FEF2F2', color: C.danger }}
                      >
                        <Ban className="w-3 h-3" /> {he ? 'חסום' : 'Ban'}
                      </button>
                    )}
                    {userStatus !== 'active' && (
                      <button
                        onClick={() => { setStatusAction('activate'); setStatusReason('') }}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-medium active:scale-[0.97] transition-transform"
                        style={{ background: '#ECFDF5', color: C.success }}
                      >
                        <UserCheck className="w-3 h-3" /> {he ? 'הפעל' : 'Activate'}
                      </button>
                    )}
                  </div>
                )
              })()}
            </div>
          </div>
        </div>
      </div>

      {/* ═══ Status Change Confirmation Modal ═══ */}
      {statusAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setStatusAction(null)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div
            className="relative rounded-xl p-6 w-full max-w-sm animate-fade-in"
            style={{ background: 'white', boxShadow: '0 20px 40px rgba(0,0,0,0.12)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold mb-1" style={{ color: C.dark }}>
              {statusAction === 'activate'
                ? (he ? 'הפעל חשבון' : 'Activate Account')
                : statusAction === 'suspend'
                  ? (he ? 'השעה חשבון' : 'Suspend Account')
                  : (he ? 'חסום חשבון' : 'Ban Account')
              }
            </h2>
            <p className="text-[13px] mb-5" style={{ color: C.muted }}>
              {statusAction === 'activate'
                ? (he ? 'החשבון יופעל מחדש והמשתמש יוכל להתחבר.' : 'The account will be re-enabled and the user will be able to sign in.')
                : statusAction === 'suspend'
                  ? (he ? 'החשבון יושעה זמנית. המשתמש לא יוכל להתחבר.' : 'The account will be temporarily suspended. The user will not be able to sign in.')
                  : (he ? 'החשבון ייחסם לצמיתות. המשתמש לא יוכל להתחבר.' : 'The account will be permanently banned. The user will not be able to sign in.')
              }
            </p>
            {statusAction !== 'activate' && (
              <div className="mb-5">
                <label className="text-[12px] font-semibold block mb-1.5" style={{ color: C.dark }}>
                  {he ? 'סיבה (חובה)' : 'Reason (required)'}
                </label>
                <textarea
                  value={statusReason}
                  onChange={(e) => setStatusReason(e.target.value)}
                  rows={3}
                  placeholder={he ? 'הזן סיבה...' : 'Enter reason...'}
                  className="w-full rounded-xl px-4 py-3 text-sm outline-none resize-none transition-all focus:ring-2 focus:ring-orange-200"
                  style={{ border: `1.5px solid ${C.border}`, color: C.dark }}
                />
              </div>
            )}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setStatusAction(null)}
                className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold transition-all hover:bg-gray-50"
                style={{ border: `1.5px solid ${C.border}`, color: C.muted }}
              >
                {he ? 'ביטול' : 'Cancel'}
              </button>
              <button
                onClick={handleStatusChange}
                disabled={savingStatus || ((statusAction === 'suspend' || statusAction === 'ban') && !statusReason.trim())}
                className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold text-white transition-all hover:shadow-md active:scale-95 disabled:opacity-50"
                style={{
                  background: statusAction === 'activate' ? C.success : statusAction === 'suspend' ? '#D97706' : C.danger,
                }}
              >
                {savingStatus ? (
                  <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                ) : statusAction === 'activate'
                  ? (he ? 'הפעל' : 'Activate')
                  : statusAction === 'suspend'
                    ? (he ? 'השעה' : 'Suspend')
                    : (he ? 'חסום' : 'Ban')
                }
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Customer Lifecycle Pipeline ═══ */}
      <GlassCard delay={50}>
        <div className="px-5 py-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 shrink-0">
              <div className="w-7 h-7 rounded-lg bg-[#fff4f0] flex items-center justify-center">
                <TrendingUp className="w-3.5 h-3.5 text-[#fe5b25]" />
              </div>
              <h2 className="text-[15px] font-bold tracking-tight">{he ? 'מסלול' : 'Lifecycle'}</h2>
            </div>
            <div className="flex items-center gap-1.5 flex-1">
              {pipelineStages.map((stage, i) => (
                <div key={stage.key} className="flex items-center gap-1.5" style={{ flex: 1 }}>
                  <div
                    className="flex items-center gap-2 px-3 py-2.5 rounded-xl flex-1 active:scale-[0.97] transition-transform"
                    style={{
                      background: stage.isCurrent ? '#fe5b25' : stage.reached ? '#fff4f0' : '#fafafa',
                      border: `1px solid ${stage.isCurrent ? '#fe5b25' : stage.reached ? 'rgba(254,91,37,0.15)' : 'rgba(0,0,0,0.04)'}`,
                    }}
                  >
                    {stage.reached ? (
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" style={{ color: stage.isCurrent ? 'white' : '#fe5b25' }} />
                    ) : (
                      <CircleDot className="w-3.5 h-3.5 shrink-0 text-[#d4d4d4]" />
                    )}
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold truncate" style={{ color: stage.isCurrent ? 'white' : stage.reached ? '#111' : '#a3a3a3' }}>
                        {he ? stage.labelHe : stage.label}
                      </p>
                      {stage.date && (
                        <p className="text-[9px]" style={{ color: stage.isCurrent ? 'rgba(255,255,255,0.7)' : '#a3a3a3' }}>
                          {fmtShort(stage.date)}
                        </p>
                      )}
                    </div>
                  </div>
                  {i < pipelineStages.length - 1 && (
                    <div className="w-3 h-0.5 rounded-full shrink-0" style={{ background: stage.reached ? 'rgba(254,91,37,0.3)' : '#e5e5e5' }} />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </GlassCard>

      {/* ═══ Revenue KPI Strip ═══ */}
      <GlassCard delay={80}>
        <SectionHeader icon={BarChart3} iconColor={C.success} title={he ? 'הכנסות וחיוב' : 'Revenue & Billing'} />
        <div className="p-5">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
            {[
              { label: 'MRR', value: monthlyFee > 0 ? `$${monthlyFee}` : '\u2014' },
              { label: 'LTV', value: ltv > 0 ? `$${ltv.toLocaleString()}` : '\u2014' },
              { label: he ? 'חודשים' : 'Months', value: monthsActive > 0 ? String(monthsActive) : '\u2014' },
              { label: he ? 'ימים' : 'Days', value: String(daysAsCustomer) },
              { label: he ? 'חיוב הבא' : 'Next Bill', value: contractor.subscription?.current_period_end ? fmtShort(contractor.subscription.current_period_end) : '\u2014' },
              { label: he ? 'מחזור' : 'Interval', value: monthlyFee > 0 ? (he ? 'חודשי' : 'Monthly') : '\u2014' },
            ].map((kpi) => (
              <div key={kpi.label} className="bg-white rounded-[20px] border border-black/[0.04] shadow-sm p-3 text-center">
                <p className="text-[18px] font-bold tracking-tight">{kpi.value}</p>
                <p className="text-[8px] text-[#a3a3a3] mt-0.5 uppercase tracking-wide">{kpi.label}</p>
              </div>
            ))}
          </div>
        </div>
      </GlassCard>

      {/* ═══ 2-Column Layout: Main + Sidebar ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Left Column (2/3) ── */}
        <div className="lg:col-span-2 space-y-6">

          {/* Subscription Card */}
          <GlassCard delay={140}>
            <SectionHeader icon={CreditCard} iconColor={C.accent} title={he ? 'מנוי' : 'Subscription'} />
            <div className="p-6">
              {contractor.subscription ? (
                <div className="space-y-4">
                  {/* Plan visual */}
                  <div className="bg-[#fafafa] rounded-[20px] p-5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-[#fff4f0] flex items-center justify-center">
                          <Crown className="w-5 h-5 text-[#fe5b25]" />
                        </div>
                        <span className="text-[15px] font-bold">{plan?.name}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[26px] font-bold tracking-tight">${monthlyFee}</span>
                        <span className="text-[12px] text-[#a3a3a3] ml-0.5">/mo</span>
                      </div>
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

                  {/* Admin upgrade/change plan button */}
                  <div className="flex gap-3 mt-5 pt-5" style={{ borderTop: `1px solid ${C.line}` }}>
                    <button
                      onClick={openPlanModal}
                      className="flex-1 flex items-center justify-center gap-2 bg-[#fe5b25] text-white py-3 rounded-xl text-[13px] font-semibold active:scale-[0.97] transition-transform"
                    >
                      <ArrowUpCircle className="w-4 h-4" />
                      {he ? 'שנה חבילה' : 'Change Plan'}
                    </button>
                    {contractor.subscription.stripe_customer_id && (
                      <button
                        onClick={() => window.open(`https://dashboard.stripe.com/customers/${contractor.subscription.stripe_customer_id}`, '_blank')}
                        className="px-5 py-3 rounded-xl text-[13px] font-semibold border border-black/[0.04] text-[#737373] active:scale-[0.97] transition-transform"
                      >
                        Stripe
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-10">
                  <div className="w-14 h-14 mx-auto mb-4 rounded-2xl flex items-center justify-center" style={{ background: C.subtle }}>
                    <Package className="w-7 h-7" style={{ color: '#CBD5E1' }} />
                  </div>
                  <p className="text-[15px] font-semibold mb-1" style={{ color: C.ink }}>{he ? 'ללא מנוי' : 'No subscription'}</p>
                  <p className="text-[13px] mb-5" style={{ color: C.hint }}>{he ? 'הפעל תקופת ניסיון' : 'Start a trial to begin billing'}</p>
                  <button
                    onClick={openPlanModal}
                    className="inline-flex items-center gap-2 bg-[#059669] text-white px-6 py-3 rounded-xl text-[13px] font-semibold active:scale-[0.97] transition-transform"
                  >
                    <Sparkles className="w-4 h-4" />
                    {he ? 'הפעל Trial' : 'Start Trial'}
                  </button>
                </div>
              )}
            </div>
          </GlassCard>

          {/* Plan Change Modal */}
          {showPlanModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowPlanModal(false)}>
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="p-6 pb-4" style={{ borderBottom: `1px solid ${C.border}` }}>
                  <h3 className="text-lg font-bold" style={{ color: C.dark }}>
                    {he ? 'שנה חבילה' : 'Change Plan'}
                  </h3>
                  <p className="text-sm mt-1" style={{ color: C.muted }}>
                    {contractor?.profile_name || contractor?.full_name}
                  </p>
                </div>
                <div className="p-6 space-y-3">
                  {availablePlans.map(p => {
                    const isCurrent = contractor?.subscription?.plan_id === p.id
                    const currentPlan = contractor?.subscription?.plan
                    const currentPrice = (currentPlan as any)?.price_cents ?? 0
                    const diff = p.price_cents - currentPrice
                    const periodEnd = contractor?.subscription?.current_period_end
                    const daysLeft = periodEnd ? Math.max(0, Math.ceil((new Date(periodEnd).getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : 0
                    const proratedDiff = Math.round((diff / 100) * (daysLeft / 30) * 100) / 100

                    return (
                      <button
                        key={p.id}
                        onClick={() => contractor?.subscription ? handleChangePlan(p.id) : handleCreateTrial(p.slug)}
                        disabled={isCurrent || changingPlan}
                        className={`w-full text-left rounded-xl p-4 transition-all border-2 ${
                          isCurrent
                            ? 'border-green-300 bg-green-50 cursor-default'
                            : 'border-gray-100 hover:border-indigo-300 hover:bg-indigo-50 active:scale-[0.98]'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-sm font-bold" style={{ color: C.dark }}>{p.name}</span>
                            <span className="text-xs ml-2" style={{ color: C.muted }}>
                              {p.max_counties === -1 ? 'Unlimited' : `${p.max_counties} county`}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-lg font-bold" style={{ color: C.dark }}>
                              ${p.price_cents / 100}
                            </span>
                            <span className="text-xs" style={{ color: C.muted }}>/mo</span>
                          </div>
                        </div>
                        {isCurrent && (
                          <span className="inline-flex items-center gap-1 mt-2 text-xs font-semibold text-green-600">
                            <CheckCircle2 className="w-3 h-3" /> Current plan
                          </span>
                        )}
                        {!isCurrent && contractor?.subscription && diff !== 0 && (
                          <span className={`inline-flex items-center gap-1 mt-2 text-xs font-medium ${diff > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                            {diff > 0 ? '↑' : '↓'} {diff > 0 ? 'Upgrade' : 'Downgrade'}
                            {daysLeft > 0 && ` · ~$${Math.abs(proratedDiff).toFixed(0)} proration (${daysLeft}d left)`}
                          </span>
                        )}
                      </button>
                    )
                  })}
                  {changingPlan && (
                    <div className="flex items-center justify-center gap-2 py-2">
                      <Loader2 className="w-4 h-4 animate-spin" style={{ color: C.accent }} />
                      <span className="text-sm" style={{ color: C.muted }}>Updating...</span>
                    </div>
                  )}
                </div>
                <div className="p-4 pt-2" style={{ borderTop: `1px solid ${C.border}` }}>
                  <button
                    onClick={() => setShowPlanModal(false)}
                    className="w-full rounded-xl py-2.5 text-sm font-medium transition-all hover:bg-gray-50"
                    style={{ color: C.muted }}
                  >
                    {he ? 'ביטול' : 'Cancel'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Groups Membership */}
          <SectionCard>
            <SectionHeader icon={MessageSquare} iconColor="#059669" title={he ? 'קבוצות ווטסאפ' : 'WhatsApp Groups'} count={groups.length + linkedGroups.length} />
            {groups.length === 0 && linkedGroups.length === 0 ? (
              <div className="px-6 py-4 text-center">
                <p className="text-[13px]" style={{ color: C.hint }}>
                  {he ? 'אין קבוצות מקושרות' : 'No groups linked'}
                </p>
              </div>
            ) : (
              <div className="p-6 space-y-3">
                {/* Groups from leads */}
                {groups.length > 0 && (
                  <div>
                    <p className="text-[12px] font-medium mb-2" style={{ color: C.hint }}>
                      {he ? 'קבוצות מלידים' : 'From Leads'}
                    </p>
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
                {/* Linked / Scan groups */}
                {linkedGroups.length > 0 && (
                  <div>
                    <p className="text-[12px] font-medium mb-2" style={{ color: C.hint }}>
                      {he ? 'קבוצות מקושרות' : 'Linked Groups'}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {linkedGroups.map((lg) => {
                        const statusColors: Record<string, { bg: string; text: string; border: string }> = {
                          joined: { bg: '#ECFDF5', text: '#065F46', border: '#A7F3D0' },
                          pending: { bg: '#FFFBEB', text: '#92400E', border: '#FDE68A' },
                          failed: { bg: '#FEF2F2', text: '#991B1B', border: '#FECACA' },
                        }
                        const sc = statusColors[lg.status] ?? statusColors.pending
                        return (
                          <div
                            key={lg.id}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-[12px] font-semibold"
                            style={{ background: sc.bg, color: sc.text, border: `1px solid ${sc.border}` }}
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            {lg.group_name || (he ? 'ממתין לסריקה' : 'Pending scan')}
                            <span
                              className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                              style={{ background: `${sc.text}15`, color: sc.text }}
                            >
                              {lg.status}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </SectionCard>

          {/* Subcontractors Table */}
          <SectionCard>
            <SectionHeader icon={UsersRound} iconColor={C.accent} title={he ? 'תת-קבלנים' : 'Subcontractors'} count={subcontractors.length} />
            {subcontractors.length === 0 ? (
              <div className="px-6 py-4 text-center">
                <p className="text-[13px]" style={{ color: C.hint }}>{he ? 'אין תת-קבלנים' : 'No subcontractors yet'}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${C.line}` }}>
                      {[he ? 'שם' : 'Name', he ? 'טלפון' : 'Phone', he ? 'מקצועות' : 'Skills', he ? 'עבודות' : 'Jobs', he ? 'סטטוס' : 'Last Status', he ? 'נוסף' : 'Added'].map((col, i) => (
                        <th key={i} className="text-start px-5 py-3 text-[12px] font-medium" style={{ color: C.hint }}>{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {subcontractors.map((sub, idx) => (
                      <tr key={sub.id} className="transition-colors duration-150 hover:bg-slate-50" style={{ borderBottom: idx < subcontractors.length - 1 ? `1px solid ${C.line}` : undefined }}>
                        <td className="px-5 py-3">
                          <span className="font-medium text-[13px]" style={{ color: C.ink }}>{sub.full_name}</span>
                        </td>
                        <td className="px-5 py-3 text-[13px] font-mono" style={{ color: C.hint }}>{sub.phone ?? '\u2014'}</td>
                        <td className="px-5 py-3">
                          <div className="flex gap-0.5">
                            {sub.profession_tags?.map((p) => (
                              <span key={p} title={p} className="text-sm leading-none">{PROF_EMOJI[p] ?? '📋'}</span>
                            ))}
                            {(!sub.profession_tags || sub.profession_tags.length === 0) && <span className="text-[13px]" style={{ color: '#D1D5DB' }}>{'\u2014'}</span>}
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          <span className="text-[13px] font-semibold" style={{ color: sub.job_count > 0 ? C.ink : '#D1D5DB' }}>{sub.job_count}</span>
                        </td>
                        <td className="px-5 py-3">
                          {sub.last_job_status ? (
                            <StatusBadge
                              label={sub.last_job_status}
                              color={JOB_STATUS_CONFIG[sub.last_job_status]?.color ?? C.muted}
                              bg={JOB_STATUS_CONFIG[sub.last_job_status]?.bg ?? '#F3F4F6'}
                            />
                          ) : (
                            <span className="text-[13px]" style={{ color: '#D1D5DB' }}>{'\u2014'}</span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-[12px]" style={{ color: C.hint }}>{fmtShort(sub.created_at)}</td>
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
              <div className="px-6 py-4 text-center">
                <p className="text-[13px]" style={{ color: C.hint }}>{he ? 'אין לידים' : 'No leads yet'}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${C.line}` }}>
                      {[he ? 'מקצוע' : 'Profession', he ? 'עיר' : 'City', he ? 'קבוצה' : 'Group', he ? 'דחיפות' : 'Urgency', he ? 'סטטוס' : 'Status', he ? 'תאריך' : 'Date'].map((col, i) => (
                        <th key={i} className="text-start px-5 py-3 text-[12px] font-medium" style={{ color: C.hint }}>{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {leads.map((lead, idx) => (
                      <tr key={lead.id} className="transition-colors duration-150 hover:bg-slate-50" style={{ borderBottom: idx < leads.length - 1 ? `1px solid ${C.line}` : undefined }}>
                        <td className="px-5 py-3">
                          <span className="text-sm mr-1">{PROF_EMOJI[lead.profession] ?? '📋'}</span>
                          <span className="text-[13px] font-medium" style={{ color: C.ink }}>{lead.profession}</span>
                        </td>
                        <td className="px-5 py-3 text-[13px]" style={{ color: C.hint }}>{lead.city ?? '\u2014'}</td>
                        <td className="px-5 py-3">
                          {lead.group_name ? (
                            <span className="text-[11px] font-medium px-2 py-0.5 rounded-md" style={{ background: '#ECFDF5', color: '#065F46' }}>
                              {lead.group_name}
                            </span>
                          ) : (
                            <span className="text-[13px]" style={{ color: '#D1D5DB' }}>{'\u2014'}</span>
                          )}
                        </td>
                        <td className="px-5 py-3">
                          {URGENCY_CONFIG[lead.urgency] ? (
                            <StatusBadge label={lead.urgency} color={URGENCY_CONFIG[lead.urgency].color} bg={URGENCY_CONFIG[lead.urgency].bg} />
                          ) : <span className="text-[13px]" style={{ color: '#D1D5DB' }}>{'\u2014'}</span>}
                        </td>
                        <td className="px-5 py-3">
                          {LEAD_STATUS_CONFIG[lead.status] ? (
                            <StatusBadge label={lead.status} color={LEAD_STATUS_CONFIG[lead.status].color} bg={LEAD_STATUS_CONFIG[lead.status].bg} />
                          ) : <span className="text-[13px]" style={{ color: '#D1D5DB' }}>{'\u2014'}</span>}
                        </td>
                        <td className="px-5 py-3 text-[12px]" style={{ color: C.hint }}>{fmtShort(lead.created_at)}</td>
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

          {/* Contact + Channels */}
          <GlassCard delay={100}>
            <div className="p-5 space-y-4">
              <h3 className="text-[13px] font-semibold flex items-center gap-2" style={{ color: C.ink }}>
                <Phone className="w-3.5 h-3.5" style={{ color: C.hint }} />
                {he ? 'פרטי קשר' : 'Contact Info'}
              </h3>

              <div className="space-y-0">
                {contractor.profiles?.phone && (
                  <InfoRow label={he ? 'טלפון' : 'Phone'} value={contractor.profiles.phone} />
                )}
                <InfoRow label={he ? 'הצטרף' : 'Joined'} value={fmtDate(contractor.created_at)} />
                <InfoRow label="User ID" value={<span className="font-mono text-[11px]">{contractor.user_id.slice(0, 12)}...</span>} mono />
              </div>

              <div className="pt-2">
                <h3 className="text-[13px] font-semibold flex items-center gap-2" style={{ color: C.ink }}>
                  <Bell className="w-3.5 h-3.5" style={{ color: C.hint }} />
                  {he ? 'ערוצי התראות' : 'Channels'}
                  {(() => {
                    const count = [
                      contractor.wa_notify && contractor.profiles?.whatsapp_phone,
                      pushSubs.length > 0,
                    ].filter(Boolean).length
                    const clr = count >= 2 ? C.success : count >= 1 ? C.warning : C.danger
                    return (
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: `${clr}12`, color: clr }}>
                        {count}/2
                      </span>
                    )
                  })()}
                </h3>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'WhatsApp', active: contractor.wa_notify && !!contractor.profiles?.whatsapp_phone, color: '#25D366', icon: MessageCircle },
                  { label: 'Push', active: pushSubs.length > 0, color: C.accent, icon: Smartphone },
                ].map((ch) => (
                  <div
                    key={ch.label}
                    className="flex items-center gap-2.5 p-2.5 bg-white rounded-[20px] border border-black/[0.04] shadow-sm"
                  >
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: ch.active ? `${ch.color}10` : '#fafafa' }}>
                      <ch.icon className="w-4 h-4" style={{ color: ch.active ? ch.color : '#d4d4d4' }} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold" style={{ color: ch.active ? ch.color : '#d4d4d4' }}>{ch.label}</p>
                      <p className="text-[9px]" style={{ color: ch.active ? '#737373' : '#d4d4d4' }}>
                        {ch.active ? (he ? 'מחובר' : 'Active') : (he ? 'כבוי' : 'Off')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </GlassCard>



          {/* Trades / Professions */}
          <GlassCard delay={200}>
            <div className="p-5 space-y-3">
              <h3 className="text-[13px] font-semibold flex items-center gap-2" style={{ color: C.ink }}>
                <Briefcase className="w-3.5 h-3.5" style={{ color: C.hint }} />
                {he ? 'מקצועות' : 'Trades'}
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: `${C.accent}12`, color: C.accent }}>
                  {contractor.professions.length}
                </span>
              </h3>

              {contractor.professions.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {contractor.professions.map((p) => (
                    <div key={p} className="bg-white rounded-[20px] border border-black/[0.04] shadow-sm px-3.5 py-3 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-[#fff4f0] flex items-center justify-center">
                        <span className="text-sm">{PROF_EMOJI[p] ?? '📋'}</span>
                      </div>
                      <span className="text-[12px] font-semibold capitalize">{p}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[12px] text-center py-3" style={{ color: C.hint }}>
                  {he ? 'לא הוגדרו' : 'None defined'}
                </p>
              )}
            </div>
          </GlassCard>

          {/* Service Areas */}
          <GlassCard delay={280}>
            <div className="p-5 space-y-3">
              <h3 className="text-[13px] font-semibold flex items-center gap-2" style={{ color: C.ink }}>
                <MapPin className="w-3.5 h-3.5" style={{ color: C.hint }} />
                {he ? 'אזורי שירות' : 'Service Areas'}
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: C.primaryLight, color: C.primary }}>
                  {contractor.zip_codes.length}
                </span>
              </h3>

              {contractor.zip_codes.length > 0 ? (
                <>
                  <div className="flex flex-wrap gap-1.5">
                    {(showAllZips ? contractor.zip_codes : contractor.zip_codes.slice(0, 12)).map((zip) => (
                      <div key={zip} className="bg-white rounded-[20px] border border-black/[0.04] shadow-sm px-3 py-2 flex items-center gap-2">
                        <MapPin className="w-2.5 h-2.5 text-[#fe5b25]" />
                        <span className="text-[11px] font-medium">{zip}</span>
                      </div>
                    ))}
                  </div>
                  {contractor.zip_codes.length > 12 && (
                    <button
                      onClick={() => setShowAllZips(!showAllZips)}
                      className="w-full text-center text-[12px] font-semibold py-2 rounded-lg transition-all duration-200 hover:bg-orange-50"
                      style={{ color: C.primary }}
                    >
                      {showAllZips
                        ? (he ? 'הצג פחות' : 'Show less')
                        : (he ? `הצג עוד ${contractor.zip_codes.length - 12}` : `Show ${contractor.zip_codes.length - 12} more`)
                      }
                    </button>
                  )}
                </>
              ) : (
                <p className="text-[13px] text-center py-3" style={{ color: C.hint }}>
                  {he ? 'לא הוגדרו' : 'None defined'}
                </p>
              )}
            </div>
          </GlassCard>

          {/* Profile Verification */}
          {cpProfile && (
            <GlassCard delay={350}>
              <div className="p-5 space-y-4">
                <h3 className="text-[13px] font-semibold flex items-center gap-2" style={{ color: C.ink }}>
                  <ShieldCheck className="w-3.5 h-3.5" style={{ color: C.hint }} />
                  {he ? 'אימות פרופיל' : 'Profile Verification'}
                </h3>

                {/* Background Check */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <ShieldCheck className="w-5 h-5" style={{ color: cpProfile.background_check === 'passed' ? C.success : C.hint }} />
                    <div>
                      <p className="text-[12px] font-medium" style={{ color: C.hint }}>Background Check</p>
                      <p className="text-[13px] font-semibold" style={{ color: cpProfile.background_check === 'passed' ? C.success : C.hint }}>
                        {cpProfile.background_check === 'passed' ? (he ? 'מאומת' : 'Passed') : (he ? 'לא מאומת' : 'Not verified')}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleToggleBgCheck}
                    disabled={savingVerification}
                    className="px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors hover:opacity-80"
                    style={{
                      background: cpProfile.background_check === 'passed' ? '#FEF2F2' : '#ECFDF5',
                      color: cpProfile.background_check === 'passed' ? C.danger : C.success,
                      opacity: savingVerification ? 0.6 : 1,
                    }}
                  >
                    {cpProfile.background_check === 'passed' ? (he ? 'בטל' : 'Revoke') : (he ? 'אמת' : 'Verify')}
                  </button>
                </div>

                {/* Trust Tier */}
                <div>
                  <p className="text-[12px] font-medium mb-2" style={{ color: C.hint }}>Trust Tier</p>
                  <div className="grid grid-cols-4 gap-1.5">
                    {([
                      { key: 'new', label: 'New', color: '#6B7280' },
                      { key: 'verified', label: 'Verified', color: '#2563EB' },
                      { key: 'trusted', label: 'Trusted', color: '#059669' },
                      { key: 'elite', label: 'Elite', color: '#D97706' },
                    ] as const).map((t) => {
                      const isActive = cpProfile.tier === t.key
                      return (
                        <button
                          key={t.key}
                          onClick={() => handleChangeTier(t.key)}
                          disabled={savingVerification}
                          className="py-2.5 rounded-xl text-[11px] font-semibold text-center transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm active:scale-[0.97]"
                          style={{
                            background: isActive ? `${t.color}08` : C.card,
                            color: isActive ? t.color : C.hint,
                            border: `2px solid ${isActive ? t.color : C.line}`,
                            boxShadow: isActive ? `0 2px 8px ${t.color}20` : 'none',
                            opacity: savingVerification ? 0.6 : 1,
                          }}
                        >
                          {t.label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Profile Completeness */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-[12px] font-medium" style={{ color: C.hint }}>
                      {he ? 'השלמת פרופיל' : 'Profile Completeness'}
                    </p>
                    <span className="text-[13px] font-bold" style={{ color: cpProfile.profile_completeness >= 70 ? C.success : cpProfile.profile_completeness >= 40 ? C.warning : C.hint }}>
                      {cpProfile.profile_completeness}%
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: C.subtle }}>
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${cpProfile.profile_completeness}%`,
                        background: cpProfile.profile_completeness >= 70 ? C.success
                          : cpProfile.profile_completeness >= 40 ? C.warning : C.hint,
                      }}
                    />
                  </div>
                </div>
              </div>
            </GlassCard>
          )}

          {/* Admin Notes */}
          <GlassCard delay={420}>
            <div className="p-5 space-y-3">
              <h3 className="text-[13px] font-semibold flex items-center gap-2" style={{ color: C.ink }}>
                <StickyNote className="w-3.5 h-3.5" style={{ color: C.hint }} />
                {he ? 'הערות מנהל' : 'Admin Notes'}
              </h3>
              <textarea
                className="w-full rounded-xl px-4 py-3 text-[13px] resize-none focus:outline-none focus:ring-2 focus:ring-orange-200/60 transition-all duration-200"
                style={{
                  background: C.subtle,
                  border: `1.5px solid ${C.line}`,
                  color: C.ink,
                  minHeight: '100px',
                  lineHeight: '1.6',
                }}
                placeholder={he ? 'הוסף הערות על הלקוח...' : 'Add notes about this customer...'}
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
              />
              <p className="text-[11px]" style={{ color: C.hint }}>
                {he ? 'הערות נשמרות באופן מקומי בלבד' : 'Notes are saved locally only'}
              </p>
            </div>
          </GlassCard>

        </div>
      </div>

      {/* No page-specific CSS — uses app design system */}
    </div>
  )
}
