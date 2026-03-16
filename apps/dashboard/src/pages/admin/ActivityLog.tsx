import { useState, useMemo } from 'react'
import { useI18n } from '../../lib/i18n'
import {
  LogIn,
  Zap,
  UserCheck,
  UserPlus,
  CreditCard,
  Settings,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'

/* ─── Event Types ─── */
type EventType =
  | 'login'
  | 'lead_created'
  | 'lead_assigned'
  | 'contractor_registered'
  | 'payment_received'
  | 'settings_changed'

const eventTypes: Record<
  EventType,
  { icon: typeof LogIn; color: string; label: string; labelHe: string }
> = {
  login: { icon: LogIn, color: '#6b7c6e', label: 'Login', labelHe: 'התחברות' },
  lead_created: { icon: Zap, color: '#c97d3a', label: 'Lead Created', labelHe: 'ליד חדש' },
  lead_assigned: { icon: UserCheck, color: '#5a8a5e', label: 'Lead Assigned', labelHe: 'ליד שויך' },
  contractor_registered: { icon: UserPlus, color: '#3b82f6', label: 'Contractor Registered', labelHe: 'קבלן נרשם' },
  payment_received: { icon: CreditCard, color: '#22c55e', label: 'Payment Received', labelHe: 'תשלום התקבל' },
  settings_changed: { icon: Settings, color: '#8b5cf6', label: 'Settings Changed', labelHe: 'הגדרות שונו' },
}

/* ─── Mock Data ─── */
interface ActivityEvent {
  id: string
  type: EventType
  user: string
  description: string
  timestamp: string
  details: string
}

const mockEvents: ActivityEvent[] = [
  { id: '1', type: 'lead_created', user: 'System', description: 'New HVAC lead parsed from WhatsApp group', timestamp: '2026-03-16T14:32:00', details: 'Lead #847 - Tel Aviv, Hot urgency' },
  { id: '2', type: 'lead_assigned', user: 'System', description: 'Lead assigned to Carlos Mendez', timestamp: '2026-03-16T14:32:05', details: 'Lead #847 → Carlos Mendez (HVAC, ZIP 62000)' },
  { id: '3', type: 'login', user: 'Jeff (Admin)', description: 'Admin login', timestamp: '2026-03-16T14:00:00', details: 'IP: 192.168.1.1' },
  { id: '4', type: 'payment_received', user: 'Sarah Cohen', description: 'Monthly subscription payment', timestamp: '2026-03-16T12:00:00', details: '₪299 - Unlimited Plan' },
  { id: '5', type: 'contractor_registered', user: 'Mike Johnson', description: 'New contractor registered', timestamp: '2026-03-16T10:30:00', details: 'Profession: Fencing, ZIP: 46000' },
  { id: '6', type: 'settings_changed', user: 'Jeff (Admin)', description: 'Updated profession list', timestamp: '2026-03-16T09:15:00', details: 'Added "Pool Maintenance" profession' },
  { id: '7', type: 'lead_created', user: 'System', description: 'New Renovation lead parsed', timestamp: '2026-03-15T18:45:00', details: 'Lead #846 - Haifa, Warm urgency' },
  { id: '8', type: 'payment_received', user: 'Tom Baker', description: 'Monthly subscription payment', timestamp: '2026-03-15T12:00:00', details: '₪149 - Pro Plan' },
  { id: '9', type: 'login', user: 'Carlos Mendez', description: 'Contractor login', timestamp: '2026-03-15T08:22:00', details: 'Mobile device' },
  { id: '10', type: 'lead_assigned', user: 'System', description: 'Lead assigned to Rachel Stern', timestamp: '2026-03-14T16:10:00', details: 'Lead #845 → Rachel Stern (Cleaning, ZIP 48000)' },
  { id: '11', type: 'lead_created', user: 'System', description: 'New Cleaning lead parsed', timestamp: '2026-03-14T15:00:00', details: 'Lead #844 - Netanya, Cold urgency' },
  { id: '12', type: 'login', user: 'Sarah Cohen', description: 'Contractor login', timestamp: '2026-03-14T10:00:00', details: 'Desktop browser' },
  { id: '13', type: 'contractor_registered', user: 'David Levy', description: 'New contractor registered', timestamp: '2026-03-13T14:30:00', details: 'Profession: HVAC, ZIP: 62000' },
  { id: '14', type: 'settings_changed', user: 'Jeff (Admin)', description: 'Updated WhatsApp connection', timestamp: '2026-03-13T09:00:00', details: 'Reconnected group "HVAC Pros IL"' },
  { id: '15', type: 'payment_received', user: 'Carlos Mendez', description: 'Monthly subscription payment', timestamp: '2026-03-13T08:00:00', details: '₪149 - Pro Plan' },
  { id: '16', type: 'lead_created', user: 'System', description: 'New Fencing lead parsed from WhatsApp group', timestamp: '2026-03-12T17:20:00', details: 'Lead #843 - Herzliya, Hot urgency' },
  { id: '17', type: 'lead_assigned', user: 'System', description: 'Lead assigned to Mike Johnson', timestamp: '2026-03-12T17:20:08', details: 'Lead #843 → Mike Johnson (Fencing, ZIP 46000)' },
  { id: '18', type: 'login', user: 'Tom Baker', description: 'Contractor login', timestamp: '2026-03-12T09:05:00', details: 'Desktop browser' },
  { id: '19', type: 'payment_received', user: 'David Levy', description: 'Monthly subscription payment', timestamp: '2026-03-12T08:00:00', details: '₪99 - Starter Plan' },
  { id: '20', type: 'settings_changed', user: 'Jeff (Admin)', description: 'Updated system notification settings', timestamp: '2026-03-11T16:45:00', details: 'Email notifications enabled for new signups' },
  { id: '21', type: 'contractor_registered', user: 'Noa Peretz', description: 'New contractor registered', timestamp: '2026-03-11T11:00:00', details: 'Profession: Renovation, ZIP: 52000' },
  { id: '22', type: 'lead_created', user: 'System', description: 'New HVAC lead parsed', timestamp: '2026-03-11T10:15:00', details: 'Lead #842 - Rishon LeZion, Warm urgency' },
  { id: '23', type: 'login', user: 'Jeff (Admin)', description: 'Admin login', timestamp: '2026-03-11T08:30:00', details: 'IP: 192.168.1.1' },
  { id: '24', type: 'lead_assigned', user: 'System', description: 'Lead assigned to Noa Peretz', timestamp: '2026-03-10T14:50:00', details: 'Lead #841 → Noa Peretz (Renovation, ZIP 52000)' },
  { id: '25', type: 'lead_created', user: 'System', description: 'New Renovation lead parsed', timestamp: '2026-03-10T14:48:00', details: 'Lead #841 - Petah Tikva, Hot urgency' },
]

/* ─── Date Range Helpers ─── */
type DateRange = 'today' | 'week' | 'month' | 'all'

function isInRange(timestamp: string, range: DateRange): boolean {
  if (range === 'all') return true
  const eventDate = new Date(timestamp)
  const now = new Date('2026-03-16T23:59:59')
  const startOfDay = new Date('2026-03-16T00:00:00')

  if (range === 'today') return eventDate >= startOfDay
  if (range === 'week') {
    const weekAgo = new Date(now)
    weekAgo.setDate(weekAgo.getDate() - 7)
    return eventDate >= weekAgo
  }
  if (range === 'month') {
    const monthAgo = new Date(now)
    monthAgo.setMonth(monthAgo.getMonth() - 1)
    return eventDate >= monthAgo
  }
  return true
}

function formatTimestamp(timestamp: string, he: boolean): string {
  const date = new Date(timestamp)
  const options: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }
  return date.toLocaleDateString(he ? 'he-IL' : 'en-US', options)
}

const EVENTS_PER_PAGE = 10

/* ─── Component ─── */
export default function ActivityLog() {
  const { locale } = useI18n()
  const he = locale === 'he'

  const [typeFilter, setTypeFilter] = useState<EventType | 'all'>('all')
  const [userSearch, setUserSearch] = useState('')
  const [dateRange, setDateRange] = useState<DateRange>('all')
  const [page, setPage] = useState(1)

  /* Filtered events */
  const filtered = useMemo(() => {
    return mockEvents.filter((e) => {
      if (typeFilter !== 'all' && e.type !== typeFilter) return false
      if (userSearch && !e.user.toLowerCase().includes(userSearch.toLowerCase())) return false
      if (!isInRange(e.timestamp, dateRange)) return false
      return true
    })
  }, [typeFilter, userSearch, dateRange])

  const totalPages = Math.max(1, Math.ceil(filtered.length / EVENTS_PER_PAGE))
  const safePage = Math.min(page, totalPages)
  const paged = filtered.slice((safePage - 1) * EVENTS_PER_PAGE, safePage * EVENTS_PER_PAGE)

  /* Reset page when filters change */
  const updateFilter = <T,>(setter: React.Dispatch<React.SetStateAction<T>>, value: T) => {
    setter(value)
    setPage(1)
  }

  const dateRangeOptions: { key: DateRange; en: string; he: string }[] = [
    { key: 'today', en: 'Today', he: 'היום' },
    { key: 'week', en: 'This Week', he: 'השבוע' },
    { key: 'month', en: 'This Month', he: 'החודש' },
    { key: 'all', en: 'All Time', he: 'הכל' },
  ]

  const typeOptions: { key: EventType | 'all'; en: string; he: string }[] = [
    { key: 'all', en: 'All', he: 'הכל' },
    { key: 'login', en: 'Login', he: 'התחברות' },
    { key: 'lead_created', en: 'Lead Created', he: 'ליד חדש' },
    { key: 'lead_assigned', en: 'Lead Assigned', he: 'ליד שויך' },
    { key: 'contractor_registered', en: 'Contractor Registered', he: 'קבלן נרשם' },
    { key: 'payment_received', en: 'Payment Received', he: 'תשלום התקבל' },
    { key: 'settings_changed', en: 'Settings Changed', he: 'הגדרות שונו' },
  ]

  return (
    <div className="animate-fade-in space-y-8" style={{ fontFamily: 'Outfit, sans-serif' }}>
      {/* Header */}
      <header>
        <h1 className="text-3xl font-bold tracking-tight" style={{ color: '#2d3a2e' }}>
          {he ? 'יומן פעילות' : 'Activity Log'}
        </h1>
        <p className="mt-1 text-sm" style={{ color: '#6b7c6e' }}>
          {he ? 'אירועי מערכת ופעולות משתמשים' : 'System events and user actions'}
        </p>
      </header>

      {/* Filter Bar */}
      <div className="glass-panel p-4">
        <div className="flex flex-wrap items-center gap-4">
          {/* Event Type Dropdown */}
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4" style={{ color: '#6b7c6e' }} />
            <select
              value={typeFilter}
              onChange={(e) => updateFilter(setTypeFilter, e.target.value as EventType | 'all')}
              className="text-sm rounded-xl border px-3 py-2"
              style={{ borderColor: '#e8e6e2', color: '#2d3a2e', background: 'white' }}
            >
              {typeOptions.map((opt) => (
                <option key={opt.key} value={opt.key}>
                  {he ? opt.he : opt.en}
                </option>
              ))}
            </select>
          </div>

          {/* User Search */}
          <div className="flex items-center gap-2 flex-1 min-w-[200px] max-w-xs">
            <Search className="h-4 w-4 shrink-0" style={{ color: '#6b7c6e' }} />
            <input
              type="text"
              placeholder={he ? 'חיפוש משתמש...' : 'Search user...'}
              value={userSearch}
              onChange={(e) => updateFilter(setUserSearch, e.target.value)}
              className="w-full text-sm rounded-xl border px-3 py-2"
              style={{ borderColor: '#e8e6e2', color: '#2d3a2e' }}
            />
          </div>

          {/* Date Range Buttons */}
          <div className="flex items-center gap-1 ml-auto">
            {dateRangeOptions.map((opt) => (
              <button
                key={opt.key}
                onClick={() => updateFilter(setDateRange, opt.key)}
                className="px-3 py-1.5 text-xs font-medium rounded-lg transition-all"
                style={{
                  background: dateRange === opt.key ? '#2d3a2e' : 'transparent',
                  color: dateRange === opt.key ? '#fff' : '#6b7c6e',
                }}
              >
                {he ? opt.he : opt.en}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Event List */}
      <div className="glass-panel p-6">
        {paged.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm" style={{ color: '#9ca89e' }}>
              {he ? 'לא נמצאו אירועים' : 'No events found'}
            </p>
          </div>
        ) : (
          <div className="relative">
            {/* Timeline line */}
            <div
              className="absolute top-0 bottom-0 w-px"
              style={{
                background: 'linear-gradient(to bottom, #e8e6e2, transparent)',
                left: he ? 'auto' : '19px',
                right: he ? '19px' : 'auto',
              }}
            />

            <div className="space-y-1">
              {paged.map((event, idx) => {
                const config = eventTypes[event.type]
                const Icon = config.icon

                return (
                  <div
                    key={event.id}
                    className="relative flex items-start gap-4 p-3 rounded-xl transition-all hover:bg-black/[0.02]"
                    style={{
                      animationDelay: `${idx * 50}ms`,
                      paddingLeft: he ? undefined : '8px',
                      paddingRight: he ? '8px' : undefined,
                    }}
                  >
                    {/* Timeline dot + icon */}
                    <div
                      className="relative z-10 flex items-center justify-center shrink-0 rounded-full"
                      style={{
                        width: 38,
                        height: 38,
                        background: `${config.color}14`,
                      }}
                    >
                      <Icon className="h-4 w-4" style={{ color: config.color }} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 pt-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold" style={{ color: '#2d3a2e' }}>
                          {event.user}
                        </span>
                        <span
                          className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold"
                          style={{
                            background: `${config.color}14`,
                            color: config.color,
                          }}
                        >
                          {he ? config.labelHe : config.label}
                        </span>
                      </div>
                      <p className="text-sm mt-0.5" style={{ color: '#2d3a2e' }}>
                        {event.description}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: '#9ca89e' }}>
                        {event.details}
                      </p>
                    </div>

                    {/* Timestamp */}
                    <div className="shrink-0 pt-1">
                      <span className="text-xs tabular-nums" style={{ color: '#9ca89e' }}>
                        {formatTimestamp(event.timestamp, he)}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Pagination */}
        {filtered.length > EVENTS_PER_PAGE && (
          <div className="flex items-center justify-between mt-6 pt-4 border-t" style={{ borderColor: '#e8e6e2' }}>
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage <= 1}
              className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-lg transition-all disabled:opacity-40"
              style={{ color: '#2d3a2e' }}
            >
              {he ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
              {he ? 'הקודם' : 'Previous'}
            </button>

            <span className="text-xs" style={{ color: '#6b7c6e' }}>
              {he
                ? `עמוד ${safePage} מתוך ${totalPages}`
                : `Page ${safePage} of ${totalPages}`}
            </span>

            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
              className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-lg transition-all disabled:opacity-40"
              style={{ color: '#2d3a2e' }}
            >
              {he ? 'הבא' : 'Next'}
              {he ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
