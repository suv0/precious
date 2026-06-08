import { buildUsageSummary, type UsageSummary, PerKeyRateLedger } from '@precious/core';
import { eq } from 'drizzle-orm';
import { DEFAULT_KEY_RATE_LIMITS, type ProviderId } from '@precious/core';
import type { Db } from '../db/index.js';
import { keyUsageCounters, providerKeys } from '../db/schema.js';
import { getKeyRateLedger, hydrateKeyRateLedger } from './key-usage.js';

export async function getUsageSummaryForUser(db: Db, userId: string): Promise<UsageSummary> {
  await hydrateKeyRateLedger(db, userId);
  const ledger = getKeyRateLedger();

  const rows = await db
    .select({
      id: providerKeys.id,
      providerId: providerKeys.providerId,
      minuteCount: keyUsageCounters.minuteCount,
      minuteWindowStart: keyUsageCounters.minuteWindowStart,
      dayCount: keyUsageCounters.dayCount,
      dayWindowStart: keyUsageCounters.dayWindowStart,
    })
    .from(providerKeys)
    .leftJoin(keyUsageCounters, eq(keyUsageCounters.providerKeyId, providerKeys.id))
    .where(eq(providerKeys.userId, userId));

  const keys = rows.map((row) => {
    const k = PerKeyRateLedger.key(row.providerId as ProviderId, '*', row.id);
    const live = ledger.snapshot(k);
    return {
      providerId: row.providerId as ProviderId,
      snapshot:
        live ??
        (row.dayCount != null
          ? {
              minuteCount: row.minuteCount ?? 0,
              minuteWindowStart: row.minuteWindowStart ?? Date.now(),
              dayCount: row.dayCount ?? 0,
              dayWindowStart: row.dayWindowStart ?? Date.now(),
            }
          : undefined),
    };
  });

  return buildUsageSummary(keys, Date.now(), DEFAULT_KEY_RATE_LIMITS);
}
