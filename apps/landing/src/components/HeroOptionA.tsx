import { ArrowRight, MessageCircle } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { useLang } from '../i18n/LanguageContext'

/**
 * OPTION A — Single phone showing the extraction process:
 * 1. WhatsApp group with noisy messages scrolling in one by one
 * 2. AI scans → scan line sweeps, lead message highlights + pulses
 * 3. That message "extracts" into a large lead card with spring animation
 */

const WhatsAppIcon = ({ className = '' }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
)

const GROUP_MSGS = [
  { name: 'Dan', text: 'Anyone free for a job in Miami?', color: '#1f7aec' },
  { name: 'Mike', text: 'Me!!', color: '#e65100' },
  { name: 'Joe', text: 'I\'m free too', color: '#00897b' },
  { name: 'Dan', text: 'Plumbing, pipe leak, 33101', color: '#1f7aec', isLead: true },
  { name: 'Alex', text: 'I can do tomorrow', color: '#6a1b9a' },
  { name: 'Ron', text: 'What\'s the budget?', color: '#c62828' },
  { name: 'Sam', text: 'Already taken?', color: '#2e7d32' },
  { name: 'Mike', text: 'That\'s my area!', color: '#e65100' },
]

export default function HeroOptionA() {
  const { t } = useLang()
  const [phase, setPhase] = useState<'scroll' | 'scan' | 'extract'>('scroll')
  const [visibleMsgs, setVisibleMsgs] = useState(0)

  useEffect(() => {
    const cycle = () => {
      setPhase('scroll')
      setVisibleMsgs(0)

      // Messages appear one by one
      const msgTimers = GROUP_MSGS.map((_, i) =>
        setTimeout(() => setVisibleMsgs(i + 1), (i + 1) * 350)
      )

      // After messages, scan phase
      setTimeout(() => setPhase('scan'), GROUP_MSGS.length * 350 + 500)

      // After scan, extract
      setTimeout(() => setPhase('extract'), GROUP_MSGS.length * 350 + 1800)

      return msgTimers
    }

    const timers = cycle()
    const interval = setInterval(() => {
      cycle()
    }, 10000)

    return () => {
      clearInterval(interval)
      timers.forEach(clearTimeout)
    }
  }, [])

  return (
    <section className="relative pt-28 pb-8 md:pt-36 md:pb-16 overflow-hidden min-h-screen flex items-center bg-cream">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-[#fe5b25]/8 rounded-full blur-[120px]" />

      <div className="max-w-7xl mx-auto px-6 relative w-full">
        <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-center">

          {/* Text side */}
          <div className="text-center md:text-start">
            <div className="inline-flex items-center gap-2 bg-[#fe5b25]/15 text-[#fe5b25] rounded-full px-4 py-1.5 text-xs font-semibold mb-6">
              <WhatsAppIcon className="w-3.5 h-3.5" />
              {t.hero.badge}
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-medium leading-[1.15] tracking-[-0.04em] mb-6 text-dark">
              {t.hero.title1}{' '}
              <span className="highlight-box">{t.hero.titleHighlight}</span>
              <br />
              {t.hero.title2}
            </h1>

            <p className="text-base md:text-lg text-gray-subtle/70 max-w-lg mb-8 leading-relaxed">
              {t.hero.subtitle}
            </p>

            <div className="flex flex-col sm:flex-row items-center md:items-start gap-4 mb-8">
              <a href="#pricing" className="group inline-flex items-center justify-center gap-2 rounded-full bg-[#fe5b25] text-white px-8 py-4 text-base font-semibold transition-all duration-300 hover:bg-[#e04d1c] hover:scale-105 hover:shadow-lg hover:shadow-[#fe5b25]/25 active:scale-95">
                <WhatsAppIcon className="w-5 h-5" />
                {t.hero.cta1}
                <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
              </a>
              <a href="#features" className="inline-flex items-center justify-center gap-2 rounded-full border border-dark/20 text-dark/70 px-8 py-4 text-base font-semibold transition-all duration-300 hover:border-dark/40 hover:text-dark hover:scale-105 active:scale-95">
                <MessageCircle size={16} />
                {t.hero.cta2}
              </a>
            </div>

            <div className="flex items-center gap-3 justify-center md:justify-start">
              <div className="flex -space-x-2">
                {['bg-blue-400', 'bg-amber-400', 'bg-orange-400', 'bg-purple-400'].map((bg, i) => (
                  <div key={i} className={`w-8 h-8 rounded-full ${bg} border-2 border-cream flex items-center justify-center text-[10px] font-bold text-white`}>
                    {['M', 'S', 'D', 'R'][i]}
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-subtle/50">{t.hero.trustedBy}</p>
            </div>
          </div>

          {/* Phone — extraction process */}
          <div className="flex flex-col items-center">

            {/* The Phone */}
            <div className="relative">
              <div className="relative z-10">
                {/* Titanium frame */}
                <div
                  className="w-[260px] md:w-[280px] rounded-[44px] p-[3px] shadow-[0_0_0_1px_rgba(0,0,0,0.08),0_20px_60px_rgba(0,0,0,0.2),0_8px_24px_rgba(0,0,0,0.12)]"
                  style={{ background: 'linear-gradient(145deg, #2a2a2e 0%, #1a1a1e 50%, #2a2a2e 100%)' }}
                >
                  {/* Inner bezel */}
                  <div className="rounded-[42px] p-[2px] bg-black">
                    <div className="rounded-[40px] overflow-hidden bg-white flex flex-col" style={{ aspectRatio: '393/852' }}>

                      {/* Status bar + Dynamic Island */}
                      <div className="relative bg-white pt-2 pb-0 flex-shrink-0">
                        <div className="flex justify-between items-center px-6 mb-1">
                          <span className="text-[10px] font-semibold text-black tracking-tight">9:41</span>
                          <div className="flex items-center gap-1">
                            <svg width="14" height="10" viewBox="0 0 17 12" fill="black">
                              <rect x="0" y="8" width="3" height="4" rx="0.5" fillOpacity="0.3" />
                              <rect x="4.5" y="5.5" width="3" height="6.5" rx="0.5" />
                              <rect x="9" y="3" width="3" height="9" rx="0.5" />
                              <rect x="13.5" y="0" width="3" height="12" rx="0.5" />
                            </svg>
                            <svg width="13" height="10" viewBox="0 0 16 12" fill="black">
                              <path d="M8 9.6a1.2 1.2 0 110 2.4 1.2 1.2 0 010-2.4zM4.5 7.5a5 5 0 017 0" fill="none" stroke="black" strokeWidth="1.3" strokeLinecap="round" />
                              <path d="M2 4.8a8.5 8.5 0 0112 0" fill="none" stroke="black" strokeWidth="1.3" strokeLinecap="round" />
                            </svg>
                            <svg width="22" height="10" viewBox="0 0 27 12">
                              <rect x="0.5" y="0.5" width="23" height="11" rx="2.5" stroke="black" strokeOpacity="0.35" fill="none" />
                              <rect x="24.5" y="3.5" width="2" height="5" rx="1" fill="black" fillOpacity="0.3" />
                              <rect x="2" y="2" width="20" height="8" rx="1.5" fill="black" />
                            </svg>
                          </div>
                        </div>
                        <div className="flex justify-center">
                          <div className="w-[100px] h-[28px] bg-black rounded-full" />
                        </div>
                      </div>

                      {/* WhatsApp header */}
                      <div className="bg-[#075E54] px-2.5 pt-1.5 pb-2 flex-shrink-0">
                        <div className="flex items-center gap-1.5">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M15 18l-6-6 6-6" /></svg>
                          <div className="w-[28px] h-[28px] rounded-full bg-[#DFE5E7] flex items-center justify-center overflow-hidden flex-shrink-0">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="#a0aeb4">
                              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                            </svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-[11px] font-medium text-white truncate leading-tight">
                              Contractors — Jobs FL 🔧
                            </div>
                            <div className="text-[8px] text-white/70 leading-tight">
                              Dan, Mike, Joe, Alex, Ron, Sam...
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M15.9 14.3H15l-.3-.3c1-1.1 1.6-2.7 1.6-4.3 0-3.7-3-6.7-6.7-6.7S3 6 3 9.7s3 6.7 6.7 6.7c1.6 0 3.2-.6 4.3-1.6l.3.3v.8l5.1 5.1 1.5-1.5-5-5.2zm-6.2 0c-2.6 0-4.6-2.1-4.6-4.6s2.1-4.6 4.6-4.6 4.6 2.1 4.6 4.6-2 4.6-4.6 4.6z"/></svg>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>
                          </div>
                        </div>
                      </div>

                      {/* Messages area — fixed size, only content animates */}
                      <div
                        className="px-2 py-1.5 space-y-[2px] flex-1 min-h-0 overflow-hidden relative"
                        style={{
                          backgroundColor: '#ECE5DD',
                          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200' viewBox='0 0 200 200'%3E%3Cg fill='%23c8c0b5' fill-opacity='0.12'%3E%3Cpath d='M20 20h4v4h-4zM60 20h4v4h-4zM100 20h4v4h-4zM140 20h4v4h-4zM180 20h4v4h-4zM40 40h4v4h-4zM80 40h4v4h-4zM120 40h4v4h-4zM160 40h4v4h-4zM20 60h4v4h-4zM60 60h4v4h-4zM100 60h4v4h-4zM140 60h4v4h-4zM180 60h4v4h-4z'/%3E%3C/g%3E%3C/svg%3E")`
                        }}
                      >
                        {/* Unread badge */}
                        <div className="flex justify-center mb-0.5">
                          <span className="bg-[#BDDAB5] text-[#3B6E32] text-[7px] font-medium px-2 py-0.5 rounded-md shadow-sm">
                            47 UNREAD MESSAGES
                          </span>
                        </div>

                        {GROUP_MSGS.slice(0, visibleMsgs).map((msg, i) => {
                          const showName = i === 0 || GROUP_MSGS[i - 1]?.name !== msg.name
                          const isScanning = phase === 'scan' && msg.isLead
                          const isExtracting = phase === 'extract' && msg.isLead
                          const justAppeared = i === visibleMsgs - 1

                          return (
                            <div
                              key={i}
                              className="flex justify-start"
                              style={{
                                animation: justAppeared ? 'msgSlideIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)' : undefined,
                                opacity: isExtracting ? 0 : 1,
                                transform: isExtracting ? 'scale(0.85) translateY(-8px)' : 'none',
                                transition: isExtracting ? 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1)' : 'none',
                              }}
                            >
                              <div
                                className="relative rounded-md shadow-[0_1px_0.5px_rgba(0,0,0,0.13)] px-2 py-0.5 max-w-[82%]"
                                style={{
                                  borderTopLeftRadius: showName ? '2px' : '6px',
                                  background: isScanning
                                    ? 'linear-gradient(135deg, rgba(254,91,37,0.15), rgba(254,91,37,0.25))'
                                    : 'white',
                                  border: isScanning ? '1.5px solid #fe5b25' : '1px solid transparent',
                                  transform: isScanning ? 'scale(1.06)' : 'scale(1)',
                                  boxShadow: isScanning ? '0 4px 20px rgba(254,91,37,0.3), 0 0 0 2px rgba(254,91,37,0.1)' : '0 1px 0.5px rgba(0,0,0,0.13)',
                                  transition: 'all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
                                }}
                              >
                                {showName && (
                                  <div className="absolute -left-[5px] top-0 w-0 h-0"
                                    style={{ borderTop: '0px solid transparent', borderRight: '5px solid white', borderBottom: '6px solid transparent' }}
                                  />
                                )}
                                {showName && (
                                  <div className="text-[8px] font-medium leading-tight" style={{ color: msg.color }}>
                                    ~ {msg.name}
                                  </div>
                                )}
                                <div className="flex items-end gap-1">
                                  <span className="text-[9px] text-[#303030] leading-snug">{msg.text}</span>
                                  <span className="text-[6px] text-[#8c8c8c] whitespace-nowrap flex-shrink-0">08:12</span>
                                </div>
                                {isScanning && (
                                  <div
                                    className="absolute -right-2 -top-2 w-5 h-5 rounded-full bg-gradient-to-br from-[#fe5b25] to-[#e04d1c] flex items-center justify-center shadow-lg"
                                    style={{ animation: 'pulseGlow 1s ease-in-out infinite', boxShadow: '0 0 12px rgba(254,91,37,0.6)' }}
                                  >
                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="white"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>
                                  </div>
                                )}
                              </div>
                            </div>
                          )
                        })}

                        {/* Scan line that sweeps down */}
                        {phase === 'scan' && (
                          <>
                            <div
                              className="absolute inset-x-0 h-[2px] pointer-events-none"
                              style={{
                                background: 'linear-gradient(90deg, transparent 0%, #fe5b25 30%, #fe5b25 70%, transparent 100%)',
                                boxShadow: '0 0 12px 3px rgba(254,91,37,0.4)',
                                animation: 'scanSweep 1.2s ease-in-out infinite',
                              }}
                            />
                            <div className="absolute inset-x-0 bottom-3 flex justify-center">
                              <div
                                className="bg-gradient-to-r from-[#fe5b25] to-[#e04d1c] text-white text-[8px] font-bold px-3.5 py-1.5 rounded-full flex items-center gap-1.5"
                                style={{ boxShadow: '0 4px 16px rgba(254,91,37,0.4)', animation: 'pulseGlow 1.5s ease-in-out infinite' }}
                              >
                                <svg className="w-2.5 h-2.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M21 12a9 9 0 11-6.219-8.56" /></svg>
                                AI scanning messages...
                              </div>
                            </div>
                          </>
                        )}

                        {/* CSS animations */}
                        <style>{`
                          @keyframes msgSlideIn {
                            from { opacity: 0; transform: translateY(12px) scale(0.9); }
                            to { opacity: 1; transform: translateY(0) scale(1); }
                          }
                          @keyframes scanSweep {
                            0% { top: 10%; opacity: 0; }
                            20% { opacity: 1; }
                            80% { opacity: 1; }
                            100% { top: 85%; opacity: 0; }
                          }
                          @keyframes pulseGlow {
                            0%, 100% { transform: scale(1); box-shadow: 0 0 12px rgba(254,91,37,0.4); }
                            50% { transform: scale(1.05); box-shadow: 0 0 20px rgba(254,91,37,0.6); }
                          }
                        `}</style>

                        <div className="absolute bottom-0 inset-x-0 h-10 bg-gradient-to-t from-[#ECE5DD] to-transparent" />
                      </div>

                      {/* WhatsApp input bar */}
                      <div className="bg-[#F0F0F0] px-1.5 py-1 flex items-center gap-1 flex-shrink-0">
                        <div className="flex-1 bg-white rounded-full px-2.5 py-1 flex items-center gap-1 shadow-sm">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="#8c8c8c"><circle cx="12" cy="12" r="10" fill="none" stroke="#8c8c8c" strokeWidth="1.5"/><path d="M8 14s1.5 2 4 2 4-2 4-2" fill="none" stroke="#8c8c8c" strokeWidth="1.5" strokeLinecap="round"/><circle cx="9" cy="10" r="1.2"/><circle cx="15" cy="10" r="1.2"/></svg>
                          <span className="text-[8px] text-[#8c8c8c] flex-1">Message</span>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8c8c8c" strokeWidth="1.5" strokeLinecap="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66L9.41 17.4a2 2 0 01-2.83-2.83l8.49-8.48" /></svg>
                        </div>
                        <div className="w-[28px] h-[28px] rounded-full bg-[#00A884] flex items-center justify-center flex-shrink-0">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M12 15c1.66 0 2.99-1.34 2.99-3L15 6c0-1.66-1.34-3-3-3S9 4.34 9 6v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 15 6.7 12H5c0 3.42 2.72 6.23 6 6.72V22h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/></svg>
                        </div>
                      </div>

                      {/* Home indicator */}
                      <div className="bg-white flex justify-center py-1 flex-shrink-0">
                        <div className="w-[90px] h-[4px] bg-black/20 rounded-full" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Extracted lead card — dramatic entrance from phone */}
              <div
                className={`absolute -right-4 md:-right-32 top-[28%] z-20 transition-all ${
                  phase === 'extract'
                    ? 'opacity-100 translate-x-0 scale-100 duration-[800ms]'
                    : 'opacity-0 -translate-x-12 scale-[0.6] duration-500'
                }`}
                style={{ transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }}
              >
                <div
                  className="w-[220px] bg-gradient-to-br from-[#0d1117] to-[#1a0f0a] rounded-2xl border border-[#fe5b25]/20 overflow-hidden"
                  style={{
                    boxShadow: phase === 'extract'
                      ? '0 20px 60px rgba(254,91,37,0.35), 0 0 0 1px rgba(254,91,37,0.1), 0 0 40px rgba(254,91,37,0.15)'
                      : 'none',
                  }}
                >
                  {/* Animated top bar */}
                  <div
                    className="h-[3px]"
                    style={{
                      background: 'linear-gradient(90deg, transparent, #fe5b25, #ff8a5c, #fe5b25, transparent)',
                      backgroundSize: '200% 100%',
                      animation: phase === 'extract' ? 'shimmer 2s linear infinite' : 'none',
                    }}
                  />

                  {/* Header */}
                  <div className="px-3 pt-2.5 pb-2 flex items-center gap-2 border-b border-[#fe5b25]/10">
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#fe5b25] to-[#e04d1c] flex items-center justify-center">
                      <span className="text-[11px]">🎯</span>
                    </div>
                    <div>
                      <div className="text-[11px] font-bold text-[#fe5b25]">Lead Found!</div>
                      <div className="text-[8px] text-[#8696a0]">Matched to your profile</div>
                    </div>
                  </div>

                  {/* Details */}
                  <div className="px-3 py-2.5 space-y-2">
                    {[
                      { icon: '📍', label: 'Miami, FL 33101', color: '#e9edef' },
                      { icon: '🔧', label: 'Plumbing — Pipe leak', color: '#e9edef' },
                      { icon: '💰', label: '$300–500', color: '#fe5b25' },
                    ].map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-2"
                        style={{
                          animation: phase === 'extract' ? `msgSlideIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) ${0.3 + idx * 0.12}s both` : 'none',
                        }}
                      >
                        <span className="text-[10px]">{item.icon}</span>
                        <span className="text-[10px] font-medium" style={{ color: item.color }}>{item.label}</span>
                      </div>
                    ))}
                  </div>

                  {/* CTA */}
                  <div className="px-3 pb-3">
                    <div
                      className="bg-gradient-to-r from-[#fe5b25] to-[#e04d1c] text-white text-center text-[9px] font-bold py-2 rounded-lg"
                      style={{
                        boxShadow: '0 4px 12px rgba(254,91,37,0.3)',
                        animation: phase === 'extract' ? 'pulseGlow 2s ease-in-out infinite 0.8s' : 'none',
                      }}
                    >
                      ✅ I'm interested
                    </div>
                  </div>
                </div>

                <style>{`
                  @keyframes shimmer {
                    0% { background-position: -200% 0; }
                    100% { background-position: 200% 0; }
                  }
                `}</style>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
