import { serve } from '@hono/node-server';
import pino from 'pino';
import Redis from 'ioredis';
import { config } from './config.js';
import { createServer } from './server.js';
import { createWorker } from './outbound/worker.js';
import { startCheckinCron } from './outbound/checkin.js';

const log = pino({ name: 'rebeca' });

const redis = new Redis(process.env.REDIS_URL ?? {
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
  maxRetriesPerRequest: null,
} as never);

log.info({
  port: config.server.port,
  checkinCron: config.cron.checkinSchedule,
  timezone: config.cron.timezone,
}, 'Starting Rebeca service');

// 1. BullMQ outbound worker
const { worker, cleanup: cleanupWorker } = createWorker(redis);
worker.on('ready', () => log.info('WA notification worker ready'));

// 2. Daily check-in cron
const cronTask = startCheckinCron();

// 3. HTTP server (Twilio inbound webhook)
const app = createServer();
const server = serve({ fetch: app.fetch, port: config.server.port }, (info) => {
  log.info({ port: info.port }, 'Webhook server listening');
});

async function shutdown(signal: string): Promise<void> {
  log.info({ signal }, 'Shutting down gracefully');
  cronTask.stop();
  await cleanupWorker();
  server.close();
  redis.disconnect();
  process.exit(0);
}

process.on('SIGINT', () => { shutdown('SIGINT').catch(() => process.exit(1)); });
process.on('SIGTERM', () => { shutdown('SIGTERM').catch(() => process.exit(1)); });

process.on('unhandledRejection', (err) => {
  log.fatal({ err }, 'Unhandled rejection');
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  log.fatal({ err }, 'Uncaught exception');
  process.exit(1);
});
