import { useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useToast } from './hooks/use-toast'
import { useI18n } from '../lib/i18n'
import { Bell } from 'lucide-react'
import { useAuth } from '../lib/auth'

export function GlobalNotificationListener() {
  const { toast } = useToast()
  const { locale } = useI18n()
  const { user } = useAuth()
  const isHe = locale === 'he'

  useEffect(() => {
    // Show notification for any logged in user
    if (!user) return

    const ch = supabase
      .channel('global-leads-rt')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'leads' }, (payload) => {
        const newLead = payload.new
        
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
                  {isHe ? 'ליד חדש במערכת!' : 'New Lead in System!'}
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
  }, [toast, isHe, user])

  return null
}
