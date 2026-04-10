import { Check } from 'lucide-react'
import { useI18n } from '../../lib/i18n'

interface Props {
  phone: string
  country: '+1' | '+972'
  onPhoneChange: (value: string) => void
  onCountryChange: (country: '+1' | '+972') => void
}

export default function PhoneStep({ phone, country, onPhoneChange, onCountryChange }: Props) {
  const { locale } = useI18n()
  const he = locale === 'he'

  function format(raw: string) {
    const digits = raw.replace(/\D/g, '')
    if (country === '+972') {
      let f = digits
      if (digits.length > 2) f = digits.slice(0, 2) + '-' + digits.slice(2)
      if (digits.length > 5) f = digits.slice(0, 2) + '-' + digits.slice(2, 5) + '-' + digits.slice(5, 9)
      return f
    }
    let f = digits
    if (digits.length > 3) f = '(' + digits.slice(0, 3) + ') ' + digits.slice(3)
    if (digits.length > 6) f = '(' + digits.slice(0, 3) + ') ' + digits.slice(3, 6) + '-' + digits.slice(6, 10)
    return f
  }

  return (
    <div className="space-y-5">
      <div className="text-center">
        <h1 className="text-base md:text-lg font-bold text-zinc-900">
          {he ? 'מספר הWhatsApp שלך' : 'Your WhatsApp Number'}
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          {he
            ? 'הזן את מספר הWhatsApp שלך כדי שנוכל לשלוח לך לידים'
            : 'Enter your WhatsApp number so we can send you leads'}
        </p>
      </div>

      <div className="max-w-sm mx-auto space-y-4">
        <label className="block text-sm font-semibold text-zinc-700 text-center">
          {he ? 'מספר WhatsApp' : 'WhatsApp Number'}
        </label>
        <div className="flex flex-col sm:flex-row gap-2">
          <select
            value={country}
            onChange={(e) => onCountryChange(e.target.value as '+1' | '+972')}
            className="w-full sm:w-auto rounded-xl border-2 border-zinc-200 bg-white px-3 py-3 text-sm font-semibold text-zinc-700 outline-none focus:border-[#fe5b25] transition-colors"
          >
            <option value="+1">🇺🇸 +1</option>
            <option value="+972">🇮🇱 +972</option>
          </select>
          <input
            type="tel"
            placeholder={country === '+972' ? '50-123-4567' : '(555) 123-4567'}
            value={phone}
            onChange={(e) => onPhoneChange(format(e.target.value))}
            className="flex-1 rounded-xl border-2 border-zinc-200 bg-white px-4 py-3 text-sm font-semibold text-zinc-700 outline-none focus:border-[#fe5b25] transition-colors placeholder:text-zinc-300"
          />
        </div>

        {phone.replace(/\D/g, '').length >= 10 && (
          <div className="flex items-center gap-2 justify-center text-sm text-emerald-600 font-medium">
            <Check className="w-4 h-4" />
            {he ? 'מספר תקין' : 'Looks good!'}
          </div>
        )}

        <div className="rounded-xl bg-[#fff4ef] border border-[#fee8df] px-4 py-3 text-xs text-[#e04d1c] text-center leading-relaxed">
          {he
            ? 'נשלח לך לידים ישירות בWhatsApp. ודא שזה המספר הנכון.'
            : "We'll send leads directly to your WhatsApp. Make sure this is the right number."}
        </div>
      </div>
    </div>
  )
}
