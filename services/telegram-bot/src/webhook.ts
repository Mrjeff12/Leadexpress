import { Hono } from 'hono'
import type { SupabaseClient } from '@supabase/supabase-js'
import type Redis from 'ioredis'
import type { Logger } from 'pino'
import {
  handleStart,
  handleHelp,
  handleStatus,
  handleProfessions,
  handleAreas,
  handleUnknown,
  getOnboardState,
  setOnboardState,
  clearOnboardState,
  PROFESSIONS,
  REGIONS,
} from './commands.js'
import { sendMessage, answerCallbackQuery, editMessage } from './telegram.js'

// ---------------------------------------------------------------------------
// Telegram types (minimal subset we actually use)
// ---------------------------------------------------------------------------

interface TelegramUser {
  id: number
  first_name: string
  last_name?: string
  username?: string
}

interface TelegramChat {
  id: number
  type: string
}

interface TelegramMessage {
  message_id: number
  from?: TelegramUser
  chat: TelegramChat
  date: number
  text?: string
}

interface TelegramUpdate {
  update_id: number
  message?: TelegramMessage
  callback_query?: {
    id: string
    from: TelegramUser
    message?: TelegramMessage
    data?: string
  }
}

// ---------------------------------------------------------------------------
// Webhook router
// ---------------------------------------------------------------------------

export function createWebhookRouter(deps: {
  redis: Redis
  supabase: SupabaseClient
  logger: Logger
  webhookSecret?: string
}): Hono {
  const app = new Hono()
  const { redis, supabase, logger, webhookSecret } = deps

  app.post('/webhook', async (c) => {
    // Verify Telegram webhook secret to prevent forged requests
    if (webhookSecret) {
      const headerSecret = c.req.header('x-telegram-bot-api-secret-token')
      if (headerSecret !== webhookSecret) {
        logger.warn('Webhook request with invalid or missing secret token')
        return c.json({ ok: false, error: 'Forbidden' }, 403)
      }
    }
    let update: TelegramUpdate

    try {
      update = await c.req.json<TelegramUpdate>()
    } catch {
      logger.warn('Invalid JSON in webhook request')
      return c.json({ ok: false, error: 'Invalid JSON' }, 400)
    }

    if (!update.update_id) {
      logger.warn('Missing update_id in webhook payload')
      return c.json({ ok: false, error: 'Invalid update' }, 400)
    }

    try {
      // ---- Handle callback queries (button taps) ----
      if (update.callback_query) {
        await handleCallbackQuery(update.callback_query, { redis, supabase, logger })
        return c.json({ ok: true })
      }

      // ---- Handle text messages (commands) ----
      const message = update.message
      if (!message?.text) {
        return c.json({ ok: true })
      }

      const chatId = message.chat.id
      const text = message.text.trim()

      logger.debug({ chatId, text, from: message.from?.username }, 'Incoming message')

      if (text.startsWith('/start')) {
        const args = text.slice('/start'.length).trim()
        await handleStart(chatId, args, { redis, supabase, logger })
      } else if (text === '/help') {
        await handleHelp(chatId)
      } else if (text === '/status') {
        await handleStatus(chatId, { supabase, logger })
      } else if (text === '/professions') {
        await handleProfessions(chatId, { redis, supabase, logger })
      } else if (text === '/areas') {
        await handleAreas(chatId, { redis, supabase, logger })
      } else if (text.startsWith('/')) {
        await handleUnknown(chatId)
      } else {
        // Free text — check if in onboarding (zip code entry)
        const state = await getOnboardState(redis, chatId)
        if (state?.step === 'zip') {
          // User might be typing zip codes manually
          const zips = text.split(/[,\s]+/).filter((z) => /^\d{5}$/.test(z))
          if (zips.length > 0) {
            state.zipCodes = [...new Set([...state.zipCodes, ...zips])]
            await setOnboardState(redis, chatId, state)
            await sendMessage(
              chatId,
              `Added ZIP codes: <b>${zips.join(', ')}</b>\n\nTotal: ${state.zipCodes.join(', ')}\n\nType more ZIPs or tap ✅ Done to finish.`,
              {
                buttons: [[{ text: '✅ Done — Save my preferences', callback_data: 'area:done' }]],
              },
            )
          } else {
            await sendMessage(chatId, 'Please enter valid 5-digit ZIP codes (e.g. 33139, 33140)')
          }
        } else {
          await handleUnknown(chatId)
        }
      }
    } catch (err) {
      logger.error({ err }, 'Error handling update')
    }

    return c.json({ ok: true })
  })

  return app
}

// ---------------------------------------------------------------------------
// Callback query handler — buttons for onboarding, claim, pass
// ---------------------------------------------------------------------------

async function handleCallbackQuery(
  query: NonNullable<TelegramUpdate['callback_query']>,
  deps: { redis: Redis; supabase: SupabaseClient; logger: Logger },
): Promise<void> {
  const { redis, supabase, logger } = deps
  const chatId = query.message?.chat.id
  const messageId = query.message?.message_id
  const data = query.data ?? ''

  if (!chatId) return

  logger.debug({ chatId, data, from: query.from.username }, 'Callback query')

  // ---- CLAIM a lead ----
  if (data.startsWith('claim:')) {
    const leadId = data.slice('claim:'.length)
    await handleClaim(chatId, messageId!, leadId, query, deps)
    return
  }

  // ---- PASS on a lead ----
  if (data.startsWith('pass:')) {
    const leadId = data.slice('pass:'.length)
    await answerCallbackQuery(query.id, 'Skipped this lead')
    if (messageId) {
      await editMessage(chatId, messageId, query.message?.text + '\n\n❌ <i>Passed</i>')
    }
    logger.info({ chatId, leadId }, 'Contractor passed on lead')
    return
  }

  // ---- ONBOARDING: profession selection ----
  if (data.startsWith('prof:')) {
    const profKey = data.slice('prof:'.length)
    const state = await getOnboardState(redis, chatId)

    if (!state) {
      await answerCallbackQuery(query.id, 'Session expired. Use /professions to restart.')
      return
    }

    if (profKey === 'done') {
      if (state.professions.length === 0) {
        await answerCallbackQuery(query.id, 'Please select at least one profession first!', true)
        return
      }

      // Move to ZIP code selection
      state.step = 'zip'
      await setOnboardState(redis, chatId, state)
      await answerCallbackQuery(query.id)

      const profLabels = state.professions
        .map((p) => PROFESSIONS.find((pr) => pr.key === p)?.label ?? p)
        .join(', ')

      await sendMessage(
        chatId,
        `Great! You selected: <b>${profLabels}</b>\n\n<b>Step 2:</b> Which areas do you serve?\n\nTap a region or type specific ZIP codes (e.g. 33139):`,
        {
          buttons: [
            ...REGIONS.map((r) => [{ text: r.label, callback_data: `area:${r.key}` }]),
            [{ text: '⌨️ I\'ll type ZIP codes', callback_data: 'area:manual' }],
            [{ text: '✅ Done — Save my preferences', callback_data: 'area:done' }],
          ],
        },
      )
      return
    }

    // Toggle profession
    if (state.professions.includes(profKey)) {
      state.professions = state.professions.filter((p) => p !== profKey)
      await answerCallbackQuery(query.id, `Removed ${profKey}`)
    } else {
      state.professions.push(profKey)
      await answerCallbackQuery(query.id, `Added ${profKey} ✓`)
    }

    await setOnboardState(redis, chatId, state)

    // Update message to show current selection
    const selected = state.professions
      .map((p) => PROFESSIONS.find((pr) => pr.key === p)?.emoji ?? '•')
      .join(' ')

    if (messageId) {
      const updatedButtons = [
        ...PROFESSIONS.map((p) => [{
          text: state.professions.includes(p.key) ? `✓ ${p.label}` : p.label,
          callback_data: `prof:${p.key}`,
        }]),
        [{ text: `✅ Done (${state.professions.length} selected)`, callback_data: 'prof:done' }],
      ]

      await editMessage(
        chatId,
        messageId,
        `<b>Select your professions:</b>\n\nSelected: ${selected || 'none yet'}`,
        updatedButtons,
      )
    }
    return
  }

  // ---- ONBOARDING: area / zip code selection ----
  if (data.startsWith('area:')) {
    const areaKey = data.slice('area:'.length)
    const state = await getOnboardState(redis, chatId)

    if (!state) {
      await answerCallbackQuery(query.id, 'Session expired. Use /areas to restart.')
      return
    }

    if (areaKey === 'manual') {
      await answerCallbackQuery(query.id)
      await sendMessage(
        chatId,
        'Type your ZIP codes separated by commas or spaces:\n\nExample: <code>33139, 33140, 33141</code>',
        {
          buttons: [[{ text: '✅ Done — Save my preferences', callback_data: 'area:done' }]],
        },
      )
      return
    }

    if (areaKey === 'done') {
      if (state.zipCodes.length === 0) {
        await answerCallbackQuery(query.id, 'Please select at least one area first!', true)
        return
      }

      // Save to DB and finish onboarding
      await finishOnboarding(chatId, state, deps)
      await answerCallbackQuery(query.id, 'Preferences saved! ✅')
      await clearOnboardState(redis, chatId)
      return
    }

    // A region was selected — prompt user to enter actual ZIP codes for that region
    const region = REGIONS.find((r) => r.key === areaKey)
    if (region) {
      await answerCallbackQuery(query.id)
      await sendMessage(
        chatId,
        `You selected <b>${region.label}</b>.\n\nPlease type the actual 5-digit ZIP codes you serve in this area, separated by commas or spaces.\n\nExample: <code>33139, 33140, 33141</code>`,
        {
          buttons: [
            ...(state.zipCodes.length > 0 ? [[{ text: `✅ Done (${state.zipCodes.length} ZIPs)`, callback_data: 'area:done' }]] : []),
          ],
        },
      )
    }
    return
  }

  // Unknown callback
  await answerCallbackQuery(query.id)
}

// ---------------------------------------------------------------------------
// Claim handler
// ---------------------------------------------------------------------------

async function handleClaim(
  chatId: number,
  messageId: number,
  leadId: string,
  query: NonNullable<TelegramUpdate['callback_query']>,
  deps: { supabase: SupabaseClient; logger: Logger },
): Promise<void> {
  const { supabase, logger } = deps

  // Find the contractor profile by telegram_chat_id
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('telegram_chat_id', chatId)
    .maybeSingle()

  if (!profile) {
    await answerCallbackQuery(query.id, 'Account not found. Use /start to connect.', true)
    return
  }

  // Check if lead is still available
  const { data: lead } = await supabase
    .from('leads')
    .select('id, status, parsed_summary, profession')
    .eq('id', leadId)
    .maybeSingle()

  if (!lead) {
    await answerCallbackQuery(query.id, 'This lead no longer exists.', true)
    return
  }

  if (lead.status === 'expired') {
    await answerCallbackQuery(query.id, 'This lead has expired.', true)
    await editMessage(chatId, messageId, (query.message?.text ?? '') + '\n\n⏰ <i>Lead expired</i>')
    return
  }

  if (lead.status === 'claimed') {
    await answerCallbackQuery(query.id, 'This lead was already claimed.', true)
    await editMessage(chatId, messageId, (query.message?.text ?? '') + '\n\n⚡ <i>Already claimed</i>')
    return
  }

  // Atomic claim: only update if status is still 'sent' (prevents race condition
  // when two contractors tap Claim at the same time)
  const { data: claimed, error: claimError } = await supabase
    .from('leads')
    .update({ status: 'claimed', claimed_by: profile.id, claimed_at: new Date().toISOString() })
    .eq('id', leadId)
    .eq('status', 'sent') // CAS — only succeeds if status hasn't changed
    .select('id')
    .maybeSingle()

  if (claimError || !claimed) {
    // Another contractor beat us to it
    await answerCallbackQuery(query.id, 'This lead was just claimed by someone else!', true)
    await editMessage(chatId, messageId, (query.message?.text ?? '') + '\n\n⚡ <i>Already claimed</i>')
    return
  }

  // Log pipeline event (fire-and-forget — H7 fix)
  supabase.from('pipeline_events').insert({
    stage: 'claimed',
    lead_id: leadId,
    detail: {
      contractor_id: profile.id,
      contractor_name: profile.full_name,
      claimed_via: 'telegram',
    },
  }).then(({ error: evtErr }) => {
    if (evtErr) logger.error({ evtErr, leadId }, 'Failed to log claim pipeline event')
  })

  await answerCallbackQuery(query.id, '✅ Lead claimed! Good luck!')

  // Update the message to show it's been claimed
  await editMessage(
    chatId,
    messageId,
    (query.message?.text ?? '') + `\n\n✅ <b>CLAIMED</b> by you at ${new Date().toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' })} ET`,
  )

  logger.info({ chatId, leadId, contractorId: profile.id }, 'Lead claimed via Telegram')
}

// ---------------------------------------------------------------------------
// Finish onboarding — save preferences to DB
// ---------------------------------------------------------------------------

async function finishOnboarding(
  chatId: number,
  state: { userId: string; professions: string[]; zipCodes: string[] },
  deps: { supabase: SupabaseClient; logger: Logger },
): Promise<void> {
  const { supabase, logger } = deps

  const { error } = await supabase
    .from('contractors')
    .update({
      professions: state.professions,
      zip_codes: state.zipCodes,
      is_active: true,
    })
    .eq('user_id', state.userId)

  if (error) {
    logger.error({ error, userId: state.userId }, 'Failed to save contractor preferences')
    await sendMessage(chatId, '❌ Failed to save preferences. Please try again with /professions.')
    return
  }

  const profLabels = state.professions
    .map((p) => PROFESSIONS.find((pr) => pr.key === p)?.label ?? p)
    .join('\n  ')

  logger.info(
    { userId: state.userId, professions: state.professions, zipCodes: state.zipCodes },
    'Contractor onboarding complete',
  )

  await sendMessage(
    chatId,
    [
      '🎉 <b>You\'re all set!</b>',
      '',
      '<b>Your preferences:</b>',
      `  ${profLabels}`,
      '',
      `<b>Service areas:</b>`,
      `  ${state.zipCodes.join(', ')}`,
      '',
      "You'll now receive leads matching these preferences.",
      'When you get a lead, tap <b>✅ Claim</b> to take it.',
      '',
      'Use /professions or /areas to update anytime.',
    ].join('\n'),
  )
}
