import { Worker, Queue, type Job } from 'bullmq';
import Redis from 'ioredis';
import { createClient } from '@supabase/supabase-js';
import pino from 'pino';
import { config } from './config.js';
import { parseMessage } from './parser.js';
import { isDuplicate } from './dedup.js';

const log = pino({ name: 'parser-worker' });

const redis = new Redis({
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
  maxRetriesPerRequest: null,
  ...((config.redis as any).tls ? { tls: {} } : {}),
});

const supabase = createClient(config.supabase.url, config.supabase.serviceKey);

const parsedLeadsQueue = new Queue(config.queues.parsedLeads, {
  connection: {
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password,
    maxRetriesPerRequest: null,
    ...((config.redis as any).tls ? { tls: {} } : {}),
  },
});

// ---- Payload from wa-listener (matches RawMessageJob in queue.ts) ----
interface RawMessagePayload {
  messageId: string;
  groupId: string;       // wa_group_id (e.g. "120363044...")
  body: string;          // message text
  sender: string | null; // display name
  senderId?: string;     // e.g. "972501234567@c.us"
  timestamp: number;     // unix epoch
  accountId: string;     // wa_accounts.id UUID
}

// ---- Pipeline event logger ----
async function logPipelineEvent(
  stage: string,
  payload: {
    groupId?: string;
    waMessageId?: string;
    senderId?: string;
    leadId?: string;
    accountId?: string;
    detail?: Record<string, unknown>;
  },
): Promise<void> {
  // Look up internal group UUID from wa_group_id
  let groupUuid: string | null = null;
  if (payload.groupId) {
    const { data } = await supabase
      .from('groups')
      .select('id')
      .eq('wa_group_id', payload.groupId)
      .single();
    groupUuid = data?.id ?? null;
  }

  await supabase.from('pipeline_events').insert({
    stage,
    group_id: groupUuid,
    wa_message_id: payload.waMessageId ?? null,
    sender_id: payload.senderId ?? null,
    lead_id: payload.leadId ?? null,
    detail: payload.detail ?? {},
    // wa_account_id omitted — wa_accounts table not yet populated, FK would reject
  });
}

// ---- Group UUID cache (avoid repeated lookups) ----
const groupUuidCache = new Map<string, string>();

async function resolveGroupUuid(waGroupId: string): Promise<string | null> {
  const cached = groupUuidCache.get(waGroupId);
  if (cached) return cached;

  const { data } = await supabase
    .from('groups')
    .select('id')
    .eq('wa_group_id', waGroupId)
    .single();

  if (data?.id) {
    groupUuidCache.set(waGroupId, data.id);
    return data.id;
  }
  return null;
}

// ---- Main job processor ----
async function processJob(job: Job<RawMessagePayload>): Promise<void> {
  const jobLog = log.child({ jobId: job.id });
  const { messageId, groupId, body, sender, senderId, timestamp, accountId } = job.data;

  const text = body;

  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    jobLog.warn('Skipping job with empty text');
    return;
  }

  // ---- dedup ----
  const { duplicate, hash } = await isDuplicate(redis, text);
  if (duplicate) {
    jobLog.info({ hash }, 'Duplicate message — skipping');
    return;
  }

  // ---- log: ai_parsing ----
  await logPipelineEvent('ai_parsing', {
    groupId,
    waMessageId: messageId,
    senderId,
    accountId,
    detail: { sender, model: config.openai.model },
  });

  // ---- parse with OpenAI ----
  const { parsed, usage, durationMs } = await parseMessage(text, jobLog);

  // ---- log: ai_parsed ----
  await logPipelineEvent('ai_parsed', {
    groupId,
    waMessageId: messageId,
    senderId,
    accountId,
    detail: {
      is_lead: parsed.is_lead,
      profession: parsed.profession,
      durationMs,
      tokens: usage?.total_tokens,
    },
  });

  // ---- skip non-leads ----
  if (!parsed.is_lead) {
    jobLog.info({ durationMs }, 'Not a lead — skipping');

    await logPipelineEvent('no_lead', {
      groupId,
      waMessageId: messageId,
      senderId,
      accountId,
      detail: { reason: 'ai_classified_not_lead', durationMs },
    });
    return;
  }

  // ---- resolve group UUID ----
  const groupUuid = await resolveGroupUuid(groupId);
  if (!groupUuid) {
    jobLog.error({ waGroupId: groupId }, 'Group not found in DB — cannot insert lead');
    return;
  }

  // ---- format budget_range ----
  let budgetRange: string | null = null;
  if (parsed.budget_min != null && parsed.budget_max != null) {
    budgetRange = `$${parsed.budget_min}–$${parsed.budget_max}`;
  } else if (parsed.budget_min != null) {
    budgetRange = `$${parsed.budget_min}+`;
  } else if (parsed.budget_max != null) {
    budgetRange = `up to $${parsed.budget_max}`;
  }

  // ---- persist to Supabase ----
  const { data, error } = await supabase
    .from('leads')
    .insert({
      group_id: groupUuid,
      wa_message_id: messageId,
      content_hash: hash,
      raw_message: text,
      sender_id: senderId ?? null,
      profession: parsed.profession === 'not_a_lead' ? 'other' : parsed.profession,
      zip_code: parsed.zip_code,
      city: parsed.city,
      budget_range: budgetRange,
      urgency: parsed.urgency,
      parsed_summary: parsed.summary,
      filter_stage: 'ai_parsed',
      status: 'parsed',
    })
    .select('id')
    .single();

  if (error) {
    jobLog.error({ error }, 'Supabase insert failed');
    throw new Error(`Supabase insert failed: ${error.message}`);
  }

  const leadId = data.id;
  jobLog.info({ leadId, profession: parsed.profession, urgency: parsed.urgency }, 'Lead saved');

  // ---- log: lead_created ----
  await logPipelineEvent('lead_created', {
    groupId,
    waMessageId: messageId,
    senderId,
    accountId,
    leadId,
    detail: {
      profession: parsed.profession,
      zip_code: parsed.zip_code,
      city: parsed.city,
      urgency: parsed.urgency,
    },
  });

  // ---- update sender stats: mark as lead contributor ----
  if (senderId) {
    await supabase.from('group_members').upsert(
      {
        group_id: groupUuid,
        wa_sender_id: senderId,
        display_name: sender,
        total_messages: 1,   // will be incremented by wa-listener, but ensure row exists
        lead_messages: 1,
        last_seen_at: new Date().toISOString(),
      },
      {
        onConflict: 'group_id,wa_sender_id',
        ignoreDuplicates: false,
      },
    );

    // Increment lead_messages counter
    await supabase.rpc('increment_lead_messages', {
      p_group_id: groupUuid,
      p_sender_id: senderId,
    }).then(({ error: rpcErr }) => {
      // If RPC doesn't exist yet, just log and continue — the upsert above is enough
      if (rpcErr) jobLog.debug({ rpcErr }, 'increment_lead_messages RPC not available, skipping');
    });
  }

  // ---- enqueue for downstream matching ----
  await parsedLeadsQueue.add('parsed-lead', { leadId }, { removeOnComplete: 1000, removeOnFail: 5000 });
  jobLog.info({ leadId }, 'Pushed to parsed-leads queue');
}

export function startWorker(): Worker {
  const worker = new Worker(config.queues.rawMessages, processJob, {
    connection: {
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      maxRetriesPerRequest: null,
      ...((config.redis as any).tls ? { tls: {} } : {}),
    },
    concurrency: config.worker.concurrency,
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 5000 },
  });

  worker.on('completed', (job) => {
    log.debug({ jobId: job.id }, 'Job completed');
  });

  worker.on('failed', (job, err) => {
    log.error({ jobId: job?.id, err: err.message }, 'Job failed');
  });

  worker.on('error', (err) => {
    log.error({ err: err.message }, 'Worker error');
  });

  log.info(
    { concurrency: config.worker.concurrency, queue: config.queues.rawMessages },
    'Parser worker started',
  );

  return worker;
}
