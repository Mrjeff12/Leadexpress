import { supabase } from '../lib/supabase.js';
import { sendText } from '../lib/twilio.js';
import { t } from '../lib/i18n.js';
import { hasActiveSubscription, recordOptOut } from '../lib/profile.js';
import { startOnboarding } from './onboarding.js';
import pino from 'pino';

const log = pino({ name: 'known-user' });

const MENU_TRIGGERS = new Set(['menu', 'help', 'תפריט', 'עזרה', 'options']);
const STOP_TRIGGERS = new Set(['stop', 'unsubscribe', 'cancel', 'הסר', 'ביטול', 'הפסק']);
const POSITIVE_RESPONSES = new Set([
  'כן','yes','yeah','yep','y','ok','אוקי','זמין','available',
  'sure','בטח','כמובן','1','👍','yea','ya','ken','betach',
]);

export async function handleKnownUser(
  phone: string,
  text: string,
  profile: { id: string; full_name: string },
): Promise<void> {
  const lower = text.trim().toLowerCase();

  // Check contractor setup — if not set up, start onboarding (no subscription check yet)
  const { data: contractor } = await supabase
    .from('contractors')
    .select('user_id, professions, zip_codes, wa_notify')
    .eq('user_id', profile.id)
    .maybeSingle();

  if (!contractor || (contractor as { professions?: string[]; zip_codes?: string[] }).professions?.length === 0 || (contractor as { professions?: string[]; zip_codes?: string[] }).zip_codes?.length === 0) {
    if (!contractor) {
      await supabase.from('contractors').insert({ user_id: profile.id, wa_notify: true });
    }
    await startOnboarding(phone, profile);
    return;
  }

  // Enable WA notify if disabled
  if (!(contractor as { wa_notify?: boolean }).wa_notify) {
    await supabase.from('contractors').update({ wa_notify: true }).eq('user_id', profile.id);
  }

  // Subscription check — only for fully set-up users
  const hasSub = await hasActiveSubscription(profile.id);
  if (!hasSub) {
    const name = profile.full_name.split(' ')[0];
    await sendText(phone, t(phone, 'subscription_expired', { name }));
    // Don't return — allow menu access
  }

  // STOP / unsubscribe
  if (STOP_TRIGGERS.has(lower)) {
    await recordOptOut(phone);
    await sendText(phone, t(phone, 'unsubscribed'));
    return;
  }

  // MENU
  if (MENU_TRIGGERS.has(lower)) {
    await sendText(phone, t(phone, 'menu'));
    return;
  }

  // Daily check-in positive response
  if ([...POSITIVE_RESPONSES].some(w => lower.includes(w))) {
    await markAvailable(phone, profile.id);
    return;
  }

  // Unrecognized — show menu
  log.debug({ phone, text: lower }, 'Unrecognized message from known user');
  await sendText(phone, t(phone, 'menu'));
}

async function markAvailable(phone: string, userId: string): Promise<void> {
  const windowUntil = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const { error } = await supabase
    .from('contractors')
    .update({ available_today: true, wa_window_until: windowUntil })
    .eq('user_id', userId);

  if (error) {
    log.error({ error, userId }, 'Failed to mark available');
    return;
  }
  await sendText(phone, t(phone, 'available_confirm'));
  log.info({ userId, windowUntil }, 'Contractor marked available');
}
