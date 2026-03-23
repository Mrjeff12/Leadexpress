import { useParams, useNavigate } from 'react-router-dom'
import { useI18n } from '../../lib/i18n'
import { usePartnerGroupDetail } from '../../hooks/usePartnerGroups'
import { getScoreColorClass } from '../../lib/group-score'
import {
  ArrowLeft,
  Users,
  MessageSquare,
  Zap,
  ShieldAlert,
  TrendingDown,
  Skull,
  Activity,
  BarChart3,
  MapPin,
  Briefcase,
  Eye,
  UserCheck,
  UserX,
  HelpCircle,
} from 'lucide-react'

/* ── helpers ──────────────────────────────────────────── */

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

const activityLevelConfig = {
  high: { label: 'High', labelHe: 'גבוהה', color: 'text-emerald-600', bg: 'bg-emerald-50' },
  medium: { label: 'Medium', labelHe: 'בינונית', color: 'text-amber-600', bg: 'bg-amber-50' },
  low: { label: 'Low', labelHe: 'נמוכה', color: 'text-orange-500', bg: 'bg-orange-50' },
  dormant: { label: 'Dormant', labelHe: 'רדומה', color: 'text-red-500', bg: 'bg-red-50' },
}

const classificationConfig = {
  buyer: { icon: UserCheck, label: 'Buyer', labelHe: 'קונה', color: 'text-emerald-600', bg: 'bg-emerald-50' },
  seller: { icon: UserX, label: 'Seller', labelHe: 'מוכר/ספאם', color: 'text-red-500', bg: 'bg-red-50' },
  bot: { icon: Activity, label: 'Bot', labelHe: 'בוט', color: 'text-zinc-400', bg: 'bg-zinc-50' },
  admin: { icon: ShieldAlert, label: 'Admin', labelHe: 'מנהל', color: 'text-blue-500', bg: 'bg-blue-50' },
  unknown: { icon: HelpCircle, label: 'Unknown', labelHe: 'לא ידוע', color: 'text-zinc-400', bg: 'bg-zinc-50' },
}

/* ── component ───────────────────────────────────────── */

export default function PartnerGroupDetail() {
  const { groupId } = useParams()
  const navigate = useNavigate()
  const { locale } = useI18n()
  const he = locale === 'he'
  const { data: detail, isLoading } = usePartnerGroupDetail(groupId)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin h-8 w-8 rounded-full border-2 border-[#fe5b25] border-t-transparent" />
      </div>
    )
  }

  if (!detail) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <p className="text-zinc-400">{he ? 'קבוצה לא נמצאה' : 'Group not found'}</p>
        <button onClick={() => navigate('/partner/communities')} className="text-sm text-[#fe5b25] hover:underline">
          {he ? 'חזור לקבוצות' : 'Back to groups'}
        </button>
      </div>
    )
  }

  const { info, activity, members, topProfessions, topRegions, alerts } = detail
  const actConf = activityLevelConfig[info.activityLevel]

  // Activity chart: simple bar chart of last 30 days
  const maxMessages = Math.max(...activity.map(d => d.messages), 1)

  return (
    <div className="animate-fade-in space-y-6 pb-16 pt-2">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/partner/communities')}
          className="w-9 h-9 rounded-xl bg-zinc-100 hover:bg-zinc-200 flex items-center justify-center transition-colors"
        >
          <ArrowLeft className="w-4 h-4 text-zinc-500" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">{info.name}</h1>
          <p className="text-sm text-zinc-400 mt-0.5">
            {he ? 'אנליטיקה חכמה לקבוצה' : 'Smart Group Analytics'}
          </p>
        </div>
        <span className={`inline-flex items-center justify-center w-12 h-12 rounded-2xl text-lg font-bold ${getScoreColorClass(info.score.color)}`}>
          {info.score.score}
        </span>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="flex gap-3 overflow-x-auto pb-1">
          {alerts.map((alert, i) => {
            const config = {
              spam: { icon: ShieldAlert, bg: 'bg-red-50', color: 'text-red-500', label: he ? 'ספאם' : 'Spam Alert' },
              dormant: { icon: Skull, bg: 'bg-zinc-100', color: 'text-zinc-500', label: he ? 'רדומה' : 'Dormant' },
              declining: { icon: TrendingDown, bg: 'bg-amber-50', color: 'text-amber-600', label: he ? 'ירידה' : 'Declining' },
            }[alert.type]
            const Icon = config.icon
            return (
              <div key={i} className={`flex items-center gap-3 px-4 py-3 rounded-xl ${config.bg} shrink-0`}>
                <Icon className={`w-4 h-4 ${config.color}`} />
                <div>
                  <p className={`text-xs font-semibold ${config.color}`}>{config.label}</p>
                  <p className="text-[11px] text-zinc-500">{alert.message}</p>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { icon: Users, value: info.total_members, label: he ? 'חברים' : 'Members', color: '#3b82f6' },
          { icon: MessageSquare, value: info.messages7d, label: he ? 'הודעות (7 ימים)' : 'Messages (7d)', color: '#fe5b25' },
          { icon: Zap, value: info.leadsDetected, label: he ? 'לידים שזוהו' : 'Leads Detected', color: '#10b981' },
          { icon: ShieldAlert, value: `${info.spamRatio}%`, label: he ? 'ספאמרים' : 'Spammers', color: info.spamRatio > 50 ? '#ef4444' : '#f59e0b' },
          { icon: Activity, value: he ? actConf.labelHe : actConf.label, label: he ? 'רמת פעילות' : 'Activity Level', color: '#8b5cf6' },
        ].map(({ icon: Icon, value, label, color }, i) => (
          <div key={i} className="bg-white rounded-2xl border border-zinc-200 p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${color}15` }}>
              <Icon className="w-5 h-5" style={{ color }} />
            </div>
            <div>
              <p className="text-xl font-bold text-zinc-900 leading-none">{value}</p>
              <p className="text-[11px] text-zinc-400 mt-0.5">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Activity Chart + Member Breakdown */}
      <div className="grid lg:grid-cols-3 gap-5">
        {/* Activity — 30-day bar chart */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-zinc-200 p-6">
          <h3 className="text-sm font-bold text-zinc-800 mb-4 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-[#fe5b25]" />
            {he ? 'פעילות (30 ימים אחרונים)' : 'Activity (Last 30 Days)'}
          </h3>
          {activity.length === 0 ? (
            <p className="text-sm text-zinc-400 text-center py-8">{he ? 'אין נתונים עדיין' : 'No data yet'}</p>
          ) : (
            <div className="flex items-end gap-[3px] h-32">
              {activity.map((day, i) => {
                const pct = (day.messages / maxMessages) * 100
                return (
                  <div key={i} className="flex-1 flex flex-col items-center justify-end group relative">
                    <div
                      className="w-full rounded-t-sm transition-all group-hover:opacity-80"
                      style={{
                        height: `${Math.max(pct, 2)}%`,
                        background: pct >= 60 ? '#fe5b25' : pct >= 30 ? '#f59e0b' : '#d4d4d8',
                      }}
                    />
                    <div className="absolute -top-8 bg-zinc-800 text-white text-[9px] px-1.5 py-0.5 rounded hidden group-hover:block whitespace-nowrap">
                      {day.date.slice(5)} — {day.messages}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          {info.messagesPrev7d > 0 && (
            <div className="mt-3 flex items-center gap-2 text-[11px]">
              {info.messages7d >= info.messagesPrev7d ? (
                <span className="text-emerald-500 font-semibold">
                  ↑ {Math.round(((info.messages7d - info.messagesPrev7d) / info.messagesPrev7d) * 100)}%
                </span>
              ) : (
                <span className="text-red-500 font-semibold">
                  ↓ {Math.round(((info.messagesPrev7d - info.messages7d) / info.messagesPrev7d) * 100)}%
                </span>
              )}
              <span className="text-zinc-400">{he ? 'לעומת שבוע קודם' : 'vs previous week'}</span>
            </div>
          )}
        </div>

        {/* Member Breakdown */}
        <div className="bg-white rounded-2xl border border-zinc-200 p-6">
          <h3 className="text-sm font-bold text-zinc-800 mb-4 flex items-center gap-2">
            <Users className="w-4 h-4 text-[#fe5b25]" />
            {he ? 'הרכב חברים' : 'Member Breakdown'}
          </h3>
          <div className="space-y-4">
            {[
              { label: he ? 'קונים (מחפשי עבודה)' : 'Buyers (Job Seekers)', count: info.memberBreakdown.buyers, color: '#10b981', total: info.total_members },
              { label: he ? 'מוכרים/ספאמרים' : 'Sellers/Spammers', count: info.memberBreakdown.sellers, color: '#ef4444', total: info.total_members },
              { label: he ? 'מנהלי קבוצה' : 'Group Admins', count: info.memberBreakdown.admins, color: '#f59e0b', total: info.total_members },
              { label: he ? 'לא מסווגים' : 'Unclassified', count: info.memberBreakdown.unknown, color: '#d4d4d8', total: info.total_members },
            ].map(({ label, count, color, total }, i) => (
              <div key={i}>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-zinc-600 font-medium">{label}</span>
                  <span className="text-zinc-400">{count} ({total > 0 ? Math.round((count / total) * 100) : 0}%)</span>
                </div>
                <div className="h-2 rounded-full bg-zinc-100 overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${total > 0 ? (count / total) * 100 : 0}%`, background: color }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top Professions + Top Regions */}
      <div className="grid lg:grid-cols-2 gap-5">
        {/* Professions */}
        <div className="bg-white rounded-2xl border border-zinc-200 p-6">
          <h3 className="text-sm font-bold text-zinc-800 mb-4 flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-[#fe5b25]" />
            {he ? 'מקצועות מובילים' : 'Top Professions'}
          </h3>
          {topProfessions.length === 0 ? (
            <p className="text-sm text-zinc-400 text-center py-4">{he ? 'אין נתונים' : 'No data'}</p>
          ) : (
            <div className="space-y-2.5">
              {topProfessions.map((p, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="w-5 h-5 rounded-full bg-[#fe5b25]/10 text-[#fe5b25] text-[9px] font-bold flex items-center justify-center shrink-0">
                    {i + 1}
                  </span>
                  <span className="text-sm text-zinc-700 flex-1 truncate">{p.name}</span>
                  <span className="text-xs text-zinc-400 tabular-nums">{p.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Regions */}
        <div className="bg-white rounded-2xl border border-zinc-200 p-6">
          <h3 className="text-sm font-bold text-zinc-800 mb-4 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-[#fe5b25]" />
            {he ? 'אזורים מובילים' : 'Top Regions'}
          </h3>
          {topRegions.length === 0 ? (
            <p className="text-sm text-zinc-400 text-center py-4">{he ? 'אין נתונים' : 'No data'}</p>
          ) : (
            <div className="space-y-2.5">
              {topRegions.map((r, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="w-5 h-5 rounded-full bg-blue-50 text-blue-500 text-[9px] font-bold flex items-center justify-center shrink-0">
                    {i + 1}
                  </span>
                  <span className="text-sm text-zinc-700 flex-1 truncate">{r.name}</span>
                  <span className="text-xs text-zinc-400 tabular-nums">{r.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Members Table */}
      <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden">
        <div className="p-6 pb-4 flex items-center justify-between">
          <h3 className="text-sm font-bold text-zinc-800 flex items-center gap-2">
            <Eye className="w-4 h-4 text-[#fe5b25]" />
            {he ? 'חברי הקבוצה' : 'Group Members'}
            <span className="text-xs font-normal text-zinc-400">({members.length})</span>
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-t border-zinc-100 text-[11px] text-zinc-400 uppercase tracking-wider">
                <th className="px-6 py-3 text-start font-medium">{he ? 'שם' : 'Name'}</th>
                <th className="px-4 py-3 text-start font-medium">{he ? 'סיווג' : 'Type'}</th>
                <th className="px-4 py-3 text-start font-medium">{he ? 'הודעות' : 'Messages'}</th>
                <th className="px-4 py-3 text-start font-medium">{he ? 'פעילות' : 'Activity'}</th>
                <th className="px-4 py-3 text-start font-medium">{he ? 'הצטרף' : 'Joined'}</th>
                <th className="px-4 py-3 text-start font-medium">{he ? 'נראה לאחרונה' : 'Last Seen'}</th>
              </tr>
            </thead>
            <tbody>
              {members.slice(0, 50).map((m, i) => {
                const cls = classificationConfig[m.classification] || classificationConfig.unknown
                const ClsIcon = cls.icon
                const actLevel = m.activityLevel === 'active'
                  ? { label: he ? 'פעיל' : 'Active', color: 'text-emerald-600 bg-emerald-50' }
                  : m.activityLevel === 'moderate'
                    ? { label: he ? 'בינוני' : 'Moderate', color: 'text-amber-600 bg-amber-50' }
                    : { label: he ? 'רדום' : 'Dormant', color: 'text-zinc-400 bg-zinc-50' }

                const isGroupAdmin = m.classification === 'admin'

                return (
                  <tr key={i} className={`border-t border-zinc-50 hover:bg-zinc-50/50 transition-colors ${isGroupAdmin ? 'bg-amber-50/40' : ''}`}>
                    <td className="px-6 py-3">
                      <span className={`text-sm font-medium ${isGroupAdmin ? 'text-amber-700' : 'text-zinc-700'}`}>
                        {isGroupAdmin && '👑 '}{m.display_name || m.wa_sender_id.slice(-6)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${cls.bg} ${cls.color}`}>
                        <ClsIcon className="w-3 h-3" />
                        {he ? cls.labelHe : cls.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-600 tabular-nums">{m.total_messages}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${actLevel.color}`}>
                        {actLevel.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-400 text-xs">{relativeTime(m.joined_group_at)}</td>
                    <td className="px-4 py-3 text-zinc-400 text-xs">{relativeTime(m.last_seen_at)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {members.length > 50 && (
          <div className="px-6 py-3 border-t border-zinc-100 text-center">
            <p className="text-[11px] text-zinc-400">
              {he ? `מציג 50 מתוך ${members.length} חברים` : `Showing 50 of ${members.length} members`}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
