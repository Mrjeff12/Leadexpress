import { MapPin, Filter, Zap, BarChart3 } from 'lucide-react'
import { useLang } from '../i18n/LanguageContext'

const icons = [MapPin, Filter, Zap, BarChart3]

export default function FeatureGrid() {
  const { t } = useLang()

  return (
    <section className="py-16">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {t.featureGrid.items.map((item, i) => {
            const Icon = icons[i]
            return (
              <div key={i} className="text-center md:text-start">
                <h4 className="font-bold text-base mb-2">{item.title}</h4>
                <p className="text-gray-subtle/60 text-sm leading-relaxed">{item.desc}</p>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
