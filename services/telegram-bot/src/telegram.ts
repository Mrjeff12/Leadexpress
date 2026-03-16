import { config } from './config.js'

const API_BASE = `https://api.telegram.org/bot${config.telegramBotToken}`

export interface InlineButton {
  text: string
  callback_data?: string
  url?: string
}

// ---- Send a text message (optionally with inline keyboard) ----
export async function sendMessage(
  chatId: number,
  text: string,
  options?: {
    parse_mode?: 'HTML' | 'Markdown' | 'MarkdownV2'
    buttons?: InlineButton[][]
  },
): Promise<void> {
  const payload: Record<string, unknown> = {
    chat_id: chatId,
    text,
    parse_mode: options?.parse_mode ?? 'HTML',
  }

  if (options?.buttons && options.buttons.length > 0) {
    payload.reply_markup = { inline_keyboard: options.buttons }
  }

  const res = await fetch(`${API_BASE}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`sendMessage failed (${res.status}): ${body}`)
  }
}

// ---- Answer a callback query (removes "loading" on the button) ----
export async function answerCallbackQuery(
  callbackQueryId: string,
  text?: string,
  showAlert?: boolean,
): Promise<void> {
  const res = await fetch(`${API_BASE}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      callback_query_id: callbackQueryId,
      text,
      show_alert: showAlert ?? false,
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    // Log but don't throw — failing to ack a callback shouldn't crash the handler
    console.error(`answerCallbackQuery failed (${res.status}): ${body}`)
  }
}

// ---- Edit an existing message (update text + buttons after claim) ----
export async function editMessage(
  chatId: number,
  messageId: number,
  text: string,
  buttons?: InlineButton[][],
): Promise<void> {
  const payload: Record<string, unknown> = {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: 'HTML',
  }

  if (buttons) {
    payload.reply_markup = { inline_keyboard: buttons }
  } else {
    payload.reply_markup = { inline_keyboard: [] }
  }

  const res = await fetch(`${API_BASE}/editMessageText`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const body = await res.text()
    // Log but don't throw — a "message is not modified" 400 is common and harmless
    console.error(`editMessage failed (${res.status}): ${body}`)
  }
}
