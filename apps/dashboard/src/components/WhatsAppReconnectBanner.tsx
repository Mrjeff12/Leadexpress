import { useState } from 'react'
import { MessageCircle, X } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { useContractor } from '../lib/useContractor'

const REBECA_PHONE = '14155238886'
const WA_LINK = `https://wa.me/${REBECA_PHONE}?text=${encodeURIComponent('👋')}`

export default function WhatsAppReconnectBanner() {
  const { profile } = useAuth()
  const { contractor } = useContractor()
  const [dismissed, setDismissed] = useState(() => sessionStorage.getItem('wa_reconnect_dismissed') === '1')

  if (dismissed || !profile?.id) return null
  if (!profile.role || !['contractor', 'admin'].includes(profile.role)) return null
  if (!contractor?.wa_notify) return null

  const windowExpired = !contractor.wa_window_until || new Date(contractor.wa_window_until) < new Date()
  if (!windowExpired) return null

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
