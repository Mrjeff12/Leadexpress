import { useState, useEffect } from 'react'
import { useAuth } from '../lib/auth'
import { useI18n } from '../lib/i18n'
import { supabase } from '../lib/supabase'
import {
  CreditCard,
  Check,
  Star,
  Crown,
  Zap,
  ArrowRight,
  Shield,
  Sparkles,
  Clock,
  Mail,
  MessageSquare,
  MapPin,
  Briefcase,
} from 'lucide-react'

/* ─── Plan definitions ─── */
interface PlanTier {
  id: 'starter' | 'pro' | 'unlimited'
  name: string
  price: number
  icon: React.ReactNode
  features: string[]
  highlight?: boolean
  badge?: string
}

const PLANS: PlanTier[] = [
  {
    id: 'starter',
    name: 'Starter',
    price: 149,
    icon: <Zap className="h-5 w-5" />,
    features: [
      'Up to 3 professions',
      'Up to 10 zip codes',
      'Email support',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 249,
    icon: <Star className="h-5 w-5" />,
    highlight: true,
    badge: 'Most Popular',
    features: [
      'All professions',
      'Up to 25 zip codes',
      'Priority support',
      'Morning digest',
    ],
  },
  {
    id: 'unlimited',
    name: 'Unlimited',
    price: 399,
    icon: <Crown className="h-5 w-5" />,
    features: [
      'All professions',
      'Unlimited zip codes',
      'VIP support',
      'AI suggestions',
      'Priority delivery',
    ],
  },
]

/* ─── Feature icons ─── */
function featureIcon(feature: string) {
  if (feature.toLowerCase().includes('profession')) return <Briefcase className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
  if (feature.toLowerCase().includes('zip')) return <MapPin className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
  if (feature.toLowerCase().includes('support')) return <MessageSquare className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
  if (feature.toLowerCase().includes('digest')) return <Mail className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
  if (feature.toLowerCase().includes('ai')) return <Sparkles className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
  if (feature.toLowerCase().includes('priority')) return <Clock className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
  return <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
}

/* ─── Helpers ─── */
function daysRemaining(endDate: string): number {
  const diff = new Date(endDate).getTime() - Date.now()
  return Math.max(0, Math.ceil(diff / 86_400_000))
}

/* ─── Component ─── */
export default function Subscription() {
  const { effectiveUserId } = useAuth()
  const { t } = useI18n()

  const [currentPlan, setCurrentPlan] = useState<'starter' | 'pro' | 'unlimited'>('starter')
  const [loading, setLoading] = useState(true)
  const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(null)
  const [trialEnd, setTrialEnd] = useState<string | null>(null)

  /* ─── Load subscription data ─── */
  useEffect(() => {
    async function loadSubscription() {
      if (!effectiveUserId) return
      setLoading(true)

      const { data } = await supabase
        .from('subscriptions')
        .select('status, current_period_end, plans ( slug )')
        .eq('user_id', effectiveUserId)
        .in('status', ['active', 'trialing'])
        .maybeSingle()

      const planSlug = (data?.plans as any)?.slug as string | undefined
      if (planSlug && ['starter', 'pro', 'unlimited'].includes(planSlug)) {
        setCurrentPlan(planSlug as typeof currentPlan)
      }
      if (data) {
        setSubscriptionStatus(data.status ?? null)
        setTrialEnd(data.current_period_end ?? null)
      }

      setLoading(false)
    }

    loadSubscription()
  }, [effectiveUserId])

  const activePlan = PLANS.find((p) => p.id === currentPlan)!

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin h-8 w-8 rounded-full border-2 border-emerald-500 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="animate-fade-in max-w-5xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-emerald-100 text-emerald-700">
          <CreditCard className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">{t('sub.title')}</h1>
          <p className="text-sm text-zinc-500">Manage your plan and billing</p>
        </div>
      </div>

      {/* ─── Trial Banner ─── */}
      {subscriptionStatus === 'trialing' && (
        <section className="glass-panel p-5 border-amber-200 bg-gradient-to-r from-amber-50/80 to-orange-50/50">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-amber-100 text-amber-600">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold text-zinc-900">Free Trial</h2>
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-700 px-2.5 py-0.5 text-xs font-medium">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                    Trial
                  </span>
                </div>
                <p className="text-sm text-zinc-500 mt-0.5">
                  {trialEnd
                    ? `${daysRemaining(trialEnd)} days remaining in your free trial`
                    : 'You are currently on a free trial'}
                </p>
              </div>
            </div>
            <button
              type="button"
              className="btn-primary rounded-xl px-5 py-2.5 text-sm font-medium flex items-center gap-2 hover:gap-3 transition-all"
            >
              Upgrade
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </section>
      )}

      <div className="stagger-children space-y-6">
        {/* ─── Current Plan Banner ─── */}
        <section className="glass-panel p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center h-12 w-12 rounded-2xl bg-emerald-100 text-emerald-600">
                {activePlan.icon}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold text-zinc-900">{activePlan.name}</h2>
                  <span className="badge-green inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    Active
                  </span>
                </div>
                <p className="text-sm text-zinc-500 mt-0.5">
                  ${activePlan.price}{t('sub.per_month')}
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-zinc-900">${activePlan.price}</div>
              <div className="text-xs text-zinc-500">{t('sub.per_month')}</div>
            </div>
          </div>
        </section>

        {/* ─── Plan Comparison ─── */}
        <section>
          <h2 className="text-sm font-medium text-zinc-600 mb-4">{t('sub.change_plan')}</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {PLANS.map((plan) => {
              const isCurrent = plan.id === currentPlan
              return (
                <div
                  key={plan.id}
                  className={[
                    'glass-panel relative flex flex-col p-6 transition-all duration-300',
                    'hover:-translate-y-1 hover:shadow-lg',
                    isCurrent
                      ? 'ring-2 ring-emerald-400 border-emerald-300'
                      : 'hover:ring-1 hover:ring-emerald-200',
                  ].join(' ')}
                >
                  {/* Badge */}
                  {plan.badge && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500 px-3 py-1 text-[11px] font-semibold text-white shadow-sm">
                        <Sparkles className="h-3 w-3" />
                        {plan.badge}
                      </span>
                    </div>
                  )}

                  {/* Icon + Name */}
                  <div className="flex items-center gap-3 mb-4">
                    <div
                      className={[
                        'flex items-center justify-center h-10 w-10 rounded-xl',
                        isCurrent
                          ? 'bg-emerald-100 text-emerald-600'
                          : 'bg-zinc-100 text-zinc-500',
                      ].join(' ')}
                    >
                      {plan.icon}
                    </div>
                    <h3 className="text-lg font-semibold text-zinc-900">{plan.name}</h3>
                  </div>

                  {/* Price */}
                  <div className="flex items-baseline gap-1 mb-5">
                    <span className="text-3xl font-bold text-zinc-900">${plan.price}</span>
                    <span className="text-sm text-zinc-500">{t('sub.per_month')}</span>
                  </div>

                  {/* Features */}
                  <ul className="flex-1 space-y-2.5 mb-6">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-center gap-2 text-sm text-zinc-700">
                        {featureIcon(feature)}
                        {feature}
                      </li>
                    ))}
                  </ul>

                  {/* CTA */}
                  {isCurrent ? (
                    <button
                      type="button"
                      disabled
                      className="btn-outline w-full rounded-xl py-2.5 text-sm font-medium text-emerald-600 border-emerald-300 bg-emerald-50/50 cursor-default flex items-center justify-center gap-2"
                    >
                      <Shield className="h-4 w-4" />
                      {t('sub.current_plan')}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn-primary w-full rounded-xl py-2.5 text-sm font-medium flex items-center justify-center gap-2 hover:gap-3 transition-all"
                    >
                      Upgrade
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </section>

        {/* ─── Billing Info Placeholder ─── */}
        <section className="glass-panel p-6">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-zinc-100 text-zinc-500">
              <CreditCard className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h2 className="text-sm font-semibold text-zinc-700">Billing Information</h2>
              <p className="text-sm text-zinc-400 mt-0.5">
                Stripe integration coming soon
              </p>
            </div>
            <button type="button" disabled className="btn-ghost rounded-xl px-4 py-2 text-sm text-zinc-400 cursor-not-allowed">
              Manage Billing
            </button>
          </div>
        </section>
      </div>
    </div>
  )
}
