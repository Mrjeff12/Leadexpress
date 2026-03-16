import { useState, useEffect } from 'react'
import { useLang } from '../i18n/LanguageContext'

// Chaotic group messages — all from "others" in the group
const CHAOS_MSGS_HE = [
  { name: 'דני', text: 'מישהו פנוי לעבודה בת"א?', time: '08:12' },
  { name: 'משה', text: 'אני!!', time: '08:12' },
  { name: 'יוסי', text: 'גם אני פנוי', time: '08:12' },
  { name: 'אבי', text: 'אני יכול מחר', time: '08:13' },
  { name: 'רון', text: 'מה סוג העבודה?', time: '08:13' },
  { name: 'דני', text: 'אינסטלציה, מי שמגיע ראשון', time: '08:13' },
  { name: 'שלומי', text: 'כבר בדרך!', time: '08:13' },
  { name: 'משה', text: 'זה באזור שלי!', time: '08:14' },
  { name: 'יוסי', text: 'אני יותר קרוב', time: '08:14' },
  { name: 'אבי', text: 'כבר ענו? 😤', time: '08:14' },
  { name: 'רון', text: 'פספסתי שוב...', time: '08:15' },
  { name: 'שלומי', text: 'מישהו יודע על עבודות?', time: '08:16' },
]
const CHAOS_MSGS_EN = [
  { name: 'Dan', text: 'Anyone free for a job in Miami?', time: '08:12' },
  { name: 'Mike', text: 'Me!!', time: '08:12' },
  { name: 'Joe', text: 'I\'m free too', time: '08:12' },
  { name: 'Alex', text: 'I can do tomorrow', time: '08:13' },
  { name: 'Ron', text: 'What type of work?', time: '08:13' },
  { name: 'Dan', text: 'Plumbing, first come first served', time: '08:13' },
  { name: 'Sam', text: 'On my way!', time: '08:13' },
  { name: 'Mike', text: 'That\'s my area!', time: '08:14' },
  { name: 'Joe', text: 'I\'m closer', time: '08:14' },
  { name: 'Alex', text: 'Already taken? 😤', time: '08:14' },
  { name: 'Ron', text: 'Missed it again...', time: '08:15' },
  { name: 'Sam', text: 'Anyone know about jobs?', time: '08:16' },
]

const NAME_COLORS = ['#1f7aec', '#e65100', '#00897b', '#6a1b9a', '#c62828', '#2e7d32']

export default function ChaosToOrderSection() {
  const { lang } = useLang()
  const [phase, setPhase] = useState<'chaos' | 'extract' | 'done'>('chaos')
  const [chaosScroll, setChaosScroll] = useState(0)

  const chaosMsgs = lang === 'he' ? CHAOS_MSGS_HE : CHAOS_MSGS_EN
  const isHe = lang === 'he'

  useEffect(() => {
    const cycle = () => {
      setPhase('chaos')
      setChaosScroll(0)

      const scrollInterval = setInterval(() => {
        setChaosScroll(prev => Math.min(prev + 1, chaosMsgs.length))
      }, 280)

      setTimeout(() => {
        clearInterval(scrollInterval)
        setPhase('extract')
      }, 4200)

      setTimeout(() => {
        setPhase('done')
      }, 5200)
    }

    cycle()
    const mainInterval = setInterval(cycle, 11000)
    return () => clearInterval(mainInterval)
  }, [lang])

  const isExtracted = phase === 'extract' || phase === 'done'

  return (
    <section className="section-padding bg-cream-dark overflow-hidden">
      <div className="max-w-7xl mx-auto px-6">
        {/* Header */}
        <div className="text-center mb-12 md:mb-16">
          <div className="inline-flex items-center gap-2 bg-red-500/10 text-red-500 rounded-full px-4 py-1.5 text-xs font-semibold mb-4">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            {isHe ? 'הבעיה' : 'The Problem'}
          </div>
          <h2 className="text-3xl md:text-5xl font-medium mb-4">
            {isHe
              ? 'בקבוצות ווצאפ, כולם נלחמים על אותו ליד.'
              : 'In WhatsApp groups, everyone fights for the same lead.'}
          </h2>
          <p className="text-gray-subtle/70 max-w-2xl mx-auto">
            {isHe
              ? 'עשרות טכנאים, הודעה אחת — מי שמגיע ראשון לוקח. אתה מפספס עבודות כי לא ראית את ההודעה בזמן.'
              : 'Dozens of technicians, one message — first to respond wins. You miss jobs because you didn\'t see the message in time.'}
          </p>
        </div>

        {/* Phone + extracted lead */}
        <div className="flex flex-col md:flex-row items-center justify-center gap-6 md:gap-12 relative">

          {/* Before label */}
          <div className={`mb-2 md:mb-0 md:absolute md:-top-6 transition-opacity duration-500 z-10 ${
            phase === 'chaos' ? 'opacity-100' : 'opacity-50'
          }`} style={{ left: '50%', transform: 'translateX(-50%)' }}>
            <span className={`inline-flex items-center gap-1.5 text-[10px] font-semibold px-3 py-1 rounded-full ${
              phase === 'chaos' ? 'bg-red-500 text-white' : 'bg-red-500/10 text-red-500'
            } transition-all duration-500`}>
              ✕ {isHe ? 'לפני — קבוצת ווצאפ' : 'Before — WhatsApp Group'}
            </span>
          </div>

          {/* iPhone frame */}
          <div className="relative w-[272px] md:w-[300px] flex-shrink-0">
            <div className="relative bg-black rounded-[44px] p-[6px] shadow-[0_0_80px_rgba(0,0,0,0.25)]">
              <div className="bg-white rounded-[40px] overflow-hidden border border-gray-200">
                {/* Dynamic Island */}
                <div className="flex justify-center pt-2 pb-0 bg-white relative z-10">
                  <div className="w-[80px] h-[22px] bg-black rounded-full" />
                </div>

                {/* WhatsApp header — real WhatsApp green */}
                <div className="bg-[#075E54] px-2 pt-1 pb-2">
                  {/* Status bar overlapping */}
                  <div className="flex justify-between items-center text-[8px] text-white/80 px-1 mb-1.5">
                    <span>9:41</span>
                    <div className="flex items-center gap-1">
                      <svg width="12" height="8" viewBox="0 0 12 8" fill="white" fillOpacity="0.8"><rect x="0" y="3" width="2" height="5" rx="0.5" /><rect x="3" y="2" width="2" height="6" rx="0.5" /><rect x="6" y="1" width="2" height="7" rx="0.5" /><rect x="9" y="0" width="2" height="8" rx="0.5" /></svg>
                      <svg width="16" height="9" viewBox="0 0 16 9" fill="none"><rect x="0.5" y="0.5" width="13" height="8" rx="1.5" stroke="white" strokeOpacity="0.8" /><rect x="14.5" y="2.5" width="1.5" height="4" rx="0.5" fill="white" fillOpacity="0.8" /><rect x="1.5" y="1.5" width="11" height="6" rx="0.5" fill="white" fillOpacity="0.8" /></svg>
                    </div>
                  </div>
                  {/* Nav row */}
                  <div className="flex items-center gap-1.5">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M15 18l-6-6 6-6" /></svg>
                    {/* Group avatar */}
                    <div className="w-[30px] h-[30px] rounded-full bg-[#DFE5E7] flex items-center justify-center overflow-hidden flex-shrink-0">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="#a0aeb4">
                        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                        <path d="M18 11c1.66 0 2.99-1.34 2.99-3S19.66 5 18 5c-.32 0-.63.05-.91.14.57.81.91 1.79.91 2.86 0 1.07-.34 2.04-.91 2.86.28.09.59.14.91.14zm0 2c1.11 0 3.45.67 4 2v2h-4v-2c0-.82-.27-1.54-.73-2.15.24-.03.48-.05.73-.05z" transform="translate(-2, 0) scale(0.85)"/>
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] font-medium text-white truncate leading-tight">
                        {isHe ? 'טכנאים — עבודות דחופות 🔧' : 'Technicians — Urgent Jobs 🔧'}
                      </div>
                      <div className="text-[9px] text-white/70 leading-tight">
                        {isHe ? 'דני, משה, יוסי, אבי, רון, שלומי...' : 'Dan, Mike, Joe, Alex, Ron, Sam...'}
                      </div>
                    </div>
                    {/* Header icons */}
                    <div className="flex items-center gap-2.5">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M15.9 14.3H15l-.3-.3c1-1.1 1.6-2.7 1.6-4.3 0-3.7-3-6.7-6.7-6.7S3 6 3 9.7s3 6.7 6.7 6.7c1.6 0 3.2-.6 4.3-1.6l.3.3v.8l5.1 5.1 1.5-1.5-5-5.2zm-6.2 0c-2.6 0-4.6-2.1-4.6-4.6s2.1-4.6 4.6-4.6 4.6 2.1 4.6 4.6-2 4.6-4.6 4.6z"/></svg>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>
                    </div>
                  </div>
                </div>

                {/* Messages area — WhatsApp light wallpaper */}
                <div
                  className="px-2 py-1.5 space-y-[3px] h-[330px] md:h-[360px] overflow-hidden relative"
                  style={{
                    backgroundColor: '#ECE5DD',
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200' viewBox='0 0 200 200'%3E%3Cg fill='%23c8c0b5' fill-opacity='0.15'%3E%3Cpath d='M20 20h4v4h-4zM60 20h4v4h-4zM100 20h4v4h-4zM140 20h4v4h-4zM180 20h4v4h-4zM40 40h4v4h-4zM80 40h4v4h-4zM120 40h4v4h-4zM160 40h4v4h-4zM20 60h4v4h-4zM60 60h4v4h-4zM100 60h4v4h-4zM140 60h4v4h-4zM180 60h4v4h-4zM40 80h4v4h-4zM80 80h4v4h-4zM120 80h4v4h-4zM160 80h4v4h-4zM20 100h4v4h-4zM60 100h4v4h-4zM100 100h4v4h-4zM140 100h4v4h-4zM180 100h4v4h-4zM40 120h4v4h-4zM80 120h4v4h-4zM120 120h4v4h-4zM160 120h4v4h-4zM20 140h4v4h-4zM60 140h4v4h-4zM100 140h4v4h-4zM140 140h4v4h-4zM180 140h4v4h-4zM40 160h4v4h-4zM80 160h4v4h-4zM120 160h4v4h-4zM160 160h4v4h-4zM20 180h4v4h-4zM60 180h4v4h-4zM100 180h4v4h-4zM140 180h4v4h-4zM180 180h4v4h-4z'/%3E%3C/g%3E%3C/svg%3E")`
                  }}
                >
                  {/* Unread badge */}
                  <div className="flex justify-center mb-1">
                    <span className="bg-[#BDDAB5] text-[#3B6E32] text-[8px] font-medium px-2.5 py-0.5 rounded-md shadow-sm">
                      {isHe ? '99+ הודעות שלא נקראו' : '99+ UNREAD MESSAGES'}
                    </span>
                  </div>

                  {chaosMsgs.slice(0, chaosScroll).map((msg, i) => {
                    const showName = i === 0 || chaosMsgs[i - 1]?.name !== msg.name
                    return (
                      <div key={i} className="chaos-msg-appear flex justify-start">
                        {/* White bubble with tail for incoming messages */}
                        <div className="relative bg-white rounded-lg shadow-[0_1px_0.5px_rgba(0,0,0,0.13)] px-2 py-1 max-w-[82%]" style={{
                          borderTopLeftRadius: showName ? '2px' : '8px',
                        }}>
                          {/* Tail on first message of sender */}
                          {showName && (
                            <div className="absolute -left-[6px] top-0 w-0 h-0"
                              style={{ borderTop: '0px solid transparent', borderRight: '6px solid white', borderBottom: '8px solid transparent' }}
                            />
                          )}
                          {showName && (
                            <div className="text-[9px] font-medium leading-tight" style={{ color: NAME_COLORS[i % NAME_COLORS.length] }}>
                              ~ {msg.name}
                            </div>
                          )}
                          <div className="flex items-end gap-1.5">
                            <span className="text-[11px] text-[#303030] leading-snug">{msg.text}</span>
                            <span className="text-[7px] text-[#8c8c8c] whitespace-nowrap flex-shrink-0 translate-y-[1px]">{msg.time}</span>
                          </div>
                        </div>
                      </div>
                    )
                  })}

                  {/* Gradient fade at bottom */}
                  <div className="absolute bottom-0 inset-x-0 h-12 bg-gradient-to-t from-[#ECE5DD] to-transparent" />
                </div>

                {/* Input bar — real WhatsApp style */}
                <div className="bg-[#F0F0F0] px-2 py-1.5 flex items-center gap-1.5">
                  <div className="flex-1 bg-white rounded-full px-3 py-1.5 flex items-center gap-1.5 shadow-sm">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="#8c8c8c"><circle cx="12" cy="12" r="10" fill="none" stroke="#8c8c8c" strokeWidth="1.5"/><path d="M8 14s1.5 2 4 2 4-2 4-2" fill="none" stroke="#8c8c8c" strokeWidth="1.5" strokeLinecap="round"/><circle cx="9" cy="10" r="1.2"/><circle cx="15" cy="10" r="1.2"/></svg>
                    <span className="text-[9px] text-[#8c8c8c] flex-1">{isHe ? 'הודעה' : 'Message'}</span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="#8c8c8c"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66L9.41 17.4a2 2 0 01-2.83-2.83l8.49-8.48" fill="none" stroke="#8c8c8c" strokeWidth="1.8" strokeLinecap="round"/></svg>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="#8c8c8c"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" fill="none" stroke="#8c8c8c" strokeWidth="1.8"/><circle cx="12" cy="13" r="4" fill="none" stroke="#8c8c8c" strokeWidth="1.8"/></svg>
                  </div>
                  <div className="w-[32px] h-[32px] rounded-full bg-[#00A884] flex items-center justify-center flex-shrink-0">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M12 15c1.66 0 2.99-1.34 2.99-3L15 6c0-1.66-1.34-3-3-3S9 4.34 9 6v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 15 6.7 12H5c0 3.42 2.72 6.23 6 6.72V22h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/></svg>
                  </div>
                </div>

                {/* Home indicator */}
                <div className="bg-white flex justify-center py-1.5">
                  <div className="w-[80px] h-[4px] bg-black/20 rounded-full" />
                </div>
              </div>
            </div>

            {/* Pain labels */}
            <div className="flex flex-wrap gap-1.5 justify-center mt-3">
              {(isHe
                ? ['😤 תחרות על כל ליד', '🔇 התראות מושתקות', '⏰ מפספס עבודות']
                : ['😤 Fighting for leads', '🔇 Notifications muted', '⏰ Missing jobs']
              ).map((label, i) => (
                <span key={i} className="text-[9px] text-red-400/70 bg-red-500/5 rounded-full px-2 py-0.5">{label}</span>
              ))}
            </div>
          </div>

          {/* Arrow between phone and card */}
          <div className={`transition-all duration-700 ${isExtracted ? 'opacity-100 scale-100' : 'opacity-0 scale-75'}`}>
            <div className="md:hidden flex flex-col items-center gap-1">
              <div className="w-10 h-10 rounded-full bg-[#25D366] flex items-center justify-center shadow-lg shadow-[#25D366]/30">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 5v14M5 12l7 7 7-7" />
                </svg>
              </div>
              <span className="text-[9px] text-[#25D366] font-semibold">
                {isHe ? 'חילוץ הליד' : 'Lead extracted'}
              </span>
            </div>
            <div className="hidden md:flex flex-col items-center gap-1">
              <svg width="80" height="40" viewBox="0 0 80 40">
                <path d="M0,20 C30,20 50,20 70,20" fill="none" stroke="#25D366" strokeWidth="2" strokeDasharray="6 4" className={isExtracted ? 'lead-dash-animate' : ''} />
                <polygon points="68,14 78,20 68,26" fill="#25D366" />
              </svg>
              <span className="text-[9px] text-[#25D366] font-semibold">
                {isHe ? 'חילוץ הליד' : 'Lead extracted'}
              </span>
            </div>
          </div>

          {/* EXTRACTED LEAD CARD */}
          <div
            className={`relative transition-all duration-[800ms] ${
              isExtracted
                ? 'opacity-100 translate-y-0 md:translate-x-0 scale-100'
                : 'opacity-0 translate-y-8 md:translate-y-0 md:-translate-x-12 scale-[0.85]'
            }`}
            style={{ transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }}
          >
            {/* Glow */}
            <div className={`absolute -inset-8 bg-[#25D366]/15 rounded-3xl blur-3xl transition-opacity duration-700 ${isExtracted ? 'opacity-100' : 'opacity-0'}`} />

            {/* After label */}
            <div className={`text-center mb-3 transition-all duration-500 ${isExtracted ? 'opacity-100' : 'opacity-0'}`}>
              <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold px-3 py-1 rounded-full bg-[#25D366] text-white">
                ✓ {isHe ? 'אחרי — Lead Express' : 'After — Lead Express'}
              </span>
            </div>

            {/* Card */}
            <div className="relative w-[270px] md:w-[300px] bg-gradient-to-br from-[#111b21] to-[#0d1f17] rounded-2xl border border-[#25D366]/30 shadow-[0_20px_60px_rgba(37,211,102,0.2)] overflow-hidden">
              <div className={`h-[2px] bg-gradient-to-r from-transparent via-[#25D366] to-transparent ${isExtracted ? 'lead-shimmer' : ''}`} />

              <div className="px-4 pt-3 pb-2 flex items-center gap-2.5 border-b border-[#25D366]/10">
                <div className="w-9 h-9 rounded-full bg-[#25D366]/20 flex items-center justify-center">
                  <span className="text-base">🎯</span>
                </div>
                <div className="flex-1">
                  <div className="text-[12px] font-bold text-[#25D366]">
                    {isHe ? 'ליד בלעדי עבורך!' : 'Exclusive Lead For You!'}
                  </div>
                  <div className="text-[9px] text-[#8696a0]">Lead Express</div>
                </div>
                <div className={`w-2.5 h-2.5 rounded-full bg-[#25D366] ${isExtracted ? 'animate-pulse' : ''}`} />
              </div>

              <div className="px-4 py-3 space-y-2.5">
                <div className="flex items-start gap-2.5">
                  <span className="text-sm mt-0.5">📍</span>
                  <div>
                    <div className="text-[9px] text-[#8696a0]">{isHe ? 'מיקום' : 'Location'}</div>
                    <div className="text-[12px] text-[#e9edef] font-medium">{isHe ? 'תל אביב, רמת אביב' : 'Miami, FL 33101'}</div>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="text-sm mt-0.5">🔧</span>
                  <div>
                    <div className="text-[9px] text-[#8696a0]">{isHe ? 'סוג עבודה' : 'Job Type'}</div>
                    <div className="text-[12px] text-[#e9edef] font-medium">{isHe ? 'אינסטלציה — תיקון דליפה' : 'Plumbing — Pipe leak repair'}</div>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="text-sm mt-0.5">💰</span>
                  <div>
                    <div className="text-[9px] text-[#8696a0]">{isHe ? 'תקציב משוער' : 'Est. Budget'}</div>
                    <div className="text-[13px] text-[#25D366] font-bold">$300–500</div>
                  </div>
                </div>
              </div>

              <div className="px-4 pb-3">
                <div className={`bg-[#25D366] text-white text-center text-[11px] font-bold py-2.5 rounded-xl transition-all duration-500 ${
                  phase === 'done' ? 'shadow-[0_0_20px_rgba(37,211,102,0.4)]' : ''
                }`}>
                  {isHe ? '✅ אני זמין — תשלחו לי פרטים' : '✅ I\'m available — Send details'}
                </div>
              </div>

              <div className="bg-[#25D366]/5 border-t border-[#25D366]/10 px-4 py-2 text-center">
                <div className="text-[8px] text-[#25D366]/80">
                  🔒 {isHe ? 'רק אתה קיבלת את הליד הזה' : 'Only you received this lead'}
                </div>
              </div>
            </div>

            {/* Benefit tags */}
            <div className={`flex flex-wrap gap-1.5 justify-center mt-3 transition-all duration-500 delay-300 ${isExtracted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
              {(isHe
                ? ['🎯 ליד בלעדי', '📍 מותאם לאזור שלך', '⚡ אפס תחרות']
                : ['🎯 Exclusive lead', '📍 Matched to your area', '⚡ Zero competition']
              ).map((label, i) => (
                <span key={i} className="text-[9px] text-[#25D366]/80 bg-[#25D366]/5 border border-[#25D366]/10 rounded-full px-2 py-0.5">{label}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
