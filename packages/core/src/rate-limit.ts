import type { RateLimitConfig, RateLimitResult } from './types.js';

interface BucketEntry {
  minuteCount: number;
  minuteWindowStart: number;
  dayCount: number;
  dayWindowStart: number;
}

export class RateLimitLedger {
  private buckets = new Map<string, BucketEntry>();
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = config;
  }

  check(key: string, now = Date.now()): RateLimitResult {
    const bucket = this.getOrCreateBucket(key, now);
    const minuteElapsed = now - bucket.minuteWindowStart;
    const dayElapsed = now - bucket.dayWindowStart;

    if (minuteElapsed >= 60_000) {
      bucket.minuteCount = 0;
      bucket.minuteWindowStart = now;
    }
    if (dayElapsed >= 86_400_000) {
      bucket.dayCount = 0;
      bucket.dayWindowStart = now;
    }

    const rpmLimit = this.config.requestsPerMinute;
    const rpdLimit = this.config.requestsPerDay;

    if (bucket.minuteCount >= rpmLimit) {
      const resetAt = bucket.minuteWindowStart + 60_000;
      return {
        allowed: false,
        remaining: 0,
        resetAt,
        retryAfterMs: resetAt - now,
      };
    }

    if (rpdLimit !== undefined && bucket.dayCount >= rpdLimit) {
      const resetAt = bucket.dayWindowStart + 86_400_000;
      return {
        allowed: false,
        remaining: 0,
        resetAt,
        retryAfterMs: resetAt - now,
      };
    }

    bucket.minuteCount += 1;
    bucket.dayCount += 1;

    return {
      allowed: true,
      remaining: rpmLimit - bucket.minuteCount,
      resetAt: bucket.minuteWindowStart + 60_000,
    };
  }

  private getOrCreateBucket(key: string, now: number): BucketEntry {
    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = {
        minuteCount: 0,
        minuteWindowStart: now,
        dayCount: 0,
        dayWindowStart: now,
      };
      this.buckets.set(key, bucket);
    }
    return bucket;
  }

  reset(key: string): void {
    this.buckets.delete(key);
  }
}
