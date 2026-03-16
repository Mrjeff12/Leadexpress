import pino from 'pino';
import { config } from './config.js';
import { createNotificationWorker } from './worker.js';

const log = pino({ name: 'notification-worker' });

log.info(
  {
    redis: `${config.redis.host}:${config.redis.port}`,
    concurrency: config.worker.concurrency,
    rateLimit: `${config.rateLimiter.max}/${config.rateLimiter.duration}ms`,
    queue: config.queues.notifications,
  },
  'Starting notification worker',
);

const { worker, cleanup } = createNotificationWorker(log);

async function shutdown(signal: string) {
  log.info({ signal }, 'Shutting down');
  await cleanup();
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
  log.info('Notification worker ready — listening for jobs');
});
