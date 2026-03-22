/**
 * Teaser Lead Logic — for non-paying / expired users
 *
 * When a lead matches a non-paying user, send a "teaser" instead of full details.
 * Max 3 teasers per week per user.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const MAX_TEASERS_PER_WEEK = 3;

interface TeaserCheck {
  isTeaser: boolean;
  blocked: boolean;
  remaining: number;
}

/**
 * Check if a user should receive a teaser (non-paying) or full lead.
 */
export async function shouldSendTeaser(
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<TeaserCheck> {
  // Check active subscription
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('status')
    .eq('user_id', userId)
    .in('status', ['active', 'trialing'])
    .maybeSingle();

  if (sub) {
    return { isTeaser: false, blocked: false, remaining: 0 };
  }

  // Non-paying user — check teaser count this week
  const { data: profile } = await supabase
    .from('profiles')
    .select('teasers_sent_this_week, teaser_week_start')
    .eq('id', userId)
    .single();

  if (!profile) {
    return { isTeaser: true, blocked: false, remaining: MAX_TEASERS_PER_WEEK - 1 };
  }

  // Reset counter if new week (Monday-based)
  const now = new Date();
  const monday = getMonday(now);
  const weekStart = profile.teaser_week_start ? new Date(profile.teaser_week_start) : null;
  const isNewWeek = !weekStart || weekStart < monday;

  let count = isNewWeek ? 0 : (profile.teasers_sent_this_week ?? 0);

  if (count >= MAX_TEASERS_PER_WEEK) {
    return { isTeaser: true, blocked: true, remaining: 0 };
  }

  return { isTeaser: true, blocked: false, remaining: MAX_TEASERS_PER_WEEK - count - 1 };
}

/**
 * Increment teaser counter after sending one.
 */
export async function recordTeaserSent(
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<void> {
  const now = new Date();
  const monday = getMonday(now);

  const { data: profile } = await supabase
    .from('profiles')
    .select('teasers_sent_this_week, teaser_week_start')
    .eq('id', userId)
    .single();

  const weekStart = profile?.teaser_week_start ? new Date(profile.teaser_week_start) : null;
  const isNewWeek = !weekStart || weekStart < monday;

  await supabase
    .from('profiles')
    .update({
      teasers_sent_this_week: isNewWeek ? 1 : (profile?.teasers_sent_this_week ?? 0) + 1,
      teaser_week_start: monday.toISOString(),
    })
    .eq('id', userId);
}

/**
 * Build teaser message for a non-paying user.
 */
export function buildTeaserMessage(
  trade: string,
  county: string,
  timeAgo: string,
  remaining: number,
): string {
  return [
    `🔔 A *${trade}* job was just posted in *${county}* that matches your profile.`,
    ``,
    `Posted ${timeAgo}`,
    ``,
    `→ Upgrade to see full details and contact them:`,
    `https://app.leadexpress.co.il/subscription`,
    ``,
    remaining > 0
      ? `You have ${remaining} free preview${remaining === 1 ? '' : 's'} left this week.`
      : `This was your last free preview this week.`,
  ].join('\n');
}

function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);
  return date;
}
