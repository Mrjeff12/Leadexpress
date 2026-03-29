import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { useLang } from '../i18n/LanguageContext'

export default function FAQSection() {
  const { t } = useLang()
  const [openIndex, setOpenIndex] = useState<number | null>(0)

  return (
    <section id="faq" className="py-20 md:py-28">
      <div className="max-w-3xl mx-auto px-6">
        {/* Header */}
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 rounded-full bg-[#fe5b25]/8 border border-[#fe5b25]/15 px-4 py-1.5 mb-5">
            <span className="text-xs font-bold tracking-wide text-[#fe5b25] uppercase">FAQ</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-zinc-900 mb-3">{t.faq.title}</h2>
          <p className="text-base text-stone-500">{t.faq.subtitle}</p>
        </div>

        {/* Accordion */}
        <div className="space-y-3">
          {t.faq.items.map((item, i) => {
            const isOpen = openIndex === i
            return (
              <div
                key={i}
                className={`
                  rounded-xl border transition-all duration-300
                  ${isOpen
                    ? 'border-[#fe5b25]/20 bg-white shadow-sm shadow-[#fe5b25]/5'
                    : 'border-stone-200/60 bg-white/60 hover:border-stone-300/80 hover:bg-white'
                  }
                `}
              >
                <button
                  onClick={() => setOpenIndex(isOpen ? null : i)}
                  className="w-full flex items-center justify-between gap-4 px-5 py-4 text-start cursor-pointer"
                >
                  <span className={`font-semibold text-[15px] leading-snug transition-colors ${isOpen ? 'text-zinc-900' : 'text-zinc-700'}`}>
                    {item.q}
                  </span>
                  <div className={`
                    w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-all duration-300
                    ${isOpen
                      ? 'bg-[#fe5b25] rotate-180'
                      : 'bg-stone-100'
                    }
                  `}>
                    <ChevronDown className={`w-4 h-4 ${isOpen ? 'text-white' : 'text-stone-400'}`} />
                  </div>
                </button>

                <div
                  className="overflow-hidden transition-all duration-300"
                  style={{
                    maxHeight: isOpen ? '300px' : '0px',
                    opacity: isOpen ? 1 : 0,
                  }}
                >
                  <div className="px-5 pb-5">
                    <div className="h-px bg-stone-100 mb-4" />
                    <p className="text-sm text-stone-500 leading-relaxed">{item.a}</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
