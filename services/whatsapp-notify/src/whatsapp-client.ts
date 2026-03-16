import type { Logger } from 'pino';
import { config } from './config.js';

/**
 * Twilio WhatsApp API client.
 * Uses Twilio REST API instead of Meta Cloud API — simpler auth, no Meta Business account needed.
 * Endpoint: POST /2010-04-01/Accounts/{SID}/Messages.json
 */

const TWILIO_API_URL = `https://api.twilio.com/2010-04-01/Accounts/${config.twilio.accountSid}/Messages.json`;
const AUTH_HEADER = 'Basic ' + Buffer.from(`${config.twilio.accountSid}:${config.twilio.authToken}`).toString('base64');

export interface WaSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  rateLimited?: boolean;
  retryAfter?: number;
}

/**
 * Send a template message via Twilio (for daily check-in).
 * Twilio uses ContentSid for templates, but we can also send plain text
 * with the "whatsapp:" prefix — Twilio handles template matching automatically.
 */
export async function sendTemplate(
  to: string,
  _templateName: string,
  params: string[],
  log: Logger,
): Promise<WaSendResult> {
  // For check-in, we send a simple text that matches the approved template.
  // Twilio auto-matches it if it's within the template catalog.
  const contractorName = params[0] ?? '';
  const body = `${contractorName}, ???? ???????? ?????? ?????? ????? ???????\n\n?????? "????" ???? ???????? ?????????? ??????.`;

  return sendMessage(to, body, log);
}

/**
 * Send a free-form text message (free within 24h window)
 */
export async function sendTextMessage(
  to: string,
  text: string,
  log: Logger,
): Promise<WaSendResult> {
  return sendMessage(to, text, log);
}

/**
 * Core send function — Twilio REST API with form-urlencoded body.
 */
async function sendMessage(
  to: string,
  body: string,
  log: Logger,
): Promise<WaSendResult> {
  // Ensure WhatsApp prefix
  const toWa = to.startsWith('whatsapp:') ? to : `whatsapp:${to.startsWith('+') ? to : '+' + to}`;

  const formData = new URLSearchParams({
    From: config.twilio.whatsappFrom,
    To: toWa,
    Body: body,
  });

  try {
    const res = await fetch(TWILIO_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: AUTH_HEADER,
      },
      body: formData.toString(),
    });

    const data = (await res.json()) as Record<string, unknown>;

    if (res.ok || res.status === 201) {
      const messageId = data.sid as string;
      log.info({ messageId, to: toWa }, 'WhatsApp message sent via Twilio');
      return { success: true, messageId };
    }

    const errorCode = data.code as number | undefined;
    const errorMsg = (data.message as string) ?? 'Unknown error';

    // Rate limited (Twilio uses 429)
    if (res.status === 429 || errorCode === 20429) {
      log.warn({ status: res.status, errorMsg }, 'Twilio rate limit hit');
      return { success: false, rateLimited: true, retryAfter: 60, error: errorMsg };
    }

    log.error({ status: res.status, errorMsg, errorCode, sid: data.sid }, 'Twilio API error');
    return { success: false, error: errorMsg };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : 'Network error';
    log.error({ err: errMsg }, 'Failed to call Twilio API');
    return { success: false, error: errMsg };
  }
}
