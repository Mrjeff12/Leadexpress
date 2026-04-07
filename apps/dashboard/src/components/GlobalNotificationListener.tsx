import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useToast } from './hooks/use-toast'
import { useI18n } from '../lib/i18n'
import { Bell } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { useContractor } from '../lib/useContractor'

export function GlobalNotificationListener() {
  const { toast } = useToast()
  const { locale } = useI18n()
  const { user } = useAuth()
  const { contractor } = useContractor()
  const navigate = useNavigate()
  const isHe = locale === 'he'
  const [deferred, setDeferred] = useState(false)

  // Defer realtime subscription — wait 3s after mount so dashboard renders first
  useEffect(() => {
    const t = setTimeout(() => setDeferred(true), 3000)
    return () => clearTimeout(t)
  }, [])

  const professions = contractor?.professions ?? []
  const zipCodes = contractor?.zip_codes ?? []

  // Listen for service worker messages (notification clicks)
  useEffect(() => {
    function handleSWMessage(event: MessageEvent) {
      if (event.data?.type === 'NOTIFICATION_CLICK' && event.data.url) {
        const url = event.data.url
        if (window.location.pathname === url) {
          window.location.reload()
        } else {
          navigate(url)
        }
      }
    }

    navigator.serviceWorker?.addEventListener('message', handleSWMessage)
    return () => {
      navigator.serviceWorker?.removeEventListener('message', handleSWMessage)
    }
  }, [navigate])

  useEffect(() => {
    if (!user || !deferred || professions.length === 0 || zipCodes.length === 0) return

    const ch = supabase
      .channel('global-leads-rt')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'leads' }, (payload) => {
        const newLead = payload.new as Record<string, any>

        // Client-side filter: only show toast if lead matches contractor's professions AND zip codes
        if (!professions.includes(newLead.profession) || !zipCodes.includes(newLead.zip_code)) {
          return
        }

        toast({
          title: (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-pink-500 via-red-500 to-yellow-500 p-[2px] flex-shrink-0">
                <div className="w-full h-full bg-white rounded-full flex items-center justify-center border-2 border-white">
                  <Bell className="w-4 h-4 text-pink-500" />
                </div>
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-sm">
                  {isHe ? 'ליד חדש בשבילך!' : 'New Lead for You!'}
                </span>
                <span className="text-xs text-gray-500 font-normal mt-0.5">
                  {newLead.name || (isHe ? 'ללא שם' : 'Unnamed')} • {newLead.profession || (isHe ? 'כללי' : 'General')}
                </span>
              </div>
            </div>
          ) as any,
          duration: 5000,
          className: "border-none shadow-xl rounded-2xl bg-white/95 backdrop-blur-md p-3",
        })
      })
      .subscribe()

    return () => {
      supabase.removeChannel(ch)
    }
  }, [toast, isHe, user, deferred, professions, zipCodes])

  return null
}
