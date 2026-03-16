import { useI18n } from '../../lib/i18n'
import { PROFESSIONS, type ProfessionId } from '../../lib/professions'

interface Props {
  selected: ProfessionId[]
  onToggle: (id: ProfessionId) => void
}

export default function ProfessionGrid({ selected, onToggle }: Props) {
  const { locale } = useI18n()

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-zinc-700">
        {locale === 'he' ? 'מקצועות' : 'Professions'}
      </h3>
      <div className="grid grid-cols-2 gap-2">
        {PROFESSIONS.map((prof) => {
          const active = selected.includes(prof.id)
          return (
            <button
              key={prof.id}
              type="button"
              onClick={() => onToggle(prof.id)}
              className={[
                'flex items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm transition-all duration-150',
                active
                  ? 'bg-emerald-50 ring-2 ring-emerald-300 text-emerald-800 font-medium shadow-sm'
                  : 'bg-white/60 border border-zinc-200 text-zinc-600 hover:bg-white hover:shadow-sm',
              ].join(' ')}
            >
              <span className="text-base">{prof.emoji}</span>
              <span className="flex-1 truncate">{locale === 'he' ? prof.he : prof.en}</span>
              {active && (
                <svg className="w-4 h-4 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
