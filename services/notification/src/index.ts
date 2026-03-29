import pino from 'pino';
import { config } from './config.js';
import { createNotificationWorker } from './worker.js';
import { createPushWorker } from './push-worker.js';

const log = pino({ name: 'notification-service' });

log.info(
  {
    redis: `${config.redis.host}:${config.redis.port}`,
    concurrency: config.worker.concurrency,
    queues: [config.queues.notifications, config.queues.pushNotifications],
    vapidConfigured: !!(config.vapid.publicKey && config.vapid.privateKey),
  },
  'Starting notification service',
);

const { worker: telegramWorker, cleanup: cleanupTelegram } = createNotificationWorker(log);
const { worker: pushWorker, cleanup: cleanupPush } = createPushWorker(log);

async function shutdown(signal: string) {
  log.info({ signal }, 'Shutting down');
  await cleanupTelegram();
  await cleanupPush();
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

telegramWorker.on('ready', () => {
  log.info('Telegram notification worker ready');
});

if (pushWorker) {
  pushWorker.on('ready', () => {
    log.info('Push notification worker ready');
  });
}
