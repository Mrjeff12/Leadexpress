import { MapPin, Filter, Bell } from 'lucide-react'
import { useLang } from '../i18n/LanguageContext'

const icons = [MapPin, Filter, Bell]
const iconColors = ['bg-primary/10 text-primary', 'bg-blue-100 text-blue-600', 'bg-amber-100 text-amber-600']

export default function WorkflowSection() {
  const { t, lang } = useLang()

  return (
    <section id="features" className="section-padding">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-medium mb-4">{t.workflow.title}</h2>
          <p className="text-gray-subtle/70 max-w-xl mx-auto">{t.workflow.subtitle}</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {t.workflow.cards.map((card, i) => {
            const Icon = icons[i]
            return (
              <div key={i} className="card group">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-5 ${iconColors[i]} transition-transform group-hover:scale-110`}>
                  <Icon size={22} />
                </div>
                <h3 className="text-xl font-bold mb-3">{card.title}</h3>
                <p className="text-gray-subtle/70 text-sm leading-relaxed">{card.desc}</p>

                {/* Mini illustration */}
                <div className="mt-6 rounded-xl bg-cream-dark p-4 border border-dark/5">
                  {i === 0 && (
                    <div className="space-y-2">
                      <div className="text-xs text-gray-subtle/50 mb-2">{lang === 'he' ? 'בחר את האזור שלך:' : 'Choose your area:'}</div>
                      {[
                        { label: lang === 'he' ? 'מדינה' : 'County', value: lang === 'he' ? 'פלורידה' : 'Miami-Dade' },
                        { label: lang === 'he' ? 'עיר' : 'City', value: lang === 'he' ? 'מיאמי' : 'Miami' },
                        { label: lang === 'he' ? 'מיקוד' : 'Zip Code', value: '33101' },
                      ].map((item, j) => (
                        <div key={j} className="flex items-center justify-between py-1.5 border-b border-dark/5 last:border-0">
                          <span className="text-[11px] text-gray-subtle/50">{item.label}</span>
                          <span className="text-sm font-medium">{item.value}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {i === 1 && (
                    <div className="space-y-2">
                      {(lang === 'he'
                        ? ['תיקון מזגנים', 'אינסטלציה', 'חשמל']
                        : ['HVAC Repair', 'Plumbing', 'Electrical']
                      ).map((item, j) => (
                        <div key={j} className="flex items-center justify-between py-2 border-b border-dark/5 last:border-0">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded bg-primary/10 flex items-center justify-center">
                              <Filter size={12} className="text-primary" />
                            </div>
                            <span className="text-sm">{item}</span>
                          </div>
                          <span className="text-primary">→</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {i === 2 && (
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <div className="w-5 h-5 rounded-full bg-primary/30 flex items-center justify-center">
                          <div className="w-2 h-2 rounded-full bg-primary" />
                        </div>
                      </div>
                      <div>
                        <div className="text-sm font-medium">{lang === 'he' ? 'מנתח לידים...' : 'Analyzing leads...'}</div>
                        <div className="text-xs text-gray-subtle/50 mt-1">{lang === 'he' ? '3 התאמות חדשות נמצאו' : '3 new matches found'}</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
