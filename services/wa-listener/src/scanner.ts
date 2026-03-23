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
