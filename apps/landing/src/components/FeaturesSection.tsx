import { Check, ArrowRight } from 'lucide-react'
import { useLang } from '../i18n/LanguageContext'

export default function FeaturesSection() {
  const { t, lang } = useLang()

  return (
    <section className="section-padding bg-cream">
      <div className="max-w-7xl mx-auto px-6 space-y-24">
        {/* Feature 1: Chat / No more group chaos */}
        <div className="grid md:grid-cols-2 gap-12 items-center">
          {/* Chat mockup */}
          <div className="card !p-8 bg-cream">
            <div className="space-y-4">
              {/* User message */}
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-200 to-amber-400 flex-shrink-0" />
                <div className="bg-white rounded-2xl rounded-tl-sm px-4 py-3 text-sm max-w-[80%] shadow-sm">
                  {lang === 'he' ? 'היי, אני צריך עזרה עם ליד חדש.' : 'Hi, I need help with a new lead.'}
                </div>
              </div>
              {/* Bot response */}
              <div className="flex items-start gap-3 justify-end">
                <div className="bg-dark text-white rounded-2xl rounded-tr-sm px-4 py-3 text-sm max-w-[80%]">
                  {lang === 'he'
                    ? 'בטח! איזה סוג עבודה? אינסטלציה, חשמל, מיזוג?'
                    : 'Sure! What type of job? Plumbing, electrical, HVAC?'}
                </div>
                <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="white" stroke="none">
                    <path d="M12 2L2 7l10 5 10-5-10-5z" />
                    <path d="M2 17l10 5 10-5" />
                  </svg>
                </div>
              </div>
              {/* User reply */}
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-200 to-amber-400 flex-shrink-0" />
                <div className="bg-white rounded-2xl rounded-tl-sm px-4 py-3 text-sm max-w-[80%] shadow-sm">
                  {lang === 'he' ? 'אינסטלציה באזור מיאמי.' : 'Plumbing in the Miami area.'}
                </div>
              </div>
              {/* Bot response */}
              <div className="flex items-start gap-3 justify-end">
                <div className="bg-dark text-white rounded-2xl rounded-tr-sm px-4 py-3 text-sm max-w-[80%]">
                  {lang === 'he'
                    ? 'מצאתי 5 לידים מתאימים באזור שלך! שולח עכשיו.'
                    : 'Found 5 matching leads in your area! Sending now.'}
                </div>
                <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="white" stroke="none">
                    <path d="M12 2L2 7l10 5 10-5-10-5z" />
                    <path d="M2 17l10 5 10-5" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* Text */}
          <div>
            <h2 className="text-3xl md:text-4xl font-medium mb-5 leading-tight">
              {t.features.section1.title}
            </h2>
            <p className="text-gray-subtle/70 mb-6 leading-relaxed">
              {t.features.section1.desc}
            </p>
            <ul className="space-y-3 mb-8">
              {t.features.section1.bullets.map((b, i) => (
                <li key={i} className="flex items-start gap-3 text-sm">
                  <Check size={18} className="text-primary mt-0.5 flex-shrink-0" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
            <a href="#pricing" className="btn-primary">
              {t.features.section1.cta}
              <ArrowRight size={16} />
            </a>
          </div>
        </div>

        {/* Feature 2 (analytics) hidden — not relevant to current product */}
      </div>
    </section>
  )
}
