export type ProfessionId =
  | 'hvac' | 'air_duct' | 'chimney' | 'dryer_vent'
  | 'garage_door' | 'locksmith' | 'roofing'
  | 'plumbing' | 'electrical' | 'painting'
  | 'cleaning' | 'carpet_cleaning'
  | 'renovation' | 'fencing' | 'landscaping'
  | 'tiling' | 'kitchen' | 'bathroom' | 'pool'
  | 'moving'

export interface ProfessionMeta {
  id: ProfessionId
  emoji: string
  en: string
  he: string
}

export const PROFESSIONS: ProfessionMeta[] = [
  { id: 'hvac',            emoji: '❄️',  en: 'HVAC',             he: 'מזגנים' },
  { id: 'air_duct',        emoji: '💨',  en: 'Air Duct',         he: 'תעלות אוויר' },
  { id: 'chimney',         emoji: '🏠',  en: 'Chimney',          he: 'ארובות' },
  { id: 'dryer_vent',      emoji: '🌀',  en: 'Dryer Vent',       he: 'פתח מייבש' },
  { id: 'garage_door',     emoji: '🚪',  en: 'Garage Door',      he: 'דלת מוסך' },
  { id: 'locksmith',       emoji: '🔑',  en: 'Locksmith',        he: 'מנעולן' },
  { id: 'roofing',         emoji: '🏗️',  en: 'Roofing',          he: 'גגות' },
  { id: 'plumbing',        emoji: '🔧',  en: 'Plumbing',         he: 'אינסטלציה' },
  { id: 'electrical',      emoji: '⚡',  en: 'Electrical',       he: 'חשמל' },
  { id: 'painting',        emoji: '🎨',  en: 'Painting',         he: 'צביעה' },
  { id: 'cleaning',        emoji: '🧹',  en: 'Cleaning',         he: 'ניקיון' },
  { id: 'carpet_cleaning', emoji: '🧼',  en: 'Carpet Cleaning',  he: 'ניקוי שטיחים' },
  { id: 'renovation',      emoji: '🔨',  en: 'Renovation',       he: 'שיפוצים' },
  { id: 'fencing',         emoji: '🏗️',  en: 'Fencing',          he: 'גדרות' },
  { id: 'landscaping',     emoji: '🌿',  en: 'Landscaping',      he: 'גינון' },
  { id: 'tiling',          emoji: '🔲',  en: 'Tiling',           he: 'ריצוף' },
  { id: 'kitchen',         emoji: '🍳',  en: 'Kitchen',          he: 'מטבחים' },
  { id: 'bathroom',        emoji: '🚿',  en: 'Bathroom',         he: 'חדרי אמבטיה' },
  { id: 'pool',            emoji: '🏊',  en: 'Pool',             he: 'בריכות' },
  { id: 'moving',          emoji: '📦',  en: 'Moving',           he: 'הובלות' },
]
