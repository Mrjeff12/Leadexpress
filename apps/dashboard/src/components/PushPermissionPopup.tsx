import { useState, useEffect } from 'react'
import { Bell, X, AlertTriangle } from 'lucide-react'
import { usePushNotifications } from '../hooks/usePushNotifications'
import { useAuth } from '../lib/auth'

const DISMISS_KEY = 'mlf_push_popup_dismissed_at'
const DISMISS_COOLDOWN_MS = 24 * 60 * 60 * 1000 // Re-show after 24 hours

/**
 * Full-screen popup that appears when user enters the app
 * and push notifications are not enabled (status === 'default').
 * Dismissable, but re-appears after 24 hours.
 */
export default function PushPermissionPopup() {
  const { user } = useAuth()
  const { status, enable, isLoading } = usePushNotifications()
  const [visible, setVisible] = useState(false)
  const [enabling, setEnabling] = useState(false)

  useEffect(() => {
    // Only show for logged-in users with default (not yet asked) push status
    if (!user || status !== 'default') {
      setVisible(false)
      return
    }

    // Check cooldown
    const dismissedAt = localStorage.getItem(DISMISS_KEY)
    if (dismissedAt) {
      const elapsed = Date.now() - parseInt(dismissedAt, 10)
      if (elapsed < DISMISS_COOLDOWN_MS) {
        setVisible(false)
        return
      }
    }

    // Small delay so it doesn't flash on page load
    const timer = setTimeout(() => setVisible(true), 800)
    return () => clearTimeout(timer)
  }, [user, status])

  if (!visible) return null

  async function handleEnable() {
    setEnabling(true)
    try {
      await enable()
      setVisible(false)
    } catch (err) {
      console.error('Push enable failed:', err)
    } finally {
      setEnabling(false)
    }
  }

  function handleDismiss() {
    localStorage.setItem(DISMISS_KEY, String(Date.now()))
    setVisible(false)
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-md mx-4 mb-4 sm:mb-0 bg-white rounded-3xl shadow-2xl overflow-hidden animate-slideUp">
        {/* Close button */}
        <div className="flex justify-end p-3 pb-0">
          <button
            onClick={handleDismiss}
            className="p-1.5 rounded-full hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 pb-6 pt-1 text-center">
          {/* Icon */}
          <div className="relative mx-auto w-20 h-20 mb-5">
            <div className="w-20 h-20 rounded-full bg-[#fe5b25]/10 flex items-center justify-center">
              <Bell className="w-10 h-10 text-[#fe5b25]" />
            </div>
            <div className="absolute inset-0 rounded-full border-2 border-[#fe5b25]/20 animate-ping" />
            {/* Badge */}
            <div className="absolute -top-1 -right-1 w-7 h-7 rounded-full bg-red-500 flex items-center justify-center shadow-lg">
              <span className="text-white text-xs font-bold">!</span>
            </div>
          </div>

          <h2 className="text-xl font-bold text-gray-900 mb-2">
            Turn on notifications
          </h2>
          <p className="text-gray-500 text-sm mb-4 leading-relaxed max-w-[280px] mx-auto">
            Get notified instantly when a new job matches your area and profession. Don't miss leads!
          </p>

          {/* Warning box */}
          <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl p-3 mb-6 text-left">
            <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-amber-800 text-xs font-semibold">Without notifications</p>
              <p className="text-amber-600 text-[11px] mt-0.5">You'll miss new leads that match you. Other contractors will grab them first.</p>
            </div>
          </div>

          {/* CTA */}
          <button
            onClick={handleEnable}
            disabled={enabling || isLoading}
            className="w-full py-4 rounded-2xl text-base font-semibold text-white flex items-center justify-center gap-2.5 transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
            style={{ background: '#fe5b25', boxShadow: '0 4px 24px #fe5b2535' }}
          >
            {enabling || isLoading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <Bell className="w-5 h-5" />
                Enable Notifications
              </>
            )}
          </button>

          <button
            onClick={handleDismiss}
            className="w-full py-3 mt-2 text-sm text-gray-400 hover:text-gray-600 transition-colors"
          >
            Not now
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(40px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn { animation: fadeIn 0.25s ease-out; }
        .animate-slideUp { animation: slideUp 0.35s ease-out; }
      `}</style>
    </div>
  )
}
