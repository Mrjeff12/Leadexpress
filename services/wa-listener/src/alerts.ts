import { createClient } from '@supabase/supabase-js';
import { config } from './config.js';
import { logger } from './logger.js';

const supabase = createClient(config.supabase.url, config.supabase.serviceKey);

let pollTimer: ReturnType<typeof setInterval> | null = null;

// ── Twilio WhatsApp via REST (no SDK) ───────────────────────────────────────

export async function sendTwilioWhatsApp(
  phone: string,
  message: string
): Promise<boolean> {
  const { accountSid, authToken, whatsappFrom } = config.twilio;

  if (!accountSid || !authToken || !whatsappFrom) {
    logger.warn('Twilio credentials missing — skipping WhatsApp alert');
    return false;
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

  const body = new URLSearchParams({
    From: `whatsapp:${whatsappFrom}`,
    To: `whatsapp:${phone}`,
    Body: message,
  });

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    if (!res.ok) {
      const text = await res.text();
      logger.error({ status: res.status, text }, 'Twilio send failed');
      return false;
    }

    logger.info({ phone }, 'WhatsApp alert sent');
    return true;
  } catch (err) {
    logger.error({ err, phone }, 'Twilio send error');
    return false;
  }
}

// ── Dispatch undelivered alerts ─────────────────────────────────────────────

const SEVERITY_EMOJI: Record<string, string> = {
  critical: '🚨',
  warning: '⚠️',
  info: 'ℹ️',
};

export async function dispatchUndelivered(): Promise<void> {
  try {
    const { data: alerts, error } = await supabase
      .from('system_alerts')
      .select('*')
      .eq('delivered', false)
      .order('created_at')
      .limit(10);

    if (error) {
      logger.error({ err: error }, 'Failed to fetch undelivered alerts');
      return;
    }

    if (!alerts || alerts.length === 0) return;

    logger.info({ count: alerts.length }, 'Dispatching undelivered alerts');

    for (const alert of alerts) {
      if (alert.channel === 'whatsapp') {
        const emoji = SEVERITY_EMOJI[alert.severity] ?? 'ℹ️';
        const formattedMessage = `${emoji} ${alert.title}\n${alert.message}`;

        await sendTwilioWhatsApp(config.alerts.adminPhone, formattedMessage);
      }
      // For 'dashboard' and 'log_only' channels, just mark as delivered

      await supabase
        .from('system_alerts')
        .update({
          delivered: true,
          delivered_at: new Date().toISOString(),
        })
        .eq('id', alert.id);
    }
  } catch (err) {
    logger.error({ err }, 'Error in dispatchUndelivered');
  }
}

// ── Poller start / stop ─────────────────────────────────────────────────────

export async function startAlertPoller(): Promise<void> {
  logger.info(
    { intervalMs: config.alerts.pollIntervalMs },
    'Starting alert poller'
  );

  // Dispatch immediately, then on interval
  await dispatchUndelivered();
  pollTimer = setInterval(dispatchUndelivered, config.alerts.pollIntervalMs);
}

export async function stopAlertPoller(): Promise<void> {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  logger.info('Alert poller stopped');
}
