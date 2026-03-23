import cron from 'node-cron';
import { createClient } from '@supabase/supabase-js';
import type { Logger } from 'pino';
import { config } from './config.js';
import { sendText } from './interactive.js';

const supabase = createClient(config.supabase.url, config.supabase.serviceKey);

/**
 * Daily check-in: sends availability message to WA-enabled contractors.
 * - Only on their selected working days
 * - Only to active subscribers
 * - Includes yesterday's lead count for motivation
 * - Buttons: "I'm available" / "Off today"
 */
export function startCheckinCron(log: Logger): cron.ScheduledTask {
  log.info(
    { schedule: config.cron.checkinSchedule, timezone: config.cron.timezone },
    'Starting daily check-in cron',
  );

  return cron.schedule(
    config.cron.checkinSchedule,
    async () => {
      log.info('Running daily check-in');

      const today = new Date().getDay(); // 0=Sun, 1=Mon, ..., 6=Sat

      // Reset all contractors' availability from yesterday
      await supabase
        .from('contractors')
        .update({ available_today: false, wa_window_until: null })
        .eq('wa_notify', true);

      // Fetch WA-enabled contractors with active subscriptions
      // who work today (working_days contains today's day number)
      // Filter out expired trials (current_period_end in the past)
      const { data: contractors, error } = await supabase
        .from('contractors')
        .select(`
          user_id,
          working_days,
          zip_codes,
          profiles!inner(full_name, whatsapp_phone),
          subscriptions!inner(status, current_period_end)
        `)
        .eq('is_active', true)
        .eq('wa_notify', true)
        .in('subscriptions.status', ['active', 'trialing'])
        .gte('subscriptions.current_period_end', new Date().toISOString())
        .not('profiles.whatsapp_phone', 'is', null)
        .contains('working_days', [today]);

      if (error) {
        log.error({ error }, 'Failed to fetch contractors for check-in');
        return;
      }

      if (!contractors || contractors.length === 0) {
        log.info({ today }, 'No WA-enabled contractors found for today');
        return;
      }

      log.info({ count: contractors.length, dayOfWeek: today }, 'Sending check-in messages');

      // Get yesterday's date range for lead count queries
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      let sent = 0;
      let failed = 0;

      for (const contractor of contractors) {
        const profile = contractor.profiles as unknown as {
          full_name: string;
          whatsapp_phone: string;
        };

        const firstName = profile.full_name.split(' ')[0];

        // Count yesterday's leads filtered by contractor's service areas (zip_codes)
        const contractorZips = (contractor as any).zip_codes as string[] | null;
        let leadCount = 0;

        if (contractorZips && contractorZips.length > 0) {
          const { count } = await supabase
            .from('leads')
            .select('id', { count: 'exact', head: true })
            .gte('created_at', yesterday.toISOString())
            .lt('created_at', todayStart.toISOString())
            .in('zip_code', contractorZips);
          leadCount = count ?? 0;
        }

        const leadLine = leadCount > 0
          ? `🔥 ${leadCount} new leads in your area yesterday.`
          : `Ready for today's leads?`;

        const message = [
          `☀️ Good morning ${firstName}!`,
          leadLine,
          '',
          `Reply:`,
          `1️⃣ ✅ I'm available`,
          `2️⃣ ❌ Off today`,
        ].join('\n');

        const result = await sendText(profile.whatsapp_phone, message, log);

        if (result.success) {
          sent++;
        } else {
          failed++;
          log.warn(
            { contractorId: contractor.user_id, error: result.error },
            'Failed to send check-in',
          );
        }

        // Small delay to respect rate limits
        await sleep(50);
      }

      log.info({ sent, failed, total: contractors.length }, 'Daily check-in completed');
    },
    { timezone: config.cron.timezone },
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
