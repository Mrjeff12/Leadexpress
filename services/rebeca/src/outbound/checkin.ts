import cron from 'node-cron';
import { supabase } from '../lib/supabase.js';
import { sendText } from '../lib/twilio.js';
import { config } from '../config.js';
import pino from 'pino';

const log = pino({ name: 'checkin-cron' });

async function alreadyRanToday(): Promise<boolean> {
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabase
    .from('cron_runs')
    .select('id')
    .eq('job', 'daily_checkin')
    .eq('run_date', today)
    .maybeSingle();
  return !!data;
}

async function markRanToday(): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  await supabase.from('cron_runs').upsert({
    job: 'daily_checkin',
    run_date: today,
    ran_at: new Date().toISOString(),
  });
}

async function runCheckin(): Promise<void> {
  if (await alreadyRanToday()) {
    log.info('Check-in already ran today, skipping');
    return;
  }

  log.info('Starting daily check-in');
  await markRanToday();

  await supabase
    .from('contractors')
    .update({ available_today: false })
    .eq('is_active', true);

  const { data: contractors, error } = await supabase
    .from('contractors')
    .select('user_id, profiles!inner(full_name, whatsapp_phone)')
    .eq('wa_notify', true)
    .eq('is_active', true);

  if (error || !contractors) {
    log.error({ error }, 'Failed to fetch contractors for check-in');
    return;
  }

  log.info({ count: contractors.length }, 'Sending daily check-ins');

  let sent = 0;
  let failed = 0;

  for (const c of contractors) {
    const profile = (c as unknown as { profiles: { full_name: string; whatsapp_phone: string | null } }).profiles;
    if (!profile?.whatsapp_phone) continue;

    try {
      const name = profile.full_name?.split(' ')[0] ?? '';
      const isHebrew = profile.whatsapp_phone.startsWith('+972');
      const msg = isHebrew
        ? `שלום ${name}! 👋\nזמין להצעות עבודה היום?\n\n1️⃣ כן, זמין\n2️⃣ לא היום`
        : `Hey ${name}! 👋\nAre you available for jobs today?\n\n1️⃣ Yes, available\n2️⃣ Not today`;

      await sendText(profile.whatsapp_phone, msg);
      sent++;

      await new Promise(r => setTimeout(r, 50));
    } catch (err) {
      log.warn({ err, userId: c.user_id }, 'Check-in send failed');
      failed++;
    }
  }

  log.info({ sent, failed }, 'Daily check-in complete');
}

export function startCheckinCron(): cron.ScheduledTask {
  return cron.schedule(
    config.cron.checkinSchedule,
    () => {
      runCheckin().catch(err => log.error({ err }, 'Check-in cron error'));
    },
    { timezone: config.cron.timezone },
  );
}
