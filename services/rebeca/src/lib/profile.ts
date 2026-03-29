import { supabase } from './supabase.js';

export interface Profile {
  id: string;
  full_name: string;
  whatsapp_phone: string | null;
  phone: string | null;
}

export interface ContractorRecord {
  user_id: string;
  professions: string[];
  zip_codes: string[];
  wa_notify: boolean;
  available_today: boolean;
  wa_window_until: string | null;
}

/**
 * Find a profile by WhatsApp phone OR registered phone (single query).
 * Returns null if not found.
 */
export async function findProfile(phone: string): Promise<Profile | null> {
  const withPlus = phone.startsWith('+') ? phone : `+${phone}`;
  const withoutPlus = phone.replace(/^\+/, '');

  const { data } = await supabase
    .from('profiles')
    .select('id, full_name, whatsapp_phone, phone')
    .or(`whatsapp_phone.eq.${withPlus},whatsapp_phone.eq.${withoutPlus},phone.eq.${withPlus},phone.eq.${withoutPlus}`)
    .maybeSingle();
  return data ?? null;
}

/**
 * Link a WhatsApp phone to a profile (when found by phone field but
 * whatsapp_phone is not yet set).
 */
export async function linkWhatsAppPhone(profileId: string, phone: string): Promise<void> {
  await supabase
    .from('profiles')
    .update({ whatsapp_phone: phone })
    .eq('id', profileId)
    .is('whatsapp_phone', null);
}

/**
 * Get contractor record for a user.
 */
export async function getContractor(userId: string): Promise<ContractorRecord | null> {
  const { data } = await supabase
    .from('contractors')
    .select('user_id, professions, zip_codes, wa_notify, available_today, wa_window_until')
    .eq('user_id', userId)
    .maybeSingle();
  return data ?? null;
}

/**
 * Check if contractor is fully onboarded (has professions and zip_codes).
 */
export function isContractorSetUp(contractor: ContractorRecord | null): boolean {
  if (!contractor) return false;
  return contractor.professions.length > 0 && contractor.zip_codes.length > 0;
}

/**
 * Check subscription status. Returns true if active or trialing.
 */
export async function hasActiveSubscription(userId: string): Promise<boolean> {
  const { data } = await supabase
    .from('subscriptions')
    .select('status')
    .eq('user_id', userId)
    .in('status', ['active', 'trialing'])
    .maybeSingle();
  return !!data;
}

/**
 * Check if phone is opted out of WA messages.
 */
export async function isOptedOut(phone: string): Promise<boolean> {
  const withPlus = phone.startsWith('+') ? phone : `+${phone}`;
  const withoutPlus = phone.replace(/^\+/, '');
  const { data } = await supabase
    .from('wa_opt_outs')
    .select('id')
    .or(`phone.eq.${withPlus},phone.eq.${withoutPlus}`)
    .maybeSingle();
  return !!data;
}

/**
 * Record opt-out for a phone number.
 */
export async function recordOptOut(phone: string): Promise<void> {
  await supabase.from('wa_opt_outs').upsert({ phone, created_at: new Date().toISOString() });
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('whatsapp_phone', phone)
    .maybeSingle();
  if (profile?.id) {
    await supabase
      .from('contractors')
      .update({ wa_notify: false, is_active: false })
      .eq('user_id', profile.id);
  }
}
