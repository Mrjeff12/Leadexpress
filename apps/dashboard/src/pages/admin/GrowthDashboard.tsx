import { useGrowthMetrics } from '../../hooks/useGrowthMetrics'
import { Loader2, UserPlus, ArrowUpCircle, LinkIcon, MessageSquare, Users, Target, CreditCard, BarChart3, Layers, FlaskConical, MessageCircle, TrendingUp } from 'lucide-react'

const ORANGE = '#fe5b25'

function formatCurrency(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 0 })}`
}

const ACTIVITY_ICONS: Record<string, { icon: typeof UserPlus; color: string; bg: string }> = {
  signup: { icon: UserPlus, color: '#22c55e', bg: 'rgba(34,197,94,0.1)' },
  upgrade: { icon: ArrowUpCircle, color: ORANGE, bg: 'rgba(254,91,37,0.1)' },
  cancellation: { icon: CreditCard, color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
  group_added: { icon: LinkIcon, color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
  feedback: { icon: MessageSquare, color: '#a855f7', bg: 'rgba(168,85,247,0.1)' },
}

const LEVEL_COLORS: Record<string, { color: string; bg: string }> = {
  member: { color: '#6b7280', bg: 'rgba(107,114,128,0.12)' },
  insider: { color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
  partner: { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  vip: { color: '#a855f7', bg: 'rgba(168,85,247,0.12)' },
}

function KpiCard({ label, value, icon: Icon, accent = false }: {
  label: string
  value: string
  icon: typeof Users
  accent?: boolean
}) {
  return (
    <div className="bg-white rounded-2xl border border-stone-100 shadow-sm p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-stone-400">{label}</span>
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center"
          style={{ background: accent ? `${ORANGE}10` : 'rgba(0,0,0,0.03)' }}
        >
          <Icon className="w-4 h-4" style={{ color: accent ? ORANGE : '#9ca3af' }} />
        </div>
      </div>
      <span
        className="text-[28px] font-extrabold tracking-tight leading-none"
        style={{ color: accent ? ORANGE : '#1a1a1a' }}
      >
        {value}
      </span>
    </div>
  )
}

export default function GrowthDashboard() {
  const m = useGrowthMetrics()

  if (m.loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-stone-300" />
      </div>
    )
  }

  const progressPct = Math.min(100, (m.payingUsers / m.payingTarget) * 100)
  const totalLevelUsers = m.levelDistribution.member + m.levelDistribution.insider + m.levelDistribution.partner + m.levelDistribution.vip

  return (
    <div className="h-full overflow-y-auto" style={{ background: '#faf9f6' }}>
      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">

        {/* ═══════════════ PHASE PROGRESS BAR ═══════════════ */}
        <div className="bg-white rounded-2xl border border-stone-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <Target className="w-5 h-5" style={{ color: ORANGE }} />
              <span className="text-[13px] font-extrabold uppercase tracking-[0.06em] text-stone-700">
                Phase 1: The First 500
              </span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-[28px] font-extrabold" style={{ color: ORANGE }}>{m.payingUsers}</span>
              <span className="text-[14px] font-semibold text-stone-400">/ {m.payingTarget} paying</span>
              <span
                className="ml-2 text-[12px] font-bold px-2 py-0.5 rounded-full"
                style={{ background: `${ORANGE}12`, color: ORANGE }}
              >
                {progressPct.toFixed(1)}%
              </span>
            </div>
          </div>
          <div className="w-full h-4 rounded-full overflow-hidden" style={{ background: 'rgba(0,0,0,0.04)' }}>
            <div
              className="h-full rounded-full transition-all duration-1000 ease-out"
              style={{
                width: `${progressPct}%`,
                background: `linear-gradient(90deg, ${ORANGE}, #ff8c42)`,
                boxShadow: `0 0 12px ${ORANGE}40`,
              }}
            />
          </div>
        </div>

        {/* ═══════════════ ROW 1: PRIMARY KPIs ═══════════════ */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label="MRR" value={formatCurrency(m.mrr)} icon={TrendingUp} accent />
          <KpiCard label="Paying Users" value={m.payingUsers.toLocaleString()} icon={CreditCard} accent />
          <KpiCard label="Free Users" value={m.freeUsers.toLocaleString()} icon={Users} />
          <KpiCard label="Conversion Rate" value={`${m.conversionRate.toFixed(1)}%`} icon={BarChart3} />
        </div>

        {/* ═══════════════ ROW 2: SECONDARY METRICS ═══════════════ */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label="Groups in Pool" value={m.totalGroupsInPool.toLocaleString()} icon={Layers} />
          <KpiCard label="Active Trials" value={m.activeTrials.toLocaleString()} icon={FlaskConical} />
          <KpiCard label="Feedback This Week" value={m.feedbackThisWeek.toLocaleString()} icon={MessageCircle} />
          <KpiCard label="Groups Added (7d)" value={m.groupsAddedThisWeek.toLocaleString()} icon={LinkIcon} />
        </div>

        {/* ═══════════════ ROW 3: LEVEL DISTRIBUTION ═══════════════ */}
        <div className="bg-white rounded-2xl border border-stone-100 shadow-sm p-6">
          <h3 className="text-[12px] font-extrabold uppercase tracking-[0.08em] text-stone-400 mb-5">
            Network Level Distribution
          </h3>
          <div className="space-y-3">
            {(['member', 'insider', 'partner', 'vip'] as const).map((level) => {
              const count = m.levelDistribution[level]
              const pct = totalLevelUsers > 0 ? (count / totalLevelUsers) * 100 : 0
              const { color, bg } = LEVEL_COLORS[level]
              return (
                <div key={level} className="flex items-center gap-4">
                  <span className="w-16 text-[12px] font-bold capitalize" style={{ color }}>
                    {level}
                  </span>
                  <div className="flex-1 h-7 rounded-lg overflow-hidden" style={{ background: 'rgba(0,0,0,0.03)' }}>
                    <div
                      className="h-full rounded-lg transition-all duration-700 ease-out flex items-center px-3"
                      style={{ width: `${Math.max(pct, 2)}%`, background: bg }}
                    >
                      {pct > 8 && (
                        <span className="text-[11px] font-bold" style={{ color }}>{count}</span>
                      )}
                    </div>
                  </div>
                  <span className="w-20 text-right text-[12px] font-semibold text-stone-400">
                    {count} ({pct.toFixed(0)}%)
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* ═══════════════ ROW 4: RECENT ACTIVITY ═══════════════ */}
        <div className="bg-white rounded-2xl border border-stone-100 shadow-sm p-6">
          <h3 className="text-[12px] font-extrabold uppercase tracking-[0.08em] text-stone-400 mb-5">
            Recent Activity
          </h3>
          {m.recentActivity.length === 0 ? (
            <p className="text-sm text-stone-300 text-center py-6">No recent activity</p>
          ) : (
            <div className="space-y-2">
              {m.recentActivity.map((item, i) => {
                const cfg = ACTIVITY_ICONS[item.type] || ACTIVITY_ICONS.signup
                const IconComp = cfg.icon
                const timeAgo = getTimeAgo(item.created_at)
                return (
                  <div key={i} className="flex items-center gap-3 py-2 px-3 rounded-xl hover:bg-stone-50/60 transition-colors">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: cfg.bg }}
                    >
                      <IconComp className="w-4 h-4" style={{ color: cfg.color }} />
                    </div>
                    <span className="text-[13px] text-stone-600 flex-1">{item.description}</span>
                    <span className="text-[11px] text-stone-300 shrink-0">{timeAgo}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}

function getTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}
