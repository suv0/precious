import { eq, and } from 'drizzle-orm';
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

  for (const row of rows) {
    if (row.counters) {
      const model = row.counters.model ?? '*';
      const k = PerKeyRateLedger.key(row.providerId as ProviderId, model, row.id);
      ledger.load(k, {
        minuteCount: row.counters.minuteCount,
        minuteWindowStart: row.counters.minuteWindowStart,
        dayCount: row.counters.dayCount,
        dayWindowStart: row.counters.dayWindowStart,
        tokensToday: row.counters.tokensToday ?? 0,
      });
    }
  }
}

export async function persistKeyUsage(
  db: Db,
  providerKeyId: string,
  providerId: ProviderId,
  model: string,
): Promise<void> {
  const k = PerKeyRateLedger.key(providerId, model, providerKeyId);
  const snap = ledger.snapshot(k);
  if (!snap) return;

  const existing = await db
    .select()
    .from(keyUsageCounters)
    .where(
      and(
        eq(keyUsageCounters.providerKeyId, providerKeyId),
        eq(keyUsageCounters.model, model),
      ),
    )
    .limit(1);

  if (existing.length === 0) {
    await db.insert(keyUsageCounters).values({
      providerKeyId,
      model,
      minuteCount: snap.minuteCount,
      minuteWindowStart: snap.minuteWindowStart,
      dayCount: snap.dayCount,
      dayWindowStart: snap.dayWindowStart,
      tokensToday: snap.tokensToday ?? 0,
    });
  } else {
    await db
      .update(keyUsageCounters)
      .set({
        minuteCount: snap.minuteCount,
        minuteWindowStart: snap.minuteWindowStart,
        dayCount: snap.dayCount,
        dayWindowStart: snap.dayWindowStart,
        tokensToday: snap.tokensToday ?? 0,
      })
      .where(
        and(
          eq(keyUsageCounters.providerKeyId, providerKeyId),
          eq(keyUsageCounters.model, model),
        ),
      );
  }
}

export function recordKeyUsage(providerId: ProviderId, keyId: string, model: string): void {
  ledger.record(PerKeyRateLedger.key(providerId, model, keyId));
}

export function recordKeyTokens(providerId: ProviderId, keyId: string, model: string, tokens: number): void {
  ledger.recordTokens(PerKeyRateLedger.key(providerId, model, keyId), tokens);
}

export function buildKeyAvailabilityChecker(
  db: Db,
  healthMap: Map<string, KeyHealthStatus | null>,
): (providerId: ProviderId, model: string, keyId: string) => boolean {
  return (providerId, model, keyId) => {
    const health = healthMap.get(keyId);
    if (!isKeyHealthyForRouting(health ?? undefined)) return false;
    return ledger.isAvailable(PerKeyRateLedger.key(providerId, model, keyId));
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
