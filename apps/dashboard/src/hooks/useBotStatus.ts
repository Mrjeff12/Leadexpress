import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { DateRange } from './useDateFilter'

export interface BotStatus {
  active: boolean
  messagesSent: number
  errors: number
  lastActive: string | null
}

export function useBotStatus(dateRange?: DateRange) {
  const [data, setData] = useState<BotStatus>({
    active: false,
    messagesSent: 0,
    errors: 0,
    lastActive: null,
  })

  const from = dateRange?.from
  const to = dateRange?.to

  useEffect(() => {
    async function fetchStatus() {
      try {
        const rangeFrom = from ?? new Date().toISOString().slice(0, 10)
        const rangeTo = to ?? rangeFrom
        const rangeToEnd = rangeTo + 'T23:59:59.999Z'

        // Check bot_messages or outbound messages sent in the date range
        // Using leads with status='sent' as a proxy for bot activity
        const [sentRes, recentRes] = await Promise.all([
          supabase.from('leads').select('id', { count: 'exact', head: true })
            .eq('status', 'sent')
            .gte('created_at', rangeFrom)
            .lte('created_at', rangeToEnd),
          // Check if there's recent activity (last 5 minutes) to determine if bot is active
          supabase.from('leads').select('created_at')
            .order('created_at', { ascending: false })
            .limit(1),
        ])

        const lastLead = recentRes.data?.[0] as any
        const lastActive = lastLead?.created_at ?? null
        const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
        const isActive = lastActive ? lastActive > fiveMinAgo : false

        setData({
          active: isActive,
          messagesSent: sentRes.count ?? 0,
          errors: 0,
          lastActive,
        })
      } catch (err) {
        console.error('[useBotStatus] Error:', err)
        setData(prev => ({ ...prev, active: false }))
      }
    }

    fetchStatus()
    const interval = setInterval(fetchStatus, 30_000)
    return () => clearInterval(interval)
  }, [from, to])

  return data
}
