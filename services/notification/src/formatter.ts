/**
 * Lead message formatter with inline keyboard buttons for Telegram.
 */

const PROFESSION_EMOJI: Record<string, string> = {
  hvac: '\u2744\uFE0F',
  renovation: '\uD83D\uDD28',
  fencing: '\uD83E\uDDF1',
  cleaning: '\u2728',
  plumbing: '\uD83D\uDEB0',
  electrical: '\u26A1',
  landscaping: '\uD83C\uDF3F',
  roofing: '\uD83C\uDFE0',
  painting: '\uD83C\uDFA8',
  other: '\uD83D\uDCCB',
};

export interface LeadData {
  profession: string;
  summary: string;
  city: string | null;
  zip_code: string;
  contact_name: string | null;
  contact_phone: string | null;
  budget_min: number | null;
  budget_max: number | null;
  urgency: 'hot' | 'warm' | 'cold';
  source_name: string | null;
}

export interface FormattedLead {
  text: string;
  buttons: { text: string; callback_data?: string; url?: string }[][];
}

/**
 * Formats a lead into an HTML Telegram message with inline keyboard buttons.
 */
export function formatLeadMessage(lead: LeadData, leadId?: string): FormattedLead {
  const emoji = PROFESSION_EMOJI[lead.profession] ?? '\uD83D\uDCCB';
  const professionLabel = lead.profession.toUpperCase();
  const location = [lead.city, lead.zip_code].filter(Boolean).join(', ');

  let budgetLine = '';
  if (lead.budget_min != null && lead.budget_max != null) {
    budgetLine = `\uD83D\uDCB0 <b>Budget:</b> $${lead.budget_min.toLocaleString()}\u2013$${lead.budget_max.toLocaleString()}`;
  } else if (lead.budget_min != null) {
    budgetLine = `\uD83D\uDCB0 <b>Budget:</b> $${lead.budget_min.toLocaleString()}+`;
  } else if (lead.budget_max != null) {
    budgetLine = `\uD83D\uDCB0 <b>Budget:</b> up to $${lead.budget_max.toLocaleString()}`;
  }

  const urgencyEmoji: Record<string, string> = {
    hot: '\uD83D\uDD25',
    warm: '\u26A1',
    cold: '\u2744\uFE0F',
  };

  const urgencyLabel: Record<string, string> = {
    hot: 'HOT \u2014 Needs ASAP',
    warm: 'WARM \u2014 This Week',
    cold: 'COLD \u2014 Flexible',
  };

  const contactLine = lead.contact_name
    ? `\uD83D\uDC64 <b>Contact:</b> ${lead.contact_name}`
    : '';

  const phoneLine = lead.contact_phone
    ? `\uD83D\uDCF1 <b>Phone:</b> ${lead.contact_phone}`
    : '';

  const sourceLine = lead.source_name
    ? `\uD83C\uDFF7\uFE0F Source: <i>${lead.source_name}</i>`
    : '';

  const lines = [
    `${urgencyEmoji[lead.urgency] ?? '\uD83D\uDD25'} <b>NEW LEAD \u2014 ${professionLabel}</b>`,
    '',
    `${emoji} <i>"${lead.summary}"</i>`,
    '',
    `\uD83D\uDCCD <b>Location:</b> ${location}`,
    contactLine,
    phoneLine,
    budgetLine,
    '',
    `\u26A1 Urgency: <b>${urgencyLabel[lead.urgency] ?? lead.urgency}</b>`,
    sourceLine,
    '',
    `\u23F0 ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit', hour12: true })} ET`,
  ];

  const text = lines
    .filter((line) => line !== undefined && line !== null && !(line === '' && false))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  const claimData = leadId ? `claim:${leadId}` : 'claim:unknown';
  const passData = leadId ? `pass:${leadId}` : 'pass:unknown';

  const buttons = [
    [
      { text: '\u2705 Claim This Lead', callback_data: claimData },
      { text: '\u274C Pass', callback_data: passData },
    ],
  ];

  // If we have a phone number, add a "Call" button (shows phone via callback)
  if (lead.contact_phone) {
    const callData = leadId ? `call:${leadId}` : 'call:unknown';
    buttons.push([
      { text: `\uD83D\uDCDE Call ${lead.contact_phone}`, callback_data: callData },
    ]);
  }

  return { text, buttons };
}
