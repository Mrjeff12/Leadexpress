import { useI18n } from '../../lib/i18n'
import { DAY_KEYS, DAY_LABELS, type DayKey, type WorkingHours } from '../../lib/working-hours'

interface Props {
  hours: WorkingHours
  onChange: (hours: WorkingHours) => void
}

export default function WorkingSchedule({ hours, onChange }: Props) {
  const { locale } = useI18n()

  function toggleDay(day: DayKey) {
    onChange({ ...hours, [day]: { ...hours[day], enabled: !hours[day].enabled } })
  }

  function setTime(day: DayKey, field: 'start' | 'end', value: string) {
    onChange({ ...hours, [day]: { ...hours[day], [field]: value } })
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-zinc-700">
        {locale === 'he' ? 'ימי ושעות עבודה' : 'Working Days & Hours'}
      </h3>

      <div className="space-y-1.5">
        {DAY_KEYS.map((day) => {
          const schedule = hours[day]
          const label = locale === 'he' ? DAY_LABELS[day].he : DAY_LABELS[day].en

          return (
            <div
              key={day}
              className={[
                'flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all',
                schedule.enabled
                  ? 'bg-white border border-zinc-200'
                  : 'bg-zinc-50 border border-zinc-100 opacity-60',
              ].join(' ')}
            >
              <button
                type="button"
                onClick={() => toggleDay(day)}
                className={[
                  'relative w-10 h-5 rounded-full transition-colors shrink-0',
                  schedule.enabled ? 'bg-emerald-500' : 'bg-zinc-300',
                ].join(' ')}
              >
                <span
                  className={[
                    'absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform',
                    schedule.enabled ? 'translate-x-5' : 'translate-x-0.5',
                  ].join(' ')}
                />
              </button>

              <span className="text-sm font-medium text-zinc-700 w-20">{label}</span>

              {schedule.enabled ? (
                <div className="flex items-center gap-2 ml-auto">
                  <input
                    type="time"
                    value={schedule.start}
                    onChange={(e) => setTime(day, 'start', e.target.value)}
                    className="rounded-lg border border-zinc-200 px-2 py-1 text-xs text-zinc-700 outline-none focus:border-emerald-400"
                  />
                  <span className="text-xs text-zinc-400">–</span>
                  <input
                    type="time"
                    value={schedule.end}
                    onChange={(e) => setTime(day, 'end', e.target.value)}
                    className="rounded-lg border border-zinc-200 px-2 py-1 text-xs text-zinc-700 outline-none focus:border-emerald-400"
                  />
                </div>
              ) : (
                <span className="ml-auto text-xs text-zinc-400 italic">
                  {locale === 'he' ? 'יום חופש' : 'Day off'}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
