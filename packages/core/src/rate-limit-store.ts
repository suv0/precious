import type { RateLimitSnapshot } from './types.js';

const store = new Map<string, RateLimitSnapshot>();

function storeKey(userId: string, providerId: string): string {
  return `${userId}:${providerId}`;
}

export function setLiveRateLimit(
  userId: string,
  providerId: string,
  snap: RateLimitSnapshot,
): void {
  store.set(storeKey(userId, providerId), snap);
}

export function getLiveRateLimit(
  userId: string,
  providerId: string,
): RateLimitSnapshot | undefined {
  return store.get(storeKey(userId, providerId));
}

export function getAllLiveLimits(userId: string): Map<string, RateLimitSnapshot> {
  const result = new Map<string, RateLimitSnapshot>();
  const prefix = `${userId}:`;
  for (const [key, val] of store) {
    if (key.startsWith(prefix)) {
      result.set(key.slice(prefix.length), val);
    }
  }
  return result;
}
