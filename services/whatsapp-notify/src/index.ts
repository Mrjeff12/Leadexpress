import { serve } from '@hono/node-server';
import pino from 'pino';
import Redis from 'ioredis';
import { config } from './config.js';
import { createWebhookApp } from './webhook.js';
import { createWaNotificationWorker } from './worker.js';
import { startCheckinCron } from './checkin-cron.js';

const log = pino({ name: 'whatsapp-notify' });

const redis = new Redis({
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
  maxRetriesPerRequest: config.redis.maxRetriesPerRequest,
});

log.info(
  {
    redis: `${config.redis.host}:${config.redis.port}`,
    twilioSid: config.twilio.accountSid.slice(0, 8) + '...',
    waFrom: config.twilio.whatsappFrom,
    checkinCron: config.cron.checkinSchedule,
    timezone: config.cron.timezone,
    port: config.server.port,
  },
  'Starting WhatsApp notification service (Twilio)',
);

// 1. Start BullMQ worker for sending lead messages
const { worker, cleanup: cleanupWorker } = createWaNotificationWorker(log);

// 2. Start daily check-in cron job
const cronTask = startCheckinCron(log);

// 3. Start Hono HTTP server for Twilio webhook
const app = createWebhookApp(log, redis);
const server = serve({ fetch: app.fetch, port: config.server.port }, (info) => {
  log.info({ port: info.port }, 'Webhook server listening');
});

// Graceful shutdown
async function shutdown(signal: string) {
  log.info({ signal }, 'Shutting down');
  cronTask.stop();
  await cleanupWorker();
  server.close();
  redis.disconnect();
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

process.on('unhandledRejection', (err) => {
  log.fatal({ err }, 'Unhandled rejection — shutting down');
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  log.fatal({ err }, 'Uncaught exception — shutting down');
  process.exit(1);
});

worker.on('ready', () => {
  log.info('WhatsApp notification worker ready');
});
