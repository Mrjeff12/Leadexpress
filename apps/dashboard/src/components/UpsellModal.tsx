import { Lock } from 'lucide-react'
import { useI18n } from '../lib/i18n'

interface UpsellModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function UpsellModal({ isOpen, onClose }: UpsellModalProps) {
  const { locale } = useI18n()

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 text-center">
        <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
          <Lock className="w-6 h-6 text-amber-600" />
        </div>
        <h3 className="text-lg font-bold text-stone-900 mb-2">
          {locale === 'he' ? 'תכונת פרימיום' : 'Premium Feature'}
        </h3>
        <p className="text-sm text-stone-600 mb-6">
          {locale === 'he' 
            ? 'העברת לידים לקבלני משנה זמינה בתוכניות Pro ו-Unlimited. שדרג את החשבון שלך כדי להשתמש בתכונה זו.' 
            : 'Forwarding leads to subcontractors is available on Pro and Unlimited plans. Upgrade your account to use this feature.'}
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-50 rounded-xl transition-colors"
          >
            {locale === 'he' ? 'סגור' : 'Close'}
          </button>
          <button
            onClick={() => {
              onClose()
              window.location.href = '/subscription'
            }}
            className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors"
          >
            {locale === 'he' ? 'שדרג עכשיו' : 'Upgrade Now'}
          </button>
        </div>
      </div>
    </div>
  )
}
