import { useState, useEffect } from 'react'
import { MessageCircle, X } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'

const REBECA_PHONE = '14155238886'
const WA_LINK = `https://wa.me/${REBECA_PHONE}?text=${encodeURIComponent('👋')}`

export default function WhatsAppReconnectBanner() {
  const { profile } = useAuth()
  const [show, setShow] = useState(false)
  const [dismissed, setDismissed] = useState(() => sessionStorage.getItem('wa_reconnect_dismissed') === '1')

  useEffect(() => {
    if (!profile?.id || dismissed) return
    // Only relevant for contractor role
    if (!profile.role || !['contractor', 'admin'].includes(profile.role)) return

    supabase
      .from('contractors')
      .select('wa_notify, wa_window_until')
      .eq('user_id', profile.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return
        if (!data.wa_notify) return // Not opted in to WhatsApp

        const windowExpired = !data.wa_window_until || new Date(data.wa_window_until) < new Date()
        if (windowExpired) setShow(true)
      })
  }, [profile?.id, dismissed])

  if (!show || dismissed) return null

  function handleDismiss() {
    sessionStorage.setItem('wa_reconnect_dismissed', '1')
    setDismissed(true)
  }

  return (
    <div className="mx-4 mt-3 mb-1 flex items-center gap-3 px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200 shadow-sm">
      <MessageCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
      <p className="text-xs text-emerald-800 font-medium flex-1">
        Your WhatsApp is disconnected — you're missing leads!
      </p>
      <a
        href={WA_LINK}
        target="_blank"
        rel="noopener noreferrer"
        className="px-3 py-1.5 rounded-lg bg-[#25D366] text-white text-xs font-semibold hover:brightness-110 transition-all flex-shrink-0"
      >
        Reconnect
      </a>
      <button onClick={handleDismiss} className="text-emerald-400 hover:text-emerald-600 transition-colors flex-shrink-0">
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}
