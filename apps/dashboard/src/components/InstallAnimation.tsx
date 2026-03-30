import { useState, useEffect, useRef, useCallback } from 'react'

type Platform = 'ios' | 'android'

interface InstallAnimationProps {
  platform: Platform
}

/* Pulsing tap indicator rendered inline on the target */
function TapHere({ className = '' }: { className?: string }) {
  return (
    <span className={`absolute z-50 pointer-events-none ${className}`}>
      <span className="relative flex items-center justify-center">
        <span className="w-7 h-7 rounded-full bg-white/40 border-[1.5px] border-white/60 shadow-lg tap-pulse" />
        <span className="absolute inset-[-5px] rounded-full border-2 border-[#fe5b25]/50 animate-ping" />
      </span>
    </span>
  )
}

/* ─── Swipe to confirm button ─── */
export function SwipeConfirmButton({ onConfirm, label = "Swipe to confirm" }: { onConfirm: () => void; label?: string }) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState(false)
  const [offset, setOffset] = useState(0)
  const startX = useRef(0)
  const THUMB = 56
  const THRESHOLD = 0.75

  const handleStart = useCallback((clientX: number) => {
    startX.current = clientX
    setDragging(true)
  }, [])

  const handleMove = useCallback((clientX: number) => {
    if (!dragging || !trackRef.current) return
    const maxSlide = trackRef.current.offsetWidth - THUMB
    const dx = Math.max(0, Math.min(clientX - startX.current, maxSlide))
    setOffset(dx)
  }, [dragging])

  const handleEnd = useCallback(() => {
    if (!trackRef.current) { setDragging(false); setOffset(0); return }
    const maxSlide = trackRef.current.offsetWidth - THUMB
    if (offset >= maxSlide * THRESHOLD) {
      setOffset(maxSlide)
      setTimeout(onConfirm, 200)
    } else {
      setOffset(0)
    }
    setDragging(false)
  }, [offset, onConfirm])

  return (
    <div
      ref={trackRef}
      className="relative w-full h-14 rounded-2xl overflow-hidden select-none"
      style={{ background: 'linear-gradient(90deg, #fe5b25, #ff7a50)' }}
      onMouseDown={e => handleStart(e.clientX)}
      onMouseMove={e => handleMove(e.clientX)}
      onMouseUp={handleEnd}
      onMouseLeave={() => { if (dragging) handleEnd() }}
      onTouchStart={e => handleStart(e.touches[0].clientX)}
      onTouchMove={e => handleMove(e.touches[0].clientX)}
      onTouchEnd={handleEnd}
    >
      {/* Label */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <span
          className="text-white/80 text-sm font-semibold tracking-wide transition-opacity duration-200"
          style={{ opacity: offset > 30 ? Math.max(0, 1 - offset / 120) : 1 }}
        >
          {label}
        </span>
        {/* Chevron hints */}
        <div className="absolute right-4 flex gap-0.5 opacity-40">
          <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}><path d="M9 5l7 7-7 7"/></svg>
          <svg className="w-3.5 h-3.5 text-white -ml-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}><path d="M9 5l7 7-7 7"/></svg>
        </div>
      </div>
      {/* Thumb */}
      <div
        className="absolute top-1 left-1 w-12 h-12 rounded-xl bg-white shadow-lg flex items-center justify-center transition-[left]"
        style={{
          left: 4 + offset,
          transitionDuration: dragging ? '0ms' : '300ms',
          transitionTimingFunction: 'cubic-bezier(0.25, 1, 0.5, 1)',
        }}
      >
        <svg className="w-5 h-5 text-[#fe5b25]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path d="M5 12h14M12 5l7 7-7 7"/></svg>
      </div>
    </div>
  )
}

export default function InstallAnimation({ platform }: InstallAnimationProps) {
  const [phase, setPhase] = useState(0)
  const totalPhases = 3

  useEffect(() => {
    const durations = [3000, 3000, 3500]
    const timeout = setTimeout(() => setPhase(p => (p + 1) % totalPhases), durations[phase])
    return () => clearTimeout(timeout)
  }, [phase])

  const stepLabels = platform === 'ios'
    ? ['Tap ···', 'Tap Share', 'Add to Home']
    : ['Tap ⋮', 'Add to Home', 'Confirm']

  return (
    <div className="flex flex-col gap-3 w-full items-center">
      {/* Step pills */}
      <div className="flex items-center gap-1.5">
        {stepLabels.map((label, i) => (
          <div
            key={label}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[10px] font-bold transition-all duration-500 ${
              i === phase
                ? 'bg-[#fe5b25] text-white shadow-lg shadow-[#fe5b25]/25 scale-105'
                : i < phase ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'
            }`}
          >
            <span className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center text-[9px]">
              {i < phase ? '✓' : i + 1}
            </span>
            {label}
          </div>
        ))}
      </div>

      {/* iPhone 17 Pro frame */}
      <div className="relative" style={{ width: 260 }}>
        <div
          className="overflow-hidden"
          style={{
            borderRadius: 44,
            border: '3px solid #1a1a1a',
            boxShadow: '0 0 0 1.5px #0a0a0a, 0 25px 60px rgba(0,0,0,0.35), inset 0 0 0 1px rgba(255,255,255,0.04)',
            background: '#000',
          }}
        >
          {/* Status bar + Dynamic Island */}
          <div className="bg-black px-5 pt-2 pb-0 flex items-start justify-between relative" style={{ height: 34 }}>
            <span className="text-[10px] text-white font-semibold" style={{ marginTop: 2 }}>9:41</span>
            {/* Dynamic Island */}
            <div className="absolute left-1/2 -translate-x-1/2 top-[5px] w-[80px] h-[24px] bg-black rounded-full z-30"
              style={{ boxShadow: '0 0 0 0.5px rgba(255,255,255,0.08)' }} />
            <div className="flex items-center gap-1" style={{ marginTop: 2 }}>
              <svg className="w-[14px] h-[10px] text-white" viewBox="0 0 18 12" fill="currentColor">
                <path d="M1 8.5a.5.5 0 01.5-.5h1a.5.5 0 01.5.5v3a.5.5 0 01-.5.5h-1a.5.5 0 01-.5-.5v-3zM5 6a.5.5 0 01.5-.5h1a.5.5 0 01.5.5v5.5a.5.5 0 01-.5.5h-1a.5.5 0 01-.5-.5V6zM9 3.5a.5.5 0 01.5-.5h1a.5.5 0 01.5.5v8a.5.5 0 01-.5.5h-1a.5.5 0 01-.5-.5v-8zM13 1a.5.5 0 01.5-.5h1a.5.5 0 01.5.5v10.5a.5.5 0 01-.5.5h-1a.5.5 0 01-.5-.5V1z"/>
              </svg>
              <svg className="w-[14px] h-[10px] text-white" viewBox="0 0 16 12" fill="currentColor">
                <path d="M8 3C5.8 3 3.8 3.9 2.4 5.4L1 4c1.8-1.8 4.2-3 7-3s5.2 1.2 7 3l-1.4 1.4C12.2 3.9 10.2 3 8 3zm0 4c-1.1 0-2.1.5-2.8 1.2L4 7c1-1.1 2.4-1.8 4-1.8s3 .7 4 1.8l-1.2 1.2C10.1 7.5 9.1 7 8 7zm0 4c-.6 0-1.1-.2-1.4-.6L8 12l1.4-1.6C9.1 10.8 8.6 11 8 11z"/>
              </svg>
              <svg className="w-[22px] h-[10px] text-white" viewBox="0 0 28 12" fill="currentColor">
                <rect x="0" y="1" width="22" height="10" rx="2.5" stroke="currentColor" strokeWidth="1" fill="none"/>
                <rect x="23" y="3.5" width="2.5" height="5" rx="1" fillOpacity="0.4"/>
                <rect x="1.5" y="2.5" width="15" height="7" rx="1.5"/>
              </svg>
            </div>
          </div>

          {/* Screen */}
          <div className="bg-white relative overflow-hidden" style={{ height: 444 }}>
            {platform === 'ios' ? (
              <IOSScreen phase={phase} />
            ) : (
              <AndroidScreen phase={phase} />
            )}
          </div>

          {/* Home indicator bar */}
          <div className="bg-white pb-2 pt-1">
            <div className="w-[100px] h-[4px] bg-black/15 rounded-full mx-auto" />
          </div>
        </div>
      </div>

      {/* Phase dots */}
      <div className="flex items-center justify-center gap-1.5">
        {Array.from({ length: totalPhases }).map((_, i) => (
          <button
            key={i}
            onClick={() => setPhase(i)}
            className={`rounded-full transition-all duration-500 ${
              i === phase ? 'w-5 h-1.5 bg-[#fe5b25]' : 'w-1.5 h-1.5 bg-gray-300'
            }`}
          />
        ))}
      </div>

      <style>{`
        @keyframes tapPulse {
          0%, 100% { transform: scale(1); opacity: 0.9; }
          50% { transform: scale(0.7); opacity: 0.4; }
        }
        .tap-pulse { animation: tapPulse 1.1s ease-in-out infinite; }
      `}</style>
    </div>
  )
}

/* ─── iOS Screen — Realistic Safari UI ─── */
function IOSScreen({ phase }: { phase: number }) {
  return (
    <div className="flex flex-col h-full relative">
      {/* Safari address bar — compact iOS 17+ style */}
      <div className="bg-[#f2f2f7] px-3 pt-1 pb-1">
        <div className="bg-white/80 rounded-[10px] px-3 py-[6px] flex items-center justify-center gap-1.5"
          style={{ border: '0.5px solid rgba(0,0,0,0.08)' }}>
          <svg className="w-[10px] h-[10px] text-gray-400" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-1 6h2v2h-2V7zm0 4h2v6h-2v-6z"/>
          </svg>
          <span className="text-[11px] text-gray-800 tracking-tight">app.masterleadflow.com</span>
        </div>
      </div>

      {/* Page content */}
      <div className={`flex-1 flex items-center justify-center bg-white transition-opacity duration-300 ${phase > 0 ? 'opacity-10 blur-[1px]' : ''}`}>
        <div className="text-center">
          <div className="w-14 h-14 rounded-[14px] bg-[#fe5b25] flex items-center justify-center mx-auto mb-2"
            style={{ boxShadow: '0 4px 16px rgba(254,91,37,0.3)' }}>
            <span className="text-white font-bold text-sm">MLF</span>
          </div>
          <p className="text-[11px] font-semibold text-gray-800">MasterLeadFlow</p>
          <p className="text-[9px] text-gray-400 mt-0.5">Your lead dashboard</p>
        </div>
      </div>

      {/* Safari bottom toolbar — accurate iOS Safari look */}
      <div className={`transition-opacity duration-300 ${phase > 0 ? 'opacity-15' : ''}`}
        style={{ background: '#f2f2f7', borderTop: '0.5px solid rgba(0,0,0,0.15)' }}>
        <div className="flex items-center justify-between px-5 py-[7px]">
          {/* Back */}
          <svg className="w-[18px] h-[18px] text-[#007AFF] opacity-35" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}><path d="M15 19l-7-7 7-7"/></svg>
          {/* Forward */}
          <svg className="w-[18px] h-[18px] text-[#007AFF] opacity-20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}><path d="M9 5l7 7-7 7"/></svg>
          {/* Share */}
          <svg className="w-[18px] h-[18px] text-[#007AFF] opacity-35" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path d="M4 12v7a2 2 0 002 2h12a2 2 0 002-2v-7"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
          {/* Bookmarks */}
          <svg className="w-[18px] h-[18px] text-[#007AFF] opacity-35" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/></svg>
          {/* Tabs / ··· button — TAP TARGET for phase 0 */}
          <div className={`relative transition-all duration-300 ${phase === 0 ? 'scale-[1.3]' : ''}`}>
            <div className={`p-[3px] rounded-md ${phase === 0 ? 'bg-[#007AFF]/15 ring-2 ring-[#007AFF]/60' : ''}`}>
              <svg className={`w-[18px] h-[18px] ${phase === 0 ? 'text-[#007AFF]' : 'text-[#007AFF] opacity-35'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                <rect x="4" y="4" width="16" height="16" rx="2"/>
                <rect x="8" y="1" width="12" height="16" rx="2" opacity="0.4"/>
              </svg>
            </div>
            {phase === 0 && <TapHere className="-top-4 -right-4" />}
          </div>
        </div>
      </div>

      {/* Phase 1: iOS context menu — matches real ··· popup */}
      {phase === 1 && (
        <div className="absolute inset-x-0 bottom-0 z-10 animate-[iosMenuUp_0.3s_cubic-bezier(0.32,0.72,0,1)]">
          <div className="mx-2 mb-1.5">
            {/* Top menu group */}
            <div className="rounded-[13px] overflow-hidden shadow-2xl"
              style={{ background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(40px)', WebkitBackdropFilter: 'blur(40px)' }}>
              {/* Share — TARGET */}
              <div className="relative flex items-center justify-between px-4 py-[11px]"
                style={{ borderBottom: '0.5px solid rgba(0,0,0,0.08)', background: 'rgba(254,91,37,0.06)' }}>
                <span className="text-[15px] text-[#007AFF] font-normal">Share...</span>
                <svg className="w-[17px] h-[17px] text-[#007AFF]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path d="M4 12v7a2 2 0 002 2h12a2 2 0 002-2v-7"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
                <TapHere className="top-1/2 left-[40%] -translate-x-1/2 -translate-y-1/2" />
              </div>
              <div className="flex items-center justify-between px-4 py-[11px] opacity-50"
                style={{ borderBottom: '0.5px solid rgba(0,0,0,0.08)' }}>
                <span className="text-[15px]">Add to Reading List</span>
                <svg className="w-[17px] h-[17px] text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
              </div>
              <div className="flex items-center justify-between px-4 py-[11px] opacity-50"
                style={{ borderBottom: '0.5px solid rgba(0,0,0,0.08)' }}>
                <span className="text-[15px]">Add Bookmark</span>
                <svg className="w-[17px] h-[17px] text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/></svg>
              </div>
              <div className="flex items-center justify-between px-4 py-[11px] opacity-50">
                <span className="text-[15px]">Find on Page</span>
                <svg className="w-[17px] h-[17px] text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              </div>
            </div>
            {/* Bottom menu group */}
            <div className="rounded-[13px] overflow-hidden shadow-2xl mt-2"
              style={{ background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(40px)', WebkitBackdropFilter: 'blur(40px)' }}>
              <div className="flex items-center justify-between px-4 py-[11px] opacity-50"
                style={{ borderBottom: '0.5px solid rgba(0,0,0,0.08)' }}>
                <span className="text-[15px]">New Tab</span>
                <svg className="w-[17px] h-[17px] text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              </div>
              <div className="flex items-center justify-between px-4 py-[11px] opacity-50">
                <span className="text-[15px]">New Private Tab</span>
                <svg className="w-[17px] h-[17px] text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Phase 2: iOS Share Sheet */}
      {phase === 2 && (
        <div className="absolute inset-0 z-10 flex flex-col animate-[iosSheetUp_0.35s_cubic-bezier(0.32,0.72,0,1)]">
          {/* Dimmed top — small so sheet fills most of screen */}
          <div className="h-5 bg-black/40" />
          {/* Sheet */}
          <div className="flex-1 rounded-t-[14px] overflow-hidden flex flex-col" style={{ background: '#f2f2f7' }}>
            {/* Grabber */}
            <div className="w-9 h-[4px] bg-gray-400/40 rounded-full mx-auto mt-[5px] mb-0.5" />
            {/* Page info header */}
            <div className="flex items-center gap-2 px-2.5 py-1 mx-2 bg-white rounded-lg"
              style={{ border: '0.5px solid rgba(0,0,0,0.06)' }}>
              <div className="w-7 h-7 rounded-md bg-[#fe5b25] flex items-center justify-center flex-shrink-0">
                <span className="text-[6px] text-white font-bold">MLF</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold text-gray-900 truncate">MasterLeadFlow</p>
                <p className="text-[8px] text-gray-400 truncate">app.masterleadflow.com</p>
              </div>
            </div>
            {/* Contacts row — compact */}
            <div className="flex gap-1 px-2 py-1 overflow-hidden">
              {[
                { i: 'MR', c: '#4A90D9' },
                { i: 'ST', c: '#E8725C' },
                { i: 'DM', c: '#5CB85C' },
                { i: 'JK', c: '#9B59B6' },
              ].map(({ i, c }) => (
                <div key={i} className="flex flex-col items-center w-[44px] opacity-25">
                  <div className="w-[30px] h-[30px] rounded-full flex items-center justify-center text-white text-[8px] font-semibold" style={{ background: c }}>{i}</div>
                </div>
              ))}
            </div>
            {/* App icons row — compact */}
            <div className="flex gap-1 px-2 py-0.5 overflow-hidden">
              {['💬', '✉️', '📋', '🔗'].map(icon => (
                <div key={icon} className="flex flex-col items-center w-[44px] opacity-25">
                  <div className="w-[30px] h-[30px] rounded-[8px] bg-gray-200/80 flex items-center justify-center text-[12px]">{icon}</div>
                </div>
              ))}
            </div>
            {/* Action list */}
            <div className="mx-2 mt-1 rounded-xl overflow-hidden"
              style={{ background: 'rgba(255,255,255,0.95)', border: '0.5px solid rgba(0,0,0,0.04)' }}>
              <div className="px-3 py-[7px] opacity-40" style={{ borderBottom: '0.5px solid rgba(0,0,0,0.08)' }}>
                <span className="text-[12px]">Add to Favorites</span>
              </div>
              <div className="px-3 py-[7px] opacity-40" style={{ borderBottom: '0.5px solid rgba(0,0,0,0.08)' }}>
                <span className="text-[12px]">Find on Page</span>
              </div>
              {/* Add to Home Screen — TAP TARGET */}
              <div className="relative px-3 py-[8px] flex items-center justify-between"
                style={{ borderBottom: '0.5px solid rgba(0,0,0,0.08)', background: 'rgba(254,91,37,0.06)' }}>
                <div className="flex items-center gap-2">
                  <svg className="w-[15px] h-[15px] text-[#007AFF]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
                  <span className="text-[12px] font-semibold text-[#fe5b25]">Add to Home Screen</span>
                </div>
                <TapHere className="top-1/2 left-[45%] -translate-x-1/2 -translate-y-1/2" />
              </div>
              <div className="px-3 py-[7px] opacity-40" style={{ borderBottom: '0.5px solid rgba(0,0,0,0.08)' }}>
                <span className="text-[12px]">Markup</span>
              </div>
              <div className="px-3 py-[7px] opacity-40">
                <span className="text-[12px]">Print</span>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes iosMenuUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes iosSheetUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}

/* ─── Android Screen ─── */
function AndroidScreen({ phase }: { phase: number }) {
  return (
    <div className="flex flex-col h-full relative">
      <div className="bg-white px-2 py-1.5 flex items-center gap-1.5 border-b border-gray-200">
        <div className="flex-1 bg-[#f1f3f4] rounded-full px-2.5 py-1.5 flex items-center gap-1.5">
          <span className="text-[9px]">🔒</span>
          <span className="text-[11px] text-gray-700">app.masterleadflow.com</span>
        </div>
        <div className={`relative transition-all ${phase === 0 ? 'scale-125' : ''}`}>
          <div className={`flex flex-col gap-[2px] p-1.5 rounded ${phase === 0 ? 'bg-[#fe5b25]/10 ring-[1.5px] ring-[#fe5b25]' : ''}`}>
            <div className={`w-[3px] h-[3px] rounded-full ${phase === 0 ? 'bg-[#fe5b25]' : 'bg-gray-600'}`} />
            <div className={`w-[3px] h-[3px] rounded-full ${phase === 0 ? 'bg-[#fe5b25]' : 'bg-gray-600'}`} />
            <div className={`w-[3px] h-[3px] rounded-full ${phase === 0 ? 'bg-[#fe5b25]' : 'bg-gray-600'}`} />
          </div>
          {phase === 0 && <TapHere className="-top-2 -right-2" />}
        </div>
      </div>

      <div className={`flex-1 flex items-center justify-center bg-gradient-to-b from-gray-50 to-white transition-opacity duration-300 ${phase > 0 ? 'opacity-15' : ''}`}>
        <div className="text-center">
          <div className="w-11 h-11 rounded-xl bg-[#fe5b25] flex items-center justify-center mx-auto mb-1.5 shadow-md">
            <span className="text-white font-bold text-xs">MLF</span>
          </div>
          <p className="text-[10px] font-semibold text-gray-700">MasterLeadFlow</p>
        </div>
      </div>

      {phase === 1 && (
        <div className="absolute top-[34px] right-1.5 z-20 animate-[fadeIn_0.25s_ease-out]">
          <div className="bg-white rounded-lg shadow-2xl border border-gray-200 w-[140px] overflow-hidden">
            {['New tab', 'Bookmarks', 'History'].map(item => (
              <div key={item} className="px-3 py-[8px] opacity-35"><span className="text-[11px] text-gray-700">{item}</span></div>
            ))}
            <div className="relative px-3 py-[8px] bg-[#fe5b25]/[0.05]">
              <span className="text-[11px] font-bold text-[#fe5b25]">Add to Home screen</span>
              <TapHere className="top-1/2 right-2 -translate-y-1/2" />
            </div>
            {['Share...', 'Find in page'].map(item => (
              <div key={item} className="px-3 py-[8px] opacity-35"><span className="text-[11px] text-gray-700">{item}</span></div>
            ))}
          </div>
        </div>
      )}

      {phase === 2 && (
        <div className="absolute inset-0 bg-black/25 flex items-center justify-center z-20 animate-[fadeIn_0.25s_ease-out]">
          <div className="bg-white rounded-2xl shadow-2xl w-[180px] p-4">
            <p className="text-[12px] font-semibold text-center mb-2">Add to Home screen</p>
            <div className="flex items-center gap-2 bg-gray-50 rounded-lg p-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-[#fe5b25] flex items-center justify-center">
                <span className="text-[7px] text-white font-bold">MLF</span>
              </div>
              <div>
                <p className="text-[9px] font-medium">MasterLeadFlow</p>
                <p className="text-[7px] text-gray-400">masterleadflow.com</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button className="flex-1 py-1.5 text-[10px] text-gray-500 bg-gray-100 rounded-lg">Cancel</button>
              <button className="relative flex-1 py-1.5 text-[10px] font-bold text-white bg-[#fe5b25] rounded-lg">
                Add
                <TapHere className="-top-2 -right-2" />
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  )
}
