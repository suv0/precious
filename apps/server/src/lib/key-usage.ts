import { eq } from 'drizzle-orm';
import {
  PerKeyRateLedger,
  DEFAULT_KEY_RATE_LIMITS,
  isKeyHealthyForRouting,
  type ProviderId,
  type KeyHealthStatus,
} from '@precious/core';
import type { Db } from '../db/index.js';
import { keyUsageCounters, providerKeys } from '../db/schema.js';

const ledger = new PerKeyRateLedger(DEFAULT_KEY_RATE_LIMITS);

export function getKeyRateLedger(): PerKeyRateLedger {
  return ledger;
}

export async function hydrateKeyRateLedger(db: Db, userId: string): Promise<void> {
  const rows = await db
    .select({
      id: providerKeys.id,
      providerId: providerKeys.providerId,
      counters: keyUsageCounters,
    })
    .from(providerKeys)
    .leftJoin(keyUsageCounters, eq(keyUsageCounters.providerKeyId, providerKeys.id))
    .where(eq(providerKeys.userId, userId));

  const now = Date.now();
  for (const row of rows) {
    const k = PerKeyRateLedger.key(row.providerId as ProviderId, '*', row.id);
    if (row.counters) {
      ledger.load(k, {
        minuteCount: row.counters.minuteCount,
        minuteWindowStart: row.counters.minuteWindowStart,
        dayCount: row.counters.dayCount,
        dayWindowStart: row.counters.dayWindowStart,
      });
    }
  }
}

export async function persistKeyUsage(
  db: Db,
  providerKeyId: string,
  providerId: ProviderId,
): Promise<void> {
  const k = PerKeyRateLedger.key(providerId, '*', providerKeyId);
  const snap = ledger.snapshot(k);
  if (!snap) return;

  const existing = await db
    .select()
    .from(keyUsageCounters)
    .where(eq(keyUsageCounters.providerKeyId, providerKeyId))
    .limit(1);

  if (existing.length === 0) {
    await db.insert(keyUsageCounters).values({
      providerKeyId,
      minuteCount: snap.minuteCount,
      minuteWindowStart: snap.minuteWindowStart,
      dayCount: snap.dayCount,
      dayWindowStart: snap.dayWindowStart,
    });
  } else {
    await db
      .update(keyUsageCounters)
      .set({
        minuteCount: snap.minuteCount,
        minuteWindowStart: snap.minuteWindowStart,
        dayCount: snap.dayCount,
        dayWindowStart: snap.dayWindowStart,
      })
      .where(eq(keyUsageCounters.providerKeyId, providerKeyId));
  }
}

export function recordKeyUsage(providerId: ProviderId, keyId: string): void {
  ledger.record(PerKeyRateLedger.key(providerId, '*', keyId));
}

export function buildKeyAvailabilityChecker(
  db: Db,
  healthMap: Map<string, KeyHealthStatus | null>,
): (providerId: ProviderId, _model: string, keyId: string) => boolean {
  return (providerId, _model, keyId) => {
    const health = healthMap.get(keyId);
    if (!isKeyHealthyForRouting(health ?? undefined)) return false;
    return ledger.isAvailable(PerKeyRateLedger.key(providerId, '*', keyId));
  };
}

export async function loadKeyHealthMap(
  db: Db,
  userId: string,
): Promise<Map<string, KeyHealthStatus | null>> {
  const rows = await db
    .select({ id: providerKeys.id, healthStatus: providerKeys.healthStatus })
    .from(providerKeys)
    .where(eq(providerKeys.userId, userId));

  const map = new Map<string, KeyHealthStatus | null>();
  for (const row of rows) {
    map.set(row.id, (row.healthStatus as KeyHealthStatus) ?? 'unknown');
  }
  return map;
}
