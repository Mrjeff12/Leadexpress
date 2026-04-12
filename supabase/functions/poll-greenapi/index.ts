import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

// ── Supabase client ──────────────────────────────────────────────────────────
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

// ── Green API config (loaded from wa_accounts table) ────────────────────────
interface WaAccount {
  id: string;
  green_api_id: string;
  green_api_token: string;
  green_api_url: string;
}

async function getActiveAccounts(): Promise<WaAccount[]> {
  const { data } = await supabase
    .from("wa_accounts")
    .select("id, green_api_id, green_api_token, green_api_url")
    .eq("is_active", true);
  return (data ?? []) as WaAccount[];
}

function greenUrl(account: WaAccount, method: string): string {
  return `${account.green_api_url}/waInstance${account.green_api_id}/${method}/${account.green_api_token}`;
}

// ── Types ────────────────────────────────────────────────────────────────────
interface GreenNotification {
  receiptId: number;
  body: {
    typeWebhook: string;
    instanceData?: { idInstance: number; wid: string; typeInstance: string };
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

interface FilterResult {
  action: "skip" | "parse";
  stage: string;
  reason?: string;
  signals?: string[];
}

// ── Monitored groups cache (per invocation — Edge Fn is short-lived) ─────────
let _monitoredGroups: Set<string> | null = null;

async function getMonitoredGroups(): Promise<Set<string>> {
  if (_monitoredGroups) return _monitoredGroups;
  const { data } = await supabase
    .from("groups")
    .select("wa_group_id")
    .eq("status", "active");
  _monitoredGroups = new Set((data ?? []).map((g: { wa_group_id: string }) => g.wa_group_id));
  return _monitoredGroups;
}

// ── Smart Filter (3 stages, ported from wa-listener) ─────────────────────────

// Stage 1: Quick Filter
const MIN_TEXT_LENGTH = 8;
const BOT_PATTERNS = /^(ברוכים הבאים|Welcome|הקבוצה נוצרה|Group created|Admin changed)/i;
const MEDIA_ONLY_PATTERN = /^(📷|🎵|🎥|📎|📄|🎤)?\s*$/;
const EMOJI_ONLY = /^[\p{Emoji}\s]+$/u;
const RESPONSE_PATTERNS = [
  /^k\??$/i, /^(yes|yeah|yep|yea)\b/i, /^interested\b/i, /^i.?ll take/i,
  /^dm\b|^pm\b/i, /^(how much|price|cost)\b/i, /^(available|free)\b/i,
  /^(send|sent)\b/i, /^mine\b/i, /^(אני לוקח|אני רוצה|מעוניין|שלי)/i,
];

function quickFilter(text: string, hasQuote: boolean): FilterResult | null {
  if (hasQuote) return null;
  if (RESPONSE_PATTERNS.some((p) => p.test(text.trim()))) return null;
  if (text.length < MIN_TEXT_LENGTH) return { action: "skip", stage: "quick_filtered", reason: "too_short" };
  if (EMOJI_ONLY.test(text)) return { action: "skip", stage: "quick_filtered", reason: "emoji_only" };
  if (BOT_PATTERNS.test(text)) return { action: "skip", stage: "quick_filtered", reason: "bot_message" };
  if (MEDIA_ONLY_PATTERN.test(text)) return { action: "skip", stage: "quick_filtered", reason: "media_only" };
  return null;
}

// Stage 2: Sender Intelligence
async function senderFilter(groupWaId: string, senderId: string): Promise<FilterResult | null> {
  const { data: group } = await supabase
    .from("groups").select("id").eq("wa_group_id", groupWaId).single();
  if (!group) return null;

  const { data: member } = await supabase
    .from("group_members")
    .select("classification, total_messages, manual_override")
    .eq("group_id", group.id)
    .eq("wa_sender_id", senderId)
    .single();
  if (!member) return null;

  if (member.manual_override) {
    if (member.classification === "seller") return { action: "skip", stage: "sender_filtered", reason: "manual_seller" };
    if (member.classification === "bot") return { action: "skip", stage: "sender_filtered", reason: "manual_bot" };
    return null;
  }
  if (member.classification === "seller" && member.total_messages >= 3) {
    return { action: "skip", stage: "sender_filtered", reason: "known_seller" };
  }
  if (member.classification === "bot") return { action: "skip", stage: "sender_filtered", reason: "known_bot" };
  return null;
}

// Stage 3: Pattern Match
const ZIP_PATTERN = /\b\d{5}\b/;
const STATE_PATTERN = /\b(?:AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY)\b/;

const LOCATION_KEYWORDS = [
  "miami", "fort lauderdale", "hollywood", "boca raton", "aventura", "tampa",
  "orlando", "jacksonville", "palm beach", "coral springs", "pembroke pines",
  "new york", "brooklyn", "queens", "long island", "philadelphia", "pittsburgh", "boston",
  "jersey city", "newark", "atlanta", "charlotte", "nashville", "houston", "dallas",
  "austin", "san antonio", "phoenix", "las vegas", "denver", "salt lake",
  "los angeles", "san diego", "san francisco", "seattle", "portland", "sacramento",
  "orange county", "chicago", "detroit", "cleveland", "columbus", "indianapolis",
  "minneapolis", "st louis", "kansas city",
  "מיאמי", "ניו יורק", "לוס אנג׳לס", "שיקגו", "פילדלפיה", "יוסטון",
  "דאלאס", "אטלנטה", "פיניקס", "דנוור", "סיאטל", "לאס וגאס",
  "פורט לודרדייל", "פלורידה", "טקסס", "קליפורניה", "ניו ג׳רזי", "פנסילבניה",
];

const JOB_KEYWORDS = [
  "מזגן", "מזגנים", "מיזוג", "ac", "hvac", "air duct", "airduct", "air-duct",
  "dryer vent", "dryer-vent", "דרייר", "אייר דאקט", "chimney", "צ׳ימני", "צימני", "ארובה",
  "garage door", "garage", "גראג׳", "גראג", "דלת מוסך", "locksmith", "מנעולן", "car key", "מפתח",
  "גגות", "גג", "roofing", "roof", "shingles", "carpet", "שטיחים", "ניקוי", "ניקיון", "cleaning",
  "שיפוץ", "שיפוצים", "renovation", "remodel", "גדר", "גדרות", "fence", "fencing",
  "plumber", "plumbing", "שרברב", "אינסטלטור", "electrician", "חשמלאי",
  "painting", "צביעה", "tiling", "ריצוף", "landscaping", "גינון", "lawn",
  "kitchen", "מטבח", "bathroom", "אמבטיה", "pool", "בריכה", "moving", "הובלה",
  "repair", "fix", "install", "installation", "תיקון", "התקנה",
  "service call", "google lead", "off track", "thermostat",
];

const BUYER_INTENT = [
  "מחפש", "מחפשת", "צריך", "צריכה", "looking for", "need",
  "מכיר", "מכירה", "ממליץ", "ממליצה", "recommend",
  "הצעת מחיר", "quote", "estimate", "הערכת",
  "מישהו", "someone", "anybody", "anyone", "עזרה", "help",
  "tomorrow", "today", "monday", "tuesday", "wednesday", "thursday", "friday",
  "מחר", "היום",
];

const PHONE_PATTERN = /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}|\b\d{3}-\d{3}-\d{4}\b|\b\d{10}\b/;

function patternMatch(text: string): FilterResult {
  const lower = text.toLowerCase();
  const signals: string[] = [];

  const zipMatch = text.match(ZIP_PATTERN);
  if (zipMatch) signals.push(`zip:${zipMatch[0]}`);
  const stateMatch = text.match(STATE_PATTERN);
  if (stateMatch) signals.push(`state:${stateMatch[0]}`);

  for (const loc of LOCATION_KEYWORDS) {
    if (lower.includes(loc.toLowerCase())) { signals.push(`location:${loc}`); break; }
  }
  for (const job of JOB_KEYWORDS) {
    if (lower.includes(job.toLowerCase())) { signals.push(`job:${job}`); break; }
  }

  let hasBuyerIntent = false;
  for (const intent of BUYER_INTENT) {
    if (lower.includes(intent.toLowerCase())) { signals.push(`intent:${intent}`); hasBuyerIntent = true; break; }
  }

  const hasPhone = PHONE_PATTERN.test(text);
  if (hasPhone) signals.push("has_phone_number");

  // Decision logic
  if (hasPhone && signals.some((s) => s.startsWith("job:")) && !hasBuyerIntent) {
    return { action: "skip", stage: "sender_filtered", reason: "seller_pattern", signals };
  }

  const hasLocation = signals.some((s) => s.startsWith("location:") || s.startsWith("zip:"));
  const hasJob = signals.some((s) => s.startsWith("job:"));

  if ((hasLocation && hasJob) || (hasBuyerIntent && hasJob) || (hasBuyerIntent && hasLocation)) {
    return { action: "parse", stage: "pattern_matched", signals };
  }
  if (signals.length >= 2) return { action: "parse", stage: "pattern_matched", signals };
  if (text.length > 50 && signals.length >= 1) return { action: "parse", stage: "pattern_matched", signals };

  return { action: "skip", stage: "quick_filtered", reason: "no_signals" };
}

async function runSmartFilter(
  text: string, groupId: string, senderId: string, hasQuote: boolean,
): Promise<FilterResult> {
  const quick = quickFilter(text, hasQuote);
  if (quick) return quick;

  const sender = await senderFilter(groupId, senderId);
  if (sender) return sender;

  return patternMatch(text);
}

// ── Group link scanner ───────────────────────────────────────────────────────
const GROUP_LINK_REGEX = /(?:https?:\/\/)?chat\.whatsapp\.com\/([A-Za-z0-9_-]+)/gi;

async function scanForGroupLinks(text: string, groupWaId: string, senderId: string, messageId: string) {
  const matches = [...text.matchAll(GROUP_LINK_REGEX)];
  if (!matches.length) return;

  const { data: group } = await supabase.from("groups").select("id").eq("wa_group_id", groupWaId).single();

  for (const match of matches) {
    const inviteCode = match[1];
    const inviteLink = `https://chat.whatsapp.com/${inviteCode}`;
    try {
      await supabase.rpc("upsert_pending_group", {
        p_invite_link: inviteLink,
        p_invite_code: inviteCode,
        p_source_group_id: group?.id ?? null,
        p_source_wa_sender_id: senderId,
        p_source_wa_message_id: messageId,
      });
    } catch { /* best effort */ }
  }
}

// ── Prospect DM routing (save only, no auto-reply — Rebeca replies via Twilio only) ──
async function routeToProspectChat(body: GreenNotification["body"]) {
  const senderId = body.senderData?.sender ?? body.senderData?.chatId ?? "";
  if (!senderId) return;

  // Skip internal phones
  const { data: waAccounts } = await supabase
    .from("wa_accounts").select("phone_number, internal_phones").eq("is_active", true);
  const internalPhones = new Set<string>();
  for (const acc of waAccounts ?? []) {
    if (acc.phone_number) internalPhones.add(acc.phone_number.replace(/\D/g, "") + "@c.us");
    for (const p of acc.internal_phones ?? []) internalPhones.add(p.replace(/\D/g, "") + "@c.us");
  }
  if (internalPhones.has(senderId)) return;

  const { data: prospect } = await supabase
    .from("prospects").select("id, stage").eq("wa_id", senderId).maybeSingle();
  if (!prospect) return;

  const text = body.messageData?.textMessageData?.textMessage ??
    body.messageData?.extendedTextMessageData?.text ?? "";
  if (!text) return;

  const messageId = body.idMessage ?? `green-${Date.now()}`;

  const { error: msgErr } = await supabase.from("prospect_messages").upsert({
    prospect_id: prospect.id, direction: "incoming", message_type: "text",
    content: text, wa_message_id: messageId,
    sent_at: new Date(body.timestamp * 1000).toISOString(),
  }, { onConflict: "wa_message_id", ignoreDuplicates: true });
  if (msgErr?.code === "23505") return; // already processed

  await supabase.from("prospect_events").insert({
    prospect_id: prospect.id, event_type: "message_received",
    new_value: text.substring(0, 100), detail: { wa_message_id: messageId },
  });

  const updates: Record<string, unknown> = { last_contact_at: new Date().toISOString() };
  if (prospect.stage === "reached_out") {
    updates.stage = "in_conversation";
    await supabase.from("prospect_events").insert({
      prospect_id: prospect.id, event_type: "stage_change",
      old_value: "reached_out", new_value: "in_conversation",
      detail: { reason: "auto_advanced_on_reply" },
    });
  }
  await supabase.from("prospects").update(updates).eq("id", prospect.id);
}

// ── Outgoing DM routing (save messages sent from phone to prospect chat) ──
async function routeOutgoingToProspectChat(body: GreenNotification["body"]) {
  const recipientId = body.senderData?.chatId ?? "";
  if (!recipientId) return;

  const { data: prospect } = await supabase
    .from("prospects").select("id, stage").eq("wa_id", recipientId).maybeSingle();
  if (!prospect) return;

  const text = body.messageData?.textMessageData?.textMessage ??
    body.messageData?.extendedTextMessageData?.text ?? "";
  if (!text) return;

  const messageId = body.idMessage ?? `green-out-${Date.now()}`;

  // Upsert to avoid duplicates — messages sent via CRM are already saved by wa-listener
  const { error: msgErr } = await supabase.from("prospect_messages").upsert({
    prospect_id: prospect.id, direction: "outgoing", message_type: "text",
    content: text, wa_message_id: messageId, channel: "green_api",
    sent_at: new Date(body.timestamp * 1000).toISOString(),
  }, { onConflict: "wa_message_id", ignoreDuplicates: true });
  if (msgErr?.code === "23505") return; // already saved by wa-listener

  await supabase.from("prospects").update({
    last_contact_at: new Date().toISOString(),
  }).eq("id", prospect.id);
}

// ── Handle personal group links ──────────────────────────────────────────────
async function handlePersonalGroupLink(text: string, senderId: string) {
  const matches = [...text.matchAll(GROUP_LINK_REGEX)];
  if (!matches.length) return;

  const phoneDigits = senderId.replace("@c.us", "");
  const phoneE164 = "+" + phoneDigits;
  const { data: profile } = await supabase
    .from("profiles").select("id")
    .or(`whatsapp_phone.eq.${phoneE164},phone.eq.${phoneE164}`)
    .maybeSingle();

  for (const match of matches) {
    const inviteCode = match[1];
    const inviteLink = `https://chat.whatsapp.com/${inviteCode}`;

    if (profile?.id) {
      const { data: existing } = await supabase
        .from("contractor_group_scan_requests")
        .select("id").eq("invite_code", inviteCode).neq("status", "archived").maybeSingle();
      if (!existing) {
        await supabase.from("contractor_group_scan_requests").insert({
          contractor_id: profile.id, invite_link_raw: inviteLink,
          invite_link_normalized: inviteLink, invite_code: inviteCode,
          status: "pending", join_method: "manual",
        });
      }
    }

    try {
      await supabase.rpc("upsert_pending_group", {
        p_invite_link: inviteLink, p_invite_code: inviteCode,
        p_source_wa_sender_id: senderId,
      });
    } catch { /* best effort */ }
  }
}

// ── Pipeline event logger ────────────────────────────────────────────────────
async function logPipelineEvent(
  groupWaId: string, messageId: string | null, senderId: string | null,
  stage: string, detail?: Record<string, unknown>,
) {
  const { data: group } = await supabase
    .from("groups").select("id").eq("wa_group_id", groupWaId).maybeSingle();
  await supabase.from("pipeline_events").insert({
    group_id: group?.id ?? null, wa_message_id: messageId,
    sender_id: senderId, stage, detail: detail ?? {},
  });
}

// ── Update sender stats ──────────────────────────────────────────────────────
async function updateSenderStats(
  groupWaId: string, senderId: string, senderName: string,
  wasLead: boolean, hasPhone: boolean,
) {
  const { data: group } = await supabase
    .from("groups").select("id").eq("wa_group_id", groupWaId).maybeSingle();
  if (!group) return;

  const { data: existing } = await supabase
    .from("group_members")
    .select("id, total_messages, lead_messages, service_messages, classification, manual_override")
    .eq("group_id", group.id).eq("wa_sender_id", senderId).single();

  if (existing) {
    const newTotal = existing.total_messages + 1;
    const newLeads = existing.lead_messages + (wasLead ? 1 : 0);
    const newServices = existing.service_messages + (hasPhone ? 1 : 0);

    let newClassification = existing.classification;
    if (!existing.manual_override && newTotal >= 3) {
      const serviceRatio = newServices / newTotal;
      if (serviceRatio >= 0.6) newClassification = "seller";
      else if (newTotal >= 10 && serviceRatio >= 0.5) newClassification = "seller";
    }

    await supabase.from("group_members").update({
      total_messages: newTotal, lead_messages: newLeads, service_messages: newServices,
      display_name: senderName, last_seen_at: new Date().toISOString(),
      classification: newClassification,
    }).eq("id", existing.id);
  } else {
    const { error } = await supabase.from("group_members").insert({
      group_id: group.id, wa_sender_id: senderId, display_name: senderName,
      total_messages: 1, lead_messages: wasLead ? 1 : 0,
      service_messages: hasPhone ? 1 : 0, classification: "unknown",
      last_seen_at: new Date().toISOString(),
    });
    if (error?.code === "23505") {
      await supabase.from("group_members").update({
        total_messages: 1, lead_messages: wasLead ? 1 : 0,
        service_messages: hasPhone ? 1 : 0, display_name: senderName,
        last_seen_at: new Date().toISOString(),
      }).eq("group_id", group.id).eq("wa_sender_id", senderId);
    }
  }
}

// ── Dedup using job_queue UNIQUE constraint ──────────────────────────────────
function createDedupKey(messageId: string): string {
  return `msg:${messageId}`;
}

// ── Process a single Green API notification ──────────────────────────────────
async function processNotification(notif: GreenNotification, account: WaAccount): Promise<string> {
  const { body } = notif;

  // Handle state changes
  if (body.typeWebhook === "stateInstanceChanged") {
    const state = body.stateInstance;
    const statusMap: Record<string, string> = {
      authorized: "connected", notAuthorized: "disconnected",
      blocked: "blocked", yellowCard: "yellow_card",
    };
    const dbStatus = statusMap[state ?? ""] ?? state ?? "unknown";
    await supabase.from("wa_accounts")
      .update({ status: dbStatus, ...(state === "authorized" ? { connected_since: new Date().toISOString() } : {}) })
      .eq("green_api_id", account.green_api_id);
    return `state:${state}`;
  }

  // ── Outgoing messages (sent from phone or API) → save to prospect chat ──
  if (body.typeWebhook === "outgoingMessageReceived" || body.typeWebhook === "outgoingAPIMessageReceived") {
    const recipientChatId = body.senderData?.chatId ?? "";
    if (!recipientChatId || !recipientChatId.endsWith("@c.us")) return "outgoing_skip";
    await routeOutgoingToProspectChat(body);
    return "outgoing_dm_routed";
  }

  if (body.typeWebhook !== "incomingMessageReceived") return "ignored";

  const chatId = body.senderData?.chatId;
  if (!chatId) return "no_chat_id";

  // ── Personal DMs ──────────────────────────────────────────────────────
  if (chatId.endsWith("@c.us")) {
    const dmText = body.messageData?.textMessageData?.textMessage ??
      body.messageData?.extendedTextMessageData?.text ?? "";
    if (dmText && GROUP_LINK_REGEX.test(dmText)) {
      GROUP_LINK_REGEX.lastIndex = 0;
      await handlePersonalGroupLink(dmText, body.senderData?.sender ?? "");
    }
    await routeToProspectChat(body);
    return "dm_routed";
  }

  if (!chatId.endsWith("@g.us")) return "not_group";

  // Only monitored groups
  const groups = await getMonitoredGroups();
  if (!groups.has(chatId)) return "not_monitored";

  // Extract text
  const text = body.messageData?.textMessageData?.textMessage ??
    body.messageData?.extendedTextMessageData?.text;
  if (!text) return "no_text";

  const messageId = body.idMessage ?? `green-${Date.now()}`;
  const quotedMessageId = body.messageData?.extendedTextMessageData?.stanzaId ?? null;
  const quotedText = body.messageData?.extendedTextMessageData?.quotedMessage?.textMessage ?? null;
  const senderId = body.senderData?.sender ?? "";
  const senderName = body.senderData?.senderName ?? body.senderData?.senderContactName ?? senderId;

  // Scan for group invite links
  await scanForGroupLinks(text, chatId, senderId, messageId);

  // Log "received"
  await logPipelineEvent(chatId, messageId, senderId, "received", {
    groupName: body.senderData?.chatName, textLength: text.length,
  });

  // Smart Filter
  const filterResult = await runSmartFilter(text, chatId, senderId, !!quotedMessageId);

  const hasPhone = PHONE_PATTERN.test(text);
  await updateSenderStats(chatId, senderId, senderName, filterResult.action === "parse", hasPhone);

  if (filterResult.action === "skip") {
    await logPipelineEvent(chatId, messageId, senderId, filterResult.stage, {
      reason: filterResult.reason, signals: filterResult.signals,
      text: text.slice(0, 500),
    });
    return `filtered:${filterResult.reason}`;
  }

  // Passed filter → enqueue to job_queue
  await logPipelineEvent(chatId, messageId, senderId, "pattern_matched", {
    signals: filterResult.signals,
  });

  const { data: jobId } = await supabase.rpc("enqueue_job", {
    p_queue: "raw_messages",
    p_payload: {
      messageId, groupId: chatId, body: text, sender: senderName,
      senderId, timestamp: body.timestamp, accountId: account.id,
      quotedMessageId, quotedText,
    },
    p_dedup_key: createDedupKey(messageId),
    p_max_attempts: 3,
  });

  if (!jobId) {
    await logPipelineEvent(chatId, messageId, senderId, "dedup_hit");
    return "dedup_hit";
  }

  await logPipelineEvent(chatId, messageId, senderId, "enqueued", {
    signals: filterResult.signals, source: "edge",
  });

  return "enqueued";
}

// ── Poll a single account for up to N notifications ─────────────────────────
const MAX_PER_ACCOUNT = 10;

async function pollAccount(account: WaAccount): Promise<string[]> {
  const results: string[] = [];

  for (let i = 0; i < MAX_PER_ACCOUNT; i++) {
    try {
      const res = await fetch(greenUrl(account, "receiveNotification") + "?receiveTimeout=5");

      if (!res.ok) {
        console.error(`[poll-greenapi][${account.green_api_id}] receiveNotification error: ${res.status}`);
        break;
      }

      const text = await res.text();
      if (!text || text === "null") break;

      const notif: GreenNotification = JSON.parse(text);
      if (!notif?.receiptId) break;

      const result = await processNotification(notif, account).catch((err) => {
        console.error(`[poll-greenapi][${account.green_api_id}] process error:`, err);
        return "error";
      });
      results.push(`${account.green_api_id}:${result}`);

      // Only delete from Green API if processing succeeded — don't lose messages on errors
      if (result !== "error") {
        const delRes = await fetch(
          greenUrl(account, "deleteNotification") + `/${notif.receiptId}`,
          { method: "DELETE" },
        );
        if (!delRes.ok) {
          console.warn(`[poll-greenapi][${account.green_api_id}] delete ${notif.receiptId} failed: ${delRes.status}`);
        }
      } else {
        console.warn(`[poll-greenapi][${account.green_api_id}] skipping delete for receipt ${notif.receiptId} due to processing error`);
        break; // Stop polling this account to avoid stuck loop on persistent errors
      }
    } catch (err) {
      console.error(`[poll-greenapi][${account.green_api_id}] poll error:`, err);
      break;
    }
  }

  return results;
}

// ── Main handler ────────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === "GET") {
    return new Response(JSON.stringify({ status: "ok", service: "poll-greenapi" }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const accounts = await getActiveAccounts();
  if (!accounts.length) {
    return new Response(JSON.stringify({ error: "no_active_accounts" }), { status: 500 });
  }

  // Poll all accounts in parallel
  const allResults = await Promise.all(accounts.map((acc) => pollAccount(acc)));
  const results = allResults.flat();

  return new Response(
    JSON.stringify({ processed: results.length, accounts: accounts.length, results }),
    { headers: { "Content-Type": "application/json" } },
  );
});
