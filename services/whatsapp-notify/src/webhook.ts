import { Hono } from 'hono';
import { createClient } from '@supabase/supabase-js';
import type { Logger } from 'pino';
import type Redis from 'ioredis';
import { config } from './config.js';
import {
  getRegistrationState,
  handleRegistrationStep,
  startRegistration,
  acquireLock,
  releaseLock,
  isOptedOut,
  recordOptOut,
} from './handlers/registration.js';
import {
  getOnboardState,
  handleOnboardingStep,
  handleFirstContact,
} from './handlers/onboarding.js';
import { sendText } from './interactive.js';

const supabase = createClient(config.supabase.url, config.supabase.serviceKey);

export function createWebhookApp(log: Logger, redis: Redis): Hono {
  const app = new Hono();

  app.get('/health', (c) => c.json({ status: 'ok', service: 'whatsapp-notify' }));

  app.post('/webhooks/whatsapp', async (c) => {
    const body = await c.req.parseBody();
    const from = (body.From as string) ?? '';
    const text = (body.Body as string) ?? '';
    const messageSid = (body.MessageSid as string) ?? '';
    const phone = from.replace('whatsapp:', '');

    log.info({ phone, text: text.substring(0, 50), messageSid }, 'Received WhatsApp message');

    processIncoming(phone, text.trim(), redis, log).catch((err) => {
      log.error({ err }, 'Error processing incoming WhatsApp');
    });

    c.header('Content-Type', 'text/xml');
    return c.body('<Response></Response>', 200);
  });

  return app;
}

async function processIncoming(phone: string, text: string, redis: Redis, log: Logger): Promise<void> {
  // 1. Acquire per-phone lock
  if (!(await acquireLock(redis, phone))) {
    log.debug({ phone }, 'Phone locked — skipping concurrent message');
    await sendText(phone, `One moment, processing your previous message...`, log);
    return;
  }

  try {
    // 2. Registration in progress?
    const regState = await getRegistrationState(redis, phone);
    if (regState) {
      await handleRegistrationStep(phone, text, redis, log);
      return;
    }

    // 3. Onboarding in progress?
    const onboardState = await getOnboardState(redis, phone);
    if (onboardState) {
      await handleOnboardingStep(phone, text, redis, log);
      return;
    }

    // 4. Known user by whatsapp_phone?
    const { data: waProfile } = await supabase
      .from('profiles')
      .select('id, full_name, whatsapp_phone')
      .eq('whatsapp_phone', phone)
      .maybeSingle();

    if (waProfile) {
      await handleKnownUser(phone, text, waProfile, redis, log);
      return;
    }

    // 5. Known user by phone?
    const { data: phoneProfile } = await supabase
      .from('profiles')
      .select('id, full_name, phone, whatsapp_phone')
      .eq('phone', phone)
      .maybeSingle();

    if (phoneProfile) {
      await handleFirstContact(phone, log, redis);
      return;
    }

    // 6. Opted out?
    if (await isOptedOut(phone)) {
      log.info({ phone }, 'Opted-out phone — ignoring');
      return;
    }

    // 7. Unknown phone → start registration!
    // Note: If a user's registration TTL expired, their state was cleared and they won't have
    // a profile (never completed registration). They land here and get a fresh welcome, which
    // is acceptable UX — re-tracking expired sessions via a separate Redis key would be overengineering.
    log.info({ phone }, 'New phone — starting WhatsApp registration');
    await startRegistration(phone, redis, log);
  } finally {
    await releaseLock(redis, phone);
  }
}

async function handleKnownUser(
  phone: string,
  text: string,
  profile: { id: string; full_name: string },
  redis: Redis,
  log: Logger,
): Promise<void> {
  const trimmed = text.trim().toLowerCase();

  // Daily check-in positive response
  if (isPositiveResponse(trimmed)) {
    await markContractorAvailable(phone, profile.id, log);
    return;
  }

  // MENU command
  if (trimmed === 'menu' || trimmed === 'help') {
    await sendText(
      phone,
      `*LeadExpress Menu*\n\n1️⃣ STATUS — Check your account\n2️⃣ PROFILE — Update professions & areas\n3️⃣ STOP — Unsubscribe\n\nReply with a keyword.`,
      log,
    );
    return;
  }

  // STOP
  if (trimmed === 'stop' || trimmed === 'unsubscribe' || trimmed === 'cancel') {
    await recordOptOut(phone);
    // Deactivate contractor
    await supabase
      .from('contractors')
      .update({ wa_notify: false, is_active: false })
      .eq('user_id', profile.id);
    await sendText(phone, `You've been unsubscribed. You won't receive any more messages from us.`, log);
    return;
  }

  log.debug({ phone, text: trimmed }, 'Unrecognized message from known user');
}

function isPositiveResponse(text: string): boolean {
  const positiveWords = [
    'כן', 'yes', 'yeah', 'yep', 'y', 'ok', 'אוקי',
    'זמין', 'available', 'sure', 'בטח', 'כמובן',
    '1', '👍', 'yea', 'ya', 'ken', 'betach',
  ];
  return positiveWords.some((word) => text.includes(word));
}

async function markContractorAvailable(phone: string, userId: string, log: Logger): Promise<void> {
  const windowUntil = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const { error } = await supabase
    .from('contractors')
    .update({ available_today: true, wa_window_until: windowUntil })
    .eq('user_id', userId);

  if (error) {
    log.error({ error, userId }, 'Failed to mark contractor available');
    return;
  }
  log.info({ userId, phone, windowUntil }, 'Contractor marked available — 24h window open');
}
