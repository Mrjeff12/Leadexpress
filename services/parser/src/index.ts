import pino from 'pino';
import { createClient } from '@supabase/supabase-js';

const log = pino({ name: 'parser' });

log.info('Parser process starting — phase 1 (before worker import)');

// Immediate diagnostic: write to Supabase BEFORE importing worker
// (worker.ts creates Redis connections at module scope that may crash)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY;

if (supabaseUrl && supabaseKey) {
  const sb = createClient(supabaseUrl, supabaseKey);
  sb.from('pipeline_events').insert({
    stage: 'parser_boot',
    detail: {
      phase: 'pre_worker_import',
      redis_url: process.env.REDIS_URL ? '***set***' : '***missing***',
      redis_host: process.env.REDIS_HOST ?? 'not_set',
      openai_key: process.env.OPENAI_API_KEY ? '***set***' : '***missing***',
      node_version: process.version,
      timestamp: new Date().toISOString(),
    },
  }).then(({ error }) => {
    if (error) log.error({ error }, 'Failed to log boot event');
    else log.info('Boot event logged to Supabase');
  });
}

// Now import the heavy modules
async function main(): Promise<void> {
  log.info('Phase 2: importing config...');
  const { config } = await import('./config.js');
  log.info({ redis: { host: config.redis.host, port: config.redis.port } }, 'Config loaded');

  log.info('Phase 3: importing worker...');
  const { startWorker } = await import('./worker.js');
  log.info('Worker module loaded');

  log.info('Phase 4: starting worker...');
  const worker = startWorker();
  log.info('Worker started successfully');

  // Log success to Supabase
  if (supabaseUrl && supabaseKey) {
    const sb2 = createClient(supabaseUrl, supabaseKey);
    await sb2.from('pipeline_events').insert({
      stage: 'parser_ready',
      detail: {
        redis_host: config.redis.host,
        redis_port: config.redis.port,
        has_tls: !!(config.redis as any).tls,
        queue: 'raw-messages',
        timestamp: new Date().toISOString(),
      },
    });
  }

  // Graceful shutdown
  async function shutdown(signal: string): Promise<void> {
    log.info({ signal }, 'Shutting down...');
    await worker.close();
    log.info('Worker closed — exiting');
    process.exit(0);
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  log.fatal({ err }, 'Fatal startup error');

  // Try to log the crash to Supabase
  if (supabaseUrl && supabaseKey) {
    const sb3 = createClient(supabaseUrl, supabaseKey);
    sb3.from('pipeline_events').insert({
      stage: 'parser_crash',
      detail: {
        error: String(err),
        stack: err instanceof Error ? err.stack : undefined,
        timestamp: new Date().toISOString(),
      },
    }).then(() => process.exit(1));
    // Give it 5 seconds to write
    setTimeout(() => process.exit(1), 5000);
  } else {
    process.exit(1);
  }
});

process.on('unhandledRejection', (err) => {
  log.fatal({ err }, 'Unhandled rejection');
  process.exit(1);
});
