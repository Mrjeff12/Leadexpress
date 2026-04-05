import { useState, useEffect, useCallback } from 'react'
import { useI18n } from '../../lib/i18n'
import { useAdminAlerts } from '../../hooks/useAdminBilling'
import { supabase } from '../../lib/supabase'
import { formatCents, formatDate } from '../../lib/shared'
import {
  AlertTriangle, XCircle, Clock, Loader2, CheckCircle,
  Wifi, WifiOff, Skull, Bell, Check, Trash2, RefreshCw,
} from 'lucide-react'

// ── System alerts from system_alerts table ──
interface SystemAlert {
  id: string
  type: string
  severity: string
  title: string
  message: string | null
  read_at: string | null
  created_at: string
}

function useSystemAlerts() {
  const [alerts, setAlerts] = useState<SystemAlert[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    const { data } = await supabase
      .from('system_alerts')
      .select('*')
      .is('read_at', null)
      .order('created_at', { ascending: false })
      .limit(50)
    setAlerts((data ?? []) as SystemAlert[])
    setLoading(false)
  }, [])

  useEffect(() => { fetch() }, [fetch])

  const dismiss = async (id: string) => {
    await supabase.from('system_alerts').update({ read_at: new Date().toISOString() }).eq('id', id)
    setAlerts(prev => prev.filter(a => a.id !== id))
  }

  const dismissAll = async () => {
    await supabase.from('system_alerts').update({ read_at: new Date().toISOString() }).is('read_at', null)
    setAlerts([])
  }

  return { alerts, loading, dismiss, dismissAll, refetch: fetch }
}

const ALERT_CONFIG: Record<string, { icon: typeof Bell; color: string; borderColor: string; bgColor: string }> = {
  scanner_disconnected: { icon: WifiOff, color: 'text-red-500', borderColor: 'border-red-400', bgColor: 'bg-red-50' },
  scanner_reconnected: { icon: Wifi, color: 'text-emerald-500', borderColor: 'border-emerald-400', bgColor: 'bg-emerald-50' },
  dead_job: { icon: Skull, color: 'text-amber-500', borderColor: 'border-amber-400', bgColor: 'bg-amber-50' },
}

export default function Alerts() {
  const { locale } = useI18n()
  const he = locale === 'he'
  const { alerts, loading, totalCount } = useAdminAlerts()
  const sys = useSystemAlerts()

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
        {(totalCount + sys.alerts.length) > 0 && (
          <span className="inline-flex items-center justify-center rounded-full bg-red-500 px-2.5 py-0.5 text-xs font-semibold text-white">
            {totalCount + sys.alerts.length}
          </span>
        )}
      </div>

      {/* ── System Alerts (scanners, dead jobs) ── */}
      {sys.alerts.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell size={18} className="text-violet-500" />
              <h2 className="text-base font-semibold" style={{ color: '#2d3a2e' }}>
                {he ? 'התראות מערכת' : 'System Alerts'}
              </h2>
              <span className="rounded-full bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-600">
                {sys.alerts.length}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={sys.refetch}
                className="p-1.5 rounded-lg hover:bg-stone-100 transition"
                title="Refresh"
              >
                <RefreshCw size={14} style={{ color: '#9ca89e' }} />
              </button>
              <button
                onClick={sys.dismissAll}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium hover:bg-stone-100 transition"
                style={{ color: '#6b7c6e' }}
              >
                <Check size={12} />
                {he ? 'סמן הכל כנקרא' : 'Dismiss all'}
              </button>
            </div>
          </div>
          <div className="space-y-2">
            {sys.alerts.map((a) => {
              const cfg = ALERT_CONFIG[a.type] || { icon: Bell, color: 'text-stone-500', borderColor: 'border-stone-300', bgColor: 'bg-stone-50' }
              const Icon = cfg.icon
              const timeAgo = (() => {
                const diff = Date.now() - new Date(a.created_at).getTime()
                const m = Math.floor(diff / 60000)
                if (m < 1) return he ? 'עכשיו' : 'Just now'
                if (m < 60) return `${m}m`
                const h = Math.floor(m / 60)
                if (h < 24) return `${h}h`
                return `${Math.floor(h / 24)}d`
              })()

              return (
                <div key={a.id} className={`glass-panel border-l-4 ${cfg.borderColor} p-4`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${cfg.bgColor}`}>
                        <Icon size={14} className={cfg.color} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium" style={{ color: '#2d3a2e' }}>
                          {a.title}
                        </p>
                        {a.message && (
                          <p className="mt-0.5 text-xs break-all" style={{ color: '#6b7c6e' }}>
                            {a.message.length > 200 ? a.message.slice(0, 200) + '...' : a.message}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px]" style={{ color: '#9ca89e' }}>{timeAgo}</span>
                      <button
                        onClick={() => sys.dismiss(a.id)}
                        className="p-1 rounded hover:bg-stone-100 transition"
                        title={he ? 'סגור' : 'Dismiss'}
                      >
                        <Trash2 size={12} style={{ color: '#9ca89e' }} />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Empty state */}
      {totalCount === 0 && sys.alerts.length === 0 && (
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
