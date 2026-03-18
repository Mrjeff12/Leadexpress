import { MapPin, Filter, Bell, ArrowRight } from 'lucide-react'
import { useLang } from '../i18n/LanguageContext'

const steps = [
  { icon: MapPin, color: '#fe5b25', bg: 'from-[#fe5b25]/10 to-[#fe5b25]/5' },
  { icon: Filter, color: '#3b82f6', bg: 'from-blue-500/10 to-blue-500/5' },
  { icon: Bell, color: '#f59e0b', bg: 'from-amber-500/10 to-amber-500/5' },
]

export default function WorkflowSection() {
  const { t, lang } = useLang()

  return (
    <section id="features" className="py-16 md:py-24 bg-white">
      <div className="max-w-5xl mx-auto px-6">
        {/* Header */}
        <div className="text-center mb-12 md:mb-16">
          <p className="text-[#fe5b25] text-[11px] font-semibold tracking-widest uppercase mb-3">
            {lang === 'he' ? 'איך זה עובד' : 'How It Works'}
          </p>
          <h2 className="text-2xl md:text-4xl font-medium text-dark mb-3">{t.workflow.title}</h2>
          <p className="text-dark/40 max-w-md mx-auto text-sm">{t.workflow.subtitle}</p>
        </div>

        {/* Steps — horizontal on desktop, vertical on mobile */}
        <div className="relative">
          {/* Connecting line — desktop */}
          <div className="hidden md:block absolute top-10 left-[16%] right-[16%] h-[2px] bg-gradient-to-r from-[#fe5b25]/20 via-blue-500/20 to-amber-500/20" />

          <div className="grid md:grid-cols-3 gap-8 md:gap-6">
            {t.workflow.cards.map((card, i) => {
              const step = steps[i]
              const Icon = step.icon
              return (
                <div key={i} className="relative flex flex-col items-center text-center group">
                  {/* Step number + icon */}
                  <div className="relative mb-5">
                    <div
                      className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${step.bg} flex items-center justify-center transition-transform duration-300 group-hover:scale-105 group-hover:shadow-lg`}
                      style={{ boxShadow: `0 8px 30px ${step.color}15` }}
                    >
                      <Icon size={28} style={{ color: step.color }} strokeWidth={1.8} />
                    </div>
                    {/* Step badge */}
                    <div
                      className="absolute -top-2 -right-2 w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-md"
                      style={{ backgroundColor: step.color }}
                    >
                      {i + 1}
                    </div>
                  </div>

                  {/* Arrow between steps — mobile only */}
                  {i < 2 && (
                    <div className="md:hidden flex justify-center -mt-2 mb-3">
                      <ArrowRight size={16} className="text-dark/15 rotate-90" />
                    </div>
                  )}

                  {/* Text */}
                  <h3 className="text-lg font-semibold text-dark mb-2">{card.title}</h3>
                  <p className="text-dark/40 text-sm leading-relaxed max-w-[260px]">{card.desc}</p>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}
