import { useEffect, useState } from 'react'
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { Loader2, Lock, Shield, CreditCard } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useI18n } from '../../lib/i18n'
import { getStripe } from '../../lib/stripe'

interface Props {
  /** Called when the card is saved OR the user clicks Skip. */
  onComplete: () => void
}

function InnerCardForm({ onComplete }: Props) {
  const { locale } = useI18n()
  const he = locale === 'he'
  const stripe = useStripe()
  const elements = useElements()

  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    supabase.functions
      .invoke('create-setup-intent', { body: {} })
      .then(({ data, error }) => {
        if (cancelled) return
        if (error || !data?.client_secret) {
          setError(error?.message || 'Could not initialize payment form')
          setLoading(false)
          return
        }
        setClientSecret(data.client_secret)
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function handleSubmit() {
    if (!stripe || !elements || !clientSecret) return
    setSubmitting(true)
    setError('')

    const card = elements.getElement(CardElement)
    if (!card) {
      setError('Card form not ready')
      setSubmitting(false)
      return
    }

    const result = await stripe.confirmCardSetup(clientSecret, {
      payment_method: { card },
    })

    if (result.error) {
      setError(result.error.message || 'Card could not be saved')
      setSubmitting(false)
      return
    }

    const paymentMethodId =
      typeof result.setupIntent.payment_method === 'string'
        ? result.setupIntent.payment_method
        : result.setupIntent.payment_method?.id

    if (!paymentMethodId) {
      setError('Could not read payment method id')
      setSubmitting(false)
      return
    }

    const { error: saveErr } = await supabase.functions.invoke(
      'save-payment-method',
      { body: { payment_method_id: paymentMethodId } },
    )
    if (saveErr) {
      setError('Saved with Stripe but failed to save in our system. Please contact support.')
      setSubmitting(false)
      return
    }

    setSubmitting(false)
    onComplete()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-[#fe5b25]" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-50 text-green-700 text-xs font-semibold mb-3">
          <Shield className="w-3.5 h-3.5" />
          {he ? '7 ימי ניסיון חינם' : '7-day free trial'}
        </div>
        <h1 className="text-base md:text-lg font-bold text-zinc-900">
          {he ? 'הוסף כרטיס אשראי' : 'Add a payment card'}
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          {he
            ? 'לא תחויב עכשיו. נחייב רק בסיום הניסיון, ותוכל לבטל בכל עת.'
            : "You won't be charged now. We'll only charge after your trial, and you can cancel anytime."}
        </p>
      </div>

      <div className="max-w-sm mx-auto space-y-4">
        <div className="rounded-xl border-2 border-zinc-200 bg-white px-4 py-4">
          <CardElement
            options={{
              style: {
                base: {
                  fontSize: '15px',
                  color: '#18181b',
                  '::placeholder': { color: '#a1a1aa' },
                },
                invalid: { color: '#dc2626' },
              },
            }}
          />
        </div>

        {error && (
          <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600 text-center">
            {error}
          </div>
        )}

        <div className="flex items-center gap-2 justify-center text-xs text-zinc-400">
          <Lock className="w-3 h-3" />
          {he ? 'מוצפן ומאובטח על ידי Stripe' : 'Encrypted & secured by Stripe'}
        </div>

        <button
          type="button"
          disabled={submitting || !stripe}
          onClick={handleSubmit}
          className="w-full py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-40 transition-all shadow-md shadow-[#fe5b25]/20 flex items-center justify-center gap-2"
          style={{ background: 'linear-gradient(135deg, #fe5b25, #e04d1c)' }}
        >
          {submitting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <CreditCard className="w-4 h-4" />
              {he ? 'הפעל ניסיון חינם' : 'Start free trial'}
            </>
          )}
        </button>

        <button
          type="button"
          onClick={onComplete}
          className="w-full py-3 text-sm text-zinc-400 hover:text-zinc-600 transition-colors"
        >
          {he ? 'דלג בינתיים' : 'Skip for now'}
        </button>
      </div>
    </div>
  )
}

export default function CreditCardStep({ onComplete }: Props) {
  const [stripePromise] = useState(() => getStripe())

  return (
    <Elements stripe={stripePromise}>
      <InnerCardForm onComplete={onComplete} />
    </Elements>
  )
}
