import { config } from '../config.js';
import type { BotState } from '../lib/state.js';

const OPENAI_URL = 'https://api.openai.com/v1/responses';
const SESSION_MAX_AGE_DAYS = 25;

export interface AIResponse {
  id: string;
  output: Array<{
    type: string;
    name?: string;
    arguments?: string;
    content?: Array<{ type: string; text?: string }>;
  }>;
  output_text?: string;
}

/**
 * Call OpenAI Responses API.
 * Chains conversation via previous_response_id if session is fresh.
 */
export async function callOpenAI(opts: {
  instructions: string;
  userMessage: string;
  tools?: unknown[];
  state: BotState;
  maxTokens?: number;
}): Promise<AIResponse> {
  const { instructions, userMessage, tools, state, maxTokens = 500 } = opts;

  const sessionAgeMs = Date.now() - new Date(state.sessionStartedAt).getTime();
  const sessionAgeDays = sessionAgeMs / (1000 * 60 * 60 * 24);
  const isFresh = sessionAgeDays < SESSION_MAX_AGE_DAYS;

  const body: Record<string, unknown> = {
    model: 'gpt-4o-mini',
    instructions,
    input: [{ role: 'user', content: userMessage }],
    tools: tools && tools.length > 0 ? tools : undefined,
    store: true,
    max_output_tokens: maxTokens,
    temperature: 0.7,
  };

  if (isFresh && state.openaiResponseId) {
    body.previous_response_id = state.openaiResponseId;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  let res: Response;
  try {
    res = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.openai.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    const errText = await res.text();
    // If the error is about previous_response_id, retry without it
    if (state.openaiResponseId && errText.includes('previous_response')) {
      delete body.previous_response_id;
      const retryController = new AbortController();
      const retryTimeout = setTimeout(() => retryController.abort(), 30_000);
      try {
        const retry = await fetch(OPENAI_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${config.openai.apiKey}`,
          },
          body: JSON.stringify(body),
          signal: retryController.signal,
        });
        if (!retry.ok) throw new Error(`OpenAI error after retry: ${await retry.text()}`);
        return await retry.json() as AIResponse;
      } finally {
        clearTimeout(retryTimeout);
      }
    }
    throw new Error(`OpenAI error ${res.status}: ${errText}`);
  }

  return await res.json() as AIResponse;
}

/**
 * Extract the text message from an OpenAI response output array.
 */
export function extractTextFromResponse(response: AIResponse): string | null {
  for (const item of response.output ?? []) {
    if (item.type === 'message') {
      const textItem = item.content?.find(c => c.type === 'output_text' || c.type === 'text');
      if (textItem?.text) return textItem.text;
    }
  }
  return response.output_text ?? null;
}

/**
 * Extract function calls from an OpenAI response output array.
 */
export function extractToolCalls(response: AIResponse): Array<{ name: string; args: Record<string, unknown> }> {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  for (const item of response.output ?? []) {
    if (item.type === 'function_call' && item.name) {
      try {
        calls.push({ name: item.name, args: JSON.parse(item.arguments ?? '{}') });
      } catch {
        // skip malformed
      }
    }
  }
  return calls;
}
