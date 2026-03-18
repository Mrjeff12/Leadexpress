import { useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
} from 'recharts'
import { useI18n } from '../lib/i18n'
import { useGroupDetail } from '../hooks/useGroupDetail'
import { computeGroupScore, getScoreColorClass } from '../lib/group-score'
import {
  ArrowLeft,
  MessageSquare,
  Zap,
  TrendingUp,
  Users,
  ShieldAlert,
  Calendar,
} from 'lucide-react'

/* ── Stage labels ──────────────────────────────────────── */

const stageLabels: Record<string, { en: string; he: string; color: string }> = {
  received: { en: 'Received', he: 'התקבלו', color: 'hsl(220 60% 55%)' },
  quick_filtered: { en: 'Quick Filtered', he: 'סינון מהיר', color: 'hsl(40 4% 65%)' },
  sender_filtered: { en: 'Seller Filtered', he: 'שולח מוכר', color: 'hsl(0 60% 55%)' },
  no_lead: { en: 'Not a Lead', he: 'לא ליד', color: 'hsl(40 80% 50%)' },
  lead_created: { en: 'Lead Created', he: 'ליד נוצר', color: 'hsl(155 44% 45%)' },
}

/* ── Component ─────────────────────────────────────────── */

export default function AdminGroupDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { locale } = useI18n()
  const he = locale === 'he'

  const { info, funnel, activity, members, isLoading, isError } = useGroupDetail(id)

  const [tab, setTab] = useState<'overview' | 'members' | 'messages' | 'market'>('overview')

  /* ── Compute score ────────────────────────────────────── */

  const score = useMemo(() => {
    if (!info || !funnel || !activity) return null
    const received = funnel.find((f) => f.stage === 'received')?.count || 0
    const leads = funnel.find((f) => f.stage === 'lead_created')?.count || 0
    const leadYield = received > 0 ? leads / received : 0
    const msgs7d = activity
      .filter((a) => {
        const d = new Date(a.date)
        return d.getTime() > Date.now() - 7 * 24 * 60 * 60 * 1000
      })
      .reduce((s, a) => s + a.messages, 0)

    return computeGroupScore({
      leadYield,
      sellerRatio: info.total_members > 0 ? info.known_sellers / info.total_members : 0,
      messages7d: msgs7d,
      hoursSinceLastLead: 48,
    })
  }, [info, funnel, activity])

  /* ── KPI values ───────────────────────────────────────── */

  const kpis = useMemo(() => {
    if (!funnel || !members || !info) return null
    const received = funnel.find((f) => f.stage === 'received')?.count || 0
    const leadsCreated = funnel.find((f) => f.stage === 'lead_created')?.count || 0
    const leadYieldPct = received > 0 ? ((leadsCreated / received) * 100).toFixed(1) : '0'
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
    const activeMembers = members.filter(
      (m) => m.last_seen_at && new Date(m.last_seen_at).getTime() > sevenDaysAgo,
    ).length
    const knownSellers = members.filter((m) => m.classification === 'seller').length
    const daysActive = Math.floor(
      (Date.now() - new Date(info.created_at).getTime()) / (1000 * 60 * 60 * 24),
    )
    return { received, leadsCreated, leadYieldPct, activeMembers, knownSellers, daysActive }
  }, [funnel, members, info])

  /* ── Funnel chart data ────────────────────────────────── */

  const funnelChartData = useMemo(() => {
    if (!funnel) return []
    return funnel.map((f) => ({
      name: he ? stageLabels[f.stage]?.he : stageLabels[f.stage]?.en || f.stage,
      count: f.count,
      fill: stageLabels[f.stage]?.color || 'hsl(220 10% 50%)',
    }))
  }, [funnel, he])

  /* ── Loading / Error ──────────────────────────────────── */

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-current border-t-transparent" style={{ color: 'hsl(40 4% 42%)' }} />
      </div>
    )
  }

  if (isError || !info) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-3">
        <p style={{ color: 'hsl(0 60% 55%)' }}>{he ? 'שגיאה בטעינת הקבוצה' : 'Error loading group'}</p>
        <button onClick={() => navigate('/admin/groups')} className="text-sm underline" style={{ color: 'hsl(40 4% 42%)' }}>
          {he ? 'חזרה לקבוצות' : 'Back to Groups'}
        </button>
      </div>
    )
  }

  /* ── Tab config ───────────────────────────────────────── */

  const tabs: { key: typeof tab; label: string }[] = [
    { key: 'overview', label: he ? 'סקירה' : 'Overview' },
    { key: 'members', label: he ? 'חברים' : 'Members' },
    { key: 'messages', label: he ? 'הודעות' : 'Messages' },
    { key: 'market', label: he ? 'מודיעין שוק' : 'Market Intel' },
  ]

  return (
    <div className="animate-fade-in space-y-6">
      {/* ── Header ──────────────────────────────────────────── */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={() => navigate('/admin/groups')}
          className="p-1.5 rounded-lg hover:bg-black/5 transition-colors"
          aria-label="Back"
        >
          <ArrowLeft size={18} style={{ color: 'hsl(40 4% 42%)' }} />
        </button>

        <h1 className="text-xl font-semibold" style={{ color: 'hsl(40 8% 10%)' }}>
          {info.name}
        </h1>

        {score && (
          <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold ${getScoreColorClass(score.color)}`}>
            {score.score}
          </span>
        )}

        <span className={`badge ${info.status === 'active' ? 'badge-green' : 'badge-red'}`}>
          {info.status}
        </span>

        {info.category && (
          <span className="badge" style={{ background: 'hsl(40 4% 90%)', color: 'hsl(40 4% 42%)' }}>
            {info.category}
          </span>
        )}
      </div>

      {/* ── Tab navigation ──────────────────────────────────── */}
      <div className="flex gap-1 border-b" style={{ borderColor: 'hsl(40 4% 88%)' }}>
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className="px-4 py-2 text-sm font-medium transition-colors"
            style={{
              color: tab === t.key ? 'hsl(40 8% 10%)' : 'hsl(40 4% 42%)',
              borderBottom: tab === t.key ? '2px solid hsl(40 8% 10%)' : '2px solid transparent',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab content ─────────────────────────────────────── */}
      {tab === 'overview' && kpis && (
        <div className="space-y-6">
          {/* KPI Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <KpiCard icon={<MessageSquare size={16} />} label={he ? 'סה"כ הודעות' : 'Total Messages'} value={kpis.received.toLocaleString()} />
            <KpiCard icon={<Zap size={16} />} label={he ? 'לידים נוצרו' : 'Leads Created'} value={kpis.leadsCreated.toLocaleString()} />
            <KpiCard icon={<TrendingUp size={16} />} label={he ? '% תשואת לידים' : 'Lead Yield %'} value={`${kpis.leadYieldPct}%`} />
            <KpiCard icon={<Users size={16} />} label={he ? 'חברים פעילים' : 'Active Members'} value={kpis.activeMembers.toLocaleString()} />
            <KpiCard icon={<ShieldAlert size={16} />} label={he ? 'מוכרים ידועים' : 'Known Sellers'} value={kpis.knownSellers.toLocaleString()} />
            <KpiCard icon={<Calendar size={16} />} label={he ? 'ימים פעילים' : 'Days Active'} value={kpis.daysActive.toLocaleString()} />
          </div>

          {/* Lead Funnel Chart */}
          <div className="glass-panel p-5">
            <h2 className="text-sm font-semibold mb-4" style={{ color: 'hsl(40 8% 10%)' }}>
              {he ? 'משפך לידים' : 'Lead Funnel'}
            </h2>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={funnelChartData} layout="vertical" margin={{ left: 20, right: 20, top: 5, bottom: 5 }}>
                <XAxis type="number" tick={{ fontSize: 12, fill: 'hsl(40 4% 42%)' }} />
                <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 12, fill: 'hsl(40 4% 42%)' }} />
                <Tooltip
                  contentStyle={{ background: '#fff', border: '1px solid hsl(40 4% 88%)', borderRadius: 8, fontSize: 12 }}
                />
                <Bar dataKey="count" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Activity Over Time */}
          {activity && activity.length > 0 && (
            <div className="glass-panel p-5">
              <h2 className="text-sm font-semibold mb-4" style={{ color: 'hsl(40 8% 10%)' }}>
                {he ? 'פעילות לאורך זמן' : 'Activity Over Time'}
              </h2>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={activity} margin={{ left: 0, right: 20, top: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(40 4% 90%)" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11, fill: 'hsl(40 4% 42%)' }}
                    tickFormatter={(v: string) => v.slice(5)}
                  />
                  <YAxis tick={{ fontSize: 11, fill: 'hsl(40 4% 42%)' }} />
                  <Tooltip
                    contentStyle={{ background: '#fff', border: '1px solid hsl(40 4% 88%)', borderRadius: 8, fontSize: 12 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="messages"
                    stroke="hsl(220 60% 55%)"
                    fill="hsl(220 60% 55% / 0.15)"
                    name={he ? 'הודעות' : 'Messages'}
                  />
                  <Area
                    type="monotone"
                    dataKey="leads"
                    stroke="hsl(155 44% 45%)"
                    fill="hsl(155 44% 45% / 0.25)"
                    name={he ? 'לידים' : 'Leads'}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {(tab === 'members' || tab === 'messages' || tab === 'market') && (
        <div className="glass-panel p-12 text-center">
          <p style={{ color: 'hsl(40 4% 42%)' }}>Coming soon...</p>
        </div>
      )}
    </div>
  )
}

/* ── KPI Card sub-component ──────────────────────────── */

function KpiCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="glass-panel p-5">
      <div className="flex items-center gap-2 mb-2">
        <span style={{ color: 'hsl(40 4% 42%)' }}>{icon}</span>
        <span className="text-xs font-medium" style={{ color: 'hsl(40 4% 42%)' }}>
          {label}
        </span>
      </div>
      <p className="text-2xl font-bold" style={{ color: 'hsl(40 8% 10%)' }}>
        {value}
      </p>
    </div>
  )
}
