import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

// ── Supabase + Twilio clients ───────────────────────────────────────────────

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

// Secrets loaded lazily via RPC (not env vars) — matches production pattern
let TWILIO_SID = '', TWILIO_TOKEN = '', TWILIO_FROM = '', OPENAI_KEY_OVERRIDE = '';
let _secretsLoaded = false;

async function loadSecrets() {
  if (_secretsLoaded) return;
  const { data, error } = await supabase.rpc('get_twilio_secrets');
  if (error || !data) {
    console.error('[secrets] FATAL: Failed to load secrets:', error);
    return; // Do NOT mark as loaded — retry on next call
  }
  TWILIO_SID = data.TWILIO_ACCOUNT_SID || '';
  TWILIO_TOKEN = data.TWILIO_AUTH_TOKEN || '';
  TWILIO_FROM = data.TWILIO_WA_FROM || '';
  OPENAI_KEY_OVERRIDE = data.OPENAI_API_KEY || '';
  if (!TWILIO_SID) {
    console.error('[secrets] FATAL: TWILIO_ACCOUNT_SID is empty after loading');
    return;
  }
  _secretsLoaded = true;
  console.log('[secrets] loaded, SID=' + TWILIO_SID.substring(0, 6) + '...');
}

function getTwilioUrl() {
  return `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`;
}
function getTwilioAuth() {
  return 'Basic ' + btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`);
}

// ── Content Template SIDs (Quick Reply Buttons + CTA) ───────────────────────
const CONTENT = {
  CHECKIN:          Deno.env.get('TWILIO_CONTENT_CHECKIN')          ?? 'HXbc2002314b4ccc42d9516b1e8fa39729',
  LEAD_NOTIFY:      Deno.env.get('TWILIO_CONTENT_LEAD_NOTIFY')      ?? 'HX4ea56861f3586e6a3b6a00d2c04c013f',
  LEAD_CONTACT:     Deno.env.get('TWILIO_CONTENT_LEAD_CONTACT')     ?? 'HXa91e18851fb81ed12e3de7c334c3218a',
  CONFIRM_PROFILE:  Deno.env.get('TWILIO_CONTENT_CONFIRM_PROFILE')  ?? 'HXbfa6868f49ff1a3813767ab1005b57db',
  WELCOME:          Deno.env.get('TWILIO_CONTENT_WELCOME_CONNECTED') ?? 'HXc09a10abda5b602d9a02ac0df544f7aa',
  PAUSE_RESUME:     Deno.env.get('TWILIO_CONTENT_PAUSE_RESUME')     ?? 'HX7ee31519a4a677c64ed866bff6846462',
  MENU_LIST:        Deno.env.get('TWILIO_CONTENT_MENU_LIST')        ?? 'HXc4b6dadf3ec8b8f70b154a596d6fca22',
  LEAD_NOTIFY_BTN:  Deno.env.get('TWILIO_CONTENT_LEAD_NOTIFY_BTN')  ?? 'HXadf35e4a23ae35e016827f23fde8e2d9',
  LEAD_CLAIMED:     Deno.env.get('TWILIO_CONTENT_LEAD_CLAIMED')     ?? 'HX7b3697cc66e30d95904dd30e7ec5fb79',
  // Broadcast system templates (SIDs filled after running setup-twilio-broadcast-templates.js)
  BROADCAST_NOTIFY:   Deno.env.get('TWILIO_CONTENT_BROADCAST_NOTIFY')   ?? 'HX65b6f4255de50f056add8a1e58b81881',
  BROADCAST_INTEREST: Deno.env.get('TWILIO_CONTENT_BROADCAST_INTEREST') ?? 'HXe17599d4d5a2405eb0a8c8aa5e9794a7',
  BROADCAST_CHOSEN:   Deno.env.get('TWILIO_CONTENT_BROADCAST_CHOSEN')   ?? 'HXe3ef47c713bfa9c739aa75864801e52e',
  BROADCAST_CLOSED:   Deno.env.get('TWILIO_CONTENT_BROADCAST_CLOSED')   ?? 'HXb13bcbd71187d719cc79df427da86612',
  CONTRACTOR_INVITE:  Deno.env.get('TWILIO_CONTENT_CONTRACTOR_INVITE')  ?? 'HX344261bdd6e219674f350ce662326e28',
};

// ── Phone normalization (single source of truth) ────────────────────────────
function normalizePhone(raw: string): string {
  const cleaned = raw.replace('whatsapp:', '').replace(/\s/g, '');
  return cleaned.startsWith('+') ? cleaned : '+' + cleaned;
}

// ── Redis-like state via Supabase (Edge Functions can't use Redis) ──────────
// We use a simple key-value approach with the profiles table metadata
// For onboarding state, we store in a lightweight table or use Supabase Realtime
// For MVP: onboarding state stored in a separate table

// ── Constants ───────────────────────────────────────────────────────────────

const POSITIVE_WORDS = ['כן', 'yes', 'yeah', 'yep', 'y', 'ok', 'אוקי', 'זמין', 'available', 'sure', 'בטח', 'כמובן', '👍', 'yea', 'ya', 'ken', 'betach'];
const NEGATIVE_WORDS = ['off', 'skip', 'no', 'לא', 'not'];
const MENU_TRIGGERS = ['menu', 'help', 'תפריט'];

// ── Publish intent detection ───────────────────────────────────────────────
const PUBLISH_TRIGGERS_EN = ['publish a job', 'post a job', 'i have a job', 'distribute a job', 'have a lead'];
const PUBLISH_TRIGGERS_HE = ['יש לי עבודה', 'רוצה לפרסם', 'לפרסם עבודה', 'לפרסם ליד', 'לפרסם'];

function isPublishIntent(text: string): boolean {
  const lower = text.toLowerCase().trim();
  return PUBLISH_TRIGGERS_EN.some(t => lower.includes(t))
    || PUBLISH_TRIGGERS_HE.some(t => lower.includes(t));
}

// ── Language detection ──────────────────────────────────────────────────────
function detectLanguage(text: string): 'he' | 'en' {
  const hebrewChars = (text.match(/[\u0590-\u05FF]/g) || []).length;
  return hebrewChars > text.length * 0.2 ? 'he' : 'en';
}

// ── Sync onboarding step → prospect sub_status ──────────────────────────────
async function syncOnboardStep(phone: string, step: string) {
  await supabase.from('prospects').update({
    sub_status: step,
    sub_status_changed_at: new Date().toISOString(),
  }).eq('phone', phone);
}

// ── Group link detection ─────────────────────────────────────────────────────
const GROUP_LINK_RE = /https?:\/\/chat\.whatsapp\.com\/([A-Za-z0-9]{10,30})/;

function extractGroupLink(text: string): { url: string; inviteCode: string } | null {
  const m = text.match(GROUP_LINK_RE);
  if (!m) return null;
  return { url: m[0], inviteCode: m[1] };
}

async function handleGroupLink(phone: string, text: string, userId?: string | null): Promise<boolean> {
  const link = extractGroupLink(text);
  if (!link) return false;

  // Check if already submitted
  const { data: existing } = await supabase
    .from('contractor_group_scan_requests')
    .select('id')
    .eq('invite_code', link.inviteCode)
    .neq('status', 'archived')
    .maybeSingle();

  if (existing) {
    await sendText(phone, `👍 This group was already submitted! We'll process it soon.`);
    return true;
  }

  // Find contractor_id — either from userId or by phone lookup
  let contractorId = userId;
  if (!contractorId) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('whatsapp_phone', phone)
      .maybeSingle();
    contractorId = profile?.id ?? null;
    if (!contractorId) {
      const { data: profileByPhone } = await supabase
        .from('profiles')
        .select('id')
        .eq('phone', phone)
        .maybeSingle();
      contractorId = profileByPhone?.id ?? null;
    }
  }

  if (!contractorId) {
    await sendText(phone, `Thanks for sharing! Please complete your registration first so we can save this group for you.`);
    return true;
  }

  // Save to contractor_group_scan_requests
  await supabase.from('contractor_group_scan_requests').insert({
    contractor_id: contractorId,
    invite_link_raw: link.url,
    invite_link_normalized: `https://chat.whatsapp.com/${link.inviteCode}`,
    invite_code: link.inviteCode,
    status: 'pending',
    join_method: 'manual',
  });

  await sendText(phone, `✅ *Group saved!*\n\nOur team will review and join this group to find leads for you.\n\nYou can send more group links anytime!`);
  console.log(`[groups] Saved group link from ${phone}: ${link.inviteCode}`);
  return true;
}

// ── Twilio signature verification ───────────────────────────────────────────
// Verifies the X-Twilio-Signature header using HMAC-SHA1 and the auth token.
// See: https://www.twilio.com/docs/usage/security#validating-requests

async function verifyTwilioSignature(
  req: Request,
  body: Record<string, string>,
  authToken: string,
): Promise<boolean> {
  const signature = req.headers.get('x-twilio-signature');
  if (!signature) return false;

  // Use an explicit webhook URL env var if set (recommended for production),
  // otherwise fall back to the request URL.
  const url = Deno.env.get('TWILIO_WEBHOOK_URL')
    || 'https://zyytzwlvtuhgbjpalbgd.supabase.co/functions/v1/whatsapp-webhook';

  // Sort POST params alphabetically and append key+value to the URL
  const sortedParams = Object.keys(body)
    .sort()
    .reduce((acc, key) => acc + key + body[key], '');
  const data = url + sortedParams;

  // HMAC-SHA1
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(authToken),
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  const computed = btoa(String.fromCharCode(...new Uint8Array(sig)));

  // Constant-time comparison to prevent timing attacks
  if (computed.length !== signature.length) return false;
  const encoder2 = new TextEncoder();
  const a = encoder2.encode(computed);
  const b = encoder2.encode(signature);
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a[i] ^ b[i];
  }
  return result === 0;
}

// ── Main handler ────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'GET') {
    return new Response(JSON.stringify({ status: 'ok', service: 'whatsapp-webhook', version: '2.0' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  // Load secrets from DB (lazy, cached after first call)
  await loadSecrets();
  if (!TWILIO_SID) {
    console.error('[webhook] No Twilio secrets found');
    return twiml();
  }

  try {
    // Parse form data into a plain object for both signature verification and field access
    const formData = await req.formData();
    const params: Record<string, string> = {};
    formData.forEach((value, key) => {
      params[key] = value as string;
    });

    // ── Twilio signature verification ──────────────────────────────────────
    // Skip verification only if TWILIO_AUTH_TOKEN is not set (local dev).
    // In production this env var MUST be set.
    if (TWILIO_TOKEN) {
      const isValid = await verifyTwilioSignature(req, params, TWILIO_TOKEN);
      if (!isValid) {
        console.error('[webhook] Twilio signature verification FAILED');
        return new Response('Forbidden', { status: 403 });
      }
      console.log('[webhook] Twilio signature verified');
    } else {
      console.warn('[webhook] TWILIO_AUTH_TOKEN not set — signature verification SKIPPED (dev mode only)');
    }

    const from = params['From'] ?? '';
    let body = params['Body'] ?? '';
    const messageSid = params['MessageSid'] ?? '';
    const buttonPayload = params['ButtonPayload'] ?? '';
    const numMedia = parseInt(params['NumMedia'] ?? '0', 10);

    // ── Twilio status callback (delivery receipts) ──
    const smsStatus = params['SmsStatus'] ?? params['MessageStatus'] ?? '';
    if (smsStatus && !body && !buttonPayload) {
      const toPhone = normalizePhone(params['To'] ?? '');
      if (toPhone && ['sent', 'delivered', 'read', 'failed', 'undelivered'].includes(smsStatus)) {
        await supabase.rpc('update_reached_out_status', { p_phone: toPhone, p_twilio_status: smsStatus });
        // Also update nudge_log if this is a nudge message
        if (smsStatus === 'delivered') {
          await supabase.from('nudge_log').update({ delivered_at: new Date().toISOString(), status: 'delivered' }).eq('twilio_sid', messageSid);
        } else if (smsStatus === 'read') {
          await supabase.from('nudge_log').update({ read_at: new Date().toISOString(), status: 'read' }).eq('twilio_sid', messageSid);
        }
      }
      return twiml();
    }
    const mediaUrl = params['MediaUrl0'] ?? '';
    const mediaType = params['MediaContentType0'] ?? '';

    console.log(`[webhook] numMedia=${numMedia}, mediaType=${mediaType}, hasBody=${!!body}`);

    // ── Voice message transcription ──
    if (numMedia > 0 && mediaUrl && (mediaType.startsWith('audio/') || mediaType === 'audio/ogg; codecs=opus') && !body) {
      try {
        console.log(`[webhook] Voice message detected: ${mediaType}, URL: ${mediaUrl.substring(0, 60)}...`);
        const audioRes = await fetch(mediaUrl, {
          headers: { 'Authorization': 'Basic ' + btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`) },
        });
        console.log(`[webhook] Audio download: ${audioRes.status}, size=${audioRes.headers.get('content-length')}`);
        if (audioRes.ok) {
          const audioBlob = await audioRes.blob();
          const whisperForm = new FormData();
          whisperForm.append('file', new File([audioBlob], 'voice.ogg', { type: 'audio/ogg' }));
          whisperForm.append('model', 'whisper-1');
          // Hint language for better accuracy — Hebrew for IL numbers, English default
          const fromPhone = params['From'] ?? '';
          if (fromPhone.includes('+972')) {
            whisperForm.append('language', 'he');
          }

          const openaiKey = OPENAI_KEY_OVERRIDE || Deno.env.get('OPENAI_API_KEY') || '';
          console.log(`[webhook] Sending to Whisper, key=${openaiKey ? 'present' : 'MISSING'}`);

          const whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${openaiKey}` },
            body: whisperForm,
          });
          if (whisperRes.ok) {
            const whisperData = await whisperRes.json();
            body = whisperData.text || '';
            console.log(`[webhook] Transcribed: "${body.substring(0, 100)}"`);
          } else {
            const errText = await whisperRes.text();
            console.error(`[webhook] Whisper failed: ${whisperRes.status} — ${errText}`);
          }
        }
      } catch (err) {
        console.error('[webhook] Transcription error:', err);
      }
      // If transcription failed, ask user to type instead
      if (!body) {
        const phone = normalizePhone(from);
        if (phone) {
          await sendText(phone, `לא הצלחתי להבין את ההודעה הקולית. תכתוב בבקשה? ✏️`);
        }
        return twiml();
      }
    }

    const phone = normalizePhone(from);
    const text = body.trim();
    const textLower = text.toLowerCase();

    console.log(`[webhook] phone=${phone}, text=${text.substring(0, 50)}, button=${buttonPayload}, sid=${messageSid}`);

    if (!phone) {
      return twiml();
    }

    // Handle empty messages (voice notes that Twilio can't forward, images, etc.)
    if (!text && !buttonPayload) {
      // Check if user is in onboarding
      const { data: onboardState } = await supabase.from('wa_onboard_state').select('step').eq('phone', phone).maybeSingle();
      if (onboardState) {
        await sendText(phone, `כרגע אני יודע לקרוא רק טקסט. תכתוב בבקשה? ✏️`);
      }
      return twiml();
    }

    // Route message (button payloads take priority over text)
    await routeMessage(phone, text, textLower, buttonPayload);
  } catch (err) {
    console.error('[webhook] Error:', err);
  }

  return twiml();
});

// ── Router ──────────────────────────────────────────────────────────────────

async function routeMessage(phone: string, text: string, textLower: string, buttonPayload: string): Promise<void> {
  // NOTE: When resetting a prospect (e.g. for re-onboarding), you MUST also clear
  // their wa_onboard_state row: DELETE FROM wa_onboard_state WHERE phone = '+972...';
  // Otherwise the old onboarding state will conflict with the new flow.

  // Resolve prospect for message logging (creates if needed)
  const prospectId = await findOrCreateProspect(phone);

  // Log incoming message + update last inbound timestamp (for nudge suppression)
  if (prospectId && text) {
    logMessage(prospectId, 'incoming', text);
    supabase.from('prospects').update({ last_wa_inbound_at: new Date().toISOString() })
      .eq('id', prospectId).then(() => {});
  }

  // 0. Handle button payloads first (from Quick Reply clicks)
  if (buttonPayload) {
    if (prospectId && !text) {
      logMessage(prospectId, 'incoming', `[Button: ${buttonPayload}]`);
    }
    await handleButtonPayload(phone, buttonPayload, text, prospectId);
    return;
  }

  // 1. Check for account connection code (LE-{userId prefix})
  const codeMatch = text.match(/LE-([a-f0-9]{8})/i);
  if (codeMatch) {
    await handleConnectionCode(phone, codeMatch[1]);
    return;
  }

  // 2. Check for WhatsApp group link (anytime — works for all users)
  if (GROUP_LINK_RE.test(text)) {
    // Don't intercept if user is in onboarding groups step (handled by onboardGroups)
    const { data: obCheck } = await supabase
      .from('wa_onboard_state')
      .select('step')
      .eq('phone', phone)
      .maybeSingle();
    if (!obCheck || obCheck.step !== 'groups') {
      const handled = await handleGroupLink(phone, text);
      if (handled) return;
    }
  }

  // 3. Check if user has onboarding state
  const { data: onboardState } = await supabase
    .from('wa_onboard_state')
    .select('*')
    .eq('phone', phone)
    .maybeSingle();

  if (onboardState) {
    await handleOnboardingStep(phone, text, textLower, onboardState);
    return;
  }

  // 3. Check if this is a known user
  const profile = await findProfile(phone);

  if (!profile) {
    // Unknown user — try matching by phone field
    const profileByPhone = await findProfileByPhone(phone);
    if (!profileByPhone) {
      // ── NO PROFILE → SALES AGENT ──
      console.log(`[sales] No profile for ${phone}, routing to Sales Agent`);

      // Update prospect stage to in_conversation — but only if they're not already further along (demo_trial, paying, etc.)
      if (prospectId) {
        const { data: currentProspect } = await supabase.from('prospects').select('stage').eq('id', prospectId).maybeSingle();
        const preserveStages = ['demo_trial', 'paying', 'churned', 'declined'];
        if (!currentProspect?.stage || !preserveStages.includes(currentProspect.stage)) {
          await supabase.from('prospects')
            .update({ stage: 'in_conversation', last_contact_at: new Date().toISOString() })
            .eq('id', prospectId);
        } else {
          await supabase.from('prospects')
            .update({ last_contact_at: new Date().toISOString() })
            .eq('id', prospectId);
        }
      }

      const lang = detectLanguage(text);

      // Send a one-time greeting for brand-new prospects (first ever message)
      if (prospectId) {
        const { count: msgCount } = await supabase
          .from('prospect_messages')
          .select('id', { count: 'exact', head: true })
          .eq('prospect_id', prospectId);
        // msgCount <= 1 because the current inbound message was already logged above
        if ((msgCount ?? 0) <= 1) {
          const greeting = lang === 'he'
            ? 'היי! 👋 אני רבקה מ-LeadExpress.\nאנחנו עוזרים לקבלנים למצוא עבודות חדשות כל יום.\n\nרוצה לשמוע איך? תכתוב "כן" ואספר 😊'
            : 'Hey! 👋 I\'m Rebeca from LeadExpress.\nWe help contractors find new jobs every day.\n\nWant to hear how? Just say "yes" 😊';
          await sendText(phone, greeting, prospectId);
          console.log(`[sales] Sent first-time greeting to ${phone} (lang=${lang})`);
          return;
        }
      }

      // Route to AI Sales Agent (handles questions, sells, handoffs to onboarding)
      await handleAIForProspect(phone, text, prospectId, lang);
      return;
    }
    // Link WhatsApp and continue
    await supabase.from('profiles').update({ whatsapp_phone: phone }).eq('id', profileByPhone.id);
    await handleKnownUser(phone, text, textLower, profileByPhone, prospectId);
    return;
  }

  await handleKnownUser(phone, text, textLower, profile, prospectId);
}

// ── Button Payload Router ───────────────────────────────────────────────────

async function handleButtonPayload(phone: string, payload: string, _text: string, prospectId: string | null = null): Promise<void> {
  // Allow onboarding buttons for prospect-only users (no profile required)
  if (payload === 'confirm_yes' || payload === 'confirm_redo') {
    const { data: onboardState } = await supabase
      .from('wa_onboard_state')
      .select('*')
      .eq('phone', phone)
      .eq('step', 'confirm')
      .maybeSingle();
    if (onboardState) {
      await onboardConfirm(phone, payload === 'confirm_yes' ? 'yes' : 'redo', onboardState.data as Record<string, unknown>);
      return;
    }
  }

  // ── Marketing button payloads (prospects without profile) ──
  if (payload === 'start_trial') {
    console.log(`[sales] Prospect ${phone} clicked START TRIAL`);
    if (prospectId) {
      await supabase.from('prospects')
        .update({ stage: 'onboarding', last_contact_at: new Date().toISOString() })
        .eq('id', prospectId);
    }
    // Detect language from phone prefix: +972 = Hebrew, +1 = English
    const lang: 'he' | 'en' = phone.startsWith('+972') ? 'he' : 'en';
    await supabase.from('wa_onboard_state').upsert({
      phone,
      step: 'first_name',
      data: { prospectId, userId: null, firstName: '', professions: [], cities: [], zipCodes: [], state: '', workingDays: [1,2,3,4,5], language: lang },
      updated_at: new Date().toISOString(),
    });
    await syncOnboardStep(phone, 'first_name');
    if (lang === 'he') {
      await sendText(phone, `מעולה! 🚀 בוא נתחיל — לוקח דקה.\n\n*מה השם המלא שלך?*`);
    } else {
      await sendText(phone, `Awesome! 🚀 Let's get started — takes 60 seconds.\n\n*What's your full name?*`);
    }
    return;
  }

  if (payload === 'not_interested' || payload === 'opt_out') {
    console.log(`[sales] Prospect ${phone} not interested`);
    if (prospectId) {
      await supabase.from('prospects')
        .update({ stage: payload === 'opt_out' ? 'churned' : 'declined', last_contact_at: new Date().toISOString() })
        .eq('id', prospectId);
    }
    await sendText(phone, `בסדר גמור! אם תשנה דעתך תשלח הודעה 🤝`);
    return;
  }

  const profile = await findProfile(phone) ?? await findProfileByPhone(phone);
  if (!profile) {
    // Unknown user clicked a button but has no profile — route to sales
    await handleAIForProspect(phone, _text || payload, prospectId, detectLanguage(_text || payload));
    return;
  }

  switch (payload) {
    case 'checkin_yes': {
      const windowUntil = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      await supabase
        .from('contractors')
        .update({ available_today: true, wa_window_until: windowUntil })
        .eq('user_id', profile.id);
      await sendText(phone, `✅ You're live! Leads will come through today.`);
      console.log(`[checkin] ${profile.id} available (button)`);
      break;
    }

    case 'checkin_no': {
      await supabase
        .from('contractors')
        .update({ available_today: false })
        .eq('user_id', profile.id);
      await sendText(phone, `👍 Got it, enjoy your day off!`);
      console.log(`[checkin] ${profile.id} off (button)`);
      break;
    }

    case 'claim_lead': {
      // Retrieve pending lead context
      const { data: leadCtx } = await supabase
        .from('wa_onboard_state')
        .select('data')
        .eq('phone', phone)
        .eq('step', 'lead_pending')
        .maybeSingle();

      if (leadCtx?.data) {
        const ctx = leadCtx.data as { leadId: string; senderPhone: string; profession: string; city: string };
        await supabase.from('wa_onboard_state').delete().eq('phone', phone).eq('step', 'lead_pending');
        await handleClaim(phone, ctx.leadId, profile.id, ctx.senderPhone, ctx.profession, ctx.city);
      } else {
        await sendText(phone, `No pending lead found. You may have already claimed or passed it.`);
      }
      break;
    }

    case 'pass_lead': {
      const { data: passCtx } = await supabase
        .from('wa_onboard_state')
        .select('data')
        .eq('phone', phone)
        .eq('step', 'lead_pending')
        .maybeSingle();

      if (passCtx?.data) {
        const ctx = passCtx.data as { leadId: string };
        await supabase.from('wa_onboard_state').delete().eq('phone', phone).eq('step', 'lead_pending');
        await handlePass(phone, ctx.leadId, profile.id);
      } else {
        await sendText(phone, `No pending lead to skip.`);
      }
      break;
    }

    /* ── Broadcast system handlers ── */
    case 'broadcast_interested': {
      const { data: bCtx } = await supabase
        .from('wa_onboard_state')
        .select('data')
        .eq('phone', phone)
        .eq('step', 'broadcast_pending')
        .maybeSingle();

      if (!bCtx?.data) {
        await sendText(phone, 'This broadcast is no longer available.');
        break;
      }

      const broadcastId = (bCtx.data as { broadcastId: string }).broadcastId;

      // Find or identify the contractor profile
      const { data: respProfile } = await supabase
        .from('profiles')
        .select('id, full_name, whatsapp_phone')
        .eq('whatsapp_phone', phone)
        .maybeSingle();

      if (!respProfile) {
        await sendText(phone, 'Please register first to respond to job broadcasts.');
        break;
      }

      // Validate broadcast is still open before inserting
      const { data: bCheck } = await supabase
        .from('job_broadcasts')
        .select('status, expires_at, publisher_id')
        .eq('id', broadcastId)
        .single();

      if (!bCheck || bCheck.status !== 'open') {
        await sendText(phone, 'This job is no longer available.');
        break;
      }
      if (new Date(bCheck.expires_at) < new Date()) {
        await sendText(phone, 'This job posting has expired.');
        break;
      }
      if (bCheck.publisher_id === respProfile.id) {
        await sendText(phone, 'You cannot respond to your own broadcast.');
        break;
      }

      // Insert response
      const { error: respErr } = await supabase
        .from('job_broadcast_responses')
        .insert({ broadcast_id: broadcastId, contractor_id: respProfile.id })
        .select()
        .maybeSingle();

      if (respErr && respErr.code !== '23505') { // 23505 = unique violation (already responded)
        await sendText(phone, 'Could not register your interest. Please try again.');
        break;
      }

      // Clean up state
      await supabase.from('wa_onboard_state').delete()
        .eq('phone', phone).eq('step', 'broadcast_pending');

      // Notify the publisher
      const { data: broadcast } = await supabase
        .from('job_broadcasts')
        .select('publisher_id, leads(profession, city)')
        .eq('id', broadcastId)
        .single();

      if (broadcast) {
        const { data: publisher } = await supabase
          .from('profiles')
          .select('whatsapp_phone')
          .eq('id', broadcast.publisher_id)
          .single();

        const { data: cp } = await supabase
          .from('contractor_profiles')
          .select('tier, avg_rating, slug')
          .eq('user_id', respProfile.id)
          .maybeSingle();

        const { data: stats } = await supabase.rpc('calculate_contractor_stats', { p_user_id: respProfile.id });

        if (publisher?.whatsapp_phone && CONTENT.BROADCAST_INTEREST) {
          // Template builds URL as: https://app.leadexpress.co.il/pro/{{5}}
          // So send just the slug, not the full URL
          await sendButtons(publisher.whatsapp_phone, CONTENT.BROADCAST_INTEREST, {
            '1': respProfile.full_name || 'A contractor',
            '2': cp?.tier || 'new',
            '3': String(cp?.avg_rating || '0'),
            '4': String((stats as any)?.job_orders_completed || '0'),
            '5': cp?.slug || respProfile.id,
          });
        }
      }

      await sendText(phone, '✅ Your interest has been registered! The publisher will review your profile and get back to you.');
      break;
    }

    case 'broadcast_pass': {
      await supabase.from('wa_onboard_state').delete()
        .eq('phone', phone).eq('step', 'broadcast_pending');
      await sendText(phone, '👍 No problem. We\'ll send you more opportunities!');
      break;
    }

    case 'confirm_yes': {
      // Trigger confirm in onboarding flow
      const { data: onboardState } = await supabase
        .from('wa_onboard_state')
        .select('*')
        .eq('phone', phone)
        .eq('step', 'confirm')
        .maybeSingle();
      if (onboardState) {
        await onboardConfirm(phone, 'yes', onboardState.data as Record<string, unknown>);
      }
      break;
    }

    case 'confirm_redo': {
      const { data: onboardState } = await supabase
        .from('wa_onboard_state')
        .select('*')
        .eq('phone', phone)
        .eq('step', 'confirm')
        .maybeSingle();
      if (onboardState) {
        await onboardConfirm(phone, 'redo', onboardState.data as Record<string, unknown>);
      }
      break;
    }

    case 'setup_profile': {
      await startOnboarding(phone, profile);
      break;
    }

    case 'show_menu': {
      await handleMenu(phone);
      break;
    }

    case 'pause_leads':
    case 'menu_pause': {
      await handlePauseResume(phone, profile.id, false);
      break;
    }

    case 'resume_leads':
    case 'menu_resume': {
      await handlePauseResume(phone, profile.id, true);
      break;
    }

    // List-picker menu selections
    case 'menu_settings': {
      await handleSettings(phone, profile.id);
      break;
    }

    case 'menu_areas': {
      await startOnboardingStep(phone, profile.id, 'city');
      break;
    }

    case 'menu_trades': {
      await startOnboardingStep(phone, profile.id, 'profession');
      break;
    }

    case 'menu_days': {
      await startOnboardingStep(phone, profile.id, 'working_days');
      break;
    }

    case 'menu_stats': {
      await handleStats(phone, profile.id);
      break;
    }

    default:
      console.log(`[webhook] Unknown button payload: ${payload}`);
      await sendText(phone, `Send *MENU* for options.`);
  }
}

async function handleKnownUser(
  phone: string,
  text: string,
  textLower: string,
  profile: { id: string; full_name: string },
  prospectId: string | null = null,
): Promise<void> {
  // Check subscription (warn but don't block)
  const hasSub = await checkSubscription(profile.id);
  if (!hasSub) {
    await sendText(phone, `Hi ${profile.full_name}! Your subscription has expired.\nVisit masterleadflow.com to renew.\n\nYou can still use the menu and chat below.`);
    // Don't return — allow menu and AI access
  }

  // Check if contractor exists and is set up
  const { data: contractor } = await supabase
    .from('contractors')
    .select('user_id, professions, zip_codes, wa_notify')
    .eq('user_id', profile.id)
    .maybeSingle();

  // Not set up yet — start onboarding
  if (!contractor || contractor.professions.length === 0 || contractor.zip_codes.length === 0) {
    if (!contractor) {
      await supabase.from('contractors').insert({ user_id: profile.id, wa_notify: true });
    } else {
      await supabase.from('contractors').update({ wa_notify: true }).eq('user_id', profile.id);
    }
    await startOnboarding(phone, profile);
    return;
  }

  // Enable WA if not already
  if (!contractor.wa_notify) {
    await supabase.from('contractors').update({ wa_notify: true }).eq('user_id', profile.id);
  }

  // ── Route by message content ──────────────────────────────────────────

  // Dashboard / login request — send magic link
  const LOGIN_TRIGGERS = ['login', 'dashboard', 'כניסה', 'דשבורד', 'התחברות', 'לינק', 'קישור', 'link'];
  if (LOGIN_TRIGGERS.some(t => textLower.includes(t))) {
    await sendDashboardLink(phone, profile.id);
    return;
  }

  // Menu
  if (MENU_TRIGGERS.some(t => textLower === t)) {
    await handleMenu(phone);
    return;
  }

  // Menu selections (1-6 after MENU was shown)
  if (['1', '2', '3', '4', '5', '6'].includes(textLower) && await isMenuContext(phone)) {
    await handleMenuSelection(phone, textLower, profile.id);
    return;
  }

  // Check-in responses — only if user is in a checkin context
  if (isCheckinResponse(textLower) && await isCheckinContext(phone)) {
    await handleCheckin(phone, textLower, profile);
    return;
  }

  // Legacy text-based claim/pass (use buttons instead)
  if (textLower.startsWith('claim:') || textLower.startsWith('pass:')) {
    await sendText(phone, `Use the buttons in the lead notification to claim or pass.`);
    return;
  }

  // Settings shortcut
  if (textLower === 'settings' || textLower === 'status') {
    await handleSettings(phone, profile.id);
    return;
  }

  // Pause/resume shortcuts
  if (textLower === 'stop' || textLower === 'pause') {
    await handlePauseResume(phone, profile.id, false);
    return;
  }
  if (textLower === 'start' || textLower === 'resume') {
    await handlePauseResume(phone, profile.id, true);
    return;
  }

  // Default — AI agent handles free-text messages
  await handleAI(phone, text, profile);
}

// ── Account Connection handler ──────────────────────────────────────────────

async function handleConnectionCode(phone: string, codePrefix: string): Promise<void> {
  // Find user by ID prefix
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name')
    .like('id', `${codePrefix}%`)
    .maybeSingle();

  if (!profile) {
    await sendText(phone, `Invalid connection code. Please try again from your MasterLeadFlow dashboard.`);
    console.log(`[connect] No profile found for code prefix: ${codePrefix}`);
    return;
  }

  // Check if already connected
  const { data: existing } = await supabase
    .from('profiles')
    .select('whatsapp_phone')
    .eq('id', profile.id)
    .single();

  if (existing?.whatsapp_phone) {
    await sendText(phone, `Your account is already connected! 👍\nSend *MENU* for options.`);
    return;
  }

  // Link WhatsApp phone to profile
  await supabase.from('profiles').update({ whatsapp_phone: phone }).eq('id', profile.id);

  const firstName = profile.full_name?.split(' ')[0] ?? 'there';
  await sendButtons(phone, CONTENT.WELCOME, { '1': firstName });

  console.log(`[connect] WhatsApp linked: ${phone} → user ${profile.id}`);
}

// ── Check-in handler ────────────────────────────────────────────────────────

function isCheckinResponse(text: string): boolean {
  return POSITIVE_WORDS.some(w => text.includes(w)) || NEGATIVE_WORDS.some(w => text.includes(w));
}

async function isCheckinContext(phone: string): Promise<boolean> {
  const { data } = await supabase
    .from('wa_onboard_state')
    .select('step')
    .eq('phone', phone)
    .eq('step', 'checkin_pending')
    .maybeSingle();
  return !!data;
}

async function handleCheckin(
  phone: string,
  textLower: string,
  profile: { id: string; full_name: string },
): Promise<void> {
  const isAvailable = POSITIVE_WORDS.some(w => textLower.includes(w));

  if (isAvailable) {
    const windowUntil = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    await supabase
      .from('contractors')
      .update({ available_today: true, wa_window_until: windowUntil })
      .eq('user_id', profile.id);

    await sendText(phone, `✅ You're live! Leads will come through today.`);
    console.log(`[checkin] ${profile.id} available until ${windowUntil}`);
  } else {
    await supabase
      .from('contractors')
      .update({ available_today: false })
      .eq('user_id', profile.id);

    await sendText(phone, `👍 Got it, enjoy your day off!`);
    console.log(`[checkin] ${profile.id} off today`);
  }
}

// ── Menu handler ────────────────────────────────────────────────────────────

async function handleMenu(phone: string): Promise<void> {
  // Send interactive list-picker menu (falls back to text on unsupported channels)
  await sendButtons(phone, CONTENT.MENU_LIST);
}

async function isMenuContext(phone: string): Promise<boolean> {
  const { data } = await supabase
    .from('wa_onboard_state')
    .select('step')
    .eq('phone', phone)
    .eq('step', 'menu')
    .maybeSingle();
  return !!data;
}

async function handleMenuSelection(phone: string, selection: string, userId: string): Promise<void> {
  // Clear menu context
  await supabase.from('wa_onboard_state').delete().eq('phone', phone);

  switch (selection) {
    case '1':
      await handleSettings(phone, userId);
      break;
    case '2':
      await startOnboardingStep(phone, userId, 'city');
      break;
    case '3':
      await startOnboardingStep(phone, userId, 'profession');
      break;
    case '4':
      await startOnboardingStep(phone, userId, 'working_days');
      break;
    case '5':
      await handlePauseToggle(phone, userId);
      break;
    case '6':
      await sendDashboardLink(phone, userId);
      break;
  }
}

// ── Dashboard magic link ─────────────────────────────────────────────────────

async function sendDashboardLink(phone: string, userId: string): Promise<void> {
  try {
    const res = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/magic-login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      },
      body: JSON.stringify({ action: 'generate', user_id: userId, redirect_path: '/' }),
    });
    const data = await res.json();
    if (data.link) {
      await sendText(phone, `📱 *הלינק שלך לדשבורד:*\n\n👉 ${data.link}\n\n_הלינק תקף ל-24 שעות. תלחץ ותיכנס ישירות!_`);
    } else {
      await sendText(phone, `📱 *כניסה לדשבורד:*\n\n👉 https://app.masterleadflow.com/login\n\n_היכנס עם האימייל והסיסמה שהגדרת._`);
    }
  } catch {
    await sendText(phone, `📱 *כניסה לדשבורד:*\n\n👉 https://app.masterleadflow.com/login`);
  }
}

// ── Settings ────────────────────────────────────────────────────────────────

async function handleSettings(phone: string, userId: string): Promise<void> {
  const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', userId).single();
  const { data: contractor } = await supabase.from('contractors').select('professions, zip_codes, wa_notify, working_days').eq('user_id', userId).single();
  const { data: sub } = await supabase.from('subscriptions').select('status, plans!inner(name)').eq('user_id', userId).in('status', ['active', 'trialing']).maybeSingle();

  const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const PROF_EMOJI: Record<string, string> = { hvac: '❄️', renovation: '🔨', fencing: '🧱', cleaning: '✨', locksmith: '🔑', plumbing: '🚰', electrical: '⚡', other: '📋' };

  const profLabels = contractor?.professions?.map((p: string) => `${PROF_EMOJI[p] ?? '📋'} ${p}`).join(', ') ?? 'None';
  const dayLabels = contractor?.working_days?.map((d: number) => DAY_NAMES[d]).join(', ') ?? 'Mon-Fri';
  const planData = sub?.plans as unknown;
  const planName = planData ? (Array.isArray(planData) ? (planData[0] as {name: string})?.name : (planData as {name: string})?.name) : 'Free';
  const statusEmoji = contractor?.wa_notify ? '✅ Active' : '⏸️ Paused';

  await sendText(
    phone,
    `⚙️ *Your Settings*\n\n👤 *Name:* ${profile?.full_name ?? 'N/A'}\n📦 *Plan:* ${planName}\n🔔 *Status:* ${statusEmoji}\n\n🔧 *Trades:* ${profLabels}\n📍 *ZIP codes:* ${contractor?.zip_codes?.length ?? 0}\n📅 *Days:* ${dayLabels}\n\nSend *MENU* to change.`,
  );
}

// ── Pause/Resume ────────────────────────────────────────────────────────────

async function handlePauseResume(phone: string, userId: string, enable: boolean): Promise<void> {
  await supabase.from('contractors').update({ wa_notify: enable }).eq('user_id', userId);
  if (enable) {
    await sendText(phone, `✅ *Leads resumed!* You'll get your next check-in tomorrow.`);
  } else {
    await sendText(phone, `⏸️ *Leads paused.* Send *START* to resume.`);
  }
}

async function handlePauseToggle(phone: string, _userId: string): Promise<void> {
  await sendButtons(phone, CONTENT.PAUSE_RESUME);
}

async function handleStats(phone: string, userId: string): Promise<void> {
  // Count leads by status for this contractor
  const { count: claimed } = await supabase
    .from('leads')
    .select('*', { count: 'exact', head: true })
    .eq('claimed_by', userId)
    .eq('status', 'claimed');

  const { count: total } = await supabase
    .from('leads')
    .select('*', { count: 'exact', head: true })
    .eq('claimed_by', userId);

  const { count: thisWeek } = await supabase
    .from('leads')
    .select('*', { count: 'exact', head: true })
    .eq('claimed_by', userId)
    .gte('claimed_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

  await sendText(
    phone,
    `📊 *Your Stats*\n\n🏆 *Total claimed:* ${total ?? 0}\n✅ *Active leads:* ${claimed ?? 0}\n📅 *This week:* ${thisWeek ?? 0}\n\nSend *MENU* for more options.`,
  );
}

// ── Claim/Pass ──────────────────────────────────────────────────────────────

// ── Send lead notification with buttons ─────────────────────────────────────
// Call this from the lead distribution logic to send a lead with Claim/Pass buttons

const PROF_EMOJI_MAP: Record<string, string> = {
  hvac: '❄️', renovation: '🔨', fencing: '🧱', cleaning: '✨',
  locksmith: '🔑', plumbing: '🚰', electrical: '⚡', other: '📋',
};

async function sendLeadNotification(
  phone: string,
  leadId: string,
  _userId: string,
  profession: string,
  city: string,
  summary: string,
  source?: string,
  senderPhone?: string,
): Promise<void> {
  const emoji = PROF_EMOJI_MAP[profession.toLowerCase()] ?? '📋';
  const profLabel = profession.charAt(0).toUpperCase() + profession.slice(1);
  const cityLabel = city || 'Your area';

  // Step 1: Quick Reply notification with Claim/Pass buttons
  // Button payloads include leadId for routing: "claim_lead:{leadId}"
  await sendButtons(phone, CONTENT.LEAD_NOTIFY, {
    '1': emoji,
    '2': profLabel,
    '3': cityLabel,
    '4': summary || 'New service request',
    '5': source || 'WhatsApp Group',
  });

  // Store lead context for claim/pass handling
  await supabase.from('wa_onboard_state').upsert({
    phone,
    step: 'lead_pending',
    data: { leadId, senderPhone: senderPhone || '', profession: profLabel, city: cityLabel },
    updated_at: new Date().toISOString(),
  });
}

// Step 2: After Claim → send CTA button that opens WhatsApp chat with customer
async function handleClaim(phone: string, leadId: string, userId: string, senderPhone: string, profession: string, city: string): Promise<void> {
  // Claim in DB
  const { data: lead, error } = await supabase
    .from('leads')
    .update({ status: 'claimed', claimed_by: userId, claimed_at: new Date().toISOString() })
    .eq('id', leadId)
    .eq('status', 'sent')
    .select('id')
    .maybeSingle();

  if (error || !lead) {
    await sendText(phone, `This lead has already been claimed or is no longer available.`);
    return;
  }

  if (!senderPhone || senderPhone.length < 8) {
    await sendText(phone, `✅ Lead claimed! Good luck 🤞`);
    return;
  }

  // Build wa.me path (template prepends https://wa.me/)
  const introMsg = encodeURIComponent(
    `Hi! I am a licensed ${profession} contractor reaching out about your request in ${city}. I am available and can help. When works for you?`
  );
  const waPath = `${senderPhone}?text=${introMsg}`;

  // Send CTA button that opens WhatsApp chat directly
  await sendButtons(phone, CONTENT.LEAD_CONTACT, { '1': waPath });
}

async function handlePass(phone: string, leadId: string, userId: string): Promise<void> {
  await supabase.from('pipeline_events').insert({
    stage: 'lead_passed',
    detail: { lead_id: leadId, contractor_id: userId, channel: 'whatsapp' },
  });
  await sendText(phone, `OK, skipped. You'll get the next one! 👍`);
}

// ── Onboarding ──────────────────────────────────────────────────────────────

async function startOnboarding(phone: string, profile: { id: string; full_name: string }): Promise<void> {
  // If user already has a real name (not phone number), skip name step
  const hasRealName = profile.full_name && !profile.full_name.startsWith('+');
  const firstStep = hasRealName ? 'profession' : 'first_name';
  // Detect language from phone prefix: +972 = Hebrew, +1 = English
  const lang: 'he' | 'en' = phone.startsWith('+972') ? 'he' : 'en';

  await supabase.from('wa_onboard_state').upsert({
    phone,
    step: firstStep,
    data: { userId: profile.id, firstName: hasRealName ? profile.full_name.split(' ')[0] : '', professions: [], cities: [], zipCodes: [], state: '', workingDays: [1,2,3,4,5], language: lang },
    updated_at: new Date().toISOString(),
  });

  if (hasRealName) {
    const firstName = profile.full_name.split(' ')[0];
    if (lang === 'he') {
      await sendText(phone,
        `היי ${firstName}! אני רבקה מ-MasterLeadFlow 👋\n\n` +
        `*שלב 1/5* — מה אתה עושה?\n\n` +
        `${PROF_LIST_MSG}\n\n` +
        `✏️ כתוב או 🎙️ הקלט מה המקצוע שלך.`,
      );
    } else {
      await sendText(phone,
        `Hey ${firstName}! I'm Rebeca from MasterLeadFlow 👋\n\n` +
        `*Step 1/5* — What services do you offer?\n\n` +
        `${PROF_LIST_MSG}\n\n` +
        `✏️ Type or 🎙️ record what you do.`,
      );
    }
  } else {
    if (lang === 'he') {
      await sendText(phone,
        `היי! אני רבקה מ-MasterLeadFlow 👋\n\n` +
        `אני מוצאת לידים מקומיים לבעלי מקצוע כמוך.\n` +
        `ההגדרה לוקחת 60 שניות!\n\n` +
        `*מה השם המלא שלך?*`,
      );
    } else {
      await sendText(phone,
        `Hey! I'm Rebeca from MasterLeadFlow 👋\n\n` +
        `I find local job leads for service pros like you.\n` +
        `Setup takes 60 seconds!\n\n` +
        `*What's your full name?*`,
      );
    }
  }
}

async function startOnboardingStep(phone: string, userId: string, step: string): Promise<void> {
  // Load existing contractor data so we don't wipe it
  const { data: existingContractor } = await supabase
    .from('contractors')
    .select('professions, zip_codes, working_days')
    .eq('user_id', userId)
    .maybeSingle();

  await supabase.from('wa_onboard_state').upsert({
    phone,
    step,
    data: {
      userId,
      professions: existingContractor?.professions ?? [],
      cities: [],
      zipCodes: existingContractor?.zip_codes ?? [],
      state: '',
      workingDays: existingContractor?.working_days ?? [1,2,3,4,5],
    },
    updated_at: new Date().toISOString(),
  });

  switch (step) {
    case 'profession':
      await sendText(phone, `🔧 *Update Services*\n\n${PROF_LIST_MSG}\n\n✏️ Type or 🎙️ record what you do.`);
      break;
    case 'city':
      await sendText(phone, `📍 *עדכון אזורים*\n\nבאיזה מדינה אתה עובד?\n\n🌴 Florida\n🗽 New York\n🤠 Texas\n\n✏️ כתוב או 🎙️ הקלט.`);
      break;
    case 'working_days':
      await sendText(phone, `📅 *Working Days*\n\n1️⃣ Mon-Fri\n2️⃣ Every day\n3️⃣ Custom`);
      break;
  }
}

async function handleOnboardingStep(
  phone: string,
  text: string,
  textLower: string,
  state: { step: string; data: Record<string, unknown> },
): Promise<void> {
  // Escape words — let user exit onboarding anytime
  const ESCAPE_WORDS = ['menu', 'help', 'cancel', 'stop', 'תפריט', 'ביטול'];
  if (ESCAPE_WORDS.includes(textLower)) {
    await supabase.from('wa_onboard_state').delete().eq('phone', phone);
    const lang = detectLanguage(text);
    if (lang === 'he') {
      await sendText(phone, `בסדר, יצאנו מההגדרות.\nשלח *MENU* לאפשרויות.`);
    } else {
      await sendText(phone, `OK, exited setup.\nSend *MENU* for options.`);
    }
    await handleMenu(phone);
    return;
  }

  const data = state.data as {
    userId: string;
    professions: string[];
    cities: string[];
    zipCodes: string[];
    state: string;
    workingDays: number[];
    language?: 'he' | 'en';
  };

  switch (state.step) {
    case 'menu':
      // Menu was shown, route selection
      if (['1','2','3','4','5'].includes(textLower)) {
        await supabase.from('wa_onboard_state').delete().eq('phone', phone);
        await handleMenuSelection(phone, textLower, data.userId);
      } else {
        await sendText(phone, `Reply 1-5 to select, or send *MENU* again.`);
      }
      break;

    case 'first_name':
      await onboardFirstName(phone, text, data);
      break;

    case 'profession':
      await onboardProfession(phone, text, data);
      break;

    case 'city_state':
      await onboardCityState(phone, textLower, data);
      break;

    case 'city':
      await onboardCity(phone, textLower, data);
      break;

    case 'working_days':
      await onboardWorkingDays(phone, textLower, data);
      break;

    case 'confirm':
      await onboardConfirm(phone, textLower, data);
      break;

    case 'groups':
      await onboardGroups(phone, text, textLower, data);
      break;

    case 'post_job':
      await handlePostJobMessage(phone, text, state);
      break;

    default:
      await supabase.from('wa_onboard_state').delete().eq('phone', phone);
      await sendText(phone, `Send *MENU* for options.`);
  }
}

// ── Onboarding steps ────────────────────────────────────────────────────────

const PROFESSIONS = ['hvac','air_duct','renovation','plumbing','electrical','painting','roofing','flooring','fencing','cleaning','locksmith','landscaping','chimney','garage_doors','security','windows','other'];
const PROF_LABELS: Record<string, string> = { hvac:'❄️ HVAC & AC', air_duct:'💨 Air Duct Cleaning', renovation:'🔨 Renovation & Remodeling', plumbing:'🚰 Plumbing', electrical:'⚡ Electrical', painting:'🎨 Painting', roofing:'🏠 Roofing', flooring:'🪵 Flooring', fencing:'🧱 Fencing & Gates', cleaning:'✨ Cleaning', locksmith:'🔑 Locksmith', landscaping:'🌿 Landscaping', chimney:'🧹 Chimney Sweep', garage_doors:'🚪 Garage Doors', security:'🛡️ Security & Cameras', windows:'🪟 Windows & Doors', other:'📋 Other' };

const PROF_LIST_MAIN =
  `💨 Air Duct Cleaning\n` +
  `🧱 Fencing & Gates\n` +
  `🔑 Locksmith\n` +
  `🧹 Chimney Sweep\n` +
  `🚪 Garage Doors\n` +
  `🪟 Windows & Doors`;

const PROF_LIST_MORE =
  `❄️ HVAC & AC\n` +
  `🔨 Renovation & Remodeling\n` +
  `🚰 Plumbing\n` +
  `⚡ Electrical\n` +
  `🎨 Painting\n` +
  `🏠 Roofing\n` +
  `🪵 Flooring\n` +
  `✨ Cleaning\n` +
  `🌿 Landscaping\n` +
  `🛡️ Security & Cameras`;

const PROF_LIST_MSG = PROF_LIST_MAIN + `\n\n📋 *Type MORE to see all services*`;

// Map common text inputs to profession keys
const PROF_ALIASES: Record<string, string> = {
  'hvac': 'hvac', 'ac': 'hvac', 'air conditioning': 'hvac', 'heating': 'hvac',
  'air duct': 'air_duct', 'duct': 'air_duct', 'duct cleaning': 'air_duct', 'ducts': 'air_duct',
  'renovation': 'renovation', 'remodeling': 'renovation', 'remodel': 'renovation', 'general contractor': 'renovation',
  'plumbing': 'plumbing', 'plumber': 'plumbing',
  'electrical': 'electrical', 'electrician': 'electrical', 'electric': 'electrical',
  'painting': 'painting', 'painter': 'painting', 'paint': 'painting',
  'roofing': 'roofing', 'roof': 'roofing', 'roofer': 'roofing',
  'flooring': 'flooring', 'floor': 'flooring', 'floors': 'flooring', 'tile': 'flooring',
  'fencing': 'fencing', 'fence': 'fencing', 'gates': 'fencing', 'gate': 'fencing', 'railing': 'fencing',
  'cleaning': 'cleaning', 'cleaner': 'cleaning', 'maid': 'cleaning', 'janitorial': 'cleaning',
  'locksmith': 'locksmith', 'locks': 'locksmith', 'lock': 'locksmith',
  'landscaping': 'landscaping', 'landscape': 'landscaping', 'lawn': 'landscaping', 'garden': 'landscaping',
  'chimney': 'chimney', 'chimney sweep': 'chimney',
  'garage': 'garage_doors', 'garage door': 'garage_doors', 'garage doors': 'garage_doors',
  'security': 'security', 'cameras': 'security', 'alarm': 'security', 'cctv': 'security',
  'windows': 'windows', 'window': 'windows', 'doors': 'windows', 'door': 'windows',
};

// Convert number to emoji keycaps (works for 1-99)
const DIGIT_EMOJI = ['0️⃣','1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣'];
function numEmoji(n: number): string {
  return String(n).split('').map(d => DIGIT_EMOJI[parseInt(d)]).join('');
}

async function onboardFirstName(phone: string, text: string, data: Record<string, unknown>): Promise<void> {
  const name = text.trim();
  const lang = (data.language as string) === 'en' ? 'en' : 'he';
  if (!name || name.length < 2 || name.length > 50) {
    await sendText(phone, lang === 'he' ? `לא תפסתי, מה השם המלא שלך?` : `Didn't catch that — what's your full name?`);
    return;
  }

  // Save name and move to profession
  await supabase.from('wa_onboard_state').update({
    step: 'profession',
    data: { ...data, firstName: name },
    updated_at: new Date().toISOString(),
  }).eq('phone', phone);
  await syncOnboardStep(phone, 'profession');

  // Update prospect display_name if we have a prospect
  if (data.prospectId) {
    await supabase.from('prospects').update({ display_name: name }).eq('id', data.prospectId);
  }

  if (lang === 'he') {
    await sendText(phone,
      `נעים להכיר, ${name}! ⚡\n\n` +
      `*שלב 1/5* — מה אתה עושה?\n\n` +
      `${PROF_LIST_MSG}\n\n` +
      `✏️ כתוב או 🎙️ הקלט מה המקצוע שלך.\n` +
      `_אפשר לבחור מהרשימה או לתאר בעצמך._`,
    );
  } else {
    await sendText(phone,
      `Nice to meet you, ${name}! ⚡\n\n` +
      `*Step 1/5* — What do you do?\n\n` +
      `${PROF_LIST_MSG}\n\n` +
      `✏️ Type or 🎙️ record what you do.\n` +
      `_Pick from the list or describe in your own words._`,
    );
  }
}

async function onboardProfession(phone: string, text: string, data: Record<string, unknown>): Promise<void> {
  const lang = (data.language as string) === 'en' ? 'en' : 'he';
  // Handle "MORE" to show full list
  if (text.toLowerCase().trim() === 'more' || text.toLowerCase().trim() === 'עוד') {
    await sendText(phone, lang === 'he'
      ? `📋 *כל המקצועות:*\n\n${PROF_LIST_MAIN}\n\n${PROF_LIST_MORE}\n\n✏️ כתוב מה אתה עושה או 🎙️ שלח הודעה קולית.`
      : `📋 *All services:*\n\n${PROF_LIST_MAIN}\n\n${PROF_LIST_MORE}\n\n✏️ Type what you do or 🎙️ send a voice note.`);
    return;
  }

  // Try matching numbers first (backward compat)
  // If input is just digits with no spaces (e.g. "123"), split into individual digits
  let rawNums = text.match(/\d+/g) ?? [];
  if (/^\d{2,}$/.test(text.trim())) {
    rawNums = text.trim().split('');
  }
  const nums = rawNums.map(Number).filter(n => n >= 1 && n <= PROFESSIONS.length);
  let selected: string[] = [];

  if (nums.length > 0) {
    selected = [...new Set(nums.map(n => PROFESSIONS[n - 1]))];
  } else {
    // Free-text matching — split by comma, "and", newline
    const parts = text.toLowerCase().split(/[,&\n]+|\band\b/).map(s => s.trim()).filter(Boolean);
    for (const part of parts) {
      // Check exact alias match first
      if (PROF_ALIASES[part]) {
        selected.push(PROF_ALIASES[part]);
      } else {
        // Fuzzy — check if any alias is contained in the text
        for (const [alias, key] of Object.entries(PROF_ALIASES)) {
          if (part.includes(alias) || alias.includes(part)) {
            selected.push(key);
            break;
          }
        }
      }
    }
    selected = [...new Set(selected)];
  }

  if (selected.length === 0) {
    await sendText(phone, lang === 'he'
      ? `לא הצלחתי לזהות.\n\nתכתוב מה אתה עושה, למשל:\n_"אינסטלציה ומיזוג"_ או _"ניקוי צנרת"_\n\n✏️ כתוב או 🎙️ הקלט.`
      : `Couldn't identify your trade.\n\nType what you do, for example:\n_"plumbing and HVAC"_ or _"duct cleaning"_\n\n✏️ Type or 🎙️ record.`,
    );
    return;
  }

  (data as Record<string, unknown>).professions = selected;

  await supabase.from('wa_onboard_state').update({
    step: 'city_state',
    data,
    updated_at: new Date().toISOString(),
  }).eq('phone', phone);
  await syncOnboardStep(phone, 'city_state');

  const labels = selected.map(k => PROF_LABELS[k] ?? k).join(', ');
  await sendText(phone, lang === 'he'
    ? `קיבלתי: ${labels} 🔧\n\n*שלב 2/5* — באיזה מדינה אתה עובד?\n\n🌴 Florida\n🗽 New York\n🤠 Texas\n\n✏️ כתוב או 🎙️ הקלט.`
    : `Got it: ${labels} 🔧\n\n*Step 2/5* — What state do you work in?\n\n🌴 Florida\n🗽 New York\n🤠 Texas\n\n✏️ Type or 🎙️ record.`,
  );
}

// City-to-ZIP mapping (inline for Edge Function)
const STATE_CITIES: Record<string, { key: string; label: string; zips: string[] }[]> = {
  FL: [
    { key: 'miami', label: 'Miami', zips: ['33125','33126','33127','33128','33129','33130','33131','33132','33133','33134','33135','33136','33137','33138','33139','33140','33141','33142','33143','33144','33145','33146','33147','33148','33149','33150','33155','33156','33157','33158','33160','33161','33162','33165','33166','33167','33168','33169','33170','33172','33173','33174','33175','33176','33177','33178','33179','33180','33181','33182','33183','33184','33185','33186'] },
    { key: 'fort_lauderdale', label: 'Fort Lauderdale', zips: ['33301','33304','33305','33306','33308','33309','33311','33312','33313','33314','33315','33316','33317','33319','33334'] },
    { key: 'hollywood', label: 'Hollywood', zips: ['33019','33020','33021','33023','33024','33025','33026','33027','33028','33029'] },
    { key: 'hialeah', label: 'Hialeah', zips: ['33010','33012','33013','33014','33015','33016','33018'] },
    { key: 'coral_gables', label: 'Coral Gables', zips: ['33134','33143','33146'] },
    { key: 'boca_raton', label: 'Boca Raton', zips: ['33427','33428','33431','33432','33433','33434','33486','33487','33496','33498'] },
    { key: 'west_palm', label: 'West Palm Beach', zips: ['33401','33403','33404','33405','33406','33407','33409','33411','33412','33413','33414','33415','33417'] },
    { key: 'pompano', label: 'Pompano Beach', zips: ['33060','33062','33063','33064','33065','33066','33067','33068','33069','33071','33073'] },
    { key: 'delray', label: 'Delray Beach', zips: ['33444','33445','33446','33448','33483','33484'] },
    { key: 'homestead', label: 'Homestead', zips: ['33030','33031','33032','33033','33034','33035'] },
    { key: 'doral', label: 'Doral', zips: ['33122','33166','33172','33178'] },
    { key: 'pembroke_pines', label: 'Pembroke Pines', zips: ['33023','33024','33025','33026','33027','33028','33029','33082','33084'] },
    { key: 'miramar', label: 'Miramar', zips: ['33023','33025','33027','33029'] },
    { key: 'plantation', label: 'Plantation', zips: ['33317','33322','33324','33325','33388'] },
    { key: 'sunrise', label: 'Sunrise', zips: ['33304','33313','33319','33321','33322','33323','33325','33326','33351'] },
    { key: 'weston', label: 'Weston', zips: ['33326','33327','33331','33332'] },
    { key: 'aventura', label: 'Aventura', zips: ['33160','33180'] },
    { key: 'miami_beach', label: 'Miami Beach', zips: ['33109','33139','33140','33141','33154'] },
  ],
  NY: [
    { key: 'manhattan', label: 'Manhattan', zips: ['10001','10002','10003','10004','10005','10006','10007','10009','10010','10011','10012','10013','10014','10016','10017','10018','10019','10020','10021','10022','10023','10024','10025','10026','10027','10028','10029','10030','10031','10032','10033','10034','10035','10036','10037','10038','10039','10040'] },
    { key: 'brooklyn', label: 'Brooklyn', zips: ['11201','11203','11204','11205','11206','11207','11208','11209','11210','11211','11212','11213','11214','11215','11216','11217','11218','11219','11220','11221','11222','11223','11224','11225','11226','11228','11229','11230','11231','11232','11233','11234','11235','11236','11237','11238','11239'] },
    { key: 'queens', label: 'Queens', zips: ['11101','11102','11103','11104','11105','11106','11354','11355','11356','11357','11358','11360','11361','11362','11363','11364','11365','11366','11367','11368','11369','11370','11371','11372','11373','11374','11375','11377','11378','11379','11385','11411','11412','11413','11414','11415','11416','11417','11418','11419','11420','11421','11422','11423','11426','11427','11428','11429','11430','11432','11433','11434','11435','11436'] },
    { key: 'bronx', label: 'Bronx', zips: ['10451','10452','10453','10454','10455','10456','10457','10458','10459','10460','10461','10462','10463','10464','10465','10466','10467','10468','10469','10470','10471','10472','10473','10474','10475'] },
    { key: 'staten_island', label: 'Staten Island', zips: ['10301','10302','10303','10304','10305','10306','10307','10308','10309','10310','10312','10314'] },
  ],
  TX: [
    { key: 'houston', label: 'Houston', zips: ['77001','77002','77003','77004','77005','77006','77007','77008','77009','77010','77011','77012','77013','77014','77015','77016','77017','77018','77019','77020','77021','77022','77023','77024','77025','77026','77027','77028','77029','77030','77031','77032','77033','77034','77035','77036','77037','77038','77039','77040','77041','77042','77043','77044','77045','77046','77047','77048','77049','77050','77051','77053','77054','77055','77056','77057','77058','77059','77060','77061','77062','77063','77064','77065','77066','77067','77068','77069','77070','77071','77072','77073','77074','77075','77076','77077','77078','77079','77080','77081','77082','77083','77084','77085','77086','77087','77088','77089','77090','77091','77092','77093','77094','77095','77096','77098','77099'] },
    { key: 'dallas', label: 'Dallas', zips: ['75201','75202','75203','75204','75205','75206','75207','75208','75209','75210','75211','75212','75214','75215','75216','75217','75218','75219','75220','75223','75224','75225','75226','75227','75228','75229','75230','75231','75232','75233','75234','75235','75236','75237','75238','75240','75241','75243','75244','75246','75247','75248','75249','75251','75252','75253','75254'] },
    { key: 'fort_worth', label: 'Fort Worth', zips: ['76101','76102','76103','76104','76105','76106','76107','76108','76109','76110','76111','76112','76113','76114','76115','76116','76117','76118','76119','76120','76123','76126','76129','76130','76131','76132','76133','76134','76135','76137','76140','76148','76155','76164','76179'] },
    { key: 'san_antonio', label: 'San Antonio', zips: ['78201','78202','78203','78204','78205','78207','78208','78209','78210','78211','78212','78213','78214','78215','78216','78217','78218','78219','78220','78221','78222','78223','78224','78225','78226','78227','78228','78229','78230','78231','78232','78233','78234','78235','78236','78237','78238','78239','78240','78242','78244','78245','78247','78248','78249','78250','78251','78252','78253','78254','78255','78256','78257','78258','78259','78260','78261','78263','78264','78266'] },
    { key: 'austin', label: 'Austin', zips: ['78701','78702','78703','78704','78705','78712','78717','78719','78721','78722','78723','78724','78725','78726','78727','78728','78729','78730','78731','78732','78733','78734','78735','78736','78737','78738','78739','78741','78742','78744','78745','78746','78747','78748','78749','78750','78751','78752','78753','78754','78756','78757','78758','78759'] },
  ],
};

async function onboardCityState(phone: string, textLower: string, data: Record<string, unknown>): Promise<void> {
  const lang = (data.language as string) === 'en' ? 'en' : 'he';
  const stateMap: Record<string, string> = { '1': 'FL', 'fl': 'FL', 'florida': 'FL', '2': 'NY', 'ny': 'NY', 'new york': 'NY', '3': 'TX', 'tx': 'TX', 'texas': 'TX' };
  const selectedState = stateMap[textLower];

  if (!selectedState) {
    await sendText(phone, lang === 'he'
      ? `כרגע אנחנו ב-Florida, New York ו-Texas.\nתבחר אחת מהן.`
      : `We're currently in Florida, New York, and Texas.\nPick one.`);
    return;
  }

  data.state = selectedState;
  const cities = STATE_CITIES[selectedState] ?? [];
  const cityList = cities.map((c, i) => `${i + 1}. ${c.label}`).join('\n');

  await supabase.from('wa_onboard_state').update({
    step: 'city',
    data,
    updated_at: new Date().toISOString(),
  }).eq('phone', phone);
  await syncOnboardStep(phone, 'city');

  const stateLabel2 = selectedState === 'FL' ? 'Florida' : selectedState === 'NY' ? 'New York' : 'Texas';
  await sendText(phone, lang === 'he'
    ? `*שלב 3/5* — באיזה אזורים אתה עובד ב-${stateLabel2}?\n\n${cityList}\n\nתשלח מספרים (למשל *1, 3, 5*)\n✏️ או כתוב/🎙️ הקלט את האזורים.`
    : `*Step 3/5* — What areas do you work in ${stateLabel2}?\n\n${cityList}\n\nSend numbers (e.g. *1, 3, 5*)\n✏️ or type/🎙️ record your areas.`);
}

async function onboardCity(phone: string, textLower: string, data: Record<string, unknown>): Promise<void> {
  const lang = (data.language as string) === 'en' ? 'en' : 'he';
  const st = data.state as string;
  const cities = STATE_CITIES[st] ?? [];

  // Try numbers first
  // If input is just digits with no spaces (e.g. "123"), split into individual digits
  let rawCityNums = textLower.match(/\d+/g) ?? [];
  if (/^\d{2,}$/.test(textLower.trim())) {
    rawCityNums = textLower.trim().split('');
  }
  const nums = rawCityNums.map(Number).filter(n => n >= 1 && n <= cities.length);
  let selectedCities: typeof cities = [];

  if (nums.length > 0) {
    selectedCities = nums.map(n => cities[n - 1]);
  } else {
    // Free-text matching — find cities by name
    const parts = textLower.split(/[,&\n]+|\band\b/).map(s => s.trim()).filter(Boolean);
    for (const part of parts) {
      for (const city of cities) {
        if (city.label.toLowerCase().includes(part) || city.key.includes(part.replace(/\s+/g, '_'))) {
          if (!selectedCities.includes(city)) selectedCities.push(city);
        }
      }
    }
    // Also try matching "all" or "everywhere"
    if (['all', 'everywhere', 'all of them', 'everything'].includes(textLower)) {
      selectedCities = [...cities];
    }
  }

  if (selectedCities.length === 0) {
    await sendText(phone, lang === 'he'
      ? `לא מצאתי את האזור. תכתוב שם עיר כמו *Miami* או *Fort Lauderdale*, או תשתמש במספרים מהרשימה.`
      : `Couldn't find that area. Type a city name like *Miami* or *Fort Lauderdale*, or use numbers from the list.`);
    return;
  }
  const allZips = [...new Set(selectedCities.flatMap(c => c.zips))];

  data.cities = selectedCities.map(c => c.key);
  data.zipCodes = allZips;

  await supabase.from('wa_onboard_state').update({
    step: 'working_days',
    data,
    updated_at: new Date().toISOString(),
  }).eq('phone', phone);
  await syncOnboardStep(phone, 'working_days');

  const labels = selectedCities.map(c => c.label).join(', ');
  await sendText(phone, lang === 'he'
    ? `📍 ${labels}\n\n*שלב 4/5* — מתי אתה עובד?\n\n1. ראשון-חמישי\n2. כל יום\n3. מותאם אישית\n\n✏️ כתוב או 🎙️ הקלט.`
    : `📍 ${labels}\n\n*Step 4/5* — When do you work?\n\n1. Mon-Fri\n2. Every day\n3. Custom\n\n✏️ Type or 🎙️ record.`);
}

async function onboardWorkingDays(phone: string, textLower: string, data: Record<string, unknown>): Promise<void> {
  const lang = (data.language as string) === 'en' ? 'en' : 'he';
  const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  let days: number[];

  if (textLower === '1' || textLower.includes('mon-fri') || textLower.includes('weekday') || textLower.includes('monday to friday') || textLower.includes('monday through friday')) {
    days = [1,2,3,4,5];
  } else if (textLower === '2' || textLower.includes('every day') || textLower.includes('everyday') || textLower.includes('all week') || textLower.includes('7 days')) {
    days = [0,1,2,3,4,5,6];
  } else if (textLower === '3' || textLower === 'custom') {
    await sendText(phone, lang === 'he'
      ? `באילו ימים אתה עובד?\n\nתכתוב, למשל *Monday, Tuesday, Friday*\n\n✏️ כתוב או 🎙️ הקלט.`
      : `Which days do you work?\n\nType them, e.g. *Monday, Tuesday, Friday*\n\n✏️ Type or 🎙️ record.`);
    return;
  } else {
    // Parse day names from free text
    const dayMap: Record<string, number> = { 'sun': 0, 'sunday': 0, 'mon': 1, 'monday': 1, 'tue': 2, 'tuesday': 2, 'wed': 3, 'wednesday': 3, 'thu': 4, 'thursday': 4, 'fri': 5, 'friday': 5, 'sat': 6, 'saturday': 6 };
    const foundDays: number[] = [];
    for (const [name, num] of Object.entries(dayMap)) {
      if (textLower.includes(name)) foundDays.push(num);
    }
    // Also try digit parsing
    const nums = textLower.match(/\d/g)?.map(Number).filter(n => n >= 0 && n <= 6) ?? [];
    days = [...new Set([...foundDays, ...nums])].sort();
    if (days.length === 0) {
      await sendText(phone, lang === 'he'
        ? `תגיד לי מתי אתה עובד — למשל:\n_"Monday to Friday"_ או _"Every day"_ או _"Mon, Wed, Fri"_\n\n✏️ כתוב או 🎙️ הקלט.`
        : `Tell me when you work — for example:\n_"Monday to Friday"_ or _"Every day"_ or _"Mon, Wed, Fri"_\n\n✏️ Type or 🎙️ record.`);
      return;
    }
  }

  data.workingDays = days;

  await supabase.from('wa_onboard_state').update({
    step: 'confirm',
    data,
    updated_at: new Date().toISOString(),
  }).eq('phone', phone);
  await syncOnboardStep(phone, 'confirm');

  const profs = (data.professions as string[]).map(k => PROF_LABELS[k] ?? k).join(', ');
  const cities = (data.cities as string[]) ?? [];
  const state = (data.state as string) ?? '';
  const dayLabels = days.map(d => DAY_NAMES[d]).join(', ');
  const stateLabel = state === 'FL' ? 'Florida' : state === 'NY' ? 'New York' : state === 'TX' ? 'Texas' : state;
  // Look up proper city labels from STATE_CITIES (handles "west_palm" → "West Palm Beach")
  const stateCities = STATE_CITIES[state] ?? [];
  const cityLabelMap = Object.fromEntries(stateCities.map(c => [c.key, c.label]));
  const cityNames = cities.map(c => cityLabelMap[c] || c.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())).join(', ');

  const zipCount = ((data.zipCodes as string[]) ?? []).length;

  // Derive counties for display
  const CITY_COUNTY_DISPLAY: Record<string, string> = {
    miami:'Miami-Dade', hialeah:'Miami-Dade', doral:'Miami-Dade', homestead:'Miami-Dade', miami_beach:'Miami-Dade', coral_gables:'Miami-Dade', aventura:'Miami-Dade',
    fort_lauderdale:'Broward', hollywood:'Broward', pembroke_pines:'Broward', miramar:'Broward', plantation:'Broward', sunrise:'Broward', weston:'Broward', pompano:'Broward',
    boca_raton:'Palm Beach', west_palm:'Palm Beach', delray:'Palm Beach',
    manhattan:'New York', brooklyn:'Kings', queens:'Queens', bronx:'Bronx', staten_island:'Richmond', yonkers:'Westchester', long_island:'Nassau',
    houston:'Harris', dallas:'Dallas', san_antonio:'Bexar', austin:'Travis',
  };
  const countyNames = [...new Set(cities.map(c => CITY_COUNTY_DISPLAY[c]).filter(Boolean))].join(', ');
  const areaLine = countyNames ? `${countyNames} County` : `${stateLabel} — ${cityNames}`;

  const fullName = (data.firstName as string) || '';
  if (lang === 'he') {
    await sendText(phone,
      `✅ *שלב 5/5 — כמעט סיימנו!*\n\n` +
      `👤 *${fullName}*\n\n` +
      `🔧 ${profs}\n` +
      `📍 ${areaLine}\n` +
      `📅 ${dayLabels}\n\n` +
      `תשלח *YES* לאישור\n` +
      `תשלח *REDO* להתחיל מחדש`,
    );
  } else {
    await sendText(phone,
      `✅ *Step 5/5 — Almost done!*\n\n` +
      `👤 *${fullName}*\n\n` +
      `🔧 ${profs}\n` +
      `📍 ${areaLine}\n` +
      `📅 ${dayLabels}\n\n` +
      `Send *YES* to confirm\n` +
      `Send *REDO* to start over`,
    );
  }
}

async function onboardConfirm(phone: string, textLower: string, data: Record<string, unknown>): Promise<void> {
  const lang = (data.language as string) === 'en' ? 'en' : 'he';
  if (textLower === 'redo' || textLower === 'no') {
    await supabase.from('wa_onboard_state').update({
      step: 'profession',
      data: { ...data, professions: [], cities: [], zipCodes: [], state: '' },
      updated_at: new Date().toISOString(),
    }).eq('phone', phone);

    await sendText(phone, lang === 'he'
      ? `בסדר! בוא נתחיל מחדש.\n\n*שלב 1/5* — מה אתה עושה?\n\n${PROF_LIST_MSG}\n\n✏️ כתוב או 🎙️ הקלט.`
      : `No problem! Let's start over.\n\n*Step 1/5* — What services do you offer?\n\n${PROF_LIST_MSG}\n\n✏️ Type or 🎙️ record what you do.`);
    return;
  }

  if (!POSITIVE_WORDS.some(w => textLower.includes(w))) {
    await sendText(phone, lang === 'he'
      ? `שלח *YES* לאישור או *REDO* להתחיל מחדש.`
      : `Reply *YES* to confirm or *REDO* to start over.`);
    return;
  }

  // Save to DB
  const userId = data.userId as string | null;
  const prospectId = data.prospectId as string | null;

  if (userId) {
    // Known user — save to contractors table
    const { error: contUpdateErr } = await supabase.from('contractors').update({
      professions: data.professions,
      zip_codes: data.zipCodes,
      wa_notify: true,
      is_active: true,
      working_days: data.workingDays,
    }).eq('user_id', userId);
    if (contUpdateErr) {
      console.error('[onboard] Contractor update failed:', contUpdateErr);
      await sendText(phone, `⚠️ There was a problem saving your settings. Please try again — reply *YES*.`);
      return;
    }
  }

  if (prospectId && !userId) {
    // ── HYBRID: Auto-create full account from WhatsApp onboarding ──
    const professions = (data.professions as string[]) || [];
    const zipCodes = (data.zipCodes as string[]) || [];
    const workingDays = (data.workingDays as number[]).length > 0 ? (data.workingDays as number[]) : [1,2,3,4,5];
    const cities = (data.cities as string[]) || [];
    const phoneNorm = normalizePhone(phone);

    try {
      // 0. Idempotency — check if auth user already exists for this phone
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('whatsapp_phone', phone)
        .maybeSingle();

      if (existingProfile) {
        console.log(`[onboard] Account already exists for ${phone}, skipping creation`);
        data.newUserId = existingProfile.id;
      } else {
        // 1. Create auth user (phone-based, no password needed)
        const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
          phone: phoneNorm,
          phone_confirm: true,
          user_metadata: { full_name: (data.firstName as string) || phone, source: 'whatsapp_onboarding' },
        });

        if (authError || !authUser?.user) {
          console.error('[onboard] Auth create error:', authError);
          await supabase.from('prospects').update({
            stage: 'in_conversation',
            profession_tags: professions,
            notes: `Onboarded via WhatsApp (auth failed: ${authError?.message}). Cities: ${cities.join(', ')}.`,
            last_contact_at: new Date().toISOString(),
          }).eq('id', prospectId);
          // Clean up onboard state and notify user
          await supabase.from('wa_onboard_state').delete().eq('phone', phone);
          await sendText(phone, `⚠️ We couldn't create your account right now. Please try again later by sending any message, or contact support.\n\nSend *MENU* anytime.`);
          return;
        } else {
          const newUserId = authUser.user.id;
          console.log(`[onboard] Auth user created: ${newUserId}`);

          // 2. Profile created by trigger — update with phone, name, counties
          // Derive counties from selected cities
          const CITY_COUNTY: Record<string, string> = {
            miami:'Miami-Dade County', hialeah:'Miami-Dade County', doral:'Miami-Dade County', homestead:'Miami-Dade County', miami_beach:'Miami-Dade County', coral_gables:'Miami-Dade County', aventura:'Miami-Dade County',
            fort_lauderdale:'Broward County', hollywood:'Broward County', pembroke_pines:'Broward County', miramar:'Broward County', plantation:'Broward County', sunrise:'Broward County', weston:'Broward County', pompano:'Broward County',
            boca_raton:'Palm Beach County', west_palm:'Palm Beach County', delray:'Palm Beach County',
            // NY
            manhattan:'New York County', brooklyn:'Kings County', queens:'Queens County', bronx:'Bronx County', staten_island:'Richmond County', yonkers:'Westchester County', long_island:'Nassau County',
            // TX
            houston:'Harris County', dallas:'Dallas County', san_antonio:'Bexar County', austin:'Travis County',
          };
          const selectedCounties = [...new Set(cities.map(c => CITY_COUNTY[c]).filter(Boolean))];

          const { error: profileErr } = await supabase.from('profiles').update({
            whatsapp_phone: phone,
            phone: phoneNorm,
            full_name: (data.firstName as string) || phone,
            counties: selectedCounties.length > 0 ? selectedCounties : null,
          }).eq('id', newUserId);

          if (profileErr) {
            console.error('[onboard] Profile update failed, rolling back auth user:', profileErr);
            await supabase.auth.admin.deleteUser(newUserId);
            throw new Error('Profile update failed');
          }

          // 3. Create contractor record
          const { error: contErr } = await supabase.from('contractors').insert({
            user_id: newUserId,
            professions,
            zip_codes: zipCodes,
            wa_notify: true,
            is_active: true,
            working_days: workingDays,
          });

          if (contErr) {
            console.error('[onboard] Contractor insert failed:', contErr);
            // Don't rollback auth — profile exists, contractor can be created later
          }

          // 4. Create 7-day trial subscription — lookup plan by slug, not hardcoded ID
          const { data: plan } = await supabase
            .from('plans')
            .select('id')
            .eq('slug', 'premium')
            .limit(1)
            .maybeSingle();

          // Fallback: try any active plan
          let planId = plan?.id;
          if (!planId) {
            const { data: anyPlan } = await supabase.from('plans').select('id').limit(1).maybeSingle();
            planId = anyPlan?.id || 'ceb41e5b-5346-4de2-93e1-ead9ae5fcd57';
          }
          const { error: subErr } = await supabase.from('subscriptions').insert({
            user_id: newUserId,
            plan_id: planId,
            status: 'trialing',
            current_period_end: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          });
          if (subErr) console.error('[onboard] Subscription insert failed:', subErr);

          // 5. Link prospect — mark as demo/trial
          await supabase.from('prospects').update({
            stage: 'demo_trial',
            user_id: newUserId,
            profession_tags: professions,
            last_contact_at: new Date().toISOString(),
          }).eq('id', prospectId);

          data.newUserId = newUserId;
          console.log(`[onboard] Full account created: ${newUserId}, trial 7 days`);
        }
      }
    } catch (err) {
      console.error('[onboard] Account creation error:', err);
      await supabase.from('wa_onboard_state').delete().eq('phone', phone);
      await sendText(phone, `⚠️ Something went wrong creating your account. Please send *MENU* and try again, or contact support.`);
      return;
    }
  }

  if (userId) {
    // Known user completing setup — done, no groups step needed
    await supabase.from('wa_onboard_state').delete().eq('phone', phone);
    await sendText(phone, `✅ *All set!*\n\nYou'll get your first check-in tomorrow morning.\nLeads matching your profile will come straight here.\n\nSend *MENU* anytime for options.`);
    console.log(`[onboard] Complete: ${userId}`);
  } else {
    // New user — generate magic link + transition to groups step
    const newUserId = (data.newUserId as string) ?? null;

    // Generate magic link for dashboard
    let dashLink = 'https://app.masterleadflow.com';
    if (newUserId) {
      try {
        const lr = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/magic-login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'generate', user_id: newUserId, redirect_path: '/complete-account' }),
        });
        const ld = await lr.json();
        if (ld.link) dashLink = ld.link;
      } catch (_e) { /* fallback to static link */ }
    }

    const firstName = (data.firstName as string) || '';

    // MESSAGE 1: Confirmation + dashboard link
    await sendText(phone,
      `✅ *מעולה ${firstName}! הפרופיל נשמר!*\n\n` +
      `🎉 תקופת הנסיון שלך (7 ימים) התחילה!\n` +
      `לידים שמתאימים לך יגיעו ישירות לפה.\n\n` +
      `📱 *הממשק שלך מוכן:*\n` +
      `👉 ${dashLink}\n` +
      `_(שם תוכל להוסיף אימייל, סיסמא, ולראות את הלידים על מפה)_`,
    );

    // Transition to groups step
    await syncOnboardStep(phone, 'groups');
    await supabase.from('wa_onboard_state').update({
      step: 'groups',
      data: { ...data, newUserId },
      updated_at: new Date().toISOString(),
    }).eq('phone', phone);

    // MESSAGE 2: Groups explanation (separate message, after short delay)
    await sendText(phone,
      `📋 *עוד דבר אחד —*\n\n` +
      `כרגע יש לך *0 קבוצות* שאנחנו סורקים בשבילך.\n\n` +
      `שלח לי קישורים לקבוצות וואטסאפ של קבלנים — ואני אסרוק אותן 24/7 ואשלח לך רק עבודות רלוונטיות.\n\n` +
      `הדבק פה לינק, או שלח *עזרה* ואסביר לך איך מוציאים לינק מקבוצה.\n\n` +
      `כתוב *סיימתי* כשגמרת (או *דלג* ותוסיף אחר כך).`,
    );
  }
}

// ── Onboarding: Groups Step ──────────────────────────────────────────────────

async function onboardGroups(phone: string, text: string, textLower: string, data: Record<string, unknown>): Promise<void> {
  const userId = (data.userId ?? data.newUserId) as string | null;

  // Check for DONE/SKIP to finish onboarding
  if (['done', 'skip', 'סיימתי', 'דלג'].includes(textLower)) {
    await supabase.from('wa_onboard_state').delete().eq('phone', phone);

    // Update prospect stage to demo_trial (onboarding complete)
    const prospectId = (data.prospectId as string) ?? null;
    if (prospectId) {
      await supabase.from('prospects').update({
        stage: 'demo_trial',
        sub_status: 'just_started',
        sub_status_changed_at: new Date().toISOString(),
      }).eq('id', prospectId);
    } else {
      // Fallback: find prospect by phone
      await supabase.from('prospects').update({
        stage: 'demo_trial',
        sub_status: 'just_started',
        sub_status_changed_at: new Date().toISOString(),
      }).eq('phone', phone);
    }

    // Generate magic link for complete-account page
    let dashLink = 'https://app.masterleadflow.com';
    if (userId) {
      try {
        const lr = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/magic-login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          },
          body: JSON.stringify({ action: 'generate', user_id: userId, redirect_path: '/complete-account' }),
        });
        const ld = await lr.json();
        if (ld.link) dashLink = ld.link;
      } catch (_e) { /* fallback to static link */ }
    }
    const firstName = (data.firstName as string) || '';
    await sendText(phone,
      `🎉 *You're in${firstName ? ', ' + firstName : ''}!*\n\n` +
      `Your 7-day free trial is live.\n` +
      `Leads matching your profile will arrive right here in WhatsApp.\n\n` +
      `📱 *Open your dashboard:*\n` +
      `👉 ${dashLink}\n\n` +
      `💡 Tip: You can send me more group links anytime — the more groups, the more leads!\n\n` +
      `Send *MENU* for options.`,
    );
    return;
  }

  // Try to extract group link from message
  const link = extractGroupLink(text);
  if (link) {
    if (!userId) {
      await sendText(phone, `✅ Link received! We'll save it once your account is ready.\n\nSend more links or *DONE* to finish.`);
      return;
    }

    // Check duplicate
    const { data: existing } = await supabase
      .from('contractor_group_scan_requests')
      .select('id')
      .eq('invite_code', link.inviteCode)
      .neq('status', 'archived')
      .maybeSingle();

    if (existing) {
      await sendText(phone, `👍 This group was already saved!\n\nSend more links or *DONE* to finish.`);
      return;
    }

    // Save the group
    await supabase.from('contractor_group_scan_requests').insert({
      contractor_id: userId,
      invite_link_raw: link.url,
      invite_link_normalized: `https://chat.whatsapp.com/${link.inviteCode}`,
      invite_code: link.inviteCode,
      status: 'pending',
      join_method: 'manual',
    });

    await sendText(phone, `✅ *Group saved!*\n\nSend more group links or type *DONE* to finish.`);
    console.log(`[onboard-groups] Saved group from ${phone}: ${link.inviteCode}`);
    return;
  }

  // Detect "how to get group link" questions — answer with step-by-step instructions immediately (no AI needed)
  const helpKeywords = ['how', 'איך', 'לינק', 'link', 'מוציאים', 'עזרה', 'help', 'קישור', 'invite'];
  if (helpKeywords.some(kw => textLower.includes(kw))) {
    const lang = (data.language as string) === 'en' ? 'en' : 'he';
    if (lang === 'he') {
      await sendText(phone,
        `📲 *איך מוצאים לינק לקבוצה:*\n\n` +
        `1. פתח WhatsApp\n` +
        `2. היכנס לקבוצה של קבלנים\n` +
        `3. לחץ על שם הקבוצה למעלה ☝️\n` +
        `4. גלול למטה → "Invite via link"\n` +
        `5. לחץ "Copy link" 📋\n` +
        `6. חזור לפה והדבק!\n\n` +
        `או כתוב *סיימתי* לסיום.`,
      );
    } else {
      await sendText(phone,
        `📲 *How to find a group link:*\n\n` +
        `1. Open WhatsApp\n` +
        `2. Go to your contractor group\n` +
        `3. Tap the group name at the top ☝️\n` +
        `4. Scroll down → "Invite via link"\n` +
        `5. Tap "Copy link" 📋\n` +
        `6. Come back here and paste it!\n\n` +
        `Or type *DONE* to finish.`,
      );
    }
    return;
  }

  // Not a link — use AI to respond naturally (help, questions, anything)
  const groupsAiPrompt = `You are Rebeca from MasterLeadFlow. Speaking Hebrew (Israeli style), short and friendly.
The user just finished onboarding and you asked them to send WhatsApp group links.
They wrote: "${text}"

Context:
- You need them to paste WhatsApp group invite links (chat.whatsapp.com/...)
- If they ask HOW to get a link, explain in Hebrew:
  1. פתח קבוצת וואטסאפ
  2. לחץ על שם הקבוצה למעלה
  3. גלול למטה → "הזמן באמצעות קישור"
  4. לחץ "העתק קישור"
  5. חזור לפה והדבק
- If they ask about the product, pricing, how it works — answer briefly and redirect back to groups
- If they seem confused or frustrated — be warm, helpful, and simplify
- Always end with a reminder: they can paste links or write "סיימתי" to finish
- Keep it SHORT — max 3-4 lines. This is WhatsApp, not email.
- Respond in the SAME LANGUAGE the user wrote in.`;

  try {
    const aiRes = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getOpenAIKey()}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        instructions: groupsAiPrompt,
        input: [{ role: 'user', content: text }],
        max_output_tokens: 250,
        temperature: 0.4,
        store: false,
      }),
    });
    console.log(`[groups-ai] Status: ${aiRes.status}, key exists: ${!!getOpenAIKey()}`);
    if (aiRes.ok) {
      const aiData = await aiRes.json();
      const reply = aiData.output_text || aiData.output?.[0]?.content?.[0]?.text;
      if (reply) {
        await sendText(phone, reply);
        return;
      }
    }
  } catch (e) {
    console.error('[groups-ai] Error:', e);
  }

  // Fallback if AI fails
  await sendText(phone,
    `הדבק לינק של קבוצת וואטסאפ (chat.whatsapp.com/...)\n\n` +
    `או כתוב *סיימתי* לסיום.`
  );
}

// ── Multi-Agent Engine (DB-driven, OpenAI Responses API) ─────────────────────

// Use DB-loaded key if available, fall back to env var
function getOpenAIKey() { return OPENAI_KEY_OVERRIDE || Deno.env.get('OPENAI_API_KEY') || ''; }

// Cache agents for the lifetime of this Edge Function invocation (~same request)
let _agentCache: Array<{
  id: string; slug: string; name: string; instructions: string;
  model: string; temperature: number; handoff_targets: string[];
  guardrails: Record<string, unknown>; is_entry_point: boolean;
  bot_agent_tools: Array<{ bot_tools: { slug: string; name: string; description: string; parameters: Record<string, unknown> } }>;
}> | null = null;

async function loadAgents() {
  if (_agentCache) return _agentCache;
  const { data, error } = await supabase
    .from('bot_agents')
    .select('id, slug, name, instructions, model, temperature, handoff_targets, guardrails, is_entry_point, bot_agent_tools(bot_tools(slug, name, description, parameters))')
    .eq('is_active', true);
  if (error) console.error('[agents] Load error:', error);
  _agentCache = data || [];
  return _agentCache;
}

function buildStageGuidance(stage: string, subStatus: string): string {
  const guides: Record<string, string> = {
    prospect: `This is a new prospect. Be friendly and curious. Explain what LeadExpress does — we scan their WhatsApp groups and send them matching jobs. Offer a free 7-day trial. Don't be pushy.`,
    reached_out: `We already reached out to this prospect. They haven't registered yet. Be persuasive but not aggressive. Highlight the value — real jobs from their own WhatsApp groups. Answer questions confidently. Push toward registration.`,
    in_conversation: `This prospect is actively chatting. Listen to their questions, answer clearly, and guide them toward starting the free trial. If they say YES, hand off to onboarding_agent immediately.`,
    onboarding: `This prospect is in the middle of registration. Help them complete the current step. Be encouraging — "almost done!" Keep it short and action-oriented.`,
    demo_trial: subStatus === 'no_leads'
      ? `This user is on a free trial but hasn't gotten leads yet. Be empathetic. Help them add more WhatsApp groups — more groups = more jobs. Don't promise specific numbers.`
      : subStatus === 'inactive'
      ? `This user is on trial but hasn't been active. Gently remind them we're scanning their groups. Encourage them to check in and add more groups.`
      : subStatus === 'expiring'
      ? `Trial is about to expire! Mention how many messages we scanned and groups we monitor. Encourage them to subscribe — $79/month, cancel anytime. Be enthusiastic but not desperate.`
      : subStatus === 'wants_to_pay'
      ? `Great news — they want to pay! Help them complete payment quickly. Send the payment link. Be excited and supportive.`
      : `This user is on a free trial. Be helpful and show value. Mention scanning activity from their groups. Help with any questions.`,
    trial_expired: subStatus === 'had_leads' || subStatus === 'was_active'
      ? `Their trial expired but they GOT leads — they saw value! Remind them what they're missing. Offer to continue at $79/month. Be enthusiastic — the system works for them.`
      : subStatus === 'barely_used' || subStatus === 'never_used'
      ? `They barely used the trial. Don't push payment — offer a FREE extension. Ask if they need help getting started. Be patient and supportive.`
      : subStatus === 'payment_failed'
      ? `Payment failed after trial. Help them fix it — they WANTED to pay. Be helpful, not accusatory.`
      : subStatus === 'got_offer'
      ? `They got a discount/extension offer but haven't acted. Gentle reminder — don't repeat the offer details, just ask if they need help.`
      : `Their trial expired. Be warm and understanding. Listen first, then offer options based on what they say.`,
    paying: subStatus === 'payment_failing'
      ? `URGENT: Payment is failing. Be helpful and direct — help them fix the payment issue. They might not know it failed. Don't threaten, just explain the situation and offer to help.`
      : subStatus === 'no_leads_week' || subStatus === 'low_leads'
      ? `This paying customer isn't getting enough leads. Be proactive and helpful. Suggest adding more WhatsApp groups. Show scanning stats to prove we're working. Don't make excuses — offer solutions.`
      : subStatus === 'support_issue'
      ? `This customer has a support issue. Acknowledge it immediately. Be empathetic and solution-oriented. Escalate to admin if you can't resolve it.`
      : `This is a paying customer. Provide excellent service. Help with claims, settings, stats. Be professional and efficient. Show them their scanning stats when relevant.`,
    churned: subStatus === 'recent'
      ? `This customer recently left. Be warm, not salesy. Ask what went wrong. Mention scanning stats to show we're still monitoring their groups. Offer to help if they want to come back — no pressure.`
      : subStatus === 'payment_failed'
      ? `Payment failed — this might not be intentional. Be helpful, not accusatory. Help them fix the payment issue. They might still want the service.`
      : subStatus === 'no_value'
      ? `They left because they didn't see value. Acknowledge this honestly. Mention specific improvements. Offer a free trial week to try again — no commitment.`
      : subStatus === 'seasonal'
      ? `Seasonal contractor. Be brief and timely — mention that the season is starting and there are new jobs. One message is enough.`
      : subStatus === 'competitor'
      ? `They went to a competitor. Be classy — don't badmouth competitors. If they reach out, listen to what they need and show how we're different.`
      : `This is a former customer. Be respectful and brief. If they're reaching out, they might be interested in coming back. Listen first, then offer options.`,
  };
  const base = guides[stage] || guides.prospect;
  // Add dashboard link capability for registered users
  if (['demo_trial', 'paying', 'trial_expired', 'churned'].includes(stage)) {
    return base + `\n\nIMPORTANT: If the user asks to log in, access their dashboard, or needs a link — tell them to type "דשבורד" or "login" and the system will automatically send them a magic link. You do NOT need to generate the link yourself.`;
  }
  return base;
}

function buildUserContext(profile: { id: string; full_name: string }, contractor: Record<string, unknown> | null, userSummary: string): string {
  const name = profile.full_name || 'Contractor';
  const trades = (contractor?.professions as string[])?.join(', ') || 'not set';
  const zips = (contractor?.zip_codes as string[])?.length || 0;
  const available = contractor?.available_today ? 'Yes' : 'No';
  const waNotify = contractor?.wa_notify ? 'Active' : 'Paused';
  return `<user_context>
Name: ${name}
Trades: ${trades}
Service ZIPs: ${zips} areas
Available today: ${available}
Notification status: ${waNotify}
${userSummary ? `Memory: ${userSummary}` : ''}
</user_context>`;
}

function agentToolsToOpenAI(agent: { bot_agent_tools: Array<{ bot_tools: { slug: string; description: string; parameters: Record<string, unknown> } }> }) {
  return agent.bot_agent_tools.map(at => ({
    type: 'function' as const,
    name: at.bot_tools.slug,
    description: at.bot_tools.description,
    parameters: Object.keys(at.bot_tools.parameters).length > 0
      ? at.bot_tools.parameters
      : { type: 'object', properties: {}, additionalProperties: false },
    strict: true,
  }));
}

async function routeToAgent(text: string, agents: typeof _agentCache): Promise<string> {
  const router = agents!.find(a => a.is_entry_point);
  if (!router) return 'chat_agent'; // fallback

  try {
    const res = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getOpenAIKey()}` },
      body: JSON.stringify({
        model: router.model,
        instructions: router.instructions,
        input: [{ role: 'user', content: text }],
        text: { format: { type: 'json_object' } },
        max_output_tokens: (router.guardrails as Record<string, number>)?.max_tokens ?? 100,
        store: false,
      }),
    });

    if (!res.ok) {
      console.error('[router] Classification error:', await res.text());
      return 'chat_agent';
    }

    const data = await res.json();
    const outputText = data.output_text || '';
    try {
      const parsed = JSON.parse(outputText);
      const target = parsed.target || parsed.agent || 'chat_agent';
      // Validate target exists
      if (agents!.find(a => a.slug === target)) return target;
      console.warn(`[router] Unknown target: ${target}, falling back to chat_agent`);
      return 'chat_agent';
    } catch {
      console.warn('[router] Failed to parse classification:', outputText);
      return 'chat_agent';
    }
  } catch (err) {
    console.error('[router] Error:', err);
    return 'chat_agent';
  }
}

// ── Sales AI for prospects (no profile yet) ─────────────────────────────────
async function handleAIForProspect(phone: string, text: string, prospectId: string | null = null, lang: 'he' | 'en' = 'he'): Promise<void> {
  const OPENAI_KEY = getOpenAIKey();
  if (!OPENAI_KEY) {
    const fallback = lang === 'he'
      ? `היי! אני רבקה מ-MasterLeadFlow 👋\nמערכת AI שסורקת קבוצות וואטסאפ ושולחת לך עבודות שמתאימות לך.\n7 ימים חינם! רוצה לנסות?`
      : `Hey! I'm Rebeca from MasterLeadFlow 👋\nAn AI system that scans WhatsApp groups and sends you matching jobs.\n7 days free! Want to try?`;
    await sendText(phone, fallback);
    return;
  }

  try {
    const agents = await loadAgents();
    const salesAgent = agents.find(a => a.slug === 'sales_agent');
    if (!salesAgent) {
      const fallback = lang === 'he'
        ? `היי! אני רבקה מ-MasterLeadFlow 👋\nרוצה לשמוע איך אני יכולה לעזור לך למצוא עבודות?`
        : `Hey! I'm Rebeca from MasterLeadFlow 👋\nWant to hear how I can help you find jobs?`;
      await sendText(phone, fallback);
      return;
    }

    // Get prospect with stage + stats
    const normalPhone = phone.startsWith('+') ? phone : '+' + phone;
    const { data: prospect } = await supabase
      .from('prospects')
      .select('display_name, pipeline_status, sub_status, group_count, messages_scanned, lead_count')
      .eq('phone', normalPhone)
      .maybeSingle();

    const prospectName = prospect?.display_name || 'there';
    const stage = prospect?.pipeline_status || 'unknown';
    const subStatus = prospect?.sub_status || '';

    // Check session for conversation continuity
    const { data: session } = await supabase
      .from('wa_agent_sessions')
      .select('last_response_id, message_count, current_agent_slug')
      .eq('wa_id', phone)
      .maybeSingle();

    // Stage-aware instructions — bot adapts behavior based on where the prospect is
    const stageGuidance = buildStageGuidance(stage, subStatus);
    const instructions = salesAgent.instructions + `\n\n<prospect_context>
Name: ${prospectName}
Phone: ${phone}
Stage: ${stage}
Sub-status: ${subStatus}
Groups monitored: ${prospect?.group_count ?? 0}
Messages scanned: ${prospect?.messages_scanned ?? 0}
Leads found: ${prospect?.lead_count ?? 0}
</prospect_context>

<stage_guidance>
${stageGuidance}
</stage_guidance>`;
    const tools = agentToolsToOpenAI(salesAgent);

    // Add handoff tool
    if (salesAgent.handoff_targets?.length > 0) {
      tools.push({
        type: 'function' as const,
        name: 'handoff',
        description: 'Hand off to another agent. Use when prospect says yes to trial (→ onboarding_agent) or asks something outside your scope (→ router).',
        parameters: {
          type: 'object',
          properties: {
            target: { type: 'string', enum: salesAgent.handoff_targets, description: 'Target agent' },
            reason: { type: 'string', description: 'Brief reason' },
          },
          required: ['target', 'reason'],
          additionalProperties: false,
        },
        strict: true,
      });
    }

    const body: Record<string, unknown> = {
      model: salesAgent.model,
      instructions,
      input: [{ role: 'user', content: text }],
      tools: tools.length > 0 ? tools : undefined,
      store: true,
      max_output_tokens: (salesAgent.guardrails as Record<string, number>)?.max_tokens ?? 200,
      temperature: salesAgent.temperature,
    };

    // Chain previous conversation if same agent
    if (session?.last_response_id && session?.current_agent_slug === 'sales_agent') {
      body.previous_response_id = session.last_response_id;
    }

    const res = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_KEY}` },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      console.error('[sales] OpenAI error:', await res.text());
      const errMsg = lang === 'he'
        ? `היי! אני רבקה מ-MasterLeadFlow 👋\nרוצה לשמוע איך אני יכולה לעזור לך?`
        : `Hey! I'm Rebeca from MasterLeadFlow 👋\nWant to hear how I can help you?`;
      await sendText(phone, errMsg);
      return;
    }

    const data = await res.json();
    const responseId = data.id as string;
    const output = data.output as Array<{ type: string; name?: string; arguments?: string; content?: Array<{ text?: string }>; text?: string }>;

    // Save session
    await supabase.from('wa_agent_sessions').upsert({
      wa_id: phone,
      user_id: null,
      last_response_id: responseId,
      message_count: (session?.message_count ?? 0) + 1,
      current_agent_slug: 'sales_agent',
      updated_at: new Date().toISOString(),
    });

    // Process output
    for (const item of (output || [])) {
      if (item.type === 'function_call' && item.name === 'handoff') {
        try {
          const args = JSON.parse(item.arguments || '{}');
          if (args.target === 'onboarding_agent') {
            console.log(`[sales] Prospect ${phone} ready for onboarding!`);
            // Update prospect stage
            if (prospectId) {
              await supabase.from('prospects')
                .update({ stage: 'onboarding', last_contact_at: new Date().toISOString() })
                .eq('id', prospectId);
            }
            // Start onboarding
            await supabase.from('wa_onboard_state').upsert({
              phone,
              step: 'first_name',
              data: {
                prospectId,
                userId: null,
                firstName: prospectName !== 'there' ? prospectName : '',
                professions: [], cities: [], zipCodes: [], state: '', workingDays: [1,2,3,4,5],
              },
              updated_at: new Date().toISOString(),
            });
            await sendText(phone, `מעולה! 🚀 בוא נתחיל — לוקח דקה.\n\n*מה השם המלא שלך?*`);
            return;
          }
        } catch {}
      }

      if (item.type === 'message' && item.content) {
        for (const part of item.content) {
          if (part.text) {
            await sendText(phone, part.text);
          }
        }
      }
    }

    // Fallback: if no text output, check output_text
    const outputText = data.output_text;
    if (outputText && !output?.some((i: { type: string }) => i.type === 'message')) {
      await sendText(phone, outputText);
    }

    // Detect conversation intent from AI response and update sub_status
    const allText = (outputText || '').toLowerCase();
    const userText = text.toLowerCase();
    let detectedIntent = 'active';
    if (userText.includes('price') || userText.includes('cost') || userText.includes('מחיר') || userText.includes('עולה')) {
      detectedIntent = 'asking_price';
    } else if (userText.includes('not interested') || userText.includes('no thanks') || userText.includes('לא מעוניין') || userText.includes('לא רלוונטי')) {
      detectedIntent = 'not_interested';
    } else if (userText.includes('maybe') || userText.includes('think about') || userText.includes('אולי') || userText.includes('לחשוב')) {
      detectedIntent = 'hesitating';
    }
    await supabase.rpc('update_conversation_substatus', { p_phone: phone, p_intent: detectedIntent });

  } catch (err) {
    console.error('[sales] Error:', err);
    const errMsg = lang === 'he'
      ? `היי! אני רבקה מ-MasterLeadFlow 👋\nרוצה לשמוע על המערכת שלנו?`
      : `Hey! I'm Rebeca from MasterLeadFlow 👋\nWant to hear about our system?`;
    await sendText(phone, errMsg);
  }
}

async function handleAI(phone: string, text: string, profile: { id: string; full_name: string }): Promise<void> {
  if (!getOpenAIKey()) {
    await sendText(phone, `Send *MENU* for options.`);
    return;
  }

  try {
    const agents = await loadAgents();
    if (!agents.length) {
      // Fallback: no agents in DB yet — use basic response
      await sendText(phone, `Send *MENU* for options.`);
      return;
    }

    // Fetch contractor data + prospect stage for context
    const { data: contractor } = await supabase
      .from('contractors')
      .select('professions, zip_codes, available_today, wa_notify, working_days')
      .eq('user_id', profile.id)
      .maybeSingle();

    const normalPhone2 = phone.startsWith('+') ? phone : '+' + phone;
    const { data: prospectData } = await supabase
      .from('prospects')
      .select('pipeline_status, sub_status, group_count, messages_scanned, lead_count')
      .eq('phone', normalPhone2)
      .maybeSingle();

    // Fetch session (memory + current agent tracking)
    const { data: session } = await supabase
      .from('wa_agent_sessions')
      .select('last_response_id, user_summary, message_count, current_agent_slug, handoff_history')
      .eq('wa_id', phone)
      .maybeSingle();

    // Route: use current agent if recent, otherwise classify via router
    let targetSlug = session?.current_agent_slug;
    if (!targetSlug || targetSlug === 'router') {
      targetSlug = await routeToAgent(text, agents);
      console.log(`[router] Classified → ${targetSlug}`);
    }

    const targetAgent = agents.find(a => a.slug === targetSlug) || agents.find(a => a.slug === 'chat_agent') || agents[0];

    // Build instructions: agent instructions + user context + stage guidance
    const userContext = buildUserContext(profile, contractor, session?.user_summary ?? '');
    const stage = prospectData?.pipeline_status || 'paying';
    const subStatus = prospectData?.sub_status || '';
    const stageGuidance = buildStageGuidance(stage, subStatus);
    const stageStats = `<activity_stats>
Groups monitored: ${prospectData?.group_count ?? 0}
Messages scanned: ${prospectData?.messages_scanned ?? 0}
Leads found: ${prospectData?.lead_count ?? 0}
</activity_stats>`;
    const instructions = targetAgent.instructions + '\n\n' + userContext + '\n\n' + stageStats + '\n\n<stage_guidance>\n' + stageGuidance + '\n</stage_guidance>';

    // Build tools from DB
    const tools = agentToolsToOpenAI(targetAgent);

    // Add handoff tool if agent has handoff targets
    if (targetAgent.handoff_targets?.length > 0) {
      tools.push({
        type: 'function' as const,
        name: 'handoff',
        description: 'Hand off the conversation to a different agent. Use when the user asks about something outside your scope.',
        parameters: {
          type: 'object',
          properties: {
            target: { type: 'string', enum: targetAgent.handoff_targets, description: 'The agent to hand off to' },
            reason: { type: 'string', description: 'Brief reason for handoff' },
          },
          required: ['target'],
          additionalProperties: false,
        },
        strict: true,
      });
    }

    // Call OpenAI Responses API
    const maxTokens = (targetAgent.guardrails as Record<string, number>)?.max_tokens ?? 300;
    const body: Record<string, unknown> = {
      model: targetAgent.model,
      instructions,
      input: [{ role: 'user', content: text }],
      tools: tools.length > 0 ? tools : undefined,
      store: true,
      max_output_tokens: maxTokens,
      temperature: targetAgent.temperature,
    };

    // Chain to previous response for memory (if same agent and not too old)
    if (session?.last_response_id && (session?.message_count ?? 0) < 50 && session?.current_agent_slug === targetSlug) {
      body.previous_response_id = session.last_response_id;
    }

    const res = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getOpenAIKey()}` },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[${targetSlug}] OpenAI error:`, errText);
      // Retry without chaining if previous_response_id failed
      if (session?.last_response_id && errText.includes('previous_response')) {
        delete body.previous_response_id;
        const retry = await fetch('https://api.openai.com/v1/responses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getOpenAIKey()}` },
          body: JSON.stringify(body),
        });
        if (!retry.ok) {
          await sendText(phone, `Send *MENU* for options.`);
          return;
        }
        const retryData = await retry.json();
        await processAIResponse(phone, profile, retryData, targetSlug, session?.handoff_history, text);
        return;
      }
      await sendText(phone, `Send *MENU* for options.`);
      return;
    }

    const data = await res.json();
    await processAIResponse(phone, profile, data, targetSlug, session?.handoff_history, text);
  } catch (err) {
    console.error('[ai] Error:', err);
    await sendText(phone, `Send *MENU* for options.`);
  }
}

async function processAIResponse(
  phone: string,
  profile: { id: string; full_name: string },
  data: Record<string, unknown>,
  agentSlug: string,
  handoffHistory?: unknown[],
  originalText?: string,
): Promise<void> {
  const responseId = data.id as string;
  const output = data.output as Array<{ type: string; name?: string; arguments?: string; content?: Array<{ text?: string }>; text?: string }>;

  // Save session with current agent tracking
  const currentCount = (await supabase.from('wa_agent_sessions').select('message_count').eq('wa_id', phone).maybeSingle()).data?.message_count ?? 0;
  await supabase.from('wa_agent_sessions').upsert({
    wa_id: phone,
    user_id: profile.id,
    last_response_id: responseId,
    message_count: currentCount + 1,
    current_agent_slug: agentSlug,
    handoff_history: handoffHistory || [],
    updated_at: new Date().toISOString(),
  });

  // Process output items
  for (const item of (output || [])) {
    if (item.type === 'function_call' && item.name) {
      // Handle handoff — re-route to different agent
      if (item.name === 'handoff') {
        try {
          const args = JSON.parse(item.arguments || '{}');
          const newAgent = args.target || 'chat_agent';
          const newHistory = [...(handoffHistory || []), { from: agentSlug, to: newAgent, reason: args.reason, at: new Date().toISOString() }];
          // Update session to new agent and reset chaining
          await supabase.from('wa_agent_sessions').upsert({
            wa_id: phone,
            user_id: profile.id,
            last_response_id: null,
            current_agent_slug: newAgent,
            handoff_history: newHistory,
            updated_at: new Date().toISOString(),
          });
          console.log(`[handoff] ${agentSlug} → ${newAgent} (${args.reason})`);
          // Re-run with new agent using the original user text
          await handleAI(phone, originalText || 'help', profile);
          return;
        } catch (err) {
          console.error('[handoff] Parse error:', err);
        }
      }

      // Execute tool function
      await executeAIFunction(phone, item.name, profile, item.arguments);
      return;
    }
    if (item.type === 'message') {
      const content = item.content as Array<{ type: string; text?: string }>;
      const textContent = content?.find(c => c.type === 'output_text' || c.type === 'text');
      if (textContent?.text) {
        await sendText(phone, textContent.text);
        return;
      }
    }
  }

  // Fallback: check output_text
  const outputText = data.output_text as string;
  if (outputText) {
    await sendText(phone, outputText);
    return;
  }

  await sendText(phone, `Send *MENU* for options.`);
}

async function executeAIFunction(phone: string, fnName: string, profile: { id: string; full_name: string }, args?: string): Promise<void> {
  switch (fnName) {
    case 'show_menu':
      await handleMenu(phone);
      break;
    case 'show_settings':
      await handleSettings(phone, profile.id);
      break;
    case 'show_stats':
      await handleStats(phone, profile.id);
      break;
    case 'pause_leads':
      await handlePauseResume(phone, profile.id, false);
      break;
    case 'resume_leads':
      await handlePauseResume(phone, profile.id, true);
      break;
    case 'update_trades':
      await startOnboardingStep(phone, profile.id, 'profession');
      break;
    case 'update_areas':
      await startOnboardingStep(phone, profile.id, 'city');
      break;
    case 'update_days':
      await startOnboardingStep(phone, profile.id, 'working_days');
      break;
    case 'checkin_available': {
      const windowUntil = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      await supabase.from('contractors').update({ available_today: true, wa_window_until: windowUntil }).eq('user_id', profile.id);
      await sendText(phone, `✅ You're live! Leads will come through today.`);
      break;
    }
    case 'checkin_off':
      await supabase.from('contractors').update({ available_today: false }).eq('user_id', profile.id);
      await sendText(phone, `👍 Got it, enjoy your day off!`);
      break;
    case 'start_post_job':
      await startPostJob(phone, profile);
      break;
    case 'claim_lead': {
      try {
        const parsed = JSON.parse(args || '{}');
        if (parsed.lead_id) {
          const { error } = await supabase.from('leads').update({ status: 'claimed', claimed_by: profile.id }).eq('id', parsed.lead_id).eq('status', 'sent');
          await sendText(phone, error ? `Could not claim this lead.` : `✅ Lead claimed! Check your WhatsApp for the customer's contact.`);
        }
      } catch { await sendText(phone, `Send *MENU* for options.`); }
      break;
    }
    case 'pass_lead': {
      try {
        const parsed = JSON.parse(args || '{}');
        if (parsed.lead_id) {
          await supabase.from('pipeline_events').insert({ lead_id: parsed.lead_id, user_id: profile.id, stage: 'lead_passed', meta: { reason: parsed.reason } });
          await sendText(phone, `👍 Lead passed.`);
        }
      } catch { await sendText(phone, `Send *MENU* for options.`); }
      break;
    }
    default:
      console.warn(`[tool] Unknown function: ${fnName}`);
      await sendText(phone, `Send *MENU* for options.`);
  }
}

// ── Post Job Flow ────────────────────────────────────────────────────────────
// Contractor posts a job from the field → AI collects details → publishes to matching contractors

const POST_JOB_SYSTEM = `You are Rebeca, a smart AI assistant helping contractors publish jobs to other contractors on the MasterLeadFlow network.
You speak English and Hebrew — match the user's language.
Keep responses SHORT (1-2 sentences, WhatsApp style).

CRITICAL: ANALYZE THE FIRST MESSAGE CAREFULLY. Users often provide ALL details in a single message.
If you can extract all required fields from the message, call publish_job IMMEDIATELY — do NOT ask questions you already have answers to.

Required fields:
1. profession - Extract from context. Map to: hvac, renovation, fencing, cleaning, locksmith, plumbing, electrical, painting, roofing, flooring, air_duct, other
   Examples: "תיקון מזגן"→hvac, "AC repair"→hvac, "fence install"→fencing, "deep clean"→cleaning
2. city - Extract city name from context (e.g. "פורט לוטרדר"→Fort Lauderdale, "מיאמי"→Miami)
3. description - Summarize the work needed in 1 sentence. Strip ALL personal info (phone, address, names).
4. urgency - Infer from context: "just finished there"→today, "need someone"→this_week, otherwise→flexible
5. budget - Optional. Extract if mentioned (e.g. "20% על העבודה"→"20% commission")

RULES:
- If ALL required fields can be extracted → call publish_job RIGHT AWAY
- If only 1-2 fields are missing → ask for just those specific fields
- NEVER re-ask for information already provided
- NEVER include customer phone, address, or personal info in the description
- Be encouraging: "מעולה! מפרסם עכשיו..." / "Great! Publishing now..."`;

const POST_JOB_FUNCTIONS = [
  {
    name: 'publish_job',
    description: 'Publish the job when all details are collected',
    parameters: {
      type: 'object',
      properties: {
        profession: { type: 'string', enum: ['hvac', 'renovation', 'fencing', 'cleaning', 'locksmith', 'plumbing', 'electrical', 'painting', 'roofing', 'flooring', 'air_duct', 'other'] },
        city: { type: 'string' },
        description: { type: 'string', description: 'Brief job description WITHOUT personal info' },
        urgency: { type: 'string', enum: ['today', 'this_week', 'flexible'] },
        budget: { type: 'string', description: 'Optional budget estimate' },
      },
      required: ['profession', 'city', 'description', 'urgency'],
    },
  },
  {
    name: 'cancel_post',
    description: 'Cancel job posting',
    parameters: { type: 'object', properties: {} },
  },
];

async function startPostJob(phone: string, profile: { id: string; full_name: string }): Promise<void> {
  // Store conversation state
  await supabase.from('wa_onboard_state').upsert({
    phone,
    step: 'post_job',
    data: { userId: profile.id, messages: [] },
    updated_at: new Date().toISOString(),
  });

  await sendText(phone, `📝 *Post a Job*\n\nTell me about the job you want to publish.\nWhat type of work is it? (HVAC, plumbing, renovation, etc.)`);
}

async function handlePostJobMessage(phone: string, text: string, state: { data: Record<string, unknown> }): Promise<void> {
  if (!getOpenAIKey()) {
    await sendText(phone, `AI not configured. Send *MENU* for options.`);
    return;
  }

  const data = state.data as { userId: string; messages: Array<{ role: string; content: string }> };
  const messages = data.messages || [];

  // Add user message to history
  messages.push({ role: 'user', content: text });

  // Keep only last 10 messages to stay within limits
  const recentMessages = messages.slice(-10);

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getOpenAIKey()}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: POST_JOB_SYSTEM },
          ...recentMessages,
        ],
        functions: POST_JOB_FUNCTIONS,
        function_call: 'auto',
        max_tokens: 200,
      }),
    });

    if (!res.ok) {
      console.error('[post-job] OpenAI error:', await res.text());
      await sendText(phone, `Something went wrong. Try again or send *MENU*.`);
      return;
    }

    const result = await res.json();
    const msg = result.choices?.[0]?.message;

    if (msg?.function_call?.name === 'publish_job') {
      const args = JSON.parse(msg.function_call.arguments);
      await publishJob(phone, data.userId, args);
      // Clear state
      await supabase.from('wa_onboard_state').delete().eq('phone', phone);
    } else if (msg?.function_call?.name === 'cancel_post') {
      await supabase.from('wa_onboard_state').delete().eq('phone', phone);
      await sendText(phone, `❌ Job posting cancelled. Send *MENU* for options.`);
    } else if (msg?.content) {
      // Save conversation and send AI response
      messages.push({ role: 'assistant', content: msg.content });
      await supabase.from('wa_onboard_state').update({
        data: { ...data, messages },
        updated_at: new Date().toISOString(),
      }).eq('phone', phone);
      await sendText(phone, msg.content);
    }
  } catch (err) {
    console.error('[post-job] Error:', err);
    await sendText(phone, `Something went wrong. Try again or send *MENU*.`);
  }
}

async function publishJob(
  phone: string,
  userId: string,
  job: { profession: string; city: string; description: string; urgency: string; budget?: string },
): Promise<void> {
  const URGENCY_LABELS: Record<string, string> = { today: '🔴 Today', this_week: '🟡 This week', flexible: '🟢 Flexible' };
  const emoji = PROF_EMOJI_MAP[job.profession] ?? '📋';
  const profLabel = job.profession.charAt(0).toUpperCase() + job.profession.slice(1);

  // Create lead in DB
  const { data: lead, error } = await supabase
    .from('leads')
    .insert({
      profession: job.profession,
      city: job.city,
      parsed_summary: job.description,
      status: 'parsed',
      urgency: job.urgency === 'today' ? 'hot' : job.urgency === 'this_week' ? 'warm' : 'cold',
      sender_id: phone.replace('+', '') + '@c.us',
      raw_message: `[Posted via WhatsApp Bot] ${job.description}`,
    })
    .select('id')
    .single();

  if (error || !lead) {
    console.error('[post-job] Insert error:', error);
    await sendText(phone, `Failed to publish. Please try again.`);
    return;
  }

  // Find matching contractors (same profession, overlapping zip codes area)
  const { data: matches } = await supabase
    .from('contractors')
    .select('user_id, professions, zip_codes')
    .contains('professions', [job.profession])
    .eq('is_active', true)
    .eq('wa_notify', true)
    .neq('user_id', userId);

  const matchedIds = (matches || []).map(c => c.user_id);

  // Update lead with matched contractors
  if (matchedIds.length > 0) {
    await supabase.from('leads').update({
      status: 'sent',
      matched_contractors: matchedIds,
      sent_to_count: matchedIds.length,
    }).eq('id', lead.id);

    // Send notifications to matching contractors
    for (const contractor of (matches || [])) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('whatsapp_phone')
        .eq('id', contractor.user_id)
        .single();

      if (profile?.whatsapp_phone) {
        await sendLeadNotification(
          profile.whatsapp_phone,
          lead.id,
          contractor.user_id,
          job.profession,
          job.city,
          job.description,
          'Contractor Network',
          phone.replace('+', ''),
        );
      }
    }
  }

  const budgetLine = job.budget ? `\n💰 *Budget:* ${job.budget}` : '';
  await sendText(
    phone,
    `✅ *Job Published!*\n\n${emoji} *${profLabel}* — ${job.city}\n📝 ${job.description}\n⏰ ${URGENCY_LABELS[job.urgency] ?? job.urgency}${budgetLine}\n\n📨 Sent to *${matchedIds.length}* matching contractors.\nYou'll get WhatsApp messages from interested pros!`,
  );

  console.log(`[post-job] Published lead ${lead.id} by ${userId}, sent to ${matchedIds.length} contractors`);
}

// ── Helpers ─────────────────────────────────────────────────────────────────

async function findProfile(phone: string) {
  const { data } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('whatsapp_phone', phone)
    .maybeSingle();
  return data;
}

async function findProfileByPhone(phone: string) {
  const stripped = phone.replace(/^\+/, '');
  const { data } = await supabase
    .from('profiles')
    .select('id, full_name')
    .or(`phone.eq.${phone},phone.eq.${stripped}`)
    .maybeSingle();
  return data;
}

// ── Prospect auto-creation + message logging ──────────────────────────────

// prospectId is now passed through function parameters instead of a module-level variable

async function findOrCreateProspect(phone: string): Promise<string | null> {
  const stripped = phone.replace(/^\+/, '');
  const waId = stripped + '@c.us';

  // Try existing prospect
  const { data: existing } = await supabase
    .from('prospects')
    .select('id')
    .eq('wa_id', waId)
    .maybeSingle();

  if (existing) return existing.id;

  // Also try by phone field
  const { data: byPhone } = await supabase
    .from('prospects')
    .select('id')
    .or(`phone.eq.+${stripped},phone.eq.${stripped}`)
    .maybeSingle();

  if (byPhone) return byPhone.id;

  // Create new prospect
  const { data: created, error } = await supabase
    .from('prospects')
    .insert({
      wa_id: waId,
      phone: phone.startsWith('+') ? phone : '+' + phone,
      display_name: phone,
      stage: 'prospect',
      source: 'whatsapp_inbound',
    })
    .select('id')
    .single();

  if (error) {
    console.error('[prospect] Create error:', error);
    return null;
  }
  console.log(`[prospect] Created ${created.id} for ${phone}`);
  return created.id;
}

function logMessage(
  prospectId: string,
  direction: 'incoming' | 'outgoing',
  content: string,
  opts?: { messageType?: string; waMessageId?: string; templateId?: string },
): void {
  // Fire-and-forget — never block webhook response
  supabase.from('prospect_messages').insert({
    prospect_id: prospectId,
    direction,
    message_type: opts?.messageType ?? 'text',
    content: content || '(empty)',
    channel: 'twilio',
    wa_message_id: opts?.waMessageId ?? null,
    template_id: opts?.templateId ?? null,
    sent_at: new Date().toISOString(),
  }).then(({ error }) => {
    if (error) console.error('[msg-log]', error.message);
  });
}

async function checkSubscription(userId: string): Promise<boolean> {
  const { data } = await supabase
    .from('subscriptions')
    .select('status')
    .eq('user_id', userId)
    .in('status', ['active', 'trialing'])
    .maybeSingle();
  return !!data;
}

async function sendText(to: string, body: string, prospectId?: string | null): Promise<void> {
  const toWa = to.startsWith('whatsapp:') ? to : `whatsapp:${to.startsWith('+') ? to : '+' + to}`;
  const formData = new URLSearchParams({ From: TWILIO_FROM, To: toWa, Body: body });

  try {
    const res = await fetch(getTwilioUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: getTwilioAuth() },
      body: formData.toString(),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error(`[twilio] Send failed: ${err}`);
    }
  } catch (err) {
    console.error(`[twilio] Network error:`, err);
  }

  // Log outgoing message
  if (prospectId) {
    logMessage(prospectId, 'outgoing', body);
  }
}

async function sendButtons(to: string, contentSid: string, vars?: Record<string, string>, prospectId?: string | null): Promise<void> {
  const toWa = to.startsWith('whatsapp:') ? to : `whatsapp:${to.startsWith('+') ? to : '+' + to}`;
  const formData = new URLSearchParams({ From: TWILIO_FROM, To: toWa, ContentSid: contentSid });
  if (vars) {
    formData.set('ContentVariables', JSON.stringify(vars));
  }

  try {
    const res = await fetch(getTwilioUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: getTwilioAuth() },
      body: formData.toString(),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error(`[twilio] Send buttons failed: ${err}`);
      // Fallback to plain text if content template fails
      if (vars) {
        const fallbackBody = Object.values(vars).join('\n');
        await sendText(to, fallbackBody, prospectId);
      }
    }
  } catch (err) {
    console.error(`[twilio] Network error:`, err);
  }

  // Log outgoing button message
  if (prospectId) {
    const content = vars ? `[Buttons] ${JSON.stringify(vars)}` : `[Template: ${contentSid}]`;
    logMessage(prospectId, 'outgoing', content, { templateId: contentSid });
  }
}

function twiml(): Response {
  return new Response('<Response></Response>', {
    status: 200,
    headers: { 'Content-Type': 'text/xml' },
  });
}
