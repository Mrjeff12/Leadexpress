/**
 * WATCHDOG Scheduler — Task 7
 *
 * Orchestrates periodic jobs:
 *  1. Silence detector  — checks for missing notifications (every 60s)
 *  2. Delta sync         — syncAllGroups() every 4 hours
 *  3. Enrichment         — enrichMembers() every 4h + 30min offset
 *  4. Daily summary      — 24h aggregate stats alert
 *  5. Health log cleanup — prune old health_logs every 24h
 */

import { createClient } from '@supabase/supabase-js';
import { config } from './config.js';
import { logger } from './logger.js';
import { syncAllGroups, enrichMembers } from './sync-engine.js';

const supabase = createClient(config.supabase.url, config.supabase.serviceKey);

let timers: ReturnType<typeof setInterval>[] = [];
let timeouts: ReturnType<typeof setTimeout>[] = [];
let lastNotificationAt = Date.now();

// ── Public: called by listener.ts on every incoming notification ────────────
export function touchLastNotification(): void {
  lastNotificationAt = Date.now();
}

// ── Green API helper ────────────────────────────────────────────────────────
function greenUrl(method: string): string {
  return `${config.greenApi.apiUrl}/waInstance${config.greenApi.idInstance}/${method}/${config.greenApi.apiToken}`;
}

// ── Job 1: Silence Detector ─────────────────────────────────────────────────
const SILENCE_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes

async function silenceDetector(): Promise<void> {
  const silentMs = Date.now() - lastNotificationAt;
  if (silentMs <= SILENCE_THRESHOLD_MS) return;

  logger.warn({ silentMs, thresholdMs: SILENCE_THRESHOLD_MS }, 'Silence detected — verifying instance state');

  try {
    const res = await fetch(greenUrl('getStateInstance'));
    if (!res.ok) {
      logger.error({ status: res.status }, 'getStateInstance failed during silence check');
      return;
    }

    const data = (await res.json()) as { stateInstance: string };
    const state = data.stateInstance;

    if (state !== 'authorized') {
      logger.error({ state, silentMs }, 'Instance NOT authorized — sending alert');

      await supabase.rpc('send_alert', {
        p_account_id: null,
        p_type: 'silence_detected',
        p_severity: 'critical',
        p_title: 'WhatsApp instance not authorized',
        p_message: `No notifications for ${Math.round(silentMs / 60_000)} minutes. Instance state: ${state}. Re-scan QR code.`,
        p_detail: { state, silentMs },
        p_channel: 'whatsapp',
        p_dedupe_minutes: 30,
      });
    } else {
      logger.info({ silentMs }, 'Instance is authorized — silence may be normal (low traffic)');
    }
  } catch (err) {
    logger.error({ err }, 'Silence detector failed');
  }
}

// ── Job 2: Delta Sync ───────────────────────────────────────────────────────
async function deltaSyncJob(): Promise<void> {
  logger.info('Watchdog: starting delta sync');
  try {
    const result = await syncAllGroups();
    logger.info(
      {
        syncRunId: result.syncRunId,
        synced: result.groupsSynced,
        failed: result.groupsFailed,
        newMembers: result.totalNew,
        leftMembers: result.totalLeft,
      },
      'Watchdog: delta sync completed',
    );
  } catch (err) {
    logger.error({ err }, 'Watchdog: delta sync failed');
  }
}

// ── Job 3: Enrichment ───────────────────────────────────────────────────────
async function enrichmentJob(): Promise<void> {
  logger.info('Watchdog: starting enrichment');
  try {
    const enriched = await enrichMembers({ limit: 200 });
    logger.info({ enriched }, 'Watchdog: enrichment completed');
  } catch (err) {
    logger.error({ err }, 'Watchdog: enrichment failed');
  }
}

// ── Job 4: Daily Summary ────────────────────────────────────────────────────
async function dailySummaryJob(): Promise<void> {
  logger.info('Watchdog: building daily summary');
  try {
    // Count new members today
    const { count: joined } = await supabase
      .from('sync_events')
      .select('*', { count: 'exact', head: true })
      .eq('event_type', 'member_joined')
      .gte('detected_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    // Count left members today
    const { count: left } = await supabase
      .from('sync_events')
      .select('*', { count: 'exact', head: true })
      .eq('event_type', 'member_left')
      .gte('detected_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    // Count leads today
    const { count: leads } = await supabase
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    // Count alerts today
    const { count: alerts } = await supabase
      .from('system_alerts')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    const summary = [
      `Daily Summary`,
      `---`,
      `New members: ${joined ?? 0}`,
      `Left members: ${left ?? 0}`,
      `Leads captured: ${leads ?? 0}`,
      `Alerts fired: ${alerts ?? 0}`,
    ].join('\n');

    await supabase.rpc('send_alert', {
      p_account_id: null,
      p_type: 'daily_summary',
      p_severity: 'info',
      p_title: 'Daily Summary',
      p_message: summary,
      p_detail: {
        joined: joined ?? 0,
        left: left ?? 0,
        leads: leads ?? 0,
        alerts: alerts ?? 0,
      },
      p_channel: 'whatsapp',
      p_dedupe_minutes: 1380, // ~23 hours
    });

    logger.info({ joined, left, leads, alerts }, 'Watchdog: daily summary sent');
  } catch (err) {
    logger.error({ err }, 'Watchdog: daily summary failed');
  }
}

// ── Job 5: Health Log Cleanup ───────────────────────────────────────────────
async function healthCleanupJob(): Promise<void> {
  logger.info('Watchdog: cleaning up old health logs');
  try {
    await supabase.rpc('cleanup_old_health_logs');
    logger.info('Watchdog: health log cleanup completed');
  } catch (err) {
    logger.error({ err }, 'Watchdog: health log cleanup failed');
  }
}

// ── Start / Stop ────────────────────────────────────────────────────────────
export async function startWatchdog(): Promise<void> {
  logger.info('Starting WATCHDOG scheduler');

  // Job 1: Silence detector — every 60s
  timers.push(setInterval(silenceDetector, 60_000));

  // Job 2: Delta sync — every 4h (initial delay 5 min to let listener settle)
  const syncTimeout = setTimeout(() => {
    deltaSyncJob(); // run once immediately after delay
    timers.push(setInterval(deltaSyncJob, 4 * 60 * 60 * 1000));
  }, 5 * 60 * 1000);
  timeouts.push(syncTimeout);

  // Job 3: Enrichment — every 4h, offset 30 min from sync
  const enrichTimeout = setTimeout(() => {
    enrichmentJob(); // run once immediately after delay
    timers.push(setInterval(enrichmentJob, 4 * 60 * 60 * 1000));
  }, 35 * 60 * 1000);
  timeouts.push(enrichTimeout);

  // Job 4: Daily summary — every 24h
  timers.push(setInterval(dailySummaryJob, 24 * 60 * 60 * 1000));

  // Job 5: Health cleanup — every 24h
  timers.push(setInterval(healthCleanupJob, 24 * 60 * 60 * 1000));

  logger.info('WATCHDOG scheduler started — sync every 4h, enrichment every 4h+30m');
}

export async function stopWatchdog(): Promise<void> {
  timeouts.forEach((t) => clearTimeout(t));
  timeouts = [];
  timers.forEach((t) => clearInterval(t));
  timers = [];
  logger.info('WATCHDOG scheduler stopped');
}
