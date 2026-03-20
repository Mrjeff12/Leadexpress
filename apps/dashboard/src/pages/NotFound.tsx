import { Link } from 'react-router-dom'
import { useI18n } from '../lib/i18n'

export default function NotFound() {
  const { locale } = useI18n()
  const he = locale === 'he'

  return (
    <div className="fixed inset-0 flex items-center justify-center">
      <div className="le-bg" />
      <div className="le-grain" />
      <div className="relative z-10 flex flex-col items-center gap-4 text-center px-6">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center font-bold text-white text-lg"
          style={{ background: 'hsl(14 99% 57%)' }}
        >
          LE
        </div>
        <h1 className="text-4xl font-bold text-gray-900 tracking-tight">404</h1>
        <p className="text-gray-500 text-sm">
          {he ? 'העמוד לא נמצא' : 'Page Not Found'}
        </p>
        <Link
          to="/"
          className="mt-2 px-5 py-2.5 text-sm font-semibold text-white rounded-xl transition-all bg-gradient-to-r from-[#fe5b25] to-[#ff7a4d] hover:from-[#e54e1a] hover:to-[#fe5b25] shadow-lg shadow-orange-200/40 hover:shadow-orange-300/50 active:scale-[0.98]"
        >
          {he ? 'חזרה לדף הבית' : 'Back to Home'}
        </Link>
      </div>
    </div>
  )
}
