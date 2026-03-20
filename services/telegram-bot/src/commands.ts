import crypto from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import type Redis from 'ioredis'
import type { Logger } from 'pino'
import { sendMessage } from './telegram.js'

const LINK_TOKEN_PREFIX = 'le:tg-link:'
const LINK_TOKEN_TTL = 86400 // 24 hours

// Onboarding state stored in Redis (short-lived)
const ONBOARD_PREFIX = 'le:onboard:'
const ONBOARD_TTL = 3600 // 1 hour

// ---------------------------------------------------------------------------
// Available professions and regions
// ---------------------------------------------------------------------------

export const PROFESSIONS = [
  { key: 'hvac', label: '❄️ HVAC / AC', emoji: '❄️' },
  { key: 'air_duct', label: '🌬️ Air Duct', emoji: '🌬️' },
  { key: 'chimney', label: '🏠 Chimney', emoji: '🏠' },
  { key: 'dryer_vent', label: '🌀 Dryer Vent', emoji: '🌀' },
  { key: 'garage_door', label: '🚗 Garage Door', emoji: '🚗' },
  { key: 'renovation', label: '🔨 Renovation', emoji: '🔨' },
  { key: 'fencing', label: '🧱 Fencing', emoji: '🧱' },
  { key: 'cleaning', label: '✨ Cleaning', emoji: '✨' },
  { key: 'carpet_cleaning', label: '🧹 Carpet Cleaning', emoji: '🧹' },
  { key: 'locksmith', label: '🔑 Locksmith', emoji: '🔑' },
  { key: 'roofing', label: '🏗️ Roofing', emoji: '🏗️' },
  { key: 'plumbing', label: '🚰 Plumbing', emoji: '🚰' },
  { key: 'electrical', label: '⚡ Electrical', emoji: '⚡' },
  { key: 'painting', label: '🎨 Painting', emoji: '🎨' },
  { key: 'landscaping', label: '🌿 Landscaping', emoji: '🌿' },
  { key: 'tiling', label: '🔲 Tiling', emoji: '🔲' },
  { key: 'kitchen', label: '🍳 Kitchen', emoji: '🍳' },
  { key: 'bathroom', label: '🚿 Bathroom', emoji: '🚿' },
  { key: 'pool', label: '🏊 Pool', emoji: '🏊' },
  { key: 'moving', label: '📦 Moving', emoji: '📦' },
  { key: 'other', label: '📋 Other', emoji: '📋' },
] as const

export const REGIONS = [
  { key: 'us-fl', label: '🌴 Florida (South FL)', zips: ['331', '330', '332', '334'] },
  { key: 'us-ny', label: '🗽 New York', zips: ['100', '101', '110', '112', '113', '114'] },
  { key: 'us-tx', label: '🤠 Texas (Houston/DFW)', zips: ['770', '750', '760'] },
] as const

// ---------------------------------------------------------------------------
// Token generation (called from the dashboard API)
// ---------------------------------------------------------------------------

export async function createLinkToken(redis: Redis, userId: string): Promise<string> {
  const token = crypto.randomUUID().replace(/-/g, '').slice(0, 16)
  await redis.set(`${LINK_TOKEN_PREFIX}${token}`, userId, 'EX', LINK_TOKEN_TTL)
  return token
}

// ---------------------------------------------------------------------------
// /start {token} — link Telegram account + begin onboarding
// /start          — welcome message for unlinked users
// ---------------------------------------------------------------------------

export async function handleStart(
  chatId: number,
  args: string,
  deps: { redis: Redis; supabase: SupabaseClient; logger: Logger },
): Promise<void> {
  const token = args.trim()
  const { redis, supabase, logger } = deps

  // No token — check if already linked
  if (!token) {
    const { data: existing } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('telegram_chat_id', chatId)
      .maybeSingle()

    if (existing) {
      await sendMessage(chatId, `👋 Welcome back, <b>${existing.full_name}</b>!\n\nUse /status to check your account or /help for commands.`)
      return
    }

    await sendMessage(
      chatId,
      '👋 <b>Welcome to Lead Express!</b>\n\nTo connect your account, scan the QR code from your dashboard or use the link provided.\n\nAlready have an account? Ask your admin for an invite link.',
    )
    return
  }

  const redisKey = `${LINK_TOKEN_PREFIX}${token}`
  const userId = await redis.get(redisKey)

  if (!userId) {
    await sendMessage(chatId, '❌ This link has expired. Please generate a new one from your dashboard.')
    return
  }

  // Update user profile with their Telegram chat ID
  const { error } = await supabase
    .from('profiles')
    .update({ telegram_chat_id: chatId })
    .eq('id', userId)

  if (error) {
    logger.error({ error, userId, chatId }, 'Failed to update profile with telegram_chat_id')
    await sendMessage(chatId, '❌ Something went wrong. Please try again later.')
    return
  }

  // Consume the token
  await redis.del(redisKey)
  logger.info({ userId, chatId }, 'Telegram account linked successfully')

  // Check if contractor record exists — if not, start onboarding
  const { data: contractor } = await supabase
    .from('contractors')
    .select('user_id, professions, zip_codes')
    .eq('user_id', userId)
    .maybeSingle()

  if (contractor && contractor.professions.length > 0 && contractor.zip_codes.length > 0) {
    // Already set up — skip onboarding
    await sendMessage(
      chatId,
      "✅ <b>Connected!</b>\n\nYou'll start receiving leads matching your profile.\n\nUse /status to see your settings.",
    )
    return
  }

  // Start onboarding — save state in Redis
  await redis.set(
    `${ONBOARD_PREFIX}${chatId}`,
    JSON.stringify({ userId, step: 'profession', professions: [], zipCodes: [] }),
    'EX',
    ONBOARD_TTL,
  )

  // Ensure contractor record exists
  if (!contractor) {
    await supabase.from('contractors').insert({ user_id: userId })
  }

  await sendMessage(
    chatId,
    "✅ <b>Account linked!</b>\n\nLet's set up your lead preferences so you only get leads that matter.\n\n<b>Step 1:</b> What's your profession? (tap one or more, then tap ✅ Done)",
    {
      buttons: [
        ...PROFESSIONS.map((p) => [{ text: p.label, callback_data: `prof:${p.key}` }]),
        [{ text: '✅ Done selecting', callback_data: 'prof:done' }],
      ],
    },
  )
}

// ---------------------------------------------------------------------------
// /help
// ---------------------------------------------------------------------------

export async function handleHelp(chatId: number): Promise<void> {
  const text = [
    '📋 <b>Lead Express Bot</b>',
    '',
    '🔹 /start — Connect your account',
    '🔹 /status — View your settings & stats',
    '🔹 /professions — Update your professions',
    '🔹 /areas — Update your service areas',
    '🔹 /help — Show this message',
    '',
    'Once connected, you\'ll automatically receive leads that match your profession and service area.',
    '',
    'When you get a lead, tap <b>✅ Claim</b> to take it or <b>❌ Pass</b> to skip.',
  ].join('\n')

  await sendMessage(chatId, text)
}

// ---------------------------------------------------------------------------
// /status — show account info from the correct tables
// ---------------------------------------------------------------------------

export async function handleStatus(
  chatId: number,
  deps: { supabase: SupabaseClient; logger: Logger },
): Promise<void> {
  const { supabase, logger } = deps

  // Look up user by telegram_chat_id (profile + contractor + subscription)
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('telegram_chat_id', chatId)
    .maybeSingle()

  if (error) {
    logger.error({ error, chatId }, 'Failed to fetch profile for /status')
    await sendMessage(chatId, '❌ Something went wrong. Please try again later.')
    return
  }

  if (!profile) {
    await sendMessage(
      chatId,
      "You're not connected to a Lead Express account yet.\n\nScan the QR code from your dashboard to connect.",
    )
    return
  }

  // Fetch contractor preferences
  const { data: contractor } = await supabase
    .from('contractors')
    .select('professions, zip_codes, is_active')
    .eq('user_id', profile.id)
    .maybeSingle()

  // Fetch subscription
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('status, plans!inner(name)')
    .eq('user_id', profile.id)
    .eq('status', 'active')
    .maybeSingle()

  const planData = subscription?.plans as unknown
  const planName = planData
    ? (Array.isArray(planData) ? (planData[0] as { name: string })?.name : (planData as { name: string })?.name)
    : null

  const professions = contractor?.professions?.length
    ? contractor.professions.map((p: string) => {
        const match = PROFESSIONS.find((pr) => pr.key === p)
        return match ? match.label : p
      }).join('\n  ')
    : 'None set'

  const zipCodes = contractor?.zip_codes?.length
    ? contractor.zip_codes.join(', ')
    : 'None set'

  const text = [
    '📊 <b>Your Account</b>',
    '',
    `👤 <b>Name:</b> ${profile.full_name || 'Not set'}`,
    `📦 <b>Plan:</b> ${planName ?? 'Free'}`,
    `🔧 <b>Active:</b> ${contractor?.is_active ? '✅ Yes' : '❌ No'}`,
    '',
    `<b>Professions:</b>`,
    `  ${professions}`,
    '',
    `<b>Service Areas (ZIP):</b>`,
    `  ${zipCodes}`,
    '',
    'Use /professions or /areas to update your preferences.',
  ].join('\n')

  await sendMessage(chatId, text)
}

// ---------------------------------------------------------------------------
// /professions — re-select professions
// ---------------------------------------------------------------------------

export async function handleProfessions(
  chatId: number,
  deps: { redis: Redis; supabase: SupabaseClient; logger: Logger },
): Promise<void> {
  const { redis, supabase } = deps

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('telegram_chat_id', chatId)
    .maybeSingle()

  if (!profile) {
    await sendMessage(chatId, "You're not connected yet. Use /start first.")
    return
  }

  // Start onboarding at profession step
  await redis.set(
    `${ONBOARD_PREFIX}${chatId}`,
    JSON.stringify({ userId: profile.id, step: 'profession', professions: [], zipCodes: [] }),
    'EX',
    ONBOARD_TTL,
  )

  await sendMessage(chatId, '<b>Select your professions:</b>\n(tap one or more, then tap ✅ Done)', {
    buttons: [
      ...PROFESSIONS.map((p) => [{ text: p.label, callback_data: `prof:${p.key}` }]),
      [{ text: '✅ Done selecting', callback_data: 'prof:done' }],
    ],
  })
}

// ---------------------------------------------------------------------------
// /areas — re-select service areas
// ---------------------------------------------------------------------------

export async function handleAreas(
  chatId: number,
  deps: { redis: Redis; supabase: SupabaseClient; logger: Logger },
): Promise<void> {
  const { redis, supabase } = deps

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('telegram_chat_id', chatId)
    .maybeSingle()

  if (!profile) {
    await sendMessage(chatId, "You're not connected yet. Use /start first.")
    return
  }

  // Start onboarding at zip step
  await redis.set(
    `${ONBOARD_PREFIX}${chatId}`,
    JSON.stringify({ userId: profile.id, step: 'zip', professions: [], zipCodes: [] }),
    'EX',
    ONBOARD_TTL,
  )

  await sendMessage(chatId, '<b>Select your service areas:</b>\n(tap one or more, then tap ✅ Done)', {
    buttons: [
      ...REGIONS.map((r) => [{ text: r.label, callback_data: `area:${r.key}` }]),
      [{ text: '✅ Done selecting', callback_data: 'area:done' }],
    ],
  })
}

// ---------------------------------------------------------------------------
// Unknown command
// ---------------------------------------------------------------------------

export async function handleUnknown(chatId: number): Promise<void> {
  await sendMessage(chatId, "I don't understand that. Try /help for available commands.")
}

// ---------------------------------------------------------------------------
// Get onboarding state from Redis
// ---------------------------------------------------------------------------

export interface OnboardState {
  userId: string
  step: 'profession' | 'zip' | 'done'
  professions: string[]
  zipCodes: string[]
}

export async function getOnboardState(redis: Redis, chatId: number): Promise<OnboardState | null> {
  const raw = await redis.get(`${ONBOARD_PREFIX}${chatId}`)
  if (!raw) return null
  return JSON.parse(raw) as OnboardState
}

export async function setOnboardState(redis: Redis, chatId: number, state: OnboardState): Promise<void> {
  await redis.set(`${ONBOARD_PREFIX}${chatId}`, JSON.stringify(state), 'EX', ONBOARD_TTL)
}

export async function clearOnboardState(redis: Redis, chatId: number): Promise<void> {
  await redis.del(`${ONBOARD_PREFIX}${chatId}`)
}
