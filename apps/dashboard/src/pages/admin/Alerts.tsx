import { useI18n } from '../../lib/i18n'
import { useAdminAlerts } from '../../hooks/useAdminBilling'
import { AlertTriangle, XCircle, Clock, Loader2, CheckCircle } from 'lucide-react'

function formatCents(cents: number, currency = 'usd'): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(cents / 100)
}

function formatDate(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function Alerts() {
  const { locale } = useI18n()
  const he = locale === 'he'
  const { alerts, loading, totalCount } = useAdminAlerts()

  if (loading) {
    return (
      <div className="animate-fade-in flex items-center justify-center py-32" style={{ fontFamily: 'Outfit, sans-serif' }}>
        <Loader2 size={32} className="animate-spin" style={{ color: '#f59e0b' }} />
      </div>
    )
  }

  return (
    <div className="animate-fade-in space-y-6" style={{ fontFamily: 'Outfit, sans-serif' }}>
      {/* Header */}
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold" style={{ color: '#2d3a2e' }}>
          {he ? 'התראות' : 'Alerts'}
        </h1>
        {totalCount > 0 && (
          <span className="inline-flex items-center justify-center rounded-full bg-red-500 px-2.5 py-0.5 text-xs font-semibold text-white">
            {totalCount}
          </span>
        )}
      </div>

      {/* Empty state */}
      {totalCount === 0 && (
        <div className="glass-panel flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-green-50">
            <CheckCircle size={32} className="text-green-500" />
          </div>
          <p className="text-lg font-semibold" style={{ color: '#2d3a2e' }}>
            {he ? 'הכל תקין!' : 'All clear!'}
          </p>
          <p className="mt-1 text-sm" style={{ color: '#9ca89e' }}>
            {he ? 'אין התראות פעילות' : 'No active alerts'}
          </p>
        </div>
      )}

      {/* Failed Payments */}
      {alerts && alerts.failed_payments.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <XCircle size={18} className="text-red-500" />
            <h2 className="text-base font-semibold" style={{ color: '#2d3a2e' }}>
              {he ? 'תשלומים שנכשלו' : 'Failed Payments'}
            </h2>
            <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600">
              {alerts.failed_payments.length}
            </span>
          </div>
          <div className="space-y-2">
            {alerts.failed_payments.map((p) => (
              <div key={p.id} className="glass-panel border-l-4 border-red-400 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: '#2d3a2e' }}>
                      {p.customer_email || 'Unknown'}
                    </p>
                    {p.failure_message && (
                      <p className="mt-0.5 text-xs" style={{ color: '#6b7c6e' }}>
                        {p.failure_message}
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-lg font-bold text-red-600">
                      {formatCents(p.amount, p.currency)}
                    </p>
                    <p className="text-xs" style={{ color: '#9ca89e' }}>
                      {formatDate(p.created)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Disputes */}
      {alerts && alerts.disputes.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle size={18} className="text-amber-500" />
            <h2 className="text-base font-semibold" style={{ color: '#2d3a2e' }}>
              {he ? 'מחלוקות' : 'Disputes'}
            </h2>
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-600">
              {alerts.disputes.length}
            </span>
          </div>
          <div className="space-y-2">
            {alerts.disputes.map((d) => (
              <div key={d.id} className="glass-panel border-l-4 border-amber-400 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium" style={{ color: '#2d3a2e' }}>
                      {d.reason.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase())}
                    </p>
                    <p className="mt-0.5 text-xs" style={{ color: '#6b7c6e' }}>
                      {d.status.replace(/_/g, ' ')}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-lg font-bold text-amber-600">
                      {formatCents(d.amount, d.currency)}
                    </p>
                    {d.evidence_due && (
                      <p className="mt-0.5 flex items-center justify-end gap-1 text-xs text-red-500">
                        <Clock size={12} />
                        {formatDate(d.evidence_due)}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Past Due Subscriptions */}
      {alerts && alerts.past_due.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Clock size={18} className="text-orange-500" />
            <h2 className="text-base font-semibold" style={{ color: '#2d3a2e' }}>
              {he ? 'מנויים באיחור' : 'Past Due Subscriptions'}
            </h2>
            <span className="rounded-full bg-orange-50 px-2 py-0.5 text-xs font-medium text-orange-600">
              {alerts.past_due.length}
            </span>
          </div>
          <div className="space-y-2">
            {alerts.past_due.map((s) => (
              <div key={s.user_id} className="glass-panel border-l-4 border-orange-400 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium" style={{ color: '#2d3a2e' }}>
                      {s.name || 'Unknown'}
                    </p>
                    <p className="mt-0.5 text-xs" style={{ color: '#6b7c6e' }}>
                      {s.plan}
                    </p>
                  </div>
                  {s.current_period_end && (
                    <p className="text-xs shrink-0" style={{ color: '#9ca89e' }}>
                      {new Date(s.current_period_end).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
