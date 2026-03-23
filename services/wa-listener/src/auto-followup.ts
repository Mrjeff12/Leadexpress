/**
 * Auto Follow-Up Engine
 *
 * Sends templated follow-up messages to prospects who haven't replied:
 *  - Touch 2 (follow-up 1): 3 days after first outreach
 *  - Touch 3 (follow-up 2): 7 days after first outreach (4 days after touch 2)
 *  - No-response mark:      14 days after first outreach (7 days after touch 3)
 *
 * Templates are randomly selected for built-in A/B testing.
 * Batch-limited to 20 per touch per run with 2s delay between sends.
 */

import { createClient } from '@supabase/supabase-js';
import { config } from './config.js';
import { logger } from './logger.js';

const supabase = createClient(config.supabase.url, config.supabase.serviceKey);

// ── Template interpolation ──────────────────────────────────────────────────

export function fillTemplate(
  template: string,
  vars: Record<string, string>,
): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replaceAll(`{${key}}`, value);
  }
  return result;
}

// ── Prospect context for template vars ──────────────────────────────────────

interface ProspectContext {
  name: string;
  group_name: string;
  lead_count: string;
  contractor_count: string;
}

async function getProspectContext(prospectId: string): Promise<ProspectContext | null> {
  const { data: prospect, error } = await supabase
    .from('prospects')
    .select('display_name, phone, group_ids')
    .eq('id', prospectId)
    .single();

  if (error || !prospect) {
    logger.error({ err: error, prospectId }, 'Failed to fetch prospect for context');
    return null;
  }

  const name = prospect.display_name || prospect.phone || 'שלום';

  // Get first group name
  let groupName = 'הקבוצה';
  const groupIds: string[] = prospect.group_ids ?? [];
  if (groupIds.length > 0) {
    const { data: group } = await supabase
      .from('groups')
      .select('name')
      .eq('id', groupIds[0])
      .single();
    if (group?.name) groupName = group.name;
  }

  // Count leads in group from last 7 days
  let leadCount = '5'; // fallback
  if (groupIds.length > 0) {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { count } = await supabase
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .eq('group_id', groupIds[0])
      .gte('created_at', sevenDaysAgo);
    if (count && count > 0) leadCount = String(count);
  }

  return {
    name,
    group_name: groupName,
    lead_count: leadCount,
    contractor_count: '12', // hardcoded for now
  };
}

// ── Random template picker ──────────────────────────────────────────────────

interface Template {
  id: string;
  body_template: string;
}

async function pickTemplate(touchNumber: number): Promise<Template | null> {
  const { data, error } = await supabase
    .from('message_templates')
    .select('id, body_template')
    .eq('touch_number', touchNumber)
    .eq('is_active', true)
    .eq('category', 'follow_up');

  if (error || !data || data.length === 0) {
    logger.error({ err: error, touchNumber }, 'No templates found for touch');
    return null;
  }

  // Random selection for A/B testing
  const idx = Math.floor(Math.random() * data.length);
  return data[idx];
}

// ── Send a single follow-up ─────────────────────────────────────────────────

async function sendFollowUp(prospectId: string, touchNumber: number): Promise<boolean> {
  try {
    // 1. Get prospect and verify stage
    const { data: prospect, error: pErr } = await supabase
      .from('prospects')
      .select('id, phone, stage, sub_status')
      .eq('id', prospectId)
      .single();

    if (pErr || !prospect) {
      logger.warn({ prospectId, err: pErr }, 'Prospect not found for follow-up');
      return false;
    }

    if (prospect.stage !== 'reached_out') {
      logger.info({ prospectId, stage: prospect.stage }, 'Prospect no longer in reached_out — skipping');
      return false;
    }

    if (!prospect.phone) {
      logger.warn({ prospectId }, 'Prospect has no phone — skipping follow-up');
      return false;
    }

    // 2. Get context
    const ctx = await getProspectContext(prospectId);
    if (!ctx) return false;

    // 3. Pick template
    const template = await pickTemplate(touchNumber);
    if (!template) return false;

    // 4. Fill template
    const message = fillTemplate(template.body_template, ctx as unknown as Record<string, string>);

    // 5. Send via Twilio (same pattern as alerts.ts)
    const { accountSid, authToken, whatsappFrom } = config.twilio;
    if (!accountSid || !authToken || !whatsappFrom) {
      logger.warn('Twilio credentials missing — skipping follow-up send');
      return false;
    }

    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

    const body = new URLSearchParams({
      From: `whatsapp:${whatsappFrom}`,
      To: `whatsapp:${prospect.phone}`,
      Body: message,
    });

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
      logger.error({ status: res.status, text, prospectId }, 'Twilio follow-up send failed');
      return false;
    }

    const sendResult = (await res.json()) as { sid?: string };
    const messageSid = sendResult.sid ?? null;

    // 6. Save to prospect_messages
    await supabase.from('prospect_messages').insert({
      prospect_id: prospectId,
      direction: 'outgoing',
      message_type: 'text',
      channel: 'twilio',
      content: message,
      wa_message_id: messageSid,
      template_id: template.id,
      sent_at: new Date().toISOString(),
    });

    // 7. Update prospect sub_status
    const newSubStatus = touchNumber === 2 ? 'followup_1' : 'followup_2';
    await supabase
      .from('prospects')
      .update({
        sub_status: newSubStatus,
        sub_status_changed_at: new Date().toISOString(),
      })
      .eq('id', prospectId);

    // 8. Increment template send_count
    // Fetch current count and increment (atomic enough for hourly batch job)
    const { data: tpl } = await supabase
      .from('message_templates')
      .select('send_count')
      .eq('id', template.id)
      .single();
    if (tpl) {
      await supabase
        .from('message_templates')
        .update({ send_count: (tpl.send_count || 0) + 1 })
        .eq('id', template.id);
    }

    // 9. Log prospect_event
    await supabase.from('prospect_events').insert({
      prospect_id: prospectId,
      event_type: 'auto_followup',
      new_value: `touch_${touchNumber}`,
      detail: { template_id: template.id, template_name: template.body_template.substring(0, 50) },
    });

    logger.info(
      { prospectId, touchNumber, templateId: template.id, phone: prospect.phone },
      'Auto follow-up sent',
    );

    return true;
  } catch (err) {
    logger.error({ err, prospectId, touchNumber }, 'sendFollowUp failed');
    return false;
  }
}

// ── Main job ────────────────────────────────────────────────────────────────

export async function runFollowUpJob(): Promise<void> {
  logger.info('Running auto follow-up job...');
  let sent2 = 0;
  let sent3 = 0;

  try {
    // Touch 2: prospects in reached_out with sub_status unread/read_no_reply
    // AND sub_status_changed_at is 3+ days ago
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    const { data: touch2 } = await supabase
      .from('prospects')
      .select('id')
      .eq('stage', 'reached_out')
      .in('sub_status', ['unread', 'read_no_reply'])
      .lt('sub_status_changed_at', threeDaysAgo)
      .is('archived_at', null)
      .limit(20);

    for (const p of touch2 || []) {
      const ok = await sendFollowUp(p.id, 2);
      if (ok) sent2++;
      await new Promise((r) => setTimeout(r, 2000)); // 2s between sends
    }

    // Touch 3: prospects with sub_status followup_1
    // AND sub_status_changed_at is 4+ days ago (7 days total from first outreach)
    const fourDaysAgo = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString();
    const { data: touch3 } = await supabase
      .from('prospects')
      .select('id')
      .eq('stage', 'reached_out')
      .eq('sub_status', 'followup_1')
      .lt('sub_status_changed_at', fourDaysAgo)
      .is('archived_at', null)
      .limit(20);

    for (const p of touch3 || []) {
      const ok = await sendFollowUp(p.id, 3);
      if (ok) sent3++;
      await new Promise((r) => setTimeout(r, 2000));
    }

    // Mark no_response: followup_2 that's 7+ days old (14 days total from first outreach)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: noResp } = await supabase
      .from('prospects')
      .select('id')
      .eq('stage', 'reached_out')
      .eq('sub_status', 'followup_2')
      .lt('sub_status_changed_at', sevenDaysAgo)
      .is('archived_at', null);

    if (noResp && noResp.length > 0) {
      await supabase
        .from('prospects')
        .update({
          sub_status: 'no_response',
          sub_status_changed_at: new Date().toISOString(),
        })
        .in(
          'id',
          noResp.map((p) => p.id),
        );

      // Log events for no_response transitions
      const events = noResp.map((p) => ({
        prospect_id: p.id,
        event_type: 'auto_followup',
        new_value: 'no_response',
      }));
      await supabase.from('prospect_events').insert(events);
    }

    if (sent2 + sent3 > 0 || (noResp && noResp.length > 0)) {
      logger.info(
        { touch2: sent2, touch3: sent3, noResponse: noResp?.length || 0 },
        'Auto follow-up complete',
      );
    }
  } catch (err) {
    logger.error({ err }, 'Auto follow-up job failed');
  }
}
