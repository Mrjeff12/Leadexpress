import { Check } from 'lucide-react'
import { DAY_KEYS, DAY_LABELS, type DayKey, type WorkingHours } from '../../lib/working-hours'
import { useI18n } from '../../lib/i18n'

interface Props {
  workingHours: WorkingHours
  setWorkingHours: React.Dispatch<React.SetStateAction<WorkingHours>>
}

export default function HoursStep({ workingHours, setWorkingHours }: Props) {
  const { locale } = useI18n()
  const he = locale === 'he'

  return (
    <div className="space-y-5">
      <div className="text-center">
        <h1 className="text-base md:text-lg font-bold text-zinc-900">
          {he ? 'שעות הפעילות שלך' : 'Your active hours'}
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          {he
            ? 'הגדר מתי אתה זמין כדי שנשלח לידים בזמן הנכון'
            : "Set your hours so leads arrive when you're available"}
        </p>
      </div>

      <div className="flex gap-2 justify-center">
        {[
          { label: he ? 'ראשון-חמישי' : 'Mon–Fri', days: ['mon', 'tue', 'wed', 'thu', 'fri'] as DayKey[] },
          { label: he ? 'כל יום' : 'Every day', days: DAY_KEYS },
        ].map((preset) => (
          <button
            key={preset.label}
            type="button"
            onClick={() => {
              setWorkingHours((prev) => {
                const next = { ...prev }
                for (const key of DAY_KEYS) {
                  next[key] = { ...next[key], enabled: preset.days.includes(key) }
                }
                return next
              })
            }}
            className="px-4 py-2 rounded-full text-xs font-semibold border border-zinc-200 text-zinc-600 hover:border-[#fe5b25] hover:text-[#fe5b25] transition-all"
          >
            {preset.label}
          </button>
        ))}
      </div>

      <div className="space-y-2 max-w-sm mx-auto">
        {DAY_KEYS.map((day) => {
          const schedule = workingHours[day]
          return (
            <div
              key={day}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${
                schedule.enabled
                  ? 'border-[#fe5b25]/20 bg-[#fff4ef]'
                  : 'border-zinc-100 bg-zinc-50'
              }`}
            >
              <button
                type="button"
                onClick={() => {
                  setWorkingHours((prev) => ({
                    ...prev,
                    [day]: { ...prev[day], enabled: !prev[day].enabled },
                  }))
                }}
                className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                  schedule.enabled
                    ? 'bg-[#fe5b25] border-[#fe5b25]'
                    : 'border-zinc-300 bg-white'
                }`}
              >
                {schedule.enabled && <Check className="w-3 h-3 text-white" />}
              </button>
              <span
                className={`text-sm font-medium flex-1 ${
                  schedule.enabled ? 'text-zinc-900' : 'text-zinc-400'
                }`}
              >
                {he ? DAY_LABELS[day].he : DAY_LABELS[day].en}
              </span>
              {schedule.enabled && (
                <div className="flex items-center gap-1.5">
                  <input
                    type="time"
                    value={schedule.start}
                    onChange={(e) => {
                      setWorkingHours((prev) => ({
                        ...prev,
                        [day]: { ...prev[day], start: e.target.value },
                      }))
                    }}
                    className="rounded-lg border border-zinc-200 px-2 py-1 text-xs font-mono text-zinc-700 outline-none focus:border-[#fe5b25] w-[75px] md:w-[90px]"
                  />
                  <span className="text-zinc-400 text-xs">–</span>
                  <input
                    type="time"
                    value={schedule.end}
                    onChange={(e) => {
                      setWorkingHours((prev) => ({
                        ...prev,
                        [day]: { ...prev[day], end: e.target.value },
                      }))
                    }}
                    className="rounded-lg border border-zinc-200 px-2 py-1 text-xs font-mono text-zinc-700 outline-none focus:border-[#fe5b25] w-[75px] md:w-[90px]"
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
