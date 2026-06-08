import { eq, asc } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { getDefaultModels } from '@precious/providers';
import type { Db } from '../db/index.js';
import { providerKeys, fallbackChain } from '../db/schema.js';

/** Ensure every provider key has a fallback-chain entry (fixes older installs). */
export async function ensureFallbackChainForKeys(db: Db, userId: string): Promise<void> {
  const keys = await db
    .select({ providerId: providerKeys.providerId })
    .from(providerKeys)
    .where(eq(providerKeys.userId, userId));

  if (keys.length === 0) return;

  const chain = await db
    .select()
    .from(fallbackChain)
    .where(eq(fallbackChain.userId, userId))
    .orderBy(asc(fallbackChain.priority));

  const providersInChain = new Set(chain.map((r) => r.providerId));
  let nextPriority = chain.reduce((max, r) => Math.max(max, r.priority), -1) + 1;

  for (const key of keys) {
    if (providersInChain.has(key.providerId)) continue;
    await db.insert(fallbackChain).values({
      id: uuidv4(),
      userId,
      providerId: key.providerId,
      model: getDefaultModels(key.providerId)[0] ?? 'default',
      priority: nextPriority,
      enabled: true,
    });
    providersInChain.add(key.providerId);
    nextPriority += 1;
  }
}
