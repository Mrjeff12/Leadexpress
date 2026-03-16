import { ArrowRight } from 'lucide-react'
import { useLang } from '../i18n/LanguageContext'

export default function CTASection() {
  const { t, lang } = useLang()

  return (
    <section id="contact" className="section-padding bg-cream-dark">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="text-3xl md:text-5xl font-medium mb-5 leading-tight">
              {t.cta.title}
            </h2>
            <p className="text-gray-subtle/70 mb-8 leading-relaxed">
              {t.cta.desc}
            </p>
            <a href="#pricing" className="btn-primary text-base !px-8 !py-4">
              {t.cta.button}
              <ArrowRight size={18} />
            </a>
          </div>

          {/* Phone mockup with messaging */}
          <div className="flex justify-center">
            <div className="w-[260px] bg-dark rounded-[2.5rem] p-2 shadow-2xl phone-glow">
              <div className="rounded-[2rem] overflow-hidden bg-white aspect-[9/17]">
                {/* Status bar */}
                <div className="flex justify-between items-center px-5 pt-3 text-[10px] text-dark/50">
                  <span>11:20</span>
                  <div className="flex gap-1">
                    <span>📶</span>
                    <span>🔋</span>
                  </div>
                </div>
                {/* Header */}
                <div className="flex items-center gap-2 px-4 py-3 border-b border-dark/5">
                  <div className="w-3 h-3 rounded bg-dark/10" />
                  <span className="text-xs font-semibold">Lead Express</span>
                  <span className="ms-auto text-[10px] text-dark/30">+</span>
                </div>
                {/* Messages */}
                <div className="p-3 space-y-3">
                  <div className="flex items-start gap-2">
                    <div className="w-7 h-7 rounded-full bg-primary/20 flex-shrink-0" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-primary text-[10px]">▶ 0:20</span>
                        <div className="flex-1 h-3 bg-dark/5 rounded-full overflow-hidden">
                          <div className="w-1/3 h-full bg-dark/20 rounded-full" />
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 justify-end">
                    <div className="flex-1 flex justify-end">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-3 bg-primary/10 rounded-full overflow-hidden">
                          <div className="w-2/3 h-full bg-primary/30 rounded-full" />
                        </div>
                        <span className="text-primary text-[10px]">▶ 0:20</span>
                      </div>
                    </div>
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-200 to-amber-400 flex-shrink-0" />
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-7 h-7 rounded-full bg-primary/20 flex-shrink-0" />
                    <div className="bg-cream rounded-xl rounded-tl-sm px-3 py-2 text-[11px] max-w-[80%]">
                      {lang === 'he' ? 'בוא נתקדם!' : 'We should catch up soon!'}
                    </div>
                  </div>
                  <div className="flex items-start gap-2 justify-end">
                    <div className="bg-dark/5 rounded-xl rounded-tr-sm px-3 py-2 text-[11px] max-w-[80%]">
                      {lang === 'he'
                        ? 'בהחלט! תגיד מתי נוח לך ונקבע.'
                        : "Absolutely! Let me know when you're free."}
                    </div>
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-200 to-amber-400 flex-shrink-0" />
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
