import { useEffect, useRef, useState, useCallback } from 'react'
import { Share2, Mic, Play } from 'lucide-react'
import { useLang } from '../i18n/LanguageContext'

/* ------------------------------------------------------------------ */
/*  Chat data: LEFT phone (You → Bot)                                  */
/* ------------------------------------------------------------------ */

interface ChatMsg {
  from: 'user' | 'agent'
  type: 'text' | 'voice'
  text: string
  duration?: string
  caption?: string
  time: string
}

const chatEN: ChatMsg[] = [
  {
    from: 'user',
    type: 'voice',
    duration: '0:05',
    caption: "Hey, I just finished at a customer's. He needs AC cleaning but I don't do that. Can you find someone?",
    text: '',
    time: '14:22',
  },
  {
    from: 'agent',
    type: 'text',
    text: "Got it! 📝 Let me summarize:\n\n❄️ AC Cleaning\n📍 Customer's location\n💰 You set the referral fee\n\nReady to distribute to 14 matching contractors?",
    time: '14:22',
  },
  {
    from: 'user',
    type: 'text',
    text: 'Yes, send it out',
    time: '14:23',
  },
  {
    from: 'agent',
    type: 'text',
    text: '✅ Done! Sent to 14 AC cleaning contractors in your area. You\'ll get notified when someone claims it.',
    time: '14:23',
  },
]

const chatHE: ChatMsg[] = [
  {
    from: 'user',
    type: 'voice',
    duration: '0:05',
    caption: 'היי, סיימתי אצל לקוח. הוא צריך ניקוי מזגן ואני לא עושה את זה. אתה יכול למצוא מישהו?',
    text: '',
    time: '14:22',
  },
  {
    from: 'agent',
    type: 'text',
    text: 'קיבלתי! 📝 הנה הסיכום:\n\n❄️ ניקוי מזגנים\n📍 המיקום של הלקוח\n💰 אתה קובע את העמלה\n\nלהפיץ ל-14 קבלני מזגנים מתאימים?',
    time: '14:22',
  },
  {
    from: 'user',
    type: 'text',
    text: 'כן, תשלח',
    time: '14:23',
  },
  {
    from: 'agent',
    type: 'text',
    text: '✅ בוצע! נשלח ל-14 מנקי מזגנים באזור שלך. תקבל הודעה כשמישהו יתפוס את העבודה.',
    time: '14:23',
  },
]

/* ------------------------------------------------------------------ */
/*  Incoming responses: RIGHT phone (Contractors responding)            */
/* ------------------------------------------------------------------ */

interface IncomingMsg {
  name: string
  nameHe: string
  avatar: string
  text: string
  textHe: string
  time: string
}

const incomingMessages: IncomingMsg[] = [
  { name: 'David R.', nameHe: 'דוד ר.', avatar: '👷', text: "Hey! I'm available, I'm 10 min away", textHe: 'היי! אני זמין, אני 10 דקות משם', time: '14:24' },
  { name: 'Mike S.', nameHe: 'מיכאל ש.', avatar: '🔧', text: 'Interested! What area?', textHe: 'מעוניין! איזה אזור?', time: '14:24' },
  { name: 'Alex T.', nameHe: 'אלכס ט.', avatar: '❄️', text: 'I can be there in an hour', textHe: 'אני יכול להיות שם בעוד שעה', time: '14:25' },
  { name: 'James P.', nameHe: "ג'יימס פ.", avatar: '💪', text: 'Count me in! Sending quote now', textHe: 'אני בפנים! שולח הצעת מחיר', time: '14:25' },
  { name: 'Chris L.', nameHe: 'כריס ל.', avatar: '⚡', text: 'Available today, what time?', textHe: 'זמין היום, באיזה שעה?', time: '14:26' },
]

/* ------------------------------------------------------------------ */
/*  Stats data                                                         */
/* ------------------------------------------------------------------ */

interface Stat {
  value: number
  suffix: string
  label: string
}

const statsEN: Stat[] = [
  { value: 247, suffix: '', label: 'jobs distributed' },
  { value: 89, suffix: '%', label: 'claim rate' },
  { value: 184, suffix: 'K', label: 'earned by contractors' },
]

const statsHE: Stat[] = [
  { value: 247, suffix: '', label: 'עבודות הופצו' },
  { value: 89, suffix: '%', label: 'אחוז תפיסה' },
  { value: 184, suffix: 'K', label: 'הרוויחו קבלנים' },
]

/* ------------------------------------------------------------------ */
/*  CountUp hook                                                       */
/* ------------------------------------------------------------------ */

function useCountUp(target: number, isVisible: boolean, duration = 1800) {
  const [count, setCount] = useState(0)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    if (!isVisible) return
    const start = performance.now()
    const animate = (now: number) => {
      const elapsed = now - start
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setCount(Math.round(target * eased))
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate)
      }
    }
    rafRef.current = requestAnimationFrame(animate)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [target, isVisible, duration])

  return count
}

/* ------------------------------------------------------------------ */
/*  Voice waveform                                                     */
/* ------------------------------------------------------------------ */

function VoiceWaveform() {
  const bars = [3, 6, 10, 7, 12, 8, 5, 11, 6, 9, 4, 8, 12, 6, 3, 7, 10, 5]
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

/* ------------------------------------------------------------------ */
/*  Typing indicator                                                   */
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
              animation: 'jd-typing 1.4s ease-in-out infinite',
              animationDelay: `${i * 0.2}s`,
            }}
          />
        ))}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  LEFT PHONE: You talking to the bot                                 */
/* ------------------------------------------------------------------ */

function BotChatPhone({
  messages,
  visibleCount,
  showTyping,
  fadingOut,
  isRtl,
  lang,
}: {
  messages: ChatMsg[]
  visibleCount: number
  showTyping: boolean
  fadingOut: boolean
  isRtl: boolean
  lang: string
}) {
  const chatRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' })
  }, [visibleCount, showTyping])

  return (
    <div
      className="rounded-2xl shadow-xl border border-gray-200 overflow-hidden"
      style={{ opacity: fadingOut ? 0 : 1, transition: 'opacity 0.8s ease' }}
    >
      {/* Header */}
      <div className="px-4 py-3 flex items-center gap-3" style={{ background: '#075e54' }}>
        <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0">
          <img src="/rebeca.jpg" alt="LeadExpress AI" className="w-full h-full object-cover" />
        </div>
        <div>
          <p className="text-white text-sm font-semibold leading-tight">LeadExpress AI</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
            <span className="text-green-200 text-[11px]">{lang === 'he' ? 'מחובר' : 'online'}</span>
          </div>
        </div>
      </div>

      {/* Chat body */}
      <div
        ref={chatRef}
        className="overflow-y-auto"
        style={{ background: '#ece5dd', maxHeight: '420px', minHeight: '340px', padding: '14px 10px' }}
      >
        <div className="flex flex-col gap-3">
          {messages.slice(0, visibleCount).map((msg, i) => {
            const isAgent = msg.from === 'agent'
            return (
              <div
                key={`${lang}-${i}`}
                className={`flex ${isAgent ? 'justify-start' : 'justify-end'}`}
                style={{ animation: 'jd-msg-in 0.4s ease-out both' }}
              >
                {msg.type === 'voice' ? (
                  <div className="bg-[#dcf8c6] rounded-2xl px-3 py-2 shadow-sm max-w-[80%]" style={{ direction: 'ltr' }}>
                    <div className="flex items-center gap-2.5 mb-1">
                      <div className="w-7 h-7 rounded-full bg-[#54856c] flex items-center justify-center flex-shrink-0">
                        <Play className="w-3 h-3 text-white fill-white ml-0.5" />
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
                ) : (
                  <div
                    className={`rounded-2xl px-3 py-2 shadow-sm max-w-[80%] ${isAgent ? 'bg-white' : 'bg-[#dcf8c6]'}`}
                    style={{ direction: isRtl ? 'rtl' : 'ltr' }}
                  >
                    <p className="text-[13px] leading-[1.45] text-gray-800 whitespace-pre-line">{msg.text}</p>
                    <p className="text-[10px] text-gray-400 mt-1" style={{ textAlign: isRtl ? 'left' : 'right' }}>{msg.time}</p>
                  </div>
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
          {lang === 'he' ? 'הקלד הודעה...' : 'Type a message...'}
        </div>
        <div className="w-8 h-8 rounded-full bg-[#075e54] flex items-center justify-center flex-shrink-0">
          <Mic className="w-4 h-4 text-white" />
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  RIGHT PHONE: Contractors responding                                */
/* ------------------------------------------------------------------ */

function ContractorResponsesPhone({
  messages,
  visibleCount,
  fadingOut,
  isRtl,
  lang,
}: {
  messages: IncomingMsg[]
  visibleCount: number
  fadingOut: boolean
  isRtl: boolean
  lang: string
}) {
  const chatRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' })
  }, [visibleCount])

  const notifCount = Math.min(visibleCount, messages.length)

  return (
    <div
      className="rounded-2xl shadow-xl border border-gray-200 overflow-hidden"
      style={{ opacity: fadingOut ? 0 : 1, transition: 'opacity 0.8s ease' }}
    >
      {/* Header — looks like WhatsApp notifications list */}
      <div className="px-4 py-3 flex items-center justify-between" style={{ background: '#075e54' }}>
        <div>
          <p className="text-white text-sm font-semibold leading-tight">
            {lang === 'he' ? 'הודעות נכנסות' : 'Incoming Responses'}
          </p>
          <p className="text-green-200 text-[11px] mt-0.5">
            {visibleCount > 0
              ? (lang === 'he' ? `${notifCount} קבלנים הגיבו` : `${notifCount} contractors replied`)
              : (lang === 'he' ? 'ממתין לתגובות...' : 'Waiting for replies...')
            }
          </p>
        </div>
        {visibleCount > 0 && (
          <div className="w-7 h-7 rounded-full bg-[#25d366] flex items-center justify-center text-white text-xs font-bold"
            style={{ animation: 'jd-badge-pop 0.3s ease-out both' }}
          >
            {notifCount}
          </div>
        )}
      </div>

      {/* Notification list */}
      <div
        ref={chatRef}
        className="overflow-y-auto"
        style={{ background: '#ffffff', maxHeight: '420px', minHeight: '340px' }}
      >
        {visibleCount === 0 && (
          <div className="flex flex-col items-center justify-center h-[340px] text-gray-400">
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
              <Share2 className="w-5 h-5 text-gray-300" />
            </div>
            <p className="text-sm">{lang === 'he' ? 'מפיץ לקבלנים...' : 'Distributing to contractors...'}</p>
            <div className="flex gap-1.5 mt-3">
              {[0, 1, 2].map(i => (
                <span
                  key={i}
                  className="w-2 h-2 rounded-full bg-[#25d366]"
                  style={{ animation: 'jd-typing 1.4s ease-in-out infinite', animationDelay: `${i * 0.2}s` }}
                />
              ))}
            </div>
          </div>
        )}

        {messages.slice(0, visibleCount).map((msg, i) => (
          <div
            key={i}
            className="flex items-start gap-3 px-4 py-3.5 border-b border-gray-100"
            style={{ animation: 'jd-notif-in 0.4s ease-out both' }}
          >
            {/* Avatar */}
            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-lg flex-shrink-0">
              {msg.avatar}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-0.5">
                <p className="text-sm font-semibold text-gray-900">
                  {isRtl ? msg.nameHe : msg.name}
                </p>
                <span className="text-[10px] text-[#25d366] font-medium">{msg.time}</span>
              </div>
              <p className="text-[13px] text-gray-600 leading-snug" style={{ direction: isRtl ? 'rtl' : 'ltr' }}>
                {isRtl ? msg.textHe : msg.text}
              </p>
            </div>

            {/* New badge */}
            <div className="w-5 h-5 rounded-full bg-[#25d366] flex items-center justify-center flex-shrink-0 mt-1">
              <span className="text-[10px] text-white font-bold">!</span>
            </div>
          </div>
        ))}
      </div>

      {/* Bottom bar */}
      <div className="bg-gray-50 px-4 py-2.5 border-t border-gray-200 text-center">
        <p className="text-xs text-gray-400">
          {lang === 'he' ? 'קבלנים מאזור הלקוח' : 'Contractors near the customer'}
        </p>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export default function JobDistributionSection() {
  const { lang } = useLang()
  const isRtl = lang === 'he'
  const botChat = lang === 'he' ? chatHE : chatEN
  const stats = lang === 'he' ? statsHE : statsEN

  const sectionRef = useRef<HTMLDivElement>(null)
  const [isInView, setIsInView] = useState(false)

  // Bot chat state
  const [botVisible, setBotVisible] = useState(0)
  const [botTyping, setBotTyping] = useState(false)

  // Contractor responses state
  const [responsesVisible, setResponsesVisible] = useState(0)

  const [fadingOut, setFadingOut] = useState(false)
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([])

  const clearTimeouts = useCallback(() => {
    timeoutsRef.current.forEach(clearTimeout)
    timeoutsRef.current = []
  }, [])

  const addTimeout = useCallback((fn: () => void, ms: number) => {
    const id = setTimeout(fn, ms)
    timeoutsRef.current.push(id)
    return id
  }, [])

  /* --- Animation sequence --- */
  const runSequence = useCallback(() => {
    setBotVisible(0)
    setBotTyping(false)
    setResponsesVisible(0)
    setFadingOut(false)

    let delay = 400

    // Animate bot chat messages
    for (let i = 0; i < botChat.length; i++) {
      const msg = botChat[i]

      if (msg.from === 'agent') {
        const typingDelay = delay
        addTimeout(() => setBotTyping(true), typingDelay)
        delay += 800

        const showDelay = delay
        addTimeout(() => {
          setBotTyping(false)
          setBotVisible(showDelay ? i + 1 : i + 1)
        }, showDelay)
      } else {
        const showDelay = delay
        addTimeout(() => setBotVisible(showDelay ? i + 1 : i + 1), showDelay)
      }

      delay += 1500
    }

    // After bot conversation ends, start showing contractor responses
    const responsesStart = delay + 500
    for (let i = 0; i < incomingMessages.length; i++) {
      addTimeout(() => setResponsesVisible(i + 1), responsesStart + i * 800)
    }

    // Fade out and restart
    const totalEnd = responsesStart + incomingMessages.length * 800 + 2500
    addTimeout(() => setFadingOut(true), totalEnd)
    addTimeout(() => runSequence(), totalEnd + 1200)
  }, [botChat, addTimeout])

  /* --- IntersectionObserver --- */
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

  /* --- Start when visible --- */
  useEffect(() => {
    if (!isInView) return
    runSequence()
    return clearTimeouts
  }, [isInView, runSequence, clearTimeouts])

  /* --- Count-up stats --- */
  const count0 = useCountUp(stats[0].value, isInView)
  const count1 = useCountUp(stats[1].value, isInView)
  const count2 = useCountUp(stats[2].value, isInView)
  const counts = [count0, count1, count2]

  return (
    <>
      <style>{`
        @keyframes jd-msg-in {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes jd-notif-in {
          from { opacity: 0; transform: translateX(-20px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes jd-typing {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-4px); opacity: 1; }
        }
        @keyframes jd-badge-pop {
          0% { transform: scale(0); }
          60% { transform: scale(1.2); }
          100% { transform: scale(1); }
        }
      `}</style>

      <section ref={sectionRef} className="bg-cream py-20 md:py-28 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">
          {/* Header */}
          <div className="text-center mb-14 md:mb-20">
            <div className="inline-flex items-center gap-2 bg-[#fe5b25]/10 border border-[#fe5b25]/20 text-[#fe5b25] text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
              <Share2 className="w-3.5 h-3.5" />
              {lang === 'he' ? 'רשת הפצה' : 'Distribution Network'}
            </div>

            <h2 className="text-3xl md:text-4xl lg:text-[42px] lg:leading-[1.15] font-bold text-gray-900 mb-4 max-w-3xl mx-auto">
              {lang === 'he'
                ? 'הלקוח צריך מקצוע אחר? תרוויח מזה.'
                : "Customer needs a different trade? Earn from it."}
            </h2>

            <p className="text-gray-500 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed">
              {lang === 'he'
                ? 'סיימת עבודה. הלקוח שואל אם אתה עושה גם משהו אחר. דבר עם הבוט, הוא ימצא את הקבלן הנכון — ואתה תרוויח.'
                : "You finished the job. The customer asks about something you don't do. Talk to the bot, it finds the right contractor — and you earn your cut."}
            </p>
          </div>

          {/* Two phones side by side */}
          <div className={`grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-10 items-start max-w-4xl mx-auto ${isRtl ? 'direction-rtl' : ''}`}>
            {/* LEFT: You → Bot */}
            <div className={isRtl ? 'md:order-2' : ''}>
              <p className="text-center text-sm font-semibold text-gray-500 mb-3">
                {lang === 'he' ? '👈 אתה מדבר עם הבוט' : '👉 You talk to the bot'}
              </p>
              <BotChatPhone
                messages={botChat}
                visibleCount={botVisible}
                showTyping={botTyping}
                fadingOut={fadingOut}
                isRtl={isRtl}
                lang={lang}
              />
            </div>

            {/* RIGHT: Contractors responding */}
            <div className={isRtl ? 'md:order-1' : ''}>
              <p className="text-center text-sm font-semibold text-gray-500 mb-3">
                {lang === 'he' ? '👈 קבלנים מגיבים' : '👈 Contractors respond'}
              </p>
              <ContractorResponsesPhone
                messages={incomingMessages}
                visibleCount={responsesVisible}
                fadingOut={fadingOut}
                isRtl={isRtl}
                lang={lang}
              />
            </div>
          </div>

          {/* Arrow connector on desktop — visual cue */}
          <div className="hidden md:flex items-center justify-center mt-8 mb-2">
            <p className="text-sm text-gray-400 italic">
              {lang === 'he'
                ? '⚡ הכל קורה תוך שניות'
                : '⚡ All happens within seconds'}
            </p>
          </div>

          {/* Bottom stats bar */}
          <div className="mt-10 md:mt-14">
            <div className="bg-[#0b0707] rounded-2xl px-6 py-5 md:px-10 md:py-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-4 text-center">
                {stats.map((stat, i) => (
                  <div key={i}>
                    <p className="text-2xl md:text-3xl font-bold text-white mb-1">
                      {i === 2 && '$'}
                      {counts[i]}
                      {stat.suffix}
                    </p>
                    <p className="text-gray-400 text-sm">{stat.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
