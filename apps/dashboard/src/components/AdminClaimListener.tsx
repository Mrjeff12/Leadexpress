import { useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useToast } from './hooks/use-toast'
import { useAuth } from '../lib/auth'
import { CheckCircle2 } from 'lucide-react'

/**
 * Listens for lead_claimed pipeline events in realtime and shows
 * a toast notification to admin users.
 */
export function AdminClaimListener() {
  const { toast } = useToast()
  const { isAdmin } = useAuth()

  useEffect(() => {
    if (!isAdmin) return

    const ch = supabase
      .channel('admin-claims-rt')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'pipeline_events' },
        (payload) => {
          const evt = payload.new as Record<string, any>
          if (evt.stage !== 'lead_claimed') return

          const detail = evt.detail || {}
          const contractorId = detail.contractor_id || 'Unknown'
          const leadId = detail.lead_id || 'Unknown'

          toast({
            title: (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-green-400 to-emerald-600 p-[2px] flex-shrink-0">
                  <div className="w-full h-full bg-white rounded-full flex items-center justify-center">
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                  </div>
                </div>
                <div className="flex flex-col">
                  <span className="font-bold text-sm">Lead Claimed!</span>
                  <span className="text-xs text-gray-500 font-normal mt-0.5">
                    Lead {leadId.slice(0, 8)}... claimed via WhatsApp
                  </span>
                </div>
              </div>
            ) as any,
            duration: 6000,
            className: 'border-none shadow-xl rounded-2xl bg-white/95 backdrop-blur-md p-3',
          })
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(ch)
    }
  }, [toast, isAdmin])

  return null
}
