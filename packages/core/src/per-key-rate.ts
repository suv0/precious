import type { ProviderId, RateLimitConfig } from './types.js';

export interface KeyUsageSnapshot {
  minuteCount: number;
  minuteWindowStart: number;
  dayCount: number;
  dayWindowStart: number;
}

interface BucketEntry extends KeyUsageSnapshot {}

/**
 * Per-(provider, model, keyId) RPM/RPD tracking.
 * Used proactively before calling upstream APIs.
 */
export class PerKeyRateLedger {
  private buckets = new Map<string, BucketEntry>();
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = config;
  }

  static key(providerId: ProviderId, model: string, keyId: string): string {
    return `${providerId}:${model}:${keyId}`;
  }

  /** Hydrate from persisted counters (e.g. SQLite) */
  load(key: string, snapshot: KeyUsageSnapshot): void {
    this.buckets.set(key, { ...snapshot });
  }

  snapshot(key: string): KeyUsageSnapshot | undefined {
    const b = this.buckets.get(key);
    return b ? { ...b } : undefined;
  }

  isAvailable(key: string, now = Date.now()): boolean {
    const bucket = this.getOrCreateBucket(key, now);
    this.rollWindows(bucket, now);
    const rpmLimit = this.config.requestsPerMinute;
    const rpdLimit = this.config.requestsPerDay;
    if (bucket.minuteCount >= rpmLimit) return false;
    if (rpdLimit !== undefined && bucket.dayCount >= rpdLimit) return false;
    return true;
  }

  record(key: string, now = Date.now()): void {
    const bucket = this.getOrCreateBucket(key, now);
    this.rollWindows(bucket, now);
    bucket.minuteCount += 1;
    bucket.dayCount += 1;
  }

  private rollWindows(bucket: BucketEntry, now: number): void {
    if (now - bucket.minuteWindowStart >= 60_000) {
      bucket.minuteCount = 0;
      bucket.minuteWindowStart = now;
    }
    if (now - bucket.dayWindowStart >= 86_400_000) {
      bucket.dayCount = 0;
      bucket.dayWindowStart = now;
    }
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
}
