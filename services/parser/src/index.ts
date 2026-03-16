import pino from 'pino';
import { startWorker } from './worker.js';

const log = pino({ name: 'parser' });

log.info('Starting Lead Parser service...');

const worker = startWorker();

// Graceful shutdown
async function shutdown(signal: string): Promise<void> {
  log.info({ signal }, 'Shutting down...');
  await worker.close();
  log.info('Worker closed — exiting');
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (err) => {
  log.fatal({ err }, 'Unhandled rejection');
  process.exit(1);
});
