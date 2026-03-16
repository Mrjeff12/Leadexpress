import pino from 'pino';
import { config } from './config.js';
import { createMatchingWorker } from './worker.js';

const log = pino({ name: 'matching-engine' });

log.info(
  {
    redis: `${config.redis.host}:${config.redis.port}`,
    concurrency: config.worker.concurrency,
    maxContractors: config.matching.maxContractorsPerLead,
    queue: config.queues.parsedLeads,
  },
  'Starting matching engine',
);

const { worker, cleanup } = createMatchingWorker(log);

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
  log.info('Matching worker ready — listening for parsed leads');
});
