import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle, ChevronRight, Download } from 'lucide-react'

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

/* ── iOS Safari Share Icon (accurate SVG) ── */
function SafariShareIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12v7a2 2 0 002 2h12a2 2 0 002-2v-7" />
      <polyline points="16 6 12 2 8 6" />
      <line x1="12" y1="2" x2="12" y2="15" />
    </svg>
  )
}

/* ── iOS Step 1: Safari bottom bar with Share highlighted ── */
function IOSStep1() {
  return (
    <div className="rounded-xl overflow-hidden border border-gray-200 bg-[#f2f2f7]">
      {/* Safari URL bar */}
      <div className="bg-[#f2f2f7] px-3 pt-2 pb-1.5">
        <div className="bg-white rounded-lg px-3 py-1.5 flex items-center gap-2 shadow-sm border border-gray-200/60">
          <span className="text-[10px] text-gray-400">🔒</span>
          <span className="text-[11px] text-gray-500 flex-1 text-center">app.masterleadflow.com</span>
        </div>
      </div>
      {/* Page content hint */}
      <div className="bg-white h-12 flex items-center justify-center">
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-5 rounded-md bg-[#fe5b25] flex items-center justify-center">
            <span className="text-[8px] text-white font-bold">M</span>
          </div>
          <span className="text-[11px] font-semibold text-gray-800">MasterLeadFlow</span>
        </div>
      </div>
      {/* Safari bottom toolbar */}
      <div className="bg-[#f2f2f7] border-t border-gray-300/50 px-2 py-2 flex items-center justify-around">
        <span className="text-gray-400 text-lg">‹</span>
        <span className="text-gray-300 text-lg">›</span>
        {/* Share button — highlighted */}
        <div className="relative">
          <div className="absolute -inset-2 rounded-full border-[2.5px] border-[#fe5b25] animate-pulse-ring" />
          <SafariShareIcon className="w-5 h-5 text-[#007AFF]" />
          {/* Arrow pointing to it */}
          <div className="absolute -top-7 left-1/2 -translate-x-1/2 flex flex-col items-center">
            <span className="text-[#fe5b25] text-[10px] font-bold whitespace-nowrap bg-[#fe5b25]/10 px-1.5 py-0.5 rounded">TAP HERE</span>
            <span className="text-[#fe5b25] text-xs">▼</span>
          </div>
        </div>
        <svg className="w-5 h-5 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M4 19.5v-15A2.5 2.5 0 016.5 2H20v20H6.5a2.5 2.5 0 010-5H20" /></svg>
        <svg className="w-5 h-5 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>
      </div>
    </div>
  )
}

/* ── iOS Step 2: Share sheet with "Add to Home Screen" ── */
function IOSStep2() {
  return (
    <div className="rounded-xl overflow-hidden border border-gray-200 bg-[#f2f2f7]">
      {/* Share sheet header */}
      <div className="bg-white rounded-t-xl px-4 pt-3 pb-2 border-b border-gray-100">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-lg bg-[#fe5b25] flex items-center justify-center">
            <span className="text-[10px] text-white font-bold">M</span>
          </div>
          <div>
            <p className="text-[11px] font-semibold text-gray-900">MasterLeadFlow</p>
            <p className="text-[9px] text-gray-400">app.masterleadflow.com</p>
          </div>
        </div>
        {/* App icons row */}
        <div className="flex gap-3 py-2 overflow-hidden">
          {['Messages', 'Mail', 'Notes'].map(app => (
            <div key={app} className="flex flex-col items-center gap-0.5">
              <div className="w-10 h-10 rounded-xl bg-gray-100" />
              <span className="text-[8px] text-gray-500">{app}</span>
            </div>
          ))}
        </div>
      </div>
      {/* Action list */}
      <div className="bg-white mx-2 my-2 rounded-xl overflow-hidden">
        <div className="px-4 py-2.5 border-b border-gray-100 flex items-center gap-3 opacity-50">
          <span className="text-gray-400 text-sm">📋</span>
          <span className="text-[13px] text-gray-900">Copy</span>
        </div>
        {/* Add to Home Screen — HIGHLIGHTED */}
        <div className="relative px-4 py-2.5 border-b border-gray-100 flex items-center gap-3 bg-[#fe5b25]/5">
          <div className="absolute inset-0 border-2 border-[#fe5b25] rounded-lg animate-pulse-ring" />
          <span className="text-sm">➕</span>
          <span className="text-[13px] text-gray-900 font-semibold">Add to Home Screen</span>
          <span className="ml-auto text-[#fe5b25] text-[10px] font-bold bg-[#fe5b25]/10 px-1.5 py-0.5 rounded">← TAP</span>
        </div>
        <div className="px-4 py-2.5 flex items-center gap-3 opacity-50">
          <span className="text-gray-400 text-sm">🔖</span>
          <span className="text-[13px] text-gray-900">Add Bookmark</span>
        </div>
      </div>
    </div>
  )
}

/* ── iOS Step 3: "Add" confirmation ── */
function IOSStep3() {
  return (
    <div className="rounded-xl overflow-hidden border border-gray-200 bg-[#f2f2f7]">
      <div className="bg-white px-4 py-3">
        {/* Nav bar */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-[13px] text-[#007AFF]">Cancel</span>
          <span className="text-[13px] font-semibold text-gray-900">Add to Home Screen</span>
          <div className="relative">
            <div className="absolute -inset-1.5 rounded-lg border-[2.5px] border-[#fe5b25] animate-pulse-ring" />
            <span className="text-[13px] font-bold text-[#007AFF]">Add</span>
          </div>
        </div>
        {/* App preview */}
        <div className="flex items-center gap-3 bg-[#f2f2f7] rounded-xl p-3">
          <div className="w-12 h-12 rounded-xl bg-[#fe5b25] flex items-center justify-center shadow-md">
            <span className="text-sm text-white font-bold">MLF</span>
          </div>
          <div>
            <p className="text-[13px] font-semibold text-gray-900">MasterLeadFlow</p>
            <p className="text-[11px] text-gray-400">app.masterleadflow.com</p>
          </div>
        </div>
        {/* Arrow annotation */}
        <div className="flex justify-end mt-1 mr-1">
          <div className="flex items-center gap-1">
            <span className="text-[#fe5b25] text-xs">▲</span>
            <span className="text-[#fe5b25] text-[10px] font-bold bg-[#fe5b25]/10 px-1.5 py-0.5 rounded">TAP "Add"</span>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Android Step 1: Chrome 3-dot menu ── */
function AndroidStep1() {
  return (
    <div className="rounded-xl overflow-hidden border border-gray-200 bg-white">
      {/* Chrome top bar */}
      <div className="bg-white px-3 py-2 flex items-center gap-2 border-b border-gray-100">
        <div className="flex-1 bg-[#f1f3f4] rounded-full px-3 py-1.5 flex items-center gap-2">
          <span className="text-[10px]">🔒</span>
          <span className="text-[11px] text-gray-600 flex-1">app.masterleadflow.com</span>
        </div>
        {/* 3-dot menu — highlighted */}
        <div className="relative">
          <div className="absolute -inset-2 rounded-full border-[2.5px] border-[#fe5b25] animate-pulse-ring" />
          <div className="flex flex-col gap-[3px] px-1 py-1">
            <div className="w-[3px] h-[3px] rounded-full bg-gray-600" />
            <div className="w-[3px] h-[3px] rounded-full bg-gray-600" />
            <div className="w-[3px] h-[3px] rounded-full bg-gray-600" />
          </div>
        </div>
      </div>
      {/* Page content hint */}
      <div className="h-16 flex items-center justify-center">
        <div className="flex items-center gap-1.5">
          <div className="w-6 h-6 rounded-md bg-[#fe5b25] flex items-center justify-center">
            <span className="text-[9px] text-white font-bold">M</span>
          </div>
          <span className="text-[12px] font-semibold text-gray-800">MasterLeadFlow</span>
        </div>
      </div>
      {/* Arrow annotation */}
      <div className="flex justify-end px-3 pb-2">
        <div className="flex items-center gap-1">
          <span className="text-[#fe5b25] text-[10px] font-bold bg-[#fe5b25]/10 px-1.5 py-0.5 rounded">TAP ⋮ MENU</span>
          <span className="text-[#fe5b25] text-xs">▲</span>
        </div>
      </div>
    </div>
  )
}

/* ── Android Step 2: Dropdown with "Add to Home Screen" ── */
function AndroidStep2() {
  return (
    <div className="rounded-xl overflow-hidden border border-gray-200 bg-[#f8f9fa]">
      {/* Chrome dropdown menu */}
      <div className="bg-white mx-2 mt-2 rounded-lg shadow-lg border border-gray-200 overflow-hidden">
        {['New tab', 'New incognito tab', 'Bookmarks', 'History'].map(item => (
          <div key={item} className="px-4 py-2 flex items-center gap-3 opacity-40 border-b border-gray-50">
            <span className="text-[12px] text-gray-700">{item}</span>
          </div>
        ))}
        {/* Add to Home screen — HIGHLIGHTED */}
        <div className="relative px-4 py-2.5 flex items-center gap-3 bg-[#fe5b25]/5 border-b border-gray-50">
          <div className="absolute inset-0 border-2 border-[#fe5b25] rounded animate-pulse-ring" />
          <svg className="w-4 h-4 text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 5v14M5 12h14" /></svg>
          <span className="text-[12px] text-gray-900 font-semibold">Add to Home screen</span>
          <span className="ml-auto text-[#fe5b25] text-[10px] font-bold bg-[#fe5b25]/10 px-1.5 py-0.5 rounded">← TAP</span>
        </div>
        {['Share...', 'Find in page'].map(item => (
          <div key={item} className="px-4 py-2 flex items-center gap-3 opacity-40">
            <span className="text-[12px] text-gray-700">{item}</span>
          </div>
        ))}
      </div>
      <div className="h-2" />
    </div>
  )
}

/* ── Android Step 3: Install confirmation dialog ── */
function AndroidStep3() {
  return (
    <div className="rounded-xl overflow-hidden border border-gray-200 bg-[#00000015] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-[260px] p-5">
        <p className="text-[14px] font-semibold text-gray-900 text-center mb-3">Add to Home screen</p>
        {/* App preview */}
        <div className="flex items-center gap-3 mb-4 bg-[#f8f9fa] rounded-xl p-3">
          <div className="w-10 h-10 rounded-xl bg-[#fe5b25] flex items-center justify-center shadow">
            <span className="text-xs text-white font-bold">MLF</span>
          </div>
          <div>
            <p className="text-[12px] font-medium text-gray-900">MasterLeadFlow</p>
            <p className="text-[10px] text-gray-400">masterleadflow.com</p>
          </div>
        </div>
        {/* Buttons */}
        <div className="flex gap-2">
          <button className="flex-1 py-2 text-[12px] font-medium text-gray-500 bg-gray-100 rounded-lg">
            Cancel
          </button>
          <div className="relative flex-1">
            <div className="absolute -inset-1 rounded-xl border-[2.5px] border-[#fe5b25] animate-pulse-ring" />
            <button className="w-full py-2 text-[12px] font-bold text-white bg-[#1a73e8] rounded-lg">
              Add
            </button>
          </div>
        </div>
        <div className="flex justify-end mt-1.5">
          <span className="text-[#fe5b25] text-[10px] font-bold bg-[#fe5b25]/10 px-1.5 py-0.5 rounded">TAP "Add" ↑</span>
        </div>
      </div>
    </div>
  )
}

/* ── Expandable Step Card ── */
function StepCard({ num, title, desc, children }: {
  num: number
  title: string
  desc: string
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(num === 1) // First step open by default

  return (
    <div className="border-b border-gray-50 last:border-0">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 py-3.5 px-1 text-left"
      >
        <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white"
          style={{ background: num === 1 ? '#fe5b25' : num === 2 ? '#3b82f6' : '#22c55e' }}>
          {num}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-gray-900 text-[14px] font-semibold leading-tight">{title}</p>
          <p className="text-gray-400 text-[12px] mt-0.5">{desc}</p>
        </div>
        <ChevronRight className={`w-4 h-4 text-gray-300 transition-transform duration-200 ${open ? 'rotate-90' : ''}`} />
      </button>
      {open && (
        <div className="pb-4 px-1 animate-in">
          {children}
        </div>
      )}
    </div>
  )
}

export default function Install() {
  const navigate = useNavigate()
  // DEBUG: force 'ios' for preview — remove before deploy
  const [platform] = useState<Platform>(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('p') === 'ios') return 'ios'
    if (params.get('p') === 'android') return 'android'
    return detectPlatform()
  })
  const [installed, setInstalled] = useState(false)
  const [inWebView] = useState(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.has('p')) return false // skip webview check in preview mode
    return isWebView()
  })
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

  // Poll for standalone mode after user confirms
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
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Added!</h1>
          <p className="text-gray-500">Opening your dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen relative overflow-hidden" style={{ background: '#faf9f6' }}>
      {/* Background */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full blur-[120px] opacity-30"
        style={{ background: 'radial-gradient(circle, #fe5b2520 0%, transparent 70%)' }} />

      <div className={`relative z-10 max-w-md mx-auto px-5 py-8 transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
        {/* Logo */}
        <div className="flex items-center justify-center gap-2.5 mb-6">
          <img src="/icon.png" alt="" className="w-8 h-8 rounded-xl" />
          <span className="text-base font-semibold tracking-tight text-gray-900">MasterLeadFlow</span>
        </div>

        {/* Hero */}
        <div className="text-center mb-6">
          <h1 className="text-[1.6rem] leading-[1.2] font-bold tracking-[-0.02em] text-gray-900 mb-2">
            Add to Home Screen
            <br />
            <span className="text-[#fe5b25]">to get instant lead alerts</span>
          </h1>
          <p className="text-gray-400 text-[14px]">
            {platform === 'ios' ? '3 quick steps in Safari' : '3 quick steps in Chrome'}
          </p>
        </div>

        {/* WebView blocker */}
        {inWebView ? (
          <div className={`transition-all duration-500 delay-200 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
            <div className="rounded-2xl bg-white border border-gray-100 shadow-lg p-6 text-center mb-4">
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
          <div className={`transition-all duration-500 delay-200 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
            <button
              onClick={handleNativeInstall}
              className="w-full py-4 rounded-2xl text-base font-semibold text-white flex items-center justify-center gap-2.5 transition-all hover:brightness-110 active:scale-[0.97] mb-6"
              style={{ background: '#fe5b25', boxShadow: '0 4px 24px #fe5b2535' }}
            >
              <Download className="w-5 h-5" />
              Add to Home Screen — It's Free
            </button>
          </div>
        ) : platform === 'desktop' ? (
          /* Desktop */
          <div className={`transition-all duration-500 delay-200 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
            <div className="rounded-2xl bg-white border border-gray-100 shadow-lg p-6 text-center mb-4">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
              <p className="text-gray-900 font-semibold text-[15px] mb-1.5">No setup needed</p>
              <p className="text-gray-400 text-xs mb-5">On desktop, notifications work directly in your browser.</p>
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
          /* ── Mobile install guide with visual mockups ── */
          <div className={`transition-all duration-500 delay-200 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
            <div className="rounded-2xl bg-white border border-gray-100 shadow-lg overflow-hidden mb-5">
              <div className="px-5 pt-4 pb-1">
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">
                  {platform === 'ios' ? '📱 iPhone — Safari' : '📱 Android — Chrome'}
                </p>
              </div>

              <div className="px-4 pb-4">
                {platform === 'ios' ? (
                  <>
                    <StepCard num={1} title='Tap the Share button' desc='Bottom bar of Safari — the square with arrow'>
                      <IOSStep1 />
                    </StepCard>
                    <StepCard num={2} title='"Add to Home Screen"' desc='Scroll down in the menu to find it'>
                      <IOSStep2 />
                    </StepCard>
                    <StepCard num={3} title='Tap "Add"' desc='Top-right corner — and you&apos;re done!'>
                      <IOSStep3 />
                    </StepCard>
                  </>
                ) : (
                  <>
                    <StepCard num={1} title='Tap ⋮ menu' desc='3 dots at the top-right of Chrome'>
                      <AndroidStep1 />
                    </StepCard>
                    <StepCard num={2} title='"Add to Home screen"' desc='Find it in the dropdown menu'>
                      <AndroidStep2 />
                    </StepCard>
                    <StepCard num={3} title='Tap "Add" to confirm' desc='The app icon will appear on your phone'>
                      <AndroidStep3 />
                    </StepCard>
                  </>
                )}
              </div>
            </div>

            {/* Confirmation */}
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
          </div>
        )}

        {/* Benefits */}
        <div className={`flex gap-2 justify-center flex-wrap mb-5 transition-all duration-500 delay-500 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
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
        @keyframes pulse-ring {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        .animate-pulse-ring { animation: pulse-ring 1.5s ease-in-out infinite; }
      `}</style>
    </div>
  )
}
