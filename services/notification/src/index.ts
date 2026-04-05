import pino from 'pino';
import { config } from './config.js';
import { createPushWorker } from './push-worker.js';

const log = pino({ name: 'notification-service' });

log.info(
  {
    redis: `${config.redis.host}:${config.redis.port}`,
    concurrency: config.worker.concurrency,
    queues: [config.queues.pushNotifications],
    vapidConfigured: !!(config.vapid.publicKey && config.vapid.privateKey),
  },
  'Starting notification service',
);

const { worker: pushWorker, cleanup: cleanupPush } = createPushWorker(log);

async function shutdown(signal: string) {
  log.info({ signal }, 'Shutting down');
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

if (pushWorker) {
  pushWorker.on('ready', () => {
    log.info('Push notification worker ready');
  });
}
