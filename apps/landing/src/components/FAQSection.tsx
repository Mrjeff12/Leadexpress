import { useState } from 'react'
import { Plus, Minus } from 'lucide-react'
import { useLang } from '../i18n/LanguageContext'

export default function FAQSection() {
  const { t } = useLang()
  const [openIndex, setOpenIndex] = useState<number | null>(0)

  return (
    <section id="faq" className="section-padding">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-medium mb-4">{t.faq.title}</h2>
          <p className="text-gray-subtle/70">{t.faq.subtitle}</p>
        </div>

        <div className="grid md:grid-cols-2 gap-4 max-w-5xl mx-auto">
          {t.faq.items.map((item, i) => (
            <div
              key={i}
              className="rounded-2xl border border-dark/5 bg-white overflow-hidden transition-all"
            >
              <button
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                className="w-full flex items-center justify-between p-5 text-start"
              >
                <span className="font-semibold text-sm pe-4">{item.q}</span>
                {openIndex === i ? (
                  <Minus size={18} className="text-primary flex-shrink-0" />
                ) : (
                  <Plus size={18} className="text-gray-subtle/40 flex-shrink-0" />
                )}
              </button>
              <div className={`faq-answer px-5 pb-5 ${openIndex === i ? 'open' : ''}`}>
                <p className="text-sm text-gray-subtle/70 leading-relaxed">{item.a}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
