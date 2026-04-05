import { useState, useEffect } from 'react'
import { useUserSubscription } from '../hooks/useUserSubscription'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { formatDate, formatCents } from '../lib/shared'
import {
  CreditCard,
  Check,
  Crown,
  Zap,
  ArrowRight,
  Shield,
  Sparkles,
  Clock,
  ExternalLink,
  FileText,
  Loader2,
  CheckCircle2,
  XCircle,
  Receipt,
  ChevronRight,
  Download,
} from 'lucide-react'

/* ─── Plan display config ─── */
const PLAN_CONFIG: Record<string, {
  icon: typeof Zap
  features: string[]
  badge?: string
  gradient: string
  iconBg: string
  accentColor: string
}> = {
  free: {
    icon: Zap,
    features: [
      'Unlimited WhatsApp groups',
      'Lead notifications (preview only)',
      'Forward jobs to earn commission',
      'Earn commission on forwarded jobs',
      'Lead feedback & ratings',
    ],
    gradient: 'from-slate-50 to-white',
    iconBg: 'bg-slate-100 text-slate-600',
    accentColor: 'slate',
  },
  premium: {
    icon: Crown,
    badge: '7-Day Free Trial',
    features: [
      'Everything in Free',
      'Full lead details + contact info',
      'Unlimited leads',
      'Full dashboard + weekly report',
      'Priority support',
      'Double commission on forwards',
    ],
    gradient: 'from-[#fe5b25] to-[#e04d1c]',
    iconBg: 'bg-white/20 text-white',
    accentColor: 'orange',
  },
}

function daysRemaining(endDate: string): number {
  const diff = new Date(endDate).getTime() - Date.now()
  return Math.max(0, Math.ceil(diff / 86_400_000))
}

/* ─── Component ─── */
export default function Subscription() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [billingInterval, setBillingInterval] = useState<'monthly' | 'yearly'>('monthly')

  const {
    subscription,
    plans,
    invoices,
    loading,
    actionLoading,
    isActive,
    isTrialing,
    hasStripeSubscription,
    subscribe,
    changePlan,
    openPortal,
    isPremium,
    isFree,
    isLegacy,
  } = useUserSubscription()

  const showSuccess = searchParams.get('success') === 'true'
  const showCanceled = searchParams.get('canceled') === 'true'
  // Redirect to dashboard after successful payment (3s delay to show success message)
  useEffect(() => {
    if (showSuccess) {
      const timer = setTimeout(() => navigate('/', { replace: true }), 3000)
      return () => clearTimeout(timer)
    }
  }, [showSuccess, navigate])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin h-8 w-8 rounded-full border-2 border-[#fe5b25] border-t-transparent" />
      </div>
    )
  }

  function handleSubscribe(planSlug: string) {
    const plan = plans.find(p => p.slug === planSlug)
    if (!plan) return
    const priceId = billingInterval === 'yearly' ? plan.stripe_yearly_price_id : plan.stripe_price_id
    if (!priceId) return
    if (hasStripeSubscription && isActive) {
      changePlan(priceId)
    } else {
      subscribe(priceId, plan.slug, billingInterval)
    }
  }

  function getPremiumPrice() {
    const plan = plans.find(p => p.slug === 'premium')
    if (!plan) return { monthly: 79, yearly: Math.round((7900 * 10) / 12 / 100) }
    // Yearly = 10 months of monthly price (2 months free, ~17% discount)
    const yearlyTotal = plan.price_cents * 10
    return { monthly: plan.price_cents / 100, yearly: Math.round(yearlyTotal / 12 / 100) }
  }

  const premiumPrice = getPremiumPrice()
  const displayPrice = billingInterval === 'yearly' ? premiumPrice.yearly : premiumPrice.monthly

  const planName = subscription?.plan?.name || (isFree ? 'Free' : 'Free')
  const renewalDate = subscription?.current_period_end ? new Date(subscription.current_period_end).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'
  const monthlyPrice = subscription?.plan?.price_cents ? subscription.plan.price_cents / 100 : 0

  return (
    <div className="animate-fade-in">

    {/* ─── MOBILE (prototype-style) ─── */}
    <div className="md:hidden bg-white min-h-screen pb-28">
      <div className="flex items-center gap-3 px-5 pt-5 pb-3">
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-[#fafafa] flex items-center justify-center active:scale-[0.97] transition-transform">
          <ArrowRight className="w-[17px] h-[17px] rotate-180" />
        </button>
        <h1 className="text-[18px] font-bold tracking-tight">Subscription</h1>
      </div>

      <div className="px-5 pb-6">
        {/* Current plan hero */}
        <div className="bg-[#111] rounded-[20px] p-5 mb-5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-[#fe5b25] rounded-full opacity-[0.08] -translate-y-8 translate-x-8" />
          <div className="flex items-center gap-3 mb-2 relative">
            <div className="w-10 h-10 rounded-xl bg-[#fe5b25] flex items-center justify-center">
              <Crown className="w-[18px] h-[18px] text-white" />
            </div>
            <div>
              <p className="text-[16px] font-bold text-white">{planName} Plan</p>
              <p className="text-[11px] text-white/40">
                {isTrialing ? `Trial ends ${renewalDate}` : isActive ? `Renews ${renewalDate}` : 'Not active'}
              </p>
            </div>
          </div>
          <div className="flex items-baseline gap-1 mt-3 relative">
            <span className="text-[32px] font-bold text-white tracking-tight">${monthlyPrice}</span>
            <span className="text-[13px] text-white/40">/month</span>
          </div>
        </div>

        {/* Plans */}
        <p className="text-[10px] font-semibold text-[#a3a3a3] uppercase tracking-widest mb-3">Plans</p>
        <div className="space-y-3 mb-6">
          {/* Premium */}
          <div className={`bg-white rounded-[20px] border border-black/[0.04] shadow-sm p-4 relative overflow-hidden ${isPremium || isTrialing ? 'ring-2 ring-[#fe5b25]' : ''}`}>
            {(isPremium || isTrialing) && (
              <div className="absolute top-3 right-3">
                <span className="text-[9px] font-bold text-white bg-[#fe5b25] px-2 py-0.5 rounded-full">ACTIVE</span>
              </div>
            )}
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-[#fe5b25]" />
              <p className="text-[15px] font-semibold">Premium</p>
            </div>
            <div className="flex items-baseline gap-0.5 mb-3">
              <span className="text-[24px] font-bold tracking-tight">${premiumPrice.monthly}</span>
              <span className="text-[12px] text-[#737373]">/month</span>
            </div>
            <div className="space-y-2 mb-4">
              {['Unlimited professions', 'Unlimited zip codes', 'Priority leads', 'All channels (WhatsApp, Push)', 'Rebeca AI assistant', 'Verified badge'].map((f) => (
                <div key={f} className="flex items-center gap-2">
                  <Check className="w-3 h-3 text-[#fe5b25]" />
                  <span className="text-[12px]">{f}</span>
                </div>
              ))}
            </div>
            {isPremium || isTrialing ? (
              <button type="button" disabled className="w-full py-3 rounded-xl text-[13px] font-semibold bg-[#fafafa] text-[#737373] active:scale-[0.97] transition-transform">
                Your Plan
              </button>
            ) : (
              <button type="button" onClick={() => handleSubscribe('premium')} disabled={actionLoading}
                className="w-full py-3 rounded-xl text-[13px] font-semibold bg-[#fe5b25] text-white active:scale-[0.97] transition-transform flex items-center justify-center gap-2">
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Crown className="w-4 h-4" /> Upgrade to Premium</>}
              </button>
            )}
          </div>

          {/* Free */}
          <div className={`bg-white rounded-[20px] border border-black/[0.04] shadow-sm p-4 ${isFree && !isTrialing ? 'ring-2 ring-[#737373]' : ''}`}>
            {isFree && !isTrialing && (
              <div className="absolute top-3 right-3">
                <span className="text-[9px] font-bold text-white bg-[#737373] px-2 py-0.5 rounded-full">ACTIVE</span>
              </div>
            )}
            <div className="flex items-center gap-2 mb-3">
              <Zap className="w-4 h-4 text-[#737373]" />
              <p className="text-[15px] font-semibold">Free</p>
            </div>
            <div className="flex items-baseline gap-0.5 mb-3">
              <span className="text-[24px] font-bold tracking-tight">$0</span>
              <span className="text-[12px] text-[#737373]">forever</span>
            </div>
            <div className="space-y-2 mb-4">
              {['3 professions', '5 zip codes', 'Basic leads', 'WhatsApp alerts only'].map((f) => (
                <div key={f} className="flex items-center gap-2">
                  <Check className="w-3 h-3 text-[#737373]" />
                  <span className="text-[12px] text-[#737373]">{f}</span>
                </div>
              ))}
            </div>
            {isFree && !isTrialing ? (
              <button type="button" disabled className="w-full py-3 rounded-xl text-[13px] font-semibold bg-[#111] text-white active:scale-[0.97] transition-transform">
                Your Plan
              </button>
            ) : (
              hasStripeSubscription ? (
                <button type="button" onClick={openPortal} className="w-full py-3 rounded-xl text-[13px] font-semibold bg-[#111] text-white active:scale-[0.97] transition-transform">
                  Downgrade
                </button>
              ) : null
            )}
          </div>
        </div>

        {/* Billing */}
        {hasStripeSubscription && (
          <>
            <p className="text-[10px] font-semibold text-[#a3a3a3] uppercase tracking-widest mb-3">Billing</p>
            <div className="bg-white rounded-[20px] border border-black/[0.04] shadow-sm overflow-hidden mb-4">
              {[
                { label: 'Next billing', val: renewalDate },
                { label: 'Amount', val: `$${monthlyPrice}/mo` },
              ].map((item, i, arr) => (
                <div key={item.label} className="flex items-center justify-between px-4 py-3.5"
                  style={{ borderBottom: i < arr.length - 1 ? '1px solid #f5f5f5' : 'none' }}>
                  <p className="text-[12px] font-semibold text-[#111]">{item.label}</p>
                  <span className="text-[12px] text-[#737373]">{item.val}</span>
                </div>
              ))}
              <button type="button" onClick={openPortal}
                className="w-full flex items-center justify-between px-4 py-3.5"
                style={{ borderTop: '1px solid #f5f5f5' }}>
                <p className="text-[12px] font-semibold text-[#111]">Manage billing</p>
                <ChevronRight className="w-3.5 h-3.5 text-[#a3a3a3]" />
              </button>
            </div>
            <button type="button" onClick={openPortal}
              className="w-full text-center py-3 text-[12px] text-red-400 active:scale-[0.97] transition-transform">
              Cancel Subscription
            </button>
          </>
        )}
      </div>
    </div>

    {/* ─── DESKTOP ─── */}
    <div className="hidden md:block max-w-5xl mx-auto space-y-8 pb-16">
      {/* ─── Hero Header ─── */}
      <div className="text-center pt-2 pb-4">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 mb-2">
          {isLegacy ? 'Your Subscription' : 'Choose your plan'}
        </h1>
        <p className="text-base text-zinc-500 max-w-md mx-auto">
          {isLegacy
            ? 'You\'re on a legacy plan with all features included'
            : 'Scale your lead generation with the right tools for your business'
          }
        </p>
      </div>

      {/* ─── Success / Canceled Banners ─── */}
      {showSuccess && (
        <div className="rounded-2xl p-4 bg-[#fff4ef] border border-[#fee8df] flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 text-[#fe5b25] shrink-0" />
          <p className="text-sm font-medium text-[#c43d10]">Payment successful! Your subscription is now active. Redirecting to dashboard...</p>
        </div>
      )}
      {showCanceled && (
        <div className="rounded-2xl p-4 bg-amber-50 border border-amber-100 flex items-center gap-3">
          <XCircle className="h-5 w-5 text-amber-600 shrink-0" />
          <p className="text-sm font-medium text-amber-800">Checkout was canceled. No charges were made.</p>
        </div>
      )}

      {/* ─── Trial Banner ─── */}
      {isTrialing && subscription?.current_period_end && (
        <div className="rounded-2xl p-5 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/60 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-zinc-900">Free Trial Active</p>
              <p className="text-sm text-zinc-500">{daysRemaining(subscription.current_period_end)} days remaining</p>
            </div>
          </div>
          {!isPremium && (
            <a href="#plans" className="px-5 py-2.5 rounded-full bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 transition-colors flex items-center gap-2">
              Upgrade Now <ArrowRight className="h-4 w-4" />
            </a>
          )}
        </div>
      )}

      {/* ─── Expired Banner ─── */}
      {!isActive && !isTrialing && subscription && (
        <div className="rounded-2xl p-5 bg-red-50 border border-red-200/60 flex items-center gap-3">
          <XCircle className="h-5 w-5 text-red-500 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-zinc-900">Subscription Expired</p>
            <p className="text-sm text-zinc-500">Subscribe to a plan below to regain access to your leads.</p>
          </div>
        </div>
      )}

      {/* ─── Legacy Plan Banner ─── */}
      {isLegacy && isActive && (
        <div className="rounded-2xl p-5 bg-gradient-to-r from-zinc-50 to-slate-50 border border-zinc-200/60 flex items-center gap-4">
          <div className="h-10 w-10 rounded-xl bg-zinc-800 text-white flex items-center justify-center shrink-0">
            <Shield className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-0.5">
              <p className="text-sm font-semibold text-zinc-900">
                {subscription?.plan?.name ?? 'Legacy'} Plan
              </p>
              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-zinc-800 text-white">
                Legacy
              </span>
            </div>
            <p className="text-sm text-zinc-500">
              Legacy plan — all features included. Your plan continues to work as-is.
            </p>
          </div>
          <div className="text-right">
            <p className="text-xl font-bold text-zinc-900">
              ${subscription?.plan ? subscription.plan.price_cents / 100 : '—'}
            </p>
            <p className="text-xs text-zinc-400">/month</p>
          </div>
        </div>
      )}

      {/* ─── Plan Comparison (Free + Premium) — shown for free users and non-legacy ─── */}
      {!isLegacy && (
        <>
          {/* Billing Interval Toggle */}
          <div id="plans" className="flex justify-center">
            <div className="inline-flex items-center gap-1 bg-zinc-100 rounded-full p-1">
              <button
                type="button"
                onClick={() => setBillingInterval('monthly')}
                className={`px-6 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                  billingInterval === 'monthly'
                    ? 'bg-white shadow-sm text-zinc-900'
                    : 'text-zinc-500 hover:text-zinc-700'
                }`}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => setBillingInterval('yearly')}
                className={`px-6 py-2 rounded-full text-sm font-medium transition-all duration-200 flex items-center gap-2 ${
                  billingInterval === 'yearly'
                    ? 'bg-white shadow-sm text-zinc-900'
                    : 'text-zinc-500 hover:text-zinc-700'
                }`}
              >
                Annual
                <span className="text-[10px] font-bold text-[#fe5b25] bg-[#fff4ef] px-2 py-0.5 rounded-full">
                  -17%
                </span>
              </button>
            </div>
          </div>

          {/* 2-Column Plan Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-3xl mx-auto">
            {/* Free Plan */}
            {(() => {
              const config = PLAN_CONFIG.free
              const Icon = config.icon
              const isCurrent = isFree && !isLegacy

              return (
                <div
                  className={[
                    'relative flex flex-col rounded-2xl p-6 transition-all duration-300',
                    'hover:-translate-y-1',
                    'bg-white border border-zinc-200/60 shadow-sm hover:shadow-lg',
                    isCurrent ? 'ring-2 ring-slate-400 ring-offset-2' : '',
                  ].join(' ')}
                >
                  {isCurrent && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="inline-flex items-center gap-1 rounded-full px-3.5 py-1 text-[11px] font-bold shadow-md bg-slate-600 text-white">
                        <CheckCircle2 className="h-3 w-3" />
                        Your Current Plan
                      </span>
                    </div>
                  )}

                  <div className="flex items-center gap-3 mb-5 mt-1">
                    <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${config.iconBg}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="text-lg font-bold text-zinc-900">Free</h3>
                  </div>

                  <div className="mb-1">
                    <span className="text-4xl font-extrabold tracking-tight text-zinc-900">${plans.find(p => p.slug === 'free')?.price_cents === 0 ? '0' : ((plans.find(p => p.slug === 'free')?.price_cents ?? 0) / 100)}</span>
                    <span className="text-sm ml-1 text-zinc-400">/mo</span>
                  </div>
                  <p className="text-xs text-zinc-400 mb-5">Free forever</p>

                  <ul className="flex-1 space-y-3 mb-7">
                    {config.features.map((feature) => (
                      <li key={feature} className="flex items-center gap-2.5 text-sm text-zinc-600">
                        <div className="h-4.5 w-4.5 rounded-full flex items-center justify-center shrink-0 bg-slate-100">
                          <Check className="h-3 w-3 text-slate-500" />
                        </div>
                        {feature}
                      </li>
                    ))}
                  </ul>

                  {isCurrent ? (
                    <button
                      type="button"
                      disabled
                      className="w-full py-3 rounded-full text-sm font-semibold flex items-center justify-center gap-2 cursor-default bg-zinc-100 text-zinc-500 border border-zinc-200"
                    >
                      <Shield className="h-4 w-4" />
                      Current Plan
                    </button>
                  ) : (
                    <div className="h-[46px]" /> // spacer to align with premium button
                  )}
                </div>
              )
            })()}

            {/* Premium Plan */}
            {(() => {
              const config = PLAN_CONFIG.premium
              const Icon = config.icon
              const isCurrent = isPremium && !isLegacy

              return (
                <div
                  className={[
                    'relative flex flex-col rounded-2xl p-6 transition-all duration-300',
                    'hover:-translate-y-1',
                    `bg-gradient-to-br ${config.gradient} text-white shadow-xl`,
                    isCurrent ? 'ring-2 ring-[#fe5b25] ring-offset-2' : '',
                  ].join(' ')}
                >
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className={`inline-flex items-center gap-1 rounded-full px-3.5 py-1 text-[11px] font-bold shadow-md ${
                      isCurrent
                        ? 'bg-[#fe5b25] text-white ring-2 ring-[#ff8a5c] ring-offset-1'
                        : 'bg-white text-[#e04d1c]'
                    }`}>
                      {isCurrent ? <CheckCircle2 className="h-3 w-3" /> : <Sparkles className="h-3 w-3" />}
                      {isCurrent ? 'Your Current Plan' : config.badge}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 mb-5 mt-1">
                    <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${config.iconBg}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="text-lg font-bold text-white">Premium</h3>
                  </div>

                  <div className="mb-1">
                    <span className="text-4xl font-extrabold tracking-tight text-white">
                      ${displayPrice}
                    </span>
                    <span className="text-sm ml-1 text-white/60">/mo</span>
                  </div>
                  {billingInterval === 'yearly' ? (
                    <p className="text-xs text-white/50 mb-5">
                      ${(plans.find(p => p.slug === 'premium')?.price_cents ?? 7900) * 10 / 100}/year billed annually
                    </p>
                  ) : (
                    <p className="text-xs text-white/50 mb-5">Billed monthly</p>
                  )}

                  <ul className="flex-1 space-y-3 mb-7">
                    {config.features.map((feature) => (
                      <li key={feature} className="flex items-center gap-2.5 text-sm text-white/85">
                        <div className="h-4.5 w-4.5 rounded-full flex items-center justify-center shrink-0 bg-white/20">
                          <Check className="h-3 w-3 text-white" />
                        </div>
                        {feature}
                      </li>
                    ))}
                  </ul>

                  {isCurrent ? (
                    <button
                      type="button"
                      disabled
                      className="w-full py-3 rounded-full text-sm font-semibold flex items-center justify-center gap-2 cursor-default bg-white/20 text-white/80 border border-white/10"
                    >
                      <Shield className="h-4 w-4" />
                      Current Plan
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={() => handleSubscribe('premium')}
                      className="w-full py-3 rounded-full text-sm font-semibold flex items-center justify-center gap-2 transition-all duration-300 disabled:opacity-50 bg-white text-zinc-900 hover:bg-white/90 shadow-lg"
                    >
                      {actionLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          {hasStripeSubscription && isActive ? 'Upgrade' : 'Start Free Trial'}
                          <ArrowRight className="h-4 w-4" />
                        </>
                      )}
                    </button>
                  )}
                </div>
              )
            })()}
          </div>
        </>
      )}

      {/* ─── Billing & Invoices Section ─── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Billing Management Card */}
        <div className="rounded-2xl bg-white border border-zinc-200/60 p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-xl bg-[#fff4ef] text-[#fe5b25] flex items-center justify-center">
              <CreditCard className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-zinc-900">Billing</h3>
              <p className="text-xs text-zinc-400">
                {hasStripeSubscription ? 'Payment method & subscription' : 'Subscribe to manage billing'}
              </p>
            </div>
          </div>

          {isActive && subscription?.plan && (
            <div className="rounded-xl bg-zinc-50 p-4 mb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-[#fe5b25] uppercase tracking-wider font-bold">Current Plan</p>
                  <p className="text-lg font-bold text-zinc-900 mt-0.5">
                    {subscription.plan.name}
                    {isLegacy && (
                      <span className="ml-2 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-zinc-200 text-zinc-600 align-middle">
                        Legacy
                      </span>
                    )}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold text-zinc-900">${subscription.plan.price_cents / 100}</p>
                  <p className="text-xs text-zinc-400">/month</p>
                </div>
              </div>
              {subscription.current_period_end && (
                <p className="text-xs text-zinc-400 mt-2 pt-2 border-t border-zinc-200/60">
                  Next billing: {new Date(subscription.current_period_end).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </p>
              )}
            </div>
          )}

          <button
            type="button"
            disabled={!hasStripeSubscription || actionLoading}
            onClick={openPortal}
            className={`w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all ${
              hasStripeSubscription
                ? 'bg-[#fe5b25] text-white hover:bg-[#e04d1c] shadow-md shadow-[#fe5b25]/20'
                : 'border border-zinc-100 text-zinc-300 cursor-not-allowed'
            }`}
          >
            {actionLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                Manage Billing
                <ExternalLink className="h-3.5 w-3.5" />
              </>
            )}
          </button>
        </div>

        {/* Invoice History Card */}
        <div className="rounded-2xl bg-white border border-zinc-200/60 p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-xl bg-zinc-100 text-zinc-600 flex items-center justify-center">
              <Receipt className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-zinc-900">Invoice History</h3>
              <p className="text-xs text-zinc-400">
                {invoices.length > 0 ? `${invoices.length} invoices` : 'No invoices yet'}
              </p>
            </div>
          </div>

          {invoices.length > 0 ? (
            <div className="space-y-2">
              {invoices.slice(0, 4).map((inv) => (
                <div key={inv.id} className="flex items-center justify-between py-2.5 px-3 rounded-xl hover:bg-zinc-50 transition-colors group">
                  <div className="flex items-center gap-3">
                    <FileText className="h-4 w-4 text-zinc-300" />
                    <div>
                      <p className="text-sm font-medium text-zinc-700">{formatDate(inv.created)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span className="text-sm font-semibold text-zinc-900">
                      {formatCents(inv.amount_paid || inv.amount_due, inv.currency)}
                    </span>
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                      inv.status === 'paid'
                        ? 'bg-[#fff4ef] text-[#fe5b25]'
                        : 'bg-amber-50 text-amber-600'
                    }`}>
                      {inv.status}
                    </span>
                    {inv.invoice_pdf && (
                      <a
                        href={inv.invoice_pdf}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-zinc-400 hover:text-zinc-600"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
              {invoices.length > 4 && hasStripeSubscription && (
                <button
                  type="button"
                  onClick={openPortal}
                  className="w-full flex items-center justify-center gap-1 text-xs text-zinc-400 hover:text-zinc-600 py-2 transition-colors"
                >
                  View all invoices <ChevronRight className="h-3 w-3" />
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <FileText className="h-8 w-8 text-zinc-200 mb-2" />
              <p className="text-sm text-zinc-400">Invoices will appear here after your first payment</p>
            </div>
          )}
        </div>
      </div>
      </div>{/* end hidden md:block */}
    </div>
  )
}
