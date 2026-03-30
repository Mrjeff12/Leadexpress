import { Worker } from 'bullmq';
import { createClient } from '@supabase/supabase-js';
import IORedis from 'ioredis';
import type { Logger } from 'pino';
import { config } from './config.js';

export interface SmsNotificationJob {
  leadId: string;
  contractorId: string;
  phone: string;
  profession: string;
  city: string | null;
}

const TWILIO_API_URL = `https://api.twilio.com/2010-04-01/Accounts/${config.twilio.accountSid}/Messages.json`;
const AUTH_HEADER = config.twilio.accountSid
  ? 'Basic ' + Buffer.from(`${config.twilio.accountSid}:${config.twilio.authToken}`).toString('base64')
  : '';

const supabase = createClient(config.supabase.url, config.supabase.serviceKey);

function makeRedis() {
  return process.env.REDIS_URL
    ? new IORedis(process.env.REDIS_URL, { maxRetriesPerRequest: null })
    : new IORedis({ ...config.redis });
}

const REBECA_PHONE = process.env.REBECA_PHONE ?? '14155238886';

/**
 * BullMQ worker that sends SMS notifications via Twilio.
 * Last-resort fallback — sends a short SMS with a wa.me link to reconnect with Rebeca.
 */
export function createSmsWorker(log: Logger): { worker: Worker | null; cleanup: () => Promise<void> } {
  if (!config.twilio.accountSid || !config.twilio.smsFrom) {
    log.warn('Twilio SMS credentials not configured — sms-worker disabled');
    return { worker: null, cleanup: async () => {} };
  }

  const connection = makeRedis();

  const worker = new Worker<SmsNotificationJob>(
    config.queues.smsNotifications,
    async (job) => {
      const { leadId, contractorId, phone, profession, city } = job.data;
      const jobLog = log.child({ jobId: job.id, leadId, contractorId, phone });

      const profLabel = profession.replace(/_/g, ' ');
      const location = city ?? 'your area';
      const body = `MasterLeadFlow: New ${profLabel} lead in ${location}! Tap to see: https://wa.me/${REBECA_PHONE}?text=Hi`;

      const toPhone = phone.startsWith('+') ? phone : `+${phone}`;

      const formData = new URLSearchParams({
        From: config.twilio.smsFrom,
        To: toPhone,
        Body: body,
      });

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
        jobLog.info({ sid: data.sid }, 'SMS sent');

        await supabase.from('reconnect_throttle').upsert(
          { contractor_id: contractorId, channel: 'sms', sent_at: new Date().toISOString() },
          { onConflict: 'contractor_id,channel' },
        );

        return { sent: true, sid: data.sid };
      }

      const errorMsg = (data.message as string) ?? 'Unknown error';
      jobLog.error({ status: res.status, errorMsg, code: data.code }, 'SMS send failed');

      if (res.status === 429) {
        throw new Error(`Rate limited — retry later`);
      }

      throw new Error(`SMS send failed: ${errorMsg}`);
    },
    {
      connection,
      concurrency: 5,
      removeOnComplete: { count: 1000 },
      removeOnFail: { count: 5000 },
      limiter: { max: 1, duration: 1000 }, // 1 SMS/sec (long code limit)
    },
  );

  worker.on('completed', (job, result) => {
    log.info({ jobId: job?.id, result }, 'SMS job completed');
  });

  worker.on('failed', (job, err) => {
    log.error({ jobId: job?.id, err: err.message }, 'SMS job failed');
  });

  worker.on('error', (err) => {
    log.error({ err: err.message }, 'SMS worker error');
  });

  const cleanup = async () => {
    await worker.close();
  };

  return { worker, cleanup };
}
