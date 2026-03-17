import { ArrowRight, MessageCircle } from 'lucide-react'
import { useState, useEffect } from 'react'
import { useLang } from '../i18n/LanguageContext'

/**
 * OPTION A — Single phone showing the extraction process:
 * 1. WhatsApp group with noisy messages scrolling
 * 2. AI scans → one message highlights green
 * 3. That message "extracts" into a clean lead card
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
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-[#25D366]/8 rounded-full blur-[120px]" />

      <div className="max-w-7xl mx-auto px-6 relative w-full">
        <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-center">

          {/* Text side */}
          <div className="text-center md:text-start">
            <div className="inline-flex items-center gap-2 bg-[#25D366]/15 text-[#25D366] rounded-full px-4 py-1.5 text-xs font-semibold mb-6">
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

            <div className="flex items-center gap-3 justify-center md:justify-start">
              <div className="flex -space-x-2">
                {['bg-blue-400', 'bg-amber-400', 'bg-emerald-400', 'bg-purple-400'].map((bg, i) => (
                  <div key={i} className={`w-8 h-8 rounded-full ${bg} border-2 border-cream flex items-center justify-center text-[10px] font-bold text-white`}>
                    {['M', 'S', 'D', 'R'][i]}
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-subtle/50">{t.hero.trustedBy}</p>
            </div>
          </div>

          {/* Phone — extraction process — iPhone 17 Pro Max style */}
          <div className="flex flex-col items-center gap-4">

            {/* Filter panel — Apple-style, above phone */}
            <div className="w-full max-w-[340px]">
              <div className="rounded-2xl bg-white/80 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.08),0_0_0_1px_rgba(0,0,0,0.04)] px-4 py-3 flex gap-4">
                {/* Trade */}
                <div className="flex-1">
                  <div className="text-[10px] font-semibold text-black/40 mb-1.5 flex items-center gap-1">
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
                    Trade
                  </div>
                  <div className="flex flex-wrap gap-[5px]">
                    <span className="inline-flex items-center gap-1 px-2.5 py-[4px] rounded-lg text-[10px] font-semibold bg-[#25D366] text-white shadow-sm">
                      🔧 Plumbing
                    </span>
                    <span className="inline-flex items-center gap-1 px-2.5 py-[4px] rounded-lg text-[10px] font-medium bg-black/[0.04] text-black/25">
                      ❄️ HVAC
                    </span>
                    <span className="inline-flex items-center gap-1 px-2.5 py-[4px] rounded-lg text-[10px] font-medium bg-black/[0.04] text-black/25">
                      ⚡ Electric
                    </span>
                  </div>
                </div>
                {/* Divider */}
                <div className="w-px bg-black/[0.06]" />
                {/* Location */}
                <div className="flex-1">
                  <div className="text-[10px] font-semibold text-black/40 mb-1.5 flex items-center gap-1">
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                    Location
                  </div>
                  <div className="flex flex-wrap gap-[5px]">
                    <span className="inline-flex items-center gap-1 px-2.5 py-[4px] rounded-lg text-[10px] font-semibold bg-[#25D366] text-white shadow-sm">
                      📍 Miami
                    </span>
                    <span className="inline-flex items-center gap-1 px-2.5 py-[4px] rounded-lg text-[10px] font-medium bg-black/[0.04] text-black/25">
                      📍 Tampa
                    </span>
                    <span className="inline-flex items-center gap-1 px-2.5 py-[4px] rounded-lg text-[10px] font-medium bg-black/[0.04] text-black/25">
                      📍 Orlando
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* The Phone */}
            <div className="relative">
              <div className="relative z-10">
                {/* Titanium frame */}
                <div
                  className="w-[290px] md:w-[320px] rounded-[52px] p-[3px] shadow-[0_0_0_1px_rgba(0,0,0,0.08),0_25px_80px_rgba(0,0,0,0.25),0_8px_30px_rgba(0,0,0,0.15)]"
                  style={{ background: 'linear-gradient(145deg, #2a2a2e 0%, #1a1a1e 50%, #2a2a2e 100%)' }}
                >
                  {/* Inner bezel — super thin like Pro Max */}
                  <div className="rounded-[50px] p-[2px] bg-black">
                    <div className="rounded-[48px] overflow-hidden bg-white" style={{ aspectRatio: '393/852' }}>

                      {/* Status bar + Dynamic Island */}
                      <div className="relative bg-white pt-[10px] pb-0">
                        {/* Status bar */}
                        <div className="flex justify-between items-center px-7 mb-[6px]">
                          <span className="text-[11px] font-semibold text-black tracking-tight">9:41</span>
                          <div className="flex items-center gap-[5px]">
                            {/* Signal bars */}
                            <svg width="17" height="12" viewBox="0 0 17 12" fill="black">
                              <rect x="0" y="8" width="3" height="4" rx="0.5" fillOpacity="0.3" />
                              <rect x="4.5" y="5.5" width="3" height="6.5" rx="0.5" />
                              <rect x="9" y="3" width="3" height="9" rx="0.5" />
                              <rect x="13.5" y="0" width="3" height="12" rx="0.5" />
                            </svg>
                            {/* WiFi */}
                            <svg width="16" height="12" viewBox="0 0 16 12" fill="black">
                              <path d="M8 9.6a1.2 1.2 0 110 2.4 1.2 1.2 0 010-2.4zM4.5 7.5a5 5 0 017 0" fill="none" stroke="black" strokeWidth="1.3" strokeLinecap="round" />
                              <path d="M2 4.8a8.5 8.5 0 0112 0" fill="none" stroke="black" strokeWidth="1.3" strokeLinecap="round" />
                            </svg>
                            {/* Battery */}
                            <svg width="27" height="12" viewBox="0 0 27 12">
                              <rect x="0.5" y="0.5" width="23" height="11" rx="2.5" stroke="black" strokeOpacity="0.35" fill="none" />
                              <rect x="24.5" y="3.5" width="2" height="5" rx="1" fill="black" fillOpacity="0.3" />
                              <rect x="2" y="2" width="20" height="8" rx="1.5" fill="black" />
                            </svg>
                          </div>
                        </div>
                        {/* Dynamic Island */}
                        <div className="flex justify-center">
                          <div className="w-[120px] h-[34px] bg-black rounded-full" />
                        </div>
                      </div>

                      {/* WhatsApp header */}
                      <div className="bg-[#075E54] px-3 pt-2 pb-2.5">
                        <div className="flex items-center gap-2">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M15 18l-6-6 6-6" /></svg>
                          <div className="w-[34px] h-[34px] rounded-full bg-[#DFE5E7] flex items-center justify-center overflow-hidden flex-shrink-0">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="#a0aeb4">
                              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                              <path d="M18 11c1.66 0 2.99-1.34 2.99-3S19.66 5 18 5c-.32 0-.63.05-.91.14.57.81.91 1.79.91 2.86 0 1.07-.34 2.04-.91 2.86.28.09.59.14.91.14zm0 2c1.11 0 3.45.67 4 2v2h-4v-2c0-.82-.27-1.54-.73-2.15.24-.03.48-.05.73-.05z" transform="translate(-2, 0) scale(0.85)"/>
                            </svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-[13px] font-medium text-white truncate leading-tight">
                              Contractors — Jobs FL 🔧
                            </div>
                            <div className="text-[10px] text-white/70 leading-tight">
                              Dan, Mike, Joe, Alex, Ron, Sam...
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M15.9 14.3H15l-.3-.3c1-1.1 1.6-2.7 1.6-4.3 0-3.7-3-6.7-6.7-6.7S3 6 3 9.7s3 6.7 6.7 6.7c1.6 0 3.2-.6 4.3-1.6l.3.3v.8l5.1 5.1 1.5-1.5-5-5.2zm-6.2 0c-2.6 0-4.6-2.1-4.6-4.6s2.1-4.6 4.6-4.6 4.6 2.1 4.6 4.6-2 4.6-4.6 4.6z"/></svg>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>
                          </div>
                        </div>
                      </div>

                      {/* Messages area */}
                      <div
                        className="px-2.5 py-2 space-y-[3px] flex-1 overflow-hidden relative"
                        style={{
                          backgroundColor: '#ECE5DD',
                          height: 'calc(100% - 160px)',
                          minHeight: '340px',
                          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200' viewBox='0 0 200 200'%3E%3Cg fill='%23c8c0b5' fill-opacity='0.12'%3E%3Cpath d='M20 20h4v4h-4zM60 20h4v4h-4zM100 20h4v4h-4zM140 20h4v4h-4zM180 20h4v4h-4zM40 40h4v4h-4zM80 40h4v4h-4zM120 40h4v4h-4zM160 40h4v4h-4zM20 60h4v4h-4zM60 60h4v4h-4zM100 60h4v4h-4zM140 60h4v4h-4zM180 60h4v4h-4z'/%3E%3C/g%3E%3C/svg%3E")`
                        }}
                      >
                        {/* Unread badge */}
                        <div className="flex justify-center mb-1">
                          <span className="bg-[#BDDAB5] text-[#3B6E32] text-[8px] font-medium px-2.5 py-0.5 rounded-md shadow-sm">
                            47 UNREAD MESSAGES
                          </span>
                        </div>

                        {GROUP_MSGS.slice(0, visibleMsgs).map((msg, i) => {
                          const showName = i === 0 || GROUP_MSGS[i - 1]?.name !== msg.name
                          const isScanning = phase === 'scan' && msg.isLead
                          const isExtracting = phase === 'extract' && msg.isLead

                          return (
                            <div
                              key={i}
                              className={`flex justify-start transition-all duration-500 ${
                                isExtracting ? 'opacity-0 scale-90 -translate-y-2' : ''
                              }`}
                            >
                              <div
                                className={`relative rounded-lg shadow-[0_1px_0.5px_rgba(0,0,0,0.13)] px-2.5 py-1 max-w-[82%] transition-all duration-500 ${
                                  isScanning
                                    ? 'bg-[#25D366]/20 border-2 border-[#25D366] scale-105'
                                    : 'bg-white'
                                }`}
                                style={{ borderTopLeftRadius: showName ? '2px' : '8px' }}
                              >
                                {/* WhatsApp tail */}
                                {showName && (
                                  <div className="absolute -left-[6px] top-0 w-0 h-0"
                                    style={{ borderTop: '0px solid transparent', borderRight: '6px solid white', borderBottom: '8px solid transparent' }}
                                  />
                                )}
                                {showName && (
                                  <div className="text-[9px] font-medium leading-tight" style={{ color: msg.color }}>
                                    ~ {msg.name}
                                  </div>
                                )}
                                <div className="flex items-end gap-1.5">
                                  <span className="text-[11px] text-[#303030] leading-snug">{msg.text}</span>
                                  <span className="text-[7px] text-[#8c8c8c] whitespace-nowrap flex-shrink-0">08:12</span>
                                </div>
                                {/* Scanning indicator */}
                                {isScanning && (
                                  <div className="absolute -right-2 -top-2 w-5 h-5 rounded-full bg-[#25D366] flex items-center justify-center animate-pulse shadow-lg shadow-[#25D366]/40">
                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="white"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>
                                  </div>
                                )}
                              </div>
                            </div>
                          )
                        })}

                        {/* Scanning overlay */}
                        {phase === 'scan' && (
                          <div className="absolute inset-x-0 bottom-4 flex justify-center">
                            <div className="bg-[#25D366] text-white text-[10px] font-bold px-4 py-2 rounded-full shadow-lg animate-pulse flex items-center gap-2">
                              <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M21 12a9 9 0 11-6.219-8.56" /></svg>
                              AI scanning messages...
                            </div>
                          </div>
                        )}

                        <div className="absolute bottom-0 inset-x-0 h-10 bg-gradient-to-t from-[#ECE5DD] to-transparent" />
                      </div>

                      {/* WhatsApp input bar */}
                      <div className="bg-[#F0F0F0] px-2 py-1.5 flex items-center gap-1.5">
                        <div className="flex-1 bg-white rounded-full px-3 py-1.5 flex items-center gap-1.5 shadow-sm">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="#8c8c8c"><circle cx="12" cy="12" r="10" fill="none" stroke="#8c8c8c" strokeWidth="1.5"/><path d="M8 14s1.5 2 4 2 4-2 4-2" fill="none" stroke="#8c8c8c" strokeWidth="1.5" strokeLinecap="round"/><circle cx="9" cy="10" r="1.2"/><circle cx="15" cy="10" r="1.2"/></svg>
                          <span className="text-[10px] text-[#8c8c8c] flex-1">Message</span>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8c8c8c" strokeWidth="1.5" strokeLinecap="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66L9.41 17.4a2 2 0 01-2.83-2.83l8.49-8.48" /></svg>
                        </div>
                        <div className="w-[36px] h-[36px] rounded-full bg-[#00A884] flex items-center justify-center flex-shrink-0">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M12 15c1.66 0 2.99-1.34 2.99-3L15 6c0-1.66-1.34-3-3-3S9 4.34 9 6v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 15 6.7 12H5c0 3.42 2.72 6.23 6 6.72V22h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/></svg>
                        </div>
                      </div>

                      {/* Home indicator */}
                      <div className="bg-white flex justify-center py-[6px]">
                        <div className="w-[120px] h-[5px] bg-black/20 rounded-full" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Extracted lead card — slides out from phone */}
              <div
                className={`absolute -right-12 md:-right-44 top-1/3 z-20 transition-all duration-700 ${
                  phase === 'extract'
                    ? 'opacity-100 translate-x-0 scale-100'
                    : 'opacity-0 -translate-x-12 scale-75'
                }`}
                style={{ transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }}
              >
                <div className="w-[220px] bg-gradient-to-br from-[#111b21] to-[#0d1f17] rounded-2xl border border-[#25D366]/30 shadow-[0_20px_60px_rgba(37,211,102,0.3)] overflow-hidden">
                  <div className="h-[2px] bg-gradient-to-r from-transparent via-[#25D366] to-transparent animate-pulse" />
                  <div className="px-3 pt-2 pb-1.5 flex items-center gap-2 border-b border-[#25D366]/10">
                    <span className="text-sm">🎯</span>
                    <div>
                      <div className="text-[11px] font-bold text-[#25D366]">Lead Found!</div>
                      <div className="text-[8px] text-[#8696a0]">Matched to your profile</div>
                    </div>
                  </div>
                  <div className="px-3 py-1.5 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px]">📍</span>
                      <span className="text-[11px] text-[#e9edef]">Miami, FL 33101</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px]">🔧</span>
                      <span className="text-[11px] text-[#e9edef]">Plumbing — Pipe leak</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px]">💰</span>
                      <span className="text-[11px] text-[#25D366] font-bold">$300–500</span>
                    </div>
                  </div>
                  <div className="px-3 pb-2">
                    <div className="bg-[#25D366] text-white text-center text-[10px] font-bold py-2 rounded-lg">
                      ✅ I'm interested
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
