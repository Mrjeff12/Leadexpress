import { useState, useEffect, useMemo } from 'react'
import { useI18n } from '../../lib/i18n'
import { supabase } from '../../lib/supabase'
import { DollarSign, TrendingUp, BarChart3, Users, ArrowUpRight } from 'lucide-react'

interface SubRow {
  status: string
  created_at: string
  plans: { slug: string; name: string; price_cents: number } | null
}

const PLAN_COLORS: Record<string, { fill: string; bg: string; ring: string }> = {
  starter: { fill: '#3b82f6', bg: 'rgba(59,130,246,0.08)', ring: 'rgba(59,130,246,0.15)' },
  pro: { fill: '#f59e0b', bg: 'rgba(245,158,11,0.08)', ring: 'rgba(245,158,11,0.15)' },
  unlimited: { fill: '#8b5cf6', bg: 'rgba(139,92,246,0.08)', ring: 'rgba(139,92,246,0.15)' },
}

// ── Donut ring chart ───────────────────────────────────
function DonutChart({ segments, size = 200 }: {
  segments: { slug: string; pct: number; revenue: number }[]
  size?: number
}) {
  const r = (size - 32) / 2
  const cx = size / 2
  const cy = size / 2
  const circumference = 2 * Math.PI * r
  let offset = -circumference * 0.25 // start at 12 o'clock

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="drop-shadow-sm">
      {/* Background track */}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(0,0,0,0.04)" strokeWidth="20" />
      {segments.map((seg) => {
        const dashLen = (seg.pct / 100) * circumference
        const gap = circumference - dashLen
        const el = (
          <circle
            key={seg.slug}
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke={PLAN_COLORS[seg.slug]?.fill || '#9ca3af'}
            strokeWidth="20"
            strokeDasharray={`${dashLen} ${gap}`}
            strokeDashoffset={-offset}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
            style={{ filter: `drop-shadow(0 2px 4px ${PLAN_COLORS[seg.slug]?.ring || 'rgba(0,0,0,0.1)'})` }}
          />
        )
        offset += dashLen
        return el
      })}
    </svg>
  )
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
      if (error) { console.error('Failed to load revenue data:', error); setLoading(false); return }
      setSubs((data || []) as unknown as SubRow[])
      setLoading(false)
    }
    load()
  }, [])

  const { activeSubs, totalSubs, planBreakdown, mrr, avgPerContractor, segments } = useMemo(() => {
    const active = subs.filter((s) => s.status === 'active' || s.status === 'trialing')
    const planMap = new Map<string, { slug: string; name: string; price: number; count: number; revenue: number }>()
    for (const s of active) {
      const plan = s.plans
      if (!plan) continue
      const price = plan.price_cents / 100
      const existing = planMap.get(plan.slug)
      if (existing) { existing.count++; existing.revenue += price }
      else planMap.set(plan.slug, { slug: plan.slug, name: plan.name, price, count: 1, revenue: price })
    }
    const breakdown = Array.from(planMap.values()).sort((a, b) => a.price - b.price)
    const totalRev = breakdown.reduce((sum, p) => sum + p.revenue, 0)
    const segs = breakdown.map((p) => ({
      slug: p.slug,
      pct: totalRev > 0 ? (p.revenue / totalRev) * 100 : 0,
      revenue: p.revenue,
    }))
    return {
      activeSubs: active,
      totalSubs: subs.length,
      planBreakdown: breakdown,
      mrr: totalRev,
      avgPerContractor: active.length > 0 ? Math.round(totalRev / active.length) : 0,
      segments: segs,
    }
  }, [subs])

  const planLabel = (slug: string): string => {
    const labels: Record<string, { en: string; he: string }> = {
      starter: { en: 'Starter', he: 'סטארטר' },
      pro: { en: 'Pro', he: 'פרו' },
      unlimited: { en: 'Unlimited', he: 'ללא הגבלה' },
    }
    return he ? (labels[slug]?.he ?? slug) : (labels[slug]?.en ?? slug)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="flex flex-col items-center gap-3">
          <div className="relative w-10 h-10">
            <div className="absolute inset-0 border-2 rounded-full" style={{ borderColor: 'rgba(245,158,11,0.15)' }} />
            <div className="absolute inset-0 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#f59e0b', borderTopColor: 'transparent' }} />
          </div>
          <span className="text-[10px] uppercase tracking-[0.15em]" style={{ color: '#9ca89e' }}>Loading revenue...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="animate-fade-in space-y-6" style={{ fontFamily: 'Outfit, sans-serif' }}>
      {/* ═══ Hero MRR Card ═══ */}
      <div
        className="relative overflow-hidden rounded-[28px] p-8"
        style={{
          background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 30%, #fbbf24 70%, #f59e0b 100%)',
          boxShadow: '0 8px 32px rgba(245,158,11,0.2), inset 0 1px 0 rgba(255,255,255,0.4)',
        }}
      >
        {/* Decorative circles */}
        <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full" style={{ background: 'rgba(255,255,255,0.12)' }} />
        <div className="absolute -bottom-10 -left-10 w-40 h-40 rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }} />

        <div className="relative flex items-start justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] mb-2" style={{ color: 'rgba(120,53,0,0.6)' }}>
              {he ? 'הכנסה חודשית חוזרת' : 'Monthly Recurring Revenue'}
            </p>
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-extrabold tracking-tight" style={{ color: '#78350f' }}>
                ${mrr.toLocaleString()}
              </span>
              <span className="text-lg font-medium" style={{ color: 'rgba(120,53,0,0.5)' }}>/mo</span>
            </div>
            <div className="flex items-center gap-1.5 mt-3">
              <div className="flex items-center gap-1 rounded-full px-2.5 py-1" style={{ background: 'rgba(120,53,0,0.12)' }}>
                <ArrowUpRight className="w-3.5 h-3.5" style={{ color: '#78350f' }} />
                <span className="text-xs font-bold" style={{ color: '#78350f' }}>
                  ${(mrr * 12).toLocaleString()}
                </span>
              </div>
              <span className="text-xs font-medium" style={{ color: 'rgba(120,53,0,0.5)' }}>
                {he ? 'צפי שנתי' : 'projected ARR'}
              </span>
            </div>
          </div>

          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.3)', backdropFilter: 'blur(12px)' }}
          >
            <DollarSign className="w-7 h-7" style={{ color: '#78350f' }} />
          </div>
        </div>
      </div>

      {/* ═══ Metric Pills ═══ */}
      <div className="grid grid-cols-3 gap-3 stagger-children">
        {[
          {
            icon: Users,
            value: activeSubs.length.toString(),
            label: he ? 'מנויים פעילים' : 'Active',
            sub: he ? `מתוך ${totalSubs}` : `of ${totalSubs}`,
          },
          {
            icon: BarChart3,
            value: `$${(mrr * 12).toLocaleString()}`,
            label: he ? 'ARR' : 'ARR',
            sub: he ? 'שנתי' : 'Annual',
          },
          {
            icon: TrendingUp,
            value: `$${avgPerContractor}`,
            label: he ? 'ממוצע' : 'Avg',
            sub: he ? 'לקבלן' : '/contractor',
          },
        ].map((m) => (
          <div key={m.label} className="glass-panel p-5 flex flex-col items-center text-center gap-2">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(245,158,11,0.08)' }}
            >
              <m.icon className="w-5 h-5" style={{ color: '#f59e0b' }} />
            </div>
            <div>
              <p className="text-2xl font-extrabold tracking-tight" style={{ color: '#1a1a1a' }}>{m.value}</p>
              <p className="text-[11px] font-semibold mt-0.5" style={{ color: '#9ca89e' }}>{m.label} <span style={{ color: '#c4c4c4' }}>{m.sub}</span></p>
            </div>
          </div>
        ))}
      </div>

      {/* ═══ Plan Breakdown — Donut + Table ═══ */}
      <div className="glass-panel overflow-hidden">
        <div className="p-6 pb-0">
          <h2 className="text-lg font-bold tracking-tight" style={{ color: '#1a1a1a' }}>
            {he ? 'פירוט לפי מסלול' : 'Plan Breakdown'}
          </h2>
          <p className="text-xs mt-0.5" style={{ color: '#9ca89e' }}>
            {he ? 'חלוקת הכנסות לפי תכנית' : 'Revenue distribution by plan'}
          </p>
        </div>

        {planBreakdown.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="text-sm" style={{ color: '#9ca89e' }}>{he ? 'אין מנויים פעילים עדיין' : 'No active subscribers yet'}</p>
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row items-center gap-6 p-6">
            {/* Donut chart */}
            <div className="relative shrink-0">
              <DonutChart segments={segments} size={200} />
              {/* Center label */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-2xl font-extrabold tracking-tight" style={{ color: '#1a1a1a' }}>
                  {activeSubs.length}
                </span>
                <span className="text-[10px] uppercase tracking-[0.1em] font-semibold" style={{ color: '#9ca89e' }}>
                  {he ? 'מנויים' : 'Active'}
                </span>
              </div>
            </div>

            {/* Plan rows */}
            <div className="flex-1 w-full space-y-3">
              {planBreakdown.map((row) => {
                const pct = mrr > 0 ? Math.round((row.revenue / mrr) * 100) : 0
                const colors = PLAN_COLORS[row.slug] || { fill: '#9ca3af', bg: 'rgba(156,163,175,0.08)', ring: 'rgba(156,163,175,0.15)' }
                return (
                  <div
                    key={row.slug}
                    className="flex items-center gap-4 rounded-2xl p-4 transition-all duration-200 hover:scale-[1.01]"
                    style={{ background: colors.bg }}
                  >
                    {/* Color dot + name */}
                    <div className="flex items-center gap-3 min-w-[120px]">
                      <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: colors.fill, boxShadow: `0 0 8px ${colors.ring}` }} />
                      <span className="text-sm font-semibold" style={{ color: '#1a1a1a' }}>
                        {planLabel(row.slug)}
                      </span>
                    </div>

                    {/* Progress bar */}
                    <div className="flex-1 h-2.5 rounded-full overflow-hidden" style={{ background: 'rgba(0,0,0,0.04)' }}>
                      <div
                        className="h-full rounded-full transition-all duration-1000 ease-out"
                        style={{ width: `${pct}%`, backgroundColor: colors.fill }}
                      />
                    </div>

                    {/* Stats */}
                    <div className="flex items-center gap-4 shrink-0">
                      <div className="text-right">
                        <span className="text-sm font-bold" style={{ color: '#1a1a1a' }}>${row.revenue.toLocaleString()}</span>
                        <span className="text-[11px] ml-1" style={{ color: '#9ca89e' }}>{pct}%</span>
                      </div>
                      <div
                        className="rounded-lg px-2 py-0.5 text-[11px] font-bold"
                        style={{ background: colors.bg, color: colors.fill }}
                      >
                        {row.count} {he ? 'מנויים' : row.count === 1 ? 'sub' : 'subs'}
                      </div>
                    </div>
                  </div>
                )
              })}

              {/* Total row */}
              <div className="flex items-center justify-between rounded-2xl px-4 py-3 mt-1" style={{ background: 'rgba(0,0,0,0.02)', borderTop: '1px solid rgba(0,0,0,0.04)' }}>
                <span className="text-sm font-bold" style={{ color: '#1a1a1a' }}>{he ? 'סה"כ' : 'Total'}</span>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-extrabold" style={{ color: '#1a1a1a' }}>${mrr.toLocaleString()}/mo</span>
                  <span className="text-[11px] font-semibold rounded-lg px-2 py-0.5" style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b' }}>
                    {activeSubs.length} {he ? 'מנויים' : 'subscribers'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ═══ Price per Plan Cards ═══ */}
      {planBreakdown.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 stagger-children">
          {planBreakdown.map((row) => {
            const colors = PLAN_COLORS[row.slug] || { fill: '#9ca3af', bg: 'rgba(156,163,175,0.08)', ring: 'rgba(156,163,175,0.15)' }
            return (
              <div
                key={row.slug}
                className="glass-panel p-5 relative overflow-hidden"
              >
                {/* Accent bar at top */}
                <div className="absolute top-0 left-0 right-0 h-1 rounded-t-[24px]" style={{ background: colors.fill }} />
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold uppercase tracking-[0.1em]" style={{ color: colors.fill }}>
                    {planLabel(row.slug)}
                  </span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: colors.bg, color: colors.fill }}>
                    {row.count} {he ? 'פעילים' : 'active'}
                  </span>
                </div>
                <p className="text-3xl font-extrabold tracking-tight" style={{ color: '#1a1a1a' }}>
                  ${row.price}
                </p>
                <p className="text-xs mt-0.5" style={{ color: '#9ca89e' }}>
                  {he ? 'לחודש לקבלן' : 'per month / contractor'}
                </p>
                <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${colors.ring}` }}>
                  <p className="text-sm font-bold" style={{ color: '#1a1a1a' }}>
                    ${row.revenue.toLocaleString()}<span className="text-xs font-normal ml-1" style={{ color: '#9ca89e' }}>/mo</span>
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
