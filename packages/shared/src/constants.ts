import type { Profession } from './types'

// Profession display config
export const PROFESSIONS: Record<Profession, { label: string; labelHe: string; emoji: string; aliases: string[] }> = {
  hvac: {
    label: 'HVAC / AC',
    labelHe: 'מזגנים',
    emoji: '❄️',
    aliases: ['ac', 'air conditioning', 'air conditioner', 'hvac', 'cooling', 'heating', 'מזגן', 'מזגנים', 'מיזוג']
  },
  renovation: {
    label: 'Renovation',
    labelHe: 'שיפוצים',
    emoji: '🏗️',
    aliases: ['renovation', 'remodel', 'remodeling', 'kitchen', 'bathroom', 'שיפוץ', 'שיפוצים', 'שיפוצניק']
  },
  fencing: {
    label: 'Fencing & Railing',
    labelHe: 'גדרות ומעקות',
    emoji: '🏗️',
    aliases: ['fence', 'fencing', 'railing', 'gate', 'דור', 'גדר', 'מעקה', 'שער']
  },
  cleaning: {
    label: 'Garage Cleaning',
    labelHe: 'ניקוי גאראז\'ים',
    emoji: '🧹',
    aliases: ['garage', 'cleaning', 'pressure wash', 'power wash', 'ניקוי', 'גאראז', 'שטיפה']
  }
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
