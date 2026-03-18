import { useState, useEffect, useMemo } from 'react'
import { useI18n } from '../lib/i18n'
import { supabase } from '../lib/supabase'
import { Link } from 'react-router-dom'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts'
import {
  Zap,
  MessageSquare,
  Clock,
  MapPin,
  ChevronRight,
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
  const he = locale === 'he'

  // Demo sparkline data
  const demoData = useMemo(() => [
    { val: 40 }, { val: 30 }, { val: 45 }, { val: 50 }, { val: 35 }, { val: 60 }, { val: 55 }
  ], [])
  const demoDataUp = useMemo(() => [
    { val: 20 }, { val: 25 }, { val: 35 }, { val: 30 }, { val: 45 }, { val: 55 }, { val: 65 }
  ], [])
  const demoDataDown = useMemo(() => [
    { val: 60 }, { val: 55 }, { val: 45 }, { val: 50 }, { val: 35 }, { val: 30 }, { val: 25 }
  ], [])

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
    <div className="animate-fade-in space-y-10 pb-20 pt-4" style={{ fontFamily: 'Outfit, sans-serif' }}>
      {/* ── Header ── */}
      <header className="flex items-end justify-between px-2 mb-2">
        <div>
          <h1 className="text-4xl font-light tracking-tight text-black">
            {he ? 'סקירה כללית' : 'Admin Overview'}
          </h1>
          <p className="mt-2 text-sm font-medium text-stone-400 tracking-wide uppercase">
            {he ? 'נתונים בזמן אמת מ-Supabase' : 'Real-time intelligence'}
          </p>
        </div>
        <div className="flex items-center gap-3 px-4 py-2 rounded-full bg-white/50 backdrop-blur-md border border-black/5 shadow-sm">
          <div className="relative flex h-2 w-2">
            <div className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></div>
            <div className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></div>
          </div>
          <span className="text-xs font-bold tracking-tight text-black">{liveTimestamp}</span>
        </div>
      </header>

      {/* ── KPI Strip ── */}
      <section className="stagger-kpi grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={Zap}
          label={he ? 'סה"כ לידים' : 'Total Leads'}
          value={kpis.totalLeads}
          sub={he ? 'מנותחים ע"י AI' : 'AI-parsed leads'}
          trend={{ value: 12, label: '+12%' }}
          color="#fe5b25"
          chartData={demoDataUp}
        />
        <KpiCard
          icon={Flame}
          label="Hot"
          value={kpis.hotLeads}
          sub={he ? 'דחוף - היום/מחר' : 'Today / tomorrow'}
          trend={{ value: 8, label: '+8%' }}
          color="#FF3B30"
          chartData={demoDataUp}
        />
        <KpiCard
          icon={Thermometer}
          label="Warm"
          value={kpis.warmLeads}
          sub={he ? 'השבוע' : 'This week'}
          trend={{ value: -3, label: '-3%' }}
          color="#FF9500"
          chartData={demoDataDown}
        />
        <KpiCard
          icon={Snowflake}
          label="Cold"
          value={kpis.coldLeads}
          sub={he ? 'עתידי' : 'Future / no date'}
          trend={{ value: 5, label: '+5%' }}
          color="#5AC8FA"
          chartData={demoData}
        />
        <KpiCard
          icon={Filter}
          label={he ? 'נסננו' : 'Filtered'}
          value={kpis.messagesFiltered}
          sub={he ? `מתוך ${kpis.messagesReceived} הודעות` : `of ${kpis.messagesReceived} messages`}
          color="#8E8E93"
          chartData={demoData}
        />
        <KpiCard
          icon={BarChart3}
          label={he ? 'יחס המרה' : 'Conversion'}
          value={`${kpis.conversionRate}%`}
          sub={he ? 'הודעות → לידים' : 'Messages → leads'}
          trend={kpis.conversionRate > 5 ? { value: 1, label: 'Healthy' } : { value: -1, label: 'Low' }}
          color="#34C759"
          chartData={demoData}
        />
        <KpiCard
          icon={MessageSquare}
          label={he ? 'קבוצות פעילות' : 'Active Groups'}
          value={`${kpis.activeGroups}/${kpis.totalGroups}`}
          sub={he ? 'קבוצות מנוטרות' : 'Monitored groups'}
          trend={{ value: 2, label: '+2' }}
          color="#AF52DE"
          chartData={demoDataUp}
        />
      </section>

      {/* ── System Alerts ── */}
      <section>
        <SectionHeader
          title={he ? 'התראות מערכת' : 'System Intelligence'}
          subtitle={he ? 'דורש תשומת לב' : 'Critical insights'}
        />
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              type: 'warning' as const,
              icon: AlertTriangle,
              message: he ? '2 תשלומים נכשלו' : '2 failed payments',
              link: '/admin/subscriptions',
              color: '#FF9500', 
            },
            {
              type: 'error' as const,
              icon: WifiOff,
              message: he ? 'WhatsApp מנותק' : 'WhatsApp disconnected',
              link: '/admin/whatsapp',
              color: '#FF3B30',
            },
            {
              type: 'info' as const,
              icon: UserPlus,
              message: he ? '3 קבלנים חדשים השבוע' : '3 new contractors this week',
              link: '/admin/contractors',
              color: '#fe5b25',
            },
          ].map((alert) => {
            const AlertIcon = alert.icon
            return (
              <Link
                key={alert.link}
                to={alert.link}
                className="glass-panel group flex items-center gap-4 p-6"
              >
                <div 
                  className="w-12 h-12 rounded-[16px] flex items-center justify-center shadow-sm transition-all duration-500"
                  style={{ background: `${alert.color}10`, color: alert.color }}
                >
                  <AlertIcon className="h-6 w-6" strokeWidth={1.5} />
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-bold text-black group-hover:text-stone-600 transition-colors">
                    {alert.message}
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
                    {he ? 'לחץ לפרטים' : 'Action required'}
                  </span>
                </div>
                <ChevronRight className="ml-auto h-4 w-4 text-stone-300 group-hover:translate-x-1 transition-transform" />
              </Link>
            )
          })}
        </div>
      </section>

      {/* ── Quick Actions ── */}
      <section>
        <SectionHeader
          title={he ? 'פעולות מהירות' : 'Quick Actions'}
          subtitle={he ? 'קיצורי דרך' : 'System shortcuts'}
        />
        <div className="flex flex-wrap gap-4">
          <Link
            to="/admin/contractors"
            className="glass-panel group inline-flex items-center gap-4 px-8 py-5 text-sm font-bold transition-all hover:bg-black hover:text-white"
          >
            <div className="w-10 h-10 rounded-[12px] bg-black/5 group-hover:bg-white/20 flex items-center justify-center transition-colors">
              <Users className="h-5 w-5 text-black group-hover:text-white" strokeWidth={1.5} />
            </div>
            {he ? 'הוסף קבלן' : 'Add Contractor'}
          </Link>
          <Link
            to="/admin/leads"
            className="glass-panel group inline-flex items-center gap-4 px-8 py-5 text-sm font-bold transition-all hover:bg-black hover:text-white"
          >
            <div className="w-10 h-10 rounded-[12px] bg-black/5 group-hover:bg-white/20 flex items-center justify-center transition-colors">
              <Zap className="h-5 w-5 text-black group-hover:text-white" strokeWidth={1.5} />
            </div>
            {he ? 'הצג כל הלידים' : 'View All Leads'}
          </Link>
          <button
            type="button"
            className="glass-panel group inline-flex items-center gap-4 px-8 py-5 text-sm font-bold transition-all hover:bg-black hover:text-white border-none cursor-pointer"
          >
            <div className="w-10 h-10 rounded-[12px] bg-black/5 group-hover:bg-white/20 flex items-center justify-center transition-colors">
              <Download className="h-5 w-5 text-black group-hover:text-white" strokeWidth={1.5} />
            </div>
            {he ? 'ייצוא דו"ח' : 'Export Report'}
          </button>
        </div>
      </section>

      {/* ── Recent Leads ── */}
      <section>
        <SectionHeader
          title={he ? 'לידים אחרונים' : 'Intelligence Feed'}
          subtitle={he ? '10 לידים אחרונים' : 'Real-time activity'}
          linkTo="/admin/leads"
          linkLabel={he ? 'הצג הכל' : 'View all'}
        />
        <div className="glass-panel overflow-hidden border-none shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr
                  className="text-left text-[10px] font-bold uppercase tracking-[0.2em]"
                  style={{ color: '#aaa', background: 'rgba(0,0,0,0.02)' }}
                >
                  <th className="px-8 py-5 font-bold">{he ? 'זמן' : 'Time'}</th>
                  <th className="px-8 py-5 font-bold">{he ? 'מקצוע' : 'Profession'}</th>
                  <th className="px-8 py-5 font-bold">{he ? 'מיקום' : 'Location'}</th>
                  <th className="px-8 py-5 font-bold">{he ? 'דחיפות' : 'Urgency'}</th>
                  <th className="px-8 py-5 font-bold">{he ? 'סטטוס' : 'Status'}</th>
                  <th className="px-8 py-5 font-bold">{he ? 'סיכום' : 'Summary'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.03]">
                {leads.map((lead) => {
                  const uCfg = urgencyConfig[lead.urgency] ?? urgencyConfig.cold
                  const sCfg = statusConfig[lead.status] ?? statusConfig.parsed
                  return (
                    <tr
                      key={lead.id}
                      className="group transition-all duration-300 hover:bg-black/[0.01]"
                    >
                      <td className="whitespace-nowrap px-8 py-6" style={{ color: '#666' }}>
                        <span className="flex items-center gap-2 font-medium">
                          <Clock className="h-4 w-4 text-stone-300" strokeWidth={1.5} />
                          {timeAgo(lead.created_at)}
                        </span>
                      </td>
                      <td className="px-8 py-6">
                        <span className="px-4 py-1.5 rounded-[10px] bg-black text-white text-[10px] font-bold uppercase tracking-[0.1em]">
                          {lead.profession}
                        </span>
                      </td>
                      <td className="px-8 py-6" style={{ color: '#333' }}>
                        <div className="flex flex-col">
                          <div className="flex items-center gap-1.5">
                            <MapPin className="h-3.5 w-3.5 text-stone-300" strokeWidth={1.5} />
                            <span className="font-bold">{lead.city || '—'}</span>
                          </div>
                          {lead.zip_code && (
                            <span className="text-[10px] font-bold text-stone-400 mt-0.5">
                              {lead.zip_code}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <span className={`${uCfg.cls} inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-[10px] font-bold border border-black/5`}>
                          <uCfg.icon className="h-3.5 w-3.5" strokeWidth={2} />
                          {uCfg.label.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-8 py-6">
                        <span className={`${sCfg.cls} inline-block rounded-full px-4 py-1.5 text-[10px] font-bold border border-black/5`}>
                          {sCfg.label.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-8 py-6 max-w-[300px] truncate text-[13px] font-medium text-stone-500 group-hover:text-black transition-colors">
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
          title={he ? 'קבוצות WhatsApp' : 'Network Health'}
          subtitle={he ? 'סטטוס קבוצות' : 'WhatsApp monitoring'}
          linkTo="/admin/whatsapp"
          linkLabel={he ? 'ניהול' : 'Manage'}
        />
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((g) => (
            <div
              key={g.id}
              className="glass-panel group flex items-center gap-4 p-6"
            >
              <div
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] shadow-sm transition-all duration-500 ${
                  g.status === 'active' 
                    ? 'bg-[#AF52DE]10 text-[#AF52DE] group-hover:scale-110' 
                    : 'bg-stone-100 text-stone-400'
                }`}
                style={g.status === 'active' ? { background: 'rgba(175, 82, 222, 0.1)' } : {}}
              >
                <MessageSquare className="h-6 w-6" strokeWidth={1.5} />
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-black">
                  {g.name}
                </p>
                <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mt-1">
                  {g.total_members} {he ? 'חברים' : 'members'} · {g.message_count} {he ? 'הודעות' : 'msgs'}
                </p>
              </div>

              {g.status === 'active' ? (
                <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.5)]" />
              ) : (
                <div className="h-2 w-2 rounded-full bg-stone-300" />
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  trend,
  color = '#fe5b25',
  chartData = [],
}: {
  icon: React.ElementType
  label: string
  value: string | number
  sub: string
  trend?: { value: number; label: string }
  color?: string
  chartData?: any[]
}) {
  return (
    <div className="glass-panel group flex flex-col justify-between p-8 min-h-[220px] overflow-hidden">
      <div className="flex items-start justify-between relative z-10">
        <div 
          className="w-12 h-12 rounded-[16px] flex items-center justify-center transition-all duration-500 shadow-sm"
          style={{ 
            background: `${color}10`,
            color: color,
          }}
        >
          <Icon className="h-6 w-6" strokeWidth={1.5} />
        </div>
        {trend && (
          <span
            className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-bold tracking-tight ${
              trend.value >= 0 
                ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' 
                : 'bg-rose-50 text-rose-600 border border-rose-100'
            }`}
          >
            {trend.value >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {trend.label}
          </span>
        )}
      </div>
      
      <div className="mt-6 relative z-10">
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-stone-400 mb-1">
          {label}
        </div>
        <div className="text-4xl font-light tracking-tighter text-black">
          {value}
        </div>
        <div className="mt-1 text-[12px] font-medium text-stone-400">
          {sub}
        </div>
      </div>

      {/* Sparkline Background */}
      <div className="absolute bottom-0 left-0 right-0 h-16 opacity-30 group-hover:opacity-50 transition-opacity duration-500">
        {chartData.length > 0 && (
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id={`color-${label}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={color} stopOpacity={0.3}/>
                  <stop offset="95%" stopColor={color} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <Area 
                type="monotone" 
                dataKey="val" 
                stroke={color} 
                strokeWidth={2} 
                fillOpacity={1} 
                fill={`url(#color-${label})`} 
                isAnimationActive={true}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}

function SectionHeader({ title, subtitle, linkTo, linkLabel }: { title: string; subtitle: string; linkTo?: string; linkLabel?: string }) {
  return (
    <div className="mb-6 flex items-end justify-between px-2">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-light tracking-tight text-black">
          {title}
        </h2>
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-stone-400">
          {subtitle}
        </span>
      </div>
      {linkTo && linkLabel && (
        <Link
          to={linkTo}
          className="group flex items-center gap-2 px-4 py-2 rounded-full bg-black text-white text-xs font-bold transition-all hover:bg-stone-800 hover:scale-105 active:scale-95"
        >
          {linkLabel}
          <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
        </Link>
      )}
    </div>
  )
}
