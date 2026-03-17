import { useState, useEffect } from 'react'
import { useI18n } from '../lib/i18n'
import { supabase } from '../lib/supabase'
import { Link } from 'react-router-dom'
import {
  Zap,
  MessageSquare,
  Clock,
  MapPin,
  Pause,
  Play,
  ChevronRight,
  Radio,
  Flame,
  Thermometer,
  Snowflake,
  AlertTriangle,
  WifiOff,
  UserPlus,
  Download,
  TrendingUp,
  TrendingDown,
  Users,
  Filter,
  BarChart3,
} from 'lucide-react'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface KPIs {
  totalLeads: number
  hotLeads: number
  warmLeads: number
  coldLeads: number
  activeGroups: number
  totalGroups: number
  deliveryRate: number
  messagesReceived: number
  messagesFiltered: number
  conversionRate: number
}

interface RecentLead {
  id: string
  profession: string
  city: string | null
  zip_code: string | null
  urgency: string
  status: string
  sent_to_count: number
  parsed_summary: string
  created_at: string
}

interface GroupSummary {
  id: string
  name: string
  status: string
  total_members: number
  message_count: number
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const urgencyConfig: Record<string, { cls: string; label: string; icon: typeof Flame }> = {
  hot: { cls: 'badge-red', label: 'Hot', icon: Flame },
  warm: { cls: 'badge-orange', label: 'Warm', icon: Thermometer },
  cold: { cls: 'badge-blue', label: 'Cold', icon: Snowflake },
}

const statusConfig: Record<string, { cls: string; label: string }> = {
  parsed: { cls: 'badge-blue', label: 'New' },
  sent: { cls: 'badge-green', label: 'Sent' },
  claimed: { cls: 'badge-violet', label: 'Claimed' },
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function AdminDashboard() {
  const { locale } = useI18n()
  const [kpis, setKpis] = useState<KPIs>({
    totalLeads: 0, hotLeads: 0, warmLeads: 0, coldLeads: 0,
    activeGroups: 0, totalGroups: 0, deliveryRate: 0,
    messagesReceived: 0, messagesFiltered: 0, conversionRate: 0,
  })
  const [leads, setLeads] = useState<RecentLead[]>([])
  const [groups, setGroups] = useState<GroupSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [now, setNow] = useState(new Date())

  // Live clock tick
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(interval)
  }, [])

  // Fetch real data from Supabase
  useEffect(() => {
    async function fetchAll() {
      const [leadsRes, groupsRes, urgencyRes, pipelineRes] = await Promise.all([
        supabase
          .from('leads')
          .select('id, profession, city, zip_code, urgency, status, sent_to_count, parsed_summary, created_at')
          .order('created_at', { ascending: false })
          .limit(10),
        supabase
          .from('groups')
          .select('id, name, status, total_members, message_count')
          .order('created_at', { ascending: false }),
        supabase
          .from('leads')
          .select('urgency, status'),
        supabase
          .from('pipeline_events')
          .select('stage'),
      ])

      if (leadsRes.data) setLeads(leadsRes.data)
      if (groupsRes.data) setGroups(groupsRes.data)

      if (urgencyRes.data) {
        const rows = urgencyRes.data
        const hot = rows.filter(r => r.urgency === 'hot').length
        const warm = rows.filter(r => r.urgency === 'warm').length
        const cold = rows.filter(r => r.urgency === 'cold').length
        const total = rows.length
        const sent = rows.filter(r => r.status === 'sent').length
        const activeGroups = groupsRes.data?.filter(g => g.status === 'active').length ?? 0

        // Pipeline funnel stats
        const pe = pipelineRes.data ?? []
        const received = pe.filter(e => e.stage === 'received').length
        const filtered = pe.filter(e =>
          e.stage === 'sender_filtered' || e.stage === 'quick_filtered'
        ).length
        const noLead = pe.filter(e => e.stage === 'no_lead').length
        const totalFiltered = filtered + noLead
        const convRate = received > 0 ? Math.round((total / received) * 1000) / 10 : 0

        setKpis({
          totalLeads: total,
          hotLeads: hot,
          warmLeads: warm,
          coldLeads: cold,
          activeGroups,
          totalGroups: groupsRes.data?.length ?? 0,
          deliveryRate: total > 0 ? Math.round((sent / total) * 1000) / 10 : 0,
          messagesReceived: received,
          messagesFiltered: totalFiltered,
          conversionRate: convRate,
        })
      }

      setLoading(false)
    }

    fetchAll()

    // Realtime subscription for leads
    const channel = supabase
      .channel('dashboard-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'leads' }, (payload) => {
        const newLead = payload.new as RecentLead
        setLeads(prev => [newLead, ...prev.slice(0, 9)])
        setKpis(prev => ({
          ...prev,
          totalLeads: prev.totalLeads + 1,
          hotLeads: newLead.urgency === 'hot' ? prev.hotLeads + 1 : prev.hotLeads,
          warmLeads: newLead.urgency === 'warm' ? prev.warmLeads + 1 : prev.warmLeads,
          coldLeads: newLead.urgency === 'cold' ? prev.coldLeads + 1 : prev.coldLeads,
        }))
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  const liveTimestamp = now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })

  if (loading) {
    return (
      <div className="animate-fade-in space-y-6">
        <div className="h-8 bg-black/[0.04] rounded w-1/4 animate-pulse" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {[1,2,3,4,5,6,7].map(i => (
            <div key={i} className="glass-panel p-5 animate-pulse">
              <div className="h-4 bg-black/[0.04] rounded w-1/2 mb-2" />
              <div className="h-6 bg-black/[0.04] rounded w-1/3" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="animate-fade-in space-y-8" style={{ fontFamily: 'Outfit, sans-serif' }}>
      {/* ── Header ── */}
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" style={{ color: '#2d3a2e' }}>
            {locale === 'he' ? 'סקירה כללית' : 'Admin Overview'}
          </h1>
          <p className="mt-1 text-sm" style={{ color: '#6b7c6e' }}>
            {locale === 'he' ? 'נתונים בזמן אמת מ-Supabase' : 'Real-time data from Supabase'}
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm" style={{ color: '#6b7c6e' }}>
          <Radio className="h-3.5 w-3.5 text-emerald-500 animate-pulse" />
          <span>Live — {liveTimestamp}</span>
        </div>
      </header>

      {/* ── KPI Strip ── */}
      <section className="stagger-children grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        <KpiCard
          icon={<Zap className="h-5 w-5" style={{ color: '#c97d3a' }} />}
          label={locale === 'he' ? 'סה"כ לידים' : 'Total Leads'}
          value={kpis.totalLeads}
          sub={locale === 'he' ? 'מנותחים ע"י AI' : 'AI-parsed leads'}
          trend={{ value: 12, label: '+12%' }}
        />
        <KpiCard
          icon={<Flame className="h-5 w-5" style={{ color: '#ef4444' }} />}
          label="Hot"
          value={kpis.hotLeads}
          sub={locale === 'he' ? 'דחוף - היום/מחר' : 'Today / tomorrow'}
          trend={{ value: 8, label: '+8%' }}
        />
        <KpiCard
          icon={<Thermometer className="h-5 w-5" style={{ color: '#f59e0b' }} />}
          label="Warm"
          value={kpis.warmLeads}
          sub={locale === 'he' ? 'השבוע' : 'This week'}
          trend={{ value: -3, label: '-3%' }}
        />
        <KpiCard
          icon={<Snowflake className="h-5 w-5" style={{ color: '#3b82f6' }} />}
          label="Cold"
          value={kpis.coldLeads}
          sub={locale === 'he' ? 'עתידי' : 'Future / no date'}
          trend={{ value: 5, label: '+5%' }}
        />
        <KpiCard
          icon={<Filter className="h-5 w-5" style={{ color: '#9ca89e' }} />}
          label={locale === 'he' ? 'נסננו' : 'Filtered'}
          value={kpis.messagesFiltered}
          sub={locale === 'he' ? `מתוך ${kpis.messagesReceived} הודעות` : `of ${kpis.messagesReceived} messages`}
        />
        <KpiCard
          icon={<BarChart3 className="h-5 w-5" style={{ color: '#5a8a5e' }} />}
          label={locale === 'he' ? 'יחס המרה' : 'Conversion'}
          value={`${kpis.conversionRate}%`}
          sub={locale === 'he' ? 'הודעות → לידים' : 'Messages → leads'}
          trend={kpis.conversionRate > 5 ? { value: 1, label: 'Healthy' } : { value: -1, label: 'Low' }}
        />
        <KpiCard
          icon={<MessageSquare className="h-5 w-5" style={{ color: '#7c6bb5' }} />}
          label={locale === 'he' ? 'קבוצות פעילות' : 'Active Groups'}
          value={`${kpis.activeGroups}/${kpis.totalGroups}`}
          sub={locale === 'he' ? 'קבוצות מנוטרות' : 'Monitored groups'}
          trend={{ value: 2, label: '+2' }}
        />
      </section>

      {/* ── System Alerts ── */}
      <section>
        <SectionHeader
          title={locale === 'he' ? 'התראות מערכת' : 'System Alerts'}
          subtitle={locale === 'he' ? 'דורש תשומת לב' : 'Needs attention'}
        />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              type: 'warning' as const,
              icon: AlertTriangle,
              message: locale === 'he' ? '2 תשלומים נכשלו' : '2 failed payments',
              link: '/admin/subscriptions',
            },
            {
              type: 'error' as const,
              icon: WifiOff,
              message: locale === 'he' ? 'WhatsApp מנותק' : 'WhatsApp disconnected',
              link: '/admin/whatsapp',
            },
            {
              type: 'info' as const,
              icon: UserPlus,
              message: locale === 'he' ? '3 קבלנים חדשים השבוע' : '3 new contractors this week',
              link: '/admin/contractors',
            },
          ].map((alert) => {
            const borderColor =
              alert.type === 'error' ? '#ef4444' : alert.type === 'warning' ? '#f59e0b' : '#3b82f6'
            const AlertIcon = alert.icon
            return (
              <Link
                key={alert.link}
                to={alert.link}
                className="glass-panel flex items-center gap-3 px-4 py-3 transition-colors hover:bg-white/40"
                style={{ borderLeft: `3px solid ${borderColor}` }}
              >
                <AlertIcon className="h-4.5 w-4.5 shrink-0" style={{ color: borderColor }} />
                <span className="text-sm font-medium" style={{ color: '#2d3a2e' }}>
                  {alert.message}
                </span>
                <ChevronRight className="ml-auto h-4 w-4 shrink-0" style={{ color: '#9ca89e' }} />
              </Link>
            )
          })}
        </div>
      </section>

      {/* ── Quick Actions ── */}
      <section>
        <SectionHeader
          title={locale === 'he' ? 'פעולות מהירות' : 'Quick Actions'}
          subtitle={locale === 'he' ? 'קיצורי דרך' : 'Shortcuts'}
        />
        <div className="flex flex-wrap gap-3">
          <Link
            to="/admin/contractors"
            className="glass-panel inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors hover:bg-white/40"
            style={{ color: '#2d3a2e' }}
          >
            <Users className="h-4 w-4" style={{ color: '#5a8a5e' }} />
            {locale === 'he' ? 'הוסף קבלן' : 'Add Contractor'}
          </Link>
          <Link
            to="/admin/leads"
            className="glass-panel inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors hover:bg-white/40"
            style={{ color: '#2d3a2e' }}
          >
            <Zap className="h-4 w-4" style={{ color: '#c97d3a' }} />
            {locale === 'he' ? 'הצג כל הלידים' : 'View All Leads'}
          </Link>
          <button
            type="button"
            className="glass-panel inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors hover:bg-white/40"
            style={{ color: '#2d3a2e', cursor: 'pointer', border: 'none' }}
          >
            <Download className="h-4 w-4" style={{ color: '#6b7c6e' }} />
            {locale === 'he' ? 'ייצוא דו"ח' : 'Export Report'}
          </button>
        </div>
      </section>

      {/* ── Recent Leads ── */}
      <section>
        <SectionHeader
          title={locale === 'he' ? 'לידים אחרונים' : 'Recent Leads'}
          subtitle={locale === 'he' ? '10 לידים אחרונים' : 'Last 10 leads'}
          linkTo="/admin/leads"
          linkLabel={locale === 'he' ? 'הצג הכל' : 'View all'}
        />
        <div className="glass-panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table-sticky w-full text-sm">
              <thead>
                <tr
                  className="text-left text-xs uppercase tracking-wider"
                  style={{ color: '#6b7c6e', borderBottom: '1px solid rgba(93,124,96,0.15)' }}
                >
                  <th className="px-4 py-3 font-medium">{locale === 'he' ? 'זמן' : 'Time'}</th>
                  <th className="px-4 py-3 font-medium">{locale === 'he' ? 'מקצוע' : 'Profession'}</th>
                  <th className="px-4 py-3 font-medium">{locale === 'he' ? 'מיקום' : 'Location'}</th>
                  <th className="px-4 py-3 font-medium">{locale === 'he' ? 'דחיפות' : 'Urgency'}</th>
                  <th className="px-4 py-3 font-medium">{locale === 'he' ? 'סטטוס' : 'Status'}</th>
                  <th className="px-4 py-3 font-medium">{locale === 'he' ? 'סיכום' : 'Summary'}</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => {
                  const uCfg = urgencyConfig[lead.urgency] ?? urgencyConfig.cold
                  const sCfg = statusConfig[lead.status] ?? statusConfig.parsed
                  return (
                    <tr
                      key={lead.id}
                      className="transition-colors hover:bg-white/30"
                      style={{ borderBottom: '1px solid rgba(93,124,96,0.08)' }}
                    >
                      <td className="whitespace-nowrap px-4 py-3" style={{ color: '#6b7c6e' }}>
                        <span className="flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5" />
                          {timeAgo(lead.created_at)}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium capitalize" style={{ color: '#2d3a2e' }}>
                        {lead.profession}
                      </td>
                      <td className="px-4 py-3" style={{ color: '#4a5a4c' }}>
                        <span className="flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5" style={{ color: '#6b7c6e' }} />
                          {lead.city || '—'}
                          {lead.zip_code && (
                            <span className="text-xs" style={{ color: '#9ca89e' }}>
                              {lead.zip_code}
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`${uCfg.cls} inline-block rounded-full px-2.5 py-0.5 text-xs font-medium`}>
                          {uCfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`${sCfg.cls} inline-block rounded-full px-2.5 py-0.5 text-xs font-medium`}>
                          {sCfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 max-w-[300px] truncate text-xs" style={{ color: '#6b7c6e' }}>
                        {lead.parsed_summary}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── Groups Monitor ── */}
      <section>
        <SectionHeader
          title={locale === 'he' ? 'קבוצות WhatsApp' : 'Groups Monitor'}
          subtitle={locale === 'he' ? 'סטטוס קבוצות' : 'Group status'}
          linkTo="/admin/whatsapp"
          linkLabel={locale === 'he' ? 'ניהול' : 'Manage'}
        />
        <div className="glass-panel">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {groups.map((g) => (
              <div
                key={g.id}
                className="flex items-center gap-3 rounded-xl px-4 py-3 transition-colors"
                style={{
                  background:
                    g.status === 'active'
                      ? 'rgba(90,138,94,0.06)'
                      : 'rgba(176,184,177,0.08)',
                }}
              >
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                  style={{
                    background:
                      g.status === 'active'
                        ? 'rgba(90,138,94,0.15)'
                        : 'rgba(176,184,177,0.15)',
                  }}
                >
                  <MessageSquare
                    className="h-4 w-4"
                    style={{ color: g.status === 'active' ? '#5a8a5e' : '#b0b8b1' }}
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <p
                    className="truncate text-sm font-medium"
                    style={{ color: g.status === 'active' ? '#2d3a2e' : '#8a938b' }}
                  >
                    {g.name}
                  </p>
                  <p className="text-xs" style={{ color: '#6b7c6e' }}>
                    {g.total_members} {locale === 'he' ? 'חברים' : 'members'} · {g.message_count} {locale === 'he' ? 'הודעות' : 'msgs'}
                  </p>
                </div>

                {g.status === 'active' ? (
                  <span className="badge-green flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold">
                    <Play className="h-3 w-3" />
                    {locale === 'he' ? 'פעיל' : 'Active'}
                  </span>
                ) : (
                  <span className="badge-orange flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold">
                    <Pause className="h-3 w-3" />
                    {locale === 'he' ? 'מושבת' : 'Paused'}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function KpiCard({
  icon,
  label,
  value,
  sub,
  trend,
}: {
  icon: React.ReactNode
  label: string
  value: string | number
  sub: string
  trend?: { value: number; label: string }
}) {
  return (
    <div className="glass-panel flex flex-col gap-2 px-5 py-4">
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-xs font-medium uppercase tracking-wider" style={{ color: '#6b7c6e' }}>
          {label}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="kpi-value text-2xl font-bold tracking-tight" style={{ color: '#2d3a2e' }}>
          {value}
        </span>
        {trend && (
          <span
            className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
            style={{
              background: trend.value >= 0 ? 'rgba(90,138,94,0.12)' : 'rgba(239,68,68,0.12)',
              color: trend.value >= 0 ? '#3d7a41' : '#dc2626',
            }}
          >
            {trend.value >= 0 ? (
              <TrendingUp className="h-3 w-3" />
            ) : (
              <TrendingDown className="h-3 w-3" />
            )}
            {trend.label}
          </span>
        )}
      </div>
      <span className="kpi-sub text-xs" style={{ color: '#9ca89e' }}>
        {sub}
      </span>
    </div>
  )
}

function SectionHeader({ title, subtitle, linkTo, linkLabel }: { title: string; subtitle: string; linkTo?: string; linkLabel?: string }) {
  return (
    <div className="mb-3 flex items-baseline justify-between">
      <div className="flex items-baseline gap-3">
        <h2 className="text-lg font-semibold" style={{ color: '#2d3a2e' }}>
          {title}
        </h2>
        <span className="text-xs" style={{ color: '#9ca89e' }}>
          {subtitle}
        </span>
      </div>
      {linkTo && linkLabel && (
        <Link
          to={linkTo}
          className="flex items-center gap-1 text-xs font-medium transition-colors hover:underline"
          style={{ color: '#5a8a5e' }}
        >
          {linkLabel}
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      )}
    </div>
  )
}
