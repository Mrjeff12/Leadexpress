import { useState, useEffect } from 'react'

type Platform = 'ios' | 'android'

interface InstallAnimationProps {
  platform: Platform
}

const PHASE_DURATIONS = [1000, 2500, 1000, 2500, 1000, 2000, 2000]

export default function InstallAnimation({ platform }: InstallAnimationProps) {
  const [phase, setPhase] = useState(0)
  const [activeStep, setActiveStep] = useState(0)

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>
    let currentPhase = 0

    function nextPhase() {
      currentPhase = (currentPhase + 1) % 7
      setPhase(currentPhase)
      setActiveStep(currentPhase < 2 ? 0 : currentPhase < 4 ? 1 : 2)
      timeout = setTimeout(nextPhase, PHASE_DURATIONS[currentPhase])
    }

    timeout = setTimeout(nextPhase, PHASE_DURATIONS[0])
    return () => clearTimeout(timeout)
  }, [])

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative w-[220px] h-[400px]">
        <div className="absolute inset-0 rounded-[2rem] border-[3px] border-gray-800 bg-white overflow-hidden shadow-xl">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[80px] h-[22px] bg-gray-800 rounded-b-2xl z-30" />
          <div className="absolute inset-[3px] top-[22px] bottom-[3px] overflow-hidden bg-white rounded-b-[1.7rem]">
            {platform === 'ios' ? (
              <IOSScreenContent phase={phase} />
            ) : (
              <AndroidScreenContent phase={phase} />
            )}
          </div>
        </div>
        <AnimatedFinger phase={phase} platform={platform} />
      </div>

      <div className="flex items-center gap-3">
        {['Share', 'Select', 'Confirm'].map((label, i) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full transition-all duration-300 ${
              i === activeStep ? 'bg-[#fe5b25] scale-125' : i < activeStep ? 'bg-green-400' : 'bg-gray-200'
            }`} />
            <span className={`text-[10px] font-medium transition-colors ${
              i === activeStep ? 'text-gray-700' : 'text-gray-400'
            }`}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function IOSScreenContent({ phase }: { phase: number }) {
  return (
    <div className="h-full flex flex-col relative">
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="flex items-center gap-1.5">
          <div className="w-8 h-8 rounded-lg bg-[#fe5b25] flex items-center justify-center">
            <span className="text-[10px] text-white font-bold">M</span>
          </div>
          <span className="text-xs font-semibold text-gray-800">MasterLeadFlow</span>
        </div>
      </div>

      <div className={`bg-[#f2f2f7] border-t border-gray-200 px-4 py-2 flex items-center justify-around transition-opacity ${phase >= 2 && phase <= 5 ? 'opacity-30' : ''}`}>
        <span className="text-gray-400 text-sm">‹</span>
        <span className="text-gray-300 text-sm">›</span>
        <div className={`relative transition-all ${phase === 1 ? 'scale-110' : ''}`}>
          <svg className={`w-5 h-5 transition-colors ${phase === 1 ? 'text-[#fe5b25]' : 'text-[#007AFF]'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 12v7a2 2 0 002 2h12a2 2 0 002-2v-7" />
            <polyline points="16 6 12 2 8 6" />
            <line x1="12" y1="2" x2="12" y2="15" />
          </svg>
          {phase === 1 && <div className="absolute inset-[-6px] rounded-full border-2 border-[#fe5b25] animate-ping opacity-40" />}
        </div>
        <span className="text-gray-400 text-sm">▢</span>
        <span className="text-gray-400 text-sm">⊞</span>
      </div>

      <div className={`absolute inset-x-0 bottom-0 transition-transform duration-500 ease-out ${
        phase >= 2 && phase <= 5 ? 'translate-y-0' : 'translate-y-full'
      }`}>
        <div className="bg-[#f2f2f7] rounded-t-2xl shadow-2xl pb-2">
          <div className="w-8 h-1 bg-gray-300 rounded-full mx-auto mt-2 mb-3" />
          <div className="bg-white mx-2 rounded-xl overflow-hidden mb-2">
            <div className="px-3 py-2 border-b border-gray-100 flex items-center gap-2 opacity-40">
              <span className="text-xs">📋</span>
              <span className="text-[11px] text-gray-900">Copy</span>
            </div>
            <div className={`px-3 py-2 border-b border-gray-100 flex items-center gap-2 transition-all ${
              phase === 3 ? 'bg-[#fe5b25]/10' : ''
            }`}>
              <span className="text-xs">➕</span>
              <span className={`text-[11px] font-medium transition-colors ${phase === 3 ? 'text-[#fe5b25] font-semibold' : 'text-gray-900'}`}>
                Add to Home Screen
              </span>
            </div>
            <div className="px-3 py-2 flex items-center gap-2 opacity-40">
              <span className="text-xs">🔖</span>
              <span className="text-[11px] text-gray-900">Add Bookmark</span>
            </div>
          </div>

          {phase >= 4 && phase <= 5 && (
            <div className="bg-white mx-2 rounded-xl p-3 mb-2">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] text-[#007AFF]">Cancel</span>
                <span className="text-[11px] font-semibold">Add to Home Screen</span>
                <span className={`text-[11px] font-bold transition-colors ${phase === 5 ? 'text-[#fe5b25]' : 'text-[#007AFF]'}`}>Add</span>
              </div>
              <div className="flex items-center gap-2 bg-gray-50 rounded-lg p-2">
                <div className="w-8 h-8 rounded-lg bg-[#fe5b25] flex items-center justify-center">
                  <span className="text-[8px] text-white font-bold">MLF</span>
                </div>
                <div>
                  <p className="text-[10px] font-medium text-gray-900">MasterLeadFlow</p>
                  <p className="text-[8px] text-gray-400">app.masterleadflow.com</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {phase === 6 && (
        <div className="absolute inset-0 bg-white/90 flex flex-col items-center justify-center z-20">
          <div className="w-14 h-14 rounded-2xl bg-[#fe5b25] flex items-center justify-center mb-3 shadow-lg animate-[bounce-once_0.6s_ease-out]">
            <span className="text-lg text-white font-bold">MLF</span>
          </div>
          <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center -mt-2 mb-2">
            <span className="text-white text-sm font-bold">✓</span>
          </div>
          <p className="text-xs font-semibold text-gray-900">Added to Home Screen!</p>
        </div>
      )}
    </div>
  )
}

function AndroidScreenContent({ phase }: { phase: number }) {
  return (
    <div className="h-full flex flex-col relative">
      <div className="bg-white px-3 py-2 flex items-center gap-2 border-b border-gray-100">
        <div className="flex-1 bg-[#f1f3f4] rounded-full px-2 py-1 flex items-center gap-1">
          <span className="text-[8px]">🔒</span>
          <span className="text-[9px] text-gray-500 flex-1">app.masterleadflow.com</span>
        </div>
        <div className={`flex flex-col gap-[2px] px-1 py-1 transition-all ${phase === 1 ? 'scale-125' : ''}`}>
          <div className={`w-[3px] h-[3px] rounded-full ${phase === 1 ? 'bg-[#fe5b25]' : 'bg-gray-600'}`} />
          <div className={`w-[3px] h-[3px] rounded-full ${phase === 1 ? 'bg-[#fe5b25]' : 'bg-gray-600'}`} />
          <div className={`w-[3px] h-[3px] rounded-full ${phase === 1 ? 'bg-[#fe5b25]' : 'bg-gray-600'}`} />
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="flex items-center gap-1.5">
          <div className="w-8 h-8 rounded-lg bg-[#fe5b25] flex items-center justify-center">
            <span className="text-[10px] text-white font-bold">M</span>
          </div>
          <span className="text-xs font-semibold text-gray-800">MasterLeadFlow</span>
        </div>
      </div>

      {phase >= 2 && phase <= 3 && (
        <div className="absolute top-[48px] right-2 z-20">
          <div className="bg-white rounded-lg shadow-xl border border-gray-200 w-[160px] overflow-hidden">
            {['New tab', 'Bookmarks', 'History'].map(item => (
              <div key={item} className="px-3 py-1.5 opacity-40">
                <span className="text-[10px] text-gray-700">{item}</span>
              </div>
            ))}
            <div className={`px-3 py-1.5 transition-all ${phase === 3 ? 'bg-[#fe5b25]/10' : ''}`}>
              <span className={`text-[10px] font-medium transition-colors ${phase === 3 ? 'text-[#fe5b25] font-semibold' : 'text-gray-900'}`}>
                Add to Home screen
              </span>
            </div>
            {['Share...', 'Find in page'].map(item => (
              <div key={item} className="px-3 py-1.5 opacity-40">
                <span className="text-[10px] text-gray-700">{item}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {phase >= 4 && phase <= 5 && (
        <div className="absolute inset-0 bg-black/20 flex items-center justify-center z-30">
          <div className="bg-white rounded-2xl shadow-xl w-[180px] p-4">
            <p className="text-[11px] font-semibold text-center mb-2">Add to Home screen</p>
            <div className="flex items-center gap-2 bg-gray-50 rounded-lg p-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-[#fe5b25] flex items-center justify-center">
                <span className="text-[8px] text-white font-bold">MLF</span>
              </div>
              <div>
                <p className="text-[9px] font-medium">MasterLeadFlow</p>
                <p className="text-[7px] text-gray-400">masterleadflow.com</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button className="flex-1 py-1.5 text-[9px] text-gray-500 bg-gray-100 rounded-lg">Cancel</button>
              <button className={`flex-1 py-1.5 text-[9px] font-bold text-white rounded-lg transition-colors ${
                phase === 5 ? 'bg-[#fe5b25]' : 'bg-[#1a73e8]'
              }`}>Add</button>
            </div>
          </div>
        </div>
      )}

      {phase === 6 && (
        <div className="absolute inset-0 bg-white/90 flex flex-col items-center justify-center z-20">
          <div className="w-14 h-14 rounded-2xl bg-[#fe5b25] flex items-center justify-center mb-3 shadow-lg animate-[bounce-once_0.6s_ease-out]">
            <span className="text-lg text-white font-bold">MLF</span>
          </div>
          <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center -mt-2 mb-2">
            <span className="text-white text-sm font-bold">✓</span>
          </div>
          <p className="text-xs font-semibold text-gray-900">Added to Home Screen!</p>
        </div>
      )}
    </div>
  )
}

function AnimatedFinger({ phase, platform }: { phase: number; platform: Platform }) {
  const positions: Record<Platform, Record<number, { x: number; y: number; visible: boolean; tapping: boolean }>> = {
    ios: {
      0: { x: 110, y: 100, visible: false, tapping: false },
      1: { x: 50, y: 90, visible: true, tapping: true },
      2: { x: 80, y: 100, visible: false, tapping: false },
      3: { x: 55, y: 72, visible: true, tapping: true },
      4: { x: 80, y: 100, visible: false, tapping: false },
      5: { x: 78, y: 62, visible: true, tapping: true },
      6: { x: 110, y: 100, visible: false, tapping: false },
    },
    android: {
      0: { x: 110, y: 100, visible: false, tapping: false },
      1: { x: 88, y: 12, visible: true, tapping: true },
      2: { x: 110, y: 100, visible: false, tapping: false },
      3: { x: 70, y: 30, visible: true, tapping: true },
      4: { x: 110, y: 100, visible: false, tapping: false },
      5: { x: 62, y: 58, visible: true, tapping: true },
      6: { x: 110, y: 100, visible: false, tapping: false },
    },
  }

  const pos = positions[platform][phase] || { x: 110, y: 100, visible: false, tapping: false }

  return (
    <div
      className={`absolute transition-all duration-500 ease-in-out z-40 ${pos.visible ? 'opacity-100' : 'opacity-0'}`}
      style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
    >
      <div className={`w-8 h-8 rounded-full bg-gray-800/20 border-2 border-gray-800/30 backdrop-blur-sm transition-transform duration-150 ${
        pos.tapping ? 'animate-[tap_0.3s_ease-in-out]' : ''
      }`}>
        <div className="w-2 h-2 bg-white/40 rounded-full mt-1.5 ml-1.5" />
      </div>
      {pos.tapping && (
        <div className="absolute inset-0 rounded-full border-2 border-[#fe5b25]/40 animate-ping" />
      )}
    </div>
  )
}
