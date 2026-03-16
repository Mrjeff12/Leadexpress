import type { Logger } from 'pino';
import { config } from './config.js';

const BASE_URL = `https://api.telegram.org/bot${config.telegram.botToken}`;

export interface TelegramSendResult {
  success: boolean;
  blocked?: boolean;
  rateLimited?: boolean;
  retryAfter?: number;
  error?: string;
}

export interface InlineButton {
  text: string;
  callback_data?: string;
  url?: string;
}

export async function sendTelegramMessage(
  chatId: number,
  text: string,
  log: Logger,
  buttons?: InlineButton[][],
): Promise<TelegramSendResult> {
  const payload: Record<string, unknown> = {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
  };

  if (buttons && buttons.length > 0) {
    payload.reply_markup = {
      inline_keyboard: buttons,
    };
  }

  const res = await fetch(`${BASE_URL}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (res.ok) {
    return { success: true };
  }

  const body = await res.json().catch(() => ({})) as Record<string, unknown>;
  const description = (body.description as string) ?? 'Unknown error';

  // User blocked the bot
  if (res.status === 403) {
    log.warn({ chatId, status: 403, description }, 'User blocked the bot — skipping');
    return { success: false, blocked: true, error: description };
  }

  // Rate limited by Telegram
  if (res.status === 429) {
    const retryAfter = Number((body.parameters as Record<string, unknown>)?.retry_after ?? 5);
    log.warn({ chatId, status: 429, retryAfter }, 'Telegram rate limit hit');
    return { success: false, rateLimited: true, retryAfter, error: description };
  }

  // Other errors
  log.error({ chatId, status: res.status, description }, 'Telegram API error');
  return { success: false, error: description };
}
