import { ArrowLeft, Check, Star, Zap, Crown } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export default function SubscriptionPage() {
  const nav = useNavigate()

  return (
    <div className="page-content bg-white">
      <div className="flex items-center gap-3 px-5 pt-5 pb-3">
        <button onClick={() => nav(-1)} className="w-9 h-9 rounded-full bg-[var(--gray-50)] flex items-center justify-center press">
          <ArrowLeft size={17} strokeWidth={1.8} />
        </button>
        <h1 className="text-[18px] font-bold tracking-tight">Subscription</h1>
      </div>

      <div className="px-5 pb-6">

        {/* Current plan hero */}
        <div className="card-dark p-5 mb-5 relative overflow-hidden anim-up">
          <div className="absolute top-0 right-0 w-24 h-24 bg-[var(--brand)] rounded-full opacity-[0.08] -translate-y-8 translate-x-8" />
          <div className="flex items-center gap-3 mb-2 relative">
            <div className="w-10 h-10 rounded-xl bg-[var(--brand)] flex items-center justify-center">
              <Crown size={18} className="text-white" />
            </div>
            <div>
              <p className="text-[16px] font-bold text-white">Premium Plan</p>
              <p className="text-[11px] text-white/40">Renews Apr 15, 2026</p>
            </div>
          </div>
          <div className="flex items-baseline gap-1 mt-3 relative">
            <span className="text-[32px] font-bold text-white tracking-tight">$79</span>
            <span className="text-[13px] text-white/40">/month</span>
          </div>
        </div>

        {/* Plans - Premium first */}
        <p className="t-label mb-3">Plans</p>
        <div className="space-y-3 mb-6">
          {/* Premium */}
          <div className="card p-4 ring-2 ring-[var(--brand)] relative overflow-hidden anim-up">
            <div className="absolute top-3 right-3">
              <span className="text-[9px] font-bold text-white bg-[var(--brand)] px-2 py-0.5 rounded-full">ACTIVE</span>
            </div>
            <div className="flex items-center gap-2 mb-3">
              <Star size={16} className="text-[var(--brand)]" />
              <p className="t-sub text-[15px]">Premium</p>
            </div>
            <div className="flex items-baseline gap-0.5 mb-3">
              <span className="text-[24px] font-bold tracking-tight">$79</span>
              <span className="text-[12px] text-muted">/month</span>
            </div>
            <div className="space-y-2 mb-4">
              {['Unlimited professions', 'Unlimited zip codes', 'Priority leads', 'All channels (WhatsApp, Push)', 'Rebeca AI assistant', 'Portfolio & reviews', 'Verified badge'].map((f, j) => (
                <div key={j} className="flex items-center gap-2">
                  <Check size={13} className="text-[var(--brand)]" />
                  <span className="text-[12px]">{f}</span>
                </div>
              ))}
            </div>
            <button className="w-full py-3 rounded-xl t-sub text-[13px] bg-[var(--gray-50)] text-muted press">Your Plan</button>
          </div>

          {/* Free */}
          <div className="card p-4 anim-up">
            <div className="flex items-center gap-2 mb-3">
              <Zap size={16} className="text-muted" />
              <p className="t-sub text-[15px]">Free</p>
            </div>
            <div className="flex items-baseline gap-0.5 mb-3">
              <span className="text-[24px] font-bold tracking-tight">$0</span>
              <span className="text-[12px] text-muted">forever</span>
            </div>
            <div className="space-y-2 mb-4">
              {['3 professions', '5 zip codes', 'Basic leads', 'WhatsApp alerts only'].map((f, j) => (
                <div key={j} className="flex items-center gap-2">
                  <Check size={13} className="text-muted" />
                  <span className="text-[12px] text-muted">{f}</span>
                </div>
              ))}
            </div>
            <button className="w-full py-3 rounded-xl t-sub text-[13px] bg-[var(--dark)] text-white press">Downgrade</button>
          </div>
        </div>

        {/* Billing */}
        <p className="t-label mb-3">Billing</p>
        <div className="card overflow-hidden anim-up">
          {[
            { label: 'Payment method', val: 'Visa •••• 4242' },
            { label: 'Next billing', val: 'Apr 15, 2026' },
            { label: 'Amount', val: '$79.00' },
          ].map((item, i, arr) => (
            <div key={i} className="flex items-center justify-between px-4 py-3.5"
              style={{ borderBottom: i < arr.length - 1 ? '1px solid var(--gray-100)' : 'none' }}>
              <p className="t-sub text-[12px]">{item.label}</p>
              <span className="t-small text-muted">{item.val}</span>
            </div>
          ))}
        </div>

        <button className="w-full text-center py-3 mt-4 t-small text-red-400 press">Cancel Subscription</button>
      </div>
    </div>
  )
}
