import type { Logger } from 'pino';
import { config } from './config.js';

/**
 * Twilio WhatsApp interactive message builder.
 *
 * For production: uses Twilio Content API (ContentSid) for rich interactive messages.
 * For sandbox/fallback: sends numbered option lists that users reply to with digits.
 *
 * Endpoint: POST /2010-04-01/Accounts/{SID}/Messages.json
 */

const TWILIO_API_URL = `https://api.twilio.com/2010-04-01/Accounts/${config.twilio.accountSid}/Messages.json`;
const AUTH_HEADER =
  'Basic ' +
  Buffer.from(`${config.twilio.accountSid}:${config.twilio.authToken}`).toString('base64');

// ── Types ────────────────────────────────────────────────────────────────────

export interface Button {
  id: string;
  title: string; // max 20 chars
}

export interface ListItem {
  id: string;
  title: string;
  description?: string;
}

export interface ListSection {
  title: string;
  items: ListItem[];
}

export interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// ── Number emojis for sandbox fallback ───────────────────────────────────────

const NUMBER_EMOJIS = [
  '\u0031\uFE0F\u20E3', // 1️⃣
  '\u0032\uFE0F\u20E3', // 2️⃣
  '\u0033\uFE0F\u20E3', // 3️⃣
  '\u0034\uFE0F\u20E3', // 4️⃣
  '\u0035\uFE0F\u20E3', // 5️⃣
  '\u0036\uFE0F\u20E3', // 6️⃣
  '\u0037\uFE0F\u20E3', // 7️⃣
  '\u0038\uFE0F\u20E3', // 8️⃣
  '\u0039\uFE0F\u20E3', // 9️⃣
  '\uD83D\uDD1F',       // 🔟
];

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Format a phone number for the Twilio WhatsApp API.
 * Ensures the `whatsapp:+E.164` prefix is present.
 */
function formatWhatsAppPhone(phone: string): string {
  if (phone.startsWith('whatsapp:')) return phone;
  const digits = phone.replace(/[^\d+]/g, '');
  const e164 = digits.startsWith('+') ? digits : `+${digits}`;
  return `whatsapp:${e164}`;
}

/**
 * Low-level POST to Twilio Messages API with form-urlencoded body.
 */
async function postMessage(
  params: Record<string, string>,
  log: Logger,
): Promise<SendResult> {
  const formData = new URLSearchParams(params);

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
      log.info({ messageId, to: params.To }, 'Interactive WhatsApp message sent');
      return { success: true, messageId };
    }

    const errorMsg = (data.message as string) ?? 'Unknown error';
    const errorCode = data.code as number | undefined;
    log.error({ status: res.status, errorMsg, errorCode }, 'Twilio API error (interactive)');
    return { success: false, error: errorMsg };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : 'Network error';
    log.error({ err: errMsg }, 'Failed to call Twilio API (interactive)');
    return { success: false, error: errMsg };
  }
}

// ── Public builders ──────────────────────────────────────────────────────────

/**
 * Send a text message with quick-reply buttons (up to 3).
 *
 * - Production (ContentSid available): uses Twilio Content API for native buttons.
 * - Sandbox / fallback: appends numbered options to the body text so the user
 *   can reply with a digit.
 *
 * @param to        - Recipient phone (E.164 or whatsapp:+E.164)
 * @param body      - Message body text
 * @param buttons   - Up to 3 quick-reply buttons
 * @param log       - Pino logger
 * @param contentSid - Optional Twilio ContentSid for production rich buttons
 */
export async function sendButtonMessage(
  to: string,
  body: string,
  buttons: Button[],
  log: Logger,
  contentSid?: string,
): Promise<SendResult> {
  if (buttons.length === 0 || buttons.length > 3) {
    return { success: false, error: `Button count must be 1-3, got ${buttons.length}` };
  }

  const toWa = formatWhatsAppPhone(to);

  // ── Production path: ContentSid ──────────────────────────────────────────
  if (contentSid) {
    log.info({ contentSid, to: toWa }, 'Sending button message via ContentSid');
    return postMessage(
      {
        From: config.twilio.whatsappFrom,
        To: toWa,
        ContentSid: contentSid,
        // ContentVariables supplies template variables as JSON
        ContentVariables: JSON.stringify({ body }),
      },
      log,
    );
  }

  // ── Sandbox fallback: numbered options ───────────────────────────────────
  const optionLines = buttons
    .map((btn, i) => `${NUMBER_EMOJIS[i]} ${btn.title}`)
    .join('\n');

  const fallbackBody = `${body}\n\nReply:\n${optionLines}`;

  log.info({ to: toWa, buttonCount: buttons.length }, 'Sending button message (sandbox fallback)');
  return postMessage(
    {
      From: config.twilio.whatsappFrom,
      To: toWa,
      Body: fallbackBody,
    },
    log,
  );
}

/**
 * Send a list message with sectioned items (up to 10 total items).
 *
 * WhatsApp list messages are not natively supported via Twilio sandbox,
 * so we always render a numbered text fallback. In production, pass a
 * `contentSid` to use the Content API instead.
 *
 * @param to         - Recipient phone
 * @param body       - Header/body text
 * @param buttonText - CTA button label (used in production list messages)
 * @param sections   - Grouped list items
 * @param log        - Pino logger
 * @param contentSid - Optional Twilio ContentSid for production list messages
 */
export async function sendListMessage(
  to: string,
  body: string,
  buttonText: string,
  sections: ListSection[],
  log: Logger,
  contentSid?: string,
): Promise<SendResult> {
  const totalItems = sections.reduce((sum, s) => sum + s.items.length, 0);
  if (totalItems === 0 || totalItems > 10) {
    return { success: false, error: `List item count must be 1-10, got ${totalItems}` };
  }

  const toWa = formatWhatsAppPhone(to);

  // ── Production path: ContentSid ──────────────────────────────────────────
  if (contentSid) {
    log.info({ contentSid, to: toWa }, 'Sending list message via ContentSid');
    return postMessage(
      {
        From: config.twilio.whatsappFrom,
        To: toWa,
        ContentSid: contentSid,
        ContentVariables: JSON.stringify({ body, buttonText }),
      },
      log,
    );
  }

  // ── Sandbox fallback: numbered text list ─────────────────────────────────
  let counter = 0;
  const sectionBlocks = sections.map((section) => {
    const header = section.title ? `*${section.title}*` : '';
    const items = section.items
      .map((item) => {
        const emoji = NUMBER_EMOJIS[counter] ?? `${counter + 1}.`;
        counter++;
        const desc = item.description ? ` - ${item.description}` : '';
        return `${emoji} ${item.title}${desc}`;
      })
      .join('\n');
    return header ? `${header}\n${items}` : items;
  });

  const fallbackBody = `${body}\n\n${buttonText}:\n${sectionBlocks.join('\n\n')}`;

  log.info({ to: toWa, totalItems }, 'Sending list message (sandbox fallback)');
  return postMessage(
    {
      From: config.twilio.whatsappFrom,
      To: toWa,
      Body: fallbackBody,
    },
    log,
  );
}

/**
 * Send a plain text message via Twilio WhatsApp.
 */
export async function sendText(
  to: string,
  body: string,
  log: Logger,
): Promise<SendResult> {
  const toWa = formatWhatsAppPhone(to);

  log.info({ to: toWa }, 'Sending plain text WhatsApp message');
  return postMessage(
    {
      From: config.twilio.whatsappFrom,
      To: toWa,
      Body: body,
    },
    log,
  );
}

/**
 * Parse a user's numeric reply back to the corresponding button/list item id.
 * Returns the id string if matched, or undefined.
 *
 * @param reply   - The raw reply text from the user (e.g. "2" or "2️⃣")
 * @param options - The buttons or list items that were originally sent
 */
export function parseNumericReply(
  reply: string,
  options: Pick<Button, 'id'>[],
): string | undefined {
  const trimmed = reply.trim();

  // Try plain digit first
  const digitMatch = trimmed.match(/^(\d+)$/);
  if (digitMatch) {
    const idx = parseInt(digitMatch[1], 10) - 1;
    return options[idx]?.id;
  }

  // Try emoji number match
  const emojiIdx = NUMBER_EMOJIS.indexOf(trimmed);
  if (emojiIdx >= 0 && emojiIdx < options.length) {
    return options[emojiIdx].id;
  }

  return undefined;
}
