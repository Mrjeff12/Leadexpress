import { ArrowRight, MessageCircle } from 'lucide-react'
import { useState, useEffect } from 'react'
import { useLang } from '../i18n/LanguageContext'

/**
 * OPTION B — Two phones side by side:
 * Left: Noisy WhatsApp group (small, red tint, blurred)
 * Right: Clean WhatsApp with extracted lead (big, green, sharp)
 * Arrow/animation between them
 */

const WhatsAppIcon = ({ className = '' }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
)

const NOISE_MSGS = [
  { name: 'Dan', text: 'Anyone free for a job?' },
  { name: 'Mike', text: 'Me!!' },
  { name: 'Joe', text: 'I\'m free too' },
  { name: 'Alex', text: 'What type of work?' },
  { name: 'Dan', text: 'Plumbing, first come first served' },
  { name: 'Sam', text: 'On my way!' },
  { name: 'Mike', text: 'That\'s my area!' },
  { name: 'Ron', text: 'Already taken? 😤' },
  { name: 'Joe', text: 'Missed it again...' },
  { name: 'Sam', text: 'Anyone else got jobs?' },
]

const NAME_COLORS = ['#1f7aec', '#e65100', '#00897b', '#6a1b9a', '#c62828', '#2e7d32']

export default function HeroOptionB() {
  const { t } = useLang()
  const [scrollPos, setScrollPos] = useState(0)
  const [showLead, setShowLead] = useState(false)

  useEffect(() => {
    const cycle = () => {
      setScrollPos(0)
      setShowLead(false)

      const scrollInterval = setInterval(() => {
        setScrollPos(prev => Math.min(prev + 1, NOISE_MSGS.length))
      }, 300)

      setTimeout(() => {
        clearInterval(scrollInterval)
        setShowLead(true)
      }, NOISE_MSGS.length * 300 + 500)
    }

    cycle()
    const interval = setInterval(cycle, 9000)
    return () => clearInterval(interval)
  }, [])

  return (
    <section className="relative pt-28 pb-8 md:pt-36 md:pb-16 overflow-hidden min-h-screen flex items-center bg-cream">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-[#25D366]/8 rounded-full blur-[120px]" />

      <div className="max-w-7xl mx-auto px-6 relative w-full">
        {/* Text — centered above phones */}
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

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-6">
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

        {/* Two phones side by side */}
        <div className="flex items-center justify-center gap-4 md:gap-8 relative">

          {/* LEFT — Noisy group (smaller, red-tinted) */}
          <div className="relative opacity-80 scale-[0.85] md:scale-90 -rotate-2">
            {/* Red overlay tint */}
            <div className="absolute inset-0 bg-red-500/5 rounded-[44px] z-20 pointer-events-none" />

            <div className="w-[200px] md:w-[240px] bg-black rounded-[36px] p-[5px] shadow-xl">
              <div className="bg-white rounded-[32px] overflow-hidden">
                {/* Notch */}
                <div className="flex justify-center pt-1.5 bg-white">
                  <div className="w-[60px] h-[16px] bg-black rounded-full" />
                </div>

                {/* WhatsApp header */}
                <div className="bg-[#075E54] px-2 py-1.5">
                  <div className="flex items-center gap-1.5">
                    <div className="w-[22px] h-[22px] rounded-full bg-[#DFE5E7] flex items-center justify-center flex-shrink-0">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="#a0aeb4">
                        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[9px] font-medium text-white truncate">Jobs FL 🔧</div>
                      <div className="text-[7px] text-white/60">48 members</div>
                    </div>
                  </div>
                </div>

                {/* Messages */}
                <div className="px-1.5 py-1 space-y-[2px] h-[240px] md:h-[280px] overflow-hidden relative" style={{ backgroundColor: '#ECE5DD' }}>
                  <div className="flex justify-center mb-1">
                    <span className="bg-[#BDDAB5] text-[#3B6E32] text-[6px] font-medium px-2 py-0.5 rounded-md">
                      99+ UNREAD
                    </span>
                  </div>

                  {NOISE_MSGS.slice(0, scrollPos).map((msg, i) => {
                    const showName = i === 0 || NOISE_MSGS[i - 1]?.name !== msg.name
                    return (
                      <div key={i} className="flex justify-start">
                        <div className="bg-white rounded-md px-1.5 py-0.5 max-w-[85%] shadow-sm" style={{ borderTopLeftRadius: showName ? '1px' : '6px' }}>
                          {showName && (
                            <div className="text-[7px] font-medium" style={{ color: NAME_COLORS[i % NAME_COLORS.length] }}>
                              ~ {msg.name}
                            </div>
                          )}
                          <span className="text-[8px] text-[#303030] leading-tight">{msg.text}</span>
                        </div>
                      </div>
                    )
                  })}

                  <div className="absolute bottom-0 inset-x-0 h-8 bg-gradient-to-t from-[#ECE5DD] to-transparent" />
                </div>

                {/* Home bar */}
                <div className="bg-[#F0F0F0] flex justify-center py-1">
                  <div className="w-[60px] h-[3px] bg-black/20 rounded-full" />
                </div>
              </div>
            </div>

            {/* Label */}
            <div className="text-center mt-3">
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-red-500 bg-red-500/10 px-3 py-1 rounded-full">
                ✕ Your groups today
              </span>
            </div>
          </div>

          {/* Arrow between phones */}
          <div className="flex flex-col items-center gap-1 z-10">
            <div className={`w-12 h-12 rounded-full bg-[#25D366] flex items-center justify-center shadow-lg shadow-[#25D366]/30 transition-all duration-500 ${showLead ? 'scale-110' : 'scale-100'}`}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </div>
            <span className="text-[9px] text-[#25D366] font-semibold whitespace-nowrap">
              AI extracts
            </span>
          </div>

          {/* RIGHT — Clean lead on WhatsApp (bigger, green glow) */}
          <div className={`relative scale-[0.85] md:scale-100 rotate-1 transition-all duration-700 ${showLead ? 'opacity-100 translate-x-0' : 'opacity-40 translate-x-4'}`}>
            {/* Green glow behind */}
            <div className={`absolute -inset-6 bg-[#25D366]/10 rounded-[50px] blur-2xl transition-opacity duration-700 ${showLead ? 'opacity-100' : 'opacity-0'}`} />

            <div className="relative w-[220px] md:w-[260px] bg-black rounded-[36px] p-[5px] shadow-xl">
              <div className="bg-[#111b21] rounded-[32px] overflow-hidden">
                {/* Notch */}
                <div className="flex justify-center pt-1.5 bg-[#111b21]">
                  <div className="w-[60px] h-[16px] bg-black rounded-full" />
                </div>

                {/* WhatsApp dark header */}
                <div className="bg-[#1f2c34] px-2 py-1.5 flex items-center gap-1.5">
                  <div className="w-[24px] h-[24px] rounded-full bg-[#25D366]/20 flex items-center justify-center flex-shrink-0">
                    <WhatsAppIcon className="w-3 h-3 text-[#25D366]" />
                  </div>
                  <div>
                    <div className="text-[9px] font-semibold text-[#e9edef]">Lead Express</div>
                    <div className="text-[7px] text-[#8696a0]">online</div>
                  </div>
                </div>

                {/* Chat */}
                <div className="px-2 py-2 space-y-2 bg-[#0b141a] h-[240px] md:h-[280px]">
                  {/* Lead message */}
                  <div className={`transition-all duration-700 ${showLead ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                    <div className="bg-[#202c33] rounded-xl rounded-tl-sm px-3 py-2 max-w-[90%]">
                      <p className="text-[9px] text-[#25D366] font-bold mb-1">🎯 Lead matched to you!</p>
                      <p className="text-[9px] text-[#e9edef] leading-relaxed">
                        📍 Miami, FL 33101{'\n'}
                        🔧 Plumbing — Pipe leak{'\n'}
                        💰 Est: $300-500{'\n'}
                        👤 Client: John Smith
                      </p>
                      <span className="text-[7px] text-[#8696a0] float-right mt-1">09:42 ✓✓</span>
                    </div>
                  </div>

                  {/* User response */}
                  <div className={`flex justify-end transition-all duration-700 delay-300 ${showLead ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                    <div className="bg-[#005c4b] rounded-xl rounded-tr-sm px-3 py-2 max-w-[75%]">
                      <p className="text-[9px] text-[#e9edef]">I'm interested! 🙋‍♂️</p>
                      <span className="text-[7px] text-[#8696a0] float-right mt-1">09:42 ✓✓</span>
                    </div>
                  </div>

                  {/* Connection */}
                  <div className={`transition-all duration-700 delay-500 ${showLead ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                    <div className="bg-[#202c33] rounded-xl rounded-tl-sm px-3 py-2 max-w-[90%]">
                      <p className="text-[9px] text-[#e9edef]">
                        ✅ Connecting you now!{'\n'}
                        📞 (305) 555-0123{'\n'}
                        🕐 Client expecting your call
                      </p>
                      <span className="text-[7px] text-[#8696a0] float-right mt-1">09:43 ✓✓</span>
                    </div>
                  </div>
                </div>

                {/* Home bar */}
                <div className="bg-[#1f2c34] flex justify-center py-1">
                  <div className="w-[60px] h-[3px] bg-white/20 rounded-full" />
                </div>
              </div>
            </div>

            {/* Label */}
            <div className="text-center mt-3">
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-white bg-[#25D366] px-3 py-1 rounded-full">
                ✓ Your WhatsApp
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
