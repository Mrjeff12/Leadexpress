import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle, Share, MoreVertical, Plus, Download, ArrowRight, Smartphone } from 'lucide-react'

type Platform = 'ios' | 'android' | 'desktop'

function detectPlatform(): Platform {
  const ua = navigator.userAgent
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios'
  if (/Android/i.test(ua)) return 'android'
  return 'desktop'
}

function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches
    || ('standalone' in navigator && (navigator as any).standalone === true)
}

function isWebView(): boolean {
  const ua = navigator.userAgent
  // WhatsApp in-app browser, Facebook, Instagram, etc.
  return /FBAN|FBAV|Instagram|WhatsApp|Line/i.test(ua)
    || (/wv/i.test(ua) && /Android/i.test(ua))
}

export default function Install() {
  const navigate = useNavigate()
  const [platform] = useState<Platform>(detectPlatform)
  const [installed, setInstalled] = useState(false)
  const [inWebView] = useState(isWebView)
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)

  useEffect(() => {
    if (isStandalone()) {
      setInstalled(true)
      setTimeout(() => navigate('/complete-account'), 1500)
    }
  }, [])

  // Listen for the beforeinstallprompt event (Chrome/Android)
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  async function handleNativeInstall() {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const result = await deferredPrompt.userChoice
    if (result.outcome === 'accepted') {
      setInstalled(true)
      setTimeout(() => navigate('/complete-account'), 1500)
    }
    setDeferredPrompt(null)
  }

  function handleOpenInBrowser() {
    // Try to open in the device's default browser
    const url = window.location.href
    window.open(url, '_system')
  }

  if (installed) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'linear-gradient(135deg, #fafafa 0%, #fff5f0 100%)' }}>
        <div className="text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">App Installed!</h1>
          <p className="text-gray-500">Redirecting to your account setup...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      <div className="fixed inset-0 bg-gradient-to-br from-slate-50 via-gray-50 to-orange-50/30" />
      <div className="relative z-10 w-full max-w-lg">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2.5 mb-6">
          <img src="/icon.png" alt="MasterLeadFlow" className="w-9 h-9 rounded-xl shadow-md shadow-orange-200/50" />
          <span className="text-lg font-semibold tracking-tight text-gray-900">MasterLeadFlow</span>
        </div>

        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-100 to-amber-50 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-orange-100/50">
            <Smartphone className="w-8 h-8 text-[#fe5b25]" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight mb-2">
            Install the App
          </h1>
          <p className="text-gray-500 text-sm max-w-xs mx-auto">
            Get instant push notifications for new leads — even when your browser is closed.
          </p>
        </div>

        {/* Benefits */}
        <div className="space-y-2.5 mb-6">
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-green-50/80 border border-green-100">
            <span className="text-lg">⚡</span>
            <span className="text-gray-700 text-sm font-medium">Instant alerts — be first to grab leads</span>
          </div>
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-blue-50/80 border border-blue-100">
            <span className="text-lg">📱</span>
            <span className="text-gray-700 text-sm font-medium">Works like a native app on your phone</span>
          </div>
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-purple-50/80 border border-purple-100">
            <span className="text-lg">🔕</span>
            <span className="text-gray-700 text-sm font-medium">Only relevant jobs — no spam, ever</span>
          </div>
        </div>

        {/* WebView warning */}
        {inWebView && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 mb-5 text-center">
            <p className="text-amber-800 text-sm font-semibold mb-3">
              Open in your browser first
            </p>
            <p className="text-amber-700 text-xs mb-4">
              You're viewing this inside an app. Tap below to open in {platform === 'ios' ? 'Safari' : 'Chrome'} so you can install.
            </p>
            <button
              onClick={handleOpenInBrowser}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:brightness-110 shadow-md"
              style={{ background: 'linear-gradient(135deg, #fe5b25, #e04d1f)' }}
            >
              Open in {platform === 'ios' ? 'Safari' : 'Chrome'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Native install prompt (Chrome/Android) */}
        {deferredPrompt && !inWebView && (
          <div className="rounded-2xl border border-white/60 bg-white/70 backdrop-blur-2xl shadow-[0_8px_60px_-12px_rgba(0,0,0,0.08)] p-5 mb-5 text-center">
            <button
              onClick={handleNativeInstall}
              className="w-full py-3.5 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 transition-all hover:brightness-110 active:scale-[0.98] shadow-lg shadow-orange-200/50"
              style={{ background: 'linear-gradient(135deg, #fe5b25, #e04d1f)' }}
            >
              <Download className="w-4 h-4" />
              Install MasterLeadFlow
            </button>
          </div>
        )}

        {/* Manual instructions */}
        {!deferredPrompt && !inWebView && (
          <div className="rounded-2xl border border-white/60 bg-white/70 backdrop-blur-2xl shadow-[0_8px_60px_-12px_rgba(0,0,0,0.08)] p-5 mb-5">
            {platform === 'ios' && (
              <>
                <h3 className="text-gray-900 font-semibold text-sm mb-4">How to install on iPhone:</h3>
                <div className="space-y-4">
                  <Step num={1} icon={<Share className="w-5 h-5 text-blue-500" />}>
                    Tap the <strong>Share</strong> button at the bottom of Safari
                  </Step>
                  <Step num={2} icon={<Plus className="w-5 h-5 text-gray-700" />}>
                    Scroll down and tap <strong>"Add to Home Screen"</strong>
                  </Step>
                  <Step num={3} icon={<CheckCircle className="w-5 h-5 text-green-500" />}>
                    Tap <strong>"Add"</strong> in the top right
                  </Step>
                </div>
              </>
            )}

            {platform === 'android' && (
              <>
                <h3 className="text-gray-900 font-semibold text-sm mb-4">How to install on Android:</h3>
                <div className="space-y-4">
                  <Step num={1} icon={<MoreVertical className="w-5 h-5 text-gray-700" />}>
                    Tap the <strong>menu</strong> (3 dots) in the top right
                  </Step>
                  <Step num={2} icon={<Download className="w-5 h-5 text-blue-500" />}>
                    Tap <strong>"Add to Home Screen"</strong> or <strong>"Install app"</strong>
                  </Step>
                  <Step num={3} icon={<CheckCircle className="w-5 h-5 text-green-500" />}>
                    Tap <strong>"Install"</strong> to confirm
                  </Step>
                </div>
              </>
            )}

            {platform === 'desktop' && (
              <div className="text-center py-4">
                <p className="text-gray-700 text-sm mb-4">
                  On desktop, you don't need to install anything — notifications work directly in your browser.
                </p>
                <button
                  onClick={() => navigate('/complete-account')}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white transition-all hover:brightness-110 shadow-lg shadow-orange-200/50"
                  style={{ background: 'linear-gradient(135deg, #fe5b25, #e04d1f)' }}
                >
                  Continue to Setup
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Skip */}
        {platform !== 'desktop' && (
          <div className="text-center">
            <button
              onClick={() => navigate('/complete-account')}
              className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
            >
              Skip for now — I'll install later
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function Step({ num, icon, children }: { num: number; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500">
        {num}
      </div>
      <div className="flex items-center gap-2 pt-1">
        {icon}
        <p className="text-gray-700 text-sm">{children}</p>
      </div>
    </div>
  )
}
