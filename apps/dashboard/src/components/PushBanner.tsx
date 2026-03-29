import { useState } from 'react'
import { Bell, X } from 'lucide-react'
import { usePushNotifications } from '../hooks/usePushNotifications'
import { useNavigate } from 'react-router-dom'

export default function PushBanner() {
  const { status } = usePushNotifications()
  const navigate = useNavigate()
  const [dismissed, setDismissed] = useState(() => sessionStorage.getItem('push_banner_dismissed') === '1')

  if (dismissed || status !== 'default') return null

  function handleDismiss() {
    sessionStorage.setItem('push_banner_dismissed', '1')
    setDismissed(true)
  }

  return (
    <div className="mx-4 mt-3 mb-1 flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 shadow-sm">
      <Bell className="w-4 h-4 text-amber-600 flex-shrink-0" />
      <p className="text-xs text-amber-800 font-medium flex-1">
        Enable alerts to start your free trial
      </p>
      <button
        onClick={() => navigate('/enable-alerts')}
        className="px-3 py-1.5 rounded-lg bg-[#fe5b25] text-white text-xs font-semibold hover:brightness-110 transition-all flex-shrink-0"
      >
        Enable
      </button>
      <button onClick={handleDismiss} className="text-amber-400 hover:text-amber-600 transition-colors flex-shrink-0">
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}
