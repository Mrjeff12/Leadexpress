import { Worker, Queue } from 'bullmq';
import { createClient } from '@supabase/supabase-js';
import type { Logger } from 'pino';
import IORedis from 'ioredis';
import { CITY_ZIPS } from '@masterleadflow/shared';
import { config } from './config.js';
import { matchLead, type Lead } from './matcher.js';

function resolveZipFromCity(city: string): string | null {
  const normalized = city.toLowerCase().replace(/\s+/g, '_');
  for (const state of Object.values(CITY_ZIPS)) {
    const cityInfo = state[normalized];
    if (cityInfo && cityInfo.zips.length > 0) {
      return cityInfo.zips[0];
    }
  }
  return null;
}

const supabase = createClient(config.supabase.url, config.supabase.serviceKey);

function makeRedis() {
  return process.env.REDIS_URL
    ? new IORedis(process.env.REDIS_URL, { maxRetriesPerRequest: null })
    : new IORedis({ ...config.redis });
}

export function createMatchingWorker(log: Logger): { worker: Worker; cleanup: () => Promise<void> } {
  const connection = makeRedis();
  const notificationQueue = new Queue(config.queues.notifications, {
    connection,
    defaultJobOptions: {
      removeOnComplete: { count: 1000 },
      removeOnFail: { count: 5000 },
    },
  });

  // WhatsApp notification queue (for contractors with open 24h window)
  const waNotificationQueue = new Queue('wa-notifications', {
    connection,
    defaultJobOptions: {
      removeOnComplete: { count: 1000 },
      removeOnFail: { count: 5000 },
    },
  });

  const pushNotificationQueue = new Queue('push-notifications', {
    connection,
    defaultJobOptions: {
      removeOnComplete: { count: 1000 },
      removeOnFail: { count: 5000 },
    },
  });

  const worker = new Worker(
    config.queues.parsedLeads,
    async (job) => {
      // Parser sends { leadId } — fetch the full lead from DB
      const { leadId } = job.data as { leadId: string };
      const jobLog = log.child({ jobId: job.id, leadId });

      jobLog.info('Fetching lead for matching');

      // ---- Fetch lead + group name ----
      const { data: row, error: fetchErr } = await supabase
        .from('leads')
        .select(`
          id, profession, zip_code, city, budget_range,
          urgency, parsed_summary, group_id,
          groups!inner(name)
        `)
        .eq('id', leadId)
        .single();

      if (fetchErr || !row) {
        jobLog.error({ error: fetchErr }, 'Failed to fetch lead from DB');
        throw new Error(`Lead ${leadId} not found: ${fetchErr?.message}`);
      }

      // Resolve group name (Supabase join may return array or object)
      const groupData = row.groups as unknown;
      const sourceName = Array.isArray(groupData)
        ? (groupData[0] as { name: string })?.name
        : (groupData as { name: string })?.name ?? null;

      if (!row.profession) {
        jobLog.warn(
          { profession: row.profession, zip: row.zip_code },
          'Lead missing profession — skipping',
        );
        return { matched: 0, skipped: true };
      }

      // Leads without zip_code: try matching by city if available
      if (!row.zip_code && !row.city) {
        jobLog.warn(
          { profession: row.profession },
          'Lead missing both zip_code and city — marking as new (unmatched)',
        );
        await supabase.from('leads').update({ status: 'new' }).eq('id', leadId);
        return { matched: 0, skipped: true };
      }

      // Resolve city to zip if needed
      let resolvedZip = row.zip_code;
      if (!resolvedZip && row.city) {
        resolvedZip = resolveZipFromCity(row.city);
        if (resolvedZip) {
          jobLog.info({ city: row.city, resolvedZip }, 'Resolved city to ZIP code');
        } else {
          jobLog.warn({ city: row.city }, 'Could not resolve city to ZIP — no match in city-zips data');
          await supabase.from('leads').update({ status: 'new' }).eq('id', leadId);
          return { matched: 0, skipped: true };
        }
      }

      const lead: Lead = {
        id: row.id,
        profession: row.profession,
        zip_code: resolvedZip,
        city: row.city ?? null,
        budget_range: row.budget_range ?? null,
        urgency: row.urgency ?? 'warm',
        summary: row.parsed_summary ?? '',
        source_name: sourceName,
      };

      // ---- Log pipeline event: matching ----
      await logPipelineEvent('matched', row.group_id, leadId);

      const matched = await matchLead(lead, notificationQueue, jobLog, waNotificationQueue, pushNotificationQueue);

      // ---- Log pipeline event: sent ----
      if (matched > 0) {
        await logPipelineEvent('sent', row.group_id, leadId, {
          contractors_count: matched,
        });
      }

      return { matched };
    },
    {
      connection,
      concurrency: config.worker.concurrency,
      removeOnComplete: { count: 1000 },
      removeOnFail: { count: 5000 },
    },
  );

  worker.on('completed', (job, result) => {
    log.info({ jobId: job?.id, result }, 'Job completed');
  });

  worker.on('failed', (job, err) => {
    log.error({ jobId: job?.id, err: err.message }, 'Job failed');
  });

  worker.on('error', (err) => {
    log.error({ err: err.message }, 'Worker error');
  });

  const cleanup = async () => {
    await worker.close();
    await notificationQueue.close();
    await waNotificationQueue.close();
    await pushNotificationQueue.close();
  };

  return { worker, cleanup };
}

// ---- Pipeline event helper ----
async function logPipelineEvent(
  stage: string,
  groupId: string | null,
  leadId: string,
  detail: Record<string, unknown> = {},
): Promise<void> {
  await supabase.from('pipeline_events').insert({
    stage,
    group_id: groupId,
    lead_id: leadId,
    detail,
  });
}
