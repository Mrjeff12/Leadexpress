import { supabase } from '../lib/supabase.js';
import { sendText } from '../lib/twilio.js';
import { resolveLocale, type Lang } from '../lib/i18n.js';
import pino from 'pino';

const log = pino({ name: 'lead-action' });

function buildContactLink(senderId: string | null, profession: string, city: string | null, lang: Lang): string | null {
  if (!senderId) return null;
  const phone = senderId.replace(/@.*$/, '');
  if (!phone || phone.length < 8) return null;

  const msgs: Record<Lang, string> = {
    en: `Hi! I'm a ${profession} contractor reaching out about your request${city ? ` in ${city}` : ''}. I'm available — when works for you?`,
    he: `שלום! אני טכנאי ${profession} ואני פונה לגבי הבקשה שלך${city ? ` ב-${city}` : ''}. אני זמין — מתי נוח לך?`,
    es: `¡Hola! Soy contratista de ${profession} y me comunico por tu solicitud${city ? ` en ${city}` : ''}. Estoy disponible — ¿cuándo te conviene?`,
  };

  const msg = encodeURIComponent(msgs[lang]);
  return `https://wa.me/${phone}?text=${msg}`;
}

async function getProfileLocale(phone: string): Promise<Lang> {
  const { data } = await supabase
    .from('profiles')
    .select('preferred_locale')
    .eq('whatsapp_phone', phone)
    .maybeSingle();
  return resolveLocale(phone, data?.preferred_locale ?? null, null);
}

export async function handleLeadClaim(phone: string, leadId: string): Promise<void> {
  const l = await getProfileLocale(phone);

  const { data: lead } = await supabase
    .from('leads')
    .select('id, profession, city, sender_id, parsed_summary')
    .eq('id', leadId)
    .maybeSingle();

  if (!lead) {
    const msgs: Record<Lang, string> = {
      en: 'This lead is no longer available.',
      he: 'הליד הזה כבר לא זמין.',
      es: 'Este lead ya no está disponible.',
    };
    await sendText(phone, msgs[l]);
    return;
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('whatsapp_phone', phone)
    .maybeSingle();

  if (profile) {
    supabase.from('pipeline_events').insert({
      stage: 'lead_claimed',
      lead_id: leadId,
      detail: { contractor_id: profile.id, channel: 'whatsapp' },
    }).then(() => {});
  }

  const typedLead = lead as { sender_id?: string; profession?: string; city?: string };
  const link = buildContactLink(typedLead.sender_id ?? null, typedLead.profession ?? '', typedLead.city ?? null, l);

  const msgs: Record<Lang, { withLink: string; noLink: string }> = {
    en: {
      withLink: `✅ Great! Here's the contact:\n\n👉 ${link}\n\nGood luck! 🤞`,
      noLink: '✅ Lead claimed! Good luck 🤞',
    },
    he: {
      withLink: `✅ מעולה! הנה הקשר:\n\n👉 ${link}\n\nבהצלחה! 🤞`,
      noLink: '✅ הליד נתפס! בהצלחה 🤞',
    },
    es: {
      withLink: `✅ ¡Genial! Aquí está el contacto:\n\n👉 ${link}\n\n¡Buena suerte! 🤞`,
      noLink: '✅ ¡Lead reclamado! Buena suerte 🤞',
    },
  };

  await sendText(phone, link ? msgs[l].withLink : msgs[l].noLink);
  log.info({ leadId, phone }, 'Lead claim handled');
}

export async function handleLeadPass(phone: string, leadId: string): Promise<void> {
  const l = await getProfileLocale(phone);

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('whatsapp_phone', phone)
    .maybeSingle();

  if (profile) {
    await supabase.from('pipeline_events').insert({
      stage: 'lead_passed',
      detail: { lead_id: leadId, contractor_id: profile.id },
    });
  }

  const msgs: Record<Lang, string> = {
    en: 'OK, skipped. Next one coming! 👍',
    he: 'אוקיי, דילגנו. הבא בתור! 👍',
    es: 'OK, omitido. ¡El siguiente viene! 👍',
  };
  await sendText(phone, msgs[l]);
}
