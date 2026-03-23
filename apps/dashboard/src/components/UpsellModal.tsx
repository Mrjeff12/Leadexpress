import { useState, useEffect } from 'react'
import { Check, Star, Crown, Zap, ArrowRight, X, Sparkles } from 'lucide-react'
import { useI18n } from '../lib/i18n'
import { supabase } from '../lib/supabase'

interface Plan {
  slug: string
  name: string
  price_cents: number
  max_professions: number
  max_zip_codes: number
}

interface UpsellModalProps {
  isOpen: boolean
  onClose: () => void
  currentPlan?: string // 'starter' | 'pro' | 'unlimited'
  context?: 'zones' | 'professions' | 'subs' | 'general'
  currentUsage?: { professions: number; zips: number }
}

const PLAN_FEATURES: Record<string, { en: string[]; he: string[] }> = {
  premium: {
    en: ['Unlimited professions', 'Unlimited service areas', 'AI-matched leads', 'WhatsApp notifications', 'Priority lead delivery', 'Sub contractor management'],
    he: ['מקצועות ללא הגבלה', 'אזורים ללא הגבלה', 'לידים מותאמים ע"י AI', 'התראות WhatsApp', 'משלוח עדיפות', 'ניהול קבלני משנה'],
  },
  pro: {
    en: ['Up to 3 professions', 'Up to 8 zip codes', 'Priority support', 'Morning digest', 'Advanced analytics'],
    he: ['עד 3 מקצועות', 'עד 8 אזורים', 'תמיכה מועדפת', 'דיווח בוקר', 'אנליטיקה מתקדמת'],
  },
  unlimited: {
    en: ['Unlimited professions', 'Unlimited zip codes', 'Sub contractor management', 'VIP support', 'AI suggestions', 'Priority delivery', 'Dedicated account manager'],
    he: ['מקצועות ללא הגבלה', 'אזורים ללא הגבלה', 'ניהול קבלני משנה', 'תמיכת VIP', 'הצעות AI', 'משלוח עדיפות', 'מנהל חשבון ייעודי'],
  },
}

const PLAN_ICONS: Record<string, typeof Zap> = {
  free: Zap,
  starter: Zap,
  premium: Crown,
  pro: Star,
  unlimited: Crown,
}

const CONTEXT_HEADLINES: Record<string, { en: string; he: string }> = {
  zones: { en: 'You need more service areas', he: 'אתה צריך עוד אזורי שירות' },
  professions: { en: 'You need more trades', he: 'אתה צריך עוד מקצועות' },
  subs: { en: 'Manage your sub contractors', he: 'נהל את קבלני המשנה שלך' },
  general: { en: 'Unlock more features', he: 'פתח עוד תכונות' },
}

function getNextPlan(current: string): string {
  if (current === 'free') return 'premium'
  if (current === 'starter') return 'pro'
  return 'premium'
}

export default function UpsellModal({ isOpen, onClose, currentPlan = 'starter', context = 'general', currentUsage }: UpsellModalProps) {
  const { locale } = useI18n()
  const he = locale === 'he'
  const [nextPlanData, setNextPlanData] = useState<Plan | null>(null)

  const nextSlug = getNextPlan(currentPlan)
  const NextIcon = PLAN_ICONS[nextSlug] || Star
  const features = PLAN_FEATURES[nextSlug]
  const headline = CONTEXT_HEADLINES[context] || CONTEXT_HEADLINES.general

  useEffect(() => {
    if (!isOpen) return
    supabase
      .from('plans')
      .select('slug, name, price_cents, max_professions, max_zip_codes')
      .eq('slug', nextSlug)
      .single()
      .then(({ data }) => {
        if (data) setNextPlanData(data as Plan)
      })
  }, [isOpen, nextSlug])

  if (!isOpen) return null

  const price = nextPlanData ? Math.round(nextPlanData.price_cents / 100) : (nextSlug === 'pro' ? 249 : 399)
  const isUnlimited = nextSlug === 'unlimited'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="w-full max-w-md animate-scale-in" onClick={(e) => e.stopPropagation()}>

        {/* Close button */}
        <div className="flex justify-end mb-2">
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/10 backdrop-blur flex items-center justify-center text-white/70 hover:text-white hover:bg-white/20 transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Plan card */}
        <div className={`rounded-3xl overflow-hidden shadow-2xl ${isUnlimited ? 'bg-gradient-to-br from-zinc-800 to-zinc-950' : 'bg-gradient-to-br from-[#fe5b25] to-[#c43d10]'}`}>

          {/* Header */}
          <div className="px-6 pt-6 pb-4">
            {/* Context headline */}
            <p className="text-white/60 text-xs font-bold uppercase tracking-wider mb-3">
              {he ? headline.he : headline.en}
            </p>

            {/* Current usage bar */}
            {currentUsage && context !== 'general' && (
              <div className="mb-4 p-3 rounded-xl bg-white/10 backdrop-blur">
                <div className="flex items-center justify-between text-xs text-white/80 mb-1.5">
                  <span>{he ? 'המסלול הנוכחי שלך' : 'Your current plan'}</span>
                  <span className="font-bold text-white">{currentPlan === 'starter' ? 'Starter' : 'Pro'}</span>
                </div>
                {context === 'zones' && (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 rounded-full bg-white/20 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-white"
                        style={{ width: '100%' }}
                      />
                    </div>
                    <span className="text-[10px] font-bold text-red-300">
                      {he ? 'מלא' : 'FULL'}
                    </span>
                  </div>
                )}
                {context === 'professions' && (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 rounded-full bg-white/20 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-white"
                        style={{ width: '100%' }}
                      />
                    </div>
                    <span className="text-[10px] font-bold text-red-300">
                      {he ? 'מלא' : 'FULL'}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Plan badge */}
            <div className="flex items-center gap-3 mb-2">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isUnlimited ? 'bg-white/10' : 'bg-white/20'}`}>
                <NextIcon className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-2xl font-extrabold text-white">
                    {nextPlanData?.name || (isUnlimited ? 'Unlimited' : 'Pro')}
                  </h2>
                  {!isUnlimited && (
                    <span className="px-2 py-0.5 rounded-full bg-white/20 text-[10px] font-bold text-white uppercase">
                      {he ? 'הכי פופולרי' : 'Most Popular'}
                    </span>
                  )}
                </div>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="text-3xl font-black text-white">${price}</span>
                  <span className="text-sm text-white/60 font-medium">{he ? '/חודש' : '/mo'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Features */}
          <div className="px-6 pb-4">
            <div className="space-y-2">
              {features && (he ? features.he : features.en).map((feat, i) => (
                <div key={i} className="flex items-center gap-2.5">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${isUnlimited ? 'bg-white/15' : 'bg-white/25'}`}>
                    <Check className="w-3 h-3 text-white" strokeWidth={3} />
                  </div>
                  <span className="text-sm text-white/90 font-medium">{feat}</span>
                </div>
              ))}
            </div>
          </div>

          {/* CTA */}
          <div className="px-6 pb-6 pt-2">
            <button
              onClick={() => {
                onClose()
                window.location.href = '/subscription'
              }}
              className={`w-full py-3.5 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 transition-all shadow-lg ${
                isUnlimited
                  ? 'bg-white text-zinc-900 hover:bg-zinc-100 shadow-white/10'
                  : 'bg-white text-[#e04d1c] hover:bg-white/90 shadow-white/20'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              {he ? `שדרג ל-${nextPlanData?.name || 'Pro'}` : `Upgrade to ${nextPlanData?.name || 'Pro'}`}
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              onClick={onClose}
              className="w-full mt-3 py-2 text-xs font-medium text-white/40 hover:text-white/70 transition-colors"
            >
              {he ? 'אולי אחר כך' : 'Maybe later'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
