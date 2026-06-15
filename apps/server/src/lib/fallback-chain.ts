import { eq, asc } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { getDefaultModels } from '@precious/providers';
import type { Db } from '../db/index.js';
import { providerKeys, fallbackChain } from '../db/schema.js';

/** Ensure every provider key has fallback-chain entries for ALL of its default models (not just the first). */
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

  const existingEntries = new Set(chain.map((r) => `${r.providerId}:${r.model}`));
  let nextPriority = chain.reduce((max, r) => Math.max(max, r.priority), -1) + 1;

  // Track which providers we've already handled to avoid re-processing
  const seenProviders = new Set<string>();

  for (const key of keys) {
    if (seenProviders.has(key.providerId)) continue;

    const defaultModels = getDefaultModels(key.providerId);
    if (defaultModels.length === 0) continue;

    for (const model of defaultModels) {
      if (existingEntries.has(`${key.providerId}:${model}`)) continue;
      await db.insert(fallbackChain).values({
        id: uuidv4(),
        userId,
        providerId: key.providerId,
        model,
        priority: nextPriority,
        enabled: true,
      });
      existingEntries.add(`${key.providerId}:${model}`);
      nextPriority += 1;
    }

    seenProviders.add(key.providerId);
  }
}
