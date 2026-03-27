import Redis from 'ioredis';
import { config } from './config.js';
import { logger } from './logger.js';

let redis: Redis | null = null;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

function getRedis(): Redis {
  if (!redis) {
    redis = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      maxRetriesPerRequest: null,
      lazyConnect: true,
      ...((config.redis as any).tls ? { tls: {} } : {}),
  ...((config.redis as any).username ? { username: (config.redis as any).username } : {}),
    });

    redis.on('error', (err) => {
      logger.error({ err }, 'Health Redis connection error');
    });
  }
  return redis;
}

async function sendHeartbeat(): Promise<void> {
  try {
    const r = getRedis();
    await r.set(
      config.health.heartbeatKey,
      JSON.stringify({
        timestamp: Date.now(),
        accountId: config.whatsapp.accountId,
        status: 'alive',
      }),
      'EX',
      config.health.heartbeatTtlSeconds
    );
    logger.debug('Heartbeat sent');
  } catch (err) {
    logger.error({ err }, 'Failed to send heartbeat');
  }
}

export async function startHeartbeat(): Promise<void> {
  const r = getRedis();
  await r.connect();
  logger.info(
    { intervalMs: config.health.heartbeatIntervalMs },
    'Starting heartbeat'
  );

  // Send immediately, then on interval
  await sendHeartbeat();
  heartbeatTimer = setInterval(sendHeartbeat, config.health.heartbeatIntervalMs);
}

export async function stopHeartbeat(): Promise<void> {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
  if (redis) {
    await redis.quit();
    redis = null;
  }
  logger.info('Heartbeat stopped');
}
