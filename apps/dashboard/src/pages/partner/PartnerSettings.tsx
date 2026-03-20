import { useState, useEffect } from 'react'
import { useI18n } from '../../lib/i18n'
import { usePartnerProfile } from '../../hooks/usePartnerProfile'
import { useToast } from '../../components/hooks/use-toast'
import { supabase } from '../../lib/supabase'
import {
  Check,
  Loader2,
  User,
  MapPin,
  Link2,
  CreditCard,
  Save,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react'

export default function PartnerSettings() {
  const { locale } = useI18n()
  const he = locale === 'he'
  const { toast } = useToast()
  const { partner, loading, updateProfile, checkSlugAvailable, refetch } = usePartnerProfile()

  const [displayName, setDisplayName] = useState('')
  const [bio, setBio] = useState('')
  const [location, setLocation] = useState('')
  const [specialties, setSpecialties] = useState('')
  const [serviceAreas, setServiceAreas] = useState('')
  const [slug, setSlug] = useState('')
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null)
  const [checkingSlug, setCheckingSlug] = useState(false)
  const [payoutMethod, setPayoutMethod] = useState('bank')
  const [payoutDetails, setPayoutDetails] = useState('')
  const [saving, setSaving] = useState(false)
  const [stripeLoading, setStripeLoading] = useState(false)

  // Handle Stripe return URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const stripeParam = params.get('stripe')

    if (stripeParam === 'complete') {
      // Remove query params from URL
      window.history.replaceState({}, '', window.location.pathname)
      toast({
        title: he ? 'חשבון Stripe חובר!' : 'Stripe account connected!',
        description: he
          ? 'חשבון התשלומים שלך חובר בהצלחה.'
          : 'Your payout account has been connected successfully.',
      })
      refetch()
    } else if (stripeParam === 'refresh') {
      window.history.replaceState({}, '', window.location.pathname)
      // Auto-redirect back to onboarding
      handleStripeConnect()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Initialize form when partner loads
  useEffect(() => {
    if (partner) {
      setDisplayName(partner.display_name || '')
      setBio(partner.bio || '')
      setLocation(partner.location || '')
      setSpecialties((partner.specialties || []).join(', '))
      setServiceAreas((partner.service_areas || []).join(', '))
      setSlug(partner.slug || '')
      setPayoutMethod(partner.payout_method || 'bank')
      setPayoutDetails(partner.payout_details || '')
    }
  }, [partner])

  async function handleStripeConnect() {
    setStripeLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('stripe-connect-onboard')
      if (error) throw error
      if (data?.url) {
        window.location.href = data.url
      } else {
        throw new Error('No onboarding URL returned')
      }
    } catch (err: any) {
      toast({
        title: he ? 'שגיאה' : 'Error',
        description: err?.message || (he ? 'לא ניתן להתחבר ל-Stripe' : 'Could not connect to Stripe'),
        variant: 'destructive',
      })
      setStripeLoading(false)
    }
  }

  async function handleSlugChange(value: string) {
    const cleaned = value.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 40)
    setSlug(cleaned)
    if (cleaned.length < 3) { setSlugAvailable(null); return }
    if (cleaned === partner?.slug) { setSlugAvailable(true); return }

    setCheckingSlug(true)
    const available = await checkSlugAvailable(cleaned)
    setSlugAvailable(available)
    setCheckingSlug(false)
  }

  async function handleSave() {
    if (!displayName.trim() || !slug.trim()) return
    if (slugAvailable === false) return

    setSaving(true)
    try {
      await updateProfile({
        display_name: displayName.trim(),
        bio: bio.trim() || null as any,
        location: location.trim() || null as any,
        slug: slug.trim(),
        specialties: specialties.split(',').map(s => s.trim()).filter(Boolean),
        service_areas: serviceAreas.split(',').map(s => s.trim()).filter(Boolean),
        payout_method: payoutMethod,
        payout_details: payoutDetails.trim() || null as any,
      })
      toast({
        title: he ? 'נשמר!' : 'Saved!',
        description: he ? 'הפרופיל עודכן בהצלחה' : 'Your partner profile has been updated.',
      })
    } catch (err: any) {
      toast({
        title: he ? 'שגיאה' : 'Error',
        description: err?.message || 'Failed to save',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin h-8 w-8 rounded-full border-2 border-[#fe5b25] border-t-transparent" />
      </div>
    )
  }

  if (!partner) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-sm text-zinc-400">{he ? 'לא נמצא פרופיל שותף' : 'No partner profile found'}</p>
      </div>
    )
  }

  const stripeConnected = partner.stripe_onboarded === true
  const stripeInProgress = !!partner.stripe_connect_id && !partner.stripe_onboarded

  return (
    <div className="animate-fade-in space-y-8 pb-16 pt-2 max-w-2xl">
      {/* Header */}
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900">
          {he ? 'הגדרות שותף' : 'Partner Settings'}
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          {he ? 'ערוך את הפרופיל והגדרות התשלום שלך' : 'Edit your profile and payout preferences'}
        </p>
      </header>

      {/* Profile Section */}
      <div className="glass-panel p-6 border-none shadow-lg space-y-5">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-[#fff4ef] text-[#fe5b25] flex items-center justify-center">
            <User className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-zinc-900">{he ? 'פרופיל' : 'Profile'}</h2>
            <p className="text-xs text-zinc-400">{he ? 'איך קבלנים רואים אותך' : 'How contractors see you'}</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-zinc-600 mb-1.5">
              {he ? 'שם תצוגה' : 'Display Name'} *
            </label>
            <input
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-zinc-200 text-sm outline-none focus:border-[#fe5b25] focus:ring-2 focus:ring-[#fe5b25]/10 transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-600 mb-1.5">
              {he ? 'תיאור' : 'Bio'}
            </label>
            <textarea
              value={bio}
              onChange={e => setBio(e.target.value)}
              rows={3}
              className="w-full px-4 py-3 rounded-xl border border-zinc-200 text-sm outline-none focus:border-[#fe5b25] focus:ring-2 focus:ring-[#fe5b25]/10 transition-all resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-600 mb-1.5">
              <MapPin className="w-3 h-3 inline mr-1" />
              {he ? 'מיקום' : 'Location'}
            </label>
            <input
              value={location}
              onChange={e => setLocation(e.target.value)}
              placeholder={he ? 'לדוגמה: ניו ג\'רזי' : 'e.g. New Jersey, NY'}
              className="w-full px-4 py-3 rounded-xl border border-zinc-200 text-sm outline-none focus:border-[#fe5b25] focus:ring-2 focus:ring-[#fe5b25]/10 transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-600 mb-1.5">
              {he ? 'התמחויות' : 'Specialties'} <span className="text-zinc-400 font-normal">({he ? 'מופרדים בפסיק' : 'comma separated'})</span>
            </label>
            <input
              value={specialties}
              onChange={e => setSpecialties(e.target.value)}
              placeholder={he ? 'HVAC, אינסטלציה, חשמל' : 'HVAC, Plumbing, Electrical'}
              className="w-full px-4 py-3 rounded-xl border border-zinc-200 text-sm outline-none focus:border-[#fe5b25] focus:ring-2 focus:ring-[#fe5b25]/10 transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-600 mb-1.5">
              {he ? 'אזורי שירות' : 'Service Areas'} <span className="text-zinc-400 font-normal">({he ? 'מופרדים בפסיק' : 'comma separated'})</span>
            </label>
            <input
              value={serviceAreas}
              onChange={e => setServiceAreas(e.target.value)}
              placeholder={he ? 'ניו ג\'רזי, ניו יורק' : 'New Jersey, New York, Connecticut'}
              className="w-full px-4 py-3 rounded-xl border border-zinc-200 text-sm outline-none focus:border-[#fe5b25] focus:ring-2 focus:ring-[#fe5b25]/10 transition-all"
            />
          </div>
        </div>
      </div>

      {/* Slug Section */}
      <div className="glass-panel p-6 border-none shadow-lg space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-zinc-100 text-zinc-600 flex items-center justify-center">
            <Link2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-zinc-900">{he ? 'כתובת ייחודית' : 'Referral Slug'}</h2>
            <p className="text-xs text-zinc-400">leadexpress.co/join/{slug || '...'}</p>
          </div>
        </div>

        <input
          value={slug}
          onChange={e => handleSlugChange(e.target.value)}
          className="w-full px-4 py-3 rounded-xl border border-zinc-200 text-sm font-mono outline-none focus:border-[#fe5b25] focus:ring-2 focus:ring-[#fe5b25]/10 transition-all"
        />

        {checkingSlug && <p className="text-xs text-zinc-400">{he ? 'בודק זמינות...' : 'Checking availability...'}</p>}
        {slugAvailable === true && slug.length >= 3 && slug !== partner.slug && (
          <p className="text-xs text-green-600 flex items-center gap-1"><Check className="w-3 h-3" /> {he ? 'זמין!' : 'Available!'}</p>
        )}
        {slugAvailable === false && (
          <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {he ? 'הכתובת תפוסה' : 'This slug is taken'}</p>
        )}
      </div>

      {/* Stripe Connect Payout Account */}
      <div className="glass-panel p-6 border-none shadow-lg space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
            stripeConnected
              ? 'bg-green-50 text-green-600'
              : stripeInProgress
                ? 'bg-amber-50 text-amber-600'
                : 'bg-[#635bff]/10 text-[#635bff]'
          }`}>
            {stripeConnected ? (
              <CheckCircle2 className="w-5 h-5" />
            ) : (
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.591-7.305z"/>
              </svg>
            )}
          </div>
          <div>
            <h2 className="text-sm font-bold text-zinc-900">
              {he ? 'חשבון תשלומים' : 'Payout Account'}
            </h2>
            <p className="text-xs text-zinc-400">
              {he ? 'קבל תשלומים ישירות דרך Stripe' : 'Receive payouts directly via Stripe'}
            </p>
          </div>
        </div>

        {/* State 1: Not connected */}
        {!partner.stripe_connect_id && (
          <div className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-5 space-y-3">
            <p className="text-sm text-zinc-700">
              {he
                ? 'חבר חשבון בנק דרך Stripe כדי לקבל תשלומים ישירות.'
                : 'Connect a bank account via Stripe to receive payouts directly.'}
            </p>
            <button
              onClick={handleStripeConnect}
              disabled={stripeLoading}
              className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-bold text-white transition-all shadow-md hover:shadow-lg disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg, #fe5b25, #e04d1c)' }}
            >
              {stripeLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.591-7.305z"/>
                </svg>
              )}
              {he ? 'התחבר עם Stripe' : 'Connect with Stripe'}
            </button>
          </div>
        )}

        {/* State 2: Onboarding in progress */}
        {stripeInProgress && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 space-y-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-amber-800">
                  {he ? 'ההרשמה ל-Stripe לא הושלמה' : 'Stripe onboarding incomplete'}
                </p>
                <p className="text-xs text-amber-600 mt-1">
                  {he
                    ? 'התחלת את תהליך החיבור אבל לא סיימת.'
                    : "You started connecting but didn't finish."}
                </p>
              </div>
            </div>
            <button
              onClick={handleStripeConnect}
              disabled={stripeLoading}
              className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-bold text-white transition-all shadow-md hover:shadow-lg disabled:opacity-60 bg-amber-600 hover:bg-amber-700"
            >
              {stripeLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ExternalLink className="w-4 h-4" />
              )}
              {he ? 'השלם הגדרה' : 'Complete Setup'}
            </button>
          </div>
        )}

        {/* State 3: Connected */}
        {stripeConnected && (
          <div className="rounded-xl border border-green-200 bg-green-50 p-5 space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
              <p className="text-sm font-semibold text-green-800">
                {he ? 'חשבון תשלומים מחובר' : 'Payout account connected'}
              </p>
            </div>
            <button
              onClick={handleStripeConnect}
              disabled={stripeLoading}
              className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-green-700 border border-green-300 bg-white hover:bg-green-50 transition-all disabled:opacity-60"
            >
              {stripeLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ExternalLink className="w-4 h-4" />
              )}
              {he ? 'נהל חשבון תשלומים' : 'Manage Payout Account'}
            </button>
          </div>
        )}
      </div>

      {/* Payout Preferences (fallback / manual) */}
      <div className="glass-panel p-6 border-none shadow-lg space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-green-50 text-green-600 flex items-center justify-center">
            <CreditCard className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-zinc-900">
              {stripeConnected
                ? (he ? 'אמצעי תשלום חלופי' : 'Fallback Payout Method')
                : (he ? 'העדפות תשלום' : 'Payout Preferences')}
            </h2>
            <p className="text-xs text-zinc-400">
              {stripeConnected
                ? (he ? 'ישמש רק אם Stripe לא זמין' : 'Used only if Stripe is unavailable')
                : (he ? 'איך תרצה לקבל את הכסף' : 'How you want to receive payouts')}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          {[
            { key: 'bank', label: he ? 'העברה בנקאית' : 'Bank Transfer' },
            { key: 'paypal', label: 'PayPal' },
            { key: 'zelle', label: 'Zelle' },
          ].map(method => (
            <button
              key={method.key}
              onClick={() => setPayoutMethod(method.key)}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold border transition-all ${
                payoutMethod === method.key
                  ? 'border-[#fe5b25] bg-[#fff4ef] text-[#e04d1c]'
                  : 'border-zinc-200 text-zinc-500 hover:border-zinc-300'
              }`}
            >
              {method.label}
            </button>
          ))}
        </div>

        <input
          value={payoutDetails}
          onChange={e => setPayoutDetails(e.target.value)}
          placeholder={
            payoutMethod === 'bank' ? (he ? 'פרטי חשבון בנק' : 'Bank account details') :
            payoutMethod === 'paypal' ? (he ? 'כתובת PayPal' : 'PayPal email') :
            (he ? 'מספר טלפון Zelle' : 'Zelle phone/email')
          }
          className="w-full px-4 py-3 rounded-xl border border-zinc-200 text-sm outline-none focus:border-[#fe5b25] focus:ring-2 focus:ring-[#fe5b25]/10 transition-all"
        />
      </div>

      {/* Save Button */}
      <button
        onClick={handleSave}
        disabled={saving || !displayName.trim() || slugAvailable === false}
        className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl text-sm font-bold text-white disabled:opacity-50 transition-all shadow-lg shadow-[#fe5b25]/20"
        style={{ background: 'linear-gradient(135deg, #fe5b25, #e04d1c)' }}
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        {he ? 'שמור שינויים' : 'Save Changes'}
      </button>
    </div>
  )
}
