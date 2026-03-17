import { createClient } from '@supabase/supabase-js';
import { config } from './config.js';
import { logger } from './logger.js';

const supabase = createClient(config.supabase.url, config.supabase.serviceKey);

// ── Types ────────────────────────────────────────────────────────────────────
export type FilterResult = {
  action: 'skip' | 'parse';
  stage: 'quick_filtered' | 'sender_filtered' | 'pattern_matched' | 'unknown';
  reason?: string;
  signals?: string[];
};

export interface MessageContext {
  messageId: string;
  groupId: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
}

// ── Stage 1: Quick Filter ────────────────────────────────────────────────────
// Drop obviously non-lead messages before any DB lookups
const MIN_TEXT_LENGTH = 8;
const BOT_PATTERNS = /^(ברוכים הבאים|Welcome|הקבוצה נוצרה|Group created|Admin changed)/i;
const MEDIA_ONLY_PATTERN = /^(📷|🎵|🎥|📎|📄|🎤)?\s*$/;
const EMOJI_ONLY = /^[\p{Emoji}\s]+$/u;

export function quickFilter(text: string): FilterResult | null {
  // Too short
  if (text.length < MIN_TEXT_LENGTH) {
    return { action: 'skip', stage: 'quick_filtered', reason: 'too_short' };
  }

  // Emoji-only messages
  if (EMOJI_ONLY.test(text)) {
    return { action: 'skip', stage: 'quick_filtered', reason: 'emoji_only' };
  }

  // Bot/system messages
  if (BOT_PATTERNS.test(text)) {
    return { action: 'skip', stage: 'quick_filtered', reason: 'bot_message' };
  }

  // Media-only placeholder
  if (MEDIA_ONLY_PATTERN.test(text)) {
    return { action: 'skip', stage: 'quick_filtered', reason: 'media_only' };
  }

  return null; // passed quick filter
}

// ── Stage 2: Sender Intelligence ─────────────────────────────────────────────
// Check if sender is a known seller (frequent service advertiser)
// KEY INSIGHT: phone numbers in messages = seller signal (not buyer)

interface MemberRecord {
  classification: string;
  total_messages: number;
  service_messages: number;
  manual_override: boolean;
}

// Sender cache per session (avoid repeated DB hits)
const senderCache: Map<string, { data: MemberRecord; expires: number }> = new Map();
const SENDER_CACHE_TTL_MS = 30_000; // 30 seconds

// Group UUID cache (avoid repeated wa_group_id → UUID lookups)
const groupUuidCache: Map<string, { id: string; expires: number }> = new Map();
const GROUP_CACHE_TTL_MS = 60_000; // 60 seconds (groups rarely change)

async function resolveGroupUuid(waGroupId: string): Promise<string | null> {
  const cached = groupUuidCache.get(waGroupId);
  if (cached && cached.expires > Date.now()) return cached.id;

  const { data: group } = await supabase
    .from('groups')
    .select('id')
    .eq('wa_group_id', waGroupId)
    .single();

  if (group) {
    groupUuidCache.set(waGroupId, { id: group.id, expires: Date.now() + GROUP_CACHE_TTL_MS });
    return group.id;
  }
  return null;
}

async function getSenderRecord(groupId: string, senderId: string): Promise<MemberRecord | null> {
  const cacheKey = `${groupId}:${senderId}`;
  const cached = senderCache.get(cacheKey);
  if (cached && cached.expires > Date.now()) return cached.data;

  try {
    // Look up by group's UUID + sender ID
    const groupUuid = await resolveGroupUuid(groupId);
    if (!groupUuid) return null;

    const { data, error } = await supabase
      .from('group_members')
      .select('classification, total_messages, service_messages, manual_override')
      .eq('group_id', groupUuid)
      .eq('wa_sender_id', senderId)
      .single();

    if (error || !data) return null;

    senderCache.set(cacheKey, { data, expires: Date.now() + SENDER_CACHE_TTL_MS });
    return data;
  } catch {
    return null;
  }
}

export async function senderFilter(groupId: string, senderId: string): Promise<FilterResult | null> {
  const member = await getSenderRecord(groupId, senderId);
  if (!member) return null; // unknown sender, let it through

  // Manual override — respect admin decisions
  if (member.manual_override) {
    if (member.classification === 'seller') {
      return { action: 'skip', stage: 'sender_filtered', reason: 'manual_seller' };
    }
    if (member.classification === 'bot') {
      return { action: 'skip', stage: 'sender_filtered', reason: 'manual_bot' };
    }
    return null; // manual buyer/admin — let through
  }

  // Auto-classified seller with enough data
  if (member.classification === 'seller' && member.total_messages >= 3) {
    return {
      action: 'skip',
      stage: 'sender_filtered',
      reason: 'known_seller',
    };
  }

  // Bot classification
  if (member.classification === 'bot') {
    return { action: 'skip', stage: 'sender_filtered', reason: 'known_bot' };
  }

  return null; // passed sender filter
}

// ── Stage 3: Pattern Match ───────────────────────────────────────────────────
// Look for lead signals: location, ZIP, job type keywords
// IMPORTANT: Phone number = SELLER signal (they advertise), NOT buyer

// US ZIP codes (5-digit)
const ZIP_PATTERN = /\b\d{5}\b/;

// US State abbreviations (standalone, e.g. "PA", "FL", "TX")
const STATE_PATTERN = /\b(?:AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY)\b/;

// Location keywords (US-wide + Hebrew)
const LOCATION_KEYWORDS = [
  // Florida
  'miami', 'fort lauderdale', 'hollywood', 'boca raton', 'aventura', 'tampa',
  'orlando', 'jacksonville', 'palm beach', 'coral springs', 'pembroke pines',
  // Northeast
  'new york', 'brooklyn', 'queens', 'long island', 'philadelphia', 'pittsburgh', 'boston',
  'jersey city', 'newark',
  // South
  'atlanta', 'charlotte', 'nashville', 'houston', 'dallas', 'austin', 'san antonio',
  'phoenix', 'las vegas', 'denver', 'salt lake',
  // West
  'los angeles', 'san diego', 'san francisco', 'seattle', 'portland', 'sacramento',
  'orange county',
  // Midwest
  'chicago', 'detroit', 'cleveland', 'columbus', 'indianapolis', 'minneapolis',
  'st louis', 'kansas city',
  // Hebrew
  'מיאמי', 'ניו יורק', 'לוס אנג׳לס', 'שיקגו', 'פילדלפיה', 'יוסטון',
  'דאלאס', 'אטלנטה', 'פיניקס', 'דנוור', 'סיאטל', 'לאס וגאס',
  'פורט לודרדייל', 'פלורידה', 'טקסס', 'קליפורניה', 'ניו ג׳רזי', 'פנסילבניה',
];

// Job/profession keywords (EN + HE)
const JOB_KEYWORDS_HE = [
  // HVAC / Air
  'מזגן', 'מזגנים', 'מיזוג', 'AC', 'hvac', 'air duct', 'airduct', 'air-duct',
  'dryer vent', 'dryer-vent', 'דרייר', 'אייר דאקט',
  // Chimney
  'chimney', 'צ׳ימני', 'צימני', 'ארובה',
  // Garage door
  'garage door', 'garage', 'גראג׳', 'גראג', 'דלת מוסך',
  // Locksmith
  'locksmith', 'מנעולן', 'car key', 'מפתח',
  // Roofing
  'גגות', 'גג', 'roofing', 'roof', 'shingles',
  // Carpet / Cleaning
  'carpet', 'שטיחים', 'ניקוי', 'ניקיון', 'cleaning',
  // Renovation
  'שיפוץ', 'שיפוצים', 'renovation', 'remodel',
  // Fencing
  'גדר', 'גדרות', 'fence', 'fencing',
  // Plumbing / Electrical
  'plumber', 'plumbing', 'שרברב', 'אינסטלטור',
  'electrician', 'חשמלאי',
  // Other trades
  'painting', 'צביעה', 'tiling', 'ריצוף',
  'landscaping', 'גינון', 'lawn',
  'kitchen', 'מטבח', 'bathroom', 'אמבטיה',
  'pool', 'בריכה', 'moving', 'הובלה',
  'repair', 'fix', 'install', 'installation', 'תיקון', 'התקנה',
  // Lead-specific patterns from real messages
  'service call', 'google lead', 'off track', 'thermostat',
];

// Request/buyer intent keywords
const BUYER_INTENT = [
  'מחפש', 'מחפשת', 'צריך', 'צריכה', 'looking for', 'need',
  'מכיר', 'מכירה', 'ממליץ', 'ממליצה', 'recommend',
  'הצעת מחיר', 'quote', 'estimate', 'הערכת',
  'מישהו', 'someone', 'anybody', 'anyone',
  'עזרה', 'help',
  // Lead-specific intent from real messages
  'tomorrow', 'today', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday',
  'מחר', 'היום', 'K?', 'k?',
  'customer want', 'homeowner',
];

// Seller signals — phone numbers in message body = advertising services
const PHONE_PATTERN = /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}|\b\d{3}-\d{3}-\d{4}\b|\b\d{10}\b/;

export function patternMatch(text: string): FilterResult {
  const lower = text.toLowerCase();
  const signals: string[] = [];

  // Check for ZIP code
  const zipMatch = text.match(ZIP_PATTERN);
  if (zipMatch) signals.push(`zip:${zipMatch[0]}`);

  // Check for US state abbreviation
  const stateMatch = text.match(STATE_PATTERN);
  if (stateMatch) signals.push(`state:${stateMatch[0]}`);

  // Check for location
  for (const loc of LOCATION_KEYWORDS) {
    if (lower.includes(loc.toLowerCase())) {
      signals.push(`location:${loc}`);
      break; // one is enough
    }
  }

  // Check for job keywords
  for (const job of JOB_KEYWORDS_HE) {
    if (lower.includes(job.toLowerCase())) {
      signals.push(`job:${job}`);
      break;
    }
  }

  // Check for buyer intent
  let hasBuyerIntent = false;
  for (const intent of BUYER_INTENT) {
    if (lower.includes(intent.toLowerCase())) {
      signals.push(`intent:${intent}`);
      hasBuyerIntent = true;
      break;
    }
  }

  // Check for phone number (seller signal!)
  const hasPhone = PHONE_PATTERN.test(text);
  if (hasPhone) signals.push('has_phone_number');

  // ── Decision logic ────────────────────────────────────────────────────────
  // Phone + job keyword but NO buyer intent = likely seller posting
  if (hasPhone && signals.some(s => s.startsWith('job:')) && !hasBuyerIntent) {
    return { action: 'skip', stage: 'sender_filtered', reason: 'seller_pattern', signals };
  }

  // Has location OR zip + job keyword = likely a lead request
  const hasLocation = signals.some(s => s.startsWith('location:') || s.startsWith('zip:'));
  const hasJob = signals.some(s => s.startsWith('job:'));

  if (hasLocation && hasJob) {
    return { action: 'parse', stage: 'pattern_matched', signals };
  }

  // Buyer intent + job = likely a lead even without explicit location
  if (hasBuyerIntent && hasJob) {
    return { action: 'parse', stage: 'pattern_matched', signals };
  }

  // Buyer intent + location = might be a lead
  if (hasBuyerIntent && hasLocation) {
    return { action: 'parse', stage: 'pattern_matched', signals };
  }

  // Has at least 2 signals — let AI decide
  if (signals.length >= 2) {
    return { action: 'parse', stage: 'pattern_matched', signals };
  }

  // Single signal or no signals — skip (fail-closed for cost savings)
  // But if text is long enough (>50 chars), let AI decide (fail-open for quality)
  if (text.length > 50 && signals.length >= 1) {
    return { action: 'parse', stage: 'pattern_matched', signals };
  }

  return { action: 'skip', stage: 'quick_filtered', reason: 'no_signals' };
}

// ── Main filter pipeline ─────────────────────────────────────────────────────
export async function runSmartFilter(ctx: MessageContext): Promise<FilterResult> {
  // Stage 1: Quick filter
  const quickResult = quickFilter(ctx.text);
  if (quickResult) {
    logger.debug({ messageId: ctx.messageId, ...quickResult }, 'Quick filter applied');
    return quickResult;
  }

  // Stage 2: Sender intelligence
  const senderResult = await senderFilter(ctx.groupId, ctx.senderId);
  if (senderResult) {
    logger.debug({ messageId: ctx.messageId, senderId: ctx.senderId, ...senderResult }, 'Sender filter applied');
    return senderResult;
  }

  // Stage 3: Pattern matching
  const patternResult = patternMatch(ctx.text);
  logger.debug({ messageId: ctx.messageId, ...patternResult }, 'Pattern match result');
  return patternResult;
}

// ── Update sender stats (called after processing) ────────────────────────────
export async function updateSenderStats(
  groupWaId: string,
  senderId: string,
  senderName: string,
  wasLead: boolean,
  hasPhoneInMessage: boolean,
): Promise<void> {
  try {
    // Get group UUID
    const groupUuid = await resolveGroupUuid(groupWaId);
    if (!groupUuid) return;

    // Upsert member record
    const { data: existing } = await supabase
      .from('group_members')
      .select('id, total_messages, lead_messages, service_messages, classification, manual_override')
      .eq('group_id', groupUuid)
      .eq('wa_sender_id', senderId)
      .single();

    if (existing) {
      const newTotal = existing.total_messages + 1;
      const newLeads = existing.lead_messages + (wasLead ? 1 : 0);
      const newServices = existing.service_messages + (hasPhoneInMessage ? 1 : 0);

      // Auto-classify if not manually overridden
      let newClassification = existing.classification;
      let classifiedAt: string | undefined;

      if (!existing.manual_override) {
        // After 3 messages, start classifying
        if (newTotal >= 3) {
          const serviceRatio = newServices / newTotal;
          const leadRatio = newLeads / newTotal;

          if (serviceRatio >= 0.6) {
            newClassification = 'seller';
            classifiedAt = new Date().toISOString();
          } else if (leadRatio >= 0.4 && newTotal >= 5) {
            newClassification = 'buyer';
            classifiedAt = new Date().toISOString();
          }
        }

        // After 10 messages, refine
        if (newTotal >= 10) {
          const serviceRatio = newServices / newTotal;
          if (serviceRatio >= 0.5) {
            newClassification = 'seller';
            classifiedAt = new Date().toISOString();
          }
        }
      }

      const updateData: Record<string, unknown> = {
        total_messages: newTotal,
        lead_messages: newLeads,
        service_messages: newServices,
        display_name: senderName,
        last_seen_at: new Date().toISOString(),
        classification: newClassification,
      };
      if (classifiedAt) updateData.classified_at = classifiedAt;

      await supabase
        .from('group_members')
        .update(updateData)
        .eq('id', existing.id);
    } else {
      // Insert new member
      await supabase
        .from('group_members')
        .insert({
          group_id: groupUuid,
          wa_sender_id: senderId,
          display_name: senderName,
          total_messages: 1,
          lead_messages: wasLead ? 1 : 0,
          service_messages: hasPhoneInMessage ? 1 : 0,
          classification: 'unknown',
        });
    }

    // Invalidate sender cache
    senderCache.delete(`${groupWaId}:${senderId}`);
  } catch (err) {
    logger.error({ err, groupWaId, senderId }, 'Failed to update sender stats');
  }
}

// ── Log pipeline event ───────────────────────────────────────────────────────
export async function logPipelineEvent(
  groupWaId: string,
  messageId: string | null,
  senderId: string | null,
  stage: string,
  detail?: Record<string, unknown>,
  leadId?: string,
): Promise<void> {
  try {
    // Get group UUID
    const groupUuid = await resolveGroupUuid(groupWaId);

    await supabase.from('pipeline_events').insert({
      group_id: groupUuid ?? null,
      wa_message_id: messageId,
      sender_id: senderId,
      stage,
      detail: detail ?? {},
      lead_id: leadId ?? null,
    });
  } catch (err) {
    logger.error({ err, stage, messageId }, 'Failed to log pipeline event');
  }
}
