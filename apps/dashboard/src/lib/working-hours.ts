export type DayKey = 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat'

export interface DaySchedule {
  enabled: boolean
  start: string // "HH:mm"
  end: string   // "HH:mm"
}

export type WorkingHours = Record<DayKey, DaySchedule>

export const DAY_KEYS: DayKey[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

export const DAY_LABELS: Record<DayKey, { en: string; he: string }> = {
  sun: { en: 'Sunday',    he: 'ראשון' },
  mon: { en: 'Monday',    he: 'שני' },
  tue: { en: 'Tuesday',   he: 'שלישי' },
  wed: { en: 'Wednesday', he: 'רביעי' },
  thu: { en: 'Thursday',  he: 'חמישי' },
  fri: { en: 'Friday',    he: 'שישי' },
  sat: { en: 'Saturday',  he: 'שבת' },
}

export const DEFAULT_WORKING_HOURS: WorkingHours = {
  sun: { enabled: false, start: '09:00', end: '18:00' },
  mon: { enabled: true,  start: '09:00', end: '18:00' },
  tue: { enabled: true,  start: '09:00', end: '18:00' },
  wed: { enabled: true,  start: '09:00', end: '18:00' },
  thu: { enabled: true,  start: '09:00', end: '18:00' },
  fri: { enabled: true,  start: '09:00', end: '18:00' },
  sat: { enabled: false, start: '09:00', end: '18:00' },
}
