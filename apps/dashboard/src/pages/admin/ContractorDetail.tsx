import { useParams, Link } from 'react-router-dom'
import { useI18n } from '../../lib/i18n'
import {
  ArrowLeft,
  Zap,
  Percent,
  DollarSign,
  Calendar,
  Mail,
  Phone,
  Send,
  MapPin,
  CreditCard,
} from 'lucide-react'

/* ───────────────────── Mock Data ───────────────────── */

const mockContractor = {
  id: 'demo-contractor-001',
  name: 'Carlos Mendez',
  email: 'carlos@example.com',
  phone: '+972-50-1234567',
  professions: ['HVAC'],
  plan: 'Pro' as const,
  planStatus: 'active' as const,
  fee: 149,
  joinedAt: '2025-11-01',
  telegramConnected: true,
  telegramChatId: 987654321,
  zipCodes: ['62000', '46000', '52000', '58000', '59000'],
}

const mockLeads = [
  { id: '847', profession: 'HVAC', city: 'Tel Aviv', urgency: 'hot' as const, status: 'claimed' as const, date: '2026-03-16' },
  { id: '843', profession: 'HVAC', city: 'Herzliya', urgency: 'warm' as const, status: 'sent' as const, date: '2026-03-15' },
  { id: '838', profession: 'HVAC', city: 'Ramat Gan', urgency: 'hot' as const, status: 'claimed' as const, date: '2026-03-14' },
  { id: '831', profession: 'HVAC', city: 'Holon', urgency: 'cold' as const, status: 'sent' as const, date: '2026-03-13' },
  { id: '825', profession: 'HVAC', city: 'Bat Yam', urgency: 'warm' as const, status: 'claimed' as const, date: '2026-03-12' },
]

const mockPayments = [
  { date: '2026-03-01', amount: 149, status: 'paid' as const, plan: 'Pro' },
  { date: '2026-02-01', amount: 149, status: 'paid' as const, plan: 'Pro' },
  { date: '2026-01-01', amount: 149, status: 'paid' as const, plan: 'Pro' },
  { date: '2025-12-01', amount: 149, status: 'paid' as const, plan: 'Pro' },
  { date: '2025-11-01', amount: 49, status: 'paid' as const, plan: 'Starter' },
]

const mockZips = ['62000', '46000', '52000', '58000', '59000']

/* ───────────────────── Badge Helpers ───────────────────── */

const urgencyBadge: Record<string, string> = {
  hot: 'badge badge-red',
  warm: 'badge badge-orange',
  cold: 'badge badge-blue',
}

const statusBadge: Record<string, string> = {
  sent: 'badge badge-green',
  claimed: 'badge badge-violet',
}

const planStatusBadge: Record<string, string> = {
  active: 'badge badge-green',
  past_due: 'badge badge-orange',
  cancelled: 'badge badge-red',
}

/* ───────────────────── Component ───────────────────── */

export default function ContractorDetail() {
  const { id } = useParams()
  const { locale } = useI18n()
  const he = locale === 'he'

  // In the future, fetch by id — for now use mock data
  const contractor = mockContractor
  void id

  const kpis = [
    { label: he ? 'לידים שהתקבלו' : 'Leads Received', value: '45', icon: Zap, gradient: 'from-amber-400 to-orange-500' },
    { label: he ? 'אחוז השלמה' : 'Completion Rate', value: '78%', icon: Percent, gradient: 'from-blue-400 to-indigo-500' },
    { label: he ? 'הכנסה שנוצרה' : 'Revenue Generated', value: '₪6,705', icon: DollarSign, gradient: 'from-emerald-400 to-green-500' },
    { label: he ? 'פעיל מאז' : 'Active Since', value: 'Nov 2025', icon: Calendar, gradient: 'from-violet-400 to-purple-500' },
  ]

  return (
    <div className="animate-fade-in space-y-8" style={{ fontFamily: 'Outfit, sans-serif' }}>
      {/* ════════ Header ════════ */}
      <header>
        <Link
          to="/admin/contractors"
          className="inline-flex items-center gap-1.5 text-sm font-medium mb-4 transition-colors hover:opacity-80"
          style={{ color: '#5a8a5e' }}
        >
          <ArrowLeft className="h-4 w-4" />
          {he ? 'חזרה לקבלנים' : 'Back to Contractors'}
        </Link>

        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight" style={{ color: '#2d3a2e' }}>
            {contractor.name}
          </h1>

          {/* Profession badges */}
          {contractor.professions.map((p) => (
            <span key={p} className="badge badge-blue">{p}</span>
          ))}

          {/* Plan + status badge */}
          <span className={planStatusBadge[contractor.planStatus]}>
            {contractor.plan} &middot; {he
              ? (contractor.planStatus === 'active' ? 'פעיל' : contractor.planStatus === 'past_due' ? 'באיחור' : 'מבוטל')
              : (contractor.planStatus === 'active' ? 'Active' : contractor.planStatus === 'past_due' ? 'Past Due' : 'Cancelled')
            }
          </span>
        </div>

        <p className="mt-1 text-sm" style={{ color: '#6b7c6e' }}>
          {he ? 'הצטרף ב-' : 'Joined '}{contractor.joinedAt}
        </p>
      </header>

      {/* ════════ 2-Column Grid ════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* ──── Left Column (2/3) ──── */}
        <div className="lg:col-span-2 space-y-8">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {kpis.map((kpi) => (
              <div key={kpi.label} className="glass-panel p-5">
                <div className="flex items-center gap-3">
                  <div
                    className={`flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br ${kpi.gradient}`}
                  >
                    <kpi.icon className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="text-xl font-bold" style={{ color: '#2d3a2e' }}>{kpi.value}</p>
                    <p className="text-xs font-medium" style={{ color: '#9ca89e' }}>{kpi.label}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Recent Leads Table */}
          <div className="glass-panel overflow-hidden">
            <div className="px-5 py-4" style={{ borderBottom: '1px solid #e0e4e0' }}>
              <h2 className="text-base font-bold flex items-center gap-2" style={{ color: '#2d3a2e' }}>
                <Send className="h-4 w-4" style={{ color: '#5a8a5e' }} />
                {he ? 'לידים אחרונים' : 'Recent Leads'}
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm table-sticky">
                <thead>
                  <tr style={{ borderBottom: '1px solid #e0e4e0' }}>
                    <th className="text-left px-5 py-3 font-semibold text-xs uppercase tracking-wider" style={{ color: '#9ca89e' }}>
                      {he ? 'ליד #' : 'Lead #'}
                    </th>
                    <th className="text-left px-5 py-3 font-semibold text-xs uppercase tracking-wider" style={{ color: '#9ca89e' }}>
                      {he ? 'מקצוע' : 'Profession'}
                    </th>
                    <th className="text-left px-5 py-3 font-semibold text-xs uppercase tracking-wider" style={{ color: '#9ca89e' }}>
                      {he ? 'עיר' : 'City'}
                    </th>
                    <th className="text-left px-5 py-3 font-semibold text-xs uppercase tracking-wider" style={{ color: '#9ca89e' }}>
                      {he ? 'דחיפות' : 'Urgency'}
                    </th>
                    <th className="text-left px-5 py-3 font-semibold text-xs uppercase tracking-wider" style={{ color: '#9ca89e' }}>
                      {he ? 'סטטוס' : 'Status'}
                    </th>
                    <th className="text-left px-5 py-3 font-semibold text-xs uppercase tracking-wider" style={{ color: '#9ca89e' }}>
                      {he ? 'תאריך' : 'Date'}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {mockLeads.map((lead) => (
                    <tr key={lead.id} className="transition-colors hover:bg-[#f5f7f5]" style={{ borderBottom: '1px solid #eef0ee' }}>
                      <td className="px-5 py-3.5 font-medium" style={{ color: '#2d3a2e' }}>#{lead.id}</td>
                      <td className="px-5 py-3.5" style={{ color: '#2d3a2e' }}>{lead.profession}</td>
                      <td className="px-5 py-3.5" style={{ color: '#6b7c6e' }}>{lead.city}</td>
                      <td className="px-5 py-3.5">
                        <span className={urgencyBadge[lead.urgency]}>{lead.urgency}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={statusBadge[lead.status]}>{lead.status}</span>
                      </td>
                      <td className="px-5 py-3.5" style={{ color: '#6b7c6e' }}>{lead.date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Payment History */}
          <div className="glass-panel overflow-hidden">
            <div className="px-5 py-4" style={{ borderBottom: '1px solid #e0e4e0' }}>
              <h2 className="text-base font-bold flex items-center gap-2" style={{ color: '#2d3a2e' }}>
                <CreditCard className="h-4 w-4" style={{ color: '#5a8a5e' }} />
                {he ? 'היסטוריית תשלומים' : 'Payment History'}
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm table-sticky">
                <thead>
                  <tr style={{ borderBottom: '1px solid #e0e4e0' }}>
                    <th className="text-left px-5 py-3 font-semibold text-xs uppercase tracking-wider" style={{ color: '#9ca89e' }}>
                      {he ? 'תאריך' : 'Date'}
                    </th>
                    <th className="text-left px-5 py-3 font-semibold text-xs uppercase tracking-wider" style={{ color: '#9ca89e' }}>
                      {he ? 'סכום' : 'Amount'}
                    </th>
                    <th className="text-left px-5 py-3 font-semibold text-xs uppercase tracking-wider" style={{ color: '#9ca89e' }}>
                      {he ? 'סטטוס' : 'Status'}
                    </th>
                    <th className="text-left px-5 py-3 font-semibold text-xs uppercase tracking-wider" style={{ color: '#9ca89e' }}>
                      {he ? 'מסלול' : 'Plan'}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {mockPayments.map((payment, idx) => (
                    <tr key={idx} className="transition-colors hover:bg-[#f5f7f5]" style={{ borderBottom: '1px solid #eef0ee' }}>
                      <td className="px-5 py-3.5" style={{ color: '#6b7c6e' }}>{payment.date}</td>
                      <td className="px-5 py-3.5 font-medium" style={{ color: '#2d3a2e' }}>{'\u20AA'}{payment.amount}</td>
                      <td className="px-5 py-3.5">
                        <span className="badge badge-green">{payment.status}</span>
                      </td>
                      <td className="px-5 py-3.5" style={{ color: '#2d3a2e' }}>{payment.plan}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ──── Right Column (1/3) ──── */}
        <div className="space-y-8">
          {/* Contractor Info Card */}
          <div className="glass-panel p-5 space-y-4">
            <h2 className="text-base font-bold" style={{ color: '#2d3a2e' }}>
              {he ? 'פרטי קבלן' : 'Contractor Info'}
            </h2>

            <div className="space-y-3">
              {/* Email */}
              <div className="flex items-center gap-3">
                <div
                  className="flex items-center justify-center w-8 h-8 rounded-lg"
                  style={{ backgroundColor: 'rgba(90,138,94,0.1)' }}
                >
                  <Mail className="h-4 w-4" style={{ color: '#5a8a5e' }} />
                </div>
                <div>
                  <p className="text-xs font-medium" style={{ color: '#9ca89e' }}>{he ? 'אימייל' : 'Email'}</p>
                  <p className="text-sm font-medium" style={{ color: '#2d3a2e' }}>{contractor.email}</p>
                </div>
              </div>

              {/* Phone */}
              <div className="flex items-center gap-3">
                <div
                  className="flex items-center justify-center w-8 h-8 rounded-lg"
                  style={{ backgroundColor: 'rgba(90,138,94,0.1)' }}
                >
                  <Phone className="h-4 w-4" style={{ color: '#5a8a5e' }} />
                </div>
                <div>
                  <p className="text-xs font-medium" style={{ color: '#9ca89e' }}>{he ? 'טלפון' : 'Phone'}</p>
                  <p className="text-sm font-medium" style={{ color: '#2d3a2e' }}>{contractor.phone}</p>
                </div>
              </div>

              {/* Telegram Status */}
              <div className="flex items-center gap-3">
                <div
                  className="flex items-center justify-center w-8 h-8 rounded-lg"
                  style={{ backgroundColor: 'rgba(90,138,94,0.1)' }}
                >
                  <Send className="h-4 w-4" style={{ color: '#5a8a5e' }} />
                </div>
                <div>
                  <p className="text-xs font-medium" style={{ color: '#9ca89e' }}>Telegram</p>
                  <span className={contractor.telegramConnected ? 'badge badge-green' : 'badge'} style={contractor.telegramConnected ? undefined : { backgroundColor: '#f0f0f0', color: '#999' }}>
                    {contractor.telegramConnected
                      ? (he ? 'מחובר' : 'Connected')
                      : (he ? 'לא מחובר' : 'Not Connected')
                    }
                  </span>
                </div>
              </div>

              {/* Telegram Chat ID */}
              {contractor.telegramChatId && (
                <div className="flex items-center gap-3">
                  <div
                    className="flex items-center justify-center w-8 h-8 rounded-lg"
                    style={{ backgroundColor: 'rgba(90,138,94,0.1)' }}
                  >
                    <Send className="h-4 w-4" style={{ color: '#5a8a5e' }} />
                  </div>
                  <div>
                    <p className="text-xs font-medium" style={{ color: '#9ca89e' }}>
                      {he ? 'מזהה צ\'אט טלגרם' : 'Telegram Chat ID'}
                    </p>
                    <p className="text-sm font-medium font-mono" style={{ color: '#2d3a2e' }}>
                      {contractor.telegramChatId}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Service Areas */}
          <div className="glass-panel p-5">
            <h2 className="text-base font-bold flex items-center gap-2 mb-4" style={{ color: '#2d3a2e' }}>
              <MapPin className="h-4 w-4" style={{ color: '#5a8a5e' }} />
              {he ? 'אזורי שירות' : 'Service Areas'}
            </h2>
            <div className="flex flex-wrap gap-2">
              {mockZips.map((zip) => (
                <span
                  key={zip}
                  className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium"
                  style={{ backgroundColor: 'rgba(90,138,94,0.1)', color: '#5a8a5e' }}
                >
                  {zip}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
