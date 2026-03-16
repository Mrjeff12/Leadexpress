import { createHash } from 'crypto';
import type Redis from 'ioredis';
import { config } from './config.js';

const DEDUP_PREFIX = 'dedup:lead:';

/**
 * Normalise raw message text for consistent hashing:
 * lowercase, trim, collapse whitespace.
 */
function normalise(text: string): string {
  return text.toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * SHA-256 hash of the normalised message text.
 */
export function contentHash(text: string): string {
  return createHash('sha256').update(normalise(text)).digest('hex');
}

/**
 * Returns true if this content has already been seen (duplicate).
 * Uses Redis SET NX with a TTL so entries expire after the dedup window.
 */
export async function isDuplicate(redis: Redis, text: string): Promise<{ duplicate: boolean; hash: string }> {
  const hash = contentHash(text);
  const key = `${DEDUP_PREFIX}${hash}`;

  // SET key 1 NX EX ttl — returns "OK" on first set, null if key already exists
  const result = await redis.set(key, '1', 'EX', config.dedup.ttlSeconds, 'NX');
  return { duplicate: result === null, hash };
}
