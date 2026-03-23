import http from 'node:http';
import { createClient } from '@supabase/supabase-js';
import { logger } from './logger.js';
import { config } from './config.js';

type ConnectionStatus = 'disconnected' | 'waiting_qr' | 'connecting' | 'connected';

// ── Supabase client (for group/member/pipeline data) ─────────────────────────
const supabase = createClient(config.supabase.url, config.supabase.serviceKey);

// ── Green API helpers ────────────────────────────────────────────────────────
const { apiUrl, idInstance, apiToken } = config.greenApi;
function greenUrl(method: string): string {
  return `${apiUrl}/waInstance${idInstance}/${method}/${apiToken}`;
}

// ── Shared state (set by listener.ts) ────────────────────────────────────────
let currentStatus: ConnectionStatus = 'disconnected';
let currentQR: string | null = null;
let connectedPhone: string | null = null;
let connectedSince: string | null = null;

export function setQR(qr: string): void {
  currentQR = qr;
  currentStatus = 'waiting_qr';
}

export function setConnecting(): void {
  currentQR = null;
  currentStatus = 'connecting';
}

export function setConnected(phone?: string): void {
  currentQR = null;
  currentStatus = 'connected';
  connectedPhone = phone ?? null;
  connectedSince = new Date().toISOString();
}

export function setDisconnected(): void {
  currentQR = null;
  currentStatus = 'disconnected';
  connectedPhone = null;
  connectedSince = null;
}

export function getStatus() {
  return {
    status: currentStatus,
    qr: currentQR,
    phone: connectedPhone,
    connectedSince,
  };
}

// ── JSON response helper ─────────────────────────────────────────────────────
function jsonResponse(res: http.ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

// ── Route handlers ───────────────────────────────────────────────────────────

/** GET /api/groups — list monitored groups with member intelligence stats */
async function handleGetGroups(res: http.ServerResponse): Promise<void> {
  try {
    const { data, error } = await supabase
      .from('groups')
      .select('id, wa_group_id, name, category, status, message_count, last_message_at, total_members, known_sellers, known_buyers')
      .order('last_message_at', { ascending: false, nullsFirst: false });

    if (error) {
      logger.error({ err: error }, 'Failed to fetch groups');
      jsonResponse(res, 500, { error: 'Failed to fetch groups' });
      return;
    }

    const groups = (data ?? []).map((g) => ({
      id: g.wa_group_id,
      name: g.name,
      messageCount: g.message_count,
      isActive: g.status === 'active',
      lastMessageAt: g.last_message_at,
      totalMembers: g.total_members,
      knownSellers: g.known_sellers,
      knownBuyers: g.known_buyers,
      category: g.category,
    }));

    jsonResponse(res, 200, groups);
  } catch (err) {
    logger.error({ err }, 'Error in handleGetGroups');
    jsonResponse(res, 500, { error: 'Internal server error' });
  }
}

/** GET /api/messages/:groupId — fetch recent messages for a group via Green API */
async function handleGetMessages(res: http.ServerResponse, groupId: string): Promise<void> {
  try {
    // Use Green API getChatHistory for the group
    const apiRes = await fetch(greenUrl('getChatHistory'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId: groupId, count: 50 }),
    });

    if (!apiRes.ok) {
      const text = await apiRes.text();
      logger.error({ status: apiRes.status, body: text }, 'Green API getChatHistory error');
      jsonResponse(res, 502, { error: 'Green API error' });
      return;
    }

    const rawMessages: Array<{
      idMessage?: string;
      timestamp?: number;
      type?: string;
      chatId?: string;
      senderId?: string;
      senderName?: string;
      textMessage?: string;
      extendedTextMessage?: { text?: string };
    }> = await apiRes.json();

    // Map to our format + enrich with sender intelligence from DB
    const senderIds = [...new Set(rawMessages.map((m) => m.senderId).filter(Boolean))];

    // Batch-fetch sender classifications
    let senderMap: Map<string, { classification: string }> = new Map();
    if (senderIds.length > 0) {
      const { data: members } = await supabase
        .from('group_members')
        .select('wa_sender_id, classification')
        .in('wa_sender_id', senderIds);

      if (members) {
        senderMap = new Map(members.map((m) => [m.wa_sender_id, { classification: m.classification }]));
      }
    }

    // Check which messages are leads
    const messageIds = rawMessages.map((m) => m.idMessage).filter(Boolean);
    let leadMessageIds: Set<string> = new Set();
    if (messageIds.length > 0) {
      const { data: leads } = await supabase
        .from('leads')
        .select('wa_message_id')
        .in('wa_message_id', messageIds);
      if (leads) {
        leadMessageIds = new Set(leads.map((l) => l.wa_message_id));
      }
    }

    // Check pipeline stages
    let pipelineMap: Map<string, string> = new Map();
    if (messageIds.length > 0) {
      const { data: events } = await supabase
        .from('pipeline_events')
        .select('wa_message_id, stage')
        .in('wa_message_id', messageIds)
        .order('created_at', { ascending: false });
      if (events) {
        // Keep only the latest stage per message
        for (const ev of events) {
          if (ev.wa_message_id && !pipelineMap.has(ev.wa_message_id)) {
            pipelineMap.set(ev.wa_message_id, ev.stage);
          }
        }
      }
    }

    const messages = rawMessages
      .filter((m) => m.type === 'incoming' || m.type === 'outgoing')
      .map((m) => {
        const text = m.textMessage ?? m.extendedTextMessage?.text ?? '';
        const msgId = m.idMessage ?? '';
        const sender = senderMap.get(m.senderId ?? '');

        return {
          id: msgId,
          sender: m.senderId ?? '',
          senderName: m.senderName ?? m.senderId ?? 'Unknown',
          text,
          timestamp: (m.timestamp ?? 0) * 1000,
          isLead: leadMessageIds.has(msgId),
          pipelineStage: pipelineMap.get(msgId) ?? undefined,
          senderClassification: sender?.classification ?? 'unknown',
        };
      });

    jsonResponse(res, 200, messages);
  } catch (err) {
    logger.error({ err }, 'Error in handleGetMessages');
    jsonResponse(res, 500, { error: 'Internal server error' });
  }
}

/** GET /api/pipeline — recent pipeline events */
async function handleGetPipeline(res: http.ServerResponse, limit: number): Promise<void> {
  try {
    const { data, error } = await supabase
      .from('pipeline_events')
      .select(`
        id,
        wa_message_id,
        sender_id,
        stage,
        detail,
        created_at,
        group:groups(name)
      `)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      logger.error({ err: error }, 'Failed to fetch pipeline events');
      jsonResponse(res, 500, { error: 'Failed to fetch pipeline events' });
      return;
    }

    // Enrich with sender names
    const senderIds = [...new Set((data ?? []).map((e) => e.sender_id).filter(Boolean))];
    let senderNames: Map<string, string> = new Map();
    if (senderIds.length > 0) {
      const { data: members } = await supabase
        .from('group_members')
        .select('wa_sender_id, display_name')
        .in('wa_sender_id', senderIds);
      if (members) {
        senderNames = new Map(members.map((m) => [m.wa_sender_id, m.display_name ?? m.wa_sender_id]));
      }
    }

    const events = (data ?? []).map((e) => {
      const groupData = e.group as unknown;
      const groupName = Array.isArray(groupData)
        ? (groupData[0] as { name: string } | undefined)?.name ?? null
        : (groupData as { name: string } | null)?.name ?? null;
      return {
        id: e.id,
        groupName,
        senderName: senderNames.get(e.sender_id ?? '') ?? e.sender_id,
        stage: e.stage,
        detail: e.detail,
        createdAt: e.created_at,
      };
    });

    jsonResponse(res, 200, events);
  } catch (err) {
    logger.error({ err }, 'Error in handleGetPipeline');
    jsonResponse(res, 500, { error: 'Internal server error' });
  }
}

// ── Prospect CRM Endpoints ───────────────────────────────────────────────

/** Helper to read JSON body from request */
function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

/** POST /api/prospects/send — send a WhatsApp message to a prospect */
async function handleSendProspectMessage(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  try {
    const raw = await readBody(req);
    const { prospect_id, wa_id, text, wa_account_id, channel = 'green_api' } = JSON.parse(raw) as {
      prospect_id: string;
      wa_id: string;
      text: string;
      wa_account_id?: string;
      channel?: 'green_api' | 'twilio';
    };

    if (!wa_id || !text) {
      jsonResponse(res, 400, { error: 'wa_id and text are required' });
      return;
    }

    let messageId: string | null = null;

    if (channel === 'twilio') {
      // Send via Twilio
      const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${config.twilio.accountSid}/Messages.json`;
      const auth = 'Basic ' + Buffer.from(`${config.twilio.accountSid}:${config.twilio.authToken}`).toString('base64');
      
      // Convert wa_id (e.g. 972542922277@c.us) to E.164 format (+972542922277)
      const toPhone = `+${wa_id.split('@')[0]}`;
      
      const data = new URLSearchParams({
        To: `whatsapp:${toPhone}`,
        From: config.twilio.whatsappFrom,
        Body: text
      }).toString();

      const sendRes = await fetch(twilioUrl, {
        method: 'POST',
        headers: {
          'Authorization': auth,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: data,
      });

      if (!sendRes.ok) {
        const errText = await sendRes.text();
        logger.error({ status: sendRes.status, body: errText }, 'Twilio sendMessage failed');
        jsonResponse(res, 502, { error: 'Failed to send message via Twilio' });
        return;
      }

      const sendResult = await sendRes.json() as { sid?: string };
      messageId = sendResult.sid ?? null;

    } else {
      // Send via GREEN-API
      let sendApiUrl = apiUrl;
      let sendIdInstance = idInstance;
      let sendApiToken = apiToken;

      if (wa_account_id) {
        const { data: account } = await supabase
          .from('wa_accounts')
          .select('green_api_url, green_api_id, green_api_token')
          .eq('id', wa_account_id)
          .single();

        if (account) {
          sendApiUrl = account.green_api_url;
          sendIdInstance = account.green_api_id;
          sendApiToken = account.green_api_token;
        }
      }

      const sendUrl = `${sendApiUrl}/waInstance${sendIdInstance}/sendMessage/${sendApiToken}`;
      const sendRes = await fetch(sendUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId: wa_id,
          message: text,
        }),
      });

      if (!sendRes.ok) {
        const errText = await sendRes.text();
        logger.error({ status: sendRes.status, body: errText }, 'GREEN-API sendMessage failed');
        jsonResponse(res, 502, { error: 'Failed to send message via GREEN-API' });
        return;
      }

      const sendResult = await sendRes.json() as { idMessage?: string };
      messageId = sendResult.idMessage ?? null;
    }

    // Save to prospect_messages
    const { data: msg, error: insertErr } = await supabase
      .from('prospect_messages')
      .insert({
        prospect_id,
        wa_account_id: channel === 'green_api' ? (wa_account_id ?? null) : null,
        channel,
        direction: 'outgoing',
        message_type: 'text',
        content: text,
        wa_message_id: messageId,
        sent_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertErr) {
      logger.error({ err: insertErr }, 'Failed to save outgoing prospect message');
    }

    // Log event
    await supabase.from('prospect_events').insert({
      prospect_id,
      event_type: 'message_sent',
      new_value: text.substring(0, 100),
      detail: { wa_message_id: messageId },
    });

    // Update last_contact_at
    await supabase
      .from('prospects')
      .update({ last_contact_at: new Date().toISOString() })
      .eq('id', prospect_id);

    jsonResponse(res, 200, {
      success: true,
      message_id: msg?.[0]?.id,
      wa_message_id: messageId,
    });
  } catch (err) {
    logger.error({ err }, 'Error in handleSendProspectMessage');
    jsonResponse(res, 500, { error: 'Internal server error' });
  }
}

/** GET /api/prospects/:prospectId/messages — chat history */
async function handleGetProspectMessages(res: http.ServerResponse, prospectId: string): Promise<void> {
  try {
    const { data, error } = await supabase
      .from('prospect_messages')
      .select('*')
      .eq('prospect_id', prospectId)
      .order('sent_at', { ascending: true })
      .limit(200);

    if (error) {
      logger.error({ err: error }, 'Failed to fetch prospect messages');
      jsonResponse(res, 500, { error: 'Failed to fetch messages' });
      return;
    }

    jsonResponse(res, 200, data ?? []);
  } catch (err) {
    logger.error({ err }, 'Error in handleGetProspectMessages');
    jsonResponse(res, 500, { error: 'Internal server error' });
  }
}

/** POST /api/prospects/import — import group participants as prospects */
async function handleImportProspects(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  try {
    const raw = await readBody(req);
    const { group_id, wa_group_id } = JSON.parse(raw) as {
      group_id: string;
      wa_group_id: string;
    };

    if (!group_id || !wa_group_id) {
      jsonResponse(res, 400, { error: 'group_id and wa_group_id are required' });
      return;
    }

    // Fetch group participants from GREEN-API
    const participantsUrl = greenUrl('getGroupData');
    const partRes = await fetch(participantsUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ groupId: wa_group_id }),
    });

    if (!partRes.ok) {
      const errText = await partRes.text();
      logger.error({ status: partRes.status, body: errText }, 'GREEN-API getGroupData failed');
      jsonResponse(res, 502, { error: 'Failed to fetch group participants' });
      return;
    }

    const groupData = await partRes.json() as {
      participants?: Array<{ id: string; isAdmin?: boolean }>;
    };

    const participants = groupData.participants ?? [];
    let imported = 0;
    let skipped = 0;
    let adminsFound = 0;

    for (const p of participants) {
      const waId = p.id;
      const phone = '+' + waId.replace('@c.us', '');

      // Classify group admins in group_members table
      if (p.isAdmin) {
        adminsFound++;
        const { data: existingMember } = await supabase
          .from('group_members')
          .select('id, classification, manual_override')
          .eq('group_id', group_id)
          .eq('wa_sender_id', waId)
          .maybeSingle();

        if (existingMember) {
          // Only update if not manually overridden
          if (!existingMember.manual_override) {
            await supabase
              .from('group_members')
              .update({ classification: 'admin', classified_at: new Date().toISOString() })
              .eq('id', existingMember.id);
          }
        } else {
          // Insert new member as admin
          await supabase
            .from('group_members')
            .insert({
              group_id: group_id,
              wa_sender_id: waId,
              classification: 'admin',
              classified_at: new Date().toISOString(),
              total_messages: 0,
              lead_messages: 0,
              service_messages: 0,
            });
        }
      }

      // Try to get avatar
      let avatarUrl: string | null = null;
      try {
        const avatarRes = await fetch(greenUrl('getAvatar'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chatId: waId }),
        });
        if (avatarRes.ok) {
          const avatarData = await avatarRes.json() as { urlAvatar?: string };
          avatarUrl = avatarData.urlAvatar ?? null;
        }
      } catch {
        // Avatar fetch failed, continue without it
      }

      // Get display name from group_members if available
      const { data: member } = await supabase
        .from('group_members')
        .select('display_name, classification')
        .eq('wa_sender_id', waId)
        .maybeSingle();

      // Skip known sellers/bots — they're not our target prospects
      // Note: admins are NOT skipped — they're valuable partner targets
      if (member?.classification === 'seller' || member?.classification === 'bot') {
        skipped++;
        continue;
      }

      // Get group category for profession tagging
      const { data: group } = await supabase
        .from('groups')
        .select('category')
        .eq('id', group_id)
        .single();

      // Upsert prospect
      const { error: upsertErr } = await supabase
        .from('prospects')
        .upsert({
          wa_id: waId,
          phone,
          display_name: member?.display_name ?? null,
          profile_pic_url: avatarUrl,
          wa_sender_id: waId,
          group_ids: [group_id],
          profession_tags: group?.category ? [group.category] : [],
          stage: 'prospect',
        }, {
          onConflict: 'wa_id',
        });

      if (upsertErr) {
        logger.error({ err: upsertErr, waId }, 'Failed to upsert prospect');
        continue;
      }

      // For existing prospects, merge group_ids
      await supabase.rpc('import_group_members_as_prospects', {
        p_group_id: group_id,
        p_members: JSON.stringify([{
          wa_id: waId,
          phone,
          display_name: member?.display_name ?? null,
          profile_pic_url: avatarUrl,
        }]),
      });

      imported++;
    }

    // Sync known_admins count on the group
    if (adminsFound > 0) {
      await supabase
        .from('groups')
        .update({ known_admins: adminsFound })
        .eq('id', group_id);
      logger.info({ group_id, adminsFound }, 'Synced group admin count');
    }

    jsonResponse(res, 200, {
      success: true,
      total_participants: participants.length,
      imported,
      skipped_sellers_bots: skipped,
      admins_found: adminsFound,
    });
  } catch (err) {
    logger.error({ err }, 'Error in handleImportProspects');
    jsonResponse(res, 500, { error: 'Internal server error' });
  }
}

/** GET /api/prospects/:waId/avatar — fetch WhatsApp profile picture */
async function handleGetAvatar(res: http.ServerResponse, waId: string): Promise<void> {
  try {
    const avatarRes = await fetch(greenUrl('getAvatar'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId: waId }),
    });

    if (!avatarRes.ok) {
      jsonResponse(res, 502, { error: 'Failed to fetch avatar' });
      return;
    }

    const data = await avatarRes.json() as { urlAvatar?: string; reason?: string };
    jsonResponse(res, 200, { url: data.urlAvatar ?? null });
  } catch (err) {
    logger.error({ err }, 'Error in handleGetAvatar');
    jsonResponse(res, 500, { error: 'Internal server error' });
  }
}

import { getJoinQueue } from './queue.js';

// ── Group Scan Endpoints ───────────────────────────────────────────────────

const rateLimits = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(contractorId: string): boolean {
  const now = Date.now();
  let limit = rateLimits.get(contractorId);
  if (!limit || limit.resetAt < now) {
    limit = { count: 0, resetAt: now + 60000 }; // 1 minute window
  }
  if (limit.count >= 5) {
    return false; // Max 5 links per minute
  }
  limit.count++;
  rateLimits.set(contractorId, limit);
  return true;
}

function normalizeInviteLink(rawLink: string): { normalized: string; code: string | null } {
  const trimmed = rawLink.trim();
  const match = trimmed.match(/chat\.whatsapp\.com\/([a-zA-Z0-9]+)/);
  if (match) {
    return {
      normalized: `https://chat.whatsapp.com/${match[1]}`,
      code: match[1],
    };
  }
  return {
    normalized: trimmed,
    code: null,
  };
}

/** POST /api/group-scan/contractor-links — Contractor adds a link */
async function handlePostContractorLink(req: http.IncomingMessage, res: http.ServerResponse, user?: any): Promise<void> {
  try {
    const raw = await readBody(req);
    const { invite_link, contractor_id } = JSON.parse(raw) as { invite_link: string; contractor_id: string };

    if (!invite_link || !contractor_id) {
      jsonResponse(res, 400, { error: 'invite_link and contractor_id are required' });
      return;
    }

    // Role enforcement
    if (user && user.role !== 'admin' && user.id !== contractor_id) {
      jsonResponse(res, 403, { error: 'Forbidden: Cannot add link for another contractor' });
      return;
    }

    if (!checkRateLimit(contractor_id)) {
      jsonResponse(res, 429, { error: 'Too many requests. Please try again later.' });
      return;
    }

    const { normalized, code } = normalizeInviteLink(invite_link);
    if (!code) {
      jsonResponse(res, 400, { error: 'Invalid WhatsApp invite link' });
      return;
    }

    const { data, error } = await supabase
      .from('contractor_group_scan_requests')
      .insert({
        contractor_id,
        invite_link_raw: invite_link,
        invite_link_normalized: normalized,
        invite_code: code,
        status: 'pending',
        join_method: config.features.enableAutoJoinQueue ? 'auto' : 'manual',
        created_by: contractor_id,
        updated_by: contractor_id,
      })
      .select()
      .single();

    if (error) {
      logger.error({ err: error }, 'Failed to insert contractor group scan request');
      jsonResponse(res, 500, { error: 'Failed to save request' });
      return;
    }

    if (config.features.enableAutoJoinQueue) {
      const jq = getJoinQueue();
      if (jq) {
        await jq.add('join-group', { id: data.id, code, source: 'contractor' });
      }
    }

    jsonResponse(res, 200, data);
  } catch (err) {
    logger.error({ err }, 'Error in handlePostContractorLink');
    jsonResponse(res, 500, { error: 'Internal server error' });
  }
}

/** GET /api/group-scan/contractor-links — Contractor views their links */
async function handleGetContractorLinks(req: http.IncomingMessage, res: http.ServerResponse, user?: any, port: number = 3001): Promise<void> {
  try {
    const url = new URL(req.url ?? '/', `http://localhost:${port}`);
    const contractorId = url.searchParams.get('contractor_id');

    if (!contractorId) {
      jsonResponse(res, 400, { error: 'contractor_id is required' });
      return;
    }

    // Role enforcement
    if (user && user.role !== 'admin' && user.id !== contractorId) {
      jsonResponse(res, 403, { error: 'Forbidden: Cannot view links for another contractor' });
      return;
    }

    // Get contractor's own requests
    const { data: ownRequests, error: ownErr } = await supabase
      .from('contractor_group_scan_requests')
      .select('*')
      .eq('contractor_id', contractorId)
      .order('created_at', { ascending: false });

    if (ownErr) {
      logger.error({ err: ownErr }, 'Failed to fetch contractor group scan requests');
      jsonResponse(res, 500, { error: 'Failed to fetch requests' });
      return;
    }

    // Get admin groups (masked view)
    const { data: adminGroups, error: adminErr } = await supabase
      .from('contractor_admin_group_scan_view')
      .select('*')
      .order('created_at', { ascending: false });

    if (adminErr) {
      logger.error({ err: adminErr }, 'Failed to fetch admin group scan requests for contractor');
      jsonResponse(res, 500, { error: 'Failed to fetch admin requests' });
      return;
    }

    jsonResponse(res, 200, {
      own: ownRequests ?? [],
      admin: adminGroups ?? [],
    });
  } catch (err) {
    logger.error({ err }, 'Error in handleGetContractorLinks');
    jsonResponse(res, 500, { error: 'Internal server error' });
  }
}

/** GET /api/group-scan/admin-board — Admin views all links */
async function handleGetAdminBoard(res: http.ServerResponse, user?: any): Promise<void> {
  try {
    // Role enforcement
    if (user && user.role !== 'admin') {
      jsonResponse(res, 403, { error: 'Forbidden: Admin access required' });
      return;
    }
    const { data, error } = await supabase
      .from('group_scan_queue_view')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      logger.error({ err: error }, 'Failed to fetch admin board group scan requests');
      jsonResponse(res, 500, { error: 'Failed to fetch requests' });
      return;
    }

    jsonResponse(res, 200, data ?? []);
  } catch (err) {
    logger.error({ err }, 'Error in handleGetAdminBoard');
    jsonResponse(res, 500, { error: 'Internal server error' });
  }
}

/** POST /api/group-scan/admin-links — Admin adds a link */
async function handlePostAdminLink(req: http.IncomingMessage, res: http.ServerResponse, user?: any): Promise<void> {
  try {
    const raw = await readBody(req);
    const { invite_link, admin_id, group_name, member_count } = JSON.parse(raw) as { 
      invite_link: string; 
      admin_id: string;
      group_name?: string;
      member_count?: number;
    };

    if (!invite_link || !admin_id) {
      jsonResponse(res, 400, { error: 'invite_link and admin_id are required' });
      return;
    }

    // Role enforcement
    if (user && user.role !== 'admin') {
      jsonResponse(res, 403, { error: 'Forbidden: Admin access required' });
      return;
    }

    const { normalized, code } = normalizeInviteLink(invite_link);
    if (!code) {
      jsonResponse(res, 400, { error: 'Invalid WhatsApp invite link' });
      return;
    }

    const { data, error } = await supabase
      .from('admin_group_scan_entries')
      .insert({
        invite_link_raw: invite_link,
        invite_link_normalized: normalized,
        invite_code: code,
        status: 'pending',
        join_method: config.features.enableAutoJoinQueue ? 'auto' : 'manual',
        group_name: group_name ?? null,
        member_count: member_count ?? null,
        created_by: admin_id,
        updated_by: admin_id,
      })
      .select()
      .single();

    if (error) {
      logger.error({ err: error }, 'Failed to insert admin group scan request');
      jsonResponse(res, 500, { error: 'Failed to save request' });
      return;
    }

    if (config.features.enableAutoJoinQueue) {
      const jq = getJoinQueue();
      if (jq) {
        await jq.add('join-group', { id: data.id, code, source: 'admin' });
      }
    }

    jsonResponse(res, 200, data);
  } catch (err) {
    logger.error({ err }, 'Error in handlePostAdminLink');
    jsonResponse(res, 500, { error: 'Internal server error' });
  }
}

/** PATCH /api/group-scan/:id/status — Update status */
async function handlePatchGroupScanStatus(req: http.IncomingMessage, res: http.ServerResponse, id: string, user?: any): Promise<void> {
  try {
    const raw = await readBody(req);
    const { status, source, updated_by, last_error } = JSON.parse(raw) as { 
      status: string; 
      source: 'contractor' | 'admin';
      updated_by: string;
      last_error?: string;
    };

    if (!status || !source || !updated_by) {
      jsonResponse(res, 400, { error: 'status, source, and updated_by are required' });
      return;
    }

    // Role enforcement
    if (user && user.role !== 'admin') {
      jsonResponse(res, 403, { error: 'Forbidden: Admin access required' });
      return;
    }

    const validStatuses = ['pending', 'joined', 'failed', 'blocked_private', 'archived'];
    if (!validStatuses.includes(status)) {
      jsonResponse(res, 400, { error: 'Invalid status' });
      return;
    }

    const table = source === 'contractor' ? 'contractor_group_scan_requests' : 'admin_group_scan_entries';

    const { data, error } = await supabase
      .from(table)
      .update({ 
        status, 
        updated_by,
        ...(last_error !== undefined ? { last_error } : {})
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      logger.error({ err: error }, `Failed to update status in ${table}`);
      jsonResponse(res, 500, { error: 'Failed to update status' });
      return;
    }

    jsonResponse(res, 200, data);
  } catch (err) {
    logger.error({ err }, 'Error in handlePatchGroupScanStatus');
    jsonResponse(res, 500, { error: 'Internal server error' });
  }
}

// ── HTTP Server ──────────────────────────────────────────────────────────────
let server: http.Server | null = null;

// ── Auth: bearer token check ────────────────────────────────────────────────
const API_SECRET = process.env.WA_LISTENER_API_SECRET;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

async function isAuthorized(req: http.IncomingMessage): Promise<{ authorized: boolean; user?: any }> {
  const url = req.url ?? '/';
  if (url === '/api/health' || url.startsWith('/api/health?')) return { authorized: true };

  const authHeader = req.headers['authorization'] ?? '';
  const token = authHeader.replace('Bearer ', '').trim();

  if (!token) {
    if (!API_SECRET && !IS_PRODUCTION) return { authorized: true };
    return { authorized: false };
  }

  // Check if it's the API secret
  if (API_SECRET && token === API_SECRET) {
    return { authorized: true, user: { id: 'admin', role: 'admin' } };
  }

  // Check if it's a valid Supabase JWT
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (user && !error) {
      // Also get the user's role from profiles
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
      if (profile) {
        user.role = profile.role;
      }
      return { authorized: true, user };
    }
  } catch (err) {
    // Ignore error and fall through
  }

  return { authorized: false };
}

export async function startAPI(port = 3001): Promise<void> {
  if (!API_SECRET) {
    if (IS_PRODUCTION) {
      logger.error('FATAL: WA_LISTENER_API_SECRET not set in production!');
      process.exit(1);
    }
    logger.warn('WA_LISTENER_API_SECRET not set — API is unauthenticated (OK for local dev only)');
  }

  server = http.createServer(async (req, res) => {
    // CORS headers for dashboard
    const ALLOWED_ORIGINS = process.env.CORS_ORIGINS?.split(',') ?? ['http://localhost:5173', 'http://localhost:3000'];
    const origin = req.headers.origin ?? '';
    if (ALLOWED_ORIGINS.includes(origin) || ALLOWED_ORIGINS.includes('*')) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    } else if (!IS_PRODUCTION) {
      res.setHeader('Access-Control-Allow-Origin', '*');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // Auth check
    const authResult = await isAuthorized(req);
    if (!authResult.authorized) {
      jsonResponse(res, 401, { error: 'Unauthorized' });
      return;
    }
    const user = authResult.user;

    const url = new URL(req.url ?? '/', `http://localhost:${port}`);
    const pathname = url.pathname;

    try {
      // GET /api/status
      if (pathname === '/api/status' && req.method === 'GET') {
        jsonResponse(res, 200, getStatus());
        return;
      }

      // GET /api/accounts
      if (pathname === '/api/accounts' && req.method === 'GET') {
        // Return both Green API and Twilio API accounts
        const accounts = [
          {
            id: 'acc-green',
            label: 'Green API (Personal)',
            region: 'green',
            phone: connectedPhone || 'Connecting...',
            status: currentStatus,
            groupCount: 0,
            leadsToday: 0,
            messagesTotal: 0,
            qr: currentQR,
            connectedSince: connectedSince,
          },
          {
            id: 'acc-twilio',
            label: 'Twilio API (Official)',
            region: 'twilio',
            phone: config.twilio.whatsappFrom || 'Not configured',
            status: config.twilio.accountSid ? 'connected' : 'disconnected',
            groupCount: 0,
            leadsToday: 0,
            messagesTotal: 0,
            qr: null,
            connectedSince: new Date().toISOString(),
          }
        ];
        jsonResponse(res, 200, accounts);
        return;
      }

      // GET /api/health
      if (pathname === '/api/health' && req.method === 'GET') {
        jsonResponse(res, 200, { ok: true, status: currentStatus });
        return;
      }

      // GET /api/groups
      if (pathname === '/api/groups' && req.method === 'GET') {
        await handleGetGroups(res);
        return;
      }

      // GET /api/messages/:groupId
      const messagesMatch = pathname.match(/^\/api\/messages\/(.+)$/);
      if (messagesMatch && req.method === 'GET') {
        await handleGetMessages(res, decodeURIComponent(messagesMatch[1]));
        return;
      }

      // GET /api/pipeline
      if (pathname === '/api/pipeline' && req.method === 'GET') {
        const limit = parseInt(url.searchParams.get('limit') ?? '50', 10);
        await handleGetPipeline(res, Math.min(limit, 200));
        return;
      }

      // POST /api/prospects/send — send WhatsApp message to a prospect
      if (pathname === '/api/prospects/send' && req.method === 'POST') {
        await handleSendProspectMessage(req, res);
        return;
      }

      // GET /api/prospects/:prospectId/messages — get chat history for prospect
      const prospectMsgMatch = pathname.match(/^\/api\/prospects\/([^/]+)\/messages$/);
      if (prospectMsgMatch && req.method === 'GET') {
        await handleGetProspectMessages(res, prospectMsgMatch[1]);
        return;
      }

      // POST /api/prospects/import — import group members as prospects
      if (pathname === '/api/prospects/import' && req.method === 'POST') {
        await handleImportProspects(req, res);
        return;
      }

      // GET /api/prospects/:prospectId/avatar — fetch profile pic
      const avatarMatch = pathname.match(/^\/api\/prospects\/([^/]+)\/avatar$/);
      if (avatarMatch && req.method === 'GET') {
        await handleGetAvatar(res, avatarMatch[1]);
        return;
      }

      // POST /api/group-scan/contractor-links
      if (pathname === '/api/group-scan/contractor-links' && req.method === 'POST') {
        await handlePostContractorLink(req, res, user);
        return;
      }

      // GET /api/group-scan/contractor-links
      if (pathname === '/api/group-scan/contractor-links' && req.method === 'GET') {
        await handleGetContractorLinks(req, res, user, port);
        return;
      }

      // GET /api/group-scan/admin-board
      if (pathname === '/api/group-scan/admin-board' && req.method === 'GET') {
        await handleGetAdminBoard(res, user);
        return;
      }

      // POST /api/group-scan/admin-links
      if (pathname === '/api/group-scan/admin-links' && req.method === 'POST') {
        await handlePostAdminLink(req, res, user);
        return;
      }

      // PATCH /api/group-scan/:id/status
      const groupScanStatusMatch = pathname.match(/^\/api\/group-scan\/([^/]+)\/status$/);
      if (groupScanStatusMatch && req.method === 'PATCH') {
        await handlePatchGroupScanStatus(req, res, groupScanStatusMatch[1], user);
        return;
      }

      // 404
      jsonResponse(res, 404, { error: 'Not found' });
    } catch (err) {
      logger.error({ err, path: pathname }, 'Unhandled API error');
      jsonResponse(res, 500, { error: 'Internal server error' });
    }
  });

  return new Promise((resolve) => {
    server!.listen(port, () => {
      logger.info({ port }, 'WA Listener API server started');
      resolve();
    });
  });
}

export async function stopAPI(): Promise<void> {
  if (server) {
    return new Promise((resolve) => {
      server!.close(() => {
        logger.info('API server stopped');
        resolve();
      });
    });
  }
}
