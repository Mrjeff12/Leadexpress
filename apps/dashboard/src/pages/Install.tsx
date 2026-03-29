import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle, ChevronRight, Download, Zap, ExternalLink } from 'lucide-react'

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
  return /FBAN|FBAV|Instagram|WhatsApp|Line/i.test(ua)
    || (/wv/i.test(ua) && /Android/i.test(ua))
}

export default function Install() {
  const navigate = useNavigate()
  const [platform] = useState<Platform>(detectPlatform)
  const [installed, setInstalled] = useState(false)
  const [inWebView] = useState(isWebView)
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [mounted, setMounted] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  useEffect(() => {
    setMounted(true)
    if (isStandalone()) {
      setInstalled(true)
      setTimeout(() => navigate('/complete-account'), 1200)
    }
  }, [])

  // Poll for standalone mode after user says they added it
  useEffect(() => {
    if (!showConfirm) return
    const interval = setInterval(() => {
      if (isStandalone()) {
        setInstalled(true)
        setTimeout(() => navigate('/complete-account'), 1200)
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [showConfirm])

  useEffect(() => {
    const handler = (e: Event) => { e.preventDefault(); setDeferredPrompt(e) }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  async function handleNativeInstall() {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const result = await deferredPrompt.userChoice
    if (result.outcome === 'accepted') {
      setInstalled(true)
      setTimeout(() => navigate('/complete-account'), 1200)
    }
    setDeferredPrompt(null)
  }

  function handleOpenInBrowser() {
    window.open(window.location.href, '_system')
  }

  function handleConfirmInstalled() {
    if (isStandalone()) {
      setInstalled(true)
      setTimeout(() => navigate('/complete-account'), 1200)
    } else {
      // They said they did it but they're not in standalone — move them forward anyway
      navigate('/complete-account')
    }
  }

  // ── Success state ──
  if (installed) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#faf9f6' }}>
        <div className="text-center animate-in">
          <div className="w-20 h-20 rounded-full bg-green-500 flex items-center justify-center mx-auto mb-5 shadow-lg shadow-green-200">
            <CheckCircle className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Installed!</h1>
          <p className="text-gray-500">Opening your dashboard...</p>
        </div>
      </div>
    )
  }

  const iosSteps = [
    {
      icon: <ExternalLink className="w-5 h-5 text-[#fe5b25]" />,
      title: 'Tap the Share button',
      desc: 'The square icon with an arrow at the bottom of your screen',
      highlight: 'Look for ⬆️ at the bottom bar',
    },
    {
      icon: <span className="text-lg">➕</span>,
      title: '"Add to Home Screen"',
      desc: 'Scroll down in the share menu until you see it',
      highlight: 'You may need to scroll down',
    },
    {
      icon: <CheckCircle className="w-5 h-5 text-green-500" />,
      title: 'Tap "Add" (top right)',
      desc: 'The app icon will appear on your home screen',
      highlight: 'Top-right corner',
    },
  ]

  const androidSteps = [
    {
      icon: <span className="text-xl font-bold text-gray-700">⋮</span>,
      title: 'Tap the 3-dot menu',
      desc: 'Top-right corner of Chrome',
      highlight: 'The ⋮ icon at the top',
    },
    {
      icon: <Download className="w-5 h-5 text-blue-500" />,
      title: '"Install App" or "Add to Home Screen"',
      desc: 'Look for it in the dropdown menu',
      highlight: 'Might say "Install" or "Add to Home"',
    },
    {
      icon: <CheckCircle className="w-5 h-5 text-green-500" />,
      title: 'Tap "Install" to confirm',
      desc: 'The app will be added to your phone',
      highlight: 'Tap Install on the popup',
    },
  ]

  const steps = platform === 'ios' ? iosSteps : androidSteps

  return (
    <div className="min-h-screen relative overflow-hidden" style={{ background: '#faf9f6' }}>
      {/* Background elements */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full blur-[120px] opacity-30"
        style={{ background: 'radial-gradient(circle, #fe5b2520 0%, transparent 70%)' }} />
      <div className="absolute bottom-0 right-0 w-[400px] h-[300px] rounded-full blur-[100px] opacity-20"
        style={{ background: 'radial-gradient(circle, #25D36615 0%, transparent 70%)' }} />

      {/* Subtle dot grid */}
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: 'radial-gradient(circle at 1px 1px, #000 0.5px, transparent 0)',
        backgroundSize: '40px 40px',
      }} />

      <div className={`relative z-10 max-w-md mx-auto px-5 py-10 transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
        {/* Logo */}
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <img src="/icon.png" alt="" className="w-8 h-8 rounded-xl" />
          <span className="text-base font-semibold tracking-tight text-gray-900">MasterLeadFlow</span>
        </div>

        {/* Hero */}
        <div className="text-center mb-8">
          <h1 className="text-[1.75rem] leading-[1.15] font-bold tracking-[-0.03em] text-gray-900 mb-3">
            Add to your Home Screen
            <br />
            <span className="text-[#fe5b25]">to get lead alerts</span>
          </h1>

          <p className="text-gray-500 text-[15px] leading-relaxed max-w-[320px] mx-auto">
            {platform === 'ios'
              ? 'Follow these 3 steps in Safari to install the app:'
              : 'Follow these 3 steps in Chrome to install the app:'}
          </p>
        </div>

        {/* WebView blocker */}
        {inWebView ? (
          <div className={`transition-all duration-500 delay-200 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
            <div className="rounded-2xl bg-white border border-gray-100 shadow-[0_2px_40px_-12px_rgba(0,0,0,0.08)] p-6 text-center mb-4">
              <div className="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">🌐</span>
              </div>
              <p className="text-gray-900 font-semibold text-[15px] mb-1.5">
                Open in {platform === 'ios' ? 'Safari' : 'Chrome'} first
              </p>
              <p className="text-gray-400 text-xs mb-5 leading-relaxed">
                You're inside an in-app browser (like WhatsApp).<br />
                Tap below to open in your real browser, then follow the steps.
              </p>
              <button
                onClick={handleOpenInBrowser}
                className="w-full py-3.5 rounded-2xl text-sm font-semibold text-white flex items-center justify-center gap-2 transition-all hover:brightness-110 active:scale-[0.97]"
                style={{ background: '#fe5b25', boxShadow: '0 4px 20px #fe5b2530' }}
              >
                Open in {platform === 'ios' ? 'Safari' : 'Chrome'}
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : deferredPrompt ? (
          /* Native install prompt (Chrome/Android) */
          <div className={`transition-all duration-500 delay-200 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
            <button
              onClick={handleNativeInstall}
              className="w-full py-4 rounded-2xl text-base font-semibold text-white flex items-center justify-center gap-2.5 transition-all hover:brightness-110 active:scale-[0.97] mb-6"
              style={{ background: '#fe5b25', boxShadow: '0 4px 24px #fe5b2535' }}
            >
              <Download className="w-5 h-5" />
              Install Now — It's Free
            </button>
          </div>
        ) : platform === 'desktop' ? (
          /* Desktop — no install needed */
          <div className={`transition-all duration-500 delay-200 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
            <div className="rounded-2xl bg-white border border-gray-100 shadow-[0_2px_40px_-12px_rgba(0,0,0,0.08)] p-6 text-center mb-4">
              <div className="w-14 h-14 rounded-2xl bg-green-50 flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-7 h-7 text-green-500" />
              </div>
              <p className="text-gray-900 font-semibold text-[15px] mb-1.5">
                No install needed
              </p>
              <p className="text-gray-400 text-xs mb-5">
                On desktop, notifications work directly in your browser.
              </p>
              <button
                onClick={() => navigate('/complete-account')}
                className="w-full py-3.5 rounded-2xl text-sm font-semibold text-white flex items-center justify-center gap-2 transition-all hover:brightness-110 active:scale-[0.97]"
                style={{ background: '#fe5b25', boxShadow: '0 4px 20px #fe5b2530' }}
              >
                Continue Setup
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          /* Mobile install steps (iOS / Android) */
          <div className={`transition-all duration-500 delay-300 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
            <div className="rounded-2xl bg-white border border-gray-100 shadow-[0_2px_40px_-12px_rgba(0,0,0,0.08)] overflow-hidden mb-5">
              {/* Header */}
              <div className="px-5 pt-5 pb-2">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg flex items-center justify-center"
                    style={{ background: platform === 'ios' ? '#007AFF15' : '#4285F415' }}>
                    <span className="text-xs">{platform === 'ios' ? '🍎' : '🟢'}</span>
                  </div>
                  <p className="text-[12px] font-bold text-gray-500 uppercase tracking-wider">
                    {platform === 'ios' ? 'iPhone / iPad — Safari' : 'Android — Chrome'}
                  </p>
                </div>
              </div>

              {/* Steps */}
              <div className="px-5 pb-5 space-y-0">
                {steps.map((s, i) => (
                  <div key={i} className="flex items-start gap-4 py-4 border-b border-gray-50 last:border-0">
                    {/* Step number + icon */}
                    <div className="flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center"
                      style={{
                        background: i === 0 ? '#fe5b2510' : i === 1 ? '#3b82f610' : '#22c55e10',
                      }}>
                      {s.icon}
                    </div>
                    {/* Text */}
                    <div className="flex-1 min-w-0 pt-0.5">
                      <p className="text-gray-900 text-[15px] font-semibold leading-tight">{s.title}</p>
                      <p className="text-gray-400 text-[13px] mt-1 leading-snug">{s.desc}</p>
                      <div className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 border border-amber-100">
                        <span className="text-amber-600 text-[11px] font-medium">{s.highlight}</span>
                      </div>
                    </div>
                    {/* Step badge */}
                    <div className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center mt-0.5"
                      style={{ background: '#fe5b2515' }}>
                      <span className="text-[11px] font-bold text-[#fe5b25]">{i + 1}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Confirmation: "Did you add it?" ── */}
            {!showConfirm ? (
              <button
                onClick={() => setShowConfirm(true)}
                className="w-full py-4 rounded-2xl text-base font-semibold text-white flex items-center justify-center gap-2.5 transition-all hover:brightness-110 active:scale-[0.97] mb-3"
                style={{ background: '#fe5b25', boxShadow: '0 4px 24px #fe5b2535' }}
              >
                <CheckCircle className="w-5 h-5" />
                Done — I've added it!
              </button>
            ) : (
              <div className="rounded-2xl bg-white border-2 border-[#fe5b25]/20 shadow-lg p-5 text-center mb-3 animate-in">
                <p className="text-gray-900 font-semibold text-[15px] mb-1">
                  Did you add it to your Home Screen?
                </p>
                <p className="text-gray-400 text-xs mb-4">
                  If yes, you'll see the MasterLeadFlow icon on your phone.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={handleConfirmInstalled}
                    className="flex-1 py-3 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 transition-all hover:brightness-110 active:scale-[0.97]"
                    style={{ background: '#22c55e', boxShadow: '0 4px 16px #22c55e30' }}
                  >
                    <CheckCircle className="w-4 h-4" />
                    Yes!
                  </button>
                  <button
                    onClick={() => setShowConfirm(false)}
                    className="flex-1 py-3 rounded-xl text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-all active:scale-[0.97]"
                  >
                    Not yet
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Benefits — horizontal scroll pills */}
        <div className={`flex gap-2 justify-center flex-wrap mb-6 transition-all duration-500 delay-500 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          {[
            { emoji: '⚡', text: 'Instant alerts' },
            { emoji: '🔕', text: 'No spam' },
            { emoji: '📱', text: 'Works offline' },
          ].map((b, i) => (
            <div key={i} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-gray-100 text-xs text-gray-600 font-medium shadow-sm">
              <span>{b.emoji}</span>
              {b.text}
            </div>
          ))}
        </div>

        {/* Skip */}
        {platform !== 'desktop' && (
          <div className={`text-center transition-all duration-500 delay-700 ${mounted ? 'opacity-100' : 'opacity-0'}`}>
            <button
              onClick={() => navigate('/complete-account')}
              className="text-[13px] text-gray-400 hover:text-gray-600 transition-colors"
            >
              Skip — I'll install later
            </button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes animate-in {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-in { animation: animate-in 0.3s ease-out; }
      `}</style>
    </div>
  )
}
