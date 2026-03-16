import type { Logger } from 'pino'

export async function setupWebhook(
  token: string,
  webhookUrl: string,
  logger: Logger,
  secretToken?: string,
): Promise<void> {
  const url = `https://api.telegram.org/bot${token}/setWebhook`

  const payload: Record<string, unknown> = {
    url: `${webhookUrl}/webhook`,
    allowed_updates: ['message', 'callback_query'],
  }

  // secret_token tells Telegram to include it in every webhook request
  // as X-Telegram-Bot-Api-Secret-Token header, so we can verify authenticity.
  if (secretToken) {
    payload.secret_token = secretToken
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  const data = (await res.json()) as { ok: boolean; description?: string }

  if (!data.ok) {
    throw new Error(`Webhook setup failed: ${JSON.stringify(data)}`)
  }

  logger.info({ webhookUrl: `${webhookUrl}/webhook` }, 'Telegram webhook registered')
}
