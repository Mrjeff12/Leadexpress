import { useState, useEffect, useCallback, useMemo } from 'react'
import { useI18n } from '../../lib/i18n'
import { supabase } from '../../lib/supabase'
import {
  Shield,
  Search,
  Download,
  Loader2,
  AlertCircle,
  Calendar,
  ChevronLeft,
  ChevronRight,
  FileText,
} from 'lucide-react'

/* ── Design tokens (matches CommissionLog) ──────────────────── */
const C = {
  primary: '#6b7280',
  dark: '#1C1C1E',
  muted: '#8E8E93',
  accent: '#5856D6',
  success: '#059669',
  warning: '#D97706',
  danger: '#DC2626',
  border: 'rgba(0,0,0,0.06)',
}

interface AuditRow {
  id: string
  user_id: string | null
  admin_user_id: string | null
  target_user_id: string | null
  action: string
  resource_type: string | null
  resource_id: string | null
  details: Record<string, any> | null
  created_at: string
  // joined
  admin_email: string | null
  target_email: string | null
  target_name: string | null
}

const PAGE_SIZE = 50

/* ── Action badge colors ── */
const ACTION_CONFIG: Record<string, { color: string; bg: string }> = {
  impersonate_start:      { color: C.warning, bg: '#FFFBEB' },
  impersonate_stop:       { color: C.warning, bg: '#FFFBEB' },
  plan_change:            { color: '#2563EB', bg: '#EFF6FF' },
  trial_created:          { color: '#2563EB', bg: '#EFF6FF' },
  contractor_activated:   { color: C.success, bg: '#ECFDF5' },
  contractor_deactivated: { color: C.danger, bg: '#FEF2F2' },
  suspension:             { color: C.danger, bg: '#FEF2F2' },
  ban:                    { color: C.danger, bg: '#FEF2F2' },
}

function getActionBadge(action: string) {
  return ACTION_CONFIG[action] ?? { color: C.muted, bg: '#F3F4F6' }
}

/* ── Date range presets ── */
type DatePreset = '24h' | '7d' | '30d' | 'custom'
function getDatePresetRange(preset: DatePreset): { from: string; to: string } {
  const now = new Date()
  const to = now.toISOString().slice(0, 10)
  if (preset === '24h') {
    const from = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    return { from, to }
  }
  if (preset === '7d') {
    const from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    return { from, to }
  }
  if (preset === '30d') {
    const from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    return { from, to }
  }
  return { from: '', to: '' }
}

function fmtTimestamp(d: string | null): string {
  if (!d) return '—'
  const dt = new Date(d)
  return dt.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

export default function AuditLogs() {
  const { locale } = useI18n()
  const he = locale === 'he'

  const [logs, setLogs] = useState<AuditRow[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(0)

  // Filters
  const [search, setSearch] = useState('')
  const [actionFilter, setActionFilter] = useState<string>('all')
  const [datePreset, setDatePreset] = useState<DatePreset>('30d')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  // Distinct actions for filter dropdown
  const [availableActions, setAvailableActions] = useState<string[]>([])

  // Load distinct actions once
  useEffect(() => {
    supabase
      .from('audit_logs')
      .select('action')
      .then(({ data }) => {
        if (data) {
          const unique = [...new Set(data.map((r: any) => r.action))].sort()
          setAvailableActions(unique)
        }
      })
  }, [])

  const effectiveDates = useMemo(() => {
    if (datePreset === 'custom') return { from: dateFrom, to: dateTo }
    return getDatePresetRange(datePreset)
  }, [datePreset, dateFrom, dateTo])

  const fetchData = useCallback(async () => {
    setError(null)
    setLoading(true)
    try {
      // Build query — we join auth user emails via admin_user_id and target_user_id
      let query = supabase
        .from('audit_logs')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

      if (actionFilter !== 'all') {
        query = query.eq('action', actionFilter)
      }
      if (effectiveDates.from) {
        query = query.gte('created_at', effectiveDates.from + 'T00:00:00')
      }
      if (effectiveDates.to) {
        query = query.lte('created_at', effectiveDates.to + 'T23:59:59')
      }

      const { data, error: fetchErr, count } = await query

      if (fetchErr) throw fetchErr

      // Gather unique user IDs to resolve emails/names
      const userIds = new Set<string>()
      for (const r of data ?? []) {
        if (r.user_id) userIds.add(r.user_id)
        if (r.admin_user_id) userIds.add(r.admin_user_id)
        if (r.target_user_id) userIds.add(r.target_user_id)
        if (r.resource_id) userIds.add(r.resource_id)
      }

      // Lookup profiles for those users
      let profileMap: Record<string, { email: string; full_name: string }> = {}
      if (userIds.size > 0) {
        const { data: profiles } = await supabase
          .from('contractors')
          .select('user_id, full_name, email')
          .in('user_id', [...userIds])
        if (profiles) {
          for (const p of profiles) {
            profileMap[p.user_id] = { email: p.email ?? '', full_name: p.full_name ?? '' }
          }
        }
      }

      const rows: AuditRow[] = (data ?? []).map((r: any) => {
        const adminId = r.admin_user_id || r.user_id
        const targetId = r.target_user_id || r.resource_id
        return {
          id: r.id,
          user_id: r.user_id,
          admin_user_id: r.admin_user_id,
          target_user_id: r.target_user_id,
          action: r.action,
          resource_type: r.resource_type,
          resource_id: r.resource_id,
          details: r.details,
          created_at: r.created_at,
          admin_email: profileMap[adminId]?.email || r.details?.admin_email || adminId?.slice(0, 8) || '—',
          target_email: profileMap[targetId]?.email || null,
          target_name: profileMap[targetId]?.full_name || null,
        }
      })

      // Client-side search filter (on target email/name)
      const filtered = search
        ? rows.filter(r => {
            const q = search.toLowerCase()
            return (
              (r.target_email?.toLowerCase().includes(q)) ||
              (r.target_name?.toLowerCase().includes(q)) ||
              (r.admin_email?.toLowerCase().includes(q))
            )
          })
        : rows

      setLogs(filtered)
      setTotalCount(search ? filtered.length : (count ?? 0))
    } catch (err: any) {
      console.error('[AuditLogs] fetch error:', err)
      setError(he ? 'טעינת נתונים נכשלה' : 'Failed to load audit logs')
    } finally {
      setLoading(false)
    }
  }, [he, page, actionFilter, effectiveDates, search])

  useEffect(() => { fetchData() }, [fetchData])

  // Reset page when filters change
  useEffect(() => { setPage(0) }, [actionFilter, datePreset, dateFrom, dateTo, search])

  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  function exportCSV() {
    const headers = ['Timestamp', 'Admin User', 'Action', 'Target User', 'Target Email', 'Resource Type', 'Resource ID', 'Details']
    const csvRows = logs.map(r => [
      r.created_at,
      r.admin_email ?? '',
      r.action,
      r.target_name ?? '',
      r.target_email ?? '',
      r.resource_type ?? '',
      r.resource_id ?? '',
      r.details ? JSON.stringify(r.details) : '',
    ])
    const csv = [headers, ...csvRows].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading && logs.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-6 h-6 animate-spin" style={{ color: C.primary }} />
          <p className="text-sm" style={{ color: C.muted }}>{he ? 'טוען...' : 'Loading...'}</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <AlertCircle className="w-8 h-8" style={{ color: C.danger }} />
          <p className="text-sm font-medium" style={{ color: C.danger }}>{error}</p>
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

  return (
    <div className="animate-fade-in space-y-6">
      {/* ═══ Header ═══ */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: C.dark, letterSpacing: '-0.02em' }}>
            {he ? 'יומן ביקורת' : 'Audit Logs'}
          </h1>
          <p className="text-sm mt-1" style={{ color: C.muted }}>
            {he ? 'כל הפעולות הניהוליות במערכת' : 'All administrative actions in the system'}
          </p>
        </div>
        <button
          onClick={exportCSV}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all hover:scale-[1.02] active:scale-[0.98] shadow-sm border"
          style={{ background: 'white', color: C.dark, borderColor: '#E5E7EB' }}
        >
          <Download className="w-4 h-4" />
          {he ? 'יצוא CSV' : 'Export CSV'}
        </button>
      </div>

      {/* ═══ KPI Card ═══ */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <div
          className="relative overflow-hidden rounded-2xl p-5 transition-all hover:shadow-md"
          style={{ background: 'linear-gradient(135deg, #F3F4F6 0%, #E5E7EB 100%)', border: `1px solid ${C.border}` }}
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-2xl font-bold tracking-tight" style={{ color: C.dark }}>{totalCount.toLocaleString()}</p>
              <p className="text-xs font-medium mt-1 uppercase tracking-wider" style={{ color: C.muted }}>
                {he ? 'סה"כ רשומות' : 'Total Records'}
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${C.primary}15` }}>
              <Shield className="w-5 h-5" style={{ color: C.primary }} />
            </div>
          </div>
        </div>
      </div>

      {/* ═══ Filters ═══ */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div
          className="flex items-center gap-2.5 flex-1 min-w-[200px] px-4 py-2.5 rounded-xl transition-all"
          style={{ background: 'white', border: `1.5px solid ${C.border}`, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
        >
          <Search className="w-4 h-4" style={{ color: C.muted }} />
          <input
            type="text"
            placeholder={he ? 'חפש לפי שם/אימייל...' : 'Search by name or email...'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent border-0 text-sm outline-none"
            style={{ color: C.dark }}
          />
        </div>

        {/* Action filter */}
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="text-xs font-medium rounded-xl px-3 py-2.5 border outline-none cursor-pointer transition-all hover:border-gray-300"
          style={{ borderColor: '#E5E7EB', color: C.dark, background: 'white' }}
        >
          <option value="all">{he ? 'כל הפעולות' : 'All Actions'}</option>
          {availableActions.map(a => (
            <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>
          ))}
        </select>

        {/* Date preset */}
        <select
          value={datePreset}
          onChange={(e) => setDatePreset(e.target.value as DatePreset)}
          className="text-xs font-medium rounded-xl px-3 py-2.5 border outline-none cursor-pointer transition-all hover:border-gray-300"
          style={{ borderColor: '#E5E7EB', color: C.dark, background: 'white' }}
        >
          <option value="24h">{he ? '24 שעות אחרונות' : 'Last 24 hours'}</option>
          <option value="7d">{he ? '7 ימים' : 'Last 7 days'}</option>
          <option value="30d">{he ? '30 ימים' : 'Last 30 days'}</option>
          <option value="custom">{he ? 'מותאם אישית' : 'Custom range'}</option>
        </select>

        {/* Custom date range */}
        {datePreset === 'custom' && (
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 shrink-0" style={{ color: C.muted }} />
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="text-xs font-medium rounded-xl px-3 py-2.5 border outline-none cursor-pointer"
              style={{ borderColor: '#E5E7EB', color: C.dark, background: 'white' }}
            />
            <span className="text-xs" style={{ color: C.muted }}>{he ? 'עד' : 'to'}</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="text-xs font-medium rounded-xl px-3 py-2.5 border outline-none cursor-pointer"
              style={{ borderColor: '#E5E7EB', color: C.dark, background: 'white' }}
            />
          </div>
        )}
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
                  he ? 'זמן' : 'Timestamp',
                  he ? 'מנהל' : 'Admin User',
                  he ? 'פעולה' : 'Action',
                  he ? 'משתמש יעד' : 'Target User',
                  he ? 'פרטים' : 'Details',
                ].map((col, i) => (
                  <th
                    key={i}
                    className="text-start px-4 py-3.5 font-semibold text-[11px] uppercase tracking-widest"
                    style={{ color: C.muted }}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-16 text-center">
                    <FileText className="w-8 h-8 mx-auto mb-3" style={{ color: '#D1D5DB' }} />
                    <p className="text-sm font-medium" style={{ color: C.muted }}>
                      {he ? 'אין רשומות ביקורת' : 'No audit logs found'}
                    </p>
                  </td>
                </tr>
              ) : (
                logs.map((r, idx) => {
                  const badge = getActionBadge(r.action)
                  const detailStr = r.details
                    ? Object.entries(r.details)
                        .filter(([k]) => k !== 'admin_email')
                        .map(([k, v]) => `${k}: ${v}`)
                        .join(', ')
                    : '—'

                  return (
                    <tr
                      key={r.id}
                      className="transition-colors"
                      style={{ borderBottom: idx < logs.length - 1 ? `1px solid ${C.border}` : undefined }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#FAFBFC')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td className="px-4 py-3.5">
                        <div className="text-[11px] font-mono whitespace-nowrap" style={{ color: C.muted }}>
                          {fmtTimestamp(r.created_at)}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="text-[12px] font-medium truncate max-w-[180px]" style={{ color: C.dark }}>
                          {r.admin_email || '—'}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className="inline-flex items-center text-[10px] font-semibold px-2.5 py-1 rounded-lg whitespace-nowrap"
                          style={{ background: badge.bg, color: badge.color }}
                        >
                          {r.action.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <div>
                          {r.target_name && (
                            <div className="text-[12px] font-semibold" style={{ color: C.dark }}>{r.target_name}</div>
                          )}
                          <div className="text-[11px]" style={{ color: C.muted }}>
                            {r.target_email || r.target_user_id || r.resource_id || '—'}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="text-[11px] max-w-[250px] truncate" style={{ color: C.muted }} title={detailStr}>
                          {detailStr}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ═══ Pagination Footer ═══ */}
        <div className="px-5 py-3 flex items-center justify-between" style={{ borderTop: `1px solid ${C.border}`, background: '#FAFBFC' }}>
          <span className="text-[11px] font-medium" style={{ color: C.muted }}>
            {he
              ? `${totalCount} רשומות · עמוד ${page + 1} מתוך ${Math.max(totalPages, 1)}`
              : `${totalCount} record${totalCount !== 1 ? 's' : ''} · Page ${page + 1} of ${Math.max(totalPages, 1)}`}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="p-1.5 rounded-lg transition-all hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" style={{ color: C.dark }} />
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="p-1.5 rounded-lg transition-all hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" style={{ color: C.dark }} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
