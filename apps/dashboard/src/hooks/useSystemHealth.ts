import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export interface ServiceStatus {
  name: string
  status: 'healthy' | 'degraded' | 'down' | 'unknown'
  detail: string
  lastCheck: string
}

export interface ErrorEntry {
  id: string
  timestamp: string
  service: string
  message: string
  severity: 'error' | 'warning' | 'info'
}

export interface ActivityEvent {
  id: string
  type: 'signup' | 'lead' | 'payment' | 'whatsapp' | 'nudge'
  description: string
  created_at: string
}

export interface HealthMetrics {
  leadsToday: number
  leadsYesterday: number
  activeGroups: number
  messagesToday: number
  cronRunsToday: number
  totalUsers: number
  nudgesToday: number
}

export interface SystemHealthData {
  services: ServiceStatus[]
  errors: ErrorEntry[]
  activity: ActivityEvent[]
  metrics: HealthMetrics
  loading: boolean
  lastRefresh: Date | null
}

const DEFAULTS: SystemHealthData = {
  services: [],
  errors: [],
  activity: [],
  metrics: {
    leadsToday: 0,
    leadsYesterday: 0,
    activeGroups: 0,
    messagesToday: 0,
    cronRunsToday: 0,
    totalUsers: 0,
    nudgesToday: 0,
  },
  loading: true,
  lastRefresh: null,
}

const REFRESH_INTERVAL = 30_000 // 30 seconds

export function useSystemHealth(): SystemHealthData & { refresh: () => void } {
  const [data, setData] = useState<SystemHealthData>(DEFAULTS)

  const fetchAll = useCallback(async () => {
    try {
      const now = new Date()
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
      const yesterdayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).toISOString()

      const [
        waAccountsRes,
        profilesCountRes,
        cronRunsRes,
        leadsRes,
        leadsYesterdayRes,
        activeGroupsRes,
        recentSignupsRes,
        recentLeadsRes,
        recentSubsRes,
        nudgesRes,
        nudgesTodayRes,
        failedNudgesRes,
      ] = await Promise.all([
        // WhatsApp accounts status
        supabase.from('wa_accounts').select('id, label, status, connected_since, updated_at').eq('is_active', true),

        // DB health check — profiles count
        supabase.from('profiles').select('id', { count: 'exact', head: true }),

        // Cron runs today
        supabase.from('cron_runs').select('job, run_date, ran_at').gte('ran_at', todayStart).order('ran_at', { ascending: false }),

        // Leads today
        supabase.from('leads').select('id', { count: 'exact', head: true }).gte('created_at', todayStart),

        // Leads yesterday
        supabase.from('leads').select('id', { count: 'exact', head: true }).gte('created_at', yesterdayStart).lt('created_at', todayStart),

        // Active groups
        supabase.from('groups').select('id', { count: 'exact', head: true }).eq('status', 'active'),

        // Recent signups (last 20)
        supabase.from('profiles').select('id, full_name, created_at').eq('role', 'contractor').order('created_at', { ascending: false }).limit(10),

        // Recent leads (last 20)
        supabase.from('leads').select('id, parsed_summary, profession, created_at').order('created_at', { ascending: false }).limit(10),

        // Recent subscriptions
        supabase.from('subscriptions').select('id, status, created_at, profiles(full_name)').order('created_at', { ascending: false }).limit(5),

        // Recent nudges
        supabase.from('nudge_log').select('id, nudge_key, status, phone, created_at').order('created_at', { ascending: false }).limit(20),

        // Nudges today count
        supabase.from('nudge_log').select('id', { count: 'exact', head: true }).gte('created_at', todayStart),

        // Failed nudges (recent errors)
        supabase.from('nudge_log').select('id, nudge_key, phone, status, created_at').eq('status', 'failed').order('created_at', { ascending: false }).limit(10),
      ])

      // --- Build service statuses ---
      const services: ServiceStatus[] = []

      // WhatsApp connections
      const waAccounts = waAccountsRes.data ?? []
      const connectedCount = waAccounts.filter(a => a.status === 'connected').length
      const totalWa = waAccounts.length
      services.push({
        name: 'WhatsApp Connection',
        status: totalWa === 0 ? 'unknown' : connectedCount === totalWa ? 'healthy' : connectedCount > 0 ? 'degraded' : 'down',
        detail: `${connectedCount}/${totalWa} accounts connected`,
        lastCheck: now.toISOString(),
      })

      // Edge Functions (based on cron_runs)
      const cronRuns = cronRunsRes.data ?? []
      const lastCronRun = cronRuns.length > 0 ? cronRuns[0].ran_at : null
      services.push({
        name: 'Edge Functions',
        status: cronRuns.length > 0 ? 'healthy' : 'unknown',
        detail: lastCronRun ? `Last run: ${formatTimeAgo(lastCronRun)}` : 'No cron runs today',
        lastCheck: now.toISOString(),
      })

      // Supabase DB
      const profilesCount = profilesCountRes.count ?? 0
      services.push({
        name: 'Supabase DB',
        status: profilesCountRes.error ? 'down' : 'healthy',
        detail: profilesCountRes.error ? `Error: ${profilesCountRes.error.message}` : `${profilesCount} profiles OK`,
        lastCheck: now.toISOString(),
      })

      // Stripe (inferred from recent subscription activity)
      const recentSubs = recentSubsRes.data ?? []
      const latestSub = recentSubs.length > 0 ? recentSubs[0].created_at : null
      services.push({
        name: 'Stripe',
        status: latestSub ? 'healthy' : 'unknown',
        detail: latestSub ? `Last event: ${formatTimeAgo(latestSub)}` : 'No recent events',
        lastCheck: now.toISOString(),
      })

      // --- Build errors list ---
      const errors: ErrorEntry[] = []

      // WA accounts with issues
      for (const wa of waAccounts) {
        if (wa.status !== 'connected') {
          errors.push({
            id: `wa-${wa.id}`,
            timestamp: wa.updated_at,
            service: 'WhatsApp',
            message: `Account "${wa.label}" is ${wa.status}`,
            severity: wa.status === 'blocked' ? 'error' : 'warning',
          })
        }
      }

      // Failed nudges
      for (const n of (failedNudgesRes.data ?? [])) {
        errors.push({
          id: `nudge-${n.id}`,
          timestamp: n.created_at,
          service: 'Nudge Engine',
          message: `Failed nudge ${n.nudge_key} to ${n.phone}`,
          severity: 'error',
        })
      }

      // Sort errors by time
      errors.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

      // --- Build activity feed ---
      const activity: ActivityEvent[] = []

      for (const s of (recentSignupsRes.data ?? [])) {
        activity.push({
          id: `signup-${s.id}`,
          type: 'signup',
          description: `${s.full_name || 'New user'} signed up`,
          created_at: s.created_at,
        })
      }

      for (const l of (recentLeadsRes.data ?? [])) {
        activity.push({
          id: `lead-${l.id}`,
          type: 'lead',
          description: `Lead parsed: ${l.parsed_summary?.slice(0, 60) || l.profession || 'Unknown'}`,
          created_at: l.created_at,
        })
      }

      for (const s of recentSubs) {
        const name = (s as any).profiles?.full_name || 'Unknown'
        activity.push({
          id: `sub-${s.id}`,
          type: 'payment',
          description: `Subscription ${s.status} for ${name}`,
          created_at: s.created_at,
        })
      }

      for (const n of (nudgesRes.data ?? []).slice(0, 5)) {
        activity.push({
          id: `nudge-${n.id}`,
          type: 'nudge',
          description: `Nudge ${n.nudge_key} → ${n.phone} (${n.status})`,
          created_at: n.created_at,
        })
      }

      activity.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

      // --- Build metrics ---
      const metrics: HealthMetrics = {
        leadsToday: leadsRes.count ?? 0,
        leadsYesterday: leadsYesterdayRes.count ?? 0,
        activeGroups: activeGroupsRes.count ?? 0,
        messagesToday: 0, // groups.message_count is cumulative, not per-day
        cronRunsToday: cronRuns.length,
        totalUsers: profilesCount,
        nudgesToday: nudgesTodayRes.count ?? 0,
      }

      setData({
        services,
        errors: errors.slice(0, 20),
        activity: activity.slice(0, 20),
        metrics,
        loading: false,
        lastRefresh: now,
      })
    } catch (err) {
      console.error('Failed to load system health:', err)
      setData(prev => ({ ...prev, loading: false }))
    }
  }, [])

  useEffect(() => {
    fetchAll()
    const interval = setInterval(fetchAll, REFRESH_INTERVAL)
    return () => clearInterval(interval)
  }, [fetchAll])

  return { ...data, refresh: fetchAll }
}

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}
