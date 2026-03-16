import { User, BookOpen, Activity } from 'lucide-react'
import { useLang } from '../i18n/LanguageContext'

const icons = [User, BookOpen, Activity]

export default function MarketingSection() {
  const { t, lang } = useLang()

  return (
    <section className="section-padding bg-cream-dark">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-medium mb-4">{t.marketing.title}</h2>
          <p className="text-gray-subtle/70 max-w-xl mx-auto">{t.marketing.subtitle}</p>
        </div>

        <div className="grid md:grid-cols-2 gap-12 items-start">
          {/* Features list */}
          <div className="space-y-8">
            {t.marketing.features.map((feat, i) => {
              const Icon = icons[i]
              return (
                <div key={i} className="flex gap-4">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                    <Icon size={18} className="text-primary" />
                  </div>
                  <div>
                    <h4 className="font-bold text-lg mb-1">{feat.title}</h4>
                    <p className="text-gray-subtle/60 text-sm leading-relaxed">{feat.desc}</p>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Chat UI illustration */}
          <div className="relative">
            <div className="card !p-6 bg-white rotate-2 absolute top-4 right-4 opacity-50 w-full h-full" />
            <div className="card !p-6 bg-white relative">
              <div className="flex items-center justify-between mb-4">
                <span className="font-semibold text-sm">Chat History</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-dark/5 text-gray-subtle/50">GPT-4</span>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 rounded-xl bg-cream border border-dark/5">
                  <div className="w-8 h-8 rounded-full bg-blue-100" />
                  <div className="flex-1">
                    <div className="text-sm font-medium">
                      {lang === 'he' ? 'איך אני יכול לעזור היום?' : 'How can I help you today?'}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 items-center">
                  <span className="text-gray-subtle/30">+</span>
                  <div className="flex-1 py-2 px-3 rounded-full bg-cream border border-dark/5 text-xs text-gray-subtle/40">
                    Search
                  </div>
                  <div className="w-5 h-5 text-gray-subtle/30">🎤</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
