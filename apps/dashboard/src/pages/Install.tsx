import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle, ChevronRight, Download } from 'lucide-react'
import { supabase } from '../lib/supabase'
import OnboardingProgress from '../components/OnboardingProgress'
import InstallAnimation from '../components/InstallAnimation'

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
  const [platform] = useState<Platform>(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('p') === 'ios') return 'ios'
    if (params.get('p') === 'android') return 'android'
    return detectPlatform()
  })
  const [installed, setInstalled] = useState(false)
  const [inWebView] = useState(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.has('p')) return false
    return isWebView()
  })
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [mounted, setMounted] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  useEffect(() => {
    setMounted(true)
    if (isStandalone()) {
      setInstalled(true)
      updateOnboardingStep()
      setTimeout(() => navigate('/enable-alerts'), 1200)
    }
  }, [])

  // Poll for standalone mode after user confirms
  useEffect(() => {
    if (!showConfirm) return
    const interval = setInterval(() => {
      if (isStandalone()) {
        setInstalled(true)
        updateOnboardingStep()
        setTimeout(() => navigate('/enable-alerts'), 1200)
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [showConfirm])

  useEffect(() => {
    const handler = (e: Event) => { e.preventDefault(); setDeferredPrompt(e) }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  async function updateOnboardingStep() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase.from('contractors').update({ onboarding_step: 'installed' }).eq('user_id', user.id)
      }
    } catch {}
  }

  async function handleNativeInstall() {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const result = await deferredPrompt.userChoice
    if (result.outcome === 'accepted') {
      setInstalled(true)
      updateOnboardingStep()
      setTimeout(() => navigate('/enable-alerts'), 1200)
    }
    setDeferredPrompt(null)
  }

  function handleOpenInBrowser() {
    window.open(window.location.href, '_system')
  }

  function handleConfirmInstalled() {
    updateOnboardingStep()
    if (isStandalone()) {
      setInstalled(true)
      setTimeout(() => navigate('/enable-alerts'), 1200)
    } else {
      navigate('/enable-alerts')
    }
  }

  // Success state
  if (installed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center animate-in">
          <div className="w-20 h-20 rounded-full bg-green-500 flex items-center justify-center mx-auto mb-5 shadow-lg shadow-green-200">
            <CheckCircle className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Added!</h1>
          <p className="text-gray-500">Opening next step...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <div className={`flex-1 flex flex-col px-5 pt-8 pb-6 max-w-md mx-auto w-full transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
        <OnboardingProgress current={2} />

        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-4">
          <img src="/icon.png" alt="" className="w-7 h-7 rounded-xl" />
          <span className="text-sm font-semibold text-gray-900">MasterLeadFlow</span>
        </div>

        {/* Heading */}
        <div className="text-center mb-4">
          <h1 className="text-xl font-bold text-gray-900 mb-1">Install the app</h1>
          <p className="text-gray-500 text-sm">We need this to send you matching leads directly to your phone</p>
          <p className="text-amber-600 text-xs font-medium mt-1">⚡ Without it, you won't receive job alerts</p>
        </div>

        {/* WebView blocker */}
        {inWebView ? (
          <div className="flex-1 flex items-center">
            <div className="rounded-2xl bg-gray-50 border border-gray-100 shadow-lg p-6 text-center w-full">
              <div className="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">🌐</span>
              </div>
              <p className="text-gray-900 font-semibold text-[15px] mb-1.5">
                Open in {platform === 'ios' ? 'Safari' : 'Chrome'} first
              </p>
              <p className="text-gray-400 text-xs mb-5 leading-relaxed">
                You're inside an in-app browser (WhatsApp).<br />
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
          /* Native install (Chrome/Android) */
          <div className="flex-1 flex flex-col items-center justify-center">
            <button
              onClick={handleNativeInstall}
              className="w-full py-4 rounded-2xl text-base font-semibold text-white flex items-center justify-center gap-2.5 transition-all hover:brightness-110 active:scale-[0.97]"
              style={{ background: '#fe5b25', boxShadow: '0 4px 24px #fe5b2535' }}
            >
              <Download className="w-5 h-5" />
              Add to Home Screen — It's Free
            </button>
          </div>
        ) : platform === 'desktop' ? (
          /* Desktop */
          <div className="flex-1 flex items-center">
            <div className="rounded-2xl bg-gray-50 border border-gray-100 shadow-lg p-6 text-center w-full">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
              <p className="text-gray-900 font-semibold text-[15px] mb-1.5">No setup needed</p>
              <p className="text-gray-400 text-xs mb-5">On desktop, notifications work directly in your browser.</p>
              <button
                onClick={() => navigate('/enable-alerts')}
                className="w-full py-3.5 rounded-2xl text-sm font-semibold text-white flex items-center justify-center gap-2 transition-all hover:brightness-110 active:scale-[0.97]"
                style={{ background: '#fe5b25', boxShadow: '0 4px 20px #fe5b2530' }}
              >
                Continue
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          /* Mobile install guide with animation */
          <div className="flex-1 flex flex-col items-center justify-center">
            <InstallAnimation platform={platform as 'ios' | 'android'} />
          </div>
        )}

        {/* CTA buttons (mobile only, not webview, not native) */}
        {!inWebView && !deferredPrompt && platform !== 'desktop' && (
          <div className="space-y-3 mt-4">
            {!showConfirm ? (
              <button
                onClick={() => setShowConfirm(true)}
                className="w-full py-4 rounded-2xl text-base font-semibold text-white flex items-center justify-center gap-2.5 transition-all hover:brightness-110 active:scale-[0.97]"
                style={{ background: '#fe5b25', boxShadow: '0 4px 24px #fe5b2535' }}
              >
                <CheckCircle className="w-5 h-5" />
                Done — I've added it!
              </button>
            ) : (
              <div className="rounded-2xl bg-gray-50 border-2 border-[#fe5b25]/20 shadow-lg p-5 text-center animate-in">
                <p className="text-gray-900 font-semibold text-[15px] mb-1">
                  Did you add it to your Home Screen?
                </p>
                <p className="text-gray-400 text-xs mb-4">
                  Check your phone — you should see the MasterLeadFlow icon.
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

            <button
              onClick={() => navigate('/enable-alerts')}
              className="w-full py-3 text-sm text-gray-400 hover:text-gray-600 transition-colors text-center"
            >
              Skip for now
            </button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes animate-in {
          from { opacity: 0; transform: scale(0.97) translateY(4px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        .animate-in { animation: animate-in 0.25s ease-out; }
        @keyframes tap {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(0.85); }
        }
        @keyframes bounce-once {
          0% { transform: scale(0) translateY(-20px); }
          60% { transform: scale(1.1) translateY(0); }
          80% { transform: scale(0.95); }
          100% { transform: scale(1); }
        }
      `}</style>
    </div>
  )
}
