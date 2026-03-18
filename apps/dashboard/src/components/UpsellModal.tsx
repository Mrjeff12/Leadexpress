import { Rocket } from 'lucide-react'
import { useI18n } from '../lib/i18n'

interface UpsellModalProps {
  isOpen: boolean
  onClose: () => void
  title?: { en: string; he: string }
  message?: { en: string; he: string }
  featureHighlight?: string
}

export default function UpsellModal({ isOpen, onClose, title, message, featureHighlight }: UpsellModalProps) {
  const { locale } = useI18n()
  const he = locale === 'he'

  if (!isOpen) return null

  const defaultTitle = { en: 'Want more?', he: 'רוצה עוד?' }
  const defaultMessage = {
    en: 'Upgrade your plan to unlock more capacity and premium features.',
    he: 'שדרג את התוכנית שלך כדי לפתוח עוד יכולות ותכונות פרימיום.',
  }

  const t = title || defaultTitle
  const m = message || defaultMessage

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-fade-in" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-scale-in" onClick={(e) => e.stopPropagation()}>
        {/* Orange gradient header */}
        <div className="px-6 pt-6 pb-4" style={{ background: 'linear-gradient(135deg, #fe5b25 0%, #ff8a5c 100%)' }}>
          <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center mx-auto mb-3">
            <Rocket className="w-7 h-7 text-white" />
          </div>
          <h3 className="text-xl font-bold text-white text-center">
            {he ? t.he : t.en}
          </h3>
          {featureHighlight && (
            <div className="mt-2 mx-auto w-fit px-3 py-1 rounded-full bg-white/20 backdrop-blur text-[11px] font-bold text-white">
              {featureHighlight}
            </div>
          )}
        </div>

        {/* Body */}
        <div className="px-6 pt-4 pb-6">
          <p className="text-sm text-stone-600 text-center mb-5 leading-relaxed">
            {he ? m.he : m.en}
          </p>

          <button
            onClick={() => {
              onClose()
              window.location.href = '/subscription'
            }}
            className="w-full py-3 text-sm font-bold text-white rounded-xl transition-all shadow-lg shadow-[#fe5b25]/20 hover:shadow-[#fe5b25]/40"
            style={{ background: 'linear-gradient(135deg, #fe5b25, #e04d1c)' }}
          >
            {he ? 'שדרג עכשיו' : 'Upgrade Now'}
          </button>

          <button
            onClick={onClose}
            className="w-full mt-2 py-2 text-xs font-medium text-stone-400 hover:text-stone-600 transition-colors"
          >
            {he ? 'אולי אחר כך' : 'Maybe later'}
          </button>
        </div>
      </div>
    </div>
  )
}
