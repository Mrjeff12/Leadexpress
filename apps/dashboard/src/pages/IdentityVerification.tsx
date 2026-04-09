import { useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import {
  Shield,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  Clock,
  RefreshCw,
  ArrowLeft,
  ArrowRight,
  Camera,
  Upload,
  Lock,
} from 'lucide-react'
import { useIdentityVerification } from '../hooks/useIdentityVerification'
import { useI18n } from '../lib/i18n'

const ERROR_MESSAGES: Record<string, { en: string; he: string }> = {
  consent_declined:           { en: 'You declined consent. Please try again.',                    he: 'דחית את ההסכמה. נסה שוב.' },
  document_expired:           { en: 'Your document has expired. Use a valid one.',                he: 'המסמך פג תוקף. השתמש במסמך בתוקף.' },
  document_type_not_supported:{ en: 'Document type not supported. Use passport, license, or ID.', he: 'סוג מסמך לא נתמך. השתמש בדרכון, רישיון או ת.ז.' },
  document_unverified_other:  { en: 'Could not verify document. Try a clearer photo.',            he: 'לא ניתן לאמת את המסמך. נסה תמונה ברורה יותר.' },
  selfie_face_mismatch:       { en: 'Selfie doesn\'t match your ID photo. Try again.',           he: 'הסלפי לא תואם לתמונה בתעודה. נסה שוב.' },
  selfie_manipulated:         { en: 'Selfie appears manipulated. Take a live photo.',             he: 'הסלפי נראה מעובד. צלם תמונה חיה.' },
  selfie_unverified_other:    { en: 'Could not verify your selfie. Try again.',                   he: 'לא ניתן לאמת את הסלפי. נסה שוב.' },
  under_supported_age:        { en: 'You must be at least 18 years old.',                         he: 'עליך להיות בן 18 לפחות.' },
}

export default function IdentityVerification() {
  const [searchParams] = useSearchParams()
  const nav = useNavigate()
  const { locale } = useI18n()
  const isHe = locale === 'he'
  const completed = searchParams.get('completed') === 'true'

  const {
    verification,
    loading,
    actionLoading,
    status,
    isVerified,
    isPending,
    needsRetry,
    startVerification,
    refetch,
  } = useIdentityVerification()

  // Poll for verification result after returning from Stripe (every 3s for up to 30s)
  useEffect(() => {
    if (!completed) return
    let cancelled = false
    let attempts = 0
    const maxAttempts = 10 // 10 * 3s = 30s

    const poll = async () => {
      if (cancelled || attempts >= maxAttempts) return
      attempts++
      await refetch()
      if (!cancelled && attempts < maxAttempts) {
        timer = setTimeout(poll, 3000)
      }
    }

    // Start first poll after 2s delay for Stripe webhook processing
    let timer: ReturnType<typeof setTimeout> = setTimeout(poll, 2000)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [completed, refetch])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[100dvh]">
        <Loader2 className="w-7 h-7 animate-spin text-[#fe5b25]" />
      </div>
    )
  }

  return (
    <div className="min-h-[100dvh] bg-white flex flex-col max-w-[480px] mx-auto" dir={isHe ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex items-center gap-3 px-5 pt-5 pb-3">
        <button
          onClick={() => nav(-1)}
          className="w-9 h-9 rounded-full bg-gray-50 flex items-center justify-center active:scale-95 transition-transform"
        >
          <ArrowLeft size={17} strokeWidth={1.8} className="rtl:rotate-180" />
        </button>
        <h1 className="text-[18px] font-bold tracking-tight">
          {isHe ? 'אימות זהות' : 'Identity Verification'}
        </h1>
      </div>

      <div className="flex-1 px-5 pt-2 pb-8">

        {/* ── Verified ── */}
        {isVerified && (
          <div className="text-center pt-8">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 size={32} className="text-green-500" />
            </div>
            <h2 className="text-[20px] font-bold tracking-tight mb-2">
              {isHe ? 'הזהות אומתה!' : 'Identity Verified!'}
            </h2>
            <p className="text-[13px] text-gray-500 leading-relaxed mb-6">
              {isHe
                ? 'הזהות שלך אומתה בהצלחה. תג "מאומת" מופיע בפרופיל שלך.'
                : 'Your identity has been verified. The "Verified" badge is now on your profile.'
              }
            </p>

            {verification?.first_name && (
              <div className="bg-green-50 rounded-2xl border border-green-100 p-4 mb-6">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <CheckCircle2 size={14} className="text-green-600" />
                  <span className="text-[14px] font-semibold text-green-800">
                    {verification.first_name} {verification.last_name}
                  </span>
                </div>
                {verification.document_type && (
                  <p className="text-[11px] text-green-600">
                    {verification.document_type.replace('_', ' ')}
                    {verification.verified_at && ` · ${new Date(verification.verified_at).toLocaleDateString()}`}
                  </p>
                )}
              </div>
            )}

            <button
              onClick={() => nav('/profile')}
              className="w-full bg-gray-900 text-white py-4 rounded-2xl text-[15px] font-semibold active:scale-[0.97] transition-transform"
            >
              {isHe ? 'חזרה לפרופיל' : 'Back to Profile'}
            </button>
          </div>
        )}

        {/* ── Pending / Processing ── */}
        {isPending && (
          <div className="text-center pt-8">
            <div className="w-16 h-16 rounded-2xl bg-amber-50 flex items-center justify-center mx-auto mb-4">
              <Clock size={28} className="text-amber-500 animate-pulse" />
            </div>
            <h2 className="text-[20px] font-bold tracking-tight mb-2">
              {isHe ? 'האימות בתהליך' : 'Verification In Progress'}
            </h2>
            <p className="text-[13px] text-gray-500 leading-relaxed mb-6">
              {isHe
                ? 'אנחנו בודקים את המסמכים שלך. זה בדרך כלל לוקח כמה דקות.'
                : 'We\'re reviewing your documents. This usually takes a few minutes.'
              }
            </p>

            {completed && (
              <div className="bg-blue-50 rounded-2xl border border-blue-100 p-4 mb-6">
                <p className="text-[12px] text-blue-700">
                  {isHe ? 'קיבלנו את המסמכים. התוצאות יופיעו בקרוב.' : 'Submission received. Results will appear shortly.'}
                </p>
              </div>
            )}

            <button
              onClick={refetch}
              className="inline-flex items-center gap-2 text-[13px] text-[#fe5b25] font-semibold active:scale-95 transition-transform"
            >
              <RefreshCw size={14} />
              {isHe ? 'בדוק סטטוס' : 'Check status'}
            </button>
          </div>
        )}

        {/* ── Failed / Retry ── */}
        {needsRetry && (
          <div className="text-center pt-8">
            <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle size={28} className="text-red-500" />
            </div>
            <h2 className="text-[20px] font-bold tracking-tight mb-2">
              {isHe ? 'האימות נכשל' : 'Verification Failed'}
            </h2>
            <p className="text-[13px] text-gray-500 leading-relaxed mb-8">
              {verification?.error_code
                ? (isHe
                    ? ERROR_MESSAGES[verification.error_code]?.he
                    : ERROR_MESSAGES[verification.error_code]?.en
                  ) || verification.error_reason || (isHe ? 'אירעה שגיאה. נסה שוב.' : 'An error occurred. Please try again.')
                : (isHe ? 'האימות לא הושלם. נסה שוב.' : 'Verification could not be completed. Try again.')
              }
            </p>

            <button
              onClick={startVerification}
              disabled={actionLoading}
              className="w-full bg-[#fe5b25] text-white py-4 rounded-2xl text-[15px] font-semibold flex items-center justify-center gap-2 active:scale-[0.97] transition-transform disabled:opacity-50"
            >
              {actionLoading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <RefreshCw size={16} />
              )}
              {isHe ? 'נסה שוב' : 'Try Again'}
            </button>
          </div>
        )}

        {/* ── Not Started (Intro) ── */}
        {status === 'none' && (
          <>
            {/* Hero image */}
            <div className="relative -mx-5 h-48 overflow-hidden rounded-b-3xl mb-6">
              <img src="/reviews-technician-v3.jpg" alt="" className="w-full h-full object-cover object-top" />
              <div className="absolute inset-0 bg-gradient-to-t from-white via-white/30 to-transparent" />
              <div className="absolute bottom-4 left-5 right-5">
                <div className="flex items-center gap-1.5">
                  {[1,2,3,4,5].map(i => <span key={i} className="text-amber-400 text-sm">★</span>)}
                  <span className="text-[11px] text-gray-600 font-medium ml-1">
                    {isHe ? 'קבלנים מאומתים מקבלים 3x יותר עבודות' : 'Verified contractors get 3x more jobs'}
                  </span>
                </div>
              </div>
            </div>

            <div className="text-center">
              <h2 className="text-[22px] font-bold tracking-tight mb-2">
                {isHe ? 'קבל אימות, קבל יותר עבודות' : 'Get Verified, Get More Jobs'}
              </h2>
              <p className="text-[13px] text-gray-500 leading-relaxed mb-2">
                {isHe
                  ? <>אמת את הזהות שלך כדי לקבל תג מאומת ולפתוח <strong className="text-[#fe5b25]">+30% יותר לידים</strong></>
                  : <>Verify your identity to get the verified badge and unlock <strong className="text-[#fe5b25]">+30% more leads</strong></>
                }
              </p>
            </div>

            {/* Why it matters */}
            <div className="flex justify-between gap-2 my-5 px-2">
              {[
                { icon: '⚡', label: isHe ? 'עדיפות\nבלידים' : 'Lead\nPriority', color: 'bg-orange-50 text-orange-600' },
                { icon: '✓', label: isHe ? 'תג\nמאומת' : 'Verified\nBadge', color: 'bg-green-50 text-green-600' },
                { icon: '🔒', label: isHe ? 'אמון\nלקוחות' : 'Client\nTrust', color: 'bg-blue-50 text-blue-600' },
                { icon: '💰', label: isHe ? 'יותר\nעבודות' : 'More\nJobs', color: 'bg-purple-50 text-purple-600' },
              ].map((b, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1.5 p-3 rounded-2xl bg-gray-50">
                  <span className="text-xl">{b.icon}</span>
                  <span className="text-[10px] font-semibold text-gray-600 text-center whitespace-pre-line leading-tight">{b.label}</span>
                </div>
              ))}
            </div>

            {/* Steps */}
            <div className="space-y-3 text-left mb-6" dir={isHe ? 'rtl' : 'ltr'}>
              {[
                {
                  n: '1', icon: Upload,
                  title: isHe ? 'צלם תעודה' : 'Upload ID',
                  desc: isHe ? 'תעודת זהות, דרכון או רישיון נהיגה' : 'Photo of government-issued ID',
                },
                {
                  n: '2', icon: Camera,
                  title: isHe ? 'צלם סלפי' : 'Take a selfie',
                  desc: isHe ? 'התאמת פנים מהירה לאבטחה' : 'Quick face match for security',
                },
                {
                  n: '3', icon: Lock,
                  title: isHe ? 'קבל אישור' : 'Get approved',
                  desc: isHe ? 'תוצאות תוך דקות' : 'Results within minutes',
                },
              ].map((s) => {
                const Icon = s.icon
                return (
                  <div key={s.n} className="bg-white rounded-2xl border border-gray-100 shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-4 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-[#fe5b25] text-white flex items-center justify-center text-[13px] font-bold flex-shrink-0">
                      {s.n}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-semibold text-gray-900">{s.title}</p>
                      <p className="text-[11px] text-gray-400">{s.desc}</p>
                    </div>
                    <Icon size={16} className="text-gray-300 flex-shrink-0" />
                  </div>
                )
              })}
            </div>

            <button
              onClick={startVerification}
              disabled={actionLoading}
              className="w-full bg-[#fe5b25] text-white py-4 rounded-2xl text-[15px] font-bold flex items-center justify-center gap-2 active:scale-[0.97] transition-transform disabled:opacity-50 shadow-lg shadow-[#fe5b25]/20"
            >
              {actionLoading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <>
                  {isHe ? '✓ התחל אימות — חינם' : '✓ Start Verification — Free'}
                  <ArrowRight size={16} className="rtl:rotate-180" />
                </>
              )}
            </button>
            <p className="text-[10px] text-gray-400 mt-3 text-center">
              {isHe ? 'לוקח פחות מ-2 דקות • מעובד ע"י Stripe' : 'Takes less than 2 minutes • Processed by Stripe'}
            </p>

            {/* What we verify */}
            <div className="mt-6 bg-gray-50 rounded-2xl p-5 space-y-3">
              <h3 className="text-[13px] font-semibold text-gray-900">
                {isHe ? 'מה אנחנו מאמתים' : 'What we verify'}
              </h3>
              <div className="space-y-2">
                {[
                  isHe ? 'תעודה ממשלתית (דרכון, רישיון או ת.ז.)' : 'Government-issued ID (passport, license, or ID)',
                  isHe ? 'התאמת סלפי לתמונה בתעודה' : 'Selfie matching to your document photo',
                  isHe ? 'זיהוי חיות למניעת הונאה' : 'Liveness detection to prevent fraud',
                ].map((text, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <CheckCircle2 size={12} className="text-green-500 flex-shrink-0" />
                    <span className="text-[12px] text-gray-500">{text}</span>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-gray-300 pt-1">
                {isHe
                  ? 'המסמכים מעובדים ע"י Stripe ולא נשמרים בשרתים שלנו.'
                  : 'Documents processed by Stripe. Not stored on our servers.'
                }
              </p>
            </div>
          </>
        )}

        {/* ── What we verify (retry state) ── */}
        {needsRetry && (
          <div className="mt-8 bg-gray-50 rounded-2xl p-5 space-y-3">
            <h3 className="text-[13px] font-semibold text-gray-900">
              {isHe ? 'מה אנחנו מאמתים' : 'What we verify'}
            </h3>
            <div className="space-y-2">
              {[
                isHe ? 'תעודה ממשלתית (דרכון, רישיון או ת.ז.)' : 'Government-issued ID (passport, license, or ID)',
                isHe ? 'התאמת סלפי לתמונה בתעודה' : 'Selfie matching to your document photo',
                isHe ? 'זיהוי חיות למניעת הונאה' : 'Liveness detection to prevent fraud',
              ].map((text, i) => (
                <div key={i} className="flex items-center gap-2">
                  <CheckCircle2 size={12} className="text-green-500 flex-shrink-0" />
                  <span className="text-[12px] text-gray-500">{text}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
