/**
 * Unified SyncEngine — WATCHDOG Protocol Task 6
 *
 * Replaces the separate sync-members-local.mjs, enrich-admins-local.mjs,
 * sync-admins-local.mjs and sync-group-members scripts with a single module.
 *
 * Responsibilities:
 *  1. syncGroup()        — delta-sync a single group's membership
 *  2. syncAllGroups()    — iterate all active groups
 *  3. enrichMembers()    — fetch avatar / contact info from Green API
 *  4. discoverNewGroups()— compare Green API contacts with DB
 *  5. onboardInstance()  — full bootstrap for a new WA instance
 */

import { createClient } from '@supabase/supabase-js';
import { config } from './config.js';
import { logger } from './logger.js';
import { invalidateSenderCache } from './smart-filter.js';

// ── Supabase client ─────────────────────────────────────────────────────────
const supabase = createClient(config.supabase.url, config.supabase.serviceKey);

// ── Helpers ─────────────────────────────────────────────────────────────────
function greenUrl(method: string): string {
  return `${config.greenApi.apiUrl}/waInstance${config.greenApi.idInstance}/${method}/${config.greenApi.apiToken}`;
}

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function normalizeChatId(waGroupId: string): string {
  return waGroupId.includes('@g.us') ? waGroupId : `${waGroupId}@g.us`;
}

// ── Types ───────────────────────────────────────────────────────────────────
export interface SyncGroupResult {
  newMembers: number;
  leftMembers: number;
  returningMembers: number;
  adminChanges: number;
  totalMembers: number;
  error?: string;
}

export interface SyncAllResult {
  syncRunId: string;
  groupsSynced: number;
  groupsFailed: number;
  totalNew: number;
  totalLeft: number;
  totalReturning: number;
  totalAdminChanges: number;
}

export interface DiscoverResult {
  newGroups: string[];
  existingGroups: string[];
  removedGroups: string[];
}

// ── Green API response shapes ───────────────────────────────────────────────
interface GreenParticipant {
  id: string;
  isAdmin: boolean;
}

interface GreenGroupData {
  participants?: GreenParticipant[];
  groupName?: string;
}

interface GreenContact {
  id: string;
  name?: string;
  type?: string;
}

interface GreenAvatarResponse {
  urlAvatar?: string;
  existsWhatsapp?: boolean;
}

interface GreenContactInfoResponse {
  name?: string;
  contactName?: string;
  about?: string;
}

// ── DB row shapes ───────────────────────────────────────────────────────────
interface DbGroupMember {
  id: string;
  wa_sender_id: string;
  classification: string;
  manual_override: boolean;
  left_group_at: string | null;
}

// ── 1. syncGroup ────────────────────────────────────────────────────────────

export async function syncGroup(
  groupWaId: string,
  groupUuid: string,
  syncRunId: string,
): Promise<SyncGroupResult> {
  const chatId = normalizeChatId(groupWaId);
  const now = new Date().toISOString();

  const empty: SyncGroupResult = {
    newMembers: 0,
    leftMembers: 0,
    returningMembers: 0,
    adminChanges: 0,
    totalMembers: 0,
  };

  // 1. Call Green API getGroupData
  let apiParticipants: GreenParticipant[];
  try {
    const res = await fetch(greenUrl('getGroupData'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ groupId: chatId }),
    });

    if (!res.ok) {
      logger.warn({ groupUuid, chatId, status: res.status }, 'getGroupData failed');
      await supabase
        .from('groups')
        .update({ sync_status: 'failed' })
        .eq('id', groupUuid);
      return { ...empty, error: `HTTP ${res.status}` };
    }

    const body = (await res.json()) as GreenGroupData;

    // Handle "instance not authorized" response
    if (!body.participants || body.participants.length === 0) {
      logger.info({ groupUuid, chatId }, 'getGroupData returned 0 participants — skipping');
      return { ...empty, error: 'no_participants' };
    }

    apiParticipants = body.participants;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err, groupUuid, chatId }, 'getGroupData network error');
    await supabase
      .from('groups')
      .update({ sync_status: 'failed' })
      .eq('id', groupUuid);
    return { ...empty, error: message };
  }

  // 2. Build API maps
  const apiMap = new Map<string, boolean>(); // waId → isAdmin
  for (const p of apiParticipants) {
    apiMap.set(p.id, p.isAdmin);
  }

  // 3. Load existing members from DB
  const { data: existingMembers, error: dbErr } = await supabase
    .from('group_members')
    .select('id, wa_sender_id, classification, manual_override, left_group_at')
    .eq('group_id', groupUuid);

  if (dbErr) {
    logger.error({ err: dbErr, groupUuid }, 'Failed to load group_members');
    return { ...empty, error: dbErr.message };
  }

  const dbMap = new Map<string, DbGroupMember>();
  for (const m of existingMembers ?? []) {
    dbMap.set(m.wa_sender_id, m);
  }

  // 4. Compute diffs
  const toInsert: Array<Record<string, unknown>> = [];
  const joinEvents: Array<Record<string, unknown>> = [];
  const returningIds: string[] = [];
  const returningUpdates: Array<{ id: string; updates: Record<string, unknown> }> = [];
  const adminPromotions: Array<{ memberId: string; waId: string }> = [];
  const adminDemotions: Array<{ memberId: string; waId: string }> = [];

  for (const [waId, isAdmin] of apiMap) {
    const existing = dbMap.get(waId);

    if (!existing) {
      // ── New member ──
      toInsert.push({
        group_id: groupUuid,
        wa_sender_id: waId,
        classification: isAdmin ? 'admin' : 'unknown',
        classified_at: isAdmin ? now : null,
        joined_group_at: now,
        last_seen_at: now,
        total_messages: 0,
        lead_messages: 0,
        service_messages: 0,
      });
      joinEvents.push({
        group_id: groupUuid,
        wa_sender_id: waId,
        event_type: 'member_joined',
        sync_run_id: syncRunId,
        detected_at: now,
      });
    } else {
      // ── Existing member ──
      const updates: Record<string, unknown> = { last_seen_at: now };

      // Returning member (was marked as left)
      if (existing.left_group_at) {
        updates.left_group_at = null;
        updates.joined_group_at = now;
        returningIds.push(existing.id);
        joinEvents.push({
          group_id: groupUuid,
          wa_sender_id: waId,
          event_type: 'member_joined',
          sync_run_id: syncRunId,
          detail: { returning: true },
          detected_at: now,
        });
      }

      // Admin change detection (skip if manually overridden)
      if (!existing.manual_override) {
        const wasAdmin = existing.classification === 'admin';
        if (isAdmin && !wasAdmin) {
          updates.classification = 'admin';
          updates.classified_at = now;
          adminPromotions.push({ memberId: existing.id, waId });
        } else if (!isAdmin && wasAdmin) {
          updates.classification = 'unknown';
          updates.classified_at = now;
          adminDemotions.push({ memberId: existing.id, waId });
        }
      }

      // Only update if there are real changes beyond last_seen_at
      if (Object.keys(updates).length > 1 || existing.left_group_at) {
        returningUpdates.push({ id: existing.id, updates });
      } else {
        // Just bump last_seen_at — batch this later
        returningUpdates.push({ id: existing.id, updates: { last_seen_at: now } });
      }
    }
  }

  // Left members: in DB (active) but not in API
  const leftIds: string[] = [];
  const leftEvents: Array<Record<string, unknown>> = [];
  for (const [waId, member] of dbMap) {
    if (!apiMap.has(waId) && !member.left_group_at) {
      leftIds.push(member.id);
      leftEvents.push({
        group_id: groupUuid,
        wa_sender_id: waId,
        event_type: 'member_left',
        sync_run_id: syncRunId,
        detected_at: now,
      });
    }
  }

  // 5. Execute batch writes

  // Insert new members
  if (toInsert.length > 0) {
    const { error: insertErr } = await supabase.from('group_members').insert(toInsert);
    if (insertErr) {
      logger.error({ err: insertErr, groupUuid, count: toInsert.length }, 'Failed to insert new members');
    }
  }

  // Update existing members (batch by collecting IDs for simple last_seen_at updates)
  const simpleUpdateIds: string[] = [];
  for (const { id, updates } of returningUpdates) {
    const keys = Object.keys(updates);
    if (keys.length === 1 && keys[0] === 'last_seen_at') {
      simpleUpdateIds.push(id);
    } else {
      // Complex update — do individually
      const { error: updateErr } = await supabase
        .from('group_members')
        .update(updates)
        .eq('id', id);
      if (updateErr) {
        logger.error({ err: updateErr, memberId: id }, 'Failed to update member');
      }
    }
  }

  // Batch last_seen_at update
  if (simpleUpdateIds.length > 0) {
    const { error: batchErr } = await supabase
      .from('group_members')
      .update({ last_seen_at: now })
      .in('id', simpleUpdateIds);
    if (batchErr) {
      logger.error({ err: batchErr, count: simpleUpdateIds.length }, 'Failed batch last_seen_at update');
    }
  }

  // Mark left members
  if (leftIds.length > 0) {
    const { error: leftErr } = await supabase
      .from('group_members')
      .update({ left_group_at: now })
      .in('id', leftIds);
    if (leftErr) {
      logger.error({ err: leftErr, count: leftIds.length }, 'Failed to mark left members');
    }
  }

  // Insert sync events (batch)
  const allEvents = [...joinEvents, ...leftEvents];

  // Admin promotion / demotion events
  for (const promo of adminPromotions) {
    allEvents.push({
      group_id: groupUuid,
      wa_sender_id: promo.waId,
      event_type: 'admin_promoted',
      sync_run_id: syncRunId,
      detected_at: now,
    });
    invalidateSenderCache(groupWaId, promo.waId);
  }
  for (const demo of adminDemotions) {
    allEvents.push({
      group_id: groupUuid,
      wa_sender_id: demo.waId,
      event_type: 'admin_demoted',
      sync_run_id: syncRunId,
      detected_at: now,
    });
    invalidateSenderCache(groupWaId, demo.waId);
  }

  if (allEvents.length > 0) {
    const { error: evtErr } = await supabase.from('sync_events').insert(allEvents);
    if (evtErr) {
      logger.error({ err: evtErr, count: allEvents.length }, 'Failed to insert sync_events');
    }
  }

  // 6. Update group stats
  const adminCount = apiParticipants.filter((p) => p.isAdmin).length;
  await supabase
    .from('groups')
    .update({
      total_members: apiParticipants.length,
      known_admins: adminCount,
      last_synced_at: now,
      sync_status: 'synced',
    })
    .eq('id', groupUuid);

  return {
    newMembers: toInsert.length,
    leftMembers: leftIds.length,
    returningMembers: returningIds.length,
    adminChanges: adminPromotions.length + adminDemotions.length,
    totalMembers: apiParticipants.length,
  };
}

// ── 2. syncAllGroups ────────────────────────────────────────────────────────

export async function syncAllGroups(): Promise<SyncAllResult> {
  const syncRunId = `sync-${Date.now()}`;
  logger.info({ syncRunId }, 'Starting full group sync');

  const { data: groups, error } = await supabase
    .from('groups')
    .select('id, wa_group_id, name')
    .eq('status', 'active')
    .eq('instance_status', 'active');

  if (error || !groups) {
    logger.error({ err: error }, 'Failed to fetch groups for sync');
    return {
      syncRunId,
      groupsSynced: 0,
      groupsFailed: 0,
      totalNew: 0,
      totalLeft: 0,
      totalReturning: 0,
      totalAdminChanges: 0,
    };
  }

  logger.info({ syncRunId, groupCount: groups.length }, 'Groups to sync');

  const result: SyncAllResult = {
    syncRunId,
    groupsSynced: 0,
    groupsFailed: 0,
    totalNew: 0,
    totalLeft: 0,
    totalReturning: 0,
    totalAdminChanges: 0,
  };

  for (const group of groups) {
    if (!group.wa_group_id) continue;

    // Mark as syncing
    await supabase
      .from('groups')
      .update({ sync_status: 'syncing' })
      .eq('id', group.id);

    const groupResult = await syncGroup(group.wa_group_id, group.id, syncRunId);

    if (groupResult.error) {
      result.groupsFailed++;
      logger.warn(
        { groupId: group.id, name: group.name, error: groupResult.error },
        'Group sync failed',
      );
    } else {
      result.groupsSynced++;
      result.totalNew += groupResult.newMembers;
      result.totalLeft += groupResult.leftMembers;
      result.totalReturning += groupResult.returningMembers;
      result.totalAdminChanges += groupResult.adminChanges;

      logger.info(
        {
          groupId: group.id,
          name: group.name,
          members: groupResult.totalMembers,
          new: groupResult.newMembers,
          left: groupResult.leftMembers,
          returning: groupResult.returningMembers,
          adminChanges: groupResult.adminChanges,
        },
        'Group synced',
      );
    }

    // Rate-limit between groups
    await delay(1000);
  }

  // Sync admin counts
  await supabase.rpc('sync_group_admin_counts');

  logger.info(
    {
      syncRunId,
      groupsSynced: result.groupsSynced,
      groupsFailed: result.groupsFailed,
      totalNew: result.totalNew,
      totalLeft: result.totalLeft,
      totalReturning: result.totalReturning,
      totalAdminChanges: result.totalAdminChanges,
    },
    'Full sync completed',
  );

  return result;
}

// ── 3. enrichMembers ────────────────────────────────────────────────────────

export async function enrichMembers(opts?: { limit?: number }): Promise<number> {
  const limit = opts?.limit ?? 200;

  // Priority: unenriched admins first, then members with leads, then everyone else
  // Supabase JS doesn't support CASE ordering, so we do sequential queries
  const seen = new Set<string>();
  const toEnrich: Array<{ id: string; wa_sender_id: string }> = [];

  // Helper to collect from a query result
  const collect = (data: Array<{ id: string; wa_sender_id: string }> | null) => {
    for (const m of data ?? []) {
      if (toEnrich.length >= limit) break;
      if (seen.has(m.id)) continue;
      seen.add(m.id);
      toEnrich.push({ id: m.id, wa_sender_id: m.wa_sender_id });
    }
  };

  // Batch 1: unenriched admins
  const { data: admins, error: e1 } = await supabase
    .from('group_members')
    .select('id, wa_sender_id')
    .is('left_group_at', null)
    .is('last_enriched_at', null)
    .eq('classification', 'admin')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (e1) logger.error({ err: e1 }, 'Failed to query unenriched admins');
  collect(admins);

  // Batch 2: unenriched members with lead activity
  if (toEnrich.length < limit) {
    const { data: leads, error: e2 } = await supabase
      .from('group_members')
      .select('id, wa_sender_id')
      .is('left_group_at', null)
      .is('last_enriched_at', null)
      .neq('classification', 'admin')
      .gt('lead_messages', 0)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (e2) logger.error({ err: e2 }, 'Failed to query unenriched lead members');
    collect(leads);
  }

  // Batch 3: any other unenriched
  if (toEnrich.length < limit) {
    const { data: others, error: e3 } = await supabase
      .from('group_members')
      .select('id, wa_sender_id')
      .is('left_group_at', null)
      .is('last_enriched_at', null)
      .neq('classification', 'admin')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (e3) logger.error({ err: e3 }, 'Failed to query unenriched other members');
    collect(others);
  }

  logger.info({ count: toEnrich.length, limit }, 'Starting member enrichment');

  let enriched = 0;

  for (const member of toEnrich) {
    const updates: Record<string, unknown> = {
      last_enriched_at: new Date().toISOString(),
    };

    // 1. Get avatar
    try {
      const res = await fetch(greenUrl('getAvatar'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: member.wa_sender_id }),
      });
      if (res.ok) {
        const data = (await res.json()) as GreenAvatarResponse;
        if (data.urlAvatar) updates.profile_pic_url = data.urlAvatar;
      }
    } catch {
      // Silent — avatar is optional
    }

    await delay(200);

    // 2. Get contact info
    try {
      const res = await fetch(greenUrl('getContactInfo'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: member.wa_sender_id }),
      });
      if (res.ok) {
        const data = (await res.json()) as GreenContactInfoResponse;
        if (data.name) updates.profile_name = data.name;
        if (data.contactName) updates.display_name = data.contactName;
        if (data.about) updates.about = data.about;
      }
    } catch {
      // Silent — contact info is optional
    }

    await delay(200);

    // 3. Save to group_members
    const { error: updateErr } = await supabase
      .from('group_members')
      .update(updates)
      .eq('id', member.id);

    if (updateErr) {
      logger.error({ err: updateErr, memberId: member.id }, 'Failed to update enrichment data');
      continue;
    }

    // 4. Also update prospect record if it exists
    if (updates.profile_pic_url || updates.display_name || updates.profile_name) {
      const prospectUpdates: Record<string, unknown> = {};
      if (updates.profile_pic_url) prospectUpdates.profile_pic_url = updates.profile_pic_url;
      if (updates.display_name || updates.profile_name) {
        prospectUpdates.display_name = (updates.display_name ?? updates.profile_name) as string;
      }
      await supabase
        .from('prospects')
        .update(prospectUpdates)
        .eq('wa_id', member.wa_sender_id);
    }

    enriched++;

    if (enriched % 50 === 0) {
      logger.info({ enriched, total: toEnrich.length }, 'Enrichment progress');
    }
  }

  logger.info({ enriched, total: toEnrich.length }, 'Enrichment completed');
  return enriched;
}

// ── 4. discoverNewGroups ────────────────────────────────────────────────────

export async function discoverNewGroups(): Promise<DiscoverResult> {
  const result: DiscoverResult = {
    newGroups: [],
    existingGroups: [],
    removedGroups: [],
  };

  // 1. Get contacts from Green API
  let apiGroups: GreenContact[];
  try {
    const res = await fetch(greenUrl('getContacts'), {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!res.ok) {
      logger.error({ status: res.status }, 'getContacts failed');
      return result;
    }

    const contacts = (await res.json()) as GreenContact[];
    apiGroups = contacts.filter((c) => c.id.endsWith('@g.us'));
  } catch (err) {
    logger.error({ err }, 'getContacts network error');
    return result;
  }

  logger.info({ apiGroupCount: apiGroups.length }, 'Groups found in Green API');

  // 2. Load existing groups from DB
  const { data: dbGroups, error: dbErr } = await supabase
    .from('groups')
    .select('id, wa_group_id, status');

  if (dbErr) {
    logger.error({ err: dbErr }, 'Failed to fetch groups from DB');
    return result;
  }

  const dbGroupSet = new Set((dbGroups ?? []).map((g) => g.wa_group_id));
  const apiGroupSet = new Set(apiGroups.map((g) => g.id));

  // 3. New groups (in API, not in DB)
  const now = new Date().toISOString();
  const newGroupInserts: Array<Record<string, unknown>> = [];
  const discoveredEvents: Array<Record<string, unknown>> = [];

  for (const apiGroup of apiGroups) {
    if (dbGroupSet.has(apiGroup.id)) {
      result.existingGroups.push(apiGroup.id);
    } else {
      result.newGroups.push(apiGroup.id);
      newGroupInserts.push({
        wa_group_id: apiGroup.id,
        name: apiGroup.name ?? apiGroup.id,
        status: 'active',
        instance_status: 'active',
        sync_status: 'never',
      });
      discoveredEvents.push({
        wa_sender_id: null,
        event_type: 'group_discovered',
        detail: { wa_group_id: apiGroup.id, name: apiGroup.name },
        detected_at: now,
      });
    }
  }

  if (newGroupInserts.length > 0) {
    const { data: inserted, error: insertErr } = await supabase
      .from('groups')
      .insert(newGroupInserts)
      .select('id, wa_group_id');

    if (insertErr) {
      logger.error({ err: insertErr, count: newGroupInserts.length }, 'Failed to insert new groups');
    } else if (inserted) {
      // Link sync events to newly-inserted group IDs
      for (let i = 0; i < inserted.length; i++) {
        if (discoveredEvents[i]) {
          discoveredEvents[i].group_id = inserted[i].id;
        }
      }
    }
  }

  // 4. Removed groups (in DB active, not in API)
  const removedGroupUpdates: string[] = [];
  const removedEvents: Array<Record<string, unknown>> = [];

  for (const dbGroup of dbGroups ?? []) {
    if (!apiGroupSet.has(dbGroup.wa_group_id) && dbGroup.status === 'active') {
      removedGroupUpdates.push(dbGroup.id);
      result.removedGroups.push(dbGroup.wa_group_id);
      removedEvents.push({
        group_id: dbGroup.id,
        wa_sender_id: null,
        event_type: 'group_removed',
        detail: { wa_group_id: dbGroup.wa_group_id },
        detected_at: now,
      });
    }
  }

  if (removedGroupUpdates.length > 0) {
    await supabase
      .from('groups')
      .update({ instance_status: 'not_in_instance' })
      .in('id', removedGroupUpdates);
  }

  // 5. Insert all sync events
  const allEvents = [...discoveredEvents, ...removedEvents];
  if (allEvents.length > 0) {
    const { error: evtErr } = await supabase.from('sync_events').insert(allEvents);
    if (evtErr) {
      logger.error({ err: evtErr }, 'Failed to insert discovery sync_events');
    }
  }

  logger.info(
    {
      newGroups: result.newGroups.length,
      existingGroups: result.existingGroups.length,
      removedGroups: result.removedGroups.length,
    },
    'Group discovery completed',
  );

  return result;
}

// ── 5. onboardInstance ──────────────────────────────────────────────────────

export async function onboardInstance(): Promise<void> {
  logger.info('Starting instance onboarding');

  // Step 1: Discover groups
  const discoverResult = await discoverNewGroups();
  logger.info(
    { newGroups: discoverResult.newGroups.length },
    'Discovery phase complete',
  );

  // Step 2: Sync all groups
  const syncResult = await syncAllGroups();
  logger.info(
    {
      synced: syncResult.groupsSynced,
      failed: syncResult.groupsFailed,
      newMembers: syncResult.totalNew,
    },
    'Sync phase complete',
  );

  // Step 3: Enrich admins first (small batch)
  const enrichCount = await enrichMembers({ limit: 50 });
  logger.info({ enriched: enrichCount }, 'Initial enrichment complete');

  // Step 4: Summary alert
  await supabase.rpc('send_alert', {
    p_account_id: null,
    p_type: 'sync_completed',
    p_severity: 'info',
    p_title: 'Instance onboarding complete',
    p_message: `Discovered ${discoverResult.newGroups.length} new groups. Synced ${syncResult.groupsSynced} groups (+${syncResult.totalNew} members). Enriched ${enrichCount} profiles.`,
    p_detail: {
      discover: {
        newGroups: discoverResult.newGroups.length,
        removedGroups: discoverResult.removedGroups.length,
      },
      sync: {
        synced: syncResult.groupsSynced,
        failed: syncResult.groupsFailed,
        newMembers: syncResult.totalNew,
        leftMembers: syncResult.totalLeft,
      },
      enriched: enrichCount,
    },
    p_channel: 'dashboard',
    p_dedupe_minutes: 5,
  });

  logger.info('Instance onboarding finished');
}
