import { logger } from './logger.js';
import { startListener, stopListener } from './listener.js';
import { startHeartbeat, stopHeartbeat } from './health.js';
import { closeQueue } from './queue.js';
import { startAPI, stopAPI } from './api.js';
import { config } from './config.js';

async function main(): Promise<void> {
  logger.info(
    { accountId: config.whatsapp.accountId },
    'Starting wa-listener service'
  );

  await startAPI(parseInt(process.env.WA_API_PORT ?? '3001', 10));
  await startHeartbeat();
  await startListener();

  logger.info('wa-listener service is running');
}

// ── Graceful shutdown ────────────────────────────────────────────────────────
async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'Received shutdown signal');

  try {
    await stopListener();
    await stopAPI();
    await stopHeartbeat();
    await closeQueue();
    logger.info('Graceful shutdown complete');
    process.exit(0);
  } catch (err) {
    logger.error({ err }, 'Error during shutdown');
    process.exit(1);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error({ err: reason }, 'Unhandled rejection');
});

process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught exception — shutting down');
  shutdown('uncaughtException').catch(() => process.exit(1));
});

main().catch((err) => {
  logger.fatal({ err }, 'Failed to start wa-listener');
  process.exit(1);
});
