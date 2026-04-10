import { useEffect, useState } from 'react'

interface PWAInstallState {
  canInstall: boolean
  isInstalled: boolean
  isIOS: boolean
  promptInstall: () => Promise<'accepted' | 'dismissed' | 'unsupported'>
}

// Module-level storage — the beforeinstallprompt event fires once, we capture it.
let deferredPrompt: any = null
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferredPrompt = e
  })
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null
  })
}

function detectStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    ('standalone' in navigator && (navigator as any).standalone === true)
  )
}

function detectIOS(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iPhone|iPad|iPod/i.test(navigator.userAgent)
}

export function usePWAInstall(): PWAInstallState {
  const [canInstall, setCanInstall] = useState(!!deferredPrompt)
  const [isInstalled, setIsInstalled] = useState(detectStandalone())

  useEffect(() => {
    function onPrompt() {
      setCanInstall(true)
    }
    function onInstalled() {
      setIsInstalled(true)
      setCanInstall(false)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unsupported'> {
    if (!deferredPrompt) return 'unsupported'
    deferredPrompt.prompt()
    const choice = await deferredPrompt.userChoice
    deferredPrompt = null
    setCanInstall(false)
    return choice.outcome === 'accepted' ? 'accepted' : 'dismissed'
  }

  return {
    canInstall,
    isInstalled,
    isIOS: detectIOS(),
    promptInstall,
  }
}
