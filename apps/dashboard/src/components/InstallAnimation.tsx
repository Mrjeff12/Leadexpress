import { useState, useEffect } from 'react'

type Platform = 'ios' | 'android'

interface InstallAnimationProps {
  platform: Platform
}

/*
  Animated install guide — loops through phases automatically.
  iOS flow: ··· menu → tap Share → Share Sheet → scroll → tap "Add to Home Screen"
  Android flow: ⋮ menu → tap "Add to Home screen" → confirm dialog → tap "Add"
*/

export default function InstallAnimation({ platform }: InstallAnimationProps) {
  const [phase, setPhase] = useState(0)
  const totalPhases = platform === 'ios' ? 3 : 3

  useEffect(() => {
    const durations = platform === 'ios' ? [3000, 3000, 3500] : [3000, 3000, 3500]
    const timeout = setTimeout(() => {
      setPhase(p => (p + 1) % totalPhases)
    }, durations[phase])
    return () => clearTimeout(timeout)
  }, [phase, platform, totalPhases])

  const activeStep = platform === 'ios'
    ? (phase === 0 ? 0 : 1)
    : (phase <= 1 ? phase : 2)

  return (
    <div className="flex flex-col gap-3 w-full">
      {/* Step indicator pills */}
      <div className="flex items-center justify-center gap-2">
        {(platform === 'ios' ? ['Tap ···', 'Share', 'Add to Home'] : ['Tap ⋮', 'Add to Home', 'Confirm']).map((label, i) => (
          <div
            key={label}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold transition-all duration-500 ${
              i === activeStep
                ? 'bg-[#fe5b25] text-white shadow-lg shadow-[#fe5b25]/30 scale-105'
                : i < activeStep
                  ? 'bg-green-100 text-green-700'
                  : 'bg-gray-100 text-gray-400'
            }`}
          >
            <span className="w-[18px] h-[18px] rounded-full bg-white/20 flex items-center justify-center text-[10px]">
              {i < activeStep ? '✓' : i + 1}
            </span>
            {label}
          </div>
        ))}
      </div>

      {/* Phone frame */}
      <div className="flex justify-center">
        <div className="relative w-[280px]">
          <div className="rounded-[2rem] border-[3px] border-gray-900 bg-black overflow-hidden shadow-2xl">
            {/* Notch area */}
            <div className="bg-black flex items-center justify-between px-6 pt-2 pb-1">
              <span className="text-[10px] text-white/80 font-semibold">9:41</span>
              <div className="w-[80px] h-[22px] bg-black rounded-b-2xl" />
              <div className="flex items-center gap-1">
                <svg className="w-3 h-3 text-white/80" viewBox="0 0 24 24" fill="currentColor"><path d="M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.08 2.93 1 9zm8 8l3 3 3-3c-1.65-1.66-4.34-1.66-6 0zm-4-4l2 2c2.76-2.76 7.24-2.76 10 0l2-2C15.14 9.14 8.87 9.14 5 13z"/></svg>
                <svg className="w-3.5 h-3.5 text-white/80" viewBox="0 0 24 24" fill="currentColor"><rect x="2" y="6" width="18" height="12" rx="2"/><rect x="20" y="9" width="2" height="6" rx="1"/><rect x="4" y="8" width="10" height="8" rx="1" fillOpacity="0.5"/></svg>
              </div>
            </div>

            {/* Screen content */}
            <div className="bg-white min-h-[420px] relative overflow-hidden">
              {platform === 'ios' ? (
                <IOSScreen phase={phase} />
              ) : (
                <AndroidScreen phase={phase} />
              )}
            </div>

            {/* Home indicator */}
            <div className="bg-white pb-2 pt-1">
              <div className="w-[100px] h-[4px] bg-gray-900 rounded-full mx-auto" />
            </div>
          </div>

          {/* Animated tap finger */}
          <TapFinger phase={phase} platform={platform} />
        </div>
      </div>

      {/* Navigation dots */}
      <div className="flex items-center justify-center gap-2">
        {Array.from({ length: totalPhases }).map((_, i) => (
          <button
            key={i}
            onClick={() => setPhase(i)}
            className={`rounded-full transition-all duration-500 ${
              i === phase ? 'w-6 h-2 bg-[#fe5b25]' : 'w-2 h-2 bg-gray-300'
            }`}
          />
        ))}
      </div>

      <style>{`
        @keyframes tapPulse {
          0%, 100% { transform: scale(1); opacity: 0.9; }
          50% { transform: scale(0.82); opacity: 0.6; }
        }
        .tap-anim { animation: tapPulse 1s ease-in-out infinite; }
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        .slide-up { animation: slideUp 0.4s ease-out forwards; }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .fade-in { animation: fadeIn 0.35s ease-out forwards; }
      `}</style>
    </div>
  )
}

/* ─── iOS Screen ─── */

function IOSScreen({ phase }: { phase: number }) {
  return (
    <div className="h-full flex flex-col">
      {/* Safari URL bar */}
      <div className="bg-[#f6f6f6] px-3 pt-1.5 pb-1">
        <div className="bg-white rounded-xl px-3 py-1.5 flex items-center justify-center shadow-sm border border-gray-200/40">
          <span className="text-[9px] text-gray-400 mr-1">🔒</span>
          <span className="text-[11px] text-gray-700 font-medium">app.masterleadflow.com</span>
        </div>
      </div>

      {/* Page content (visible in phase 0, dimmed in 1-2) */}
      <div className={`flex-1 flex items-center justify-center bg-gradient-to-b from-gray-50 to-white transition-opacity duration-300 ${phase > 0 ? 'opacity-20' : ''}`}>
        <div className="text-center">
          <div className="w-12 h-12 rounded-xl bg-[#fe5b25] flex items-center justify-center mx-auto mb-2 shadow-md">
            <span className="text-white font-bold text-sm">MLF</span>
          </div>
          <p className="text-[11px] font-semibold text-gray-700">MasterLeadFlow</p>
        </div>
      </div>

      {/* Safari bottom toolbar (always visible) */}
      <div className={`bg-[#f6f6f6] border-t border-gray-300/40 transition-opacity duration-300 ${phase > 0 ? 'opacity-30' : ''}`}>
        <div className="flex items-center justify-around px-1 py-1.5">
          <svg className="w-[18px] h-[18px] text-[#007AFF] opacity-30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path d="M15 19l-7-7 7-7"/></svg>
          <svg className="w-[18px] h-[18px] text-[#007AFF] opacity-30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path d="M9 5l7 7-7 7"/></svg>
          <svg className="w-[18px] h-[18px] text-[#007AFF] opacity-30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M4 12v7a2 2 0 002 2h12a2 2 0 002-2v-7"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
          <svg className="w-[18px] h-[18px] text-[#007AFF] opacity-30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/></svg>
          {/* ··· button - highlighted in phase 0 */}
          <div className={`transition-all duration-300 ${phase === 0 ? 'scale-110' : ''}`}>
            <div className={`rounded-md p-0.5 transition-all ${phase === 0 ? 'bg-[#007AFF]/15 ring-2 ring-[#007AFF]' : ''}`}>
              <svg className={`w-[18px] h-[18px] transition-colors ${phase === 0 ? 'text-[#007AFF]' : 'text-[#007AFF] opacity-30'}`} viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>
            </div>
          </div>
        </div>
      </div>

      {/* Phase 1: ··· Menu overlay */}
      {phase === 1 && (
        <div className="absolute inset-x-0 bottom-[40px] z-10 slide-up">
          <div className="mx-2">
            <div className="bg-white/[0.97] backdrop-blur-xl rounded-2xl overflow-hidden shadow-xl border border-gray-200/30">
              {/* Share — highlighted */}
              <div className="flex items-center justify-between px-4 py-[11px] border-b border-gray-200/40 bg-[#fe5b25]/[0.06]">
                <span className="text-[15px] text-[#fe5b25] font-semibold">Share</span>
                <svg className="w-[17px] h-[17px] text-[#fe5b25]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M4 12v7a2 2 0 002 2h12a2 2 0 002-2v-7"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
              </div>
              <div className="flex items-center justify-between px-4 py-[11px] border-b border-gray-200/40 opacity-40">
                <span className="text-[15px] text-gray-900">Add to Bookmarks</span>
                <svg className="w-[17px] h-[17px] text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/></svg>
              </div>
              <div className="flex items-center justify-between px-4 py-[11px] opacity-40">
                <span className="text-[15px] text-gray-900">Add Bookmark to...</span>
                <svg className="w-[17px] h-[17px] text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>
              </div>
            </div>
            <div className="bg-white/[0.97] backdrop-blur-xl rounded-2xl overflow-hidden shadow-xl border border-gray-200/30 mt-2">
              <div className="flex items-center justify-between px-4 py-[11px] border-b border-gray-200/40 opacity-40">
                <span className="text-[15px] text-gray-900">New Tab</span>
                <svg className="w-[17px] h-[17px] text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path d="M12 5v14M5 12h14"/></svg>
              </div>
              <div className="flex items-center justify-between px-4 py-[11px] opacity-40">
                <span className="text-[15px] text-gray-900">New Private Tab</span>
                <svg className="w-[17px] h-[17px] text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Phase 2: Share Sheet */}
      {phase === 2 && (
        <div className="absolute inset-0 z-10 flex flex-col fade-in">
          <div className="h-[40px] bg-black/30" />
          <div className="flex-1 bg-[#f2f2f7]/[0.97] backdrop-blur-xl rounded-t-[14px] overflow-hidden">
            <div className="w-8 h-1 bg-gray-400/50 rounded-full mx-auto mt-2 mb-1" />
            {/* Site info */}
            <div className="flex items-center gap-2 px-3 py-1.5">
              <div className="text-center flex-1">
                <p className="text-[11px] font-semibold text-gray-900">MasterLeadFlow</p>
                <p className="text-[9px] text-gray-400">app.masterleadflow.com</p>
              </div>
              <div className="w-7 h-7 rounded-lg bg-[#fe5b25] flex items-center justify-center">
                <span className="text-[7px] text-white font-bold">MLF</span>
              </div>
            </div>
            {/* Contacts row */}
            <div className="flex gap-0.5 px-2 py-1 overflow-hidden">
              {[
                { initials: 'MR', color: '#4A90D9' },
                { initials: 'ST', color: '#E8725C' },
                { initials: 'DM', color: '#5CB85C' },
                { initials: 'JK', color: '#9B59B6' },
              ].map((c, i) => (
                <div key={i} className="flex flex-col items-center gap-0.5 w-[58px] flex-shrink-0 opacity-30">
                  <div className="w-[38px] h-[38px] rounded-full flex items-center justify-center text-white text-[10px] font-semibold" style={{ background: c.color }}>{c.initials}</div>
                </div>
              ))}
            </div>
            {/* Apps row */}
            <div className="flex gap-0.5 px-2 py-1 overflow-hidden">
              {['📝', '📒', '💬', '📡'].map((icon, i) => (
                <div key={i} className="flex flex-col items-center gap-0.5 w-[58px] flex-shrink-0 opacity-30">
                  <div className="w-[38px] h-[38px] rounded-lg bg-gray-100 flex items-center justify-center text-base">{icon}</div>
                </div>
              ))}
            </div>
            {/* Action list */}
            <div className="bg-white/95 mx-2 rounded-xl overflow-hidden mt-1">
              <div className="px-3 py-[9px] border-b border-gray-200/40 opacity-40">
                <span className="text-[13px] text-gray-900">Add to Favorites</span>
              </div>
              <div className="px-3 py-[9px] border-b border-gray-200/40 opacity-40">
                <span className="text-[13px] text-gray-900">Find on Page</span>
              </div>
              {/* ADD TO HOME SCREEN — highlighted */}
              <div className="px-3 py-[9px] border-b border-gray-200/40 bg-[#fe5b25]/[0.06] flex items-center justify-between">
                <span className="text-[13px] font-semibold text-[#fe5b25]">Add to Home Screen</span>
                <span className="bg-[#fe5b25] text-white text-[7px] font-bold px-1.5 py-0.5 rounded-full animate-pulse">TAP</span>
              </div>
              <div className="px-3 py-[9px] border-b border-gray-200/40 opacity-40">
                <span className="text-[13px] text-gray-900">Markup</span>
              </div>
              <div className="px-3 py-[9px] opacity-40">
                <span className="text-[13px] text-gray-900">Print</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ─── Android Screen ─── */

function AndroidScreen({ phase }: { phase: number }) {
  return (
    <div className="h-full flex flex-col relative">
      {/* Chrome toolbar */}
      <div className="bg-white px-2 py-1.5 flex items-center gap-1.5 border-b border-gray-200">
        <div className="flex-1 bg-[#f1f3f4] rounded-full px-2.5 py-1.5 flex items-center gap-1.5">
          <span className="text-[9px]">🔒</span>
          <span className="text-[11px] text-gray-700">app.masterleadflow.com</span>
        </div>
        {/* ⋮ button - highlighted in phase 0 */}
        <div className={`transition-all ${phase === 0 ? 'scale-110' : ''}`}>
          <div className={`flex flex-col gap-[2px] p-1.5 rounded transition-all ${phase === 0 ? 'bg-[#fe5b25]/10 ring-2 ring-[#fe5b25]' : ''}`}>
            <div className={`w-[3px] h-[3px] rounded-full ${phase === 0 ? 'bg-[#fe5b25]' : 'bg-gray-600'}`} />
            <div className={`w-[3px] h-[3px] rounded-full ${phase === 0 ? 'bg-[#fe5b25]' : 'bg-gray-600'}`} />
            <div className={`w-[3px] h-[3px] rounded-full ${phase === 0 ? 'bg-[#fe5b25]' : 'bg-gray-600'}`} />
          </div>
        </div>
      </div>

      {/* Page content */}
      <div className={`flex-1 flex items-center justify-center bg-gradient-to-b from-gray-50 to-white transition-opacity duration-300 ${phase > 0 ? 'opacity-20' : ''}`}>
        <div className="text-center">
          <div className="w-12 h-12 rounded-xl bg-[#fe5b25] flex items-center justify-center mx-auto mb-2 shadow-md">
            <span className="text-white font-bold text-sm">MLF</span>
          </div>
          <p className="text-[11px] font-semibold text-gray-700">MasterLeadFlow</p>
        </div>
      </div>

      {/* Phase 1: Dropdown menu */}
      {phase === 1 && (
        <div className="absolute top-[38px] right-2 z-20 fade-in">
          <div className="bg-white rounded-lg shadow-2xl border border-gray-200 w-[155px] overflow-hidden">
            {['New tab', 'Bookmarks', 'History'].map(item => (
              <div key={item} className="px-3 py-[9px] opacity-40">
                <span className="text-[12px] text-gray-700">{item}</span>
              </div>
            ))}
            <div className="px-3 py-[9px] bg-[#fe5b25]/[0.06]">
              <span className="text-[12px] font-bold text-[#fe5b25]">Add to Home screen</span>
            </div>
            {['Share...', 'Find in page'].map(item => (
              <div key={item} className="px-3 py-[9px] opacity-40">
                <span className="text-[12px] text-gray-700">{item}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Phase 2: Confirm dialog */}
      {phase === 2 && (
        <div className="absolute inset-0 bg-black/30 flex items-center justify-center z-20 fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-[200px] p-4">
            <p className="text-[13px] font-semibold text-center mb-2">Add to Home screen</p>
            <div className="flex items-center gap-2 bg-gray-50 rounded-lg p-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-[#fe5b25] flex items-center justify-center">
                <span className="text-[7px] text-white font-bold">MLF</span>
              </div>
              <div>
                <p className="text-[10px] font-medium">MasterLeadFlow</p>
                <p className="text-[8px] text-gray-400">masterleadflow.com</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button className="flex-1 py-2 text-[11px] text-gray-500 bg-gray-100 rounded-lg">Cancel</button>
              <button className="flex-1 py-2 text-[11px] font-bold text-white bg-[#fe5b25] rounded-lg shadow-md">Add</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ─── Animated Tap Finger ─── */

function TapFinger({ phase, platform }: { phase: number; platform: Platform }) {
  const positions: Record<string, Record<number, { x: string; y: string; visible: boolean }>> = {
    ios: {
      0: { x: '82%', y: '82%', visible: true },     // ··· button
      1: { x: '55%', y: '60%', visible: true },      // Share in menu
      2: { x: '60%', y: '72%', visible: true },      // Add to Home Screen
    },
    android: {
      0: { x: '85%', y: '11%', visible: true },      // ⋮ button
      1: { x: '55%', y: '38%', visible: true },      // Add to Home screen in menu
      2: { x: '68%', y: '60%', visible: true },      // Add button in dialog
    },
  }

  const pos = positions[platform]?.[phase] || { x: '50%', y: '50%', visible: false }

  return (
    <div
      className={`absolute z-50 pointer-events-none transition-all duration-700 ease-in-out ${pos.visible ? 'opacity-100' : 'opacity-0'}`}
      style={{ left: pos.x, top: pos.y }}
    >
      <div className="tap-anim">
        <div className="w-9 h-9 rounded-full bg-gray-800/15 border-2 border-gray-800/25 backdrop-blur-sm flex items-center justify-center">
          <div className="w-2.5 h-2.5 bg-white/40 rounded-full" />
        </div>
      </div>
      <div className="absolute inset-0 rounded-full border-2 border-[#fe5b25]/40 animate-ping" />
    </div>
  )
}
