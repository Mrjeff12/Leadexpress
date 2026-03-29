import { useState, useEffect } from 'react'
import { Download, X } from 'lucide-react'
import { useAuth } from '../lib/auth'

function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches
    || ('standalone' in navigator && (navigator as any).standalone === true)
}

function isMobile(): boolean {
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
}

let deferredPrompt: any = null

export function PWAInstallBanner() {
  const { user } = useAuth()
  const [dismissed, setDismissed] = useState(() =>
    sessionStorage.getItem('pwa-banner-dismissed') === '1'
  )
  const [canInstall, setCanInstall] = useState(false)

  useEffect(() => {
    function handleBeforeInstall(e: Event) {
      e.preventDefault()
      deferredPrompt = e
      setCanInstall(true)
    }
    window.addEventListener('beforeinstallprompt', handleBeforeInstall)
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall)
  }, [])

  if (!user) return null
  if (!isMobile()) return null
  if (isStandalone()) return null
  if (dismissed) return null

  function handleDismiss() {
    setDismissed(true)
    sessionStorage.setItem('pwa-banner-dismissed', '1')
  }

  async function handleInstall() {
    if (deferredPrompt) {
      deferredPrompt.prompt()
      await deferredPrompt.userChoice
      deferredPrompt = null
      setCanInstall(false)
    }
  }

  return (
    <div
      className="w-full flex items-center justify-between gap-3 px-4 py-2.5 text-white text-sm font-medium z-30"
      style={{
        background: 'linear-gradient(90deg, #6d28d9 0%, #8b5cf6 100%)',
        minHeight: '44px',
      }}
    >
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <Download className="w-4 h-4 flex-shrink-0" />
        <span className="truncate">
          Install the app for instant lead alerts
        </span>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {canInstall && (
          <button
            onClick={handleInstall}
            className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 active:bg-white/40 transition-colors rounded-lg px-3 py-1 text-xs font-semibold whitespace-nowrap"
          >
            Install
          </button>
        )}
        <button
          onClick={handleDismiss}
          className="p-0.5 rounded hover:bg-white/20 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}
