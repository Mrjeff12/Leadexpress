import { useI18n } from '../../lib/i18n'
import { DollarSign, TrendingUp, BarChart3, Users } from 'lucide-react'

const monthlyRevenue = [
  { month: 'Oct', value: 8200 },
  { month: 'Nov', value: 9100 },
  { month: 'Dec', value: 9800 },
  { month: 'Jan', value: 10500 },
  { month: 'Feb', value: 11200 },
  { month: 'Mar', value: 12450 },
]

const planBreakdown = [
  { plan: 'Starter', subscribers: 15, pricePerMonth: 49, revenue: 735 },
  { plan: 'Pro', subscribers: 22, pricePerMonth: 149, revenue: 3278 },
  { plan: 'Unlimited', subscribers: 8, pricePerMonth: 299, revenue: 2392 },
]

const maxRevenue = Math.max(...monthlyRevenue.map((m) => m.value))
const totalPlanRevenue = planBreakdown.reduce((sum, p) => sum + p.revenue, 0)

const planColors: Record<string, string> = {
  Starter: '#3b82f6',
  Pro: '#f59e0b',
  Unlimited: '#8b5cf6',
}

export default function Revenue() {
  const { locale } = useI18n()
  const he = locale === 'he'

  const planLabel = (plan: string): string => {
    const labels: Record<string, { en: string; he: string }> = {
      Starter: { en: 'Starter', he: 'סטארטר' },
      Pro: { en: 'Pro', he: 'פרו' },
      Unlimited: { en: 'Unlimited', he: 'ללא הגבלה' },
    }
    return he ? (labels[plan]?.he ?? plan) : (labels[plan]?.en ?? plan)
  }

  const monthLabel = (month: string): string => {
    const labels: Record<string, string> = {
      Oct: 'אוק׳',
      Nov: 'נוב׳',
      Dec: 'דצמ׳',
      Jan: 'ינו׳',
      Feb: 'פבר׳',
      Mar: 'מרץ',
    }
    return he ? (labels[month] ?? month) : month
  }

  const kpis = [
    {
      label: he ? 'הכנסה חודשית חוזרת' : 'MRR',
      value: '₪12,450',
      subtitle: he ? 'הכנסה חודשית חוזרת' : 'Monthly Recurring Revenue',
      icon: DollarSign,
    },
    {
      label: he ? 'סה"כ הכנסות (שנתי)' : 'Total Revenue (YTD)',
      value: '₪89,200',
      subtitle: he ? 'מתחילת השנה' : 'Year to date',
      icon: BarChart3,
    },
    {
      label: he ? 'קצב צמיחה' : 'Growth Rate',
      value: '+18%',
      subtitle: he ? 'לעומת החודש הקודם' : 'vs. last month',
      icon: TrendingUp,
    },
    {
      label: he ? 'הכנסה ממוצעת לקבלן' : 'Avg Revenue per Contractor',
      value: '₪2,075',
      subtitle: he ? 'ממוצע חודשי' : 'Monthly average',
      icon: Users,
    },
  ]

  return (
    <div className="animate-fade-in space-y-8" style={{ fontFamily: 'Outfit, sans-serif' }}>
      {/* Header */}
      <header>
        <h1 className="text-3xl font-bold tracking-tight" style={{ color: '#2d3a2e' }}>
          {he ? 'הכנסות' : 'Revenue'}
        </h1>
        <p className="mt-1 text-sm" style={{ color: '#6b7c6e' }}>
          {he ? 'הכנסה חודשית חוזרת ומגמות' : 'Monthly recurring revenue and trends'}
        </p>
      </header>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 stagger-children">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="glass-panel p-5">
            <div className="flex items-center gap-3">
              <div
                className="flex items-center justify-center w-10 h-10 rounded-xl"
                style={{ backgroundColor: 'rgba(90,138,94,0.1)' }}
              >
                <kpi.icon className="h-5 w-5" style={{ color: '#5a8a5e' }} />
              </div>
              <div>
                <p className="text-2xl font-bold" style={{ color: '#2d3a2e' }}>{kpi.value}</p>
                <p className="text-xs font-medium" style={{ color: '#9ca89e' }}>{kpi.label}</p>
              </div>
            </div>
            <p className="mt-2 text-xs" style={{ color: '#6b7c6e' }}>{kpi.subtitle}</p>
          </div>
        ))}
      </div>

      {/* Revenue Over Time Chart */}
      <div className="glass-panel p-6">
        <h2 className="text-lg font-semibold mb-6" style={{ color: '#2d3a2e' }}>
          {he ? 'הכנסות לאורך זמן' : 'Revenue Over Time'}
        </h2>
        <div className="flex items-end justify-between gap-3" style={{ height: 220 }}>
          {monthlyRevenue.map((m) => {
            const heightPct = (m.value / maxRevenue) * 100
            return (
              <div key={m.month} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group">
                <span
                  className="text-xs font-semibold opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ color: '#2d3a2e' }}
                >
                  ₪{m.value.toLocaleString()}
                </span>
                <div
                  className="w-full rounded-t-lg transition-all duration-300 group-hover:opacity-80"
                  style={{
                    height: `${heightPct}%`,
                    backgroundColor: 'hsl(155 44% 30%)',
                    minHeight: 4,
                  }}
                />
                <span className="text-xs font-medium" style={{ color: '#6b7c6e' }}>
                  {monthLabel(m.month)}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Plan Breakdown Table */}
      <div className="glass-panel overflow-hidden">
        <div className="px-6 pt-5 pb-3">
          <h2 className="text-lg font-semibold" style={{ color: '#2d3a2e' }}>
            {he ? 'פירוט לפי מסלול' : 'Plan Breakdown'}
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid #e0e4e0' }}>
                <th className="text-left px-6 py-3 font-semibold text-xs uppercase tracking-wider" style={{ color: '#9ca89e' }}>
                  {he ? 'מסלול' : 'Plan'}
                </th>
                <th className="text-left px-6 py-3 font-semibold text-xs uppercase tracking-wider" style={{ color: '#9ca89e' }}>
                  {he ? 'מנויים' : 'Subscribers'}
                </th>
                <th className="text-left px-6 py-3 font-semibold text-xs uppercase tracking-wider" style={{ color: '#9ca89e' }}>
                  {he ? 'מחיר/חודש' : 'Price/Month'}
                </th>
                <th className="text-left px-6 py-3 font-semibold text-xs uppercase tracking-wider" style={{ color: '#9ca89e' }}>
                  {he ? 'הכנסה חודשית' : 'Monthly Revenue'}
                </th>
              </tr>
            </thead>
            <tbody>
              {planBreakdown.map((row) => (
                <tr key={row.plan} style={{ borderBottom: '1px solid #eef0ee' }} className="hover:bg-[#f5f7f5] transition-colors">
                  <td className="px-6 py-3.5 font-medium" style={{ color: '#2d3a2e' }}>
                    <span className="flex items-center gap-2">
                      <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: planColors[row.plan] }} />
                      {planLabel(row.plan)}
                    </span>
                  </td>
                  <td className="px-6 py-3.5" style={{ color: '#2d3a2e' }}>{row.subscribers}</td>
                  <td className="px-6 py-3.5" style={{ color: '#2d3a2e' }}>₪{row.pricePerMonth}</td>
                  <td className="px-6 py-3.5 font-semibold" style={{ color: '#2d3a2e' }}>₪{row.revenue.toLocaleString()}</td>
                </tr>
              ))}
              {/* Total Row */}
              <tr style={{ borderTop: '2px solid #d0d4d0' }}>
                <td className="px-6 py-3.5 font-bold" style={{ color: '#2d3a2e' }}>
                  {he ? 'סה"כ' : 'Total'}
                </td>
                <td className="px-6 py-3.5 font-bold" style={{ color: '#2d3a2e' }}>
                  {planBreakdown.reduce((sum, p) => sum + p.subscribers, 0)}
                </td>
                <td className="px-6 py-3.5" style={{ color: '#9ca89e' }}>—</td>
                <td className="px-6 py-3.5 font-bold" style={{ color: '#2d3a2e' }}>
                  ₪{totalPlanRevenue.toLocaleString()}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Revenue Split Visualization */}
      <div className="glass-panel p-6">
        <h2 className="text-lg font-semibold mb-4" style={{ color: '#2d3a2e' }}>
          {he ? 'חלוקת הכנסות' : 'Revenue Split'}
        </h2>
        {/* Stacked horizontal bar */}
        <div className="w-full h-10 rounded-xl overflow-hidden flex">
          {planBreakdown.map((row) => {
            const pct = (row.revenue / totalPlanRevenue) * 100
            return (
              <div
                key={row.plan}
                className="h-full transition-all duration-300 relative group"
                style={{ width: `${pct}%`, backgroundColor: planColors[row.plan] }}
                title={`${planLabel(row.plan)}: ₪${row.revenue.toLocaleString()} (${Math.round(pct)}%)`}
              />
            )
          })}
        </div>
        {/* Legend */}
        <div className="flex flex-wrap gap-5 mt-4">
          {planBreakdown.map((row) => {
            const pct = Math.round((row.revenue / totalPlanRevenue) * 100)
            return (
              <div key={row.plan} className="flex items-center gap-2">
                <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: planColors[row.plan] }} />
                <span className="text-sm font-medium" style={{ color: '#2d3a2e' }}>
                  {planLabel(row.plan)}
                </span>
                <span className="text-sm" style={{ color: '#6b7c6e' }}>
                  {pct}% (₪{row.revenue.toLocaleString()})
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
