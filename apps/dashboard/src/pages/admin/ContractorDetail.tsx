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

/* ── Design tokens (aligned with app-wide system) ─────────────── */
const C = {
  primary: '#fe5b25',
  primaryDark: '#e04d1c',
  dark: '#1C1C1E',
  darkSub: '#3A3A3C',
  muted: '#8E8E93',
  accent: '#5856D6',
  success: '#059669',
  warning: '#D97706',
  danger: '#DC2626',
  border: 'rgba(0,0,0,0.04)',
  bg: '#FBFBFD',
  glass: 'rgba(255,255,255,0.82)',
  glassBorder: 'rgba(255,255,255,0.5)',
}

/* ── Types ──────────────────────────────────────────────────────── */
interface ContractorData {
  user_id: string
  professions: string[]
  zip_codes: string[]
  is_active: boolean
  created_at: string
  wa_notify: boolean
  sms_opt_out: boolean
  profiles: {
    id: string
    full_name: string | null
    phone: string | null
    whatsapp_phone: string | null
    telegram_chat_id: number | null
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

/* ── Glass Card wrapper (matches app design system) ───────────── */
function GlassCard({ children, className = '', delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  return (
    <div
      className={`rounded-3xl overflow-hidden transition-all duration-500 hover:-translate-y-0.5 ${className}`}
      style={{
        background: C.glass,
        backdropFilter: 'blur(32px) saturate(180%)',
        WebkitBackdropFilter: 'blur(32px) saturate(180%)',
        border: `1px solid ${C.border}`,
        boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)',
        animationDelay: `${delay}ms`,
      }}
    >
      {children}
    </div>
  )
}

function SectionHeader({ icon: Icon, iconColor, title, count, action }: { icon: any; iconColor: string; title: string; count?: number; action?: React.ReactNode }) {
  return (
    <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: `1px solid ${C.border}` }}>
      <h2 className="text-[14px] font-bold tracking-tight flex items-center gap-2.5" style={{ color: C.dark, letterSpacing: '-0.015em' }}>
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center"
          style={{ background: `${iconColor}12`, boxShadow: `0 2px 8px ${iconColor}15` }}
        >
          <Icon className="w-4 h-4" style={{ color: iconColor }} />
        </div>
        {title}
        {count !== undefined && (
          <span
            className="text-[10px] font-bold px-2.5 py-1 rounded-full"
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

/* Keep old name as alias for backward compat in modals */
const SectionCard = GlassCard

/* ── Badge component ───────────────────────────────────────────── */
function StatusBadge({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <span
      className="inline-flex items-center text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider"
      style={{ background: bg, color, letterSpacing: '0.04em' }}
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
    <div className="px-6 py-6">
      <div className="flex items-center justify-between relative">
        {/* Connecting line behind nodes */}
        <div
          className="absolute top-6 left-0 right-0 h-[2px] rounded-full"
          style={{ background: 'linear-gradient(90deg, #E5E7EB 0%, #E5E7EB 100%)' }}
        />
        {/* Filled progress line */}
        <div
          className="absolute top-6 left-0 h-[2px] rounded-full transition-all duration-700"
          style={{
            background: `linear-gradient(90deg, ${C.primary}, ${C.primary}CC)`,
            width: `${(stages.filter(s => s.reached).length - 1) / (stages.length - 1) * 100}%`,
            boxShadow: `0 0 8px ${C.primary}40`,
          }}
        />
        {stages.map((stage) => {
          const completedColor = C.primary
          const futureColor = '#D1D5DB'

          return (
            <div key={stage.key} className="relative flex flex-col items-center z-10" style={{ flex: 1 }}>
              {/* Node */}
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-500"
                style={{
                  background: stage.reached
                    ? stage.isCurrent
                      ? `linear-gradient(135deg, ${completedColor}, ${C.primaryDark})`
                      : `${completedColor}15`
                    : 'white',
                  border: stage.reached ? 'none' : `2px solid ${futureColor}`,
                  boxShadow: stage.isCurrent
                    ? `0 4px 16px ${completedColor}35, 0 0 0 4px ${completedColor}15`
                    : stage.reached
                      ? `0 2px 8px ${completedColor}15`
                      : '0 1px 3px rgba(0,0,0,0.04)',
                }}
              >
                {stage.reached ? (
                  <CheckCircle2 className="w-5 h-5" style={{ color: stage.isCurrent ? 'white' : completedColor }} />
                ) : (
                  <CircleDot className="w-5 h-5" style={{ color: futureColor }} />
                )}
              </div>

              {/* Label */}
              <p
                className="text-[10px] font-bold mt-2.5 text-center leading-tight uppercase tracking-wider"
                style={{ color: stage.reached ? C.dark : C.muted, letterSpacing: '0.04em' }}
              >
                {he ? stage.labelHe : stage.label}
              </p>

              {/* Date */}
              {stage.date && (
                <p className="text-[9px] font-medium mt-1" style={{ color: C.muted }}>
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
    <div className="flex items-center justify-between py-3 group" style={{ borderBottom: `1px solid ${C.border}` }}>
      <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: C.muted, letterSpacing: '0.04em' }}>{label}</span>
      <span className={`text-[13px] font-semibold ${mono ? 'font-mono text-[12px]' : ''}`} style={{ color: C.dark }}>{value}</span>
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
    loadContractorProfile()
    loadPushSubscriptions()
  }, [id])

  async function loadContractor() {
    setLoading(true)
    const { data, error } = await supabase
      .from('contractors')
      .select(`
        user_id, professions, zip_codes, is_active, created_at, wa_notify, sms_opt_out,
        profiles!inner(id, full_name, phone, whatsapp_phone, telegram_chat_id, status, suspension_reason, suspended_at, banned_at)
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
      sms_opt_out: raw.sms_opt_out ?? false,
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
    <div className="animate-fade-in space-y-6">
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
      <div
        className="rounded-3xl overflow-hidden relative"
        style={{
          background: `linear-gradient(135deg, rgba(255,255,255,0.92) 0%, rgba(248,250,252,0.85) 100%)`,
          backdropFilter: 'blur(40px) saturate(180%)',
          WebkitBackdropFilter: 'blur(40px) saturate(180%)',
          border: `1px solid ${C.border}`,
          boxShadow: '0 2px 4px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06)',
        }}
      >
        {/* Decorative gradient accent */}
        <div
          className="absolute top-0 left-0 right-0 h-1 rounded-t-3xl"
          style={{ background: `linear-gradient(90deg, ${C.primary}, ${C.accent}, ${C.primary})` }}
        />

        <div className="px-8 py-7">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="flex items-center gap-5">
              {/* Avatar with brand gradient */}
              <div className="relative">
                <div
                  className="w-[68px] h-[68px] rounded-2xl flex items-center justify-center text-2xl font-extrabold shrink-0"
                  style={{
                    background: `linear-gradient(135deg, ${C.primary}, ${C.primaryDark})`,
                    color: 'white',
                    boxShadow: `0 4px 20px ${C.primary}35`,
                    letterSpacing: '-0.02em',
                  }}
                >
                  {initials}
                </div>
                {/* Online indicator */}
                <div
                  className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center"
                  style={{
                    background: contractor.is_active ? C.success : C.danger,
                    border: '3px solid white',
                    boxShadow: `0 2px 6px ${contractor.is_active ? C.success : C.danger}40`,
                  }}
                />
              </div>

              <div className="space-y-2">
                {/* Name + badges row */}
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: C.dark, letterSpacing: '-0.025em' }}>
                    {contractor.profiles?.full_name ?? 'Unknown'}
                  </h1>

                  {planConf && (
                    <span
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold"
                      style={{
                        background: `linear-gradient(135deg, ${planConf.bg}, ${planConf.border}40)`,
                        color: planConf.color,
                        boxShadow: `0 2px 8px ${planConf.color}15`,
                      }}
                    >
                      <Crown className="w-3.5 h-3.5" />
                      {plan?.name}
                    </span>
                  )}

                  {contractor.subscription && (
                    <StatusBadge
                      label={SUB_STATUS_MAP[contractor.subscription.status]?.label ?? contractor.subscription.status}
                      color={SUB_STATUS_MAP[contractor.subscription.status]?.color ?? C.muted}
                      bg={SUB_STATUS_MAP[contractor.subscription.status]?.bg ?? '#F3F4F6'}
                    />
                  )}

                  {!contractor.is_active && (
                    <StatusBadge label={he ? 'מושבת' : 'Inactive'} color={C.danger} bg="#FEF2F2" />
                  )}
                </div>

                {/* Meta info row */}
                <div className="flex items-center gap-4 flex-wrap">
                  {contractor.profiles?.phone && (
                    <span className="text-[13px] font-medium flex items-center gap-1.5" style={{ color: C.darkSub }}>
                      <Phone className="w-3.5 h-3.5" style={{ color: C.muted }} /> {contractor.profiles.phone}
                    </span>
                  )}
                  <span className="text-[13px] font-medium flex items-center gap-1.5" style={{ color: C.darkSub }}>
                    <Calendar className="w-3.5 h-3.5" style={{ color: C.muted }} /> {fmtDate(contractor.created_at)}
                  </span>
                  <span
                    className="text-[12px] font-bold px-2.5 py-1 rounded-lg"
                    style={{ background: '#F3F4F6', color: C.darkSub }}
                  >
                    {daysAsCustomer} {he ? 'ימים' : 'days'}
                  </span>
                </div>

                {/* Channel indicators */}
                <div className="flex items-center gap-2 mt-1">
                  {[
                    { key: 'wa', label: 'WhatsApp', active: contractor.wa_notify && !!contractor.profiles?.whatsapp_phone, color: '#25D366', icon: MessageCircle },
                    { key: 'tg', label: 'Telegram', active: !!contractor.profiles?.telegram_chat_id, color: '#2563EB', icon: Send },
                    { key: 'push', label: 'Push', active: pushSubs.length > 0, color: '#7C3AED', icon: Bell },
                    { key: 'sms', label: 'SMS', active: !contractor.sms_opt_out, color: C.primary, icon: Smartphone },
                  ].map((ch) => (
                    <span
                      key={ch.key}
                      title={`${ch.label}: ${ch.active ? 'Active' : 'Off'}`}
                      className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-lg transition-all"
                      style={{
                        background: ch.active ? `${ch.color}10` : '#F9FAFB',
                        color: ch.active ? ch.color : '#D1D5DB',
                        border: `1px solid ${ch.active ? `${ch.color}25` : '#F3F4F6'}`,
                      }}
                    >
                      <ch.icon className="w-3 h-3" />
                      {ch.label}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Actions + Account Status merged */}
            <div className="flex flex-col items-end gap-2.5">
              <div className="flex items-center gap-2.5">
                <button
                  onClick={async () => { await impersonate(contractor.user_id); navigate('/') }}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-2xl text-[13px] font-bold transition-all hover:shadow-lg hover:-translate-y-0.5 active:scale-95"
                  style={{ background: C.dark, color: 'white', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}
                >
                  <Eye className="w-4 h-4" /> {he ? 'צפה' : 'View As'}
                </button>
                <button
                  onClick={toggleActive}
                  disabled={toggling}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-[13px] font-bold transition-all hover:shadow-lg hover:-translate-y-0.5 active:scale-95"
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
              {/* Inline account moderation */}
              {(() => {
                const userStatus = contractor.profiles?.status ?? 'active'
                return (
                  <div className="flex items-center gap-2">
                    {(userStatus === 'suspended' || userStatus === 'banned') && (
                      <span className="text-[10px] font-medium" style={{ color: C.muted }}>
                        {contractor.profiles?.suspension_reason}
                      </span>
                    )}
                    {userStatus !== 'suspended' && userStatus !== 'banned' && (
                      <button
                        onClick={() => { setStatusAction('suspend'); setStatusReason('') }}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all hover:shadow-sm active:scale-95"
                        style={{ background: '#FFFBEB', color: '#D97706' }}
                      >
                        <AlertTriangle className="w-3 h-3" /> {he ? 'השעה' : 'Suspend'}
                      </button>
                    )}
                    {userStatus !== 'banned' && (
                      <button
                        onClick={() => { setStatusAction('ban'); setStatusReason('') }}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all hover:shadow-sm active:scale-95"
                        style={{ background: '#FEF2F2', color: '#DC2626' }}
                      >
                        <Ban className="w-3 h-3" /> {he ? 'חסום' : 'Ban'}
                      </button>
                    )}
                    {userStatus !== 'active' && (
                      <button
                        onClick={() => { setStatusAction('activate'); setStatusReason('') }}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all hover:shadow-sm active:scale-95"
                        style={{ background: '#ECFDF5', color: '#059669' }}
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
          <div className="absolute inset-0 bg-black/50 backdrop-blur-md" />
          <div
            className="relative rounded-2xl p-7 w-full max-w-sm animate-fade-in"
            style={{ background: 'white', boxShadow: '0 25px 50px rgba(0,0,0,0.15)' }}
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

      {/* ═══ Customer Lifecycle Pipeline (compact) ═══ */}
      <GlassCard>
        <div className="px-6 py-4">
          <div className="flex items-center gap-6">
            <h2 className="text-[13px] font-bold tracking-tight flex items-center gap-2 shrink-0" style={{ color: C.dark, letterSpacing: '-0.015em' }}>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${C.primary}12` }}>
                <TrendingUp className="w-3.5 h-3.5" style={{ color: C.primary }} />
              </div>
              {he ? 'מסלול' : 'Lifecycle'}
            </h2>
            {/* Inline pipeline */}
            <div className="flex items-center gap-1 flex-1">
              {pipelineStages.map((stage, i) => (
                <div key={stage.key} className="flex items-center gap-1" style={{ flex: 1 }}>
                  <div
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl flex-1 transition-all"
                    style={{
                      background: stage.isCurrent
                        ? `linear-gradient(135deg, ${C.primary}, ${C.primaryDark})`
                        : stage.reached ? `${C.primary}10` : '#F9FAFB',
                      border: `1px solid ${stage.reached ? `${C.primary}20` : '#F3F4F6'}`,
                    }}
                  >
                    {stage.reached ? (
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" style={{ color: stage.isCurrent ? 'white' : C.primary }} />
                    ) : (
                      <CircleDot className="w-3.5 h-3.5 shrink-0" style={{ color: '#D1D5DB' }} />
                    )}
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold truncate" style={{ color: stage.isCurrent ? 'white' : stage.reached ? C.dark : C.muted }}>
                        {he ? stage.labelHe : stage.label}
                      </p>
                      {stage.date && (
                        <p className="text-[8px] font-medium" style={{ color: stage.isCurrent ? 'rgba(255,255,255,0.7)' : C.muted }}>
                          {fmtShort(stage.date)}
                        </p>
                      )}
                    </div>
                  </div>
                  {i < pipelineStages.length - 1 && (
                    <div className="w-2 h-0.5 rounded-full shrink-0" style={{ background: stage.reached ? C.primary : '#E5E7EB' }} />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </GlassCard>

      {/* ═══ Revenue KPI Strip (full width) ═══ */}
      <GlassCard delay={70}>
        <SectionHeader icon={BarChart3} iconColor={C.success} title={he ? 'הכנסות וחיוב' : 'Revenue & Billing'} />
            <div className="p-6">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {[
                  { label: 'MRR', value: monthlyFee > 0 ? `$${monthlyFee}` : '\u2014', gradient: 'linear-gradient(135deg, #ECFDF5, #D1FAE5)', color: C.success, shadow: 'rgba(5,150,105,0.1)' },
                  { label: 'LTV', value: ltv > 0 ? `$${ltv.toLocaleString()}` : '\u2014', gradient: 'linear-gradient(135deg, #F5F3FF, #EDE9FE)', color: C.accent, shadow: 'rgba(88,86,214,0.1)' },
                  { label: he ? 'חודשים' : 'Months', value: monthsActive > 0 ? String(monthsActive) : '\u2014', gradient: 'linear-gradient(135deg, #FFF7ED, #FFEDD5)', color: C.primary, shadow: 'rgba(254,91,37,0.1)' },
                  { label: he ? 'ימים' : 'Days', value: String(daysAsCustomer), gradient: 'linear-gradient(135deg, #F0F9FF, #E0F2FE)', color: '#0284C7', shadow: 'rgba(2,132,199,0.1)' },
                  { label: he ? 'חיוב הבא' : 'Next Bill', value: contractor.subscription?.current_period_end ? fmtShort(contractor.subscription.current_period_end) : '\u2014', gradient: 'linear-gradient(135deg, #FFFBEB, #FEF3C7)', color: C.warning, shadow: 'rgba(217,119,6,0.1)' },
                  { label: he ? 'מחזור' : 'Interval', value: monthlyFee > 0 ? (he ? 'חודשי' : 'Monthly') : '\u2014', gradient: 'linear-gradient(135deg, #FDF2F8, #FCE7F3)', color: '#DB2777', shadow: 'rgba(219,39,119,0.1)' },
                ].map((kpi) => (
                  <div
                    key={kpi.label}
                    className="rounded-2xl p-4 relative overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-md"
                    style={{ background: kpi.gradient, boxShadow: `0 2px 8px ${kpi.shadow}` }}
                  >
                    <div className="absolute inset-0 rounded-2xl" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.5) 0%, transparent 60%)', pointerEvents: 'none' }} />
                    <p className="text-[10px] font-bold uppercase tracking-wider relative" style={{ color: kpi.color, letterSpacing: '0.06em' }}>{kpi.label}</p>
                    <p className="text-2xl font-extrabold mt-1 relative tracking-tight" style={{ color: C.dark, letterSpacing: '-0.03em' }}>
                      {kpi.value}
                    </p>
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
                  <div
                    className="rounded-2xl p-5 relative overflow-hidden"
                    style={{
                      background: planConf?.gradient ?? '#F3F4F6',
                      boxShadow: `0 2px 12px ${planConf?.color ?? C.muted}15`,
                    }}
                  >
                    <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.4) 0%, transparent 50%)', pointerEvents: 'none' }} />
                    <div className="flex items-center justify-between relative">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center"
                          style={{ background: `${planConf?.color ?? C.muted}18` }}
                        >
                          <Crown className="w-5 h-5" style={{ color: planConf?.color ?? C.muted }} />
                        </div>
                        <span className="text-[16px] font-extrabold tracking-tight" style={{ color: planConf?.color ?? C.dark, letterSpacing: '-0.02em' }}>{plan?.name}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-2xl font-extrabold tracking-tight" style={{ color: C.dark, letterSpacing: '-0.03em' }}>
                          ${monthlyFee}
                        </span>
                        <span className="text-[11px] font-medium ml-0.5" style={{ color: C.muted }}>/mo</span>
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
                  <div className="flex gap-3 mt-5 pt-5" style={{ borderTop: `1px solid ${C.border}` }}>
                    <button
                      onClick={openPlanModal}
                      className="flex-1 flex items-center justify-center gap-2 rounded-2xl py-3 text-[13px] font-bold text-white transition-all hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.97]"
                      style={{ background: `linear-gradient(135deg, ${C.accent}, ${C.accent}DD)`, boxShadow: `0 2px 12px ${C.accent}30` }}
                    >
                      <ArrowUpCircle className="w-4 h-4" />
                      {he ? 'שנה חבילה' : 'Change Plan'}
                    </button>
                    {contractor.subscription.stripe_customer_id && (
                      <button
                        onClick={() => window.open(`https://dashboard.stripe.com/customers/${contractor.subscription.stripe_customer_id}`, '_blank')}
                        className="rounded-2xl px-5 py-3 text-[13px] font-semibold transition-all hover:bg-gray-50 hover:-translate-y-0.5 active:scale-[0.97]"
                        style={{ border: `1.5px solid #E5E7EB`, color: C.darkSub }}
                      >
                        Stripe
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-10">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center" style={{ background: '#F3F4F6' }}>
                    <Package className="w-8 h-8" style={{ color: '#D1D5DB' }} />
                  </div>
                  <p className="text-[14px] font-semibold mb-1" style={{ color: C.dark }}>{he ? 'ללא מנוי' : 'No subscription'}</p>
                  <p className="text-[12px] mb-5" style={{ color: C.muted }}>{he ? 'הפעל תקופת ניסיון' : 'Start a trial to begin billing'}</p>
                  <button
                    onClick={openPlanModal}
                    className="inline-flex items-center gap-2 rounded-2xl px-6 py-3 text-[13px] font-bold text-white transition-all hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.97]"
                    style={{ background: `linear-gradient(135deg, ${C.success}, ${C.success}DD)`, boxShadow: `0 2px 12px ${C.success}30` }}
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
            <SectionHeader icon={MessageSquare} iconColor="#059669" title={he ? 'קבוצות ווטסאפ' : 'WhatsApp Groups'} count={groups.length} />
            {groups.length === 0 ? (
              <div className="px-6 py-4 text-center">
                <p className="text-[12px] font-medium" style={{ color: '#D1D5DB' }}>
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
              <div className="px-6 py-4 text-center">
                <p className="text-[12px] font-medium" style={{ color: '#D1D5DB' }}>{he ? 'אין תת-קבלנים' : 'No subcontractors yet'}</p>
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
              <div className="px-6 py-4 text-center">
                <p className="text-[12px] font-medium" style={{ color: '#D1D5DB' }}>{he ? 'אין לידים' : 'No leads yet'}</p>
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

          {/* Contact + Channels combined */}
          <GlassCard delay={70}>
            <div className="p-5 space-y-4">
              <h3 className="text-[12px] font-bold uppercase tracking-widest flex items-center gap-2" style={{ color: C.muted, letterSpacing: '0.08em' }}>
                <Phone className="w-3.5 h-3.5" />
                {he ? 'פרטי קשר' : 'Contact Info'}
              </h3>

              {/* Compact contact rows */}
              <div className="space-y-0">
                {contractor.profiles?.phone && (
                  <InfoRow label={he ? 'טלפון' : 'Phone'} value={contractor.profiles.phone} />
                )}
                <InfoRow label={he ? 'הצטרף' : 'Joined'} value={fmtDate(contractor.created_at)} />
                <InfoRow label="User ID" value={<span className="font-mono text-[10px]">{contractor.user_id.slice(0, 12)}...</span>} mono />
              </div>

              {/* Divider */}
              <div className="pt-2">
                <h3 className="text-[12px] font-bold uppercase tracking-widest flex items-center gap-2" style={{ color: C.muted, letterSpacing: '0.08em' }}>
                  <Bell className="w-3.5 h-3.5" />
                  {he ? 'ערוצי התראות' : 'Channels'}
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{
                      background: (() => {
                        const count = [
                          contractor.wa_notify && contractor.profiles?.whatsapp_phone,
                          contractor.profiles?.telegram_chat_id,
                          pushSubs.length > 0,
                          !contractor.sms_opt_out,
                        ].filter(Boolean).length
                        return count >= 3 ? '#ECFDF5' : count >= 1 ? '#FFFBEB' : '#FEF2F2'
                      })(),
                      color: (() => {
                        const count = [
                          contractor.wa_notify && contractor.profiles?.whatsapp_phone,
                          contractor.profiles?.telegram_chat_id,
                          pushSubs.length > 0,
                          !contractor.sms_opt_out,
                        ].filter(Boolean).length
                        return count >= 3 ? C.success : count >= 1 ? C.warning : C.danger
                      })(),
                    }}
                  >
                    {[
                      contractor.wa_notify && contractor.profiles?.whatsapp_phone,
                      contractor.profiles?.telegram_chat_id,
                      pushSubs.length > 0,
                      !contractor.sms_opt_out,
                    ].filter(Boolean).length}/4
                  </span>
                </h3>
              </div>

              {/* Channel grid — compact 2x2 */}
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'WhatsApp', active: contractor.wa_notify && !!contractor.profiles?.whatsapp_phone, color: '#25D366', icon: MessageCircle },
                  { label: 'Telegram', active: !!contractor.profiles?.telegram_chat_id, color: '#2563EB', icon: Send },
                  { label: 'Push', active: pushSubs.length > 0, color: '#7C3AED', icon: Smartphone },
                  { label: 'SMS', active: !contractor.sms_opt_out, color: C.primary, icon: Wifi },
                ].map((ch) => (
                  <div
                    key={ch.label}
                    className="flex items-center gap-2.5 p-3 rounded-xl transition-all"
                    style={{
                      background: ch.active ? `${ch.color}08` : '#FAFAFA',
                      border: `1px solid ${ch.active ? `${ch.color}20` : '#F3F4F6'}`,
                    }}
                  >
                    <ch.icon className="w-4 h-4 shrink-0" style={{ color: ch.active ? ch.color : '#D1D5DB' }} />
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold" style={{ color: ch.active ? ch.color : '#D1D5DB' }}>{ch.label}</p>
                      <p className="text-[9px] font-semibold truncate" style={{ color: ch.active ? C.darkSub : '#D1D5DB' }}>
                        {ch.active ? (he ? 'מחובר' : 'Active') : (he ? 'כבוי' : 'Off')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </GlassCard>



          {/* Trades / Professions */}
          <GlassCard delay={210}>
            <div className="p-6 space-y-4">
              <h3 className="text-[12px] font-bold uppercase tracking-widest flex items-center gap-2" style={{ color: C.muted, letterSpacing: '0.08em' }}>
                <Briefcase className="w-3.5 h-3.5" />
                {he ? 'מקצועות' : 'Trades'}
                <span
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full"
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
                      className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-[12px] font-bold capitalize transition-all hover:-translate-y-0.5 hover:shadow-sm"
                      style={{ background: `${C.accent}08`, color: C.accent, border: `1px solid ${C.accent}18` }}
                    >
                      <span className="text-base">{PROF_EMOJI[p] ?? '📋'}</span>
                      {p}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-[12px] text-center py-4" style={{ color: C.muted }}>
                  {he ? 'לא הוגדרו' : 'None defined'}
                </p>
              )}
            </div>
          </GlassCard>

          {/* Service Areas */}
          <GlassCard delay={280}>
            <div className="p-6 space-y-4">
              <h3 className="text-[12px] font-bold uppercase tracking-widest flex items-center gap-2" style={{ color: C.muted, letterSpacing: '0.08em' }}>
                <MapPin className="w-3.5 h-3.5" />
                {he ? 'אזורי שירות' : 'Service Areas'}
                <span
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{ background: '#FFF1F2', color: '#E11D48' }}
                >
                  {contractor.zip_codes.length}
                </span>
              </h3>

              {contractor.zip_codes.length > 0 ? (
                <>
                  <div className="flex flex-wrap gap-2">
                    {(showAllZips ? contractor.zip_codes : contractor.zip_codes.slice(0, 12)).map((zip) => (
                      <span
                        key={zip}
                        className="inline-flex items-center px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all hover:-translate-y-0.5"
                        style={{ background: '#FFF7ED', color: C.primary, border: '1px solid #FFEDD5' }}
                      >
                        {zip}
                      </span>
                    ))}
                  </div>
                  {contractor.zip_codes.length > 12 && (
                    <button
                      onClick={() => setShowAllZips(!showAllZips)}
                      className="w-full text-center text-[11px] font-bold py-2 rounded-xl transition-all hover:bg-gray-50"
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
                <p className="text-[12px] text-center py-4" style={{ color: C.muted }}>
                  {he ? 'לא הוגדרו' : 'None defined'}
                </p>
              )}
            </div>
          </GlassCard>

          {/* Profile Verification */}
          {cpProfile && (
            <GlassCard delay={350}>
              <div className="p-6 space-y-5">
                <h3 className="text-[12px] font-bold uppercase tracking-widest flex items-center gap-2" style={{ color: C.muted, letterSpacing: '0.08em' }}>
                  <ShieldCheck className="w-3.5 h-3.5" />
                  {he ? 'אימות פרופיל' : 'Profile Verification'}
                </h3>

                {/* Background Check */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center transition-transform hover:scale-105"
                      style={{
                        background: cpProfile.background_check === 'passed' ? '#ECFDF5' : '#F3F4F6',
                        boxShadow: cpProfile.background_check === 'passed' ? `0 2px 8px ${C.success}15` : 'none',
                      }}
                    >
                      <ShieldCheck className="w-5 h-5" style={{ color: cpProfile.background_check === 'passed' ? C.success : C.muted }} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: C.muted, letterSpacing: '0.06em' }}>Background Check</p>
                      <p className="text-[13px] font-bold" style={{ color: cpProfile.background_check === 'passed' ? C.success : C.muted }}>
                        {cpProfile.background_check === 'passed' ? (he ? 'מאומת' : 'Passed') : (he ? 'לא מאומת' : 'Not verified')}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleToggleBgCheck}
                    disabled={savingVerification}
                    className="px-4 py-2 rounded-xl text-[11px] font-bold transition-all hover:shadow-md hover:-translate-y-0.5 active:scale-95"
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
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: C.muted, letterSpacing: '0.06em' }}>Trust Tier</p>
                  <div className="grid grid-cols-4 gap-2">
                    {([
                      { key: 'new', label: 'New', color: '#6B7280', bg: '#F3F4F6' },
                      { key: 'verified', label: 'Verified', color: '#2563EB', bg: '#EFF6FF' },
                      { key: 'trusted', label: 'Trusted', color: '#059669', bg: '#ECFDF5' },
                      { key: 'elite', label: 'Elite', color: '#D97706', bg: '#FFFBEB' },
                    ] as const).map((t) => {
                      const isActive = cpProfile.tier === t.key
                      return (
                        <button
                          key={t.key}
                          onClick={() => handleChangeTier(t.key)}
                          disabled={savingVerification}
                          className="py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all hover:shadow-md hover:-translate-y-0.5 active:scale-95 text-center"
                          style={{
                            background: isActive ? t.bg : 'white',
                            color: isActive ? t.color : C.muted,
                            border: `2px solid ${isActive ? t.color : 'transparent'}`,
                            boxShadow: isActive ? `0 2px 8px ${t.color}20` : '0 1px 3px rgba(0,0,0,0.04)',
                            opacity: savingVerification ? 0.6 : 1,
                            letterSpacing: '0.04em',
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
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: C.muted, letterSpacing: '0.06em' }}>
                      {he ? 'השלמת פרופיל' : 'Profile Completeness'}
                    </p>
                    <span className="text-[14px] font-extrabold" style={{ color: cpProfile.profile_completeness >= 70 ? C.success : cpProfile.profile_completeness >= 40 ? C.warning : C.muted }}>
                      {cpProfile.profile_completeness}%
                    </span>
                  </div>
                  <div className="w-full h-2.5 rounded-full overflow-hidden" style={{ background: '#F3F4F6' }}>
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${cpProfile.profile_completeness}%`,
                        background: cpProfile.profile_completeness >= 70
                          ? `linear-gradient(90deg, ${C.success}, ${C.success}CC)`
                          : cpProfile.profile_completeness >= 40
                            ? `linear-gradient(90deg, ${C.warning}, ${C.warning}CC)`
                            : C.muted,
                        boxShadow: `0 1px 4px ${cpProfile.profile_completeness >= 70 ? C.success : cpProfile.profile_completeness >= 40 ? C.warning : C.muted}30`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </GlassCard>
          )}

          {/* Admin Notes */}
          <GlassCard delay={420}>
            <div className="p-6 space-y-3">
              <h3 className="text-[12px] font-bold uppercase tracking-widest flex items-center gap-2" style={{ color: C.muted, letterSpacing: '0.08em' }}>
                <StickyNote className="w-3.5 h-3.5" />
                {he ? 'הערות מנהל' : 'Admin Notes'}
              </h3>
              <textarea
                className="w-full rounded-2xl px-5 py-4 text-[13px] resize-none focus:outline-none focus:ring-2 focus:ring-orange-200/50 transition-all"
                style={{
                  background: '#FAFBFC',
                  border: `1.5px solid ${C.border}`,
                  color: C.dark,
                  minHeight: '120px',
                  lineHeight: '1.6',
                }}
                placeholder={he ? 'הוסף הערות על הלקוח...' : 'Add notes about this customer...'}
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
              />
              <p className="text-[10px] font-medium" style={{ color: C.muted }}>
                {he ? 'הערות נשמרות באופן מקומי בלבד' : 'Notes are saved locally only'}
              </p>
            </div>
          </GlassCard>

        </div>
      </div>

      {/* Custom animations */}
      <style>{`
        @keyframes pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(254, 91, 37, 0.3); }
          50% { box-shadow: 0 0 0 8px rgba(254, 91, 37, 0); }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(12px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  )
}
