import { supabase } from '../lib/supabase.js';
import { sendText } from '../lib/twilio.js';
import { t, lang } from '../lib/i18n.js';
import { getState, setState, clearState, updateCollected, newOnboardState } from '../lib/state.js';
import { callOpenAI, extractTextFromResponse, extractToolCalls } from '../agents/client.js';
import { ONBOARDING_TOOLS, ONBOARDING_AGENT_INSTRUCTIONS } from '../agents/tools.js';
import type { BotState } from '../lib/state.js';
import pino from 'pino';

const log = pino({ name: 'onboarding' });

const VALID_PROFESSIONS = new Set([
  'hvac','air_duct','renovation','plumbing','electrical','painting',
  'roofing','flooring','fencing','cleaning','locksmith','landscaping',
  'chimney','garage_doors','security','windows',
]);

// Map common aliases / AI variations to valid profession keys
const PROFESSION_ALIASES: Record<string, string> = {
  ac: 'hvac', air_conditioning: 'hvac', ac_repair: 'hvac', ac_cleaning: 'air_duct',
  duct_cleaning: 'air_duct', duct: 'air_duct', ducts: 'air_duct',
  remodel: 'renovation', remodeling: 'renovation', general_contractor: 'renovation',
  plumber: 'plumbing', electrician: 'electrical', painter: 'painting',
  roofer: 'roofing', roof: 'roofing', floors: 'flooring', floor: 'flooring',
  fence: 'fencing', fences: 'fencing', cleaner: 'cleaning', clean: 'cleaning',
  locks: 'locksmith', landscape: 'landscaping', lawn: 'landscaping',
  chimney_sweep: 'chimney', garage_door: 'garage_doors', garage: 'garage_doors',
  security_system: 'security', alarm: 'security', window: 'windows',
};

function normalizeProfession(p: string): string | null {
  const key = p.toLowerCase().trim();
  if (VALID_PROFESSIONS.has(key)) return key;
  if (PROFESSION_ALIASES[key]) return PROFESSION_ALIASES[key];
  return null;
}

const CITY_ZIPS: Record<string, string> = {
  miami: '33101', fort_lauderdale: '33301', hollywood: '33019',
  hialeah: '33010', coral_gables: '33146', boca_raton: '33431',
  west_palm: '33401', pompano: '33060', delray: '33444',
  homestead: '33030', doral: '33178', pembroke_pines: '33024',
  miramar: '33025', plantation: '33317', sunrise: '33325',
  weston: '33326', aventura: '33160', miami_beach: '33139',
  manhattan: '10001', brooklyn: '11201', queens: '11101',
  bronx: '10451', staten_island: '10301', yonkers: '10701',
  long_island: '11501', houston: '77001', dallas: '75201',
  san_antonio: '78201', austin: '78701',
};

const STATE_CITIES: Record<string, string[]> = {
  FL: ['miami','fort_lauderdale','hollywood','hialeah','coral_gables','boca_raton','west_palm','pompano','delray','homestead','doral','pembroke_pines','miramar','plantation','sunrise','weston','aventura','miami_beach'],
  NY: ['manhattan','brooklyn','queens','bronx','staten_island','yonkers','long_island'],
  TX: ['houston','dallas','san_antonio','austin'],
};

const CONFIRMATION_WORDS = new Set([
  'מאשר','כן','yes','confirm','ok','אוקי','נכון','בסדר','יאללה','אישור',
  'approve','correct','sure','בטח','כמובן','yep','yeah','y','1','👍',
]);

/**
 * Start onboarding for a user who has a profile but no contractor setup.
 */
export async function startOnboarding(phone: string, profile: { id: string; full_name: string }): Promise<void> {
  const l = lang(phone);
  const hasRealName = profile.full_name && !profile.full_name.startsWith('+');
  const firstName = hasRealName ? profile.full_name.split(' ')[0] : '';

  const state = newOnboardState(profile.id, null, l, hasRealName ? profile.full_name : undefined);
  await setState(phone, state);

  if (l === 'he') {
    await sendText(phone,
      hasRealName
        ? `היי ${firstName}! אני רבקה 👋\nספר לי מה אתה עושה ואיפה אתה עובד — ואני אתחיל לחפש לך עבודות.`
        : `היי! אני רבקה 👋\nספר לי מה השם שלך, מה אתה עושה ואיפה — ואני אתחיל לחפש לך עבודות.`,
    );
  } else {
    await sendText(phone,
      hasRealName
        ? `Hey ${firstName}! I'm Rebeca 👋\nTell me what you do and where you work — I'll start finding you jobs.`
        : `Hey! I'm Rebeca 👋\nTell me your name, what you do, and where — I'll start finding you jobs.`,
    );
  }
}

/**
 * Handle a message from a user who is currently in the onboarding flow.
 */
export async function handleOnboarding(phone: string, text: string): Promise<void> {
  const state = await getState(phone);
  if (!state) {
    await sendText(phone, t(phone, 'error_generic'));
    return;
  }

  const lower = text.trim().toLowerCase();
  if (['menu', 'help', 'cancel', 'stop', 'תפריט', 'ביטול'].includes(lower)) {
    await clearState(phone);
    await sendText(phone, t(phone, 'menu'));
    return;
  }

  const c = state.collected;
  const missing: string[] = [];
  if (!c.name) missing.push('name (full name)');
  if (!c.professions?.length) missing.push('professions (trade/s)');
  if (!c.state) missing.push('state (US state: FL, NY, TX)');
  if (!c.cities?.length) missing.push('cities (within their state)');
  if (!c.workingDays?.length) missing.push('working_days (days of week)');

  const contextBlock = `<onboarding_state>
Collected so far:
- Name: ${c.name || '(not yet)'}
- Professions: ${c.professions?.join(', ') || '(not yet)'}
- State: ${c.state || '(not yet)'}
- Cities: ${c.cities?.join(', ') || '(not yet)'}
- Working days: ${c.workingDays?.map(d => ['','Mon','Tue','Wed','Thu','Fri','Sat','Sun'][d]).join(', ') || '(not yet)'}

Still missing: ${missing.length > 0 ? missing.join(', ') : 'NOTHING — all fields collected, show summary and ask for confirmation'}
</onboarding_state>`;

  const instructions = ONBOARDING_AGENT_INSTRUCTIONS + '\n\n' + contextBlock;

  let aiResponse;
  try {
    aiResponse = await callOpenAI({
      instructions,
      userMessage: text,
      tools: ONBOARDING_TOOLS,
      state,
      maxTokens: 500,
    });
  } catch (err) {
    log.error({ err, phone }, 'OpenAI call failed');
    await sendText(phone, t(phone, 'profession_fallback'));
    return;
  }

  // Save session ID before processing output
  await updateCollected(phone, {}, aiResponse.id);

  // Process tool calls
  const toolCalls = extractToolCalls(aiResponse);
  for (const call of toolCalls) {
    if (call.name === 'save_profile') {
      const args = call.args as Partial<BotState['collected']> & { working_days?: number[] };
      const patch: Partial<BotState['collected']> = {};

      if (args.name) patch.name = args.name as string;
      if (Array.isArray(args.professions) && args.professions.length > 0) {
        const mapped = (args.professions as string[]).map(normalizeProfession).filter(Boolean) as string[];
        if (mapped.length > 0) patch.professions = [...new Set(mapped)];
      }
      if (args.state) patch.state = args.state as string;
      if (Array.isArray(args.cities) && args.cities.length > 0) {
        const cities = args.cities as string[];
        const hasAll = cities.some(c => /^all/i.test(c) || c === 'כל_האזורים' || c === 'all_areas');
        const currentState = (await getState(phone))?.collected.state;
        if (hasAll && currentState && STATE_CITIES[currentState]) {
          patch.cities = STATE_CITIES[currentState];
        } else {
          patch.cities = cities;
        }
      }
      if (Array.isArray(args.working_days) && args.working_days.length > 0) {
        patch.workingDays = args.working_days as number[];
      }

      await updateCollected(phone, patch);
      log.info({ phone, patch }, 'Profile data saved');
    }

    if (call.name === 'complete_onboarding') {
      const latest = await getState(phone);
      const col = latest?.collected ?? {};

      if (!col.professions?.length || !col.state || !col.cities?.length) {
        log.warn({ phone, col }, 'complete_onboarding called with incomplete data');
        await sendText(phone, t(phone, 'incomplete_profile'));
        return;
      }

      await executeCompletion(phone, latest!);
      return;
    }
  }

  // Fallback: if user sent a confirmation word and all fields are collected,
  // auto-complete even if the AI forgot to call complete_onboarding
  const latest = await getState(phone);
  const col = latest?.collected ?? {};
  if (CONFIRMATION_WORDS.has(lower) && col.professions?.length && col.state && col.cities?.length) {
    log.info({ phone }, 'Auto-completing onboarding (AI missed complete_onboarding tool call)');
    await executeCompletion(phone, latest!);
    return;
  }

  const text_response = extractTextFromResponse(aiResponse);
  if (text_response) {
    await sendText(phone, text_response);
  } else {
    await sendText(phone, t(phone, 'profession_fallback2'));
  }
}

async function executeCompletion(phone: string, state: BotState): Promise<void> {
  const { userId, collected, language: l } = state;
  if (!userId) {
    log.error({ phone }, 'executeCompletion called with no userId');
    return;
  }

  let zipCodes = (collected.cities ?? [])
    .map(city => CITY_ZIPS[city])
    .filter(Boolean) as string[];

  // If no zips resolved but we have a state, use all zips for that state
  if (zipCodes.length === 0 && collected.state && STATE_CITIES[collected.state]) {
    zipCodes = STATE_CITIES[collected.state].map(c => CITY_ZIPS[c]).filter(Boolean) as string[];
  }

  const { data: existing } = await supabase
    .from('contractors')
    .select('user_id, professions')
    .eq('user_id', userId)
    .maybeSingle();

  if ((existing as { professions?: string[] } | null)?.professions?.length) {
    await clearState(phone);
    const msg = l === 'he'
      ? '✅ הפרופיל שלך כבר מוגדר! תתחיל לקבל לידים.'
      : '✅ Your profile is already set up! You\'ll start receiving leads.';
    await sendText(phone, msg);
    return;
  }

  const { error } = existing
    ? await supabase.from('contractors').update({
        professions: collected.professions,
        zip_codes: zipCodes,
        working_days: collected.workingDays ?? [1,2,3,4,5],
        wa_notify: true,
        is_active: true,
      }).eq('user_id', userId)
    : await supabase.from('contractors').insert({
        user_id: userId,
        professions: collected.professions,
        zip_codes: zipCodes,
        working_days: collected.workingDays ?? [1,2,3,4,5],
        wa_notify: true,
        is_active: true,
      });

  if (error) {
    log.error({ error, userId }, 'Failed to save contractor');
    await sendText(phone, t(phone, 'error_generic'));
    return;
  }

  if (collected.name) {
    await supabase.from('profiles').update({ full_name: collected.name }).eq('id', userId);
  }

  await clearState(phone);

  const name = collected.name?.split(' ')[0] ?? '';
  const msg = l === 'he'
    ? `✅ ${name ? `${name}, ` : ''}הפרופיל שלך מוגדר!\nתתחיל לקבל לידים בהתאם למקצוע ואזור שלך.\n\nשלח *MENU* לאפשרויות.`
    : `✅ ${name ? `${name}, ` : ''}you're all set!\nYou'll start receiving leads matching your trade and area.\n\nSend *MENU* for options.`;

  await sendText(phone, msg);
  log.info({ phone, userId, professions: collected.professions, zipCodes }, 'Onboarding complete');
}
