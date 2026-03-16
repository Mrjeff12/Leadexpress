import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Logger } from 'pino';
import { config } from '../config.js';
import { sendText } from '../interactive.js';

const supabase: SupabaseClient = createClient(config.supabase.url, config.supabase.serviceKey);

/**
 * Handle check-in responses: "I'm available" (1) or "Off today" (2)
 * Both responses open the 24h free messaging window (any incoming message does).
 */
export async function handleCheckinResponse(
  phone: string,
  text: string,
  log: Logger,
): Promise<boolean> {
  const trimmed = text.trim().toLowerCase();

  // Detect check-in response
  const isAvailable = trimmed === '1' || trimmed.includes('available') || trimmed.includes('yes') || trimmed.includes('כן') || trimmed === '👍';
  const isOff = trimmed === '2' || trimmed.includes('off') || trimmed.includes('skip');

  if (!isAvailable && !isOff) return false;

  // Find contractor
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('whatsapp_phone', phone)
    .maybeSingle();

  if (!profile) {
    log.warn({ phone }, 'Check-in response from unknown phone');
    return true;
  }

  // Verify subscription is still active (Layer 3)
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('status')
    .eq('user_id', profile.id)
    .in('status', ['active', 'trialing'])
    .maybeSingle();

  if (!sub) {
    await sendText(
      phone,
      `Hi ${profile.full_name}! Your subscription has expired.\nVisit leadexpress.com to renew.`,
      log,
    );
    return true;
  }

  if (isAvailable) {
    const windowUntil = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    await supabase
      .from('contractors')
      .update({ available_today: true, wa_window_until: windowUntil })
      .eq('user_id', profile.id);

    await sendText(phone, `✅ You're live! Leads will come through today.`, log);
    log.info({ userId: profile.id, windowUntil }, 'Contractor available');
  } else {
    await supabase
      .from('contractors')
      .update({ available_today: false })
      .eq('user_id', profile.id);

    await sendText(phone, `👍 Got it, enjoy your day off! See you tomorrow.`, log);
    log.info({ userId: profile.id }, 'Contractor off today');
  }

  return true;
}
