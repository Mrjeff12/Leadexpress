/**
 * Scanner Feedback System — WATCHDOG Protocol
 *
 * Sends group invite links to the scanner phone via Twilio WhatsApp,
 * handles feedback replies, and checks for successfully joined groups.
 */

import { createClient } from '@supabase/supabase-js';
import { config } from './config.js';
import { logger } from './logger.js';
import { sendTwilioWhatsApp } from './alerts.js';

const supabase = createClient(config.supabase.url, config.supabase.serviceKey);

// ── Green API helper ────────────────────────────────────────────────────────
function greenUrl(method: string): string {
  return `${config.greenApi.apiUrl}/waInstance${config.greenApi.idInstance}/${method}/${config.greenApi.apiToken}`;
}

// ── Sync scan requests into pending_groups (unified queue) ────────────────────
export async function syncScanRequestsToPendingGroups(): Promise<number> {
  try {
    // Fetch pending contractor requests
    const { data: contractorReqs } = await supabase
      .from('contractor_group_scan_requests')
      .select('invite_code, invite_link_normalized, contractor_id')
      .eq('status', 'pending')
      .not('invite_code', 'is', null);

    // Fetch pending admin entries
    const { data: adminReqs } = await supabase
      .from('admin_group_scan_entries')
      .select('invite_code, invite_link_normalized')
      .eq('status', 'pending')
      .not('invite_code', 'is', null);

    const allReqs = [
      ...(contractorReqs ?? []).map((r) => ({
        invite_code: r.invite_code!,
        invite_link: r.invite_link_normalized,
        source_wa_sender_id: null as string | null,
      })),
      ...(adminReqs ?? []).map((r) => ({
        invite_code: r.invite_code!,
        invite_link: r.invite_link_normalized,
        source_wa_sender_id: null as string | null,
      })),
    ];

    if (allReqs.length === 0) return 0;

    // Check which are already in pending_groups
    const codes = allReqs.map((r) => r.invite_code);
    const { data: existing } = await supabase
      .from('pending_groups')
      .select('invite_code')
      .in('invite_code', codes)
      .in('status', ['pending', 'approved', 'joining', 'joined']);

    const existingCodes = new Set((existing ?? []).map((e) => e.invite_code));

    let synced = 0;
    for (const req of allReqs) {
      if (existingCodes.has(req.invite_code)) continue;

      try {
        await supabase.rpc('upsert_pending_group', {
          p_invite_link: req.invite_link,
          p_invite_code: req.invite_code,
        });
        synced++;
      } catch (err) {
        logger.error({ err, inviteCode: req.invite_code }, 'Failed to sync scan request to pending_groups');
      }
    }

    if (synced > 0) {
      logger.info({ synced, total: allReqs.length }, 'Synced scan requests to pending_groups');
    }
    return synced;
  } catch (err) {
    logger.error({ err }, 'Error in syncScanRequestsToPendingGroups');
    return 0;
  }
}

// ── Notify contractor of group status change ─────────────────────────────────
export async function notifyContractorOfGroupStatus(
  inviteCode: string,
  status: 'joined' | 'failed' | 'blocked_private',
  groupName?: string | null,
): Promise<void> {
  try {
    // Find contractor who submitted this link
    const { data: scanReq } = await supabase
      .from('contractor_group_scan_requests')
      .select('contractor_id')
      .eq('invite_code', inviteCode)
      .neq('status', 'archived')
      .limit(1)
      .maybeSingle();

    if (!scanReq?.contractor_id) return;

    // Get contractor's phone
    const { data: profile } = await supabase
      .from('profiles')
      .select('whatsapp_phone, full_name')
      .eq('id', scanReq.contractor_id)
      .maybeSingle();

    if (!profile?.whatsapp_phone) return;

    const name = groupName || 'WhatsApp Group';
    let message: string;

    switch (status) {
      case 'joined':
        message = `✅ הצטרפנו לקבוצה *${name}*!\n\nאנחנו מאזינים ללידים — תקבל התראות ברגע שנזהה ליד רלוונטי.`;
        break;
      case 'failed':
        message = `❌ לא הצלחנו להצטרף לקבוצה *${name}*.\n\nיתכן שהלינק פג תוקף. שלח לינק חדש ונמשיך לנסות.`;
        break;
      case 'blocked_private':
        message = `🔒 הקבוצה *${name}* פרטית.\n\nבקש מאדמין הקבוצה להוסיף את המספר שלנו: ${config.scanner.phone}`;
        break;
    }

    await sendTwilioWhatsApp(profile.whatsapp_phone, message);
    logger.info({ inviteCode, status, contractorId: scanReq.contractor_id }, 'Contractor notified of group status');
  } catch (err) {
    logger.error({ err, inviteCode, status }, 'Failed to notify contractor');
  }
}

// ── Cross-link: update scan request tables when pending_group status changes ─
async function crossLinkStatusUpdate(inviteCode: string, newStatus: string, groupName?: string | null): Promise<void> {
  const statusMap: Record<string, string> = {
    joining: 'pending',   // still processing
    joined: 'joined',
    failed: 'failed',
  };
  const mappedStatus = statusMap[newStatus];
  if (!mappedStatus) return;

  const updates: Record<string, unknown> = { status: mappedStatus };
  if (groupName) updates.group_name = groupName;

  await supabase
    .from('contractor_group_scan_requests')
    .update(updates)
    .eq('invite_code', inviteCode)
    .neq('status', 'archived');

  await supabase
    .from('admin_group_scan_entries')
    .update(updates)
    .eq('invite_code', inviteCode)
    .neq('status', 'archived');
}

// ── Dispatch all pending groups (sync first, then send) ───────────────────────
export async function dispatchPendingGroups(): Promise<number> {
  await syncScanRequestsToPendingGroups();
  return sendAllPendingToScanner();
}

// ── Send a single pending group link to the scanner phone ───────────────────
export async function sendGroupLinkToScanner(pendingGroupId: string): Promise<boolean> {
  try {
    const { data: pg, error } = await supabase
      .from('pending_groups')
      .select('*')
      .eq('id', pendingGroupId)
      .single();

    if (error || !pg) {
      logger.error({ err: error, pendingGroupId }, 'Failed to load pending group');
      return false;
    }

    const message = [
      '\u{1F4CB} \u05E7\u05D1\u05D5\u05E6\u05D4 \u05D7\u05D3\u05E9\u05D4 \u05DC\u05D4\u05E6\u05D8\u05E8\u05E4\u05D5\u05EA',
      '',
      `\u{1F3F7}\uFE0F ${pg.group_name || 'Unknown Group'}`,
      `\u{1F464} Source: ${pg.source_wa_sender_id || 'N/A'}`,
      '',
      `\u{1F449} ${pg.invite_link}`,
      '',
      'Reply: \u2705=Joined | \u274C=Broken | \u{1F504}=Later',
    ].join('\n');

    const sent = await sendTwilioWhatsApp(config.scanner.phone, message);

    if (!sent) {
      logger.error({ pendingGroupId }, 'Failed to send group link to scanner');
      return false;
    }

    // Update status to 'approved' (sent to scanner)
    const { error: updateErr } = await supabase
      .from('pending_groups')
      .update({ status: 'approved', updated_at: new Date().toISOString() })
      .eq('id', pendingGroupId);

    if (updateErr) {
      logger.error({ err: updateErr, pendingGroupId }, 'Failed to update pending group status');
    }

    logger.info({ pendingGroupId, groupName: pg.group_name }, 'Group link sent to scanner');
    return true;
  } catch (err) {
    logger.error({ err, pendingGroupId }, 'Error sending group link to scanner');
    return false;
  }
}

// ── Send all pending groups to the scanner ──────────────────────────────────
export async function sendAllPendingToScanner(): Promise<number> {
  try {
    const { data: pending, error } = await supabase
      .from('pending_groups')
      .select('id')
      .eq('status', 'pending')
      .order('created_at');

    if (error || !pending || pending.length === 0) {
      if (error) logger.error({ err: error }, 'Failed to fetch pending groups');
      return 0;
    }

    let sent = 0;
    for (const pg of pending) {
      const ok = await sendGroupLinkToScanner(pg.id);
      if (ok) sent++;

      // 2-second delay between sends to avoid rate limiting
      if (sent < pending.length) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    logger.info({ total: pending.length, sent }, 'Batch send to scanner complete');
    return sent;
  } catch (err) {
    logger.error({ err }, 'Error in sendAllPendingToScanner');
    return 0;
  }
}

// ── Handle scanner feedback (emoji reply from Twilio) ───────────────────────
export async function handleScannerFeedback(fromPhone: string, body: string): Promise<void> {
  const trimmed = body.trim().toLowerCase();

  // Determine feedback type
  let feedback: 'joined' | 'broken' | 'later' | null = null;
  if (trimmed.includes('\u2705') || trimmed.includes('joined') || trimmed.includes('yes')) {
    feedback = 'joined';
  } else if (trimmed.includes('\u274C') || trimmed.includes('broken') || trimmed.includes('no')) {
    feedback = 'broken';
  } else if (trimmed.includes('\u{1F504}') || trimmed.includes('later') || trimmed.includes('skip')) {
    feedback = 'later';
  }

  if (!feedback) {
    logger.warn({ fromPhone, body }, 'Unrecognized scanner feedback');
    return;
  }

  logger.info({ fromPhone, feedback, body }, 'Scanner feedback parsed');

  // Find the most recent pending_group sent to scanner
  const { data: pg, error } = await supabase
    .from('pending_groups')
    .select('*')
    .eq('status', 'approved')
    .order('updated_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !pg) {
    logger.warn({ err: error }, 'No approved pending group found for scanner feedback');
    return;
  }

  switch (feedback) {
    case 'joined': {
      const { error: updateErr } = await supabase
        .from('pending_groups')
        .update({ status: 'joining', updated_at: new Date().toISOString() })
        .eq('id', pg.id);

      if (updateErr) {
        logger.error({ err: updateErr }, 'Failed to update pending group to joining');
      }

      // Alert admin
      await supabase.rpc('send_alert', {
        p_account_id: null,
        p_type: 'pending_group_discovered',
        p_severity: 'info',
        p_title: `Join request submitted for ${pg.group_name || 'Unknown Group'}`,
        p_message: `Scanner confirmed joining group. Waiting for admin approval.`,
        p_detail: { pending_group_id: pg.id, invite_code: pg.invite_code },
        p_channel: 'dashboard',
        p_dedupe_minutes: 5,
      });

      // Notify the prospect who shared the link (if we know their phone)
      if (pg.source_wa_sender_id) {
        const prospectPhone = '+' + pg.source_wa_sender_id.replace('@c.us', '');
        const notifyMsg = `Thanks! We've requested to join your group ${pg.group_name || ''}. Waiting for admin approval \u{1F389}`;
        await sendTwilioWhatsApp(prospectPhone, notifyMsg);
      }

      // Cross-link to scan request tables
      if (pg.invite_code) {
        await crossLinkStatusUpdate(pg.invite_code, 'joining', pg.group_name);
      }

      logger.info({ pendingGroupId: pg.id, groupName: pg.group_name }, 'Scanner confirmed join');
      break;
    }

    case 'broken': {
      const { error: updateErr } = await supabase
        .from('pending_groups')
        .update({
          status: 'failed',
          last_error: 'Link reported broken by scanner',
          updated_at: new Date().toISOString(),
        })
        .eq('id', pg.id);

      if (updateErr) {
        logger.error({ err: updateErr }, 'Failed to update pending group to failed');
      }

      // Cross-link + notify contractor
      if (pg.invite_code) {
        await crossLinkStatusUpdate(pg.invite_code, 'failed', pg.group_name);
        await notifyContractorOfGroupStatus(pg.invite_code, 'failed', pg.group_name);
      }

      logger.info({ pendingGroupId: pg.id }, 'Scanner reported broken link');
      break;
    }

    case 'later': {
      logger.info({ pendingGroupId: pg.id }, 'Scanner deferred group join');
      break;
    }
  }
}

// ── Check if 'joining' groups are now accessible ────────────────────────────
export async function checkJoinedGroups(): Promise<number> {
  try {
    // Get all pending_groups with status 'joining'
    const { data: joiningGroups, error } = await supabase
      .from('pending_groups')
      .select('*')
      .eq('status', 'joining');

    if (error || !joiningGroups || joiningGroups.length === 0) {
      return 0;
    }

    // Fetch current groups from Green API
    let currentGroups: Array<{ id: string; name: string }> = [];
    try {
      const res = await fetch(greenUrl('getContacts'));
      if (res.ok) {
        const contacts = (await res.json()) as Array<{ id: string; name?: string; type?: string }>;
        currentGroups = contacts
          .filter((c) => c.type === 'group' || c.id?.endsWith('@g.us'))
          .map((c) => ({ id: c.id, name: c.name ?? '' }));
      }
    } catch (err) {
      logger.error({ err }, 'Failed to fetch contacts from Green API');
      return 0;
    }

    // Also check groups already in our DB for cross-reference
    const { data: dbGroups } = await supabase
      .from('groups')
      .select('id, wa_group_id, name')
      .eq('status', 'active');

    const allKnownGroupNames = new Map<string, { waGroupId: string; dbId: string }>();
    for (const g of dbGroups ?? []) {
      if (g.name) {
        allKnownGroupNames.set(g.name.toLowerCase().trim(), {
          waGroupId: g.wa_group_id,
          dbId: g.id,
        });
      }
    }

    // For each Green API group, also add to the map
    for (const g of currentGroups) {
      if (g.name && !allKnownGroupNames.has(g.name.toLowerCase().trim())) {
        allKnownGroupNames.set(g.name.toLowerCase().trim(), {
          waGroupId: g.id,
          dbId: '',
        });
      }
    }

    let joinedCount = 0;

    for (const pg of joiningGroups) {
      if (!pg.group_name) continue;

      const searchName = pg.group_name.toLowerCase().trim();

      // Try exact match first
      let match = allKnownGroupNames.get(searchName);

      // Try fuzzy match: check if any known group name contains or is contained by the pending name
      if (!match) {
        for (const [knownName, info] of allKnownGroupNames) {
          if (knownName.includes(searchName) || searchName.includes(knownName)) {
            match = info;
            break;
          }
        }
      }

      if (match) {
        const { error: updateErr } = await supabase
          .from('pending_groups')
          .update({
            status: 'joined',
            joined_group_id: match.dbId || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', pg.id);

        if (updateErr) {
          logger.error({ err: updateErr, pendingGroupId: pg.id }, 'Failed to update pending group to joined');
          continue;
        }

        // Send alert
        await supabase.rpc('send_alert', {
          p_account_id: null,
          p_type: 'pending_group_discovered',
          p_severity: 'info',
          p_title: `Joined group: ${pg.group_name}`,
          p_message: `Successfully joined group "${pg.group_name}". Now monitoring.`,
          p_detail: {
            pending_group_id: pg.id,
            wa_group_id: match.waGroupId,
            group_name: pg.group_name,
          },
          p_channel: 'whatsapp',
          p_dedupe_minutes: 60,
        });

        // Cross-link + notify contractor
        if (pg.invite_code) {
          await crossLinkStatusUpdate(pg.invite_code, 'joined', pg.group_name);
          await notifyContractorOfGroupStatus(pg.invite_code, 'joined', pg.group_name);
        }

        joinedCount++;
        logger.info({ pendingGroupId: pg.id, groupName: pg.group_name, waGroupId: match.waGroupId }, 'Pending group confirmed as joined');
      }
    }

    return joinedCount;
  } catch (err) {
    logger.error({ err }, 'Error in checkJoinedGroups');
    return 0;
  }
}
