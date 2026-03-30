import { useSystemHealth } from '../../hooks/useSystemHealth'
import type { ServiceStatus, ErrorEntry, ActivityEvent } from '../../hooks/useSystemHealth'
import {
  Loader2,
  Wifi,
  WifiOff,
  Database,
  Zap,
  CreditCard,
  RefreshCw,
  AlertTriangle,
  XCircle,
  CheckCircle,
  Info,
  UserPlus,
  FileText,
  DollarSign,
  MessageSquare,
  Bell,
  TrendingUp,
  TrendingDown,
  Minus,
  Activity,
  Clock,
  Users,
  Layers,
} from 'lucide-react'

const ORANGE = '#fe5b25'

const STATUS_CONFIG = {
  healthy: { color: '#22c55e', bg: 'rgba(34,197,94,0.08)', label: 'Healthy', icon: CheckCircle },
  degraded: { color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', label: 'Degraded', icon: AlertTriangle },
  down: { color: '#ef4444', bg: 'rgba(239,68,68,0.08)', label: 'Down', icon: XCircle },
  unknown: { color: '#6b7280', bg: 'rgba(107,114,128,0.08)', label: 'Unknown', icon: Info },
}

const SERVICE_ICONS: Record<string, typeof Wifi> = {
  'WhatsApp Connection': Wifi,
  'Edge Functions': Zap,
  'Supabase DB': Database,
  'Stripe': CreditCard,
}

const SEVERITY_CONFIG = {
  error: { color: '#ef4444', bg: 'rgba(239,68,68,0.06)', border: '#ef4444' },
  warning: { color: '#f59e0b', bg: 'rgba(245,158,11,0.06)', border: '#f59e0b' },
  info: { color: '#3b82f6', bg: 'rgba(59,130,246,0.06)', border: '#3b82f6' },
}

const EVENT_ICONS: Record<string, { icon: typeof UserPlus; color: string; bg: string }> = {
  signup: { icon: UserPlus, color: '#22c55e', bg: 'rgba(34,197,94,0.1)' },
  lead: { icon: FileText, color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
  payment: { icon: DollarSign, color: ORANGE, bg: 'rgba(254,91,37,0.1)' },
  whatsapp: { icon: MessageSquare, color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)' },
  nudge: { icon: Bell, color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
}

function MetricCard({ label, value, icon: Icon, trend, trendLabel }: {
  label: string
  value: string
  icon: typeof Users
  trend?: 'up' | 'down' | 'flat'
  trendLabel?: string
}) {
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus
  const trendColor = trend === 'up' ? '#22c55e' : trend === 'down' ? '#ef4444' : '#9ca3af'
  return (
    <div className="bg-white rounded-2xl border border-stone-100 shadow-sm p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-stone-400">{label}</span>
        <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.03)' }}>
          <Icon className="w-4 h-4 text-stone-400" />
        </div>
      </div>
      <div className="flex items-end gap-2">
        <span className="text-[28px] font-extrabold tracking-tight leading-none text-[#1a1a1a]">{value}</span>
        {trendLabel && (
          <span className="flex items-center gap-0.5 text-[11px] font-semibold pb-1" style={{ color: trendColor }}>
            <TrendIcon className="w-3 h-3" />
            {trendLabel}
          </span>
        )}
      </div>
    </div>
  )
}

function ServiceCard({ service }: { service: ServiceStatus }) {
  const cfg = STATUS_CONFIG[service.status]
  const SvcIcon = SERVICE_ICONS[service.name] || Activity
  const StatusIcon = cfg.icon
  return (
    <div className="bg-white rounded-2xl border border-stone-100 shadow-sm p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: cfg.bg }}>
            <SvcIcon className="w-4.5 h-4.5" style={{ color: cfg.color }} />
          </div>
          <div>
            <div className="text-[13px] font-bold text-stone-700">{service.name}</div>
            <div className="text-[11px] text-stone-400">{service.detail}</div>
          </div>
        </div>
        <div
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold"
          style={{ background: cfg.bg, color: cfg.color }}
        >
          <StatusIcon className="w-3 h-3" />
          {cfg.label}
        </div>
      </div>
    </div>
  )
}

function ErrorRow({ error }: { error: ErrorEntry }) {
  const cfg = SEVERITY_CONFIG[error.severity]
  return (
    <div
      className="flex items-center gap-3 py-2.5 px-3 rounded-xl border-l-3"
      style={{ background: cfg.bg, borderLeftColor: cfg.border, borderLeftWidth: 3 }}
    >
      <div className="shrink-0">
        {error.severity === 'error' ? (
          <XCircle className="w-4 h-4" style={{ color: cfg.color }} />
        ) : error.severity === 'warning' ? (
          <AlertTriangle className="w-4 h-4" style={{ color: cfg.color }} />
        ) : (
          <Info className="w-4 h-4" style={{ color: cfg.color }} />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: cfg.color }}>
            {error.service}
          </span>
        </div>
        <p className="text-[12px] text-stone-600 truncate">{error.message}</p>
      </div>
      <span className="text-[10px] text-stone-300 shrink-0">{formatTimeAgo(error.timestamp)}</span>
    </div>
  )
}

function ActivityRow({ event }: { event: ActivityEvent }) {
  const cfg = EVENT_ICONS[event.type] || EVENT_ICONS.signup
  const IconComp = cfg.icon
  return (
    <div className="flex items-center gap-3 py-2 px-3 rounded-xl hover:bg-stone-50/60 transition-colors">
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: cfg.bg }}
      >
        <IconComp className="w-4 h-4" style={{ color: cfg.color }} />
      </div>
      <span className="text-[13px] text-stone-600 flex-1 truncate">{event.description}</span>
      <span className="text-[11px] text-stone-300 shrink-0">{formatTimeAgo(event.created_at)}</span>
    </div>
  )
}

export default function SystemHealth() {
  const { services, errors, activity, metrics, loading, lastRefresh, refresh } = useSystemHealth()

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-stone-300" />
      </div>
    )
  }

  const overallHealth = services.some(s => s.status === 'down')
    ? 'down'
    : services.some(s => s.status === 'degraded')
      ? 'degraded'
      : 'healthy'

  const overallCfg = STATUS_CONFIG[overallHealth]

  const leadsTrend = metrics.leadsToday > metrics.leadsYesterday
    ? 'up'
    : metrics.leadsToday < metrics.leadsYesterday
      ? 'down'
      : 'flat'

  const leadsDiff = metrics.leadsToday - metrics.leadsYesterday

  return (
    <div className="h-full overflow-y-auto" style={{ background: '#faf9f6' }}>
      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">

        {/* Header with overall status and refresh */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Activity className="w-5 h-5" style={{ color: overallCfg.color }} />
            <h1 className="text-[13px] font-extrabold uppercase tracking-[0.06em] text-stone-700">
              System Health
            </h1>
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold"
              style={{ background: overallCfg.bg, color: overallCfg.color }}
            >
              <overallCfg.icon className="w-3 h-3" />
              All Systems {overallCfg.label}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {lastRefresh && (
              <span className="text-[11px] text-stone-300 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Updated {formatTimeAgo(lastRefresh.toISOString())}
              </span>
            )}
            <button
              onClick={refresh}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-white border border-stone-200 hover:bg-stone-50 transition-colors text-stone-500"
            >
              <RefreshCw className="w-3 h-3" />
              Refresh
            </button>
          </div>
        </div>

        {/* Service Status Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {services.map(svc => (
            <ServiceCard key={svc.name} service={svc} />
          ))}
        </div>

        {/* Metrics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            label="Leads Today"
            value={metrics.leadsToday.toLocaleString()}
            icon={FileText}
            trend={leadsTrend as 'up' | 'down' | 'flat'}
            trendLabel={`${leadsDiff >= 0 ? '+' : ''}${leadsDiff} vs yesterday`}
          />
          <MetricCard
            label="Active Groups"
            value={metrics.activeGroups.toLocaleString()}
            icon={Layers}
          />
          <MetricCard
            label="Nudges Today"
            value={metrics.nudgesToday.toLocaleString()}
            icon={Bell}
          />
          <MetricCard
            label="Cron Runs Today"
            value={metrics.cronRunsToday.toLocaleString()}
            icon={Zap}
          />
        </div>

        {/* Two-column: Errors + Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Recent Errors */}
          <div className="bg-white rounded-2xl border border-stone-100 shadow-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-[12px] font-extrabold uppercase tracking-[0.08em] text-stone-400">
                Recent Errors
              </h3>
              {errors.length > 0 && (
                <span className="inline-flex items-center justify-center rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold text-white">
                  {errors.length}
                </span>
              )}
            </div>
            {errors.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-green-50">
                  <CheckCircle className="w-6 h-6 text-green-500" />
                </div>
                <p className="text-sm font-semibold text-stone-600">No errors detected</p>
                <p className="text-[11px] text-stone-300 mt-1">All systems running smoothly</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {errors.map(err => (
                  <ErrorRow key={err.id} error={err} />
                ))}
              </div>
            )}
          </div>

          {/* Activity Feed */}
          <div className="bg-white rounded-2xl border border-stone-100 shadow-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-[12px] font-extrabold uppercase tracking-[0.08em] text-stone-400">
                Activity Feed
              </h3>
              <span className="text-[10px] text-stone-300 flex items-center gap-1">
                <RefreshCw className="w-2.5 h-2.5" />
                Auto-refresh 30s
              </span>
            </div>
            {activity.length === 0 ? (
              <p className="text-sm text-stone-300 text-center py-10">No recent activity</p>
            ) : (
              <div className="space-y-1 max-h-[400px] overflow-y-auto">
                {activity.map(evt => (
                  <ActivityRow key={evt.id} event={evt} />
                ))}
              </div>
            )}
          </div>

        </div>

        {/* Cron Jobs Detail */}
        <div className="bg-white rounded-2xl border border-stone-100 shadow-sm p-6">
          <h3 className="text-[12px] font-extrabold uppercase tracking-[0.08em] text-stone-400 mb-5">
            System Info
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="text-center p-4 rounded-xl" style={{ background: 'rgba(0,0,0,0.02)' }}>
              <div className="text-[24px] font-extrabold text-stone-700">{metrics.totalUsers}</div>
              <div className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider mt-1">Total Users</div>
            </div>
            <div className="text-center p-4 rounded-xl" style={{ background: 'rgba(0,0,0,0.02)' }}>
              <div className="text-[24px] font-extrabold text-stone-700">{metrics.activeGroups}</div>
              <div className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider mt-1">Active Groups</div>
            </div>
            <div className="text-center p-4 rounded-xl" style={{ background: 'rgba(0,0,0,0.02)' }}>
              <div className="text-[24px] font-extrabold text-stone-700">{metrics.leadsToday}</div>
              <div className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider mt-1">Leads Today</div>
            </div>
            <div className="text-center p-4 rounded-xl" style={{ background: 'rgba(0,0,0,0.02)' }}>
              <div className="text-[24px] font-extrabold text-stone-700">{metrics.cronRunsToday}</div>
              <div className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider mt-1">Cron Runs Today</div>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}
