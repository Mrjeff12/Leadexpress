import { createClient } from '@supabase/supabase-js';
import { logger } from './logger.js';
import { startListener, stopListener } from './listener.js';
import { startHeartbeat, stopHeartbeat } from './health.js';
import { closeQueue, getQueue } from './queue.js';
import { startAPI, stopAPI } from './api.js';
import { config } from './config.js';

// Global Supabase client for crash reporting
const supabase = createClient(config.supabase.url, config.supabase.serviceKey);

async function logCrash(source: string, error: unknown): Promise<void> {
  try {
    await supabase.from('pipeline_events').insert({
      stage: 'listener_crash',
      detail: {
        source,
        error: String(error),
        stack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString(),
      },
    });
  } catch { /* best effort */ }
}

async function main(): Promise<void> {
  logger.info(
    { accountId: config.whatsapp.accountId },
    'Starting wa-listener service'
  );

  // Startup diagnostic: log to Supabase
  await supabase.from('pipeline_events').insert({
    stage: 'listener_started',
    detail: {
      redis_host: config.redis.host,
      redis_port: config.redis.port,
      has_tls: !!(config.redis as any).tls,
      timestamp: new Date().toISOString(),
    },
  });

  logger.info('Phase 1: startAPI...');
  await startAPI(parseInt(process.env.WA_API_PORT ?? '3001', 10));

  logger.info('Phase 2: startHeartbeat...');
  await startHeartbeat();

  logger.info('Phase 3: startListener...');
  await startListener();

  logger.info('Phase 4: testing BullMQ...');
  // Test BullMQ connection
  try {
    const q = getQueue();
    await q.add('health-check', { messageId: 'test', groupId: 'test', body: 'startup-test', sender: null, timestamp: Date.now(), accountId: 'test' } as any, {
      jobId: 'startup-test',
      removeOnComplete: true,
    });
    logger.info('BullMQ test job enqueued successfully');
    await supabase.from('pipeline_events').insert({
      stage: 'listener_queue_ok',
      detail: { queue: 'raw-messages', timestamp: new Date().toISOString() },
    });
  } catch (queueErr) {
    logger.error({ err: queueErr }, 'BullMQ test enqueue FAILED');
    await supabase.from('pipeline_events').insert({
      stage: 'listener_queue_failed',
      detail: { error: String(queueErr), timestamp: new Date().toISOString() },
    });
  }

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
  logCrash('unhandledRejection', reason).catch(() => {});
});

process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught exception — shutting down');
  logCrash('uncaughtException', err).finally(() => {
    process.exit(1);
  });
});

main().catch((err) => {
  logger.fatal({ err }, 'Failed to start wa-listener');
  logCrash('main', err).finally(() => {
    process.exit(1);
  });
});
