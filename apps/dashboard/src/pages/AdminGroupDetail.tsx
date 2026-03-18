import { useState, useMemo, useCallback, useEffect } from 'react'
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
import { supabase } from '../lib/supabase'
import { queryClient } from '../lib/queryClient'
import { useGroupDetail, type MemberRow } from '../hooks/useGroupDetail'
import { computeGroupScore, getScoreColorClass } from '../lib/group-score'
import {
  ArrowLeft,
  MessageSquare,
  Zap,
  TrendingUp,
  Users,
  ShieldAlert,
  Calendar,
  Flame,
} from 'lucide-react'

/* ── Stage labels ──────────────────────────────────────── */

const stageLabels: Record<string, { en: string; he: string; color: string }> = {
  received: { en: 'Received', he: 'התקבלו', color: 'hsl(220 60% 55%)' },
  quick_filtered: { en: 'Quick Filtered', he: 'סינון מהיר', color: 'hsl(40 4% 65%)' },
  sender_filtered: { en: 'Seller Filtered', he: 'שולח מוכר', color: 'hsl(0 60% 55%)' },
  no_lead: { en: 'Not a Lead', he: 'לא ליד', color: 'hsl(40 80% 50%)' },
  lead_created: { en: 'Lead Created', he: 'ליד נוצר', color: 'hsl(155 44% 45%)' },
}

/* ── Classification styles ────────────────────────────── */

const classificationStyle: Record<string, { bg: string; text: string; label_en: string; label_he: string }> = {
  buyer: { bg: 'hsl(152 46% 85% / 0.5)', text: 'hsl(155 44% 30%)', label_en: 'Buyer', label_he: 'קונה' },
  seller: { bg: 'hsl(0 80% 93% / 0.5)', text: 'hsl(0 60% 50%)', label_en: 'Seller', label_he: 'מוכר' },
  bot: { bg: 'hsl(40 4% 90%)', text: 'hsl(40 4% 42%)', label_en: 'Bot', label_he: 'בוט' },
  admin: { bg: 'hsl(220 60% 92% / 0.5)', text: 'hsl(220 60% 44%)', label_en: 'Admin', label_he: 'מנהל' },
  unknown: { bg: 'hsl(40 4% 94%)', text: 'hsl(40 4% 55%)', label_en: 'Unknown', label_he: 'לא מסווג' },
}

/* ── Relative time helper ─────────────────────────────── */

function relativeTime(dateStr: string | null): string {
  if (!dateStr) return 'Never'
  const diff = Date.now() - new Date(dateStr).getTime()
  const hours = Math.floor(diff / (1000 * 60 * 60))
  if (hours < 1) return 'Just now'
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return `${Math.floor(days / 7)}w ago`
}

/* ── Component ─────────────────────────────────────────── */

export default function AdminGroupDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { locale } = useI18n()
  const he = locale === 'he'

  const { info, funnel, activity, members, market, trends, isLoading, isError } = useGroupDetail(id)

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

          {/* Seasonal Trends */}
          {trends && trends.length > 0 && (() => {
            const professions = [...new Set(trends.map(t => t.profession))].sort()
            const months = [...new Set(trends.map(t => t.month))].sort()

            if (months.length < 2) return null

            const chartData = months.map(month => {
              const row: Record<string, any> = { month: month.slice(5) }
              professions.forEach(p => {
                const entry = trends.find(t => t.month === month && t.profession === p)
                row[p] = entry?.count || 0
              })
              return row
            })

            const colors = [
              'hsl(220 60% 55%)', 'hsl(155 44% 45%)', 'hsl(0 60% 55%)',
              'hsl(40 80% 50%)', 'hsl(280 60% 55%)', 'hsl(180 60% 40%)',
            ]

            return (
              <div className="glass-panel p-5">
                <h3 className="text-sm font-semibold mb-4" style={{ color: 'hsl(40 8% 10%)' }}>
                  {he ? 'מגמות עונתיות' : 'Seasonal Trends'}
                </h3>
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(40 4% 90%)" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    {professions.slice(0, 6).map((prof, i) => (
                      <Area
                        key={prof}
                        type="monotone"
                        dataKey={prof}
                        stackId="1"
                        stroke={colors[i % colors.length]}
                        fill={colors[i % colors.length]}
                        fillOpacity={0.3}
                      />
                    ))}
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )
          })()}
        </div>
      )}

      {tab === 'members' && members && (
        <MembersTab members={members} groupId={id!} he={he} />
      )}

      {tab === 'messages' && (
        <MessagesTab waGroupId={info.wa_group_id} he={he} />
      )}

      {tab === 'market' && (
        <MarketIntelTab market={market} he={he} />
      )}
    </div>
  )
}

/* ── Members Tab sub-component ───────────────────────── */

function MembersTab({ members, groupId, he }: { members: MemberRow[]; groupId: string; he: boolean }) {
  const [sortKey, setSortKey] = useState<keyof MemberRow | 'seller_ratio'>('total_messages')
  const [sortAsc, setSortAsc] = useState(false)

  const sorted = useMemo(() => {
    const list = [...members]
    list.sort((a, b) => {
      let av: number | string
      let bv: number | string
      if (sortKey === 'seller_ratio') {
        av = a.total_messages > 0 ? a.service_messages / a.total_messages : 0
        bv = b.total_messages > 0 ? b.service_messages / b.total_messages : 0
      } else {
        av = (a[sortKey] as string | number) ?? ''
        bv = (b[sortKey] as string | number) ?? ''
      }
      if (typeof av === 'number' && typeof bv === 'number') return sortAsc ? av - bv : bv - av
      return sortAsc ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av))
    })
    return list
  }, [members, sortKey, sortAsc])

  const toggleSort = useCallback((key: typeof sortKey) => {
    if (sortKey === key) setSortAsc((p) => !p)
    else { setSortKey(key); setSortAsc(false) }
  }, [sortKey])

  const handleOverride = useCallback(async (memberId: string, newValue: string) => {
    await supabase
      .from('group_members')
      .update({ classification: newValue, manual_override: true })
      .eq('id', memberId)
    queryClient.invalidateQueries({ queryKey: ['admin', 'group-detail', groupId, 'members'] })
  }, [groupId])

  const columns: { key: typeof sortKey; label: string }[] = [
    { key: 'display_name', label: he ? 'שם' : 'Name' },
    { key: 'classification', label: he ? 'סיווג' : 'Classification' },
    { key: 'total_messages', label: he ? 'הודעות' : 'Messages' },
    { key: 'lead_messages', label: he ? 'לידים' : 'Leads' },
    { key: 'seller_ratio', label: he ? '% מוכר' : 'Seller Ratio' },
    { key: 'last_seen_at', label: he ? 'נראה לאחרונה' : 'Last Seen' },
  ]

  return (
    <div className="glass-panel overflow-x-auto">
      <table className="w-full text-sm" style={{ color: 'hsl(40 8% 10%)' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid hsl(40 4% 88%)' }}>
            {columns.map((col) => (
              <th
                key={col.key}
                onClick={() => toggleSort(col.key)}
                className="px-4 py-3 text-left font-medium cursor-pointer select-none whitespace-nowrap"
                style={{ color: 'hsl(40 4% 42%)', fontSize: 12 }}
              >
                {col.label} {sortKey === col.key ? (sortAsc ? '↑' : '↓') : ''}
              </th>
            ))}
            <th className="px-4 py-3 text-left font-medium whitespace-nowrap" style={{ color: 'hsl(40 4% 42%)', fontSize: 12 }}>
              {he ? 'שינוי ידני' : 'Override'}
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((m) => {
            const cls = classificationStyle[m.classification] || classificationStyle.unknown
            const sellerRatio = m.total_messages > 0 ? ((m.service_messages / m.total_messages) * 100).toFixed(1) : '0.0'
            return (
              <tr key={m.id} className="hover:bg-black/[0.02] transition-colors" style={{ borderBottom: '1px solid hsl(40 4% 93%)' }}>
                <td className="px-4 py-3 whitespace-nowrap">{m.display_name || m.wa_sender_id}</td>
                <td className="px-4 py-3">
                  <span
                    className="inline-block px-2 py-0.5 rounded-full text-xs font-medium"
                    style={{ background: cls.bg, color: cls.text }}
                  >
                    {he ? cls.label_he : cls.label_en}
                  </span>
                </td>
                <td className="px-4 py-3 tabular-nums">{m.total_messages}</td>
                <td className="px-4 py-3 tabular-nums">{m.lead_messages}</td>
                <td className="px-4 py-3 tabular-nums">{sellerRatio}%</td>
                <td className="px-4 py-3 whitespace-nowrap" style={{ color: 'hsl(40 4% 42%)' }}>{relativeTime(m.last_seen_at)}</td>
                <td className="px-4 py-3">
                  <select
                    value={m.classification}
                    onChange={(e) => handleOverride(m.id, e.target.value)}
                    className="text-xs rounded border px-1.5 py-1 bg-white"
                    style={{ borderColor: 'hsl(40 4% 82%)', color: 'hsl(40 8% 10%)' }}
                  >
                    <option value="buyer">{he ? 'קונה' : 'Buyer'}</option>
                    <option value="seller">{he ? 'מוכר' : 'Seller'}</option>
                    <option value="bot">{he ? 'בוט' : 'Bot'}</option>
                    <option value="admin">{he ? 'מנהל' : 'Admin'}</option>
                  </select>
                </td>
              </tr>
            )
          })}
          {sorted.length === 0 && (
            <tr>
              <td colSpan={7} className="px-4 py-8 text-center" style={{ color: 'hsl(40 4% 55%)' }}>
                {he ? 'אין חברים' : 'No members found'}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

/* ── Messages Tab sub-component ─────────────────────── */

interface MessageItem {
  id: string
  text: string
  sender: string | null
  senderId: string
  timestamp: number
  classification: string
  isLead: boolean
  profession?: string
}

function MessagesTab({ waGroupId, he }: { waGroupId: string; he: boolean }) {
  const [messages, setMessages] = useState<MessageItem[]>([])
  const [msgLoading, setMsgLoading] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!waGroupId) return
    setMsgLoading(true)
    const baseUrl = import.meta.env.VITE_WA_LISTENER_URL || 'http://localhost:3001'
    fetch(`${baseUrl}/api/messages/${waGroupId}?limit=50`)
      .then((r) => r.json())
      .then((data) => setMessages(data || []))
      .catch(() => setMessages([]))
      .finally(() => setMsgLoading(false))
  }, [waGroupId])

  const toggleExpand = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  if (msgLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="glass-panel p-4 animate-pulse">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-4 w-24 rounded" style={{ background: 'hsl(40 4% 88%)' }} />
              <div className="h-4 w-16 rounded" style={{ background: 'hsl(40 4% 92%)' }} />
              <div className="flex-1" />
              <div className="h-3 w-20 rounded" style={{ background: 'hsl(40 4% 92%)' }} />
            </div>
            <div className="h-4 w-3/4 rounded" style={{ background: 'hsl(40 4% 92%)' }} />
          </div>
        ))}
      </div>
    )
  }

  if (messages.length === 0) {
    return (
      <div className="glass-panel p-12 text-center">
        <p style={{ color: 'hsl(40 4% 42%)' }}>{he ? 'לא נמצאו הודעות' : 'No messages found'}</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {messages.map((msg) => {
        const borderColor = msg.isLead
          ? 'border-emerald-400'
          : msg.classification === 'seller'
            ? 'border-red-400'
            : 'border-gray-200'
        const cls = classificationStyle[msg.classification] || classificationStyle.unknown
        const isLong = msg.text && msg.text.length > 200
        const isExpanded = expanded.has(msg.id)
        const displayText = isLong && !isExpanded ? msg.text.slice(0, 200) + '...' : msg.text

        return (
          <div key={msg.id} className={`glass-panel p-4 border-l-4 ${borderColor}`}>
            {/* Top row */}
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="font-semibold text-sm" style={{ color: 'hsl(40 8% 10%)' }}>
                {msg.sender || msg.senderId}
              </span>
              <span
                className="inline-block px-2 py-0.5 rounded-full text-xs font-medium"
                style={{ background: cls.bg, color: cls.text }}
              >
                {he ? cls.label_he : cls.label_en}
              </span>
              <span className="flex-1" />
              <span className="text-xs" style={{ color: 'hsl(40 4% 55%)' }}>
                {new Date(msg.timestamp * 1000).toLocaleString()}
              </span>
            </div>

            {/* Body */}
            <p className="text-sm whitespace-pre-wrap" style={{ color: 'hsl(40 8% 20%)' }}>
              {displayText}
            </p>
            {isLong && (
              <button
                onClick={() => toggleExpand(msg.id)}
                className="text-xs mt-1 underline"
                style={{ color: 'hsl(220 60% 55%)' }}
              >
                {isExpanded ? (he ? 'הצג פחות' : 'Show less') : (he ? 'הצג עוד' : 'Show more')}
              </button>
            )}

            {/* Lead badge */}
            {msg.isLead && (
              <div className="mt-2">
                <span
                  className="inline-block px-2 py-0.5 rounded-full text-xs font-medium"
                  style={{ background: 'hsl(152 46% 85% / 0.5)', color: 'hsl(155 44% 30%)' }}
                >
                  {msg.profession || (he ? 'ליד' : 'Lead')}
                </span>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

/* ── Market Intel Tab sub-component ──────────────────── */

interface MarketIntel {
  professions: { name: string; count: number; pct: number }[]
  regions: { name: string; count: number; pct: number }[]
  urgency: { level: string; count: number; pct: number }[]
  repeatRequesters: {
    sender_id: string
    display_name: string | null
    request_count: number
    professions: string[]
    last_request: string
  }[]
}

function MarketIntelTab({ market, he }: { market: MarketIntel | null | undefined; he: boolean }) {
  const professions = market?.professions ?? []
  const regions = market?.regions ?? []
  const urgency = market?.urgency ?? []
  const repeatRequesters = market?.repeatRequesters ?? []

  // Empty state
  if (!market || professions.length === 0) {
    return (
      <div className="glass-panel p-12 text-center">
        <p style={{ color: 'hsl(40 4% 42%)' }}>
          {he ? 'אין לידים מהקבוצה הזו עדיין' : 'No leads from this group yet'}
        </p>
      </div>
    )
  }

  const sortedProfessions = [...professions].sort((a, b) => b.count - a.count)
  const topRegions = [...regions].sort((a, b) => b.count - a.count).slice(0, 10)

  const getUrgency = (level: string) => urgency.find((u) => u.level === level)
  const hotPct = getUrgency('hot')?.pct ?? 0
  const warmPct = getUrgency('warm')?.pct ?? 0
  const coldPct = getUrgency('cold')?.pct ?? 0

  return (
    <div className="space-y-6">
      {/* Section 1: Top Professions */}
      <div className="glass-panel p-5">
        <h2 className="text-sm font-semibold mb-4" style={{ color: 'hsl(40 8% 10%)' }}>
          {he ? 'מקצועות מובילים' : 'Top Professions'}
        </h2>
        {sortedProfessions.length >= 3 ? (
          <ResponsiveContainer width="100%" height={Math.max(180, sortedProfessions.length * 36)}>
            <BarChart
              data={sortedProfessions}
              layout="vertical"
              margin={{ left: 10, right: 20, top: 5, bottom: 5 }}
            >
              <XAxis type="number" tick={{ fontSize: 12, fill: 'hsl(40 4% 42%)' }} />
              <YAxis
                type="category"
                dataKey="name"
                width={120}
                tick={{ fontSize: 12, fill: 'hsl(40 4% 42%)' }}
              />
              <Tooltip
                contentStyle={{
                  background: '#fff',
                  border: '1px solid hsl(40 4% 88%)',
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={(value: any, _name: any, props: any) => [
                  `${value} (${props.payload.pct}%)`,
                  he ? 'בקשות' : 'Requests',
                ]}
              />
              <Bar dataKey="count" fill="hsl(220 60% 55%)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex flex-wrap gap-2">
            {sortedProfessions.map((p) => (
              <span
                key={p.name}
                className="glass-panel inline-flex px-3 py-1.5 rounded-full text-sm"
                style={{ color: 'hsl(40 8% 10%)' }}
              >
                {p.name} <span className="ml-1.5 font-medium" style={{ color: 'hsl(220 60% 55%)' }}>{p.pct}%</span>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Section 2: Hot Regions */}
      {topRegions.length > 0 && (
        <div className="glass-panel p-5">
          <h2 className="text-sm font-semibold mb-4" style={{ color: 'hsl(40 8% 10%)' }}>
            {he ? 'אזורים חמים' : 'Hot Regions'}
          </h2>
          <div className="flex flex-wrap gap-2">
            {topRegions.map((r) => (
              <span
                key={r.name}
                className="glass-panel inline-flex px-3 py-1.5 rounded-full text-sm"
                style={{ color: 'hsl(40 8% 10%)' }}
              >
                {r.name} <span className="ml-1.5 font-semibold tabular-nums">{r.count}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Section 3: Urgency Mix */}
      {urgency.length > 0 && (
        <div className="glass-panel p-5">
          <h2 className="text-sm font-semibold mb-4" style={{ color: 'hsl(40 8% 10%)' }}>
            {he ? 'פילוח דחיפות' : 'Urgency Breakdown'}
          </h2>
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl p-4 text-center" style={{ background: 'hsl(0 80% 93% / 0.5)' }}>
              <div className="text-lg mb-1">🔥</div>
              <div className="text-xl font-bold" style={{ color: 'hsl(0 60% 40%)' }}>{hotPct}%</div>
              <div className="text-xs mt-1" style={{ color: 'hsl(0 50% 45%)' }}>Hot</div>
            </div>
            <div className="rounded-xl p-4 text-center" style={{ background: 'hsl(40 80% 90% / 0.5)' }}>
              <div className="text-lg mb-1">☀️</div>
              <div className="text-xl font-bold" style={{ color: 'hsl(35 70% 35%)' }}>{warmPct}%</div>
              <div className="text-xs mt-1" style={{ color: 'hsl(35 50% 40%)' }}>Warm</div>
            </div>
            <div className="rounded-xl p-4 text-center" style={{ background: 'hsl(220 60% 92% / 0.5)' }}>
              <div className="text-lg mb-1">❄️</div>
              <div className="text-xl font-bold" style={{ color: 'hsl(220 50% 40%)' }}>{coldPct}%</div>
              <div className="text-xs mt-1" style={{ color: 'hsl(220 40% 45%)' }}>Cold</div>
            </div>
          </div>
        </div>
      )}

      {/* Section 4: Repeat Requesters */}
      <div className="glass-panel p-5">
        <h2 className="text-sm font-semibold" style={{ color: 'hsl(40 8% 10%)' }}>
          {he ? 'מבקשים חוזרים' : 'Repeat Requesters'}
        </h2>
        <p className="text-xs mt-0.5 mb-4" style={{ color: 'hsl(40 4% 42%)' }}>
          {he
            ? 'פרוספקטים בעלי ערך גבוה שפרסמו 2+ בקשות'
            : 'High-value prospects who posted 2+ requests'}
        </p>
        {repeatRequesters.length === 0 ? (
          <p className="text-sm text-center py-4" style={{ color: 'hsl(40 4% 55%)' }}>
            {he ? 'לא נמצאו מבקשים חוזרים' : 'No repeat requesters found'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ color: 'hsl(40 8% 10%)' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid hsl(40 4% 88%)' }}>
                  <th className="px-4 py-2 text-left font-medium" style={{ color: 'hsl(40 4% 42%)', fontSize: 12 }}>
                    {he ? 'שולח' : 'Sender'}
                  </th>
                  <th className="px-4 py-2 text-left font-medium" style={{ color: 'hsl(40 4% 42%)', fontSize: 12 }}>
                    {he ? 'בקשות' : 'Requests'}
                  </th>
                  <th className="px-4 py-2 text-left font-medium" style={{ color: 'hsl(40 4% 42%)', fontSize: 12 }}>
                    {he ? 'מקצועות' : 'Professions'}
                  </th>
                  <th className="px-4 py-2 text-left font-medium" style={{ color: 'hsl(40 4% 42%)', fontSize: 12 }}>
                    {he ? 'בקשה אחרונה' : 'Last Request'}
                  </th>
                </tr>
              </thead>
              <tbody>
                {repeatRequesters.map((rr) => (
                  <tr
                    key={rr.sender_id}
                    className="hover:bg-black/[0.02] transition-colors"
                    style={{ borderBottom: '1px solid hsl(40 4% 93%)' }}
                  >
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      {rr.display_name || rr.sender_id}
                    </td>
                    <td className="px-4 py-2.5 tabular-nums whitespace-nowrap">
                      <span className="inline-flex items-center gap-1">
                        {rr.request_count}
                        {rr.request_count >= 3 && (
                          <Flame size={14} style={{ color: 'hsl(0 80% 50%)' }} />
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-2.5" style={{ color: 'hsl(40 4% 42%)' }}>
                      {rr.professions.join(', ')}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap" style={{ color: 'hsl(40 4% 42%)' }}>
                      {relativeTime(rr.last_request)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
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
