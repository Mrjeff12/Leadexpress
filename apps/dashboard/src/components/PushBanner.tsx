// apps/dashboard/src/components/PushBanner.tsx
import { Bell, Loader2 } from 'lucide-react'
import { usePushNotifications } from '../hooks/usePushNotifications'
import { useAuth } from '../lib/auth'

export function PushBanner() {
  const { user } = useAuth()
  const { status, enable, isLoading } = usePushNotifications()

  if (!user) return null
  if (status === 'granted' || status === 'unsupported' || status === 'loading') return null
  if (status === 'denied') return null

  const isIos = /iPhone|iPad|iPod/i.test(navigator.userAgent)
  const isInStandaloneMode =
    'standalone' in window.navigator && (window.navigator as any).standalone === true
  const showIosHint = isIos && !isInStandaloneMode

  return (
    <div
      className="w-full flex items-center justify-between gap-3 px-4 py-2.5 text-white text-sm font-medium z-30"
      style={{
        background: 'linear-gradient(90deg, #fe5b25 0%, #ff8c42 100%)',
        minHeight: '44px',
      }}
    >
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <Bell className="w-4 h-4 flex-shrink-0" />
        <span className="truncate">
          {showIosHint
            ? '📱 Tap Share → Add to Home Screen, then enable notifications'
            : "🔔 Enable notifications — get leads instantly, even when this tab is closed"}
        </span>
      </div>

      {!showIosHint && (
        <button
          onClick={enable}
          disabled={isLoading}
          className="flex-shrink-0 flex items-center gap-1.5 bg-white/20 hover:bg-white/30 active:bg-white/40 transition-colors rounded-lg px-3 py-1 text-xs font-semibold whitespace-nowrap disabled:opacity-60"
        >
          {isLoading ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            'Enable'
          )}
        </button>
      )}
    </div>
  )
}
