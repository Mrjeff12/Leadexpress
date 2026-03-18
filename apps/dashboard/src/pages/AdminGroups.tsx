import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useI18n } from '../lib/i18n'
import { useGroupScoreboard, type GroupRow } from '../hooks/useGroupScoreboard'
import { getScoreColorClass } from '../lib/group-score'
import {
  Radio,
  Eye,
  Search,
  TrendingUp,
  AlertTriangle,
  Users,
  Activity,
  ChevronUp,
  ChevronDown,
  ShieldAlert,
  Skull,
  TrendingDown,
  Flame,
} from 'lucide-react'

/* ── helpers ─────────────────────────────────────────────── */

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

type SortKey =
  | 'score'
  | 'name'
  | 'status'
  | 'leadYield'
  | 'sellers'
  | 'messages7d'
  | 'lastLeadAt'

function getSortValue(row: GroupRow, key: SortKey): number | string {
  switch (key) {
    case 'score':
      return row.score.score
    case 'name':
      return row.name.toLowerCase()
    case 'status':
      return row.status
    case 'leadYield':
      return row.leadYield
    case 'sellers':
      return row.total_members > 0 ? row.known_sellers / row.total_members : 0
    case 'messages7d':
      return row.messages7d
    case 'lastLeadAt':
      return row.lastLeadAt ? new Date(row.lastLeadAt).getTime() : 0
  }
}

/* ── component ───────────────────────────────────────────── */

export default function AdminGroups() {
  const { locale } = useI18n()
  const he = locale === 'he'
  const navigate = useNavigate()
  const { data: groups, isLoading } = useGroupScoreboard()

  /* filter state */
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [search, setSearch] = useState('')

  /* sort state */
  const [sortBy, setSortBy] = useState<SortKey>('score')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  /* derived: unique categories */
  const categories = useMemo(() => {
    if (!groups) return []
    const set = new Set<string>()
    groups.forEach((g) => {
      if (g.category) set.add(g.category)
    })
    return Array.from(set).sort()
  }, [groups])

  /* filtered + sorted rows */
  const rows = useMemo(() => {
    if (!groups) return []
    let list = [...groups]

    if (statusFilter !== 'all') {
      list = list.filter((g) => g.status === statusFilter)
    }
    if (categoryFilter !== 'all') {
      list = list.filter((g) => g.category === categoryFilter)
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter((g) => g.name.toLowerCase().includes(q))
    }

    list.sort((a, b) => {
      const va = getSortValue(a, sortBy)
      const vb = getSortValue(b, sortBy)
      if (va < vb) return sortDir === 'asc' ? -1 : 1
      if (va > vb) return sortDir === 'asc' ? 1 : -1
      return 0
    })

    return list
  }, [groups, statusFilter, categoryFilter, search, sortBy, sortDir])

  /* KPI aggregates */
  const kpis = useMemo(() => {
    if (!groups) return { total: 0, active: 0, avgYield: 0, needAttention: 0 }
    const total = groups.length
    const active = groups.filter((g) => g.status === 'active').length
    const avgYield =
      total > 0 ? groups.reduce((s, g) => s + g.leadYield, 0) / total : 0
    const needAttention = groups.filter((g) => g.score.score < 30).length
    return { total, active, avgYield, needAttention }
  }, [groups])

  interface Alert {
    type: 'spam' | 'dead' | 'declining'
    groupId: string
    groupName: string
    message: string
  }

  const alerts = useMemo(() => {
    if (!groups) return [] as Alert[]
    const result: Alert[] = []
    const now = Date.now()
    const threeDays = 3 * 24 * 60 * 60 * 1000

    groups.forEach((g) => {
      if (g.total_members > 0 && g.known_sellers / g.total_members > 0.6) {
        const pct = Math.round((g.known_sellers / g.total_members) * 100)
        result.push({ type: 'spam', groupId: g.id, groupName: g.name, message: he ? `${pct}% מוכרים` : `${pct}% sellers` })
      }
      if (g.last_message_at && now - new Date(g.last_message_at).getTime() > threeDays) {
        const days = Math.floor((now - new Date(g.last_message_at).getTime()) / (24 * 60 * 60 * 1000))
        result.push({ type: 'dead', groupId: g.id, groupName: g.name, message: he ? `${days} ימים ללא פעילות` : `${days} days inactive` })
      }
      if (g.messagesPrev7d > 10 && g.messages7d < g.messagesPrev7d * 0.5) {
        const drop = Math.round((1 - g.messages7d / g.messagesPrev7d) * 100)
        result.push({ type: 'declining', groupId: g.id, groupName: g.name, message: he ? `ירידה של ${drop}%` : `${drop}% decline` })
      }
    })
    return result
  }, [groups, he])

  function toggleSort(key: SortKey) {
    if (sortBy === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(key)
      setSortDir('desc')
    }
  }

  function SortIcon({ col }: { col: SortKey }) {
    if (sortBy !== col)
      return (
        <span className="ml-1 opacity-30 inline-flex flex-col leading-none">
          <ChevronUp className="w-3 h-3 -mb-0.5" />
          <ChevronDown className="w-3 h-3" />
        </span>
      )
    return sortDir === 'asc' ? (
      <ChevronUp className="w-3.5 h-3.5 ml-1 inline" />
    ) : (
      <ChevronDown className="w-3.5 h-3.5 ml-1 inline" />
    )
  }

  /* ── render ─────────────────────────────────────────────── */

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div>
        <h1
          className="text-xl font-semibold"
          style={{ color: 'hsl(40 8% 10%)' }}
        >
          {he ? 'לוח קבוצות' : 'Group Intelligence Scoreboard'}
        </h1>
        <p className="text-sm mt-1" style={{ color: 'hsl(40 4% 42%)' }}>
          {he
            ? 'דירוג ביצועי הקבוצות בזמן אמת'
            : 'Real-time group performance ranking'}
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Groups */}
        <div className="glass-panel p-5 flex items-center gap-4">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'hsl(220 60% 92% / 0.6)' }}
          >
            <Radio className="w-5 h-5" style={{ color: 'hsl(220 60% 44%)' }} />
          </div>
          <div>
            <p
              className="text-2xl font-bold leading-none"
              style={{ color: 'hsl(40 8% 10%)' }}
            >
              {kpis.total}
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'hsl(40 4% 42%)' }}>
              {he ? 'סה"כ קבוצות' : 'Total Groups'}
            </p>
          </div>
        </div>

        {/* Active Groups */}
        <div className="glass-panel p-5 flex items-center gap-4">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'hsl(152 46% 85% / 0.6)' }}
          >
            <Activity
              className="w-5 h-5"
              style={{ color: 'hsl(155 44% 30%)' }}
            />
          </div>
          <div>
            <p
              className="text-2xl font-bold leading-none"
              style={{ color: 'hsl(40 8% 10%)' }}
            >
              {kpis.active}
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'hsl(40 4% 42%)' }}>
              {he ? 'קבוצות פעילות' : 'Active Groups'}
            </p>
          </div>
        </div>

        {/* Avg Lead Yield */}
        <div className="glass-panel p-5 flex items-center gap-4">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'hsl(40 80% 90% / 0.6)' }}
          >
            <TrendingUp
              className="w-5 h-5"
              style={{ color: 'hsl(40 80% 35%)' }}
            />
          </div>
          <div>
            <p
              className="text-2xl font-bold leading-none"
              style={{ color: 'hsl(40 8% 10%)' }}
            >
              {(kpis.avgYield * 100).toFixed(1)}%
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'hsl(40 4% 42%)' }}>
              {he ? 'תשואת לידים ממוצעת' : 'Avg Lead Yield'}
            </p>
          </div>
        </div>

        {/* Needing Attention */}
        <div className="glass-panel p-5 flex items-center gap-4">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'hsl(0 80% 93% / 0.6)' }}
          >
            <AlertTriangle
              className="w-5 h-5"
              style={{ color: 'hsl(0 60% 50%)' }}
            />
          </div>
          <div>
            <p
              className="text-2xl font-bold leading-none"
              style={{ color: kpis.needAttention > 0 ? 'hsl(0 60% 50%)' : 'hsl(40 8% 10%)' }}
            >
              {kpis.needAttention}
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'hsl(40 4% 42%)' }}>
              {he ? 'דורשות תשומת לב' : 'Need Attention'}
            </p>
          </div>
        </div>
      </div>

      {/* Filters row */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Status */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="glass-panel px-3 py-2 text-sm rounded-xl border-none outline-none cursor-pointer"
          style={{ color: 'hsl(40 8% 10%)' }}
        >
          <option value="all">{he ? 'כל הסטטוסים' : 'All Statuses'}</option>
          <option value="active">{he ? 'פעיל' : 'Active'}</option>
          <option value="paused">{he ? 'מושהה' : 'Paused'}</option>
          <option value="disconnected">{he ? 'מנותק' : 'Disconnected'}</option>
        </select>

        {/* Category */}
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="glass-panel px-3 py-2 text-sm rounded-xl border-none outline-none cursor-pointer"
          style={{ color: 'hsl(40 8% 10%)' }}
        >
          <option value="all">{he ? 'כל הקטגוריות' : 'All Categories'}</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
            style={{ color: 'hsl(40 4% 42%)' }}
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={he ? 'חיפוש קבוצה...' : 'Search groups...'}
            className="glass-panel w-full pl-9 pr-3 py-2 text-sm rounded-xl border-none outline-none"
            style={{ color: 'hsl(40 8% 10%)' }}
          />
        </div>
      </div>

      {/* Health Alerts */}
      {alerts.length > 0 && (
        <div className="flex gap-3 overflow-x-auto pb-1">
          {alerts.map((alert, i) => {
            const config = {
              spam: { icon: ShieldAlert, bg: 'hsl(0 80% 93% / 0.5)', color: 'hsl(0 60% 50%)', label: he ? 'ספאם' : 'Spam' },
              dead: { icon: Skull, bg: 'hsl(40 4% 90%)', color: 'hsl(40 4% 42%)', label: he ? 'לא פעילה' : 'Inactive' },
              declining: { icon: TrendingDown, bg: 'hsl(40 80% 90% / 0.5)', color: 'hsl(40 80% 35%)', label: he ? 'ירידה' : 'Declining' },
            }[alert.type]
            const Icon = config.icon
            return (
              <button
                key={`${alert.type}-${alert.groupId}-${i}`}
                onClick={() => navigate(`/admin/groups/${alert.groupId}`)}
                className="glass-panel px-4 py-3 flex items-center gap-3 shrink-0 hover:shadow-lg transition-shadow"
              >
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: config.bg }}>
                  <Icon className="w-4 h-4" style={{ color: config.color }} />
                </div>
                <div className="text-left">
                  <p className="text-xs font-semibold" style={{ color: config.color }}>{config.label}</p>
                  <p className="text-xs" style={{ color: 'hsl(40 4% 42%)' }}>
                    {alert.groupName.slice(0, 25)} — {alert.message}
                  </p>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="glass-panel p-5 animate-pulse">
              <div className="h-4 bg-black/[0.04] rounded w-1/3 mb-2" />
              <div className="h-3 bg-black/[0.04] rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="glass-panel p-12 text-center">
          <Radio
            className="w-10 h-10 mx-auto mb-3"
            style={{ color: 'hsl(40 4% 42%)' }}
          />
          <p className="text-sm" style={{ color: 'hsl(40 4% 42%)' }}>
            {he ? 'לא נמצאו קבוצות' : 'No groups found'}
          </p>
        </div>
      ) : (
        <div className="glass-panel overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr
                className="border-b"
                style={{
                  borderColor: 'hsl(40 4% 90%)',
                  color: 'hsl(40 4% 42%)',
                }}
              >
                <Th col="score" label={he ? 'ציון' : 'Score'} sortBy={sortBy} sortDir={sortDir} toggle={toggleSort} SortIcon={SortIcon} />
                <Th col="name" label={he ? 'שם קבוצה' : 'Group Name'} sortBy={sortBy} sortDir={sortDir} toggle={toggleSort} SortIcon={SortIcon} />
                <Th col="status" label={he ? 'סטטוס' : 'Status'} sortBy={sortBy} sortDir={sortDir} toggle={toggleSort} SortIcon={SortIcon} />
                <Th col="leadYield" label={he ? 'תשואת לידים' : 'Lead Yield'} sortBy={sortBy} sortDir={sortDir} toggle={toggleSort} SortIcon={SortIcon} />
                <Th col="sellers" label={he ? 'מוכרים' : 'Sellers'} sortBy={sortBy} sortDir={sortDir} toggle={toggleSort} SortIcon={SortIcon} />
                <Th col="messages7d" label={he ? 'פעילות (7 ימים)' : 'Activity (7d)'} sortBy={sortBy} sortDir={sortDir} toggle={toggleSort} SortIcon={SortIcon} />
                <Th col="lastLeadAt" label={he ? 'ליד אחרון' : 'Last Lead'} sortBy={sortBy} sortDir={sortDir} toggle={toggleSort} SortIcon={SortIcon} />
                <th className="px-4 py-3 text-xs font-medium text-right">
                  {he ? 'פעולות' : 'Actions'}
                </th>
              </tr>
            </thead>
            <tbody className="stagger-children">
              {rows.map((row) => {
                const activityPct = Math.min(
                  (row.messages7d / 50) * 100,
                  100
                )
                const activityColor =
                  activityPct >= 70
                    ? 'hsl(155 44% 45%)'
                    : activityPct >= 30
                      ? 'hsl(40 80% 50%)'
                      : 'hsl(0 60% 55%)'

                return (
                  <tr
                    key={row.id}
                    className="border-b last:border-b-0 hover:bg-black/[0.02] transition-colors"
                    style={{ borderColor: 'hsl(40 4% 94%)' }}
                  >
                    {/* Score */}
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center justify-center w-9 h-9 rounded-full text-xs font-bold ${getScoreColorClass(row.score.color)}`}
                      >
                        {row.score.score}
                      </span>
                    </td>

                    {/* Group Name */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => navigate(`/admin/groups/${row.id}`)}
                          className="text-sm font-medium hover:underline text-left"
                          style={{ color: 'hsl(40 8% 10%)' }}
                        >
                          {row.name}
                        </button>
                        {row.repeatRequesters > 0 && (
                          <span
                            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold"
                            style={{ background: 'hsl(25 95% 90%)', color: 'hsl(25 95% 40%)' }}
                            title={he ? `${row.repeatRequesters} מבקשים חוזרים` : `${row.repeatRequesters} repeat requesters`}
                          >
                            <Flame className="w-3 h-3" />
                            {row.repeatRequesters}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      <span
                        className={`badge ${row.status === 'active' ? 'badge-green' : 'badge-red'}`}
                      >
                        {row.status === 'active'
                          ? he
                            ? 'פעיל'
                            : 'Active'
                          : he
                            ? 'מושבת'
                            : 'Paused'}
                      </span>
                    </td>

                    {/* Lead Yield */}
                    <td
                      className="px-4 py-3 text-sm"
                      style={{ color: 'hsl(40 8% 10%)' }}
                    >
                      {(row.leadYield * 100).toFixed(1)}%
                    </td>

                    {/* Sellers */}
                    <td className="px-4 py-3 text-sm flex items-center gap-1.5">
                      <Users
                        className="w-3.5 h-3.5"
                        style={{ color: 'hsl(40 4% 42%)' }}
                      />
                      <span style={{ color: 'hsl(40 8% 10%)' }}>
                        {row.known_sellers}/{row.total_members}
                      </span>
                    </td>

                    {/* Activity bar */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div
                          className="h-2 rounded-full flex-1 max-w-[80px]"
                          style={{ background: 'hsl(40 4% 92%)' }}
                        >
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${activityPct}%`,
                              background: activityColor,
                            }}
                          />
                        </div>
                        <span
                          className="text-xs tabular-nums"
                          style={{ color: 'hsl(40 4% 42%)' }}
                        >
                          {row.messages7d}
                        </span>
                      </div>
                    </td>

                    {/* Last Lead */}
                    <td
                      className="px-4 py-3 text-xs"
                      style={{ color: 'hsl(40 4% 42%)' }}
                    >
                      {relativeTime(row.lastLeadAt)}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() =>
                          navigate(`/admin/groups/${row.id}`)
                        }
                        className="p-1.5 rounded-lg hover:bg-black/[0.04] transition-colors"
                        title={he ? 'צפה' : 'View'}
                      >
                        <Eye
                          className="w-4 h-4"
                          style={{ color: 'hsl(40 4% 42%)' }}
                        />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

/* ── Th: sortable column header ──────────────────────────── */

function Th({
  col,
  label,
  sortBy: _sortBy,
  sortDir: _sortDir,
  toggle,
  SortIcon,
}: {
  col: SortKey
  label: string
  sortBy: SortKey
  sortDir: 'asc' | 'desc'
  toggle: (k: SortKey) => void
  SortIcon: React.FC<{ col: SortKey }>
}) {
  return (
    <th className="px-4 py-3 text-left whitespace-nowrap">
      <button
        onClick={() => toggle(col)}
        className="inline-flex items-center text-xs font-medium hover:opacity-80"
      >
        {label}
        <SortIcon col={col} />
      </button>
    </th>
  )
}
