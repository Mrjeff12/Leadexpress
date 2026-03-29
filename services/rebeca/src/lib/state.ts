import { supabase } from './supabase.js';

export interface BotState {
  step: 'ai' | 'confirm' | 'groups' | 'menu' | 'post_job' | 'lead_pending';
  userId: string | null;
  prospectId: string | null;
  language: 'he' | 'en';
  openaiResponseId: string | null;
  sessionStartedAt: string;
  collected: {
    name?: string;
    professions?: string[];
    state?: string;
    cities?: string[];
    workingDays?: number[];
  };
  extra?: Record<string, unknown>;
}

/** Load current bot state for a phone number. Returns null if none. */
export async function getState(phone: string): Promise<BotState | null> {
  const { data } = await supabase
    .from('wa_onboard_state')
    .select('step, data')
    .eq('phone', phone)
    .maybeSingle();

  if (!data) return null;

  const d = data.data as Record<string, unknown>;
  return {
    step: data.step as BotState['step'],
    userId: (d.userId as string | null) ?? null,
    prospectId: (d.prospectId as string | null) ?? null,
    language: (d.language as 'he' | 'en') ?? 'en',
    openaiResponseId: (d.openaiResponseId as string | null) ?? null,
    sessionStartedAt: (d.sessionStartedAt as string) ?? new Date().toISOString(),
    collected: (d.collected as BotState['collected']) ?? {},
    extra: (d.extra as Record<string, unknown>) ?? undefined,
  };
}

/** Upsert (create or update) bot state for a phone number. */
export async function setState(phone: string, state: BotState): Promise<void> {
  await supabase.from('wa_onboard_state').upsert({
    phone,
    step: state.step,
    data: {
      userId: state.userId,
      prospectId: state.prospectId,
      language: state.language,
      openaiResponseId: state.openaiResponseId,
      sessionStartedAt: state.sessionStartedAt,
      collected: state.collected,
      extra: state.extra,
    },
    updated_at: new Date().toISOString(),
  });
}

/** Update only the collected fields and openaiResponseId, keeping other state intact. */
export async function updateCollected(
  phone: string,
  patch: Partial<BotState['collected']>,
  openaiResponseId?: string,
): Promise<void> {
  const current = await getState(phone);
  if (!current) return;
  await setState(phone, {
    ...current,
    collected: { ...current.collected, ...patch },
    openaiResponseId: openaiResponseId ?? current.openaiResponseId,
  });
}

/** Delete bot state — user is fully onboarded or opted out. */
export async function clearState(phone: string): Promise<void> {
  await supabase.from('wa_onboard_state').delete().eq('phone', phone);
}

/** Initialize fresh onboarding state for a new or returning user. */
export function newOnboardState(
  userId: string | null,
  prospectId: string | null,
  lang: 'he' | 'en',
  knownName?: string,
): BotState {
  return {
    step: 'ai',
    userId,
    prospectId,
    language: lang,
    openaiResponseId: null,
    sessionStartedAt: new Date().toISOString(),
    collected: knownName ? { name: knownName } : {},
  };
}

/** Check if the OpenAI session is still fresh (< 25 days old). */
export function isSessionFresh(state: BotState): boolean {
  const start = new Date(state.sessionStartedAt).getTime();
  const ageMs = Date.now() - start;
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  return ageDays < 25;
}
