import { sendText } from '../lib/twilio.js';
import { t, lang } from '../lib/i18n.js';
import { getState, setState, newOnboardState } from '../lib/state.js';
import { callOpenAI, extractTextFromResponse } from '../agents/client.js';
import pino from 'pino';

const log = pino({ name: 'sales' });

const SALES_INSTRUCTIONS = `Your name is Rebeca, from MasterLeadFlow.
We help contractors find new jobs every day by scanning WhatsApp groups.

Your goal: understand if this person is a contractor, and if so, get them to sign up for a free trial.

RULES:
- Default: HEBREW. Switch to English only if the user writes in English.
- Keep messages SHORT — 1-3 sentences.
- Be warm, direct, conversational. Like a friend, not a salesperson.
- If they express interest or say YES, tell them to say "כן" or "yes" to start.
- If they ask how it works: "We scan WhatsApp groups in your area and send you matching job requests — no searching needed."
- If they're clearly not a contractor or not interested, be polite and end the conversation.`;

/**
 * Handle a message from an unknown user (no profile found).
 * Uses AI for natural conversation and leads toward registration.
 */
export async function handleSales(phone: string, text: string): Promise<void> {
  const l = lang(phone);

  let state = await getState(phone);
  if (!state) {
    state = newOnboardState(null, null, l);
    await setState(phone, state);

    const greeting = l === 'he'
      ? 'היי! 👋 אני רבקה מ-MasterLeadFlow.\nאנחנו עוזרים לקבלנים למצוא עבודות חדשות כל יום.\n\nרוצה לשמוע איך? ✍️'
      : 'Hey! 👋 I\'m Rebeca from MasterLeadFlow.\nWe help contractors find new jobs every day.\n\nWant to hear how? Just reply!';
    await sendText(phone, greeting);
    return;
  }

  try {
    const aiResponse = await callOpenAI({
      instructions: SALES_INSTRUCTIONS,
      userMessage: text,
      state,
      maxTokens: 300,
    });

    state.openaiResponseId = aiResponse.id;
    await setState(phone, state);

    const reply = extractTextFromResponse(aiResponse);
    if (reply) {
      await sendText(phone, reply);
    } else {
      await sendText(phone, t(phone, 'error_generic'));
    }
  } catch (err) {
    log.error({ err, phone }, 'Sales AI call failed');
    await sendText(phone, t(phone, 'error_generic'));
  }
}
