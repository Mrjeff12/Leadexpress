import { useState, useEffect } from 'react'
import { useI18n } from '../../lib/i18n'
import { supabase } from '../../lib/supabase'
import { DollarSign, TrendingUp, BarChart3, Users, Loader2 } from 'lucide-react'

interface SubRow {
  status: string
  created_at: string
  plans: { slug: string; name: string; price_cents: number } | null
}

const planColors: Record<string, string> = {
  starter: '#3b82f6',
  pro: '#f59e0b',
  unlimited: '#8b5cf6',
}

export default function Revenue() {
  const { locale } = useI18n()
  const he = locale === 'he'

  const [subs, setSubs] = useState<SubRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('status, created_at, plans ( slug, name, price_cents )')

      if (error) {
        console.error('Failed to load revenue data:', error)
        setLoading(false)
        return
      }

      setSubs((data || []) as SubRow[])
      setLoading(false)
    }
    load()
  }, [])

  // Compute real metrics from subscriptions
  const activeSubs = subs.filter((s) => s.status === 'active' || s.status === 'trialing')
  const totalSubs = subs.length

  // Plan breakdown
  const planMap = new Map<string, { slug: string; name: string; price: number; count: number; revenue: number }>()
  for (const s of activeSubs) {
    const plan = s.plans
    if (!plan) continue
    const existing = planMap.get(plan.slug)
    const price = plan.price_cents / 100
    if (existing) {
      existing.count++
      existing.revenue += price
    } else {
      planMap.set(plan.slug, { slug: plan.slug, name: plan.name, price, count: 1, revenue: price })
    }
  }
  const planBreakdown = Array.from(planMap.values()).sort((a, b) => a.price - b.price)
  const mrr = planBreakdown.reduce((sum, p) => sum + p.revenue, 0)
  const avgPerContractor = activeSubs.length > 0 ? Math.round(mrr / activeSubs.length) : 0

  const planLabel = (slug: string): string => {
    const labels: Record<string, { en: string; he: string }> = {
      starter: { en: 'Starter', he: 'סטארטר' },
      pro: { en: 'Pro', he: 'פרו' },
      unlimited: { en: 'Unlimited', he: 'ללא הגבלה' },
    }
    return he ? (labels[slug]?.he ?? slug) : (labels[slug]?.en ?? slug)
  }

  const kpis = [
    {
      label: he ? 'הכנסה חודשית חוזרת' : 'MRR',
      value: `$${mrr.toLocaleString()}`,
      subtitle: he ? 'הכנסה חודשית חוזרת' : 'Monthly Recurring Revenue',
      icon: DollarSign,
    },
    {
      label: he ? 'מנויים פעילים' : 'Active Subscribers',
      value: activeSubs.length.toString(),
      subtitle: he ? `מתוך ${totalSubs} סה"כ` : `of ${totalSubs} total`,
      icon: Users,
    },
    {
      label: he ? 'הכנסה שנתית צפויה' : 'Projected ARR',
      value: `$${(mrr * 12).toLocaleString()}`,
      subtitle: he ? 'הכנסה שנתית צפויה' : 'Annual Recurring Revenue',
      icon: BarChart3,
    },
    {
      label: he ? 'ממוצע לקבלן' : 'Avg per Contractor',
      value: `$${avgPerContractor}`,
      subtitle: he ? 'ממוצע חודשי' : 'Monthly average',
      icon: TrendingUp,
    },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: '#5a8a5e' }} />
      </div>
    )
  }

  const totalPlanRevenue = planBreakdown.reduce((sum, p) => sum + p.revenue, 0)

  return (
    <div className="animate-fade-in space-y-8" style={{ fontFamily: 'Outfit, sans-serif' }}>
      {/* Header */}
      <header>
        <h1 className="text-3xl font-bold tracking-tight" style={{ color: '#2d3a2e' }}>
          {he ? 'הכנסות' : 'Revenue'}
        </h1>
        <p className="mt-1 text-sm" style={{ color: '#6b7c6e' }}>
          {he ? 'נתונים אמיתיים מ-Stripe' : 'Live data from Stripe'}
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
                  {he ? 'מנויים פעילים' : 'Active Subscribers'}
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
              {planBreakdown.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center" style={{ color: '#9ca89e' }}>
                    {he ? 'אין מנויים פעילים עדיין' : 'No active subscribers yet'}
                  </td>
                </tr>
              )}
              {planBreakdown.map((row) => (
                <tr key={row.slug} style={{ borderBottom: '1px solid #eef0ee' }} className="hover:bg-[#f5f7f5] transition-colors">
                  <td className="px-6 py-3.5 font-medium" style={{ color: '#2d3a2e' }}>
                    <span className="flex items-center gap-2">
                      <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: planColors[row.slug] || '#6b7c6e' }} />
                      {planLabel(row.slug)}
                    </span>
                  </td>
                  <td className="px-6 py-3.5" style={{ color: '#2d3a2e' }}>{row.count}</td>
                  <td className="px-6 py-3.5" style={{ color: '#2d3a2e' }}>${row.price}</td>
                  <td className="px-6 py-3.5 font-semibold" style={{ color: '#2d3a2e' }}>${row.revenue.toLocaleString()}</td>
                </tr>
              ))}
              {planBreakdown.length > 0 && (
                <tr style={{ borderTop: '2px solid #d0d4d0' }}>
                  <td className="px-6 py-3.5 font-bold" style={{ color: '#2d3a2e' }}>
                    {he ? 'סה"כ' : 'Total'}
                  </td>
                  <td className="px-6 py-3.5 font-bold" style={{ color: '#2d3a2e' }}>
                    {activeSubs.length}
                  </td>
                  <td className="px-6 py-3.5" style={{ color: '#9ca89e' }}>—</td>
                  <td className="px-6 py-3.5 font-bold" style={{ color: '#2d3a2e' }}>
                    ${mrr.toLocaleString()}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Revenue Split Visualization */}
      {planBreakdown.length > 0 && totalPlanRevenue > 0 && (
        <div className="glass-panel p-6">
          <h2 className="text-lg font-semibold mb-4" style={{ color: '#2d3a2e' }}>
            {he ? 'חלוקת הכנסות' : 'Revenue Split'}
          </h2>
          <div className="w-full h-10 rounded-xl overflow-hidden flex">
            {planBreakdown.map((row) => {
              const pct = (row.revenue / totalPlanRevenue) * 100
              return (
                <div
                  key={row.slug}
                  className="h-full transition-all duration-300 relative group"
                  style={{ width: `${pct}%`, backgroundColor: planColors[row.slug] || '#6b7c6e' }}
                  title={`${planLabel(row.slug)}: $${row.revenue.toLocaleString()} (${Math.round(pct)}%)`}
                />
              )
            })}
          </div>
          <div className="flex flex-wrap gap-5 mt-4">
            {planBreakdown.map((row) => {
              const pct = Math.round((row.revenue / totalPlanRevenue) * 100)
              return (
                <div key={row.slug} className="flex items-center gap-2">
                  <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: planColors[row.slug] || '#6b7c6e' }} />
                  <span className="text-sm font-medium" style={{ color: '#2d3a2e' }}>
                    {planLabel(row.slug)}
                  </span>
                  <span className="text-sm" style={{ color: '#6b7c6e' }}>
                    {pct}% (${row.revenue.toLocaleString()})
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
