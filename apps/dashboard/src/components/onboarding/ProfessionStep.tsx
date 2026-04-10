import { Check } from 'lucide-react'
import { PROFESSIONS } from '../../lib/professions'
import { useI18n } from '../../lib/i18n'

interface Props {
  professions: string[]
  maxProf: number
  onToggle: (id: string) => void
}

export default function ProfessionStep({ professions, maxProf, onToggle }: Props) {
  const { locale } = useI18n()
  const he = locale === 'he'

  return (
    <div className="space-y-5">
      <div className="text-center">
        <h1 className="text-base md:text-lg font-bold text-zinc-900">
          {he ? 'מה סוג העבודה שלך?' : 'What services do you offer?'}
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          {he
            ? 'בחר את סוגי העבודה שלך ונתאים לך לידים רלוונטיים'
            : "Pick your services so we send you the right leads"}
          {maxProf > 0 && (
            <span className="ml-2 text-[#fe5b25] font-semibold">
              ({professions.length}/{maxProf})
            </span>
          )}
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {PROFESSIONS.map((prof) => {
          const selected = professions.includes(prof.id)
          const atLimit = maxProf > 0 && professions.length >= maxProf && !selected
          return (
            <button
              key={prof.id}
              type="button"
              disabled={atLimit}
              onClick={() => onToggle(prof.id)}
              className={`relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                selected
                  ? 'border-[#fe5b25] bg-[#fff4ef] shadow-sm'
                  : atLimit
                  ? 'border-zinc-100 bg-zinc-50 opacity-40 cursor-not-allowed'
                  : 'border-zinc-200 bg-white hover:border-[#fe5b25]/40 hover:shadow-sm'
              }`}
            >
              {selected && (
                <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[#fe5b25] flex items-center justify-center">
                  <Check className="w-3 h-3 text-white" />
                </div>
              )}
              <span className="text-2xl">{prof.emoji}</span>
              <span
                className={`text-xs font-semibold text-center ${
                  selected ? 'text-[#e04d1c]' : 'text-zinc-700'
                }`}
              >
                {he ? prof.he : prof.en}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
