import { useEffect, useRef, useState, useCallback } from 'react'
import { DollarSign, Mic, Play, Share2, Users, CheckCircle2, ArrowRight } from 'lucide-react'
import { useLang } from '../i18n/LanguageContext'
import { initialsAvatar } from '../utils/avatars'

/* ------------------------------------------------------------------ */
/*  Chat data                                                          */
/* ------------------------------------------------------------------ */

interface ChatMsg {
  from: 'user' | 'agent'
  type: 'text' | 'voice'
  text: string
  duration?: string
  caption?: string
  time: string
  /** Which flow step (0-based) this message activates */
  step?: number
}

const chatEN: ChatMsg[] = [
  {
    from: 'user',
    type: 'voice',
    duration: '0:05',
    caption: "I got an AC job I can't do — can you send it out?",
    text: '',
    time: '14:22',
    step: 0,
  },
  {
    from: 'agent',
    type: 'text',
    text: "📝 Got it!\n\n❄️ AC Cleaning\n📍 Fort Lauderdale, 33301\n💰 $800–1,200\n\nSending to your contractors with 15% commission?",
    time: '14:22',
    step: 1,
  },
  {
    from: 'user',
    type: 'text',
    text: 'Yes, send it',
    time: '14:23',
  },
  {
    from: 'agent',
    type: 'text',
    text: '✅ Sent to 12 contractors!\n\n3 already responded.\n💰 Your commission: $120–180',
    time: '14:23',
    step: 2,
  },
]

const chatHE: ChatMsg[] = [
  {
    from: 'user',
    type: 'voice',
    duration: '0:05',
    caption: 'נכנסה עבודת מזגן שאני לא יכול — תפיץ אותה',
    text: '',
    time: '14:22',
    step: 0,
  },
  {
    from: 'agent',
    type: 'text',
    text: '📝 קיבלתי!\n\n❄️ ניקוי מזגנים\n📍 פורט לודרדייל, 33301\n💰 $800–1,200\n\nלשלוח לרשת שלך עם עמלה 15%?',
    time: '14:22',
    step: 1,
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
    text: '✅ נשלח ל-12 קבלנים!\n\n3 כבר הגיבו.\n💰 העמלה שלך: $120–180',
    time: '14:23',
    step: 2,
  },
]

/* ------------------------------------------------------------------ */
/*  Flow steps                                                         */
/* ------------------------------------------------------------------ */

const flowStepsEN = [
  { icon: Mic, label: 'You send it', desc: 'Send a voice message to Rebeca' },
  { icon: Share2, label: 'Rebeca sends it out', desc: 'Sent to contractors near the job' },
  { icon: Users, label: 'They answer', desc: 'Contractors take the job in seconds' },
  { icon: DollarSign, label: 'You earn', desc: 'Commission paid automatically' },
]

const flowStepsHE = [
  { icon: Mic, label: 'אתה מעביר', desc: 'שלח הודעה קולית לרבקה' },
  { icon: Share2, label: 'רבקה מפיצה', desc: 'מותאם לקבלנים ליד העבודה' },
  { icon: Users, label: 'הם מגיבים', desc: 'קבלנים תופסים את העבודה בשניות' },
  { icon: DollarSign, label: 'אתה מרוויח', desc: 'העמלה נכנסת אוטומטית' },
]

/* ------------------------------------------------------------------ */
/*  Network contractors (visual)                                       */
/* ------------------------------------------------------------------ */

const networkContractors = [
  { name: 'David R.', nameHe: 'דוד ר.', trade: 'HVAC', tradeHe: 'מיזוג' },
  { name: 'Mike S.', nameHe: 'מיכאל ש.', trade: 'Plumbing', tradeHe: 'אינסטלציה' },
  { name: 'Alex T.', nameHe: 'אלכס ט.', trade: 'Electrical', tradeHe: 'חשמל' },
  { name: 'Chris L.', nameHe: 'כריס ל.', trade: 'AC Clean', tradeHe: 'ניקוי מזגנים' },
  { name: 'James P.', nameHe: "ג'יימס פ.", trade: 'Moving', tradeHe: 'הובלות' },
]

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function VoiceWaveform() {
  const bars = [3, 6, 10, 7, 12, 8, 5, 11, 6, 9, 4, 8, 12, 6, 3, 7, 10, 5]
  return (
    <div className="flex items-center gap-[2px] h-5">
      {bars.map((h, i) => (
        <div key={i} className="w-[3px] rounded-full bg-[#54856c]" style={{ height: `${h}px` }} />
      ))}
    </div>
  )
}

function TypingDots() {
  return (
    <div className="flex items-end gap-1" style={{ direction: 'ltr' }}>
      <div className="bg-white rounded-2xl px-4 py-3 shadow-sm flex items-center gap-1.5">
        {[0, 1, 2].map(i => (
          <span
            key={i}
            className="block w-2 h-2 rounded-full bg-gray-400"
            style={{ animation: 'em-typing 1.4s ease-in-out infinite', animationDelay: `${i * 0.2}s` }}
          />
        ))}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export default function EarnMoreSection() {
  const { lang } = useLang()
  const isRtl = lang === 'he'
  const messages = lang === 'he' ? chatHE : chatEN
  const flowSteps = lang === 'he' ? flowStepsHE : flowStepsEN

  const sectionRef = useRef<HTMLDivElement>(null)
  const chatBodyRef = useRef<HTMLDivElement>(null)
  const [isInView, setIsInView] = useState(false)

  const [visibleCount, setVisibleCount] = useState(0)
  const [showTyping, setShowTyping] = useState(false)
  const [activeStep, setActiveStep] = useState(-1)
  const [showNetwork, setShowNetwork] = useState(false)
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

  /* --- Animate sequence --- */
  const runSequence = useCallback(() => {
    setVisibleCount(0)
    setShowTyping(false)
    setActiveStep(-1)
    setShowNetwork(false)
    setFadingOut(false)

    let delay = 600

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i]

      if (msg.from === 'agent') {
        addTimeout(() => setShowTyping(true), delay)
        delay += 800
        const idx = i + 1
        const step = msg.step
        addTimeout(() => {
          setShowTyping(false)
          setVisibleCount(idx)
          if (step !== undefined) setActiveStep(step)
        }, delay)
      } else {
        const idx = i + 1
        const step = msg.step
        addTimeout(() => {
          setVisibleCount(idx)
          if (step !== undefined) setActiveStep(step)
        }, delay)
      }

      delay += 1400
    }

    // Final step: commission earned
    addTimeout(() => setActiveStep(3), delay)
    delay += 800

    // Show network card — stays visible, no loop
    addTimeout(() => setShowNetwork(true), delay)
  }, [messages, addTimeout])

  /* --- IntersectionObserver --- */
  useEffect(() => {
    const el = sectionRef.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting && !isInView) setIsInView(true) },
      { threshold: 0.15 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [isInView])

  useEffect(() => {
    if (!isInView) return
    runSequence()
    return clearTimeouts
  }, [isInView, runSequence, clearTimeouts])

  /* --- Auto-scroll chat --- */
  useEffect(() => {
    chatBodyRef.current?.scrollTo({ top: chatBodyRef.current.scrollHeight, behavior: 'smooth' })
  }, [visibleCount, showTyping])

  return (
    <>
      <style>{`
        @keyframes em-msg-in {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes em-typing {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-4px); opacity: 1; }
        }
        @keyframes em-step-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(254,91,37,0.3); }
          50% { box-shadow: 0 0 0 8px rgba(254,91,37,0); }
        }
        @keyframes em-network-in {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes em-avatar-pop {
          0% { transform: scale(0); opacity: 0; }
          60% { transform: scale(1.15); }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>

      <section ref={sectionRef} className="bg-cream py-20 md:py-28 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">
          {/* Header */}
          <div className="text-center mb-12 md:mb-16">
            <div className="inline-flex items-center gap-2 bg-[#fe5b25]/10 border border-[#fe5b25]/20 text-[#fe5b25] text-xs font-semibold px-3 py-1.5 rounded-full mb-4">
              <DollarSign className="w-3.5 h-3.5" />
              {isRtl ? 'העבודות הפרטיות שלך' : 'Your Private Jobs'}
            </div>

            <h2 className="text-3xl md:text-4xl lg:text-[42px] lg:leading-[1.15] font-bold text-gray-900 mb-3 max-w-3xl mx-auto">
              {isRtl
                ? 'כל עבודה שאתה לא לוקח? מישהו ברשת יכול.'
                : "Every job you can't take is money you're losing."}
            </h2>

            <p className="text-gray-500 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed">
              {isRtl
                ? 'עבודות שנכנסות אליך כל יום ויוצאות בלי שום ערך — עכשיו הן הופכות להכנסה. הודעה קולית אחת לרבקה וזה קורה.'
                : "Jobs come to you every day that you can't do — wrong service, too far, fully booked. Right now they go to waste. With us, they become income."}
            </p>

            {/* Use case cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-8 max-w-3xl mx-auto text-left">
              {[
                {
                  emoji: '📍',
                  titleEN: 'Too far or no time',
                  titleHE: 'רחוק או עסוק',
                  descEN: 'A lead comes in but you\'re on the other side of town or fully booked. Instead of ignoring it — send it out.',
                  descHE: 'נכנס ליד אבל אתה בצד השני של העיר או מלא. במקום להתעלם — תפרסם.',
                },
                {
                  emoji: '🔧',
                  titleEN: 'Not your service',
                  titleHE: 'לא המקצוע שלך',
                  descEN: 'Someone asks for electrical work and you\'re a plumber. That\'s still a job worth money — send it to the right person.',
                  descHE: 'מבקשים חשמל ואתה אינסטלטור. זו עדיין עבודה ששווה כסף — תעביר.',
                },
                {
                  emoji: '🏠',
                  titleEN: '"Know anyone who...?"',
                  titleHE: '"אתה מכיר מישהו ש...?"',
                  descEN: 'You finish a job and the client asks about window replacement. Usually you\'d walk away. Now you earn.',
                  descHE: 'סיימת עבודה והלקוח שואל על החלפת חלונות. בדרך כלל היית הולך. עכשיו אתה מרוויח.',
                },
              ].map((uc, i) => (
                <div
                  key={i}
                  className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm"
                  style={{ direction: isRtl ? 'rtl' : 'ltr' }}
                >
                  <div className="text-2xl mb-2">{uc.emoji}</div>
                  <h4 className="text-sm font-bold text-gray-900 mb-1">{isRtl ? uc.titleHE : uc.titleEN}</h4>
                  <p className="text-xs text-gray-500 leading-relaxed">{isRtl ? uc.descHE : uc.descEN}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Main content: Phone + Flow */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-start max-w-5xl mx-auto">

            {/* LEFT: WhatsApp Phone */}
            <div className={isRtl ? 'lg:order-2' : ''}>
              <div
                className="rounded-2xl shadow-xl border border-gray-200 overflow-hidden mx-auto max-w-sm"
                style={{ opacity: 1 }}
              >
                {/* Phone header */}
                <div className="px-4 py-3 flex items-center gap-3" style={{ background: '#075e54' }}>
                  <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0">
                    <img src="/rebeca.jpg" alt="Rebeca" className="w-full h-full object-cover" />
                  </div>
                  <div>
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
                  style={{ background: '#ece5dd', maxHeight: '380px', minHeight: '300px', padding: '14px 10px' }}
                >
                  <div className="flex flex-col gap-3">
                    {messages.slice(0, visibleCount).map((msg, i) => {
                      const isAgent = msg.from === 'agent'
                      return (
                        <div
                          key={`${lang}-${i}`}
                          className={`flex items-end gap-1.5 ${isAgent ? 'justify-start' : 'justify-end'}`}
                          style={{ animation: 'em-msg-in 0.4s ease-out both' }}
                        >
                          {isAgent && (
                            <img src="/rebeca.jpg" alt="" className="w-5 h-5 rounded-full object-cover flex-shrink-0 mb-0.5" />
                          )}
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
                          {!isAgent && (
                            <img src={initialsAvatar('You', 36)} alt="" className="w-5 h-5 rounded-full object-cover flex-shrink-0 mb-0.5" />
                          )}
                        </div>
                      )
                    })}
                    {showTyping && (
                      <div className="flex justify-start">
                        <TypingDots />
                      </div>
                    )}
                  </div>
                </div>

                {/* Input bar */}
                <div className="bg-[#f0f0f0] px-3 py-2 flex items-center gap-2 border-t border-gray-200">
                  <div className="flex-1 bg-white rounded-full px-4 py-2 text-xs text-gray-400">
                    {isRtl ? 'הקלד הודעה...' : 'Type a message...'}
                  </div>
                  <div className="w-8 h-8 rounded-full bg-[#075e54] flex items-center justify-center flex-shrink-0">
                    <Mic className="w-4 h-4 text-white" />
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT: Flow Diagram + Network Card */}
            <div className={`flex flex-col gap-6 ${isRtl ? 'lg:order-1' : ''}`}>
              {/* Flow Steps */}
              <div className="space-y-0">
                {flowSteps.map((step, i) => {
                  const Icon = step.icon
                  const isActive = i <= activeStep
                  const isCurrent = i === activeStep
                  return (
                    <div key={i} className="flex items-start gap-4">
                      {/* Step indicator */}
                      <div className="flex flex-col items-center">
                        <div
                          className={`w-11 h-11 rounded-full flex items-center justify-center transition-all duration-500 ${
                            isActive
                              ? 'bg-[#fe5b25] text-white shadow-lg shadow-[#fe5b25]/25'
                              : 'bg-gray-100 text-gray-400 border border-gray-200'
                          }`}
                          style={isCurrent ? { animation: 'em-step-pulse 2s ease-in-out infinite' } : undefined}
                        >
                          {isActive && i < activeStep ? (
                            <CheckCircle2 className="w-5 h-5" />
                          ) : (
                            <Icon className="w-5 h-5" />
                          )}
                        </div>
                        {/* Connector line */}
                        {i < flowSteps.length - 1 && (
                          <div className={`w-0.5 h-8 transition-colors duration-500 ${
                            i < activeStep ? 'bg-[#fe5b25]' : 'bg-gray-200'
                          }`} />
                        )}
                      </div>

                      {/* Step content */}
                      <div className="pt-2 pb-4">
                        <h4 className={`text-sm font-bold transition-colors duration-500 ${
                          isActive ? 'text-gray-900' : 'text-gray-400'
                        }`}>
                          {step.label}
                        </h4>
                        <p className={`text-sm transition-colors duration-500 ${
                          isActive ? 'text-gray-500' : 'text-gray-300'
                        }`}>
                          {step.desc}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Your Network Card */}
              <div
                className={`bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden transition-all duration-500 ${
                  showNetwork ? 'opacity-100' : 'opacity-0 translate-y-4'
                }`}
                style={showNetwork ? { animation: 'em-network-in 0.5s ease-out both' } : undefined}
              >
                <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-[#fe5b25]" />
                    <span className="text-sm font-semibold text-gray-900">
                      {isRtl ? 'הרשת שלך' : 'Your Contractors'}
                    </span>
                  </div>
                  <span className="text-xs text-gray-400">
                    {isRtl ? '12 קבלנים' : '12 contractors'}
                  </span>
                </div>

                <div className="px-4 py-3">
                  {/* Contractor avatars row */}
                  <div className="flex items-center gap-2 mb-3">
                    {networkContractors.map((c, i) => (
                      <div
                        key={i}
                        className="flex flex-col items-center gap-1"
                        style={showNetwork ? {
                          animation: `em-avatar-pop 0.3s ease-out ${i * 0.1}s both`
                        } : undefined}
                      >
                        <img
                          src={initialsAvatar(c.name, i)}
                          alt={isRtl ? c.nameHe : c.name}
                          className="w-9 h-9 rounded-full object-cover ring-2 ring-white shadow-sm"
                        />
                        <span className="text-[9px] text-gray-400 leading-none">
                          {isRtl ? c.tradeHe : c.trade}
                        </span>
                      </div>
                    ))}
                    {/* +more */}
                    <div className="flex flex-col items-center gap-1">
                      <div className="w-9 h-9 rounded-full bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center">
                        <span className="text-xs text-gray-400 font-medium">+7</span>
                      </div>
                      <span className="text-[9px] text-gray-400 leading-none">
                        {isRtl ? 'עוד' : 'more'}
                      </span>
                    </div>
                  </div>

                  {/* Quick actions */}
                  <div className="flex items-center gap-2">
                    <button className="flex-1 text-xs font-medium text-[#fe5b25] bg-[#fe5b25]/5 border border-[#fe5b25]/15 rounded-lg py-2 px-3 flex items-center justify-center gap-1.5">
                      <Users className="w-3.5 h-3.5" />
                      {isRtl ? 'הוסף קבלן' : 'Add Contractor'}
                    </button>
                    <button className="flex-1 text-xs font-medium text-gray-600 bg-gray-50 border border-gray-200 rounded-lg py-2 px-3 flex items-center justify-center gap-1.5">
                      <DollarSign className="w-3.5 h-3.5" />
                      {isRtl ? 'הגדר עמלה' : 'Set Commission'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Earnings summary — appears with network */}
              <div
                className={`bg-[#0b0707] rounded-xl px-5 py-4 transition-all duration-500 ${
                  showNetwork ? 'opacity-100' : 'opacity-0 translate-y-4'
                }`}
                style={showNetwork ? { animation: 'em-network-in 0.5s ease-out 0.2s both' } : undefined}
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-gray-400 text-xs mb-0.5">{isRtl ? 'הרווחת החודש' : 'Earned this month'}</p>
                    <p className="text-white text-2xl font-bold">$2,340</p>
                  </div>
                  <div className="text-right">
                    <p className="text-gray-400 text-xs mb-0.5">{isRtl ? 'עבודות שהופצו' : 'Jobs sent out'}</p>
                    <p className="text-white text-2xl font-bold">18</p>
                  </div>
                  <div className="text-right">
                    <p className="text-gray-400 text-xs mb-0.5">{isRtl ? 'אחוז תפיסה' : 'Jobs taken'}</p>
                    <p className="text-[#25d366] text-2xl font-bold">89%</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
