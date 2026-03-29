import { Hono } from 'hono';
import { validateTwilioSignature } from './lib/twilio.js';
import { routeMessage } from './router.js';
import pino from 'pino';

const log = pino({ name: 'server' });

type Variables = { twilioBody: Record<string, string> };

export function createServer(): Hono<{ Variables: Variables }> {
  const app = new Hono<{ Variables: Variables }>();

  // Health check — no auth required
  app.get('/health', (c) => c.json({ status: 'ok', service: 'rebeca' }));

  // Twilio signature validation middleware
  app.use('/webhooks/*', async (c, next) => {
    const signature = c.req.header('x-twilio-signature') ?? '';
    const url = c.req.url;

    // Parse form body for signature validation
    const body = await c.req.parseBody();
    const params: Record<string, string> = {};
    for (const [k, v] of Object.entries(body)) {
      if (typeof v === 'string') params[k] = v;
    }

    const isValid = validateTwilioSignature(url, params, signature);
    if (!isValid) {
      log.warn({ url, signature }, 'Twilio signature validation FAILED');
      return c.text('Forbidden', 403);
    }

    c.set('twilioBody', params);
    await next();
  });

  // Inbound WhatsApp webhook
  app.post('/webhooks/whatsapp', async (c) => {
    const body = c.get('twilioBody') as Record<string, string>;
    const from = (body.From ?? '').replace('whatsapp:', '');
    const text = body.Body ?? '';
    const buttonPayload = body.ButtonPayload ?? body.ButtonText ?? '';

    log.info({ phone: from, text: text.substring(0, 50) }, 'Inbound WhatsApp message');

    // Process async — respond to Twilio immediately
    routeMessage(from, text, buttonPayload).catch((err) => {
      log.error({ err, phone: from }, 'Error in routeMessage');
    });

    c.header('Content-Type', 'text/xml');
    return c.body('<Response></Response>', 200);
  });

  return app;
}
