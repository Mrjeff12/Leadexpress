import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../lib/auth'
import { useI18n } from '../lib/i18n'
import { supabase } from '../lib/supabase'
import { timeAgo } from '../lib/shared'
import {
  Bell,
  Zap,
  CheckCircle2,
  MessageCircle,
  Star,
  Users,
  Briefcase,
  BellOff,
  Loader2,
  Check,
} from 'lucide-react'

/* ───────────────────── Types ───────────────────── */

interface Notification {
  id: string
  type: 'lead' | 'job' | 'review' | 'message' | 'system'
  title: string
  description: string
  time: string
  read: boolean
  lead_id?: string
}

/* ───────────────────── Helpers ───────────────────── */

function notificationIcon(type: Notification['type']) {
  switch (type) {
    case 'lead':    return Zap
    case 'job':     return Briefcase
    case 'review':  return Star
    case 'message': return MessageCircle
    case 'system':  return Bell
    default:        return Bell
  }
}

function notificationColors(type: Notification['type']) {
  switch (type) {
    case 'lead':    return { bg: 'bg-[#fe5b25]/10', text: 'text-[#fe5b25]' }
    case 'job':     return { bg: 'bg-green-500/10', text: 'text-green-600' }
    case 'review':  return { bg: 'bg-amber-500/10', text: 'text-amber-500' }
    case 'message': return { bg: 'bg-blue-500/10', text: 'text-blue-500' }
    case 'system':  return { bg: 'bg-white/5', text: 'text-gray-400' }
    default:        return { bg: 'bg-white/5', text: 'text-gray-400' }
  }
}

/* ───────────────────── Component ───────────────────── */

export default function NotificationsPage() {
  const { effectiveUserId } = useAuth()
  const { t, locale } = useI18n()
  const isHe = locale === 'he'

  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [markingAll, setMarkingAll] = useState(false)

  /* Build notifications from recent lead activity */
  const fetchNotifications = useCallback(async () => {
    if (!effectiveUserId) return
    setLoading(true)

    try {
      // Fetch recent leads assigned to this contractor (last 30 days)
      const since = new Date()
      since.setDate(since.getDate() - 30)

      const { data: leads } = await supabase
        .from('leads')
        .select('id, profession, parsed_summary, city, zip_code, urgency, budget_range, created_at, groups ( name )')
        .order('created_at', { ascending: false })
        .gte('created_at', since.toISOString())
        .limit(50)

      // Check which leads this contractor has job orders for (interacted with)
      const { data: jobLeads } = await supabase
        .from('job_orders')
        .select('lead_id')
        .eq('contractor_id', effectiveUserId)

      const interactedLeadIds = new Set(jobLeads?.map(j => j.lead_id) ?? [])

      // Build notifications from leads
      const items: Notification[] = []

      if (leads) {
        for (const lead of leads) {
          const groupName = (lead.groups as any)?.name ?? ''
          const desc = [
            lead.profession,
            lead.city || (lead.zip_code ? `ZIP ${lead.zip_code}` : null),
            lead.budget_range,
          ].filter(Boolean).join(' \u00b7 ')

          items.push({
            id: lead.id,
            type: lead.urgency === 'hot' ? 'lead' : lead.urgency === 'warm' ? 'lead' : 'lead',
            title: lead.urgency === 'hot'
              ? (isHe ? '\u26a1 \u05dc\u05d9\u05d3 \u05d3\u05d7\u05d5\u05e3 \u05d7\u05d3\u05e9' : 'New urgent lead nearby')
              : (isHe ? '\u05dc\u05d9\u05d3 \u05d7\u05d3\u05e9' : 'New lead'),
            description: desc || lead.parsed_summary || (isHe ? '\u05dc\u05d9\u05d3 \u05d7\u05d3\u05e9 \u05d6\u05de\u05d9\u05df' : 'New lead available'),
            time: lead.created_at,
            read: interactedLeadIds.has(lead.id),
            lead_id: lead.id,
          })
        }
      }

      // Fetch recent job orders for this contractor
      const { data: jobs } = await supabase
        .from('job_orders')
        .select('id, status, profession, created_at')
        .eq('contractor_id', effectiveUserId)
        .order('created_at', { ascending: false })
        .limit(10)

      if (jobs) {
        for (const job of jobs) {
          items.push({
            id: `job-${job.id}`,
            type: 'job',
            title: job.status === 'accepted'
              ? (isHe ? '\u05e2\u05d1\u05d5\u05d3\u05d4 \u05d0\u05d5\u05e9\u05e8\u05d4!' : 'Job accepted!')
              : job.status === 'completed'
                ? (isHe ? '\u05e2\u05d1\u05d5\u05d3\u05d4 \u05d4\u05d5\u05e9\u05dc\u05de\u05d4' : 'Job completed')
                : (isHe ? '\u05d4\u05e6\u05e2\u05ea \u05e2\u05d1\u05d5\u05d3\u05d4 \u05d7\u05d3\u05e9\u05d4' : 'New job offer'),
            description: job.profession || (isHe ? '\u05e2\u05d1\u05d5\u05d3\u05d4' : 'Job'),
            time: job.created_at,
            read: job.status === 'completed',
          })
        }
      }

      // Sort by time descending
      items.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())

      setNotifications(items)
    } catch (err) {
      console.error('Failed to load notifications:', err)
    } finally {
      setLoading(false)
    }
  }, [effectiveUserId, isHe])

  useEffect(() => { fetchNotifications() }, [fetchNotifications])

  /* Mark single notification as read */
  const markAsRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
  }

  /* Mark all as read */
  const markAllAsRead = () => {
    setMarkingAll(true)
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    setTimeout(() => setMarkingAll(false), 400)
  }

  const unreadCount = notifications.filter(n => !n.read).length

  /* ───────────────────── Render ───────────────────── */

  return (
    <div className="w-full max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">
            {isHe ? '\u05d4\u05ea\u05e8\u05d0\u05d5\u05ea' : 'Notifications'}
          </h1>
          {unreadCount > 0 && (
            <p className="text-sm text-white/50 mt-0.5">
              {isHe ? `${unreadCount} \u05dc\u05d0 \u05e0\u05e7\u05e8\u05d0\u05d5` : `${unreadCount} unread`}
            </p>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllAsRead}
            disabled={markingAll}
            className="flex items-center gap-1.5 text-xs font-semibold text-[#fe5b25] hover:text-[#ff7a4d] transition-colors disabled:opacity-50"
          >
            {markingAll ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
            {isHe ? '\u05e1\u05de\u05df \u05d4\u05db\u05dc \u05db\u05e0\u05e7\u05e8\u05d0' : 'Mark all read'}
          </button>
        )}
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={28} className="animate-spin text-white/30" />
        </div>
      )}

      {/* Empty state */}
      {!loading && notifications.length === 0 && (
        <div className="glass-panel rounded-2xl p-10 text-center">
          <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-4">
            <BellOff size={28} className="text-white/20" />
          </div>
          <h3 className="text-base font-semibold text-white/80 mb-1">
            {isHe ? '\u05d0\u05d9\u05df \u05d4\u05ea\u05e8\u05d0\u05d5\u05ea' : 'No notifications yet'}
          </h3>
          <p className="text-sm text-white/40 max-w-xs mx-auto">
            {isHe
              ? '\u05db\u05e9\u05ea\u05e7\u05d1\u05dc\u05d5 \u05dc\u05d9\u05d3\u05d9\u05dd \u05d7\u05d3\u05e9\u05d9\u05dd, \u05d4\u05dd \u05d9\u05d5\u05e4\u05d9\u05e2\u05d5 \u05db\u05d0\u05df'
              : 'When new leads and updates come in, they\'ll appear here.'}
          </p>
        </div>
      )}

      {/* Notification cards */}
      {!loading && notifications.length > 0 && (
        <div className="space-y-2 stagger-children">
          {notifications.map((n, i) => {
            const Icon = notificationIcon(n.type)
            const colors = notificationColors(n.type)

            return (
              <div
                key={n.id}
                onClick={() => markAsRead(n.id)}
                className={`
                  glass-panel rounded-2xl p-4 flex items-start gap-3.5 cursor-pointer
                  transition-all duration-200 hover:bg-white/[0.06] active:scale-[0.99]
                  ${n.read ? 'opacity-60' : ''}
                `}
                style={{ animationDelay: `${i * 40}ms` }}
              >
                {/* Icon */}
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${colors.bg}`}>
                  <Icon size={17} className={colors.text} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className={`text-sm leading-tight ${n.read ? 'text-white/60 font-medium' : 'text-white font-bold'}`}>
                      {n.title}
                    </p>
                    {!n.read && (
                      <span className="w-2.5 h-2.5 rounded-full bg-[#fe5b25] flex-shrink-0 mt-1 shadow-lg shadow-[#fe5b25]/30" />
                    )}
                  </div>
                  <p className="text-xs text-white/40 mt-0.5 truncate">{n.description}</p>
                  <p className="text-[10px] text-white/25 mt-1">{timeAgo(n.time, isHe)}</p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
