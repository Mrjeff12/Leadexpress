import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { useI18n } from '../lib/i18n'
import { useContractorProfile } from '../hooks/useContractorProfile'
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
  AlertCircle,
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
  const navigate = useNavigate()
  const { data: contractorData, isLoading: profileLoading } = useContractorProfile()
  const isHe = locale === 'he'

  const professions = contractorData?.professions ?? []
  const zipCodes = contractorData?.zip_codes ?? []
  const profileReady = !profileLoading && professions.length > 0 && zipCodes.length > 0

  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [markingAll, setMarkingAll] = useState(false)

  /* Build notifications from recent lead activity */
  const fetchNotifications = useCallback(async () => {
    if (!effectiveUserId) return
    if (professions.length === 0 || zipCodes.length === 0) {
      setNotifications([])
      setLoading(false)
      return
    }
    setLoading(true)

    try {
      // Fetch recent leads filtered by contractor's professions & zip codes (last 30 days)
      const since = new Date()
      since.setDate(since.getDate() - 30)

      const { data: leads } = await supabase
        .from('leads')
        .select('id, profession, parsed_summary, city, zip_code, urgency, budget_range, created_at, groups ( name )')
        .in('profession', professions)
        .in('zip_code', zipCodes)
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
  }, [effectiveUserId, isHe, professions, zipCodes])

  useEffect(() => { fetchNotifications() }, [fetchNotifications])

  /* Mark single notification as read and navigate */
  const handleNotificationClick = (n: Notification) => {
    setNotifications(prev => prev.map(item => item.id === n.id ? { ...item, read: true } : item))
    switch (n.type) {
      case 'lead':   navigate(n.lead_id ? `/leads/${n.lead_id}` : '/leads'); break
      case 'job':    navigate('/jobs'); break
      case 'message': navigate('/messages'); break
      default:       break
    }
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
    <>
      {/* ── Mobile header (md:hidden) ── */}
      <div className="md:hidden bg-white rounded-[20px] border border-black/[0.04] shadow-[0_1px_3px_rgba(0,0,0,0.04)] px-4 py-3.5 flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-[#f5f5f7] flex items-center justify-center">
            <Bell size={18} className="text-[#1d1d1f]" />
          </div>
          <div>
            <span className="text-[15px] font-semibold text-[#1d1d1f]">
              {isHe ? 'התראות' : 'Notifications'}
            </span>
            {unreadCount > 0 && (
              <span className="ml-2 inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#fe5b25] text-white text-[10px] font-bold">
                {unreadCount}
              </span>
            )}
          </div>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllAsRead}
            disabled={markingAll}
            className="flex items-center gap-1 text-xs font-semibold text-[#fe5b25] disabled:opacity-50"
          >
            {markingAll ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
            {isHe ? 'סמן הכל' : 'Mark all read'}
          </button>
        )}
      </div>

      <div className="w-full max-w-3xl mx-auto">
        {/* Desktop Header */}
        <div className="hidden md:flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-[#1d1d1f] tracking-tight">
              {isHe ? 'התראות' : 'Notifications'}
            </h1>
            {unreadCount > 0 && (
              <p className="text-sm text-[#737373] mt-0.5">
                {isHe ? `${unreadCount} לא נקראו` : `${unreadCount} unread`}
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
              {isHe ? 'סמן הכל כנקרא' : 'Mark all read'}
            </button>
          )}
        </div>

        {/* Profile not configured */}
        {!profileLoading && !profileReady && (
          <div className="bg-white md:bg-transparent md:glass-panel rounded-[20px] md:rounded-2xl border border-black/[0.04] md:border-0 shadow-[0_1px_3px_rgba(0,0,0,0.04)] md:shadow-none p-10 text-center">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-4">
              <AlertCircle size={28} className="text-amber-400" />
            </div>
            <h3 className="text-base font-semibold text-[#1d1d1f] md:text-[#1d1d1f] mb-1">
              {isHe ? 'הגדר את הפרופיל שלך' : 'Set up your profile'}
            </h3>
            <p className="text-sm text-[#737373] md:text-[#737373] max-w-xs mx-auto mb-4">
              {isHe
                ? 'הוסף מקצועות ומיקודים כדי לקבל התראות על לידים רלוונטיים'
                : 'Add your professions and zip codes to receive relevant lead notifications.'}
            </p>
            <button
              onClick={() => navigate('/profile/edit')}
              className="text-sm font-semibold text-[#fe5b25] hover:text-[#ff7a4d] transition-colors"
            >
              {isHe ? 'עבור להגדרות פרופיל' : 'Go to Profile Settings'}
            </button>
          </div>
        )}

        {/* Loading state */}
        {loading && profileReady && (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={28} className="animate-spin text-[#a3a3a3] md:text-[#a3a3a3]" />
          </div>
        )}

        {/* Empty state */}
        {!loading && notifications.length === 0 && (
          <div className="bg-white md:bg-transparent md:glass-panel rounded-[20px] md:rounded-2xl border border-black/[0.04] md:border-0 shadow-[0_1px_3px_rgba(0,0,0,0.04)] md:shadow-none p-10 text-center">
            <div className="w-16 h-16 rounded-2xl bg-black/[0.04] md:bg-white/5 border border-black/[0.06] md:border-white/10 flex items-center justify-center mx-auto mb-4">
              <BellOff size={28} className="text-[#c7c7cc] md:text-[#c7c7cc]" />
            </div>
            <h3 className="text-base font-semibold text-[#1d1d1f] md:text-[#1d1d1f] mb-1">
              {isHe ? 'אין התראות' : 'No notifications yet'}
            </h3>
            <p className="text-sm text-[#737373] md:text-[#737373] max-w-xs mx-auto">
              {isHe
                ? 'כשתקבלו לידים חדשים, הם יופיעו כאן'
                : "When new leads and updates come in, they'll appear here."}
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
                  onClick={() => handleNotificationClick(n)}
                  className={`
                    md:glass-panel bg-white md:bg-transparent
                    rounded-[20px] md:rounded-2xl
                    p-4 flex items-start gap-3.5 cursor-pointer
                    border border-black/[0.04] md:border-0
                    shadow-[0_1px_3px_rgba(0,0,0,0.04)] md:shadow-none
                    transition-all duration-200 md:hover:bg-white/[0.06] active:scale-[0.99]
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
                      <p className={`text-sm leading-tight ${n.read ? 'text-[#737373] md:text-[#737373] font-medium' : 'text-[#1d1d1f] md:text-[#1d1d1f] font-bold'}`}>
                        {n.title}
                      </p>
                      {!n.read && (
                        <span className="w-2.5 h-2.5 rounded-full bg-[#fe5b25] flex-shrink-0 mt-1 shadow-lg shadow-[#fe5b25]/30" />
                      )}
                    </div>
                    <p className="text-xs text-[#737373] md:text-[#737373] mt-0.5 truncate">{n.description}</p>
                    <p className="text-[10px] text-[#a3a3a3] md:text-[#a3a3a3] mt-1">{timeAgo(n.time, isHe)}</p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
