import pino from 'pino';
import Redis from 'ioredis';
import { createClient } from '@supabase/supabase-js';
import { config } from './config.js';
import { startWorker } from './worker.js';

const log = pino({ name: 'parser' });

log.info('Starting Lead Parser service...');

// ---- Startup health check: verify Redis + Supabase connectivity ----
async function startupCheck(): Promise<void> {
  const supabase = createClient(config.supabase.url, config.supabase.serviceKey);

  // Log startup event to Supabase
  const { error: startupErr } = await supabase.from('pipeline_events').insert({
    stage: 'parser_started',
    detail: {
      redis_host: config.redis.host,
      redis_port: config.redis.port,
      has_tls: !!(config.redis as any).tls,
      timestamp: new Date().toISOString(),
    },
  });
  if (startupErr) {
    log.error({ startupErr }, 'Failed to log startup event to Supabase');
  } else {
    log.info('Startup event logged to Supabase');
  }

  // Test Redis connectivity
  try {
    const testRedis = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      maxRetriesPerRequest: null,
      ...((config.redis as any).tls ? { tls: {} } : {}),
      connectTimeout: 10000,
      lazyConnect: true,
    });

    await testRedis.connect();
    const pong = await testRedis.ping();
    log.info({ pong }, 'Redis connectivity OK');

    // Check queue state
    const waiting = await testRedis.llen('bull:raw-messages:wait');
    const active = await testRedis.llen('bull:raw-messages:active');
    const delayed = await testRedis.zcard('bull:raw-messages:delayed');
    const failed = await testRedis.zcard('bull:raw-messages:failed');
    log.info({ waiting, active, delayed, failed }, 'BullMQ queue state');

    // Log queue state to Supabase
    await supabase.from('pipeline_events').insert({
      stage: 'parser_redis_ok',
      detail: { pong, waiting, active, delayed, failed },
    });

    await testRedis.quit();
  } catch (redisErr) {
    log.error({ err: redisErr }, 'Redis connectivity FAILED');
    await supabase.from('pipeline_events').insert({
      stage: 'parser_redis_failed',
      detail: { error: String(redisErr) },
    });
  }
}

await startupCheck();

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
