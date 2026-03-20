import { useEffect, useRef, useState, useCallback } from 'react'
import { Bot, Mic, BarChart3, Play, Search, Share2, Sun } from 'lucide-react'
import { useLang } from '../i18n/LanguageContext'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
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
  labelEN: string
  labelHE: string
  descEN: string
  descHE: string
  messagesEN: Message[]
  messagesHE: Message[]
}

/* ------------------------------------------------------------------ */
/*  Scenes — each shows a different Rebeca capability                  */
/* ------------------------------------------------------------------ */

const scenes: Scene[] = [
  {
    id: 'leads',
    icon: Search,
    labelEN: 'Find Leads',
    labelHE: 'מציאת לידים',
    descEN: 'AI scans your WhatsApp groups 24/7 and sends matching jobs straight to you.',
    descHE: 'AI סורק את קבוצות הוואטסאפ שלך 24/7 ושולח לך עבודות מתאימות.',
    messagesEN: [
      { from: 'agent', type: 'text', text: '🔔 New lead in your area!\n\n📍 Miami, FL 33101\n🔧 Plumbing — Pipe leak\n💰 $300–500\n\nInterested?', time: '08:12' },
      { from: 'user', type: 'voice', duration: '0:03', caption: "Yes, I'm interested!", text: '', time: '08:13' },
      { from: 'agent', type: 'text', text: '✅ Connecting you now!\n📞 Client: Maria Lopez\n🕐 Expecting your call', time: '08:13' },
    ],
    messagesHE: [
      { from: 'agent', type: 'text', text: '🔔 ליד חדש באזור שלך!\n\n📍 מיאמי, FL 33101\n🔧 אינסטלציה — נזילת צינור\n💰 $300–500\n\nמעוניין?', time: '08:12' },
      { from: 'user', type: 'voice', duration: '0:03', caption: 'כן, אני מעוניין!', text: '', time: '08:13' },
      { from: 'agent', type: 'text', text: '✅ מחבר אותך עכשיו!\n📞 לקוחה: מריה לופז\n🕐 מחכה לשיחה שלך', time: '08:13' },
    ],
  },
  {
    id: 'morning',
    icon: Sun,
    labelEN: 'Morning Check',
    labelHE: 'בוקר טוב',
    descEN: "Every morning Rebeca asks where you're working and sends overnight leads.",
    descHE: 'כל בוקר רבקה שואלת איפה אתה עובד ושולחת לידים שהצטברו בלילה.',
    messagesEN: [
      { from: 'agent', type: 'text', text: '☀️ Good morning! Ready for today?\n\nWhat areas are you available in and what hours?', time: '07:00' },
      { from: 'user', type: 'voice', duration: '0:05', caption: "I'm in Miami today, 9 to 5", text: '', time: '07:02' },
      { from: 'agent', type: 'text', text: '✅ Got it! Searching for jobs in Miami, 9AM–5PM.\n\nYou have 3 leads waiting from overnight. Want me to send them?', time: '07:02' },
      { from: 'user', type: 'text', text: 'Send them', time: '07:03' },
      { from: 'agent', type: 'text', text: '📋 Sending 3 leads now...', time: '07:03' },
    ],
    messagesHE: [
      { from: 'agent', type: 'text', text: '☀️ בוקר טוב! מוכן להיום?\n\nאיפה אתה זמין היום ובאילו שעות?', time: '07:00' },
      { from: 'user', type: 'voice', duration: '0:05', caption: 'אני במיאמי היום, 9 עד 5', text: '', time: '07:02' },
      { from: 'agent', type: 'text', text: '✅ סבבה! מחפש עבודות במיאמי, 9:00–17:00.\n\nיש לך 3 לידים שחיכו מהלילה. לשלוח?', time: '07:02' },
      { from: 'user', type: 'text', text: 'שלח', time: '07:03' },
      { from: 'agent', type: 'text', text: '📋 שולח 3 לידים עכשיו...', time: '07:03' },
    ],
  },
  {
    id: 'distribute',
    icon: Share2,
    labelEN: 'Forward Jobs',
    labelHE: 'הפצת עבודות',
    descEN: 'Got a job you can\'t take? Forward it to your network and earn a commission.',
    descHE: 'נכנסה עבודה שלא שלך? העבר אותה לרשת שלך ותרוויח עמלה.',
    messagesEN: [
      { from: 'user', type: 'voice', duration: '0:06', caption: 'Got an AC job I can\'t take, can you send it out?', text: '', time: '14:20' },
      { from: 'agent', type: 'text', text: '📝 Got it! Here\'s what I\'ll send:\n\n❄️ AC Installation\n📍 Fort Lauderdale, 33301\n💰 $800–1,200\n\nShould I send to your contractor network?', time: '14:20' },
      { from: 'user', type: 'text', text: 'Yes, 15% commission', time: '14:21' },
      { from: 'agent', type: 'text', text: '✅ Sent to 12 contractors!\n💰 Your cut: 15%\n\n3 already responded. I\'ll keep you posted.', time: '14:21' },
    ],
    messagesHE: [
      { from: 'user', type: 'voice', duration: '0:06', caption: 'נכנסה לי עבודת מיזוג שאני לא יכול לקחת, תפיץ אותה', text: '', time: '14:20' },
      { from: 'agent', type: 'text', text: '📝 קלטתי! הנה מה שאשלח:\n\n❄️ התקנת מזגן\n📍 פורט לודרדייל, 33301\n💰 $800–1,200\n\nלשלוח לרשת הקבלנים שלך?', time: '14:20' },
      { from: 'user', type: 'text', text: 'כן, עמלה 15%', time: '14:21' },
      { from: 'agent', type: 'text', text: '✅ נשלח ל-12 קבלנים!\n💰 העמלה שלך: 15%\n\n3 כבר הגיבו. אעדכן אותך.', time: '14:21' },
    ],
  },
  {
    id: 'stats',
    icon: BarChart3,
    labelEN: 'Stats',
    labelHE: 'סטטיסטיקות',
    descEN: 'Ask Rebeca for your weekly stats, update your trades, or adjust your areas.',
    descHE: 'שאל את רבקה על הסטטיסטיקות שלך, עדכן מקצועות או שנה אזורים.',
    messagesEN: [
      { from: 'user', type: 'voice', duration: '0:04', caption: 'What are my stats this week?', text: '', time: '18:00' },
      { from: 'agent', type: 'text', text: '📊 This week:\n• 23 new leads\n• 8 claimed\n• $12,400 estimated value\n\nYou\'re in the top 15% of contractors in FL! 🔥', time: '18:00' },
      { from: 'user', type: 'text', text: 'Add roofing to my trades', time: '18:02' },
      { from: 'agent', type: 'text', text: '✅ Roofing added! You\'ll now receive roofing leads in your coverage areas.', time: '18:02' },
    ],
    messagesHE: [
      { from: 'user', type: 'voice', duration: '0:04', caption: 'מה הסטטיסטיקות שלי השבוע?', text: '', time: '18:00' },
      { from: 'agent', type: 'text', text: '📊 השבוע:\n• 23 לידים חדשים\n• 8 נתפסו\n• $12,400 ערך משוער\n\nאתה בטופ 15% של הקבלנים בפלורידה! 🔥', time: '18:00' },
      { from: 'user', type: 'text', text: 'תוסיף איטום למקצועות שלי', time: '18:02' },
      { from: 'agent', type: 'text', text: '✅ איטום נוסף! תקבל עכשיו לידים של איטום באזורים שלך.', time: '18:02' },
    ],
  },
]

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function TypingIndicator() {
  return (
    <div className="flex items-end gap-1" style={{ direction: 'ltr' }}>
      <div className="bg-white rounded-2xl px-4 py-3 shadow-sm flex items-center gap-1.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="block w-2 h-2 rounded-full bg-gray-400"
            style={{
              animation: 'wa-typing 1.4s ease-in-out infinite',
              animationDelay: `${i * 0.2}s`,
            }}
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
        <div
          key={i}
          className="w-[3px] rounded-full bg-[#54856c]"
          style={{ height: `${h}px` }}
        />
      ))}
    </div>
  )
}

const USER_AVATAR = 'https://randomuser.me/api/portraits/men/36.jpg'

function VoiceBubble({ msg, isRtl }: { msg: Message; isRtl: boolean }) {
  return (
    <div className="bg-[#dcf8c6] rounded-2xl px-3 py-2 shadow-sm max-w-[75%]" style={{ direction: 'ltr' }}>
      <div className="flex items-center gap-2.5 mb-1">
        <div className="w-8 h-8 rounded-full bg-[#54856c] flex items-center justify-center flex-shrink-0">
          <Play className="w-3.5 h-3.5 text-white fill-white ml-0.5" />
        </div>
        <VoiceWaveform />
        <span className="text-xs text-[#54856c] font-medium whitespace-nowrap">{msg.duration}</span>
      </div>
      {msg.caption && (
        <p className="text-[11px] text-gray-500 italic mt-0.5" style={{ direction: isRtl ? 'rtl' : 'ltr' }}>
          🎤 {msg.caption}
        </p>
      )}
      <p className="text-[10px] text-gray-400 text-right mt-0.5">{msg.time}</p>
    </div>
  )
}

function TextBubble({ msg, isAgent, isRtl }: { msg: Message; isAgent: boolean; isRtl: boolean }) {
  return (
    <div
      className={`rounded-2xl px-3.5 py-2.5 shadow-sm max-w-[75%] ${isAgent ? 'bg-white' : 'bg-[#dcf8c6]'}`}
      style={{ direction: isRtl ? 'rtl' : 'ltr' }}
    >
      <p className="text-[13px] leading-[1.45] text-gray-800 whitespace-pre-line">{msg.text}</p>
      <p className="text-[10px] text-gray-400 mt-1" style={{ textAlign: isRtl ? 'left' : 'right' }}>{msg.time}</p>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export default function WhatsAppAgentSection() {
  const { lang } = useLang()
  const isRtl = lang === 'he'

  const sectionRef = useRef<HTMLDivElement>(null)
  const chatBodyRef = useRef<HTMLDivElement>(null)
  const [activeScene, setActiveScene] = useState(0)
  const [visibleCount, setVisibleCount] = useState(0)
  const [showTyping, setShowTyping] = useState(false)
  const [isInView, setIsInView] = useState(false)
  const [fadingOut, setFadingOut] = useState(false)
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([])

  const scene = scenes[activeScene]
  const messages = lang === 'he' ? scene.messagesHE : scene.messagesEN

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
    const msgs = lang === 'he' ? scenes[activeScene].messagesHE : scenes[activeScene].messagesEN
    runSequence(msgs)
    return clearTimeouts
  }, [isInView, activeScene, lang, runSequence, clearTimeouts])

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
        @keyframes wa-typing {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-4px); opacity: 1; }
        }
        @keyframes wa-msg-in {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes tab-progress {
          from { width: 0%; }
          to { width: 100%; }
        }
        @keyframes rebeca-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
      `}</style>

      <section ref={sectionRef} className="bg-[#faf9f6] py-20 md:py-28 overflow-hidden">
        {/* ── Mobile: Rebeca banner ── */}
        <div className="lg:hidden mb-4 relative mx-4">
          <div
            className="rounded-2xl h-[100px] mt-[90px]"
            style={{ background: 'linear-gradient(135deg, #fe5b25 0%, #ff8a5c 100%)' }}
          />
          <img
            src="/rebeca-character.png"
            alt="Rebeca — LeadExpress AI Agent"
            className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[220px] pointer-events-none select-none"
            style={{ filter: 'drop-shadow(0 8px 24px rgba(0,0,0,0.2))' }}
          />
        </div>

        <div className="max-w-7xl mx-auto px-6">
          {/* ── Header ── */}
          <div className="text-center mb-10 lg:mb-14">
            <div className="inline-flex items-center gap-2 bg-[#fe5b25]/10 border border-[#fe5b25]/20 text-[#fe5b25] text-xs font-semibold px-3 py-1.5 rounded-full mb-4">
              <Bot className="w-3.5 h-3.5" />
              {isRtl ? 'עוזרת אישית' : 'Your AI Assistant'}
            </div>
            <h2 className="text-3xl md:text-4xl lg:text-[42px] lg:leading-[1.15] font-bold text-gray-900 mb-3">
              {isRtl ? 'הכירו את רבקה.' : 'Meet Rebeca.'}
            </h2>
            <p className="text-gray-500 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed">
              {isRtl
                ? 'העוזרת האישית שלך בוואטסאפ. מוצאת לידים, מפיצה עבודות, בודקת זמינות כל בוקר — הכל בהודעה קולית.'
                : 'Your personal assistant on WhatsApp. Finds leads, distributes jobs, checks availability every morning — all by voice message.'}
            </p>
          </div>

          {/* ── Mobile: capability cards ── */}
          <div className="flex flex-col gap-2 mb-6 lg:hidden">
            {scenes.map((s, i) => {
              const Icon = s.icon
              const isActive = i === activeScene
              return (
                <button
                  key={s.id}
                  onClick={() => handleTabClick(i)}
                  className={`relative text-left w-full rounded-xl px-4 py-3 transition-all duration-300 overflow-hidden ${
                    isActive
                      ? 'bg-white shadow-md shadow-black/5 ring-1 ring-[#fe5b25]/20'
                      : 'bg-white/60 ring-1 ring-gray-200/60'
                  }`}
                  style={{ direction: isRtl ? 'rtl' : 'ltr' }}
                >
                  {isActive && (
                    <div className="absolute bottom-0 left-0 h-[3px] rounded-full"
                      style={{
                        background: 'linear-gradient(90deg, #fe5b25, #ff8a5c)',
                        animation: `tab-progress ${messages.length * 1.9 + 2.6}s linear`,
                      }}
                    />
                  )}
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors duration-300 ${
                      isActive ? 'bg-[#fe5b25] text-white' : 'bg-gray-100 text-gray-400'
                    }`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className={`text-sm font-bold leading-tight ${isActive ? 'text-gray-900' : 'text-gray-500'}`}>
                        {isRtl ? s.labelHE : s.labelEN}
                      </h4>
                      <p className={`text-xs mt-0.5 leading-relaxed transition-all duration-300 ${
                        isActive ? 'text-gray-500 max-h-16 opacity-100' : 'text-gray-400 max-h-0 opacity-0 overflow-hidden'
                      }`}>
                        {isRtl ? s.descHE : s.descEN}
                      </p>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>

          {/* ── Desktop layout: 2 columns ── */}
          <div className="hidden lg:grid lg:grid-cols-12 gap-8 items-start max-w-6xl mx-auto">

            {/* Column 1: Rebeca + Capability cards (5 cols) */}
            <div className={`col-span-5 ${isRtl ? 'order-2' : 'order-1'}`}>
              {/* Rebeca banner */}
              <div className="relative mb-5">
                <div
                  className="rounded-2xl overflow-hidden relative"
                  style={{
                    background: 'linear-gradient(135deg, #fe5b25 0%, #ff8a5c 100%)',
                  }}
                >
                  {/* Subtle pattern overlay */}
                  <div
                    className="absolute inset-0 opacity-[0.08]"
                    style={{
                      backgroundImage: `radial-gradient(circle at 2px 2px, white 1px, transparent 0)`,
                      backgroundSize: '20px 20px',
                    }}
                  />
                  {/* Glow orb */}
                  <div className="absolute top-4 right-8 w-28 h-28 bg-white/20 rounded-full blur-3xl" />

                  <div className="relative z-10 flex items-end gap-4 px-5 pt-5 pb-0">
                    {/* Rebeca image */}
                    <img
                      src="/rebeca-character.png"
                      alt="Rebeca"
                      className="w-[140px] flex-shrink-0 pointer-events-none select-none"
                      style={{
                        filter: 'drop-shadow(0 -4px 20px rgba(0,0,0,0.15))',
                        animation: 'rebeca-float 6s ease-in-out infinite',
                      }}
                    />
                    {/* Text */}
                    <div className="pb-5">
                      <div className="inline-flex items-center gap-1.5 bg-white/20 backdrop-blur-sm text-white text-[11px] font-semibold px-2.5 py-1 rounded-full mb-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-300 animate-pulse" />
                        {isRtl ? 'מחוברת 24/7' : 'Online 24/7'}
                      </div>
                      <h3 className="text-white text-xl font-bold leading-tight">Rebeca</h3>
                      <p className="text-white/60 text-sm mt-1">
                        {isRtl ? 'העוזרת האישית שלך' : 'Your personal AI assistant'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Capability cards */}
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
                        ? 'bg-white shadow-lg shadow-black/5 ring-1 ring-[#fe5b25]/20'
                        : 'bg-white/50 hover:bg-white/80 ring-1 ring-gray-200/60'
                    }`}
                    style={{ direction: isRtl ? 'rtl' : 'ltr' }}
                  >
                    {/* Progress bar */}
                    {isActive && (
                      <div
                        className="absolute bottom-0 left-0 h-[3px] rounded-full"
                        style={{
                          background: 'linear-gradient(90deg, #fe5b25, #ff8a5c)',
                          animation: `tab-progress ${messages.length * 1.9 + 2.6}s linear`,
                        }}
                      />
                    )}

                    <div className="flex items-start gap-3">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors duration-300 ${
                        isActive
                          ? 'bg-[#fe5b25] text-white'
                          : 'bg-gray-100 text-gray-400'
                      }`}>
                        <Icon className="w-4.5 h-4.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className={`text-sm font-bold leading-tight transition-colors duration-300 ${
                          isActive ? 'text-gray-900' : 'text-gray-500'
                        }`}>
                          {isRtl ? s.labelHE : s.labelEN}
                        </h4>
                        <p className={`text-xs mt-1 leading-relaxed transition-all duration-300 ${
                          isActive ? 'text-gray-500 max-h-20 opacity-100' : 'text-gray-400 max-h-0 opacity-0 overflow-hidden'
                        }`}>
                          {isRtl ? s.descHE : s.descEN}
                        </p>
                      </div>
                    </div>
                  </button>
                )
              })}
              </div>
            </div>

            {/* Column 2: WhatsApp Chat (7 cols) */}
            <div className={`col-span-7 ${isRtl ? 'order-1' : 'order-2'}`}>
              <div
                className="rounded-2xl shadow-xl border border-gray-200 overflow-hidden"
                style={{
                  opacity: fadingOut ? 0 : 1,
                  transition: 'opacity 0.3s ease',
                }}
              >
                {/* Phone header */}
                <div className="px-4 py-3 flex items-center gap-3" style={{ background: '#075e54' }}>
                  <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0">
                    <img src="/rebeca.jpg" alt="Rebeca" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-semibold leading-tight">Rebeca</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
                      <span className="text-green-200 text-[11px]">{isRtl ? 'מחוברת' : 'online'}</span>
                    </div>
                  </div>
                </div>

                {/* Chat body */}
                <div
                  ref={chatBodyRef}
                  className="overflow-y-auto"
                  style={{ background: '#ece5dd', maxHeight: '420px', minHeight: '360px', padding: '16px 12px' }}
                >
                  <div className="flex flex-col gap-3">
                    {messages.slice(0, visibleCount).map((msg, i) => {
                      const isAgent = msg.from === 'agent'
                      return (
                        <div
                          key={`${activeScene}-${lang}-${i}`}
                          className={`flex items-end gap-1.5 ${isAgent ? 'justify-start' : 'justify-end'}`}
                          style={{ animation: 'wa-msg-in 0.4s ease-out both' }}
                        >
                          {isAgent && (
                            <img src="/rebeca.jpg" alt="" className="w-6 h-6 rounded-full object-cover flex-shrink-0 mb-0.5" />
                          )}
                          {msg.type === 'voice' ? (
                            <VoiceBubble msg={msg} isRtl={isRtl} />
                          ) : (
                            <TextBubble msg={msg} isAgent={isAgent} isRtl={isRtl} />
                          )}
                          {!isAgent && (
                            <img src={USER_AVATAR} alt="" className="w-6 h-6 rounded-full object-cover flex-shrink-0 mb-0.5" />
                          )}
                        </div>
                      )
                    })}
                    {showTyping && (
                      <div className="flex justify-start">
                        <TypingIndicator />
                      </div>
                    )}
                  </div>
                </div>

                {/* Input bar */}
                <div className="bg-[#f0f0f0] px-3 py-2 flex items-center gap-2 border-t border-gray-200">
                  <div className="flex-1 bg-white rounded-full px-4 py-2 text-xs text-gray-400">
                    {isRtl ? 'הקלד הודעה...' : 'Type a message...'}
                  </div>
                  <div className="w-9 h-9 rounded-full bg-[#075e54] flex items-center justify-center flex-shrink-0">
                    <Mic className="w-4 h-4 text-white" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Mobile: Chat only ── */}
          <div className="lg:hidden">
            <div
              className="rounded-2xl shadow-xl border border-gray-200 overflow-hidden mx-auto max-w-sm"
              style={{
                opacity: fadingOut ? 0 : 1,
                transition: 'opacity 0.3s ease',
              }}
            >
              <div className="px-4 py-3 flex items-center gap-3" style={{ background: '#075e54' }}>
                <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0">
                  <img src="/rebeca.jpg" alt="Rebeca" className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-semibold leading-tight">Rebeca</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
                    <span className="text-green-200 text-[11px]">{isRtl ? 'מחוברת' : 'online'}</span>
                  </div>
                </div>
              </div>
              <div
                ref={typeof window !== 'undefined' && window.innerWidth < 1024 ? chatBodyRef : undefined}
                className="overflow-y-auto"
                style={{ background: '#ece5dd', maxHeight: '400px', minHeight: '320px', padding: '16px 12px' }}
              >
                <div className="flex flex-col gap-3">
                  {messages.slice(0, visibleCount).map((msg, i) => {
                    const isAgent = msg.from === 'agent'
                    return (
                      <div
                        key={`mob-${activeScene}-${lang}-${i}`}
                        className={`flex items-end gap-1.5 ${isAgent ? 'justify-start' : 'justify-end'}`}
                        style={{ animation: 'wa-msg-in 0.4s ease-out both' }}
                      >
                        {isAgent && (
                          <img src="/rebeca.jpg" alt="" className="w-6 h-6 rounded-full object-cover flex-shrink-0 mb-0.5" />
                        )}
                        {msg.type === 'voice' ? (
                          <VoiceBubble msg={msg} isRtl={isRtl} />
                        ) : (
                          <TextBubble msg={msg} isAgent={isAgent} isRtl={isRtl} />
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
                <div className="flex-1 bg-white rounded-full px-4 py-2 text-xs text-gray-400">
                  {isRtl ? 'הקלד הודעה...' : 'Type a message...'}
                </div>
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
