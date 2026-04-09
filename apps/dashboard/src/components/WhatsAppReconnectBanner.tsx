import { useState } from 'react'
import { X } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { useContractor } from '../lib/useContractor'
import WhatsAppWindowCountdown from './WhatsAppWindowCountdown'

export default function WhatsAppReconnectBanner() {
  const { profile } = useAuth()
  const { contractor } = useContractor()
  const [dismissed, setDismissed] = useState(() => sessionStorage.getItem('wa_reconnect_dismissed') === '1')

  if (dismissed || !profile?.id) return null
  if (!profile.role || !['contractor', 'admin'].includes(profile.role)) return null
  if (!contractor?.wa_notify) return null

  const windowExpired = !contractor.wa_window_until || new Date(contractor.wa_window_until) < new Date()
  // Only show banner-style when expired — countdown is inline in dashboard
  if (!windowExpired) return null

  function handleDismiss() {
    sessionStorage.setItem('wa_reconnect_dismissed', '1')
    setDismissed(true)
  }

  return (
    <div className="mx-4 mt-3 mb-1 flex items-center gap-2">
      <div className="flex-1">
        <WhatsAppWindowCountdown />
      </div>
      <button onClick={handleDismiss} className="text-red-300 hover:text-red-500 transition-colors flex-shrink-0 p-1">
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}
