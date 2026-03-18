import { ArrowRight } from 'lucide-react'
import { useLang } from '../i18n/LanguageContext'

export default function CTASection() {
  const { t, lang } = useLang()

  return (
    <section id="contact" className="section-padding bg-cream">
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

          {/* Phone mockup — WhatsApp lead notification */}
          <div className="flex justify-center">
            <div className="w-[260px] bg-dark rounded-[2.5rem] p-2 shadow-2xl phone-glow">
              <div className="rounded-[2rem] overflow-hidden bg-[#111b21] aspect-[9/17]">
                {/* Status bar */}
                <div className="flex justify-between items-center px-5 pt-3 text-[10px] text-[#8696a0]">
                  <span>11:20</span>
                  <div className="flex gap-1 text-[8px]">
                    <span>📶</span>
                    <span>🔋</span>
                  </div>
                </div>
                {/* WhatsApp header */}
                <div className="bg-[#1f2c34] flex items-center gap-2 px-3 py-2 mt-1">
                  <div className="w-8 h-8 rounded-full bg-[#25D366]/20 flex items-center justify-center">
                    <svg viewBox="0 0 24 24" fill="#25D366" className="w-4 h-4"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold text-[#e9edef]">Lead Express</div>
                    <div className="text-[9px] text-[#8696a0]">online</div>
                  </div>
                </div>
                {/* Messages */}
                <div className="px-3 py-3 space-y-2 bg-[#0b141a]">
                  <div className="flex justify-start">
                    <div className="bg-[#202c33] rounded-xl rounded-tl-sm px-3 py-2 max-w-[88%]">
                      <p className="text-[10px] text-[#e9edef] leading-relaxed">🔔 New lead in your area!</p>
                      <p className="text-[10px] text-[#e9edef] leading-relaxed mt-1">📍 Dallas, TX 75201{'\n'}🔧 HVAC installation{'\n'}💰 Est: $400-800</p>
                      <span className="text-[8px] text-[#8696a0] float-right mt-1">11:20 ✓✓</span>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <div className="bg-[#005c4b] rounded-xl rounded-tr-sm px-3 py-2 max-w-[75%]">
                      <p className="text-[10px] text-[#e9edef]">I'm interested! Send details</p>
                      <span className="text-[8px] text-[#8696a0] float-right mt-1">11:21 ✓✓</span>
                    </div>
                  </div>
                  <div className="flex justify-start">
                    <div className="bg-[#202c33] rounded-xl rounded-tl-sm px-3 py-2 max-w-[88%]">
                      <p className="text-[10px] text-[#e9edef]">✅ Connecting you now!{'\n'}📞 Client: Maria Lopez{'\n'}🕐 Expecting your call</p>
                      <span className="text-[8px] text-[#8696a0] float-right mt-1">11:21 ✓✓</span>
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
