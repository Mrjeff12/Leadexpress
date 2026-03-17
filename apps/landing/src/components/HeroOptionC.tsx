import { ArrowRight, MessageCircle } from 'lucide-react'
import { useState, useEffect } from 'react'
import { useLang } from '../i18n/LanguageContext'

/**
 * OPTION C — ChaosToOrder IS the Hero:
 * The existing chaos→extraction animation moves up to become the hero visual.
 * Title + subtitle above, animated phone + extracted card below.
 */

const WhatsAppIcon = ({ className = '' }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
)

const CHAOS_MSGS = [
  { name: 'Dan', text: 'Anyone free for a job in Miami?', color: '#1f7aec' },
  { name: 'Mike', text: 'Me!!', color: '#e65100' },
  { name: 'Joe', text: 'I\'m free too', color: '#00897b' },
  { name: 'Alex', text: 'I can do tomorrow', color: '#6a1b9a' },
  { name: 'Ron', text: 'What type of work?', color: '#c62828' },
  { name: 'Dan', text: 'Plumbing, first come first served', color: '#1f7aec' },
  { name: 'Sam', text: 'On my way!', color: '#2e7d32' },
  { name: 'Mike', text: 'That\'s my area!', color: '#e65100' },
  { name: 'Joe', text: 'I\'m closer', color: '#00897b' },
  { name: 'Alex', text: 'Already taken? 😤', color: '#6a1b9a' },
  { name: 'Ron', text: 'Missed it again...', color: '#c62828' },
  { name: 'Sam', text: 'Anyone know about jobs?', color: '#2e7d32' },
]

export default function HeroOptionC() {
  const { t } = useLang()
  const [phase, setPhase] = useState<'chaos' | 'extract' | 'done'>('chaos')
  const [chaosScroll, setChaosScroll] = useState(0)

  useEffect(() => {
    const cycle = () => {
      setPhase('chaos')
      setChaosScroll(0)

      const scrollInterval = setInterval(() => {
        setChaosScroll(prev => Math.min(prev + 1, CHAOS_MSGS.length))
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
  }, [])

  const isExtracted = phase === 'extract' || phase === 'done'

  return (
    <section className="relative pt-28 pb-12 md:pt-36 md:pb-20 overflow-hidden min-h-screen bg-cream">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-[#25D366]/8 rounded-full blur-[120px]" />

      <div className="max-w-7xl mx-auto px-6 relative w-full">
        {/* Text — centered above */}
        <div className="text-center mb-10 md:mb-14">
          <div className="inline-flex items-center gap-2 bg-[#25D366]/15 text-[#25D366] rounded-full px-4 py-1.5 text-xs font-semibold mb-6">
            <WhatsAppIcon className="w-3.5 h-3.5" />
            {t.hero.badge}
          </div>

          <h1 className="text-4xl md:text-5xl lg:text-6xl font-medium leading-[1.15] tracking-[-0.04em] mb-6 text-dark max-w-4xl mx-auto">
            {t.hero.title1}{' '}
            <span className="highlight-box">{t.hero.titleHighlight}</span>
            <br />
            {t.hero.title2}
          </h1>

          <p className="text-base md:text-lg text-gray-subtle/70 max-w-2xl mx-auto mb-8 leading-relaxed">
            {t.hero.subtitle}
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a href="#pricing" className="group inline-flex items-center justify-center gap-2 rounded-full bg-[#25D366] text-white px-8 py-4 text-base font-semibold transition-all duration-300 hover:bg-[#1ebe5a] hover:scale-105 hover:shadow-lg hover:shadow-[#25D366]/25 active:scale-95">
              <WhatsAppIcon className="w-5 h-5" />
              {t.hero.cta1}
              <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
            </a>
            <a href="#features" className="inline-flex items-center justify-center gap-2 rounded-full border border-dark/20 text-dark/70 px-8 py-4 text-base font-semibold transition-all duration-300 hover:border-dark/40 hover:text-dark hover:scale-105 active:scale-95">
              <MessageCircle size={16} />
              {t.hero.cta2}
            </a>
          </div>
        </div>

        {/* Visual — ChaosToOrder inline */}
        <div className="flex flex-col md:flex-row items-center justify-center gap-6 md:gap-12 relative">

          {/* Labels */}
          <div className={`hidden md:block absolute -top-6 z-10 transition-opacity duration-500 ${
            phase === 'chaos' ? 'opacity-100' : 'opacity-50'
          }`} style={{ left: '50%', transform: 'translateX(-50%)' }}>
            <span className={`inline-flex items-center gap-1.5 text-[10px] font-semibold px-3 py-1 rounded-full ${
              phase === 'chaos' ? 'bg-red-500 text-white' : 'bg-red-500/10 text-red-500'
            } transition-all duration-500`}>
              ✕ Before — WhatsApp Group
            </span>
          </div>

          {/* iPhone */}
          <div className="relative w-[260px] md:w-[280px] flex-shrink-0">
            <div className="relative bg-black rounded-[40px] p-[5px] shadow-[0_0_60px_rgba(0,0,0,0.2)]">
              <div className="bg-white rounded-[36px] overflow-hidden border border-gray-200">
                {/* Notch */}
                <div className="flex justify-center pt-2 bg-white">
                  <div className="w-[70px] h-[20px] bg-black rounded-full" />
                </div>

                {/* WhatsApp header */}
                <div className="bg-[#075E54] px-2 pt-1 pb-2">
                  <div className="flex items-center gap-1.5">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M15 18l-6-6 6-6" /></svg>
                    <div className="w-[26px] h-[26px] rounded-full bg-[#DFE5E7] flex items-center justify-center flex-shrink-0">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="#a0aeb4">
                        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] font-medium text-white truncate">Technicians — Urgent Jobs 🔧</div>
                      <div className="text-[8px] text-white/70">Dan, Mike, Joe, Alex...</div>
                    </div>
                  </div>
                </div>

                {/* Messages */}
                <div className="px-1.5 py-1 space-y-[2px] h-[290px] md:h-[320px] overflow-hidden relative" style={{ backgroundColor: '#ECE5DD' }}>
                  <div className="flex justify-center mb-1">
                    <span className="bg-[#BDDAB5] text-[#3B6E32] text-[7px] font-medium px-2 py-0.5 rounded-md">
                      99+ UNREAD MESSAGES
                    </span>
                  </div>

                  {CHAOS_MSGS.slice(0, chaosScroll).map((msg, i) => {
                    const showName = i === 0 || CHAOS_MSGS[i - 1]?.name !== msg.name
                    return (
                      <div key={i} className="flex justify-start">
                        <div className="bg-white rounded-md shadow-sm px-1.5 py-0.5 max-w-[82%]" style={{ borderTopLeftRadius: showName ? '1px' : '6px' }}>
                          {showName && (
                            <div className="text-[8px] font-medium" style={{ color: msg.color }}>~ {msg.name}</div>
                          )}
                          <div className="flex items-end gap-1">
                            <span className="text-[10px] text-[#303030] leading-snug">{msg.text}</span>
                            <span className="text-[6px] text-[#8c8c8c] whitespace-nowrap flex-shrink-0">08:12</span>
                          </div>
                        </div>
                      </div>
                    )
                  })}

                  <div className="absolute bottom-0 inset-x-0 h-10 bg-gradient-to-t from-[#ECE5DD] to-transparent" />
                </div>

                {/* Input + home bar */}
                <div className="bg-[#F0F0F0] px-2 py-1 flex items-center gap-1">
                  <div className="flex-1 bg-white rounded-full px-2 py-1 text-[8px] text-[#8c8c8c]">Message</div>
                  <div className="w-6 h-6 rounded-full bg-[#00A884] flex items-center justify-center flex-shrink-0">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="white"><path d="M12 15c1.66 0 2.99-1.34 2.99-3L15 6c0-1.66-1.34-3-3-3S9 4.34 9 6v6c0 1.66 1.34 3 3 3z"/></svg>
                  </div>
                </div>
                <div className="bg-white flex justify-center py-1">
                  <div className="w-[60px] h-[3px] bg-black/20 rounded-full" />
                </div>
              </div>
            </div>

            {/* Pain tags */}
            <div className="flex flex-wrap gap-1 justify-center mt-2">
              {['😤 Fighting for leads', '🔇 Muted groups', '⏰ Missing jobs'].map((label, i) => (
                <span key={i} className="text-[8px] text-red-400/70 bg-red-500/5 rounded-full px-2 py-0.5">{label}</span>
              ))}
            </div>
          </div>

          {/* Arrow */}
          <div className={`transition-all duration-700 ${isExtracted ? 'opacity-100 scale-100' : 'opacity-0 scale-75'}`}>
            <div className="md:hidden flex flex-col items-center gap-1">
              <div className="w-10 h-10 rounded-full bg-[#25D366] flex items-center justify-center shadow-lg shadow-[#25D366]/30">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 5v14M5 12l7 7 7-7" />
                </svg>
              </div>
              <span className="text-[9px] text-[#25D366] font-semibold">AI extracts your lead</span>
            </div>
            <div className="hidden md:flex flex-col items-center gap-1">
              <svg width="80" height="40" viewBox="0 0 80 40">
                <path d="M0,20 C30,20 50,20 70,20" fill="none" stroke="#25D366" strokeWidth="2" strokeDasharray="6 4" className={isExtracted ? 'lead-dash-animate' : ''} />
                <polygon points="68,14 78,20 68,26" fill="#25D366" />
              </svg>
              <span className="text-[9px] text-[#25D366] font-semibold">AI extracts your lead</span>
            </div>
          </div>

          {/* Extracted lead card */}
          <div
            className={`relative transition-all duration-[800ms] ${
              isExtracted
                ? 'opacity-100 translate-y-0 md:translate-x-0 scale-100'
                : 'opacity-0 translate-y-8 md:translate-y-0 md:-translate-x-12 scale-[0.85]'
            }`}
            style={{ transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }}
          >
            <div className={`absolute -inset-8 bg-[#25D366]/15 rounded-3xl blur-3xl transition-opacity duration-700 ${isExtracted ? 'opacity-100' : 'opacity-0'}`} />

            <div className={`text-center mb-3 transition-all duration-500 ${isExtracted ? 'opacity-100' : 'opacity-0'}`}>
              <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold px-3 py-1 rounded-full bg-[#25D366] text-white">
                ✓ Sent to your WhatsApp
              </span>
            </div>

            <div className="relative w-[250px] md:w-[280px] bg-gradient-to-br from-[#111b21] to-[#0d1f17] rounded-2xl border border-[#25D366]/30 shadow-[0_20px_60px_rgba(37,211,102,0.2)] overflow-hidden">
              <div className={`h-[2px] bg-gradient-to-r from-transparent via-[#25D366] to-transparent ${isExtracted ? 'lead-shimmer' : ''}`} />

              <div className="px-4 pt-3 pb-2 flex items-center gap-2.5 border-b border-[#25D366]/10">
                <div className="w-9 h-9 rounded-full bg-[#25D366]/20 flex items-center justify-center">
                  <span className="text-base">🎯</span>
                </div>
                <div className="flex-1">
                  <div className="text-[12px] font-bold text-[#25D366]">Exclusive Lead For You!</div>
                  <div className="text-[9px] text-[#8696a0]">Lead Express</div>
                </div>
                <div className={`w-2.5 h-2.5 rounded-full bg-[#25D366] ${isExtracted ? 'animate-pulse' : ''}`} />
              </div>

              <div className="px-4 py-3 space-y-2.5">
                <div className="flex items-start gap-2.5">
                  <span className="text-sm mt-0.5">📍</span>
                  <div>
                    <div className="text-[9px] text-[#8696a0]">Location</div>
                    <div className="text-[12px] text-[#e9edef] font-medium">Miami, FL 33101</div>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="text-sm mt-0.5">🔧</span>
                  <div>
                    <div className="text-[9px] text-[#8696a0]">Job Type</div>
                    <div className="text-[12px] text-[#e9edef] font-medium">Plumbing — Pipe leak repair</div>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="text-sm mt-0.5">💰</span>
                  <div>
                    <div className="text-[9px] text-[#8696a0]">Est. Budget</div>
                    <div className="text-[13px] text-[#25D366] font-bold">$300–500</div>
                  </div>
                </div>
              </div>

              <div className="px-4 pb-3">
                <div className={`bg-[#25D366] text-white text-center text-[11px] font-bold py-2.5 rounded-xl transition-all duration-500 ${
                  phase === 'done' ? 'shadow-[0_0_20px_rgba(37,211,102,0.4)]' : ''
                }`}>
                  ✅ I'm available — Send details
                </div>
              </div>

              <div className="bg-[#25D366]/5 border-t border-[#25D366]/10 px-4 py-2 text-center">
                <div className="text-[8px] text-[#25D366]/80">
                  🔒 Only you received this lead
                </div>
              </div>
            </div>

            <div className={`flex flex-wrap gap-1.5 justify-center mt-3 transition-all duration-500 delay-300 ${isExtracted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
              {['🎯 Exclusive lead', '📍 Your area', '⚡ Zero competition'].map((label, i) => (
                <span key={i} className="text-[9px] text-[#25D366]/80 bg-[#25D366]/5 border border-[#25D366]/10 rounded-full px-2 py-0.5">{label}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
