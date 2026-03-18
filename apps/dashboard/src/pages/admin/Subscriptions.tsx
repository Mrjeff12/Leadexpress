import { Fragment, useState, useEffect } from 'react'
import { useI18n } from '../../lib/i18n'
import { supabase } from '../../lib/supabase'
import { CreditCard, Users, ChevronDown, ChevronUp, Search, Loader2, ExternalLink } from 'lucide-react'

type PlanSlug = 'starter' | 'pro' | 'unlimited'
type SubStatus = 'active' | 'past_due' | 'canceled' | 'trialing' | 'paused'

interface SubscriberRow {
  id: string
  name: string
  email: string
  plan: PlanSlug
  status: SubStatus
  fee: number
  joined: string
  current_period_end: string | null
  stripe_customer_id: string | null
}

const statusBadgeClass: Record<string, string> = {
  active: 'badge badge-green',
  trialing: 'badge badge-blue',
  past_due: 'badge badge-orange',
  canceled: 'badge badge-red',
  paused: 'badge badge-orange',
}

export default function Subscriptions() {
  const { locale } = useI18n()
  const he = locale === 'he'

  const [subscribers, setSubscribers] = useState<SubscriberRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [planFilter, setPlanFilter] = useState<PlanSlug | 'all'>('all')
  const [statusFilter, setStatusFilter] = useState<SubStatus | 'all'>('all')
  const [expandedRow, setExpandedRow] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from('subscriptions')
        .select(`
          id,
          status,
          created_at,
          current_period_end,
          stripe_customer_id,
          plans ( slug, name, price_cents ),
          profiles ( full_name, id )
        `)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Failed to load subscriptions:', error)
        setLoading(false)
        return
      }

      const rows: SubscriberRow[] = (data || []).map((row: any) => {
        const plan = row.plans as any
        const profile = row.profiles as any
        return {
          id: row.id,
          name: profile?.full_name || 'Unknown',
          email: '',
          plan: (plan?.slug || 'starter') as PlanSlug,
          status: (row.status || 'active') as SubStatus,
          fee: plan ? plan.price_cents / 100 : 0,
          joined: row.created_at ? new Date(row.created_at).toISOString().split('T')[0] : '',
          current_period_end: row.current_period_end,
          stripe_customer_id: row.stripe_customer_id,
        }
      })

      setSubscribers(rows)
      setLoading(false)
    }

    load()
  }, [])

  const planLabel = (plan: PlanSlug): string => {
    const labels: Record<PlanSlug, { en: string; he: string }> = {
      starter: { en: 'Starter', he: 'סטארטר' },
      pro: { en: 'Pro', he: 'פרו' },
      unlimited: { en: 'Unlimited', he: 'ללא הגבלה' },
    }
    return he ? labels[plan].he : labels[plan].en
  }

  const statusLabel = (status: SubStatus): string => {
    const labels: Record<SubStatus, { en: string; he: string }> = {
      active: { en: 'Active', he: 'פעיל' },
      trialing: { en: 'Trial', he: 'ניסיון' },
      past_due: { en: 'Past Due', he: 'באיחור' },
      canceled: { en: 'Canceled', he: 'מבוטל' },
      paused: { en: 'Paused', he: 'מושהה' },
    }
    return he ? labels[status].he : labels[status].en
  }

  const filtered = subscribers.filter((s) => {
    if (planFilter !== 'all' && s.plan !== planFilter) return false
    if (statusFilter !== 'all' && s.status !== statusFilter) return false
    if (search && !s.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const totalSubscribers = subscribers.length
  const activeCount = subscribers.filter((s) => s.status === 'active' || s.status === 'trialing').length
  const starterCount = subscribers.filter((s) => s.plan === 'starter').length
  const proCount = subscribers.filter((s) => s.plan === 'pro').length
  const unlimitedCount = subscribers.filter((s) => s.plan === 'unlimited').length

  const kpis = [
    { label: he ? 'סה"כ מנויים' : 'Total Subscribers', value: totalSubscribers, icon: Users },
    { label: he ? 'פעילים' : 'Active', value: activeCount, icon: CreditCard },
    { label: he ? 'מסלול פרו' : 'Pro Plan', value: proCount, icon: CreditCard },
    { label: he ? 'מסלול ללא הגבלה' : 'Unlimited Plan', value: unlimitedCount, icon: CreditCard },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: '#5a8a5e' }} />
      </div>
    )
  }

  return (
    <div className="animate-fade-in space-y-8" style={{ fontFamily: 'Outfit, sans-serif' }}>
      {/* Header */}
      <header>
        <h1 className="text-3xl font-bold tracking-tight" style={{ color: '#2d3a2e' }}>
          {he ? 'מנויים וחיובים' : 'Subscriptions & Billing'}
        </h1>
        <p className="mt-1 text-sm" style={{ color: '#6b7c6e' }}>
          {he ? 'נתונים אמיתיים מ-Stripe' : 'Live data from Stripe'}
        </p>
      </header>

      {/* KPI Summary Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 stagger-kpi">
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
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: '#9ca89e', left: he ? 'auto' : '0.75rem', right: he ? '0.75rem' : 'auto' }} />
          <input
            type="text"
            placeholder={he ? 'חיפוש לפי שם...' : 'Search by name...'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border text-sm py-2"
            style={{
              borderColor: '#e0e4e0',
              paddingLeft: he ? '0.75rem' : '2.25rem',
              paddingRight: he ? '2.25rem' : '0.75rem',
              color: '#2d3a2e',
              fontFamily: 'Outfit, sans-serif',
            }}
          />
        </div>

        <select
          value={planFilter}
          onChange={(e) => setPlanFilter(e.target.value as PlanSlug | 'all')}
          className="rounded-xl border text-sm py-2 px-3"
          style={{ borderColor: '#e0e4e0', color: '#2d3a2e', fontFamily: 'Outfit, sans-serif' }}
        >
          <option value="all">{he ? 'כל המסלולים' : 'All Plans'}</option>
          <option value="starter">{he ? 'סטארטר' : 'Starter'}</option>
          <option value="pro">{he ? 'פרו' : 'Pro'}</option>
          <option value="unlimited">{he ? 'ללא הגבלה' : 'Unlimited'}</option>
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as SubStatus | 'all')}
          className="rounded-xl border text-sm py-2 px-3"
          style={{ borderColor: '#e0e4e0', color: '#2d3a2e', fontFamily: 'Outfit, sans-serif' }}
        >
          <option value="all">{he ? 'כל הסטטוסים' : 'All Statuses'}</option>
          <option value="active">{he ? 'פעיל' : 'Active'}</option>
          <option value="trialing">{he ? 'ניסיון' : 'Trial'}</option>
          <option value="past_due">{he ? 'באיחור' : 'Past Due'}</option>
          <option value="canceled">{he ? 'מבוטל' : 'Canceled'}</option>
        </select>
      </div>

      {/* Table */}
      <div className="glass-panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm table-sticky">
            <thead>
              <tr style={{ borderBottom: '1px solid #e0e4e0' }}>
                <th className="text-left px-5 py-3 font-semibold text-xs uppercase tracking-wider" style={{ color: '#9ca89e' }}>
                  {he ? 'שם הקבלן' : 'Contractor Name'}
                </th>
                <th className="text-left px-5 py-3 font-semibold text-xs uppercase tracking-wider" style={{ color: '#9ca89e' }}>
                  {he ? 'מסלול' : 'Plan'}
                </th>
                <th className="text-left px-5 py-3 font-semibold text-xs uppercase tracking-wider" style={{ color: '#9ca89e' }}>
                  {he ? 'סטטוס' : 'Status'}
                </th>
                <th className="text-left px-5 py-3 font-semibold text-xs uppercase tracking-wider" style={{ color: '#9ca89e' }}>
                  {he ? 'תשלום חודשי' : 'Monthly Fee'}
                </th>
                <th className="text-left px-5 py-3 font-semibold text-xs uppercase tracking-wider" style={{ color: '#9ca89e' }}>
                  {he ? 'תאריך הצטרפות' : 'Joined'}
                </th>
                <th className="text-left px-5 py-3 font-semibold text-xs uppercase tracking-wider" style={{ color: '#9ca89e' }}>
                  {he ? 'סיום תקופה' : 'Period End'}
                </th>
                <th className="px-5 py-3 w-10" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((sub) => {
                const isExpanded = expandedRow === sub.id
                return (
                  <Fragment key={sub.id}>
                    <tr
                      className="cursor-pointer transition-colors hover:bg-[#f5f7f5]"
                      style={{ borderBottom: '1px solid #eef0ee' }}
                      onClick={() => setExpandedRow(isExpanded ? null : sub.id)}
                    >
                      <td className="px-5 py-3.5 font-medium" style={{ color: '#2d3a2e' }}>{sub.name}</td>
                      <td className="px-5 py-3.5">
                        <span className="badge badge-blue">{planLabel(sub.plan)}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={statusBadgeClass[sub.status] || 'badge'}>{statusLabel(sub.status)}</span>
                      </td>
                      <td className="px-5 py-3.5" style={{ color: '#2d3a2e' }}>
                        ${sub.fee}/mo
                      </td>
                      <td className="px-5 py-3.5" style={{ color: '#6b7c6e' }}>
                        {sub.joined}
                      </td>
                      <td className="px-5 py-3.5" style={{ color: '#6b7c6e' }}>
                        {sub.current_period_end ? new Date(sub.current_period_end).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-5 py-3.5">
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4" style={{ color: '#9ca89e' }} />
                        ) : (
                          <ChevronDown className="h-4 w-4" style={{ color: '#9ca89e' }} />
                        )}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr>
                        <td colSpan={7} className="px-5 py-4" style={{ backgroundColor: '#fafbfa' }}>
                          <div className="ml-2 space-y-2">
                            <p className="text-xs" style={{ color: '#6b7c6e' }}>
                              <strong>Stripe Customer:</strong>{' '}
                              {sub.stripe_customer_id ? (
                                <a
                                  href={`https://dashboard.stripe.com/customers/${sub.stripe_customer_id}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 underline"
                                  style={{ color: '#5a8a5e' }}
                                >
                                  {sub.stripe_customer_id}
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              ) : (
                                <span style={{ color: '#9ca89e' }}>No Stripe customer</span>
                              )}
                            </p>
                            <p className="text-xs" style={{ color: '#6b7c6e' }}>
                              <strong>{he ? 'מסלול:' : 'Plan:'}</strong> {planLabel(sub.plan)} — ${sub.fee}/mo
                            </p>
                            <p className="text-xs" style={{ color: '#6b7c6e' }}>
                              <strong>{he ? 'סטטוס:' : 'Status:'}</strong> {statusLabel(sub.status)}
                            </p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center" style={{ color: '#9ca89e' }}>
                    {he ? 'לא נמצאו מנויים' : 'No subscribers found'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
