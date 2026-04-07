import { useState, useEffect } from 'react'
import { X, MessageCircle } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { useContractor } from '../lib/useContractor'
import { useI18n } from '../lib/i18n'

const REBECA_PHONE = '18623582898'

const WA = ({ className = '' }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
)

/**
 * Popup that appears for new web-signup users who haven't connected with Rebeca on WhatsApp.
 * Without this, we can't send them leads via WhatsApp.
 */
export default function RebecaConnectPopup() {
  const { profile, user } = useAuth()
  const { contractor, loading: cLoading } = useContractor()
  const { locale } = useI18n()
  const he = locale === 'he'
  const [show, setShow] = useState(false)
  const [dismissed, setDismissed] = useState(() => localStorage.getItem('rebeca_connect_dismissed') === '1')

  useEffect(() => {
    if (!profile?.id || dismissed || cLoading || !contractor) return

    const hasWindow = contractor.wa_window_until && new Date(contractor.wa_window_until) > new Date()
    if (hasWindow) return

    const isWebSignup = user?.user_metadata?.source === 'web_signup'
    if (isWebSignup || (contractor.wa_notify && !contractor.wa_window_until)) {
      setTimeout(() => setShow(true), 2000)
    }
  }, [profile?.id, dismissed, user, contractor, cLoading])

  if (!show || dismissed) return null

  const name = profile?.full_name?.split(' ')[0] || ''
  const waMessage = he
    ? `היי רבקה! אני ${name}, נרשמתי עכשיו ורוצה להתחיל לקבל לידים 👋`
    : `Hey Rebeca! I'm ${name}, I just signed up and want to start getting leads 👋`
  const waLink = `https://wa.me/${REBECA_PHONE}?text=${encodeURIComponent(waMessage)}`

  function handleDismiss() {
    localStorage.setItem('rebeca_connect_dismissed', '1')
    setDismissed(true)
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40 z-[100] animate-in fade-in duration-300" onClick={handleDismiss} />

      {/* Popup */}
      <div className="fixed inset-x-4 bottom-4 md:inset-auto md:bottom-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-[420px] bg-white rounded-3xl shadow-2xl z-[101] overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
        {/* Green header */}
        <div className="bg-gradient-to-br from-[#25D366] to-[#128C7E] px-6 pt-6 pb-8 text-center relative">
          <button onClick={handleDismiss} className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors">
            <X className="w-4 h-4 text-white" />
          </button>
          <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-3">
            <WA className="w-9 h-9 text-white" />
          </div>
          <h2 className="text-white text-xl font-semibold mb-1">
            {he ? 'עוד צעד אחד!' : 'One more step!'}
          </h2>
          <p className="text-white/80 text-sm">
            {he ? 'פתח שיחה עם רבקה כדי לקבל לידים' : 'Chat with Rebeca to start getting leads'}
          </p>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200/60 rounded-xl px-4 py-3 mb-5">
            <MessageCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800 leading-relaxed">
              {he
                ? 'בלי לפתוח שיחה עם רבקה בWhatsApp, לא נוכל לשלוח לך לידים. זה הכרחי.'
                : "Without opening a WhatsApp chat with Rebeca, we can't send you leads. This is required."}
            </p>
          </div>

          <a
            href={waLink}
            target="_blank"
            rel="noreferrer"
            onClick={handleDismiss}
            className="w-full h-[52px] rounded-2xl text-[15px] font-semibold flex items-center justify-center gap-3 bg-[#25D366] text-white shadow-lg shadow-[#25D366]/20 hover:bg-[#1ebe5a] active:scale-[0.97] transition-all"
          >
            <WA className="w-5 h-5" />
            {he ? 'פתח שיחה עם רבקה' : 'Open chat with Rebeca'}
          </a>

          <button onClick={handleDismiss} className="w-full text-center mt-3 text-sm text-gray-400 hover:text-gray-600 transition-colors py-2">
            {he ? 'אעשה את זה אחר כך' : "I'll do this later"}
          </button>
        </div>
      </div>
    </>
  )
}
