import { useI18n } from '../../lib/i18n'
import { usePartnerStats } from '../../hooks/usePartnerStats'
import { usePartnerProfile } from '../../hooks/usePartnerProfile'
import { useNavigate } from 'react-router-dom'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts'
import {
  DollarSign,
  Users,
  MessageSquare,
  Percent,
  ArrowRight,
  Share2,
  TrendingUp,
  Clock,
  Wallet,
  XCircle,
  ArrowDownRight,
  ArrowUpRight,
} from 'lucide-react'

function formatCents(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)
}

function timeAgo(d: string, he: boolean): string {
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000)
  if (m < 1) return he ? 'עכשיו' : 'just now'
  if (m < 60) return he ? `לפני ${m} דק'` : `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return he ? `לפני ${h} שע'` : `${h}h ago`
  return he ? `לפני ${Math.floor(h / 24)} ימים` : `${Math.floor(h / 24)}d ago`
}

const ACTIVITY_CONFIG: Record<string, { icon: typeof DollarSign; color: string; label: string; he: string }> = {
  earning:         { icon: ArrowDownRight, color: '#16a34a', label: 'Commission Earned', he: 'עמלה שהתקבלה' },
  withdrawal:      { icon: ArrowUpRight,   color: '#ef4444', label: 'Withdrawal',        he: 'משיכה' },
  credit:          { icon: Wallet,         color: '#6366f1', label: 'Credit Applied',    he: 'זיכוי' },
  refund_clawback: { icon: XCircle,        color: '#f59e0b', label: 'Refund Clawback',   he: 'החזר' },
}

export default function PartnerHome() {
  const { locale } = useI18n()
  const he = locale === 'he'
  const navigate = useNavigate()
  const { stats, dailyEarnings, recentActivity, loading } = usePartnerStats()
  const { partner } = usePartnerProfile()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin h-8 w-8 rounded-full border-2 border-[#fe5b25] border-t-transparent" />
      </div>
    )
  }

  const chartData = dailyEarnings.map(d => ({
    date: d.date.slice(5), // MM-DD
    amount: d.amount_cents / 100,
  }))

  return (
    <div className="animate-fade-in space-y-8 pb-16 pt-2">
      {/* Header */}
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900">
            {he ? `שלום, ${partner?.display_name || ''}` : `Hey, ${partner?.display_name || ''}`}
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            {he ? 'סקירת הביצועים שלך' : 'Your partner performance overview'}
          </p>
        </div>
      </header>

      {/* KPI Cards */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <KpiCard
          icon={DollarSign}
          label={he ? 'סה"כ הכנסות' : 'Total Earnings'}
          value={formatCents(stats?.total_earnings_cents ?? 0)}
          sub={he ? `${formatCents(stats?.pending_earnings_cents ?? 0)} ממתין` : `${formatCents(stats?.pending_earnings_cents ?? 0)} pending`}
          color="#16a34a"
        />
        <KpiCard
          icon={Users}
          label={he ? 'הפניות' : 'Referrals'}
          value={String(stats?.total_referrals ?? 0)}
          sub={he ? `${stats?.active_referrals ?? 0} פעילים` : `${stats?.active_referrals ?? 0} active`}
          color="#fe5b25"
        />
        <KpiCard
          icon={MessageSquare}
          label={he ? 'קהילות' : 'Communities'}
          value={String(stats?.total_communities ?? 0)}
          sub={he ? 'קבוצות מקושרות' : 'Linked groups'}
          color="#6366f1"
        />
        <KpiCard
          icon={Percent}
          label={he ? 'אחוז עמלה' : 'Commission Rate'}
          value={`${((stats?.commission_rate ?? 0.15) * 100).toFixed(0)}%`}
          sub={he ? 'חוזר כל חודש' : 'Recurring monthly'}
          color="#f59e0b"
        />
      </section>

      {/* Earnings Chart */}
      <div className="glass-panel p-6 border-none shadow-lg">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-sm font-bold text-zinc-900">
              {he ? 'הכנסות - 30 ימים אחרונים' : 'Earnings - Last 30 Days'}
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              {he ? 'עמלות מאושרות' : 'Approved commissions'}
            </p>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-50 border border-green-100">
            <TrendingUp className="w-3.5 h-3.5 text-green-600" />
            <span className="text-xs font-bold text-green-600">
              {formatCents(stats?.total_earnings_cents ?? 0)}
            </span>
          </div>
        </div>

        <div className="h-[220px]">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="earningsGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#fe5b25" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#fe5b25" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: '#a1a1aa' }}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 10, fill: '#a1a1aa' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={v => `$${v}`}
                  width={50}
                />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', fontSize: 12 }}
                  formatter={(value) => [`$${Number(value).toFixed(2)}`, 'Earnings']}
                />
                <Area
                  type="monotone"
                  dataKey="amount"
                  stroke="#fe5b25"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#earningsGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-sm text-zinc-400">
                {he ? 'אין נתונים עדיין' : 'No earnings data yet'}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <div className="glass-panel p-6 border-none shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-zinc-900">
              {he ? 'פעילות אחרונה' : 'Recent Activity'}
            </h2>
            <button
              onClick={() => navigate('/partner/wallet')}
              className="text-xs text-[#fe5b25] font-semibold flex items-center gap-1 hover:underline"
            >
              {he ? 'הכל' : 'View all'} <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          {recentActivity.length > 0 ? (
            <div className="space-y-3">
              {recentActivity.map((item) => {
                const config = ACTIVITY_CONFIG[item.type] || ACTIVITY_CONFIG.earning
                const Icon = config.icon
                return (
                  <div key={item.id} className="flex items-center gap-3 py-2">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: `${config.color}10`, color: config.color }}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-zinc-800 truncate">
                        {he ? config.he : config.label}
                      </p>
                      <p className="text-[11px] text-zinc-400">
                        {timeAgo(item.created_at, he)}
                        {item.note && ` · ${item.note}`}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className={`text-sm font-bold ${item.amount_cents >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                        {item.amount_cents >= 0 ? '+' : ''}{formatCents(item.amount_cents)}
                      </span>
                      <span className={`block text-[10px] font-bold uppercase px-2 py-0.5 rounded-full mt-0.5 ${
                        item.status === 'approved' || item.status === 'paid' ? 'bg-green-50 text-green-600' :
                        item.status === 'pending' ? 'bg-amber-50 text-amber-600' :
                        'bg-red-50 text-red-500'
                      }`}>
                        {item.status}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="py-12 text-center">
              <Clock className="w-8 h-8 text-zinc-200 mx-auto mb-2" />
              <p className="text-sm text-zinc-400">
                {he ? 'אין פעילות עדיין' : 'No activity yet'}
              </p>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="glass-panel p-6 border-none shadow-lg">
          <h2 className="text-sm font-bold text-zinc-900 mb-4">
            {he ? 'פעולות מהירות' : 'Quick Actions'}
          </h2>

          <div className="space-y-3">
            {[
              { label: he ? 'שתף קישור הפניה' : 'Share Referral Link', icon: Share2, to: '/partner/share', color: '#fe5b25' },
              { label: he ? 'צפה בהפניות' : 'View Referrals', icon: Users, to: '/partner/referrals', color: '#6366f1' },
              { label: he ? 'נהל קהילות' : 'Manage Communities', icon: MessageSquare, to: '/partner/communities', color: '#25D366' },
              { label: he ? 'ארנק ומשיכות' : 'Wallet & Withdrawals', icon: Wallet, to: '/partner/wallet', color: '#f59e0b' },
            ].map((action) => (
              <button
                key={action.to}
                onClick={() => navigate(action.to)}
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border border-zinc-100 hover:border-zinc-200 hover:bg-zinc-50/50 transition-all group"
              >
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: `${action.color}10`, color: action.color }}
                >
                  <action.icon className="w-4 h-4" />
                </div>
                <span className="text-sm font-semibold text-zinc-700 flex-1 text-left">
                  {action.label}
                </span>
                <ArrowRight className="w-4 h-4 text-zinc-300 group-hover:text-zinc-500 transition-colors" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/* KPI Card sub-component */
function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ElementType
  label: string
  value: string
  sub: string
  color: string
}) {
  return (
    <div className="glass-panel p-6 border-none shadow-lg">
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center mb-4 shadow-sm"
        style={{ background: `${color}10`, color }}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-stone-400 mb-1">
        {label}
      </div>
      <div className="text-2xl font-bold tracking-tight text-zinc-900">
        {value}
      </div>
      <div className="mt-1 text-[11px] font-medium text-stone-400">
        {sub}
      </div>
    </div>
  )
}
