import { Helmet } from 'react-helmet-async'
import { useNavigate } from 'react-router-dom'
import {
  Search, Zap, MapPin, ArrowRight, CheckCircle, ChevronDown,
  ChevronRight, Flame, Clock, Phone, Bell, Filter, Menu, X, MessageSquare,
  Bot, Mic, Play, Sun, Shield, Users, BarChart3, Sparkles,
} from 'lucide-react'
import { useEffect, useRef, useState, useCallback } from 'react'
import LeadsFeedShowcase from '../components/landing/LeadsFeedShowcase'

const REBECA_PHONE = '18623582898'
const REBECA_WA = `https://wa.me/${REBECA_PHONE}?text=${encodeURIComponent('Hey Rebeca! I want to start getting leads for my trade 👋')}`

/* ─── Intersection Observer ─── */
function useInView(threshold = 0.2) {
  const ref = useRef<HTMLElement | null>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setVisible(true) },
      { threshold },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [threshold])
  return { ref, visible }
}

/* ─── Site Navbar ─── */
const LANDING_URL = import.meta.env.PROD ? 'https://masterleadflow.com' : 'http://localhost:5174'

function SiteNavbar() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const navigate = useNavigate()

  return (
    <nav className="fixed top-0 inset-x-0 z-50 bg-white/80 backdrop-blur-xl border-b border-zinc-200/50">
      <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-4">
        <a href={LANDING_URL} className="flex items-center gap-2.5">
          <div className="w-9 h-9 bg-gradient-to-br from-[#fe5b25] to-[#e04d1c] rounded-lg flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <span className="text-xl font-semibold tracking-[-0.03em] text-zinc-900">MasterLeadFlow</span>
        </a>

        <div className="hidden md:flex items-center gap-8">
          <a href="#how-it-works" className="text-sm text-stone-500 hover:text-[#fe5b25] transition-colors">How It Works</a>
          <a href="#features" className="text-sm text-stone-500 hover:text-[#fe5b25] transition-colors">Features</a>
          <a href="#pricing" className="text-sm text-stone-500 hover:text-[#fe5b25] transition-colors">Pricing</a>
          <a href="#faq" className="text-sm text-stone-500 hover:text-[#fe5b25] transition-colors">FAQ</a>
        </div>

        <div className="hidden md:flex items-center gap-3">
          <button onClick={() => navigate('/login')} className="text-sm font-medium text-stone-500 hover:text-zinc-900 transition-colors px-4 py-2">
            Log in
          </button>
          <button
            onClick={() => window.open(REBECA_WA, '_blank')}
            className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[#fe5b25] to-[#e04d1c] text-white px-5 py-2.5 text-xs font-semibold transition-all hover:scale-105 hover:shadow-md hover:shadow-[#fe5b25]/20"
          >
            Get Started Free
          </button>
        </div>

        <button className="md:hidden p-2" onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {mobileOpen && (
        <div className="md:hidden bg-white border-t border-zinc-100 px-6 py-6 space-y-4">
          <a href="#how-it-works" className="block text-sm py-2 text-stone-600">How It Works</a>
          <a href="#features" className="block text-sm py-2 text-stone-600">Features</a>
          <a href="#pricing" className="block text-sm py-2 text-stone-600">Pricing</a>
          <a href="#faq" className="block text-sm py-2 text-stone-600">FAQ</a>
          <button onClick={() => navigate('/login')} className="block text-sm py-2 font-medium text-stone-500">Log in</button>
          <button
            onClick={() => window.open(REBECA_WA, '_blank')}
            className="w-full rounded-full bg-gradient-to-r from-[#fe5b25] to-[#e04d1c] text-white py-3 text-sm font-semibold"
          >
            Get Started Free
          </button>
        </div>
      )}
    </nav>
  )
}

/* ─── FAQ Item ─── */
function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className={`border rounded-2xl transition-all duration-300 ${open ? 'border-[#fe5b25]/30 bg-white shadow-sm' : 'border-stone-200/60 bg-white/60'}`}>
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-6 py-5 text-left cursor-pointer">
        <span className="text-sm font-semibold text-zinc-800 pr-4">{q}</span>
        <ChevronDown className={`w-4 h-4 text-stone-400 shrink-0 transition-transform duration-300 ${open ? 'rotate-180 text-[#fe5b25]' : ''}`} />
      </button>
      <div className={`overflow-hidden transition-all duration-300 ${open ? 'max-h-40 pb-5' : 'max-h-0'}`}>
        <p className="px-6 text-sm text-stone-500 leading-relaxed">{a}</p>
      </div>
    </div>
  )
}

/* ─── Rebeca Scanner Chat (ported from landing) ─── */
interface RMsg { from: 'user' | 'agent'; type: 'text' | 'voice'; duration?: string; caption?: string; text: string; time: string }
interface RScene { id: string; icon: typeof Mic; label: string; desc: string; messages: RMsg[] }

const rebecaScenes: RScene[] = [
  {
    id: 'leads', icon: Search, label: 'Find Leads',
    desc: 'AI checks your WhatsApp groups 24/7 and sends you the right jobs.',
    messages: [
      { from: 'agent', type: 'text', text: '🔔 New lead in your area!\n\n📍 Houston, TX 77001\n🔧 HVAC — 3 units residential\n💰 Good pay\n\nInterested?', time: '08:12' },
      { from: 'user', type: 'voice', duration: '0:03', caption: "Yes, I'm interested!", text: '', time: '08:13' },
      { from: 'agent', type: 'text', text: '✅ Connecting you now!\n📞 Client: John Rivera\n🕐 He is waiting for your call', time: '08:13' },
    ],
  },
  {
    id: 'morning', icon: Sun, label: 'Morning Check',
    desc: 'Every morning Rebeca asks where you\'re working and sends leads from the night.',
    messages: [
      { from: 'agent', type: 'text', text: '☀️ Good morning! Ready for today?\n\nWhat areas are you available in?', time: '07:00' },
      { from: 'user', type: 'voice', duration: '0:05', caption: "I'm in Houston today, 9 to 5", text: '', time: '07:02' },
      { from: 'agent', type: 'text', text: '✅ Got it! Searching Houston, 9AM–5PM.\n\nYou have 3 leads from overnight. Want me to send them?', time: '07:02' },
      { from: 'user', type: 'text', text: 'Send them', time: '07:03' },
      { from: 'agent', type: 'text', text: '📋 Sending 3 leads now...', time: '07:03' },
    ],
  },
]

function RTyping() {
  return (
    <div className="flex items-end gap-1" style={{ direction: 'ltr' }}>
      <div className="bg-white rounded-2xl px-4 py-3 shadow-sm flex items-center gap-1.5">
        {[0, 1, 2].map(i => (
          <span key={i} className="block w-2 h-2 rounded-full bg-gray-400"
            style={{ animation: 'rs-typing 1.4s ease-in-out infinite', animationDelay: `${i * 0.2}s` }} />
        ))}
      </div>
    </div>
  )
}

function RWaveform() {
  const bars = [3, 6, 10, 7, 12, 8, 5, 11, 6, 9, 4, 8, 12, 6, 3, 7, 10, 5, 8, 4]
  return (
    <div className="flex items-center gap-[2px] h-5">
      {bars.map((h, i) => <div key={i} className="w-[3px] rounded-full bg-[#54856c]" style={{ height: `${h}px` }} />)}
    </div>
  )
}

function RebecaScanner() {
  const sectionRef = useRef<HTMLDivElement>(null)
  const chatBodyRef = useRef<HTMLDivElement>(null)
  const [activeScene, setActiveScene] = useState(0)
  const [visibleCount, setVisibleCount] = useState(0)
  const [showTyping, setShowTyping] = useState(false)
  const [isInView, setIsInView] = useState(false)
  const [fadingOut, setFadingOut] = useState(false)
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([])

  const scene = rebecaScenes[activeScene]
  const messages = scene.messages

  const clearTimeouts = useCallback(() => { timeoutsRef.current.forEach(clearTimeout); timeoutsRef.current = [] }, [])
  const addTimeout = useCallback((fn: () => void, ms: number) => { const id = setTimeout(fn, ms); timeoutsRef.current.push(id); return id }, [])

  const runSequence = useCallback((msgs: RMsg[]) => {
    clearTimeouts(); setVisibleCount(0); setShowTyping(false); setFadingOut(false)
    let delay = 400
    for (let i = 0; i < msgs.length; i++) {
      const msg = msgs[i]
      if (msg.from === 'agent') {
        addTimeout(() => setShowTyping(true), delay); delay += 700
        const idx = i + 1; addTimeout(() => { setShowTyping(false); setVisibleCount(idx) }, delay)
      } else { const idx = i + 1; addTimeout(() => setVisibleCount(idx), delay) }
      delay += 1200
    }
    addTimeout(() => setFadingOut(true), delay + 2000)
    addTimeout(() => setActiveScene(prev => (prev + 1) % rebecaScenes.length), delay + 2600)
  }, [clearTimeouts, addTimeout])

  useEffect(() => {
    const el = sectionRef.current; if (!el) return
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting && !isInView) setIsInView(true) }, { threshold: 0.2 })
    obs.observe(el); return () => obs.disconnect()
  }, [isInView])

  useEffect(() => { if (!isInView) return; runSequence(rebecaScenes[activeScene].messages); return clearTimeouts }, [isInView, activeScene, runSequence, clearTimeouts])
  useEffect(() => { const el = chatBodyRef.current; if (!el) return; el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' }) }, [visibleCount, showTyping])

  const handleTabClick = (idx: number) => { if (idx === activeScene) return; clearTimeouts(); setFadingOut(true); setTimeout(() => setActiveScene(idx), 300) }

  const USER_AVT = `https://ui-avatars.com/api/?name=You&background=e0e0e0&color=666&bold=true&size=36`

  return (
    <>
      <style>{`
        @keyframes rs-typing { 0%, 60%, 100% { transform: translateY(0); opacity: 0.4; } 30% { transform: translateY(-4px); opacity: 1; } }
        @keyframes rs-msg-in { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes rs-tab-progress { from { width: 0%; } to { width: 100%; } }
        @keyframes rs-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
      `}</style>
      <section ref={sectionRef} className="bg-[#faf9f6] py-16 md:py-24 overflow-hidden">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 bg-[#25D366]/10 border border-[#25D366]/20 text-[#25D366] text-xs font-semibold px-3 py-1.5 rounded-full mb-4">
              <Bot className="w-3.5 h-3.5" /> Rebeca — Your Lead Finder
            </div>
            <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 mb-3">
              She finds the jobs. <span className="text-[#fe5b25]">You pick what you want.</span>
            </h2>
            <p className="text-gray-500 text-base md:text-lg max-w-2xl mx-auto leading-relaxed">
              Rebeca checks hundreds of WhatsApp groups 24/7, looks for your trade and area, and sends the leads directly to your WhatsApp.
            </p>
          </div>

          {/* Rebeca banner — mobile */}
          <div className="lg:hidden mb-4 relative mx-4">
            <div className="rounded-2xl h-[80px] mt-[70px]" style={{ background: 'linear-gradient(135deg, #25D366 0%, #4ade80 100%)' }} />
            <img src="/rebeca-character.png" alt="Rebeca" className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[180px] pointer-events-none select-none" style={{ filter: 'drop-shadow(0 8px 24px rgba(0,0,0,0.2))' }} />
          </div>

          {/* Desktop: 2-col layout */}
          <div className="hidden lg:grid lg:grid-cols-12 gap-8 items-start max-w-5xl mx-auto">
            {/* Left: Rebeca + tabs */}
            <div className="col-span-5">
              <div className="relative mb-5">
                <div className="rounded-2xl overflow-hidden relative" style={{ background: 'linear-gradient(135deg, #25D366 0%, #4ade80 100%)' }}>
                  <div className="absolute inset-0 opacity-[0.08]" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '20px 20px' }} />
                  <div className="absolute top-4 right-8 w-28 h-28 bg-white/20 rounded-full blur-3xl" />
                  <div className="relative z-10 flex items-end gap-4 px-5 pt-5 pb-0">
                    <img src="/rebeca-character.png" alt="Rebeca" className="w-[120px] flex-shrink-0 pointer-events-none select-none" style={{ filter: 'drop-shadow(0 -4px 20px rgba(0,0,0,0.15))', animation: 'rs-float 6s ease-in-out infinite' }} />
                    <div className="pb-5">
                      <div className="inline-flex items-center gap-1.5 bg-white/20 backdrop-blur-sm text-white text-[11px] font-semibold px-2.5 py-1 rounded-full mb-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> Working 24/7
                      </div>
                      <h3 className="text-white text-xl font-bold leading-tight">Rebeca</h3>
                      <p className="text-white/60 text-sm mt-1">Your lead finder</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-2.5">
                {rebecaScenes.map((s, i) => {
                  const Icon = s.icon; const isActive = i === activeScene
                  return (
                    <button key={s.id} onClick={() => handleTabClick(i)}
                      className={`relative text-left w-full rounded-xl px-4 py-4 transition-all duration-300 overflow-hidden ${isActive ? 'bg-white shadow-lg shadow-black/5 ring-1 ring-[#25D366]/20' : 'bg-white/50 hover:bg-white/80 ring-1 ring-gray-200/60'}`}>
                      {isActive && <div className="absolute bottom-0 left-0 h-[3px] rounded-full" style={{ background: 'linear-gradient(90deg, #25D366, #4ade80)', animation: `rs-tab-progress ${messages.length * 1.9 + 2.6}s linear` }} />}
                      <div className="flex items-start gap-3">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors duration-300 ${isActive ? 'bg-[#25D366] text-white' : 'bg-gray-100 text-gray-400'}`}><Icon className="w-4.5 h-4.5" /></div>
                        <div className="flex-1 min-w-0">
                          <h4 className={`text-sm font-bold leading-tight ${isActive ? 'text-gray-900' : 'text-gray-500'}`}>{s.label}</h4>
                          <p className={`text-xs mt-1 leading-relaxed transition-all duration-300 ${isActive ? 'text-gray-500 max-h-20 opacity-100' : 'text-gray-400 max-h-0 opacity-0 overflow-hidden'}`}>{s.desc}</p>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Right: WhatsApp Chat */}
            <div className="col-span-7">
              <div className="rounded-2xl shadow-xl border border-gray-200 overflow-hidden" style={{ opacity: fadingOut ? 0 : 1, transition: 'opacity 0.3s ease' }}>
                <div className="px-4 py-3 flex items-center gap-3" style={{ background: '#075e54' }}>
                  <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0"><img src="/rebeca.jpg" alt="Rebeca" className="w-full h-full object-cover" /></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-semibold leading-tight">Rebeca</p>
                    <div className="flex items-center gap-1.5 mt-0.5"><span className="w-2 h-2 rounded-full bg-green-400 inline-block" /><span className="text-green-200 text-[11px]">online</span></div>
                  </div>
                </div>
                <div ref={chatBodyRef} className="overflow-y-auto" style={{ background: '#ece5dd', maxHeight: '400px', minHeight: '340px', padding: '16px 12px' }}>
                  <div className="flex flex-col gap-3">
                    {messages.slice(0, visibleCount).map((msg, i) => {
                      const isAgent = msg.from === 'agent'
                      return (
                        <div key={`${activeScene}-${i}`} className={`flex items-end gap-1.5 ${isAgent ? 'justify-start' : 'justify-end'}`} style={{ animation: 'rs-msg-in 0.4s ease-out both' }}>
                          {isAgent && <img src="/rebeca.jpg" alt="" className="w-6 h-6 rounded-full object-cover flex-shrink-0 mb-0.5" />}
                          {msg.type === 'voice' ? (
                            <div className="bg-[#dcf8c6] rounded-2xl px-3 py-2 shadow-sm max-w-[75%]" style={{ direction: 'ltr' }}>
                              <div className="flex items-center gap-2.5 mb-1">
                                <div className="w-8 h-8 rounded-full bg-[#54856c] flex items-center justify-center flex-shrink-0"><Play className="w-3.5 h-3.5 text-white fill-white ml-0.5" /></div>
                                <RWaveform /><span className="text-xs text-[#54856c] font-medium whitespace-nowrap">{msg.duration}</span>
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
                          {!isAgent && <img src={USER_AVT} alt="" className="w-6 h-6 rounded-full object-cover flex-shrink-0 mb-0.5" />}
                        </div>
                      )
                    })}
                    {showTyping && <div className="flex justify-start"><RTyping /></div>}
                  </div>
                </div>
                <div className="bg-[#f0f0f0] px-3 py-2 flex items-center gap-2 border-t border-gray-200">
                  <div className="flex-1 bg-white rounded-full px-4 py-2 text-xs text-gray-400">Type a message...</div>
                  <div className="w-9 h-9 rounded-full bg-[#075e54] flex items-center justify-center flex-shrink-0"><Mic className="w-4 h-4 text-white" /></div>
                </div>
              </div>
            </div>
          </div>

          {/* Mobile layout */}
          <div className="lg:hidden">
            <div className="flex flex-col gap-2 mb-6">
              {rebecaScenes.map((s, i) => {
                const Icon = s.icon; const isActive = i === activeScene
                return (
                  <button key={s.id} onClick={() => handleTabClick(i)}
                    className={`relative text-left w-full rounded-xl px-4 py-3 transition-all duration-300 overflow-hidden ${isActive ? 'bg-white shadow-md shadow-black/5 ring-1 ring-[#25D366]/20' : 'bg-white/60 ring-1 ring-gray-200/60'}`}>
                    {isActive && <div className="absolute bottom-0 left-0 h-[3px] rounded-full" style={{ background: 'linear-gradient(90deg, #25D366, #4ade80)', animation: `rs-tab-progress ${messages.length * 1.9 + 2.6}s linear` }} />}
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${isActive ? 'bg-[#25D366] text-white' : 'bg-gray-100 text-gray-400'}`}><Icon className="w-4 h-4" /></div>
                      <div className="flex-1 min-w-0">
                        <h4 className={`text-sm font-bold leading-tight ${isActive ? 'text-gray-900' : 'text-gray-500'}`}>{s.label}</h4>
                        <p className={`text-xs mt-0.5 leading-relaxed transition-all duration-300 ${isActive ? 'text-gray-500 max-h-16 opacity-100' : 'text-gray-400 max-h-0 opacity-0 overflow-hidden'}`}>{s.desc}</p>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
            <div className="rounded-2xl shadow-xl border border-gray-200 overflow-hidden mx-auto max-w-sm" style={{ opacity: fadingOut ? 0 : 1, transition: 'opacity 0.3s ease' }}>
              <div className="px-4 py-3 flex items-center gap-3" style={{ background: '#075e54' }}>
                <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0"><img src="/rebeca.jpg" alt="Rebeca" className="w-full h-full object-cover" /></div>
                <div className="flex-1 min-w-0"><p className="text-white text-sm font-semibold leading-tight">Rebeca</p><div className="flex items-center gap-1.5 mt-0.5"><span className="w-2 h-2 rounded-full bg-green-400 inline-block" /><span className="text-green-200 text-[11px]">online</span></div></div>
              </div>
              <div className="overflow-y-auto" style={{ background: '#ece5dd', maxHeight: '380px', minHeight: '300px', padding: '16px 12px' }}>
                <div className="flex flex-col gap-3">
                  {messages.slice(0, visibleCount).map((msg, i) => {
                    const isAgent = msg.from === 'agent'
                    return (
                      <div key={`mob-${activeScene}-${i}`} className={`flex items-end gap-1.5 ${isAgent ? 'justify-start' : 'justify-end'}`} style={{ animation: 'rs-msg-in 0.4s ease-out both' }}>
                        {isAgent && <img src="/rebeca.jpg" alt="" className="w-6 h-6 rounded-full object-cover flex-shrink-0 mb-0.5" />}
                        {msg.type === 'voice' ? (
                          <div className="bg-[#dcf8c6] rounded-2xl px-3 py-2 shadow-sm max-w-[75%]" style={{ direction: 'ltr' }}>
                            <div className="flex items-center gap-2.5 mb-1">
                              <div className="w-8 h-8 rounded-full bg-[#54856c] flex items-center justify-center flex-shrink-0"><Play className="w-3.5 h-3.5 text-white fill-white ml-0.5" /></div>
                              <RWaveform /><span className="text-xs text-[#54856c] font-medium whitespace-nowrap">{msg.duration}</span>
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
                        {!isAgent && <img src={USER_AVT} alt="" className="w-6 h-6 rounded-full object-cover flex-shrink-0 mb-0.5" />}
                      </div>
                    )
                  })}
                  {showTyping && <div className="flex justify-start"><RTyping /></div>}
                </div>
              </div>
              <div className="bg-[#f0f0f0] px-3 py-2 flex items-center gap-2 border-t border-gray-200">
                <div className="flex-1 bg-white rounded-full px-4 py-2 text-xs text-gray-400">Type a message...</div>
                <div className="w-9 h-9 rounded-full bg-[#075e54] flex items-center justify-center flex-shrink-0"><Mic className="w-4 h-4 text-white" /></div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}

/* ═══════════════════════════════════════════════════════════
   GROUP LEADS — LANDING PAGE
   WhatsApp Group Lead Extractor focused landing page
   ═══════════════════════════════════════════════════════════ */
export default function GroupLeads() {
  const navigate = useNavigate()

  const howRef = useInView(0.15)
  const featRef = useInView(0.15)
  const pricingRef = useInView(0.15)
  const faqRef = useInView(0.15)
  const ctaRef = useInView(0.15)

  return (
    <div className="min-h-screen">
      <Helmet>
        <title>Your Next Job Is Already In a WhatsApp Group | MasterLeadFlow</title>
        <meta name="description" content="We scan hundreds of WhatsApp contractor groups and send you the leads that match your trade and area. Free to try." />
      </Helmet>

      <SiteNavbar />
      <div className="le-bg" />
      <div className="le-grain" />

      {/* ══════════════ HERO ══════════════ */}
      <section className="relative pt-28 pb-20 md:pt-36 md:pb-28 overflow-x-clip">
        <div className="absolute top-20 right-0 w-[600px] h-[600px] bg-[#25D366]/6 rounded-full blur-[150px]" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-[#fe5b25]/4 rounded-full blur-[120px]" />

        <div className="max-w-7xl mx-auto px-6 relative">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.1fr] gap-10 lg:gap-16 items-center min-h-[520px]">

            {/* Left — Text */}
            <div className="relative z-10">
              <div className="animate-fade-in inline-flex items-center gap-2 bg-[#fe5b25]/10 border border-[#fe5b25]/20 text-[#fe5b25] rounded-full px-4 py-1.5 text-xs font-semibold mb-8 tracking-wide uppercase">
                <Zap className="w-3.5 h-3.5" />
                200+ groups scanned daily
              </div>

              <h1
                className="animate-fade-in text-[2.75rem] md:text-5xl lg:text-[3.5rem] font-bold leading-[1.1] tracking-[-0.035em] mb-5 text-zinc-900"
                style={{ animationDelay: '100ms' }}
              >
                Your Next Job Is Already
                <br />
                <span className="relative inline-block mt-1">
                  <span className="relative z-10 text-[#fe5b25]">In a WhatsApp Group</span>
                  <span className="absolute inset-x-0 bottom-1 h-3.5 bg-[#fe5b25]/12 rounded-sm -z-0" />
                </span>
              </h1>

              <p
                className="animate-fade-in text-[1.05rem] md:text-lg text-stone-500 max-w-md mb-9 leading-relaxed"
                style={{ animationDelay: '200ms' }}
              >
                We scan hundreds of contractor groups and send you the ones that match your trade and area.
              </p>

              {/* Step pills */}
              <div className="animate-fade-in flex flex-wrap items-center gap-2 mb-9" style={{ animationDelay: '300ms' }}>
                {[
                  { icon: Search, label: 'We Scan', color: '#25D366' },
                  { icon: Filter, label: 'We Match', color: '#fe5b25' },
                  { icon: Bell, label: 'You Get Leads', color: '#3b82f6' },
                ].map((s, i) => (
                  <div key={s.label} className="flex items-center gap-2">
                    {i > 0 && <ChevronRight className="w-3.5 h-3.5 text-stone-300" />}
                    <div className="bg-white/80 backdrop-blur-sm rounded-full px-4 py-2 flex items-center gap-2 shadow-sm border border-stone-100">
                      <s.icon className="w-4 h-4" style={{ color: s.color }} />
                      <span className="text-sm font-semibold text-zinc-700">{s.label}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="animate-fade-in flex flex-col sm:flex-row items-start gap-4" style={{ animationDelay: '400ms' }}>
                <button
                  onClick={() => window.open(REBECA_WA, '_blank')}
                  className="group inline-flex items-center justify-center gap-2.5 rounded-full bg-gradient-to-r from-[#fe5b25] to-[#e04d1c] text-white px-8 py-4 text-base font-semibold transition-all duration-300 hover:scale-[1.03] hover:shadow-xl hover:shadow-[#fe5b25]/20 active:scale-[0.98] cursor-pointer"
                >
                  See Leads In Your Area
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </button>
                <a
                  href="#how-it-works"
                  className="inline-flex items-center gap-2 rounded-full border border-stone-200 px-6 py-4 text-sm font-semibold text-zinc-700 hover:bg-stone-50 transition-colors"
                >
                  How It Works
                  <ChevronDown className="w-4 h-4" />
                </a>
              </div>

              {/* Trust bar */}
              <div className="animate-fade-in mt-10 flex items-center gap-3" style={{ animationDelay: '500ms' }}>
                <div className="flex -space-x-2">
                  {[11, 22, 33, 44, 55].map(n => (
                    <img key={n} src={`https://i.pravatar.cc/32?img=${n}`} className="w-7 h-7 rounded-full border-2 border-white" alt="" />
                  ))}
                </div>
                <span className="text-xs text-stone-400">We check <span className="font-semibold text-zinc-700">200+ groups</span> every day</span>
              </div>
            </div>

            {/* Right — Scan Flow: Group → Extract → Rebeca */}
            <div className="animate-fade-in relative" style={{ animationDelay: '300ms' }}>
              <style>{`
                @keyframes hero-scan-line { 0% { top: 8%; opacity: 0; } 10% { opacity: 1; } 90% { opacity: 1; } 100% { top: 88%; opacity: 0; } }
                @keyframes hero-lead-fly { 0% { opacity: 0; transform: translateX(0); } 15% { opacity: 1; } 85% { opacity: 1; } 100% { opacity: 0; transform: translateX(90px); } }
                @keyframes hero-pulse-ring { 0% { transform: scale(1); opacity: 0.6; } 100% { transform: scale(2); opacity: 0; } }
                @keyframes hero-dot-travel { 0% { left: 0; opacity: 0; } 10% { opacity: 1; } 90% { opacity: 1; } 100% { left: 100%; opacity: 0; } }
                @keyframes hero-extract-glow { 0%, 100% { box-shadow: 0 0 0 0 rgba(254,91,37,0); } 50% { box-shadow: 0 0 12px 4px rgba(254,91,37,0.25); } }
              `}</style>

              <div className="flex items-center gap-4 lg:gap-5">
                {/* Phone — WhatsApp Group (realistic) */}
                <div className="relative flex-shrink-0" style={{ width: '230px' }}>
                  <div className="rounded-[2rem] bg-gradient-to-b from-zinc-700 to-zinc-900 p-[6px] shadow-2xl shadow-black/40">
                    {/* Notch */}
                    <div className="absolute top-[6px] left-1/2 -translate-x-1/2 w-20 h-5 bg-black rounded-b-2xl z-30" />
                    <div className="rounded-[1.6rem] overflow-hidden bg-white">
                      {/* WA Header — realistic green */}
                      <div className="pt-6 px-3 pb-2 flex items-center gap-2.5" style={{ background: '#075E54' }}>
                        <div className="flex -space-x-1.5">
                          {[11, 22, 33].map(n => (
                            <img key={n} src={`https://i.pravatar.cc/20?img=${n}`} className="w-5 h-5 rounded-full border border-[#075E54]" alt="" />
                          ))}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-white text-[11px] font-semibold truncate">GC Leads - South Texas</div>
                          <div className="text-[9px] text-white/50">Mike, Carlos, Ahmad, +244</div>
                        </div>
                      </div>

                      {/* Chat body — real WA background */}
                      <div className="relative" style={{ background: '#ece5dd', padding: '8px 6px', minHeight: '290px' }}>
                        {/* WA wallpaper pattern */}
                        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'200\' height=\'200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M20 20h10v10H20zM50 50h10v10H50zM80 20h10v10H80zM20 80h10v10H20zM110 110h10v10h-10zM140 50h10v10h-10zM50 140h10v10H50zM170 170h10v10h-10z\' fill=\'%23000\'/%3E%3C/svg%3E")', backgroundSize: '100px' }} />

                        {/* Scan line */}
                        <div className="absolute left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#25D366] to-transparent z-20"
                          style={{ animation: 'hero-scan-line 3s ease-in-out infinite' }} />

                        <div className="relative z-10 flex flex-col gap-[5px]">
                          {/* Regular msg — other person (white bubble) */}
                          <div className="flex gap-1 items-end">
                            <div className="bg-white rounded-lg rounded-tl-sm px-2.5 py-1.5 shadow-[0_1px_1px_rgba(0,0,0,0.08)] max-w-[85%]">
                              <p className="text-[8px] font-semibold text-[#075E54] mb-0.5">Mike R.</p>
                              <p className="text-[10px] text-gray-700 leading-snug">Anyone know a good tile guy?</p>
                              <p className="text-[8px] text-gray-400 text-right mt-0.5">9:41 AM</p>
                            </div>
                          </div>

                          {/* HOT lead — highlighted white bubble */}
                          <div className="relative flex gap-1 items-end">
                            <div className="absolute -inset-1 bg-[#fe5b25]/12 rounded-xl border border-[#fe5b25]/25 animate-pulse" style={{ animationDuration: '2.5s' }} />
                            <div className="relative bg-white rounded-lg rounded-tl-sm px-2.5 py-1.5 shadow-[0_1px_2px_rgba(0,0,0,0.1)] max-w-[85%] ring-1 ring-[#fe5b25]/30">
                              <p className="text-[8px] font-semibold text-[#075E54] mb-0.5">John S.</p>
                              <p className="text-[10px] text-gray-800 leading-snug font-medium">Need HVAC sub ASAP. 3 units, residential. Houston area. Good pay. Call me 📞</p>
                              <div className="flex items-center justify-end gap-1 mt-0.5">
                                <p className="text-[8px] text-gray-400">9:43 AM</p>
                              </div>
                            </div>
                            <div className="absolute -top-2 -right-1 bg-[#fe5b25] text-white text-[7px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5 shadow-md z-10">
                              <Flame className="w-2 h-2" /> HOT
                            </div>
                            <div className="absolute top-1/2 right-0 w-2 h-2 rounded-full bg-[#fe5b25] z-10"
                              style={{ animation: 'hero-lead-fly 3s ease-out infinite', animationDelay: '1s' }} />
                          </div>

                          {/* Noise — green bubble (own msg style for variety) */}
                          <div className="flex justify-end">
                            <div className="bg-[#dcf8c6] rounded-lg rounded-tr-sm px-2.5 py-1.5 shadow-[0_1px_1px_rgba(0,0,0,0.06)] max-w-[70%]">
                              <p className="text-[10px] text-gray-700">Thanks bro 🙏</p>
                              <p className="text-[8px] text-gray-400 text-right mt-0.5">9:45 AM</p>
                            </div>
                          </div>

                          {/* WARM lead */}
                          <div className="relative flex gap-1 items-end">
                            <div className="absolute -inset-1 bg-amber-500/8 rounded-xl border border-amber-500/15" />
                            <div className="relative bg-white rounded-lg rounded-tl-sm px-2.5 py-1.5 shadow-[0_1px_1px_rgba(0,0,0,0.08)] max-w-[85%] ring-1 ring-amber-500/20">
                              <p className="text-[8px] font-semibold text-[#075E54] mb-0.5">Carlos M.</p>
                              <p className="text-[10px] text-gray-700 leading-snug">Looking for plumber, bathroom remodel in Dallas. DM me 💬</p>
                              <p className="text-[8px] text-gray-400 text-right mt-0.5">9:48 AM</p>
                            </div>
                            <div className="absolute -top-2 -right-1 bg-amber-500 text-white text-[7px] font-bold px-1.5 py-0.5 rounded-full shadow-md z-10">WARM</div>
                            <div className="absolute top-1/2 right-0 w-1.5 h-1.5 rounded-full bg-amber-500 z-10"
                              style={{ animation: 'hero-lead-fly 3s ease-out infinite', animationDelay: '2s' }} />
                          </div>

                          {/* More noise */}
                          <div className="flex gap-1 items-end">
                            <div className="bg-white rounded-lg rounded-tl-sm px-2.5 py-1.5 shadow-[0_1px_1px_rgba(0,0,0,0.06)] max-w-[75%]">
                              <p className="text-[8px] font-semibold text-[#6b3fa0] mb-0.5">Ahmad K.</p>
                              <p className="text-[10px] text-gray-600">Happy Friday everyone 💪</p>
                              <p className="text-[8px] text-gray-400 text-right mt-0.5">9:50 AM</p>
                            </div>
                          </div>
                        </div>

                        {/* Input bar */}
                        <div className="flex items-center gap-1.5 mt-2">
                          <div className="flex-1 bg-white rounded-full px-3 py-1.5 text-[9px] text-gray-400 shadow-sm">Type a message</div>
                          <div className="w-6 h-6 rounded-full bg-[#075E54] flex items-center justify-center flex-shrink-0">
                            <Mic className="w-3 h-3 text-white" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="text-center mt-3">
                    <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">WhatsApp Groups</span>
                  </div>
                </div>

                {/* Rebeca in the middle — extraction flow */}
                <div className="flex flex-col items-center flex-shrink-0" style={{ width: '220px' }}>
                  {/* Rebeca character */}
                  <div className="relative mb-3">
                    <div className="absolute top-6 left-1/2 -translate-x-1/2 w-20 h-20 rounded-full border-2 border-[#25D366]/20"
                      style={{ animation: 'hero-pulse-ring 2s ease-out infinite' }} />
                    <div className="absolute top-6 left-1/2 -translate-x-1/2 w-20 h-20 rounded-full border-2 border-[#25D366]/20"
                      style={{ animation: 'hero-pulse-ring 2s ease-out infinite', animationDelay: '1s' }} />
                    <img src="/rebeca-character.png" alt="Rebeca" className="w-[110px] relative z-10 pointer-events-none select-none mx-auto"
                      style={{ filter: 'drop-shadow(0 4px 16px rgba(0,0,0,0.2))', animation: 'rs-float 6s ease-in-out infinite' }} />
                  </div>
                  <div className="text-center mb-3">
                    <div className="inline-flex items-center gap-1 bg-[#25D366]/10 text-[#25D366] text-[9px] font-semibold px-2.5 py-1 rounded-full mb-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#25D366] animate-pulse" /> Scanning 24/7
                    </div>
                    <h4 className="text-sm font-bold text-zinc-800">Rebeca</h4>
                    <p className="text-[10px] text-stone-400">finds & sends your leads</p>
                  </div>

                  {/* Dotted path with traveling dots */}
                  <div className="relative w-full h-5 mb-3">
                    <div className="absolute top-1/2 left-0 right-0 border-t-2 border-dashed border-[#fe5b25]/25" />
                    <div className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-[#fe5b25] shadow-md shadow-[#fe5b25]/40"
                      style={{ animation: 'hero-dot-travel 2s ease-in-out infinite' }} />
                    <div className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-amber-500 shadow-md shadow-amber-500/40"
                      style={{ animation: 'hero-dot-travel 2s ease-in-out infinite', animationDelay: '1s' }} />
                  </div>

                  {/* Realistic WhatsApp message — actual template */}
                  <div className="animate-fade-in" style={{ animationDelay: '1200ms' }}>
                    <div className="rounded-xl shadow-lg border border-stone-100 overflow-hidden" style={{ width: '220px' }}>
                      {/* WA header mini */}
                      <div className="flex items-center gap-2 px-2.5 py-1.5" style={{ background: '#075E54' }}>
                        <div className="w-5 h-5 rounded-full overflow-hidden shrink-0">
                          <img src="/rebeca.jpg" alt="" className="w-full h-full object-cover" />
                        </div>
                        <span className="text-[9px] text-white font-semibold">Rebeca</span>
                        <span className="ml-auto text-[8px] text-white/40">now</span>
                      </div>
                      {/* Message body */}
                      <div style={{ background: '#ece5dd', padding: '6px' }}>
                        <div className="bg-white rounded-lg px-2.5 py-2 shadow-sm">
                          <p className="text-[9px] text-gray-800 leading-[1.5] whitespace-pre-line font-medium">{'❄️'} <span className="font-bold">New HVAC Lead</span>{'\n'}━━━━━━━━━━━━{'\n\n'}📍 <span className="font-bold">Location:</span> Houston, TX{'\n'}📝 <span className="font-bold">Request:</span> 3 units, residential{'\n'}💬 <span className="font-bold">Source:</span> GC Leads Texas{'\n\n'}⚡ Reply now to claim</p>
                          <p className="text-[7px] text-gray-400 text-right mt-1">12:03 PM ✓✓</p>
                        </div>
                        {/* Action buttons */}
                        <div className="flex gap-1 mt-1.5">
                          <button className="flex-1 bg-[#25D366] text-white text-[8px] font-bold py-1.5 rounded-md flex items-center justify-center gap-1">
                            <CheckCircle className="w-2.5 h-2.5" /> Claim Lead
                          </button>
                          <button className="flex-1 bg-white text-gray-500 text-[8px] font-medium py-1.5 rounded-md border border-gray-200">
                            Pass
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="text-center mt-3">
                    <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">What You Get</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════ HOW IT WORKS — Dark premium section ══════════════ */}
      <section id="how-it-works" ref={howRef.ref as React.RefObject<HTMLElement>} className="py-24 md:py-32 px-6 relative overflow-hidden" style={{ background: 'linear-gradient(180deg, #0f0f0f 0%, #1a1a1a 100%)' }}>
        {/* Dot grid */}
        <div className="absolute inset-0 opacity-[0.04] pointer-events-none" style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,.6) 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
        {/* Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-[#25D366]/6 rounded-full blur-[120px] pointer-events-none" />

        <div className="max-w-5xl mx-auto relative">
          <div className={`text-center mb-16 transition-all duration-700 ${howRef.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
            <h2 className="text-3xl md:text-4xl font-bold tracking-[-0.03em] text-white mb-4">
              How It Works
            </h2>
            <p className="text-base text-white/40 max-w-lg mx-auto">
              You sign up, tell us what you do and where — we do the rest.
            </p>
          </div>

          {/* 3 steps — horizontal flow with line */}
          <div className={`relative transition-all duration-700 ${howRef.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
            {/* Connecting line (desktop) */}
            <div className="hidden md:block absolute top-[60px] left-[16%] right-[16%] h-[2px]">
              <div className="h-full bg-gradient-to-r from-[#25D366] via-[#fe5b25] to-[#3b82f6] rounded-full opacity-30" />
              {/* Animated traveling dot */}
              <div className="absolute top-[-3px] w-2 h-2 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.6)]"
                style={{ animation: 'hero-dot-travel 4s ease-in-out infinite' }} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-8">
              {[
                {
                  num: '01', icon: Search, color: '#25D366', colorEnd: '#4ade80',
                  title: 'We Check the Groups',
                  desc: 'Hundreds of WhatsApp groups, all day, every day. You don\'t lift a finger.',
                  detail: '200+ active groups',
                },
                {
                  num: '02', icon: Filter, color: '#fe5b25', colorEnd: '#ff7a4d',
                  title: 'We Find What Fits',
                  desc: 'AI matches leads to your trade and zip code. No junk, no noise.',
                  detail: 'Trade + area match',
                },
                {
                  num: '03', icon: Zap, color: '#3b82f6', colorEnd: '#60a5fa',
                  title: 'You Get the Lead',
                  desc: 'Rebeca sends it straight to your WhatsApp with contact info.',
                  detail: 'Straight to WhatsApp',
                },
              ].map((s, i) => (
                <div key={s.num} className="flex flex-col items-center text-center group">
                  {/* Glowing circle */}
                  <div className="relative mb-6">
                    <div
                      className="w-[120px] h-[120px] rounded-full flex items-center justify-center transition-transform duration-300 group-hover:scale-110"
                      style={{
                        background: `linear-gradient(135deg, ${s.color}15, ${s.color}08)`,
                        border: `2px solid ${s.color}30`,
                        boxShadow: `0 0 30px ${s.color}15, 0 0 60px ${s.color}08`,
                      }}
                    >
                      <div
                        className="w-16 h-16 rounded-2xl flex items-center justify-center"
                        style={{ background: `linear-gradient(135deg, ${s.color}, ${s.colorEnd})`, boxShadow: `0 8px 24px ${s.color}40` }}
                      >
                        <s.icon className="w-7 h-7 text-white" />
                      </div>
                    </div>
                    {/* Step number */}
                    <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-white text-zinc-900 text-[10px] font-black px-3 py-1 rounded-full shadow-lg">
                      STEP {s.num}
                    </div>
                  </div>

                  <h3 className="text-lg font-bold text-white mb-2 mt-2">{s.title}</h3>
                  <p className="text-sm text-white/50 leading-relaxed max-w-[260px] mb-3">{s.desc}</p>
                  <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1 rounded-full" style={{ background: `${s.color}15`, color: s.color }}>
                    <CheckCircle className="w-3 h-3" />
                    {s.detail}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════ REBECA SCANNER ══════════════ */}
      <RebecaScanner />

      {/* ══════════════ YOUR GROUPS + OUR GROUPS ══════════════ */}
      <section className="py-20 md:py-28 px-6 relative overflow-hidden" style={{ background: 'linear-gradient(180deg, #f8f7f4 0%, #faf9f6 100%)' }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold tracking-[-0.03em] text-zinc-900 mb-4">
              Your Groups <span className="text-[#fe5b25]">+</span> Our Groups
            </h2>
            <p className="text-base text-stone-500 max-w-xl mx-auto">
              Send us the groups you{"'"}re in — and get leads from hundreds more you{"'"}re not.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">

            {/* Card 1: Your groups — WhatsApp chat list style */}
            <div className="rounded-2xl overflow-hidden shadow-xl">
              {/* WA header */}
              <div className="px-4 py-3 flex items-center justify-between" style={{ background: '#075E54' }}>
                <h3 className="text-white text-sm font-semibold">Your Groups</h3>
                <span className="text-[10px] text-white/50">You send us these</span>
              </div>
              {/* Chat list */}
              <div style={{ background: '#111b21' }}>
                {[
                  { name: 'GC Leads - South Texas', avatar: 11, members: '247', lastMsg: 'Mike: Need HVAC sub ASAP...', time: '9:43 AM', unread: 12 },
                  { name: 'HVAC Contractors FL', avatar: 22, members: '189', lastMsg: 'Carlos: Anyone available for...', time: '8:15 AM', unread: 5 },
                  { name: 'Plumbing Jobs Houston', avatar: 33, members: '312', lastMsg: 'John: Looking for plumber...', time: '7:30 AM', unread: 8 },
                  { name: 'Renovation Pros TX', avatar: 44, members: '156', lastMsg: 'David: Kitchen remodel job in...', time: 'Yesterday', unread: 3 },
                ].map((g, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-white/5 hover:bg-white/5 transition-colors">
                    {/* Group avatar */}
                    <div className="relative shrink-0">
                      <div className="w-12 h-12 rounded-full bg-[#25D366]/20 flex items-center justify-center overflow-hidden">
                        <div className="grid grid-cols-2 gap-[1px]">
                          {[i*4+10, i*4+11, i*4+12, i*4+13].map(n => (
                            <img key={n} src={`https://i.pravatar.cc/24?img=${n}`} className="w-[22px] h-[22px] rounded-sm" alt="" />
                          ))}
                        </div>
                      </div>
                      <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-[#25D366] flex items-center justify-center">
                        <CheckCircle className="w-2.5 h-2.5 text-white" />
                      </div>
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-[13px] text-white font-medium truncate">{g.name}</span>
                        <span className="text-[10px] text-[#25D366] shrink-0 ml-2">{g.time}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-white/40 truncate">{g.lastMsg}</span>
                        <span className="bg-[#25D366] text-white text-[9px] font-bold min-w-[18px] h-[18px] rounded-full flex items-center justify-center shrink-0 ml-2">{g.unread}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {/* Bottom label */}
              <div className="px-4 py-2.5 flex items-center justify-center gap-2" style={{ background: '#0b141a' }}>
                <CheckCircle className="w-3.5 h-3.5 text-[#25D366]" />
                <span className="text-[11px] text-white/40">We join your groups and start scanning</span>
              </div>
            </div>

            {/* Card 2: Our network — WhatsApp chat list style */}
            <div className="rounded-2xl overflow-hidden shadow-xl">
              {/* Header */}
              <div className="px-4 py-3 flex items-center justify-between" style={{ background: 'linear-gradient(135deg, #fe5b25, #e04d1c)' }}>
                <h3 className="text-white text-sm font-semibold">Our Network</h3>
                <span className="text-[10px] text-white/70">200+ groups we scan</span>
              </div>
              {/* Chat list */}
              <div style={{ background: '#111b21' }}>
                {[
                  { name: 'Roofing Pros - Florida', members: '423', lastMsg: 'Need roofer for commercial...', time: '10:12 AM', unread: 15, emoji: '🏗️' },
                  { name: 'Electricians USA', members: '567', lastMsg: 'Emergency electrical job in...', time: '9:55 AM', unread: 22, emoji: '⚡' },
                  { name: 'Fencing & Decks - TX', members: '198', lastMsg: 'Fence install 200 linear ft...', time: '9:30 AM', unread: 6, emoji: '🏡' },
                  { name: 'Painting Contractors', members: '345', lastMsg: 'Interior paint job, 3 bedroom...', time: '8:45 AM', unread: 9, emoji: '🎨' },
                ].map((g, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-white/5">
                    {/* Group avatar with emoji */}
                    <div className="relative shrink-0">
                      <div className="w-12 h-12 rounded-full bg-[#fe5b25]/15 flex items-center justify-center">
                        <span className="text-xl">{g.emoji}</span>
                      </div>
                      <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-[#fe5b25] flex items-center justify-center">
                        <Search className="w-2.5 h-2.5 text-white" />
                      </div>
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-[13px] text-white font-medium truncate">{g.name}</span>
                        <span className="text-[10px] text-[#fe5b25] shrink-0 ml-2">{g.time}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-white/40 truncate">{g.lastMsg}</span>
                        <span className="bg-[#fe5b25] text-white text-[9px] font-bold min-w-[18px] h-[18px] rounded-full flex items-center justify-center shrink-0 ml-2">{g.unread}</span>
                      </div>
                    </div>
                  </div>
                ))}
                {/* "And more" row */}
                <div className="flex items-center justify-center gap-2 px-4 py-3 border-t border-white/5">
                  <span className="text-[11px] text-white/30">+ 196 more groups across all trades</span>
                </div>
              </div>
              {/* Bottom label */}
              <div className="px-4 py-2.5 flex items-center justify-center gap-2" style={{ background: '#0b141a' }}>
                <Zap className="w-3.5 h-3.5 text-[#fe5b25]" />
                <span className="text-[11px] text-white/40">Leads from groups you didn{"'"}t even know existed</span>
              </div>
            </div>
          </div>

          {/* Bottom connector */}
          <div className="flex items-center justify-center gap-4 mt-10">
            <div className="h-[1px] w-16 bg-stone-200" />
            <div className="bg-white rounded-full px-5 py-2.5 shadow-md border border-stone-100 flex items-center gap-2">
              <Zap className="w-4 h-4 text-[#fe5b25]" />
              <span className="text-sm font-bold text-zinc-800">All leads go to your feed</span>
            </div>
            <div className="h-[1px] w-16 bg-stone-200" />
          </div>
        </div>
      </section>

      {/* ══════════════ LIVE FEED SHOWCASE (from landing) ══════════════ */}
      <LeadsFeedShowcase />

      {/* ══════════════ FEATURES ══════════════ */}
      <section id="features" ref={featRef.ref as React.RefObject<HTMLElement>} className="py-20 md:py-28 px-6">
        <div className="max-w-5xl mx-auto">
          <div className={`text-center mb-14 transition-all duration-700 ${featRef.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-zinc-900 mb-3">
              What you get
            </h2>
            <p className="text-stone-400 max-w-md mx-auto">
              No fluff. Just the tools to get more jobs, faster.
            </p>
          </div>

          <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-stone-200/60 rounded-2xl overflow-hidden border border-stone-200/60 ${featRef.visible ? 'stagger-children' : ''}`}>
            {[
              { icon: MessageSquare, title: 'Real group leads', desc: 'From 200+ WhatsApp groups. Real people, real jobs, right now.' },
              { icon: Filter, title: 'Matched to you', desc: 'Your trade, your area. We only send what fits.' },
              { icon: Flame, title: 'Urgency ranking', desc: 'Hot, warm, or cold — so you call the urgent ones first.' },
              { icon: Phone, title: 'Contact info', desc: 'Name and number. No guessing, no middleman.' },
              { icon: Bell, title: 'Instant alerts', desc: 'Push notification the moment a lead matches you.' },
              { icon: Search, title: 'No junk', desc: 'AI filters out memes, ads, and chit-chat automatically.' },
            ].map(f => (
              <div key={f.title} className="bg-white p-6 md:p-8">
                <f.icon className="w-5 h-5 text-[#fe5b25] mb-3" strokeWidth={2} />
                <h3 className="font-semibold text-zinc-900 text-[15px] mb-1">{f.title}</h3>
                <p className="text-[13px] text-stone-400 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════ PRICING ══════════════ */}
      <section id="pricing" ref={pricingRef.ref as React.RefObject<HTMLElement>} className="py-24 md:py-32 px-6 relative">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-[#fe5b25]/[0.03] rounded-full blur-[100px] pointer-events-none" />

        <div className="max-w-4xl mx-auto relative">
          <div className={`text-center mb-14 transition-all duration-700 ${pricingRef.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
            <h2 className="text-3xl md:text-4xl font-bold tracking-[-0.03em] text-zinc-900 mb-4">
              One Plan. Everything You Need.
            </h2>
            <p className="text-base text-stone-500">
              Try free for 7 days. Cancel anytime.
            </p>
          </div>

          <div className={`max-w-5xl mx-auto transition-all duration-700 ${pricingRef.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
            <div className="relative overflow-hidden bg-gradient-to-br from-[#fe5b25] via-[#e8511e] to-[#c9410f] rounded-3xl text-white shadow-2xl shadow-[#fe5b25]/20">
              {/* Decorative glow */}
              <div className="absolute -top-24 -right-24 w-64 h-64 bg-white/[0.07] rounded-full blur-3xl pointer-events-none" />
              <div className="absolute -bottom-16 -left-16 w-48 h-48 bg-black/[0.08] rounded-full blur-3xl pointer-events-none" />

              {/* Stats bar */}
              <div className="relative border-b border-white/10 px-8 md:px-10 lg:px-12 py-4">
                <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-[13px] font-medium text-white/80">
                  <span className="flex items-center gap-2"><Users className="w-4 h-4 text-white/60" /> <strong className="text-white">200+</strong> Groups Scanned</span>
                  <span className="hidden md:inline text-white/30">|</span>
                  <span className="flex items-center gap-2"><Sparkles className="w-4 h-4 text-white/60" /> <strong className="text-white">AI-Powered</strong> Matching</span>
                  <span className="hidden md:inline text-white/30">|</span>
                  <span className="flex items-center gap-2"><Zap className="w-4 h-4 text-white/60" /> <strong className="text-white">Earn</strong> While You Work</span>
                </div>
              </div>

              <div className="relative p-8 md:p-10 lg:p-12">
                <div className="absolute top-4 right-6 bg-white/20 backdrop-blur-sm rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider">
                  7-Day Free Trial
                </div>

                {/* Header + CTA left, features right on desktop */}
                <div className="lg:flex lg:gap-12 lg:items-start">
                  {/* Left: price + CTA */}
                  <div className="lg:w-[280px] lg:shrink-0 mb-8 lg:mb-0">
                    <h3 className="text-lg font-bold mb-1">Premium</h3>
                    <div className="flex items-baseline gap-1 mb-1">
                      <span className="text-5xl font-bold tracking-tight">$79</span>
                      <span className="text-sm text-white/70">/month</span>
                    </div>
                    <p className="text-sm text-white/60 mb-6">Try free for 7 days. Cancel anytime.</p>
                    <button
                      onClick={() => window.open(REBECA_WA, '_blank')}
                      className="w-full rounded-full bg-white text-[#fe5b25] py-4 text-sm font-bold hover:bg-white/90 hover:scale-[1.02] active:scale-95 transition-all cursor-pointer shadow-lg shadow-black/10"
                    >
                      Start Free Trial
                    </button>
                    <div className="flex items-center justify-center gap-1.5 mt-3 text-white/50 text-[11px]">
                      <Shield className="w-3 h-3" />
                      <span>Cancel anytime. No contracts.</span>
                    </div>
                  </div>

                  {/* Right: features in 3 columns on desktop */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 flex-1">
                    <div>
                      <div className="flex items-center gap-2.5 mb-1.5">
                        <div className="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center">
                          <Search className="w-4 h-4" />
                        </div>
                        <p className="text-[14px] font-bold text-white">Find Jobs</p>
                      </div>
                      <p className="text-[12px] text-white/50 mb-4 ml-[42px]">We find work for you</p>
                      <ul className="space-y-2.5">
                        {[
                          'New leads every day',
                          'Name + phone number',
                          'Only jobs near you',
                          'Hot jobs show first',
                          'Alerts on WhatsApp',
                        ].map(f => (
                          <li key={f} className="flex items-start gap-2">
                            <CheckCircle className="w-3.5 h-3.5 text-white/70 mt-0.5 shrink-0" />
                            <span className="text-[13px] text-white/90">{f}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <div className="flex items-center gap-2.5 mb-1.5">
                        <div className="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center">
                          <Zap className="w-4 h-4" />
                        </div>
                        <p className="text-[14px] font-bold text-white">Post & Earn Money</p>
                      </div>
                      <p className="text-[12px] text-white/50 mb-4 ml-[42px]">Share jobs, get paid</p>
                      <ul className="space-y-2.5">
                        {[
                          'Post a job in 30 seconds',
                          'Send to the right people',
                          'Earn money on every deal',
                          'Track who said yes',
                          'Grow your network',
                        ].map(f => (
                          <li key={f} className="flex items-start gap-2">
                            <CheckCircle className="w-3.5 h-3.5 text-white/70 mt-0.5 shrink-0" />
                            <span className="text-[13px] text-white/90">{f}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <div className="flex items-center gap-2.5 mb-1.5">
                        <div className="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center">
                          <BarChart3 className="w-4 h-4" />
                        </div>
                        <p className="text-[14px] font-bold text-white">Track Everything</p>
                      </div>
                      <p className="text-[12px] text-white/50 mb-4 ml-[42px]">See it all in one place</p>
                      <ul className="space-y-2.5">
                        {[
                          'Your leads in one dashboard',
                          'Manage your team',
                          'Weekly report',
                          'Ratings & reviews',
                          'Priority support',
                        ].map(f => (
                          <li key={f} className="flex items-start gap-2">
                            <CheckCircle className="w-3.5 h-3.5 text-white/70 mt-0.5 shrink-0" />
                            <span className="text-[13px] text-white/90">{f}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════ FAQ ══════════════ */}
      <section id="faq" ref={faqRef.ref as React.RefObject<HTMLElement>} className="py-24 md:py-32 px-6 relative">
        <div className="max-w-2xl mx-auto">
          <div className={`text-center mb-12 transition-all duration-700 ${faqRef.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
            <h2 className="text-3xl md:text-4xl font-bold tracking-[-0.03em] text-zinc-900 mb-4">
              Questions? We Got You
            </h2>
          </div>

          <div className={`space-y-3 transition-all duration-700 ${faqRef.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
            <FaqItem
              q="What WhatsApp groups do you check?"
              a="Hundreds of contractor groups across the US — GCs, subs, renovation, HVAC, plumbing, roofing, and more. We add new ones every week."
            />
            <FaqItem
              q="How fast do I get leads?"
              a="Most leads show up in your feed within a few minutes after someone posts in a group."
            />
            <FaqItem
              q="Do I need to connect my WhatsApp?"
              a="No. We do all the scanning. Your WhatsApp is not involved at all. You just see the results."
            />
            <FaqItem
              q="Can I cancel?"
              a="Yes, cancel anytime. No contracts, no commitments. You can go back to the free plan whenever you want."
            />
            <FaqItem
              q="I'm not getting leads in my area"
              a="Tell us your zip code and trade, we'll make sure we're covering the right groups for you. We're always adding new groups."
            />
          </div>
        </div>
      </section>

      {/* ══════════════ BOTTOM CTA ══════════════ */}
      <section ref={ctaRef.ref as React.RefObject<HTMLElement>} className="py-24 md:py-32 px-6 relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-[#fe5b25]/[0.04] rounded-full blur-[100px] pointer-events-none" />

        <div className="max-w-3xl mx-auto text-center relative">
          <div className={`transition-all duration-700 ${ctaRef.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-[-0.03em] text-zinc-900 mb-5 leading-tight">
              Right Now, Someone Is<br />Looking For a Contractor Like You
            </h2>
            <p className="text-base text-stone-500 mb-10 leading-relaxed max-w-lg mx-auto">
              They posted it in a WhatsApp group. You just didn{"'"}t see it. We{"'"}ll find it for you.
            </p>
          </div>

          <div className={`transition-all duration-700 delay-200 ${ctaRef.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
            <button
              onClick={() => window.open(REBECA_WA, '_blank')}
              className="group inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#fe5b25] to-[#e04d1c] text-white px-10 py-4 text-base font-semibold transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-[#fe5b25]/25 active:scale-95 cursor-pointer mb-8"
            >
              Get Started Free
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </button>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-5 sm:gap-8">
              {['No credit card needed', 'Free to start', 'Cancel anytime'].map(text => (
                <div key={text} className="flex items-center gap-2">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="text-xs text-stone-500">{text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="max-w-5xl mx-auto mt-24 pt-8 border-t border-stone-200/60">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <a href={LANDING_URL} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-[9px] bg-gradient-to-br from-[#fe5b25] to-[#e04d1c]">LE</div>
              <span className="text-stone-400 text-sm font-medium">MasterLeadFlow</span>
            </a>
            <div className="flex items-center gap-6">
              <a href="#how-it-works" className="text-stone-400 text-xs hover:text-[#fe5b25] transition-colors">How It Works</a>
              <a href="#features" className="text-stone-400 text-xs hover:text-[#fe5b25] transition-colors">Features</a>
              <a href="#pricing" className="text-stone-400 text-xs hover:text-[#fe5b25] transition-colors">Pricing</a>
              <a href="#faq" className="text-stone-400 text-xs hover:text-[#fe5b25] transition-colors">FAQ</a>
            </div>
            <p className="text-stone-400 text-xs">We find the jobs. You do the work.</p>
          </div>
        </div>
      </section>
    </div>
  )
}
