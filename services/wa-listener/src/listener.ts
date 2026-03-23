import Redis from 'ioredis';
import { createClient } from '@supabase/supabase-js';
import { config } from './config.js';
import { logger } from './logger.js';
import { enqueueMessage, type RawMessageJob } from './queue.js';
import { setQR, setConnected, setDisconnected, setConnecting } from './api.js';
import { runSmartFilter, updateSenderStats, logPipelineEvent } from './smart-filter.js';

// ── Green API helpers ────────────────────────────────────────────────────────
const { apiUrl, idInstance, apiToken } = config.greenApi;

function greenUrl(method: string): string {
  return `${apiUrl}/waInstance${idInstance}/${method}/${apiToken}`;
}

// ── Supabase client ──────────────────────────────────────────────────────────
const supabase = createClient(config.supabase.url, config.supabase.serviceKey);

// ── Redis for deduplication ──────────────────────────────────────────────────
let dedupRedis: Redis | null = null;

function getDedupRedis(): Redis {
  if (!dedupRedis) {
    dedupRedis = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      maxRetriesPerRequest: null,
      ...((config.redis as any).tls ? { tls: {} } : {}),
    });
    dedupRedis.on('error', (err) => {
      logger.error({ err }, 'Dedup Redis connection error');
    });
  }
  return dedupRedis;
}

// ── Monitored groups cache ───────────────────────────────────────────────────
let monitoredGroupIds: Set<string> = new Set();
let groupsCacheExpiry = 0;
const GROUPS_CACHE_TTL_MS = 60_000;

async function getMonitoredGroups(): Promise<Set<string>> {
  const now = Date.now();
  if (now < groupsCacheExpiry && monitoredGroupIds.size > 0) {
    return monitoredGroupIds;
  }

  try {
    const { data, error } = await supabase
      .from('groups')
      .select('wa_group_id')
      .eq('status', 'active');

    if (error) {
      logger.error({ err: error }, 'Failed to fetch monitored groups');
      return monitoredGroupIds;
    }

    monitoredGroupIds = new Set((data ?? []).map((g) => g.wa_group_id));
    groupsCacheExpiry = now + GROUPS_CACHE_TTL_MS;
    logger.debug({ count: monitoredGroupIds.size }, 'Refreshed monitored groups');
  } catch (err) {
    logger.error({ err }, 'Unexpected error fetching monitored groups');
  }

  return monitoredGroupIds;
}

// ── Deduplication ────────────────────────────────────────────────────────────
async function isDuplicate(messageId: string): Promise<boolean> {
  const redis = getDedupRedis();
  const key = `${config.dedup.keyPrefix}${messageId}`;
  const result = await redis.set(key, '1', 'EX', config.dedup.ttlSeconds, 'NX');
  return result === null;
}

// ── Green API notification types ─────────────────────────────────────────────
interface GreenNotification {
  receiptId: number;
  body: {
    typeWebhook: string;
    instanceData?: {
      idInstance: number;
      wid: string;
      typeInstance: string;
    };
    timestamp: number;
    idMessage?: string;
    senderData?: {
      chatId: string;
      sender: string;
      chatName: string;
      senderName: string;
      senderContactName?: string;
    };
    messageData?: {
      typeMessage: string;
      textMessageData?: { textMessage: string };
      extendedTextMessageData?: {
        text: string;
        stanzaId?: string;
        quotedMessage?: { textMessage?: string };
      };
    };
    stateInstance?: string;
  };
}

interface GreenStateResponse {
  stateInstance: 'notAuthorized' | 'authorized' | 'blocked' | 'sleepMode' | 'starting' | 'yellowCard';
}

interface GreenQRResponse {
  type: 'qrCode' | 'alreadyLogged' | 'error';
  message: string;
}

// ── Internal phones (scanners, admin) — skip prospect routing ────────────
let internalPhones: Set<string> = new Set();
let internalPhonesCacheExpiry = 0;

async function isInternalPhone(waId: string): Promise<boolean> {
  const now = Date.now();
  if (now < internalPhonesCacheExpiry && internalPhones.size > 0) {
    return internalPhones.has(waId);
  }
  try {
    const { data } = await supabase
      .from('wa_accounts')
      .select('internal_phones, phone_number')
      .eq('is_active', true);
    const phones = new Set<string>();
    for (const acc of data ?? []) {
      if (acc.phone_number) phones.add(acc.phone_number.replace(/\D/g, '') + '@c.us');
      for (const p of acc.internal_phones ?? []) {
        phones.add(p.replace(/\D/g, '') + '@c.us');
      }
    }
    internalPhones = phones;
    internalPhonesCacheExpiry = now + 5 * 60 * 1000; // 5 min cache
  } catch { /* keep old cache */ }
  return internalPhones.has(waId);
}

// ── Route personal messages to prospect CRM ─────────────────────────────
async function routeToProspectChat(body: GreenNotification['body']): Promise<void> {
  const senderId = body.senderData?.sender ?? body.senderData?.chatId ?? '';
  if (!senderId) return;

  // Skip internal phones (scanners, admin)
  if (await isInternalPhone(senderId)) {
    logger.debug({ senderId }, 'Internal phone — skipping prospect routing');
    return;
  }

  // Check if this sender is a known prospect
  const { data: prospect } = await supabase
    .from('prospects')
    .select('id, stage, profile_pic_url')
    .eq('wa_id', senderId)
    .maybeSingle();

  if (!prospect) {
    logger.debug({ senderId }, 'Personal message from non-prospect, ignoring');
    return;
  }

  // Fetch WhatsApp avatar if we don't have one yet
  if (!prospect.profile_pic_url) {
    try {
      const avatarRes = await fetch(greenUrl('getAvatar'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: senderId }),
      });
      if (avatarRes.ok) {
        const avatarData = await avatarRes.json() as { urlAvatar?: string };
        if (avatarData.urlAvatar) {
          await supabase.from('prospects').update({ profile_pic_url: avatarData.urlAvatar }).eq('id', prospect.id);
          logger.info({ prospectId: prospect.id }, 'Saved WhatsApp avatar for prospect');
        }
      }
    } catch {
      // Avatar fetch is best-effort, don't block message processing
    }
  }

  // Extract text
  const text =
    body.messageData?.textMessageData?.textMessage ??
    body.messageData?.extendedTextMessageData?.text ?? '';

  if (!text) return;

  const messageId = body.idMessage ?? `green-${Date.now()}`;

  // Deduplicate
  if (await isDuplicate(messageId)) return;

  logger.info(
    { messageId, prospectId: prospect.id, senderId },
    'Incoming prospect message'
  );

  // Save to prospect_messages
  await supabase.from('prospect_messages').insert({
    prospect_id: prospect.id,
    direction: 'incoming',
    message_type: 'text',
    content: text,
    wa_message_id: messageId,
    sent_at: new Date(body.timestamp * 1000).toISOString(),
  });

  // Log event
  await supabase.from('prospect_events').insert({
    prospect_id: prospect.id,
    event_type: 'message_received',
    new_value: text.substring(0, 100),
    detail: { wa_message_id: messageId },
  });

  // Update last_contact_at and auto-advance stage if still at 'reached_out'
  const updates: Record<string, unknown> = {
    last_contact_at: new Date().toISOString(),
  };

  if (prospect.stage === 'reached_out') {
    updates.stage = 'in_conversation';

    await supabase.from('prospect_events').insert({
      prospect_id: prospect.id,
      event_type: 'stage_change',
      old_value: 'reached_out',
      new_value: 'in_conversation',
      detail: { reason: 'auto_advanced_on_reply' },
    });
  }

  await supabase
    .from('prospects')
    .update(updates)
    .eq('id', prospect.id);
}

// ── Group invite link scanner ─────────────────────────────────────────────────
const GROUP_LINK_REGEX = /(?:https?:\/\/)?chat\.whatsapp\.com\/([A-Za-z0-9_-]+)/gi;

async function scanForGroupLinks(text: string, groupId: string, senderId: string, messageId: string): Promise<void> {
  const matches = [...text.matchAll(GROUP_LINK_REGEX)];
  if (matches.length === 0) return;

  // Lazy import to avoid circular dependency
  const { resolveGroupUuid } = await import('./smart-filter.js');
  const groupUuid = await resolveGroupUuid(groupId);

  for (const match of matches) {
    const inviteCode = match[1];
    const inviteLink = `https://chat.whatsapp.com/${inviteCode}`;

    try {
      await supabase.rpc('upsert_pending_group', {
        p_invite_link: inviteLink,
        p_invite_code: inviteCode,
        p_source_group_id: groupUuid,
        p_source_wa_sender_id: senderId,
        p_source_wa_message_id: messageId,
      });
      logger.info({ inviteCode, groupId, senderId }, 'Group invite link discovered');
    } catch (err) {
      logger.error({ err, inviteCode }, 'Failed to save pending group');
    }
  }
}

// ── Process a single notification ────────────────────────────────────────────
async function processNotification(notif: GreenNotification): Promise<void> {
  const { body } = notif;

  // Touch watchdog silence detector
  try { const { touchLastNotification } = await import('./watchdog.js'); touchLastNotification(); } catch {}

  // Handle state changes
  if (body.typeWebhook === 'stateInstanceChanged') {
    const state = body.stateInstance;
    logger.info({ state }, 'Green API instance state changed');

    if (state === 'authorized') {
      setConnected();
      await supabase.from('wa_accounts')
        .update({ status: 'connected', connected_since: new Date().toISOString() })
        .eq('green_api_id', config.greenApi.idInstance);

      // Trigger onboarding after 5-minute warm-up (don't block poll loop)
      logger.info('Instance authorized — scheduling onboarding in 5 minutes');
      setTimeout(async () => {
        try {
          const { onboardInstance } = await import('./sync-engine.js');
          await onboardInstance();
        } catch (err) {
          logger.error({ err }, 'Onboarding failed');
        }
      }, 5 * 60 * 1000);
    } else if (state === 'notAuthorized' || state === 'blocked') {
      setDisconnected();
      await supabase.from('wa_accounts')
        .update({ status: state === 'blocked' ? 'blocked' : 'disconnected' })
        .eq('green_api_id', config.greenApi.idInstance);
    } else if (state === 'yellowCard') {
      setConnecting();
      await supabase.from('wa_accounts')
        .update({ status: 'yellow_card' })
        .eq('green_api_id', config.greenApi.idInstance);
    } else {
      setConnecting();
    }
    return;
  }

  // Only process incoming messages
  if (body.typeWebhook !== 'incomingMessageReceived') return;

  const chatId = body.senderData?.chatId;
  if (!chatId) return;

  // ── Route personal messages to prospect CRM ──────────────────────────
  if (chatId.endsWith('@c.us')) {
    await routeToProspectChat(body);
    return;
  }

  // Only process group messages from here
  if (!chatId.endsWith('@g.us')) return;

  // Check if monitored
  const groups = await getMonitoredGroups();
  if (!groups.has(chatId)) return;

  // Extract message text
  const text =
    body.messageData?.textMessageData?.textMessage ??
    body.messageData?.extendedTextMessageData?.text;

  // Extract reply/quote context from Green API
  const quotedMessageId = body.messageData?.extendedTextMessageData?.stanzaId ?? null;
  const quotedText = body.messageData?.extendedTextMessageData?.quotedMessage?.textMessage ?? null;

  if (!text) return; // skip media-only messages

  const messageId = body.idMessage ?? `green-${Date.now()}`;

  // Deduplicate
  if (await isDuplicate(messageId)) {
    logger.debug({ messageId }, 'Duplicate message, skipping');
    return;
  }

  const senderId = body.senderData?.sender ?? '';
  const senderName = body.senderData?.senderName ?? body.senderData?.senderContactName ?? senderId;

  logger.info(
    { messageId, groupId: chatId, groupName: body.senderData?.chatName, sender: senderName, textLength: text.length },
    'New group message received'
  );

  // ── Scan for group invite links (before filter — capture even from sellers) ──
  await scanForGroupLinks(text, chatId, senderId, messageId);

  // ── Pipeline: log "received" ────────────────────────────────────────────
  await logPipelineEvent(chatId, messageId, senderId, 'received', {
    groupName: body.senderData?.chatName,
    textLength: text.length,
  });

  // ── Smart Filter: 3-stage pre-filter ────────────────────────────────────
  const filterResult = await runSmartFilter({
    messageId,
    groupId: chatId,
    senderId,
    senderName,
    text,
    timestamp: body.timestamp,
    quotedMessageId,
    quotedText,
  });

  if (filterResult.action === 'skip') {
    // Log the filter stage
    await logPipelineEvent(chatId, messageId, senderId, filterResult.stage, {
      reason: filterResult.reason,
      signals: filterResult.signals,
    });

    // Still update sender stats (track even filtered messages)
    const hasPhone = /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/.test(text);
    await updateSenderStats(chatId, senderId, senderName, false, hasPhone);

    logger.debug(
      { messageId, stage: filterResult.stage, reason: filterResult.reason },
      'Message filtered by Smart Filter'
    );
    return;
  }

  // ── Passed filter — log pattern_matched and enqueue for AI parsing ──────
  await logPipelineEvent(chatId, messageId, senderId, 'pattern_matched', {
    signals: filterResult.signals,
  });

  const job: RawMessageJob = {
    messageId,
    groupId: chatId,
    body: text,
    sender: senderName,
    senderId,
    timestamp: body.timestamp,
    accountId: config.whatsapp.accountId,
    quotedMessageId,
    quotedText,
  };

  try {
    await enqueueMessage(job);
    logger.info(
      { messageId, signals: filterResult.signals },
      'Message passed Smart Filter — enqueued for AI parsing'
    );

    // Log successful enqueue to Supabase for diagnostics
    await logPipelineEvent(chatId, messageId, senderId, 'enqueued', {
      signals: filterResult.signals,
    });
  } catch (enqueueErr) {
    logger.error(
      { err: enqueueErr, messageId },
      'FAILED to enqueue message to BullMQ'
    );

    // Log failure to Supabase
    await logPipelineEvent(chatId, messageId, senderId, 'enqueue_failed', {
      error: String(enqueueErr),
      signals: filterResult.signals,
    });
  }
}

// ── Polling loop (long-polling) ──────────────────────────────────────────────
let polling = false;
let pollTimer: ReturnType<typeof setTimeout> | null = null;

async function pollOnce(): Promise<void> {
  try {
    // Long-poll: Green API holds the connection for up to receiveTimeout seconds
    const res = await fetch(greenUrl('receiveNotification') + '?receiveTimeout=5');

    if (!res.ok) {
      const text = await res.text();
      logger.error({ status: res.status, body: text }, 'Green API receiveNotification error');
      return;
    }

    // Returns null (empty body) when no notifications
    const text = await res.text();
    if (!text || text === 'null') return;

    const notif: GreenNotification = JSON.parse(text);

    if (notif && notif.receiptId) {
      // Process the notification
      await processNotification(notif).catch((err) => {
        logger.error({ err, receiptId: notif.receiptId }, 'Error processing notification');
      });

      // Acknowledge: DELETE request with receiptId in URL
      const delRes = await fetch(
        greenUrl('deleteNotification') + `/${notif.receiptId}`,
        { method: 'DELETE' }
      );

      if (!delRes.ok) {
        logger.warn({ receiptId: notif.receiptId, status: delRes.status }, 'Failed to delete notification');
      }
    }
  } catch (err) {
    logger.error({ err }, 'Error polling Green API');
  }
}

async function pollLoop(): Promise<void> {
  while (polling) {
    await pollOnce();

    // Small delay between polls to avoid hammering if long-poll fails instantly
    if (polling) {
      await new Promise((resolve) => {
        pollTimer = setTimeout(resolve, 500);
      });
    }
  }
}

// ── Check instance state and fetch QR if needed ──────────────────────────────
async function checkAndConnect(): Promise<void> {
  try {
    const stateRes = await fetch(greenUrl('getStateInstance'));
    if (!stateRes.ok) {
      throw new Error(`getStateInstance failed: ${stateRes.status}`);
    }
    const state: GreenStateResponse = await stateRes.json();
    logger.info({ state: state.stateInstance }, 'Green API instance state');

    if (state.stateInstance === 'authorized') {
      setConnected();
      await supabase.from('wa_accounts')
        .update({ status: 'connected', connected_since: new Date().toISOString() })
        .eq('green_api_id', config.greenApi.idInstance);
      logger.info('WhatsApp already authorized via Green API');
    } else if (state.stateInstance === 'notAuthorized') {
      setDisconnected();
      await supabase.from('wa_accounts')
        .update({ status: 'disconnected' })
        .eq('green_api_id', config.greenApi.idInstance);
      logger.info('WhatsApp not authorized — QR scan needed via Green API console or dashboard');

      // Fetch QR code
      try {
        const qrRes = await fetch(greenUrl('qr'));
        if (qrRes.ok) {
          const qr: GreenQRResponse = await qrRes.json();
          if (qr.type === 'qrCode' && qr.message) {
            // qr.message is base64 PNG
            setQR(qr.message);
            logger.info('QR code fetched — display in dashboard or scan via Green API console');
          } else if (qr.type === 'alreadyLogged') {
            setConnected();
            await supabase.from('wa_accounts')
              .update({ status: 'connected', connected_since: new Date().toISOString() })
              .eq('green_api_id', config.greenApi.idInstance);
          }
        }
      } catch (err) {
        logger.warn({ err }, 'Could not fetch QR code');
      }
    } else if (state.stateInstance === 'blocked') {
      setDisconnected();
      await supabase.from('wa_accounts')
        .update({ status: 'blocked' })
        .eq('green_api_id', config.greenApi.idInstance);
      logger.error('WhatsApp account is BLOCKED by WhatsApp');
    } else {
      // sleepMode, starting, yellowCard
      setConnecting();
      const dbStatus = state.stateInstance === 'yellowCard' ? 'yellow_card' : state.stateInstance;
      await supabase.from('wa_accounts')
        .update({ status: dbStatus })
        .eq('green_api_id', config.greenApi.idInstance);
      logger.warn({ state: state.stateInstance }, 'Instance in transitional state');
    }
  } catch (err) {
    logger.error({ err }, 'Failed to check Green API state');
    setDisconnected();
  }
}

// ── Public API ───────────────────────────────────────────────────────────────
export async function startListener(): Promise<void> {
  logger.info({
    idInstance,
    apiUrl,
  }, 'Starting Green API listener');

  // Check current state
  await checkAndConnect();

  // Start polling for notifications
  polling = true;
  pollLoop().catch((err) => {
    logger.error({ err }, 'Poll loop crashed');
  });

  logger.info('Green API listener is running');
}

export async function stopListener(): Promise<void> {
  polling = false;

  if (pollTimer) {
    clearTimeout(pollTimer);
    pollTimer = null;
  }

  if (dedupRedis) {
    await dedupRedis.quit();
    dedupRedis = null;
  }

  logger.info('Listener stopped');
}
