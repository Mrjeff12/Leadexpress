import { useState, useEffect } from 'react'
import { useI18n } from '../lib/i18n'
import { supabase } from '../lib/supabase'
import { Radio, MessageSquare, Wifi, WifiOff, Users, Shield, ShoppingCart } from 'lucide-react'

interface Group {
  id: string
  name: string
  wa_group_id: string
  status: string           // 'active' | 'inactive' — actual DB column
  message_count: number
  total_members: number
  known_sellers: number
  known_buyers: number
  last_message_at: string | null
  created_at: string
}

export default function AdminGroups() {
  const { locale } = useI18n()
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetch() {
      const { data, error } = await supabase
        .from('groups')
        .select('*')
        .order('created_at', { ascending: false })

      if (!error && data) {
        setGroups(data as Group[])
      }
      setLoading(false)
    }
    fetch()
  }, [])

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="text-xl font-semibold" style={{ color: 'hsl(40 8% 10%)' }}>
          {locale === 'he' ? 'קבוצות WhatsApp' : 'WhatsApp Groups'}
        </h1>
        <p className="text-sm mt-1" style={{ color: 'hsl(40 4% 42%)' }}>
          {locale === 'he' ? 'קבוצות שמנוטרות לליד חדשים' : 'Groups being monitored for new leads'}
        </p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="glass-panel p-5 animate-pulse">
              <div className="h-4 bg-black/[0.04] rounded w-1/3 mb-2" />
              <div className="h-3 bg-black/[0.04] rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : groups.length === 0 ? (
        <div className="glass-panel p-12 text-center">
          <Radio className="w-10 h-10 mx-auto mb-3" style={{ color: 'hsl(40 4% 42%)' }} />
          <p className="text-sm" style={{ color: 'hsl(40 4% 42%)' }}>
            {locale === 'he' ? 'אין קבוצות מנוטרות עדיין' : 'No monitored groups yet'}
          </p>
          <p className="text-xs mt-1" style={{ color: 'hsl(40 4% 55%)' }}>
            {locale === 'he'
              ? 'הפעל את ה-WA Listener כדי להתחיל לנטר קבוצות'
              : 'Start the WA Listener to begin monitoring groups'}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 stagger-children">
          {groups.map((group) => (
            <div key={group.id} className="glass-panel p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{
                    background: group.status === 'active'
                      ? 'hsl(152 46% 85% / 0.5)'
                      : 'hsl(0 80% 93% / 0.5)',
                  }}
                >
                  {group.status === 'active' ? (
                    <Wifi className="w-5 h-5" style={{ color: 'hsl(155 44% 30%)' }} />
                  ) : (
                    <WifiOff className="w-5 h-5" style={{ color: 'hsl(0 60% 50%)' }} />
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium" style={{ color: 'hsl(40 8% 10%)' }}>
                    {group.name}
                  </p>
                  <p className="text-xs" style={{ color: 'hsl(40 4% 42%)' }}>
                    ID: {group.wa_group_id.slice(0, 20)}...
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-3 text-xs" style={{ color: 'hsl(40 4% 42%)' }}>
                  <span className="flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    {group.total_members} {locale === 'he' ? 'חברים' : 'members'}
                  </span>
                  <span className="flex items-center gap-1">
                    <MessageSquare className="w-3 h-3" />
                    {group.message_count} {locale === 'he' ? 'הודעות' : 'messages'}
                  </span>
                </div>
                <span className={`badge ${group.status === 'active' ? 'badge-green' : 'badge-red'}`}>
                  {group.status === 'active'
                    ? locale === 'he' ? 'פעיל' : 'Active'
                    : locale === 'he' ? 'מושבת' : 'Paused'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
