import twilio from 'twilio';
import { config } from '../config.js';
import pino from 'pino';

const log = pino({ name: 'twilio' });
const TWILIO_API = `https://api.twilio.com/2010-04-01/Accounts/${config.twilio.accountSid}/Messages.json`;
const AUTH = 'Basic ' + Buffer.from(`${config.twilio.accountSid}:${config.twilio.authToken}`).toString('base64');

function formatWaPhone(phone: string): string {
  if (phone.startsWith('whatsapp:')) return phone;
  const digits = phone.replace(/[^\d+]/g, '');
  const e164 = digits.startsWith('+') ? digits : `+${digits}`;
  return `whatsapp:${e164}`;
}

async function postMessage(params: Record<string, string>): Promise<void> {
  const res = await fetch(TWILIO_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: AUTH },
    body: new URLSearchParams(params).toString(),
  });
  if (!res.ok) {
    const err = await res.text();
    log.error({ status: res.status, err, to: params.To }, 'Twilio send error');
    throw new Error(`Twilio error ${res.status}: ${err}`);
  }
  const data = await res.json() as { sid: string };
  log.info({ sid: data.sid, to: params.To }, 'Message sent');
}

export async function sendText(to: string, body: string): Promise<void> {
  await postMessage({ From: config.twilio.whatsappFrom, To: formatWaPhone(to), Body: body });
}

export async function sendContentTemplate(to: string, contentSid: string, variables?: Record<string, string>): Promise<void> {
  const params: Record<string, string> = {
    From: config.twilio.whatsappFrom,
    To: formatWaPhone(to),
    ContentSid: contentSid,
  };
  if (variables) params.ContentVariables = JSON.stringify(variables);
  await postMessage(params);
}

/**
 * Validate that an inbound request is genuinely from Twilio.
 * Returns true if valid, false if the signature does not match.
 */
export function validateTwilioSignature(
  url: string,
  params: Record<string, string>,
  signature: string,
): boolean {
  return twilio.validateRequest(config.twilio.authToken, signature, url, params);
}
