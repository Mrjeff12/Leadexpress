import { Fragment, useState } from 'react'
import { useI18n } from '../../lib/i18n'
import { CreditCard, Users, ChevronDown, ChevronUp, Search } from 'lucide-react'

type PlanType = 'starter' | 'pro' | 'unlimited'
type SubStatus = 'active' | 'past_due' | 'cancelled'
type PaymentStatus = 'paid' | 'failed' | 'refunded'

interface Payment {
  date: string
  amount: number
  status: PaymentStatus
}

interface Subscriber {
  id: string
  name: string
  plan: PlanType
  status: SubStatus
  fee: number
  joined: string
  payments: Payment[]
}

const mockSubscribers: Subscriber[] = [
  { id: '1', name: 'Carlos Mendez', plan: 'pro', status: 'active', fee: 149, joined: '2025-11-01', payments: [
    { date: '2026-03-01', amount: 149, status: 'paid' },
    { date: '2026-02-01', amount: 149, status: 'paid' },
    { date: '2026-01-01', amount: 149, status: 'paid' },
  ]},
  { id: '2', name: 'Sarah Cohen', plan: 'unlimited', status: 'active', fee: 299, joined: '2025-09-15', payments: [
    { date: '2026-03-01', amount: 299, status: 'paid' },
    { date: '2026-02-01', amount: 299, status: 'paid' },
  ]},
  { id: '3', name: 'Mike Johnson', plan: 'starter', status: 'past_due', fee: 49, joined: '2026-01-10', payments: [
    { date: '2026-03-01', amount: 49, status: 'failed' },
    { date: '2026-02-01', amount: 49, status: 'paid' },
  ]},
  { id: '4', name: 'David Levy', plan: 'pro', status: 'cancelled', fee: 0, joined: '2025-12-01', payments: [
    { date: '2026-02-01', amount: 149, status: 'refunded' },
    { date: '2026-01-01', amount: 149, status: 'paid' },
  ]},
  { id: '5', name: 'Rachel Stern', plan: 'starter', status: 'active', fee: 49, joined: '2026-02-20', payments: [
    { date: '2026-03-01', amount: 49, status: 'paid' },
  ]},
  { id: '6', name: 'Tom Baker', plan: 'pro', status: 'active', fee: 149, joined: '2025-10-05', payments: [
    { date: '2026-03-01', amount: 149, status: 'paid' },
    { date: '2026-02-01', amount: 149, status: 'paid' },
  ]},
]

const statusBadgeClass: Record<SubStatus, string> = {
  active: 'badge badge-green',
  past_due: 'badge badge-orange',
  cancelled: 'badge badge-red',
}

const paymentBadgeClass: Record<PaymentStatus, string> = {
  paid: 'badge badge-green',
  failed: 'badge badge-red',
  refunded: 'badge badge-orange',
}

export default function Subscriptions() {
  const { locale } = useI18n()
  const he = locale === 'he'

  const [search, setSearch] = useState('')
  const [planFilter, setPlanFilter] = useState<PlanType | 'all'>('all')
  const [statusFilter, setStatusFilter] = useState<SubStatus | 'all'>('all')
  const [expandedRow, setExpandedRow] = useState<string | null>(null)

  const planLabel = (plan: PlanType): string => {
    const labels: Record<PlanType, { en: string; he: string }> = {
      starter: { en: 'Starter', he: 'סטארטר' },
      pro: { en: 'Pro', he: 'פרו' },
      unlimited: { en: 'Unlimited', he: 'ללא הגבלה' },
    }
    return he ? labels[plan].he : labels[plan].en
  }

  const statusLabel = (status: SubStatus): string => {
    const labels: Record<SubStatus, { en: string; he: string }> = {
      active: { en: 'Active', he: 'פעיל' },
      past_due: { en: 'Past Due', he: 'באיחור' },
      cancelled: { en: 'Cancelled', he: 'מבוטל' },
    }
    return he ? labels[status].he : labels[status].en
  }

  const paymentStatusLabel = (status: PaymentStatus): string => {
    const labels: Record<PaymentStatus, { en: string; he: string }> = {
      paid: { en: 'Paid', he: 'שולם' },
      failed: { en: 'Failed', he: 'נכשל' },
      refunded: { en: 'Refunded', he: 'הוחזר' },
    }
    return he ? labels[status].he : labels[status].en
  }

  const filtered = mockSubscribers.filter((s) => {
    if (planFilter !== 'all' && s.plan !== planFilter) return false
    if (statusFilter !== 'all' && s.status !== statusFilter) return false
    if (search && !s.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const totalSubscribers = mockSubscribers.length
  const starterCount = mockSubscribers.filter((s) => s.plan === 'starter').length
  const proCount = mockSubscribers.filter((s) => s.plan === 'pro').length
  const unlimitedCount = mockSubscribers.filter((s) => s.plan === 'unlimited').length

  const kpis = [
    { label: he ? 'סה"כ מנויים' : 'Total Subscribers', value: totalSubscribers, icon: Users },
    { label: he ? 'מסלול סטארטר' : 'Starter Plan', value: starterCount, icon: CreditCard },
    { label: he ? 'מסלול פרו' : 'Pro Plan', value: proCount, icon: CreditCard },
    { label: he ? 'מסלול ללא הגבלה' : 'Unlimited Plan', value: unlimitedCount, icon: CreditCard },
  ]

  return (
    <div className="animate-fade-in space-y-8" style={{ fontFamily: 'Outfit, sans-serif' }}>
      {/* Header */}
      <header>
        <h1 className="text-3xl font-bold tracking-tight" style={{ color: '#2d3a2e' }}>
          {he ? 'מנויים וחיובים' : 'Subscriptions & Billing'}
        </h1>
        <p className="mt-1 text-sm" style={{ color: '#6b7c6e' }}>
          {he ? 'ניהול מנויים ותשלומים' : 'Manage contractor plans and payments'}
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
        {/* Search */}
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

        {/* Plan filter */}
        <select
          value={planFilter}
          onChange={(e) => setPlanFilter(e.target.value as PlanType | 'all')}
          className="rounded-xl border text-sm py-2 px-3"
          style={{ borderColor: '#e0e4e0', color: '#2d3a2e', fontFamily: 'Outfit, sans-serif' }}
        >
          <option value="all">{he ? 'כל המסלולים' : 'All Plans'}</option>
          <option value="starter">{he ? 'סטארטר' : 'Starter'}</option>
          <option value="pro">{he ? 'פרו' : 'Pro'}</option>
          <option value="unlimited">{he ? 'ללא הגבלה' : 'Unlimited'}</option>
        </select>

        {/* Status filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as SubStatus | 'all')}
          className="rounded-xl border text-sm py-2 px-3"
          style={{ borderColor: '#e0e4e0', color: '#2d3a2e', fontFamily: 'Outfit, sans-serif' }}
        >
          <option value="all">{he ? 'כל הסטטוסים' : 'All Statuses'}</option>
          <option value="active">{he ? 'פעיל' : 'Active'}</option>
          <option value="past_due">{he ? 'באיחור' : 'Past Due'}</option>
          <option value="cancelled">{he ? 'מבוטל' : 'Cancelled'}</option>
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
                  {he ? 'תאריך הצטרפות' : 'Joined Date'}
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
                        <span className={statusBadgeClass[sub.status]}>{statusLabel(sub.status)}</span>
                      </td>
                      <td className="px-5 py-3.5" style={{ color: '#2d3a2e' }}>
                        ${sub.fee}
                      </td>
                      <td className="px-5 py-3.5" style={{ color: '#6b7c6e' }}>
                        {sub.joined}
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
                        <td colSpan={6} className="px-5 py-4" style={{ backgroundColor: '#fafbfa' }}>
                          <div className="ml-2">
                            <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#9ca89e' }}>
                              {he ? 'היסטוריית תשלומים' : 'Payment History'}
                            </p>
                            <table className="w-full text-sm">
                              <thead>
                                <tr style={{ borderBottom: '1px solid #e8eae8' }}>
                                  <th className="text-left pb-2 text-xs font-medium" style={{ color: '#9ca89e' }}>
                                    {he ? 'תאריך' : 'Date'}
                                  </th>
                                  <th className="text-left pb-2 text-xs font-medium" style={{ color: '#9ca89e' }}>
                                    {he ? 'סכום' : 'Amount'}
                                  </th>
                                  <th className="text-left pb-2 text-xs font-medium" style={{ color: '#9ca89e' }}>
                                    {he ? 'סטטוס' : 'Status'}
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {sub.payments.map((p, idx) => (
                                  <tr key={idx} style={{ borderBottom: '1px solid #f0f2f0' }}>
                                    <td className="py-2" style={{ color: '#6b7c6e' }}>{p.date}</td>
                                    <td className="py-2" style={{ color: '#2d3a2e' }}>${p.amount}</td>
                                    <td className="py-2">
                                      <span className={paymentBadgeClass[p.status]}>
                                        {paymentStatusLabel(p.status)}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center" style={{ color: '#9ca89e' }}>
                    {he ? 'לא נמצאו תוצאות' : 'No results found'}
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
