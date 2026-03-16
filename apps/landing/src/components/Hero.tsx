import { ArrowRight, Zap, MessageCircle } from 'lucide-react'
import { useLang } from '../i18n/LanguageContext'

const WhatsAppIcon = ({ className = '' }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
)

export default function Hero() {
  const { t, lang } = useLang()

  return (
    <section className="relative pt-28 pb-8 md:pt-36 md:pb-16 overflow-hidden min-h-screen flex items-center bg-cream">
      {/* WhatsApp green glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-[#25D366]/8 rounded-full blur-[120px] hero-glow-pulse" />

      {/* Subtle grid */}
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: 'radial-gradient(circle at 1px 1px, #25D366 1px, transparent 0)',
        backgroundSize: '50px 50px'
      }} />

      <div className="max-w-7xl mx-auto px-6 relative w-full">
        <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-center">

          {/* Text side */}
          <div className="text-center md:text-start hero-text-reveal">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 bg-[#25D366]/15 text-[#25D366] rounded-full px-4 py-1.5 text-xs font-semibold mb-6 hero-badge">
              <WhatsAppIcon className="w-3.5 h-3.5" />
              {t.hero.badge}
            </div>

            {/* Main heading */}
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-medium leading-[1.15] tracking-[-0.04em] mb-6 text-dark hero-title">
              {t.hero.title1}{' '}
              <span className="highlight-box">{t.hero.titleHighlight}</span>
              <br />
              {t.hero.title2}
            </h1>

            {/* Subtitle */}
            <p className="text-base md:text-lg text-gray-subtle/70 max-w-lg mb-8 leading-relaxed hero-subtitle">
              {t.hero.subtitle}
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-center md:items-start gap-4 mb-8 hero-ctas">
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

            {/* Trust */}
            <div className="flex items-center gap-3 justify-center md:justify-start hero-trust">
              <div className="flex -space-x-2 rtl:space-x-reverse">
                {['bg-blue-400', 'bg-amber-400', 'bg-emerald-400', 'bg-purple-400'].map((bg, i) => (
                  <div key={i} className={`w-8 h-8 rounded-full ${bg} border-2 border-cream flex items-center justify-center text-[10px] font-bold text-white`}>
                    {['M', 'S', 'D', 'R'][i]}
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-subtle/50">{t.hero.trustedBy}</p>
            </div>
          </div>

          {/* Phone side — WhatsApp mockup */}
          <div className="flex justify-center hero-phone-reveal">
            <div className="relative">
              {/* Glow ring behind phone */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-[320px] h-[320px] md:w-[420px] md:h-[420px] rounded-full bg-gradient-to-br from-[#25D366]/10 to-transparent border border-[#25D366]/10 hero-ring-spin" />
              </div>

              {/* Floating notification badges */}
              <div className="absolute -top-2 -right-4 md:right-0 z-20 hero-float-badge-1">
                <div className="bg-white rounded-2xl shadow-2xl px-4 py-3 flex items-center gap-3 border border-dark/5">
                  <div className="w-10 h-10 rounded-full bg-[#25D366]/10 flex items-center justify-center">
                    <WhatsAppIcon className="w-5 h-5 text-[#25D366]" />
                  </div>
                  <div>
                    <div className="text-xs font-bold">{lang === 'he' ? 'ליד חדש!' : 'New Lead!'}</div>
                    <div className="text-[10px] text-gray-subtle/50">{lang === 'he' ? 'אינסטלציה • מיאמי, FL' : 'Plumbing • Miami, FL'}</div>
                  </div>
                  <div className="w-2 h-2 rounded-full bg-[#25D366] animate-pulse" />
                </div>
              </div>

              <div className="absolute -bottom-4 -left-4 md:left-0 z-20 hero-float-badge-2">
                <div className="bg-white rounded-2xl shadow-2xl px-4 py-3 flex items-center gap-3 border border-dark/5">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Zap className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <div className="text-xs font-bold">{lang === 'he' ? '3 עבודות נסגרו!' : '3 Jobs Closed!'}</div>
                    <div className="text-[10px] text-gray-subtle/50">{lang === 'he' ? 'השבוע • $1,200' : 'This week • $1,200'}</div>
                  </div>
                </div>
              </div>

              {/* The Phone */}
              <div className="relative z-10 phone-glow">
                <div className="w-[270px] md:w-[300px] bg-dark rounded-[2.5rem] p-2 shadow-2xl shadow-black/50">
                  <div className="rounded-[2rem] overflow-hidden bg-[#111b21] aspect-[9/19.5]">
                    {/* Notch */}
                    <div className="flex justify-center pt-2">
                      <div className="w-28 h-6 bg-black rounded-full" />
                    </div>

                    {/* WhatsApp Header */}
                    <div className="bg-[#1f2c34] px-4 py-2.5 flex items-center gap-3 mt-1">
                      <svg viewBox="0 0 24 24" fill="none" stroke="#aebac1" strokeWidth="2" className="w-5 h-5">
                        <path d="M15 18l-6-6 6-6" />
                      </svg>
                      <div className="w-8 h-8 rounded-full bg-[#25D366]/20 flex items-center justify-center">
                        <WhatsAppIcon className="w-4 h-4 text-[#25D366]" />
                      </div>
                      <div className="flex-1">
                        <div className="text-[11px] font-semibold text-[#e9edef]">Lead Express</div>
                        <div className="text-[9px] text-[#8696a0]">{lang === 'he' ? 'מקוון' : 'online'}</div>
                      </div>
                      <div className="flex gap-3">
                        <svg viewBox="0 0 24 24" fill="none" stroke="#aebac1" strokeWidth="2" className="w-4 h-4"><path d="M22 16.92v3a2 2 0 01-2.18 2A19.79 19.79 0 013.09 5.18 2 2 0 015.11 3h3"/></svg>
                        <svg viewBox="0 0 24 24" fill="none" stroke="#aebac1" strokeWidth="2" className="w-4 h-4"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
                      </div>
                    </div>

                    {/* WhatsApp Chat Background */}
                    <div className="relative px-3 py-3 space-y-2 bg-[#0b141a] flex-1" style={{
                      backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'0.02\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")'
                    }}>
                      {/* System message */}
                      <div className="flex justify-center mb-1">
                        <div className="bg-[#182229] text-[#8696a0] text-[8px] px-3 py-1 rounded-lg">
                          {lang === 'he' ? 'היום' : 'Today'}
                        </div>
                      </div>

                      {/* Bot message 1 */}
                      <div className="flex justify-start wa-msg-1">
                        <div className="bg-[#202c33] rounded-xl rounded-tl-sm px-3 py-2 max-w-[85%] shadow-sm">
                          <p className="text-[10px] text-[#e9edef] leading-relaxed">
                            {lang === 'he'
                              ? '🔔 ליד חדש באזור שלך!'
                              : '🔔 New lead in your area!'}
                          </p>
                          <p className="text-[10px] text-[#e9edef] leading-relaxed mt-1">
                            {lang === 'he'
                              ? '📍 מיאמי, FL 33101\n🔧 תיקון דליפה בצנרת\n💰 הערכה: $300-500'
                              : '📍 Miami, FL 33101\n🔧 Pipe leak repair\n💰 Est: $300-500'}
                          </p>
                          <span className="text-[8px] text-[#8696a0] float-right mt-1">09:42 ✓✓</span>
                        </div>
                      </div>

                      {/* User reply */}
                      <div className="flex justify-end wa-msg-2">
                        <div className="bg-[#005c4b] rounded-xl rounded-tr-sm px-3 py-2 max-w-[75%] shadow-sm">
                          <p className="text-[10px] text-[#e9edef]">
                            {lang === 'he' ? 'אני זמין! שלח לי פרטים' : "I'm available! Send details"}
                          </p>
                          <span className="text-[8px] text-[#8696a0] float-right mt-1">09:42 ✓✓</span>
                        </div>
                      </div>

                      {/* Bot sends contact */}
                      <div className="flex justify-start wa-msg-3">
                        <div className="bg-[#202c33] rounded-xl rounded-tl-sm px-3 py-2 max-w-[85%] shadow-sm">
                          <p className="text-[10px] text-[#e9edef]">
                            {lang === 'he'
                              ? '✅ מעולה! הלקוח: ג\'ון סמית\n📞 (305) 555-0123\n🕐 מחכה לשיחה שלך'
                              : '✅ Great! Client: John Smith\n📞 (305) 555-0123\n🕐 Awaiting your call'}
                          </p>
                          <span className="text-[8px] text-[#8696a0] float-right mt-1">09:43 ✓✓</span>
                        </div>
                      </div>

                      {/* User confirms */}
                      <div className="flex justify-end wa-msg-4">
                        <div className="bg-[#005c4b] rounded-xl rounded-tr-sm px-3 py-2 max-w-[75%] shadow-sm">
                          <p className="text-[10px] text-[#e9edef]">
                            {lang === 'he' ? 'סגרתי את העבודה! 🎉' : 'Job booked! 🎉'}
                          </p>
                          <span className="text-[8px] text-[#8696a0] float-right mt-1">10:15 ✓✓</span>
                        </div>
                      </div>

                      {/* Bot celebrates */}
                      <div className="flex justify-start wa-msg-5">
                        <div className="bg-[#202c33] rounded-xl rounded-tl-sm px-3 py-2 max-w-[85%] shadow-sm">
                          <p className="text-[10px] text-[#e9edef]">
                            {lang === 'he'
                              ? '🏆 כל הכבוד! זו העבודה ה-3 שלך השבוע!'
                              : '🏆 Amazing! That\'s your 3rd job this week!'}
                          </p>
                          <span className="text-[8px] text-[#8696a0] float-right mt-1">10:15 ✓✓</span>
                        </div>
                      </div>
                    </div>

                    {/* WhatsApp Input Bar */}
                    <div className="bg-[#1f2c34] px-3 py-2 flex items-center gap-2">
                      <div className="flex-1 bg-[#2a3942] rounded-full px-3 py-1.5 flex items-center gap-2">
                        <span className="text-[10px]">😊</span>
                        <span className="text-[9px] text-[#8696a0] flex-1">
                          {lang === 'he' ? 'הקלד הודעה' : 'Type a message'}
                        </span>
                        <span className="text-[10px]">📎</span>
                      </div>
                      <div className="w-8 h-8 rounded-full bg-[#25D366] flex items-center justify-center">
                        <svg viewBox="0 0 24 24" fill="white" className="w-4 h-4"><path d="M2 21l21-9L2 3v7l15 2-15 2v7z"/></svg>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 hero-scroll-indicator">
        <div className="w-6 h-10 border-2 border-dark/20 rounded-full flex justify-center pt-2">
          <div className="w-1 h-2 bg-white/40 rounded-full animate-bounce" />
        </div>
      </div>
    </section>
  )
}
