// Profession display config
export const PROFESSIONS: Record<string, { label: string; labelHe: string; emoji: string; aliases: string[] }> = {
  hvac: { label: 'HVAC / AC', labelHe: 'מזגנים', emoji: '❄️', aliases: ['ac', 'air conditioning', 'hvac', 'cooling', 'heating', 'מזגן', 'מזגנים', 'מיזוג'] },
  air_duct: { label: 'Air Duct', labelHe: 'תעלות אוויר', emoji: '💨', aliases: ['air duct', 'airduct', 'air-duct', 'duct cleaning', 'אייר דאקט', 'תעלות אוויר'] },
  chimney: { label: 'Chimney', labelHe: 'ארובות', emoji: '🏠', aliases: ['chimney', 'chimney sweep', 'צימני', 'ארובה'] },
  dryer_vent: { label: 'Dryer Vent', labelHe: 'פתח מייבש', emoji: '🌀', aliases: ['dryer vent', 'dryer-vent', 'dryer', 'דרייר'] },
  garage_door: { label: 'Garage Door', labelHe: 'דלת מוסך', emoji: '🚪', aliases: ['garage door', 'garage', 'גראג׳', 'דלת מוסך'] },
  locksmith: { label: 'Locksmith', labelHe: 'מנעולן', emoji: '🔑', aliases: ['locksmith', 'lock', 'car key', 'מנעולן', 'מפתח'] },
  roofing: { label: 'Roofing', labelHe: 'גגות', emoji: '🏗️', aliases: ['roofing', 'roof', 'shingles', 'גגות', 'גג'] },
  plumbing: { label: 'Plumbing', labelHe: 'אינסטלציה', emoji: '🔧', aliases: ['plumber', 'plumbing', 'שרברב', 'אינסטלטור', 'אינסטלציה'] },
  electrical: { label: 'Electrical', labelHe: 'חשמל', emoji: '⚡', aliases: ['electrician', 'electrical', 'חשמלאי', 'חשמל'] },
  painting: { label: 'Painting', labelHe: 'צביעה', emoji: '🎨', aliases: ['painting', 'painter', 'paint', 'צביעה', 'צבע'] },
  cleaning: { label: 'Cleaning', labelHe: 'ניקיון', emoji: '🧹', aliases: ['cleaning', 'pressure wash', 'power wash', 'ניקוי', 'ניקיון'] },
  carpet_cleaning: { label: 'Carpet Cleaning', labelHe: 'ניקוי שטיחים', emoji: '🧼', aliases: ['carpet', 'carpet cleaning', 'שטיחים', 'ניקוי שטיחים'] },
  renovation: { label: 'Renovation', labelHe: 'שיפוצים', emoji: '🔨', aliases: ['renovation', 'remodel', 'remodeling', 'שיפוץ', 'שיפוצים'] },
  fencing: { label: 'Fencing & Railing', labelHe: 'גדרות ומעקות', emoji: '🏗️', aliases: ['fence', 'fencing', 'railing', 'gate', 'גדר', 'מעקה', 'שער'] },
  landscaping: { label: 'Landscaping', labelHe: 'גינון', emoji: '🌿', aliases: ['landscaping', 'lawn', 'garden', 'גינון', 'דשא'] },
  tiling: { label: 'Tiling', labelHe: 'ריצוף', emoji: '🔲', aliases: ['tiling', 'tile', 'tiles', 'ריצוף', 'אריחים'] },
  kitchen: { label: 'Kitchen', labelHe: 'מטבחים', emoji: '🍳', aliases: ['kitchen', 'cabinets', 'מטבח', 'מטבחים'] },
  bathroom: { label: 'Bathroom', labelHe: 'חדרי אמבטיה', emoji: '🚿', aliases: ['bathroom', 'bath', 'אמבטיה', 'חדר אמבטיה'] },
  pool: { label: 'Pool', labelHe: 'בריכות', emoji: '🏊', aliases: ['pool', 'swimming pool', 'בריכה', 'בריכות'] },
  moving: { label: 'Moving', labelHe: 'הובלות', emoji: '📦', aliases: ['moving', 'movers', 'relocation', 'הובלה', 'הובלות'] },
}

// Lead urgency config
export const URGENCY_CONFIG = {
  hot: { label: 'HOT', emoji: '🔥', ttlHours: 4, color: '#ef4444' },
  warm: { label: 'WARM', emoji: '🟡', ttlHours: 48, color: '#f59e0b' },
  cold: { label: 'COLD', emoji: '🟢', ttlHours: 168, color: '#22c55e' } // 7 days
} as const

// Plan config
export const PLAN_CONFIG = {
  starter: { label: 'Starter', price: 149, maxGroups: 5, maxProfessions: 1, maxZips: 3 },
  pro: { label: 'Pro', price: 249, maxGroups: 15, maxProfessions: 3, maxZips: 8 },
  unlimited: { label: 'Unlimited', price: 399, maxGroups: -1, maxProfessions: -1, maxZips: -1 }
} as const

// Queue names
export const QUEUES = {
  RAW_MESSAGES: 'raw-messages',
  PARSED_LEADS: 'parsed-leads',
  NOTIFICATIONS: 'notifications',
  WA_NOTIFICATIONS: 'wa-notifications',
} as const

// WhatsApp listener config
export const WA_CONFIG = {
  MAX_GROUPS_PER_ACCOUNT: 40,
  HEARTBEAT_INTERVAL_MS: 30_000,
  RECONNECT_MAX_ATTEMPTS: 5,
  RECONNECT_BASE_DELAY_MS: 30_000,
  MESSAGE_READ_DELAY_MS: 3_000, // random delay before marking as read
} as const

// Matching config
export const MATCHING_CONFIG = {
  MAX_CONTRACTORS_PER_LEAD: 50, // send to all matching, cap at 50
} as const
