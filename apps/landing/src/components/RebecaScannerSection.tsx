import { useEffect, useRef, useState, useCallback } from 'react'
import { Bot, Mic, Play, Search, Sun } from 'lucide-react'
import { initialsAvatar } from '../utils/avatars'

/* ------------------------------------------------------------------ */
/*  Rebeca Scanner — "דרך 1" — Finds and delivers matched jobs         */
/* ------------------------------------------------------------------ */

interface Message {
  from: 'user' | 'agent'
  type: 'text' | 'voice'
  duration?: string
  caption?: string
  text: string
  time: string
}

interface Scene {
  id: string
  icon: typeof Mic
  label: string
  desc: string
  messages: Message[]
}

const scenes: Scene[] = [
  {
    id: 'leads',
    icon: Search,
    label: 'Find Leads',
    desc: 'AI scans your WhatsApp groups 24/7 and sends matching jobs straight to you.',
    messages: [
      { from: 'agent', type: 'text', text: '🔔 New lead in your area!\n\n📍 Miami, FL 33101\n🔧 Plumbing — Pipe leak\n💰 $300–500\n\nInterested?', time: '08:12' },
      { from: 'user', type: 'voice', duration: '0:03', caption: "Yes, I'm interested!", text: '', time: '08:13' },
      { from: 'agent', type: 'text', text: '✅ Connecting you now!\n📞 Client: Maria Lopez\n🕐 Expecting your call', time: '08:13' },
    ],
  },
  {
    id: 'morning',
    icon: Sun,
    label: 'Morning Check',
    desc: "Every morning Rebeca asks where you're working and sends overnight leads.",
    messages: [
      { from: 'agent', type: 'text', text: '☀️ Good morning! Ready for today?\n\nWhat areas are you available in and what hours?', time: '07:00' },
      { from: 'user', type: 'voice', duration: '0:05', caption: "I'm in Miami today, 9 to 5", text: '', time: '07:02' },
      { from: 'agent', type: 'text', text: '✅ Got it! Searching for jobs in Miami, 9AM–5PM.\n\nYou have 3 leads waiting from overnight. Want me to send them?', time: '07:02' },
      { from: 'user', type: 'text', text: 'Send them', time: '07:03' },
      { from: 'agent', type: 'text', text: '📋 Sending 3 leads now...', time: '07:03' },
    ],
  },
]

const USER_AVATAR = initialsAvatar('You', 36)

/* ── Sub-components ── */

function TypingIndicator() {
  return (
    <div className="flex items-end gap-1" style={{ direction: 'ltr' }}>
      <div className="bg-white rounded-2xl px-4 py-3 shadow-sm flex items-center gap-1.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="block w-2 h-2 rounded-full bg-gray-400"
            style={{ animation: 'rs-typing 1.4s ease-in-out infinite', animationDelay: `${i * 0.2}s` }}
          />
        ))}
      </div>
    </div>
  )
}

function VoiceWaveform() {
  const bars = [3, 6, 10, 7, 12, 8, 5, 11, 6, 9, 4, 8, 12, 6, 3, 7, 10, 5, 8, 4]
  return (
    <div className="flex items-center gap-[2px] h-5">
      {bars.map((h, i) => (
        <div key={i} className="w-[3px] rounded-full bg-[#54856c]" style={{ height: `${h}px` }} />
      ))}
    </div>
  )
}

/* ── Main Component ── */

export default function RebecaScannerSection() {
  const sectionRef = useRef<HTMLDivElement>(null)
  const chatBodyRef = useRef<HTMLDivElement>(null)
  const [activeScene, setActiveScene] = useState(0)
  const [visibleCount, setVisibleCount] = useState(0)
  const [showTyping, setShowTyping] = useState(false)
  const [isInView, setIsInView] = useState(false)
  const [fadingOut, setFadingOut] = useState(false)
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([])

  const scene = scenes[activeScene]
  const messages = scene.messages

  const clearTimeouts = useCallback(() => {
    timeoutsRef.current.forEach(clearTimeout)
    timeoutsRef.current = []
  }, [])

  const addTimeout = useCallback((fn: () => void, ms: number) => {
    const id = setTimeout(fn, ms)
    timeoutsRef.current.push(id)
    return id
  }, [])

  const runSequence = useCallback((msgs: Message[]) => {
    clearTimeouts()
    setVisibleCount(0)
    setShowTyping(false)
    setFadingOut(false)

    let delay = 400
    for (let i = 0; i < msgs.length; i++) {
      const msg = msgs[i]
      if (msg.from === 'agent') {
        addTimeout(() => setShowTyping(true), delay)
        delay += 700
        const idx = i + 1
        addTimeout(() => { setShowTyping(false); setVisibleCount(idx) }, delay)
      } else {
        const idx = i + 1
        addTimeout(() => setVisibleCount(idx), delay)
      }
      delay += 1200
    }
    addTimeout(() => setFadingOut(true), delay + 2000)
    addTimeout(() => setActiveScene(prev => (prev + 1) % scenes.length), delay + 2600)
  }, [clearTimeouts, addTimeout])

  useEffect(() => {
    const el = sectionRef.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting && !isInView) setIsInView(true) },
      { threshold: 0.2 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [isInView])

  useEffect(() => {
    if (!isInView) return
    runSequence(scenes[activeScene].messages)
    return clearTimeouts
  }, [isInView, activeScene, runSequence, clearTimeouts])

  useEffect(() => {
    const el = chatBodyRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [visibleCount, showTyping])

  const handleTabClick = (idx: number) => {
    if (idx === activeScene) return
    clearTimeouts()
    setFadingOut(true)
    setTimeout(() => setActiveScene(idx), 300)
  }

  return (
    <>
      <style>{`
        @keyframes rs-typing {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-4px); opacity: 1; }
        }
        @keyframes rs-msg-in {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes rs-tab-progress {
          from { width: 0%; }
          to { width: 100%; }
        }
        @keyframes rs-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
      `}</style>

      <section ref={sectionRef} className="bg-[#faf9f6] py-16 md:py-24 overflow-hidden">
        <div className="max-w-6xl mx-auto px-6">
          {/* Header */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 bg-[#25D366]/10 border border-[#25D366]/20 text-[#25D366] text-xs font-semibold px-3 py-1.5 rounded-full mb-4">
              <Bot className="w-3.5 h-3.5" />
              Rebeca — Your Lead Scout
            </div>
            <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 mb-3">
              She finds the jobs. <span className="highlight-box">You pick the ones you want.</span>
            </h2>
            <p className="text-gray-500 text-base md:text-lg max-w-2xl mx-auto leading-relaxed">
              Rebeca scans 2,000+ WhatsApp groups 24/7, filters for your trade and area, and delivers matched leads straight to your WhatsApp.
            </p>
          </div>

          {/* Mobile: Rebeca banner */}
          <div className="lg:hidden mb-4 relative mx-4">
            <div
              className="rounded-2xl h-[80px] mt-[70px]"
              style={{ background: 'linear-gradient(135deg, #25D366 0%, #4ade80 100%)' }}
            />
            <img
              src="/rebeca-character.png"
              alt="Rebeca — LeadExpress AI Agent"
              className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[180px] pointer-events-none select-none"
              style={{ filter: 'drop-shadow(0 8px 24px rgba(0,0,0,0.2))' }}
            />
          </div>

          {/* Desktop layout */}
          <div className="hidden lg:grid lg:grid-cols-12 gap-8 items-start max-w-5xl mx-auto">
            {/* Left: Rebeca + tabs */}
            <div className="col-span-5">
              {/* Rebeca banner */}
              <div className="relative mb-5">
                <div
                  className="rounded-2xl overflow-hidden relative"
                  style={{ background: 'linear-gradient(135deg, #25D366 0%, #4ade80 100%)' }}
                >
                  <div
                    className="absolute inset-0 opacity-[0.08]"
                    style={{ backgroundImage: `radial-gradient(circle at 2px 2px, white 1px, transparent 0)`, backgroundSize: '20px 20px' }}
                  />
                  <div className="absolute top-4 right-8 w-28 h-28 bg-white/20 rounded-full blur-3xl" />
                  <div className="relative z-10 flex items-end gap-4 px-5 pt-5 pb-0">
                    <img
                      src="/rebeca-character.png"
                      alt="Rebeca"
                      className="w-[120px] flex-shrink-0 pointer-events-none select-none"
                      style={{ filter: 'drop-shadow(0 -4px 20px rgba(0,0,0,0.15))', animation: 'rs-float 6s ease-in-out infinite' }}
                    />
                    <div className="pb-5">
                      <div className="inline-flex items-center gap-1.5 bg-white/20 backdrop-blur-sm text-white text-[11px] font-semibold px-2.5 py-1 rounded-full mb-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                        Scanning 24/7
                      </div>
                      <h3 className="text-white text-xl font-bold leading-tight">Rebeca</h3>
                      <p className="text-white/60 text-sm mt-1">Your lead scout</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Scene tabs */}
              <div className="flex flex-col gap-2.5">
                {scenes.map((s, i) => {
                  const Icon = s.icon
                  const isActive = i === activeScene
                  return (
                    <button
                      key={s.id}
                      onClick={() => handleTabClick(i)}
                      className={`relative text-left w-full rounded-xl px-4 py-4 transition-all duration-300 overflow-hidden ${
                        isActive
                          ? 'bg-white shadow-lg shadow-black/5 ring-1 ring-[#25D366]/20'
                          : 'bg-white/50 hover:bg-white/80 ring-1 ring-gray-200/60'
                      }`}
                    >
                      {isActive && (
                        <div className="absolute bottom-0 left-0 h-[3px] rounded-full"
                          style={{ background: 'linear-gradient(90deg, #25D366, #4ade80)', animation: `rs-tab-progress ${messages.length * 1.9 + 2.6}s linear` }}
                        />
                      )}
                      <div className="flex items-start gap-3">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors duration-300 ${
                          isActive ? 'bg-[#25D366] text-white' : 'bg-gray-100 text-gray-400'
                        }`}>
                          <Icon className="w-4.5 h-4.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className={`text-sm font-bold leading-tight ${isActive ? 'text-gray-900' : 'text-gray-500'}`}>
                            {s.label}
                          </h4>
                          <p className={`text-xs mt-1 leading-relaxed transition-all duration-300 ${
                            isActive ? 'text-gray-500 max-h-20 opacity-100' : 'text-gray-400 max-h-0 opacity-0 overflow-hidden'
                          }`}>
                            {s.desc}
                          </p>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Right: WhatsApp Chat */}
            <div className="col-span-7">
              <div
                className="rounded-2xl shadow-xl border border-gray-200 overflow-hidden"
                style={{ opacity: fadingOut ? 0 : 1, transition: 'opacity 0.3s ease' }}
              >
                <div className="px-4 py-3 flex items-center gap-3" style={{ background: '#075e54' }}>
                  <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0">
                    <img src="/rebeca.jpg" alt="Rebeca" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-semibold leading-tight">Rebeca</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
                      <span className="text-green-200 text-[11px]">online</span>
                    </div>
                  </div>
                </div>

                <div
                  ref={chatBodyRef}
                  className="overflow-y-auto"
                  style={{ background: '#ece5dd', maxHeight: '400px', minHeight: '340px', padding: '16px 12px' }}
                >
                  <div className="flex flex-col gap-3">
                    {messages.slice(0, visibleCount).map((msg, i) => {
                      const isAgent = msg.from === 'agent'
                      return (
                        <div
                          key={`${activeScene}-${i}`}
                          className={`flex items-end gap-1.5 ${isAgent ? 'justify-start' : 'justify-end'}`}
                          style={{ animation: 'rs-msg-in 0.4s ease-out both' }}
                        >
                          {isAgent && (
                            <img src="/rebeca.jpg" alt="" className="w-6 h-6 rounded-full object-cover flex-shrink-0 mb-0.5" />
                          )}
                          {msg.type === 'voice' ? (
                            <div className="bg-[#dcf8c6] rounded-2xl px-3 py-2 shadow-sm max-w-[75%]" style={{ direction: 'ltr' }}>
                              <div className="flex items-center gap-2.5 mb-1">
                                <div className="w-8 h-8 rounded-full bg-[#54856c] flex items-center justify-center flex-shrink-0">
                                  <Play className="w-3.5 h-3.5 text-white fill-white ml-0.5" />
                                </div>
                                <VoiceWaveform />
                                <span className="text-xs text-[#54856c] font-medium whitespace-nowrap">{msg.duration}</span>
                              </div>
                              {msg.caption && <p className="text-[11px] text-gray-500 italic mt-0.5">🎤 {msg.caption}</p>}
                              <p className="text-[10px] text-gray-400 text-right mt-0.5">{msg.time}</p>
                            </div>
                          ) : (
                            <div className={`rounded-2xl px-3.5 py-2.5 shadow-sm max-w-[75%] ${isAgent ? 'bg-white' : 'bg-[#dcf8c6]'}`}>
                              <p className="text-[13px] leading-[1.45] text-gray-800 whitespace-pre-line">{msg.text}</p>
                              <p className="text-[10px] text-gray-400 mt-1 text-right">{msg.time}</p>
                            </div>
                          )}
                          {!isAgent && (
                            <img src={USER_AVATAR} alt="" className="w-6 h-6 rounded-full object-cover flex-shrink-0 mb-0.5" />
                          )}
                        </div>
                      )
                    })}
                    {showTyping && (
                      <div className="flex justify-start"><TypingIndicator /></div>
                    )}
                  </div>
                </div>

                <div className="bg-[#f0f0f0] px-3 py-2 flex items-center gap-2 border-t border-gray-200">
                  <div className="flex-1 bg-white rounded-full px-4 py-2 text-xs text-gray-400">Type a message...</div>
                  <div className="w-9 h-9 rounded-full bg-[#075e54] flex items-center justify-center flex-shrink-0">
                    <Mic className="w-4 h-4 text-white" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Mobile layout */}
          <div className="lg:hidden">
            {/* Mobile tabs */}
            <div className="flex flex-col gap-2 mb-6">
              {scenes.map((s, i) => {
                const Icon = s.icon
                const isActive = i === activeScene
                return (
                  <button
                    key={s.id}
                    onClick={() => handleTabClick(i)}
                    className={`relative text-left w-full rounded-xl px-4 py-3 transition-all duration-300 overflow-hidden ${
                      isActive ? 'bg-white shadow-md shadow-black/5 ring-1 ring-[#25D366]/20' : 'bg-white/60 ring-1 ring-gray-200/60'
                    }`}
                  >
                    {isActive && (
                      <div className="absolute bottom-0 left-0 h-[3px] rounded-full"
                        style={{ background: 'linear-gradient(90deg, #25D366, #4ade80)', animation: `rs-tab-progress ${messages.length * 1.9 + 2.6}s linear` }}
                      />
                    )}
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        isActive ? 'bg-[#25D366] text-white' : 'bg-gray-100 text-gray-400'
                      }`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className={`text-sm font-bold leading-tight ${isActive ? 'text-gray-900' : 'text-gray-500'}`}>
                          {s.label}
                        </h4>
                        <p className={`text-xs mt-0.5 leading-relaxed transition-all duration-300 ${
                          isActive ? 'text-gray-500 max-h-16 opacity-100' : 'text-gray-400 max-h-0 opacity-0 overflow-hidden'
                        }`}>
                          {s.desc}
                        </p>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>

            {/* Mobile chat */}
            <div
              className="rounded-2xl shadow-xl border border-gray-200 overflow-hidden mx-auto max-w-sm"
              style={{ opacity: fadingOut ? 0 : 1, transition: 'opacity 0.3s ease' }}
            >
              <div className="px-4 py-3 flex items-center gap-3" style={{ background: '#075e54' }}>
                <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0">
                  <img src="/rebeca.jpg" alt="Rebeca" className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-semibold leading-tight">Rebeca</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
                    <span className="text-green-200 text-[11px]">online</span>
                  </div>
                </div>
              </div>
              <div
                className="overflow-y-auto"
                style={{ background: '#ece5dd', maxHeight: '380px', minHeight: '300px', padding: '16px 12px' }}
              >
                <div className="flex flex-col gap-3">
                  {messages.slice(0, visibleCount).map((msg, i) => {
                    const isAgent = msg.from === 'agent'
                    return (
                      <div
                        key={`mob-${activeScene}-${i}`}
                        className={`flex items-end gap-1.5 ${isAgent ? 'justify-start' : 'justify-end'}`}
                        style={{ animation: 'rs-msg-in 0.4s ease-out both' }}
                      >
                        {isAgent && <img src="/rebeca.jpg" alt="" className="w-6 h-6 rounded-full object-cover flex-shrink-0 mb-0.5" />}
                        {msg.type === 'voice' ? (
                          <div className="bg-[#dcf8c6] rounded-2xl px-3 py-2 shadow-sm max-w-[75%]" style={{ direction: 'ltr' }}>
                            <div className="flex items-center gap-2.5 mb-1">
                              <div className="w-8 h-8 rounded-full bg-[#54856c] flex items-center justify-center flex-shrink-0">
                                <Play className="w-3.5 h-3.5 text-white fill-white ml-0.5" />
                              </div>
                              <VoiceWaveform />
                              <span className="text-xs text-[#54856c] font-medium whitespace-nowrap">{msg.duration}</span>
                            </div>
                            {msg.caption && <p className="text-[11px] text-gray-500 italic mt-0.5">🎤 {msg.caption}</p>}
                            <p className="text-[10px] text-gray-400 text-right mt-0.5">{msg.time}</p>
                          </div>
                        ) : (
                          <div className={`rounded-2xl px-3.5 py-2.5 shadow-sm max-w-[75%] ${isAgent ? 'bg-white' : 'bg-[#dcf8c6]'}`}>
                            <p className="text-[13px] leading-[1.45] text-gray-800 whitespace-pre-line">{msg.text}</p>
                            <p className="text-[10px] text-gray-400 mt-1 text-right">{msg.time}</p>
                          </div>
                        )}
                        {!isAgent && <img src={USER_AVATAR} alt="" className="w-6 h-6 rounded-full object-cover flex-shrink-0 mb-0.5" />}
                      </div>
                    )
                  })}
                  {showTyping && <div className="flex justify-start"><TypingIndicator /></div>}
                </div>
              </div>
              <div className="bg-[#f0f0f0] px-3 py-2 flex items-center gap-2 border-t border-gray-200">
                <div className="flex-1 bg-white rounded-full px-4 py-2 text-xs text-gray-400">Type a message...</div>
                <div className="w-9 h-9 rounded-full bg-[#075e54] flex items-center justify-center flex-shrink-0">
                  <Mic className="w-4 h-4 text-white" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
