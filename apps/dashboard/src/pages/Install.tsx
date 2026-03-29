import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle, ChevronRight, Download, Zap } from 'lucide-react'

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

// Animated counter for the "3 seconds" claim
function AnimatedTimer() {
  const [count, setCount] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const interval = setInterval(() => {
      setCount(prev => {
        if (prev >= 3) { clearInterval(interval); return 3 }
        return prev + 1
      })
    }, 400)
    return () => clearInterval(interval)
  }, [])

  return (
    <span ref={ref} className="tabular-nums">{count}</span>
  )
}

export default function Install() {
  const navigate = useNavigate()
  const [platform] = useState<Platform>(detectPlatform)
  const [installed, setInstalled] = useState(false)
  const [inWebView] = useState(isWebView)
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    if (isStandalone()) {
      setInstalled(true)
      setTimeout(() => navigate('/complete-account'), 1200)
    }
  }, [])

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
    { icon: '⬆️', title: 'Tap Share', desc: 'Bottom bar in Safari' },
    { icon: '➕', title: 'Add to Home Screen', desc: 'Scroll down in the menu' },
    { icon: '✅', title: 'Tap "Add"', desc: 'Top right corner' },
  ]

  const androidSteps = [
    { icon: '⋮', title: 'Tap Menu', desc: '3 dots, top right' },
    { icon: '📲', title: 'Install App', desc: 'Or "Add to Home Screen"' },
    { icon: '✅', title: 'Tap Install', desc: 'Confirm the prompt' },
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
        <div className="flex items-center justify-center gap-2.5 mb-10">
          <img src="/icon.png" alt="" className="w-8 h-8 rounded-xl" />
          <span className="text-base font-semibold tracking-tight text-gray-900">MasterLeadFlow</span>
        </div>

        {/* Hero — big countdown claim */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-[#fe5b25]/10 text-[#fe5b25] rounded-full px-4 py-1.5 text-xs font-bold mb-5 tracking-wide uppercase">
            <Zap className="w-3.5 h-3.5" />
            Takes <AnimatedTimer /> seconds
          </div>

          <h1 className="text-[2rem] leading-[1.1] font-bold tracking-[-0.03em] text-gray-900 mb-3">
            Never miss a lead
            <br />
            <span style={{ color: '#fe5b25' }}>again.</span>
          </h1>

          <p className="text-gray-500 text-[15px] leading-relaxed max-w-[300px] mx-auto">
            Install the app and get instant push alerts the moment a matching job drops.
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
                Open in {platform === 'ios' ? 'Safari' : 'Chrome'}
              </p>
              <p className="text-gray-400 text-xs mb-5 leading-relaxed">
                You're inside an in-app browser.<br />
                Tap below to open in your real browser.
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
            <div className="rounded-2xl bg-white border border-gray-100 shadow-[0_2px_40px_-12px_rgba(0,0,0,0.08)] overflow-hidden mb-4">
              {/* Header */}
              <div className="px-5 pt-5 pb-3">
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">
                  {platform === 'ios' ? 'Safari' : 'Chrome'} — 3 quick taps
                </p>
              </div>

              {/* Steps */}
              <div className="px-5 pb-5 space-y-0">
                {steps.map((step, i) => (
                  <div key={i} className="flex items-center gap-4 py-3.5 border-b border-gray-50 last:border-0">
                    {/* Number circle */}
                    <div className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-lg"
                      style={{
                        background: i === 0 ? '#fe5b2512' : i === 1 ? '#3b82f612' : '#22c55e12',
                      }}>
                      {step.icon}
                    </div>
                    {/* Text */}
                    <div className="flex-1 min-w-0">
                      <p className="text-gray-900 text-[15px] font-semibold leading-tight">{step.title}</p>
                      <p className="text-gray-400 text-xs mt-0.5">{step.desc}</p>
                    </div>
                    {/* Step number */}
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center">
                      <span className="text-[10px] font-bold text-gray-400">{i + 1}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
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
        .animate-in { animation: animate-in 0.5s ease-out; }
      `}</style>
    </div>
  )
}
