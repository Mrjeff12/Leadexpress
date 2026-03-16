import { Star } from 'lucide-react'
import { useLang } from '../i18n/LanguageContext'

export default function TestimonialsSection() {
  const { t } = useLang()

  return (
    <section className="section-padding">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-medium mb-4">{t.testimonials.title}</h2>
          <p className="text-gray-subtle/70">{t.testimonials.subtitle}</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {t.testimonials.items.map((item, i) => (
            <div key={i} className="card">
              {/* Stars */}
              <div className="flex items-center gap-1 mb-1">
                {[1,2,3,4,5].map(s => (
                  <Star key={s} size={16} fill="#f59e0b" className="text-amber-400" />
                ))}
                <span className="text-sm font-semibold ms-2">5.0</span>
              </div>

              <p className="text-sm text-gray-subtle/80 my-4 leading-relaxed">
                {item.text}
              </p>

              <div className="flex items-center gap-3 pt-3 border-t border-dark/5">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-sm font-bold text-primary">
                  {item.name.charAt(0)}
                </div>
                <div>
                  <div className="text-sm font-semibold">{item.name}</div>
                  <div className="text-xs text-gray-subtle/50">{item.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
