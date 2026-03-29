import { supabase } from './lib/supabase.js';
import { sendText } from './lib/twilio.js';
import { t } from './lib/i18n.js';
import { getState } from './lib/state.js';
import { findProfile, linkWhatsAppPhone, isOptedOut } from './lib/profile.js';
import { handleOnboarding, startOnboarding } from './handlers/onboarding.js';
import { handleKnownUser } from './handlers/known-user.js';
import { handleSales } from './handlers/sales.js';
import { handleLeadClaim, handleLeadPass } from './handlers/lead-action.js';
import pino from 'pino';

const log = pino({ name: 'router' });

const GROUP_LINK_RE = /chat\.whatsapp\.com\/([A-Za-z0-9]+)/;
const CONNECTION_CODE_RE = /LE-([a-f0-9]{8})/i;

/**
 * Route an inbound Twilio WhatsApp message to the correct handler.
 * Uses a Postgres advisory lock to prevent concurrent processing of
 * messages from the same phone number.
 */
export async function routeMessage(
  phone: string,
  text: string,
  buttonPayload: string,
): Promise<void> {
  const lockKey = Math.abs(hashPhoneToInt(phone));
  const { data: lockAcquired } = await supabase.rpc('try_phone_lock', { lock_key: lockKey });

  if (!lockAcquired) {
    log.debug({ phone }, 'Phone locked — concurrent message, sending wait message');
    await sendText(phone, t(phone, 'processing'));
    return;
  }

  try {
    await processMessage(phone, text.trim(), buttonPayload);
  } finally {
    await supabase.rpc('release_phone_lock', { lock_key: lockKey });
  }
}

async function processMessage(phone: string, text: string, buttonPayload: string): Promise<void> {
  // 1. Button payload (Quick Reply button press)
  if (buttonPayload) {
    await handleButtonPayload(phone, buttonPayload);
    return;
  }

  // 2. Connection code (LE-{userId prefix})
  const codeMatch = text.match(CONNECTION_CODE_RE);
  if (codeMatch) {
    await handleConnectionCode(phone, codeMatch[1]);
    return;
  }

  // 3. WhatsApp group link
  if (GROUP_LINK_RE.test(text)) {
    await handleGroupLink(phone, text);
    return;
  }

  // 4. Active onboarding state
  const state = await getState(phone);
  if (state) {
    await handleOnboarding(phone, text);
    return;
  }

  // 5. Opted out
  if (await isOptedOut(phone)) {
    log.info({ phone }, 'Opted-out phone, ignoring');
    return;
  }

  // 6. Known profile
  const profile = await findProfile(phone);
  if (profile) {
    if (!profile.whatsapp_phone) {
      await linkWhatsAppPhone(profile.id, phone);
    }
    await handleKnownUser(phone, text, profile);
    return;
  }

  // 7. Unknown → sales agent
  log.info({ phone }, 'Unknown phone — routing to sales');
  await handleSales(phone, text);
}

async function handleButtonPayload(phone: string, payload: string): Promise<void> {
  const claimMatch = payload.match(/^claim:(.+)$/);
  if (claimMatch) {
    await handleLeadClaim(phone, claimMatch[1]);
    return;
  }
  const passMatch = payload.match(/^pass:(.+)$/);
  if (passMatch) {
    await handleLeadPass(phone, passMatch[1]);
    return;
  }
  log.warn({ phone, payload }, 'Unknown button payload');
}

async function handleConnectionCode(phone: string, code: string): Promise<void> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name')
    .ilike('id', `${code}%`)
    .maybeSingle();

  if (!profile) {
    await sendText(phone, 'Invalid connection code. Please generate a new one from the dashboard.');
    return;
  }

  await linkWhatsAppPhone(profile.id, phone);
  const name = (profile as { full_name?: string }).full_name?.split(' ')[0] ?? '';
  await sendText(phone, `✅ Connected! Hi ${name} 👋\nYou'll now receive lead notifications here.`);
}

async function handleGroupLink(phone: string, text: string): Promise<void> {
  const match = text.match(GROUP_LINK_RE);
  if (!match) return;

  const inviteCode = match[1];
  const profile = await findProfile(phone);

  if (profile) {
    await supabase.from('contractor_group_scan_requests').insert({
      contractor_id: profile.id,
      invite_code: inviteCode,
      invite_link: `https://chat.whatsapp.com/${inviteCode}`,
      status: 'pending',
    });
    await sendText(phone, '✅ Group saved! We\'ll review and add it to our scan list.');
  } else {
    await sendText(phone, '✅ Thanks! Send your registration link too so we can connect the group to your account.');
  }
}

/** Stable integer hash of phone for Postgres advisory lock key */
function hashPhoneToInt(phone: string): number {
  let hash = 0;
  for (let i = 0; i < phone.length; i++) {
    const char = phone.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash;
}
