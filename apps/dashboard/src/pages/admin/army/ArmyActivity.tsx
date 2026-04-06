import { useMemo } from 'react'
import { useI18n } from '../../../lib/i18n'
import { useArmyActivity, useArmyConfig } from '../../../hooks/useArmyData'
import {
  Loader2, Power, PowerOff, CheckCircle2, XCircle, Clock,
  Megaphone, MessageCircleReply, HardHat, Activity, Send,
} from 'lucide-react'

const TYPE_META: Record<string, { icon: typeof Megaphone; color: string; label: string; labelHe: string }> = {
  job_post: { icon: Megaphone, color: '#2563eb', label: 'Job Post', labelHe: 'פרסום עבודה' },
  response: { icon: MessageCircleReply, color: '#f59e0b', label: 'Response', labelHe: 'תגובה' },
  contractor_promo: { icon: HardHat, color: '#10b981', label: 'Contractor Promo', labelHe: 'פרסום קבלן' },
}

const STATUS_META: Record<string, { icon: typeof CheckCircle2; color: string }> = {
  sent: { icon: CheckCircle2, color: '#10b981' },
  failed: { icon: XCircle, color: '#ef4444' },
  pending: { icon: Clock, color: '#f59e0b' },
}

export default function ArmyActivity() {
  const { locale } = useI18n()
  const he = locale === 'he'
  const { entries, loading } = useArmyActivity(100)
  const { config, loading: configLoading, update } = useArmyConfig()

  const stats = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    const todayEntries = entries.filter(e => e.scheduled_at.startsWith(today))
    return {
      total: todayEntries.length,
      sent: todayEntries.filter(e => e.status === 'sent').length,
      failed: todayEntries.filter(e => e.status === 'failed').length,
      pending: todayEntries.filter(e => e.status === 'pending').length,
    }
  }, [entries])

  if (loading || configLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-red-500" />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Master Toggle + Stats */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => update('enabled', config.enabled ? 'false' : 'true')}
          className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all"
          style={{
            background: config.enabled ? '#10b98115' : '#ef444415',
            color: config.enabled ? '#10b981' : '#ef4444',
            border: `1px solid ${config.enabled ? '#10b98130' : '#ef444430'}`,
          }}
        >
          {config.enabled ? <Power className="w-4 h-4" /> : <PowerOff className="w-4 h-4" />}
          {config.enabled ? (he ? 'פעיל' : 'ACTIVE') : (he ? 'מושבת' : 'DISABLED')}
        </button>

        <div className="flex gap-3 text-xs">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#f5f2ed]">
            <Send className="w-3 h-3 text-[#3b3b3b]/40" />
            <span className="font-bold text-[#0b0707]">{stats.sent}</span>
            <span className="text-[#3b3b3b]/40">{he ? 'נשלחו' : 'sent'}</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#f5f2ed]">
            <Clock className="w-3 h-3 text-amber-500/60" />
            <span className="font-bold text-[#0b0707]">{stats.pending}</span>
            <span className="text-[#3b3b3b]/40">{he ? 'ממתינות' : 'pending'}</span>
          </div>
          {stats.failed > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-50">
              <XCircle className="w-3 h-3 text-red-400" />
              <span className="font-bold text-red-600">{stats.failed}</span>
              <span className="text-red-400">{he ? 'נכשלו' : 'failed'}</span>
            </div>
          )}
        </div>
      </div>

      {/* Activity window config */}
      <div className="flex items-center gap-3 text-xs text-[#3b3b3b]/50">
        <Activity className="w-3.5 h-3.5" />
        <span>{he ? 'חלון פעילות:' : 'Activity window:'}</span>
        <span className="font-mono font-bold text-[#0b0707]">
          {config.activity_window_start} – {config.activity_window_end}
        </span>
        <span>|</span>
        <span>{he ? 'דיליי תגובה:' : 'Response delay:'}</span>
        <span className="font-mono font-bold text-[#0b0707]">
          {config.response_delay_min}-{config.response_delay_max} min
        </span>
      </div>

      {/* Log */}
      <div className="space-y-2">
        <h2 className="text-xs font-bold text-[#3b3b3b]/40 uppercase tracking-wider">
          {he ? 'לוג פעילות' : 'Activity Log'}
        </h2>

        <div className="space-y-1.5">
          {entries.map((entry) => {
            const type = TYPE_META[entry.message_type] ?? TYPE_META.job_post
            const status = STATUS_META[entry.status] ?? STATUS_META.pending
            const TypeIcon = type.icon
            const StatusIcon = status.icon
            return (
              <div
                key={entry.id}
                className="flex items-center gap-3 px-3 py-2 rounded-xl border border-[#efeff1] bg-white text-[11px]"
              >
                <StatusIcon className="w-3.5 h-3.5 shrink-0" style={{ color: status.color }} />
                <TypeIcon className="w-3.5 h-3.5 shrink-0" style={{ color: type.color }} />
                <span className="font-semibold text-[#0b0707] shrink-0">
                  {he ? type.labelHe : type.label}
                </span>
                <span className="text-[#3b3b3b]/40 truncate flex-1">
                  {entry.rendered_message?.slice(0, 60) ?? '...'}
                </span>
                <span className="text-[#3b3b3b]/30 font-mono shrink-0">
                  {new Date(entry.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                {entry.error && (
                  <span className="text-red-400 truncate max-w-[120px]" title={entry.error}>
                    {entry.error}
                  </span>
                )}
              </div>
            )
          })}

          {entries.length === 0 && (
            <div className="text-center py-12 text-sm text-[#3b3b3b]/30">
              {he ? 'אין פעילות עדיין' : 'No activity yet'}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
