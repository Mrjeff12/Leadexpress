import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import { useLang } from '../i18n/LanguageContext'
import { supabase } from '../lib/supabase'

const DASHBOARD_URL = 'https://app.masterleadflow.com'

const PLAN_SLUGS = ['pro', 'unlimited']

type DbPlan = { slug: string; price_cents: number; name: string }

export default function PricingSection() {
  const { t } = useLang()
  const [dbPlans, setDbPlans] = useState<DbPlan[] | null>(null)

  useEffect(() => {
    if (!supabase) return
    supabase
      .from('plans')
      .select('slug, price_cents, name')
      .eq('is_active', true)
      .order('price_cents')
      .then(({ data }) => {
        if (data) setDbPlans(data)
      })
  }, [])

  function handlePlanClick(index: number) {
    const slug = PLAN_SLUGS[index] || 'free'
    window.location.href = `${DASHBOARD_URL}/login?mode=signup&plan=${slug}`
  }

  return (
    <section id="pricing" className="section-padding bg-cream">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-medium mb-4">{t.pricing.title}</h2>
          <p className="text-gray-subtle/70">{t.pricing.subtitle}</p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-3xl mx-auto">
          {t.pricing.plans.map((plan, i) => {
            const isPopular = (plan as any).popular
            const dbPlan = dbPlans?.find(p => p.slug === PLAN_SLUGS[i])
            const displayPrice = dbPlan
              ? dbPlan.price_cents === 0 ? '$0' : `$${dbPlan.price_cents / 100}`
              : plan.price
            return (
              <div
                key={i}
                className={`rounded-2xl p-6 flex flex-col transition-all duration-300 hover:-translate-y-2 ${
                  isPopular
                    ? 'bg-primary text-white shadow-xl shadow-primary/20 scale-[1.02]'
                    : 'bg-white border border-dark/5'
                }`}
              >
                {isPopular && (
                  <div className="mb-4">
                    <span className="text-[10px] font-semibold bg-white text-primary px-2.5 py-0.5 rounded-full">
                      7-Day Free Trial
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xl font-bold">{plan.name}</h3>
                  {isPopular && (
                    <span className="text-[10px] font-semibold bg-white/20 text-white px-2.5 py-0.5 rounded-full">
                      Popular
                    </span>
                  )}
                </div>
                <p className={`text-sm mb-6 ${isPopular ? 'text-white/70' : 'text-gray-subtle/60'}`}>
                  {plan.desc}
                </p>

                <div className="mb-6">
                  <span className="text-4xl font-bold">{displayPrice}</span>
                  <span className={`text-sm ${isPopular ? 'text-white/60' : 'text-gray-subtle/50'}`}>
                    {plan.period}
                  </span>
                </div>

                <button
                  onClick={() => handlePlanClick(i)}
                  className={`w-full py-3 rounded-full text-sm font-semibold transition-all duration-300 mb-6 cursor-pointer ${
                    isPopular
                      ? 'bg-white text-primary hover:bg-white/90'
                      : 'border border-dark/10 hover:bg-dark hover:text-white'
                  }`}
                >
                  {plan.cta}
                </button>

                <ul className="space-y-3 mt-auto">
                  {plan.features.map((f, j) => (
                    <li key={j} className="flex items-start gap-2.5 text-sm">
                      <Check
                        size={16}
                        className={`mt-0.5 flex-shrink-0 ${isPopular ? 'text-white' : 'text-primary'}`}
                      />
                      <span className={isPopular ? 'text-white/90' : ''}>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
